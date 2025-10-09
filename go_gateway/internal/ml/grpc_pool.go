package ml

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/schlep-engine/go-gateway/proto"
)

// ============================================================================
// gRPC Connection Pool for Python ML Service
// ============================================================================
//
// Solves the single-connection bottleneck by maintaining a pool of gRPC
// connections with:
// - Round-robin load balancing
// - Health checking and auto-reconnection
// - Connection lifecycle management
// - Metrics and observability
//
// Phase: 2 - Runtime Abstraction
// ============================================================================

// ConnectionPool manages a pool of gRPC connections
type ConnectionPool struct {
	// Configuration
	address     string
	poolSize    int
	dialTimeout time.Duration

	// Connection pool
	connections []*pooledConnection
	mu          sync.RWMutex

	// Round-robin counter
	counter atomic.Uint64

	// Lifecycle
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Metrics
	metrics *PoolMetrics
}

// pooledConnection wraps a gRPC connection with metadata
type pooledConnection struct {
	conn      *grpc.ClientConn
	client    pb.MLServiceClient
	id        int
	createdAt time.Time
	lastUsed  time.Time
	healthy   atomic.Bool
	usageCount atomic.Uint64
	mu        sync.RWMutex
}

// PoolMetrics tracks connection pool statistics
type PoolMetrics struct {
	TotalConnections   int32
	HealthyConnections int32
	TotalRequests      atomic.Uint64
	FailedRequests     atomic.Uint64
	TotalReconnects    atomic.Uint64
	mu                 sync.RWMutex
}

// PoolConfig configures the connection pool
type PoolConfig struct {
	Address           string
	PoolSize          int
	DialTimeout       time.Duration
	HealthCheckPeriod time.Duration
	ReconnectDelay    time.Duration
}

// DefaultPoolConfig returns sensible defaults
func DefaultPoolConfig(address string) PoolConfig {
	return PoolConfig{
		Address:           address,
		PoolSize:          5, // 5 connections for load balancing
		DialTimeout:       5 * time.Second,
		HealthCheckPeriod: 30 * time.Second,
		ReconnectDelay:    5 * time.Second,
	}
}

// NewConnectionPool creates a new gRPC connection pool
func NewConnectionPool(config PoolConfig) (*ConnectionPool, error) {
	if config.PoolSize <= 0 {
		config.PoolSize = 5
	}
	if config.DialTimeout == 0 {
		config.DialTimeout = 5 * time.Second
	}
	if config.HealthCheckPeriod == 0 {
		config.HealthCheckPeriod = 30 * time.Second
	}
	if config.ReconnectDelay == 0 {
		config.ReconnectDelay = 5 * time.Second
	}

	ctx, cancel := context.WithCancel(context.Background())

	pool := &ConnectionPool{
		address:     config.Address,
		poolSize:    config.PoolSize,
		dialTimeout: config.DialTimeout,
		connections: make([]*pooledConnection, 0, config.PoolSize),
		ctx:         ctx,
		cancel:      cancel,
		metrics: &PoolMetrics{
			TotalConnections:   int32(config.PoolSize),
			HealthyConnections: 0,
		},
	}

	// Initialize connections
	if err := pool.initialize(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to initialize pool: %w", err)
	}

	// Start health check routine
	pool.wg.Add(1)
	go pool.healthCheckLoop(config.HealthCheckPeriod)

	return pool, nil
}

// initialize creates all connections in the pool
func (p *ConnectionPool) initialize() error {
	var firstError error
	successCount := 0

	for i := 0; i < p.poolSize; i++ {
		conn, err := p.createConnection(i)
		if err != nil {
			if firstError == nil {
				firstError = err
			}
			// Continue creating other connections even if one fails
			continue
		}

		p.connections = append(p.connections, conn)
		successCount++
		atomic.AddInt32(&p.metrics.HealthyConnections, 1)
	}

	// Require at least one successful connection
	if successCount == 0 {
		return fmt.Errorf("failed to create any connections: %w", firstError)
	}

	return nil
}

// createConnection creates a single pooled connection
func (p *ConnectionPool) createConnection(id int) (*pooledConnection, error) {
	ctx, cancel := context.WithTimeout(p.ctx, p.dialTimeout)
	defer cancel()

	conn, err := grpc.DialContext(ctx, p.address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to dial %s: %w", p.address, err)
	}

	pooledConn := &pooledConnection{
		conn:      conn,
		client:    pb.NewMLServiceClient(conn),
		id:        id,
		createdAt: time.Now(),
		lastUsed:  time.Now(),
	}
	pooledConn.healthy.Store(true)

	return pooledConn, nil
}

// GetClient returns a client using round-robin selection
func (p *ConnectionPool) GetClient() (pb.MLServiceClient, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(p.connections) == 0 {
		return nil, fmt.Errorf("no connections available")
	}

	// Round-robin selection
	index := p.counter.Add(1) % uint64(len(p.connections))
	conn := p.connections[index]

	// Check if connection is healthy
	if !conn.healthy.Load() {
		// Try to find a healthy connection
		for i := range p.connections {
			if p.connections[i].healthy.Load() {
				conn = p.connections[i]
				break
			}
		}

		// If no healthy connections, return error
		if !conn.healthy.Load() {
			return nil, fmt.Errorf("no healthy connections available")
		}
	}

	// Update usage stats
	conn.mu.Lock()
	conn.lastUsed = time.Now()
	conn.usageCount.Add(1)
	conn.mu.Unlock()

	p.metrics.TotalRequests.Add(1)

	return conn.client, nil
}

