package policy

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewControlSurface(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.Enabled = true

	cs := NewControlSurface(config)
	if cs == nil {
		t.Fatal("Expected non-nil control surface")
	}

	policy := cs.GetCurrentPolicy()
	if policy.Version != 0 {
		t.Errorf("Expected initial version 0, got %d", policy.Version)
	}
}

func TestPolicyUpdate(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.AuthEnabled = false // Disable auth for testing
	cs := NewControlSurface(config)

	update := PolicyUpdate{
		Routing: RoutingPolicy{
			PrimaryEndpoint:         "test-primary",
			FallbackEndpoint:        "test-fallback",
			TrafficSplit:            0.9,
			CircuitBreakerThreshold: 15,
			TimeoutMS:               3000,
		},
		Batching: BatchingPolicy{
			BatchSize:          64,
			MaxWaitMS:          20,
			DynamicSizing:      false,
			TimeoutThresholdMS: 100,
		},
		Confidence: 0.95,
		TriggerMetrics: TelemetryData{
			AvgLatencyMS:  120.0,
			CacheHitRate:  0.97,
			ThroughputRPS: 500.0,
			ErrorRate:     0.005,
		},
	}

	body, _ := json.Marshal(update)
	req := httptest.NewRequest(http.MethodPost, "/policy/update", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := cs.server.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Verify policy was updated
	current := cs.GetCurrentPolicy()
	if current.Version != 1 {
		t.Errorf("Expected version 1, got %d", current.Version)
	}

	if current.Batching.BatchSize != 64 {
		t.Errorf("Expected batch size 64, got %d", current.Batching.BatchSize)
	}
}

func TestPolicyInspect(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.AuthEnabled = false
	cs := NewControlSurface(config)

	req := httptest.NewRequest(http.MethodGet, "/policy/inspect", nil)
	resp, err := cs.server.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["status"] != "success" {
		t.Error("Expected success status")
	}

	if result["policy"] == nil {
		t.Error("Expected policy in response")
	}
}

func TestPolicyRollback(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.AuthEnabled = false
	cs := NewControlSurface(config)

	// Create a policy update first
	update := PolicyUpdate{
		Routing: RoutingPolicy{
			PrimaryEndpoint:         "updated",
			FallbackEndpoint:        "fallback",
			TrafficSplit:            0.9,
			CircuitBreakerThreshold: 20,
			TimeoutMS:               4000,
		},
		Batching: BatchingPolicy{
			BatchSize:     48,
			MaxWaitMS:     15,
			DynamicSizing: true,
		},
		Confidence: 0.9,
	}

	body, _ := json.Marshal(update)
	req := httptest.NewRequest(http.MethodPost, "/policy/update", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	cs.server.Test(req)

	// Now rollback to version 0
	rollbackReq := map[string]interface{}{
		"version": 0,
	}
	rollbackBody, _ := json.Marshal(rollbackReq)
	req = httptest.NewRequest(http.MethodPost, "/policy/rollback", bytes.NewReader(rollbackBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := cs.server.Test(req)
	if err != nil {
		t.Fatalf("Rollback request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Verify rollback succeeded
	current := cs.GetCurrentPolicy()
	if current.Routing.PrimaryEndpoint != "default" {
		t.Errorf("Expected rollback to default policy, got %s", current.Routing.PrimaryEndpoint)
	}
}

func TestPolicyMetrics(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.AuthEnabled = false
	cs := NewControlSurface(config)

	// Perform some updates to generate metrics
	for i := 0; i < 3; i++ {
		update := PolicyUpdate{
			Routing:    RoutingPolicy{PrimaryEndpoint: "test", FallbackEndpoint: "fallback", TrafficSplit: 0.8, TimeoutMS: 5000},
			Batching:   BatchingPolicy{BatchSize: 32, MaxWaitMS: 10},
			Confidence: 0.9,
		}
		body, _ := json.Marshal(update)
		req := httptest.NewRequest(http.MethodPost, "/policy/update", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		cs.server.Test(req)
		time.Sleep(10 * time.Millisecond)
	}

	req := httptest.NewRequest(http.MethodGet, "/policy/metrics", nil)
	resp, err := cs.server.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	metrics := result["metrics"].(map[string]interface{})
	if metrics["total_updates"].(float64) != 3 {
		t.Errorf("Expected 3 total updates, got %v", metrics["total_updates"])
	}
}

func TestPolicyValidation(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.AuthEnabled = false
	cs := NewControlSurface(config)

	tests := []struct {
		name    string
		update  PolicyUpdate
		wantErr bool
	}{
		{
			name: "valid update",
			update: PolicyUpdate{
				Routing:    RoutingPolicy{PrimaryEndpoint: "test", FallbackEndpoint: "fallback", TrafficSplit: 0.7, TimeoutMS: 3000},
				Batching:   BatchingPolicy{BatchSize: 32, MaxWaitMS: 10},
				Confidence: 0.9,
			},
			wantErr: false,
		},
		{
			name: "invalid traffic split",
			update: PolicyUpdate{
				Routing:    RoutingPolicy{PrimaryEndpoint: "test", FallbackEndpoint: "fallback", TrafficSplit: 1.5, TimeoutMS: 3000},
				Batching:   BatchingPolicy{BatchSize: 32, MaxWaitMS: 10},
				Confidence: 0.9,
			},
			wantErr: true,
		},
		{
			name: "invalid batch size",
			update: PolicyUpdate{
				Routing:    RoutingPolicy{PrimaryEndpoint: "test", FallbackEndpoint: "fallback", TrafficSplit: 0.8, TimeoutMS: 3000},
				Batching:   BatchingPolicy{BatchSize: 500, MaxWaitMS: 10},
				Confidence: 0.9,
			},
			wantErr: true,
		},
		{
			name: "invalid confidence",
			update: PolicyUpdate{
				Routing:    RoutingPolicy{PrimaryEndpoint: "test", FallbackEndpoint: "fallback", TrafficSplit: 0.8, TimeoutMS: 3000},
				Batching:   BatchingPolicy{BatchSize: 32, MaxWaitMS: 10},
				Confidence: 1.5,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.update)
			req := httptest.NewRequest(http.MethodPost, "/policy/update", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			resp, err := cs.server.Test(req)
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			if tt.wantErr && resp.StatusCode == http.StatusOK {
				t.Error("Expected error but got success")
			}

			if !tt.wantErr && resp.StatusCode != http.StatusOK {
				t.Errorf("Expected success but got status %d", resp.StatusCode)
			}
		})
	}
}

func TestHealthEndpoint(t *testing.T) {
	config := DefaultControlSurfaceConfig()
	config.AuthEnabled = false
	cs := NewControlSurface(config)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	resp, err := cs.server.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["status"] != "healthy" {
		t.Error("Expected healthy status")
	}
}
