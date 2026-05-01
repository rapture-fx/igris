package internal

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/google/uuid"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func signEnvelopeForTest(t *testing.T, privateKey ed25519.PrivateKey, envelope map[string]interface{}) map[string]interface{} {
	t.Helper()

	clone := make(map[string]interface{}, len(envelope)+1)
	for key, value := range envelope {
		clone[key] = value
	}
	canonBytes, err := json.Marshal(clone)
	if err != nil {
		t.Fatalf("json.Marshal(envelope) error = %v", err)
	}
	hash := sha256.Sum256(canonBytes)
	clone["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, hash[:]))
	return clone
}

func signReceiptForTest(t *testing.T, privateKey ed25519.PrivateKey, receipt map[string]interface{}) map[string]interface{} {
	t.Helper()

	clone := make(map[string]interface{}, len(receipt)+2)
	for key, value := range receipt {
		clone[key] = value
	}
	canonBytes, err := canonicalReceiptBytes(clone)
	if err != nil {
		t.Fatalf("canonicalReceiptBytes() error = %v", err)
	}
	hash := sha256.Sum256(canonBytes)
	clone["hash"] = hex.EncodeToString(hash[:])
	clone["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, hash[:]))
	return clone
}

func TestVerifyExecutionArtifactsRawRejectsUnsignedReceiptWhenPublicKeyConfigured(t *testing.T) {
	publicKey, _, err := ed25519.GenerateKey(strings.NewReader(strings.Repeat("\x01", ed25519.SeedSize)))
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	t.Setenv("IGRIS_RUNTIME_PUBLIC_KEY", hex.EncodeToString(publicKey))

	err = VerifyExecutionArtifactsRaw(nil, []byte(`{"execution_id":"exec-1","hash":"hash-1"}`))
	if err == nil {
		t.Fatal("VerifyExecutionArtifactsRaw() error = nil, want missing signature error")
	}
	if !strings.Contains(err.Error(), "execution_receipt missing signature field") {
		t.Fatalf("VerifyExecutionArtifactsRaw() error = %v, want missing signature", err)
	}
}

func TestRuntimeClientCancelTaskAcceptsConflictResponse(t *testing.T) {
	t.Parallel()

	client := &RuntimeClient{
		baseURL: "http://runtime.test",
		httpClient: &http.Client{
			Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusConflict,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(`{
						"task_id":"` + uuid.Nil.String() + `",
						"canceled":false,
						"known":true,
						"active_execution":false,
						"cancellation_allowed":false,
						"reason":"task_execution_completed",
						"checkpoint_persisted":true,
						"last_step":4,
						"checkpoint_digest":"abcd"
					}`)),
				}, nil
			}),
		},
	}

	result, err := client.CancelTask(context.Background(), uuid.Nil, "tenant-1")
	if err != nil {
		t.Fatalf("CancelTask() error = %v, want nil", err)
	}
	if result.Signaled() {
		t.Fatalf("CancelTask().Signaled() = true, want false for conflict")
	}
	payload := result.ResponsePayload()
	if payload["status_code"] != http.StatusConflict {
		t.Fatalf("status_code = %v, want %d", payload["status_code"], http.StatusConflict)
	}
	if payload["last_step"] != float64(4) {
		t.Fatalf("last_step = %v, want 4", payload["last_step"])
	}
	if payload["checkpoint_digest"] != "abcd" {
		t.Fatalf("checkpoint_digest = %v, want abcd", payload["checkpoint_digest"])
	}
}

