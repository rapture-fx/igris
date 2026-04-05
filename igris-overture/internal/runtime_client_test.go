package internal

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// buildAndSignEnvelope marshals the given fields (without a "signature" key),
// SHA-256 hashes the canonical bytes, signs with priv, and attaches the
// base64-encoded signature to the map in-place.
func buildAndSignEnvelope(t *testing.T, priv ed25519.PrivateKey, fields map[string]interface{}) map[string]interface{} {
	t.Helper()
	delete(fields, "signature") // ensure clean state
	b, err := json.Marshal(fields)
	if err != nil {
		t.Fatalf("buildAndSignEnvelope: marshal: %v", err)
	}
	hash := sha256.Sum256(b)
	sig := ed25519.Sign(priv, hash[:])
	fields["signature"] = base64.StdEncoding.EncodeToString(sig)
	return fields
}

// TestVerifyEnvelope_Valid verifies that a correctly signed envelope passes
// verification without error.
func TestVerifyEnvelope_Valid(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-001",
		"finish_reason":    "stop",
		"model":            "gpt-4o",
		"request_hash":     "aabbccdd",
		"response_hash":    "eeff0011",
		"routing_decision": "openai",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyEnvelope(envelope); err != nil {
		t.Fatalf("expected nil error for valid envelope, got: %v", err)
	}
}

// TestVerifyEnvelope_Tampered verifies that modifying any field after signing
// causes verification to return an error.
func TestVerifyEnvelope_Tampered(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-002",
		"finish_reason":    "stop",
		"model":            "claude-3-5-sonnet",
		"request_hash":     "aabbccdd",
		"response_hash":    "eeff0011",
		"routing_decision": "anthropic",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	// Tamper: change the model field after signing.
	envelope["model"] = "gpt-4o"

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyEnvelope(envelope); err == nil {
		t.Fatal("expected verification error for tampered envelope, got nil")
	}
}

// TestVerifyEnvelope_NoKey verifies that when no public key is configured,
// verification is skipped and returns nil regardless of envelope content.
func TestVerifyEnvelope_NoKey(t *testing.T) {
	c := &RuntimeClient{} // publicKey is nil
	envelope := map[string]interface{}{
		"execution_id": "exec-003",
		"model":        "gpt-4o",
		"signature":    "not-a-real-signature",
	}
	if err := c.verifyEnvelope(envelope); err != nil {
		t.Fatalf("expected nil (no key configured), got: %v", err)
	}
}

// minimalTaskSubmitResponseJSON returns a JSON response body that ForwardExecution can decode.
func minimalTaskSubmitResponseJSON(t *testing.T) []byte {
	t.Helper()
	resp := map[string]interface{}{
		"task_id":         "test-id",
		"steps_completed": 1,
		"steps_total":     1,
		"status":          "completed",
		"final_output":    "hi",
		"usage": map[string]interface{}{
			"prompt_tokens":     1,
			"completion_tokens": 1,
			"total_tokens":      2,
		},
		"execution_envelope": map[string]interface{}{
			"execution_id":     "exec-minimal",
			"finish_reason":    "stop",
			"model":            "mock",
			"request_hash":     "aabb",
			"response_hash":    "ccdd",
			"routing_decision": "runtime",
			"timestamp":        "2026-02-20T12:00:00Z",
			"signature":        "placeholder",
		},
	}
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("minimalTaskSubmitResponseJSON: %v", err)
	}
	return b
}

// minimalInferRequest returns a minimal *models.InferRequest for tests.
func minimalInferRequest() *models.InferRequest {
	return &models.InferRequest{
		Model:    "mock",
		Messages: []models.Message{{Role: "user", Content: "hi"}},
	}
}

// ============================================================================
// P0-2: Bearer auth header tests
// ============================================================================

