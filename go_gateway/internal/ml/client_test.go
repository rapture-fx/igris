package ml

import (
	"context"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestNewClient_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	if client.conn == nil {
		t.Error("Expected non-nil connection")
	}
	if client.client == nil {
		t.Error("Expected non-nil gRPC client")
	}
}

func TestNewClient_InvalidAddress(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Use a channel to capture the error
	errChan := make(chan error, 1)
	go func() {
		_, err := NewClient("invalid:99999")
		errChan <- err
	}()

	select {
	case err := <-errChan:
		if err == nil {
			t.Error("Expected error for invalid address, got nil")
		}
	case <-ctx.Done():
		t.Fatal("NewClient() timed out")
	}
}

func TestClient_Predict_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0, 4.0, 5.0}
	modelId := "test-model"

	resp, err := client.Predict(ctx, features, modelId)
	if err != nil {
		t.Fatalf("Predict() error = %v", err)
	}

	if resp == nil {
		t.Fatal("Expected non-nil response")
	}

	// Mock server returns sum * 0.1 = 15.0 * 0.1 = 1.5
	expectedPrediction := 1.5
	if resp.Prediction != expectedPrediction {
		t.Errorf("Prediction = %v, want %v", resp.Prediction, expectedPrediction)
	}

	if resp.ModelId != modelId {
		t.Errorf("ModelId = %v, want %v", resp.ModelId, modelId)
	}

	if resp.Confidence <= 0 || resp.Confidence > 1 {
		t.Errorf("Confidence = %v, expected value between 0 and 1", resp.Confidence)
	}
}

func TestClient_Predict_ServerError(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	// Configure mock server to fail
	ts.MockServer.SetShouldFail(true)

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0}

	_, err = client.Predict(ctx, features, "test-model")
	if err == nil {
		t.Error("Expected error when server fails, got nil")
	}
}

func TestClient_Predict_Timeout(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	// Create context with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()

	time.Sleep(10 * time.Millisecond) // Ensure context is expired

	_, err = client.Predict(ctx, []float64{1.0}, "test-model")
	if err == nil {
		t.Error("Expected timeout error, got nil")
	}
}

func TestClient_HealthCheck_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	healthy, err := client.HealthCheck(ctx)
	if err != nil {
		t.Fatalf("HealthCheck() error = %v", err)
	}

	if !healthy {
		t.Error("Expected healthy=true, got false")
	}

	// Verify call count
	if ts.MockServer.GetHealthCallCount() != 1 {
		t.Errorf("HealthCallCount = %d, want 1", ts.MockServer.GetHealthCallCount())
	}
}

func TestClient_HealthCheck_Unhealthy(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	// Set unhealthy status
	ts.MockServer.mu.Lock()
	ts.MockServer.HealthStatus = "degraded"
	ts.MockServer.mu.Unlock()

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	healthy, err := client.HealthCheck(ctx)
	if err != nil {
		t.Fatalf("HealthCheck() error = %v", err)
	}

	if healthy {
		t.Error("Expected healthy=false for degraded status, got true")
	}
}

func TestClient_HealthCheck_ServerError(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	ts.MockServer.SetShouldFail(true)

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	_, err = client.HealthCheck(ctx)
	if err == nil {
		t.Error("Expected error when server fails, got nil")
	}

	// Verify it's an Unavailable error
	if st, ok := status.FromError(err); ok {
		if st.Code() != codes.Unavailable {
			t.Errorf("Expected Unavailable error, got %v", st.Code())
		}
	}
}

func TestClient_Close(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	client, err := NewClient(ts.Address)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	err = client.Close()
	if err != nil {
		t.Errorf("Close() error = %v", err)
	}

	// Closing again should not panic
	err = client.Close()
	if err != nil {
		t.Errorf("Close() second call error = %v", err)
	}
}
