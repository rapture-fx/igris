package api

import (
	"testing"
	"time"
)

func TestBuildExecutionRunSummary(t *testing.T) {
	startedAt := time.Date(2026, 5, 3, 10, 0, 0, 0, time.UTC)
	record := executionRunRecord{
		ID:                  "exec-123",
		AgentID:             "agent-1",
		DeviceID:            "runtime-1",
		StartedAt:           startedAt,
		DurationMs:          1500,
		HasViolation:        false,
		Status:              "completed",
		PromptPreview:       "hello",
		ReceiptID:           "receipt-1",
		ReceiptHash:         "hash-1",
		ReceiptPreviousHash: "hash-0",
		ReceiptSignature:    "sig-1",
		ProofStatus:         "verified",
	}

	run := buildExecutionRunSummary(record)
	if run.Status != "COMPLETED" {
		t.Fatalf("Status = %q, want %q", run.Status, "COMPLETED")
	}
	if run.EndedAt == nil {
		t.Fatal("EndedAt = nil, want value")
	}
	if got := run.EndedAt.UTC().Format(time.RFC3339Nano); got != startedAt.Add(1500*time.Millisecond).Format(time.RFC3339Nano) {
		t.Fatalf("EndedAt = %q, want %q", got, startedAt.Add(1500*time.Millisecond).Format(time.RFC3339Nano))
	}
	if run.VerificationStatus != "verified" {
		t.Fatalf("VerificationStatus = %q, want %q", run.VerificationStatus, "verified")
	}
}

func TestBuildExecutionRunDetailUsesEmptyCollections(t *testing.T) {
	record := executionRunRecord{
		ID:           "exec-456",
		AgentID:      "agent-2",
		StartedAt:    time.Date(2026, 5, 3, 11, 0, 0, 0, time.UTC),
		HasViolation: false,
		Status:       "running",
	}

	detail := buildExecutionRunDetail(record)
	if detail.Receipt != nil {
		t.Fatalf("Receipt = %#v, want nil", detail.Receipt)
	}
	if detail.Violations == nil || len(detail.Violations) != 0 {
		t.Fatalf("Violations = %#v, want empty slice", detail.Violations)
	}
	if detail.Events == nil || len(detail.Events) != 0 {
		t.Fatalf("Events = %#v, want empty slice", detail.Events)
	}
	if detail.Logs == nil || len(detail.Logs) != 0 {
		t.Fatalf("Logs = %#v, want empty slice", detail.Logs)
	}
}

func TestBuildExecutionRunDetailIncludesPersistedContext(t *testing.T) {
	record := executionRunRecord{
		ID:                   "exec-789",
		AgentID:              "agent-3",
		DeviceID:             "runtime-9",
		StartedAt:            time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC),
		DurationMs:           4200,
		Status:               "completed",
		ReceiptID:            "receipt-9",
		ReceiptHash:          "hash-9",
		ReceiptSignature:     "sig-9",
		ProofStatus:          "verified",
		ContextProvider:      "openai",
		ContextRouteDecision: "runtime:tool:github.issues.write",
		ContextExecutionPath: "runtime_tool",
		ContextRuntimeLabel:  "http://runtime.internal",
		ContextFallbackUsed:  false,
		ContextPolicySnapshot: []byte(`{
			"policy_decision_id":"decision-9",
			"bounds_applied":{"max_tick_ms":1000}
		}`),
		ContextCapabilitySnapshot: []byte(`{
			"required_capabilities":["tools.github.issues.write"],
			"granted_capability_count":1
		}`),
		ContextEvents: []byte(`[
			{"timestamp":"2026-05-03T12:00:00Z","kind":"task_created","message":"Task accepted by Overture"}
		]`),
		ContextLogs: []byte(`["2026-05-03T12:00:00Z task_created: Task accepted by Overture"]`),
	}

	detail := buildExecutionRunDetail(record)
	if detail.Provider == nil || *detail.Provider != "openai" {
		t.Fatalf("Provider = %v, want openai", detail.Provider)
	}
	if detail.ProviderPath == nil || *detail.ProviderPath != "runtime_tool" {
		t.Fatalf("ProviderPath = %v, want runtime_tool", detail.ProviderPath)
	}
	if detail.RuntimeLabel == nil || *detail.RuntimeLabel != "http://runtime.internal" {
		t.Fatalf("RuntimeLabel = %v, want http://runtime.internal", detail.RuntimeLabel)
	}
	if detail.PolicySnapshot == nil {
		t.Fatal("PolicySnapshot = nil, want value")
	}
	if detail.CapabilitySnapshot == nil {
		t.Fatal("CapabilitySnapshot = nil, want value")
	}
	if len(detail.Events) != 1 {
		t.Fatalf("Events length = %d, want 1", len(detail.Events))
	}
	if len(detail.Logs) != 1 {
		t.Fatalf("Logs length = %d, want 1", len(detail.Logs))
	}
}