// TestRuntimeClient_BearerSent verifies that when a secret is configured,
// Authorization: Bearer <secret> is sent on every ForwardExecution call.
func TestRuntimeClient_BearerSent(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(minimalTaskSubmitResponseJSON(t))
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		secret:     "s3cr3t",
		httpClient: srv.Client(),
	}
	_, err := c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err != nil {
		t.Fatalf("ForwardExecution failed: %v", err)
	}
	if gotAuth != "Bearer s3cr3t" {
		t.Errorf("expected Authorization: Bearer s3cr3t, got %q", gotAuth)
	}
}

// TestRuntimeClient_NoBearer verifies that when no secret is configured,
// no Authorization header is sent.
func TestRuntimeClient_NoBearer(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(minimalTaskSubmitResponseJSON(t))
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		secret:     "", // no secret
		httpClient: srv.Client(),
	}
	_, err := c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err != nil {
		t.Fatalf("ForwardExecution failed: %v", err)
	}
	if gotAuth != "" {
		t.Errorf("expected no Authorization header, got %q", gotAuth)
	}
}

// ============================================================================
// P0-3: Decision signature header tests
// ============================================================================

// TestDecisionSigHeader_Sent verifies that when a signing key is configured,
// X-Igris-Decision-Sig is sent with a valid Ed25519 signature over SHA-256(body).
func TestDecisionSigHeader_Sent(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	var gotSig string
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSig = r.Header.Get("X-Igris-Decision-Sig")
		gotBody, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(minimalTaskSubmitResponseJSON(t))
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		signingKey: priv,
		httpClient: srv.Client(),
	}
	_, err = c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err != nil {
		t.Fatalf("ForwardExecution failed: %v", err)
	}
	if gotSig == "" {
		t.Fatal("expected X-Igris-Decision-Sig header to be set")
	}
	// Verify the signature is valid.
	sigBytes, err := base64.StdEncoding.DecodeString(gotSig)
	if err != nil {
		t.Fatalf("signature base64 decode: %v", err)
	}
	hash := sha256.Sum256(gotBody)
	if !ed25519.Verify(pub, hash[:], sigBytes) {
		t.Error("decision signature verification failed")
	}
}

func TestForwardExecution_StreamBypassesTaskEndpoint(t *testing.T) {
	hitServer := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hitServer = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(minimalTaskSubmitResponseJSON(t))
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		httpClient: srv.Client(),
	}

	req := minimalInferRequest()
	req.Stream = true

	_, err := c.ForwardExecution(context.Background(), "t1", req, "")
	if err == nil {
		t.Fatal("expected streaming request to be rejected by runtime task client")
	}
	if hitServer {
		t.Fatal("expected streaming request to bypass runtime task endpoint")
	}
}

func TestOpenStreamingExecution_SendsStreamingRequest(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	var gotAuth string
	var gotAccept string
	var gotSig string
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotAccept = r.Header.Get("Accept")
		gotSig = r.Header.Get("X-Igris-Decision-Sig")
		gotBody, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data: {\"id\":\"chunk-1\"}\n\n"))
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		secret:     "stream-secret",
		signingKey: priv,
		httpClient: srv.Client(),
	}

	req := minimalInferRequest()
	req.Stream = true
	resp, err := c.OpenStreamingExecution(context.Background(), "tenant-1", req)
	if err != nil {
		t.Fatalf("OpenStreamingExecution failed: %v", err)
	}
	defer resp.Body.Close()

	if gotAuth != "Bearer stream-secret" {
		t.Fatalf("expected Authorization header, got %q", gotAuth)
	}
	if gotAccept != "text/event-stream" {
		t.Fatalf("expected Accept text/event-stream, got %q", gotAccept)
	}
	if gotSig == "" {
		t.Fatal("expected X-Igris-Decision-Sig header to be set")
	}

	sigBytes, err := base64.StdEncoding.DecodeString(gotSig)
	if err != nil {
		t.Fatalf("signature base64 decode: %v", err)
	}
	hash := sha256.Sum256(gotBody)
	if !ed25519.Verify(pub, hash[:], sigBytes) {
		t.Fatal("decision signature verification failed")
	}
}

