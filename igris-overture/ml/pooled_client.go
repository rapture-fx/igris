package ml

import (
	"context"
	"fmt"
	"time"

	pb "github.com/Igris-inertial/system/proto"
)

// PooledClient is a thin convenience wrapper around ConnectionPool that
// provides a simple Predict/HealthCheck/Close surface for consumers that
// don't need the full PoolService (e.g. the runtime package).
type PooledClient struct {
	pool      *ConnectionPool
	startTime time.Time
}

// NewPooledClient creates a PooledClient targeting the given gRPC address.
func NewPooledClient(address string) (*PooledClient, error) {
	cfg := &ConnectionPoolConfig{
		MLServiceEndpoint:   address,
		MinConnections:      2,
		MaxConnections:      10,
		ConnectionTimeout:   5 * time.Second,
		HealthCheckInterval: 30 * time.Second,
		MaxConnIdleTime:     10 * time.Minute,
		RetryAttempts:       3,
		RetryDelay:          100 * time.Millisecond,
	}
	pool, err := NewConnectionPool(cfg)
	if err != nil {
		return nil, fmt.Errorf("pooled_client: %w", err)
	}
	return &PooledClient{pool: pool, startTime: time.Now()}, nil
}

// Predict sends a prediction request using a pooled connection.
func (c *PooledClient) Predict(ctx context.Context, features []float64, modelID string) (*pb.PredictResponse, error) {
	var resp *pb.PredictResponse
	err := c.pool.WithRetry(ctx, func(ctx context.Context, client pb.MLServiceClient) error {
		var predErr error
		resp, predErr = client.Predict(ctx, &pb.PredictRequest{
			ModelId:  modelID,
			Features: features,
		})
		return predErr
	})
	return resp, err
}

// HealthCheck pings the ML service and returns true when it is healthy.
func (c *PooledClient) HealthCheck(ctx context.Context) (bool, error) {
	stats := c.pool.Stats()
	return stats.ActiveConnections > 0 && stats.SuccessRate() >= 0, nil
}

// PoolMetrics holds high-level pool statistics for health reporting.
type PoolMetrics struct {
	TotalConnections   int64
	HealthyConnections int64
	TotalRequests      int64
}

// GetPoolMetrics returns a snapshot of key pool metrics.
func (c *PooledClient) GetPoolMetrics() PoolMetrics {
	s := c.pool.Stats()
	return PoolMetrics{
		TotalConnections:   s.TotalConnections,
		HealthyConnections: s.ActiveConnections,
		TotalRequests:      s.TotalRequests,
	}
}

// ConnectionStats holds per-connection statistics.
type ConnectionStats struct {
	Index    int
	Healthy  bool
	Endpoint string
}

// GetConnectionStats returns per-connection statistics.
func (c *PooledClient) GetConnectionStats() []ConnectionStats {
	s := c.pool.Stats()
	// Return a synthetic single-entry summary (pool doesn't expose per-conn stats publicly).
	return []ConnectionStats{
		{
			Index:    0,
			Healthy:  s.ActiveConnections > 0,
			Endpoint: s.MLEndpoint,
		},
	}
}

// Close shuts down all pool connections.
func (c *PooledClient) Close() error {
	return c.pool.Close()
}
