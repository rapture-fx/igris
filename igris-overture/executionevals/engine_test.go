package executionevals

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestRunAssertionsCoversPhaseOneTypes(t *testing.T) {
	t.Parallel()

	assertions := []Assertion{
		{Name: "called", Type: TypeActionCalled, ActionName: "charge_customer"},
		{Name: "did not call refund", Type: TypeActionNotCalled, ActionName: "refund_customer"},
		{Name: "agent", Type: TypeAgentUsed, AgentID: "billing_agent"},
		{Name: "approval", Type: TypeApprovalRequired},
		{Name: "recovery", Type: TypeRecoveryOccurred},
		{Name: "proof", Type: TypeProofGenerated},
		{Name: "safe", Type: TypeNoSecretLeak},
	}
	truth := BuildExecutionTruth(
		mustUUIDForTest(t, "11111111-1111-1111-1111-111111111111"),
		"exec-1",
		"completed",
		json.RawMessage(`{"steps":[{"action":"charge_customer"}]}`),
		"",
		"",
		"billing_agent",
		true,
		true,
		true,
	)

	results, passed, failed := RunAssertions(assertions, truth)

	if passed != len(assertions) || failed != 0 {
		t.Fatalf("passed=%d failed=%d, want all pass", passed, failed)
	}
	for _, result := range results {
		if result.Status != StatusPassed {
			t.Fatalf("%s status=%s, want passed", result.Name, result.Status)
		}
		if result.Reason == "" || ContainsUnsafeMarker(json.RawMessage(result.Reason)) {
			t.Fatalf("%s reason is empty or unsafe: %q", result.Name, result.Reason)
		}
	}
}

func TestRunAssertionsReportsFailuresDeterministically(t *testing.T) {
	t.Parallel()

	assertions := []Assertion{
		{Name: "called", Type: TypeActionCalled, ActionName: "charge_customer"},
		{Name: "approval not required", Type: TypeApprovalNotRequired},
		{Name: "recovery not required", Type: TypeRecoveryNotRequired},
		{Name: "proof", Type: TypeProofGenerated},
		{Name: "safe", Type: TypeNoSecretLeak},
	}
	truth := BuildExecutionTruth(
		mustUUIDForTest(t, "22222222-2222-2222-2222-222222222222"),
		"",
		"failed",
		json.RawMessage(`{"steps":[{"action":"open_ticket"}],"api_key":"sk-live-value"}`),
		"",
		"",
		"",
		true,
		true,
		false,
	)

	results, passed, failed := RunAssertions(assertions, truth)

	if passed != 0 || failed != len(assertions) {
		t.Fatalf("passed=%d failed=%d, want all fail", passed, failed)
	}
	for _, result := range results {
		if result.Status != StatusFailed {
			t.Fatalf("%s status=%s, want failed", result.Name, result.Status)
		}
	}
}

func TestValidateAssertionsRejectsUnknownTypesAndUnsafeText(t *testing.T) {
	t.Parallel()

	if _, err := ValidateAssertions([]Assertion{{Name: "prompt leak", Type: TypeNoSecretLeak}}); err == nil {
		t.Fatal("ValidateAssertions accepted unsafe assertion name")
	}
	if _, err := ValidateAssertions([]Assertion{{Name: "score", Type: "model_score"}}); err == nil {
		t.Fatal("ValidateAssertions accepted unsupported assertion type")
	}
	if _, err := ValidateAssertions([]Assertion{{Name: "called", Type: TypeActionCalled}}); err == nil {
		t.Fatal("ValidateAssertions accepted action assertion without action_name")
	}
}

func mustUUIDForTest(t *testing.T, value string) uuid.UUID {
	t.Helper()
	id, err := uuid.Parse(value)
	if err != nil {
		t.Fatal(err)
	}
	return id
}
