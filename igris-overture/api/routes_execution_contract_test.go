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