func TestOpenStreamingExecution_RejectsNonBaseMode(t *testing.T) {
	hitServer := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hitServer = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		httpClient: srv.Client(),
	}

	req := minimalInferRequest()
	req.Stream = true
	req.SpeculativeMode = "latency"

	_, err := c.OpenStreamingExecution(context.Background(), "tenant-1", req)
	if err == nil {
		t.Fatal("expected non-base streaming mode to be rejected")
	}
	if hitServer {
		t.Fatal("expected non-base streaming mode to bypass runtime stream endpoint")
	}
}

// TestDecisionSigHeader_NotSent verifies that when no signing key is configured,
// X-Igris-Decision-Sig is not sent.
func TestDecisionSigHeader_NotSent(t *testing.T) {
	var gotSig string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSig = r.Header.Get("X-Igris-Decision-Sig")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(minimalTaskSubmitResponseJSON(t))
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		httpClient: srv.Client(),
	}
	_, err := c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err != nil {
		t.Fatalf("ForwardExecution failed: %v", err)
	}
	if gotSig != "" {
		t.Errorf("expected no X-Igris-Decision-Sig header, got %q", gotSig)
	}
}

// ============================================================================
// P0-4: Execution envelope passthrough tests
// ============================================================================

// TestForwardExecution_EnvelopePassthrough verifies that a verified execution
// envelope from the Runtime is attached to the returned InferResponse.
func TestForwardExecution_EnvelopePassthrough(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	// Build a signed execution envelope.
	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-pass",
		"finish_reason":    "stop",
		"model":            "mock",
		"request_hash":     "aabb",
		"response_hash":    "ccdd",
		"routing_decision": "openai",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	// Build response JSON including the envelope.
	respPayload := map[string]interface{}{
		"task_id":            "test-id",
		"steps_completed":    1,
		"steps_total":        1,
		"status":             "completed",
		"final_output":       "hi",
		"execution_envelope": envelope,
	}
	respBytes, _ := json.Marshal(respPayload)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(respBytes)
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		publicKey:  pub,
		httpClient: srv.Client(),
	}
	resp, err := c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err != nil {
		t.Fatalf("ForwardExecution failed: %v", err)
	}
	if resp.ExecutionEnvelope == nil {
		t.Fatal("expected ExecutionEnvelope to be attached to InferResponse")
	}
	if resp.ExecutionEnvelope["execution_id"] != "exec-pass" {
		t.Errorf("unexpected execution_id in envelope: %v", resp.ExecutionEnvelope["execution_id"])
	}
}

// TestForwardExecution_TamperedEnvelope_ReturnsSecurityError verifies that
// a tampered execution envelope causes ForwardExecution to return ErrRuntimeSecurity.
func TestForwardExecution_TamperedEnvelope_ReturnsSecurityError(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id": "exec-tamper",
		"model":        "mock",
		"timestamp":    "2026-02-20T12:00:00Z",
	})
	// Tamper after signing.
	envelope["model"] = "evil-model"

	respPayload := map[string]interface{}{
		"task_id":            "test-id",
		"steps_completed":    1,
		"steps_total":        1,
		"status":             "completed",
		"final_output":       "hi",
		"execution_envelope": envelope,
	}
	respBytes, _ := json.Marshal(respPayload)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(respBytes)
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		publicKey:  pub,
		httpClient: srv.Client(),
	}
	_, err = c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err == nil {
		t.Fatal("expected error for tampered envelope, got nil")
	}
	if !errors.Is(err, models.ErrRuntimeSecurity) {
		t.Errorf("expected ErrRuntimeSecurity, got: %v", err)
	}
}

// ============================================================================
// P0-5: Security rejection does not fall back (sentinel error)
// ============================================================================

// ============================================================================
// Phase 2: ExecutionReceipt verification tests
// ============================================================================

