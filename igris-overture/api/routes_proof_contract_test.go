package api

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestExpectedHashFromVerifyRequest(t *testing.T) {
	req := VerifyReceiptRequest{Hash: "hash-a"}
	if got := expectedHashFromVerifyRequest(req); got != "hash-a" {
		t.Fatalf("expectedHashFromVerifyRequest() = %q, want %q", got, "hash-a")
	}

	req = VerifyReceiptRequest{ExpectedHash: "hash-b", Hash: "hash-a"}
	if got := expectedHashFromVerifyRequest(req); got != "hash-b" {
		t.Fatalf("expectedHashFromVerifyRequest() preferred hash = %q, want %q", got, "hash-b")
	}
}

func TestReceiptVerificationStatus(t *testing.T) {
	tests := []struct {
		name        string
		proofStatus string
		hash        string
		want        string
	}{
		{name: "verified proof", proofStatus: "verified", hash: "hash-1", want: "verified"},
		{name: "present receipt", hash: "hash-1", want: "present"},
		{name: "missing receipt", want: "missing"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := receiptVerificationStatus(test.proofStatus, test.hash); got != test.want {
				t.Fatalf("receiptVerificationStatus() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestParsePolicyViolationDetails(t *testing.T) {
	raw, err := json.Marshal(map[string]any{
		"violation_type":     "TICK_TIMEOUT",
		"severity":           "critical",
		"policy_rule":        "max_tick_ms",
		"action_taken":       "terminated",
		"execution_state":    "VIOLATION",
		"bound_violated":     "max_tick_ms",
		"expected":           1000,
		"actual":             1247,
		"containment_result": "contained",
	})
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	meta := parsePolicyViolationDetails(raw)
	if meta.ViolationType != "TICK_TIMEOUT" {
		t.Fatalf("ViolationType = %q, want %q", meta.ViolationType, "TICK_TIMEOUT")
	}
	if meta.PolicyRule != "max_tick_ms" {
		t.Fatalf("PolicyRule = %q, want %q", meta.PolicyRule, "max_tick_ms")
	}
	if meta.LimitValue == nil || *meta.LimitValue != 1000 {
		t.Fatalf("LimitValue = %v, want 1000", meta.LimitValue)
	}
	if meta.ObservedValue == nil || *meta.ObservedValue != 1247 {
		t.Fatalf("ObservedValue = %v, want 1247", meta.ObservedValue)
	}
}

func TestBuildReceiptViolationRecordFallback(t *testing.T) {
	record := buildReceiptViolationRecord(time.Unix(0, 0).UTC(), nil)
	if record.ViolationType != "violation_recorded" {
		t.Fatalf("ViolationType = %q, want %q", record.ViolationType, "violation_recorded")
	}
}

func TestListReceiptsIncludesRuntimeIdentity(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2026, 5, 4, 10, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: []string{
				"id", "execution_id", "agent_id", "runtime_id", "runtime_label", "timestamp_utc",
				"receipt_hash", "previous_hash", "signature", "cpu_time_ms", "memory_peak_mb",
				"tool_calls", "wall_time_ms", "violation_occurred", "proof_status", "violation_details",
			},
			rows: [][]driver.Value{{
				"receipt-row-1",
				"exec-runtime-1",
				"tenant-runtime",
				"runtime-backed-1",
				"http://runtime.test",
				timestamp,
				"receipt-hash-1",
				"receipt-hash-0",
				"receipt-signature-1",
				int64(12),
				int64(48),
				int64(1),
				int64(36),
				false,
				"verified",
				nil,
			}},
		},
	})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Get("/proof/receipts", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-runtime")
		return handler.ListReceipts(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/proof/receipts?limit=20", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var receipts []ProofReceipt
	if err := json.NewDecoder(resp.Body).Decode(&receipts); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(receipts) != 1 {
		t.Fatalf("len(receipts) = %d, want 1", len(receipts))
	}
	if receipts[0].RuntimeID != "runtime-backed-1" {
		t.Fatalf("RuntimeID = %q, want runtime-backed-1", receipts[0].RuntimeID)
	}
	if receipts[0].RuntimeLabel != "http://runtime.test" {
		t.Fatalf("RuntimeLabel = %q, want http://runtime.test", receipts[0].RuntimeLabel)
	}
	if receipts[0].DeviceID != receipts[0].RuntimeID {
		t.Fatalf("DeviceID = %q, want same as RuntimeID %q", receipts[0].DeviceID, receipts[0].RuntimeID)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestListReceiptsHistoricalRowWithoutRuntimeIdentityRemainsValid(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2026, 5, 4, 11, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: []string{
				"id", "execution_id", "agent_id", "runtime_id", "runtime_label", "timestamp_utc",
				"receipt_hash", "previous_hash", "signature", "cpu_time_ms", "memory_peak_mb",
				"tool_calls", "wall_time_ms", "violation_occurred", "proof_status", "violation_details",
			},
			rows: [][]driver.Value{{
				"receipt-row-2",
				"exec-legacy-2",
				"tenant-legacy",
				"",
				"",
				timestamp,
				"receipt-hash-2",
				"",
				"receipt-signature-2",
				int64(0),
				int64(0),
				int64(0),
				int64(14),
				false,
				"present",
				nil,
			}},
		},
	})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Get("/proof/receipts", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-legacy")
		return handler.ListReceipts(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/proof/receipts?limit=20", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var receipts []ProofReceipt
	if err := json.NewDecoder(resp.Body).Decode(&receipts); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(receipts) != 1 {
		t.Fatalf("len(receipts) = %d, want 1", len(receipts))
	}
	if receipts[0].RuntimeID != "" {
		t.Fatalf("RuntimeID = %q, want empty string", receipts[0].RuntimeID)
	}
	if receipts[0].RuntimeLabel != "" {
		t.Fatalf("RuntimeLabel = %q, want empty string", receipts[0].RuntimeLabel)
	}
	if receipts[0].Hash != "receipt-hash-2" {
		t.Fatalf("Hash = %q, want receipt-hash-2", receipts[0].Hash)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

// TestListReceiptsHandlesEmptyReceiptHashAfterCoalesce locks in the
// post-COALESCE contract: a receipt row with empty receipt_hash (a sparse
// shape that COALESCE collapses NULL into) must return verification_status
// "missing" and serialize as a valid 200 response — not 500.
func TestListReceiptsHandlesEmptyReceiptHashAfterCoalesce(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2026, 5, 10, 12, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{true, true, false, true}},
		},
		{
			columns: []string{
				"id", "execution_id", "agent_id", "runtime_id", "runtime_label", "timestamp_utc",
				"receipt_hash", "previous_hash", "signature", "cpu_time_ms", "memory_peak_mb",
				"tool_calls", "wall_time_ms", "violation_occurred", "proof_status", "violation_details",
			},
			rows: [][]driver.Value{{
				"receipt-empty-1",
				"exec-empty-1",
				"tenant-empty",
				"",
				"",
				timestamp,
				"",         // post-COALESCE empty hash
				"",         // post-COALESCE empty previous hash
				"",         // post-COALESCE empty signature
				int64(0),   // post-COALESCE zero metrics
				int64(0),
				int64(0),
				int64(0),
				false,      // post-COALESCE false
				"",
				nil,
			}},
		},
	})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Get("/proof/receipts", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-empty")
		return handler.ListReceipts(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/proof/receipts?limit=20", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var receipts []ProofReceipt
	if err := json.NewDecoder(resp.Body).Decode(&receipts); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(receipts) != 1 {
		t.Fatalf("len(receipts) = %d, want 1", len(receipts))
	}
	if receipts[0].VerificationStatus != "missing" {
		t.Fatalf("VerificationStatus = %q, want missing", receipts[0].VerificationStatus)
	}
	if receipts[0].Signed {
		t.Fatalf("Signed = true, want false for empty signature")
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestVerifyReceiptResponseIncludesRuntimeIdentityWhenAvailable(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: []string{"id", "runtime_id", "runtime_label", "receipt_hash", "signature", "proof_status"},
			rows: [][]driver.Value{{
				"receipt-row-3",
				"runtime-verify-3",
				"http://runtime.verify",
				"receipt-hash-3",
				"receipt-signature-3",
				"verified",
			}},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Post("/proof/receipts/verify", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-verify")
		return handler.VerifyReceipt(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/proof/receipts/verify", bytes.NewBufferString(`{
		"execution_id":"exec-verify-3",
		"expected_hash":"receipt-hash-3",
		"signature":"receipt-signature-3"
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var result VerifyReceiptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if !result.Verified {
		t.Fatalf("Verified = false, want true")
	}
	if result.RuntimeID != "runtime-verify-3" {
		t.Fatalf("RuntimeID = %q, want runtime-verify-3", result.RuntimeID)
	}
	if result.RuntimeLabel != "http://runtime.verify" {
		t.Fatalf("RuntimeLabel = %q, want http://runtime.verify", result.RuntimeLabel)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestVerifyReceiptResponseRemainsBackwardCompatibleWithoutRuntimeIdentity(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: []string{"id", "runtime_id", "runtime_label", "receipt_hash", "signature", "proof_status"},
			rows: [][]driver.Value{{
				"receipt-row-4",
				"",
				"",
				"receipt-hash-4",
				"receipt-signature-4",
				"present",
			}},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Post("/proof/receipts/verify", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-verify")
		return handler.VerifyReceipt(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/proof/receipts/verify", bytes.NewBufferString(`{
		"execution_id":"exec-verify-4",
		"expected_hash":"receipt-hash-4"
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var result VerifyReceiptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if !result.Verified {
		t.Fatalf("Verified = false, want true")
	}
	if result.RuntimeID != "" {
		t.Fatalf("RuntimeID = %q, want empty string", result.RuntimeID)
	}
	if result.RuntimeLabel != "" {
		t.Fatalf("RuntimeLabel = %q, want empty string", result.RuntimeLabel)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}
