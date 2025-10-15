package ml

import (
	"context"
	"fmt"
	"net"
	"sync"

	pb "github.com/schlep-engine/schlep-engine/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// MockMLServer is a mock gRPC server for testing
type MockMLServer struct {
	pb.UnimplementedMLServiceServer
	mu sync.Mutex

	// Configurable behavior
	ShouldFail       bool
	FailureError     error
	PredictLatency   int // milliseconds
	HealthStatus     string
	PredictResponse  *pb.PredictResponse
	CallCount        int
	HealthCallCount  int
}

// NewMockMLServer creates a new mock server
func NewMockMLServer() *MockMLServer {
	return &MockMLServer{
		HealthStatus: "healthy",
		PredictResponse: &pb.PredictResponse{
			Prediction: 0.95,
			Confidence: 0.87,
			ModelId:    "test-model-v1",
		},
	}
}

// Predict implements the Predict RPC method
func (m *MockMLServer) Predict(ctx context.Context, req *pb.PredictRequest) (*pb.PredictResponse, error) {
	m.mu.Lock()
	m.CallCount++
	shouldFail := m.ShouldFail
	failureError := m.FailureError
	response := m.PredictResponse
	m.mu.Unlock()

	if shouldFail {
		if failureError != nil {
			return nil, failureError
		}
		return nil, status.Error(codes.Internal, "mock server configured to fail")
	}

	// Simulate inference: sum of features * 0.1
	var sum float64
	for _, f := range req.Features {
		sum += f
	}

	return &pb.PredictResponse{
		Prediction: sum * 0.1,
		Confidence: response.Confidence,
		ModelId:    req.ModelId,
	}, nil
}

// HealthCheck implements the HealthCheck RPC method
func (m *MockMLServer) HealthCheck(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	m.mu.Lock()
	m.HealthCallCount++
	shouldFail := m.ShouldFail
	healthStatus := m.HealthStatus
	m.mu.Unlock()

	if shouldFail {
		return nil, status.Error(codes.Unavailable, "service unavailable")
	}

	return &pb.HealthCheckResponse{
		Status:  healthStatus,
		Version: "1.0.0-test",
	}, nil
}

// SetShouldFail configures the server to fail on next requests
func (m *MockMLServer) SetShouldFail(shouldFail bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ShouldFail = shouldFail
}

// SetFailureError sets a custom error to return
func (m *MockMLServer) SetFailureError(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.FailureError = err
}

// GetCallCount returns the number of Predict calls
func (m *MockMLServer) GetCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.CallCount
}

// GetHealthCallCount returns the number of HealthCheck calls
func (m *MockMLServer) GetHealthCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.HealthCallCount
}

// ResetCounts resets all call counters
func (m *MockMLServer) ResetCounts() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.CallCount = 0
	m.HealthCallCount = 0
}

// TestServer wraps the mock server with gRPC server
type TestServer struct {
	Server     *grpc.Server
	MockServer *MockMLServer
	Address    string
	listener   net.Listener
}

// StartTestServer starts a mock gRPC server on a random port
func StartTestServer() (*TestServer, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("failed to create listener: %w", err)
	}

	mockServer := NewMockMLServer()
	grpcServer := grpc.NewServer()
	pb.RegisterMLServiceServer(grpcServer, mockServer)

	ts := &TestServer{
		Server:     grpcServer,
		MockServer: mockServer,
		Address:    listener.Addr().String(),
		listener:   listener,
	}

	// Start serving in background
	go func() {
		_ = grpcServer.Serve(listener)
	}()

	return ts, nil
}

// Stop stops the test server
func (ts *TestServer) Stop() {
	if ts.Server != nil {
		ts.Server.GracefulStop()
	}
	if ts.listener != nil {
		ts.listener.Close()
	}
}