func TestRuntimeClientOpenStreamingExecutionPreservesRuntimeErrorPayload(t *testing.T) {
	t.Parallel()

	client := &RuntimeClient{
		baseURL: "http://runtime.test",
		httpClient: &http.Client{
			Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
				if got := req.Header.Get("Accept"); got != "text/event-stream" {
					t.Fatalf("Accept = %q, want text/event-stream", got)
				}
				return &http.Response{
					StatusCode: http.StatusConflict,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(`{
						"error":{"message":"Streaming replay is only available for completed task submissions with final output","type":"stream_replay_unavailable"},
						"task":{
							"task_id":"` + uuid.Nil.String() + `",
							"status":{"status":"failed","reason":"provider stream failed"},
							"failure_details":{"source":"runtime","operation":"execution","rejection_type":"step_failed","message":"provider stream failed","step_index":0,"domain":"agent","node_id":"agent-0"}
						},
						"durability":{"mode":"streaming","resume_supported":false,"replay_supported":false,"checkpoint_persisted":false}
					}`)),
				}, nil
			}),
		},
	}

	_, err := client.OpenStreamingExecution(context.Background(), "tenant-1", &models.InferRequest{
		Model:    "gpt-4.1-mini",
		Messages: []models.Message{{Role: "user", Content: "hello"}},
	}, "")
	if err == nil {
		t.Fatal("OpenStreamingExecution() error = nil, want RuntimeStreamError")
	}
	var streamErr *models.RuntimeStreamError
	if !errors.As(err, &streamErr) {
		t.Fatalf("OpenStreamingExecution() error type = %T, want RuntimeStreamError", err)
	}
	if streamErr.StatusCode != http.StatusConflict {
		t.Fatalf("StatusCode = %d, want %d", streamErr.StatusCode, http.StatusConflict)
	}
	if got := streamErr.Type(); got != "stream_replay_unavailable" {
		t.Fatalf("Type() = %q, want stream_replay_unavailable", got)
	}
	if got := streamErr.Message(); got != "Streaming replay is only available for completed task submissions with final output" {
		t.Fatalf("Message() = %q, want runtime message", got)
	}
	taskBody, ok := streamErr.Payload["task"].(map[string]interface{})
	if !ok {
		t.Fatalf("Payload.task type = %T, want map[string]interface{}", streamErr.Payload["task"])
	}
	failureDetails, ok := taskBody["failure_details"].(map[string]interface{})
	if !ok {
		t.Fatalf("Payload.task.failure_details type = %T, want map[string]interface{}", taskBody["failure_details"])
	}
	if got := failureDetails["node_id"]; got != "agent-0" {
		t.Fatalf("failure_details.node_id = %v, want agent-0", got)
	}
}

func TestTaskSubmitResponseUnmarshalSupportsStructuredStatus(t *testing.T) {
	t.Parallel()

	var resp taskSubmitResponse
	err := json.Unmarshal([]byte(`{
		"task_id":"123e4567-e89b-12d3-a456-426614174000",
		"steps_completed":1,
		"steps_total":2,
		"status":{
			"status":"checkpointed",
			"resume_token":{
				"last_committed_step":1,
				"checkpoint_digest":"abc123",
				"runtime_id":"igris-local"
			}
		},
		"checkpoint":{
			"resume_token":{
				"last_committed_step":1,
				"checkpoint_digest":"abc123",
				"runtime_id":"igris-local"
			}
		},
		"execution_envelope":{"signature":"sig-env","routing_decision":"runtime"},
		"execution_receipt":{"signature":"sig-rcpt","hash":"receipt-hash-1"}
	}`), &resp)
	if err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	if got := resp.Status.String(); got != "checkpointed" {
		t.Fatalf("status = %q, want checkpointed", got)
	}
	if got := resp.Status.ResumeToken["runtime_id"]; got != "igris-local" {
		t.Fatalf("resume_token.runtime_id = %v, want igris-local", got)
	}
	if _, ok := resp.Checkpoint["resume_token"].(map[string]interface{}); !ok {
		t.Fatalf("checkpoint.resume_token type = %T, want map[string]interface{}", resp.Checkpoint["resume_token"])
	}
	if got := resp.ExecutionEnvelope["signature"]; got != "sig-env" {
		t.Fatalf("execution_envelope.signature = %v, want sig-env", got)
	}
	if got := resp.ExecutionReceipt["hash"]; got != "receipt-hash-1" {
		t.Fatalf("execution_receipt.hash = %v, want receipt-hash-1", got)
	}
}