// healthCheckLoop periodically checks connection health
func (p *ConnectionPool) healthCheckLoop(period time.Duration) {
	defer p.wg.Done()

	ticker := time.NewTicker(period)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.checkHealth()
		}
	}
}

// checkHealth checks all connections and reconnects unhealthy ones
func (p *ConnectionPool) checkHealth() {
	p.mu.Lock()
	defer p.mu.Unlock()

	healthyCount := int32(0)

	for i, conn := range p.connections {
		state := conn.conn.GetState()
		isHealthy := state == connectivity.Ready || state == connectivity.Idle

		if !isHealthy {
			conn.healthy.Store(false)

			// Attempt reconnection in background
			go p.reconnect(i)
		} else {
			conn.healthy.Store(true)
			healthyCount++
		}
	}

	p.metrics.mu.Lock()
	p.metrics.HealthyConnections = healthyCount
	p.metrics.mu.Unlock()
}

// reconnect attempts to reconnect a specific connection
func (p *ConnectionPool) reconnect(index int) {
	p.mu.Lock()
	oldConn := p.connections[index]
	p.mu.Unlock()

	// Close old connection
	if oldConn.conn != nil {
		oldConn.conn.Close()
	}

	// Create new connection
	newConn, err := p.createConnection(index)
	if err != nil {
		// Failed to reconnect, mark as unhealthy
		oldConn.healthy.Store(false)
		p.metrics.FailedRequests.Add(1)
		return
	}

	// Replace connection in pool
	p.mu.Lock()
	p.connections[index] = newConn
	p.mu.Unlock()

	p.metrics.TotalReconnects.Add(1)
	atomic.AddInt32(&p.metrics.HealthyConnections, 1)
}

// Close shuts down the connection pool
func (p *ConnectionPool) Close() error {
	// Cancel context to stop health checks
	p.cancel()

	// Wait for background goroutines
	p.wg.Wait()

	// Close all connections
	p.mu.Lock()
	defer p.mu.Unlock()

	var lastError error
	for _, conn := range p.connections {
		if err := conn.conn.Close(); err != nil {
			lastError = err
		}
	}

	p.connections = nil
	return lastError
}

// GetMetrics returns current pool metrics
func (p *ConnectionPool) GetMetrics() PoolMetrics {
	p.metrics.mu.RLock()
	defer p.metrics.mu.RUnlock()

	return PoolMetrics{
		TotalConnections:   p.metrics.TotalConnections,
		HealthyConnections: p.metrics.HealthyConnections,
		TotalRequests:      atomic.Uint64{},
		FailedRequests:     atomic.Uint64{},
		TotalReconnects:    atomic.Uint64{},
	}
}

// GetConnectionStats returns detailed connection statistics
func (p *ConnectionPool) GetConnectionStats() []ConnectionStats {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := make([]ConnectionStats, len(p.connections))
	for i, conn := range p.connections {
		conn.mu.RLock()
		stats[i] = ConnectionStats{
			ID:         conn.id,
			Healthy:    conn.healthy.Load(),
			CreatedAt:  conn.createdAt,
			LastUsed:   conn.lastUsed,
			UsageCount: conn.usageCount.Load(),
			State:      conn.conn.GetState().String(),
		}
		conn.mu.RUnlock()
	}

	return stats
}

// ConnectionStats contains statistics for a single connection
type ConnectionStats struct {
	ID         int
	Healthy    bool
	CreatedAt  time.Time
	LastUsed   time.Time
	UsageCount uint64
	State      string
}

// ============================================================================
// Pooled ML Client (Wrapper)
// ============================================================================

// PooledClient wraps the connection pool with a convenient client interface
type PooledClient struct {
	pool *ConnectionPool
}

// NewPooledClient creates a new pooled ML client
func NewPooledClient(address string) (*PooledClient, error) {
	config := DefaultPoolConfig(address)
	pool, err := NewConnectionPool(config)
	if err != nil {
		return nil, err
	}

	return &PooledClient{pool: pool}, nil
}

// Predict makes a prediction using a connection from the pool
func (c *PooledClient) Predict(ctx context.Context, features []float64, modelID string) (*PredictResponse, error) {
	client, err := c.pool.GetClient()
	if err != nil {
		c.pool.metrics.FailedRequests.Add(1)
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req := &pb.PredictRequest{
		Features: features,
		ModelId:  modelID,
	}

	resp, err := client.Predict(ctx, req)
	if err != nil {
		c.pool.metrics.FailedRequests.Add(1)
		return nil, fmt.Errorf("prediction failed: %w", err)
	}

	return &PredictResponse{
		Prediction: resp.Prediction,
		Confidence: resp.Confidence,
		ModelId:    resp.ModelId,
	}, nil
}

// HealthCheck checks if the ML service is healthy
func (c *PooledClient) HealthCheck(ctx context.Context) (bool, error) {
	client, err := c.pool.GetClient()
	if err != nil {
		return false, err
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req := &pb.HealthCheckRequest{}
	resp, err := client.HealthCheck(ctx, req)
	if err != nil {
		return false, err
	}

	return resp.Status == "healthy", nil
}

// Close closes the pooled client
func (c *PooledClient) Close() error {
	return c.pool.Close()
}

// GetPoolMetrics returns pool metrics
func (c *PooledClient) GetPoolMetrics() PoolMetrics {
	return c.pool.GetMetrics()
}

// GetConnectionStats returns connection statistics
func (c *PooledClient) GetConnectionStats() []ConnectionStats {
	return c.pool.GetConnectionStats()
}
