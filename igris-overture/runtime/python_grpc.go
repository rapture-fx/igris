package runtime

import (
	"context"
	"fmt"
	"time"

	"github.com/Schlep-engine/igris-inertial/igris-overture/ml"
)

// ============================================================================
// Python gRPC Runtime Implementation
// ============================================================================
//
// Implements the Runtime interface for Python ML service via gRPC.
// Uses connection pooling for high throughput.
//
// Advantages:
// - GPU acceleration support
// - Complex model support (PyTorch, TensorFlow, scikit-learn)
// - Mature ML ecosystem
//
// Limitations:
// - Higher latency (network + Python overhead)
// - Requires separate service deployment
//
// Phase: 2 - Runtime Abstraction
// ============================================================================

// PythonGrpcRuntime executes inference via Python ML service
type PythonGrpcRuntime struct {
	name      string
	client    *ml.PooledClient
	startTime time.Time
}

// NewPythonGrpcRuntime creates a new Python gRPC runtime
func NewPythonGrpcRuntime(name string, address string) (*PythonGrpcRuntime, error) {
	client, err := ml.NewPooledClient(address)
	if err != nil {
		return nil, fmt.Errorf("failed to create pooled client: %w", err)
	}

	return &PythonGrpcRuntime{
		name:      name,
		client:    client,
		startTime: time.Now(),
	}, nil
}

// Name returns the runtime identifier
func (r *PythonGrpcRuntime) Name() string {
	return r.name
}

// Type returns the runtime type
func (r *PythonGrpcRuntime) Type() RuntimeType {
	return RuntimeTypePythonGrpc
}

// Predict executes inference via Python gRPC
func (r *PythonGrpcRuntime) Predict(ctx context.Context, req *PredictRequest) (*PredictResponse, error) {
	start := time.Now()

	// Call Python ML service
	resp, err := r.client.Predict(ctx, req.Features, req.ModelID)
	if err != nil {
		return nil, fmt.Errorf("python grpc prediction failed: %w", err)
	}

	latency := time.Since(start)

	// Convert ML client response to runtime response
	return &PredictResponse{
		Prediction:    resp.Prediction,
		Confidence:    resp.Confidence,
		ModelID:       resp.ModelId,
		LatencyMs:     latency.Milliseconds(),
		Probabilities: make(map[string]float64),
		Metadata: map[string]string{
			"runtime":      "python_grpc",
			"runtime_name": r.name,
			"grpc_latency": fmt.Sprintf("%dms", latency.Milliseconds()),
		},
	}, nil
}

// HealthCheck checks runtime health
func (r *PythonGrpcRuntime) HealthCheck(ctx context.Context) (*HealthStatus, error) {
	healthy, err := r.client.HealthCheck(ctx)
	if err != nil {
		return &HealthStatus{
			Status:              "unhealthy",
			Version:             "0.1.0",
			UptimeSeconds:       int64(time.Since(r.startTime).Seconds()),
			ConsecutiveFailures: 1,
		}, err
	}

	status := "unhealthy"
	if healthy {
		status = "healthy"
	}

	// Get pool metrics
	poolMetrics := r.client.GetPoolMetrics()

	return &HealthStatus{
		Status:        status,
		Version:       "0.1.0",
		UptimeSeconds: int64(time.Since(r.startTime).Seconds()),
		SystemMetrics: map[string]string{
			"pool_size":           fmt.Sprintf("%d", poolMetrics.TotalConnections),
			"healthy_connections": fmt.Sprintf("%d", poolMetrics.HealthyConnections),
			"total_requests":      fmt.Sprintf("%d", poolMetrics.TotalRequests),
			"backend":             "python_ml",
		},
		LastHealthCheck:     time.Now(),
		ConsecutiveFailures: 0,
	}, nil
}

// Close shuts down the runtime
func (r *PythonGrpcRuntime) Close() error {
	if r.client != nil {
		return r.client.Close()
	}
	return nil
}

// GetPoolStats returns connection pool statistics
func (r *PythonGrpcRuntime) GetPoolStats() []ml.ConnectionStats {
	return r.client.GetConnectionStats()
}
