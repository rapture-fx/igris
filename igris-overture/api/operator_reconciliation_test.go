package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestDecodeOperatorReconciliationRequest(t *testing.T) {
	requestID := uuid.New()
	req, parsedID, err := decodeOperatorReconciliationRequest([]byte(`{
		"request_id":"` + requestID.String() + `",
		"resolution":"confirmed_succeeded",
		"reason":"Provider transaction was independently verified",
		"external_reference":{"type":"transaction_id","value":"txn-123"}
	}`))
	require.NoError(t, err)
	require.Equal(t, requestID, parsedID)
	require.Equal(t, reconciliationSucceeded, req.Resolution)

	for _, body := range []string{
		`{"request_id":"` + requestID.String() + `","resolution":"succeeded","reason":"checked"}`,
		`{"request_id":"` + requestID.String() + `","resolution":"confirmed_failed","reason":"Bearer private-token"}`,
		`{"request_id":"` + requestID.String() + `","resolution":"confirmed_failed","reason":"checked","operator_id":"client-spoofed"}`,
		`{"request_id":"` + requestID.String() + `","resolution":"confirmed_failed","reason":"checked","external_reference":{"type":"transaction_id","value":"bad value with spaces"}}`,
	} {
		_, _, err := decodeOperatorReconciliationRequest([]byte(body))
		require.Error(t, err, "body must fail closed: %s", body)
	}
}

func TestReconciliationEligibilityNeverParsesHumanFailureText(t *testing.T) {
	require.False(t, coordinator.IsTypedReconciliationFailure(
		&coordinator.TaskFailureDetails{
			Source:        "runtime",
			RejectionType: "step_failed",
			Message:       "unknown_effect_state reconciliation_required idempotency_unresolved",
		},
	))
	details := typedReconciliationFailure()
	require.True(t, coordinator.IsTypedReconciliationFailure(details))
	details.TargetResponseDigest = "not-a-digest"
	require.False(t, coordinator.IsTypedReconciliationFailure(details))
}

func TestAttachOperatorReconciliationProofPreservesClaimBoundaries(t *testing.T) {
	eventID := uuid.New()
	taskID := uuid.New()
	state := &operatorReconciliationState{
		Required:     false,
		CurrentState: reconciliationSucceeded,
		History: []operatorReconciliationEvent{{
			ID: eventID, TaskID: taskID, Resolution: reconciliationSucceeded,
		}},
	}
	resp := fiber.Map{
		"igris_run_proof": fiber.Map{
			"run_id": taskID.String(),
			"statuses": fiber.Map{
				"runtime_proof_status":   "verified",
				"run_linkage_status":     "eligible_linked",
				"action_evidence_status": "linked",
			},
			"runtime_proof": fiber.Map{"claim_type": "runtime_receipt", "status": "verified"},
			"action_protocol_evidence": fiber.Map{
				"claim_type": "action_protocol_evidence", "verification_status": "verified",
			},
		},
		"linked_proof": fiber.Map{},
	}

	attachOperatorReconciliationProof(resp, state)

	proof := resp["igris_run_proof"].(fiber.Map)
	claim := proof["operator_reconciliation"].(fiber.Map)
	require.Equal(t, "operator_reconciliation", claim["claim_type"])
	require.Equal(t, "operator_attestation", claim["claim_nature"])
	require.Equal(t, false, claim["cryptographic_proof"])
	require.Equal(t, reconciliationSucceeded, claim["current_resolution"])
	require.Contains(t, claim["claim_boundary"], "does not prove")
	require.Equal(t, "runtime_receipt", proof["runtime_proof"].(fiber.Map)["claim_type"])
	require.Equal(
		t,
		"action_protocol_evidence",
		proof["action_protocol_evidence"].(fiber.Map)["claim_type"],
	)
	statuses := proof["statuses"].(fiber.Map)
	require.Equal(t, "verified", statuses["runtime_proof_status"])
	require.Equal(t, "eligible_linked", statuses["run_linkage_status"])
	require.Equal(t, reconciliationSucceeded, statuses["reconciliation_status"])
}

func TestAuthorizedHistoryIsAttributableButRunProofOmitsActorIdentity(t *testing.T) {
	taskID := uuid.New()
	state := &operatorReconciliationState{
		CurrentState: reconciliationRemainsUnknown,
		Required:     true,
		History: []operatorReconciliationEvent{{
			ID: uuid.New(), TaskID: taskID, EventType: "operator_resolution",
			ObservedEffectState: "unknown_effect_state",
			Resolution:          reconciliationRemainsUnknown,
			ActorType:           "operator",
			ActorID:             "operator-1",
			ActorEmail:          "operator@example.test",
		}},
	}
	history := operatorReconciliationResponse(taskID, state, true)["history"].([]fiber.Map)
	actor := history[0]["actor"].(fiber.Map)
	require.Equal(t, "operator-1", actor["id"])
	require.Equal(t, "operator@example.test", actor["email"])

	proofClaim := reconciliationProofClaim(state, "/history")
	require.NotContains(t, proofClaim, "actor")
	require.NotContains(t, proofClaim, "operator_id")
}

func TestReconciliationEndpointsRequireAdminOperator(t *testing.T) {
	taskID := uuid.New()
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		if c.Get("X-Test-Tenant") != "" {
			c.Locals("clerk_user_id", c.Get("X-Test-Tenant"))
			c.Locals("tenant", &middleware.TenantContext{
				TenantID: c.Get("X-Test-Tenant"),
				IsAdmin:  false,
			})
		}
		return c.Next()
	})
	app.Get("/v1/actions/runs/:id/reconciliation", handleActionReconciliationGet(nil, nil))
	app.Post("/v1/actions/runs/:id/reconciliation", handleActionReconciliationAppend(nil, nil))

	for _, method := range []string{http.MethodGet, http.MethodPost} {
		req := httptest.NewRequest(
			method,
			"/v1/actions/runs/"+taskID.String()+"/reconciliation",
			strings.NewReader(`{}`),
		)
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		var body map[string]interface{}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		require.Equal(t, "not_authorized", body["error"])

		req = httptest.NewRequest(
			method,
			"/v1/actions/runs/"+taskID.String()+"/reconciliation",
			strings.NewReader(`{}`),
		)
		req.Header.Set("X-Test-Tenant", "tenant-a")
		resp, err = app.Test(req, -1)
		require.NoError(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		require.Equal(t, "not_authorized", body["error"])
	}
}
