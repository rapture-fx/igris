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
						"reason":"task_execution_completed"
					}`)),
				}, nil
			}),
		},
	}

	if err := client.CancelTask(context.Background(), uuid.Nil, "tenant-1"); err != nil {
		t.Fatalf("CancelTask() error = %v, want nil", err)
	}
}
