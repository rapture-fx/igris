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

	"github.com/Igris-inertial/system/igris-overture/internal"
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

// verifyReceiptColumns matches the receipt-verify SELECT shape after we
// upgraded the endpoint to do fresh cryptographic verification.
var verifyReceiptColumns = []string{
	"id", "execution_id", "agent_id", "runtime_id", "runtime_label",
	"transaction_id", "transaction_hash",
	"cpu_time_ms", "wall_time_ms", "memory_peak_mb", "fs_bytes_written", "tool_calls",
	"violation_occurred",
	"receipt_hash", "previous_hash", "signature", "timestamp_utc",
	"runtime_public_key", "proof_status",
}

func TestVerifyReceiptStoredValuesAloneCannotMarkVerifiedTrue(t *testing.T) {
	t.Parallel()

	// Stored hash and signature are arbitrary strings, not a real Ed25519
	// signature; with the new contract verified=true only when fresh
	// cryptographic verification succeeds. Even though the request supplies
	// matching values, verified must be false.
	timestamp := time.Date(2026, 5, 10, 12, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: verifyReceiptColumns,
			rows: [][]driver.Value{{
				"receipt-row-3",
				"exec-verify-3",
				"agent-verify",
				"runtime-verify-3",
				"http://runtime.verify",
				"",
				"",
				int64(0), int64(0), int64(0), int64(0), int64(0),
				false,
				"receipt-hash-3",
				"",
				"receipt-signature-3", // not a real Ed25519 signature
				timestamp,
				"", // no runtime public key in registry
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
	if result.Verified {
		t.Fatalf("Verified = true, want false — stored-value comparison alone must not pass cryptographic verification")
	}
	if result.RuntimeID != "runtime-verify-3" {
		t.Fatalf("RuntimeID = %q, want runtime-verify-3", result.RuntimeID)
	}
	if result.RuntimeKeyFound == nil || *result.RuntimeKeyFound {
		t.Fatalf("RuntimeKeyFound = %v, want pointer to false (no key in registry, no env)", result.RuntimeKeyFound)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestVerifyReceiptReturnsCleanlyWithoutRuntimeIdentity(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2026, 5, 10, 12, 30, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: verifyReceiptColumns,
			rows: [][]driver.Value{{
				"receipt-row-4",
				"exec-verify-4",
				"agent-verify",
				"",
				"",
				"",
				"",
				int64(0), int64(0), int64(0), int64(0), int64(0),
				false,
				"receipt-hash-4",
				"",
				"receipt-signature-4",
				timestamp,
				"",
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
	if result.Verified {
		t.Fatalf("Verified = true, want false — no runtime key, no signature, must not verify")
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

// chainPriorRowColumns matches the SELECT shape used by fetchReceiptForChain
// (the prior-receipt lookup for chain-link verification).
var chainPriorRowColumns = []string{
	"id", "execution_id", "agent_id", "runtime_id", "runtime_label",
	"transaction_id", "transaction_hash",
	"cpu_time_ms", "wall_time_ms", "memory_peak_mb", "fs_bytes_written", "tool_calls",
	"violation_occurred",
	"receipt_hash", "previous_hash", "signature", "timestamp_utc",
	"runtime_public_key", "proof_status",
}

// makeChainTestPriorRow builds a driver row whose canonical hash, when
// re-derived by ComputeCanonicalReceiptHash, equals the supplied hash. We
// compute the hash directly from the same canonical helper to keep the test
// in lockstep with the runtime's BTreeMap form.
func makeChainTestPriorRow(t *testing.T, executionID, agentID string, timestamp time.Time) ([]driver.Value, string) {
	t.Helper()
	receipt := map[string]interface{}{
		"execution_id":       executionID,
		"agent_id":           agentID,
		"cpu_time_ms":        int64(0),
		"wall_time_ms":       int64(0),
		"memory_peak_mb":     int64(0),
		"fs_bytes_written":   int64(0),
		"tool_calls":         int64(0),
		"violation_occurred": false,
		"timestamp_utc":      timestamp.UTC().Format(time.RFC3339Nano),
		"previous_hash":      "",
	}
	hash, err := internal.ComputeCanonicalReceiptHash(receipt)
	if err != nil {
		t.Fatalf("ComputeCanonicalReceiptHash() error = %v", err)
	}
	row := []driver.Value{
		"prior-row-id",
		executionID,
		agentID,
		"", // runtime_id (not part of canonical when empty)
		"", // runtime_label
		"", // transaction_id
		"", // transaction_hash
		int64(0), int64(0), int64(0), int64(0), int64(0),
		false,
		hash, // receipt_hash
		"",   // previous_hash empty (this prior row is genesis)
		"",   // signature
		timestamp,
		"", // runtime_public_key
		"", // proof_status
	}
	return row, hash
}

func TestVerifyReceiptChainLinkGenesisIsValid(t *testing.T) {
	t.Parallel()

	// Genesis receipt: previous_hash is empty. The chain check should not
	// query the database and must report ChainValid=true.
	timestamp := time.Date(2026, 5, 10, 13, 0, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: verifyReceiptColumns,
			rows: [][]driver.Value{{
				"receipt-genesis",
				"exec-genesis",
				"agent-genesis",
				"", "", "", "",
				int64(0), int64(0), int64(0), int64(0), int64(0),
				false,
				"any-hash",
				"", // previous_hash empty → genesis
				"",
				timestamp,
				"", "",
			}},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Post("/proof/receipts/verify", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-genesis")
		return handler.VerifyReceipt(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/proof/receipts/verify", bytes.NewBufferString(`{"execution_id":"exec-genesis"}`))
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
	if result.ChainValid == nil || !*result.ChainValid {
		t.Fatalf("ChainValid = %v, want pointer to true for genesis receipt", result.ChainValid)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestVerifyReceiptChainLinkVerifiesPriorReceipt(t *testing.T) {
	t.Parallel()

	priorTimestamp := time.Date(2026, 5, 10, 13, 0, 0, 0, time.UTC)
	priorRow, priorHash := makeChainTestPriorRow(t, "exec-prior", "agent-prior", priorTimestamp)
	currentTimestamp := time.Date(2026, 5, 10, 13, 5, 0, 0, time.UTC)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: verifyReceiptColumns,
			rows: [][]driver.Value{{
				"receipt-current",
				"exec-current",
				"agent-current",
				"", "", "", "",
				int64(0), int64(0), int64(0), int64(0), int64(0),
				false,
				"current-hash",
				priorHash, // previous_hash points at prior row's canonical hash
				"",
				currentTimestamp,
				"", "",
			}},
		},
		{
			columns: chainPriorRowColumns,
			rows:    [][]driver.Value{priorRow},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Post("/proof/receipts/verify", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-chain")
		return handler.VerifyReceipt(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/proof/receipts/verify", bytes.NewBufferString(`{"execution_id":"exec-current"}`))
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
	if result.ChainValid == nil || !*result.ChainValid {
		t.Fatalf("ChainValid = %v, want pointer to true when prior canonical hash matches", result.ChainValid)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestVerifyReceiptChainLinkRejectsMissingPriorReceipt(t *testing.T) {
	t.Parallel()

	currentTimestamp := time.Date(2026, 5, 10, 13, 10, 0, 0, time.UTC)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: verifyReceiptColumns,
			rows: [][]driver.Value{{
				"receipt-orphan",
				"exec-orphan",
				"agent-orphan",
				"", "", "", "",
				int64(0), int64(0), int64(0), int64(0), int64(0),
				false,
				"orphan-hash",
				"missing-prior-hash", // pointer to a hash with no row
				"",
				currentTimestamp,
				"", "",
			}},
		},
		// Empty result for the chain lookup → sql.ErrNoRows path.
		{
			columns: chainPriorRowColumns,
			rows:    [][]driver.Value{},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Post("/proof/receipts/verify", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-chain")
		return handler.VerifyReceipt(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/proof/receipts/verify", bytes.NewBufferString(`{"execution_id":"exec-orphan"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d (must be 200, never 500)", resp.StatusCode, http.StatusOK)
	}

	var result VerifyReceiptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if result.ChainValid == nil || *result.ChainValid {
		t.Fatalf("ChainValid = %v, want pointer to false when prior row missing", result.ChainValid)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}

func TestVerifyReceiptChainLinkRejectsTamperedPriorReceipt(t *testing.T) {
	t.Parallel()

	priorTimestamp := time.Date(2026, 5, 10, 13, 15, 0, 0, time.UTC)
	priorRow, priorHash := makeChainTestPriorRow(t, "exec-prior-tampered", "agent-prior", priorTimestamp)
	// Tamper: agent_id on the stored prior row no longer matches the
	// canonical re-derivation that was originally signed.
	tamperedRow := append([]driver.Value(nil), priorRow...)
	tamperedRow[2] = "agent-prior-tampered"
	currentTimestamp := time.Date(2026, 5, 10, 13, 20, 0, 0, time.UTC)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, true}},
		},
		{
			columns: verifyReceiptColumns,
			rows: [][]driver.Value{{
				"receipt-current",
				"exec-current",
				"agent-current",
				"", "", "", "",
				int64(0), int64(0), int64(0), int64(0), int64(0),
				false,
				"current-hash",
				priorHash, // current claims to chain to the original prior hash
				"",
				currentTimestamp,
				"", "",
			}},
		},
		{
			columns: chainPriorRowColumns,
			rows:    [][]driver.Value{tamperedRow},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Post("/proof/receipts/verify", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-chain")
		return handler.VerifyReceipt(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/proof/receipts/verify", bytes.NewBufferString(`{"execution_id":"exec-current"}`))
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
	if result.ChainValid == nil || *result.ChainValid {
		t.Fatalf("ChainValid = %v, want pointer to false when prior row tampered", result.ChainValid)
	}
	if queued.remainingQueries() != 0 || queued.remainingExecs() != 0 {
		t.Fatalf("remaining queries=%d execs=%d, want 0/0", queued.remainingQueries(), queued.remainingExecs())
	}
}
