package api

import (
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestGovernancePolicyDecisionsEndpointIsTenantScoped(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	decisionID := uuid.New()
	now := time.Unix(1_700_000_000, 0).UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRow(),
		{
			columns: []string{
				"decision_id", "tenant_id", "task_id", "agent_id", "runtime_id",
				"task_type", "action_name", "environment_label", "resource_scope",
				"risk_level", "decision", "replay_class", "irreversible", "human_gated",
				"policy_version", "policy_reason", "action_digest", "boundary_digest",
				"checkpoint_portability", "created_at", "count",
			},
			rows: [][]driver.Value{{
				decisionID.String(), testTenantID, taskID.String(), "agent-1", "runtime-1",
				"execution_graph", "tool:db_write", "tenant-runtime", "task",
				"high", "denied", "non_retryable", true, false,
				"execution-governance.builtin.v1", "irreversible action cannot be replayed",
				"action-digest", "boundary-digest", "same_runtime_only", now, int64(1),
			}},
		},
	})

	app := fiber.New()
	RegisterGovernanceRoutes(app, db)
	req := httptest.NewRequest(http.MethodGet, "/v1/execution/governance/policy-decisions?decision=denied&limit=10", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Items []struct {
			DecisionID   string `json:"decision_id"`
			TaskID       string `json:"task_id"`
			Decision     string `json:"decision"`
			ActionDigest string `json:"action_digest"`
		} `json:"items"`
		Total int `json:"total"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 1, body.Total)
	require.Len(t, body.Items, 1)
	require.Equal(t, decisionID.String(), body.Items[0].DecisionID)
	require.Equal(t, taskID.String(), body.Items[0].TaskID)
	require.Equal(t, "denied", body.Items[0].Decision)
	require.Equal(t, "action-digest", body.Items[0].ActionDigest)
	require.Zero(t, drv.remainingQueries())
}

func TestGovernanceVerificationResultsEndpointReturnsSafeSummaries(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	verificationID := uuid.New()
	now := time.Unix(1_700_000_100, 0).UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRow(),
		{
			columns: []string{
				"verification_id", "task_id", "execution_id", "runtime_id", "policy_decision_id",
				"checkpoint_digest", "action_digest", "status", "policy_compliant",
				"proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found",
				"proof_chain_link_valid", "evidence_digest", "reason", "created_at", "count",
			},
			rows: [][]driver.Value{{
				verificationID.String(), taskID.String(), "exec-1", "runtime-1", nil,
				"checkpoint-digest", "action-digest", "failed_verification", false,
				false, false, true, false, "evidence-digest", "signature mismatch", now, int64(1),
			}},
		},
	})

	app := fiber.New()
	RegisterGovernanceRoutes(app, db)
	req := httptest.NewRequest(http.MethodGet, "/v1/execution/governance/verification-results?status=failed_verification", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "resume_token")
	require.NotContains(t, string(raw), "private_key")
	require.NotContains(t, string(raw), "credential")

	var body struct {
		Items []struct {
			VerificationID  string `json:"verification_id"`
			Status          string `json:"status"`
			RuntimeKeyFound bool   `json:"runtime_key_found"`
			Reason          string `json:"reason"`
		} `json:"items"`
		Total int `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &body))
	require.Equal(t, 1, body.Total)
	require.Equal(t, verificationID.String(), body.Items[0].VerificationID)
	require.Equal(t, "failed_verification", body.Items[0].Status)
	require.True(t, body.Items[0].RuntimeKeyFound)
	require.Equal(t, "signature mismatch", body.Items[0].Reason)
	require.Zero(t, drv.remainingQueries())
}