func TestRuntimeClientForwardExecutionAcceptsStructuredCompletedStatus(t *testing.T) {
	t.Parallel()

	var sawPath string
	var sawTenant string
	var sawTaskType string
	publicKey, privateKey, err := ed25519.GenerateKey(strings.NewReader(strings.Repeat("\x02", ed25519.SeedSize)))
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	envelope := signEnvelopeForTest(t, privateKey, map[string]interface{}{
		"execution_id":     "exec-1",
		"routing_decision": "local-mock-cloud",
		"finish_reason":    "stop",
		"model":            "mock-model",
		"request_hash":     "req-hash-1",
		"response_hash":    "resp-hash-1",
		"tenant_id":        "tenant-structured",
		"timestamp":        "2026-05-01T10:32:21Z",
	})
	receipt := signReceiptForTest(t, privateKey, map[string]interface{}{
		"agent_id":           "tenant-structured",
		"cpu_time_ms":        0,
		"execution_id":       "exec-1",
		"fs_bytes_written":   0,
		"memory_peak_mb":     0,
		"previous_hash":      "prev-1",
		"timestamp_utc":      "2026-05-01T10:32:21Z",
		"tool_calls":         0,
		"transaction_hash":   "tx-hash-1",
		"transaction_id":     "tx-1",
		"violation_occurred": false,
		"wall_time_ms":       36,
	})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawPath = r.URL.Path
		sawTenant = r.Header.Get("X-Igris-Tenant")
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("Decode request body error = %v", err)
		}
		taskType, _ := payload["task_type"].(map[string]interface{})
		sawTaskType, _ = taskType["type"].(string)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"task_id":         "runtime-task-1",
			"steps_completed": 1,
			"steps_total":     1,
			"status": map[string]interface{}{
				"status": "completed",
			},
			"final_output": "hello unified path",
			"usage": map[string]interface{}{
				"prompt_tokens":     4,
				"completion_tokens": 7,
				"total_tokens":      11,
			},
			"execution_envelope": envelope,
			"execution_receipt":  receipt,
		})
	}))
	defer srv.Close()

	client := &RuntimeClient{
		baseURL:    srv.URL,
		publicKey:  publicKey,
		httpClient: srv.Client(),
	}
	resp, err := client.ForwardExecution(context.Background(), "tenant-structured", &models.InferRequest{
		Model:    "mock-model",
		Messages: []models.Message{{Role: "user", Content: "hello runtime"}},
	}, "")
	if err != nil {
		t.Fatalf("ForwardExecution() error = %v", err)
	}
	if sawPath != "/v1/runtime/task/submit" {
		t.Fatalf("path = %q, want /v1/runtime/task/submit", sawPath)
	}
	if sawTenant != "tenant-structured" {
		t.Fatalf("X-Igris-Tenant = %q, want tenant-structured", sawTenant)
	}
	if sawTaskType != "single_inference" {
		t.Fatalf("task_type.type = %q, want single_inference", sawTaskType)
	}
	if got := resp.GetContent(); got != "hello unified path" {
		t.Fatalf("content = %q, want hello unified path", got)
	}
	if got := resp.Metadata.Provider; got != "local-mock-cloud" {
		t.Fatalf("metadata.provider = %q, want local-mock-cloud", got)
	}
	if got := resp.Metadata.RouteDecision; got != "forwarded_to_runtime_task" {
		t.Fatalf("metadata.route_decision = %q, want forwarded_to_runtime_task", got)
	}
	if got := resp.ExecutionEnvelope["execution_id"]; got != "exec-1" {
		t.Fatalf("execution_envelope.execution_id = %v, want exec-1", got)
	}
	if got := resp.ExecutionReceipt["hash"]; got != receipt["hash"] {
		t.Fatalf("execution_receipt.hash = %v, want %v", got, receipt["hash"])
	}
	if got := resp.Receipt["receipt_hash"]; got != receipt["hash"] {
		t.Fatalf("receipt.receipt_hash = %v, want %v", got, receipt["hash"])
	}
}

func TestRuntimeClientForwardExecutionReturnsStructuredTaskErrorForNonCompletedStatus(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"task_id":         "runtime-task-2",
			"steps_completed": 0,
			"steps_total":     1,
			"status": map[string]interface{}{
				"status": "failed",
				"reason": "provider stream failed",
			},
			"failure_details": map[string]interface{}{
				"source":         "runtime",
				"operation":      "execution",
				"rejection_type": "step_failed",
				"message":        "provider stream failed",
			},
			"execution_envelope": map[string]interface{}{
				"execution_id": "exec-2",
				"signature":    "sig-env",
			},
		})
	}))
	defer srv.Close()

	client := &RuntimeClient{
		baseURL:    srv.URL,
		httpClient: srv.Client(),
	}
	_, err := client.ForwardExecution(context.Background(), "tenant-1", &models.InferRequest{
		Model:    "mock-model",
		Messages: []models.Message{{Role: "user", Content: "hello runtime"}},
	}, "")
	if err == nil {
		t.Fatal("ForwardExecution() error = nil, want RuntimeTaskError")
	}
	var taskErr *models.RuntimeTaskError
	if !errors.As(err, &taskErr) {
		t.Fatalf("ForwardExecution() error type = %T, want RuntimeTaskError", err)
	}
	if got := taskErr.Status(); got != "failed" {
		t.Fatalf("taskErr.Status() = %q, want failed", got)
	}
	if got := taskErr.Reason(); got != "provider stream failed" {
		t.Fatalf("taskErr.Reason() = %q, want provider stream failed", got)
	}
	if got := taskErr.Payload["task_id"]; got != "runtime-task-2" {
		t.Fatalf("payload.task_id = %v, want runtime-task-2", got)
	}
}
