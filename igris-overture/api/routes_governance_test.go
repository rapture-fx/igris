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

func TestGovernanceSummaryIncludesRejectedRuntimeCallbackCounts(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_700_010_000, 0).UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRow(),
		{columns: []string{"verified", "failed", "verified_tasks", "partial_tasks"}, rows: [][]driver.Value{{int64(3), int64(1), int64(2), int64(1)}}},
		{columns: []string{"denied", "approval", "blocked_tasks"}, rows: [][]driver.Value{{int64(2), int64(1), int64(2)}}},
		{columns: []string{"count"}, rows: [][]driver.Value{{int64(9)}}},
		{columns: []string{"count", "last_1h", "last_24h"}, rows: [][]driver.Value{{int64(5), int64(2), int64(4)}}},
		{columns: []string{"key", "count", "last_24h"}, rows: [][]driver.Value{
			{"runtime callback replay detected", int64(3), int64(3)},
			{"runtime callback timestamp outside freshness window", int64(2), int64(1)},
		}},
		{columns: []string{"key", "count", "last_24h"}, rows: [][]driver.Value{
			{"runtime-a", int64(4), int64(3)},
			{"unknown", int64(1), int64(1)},
		}},
		{columns: []string{"key", "count", "last_24h"}, rows: [][]driver.Value{
			{"complete", int64(3), int64(2)},
			{"failed", int64(2), int64(2)},
		}},
		{columns: []string{"count"}, rows: [][]driver.Value{{int64(1)}}},
		{columns: []string{"running", "approval", "recovering", "failed"}, rows: [][]driver.Value{{int64(4), int64(1), int64(0), int64(2)}}},
		{columns: []string{"kind", "category", "task_id", "runtime_id", "severity", "reason", "created_at"}, rows: [][]driver.Value{{
			"boundary_violation", "boundary", uuid.New().String(), "runtime-a", "critical", "runtime callback replay detected", now,
		}}},
	})

	app := fiber.New()
	RegisterGovernanceRoutes(app, db)
	req := httptest.NewRequest(http.MethodGet, "/v1/execution/governance/summary", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		TrustSummary struct {
			BoundaryViolations       int `json:"boundary_violations"`
			RejectedRuntimeCallbacks int `json:"rejected_runtime_callbacks"`
		} `json:"trust_summary"`
		RuntimeCallbackRejections struct {
			Total    int `json:"total"`
			Last1h   int `json:"last_1h"`
			Last24h  int `json:"last_24h"`
			ByReason []struct {
				Key     string
				Count   int
				Last24h int `json:"last_24h"`
			} `json:"by_reason"`
			ByRuntimeID []struct {
				Key     string
				Count   int
				Last24h int `json:"last_24h"`
			} `json:"by_runtime_id"`
			ByCallbackType []struct {
				Key     string
				Count   int
				Last24h int `json:"last_24h"`
			} `json:"by_callback_type"`
		} `json:"runtime_callback_rejections"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 9, body.TrustSummary.BoundaryViolations)
	require.Equal(t, 5, body.TrustSummary.RejectedRuntimeCallbacks)
	require.Equal(t, 5, body.RuntimeCallbackRejections.Total)
	require.Equal(t, 2, body.RuntimeCallbackRejections.Last1h)
	require.Equal(t, 4, body.RuntimeCallbackRejections.Last24h)
	require.Equal(t, "runtime callback replay detected", body.RuntimeCallbackRejections.ByReason[0].Key)
	require.Equal(t, 3, body.RuntimeCallbackRejections.ByReason[0].Count)
	require.Equal(t, "runtime-a", body.RuntimeCallbackRejections.ByRuntimeID[0].Key)
	require.Equal(t, "complete", body.RuntimeCallbackRejections.ByCallbackType[0].Key)
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

func TestGovernanceRuntimesEndpointReturnsSafeSummaries(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_700_000_200, 0).UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRow(),
		{
			columns: []string{
				"runtime_id", "capabilities", "last_seen", "status", "is_healthy", "endpoint",
				"active_execution_count", "recent_execution_count", "boundary_count",
				"violation_count", "handoff_count", "verified_proof_count",
				"failed_verification_count", "portability_same_runtime_only",
				"portability_compatible_runtime", "portability_any_runtime", "count",
			},
			rows: [][]driver.Value{{
				"runtime-1", []byte(`["tools.github.issues.write"]`), now, "active", true, "https://runtime.test",
				int64(1), int64(3), int64(2), int64(0), int64(1), int64(4), int64(0),
				int64(1), int64(0), int64(0), int64(1),
			}},
		},
	})

	app := fiber.New()
	RegisterGovernanceRoutes(app, db)
	req := httptest.NewRequest(http.MethodGet, "/v1/execution/governance/runtimes?limit=10", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "hostname")
	require.NotContains(t, string(raw), "ip_address")
	require.NotContains(t, string(raw), "public_key")
	require.NotContains(t, string(raw), "endpoint")

	var body struct {
		Items []struct {
			RuntimeID      string `json:"runtime_id"`
			RuntimeLabel   string `json:"runtime_label"`
			Routable       bool   `json:"routable"`
			TrustState     string `json:"trust_state"`
			BoundaryCount  int    `json:"boundary_count"`
			ViolationCount int    `json:"violation_count"`
		} `json:"items"`
		Total int `json:"total"`
	}
	require.NoError(t, json.Unmarshal(raw, &body))
	require.Equal(t, 1, body.Total)
	require.Equal(t, "runtime-1", body.Items[0].RuntimeID)
	require.Equal(t, "runtime-1", body.Items[0].RuntimeLabel)
	require.True(t, body.Items[0].Routable)
	require.Equal(t, "trusted", body.Items[0].TrustState)
	require.Equal(t, 2, body.Items[0].BoundaryCount)
	require.Equal(t, 0, body.Items[0].ViolationCount)
	require.Zero(t, drv.remainingQueries())
}
