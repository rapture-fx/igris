package internal

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
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
