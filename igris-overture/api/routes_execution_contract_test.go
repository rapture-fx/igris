package api

import (
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
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
	if run.RuntimeID != "runtime-1" {
		t.Fatalf("RuntimeID = %q, want runtime-1", run.RuntimeID)
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
	if detail.RuntimeID != "runtime-9" {
		t.Fatalf("RuntimeID = %q, want runtime-9", detail.RuntimeID)
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

func TestListRunsIncludesInferenceRecordsWithExecutionContextVerification(t *testing.T) {
	t.Parallel()

	startedAt := time.Date(2026, 5, 3, 13, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: []string{
				"execution_id", "agent_id", "device_id", "timestamp_utc", "wall_time_ms",
				"violation_occurred", "status", "pause_reason", "prompt_preview", "id",
				"receipt_hash", "previous_hash", "signature", "proof_status",
			},
			rows: [][]driver.Value{{
				"exec-infer-1",
				"tenant-infer",
				"runtime-infer-1",
				startedAt,
				int64(36),
				false,
				"completed",
				"",
				"hello runtime",
				"row-infer-1",
				"receipt-hash-infer-1",
				"receipt-hash-prev-0",
				"receipt-sig-infer-1",
				"verified",
			}},
		},
	})

	handler := NewExecutionHandler(db)
	app := fiber.New()
	app.Get("/v1/execution/runs", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-infer")
		return handler.ListRuns(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/execution/runs?limit=20&range=24h", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var runs []ExecutionRun
	if err := json.NewDecoder(resp.Body).Decode(&runs); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("len(runs) = %d, want 1", len(runs))
	}
	if runs[0].VerificationStatus != "verified" {
		t.Fatalf("VerificationStatus = %q, want verified", runs[0].VerificationStatus)
	}
	if runs[0].RuntimeID != "runtime-infer-1" {
		t.Fatalf("RuntimeID = %q, want runtime-infer-1", runs[0].RuntimeID)
	}
	if runs[0].ReceiptHash != "receipt-hash-infer-1" {
		t.Fatalf("ReceiptHash = %q, want receipt-hash-infer-1", runs[0].ReceiptHash)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestGetRunDetailSupportsInferenceRecordWithoutTaskID(t *testing.T) {
	t.Parallel()

	startedAt := time.Date(2026, 5, 3, 13, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: []string{
				"execution_id", "agent_id", "device_id", "timestamp_utc", "wall_time_ms",
				"violation_occurred", "status", "pause_reason", "prompt_preview", "id",
				"receipt_hash", "previous_hash", "signature", "proof_status", "violation_details",
				"context_provider", "context_route_decision", "context_execution_path", "context_runtime_label",
				"context_fallback_used", "context_fallback_reason", "context_policy_snapshot",
				"context_capability_snapshot", "context_events", "context_logs",
				"execution_envelope", "permission_envelope", "task_failure_reason", "task_failure_details",
				"created_at", "dispatched_at", "completed_at", "canceled_at",
			},
			rows: [][]driver.Value{{
				"exec-infer-1",
				"tenant-infer",
				"runtime-infer-1",
				startedAt,
				int64(36),
				false,
				"completed",
				"",
				"hello runtime",
				"row-infer-1",
				"receipt-hash-infer-1",
				"receipt-hash-prev-0",
				"receipt-sig-infer-1",
				"verified",
				nil,
				"local-mock-cloud",
				"forwarded_to_runtime_task",
				"runtime_task",
				"http://runtime.test",
				false,
				"",
				[]byte(`{"bounds_applied":{"max_tick_ms":1000}}`),
				nil,
				[]byte(`[{"timestamp":"2026-05-03T13:00:00Z","kind":"runtime_execution","message":"Runtime execution completed"}]`),
				[]byte(`["2026-05-03T13:00:00Z runtime_execution: Runtime execution completed"]`),
				nil,
				nil,
				"",
				nil,
				nil,
				nil,
				nil,
				nil,
			}},
		},
	})

	handler := NewExecutionHandler(db)
	app := fiber.New()
	app.Get("/v1/execution/runs/:id", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-infer")
		return handler.GetRunDetail(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/execution/runs/exec-infer-1", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var detail ExecutionRunDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if detail.Provider == nil || *detail.Provider != "local-mock-cloud" {
		t.Fatalf("Provider = %v, want local-mock-cloud", detail.Provider)
	}
	if detail.ProviderPath == nil || *detail.ProviderPath != "runtime_task" {
		t.Fatalf("ProviderPath = %v, want runtime_task", detail.ProviderPath)
	}
	if detail.RuntimeLabel == nil || *detail.RuntimeLabel != "http://runtime.test" {
		t.Fatalf("RuntimeLabel = %v, want http://runtime.test", detail.RuntimeLabel)
	}
	if detail.RuntimeID != "runtime-infer-1" {
		t.Fatalf("RuntimeID = %q, want runtime-infer-1", detail.RuntimeID)
	}
	if detail.VerificationStatus != "verified" {
		t.Fatalf("VerificationStatus = %q, want verified", detail.VerificationStatus)
	}
	if len(detail.Events) != 1 {
		t.Fatalf("len(Events) = %d, want 1", len(detail.Events))
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}