// buildAndSignReceipt builds and signs a minimal ExecutionReceipt map using
// the same BTreeMap-canonical-JSON + SHA-256 + Ed25519 algorithm as the runtime.
func buildAndSignReceipt(t *testing.T, priv ed25519.PrivateKey, fields map[string]interface{}) map[string]interface{} {
	t.Helper()
	delete(fields, "signature")
	b, err := json.Marshal(fields)
	if err != nil {
		t.Fatalf("buildAndSignReceipt: marshal: %v", err)
	}
	hash := sha256.Sum256(b)
	sig := ed25519.Sign(priv, hash[:])
	fields["signature"] = base64.StdEncoding.EncodeToString(sig)
	return fields
}

// TestVerifyReceipt_Valid verifies that a correctly signed receipt passes.
func TestVerifyReceipt_Valid(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	receipt := buildAndSignReceipt(t, priv, map[string]interface{}{
		"execution_id":       "exec-receipt-001",
		"agent_id":           "tenant-a",
		"transaction_id":     "tx-001",
		"transaction_hash":   "abcdef01",
		"cpu_time_ms":        "0",
		"wall_time_ms":       "250",
		"memory_peak_mb":     "0",
		"fs_bytes_written":   "0",
		"tool_calls":         "0",
		"violation_occurred": "false",
		"timestamp_utc":      "2026-02-26T10:00:00Z",
		"previous_hash":      "",
	})

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyReceipt(receipt); err != nil {
		t.Fatalf("expected nil error for valid receipt, got: %v", err)
	}
}

// TestVerifyReceipt_Tampered verifies that field modification after signing fails.
func TestVerifyReceipt_Tampered(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	receipt := buildAndSignReceipt(t, priv, map[string]interface{}{
		"execution_id":       "exec-receipt-002",
		"agent_id":           "tenant-b",
		"cpu_time_ms":        "0",
		"wall_time_ms":       "100",
		"memory_peak_mb":     "0",
		"fs_bytes_written":   "0",
		"tool_calls":         "0",
		"violation_occurred": "false",
		"timestamp_utc":      "2026-02-26T10:00:00Z",
		"previous_hash":      "",
	})

	// Tamper: claim a violation did not occur when it did.
	receipt["violation_occurred"] = "true"

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyReceipt(receipt); err == nil {
		t.Fatal("expected verification error for tampered receipt, got nil")
	}
}

// TestVerifyReceipt_MissingSignature verifies that a receipt without a
// signature is rejected when a public key is configured.
func TestVerifyReceipt_MissingSignature(t *testing.T) {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	receipt := map[string]interface{}{
		"execution_id": "exec-no-sig",
		"agent_id":     "tenant-c",
	}
	// No "signature" key.

	c := &RuntimeClient{publicKey: pub}
	if err := c.verifyReceipt(receipt); err == nil {
		t.Fatal("expected error for missing signature, got nil")
	}
}

// TestVerifyReceipt_NoKey verifies that when no public key is configured,
// receipt verification is skipped (backward compatibility).
func TestVerifyReceipt_NoKey(t *testing.T) {
	c := &RuntimeClient{} // no publicKey
	receipt := map[string]interface{}{
		"execution_id": "exec-no-key",
		"agent_id":     "tenant-d",
		"signature":    "not-verified",
	}
	if err := c.verifyReceipt(receipt); err != nil {
		t.Fatalf("expected nil (no key configured), got: %v", err)
	}
}

