package internal

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// ============================================================================
// Mock repository
// ============================================================================

type mockRepo struct {
	mu      sync.Mutex
	healthy []RuntimeInstance
	all     []RuntimeInstance
	updates map[string]bool // runtimeID -> last healthy value
}

func newMockRepo(healthy, all []RuntimeInstance) *mockRepo {
	return &mockRepo{healthy: healthy, all: all, updates: make(map[string]bool)}
}

func (m *mockRepo) ListHealthy(_ context.Context) ([]RuntimeInstance, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]RuntimeInstance, len(m.healthy))
	copy(out, m.healthy)
	return out, nil
}

func (m *mockRepo) ListAll(_ context.Context) ([]RuntimeInstance, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]RuntimeInstance, len(m.all))
	copy(out, m.all)
	return out, nil
}

func (m *mockRepo) UpdateHealth(_ context.Context, runtimeID string, healthy bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updates[runtimeID] = healthy
	return nil
}

func (m *mockRepo) getUpdate(id string) (bool, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.updates[id]
	return v, ok
}

// ============================================================================
// Mock runtime server helpers
// ============================================================================

// newHealthyRuntimeServer returns an httptest.Server that:
//   - GET /v1/health → 200
//   - POST /v1/runtime/task/submit → 200 with minimal task response
func newHealthyRuntimeServer(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/v1/runtime/task/submit", func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"task_id":         "exec-test",
			"steps_completed": 1,
			"steps_total":     1,
			"status":          "completed",
			"final_output":    "hello",
			"usage": map[string]interface{}{
				"prompt_tokens":     1,
				"completion_tokens": 1,
				"total_tokens":      2,
			},
			"execution_envelope": map[string]interface{}{
				"execution_id":     "exec-selector",
				"finish_reason":    "stop",
				"model":            "mock",
				"request_hash":     "aabb",
				"response_hash":    "ccdd",
				"routing_decision": "runtime",
				"timestamp":        "2026-02-20T12:00:00Z",
				"signature":        "placeholder",
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})
	mux.HandleFunc("/v1/runtime/task/stream", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("X-Igris-Runtime-Task-Id", "stream-task-test")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data: {\"id\":\"chunk-1\"}\n\n"))
	})
	return httptest.NewServer(mux)
}

// newUnhealthyRuntimeServer returns a server whose /v1/health always returns 503.
func newUnhealthyRuntimeServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
}

// ============================================================================
// Tests
// ============================================================================

// TestSelector_EdgeHealthy_Selected verifies that when a healthy edge runtime
// is registered, ForwardExecution succeeds and the circuit breaker stays closed.
func TestSelector_EdgeHealthy_Selected(t *testing.T) {
	srv := newHealthyRuntimeServer(t)
	defer srv.Close()

	edge := RuntimeInstance{RuntimeID: "edge-1", Endpoint: srv.URL, IsEdge: true, IsHealthy: true}
	repo := newMockRepo([]RuntimeInstance{edge}, nil)
	sel := NewRuntimeSelector(repo)

	req := &models.InferRequest{Model: "mock", Messages: []models.Message{{Role: "user", Content: "hi"}}}
	resp, err := sel.ForwardExecution(context.Background(), "tenant-1", req, "")
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}

	// Circuit breaker should still be closed after a success.
	state := sel.breakers.GetState("edge-1")
	if state.String() != "closed" {
		t.Errorf("expected circuit closed, got %s", state)
	}
}

// TestSelector_EdgeUnhealthy_FallbackToCloud verifies that when the edge
// circuit is open, the selector falls back to a cloud (is_edge=false) runtime.
func TestSelector_EdgeUnhealthy_FallbackToCloud(t *testing.T) {
	cloudSrv := newHealthyRuntimeServer(t)
	defer cloudSrv.Close()

	edge := RuntimeInstance{RuntimeID: "edge-2", Endpoint: "http://127.0.0.1:1", IsEdge: true, IsHealthy: true}
	cloud := RuntimeInstance{RuntimeID: "cloud-1", Endpoint: cloudSrv.URL, IsEdge: false, IsHealthy: true}

	// ListHealthy returns edge first (is_edge DESC ordering), then cloud.
	repo := newMockRepo([]RuntimeInstance{edge, cloud}, nil)
	sel := NewRuntimeSelector(repo)

	// Trip the edge circuit breaker by recording 3 failures.
	for i := 0; i < 3; i++ {
		sel.breakers.RecordFailure("edge-2")
	}

	req := &models.InferRequest{Model: "mock", Messages: []models.Message{{Role: "user", Content: "hi"}}}
	resp, err := sel.ForwardExecution(context.Background(), "tenant-1", req, "")
	if err != nil {
		t.Fatalf("expected cloud fallback success, got: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
}

// TestSelector_NoRuntime_Returns503 verifies that an empty registry produces
// an error that the caller can map to 503 / direct routing fallback.
func TestSelector_NoRuntime_Returns503(t *testing.T) {
	repo := newMockRepo(nil, nil)
	sel := NewRuntimeSelector(repo)

	req := &models.InferRequest{Model: "mock", Messages: []models.Message{{Role: "user", Content: "hi"}}}
	_, err := sel.ForwardExecution(context.Background(), "tenant-1", req, "")
	if err == nil {
		t.Fatal("expected error when no runtimes registered")
	}
}

// TestSelector_HealthPoll_UpdatesDB verifies that pollHealth correctly marks
// a reachable runtime healthy and an unreachable one unhealthy.
func TestSelector_HealthPoll_UpdatesDB(t *testing.T) {
	healthySrv := newHealthyRuntimeServer(t)
	defer healthySrv.Close()

	unhealthySrv := newUnhealthyRuntimeServer(t)
	defer unhealthySrv.Close()

	all := []RuntimeInstance{
		{RuntimeID: "rt-healthy", Endpoint: healthySrv.URL, IsEdge: true},
		{RuntimeID: "rt-sick", Endpoint: unhealthySrv.URL, IsEdge: false},
	}
	repo := newMockRepo(nil, all)
	sel := NewRuntimeSelector(repo)

	sel.pollHealth(context.Background())

	if v, ok := repo.getUpdate("rt-healthy"); !ok || !v {
		t.Errorf("expected rt-healthy to be marked healthy, got ok=%v v=%v", ok, v)
	}
	if v, ok := repo.getUpdate("rt-sick"); !ok || v {
		t.Errorf("expected rt-sick to be marked unhealthy, got ok=%v v=%v", ok, v)
	}
}
