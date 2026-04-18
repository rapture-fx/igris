package internal

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/google/uuid"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
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