// TestForwardExecution_ReceiptPassthrough verifies that a verified
// ExecutionReceipt is attached to the returned InferResponse.
func TestForwardExecution_ReceiptPassthrough(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	receipt := buildAndSignReceipt(t, priv, map[string]interface{}{
		"execution_id":       "exec-rcpt-pass",
		"agent_id":           "t1",
		"transaction_id":     "tx-pass-001",
		"transaction_hash":   "deadbeef",
		"cpu_time_ms":        "0",
		"wall_time_ms":       "300",
		"memory_peak_mb":     "0",
		"fs_bytes_written":   "0",
		"tool_calls":         "0",
		"violation_occurred": "false",
		"timestamp_utc":      "2026-02-26T10:00:00Z",
		"previous_hash":      "",
	})
	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-rcpt-envelope-pass",
		"finish_reason":    "stop",
		"model":            "mock",
		"request_hash":     "aabb",
		"response_hash":    "ccdd",
		"routing_decision": "openai",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	respPayload := map[string]interface{}{
		"task_id":            "test-id",
		"steps_completed":    1,
		"steps_total":        1,
		"status":             "completed",
		"final_output":       "hi",
		"execution_envelope": envelope,
		"execution_receipt":  receipt,
	}
	respBytes, _ := json.Marshal(respPayload)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(respBytes)
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		publicKey:  pub,
		httpClient: srv.Client(),
	}
	resp, err := c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err != nil {
		t.Fatalf("ForwardExecution failed: %v", err)
	}
	if resp.ExecutionReceipt == nil {
		t.Fatal("expected ExecutionReceipt to be attached to InferResponse")
	}
	if resp.ExecutionReceipt["execution_id"] != "exec-rcpt-pass" {
		t.Errorf("unexpected execution_id in receipt: %v", resp.ExecutionReceipt["execution_id"])
	}
	if resp.ExecutionReceipt["transaction_id"] != "tx-pass-001" {
		t.Errorf("unexpected transaction_id in receipt: %v", resp.ExecutionReceipt["transaction_id"])
	}
}

// TestForwardExecution_TamperedReceipt_ReturnsSecurityError verifies that a
// tampered ExecutionReceipt causes ForwardExecution to return ErrRuntimeSecurity.
func TestForwardExecution_TamperedReceipt_ReturnsSecurityError(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	receipt := buildAndSignReceipt(t, priv, map[string]interface{}{
		"execution_id":       "exec-rcpt-tamper",
		"agent_id":           "t1",
		"violation_occurred": "false",
		"timestamp_utc":      "2026-02-26T10:00:00Z",
		"previous_hash":      "",
	})
	// Tamper: claim violation did not occur.
	receipt["violation_occurred"] = "true"
	envelope := buildAndSignEnvelope(t, priv, map[string]interface{}{
		"execution_id":     "exec-rcpt-envelope-tamper",
		"finish_reason":    "stop",
		"model":            "mock",
		"request_hash":     "aabb",
		"response_hash":    "ccdd",
		"routing_decision": "openai",
		"timestamp":        "2026-02-20T12:00:00Z",
	})

	respPayload := map[string]interface{}{
		"task_id":            "test-id",
		"steps_completed":    1,
		"steps_total":        1,
		"status":             "completed",
		"final_output":       "hi",
		"execution_envelope": envelope,
		"execution_receipt":  receipt,
	}
	respBytes, _ := json.Marshal(respPayload)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(respBytes)
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		publicKey:  pub,
		httpClient: srv.Client(),
	}
	_, err = c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err == nil {
		t.Fatal("expected error for tampered receipt, got nil")
	}
	if !errors.Is(err, models.ErrRuntimeSecurity) {
		t.Errorf("expected ErrRuntimeSecurity, got: %v", err)
	}
}

// TestForwardExecution_401_ReturnsSecurityError verifies that a 401 from the
// Runtime is wrapped as ErrRuntimeSecurity (not a connectivity error).
func TestForwardExecution_401_ReturnsSecurityError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	c := &RuntimeClient{
		baseURL:    srv.URL,
		httpClient: srv.Client(),
	}
	_, err := c.ForwardExecution(context.Background(), "t1", minimalInferRequest(), "")
	if err == nil {
		t.Fatal("expected error for 401 response, got nil")
	}
	if !errors.Is(err, models.ErrRuntimeSecurity) {
		t.Errorf("expected ErrRuntimeSecurity for 401, got: %v", err)
	}
}
