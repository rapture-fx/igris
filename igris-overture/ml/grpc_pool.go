package ml

import (
	"context"
	"fmt"
	"sync"
	"time"
	"sync/atomic"
	"net"
	"errors"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"github.com/rs/zerolog/log"

	pb "github.com/Igris-inertial/system/proto"
)

// Connection pool configuration
const (
	// Default pool configuration
	DefaultMinConnections     = 2
	DefaultMaxConnections     = 10
	DefaultConnectionTimeout  = 5 * time.Second
	DefaultHealthCheckInterval = 30 * time.Second
	DefaultMaxConnIdleTime    = 10 * time.Minute
 DefaultRetryAttempts      = 3
	DefaultRetryDelay         = 100 * time.Millisecond
)

// ConnectionPool manages a pool of gRPC connections to ML service
type ConnectionPool struct {
	mu                sync.RWMutex
	connections        []*PooledConnection
	available         chan *PooledConnection
	minConnections    int
	maxConnections    int
	connectionTimeout  time.Duration
	healthCheckInterval time.Duration
	maxConnIdleTime    time.Duration
	mlServiceEndpoint   string
	retryAttempts      int
	retryDelay         time.Duration
	
	// Statistics
	totalConnections   int64
	activeConnections   int64
	totalRequests       int64
	successfulRequests  int64
	failedRequests      int64
	connectionsCreated   int64
	connectionsDestroyed int64
	
	// Lifecycle
	ctx    context.Context
	cancel context.CancelFunc
	closed bool
}

// PooledConnection represents a single gRPC connection in the pool
type PooledConnection struct {
	conn         *grpc.ClientConn
	client       pb.MLServiceClient
	lastUsed     time.Time
	inUse        int32 // atomic
	index        int
	healthy      bool
	errorCount   int
	mu           sync.Mutex
}

// ConnectionPoolConfig holds configuration for the connection pool
type ConnectionPoolConfig struct {
	MLServiceEndpoint   string
	MinConnections     int
	MaxConnections     int
	ConnectionTimeout  time.Duration
	HealthCheckInterval time.Duration
	MaxConnIdleTime    time.Duration
	RetryAttempts      int
	RetryDelay         time.Duration
}

// NewConnectionPool creates a new gRPC connection pool
func NewConnectionPool(config *ConnectionPoolConfig) (*ConnectionPool, error) {
	if config.MLServiceEndpoint == "" {
		return nil, errors.New("ML service endpoint is required")
	}
	
	if config.MinConnections <= 0 {
		config.MinConnections = DefaultMinConnections
	}
	if config.MaxConnections <= 0 {
		config.MaxConnections = DefaultMaxConnections
	}
	if config.MinConnections > config.MaxConnections {
		return nil, errors.New("min connections cannot be greater than max connections")
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	pool := &ConnectionPool{
		available:          make(chan *PooledConnection, config.MaxConnections),
		minConnections:     config.MinConnections,
		maxConnections:     config.MaxConnections,
		connectionTimeout:  config.ConnectionTimeout,
		healthCheckInterval: config.HealthCheckInterval,
		maxConnIdleTime:    config.MaxConnIdleTime,
		mlServiceEndpoint: config.MLServiceEndpoint,
		retryAttempts:     config.RetryAttempts,
		retryDelay:        config.RetryDelay,
		ctx:               ctx,
		cancel:            cancel,
	}
	
	// Initialize minimum connections
	err := pool.initializeConnections()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to initialize connections: %w", err)
	}
	
	// Start health checking
	go pool.healthChecker()
	
	log.Info().
		Str("endpoint", config.MLServiceEndpoint).
		Int("min_connections", config.MinConnections).
		Int("max_connections", config.MaxConnections).
		Msg("gRPC connection pool created")
	
	return pool, nil
}

// initializeConnections creates the minimum required connections
func (p *ConnectionPool) initializeConnections() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	for i := 0; i < p.minConnections; i++ {
		conn, err := p.createConnection(i)
		if err != nil {
			return fmt.Errorf("failed to create connection %d: %w", i, err)
		}
		p.connections = append(p.connections, conn)
		atomic.AddInt64(&p.totalConnections, 1)
	}
	
	return nil
}

// createConnection creates a new gRPC connection
func (p *ConnectionPool) createConnection(index int) (*PooledConnection, error) {
	ctx, cancel := context.WithTimeout(p.ctx, p.connectionTimeout)
	defer cancel()
	
	// Create gRPC connection with optimized dial options
	conn, err := grpc.DialContext(
		ctx,
		p.mlServiceEndpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                30 * time.Second,
			Timeout:             5 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.WithDefaultCallOptions(
			grpc.MaxRetryRPCDefaultCalls(3),
			grpc.MaxCallRecvMsgSize(4*1024*1024), // 4MB max receive size
			grpc.MaxCallSendMsgSize(4*1024*1024), // 4MB max send size
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to dial ML service: %w", err)
	}
	
	// Create client
	client := pb.NewMLServiceClient(conn)
	
	// Test connection health
	client := pb.NewMLServiceClient(conn)
	healthReq := &grpc_health_v1.HealthCheckRequest{
		Service: "ml.service",
	}
	
	healthResp, err := client.Check(ctx, healthReq)
	if err != nil || healthResp.Status != grpc_health_v1.HealthCheckResponse_SERVING {
		conn.Close()
		return nil, fmt.Errorf("health check failed: %w", err)
	}
	
	pooledConn := &PooledConnection{
		conn:       conn,
		client:     client,
		lastUsed:   time.Now(),
		healthy:    true,
		index:      index,
	}
	
	atomic.AddInt64(&p.connectionsCreated, 1)
	log.Debug().Int("connection_index", index).Msg("New gRPC connection created")
	
	return pooledConn, nil
}

// GetClient retrieves a client connection from the pool
func (p *ConnectionPool) GetClient(ctx context.Context) (pb.MLServiceClient, error) {
	if p.closed {
		return nil, errors.New("connection pool is closed")
	}
	
	atomic.AddInt64(&p.totalRequests, 1)
	
	// Try to get an available connection
	select {
	case conn := <-p.available:
		if conn != nil && conn.isHealthy() {
			atomic.StoreInt32(&conn.inUse, 1)
			atomic.AddInt64(&p.activeConnections, 1)
			atomic.AddInt64(&p.successfulRequests, 1)
			return conn.client, nil
		}
		// Connection is not healthy, put it back and try to create a new one
		if conn != nil {
			p.returnConnection(conn, false)
		}
	default:
		// No available connection, try to create a new one if under limit
	}
	
	// Try to create a new connection if under max limit
	if atomic.LoadInt64(&p.totalConnections) < int64(p.maxConnections) {
		p.mu.Lock()
		canCreate := len(p.connections) < p.maxConnections
		if canCreate {
			index := len(p.connections)
			newConn, err := p.createConnection(index)
			if err == nil {
				p.connections = append(p.connections, newConn)
				atomic.StoreInt32(&newConn.inUse, 1)
				atomic.AddInt64(&p.activeConnections, 1)
				atomic.AddInt64(&p.successfulRequests, 1)
				log.Debug().Msg("Created new gRPC connection (pool expanded)")
				p.mu.Unlock()
				return newConn.client, nil
			}
			log.Error().Err(err).Msg("Failed to create new gRPC connection")
		}
		p.mu.Unlock()
	}
	
	// Wait for available connection with timeout
	timeout := time.NewTimer(3 * time.Second)
	defer timeout.Stop()
	
	select {
	case <-ctx.Done():
		atomic.AddInt64(&p.failedRequests, 1)
		return nil, ctx.Err()
	case <-timeout.C:
		atomic.AddInt64(&p.failedRequests, 1)
		return nil, errors.New("timeout waiting for available connection")
	case conn := <-p.available:
		if conn != nil && conn.isHealthy() {
			atomic.StoreInt32(&conn.inUse, 1)
			atomic.AddInt64(&p.activeConnections, 1)
			atomic.AddInt64(&p.successfulRequests, 1)
			return conn.client, nil
		}
		// Unhealthy connection, try again recursively (with limited attempts)
		if conn != nil {
			p.returnConnection(conn, false)
		}
		return p.GetClient(ctx)
	}
}

// ReturnClient returns the client connection to the pool
func (p *ConnectionPool) ReturnClient(client pb.MLServiceClient, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	// Find the connection associated with this client
	for _, conn := range p.connections {
		if conn.client == client {
			conn.mu.Lock()
			conn.lastUsed = time.Now()
			atomic.StoreInt32(&conn.inUse, 0)
			atomic.AddInt64(&p.activeConnections, -1)
			
			// Mark unhealthy if there was an error
			if err != nil {
				conn.errorCount++
				if conn.errorCount >= 3 {
					conn.healthy = false
					log.Warn().Int("error_count", conn.errorCount).Msg("Connection marked unhealthy")
				}
			} else {
				conn.errorCount = 0 // Reset error count on success
			}
			conn.mu.Unlock()
			
			p.returnConnection(conn, conn.healthy)
			return
		}
	}
	
	// Connection not found, might already be destroyed
	log.Warn().Msg("ReturnClient called with unknown client")
}

// returnConnection returns a connection to the pool or destroys it
func (p *ConnectionPool) returnConnection(conn *PooledConnection, healthy bool) {
	if !healthy || p.shouldDestroyIdle(conn) {
		p.destroyConnection(conn)
		return
	}
	
	select {
	case p.available <- conn:
		// Successfully returned to pool
	default:
		// Pool full, destroy the connection
		p.destroyConnection(conn)
	}
}

// shouldDestroyIdle checks if a connection should be destroyed due to idleness
func (p *ConnectionPool) shouldDestroyIdle(conn *PooledConnection) bool {
	if atomic.LoadInt64(&p.totalConnections) <= int64(p.minConnections) {
		return false // Keep at least minimum connections
	}
	
	conn.mu.Lock()
	defer conn.mu.Unlock()
	
	return time.Since(conn.lastUsed) > p.maxConnIdleTime
}

// destroyConnection destroys a connection and removes it from the pool
func (p *ConnectionPool) destroyConnection(conn *PooledConnection) {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	// Remove from connections slice
	for i, c := range p.connections {
		if c == conn {
			p.connections = append(p.connections[:i], p.connections[i+1:]...)
			break
		}
	}
	
	// Close the gRPC connection
	if conn.conn != nil {
		if err := conn.conn.Close(); err != nil {
			log.Error().Err(err).Int("connection_index", conn.index).Msg("Failed to close gRPC connection")
		}
	}
	
	atomic.AddInt64(&p.connectionsDestroyed, 1)
	atomic.AddInt64(&p.totalConnections, -1)
	
	log.Debug().Int("connection_index", conn.index).Msg("gRPC connection destroyed")
}

// healthChecker periodically checks the health of all connections
func (p *ConnectionPool) healthChecker() {
	ticker := time.NewTicker(p.healthCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.checkAllConnections()
		}
	}
}

// checkAllConnections performs health checks on all connections
func (p *ConnectionPool) checkAllConnections() {
	p.mu.RLock()
	connections := make([]*PooledConnection, len(p.connections))
	copy(connections, p.connections)
	p.mu.RUnlock()
	
	for _, conn := range connections {
		p.checkConnectionHealth(conn)
	}
}

// checkConnectionHealth checks the health of a single connection
func (p *ConnectionPool) checkConnectionHealth(conn *PooledConnection) {
	if atomic.LoadInt32(&conn.inUse) != 0 {
		return // Skip in-use connections
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	healthReq := &grpc_health_v1.HealthCheckRequest{
		Service: "ml.service",
	}
	
	healthResp, err := conn.client.Check(ctx, healthReq)
	
	conn.mu.Lock()
	healthy := err == nil && healthResp.Status == grpc_health_v1.HealthCheckResponse_SERVING
	
	if !healthy && conn.healthy {
		log.Warn().Err(err).Int("connection_index", conn.index).Msg("Connection health check failed")
	} else if healthy && !conn.healthy {
		log.Info().Int("connection_index", conn.index).Msg("Connection recovered healthy status")
	}
	
	conn.healthy = healthy
	conn.healthy = healthy
	conn.mu.Unlock()
}

// isHealthy checks if a connection is healthy
func (p *PooledConnection) isHealthy() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.healthy
}

// Stats returns connection pool statistics
func (p *ConnectionPool) Stats() PoolStats {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	return PoolStats{
		TotalConnections:      atomic.LoadInt64(&p.totalConnections),
		ActiveConnections:     atomic.LoadInt64(&p.activeConnections),
		IdleConnections:       int64(len(p.available)),
		TotalRequests:         atomic.LoadInt64(&p.totalRequests),
		SuccessfulRequests:    atomic.LoadInt64(&p.successfulRequests),
		FailedRequests:        atomic.LoadInt64(&p.failedRequests),
		ConnectionsCreated:    atomic.LoadInt64(&p.connectionsCreated),
		ConnectionsDestroyed:  atomic.LoadInt64(&p.connectionsDestroyed),
		MLEndpoint:            p.mlServiceEndpoint,
		MinConnections:        p.minConnections,
		MaxConnections:        p.maxConnections,
	}
}

// PoolStats contains connection pool statistics
type PoolStats struct {
	TotalConnections      int64  `json:"total_connections"`
	ActiveConnections     int64  `json:"active_connections"`
	IdleConnections       int64  `json:"idle_connections"`
	TotalRequests         int64  `json:"total_requests"`
	SuccessfulRequests    int64  `json:"successful_requests"`
	FailedRequests        int64  `json:"failed_requests"`
	ConnectionsCreated    int64  `json:"connections_created"`
	ConnectionsDestroyed  int64  `json:"connections_destroyed"`
	MLEndpoint            string `json:"ml_endpoint"`
	MinConnections        int    `json:"min_connections"`
	MaxConnections        int    `json:"max_connections"`
}

func (p *PoolStats) SuccessRate() float64 {
	if p.TotalRequests == 0 {
		return 0
	}
	return float64(p.SuccessfulRequests) / float64(p.TotalRequests) * 100
}

// Close closes all connections in the pool
func (p *ConnectionPool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	if p.closed {
		return nil
	}
	
	p.cancel()
	p.closed = true
	
	// Close all connections
	for _, conn := range p.connections {
		if conn.conn != nil {
			conn.conn.Close()
		}
	}
	
	close(p.available)
	p.connections = nil
	
	log.Info().Msg("gRPC connection pool closed")
	return nil
}

// UpdateConfig dynamically updates pool configuration
func (p *ConnectionPool) UpdateConfig(config *ConnectionPoolConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	// Update configuration (but not connection limits which would require rebuilding)
	p.mlServiceEndpoint = config.MLServiceEndpoint
	p.connectionTimeout = config.ConnectionTimeout
	p.healthCheckInterval = config.HealthCheckInterval
	p.maxConnIdleTime = config.MaxConnIdleTime
	p.retryAttempts = config.RetryAttempts
	p.retryDelay = config.RetryDelay
	
	log.Info().Msg("gRPC pool configuration updated")
	return nil
}

// WithRetry executes a function with automatic retry logic
func (p *ConnectionPool) WithRetry(ctx context.Context, fn func(ctx context.Context, client pb.MLServiceClient) error) error {
	var lastErr error
	
	for attempt := range p.retryAttempts {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(p.retryDelay * time.Duration(attempt)):
				// Exponential backoff would be better
			}
		}
		
		client, err := p.GetClient(ctx)
		if err != nil {
			lastErr = err
			continue
		}
		
		err = fn(ctx, client)
		p.ReturnClient(client, err)
		
		if err == nil {
			return nil
		}
		
		lastErr = err
		
		// Don't retry on certain errors
		if isNonRetryableError(err) {
			return err
		}
	}
	
	return fmt.Errorf("operation failed after %d attempts: %w", p.retryAttempts, lastErr)
}

// isNonRetryableError checks if an error should not be retried
func isNonRetryableError(err error) bool {
	if err == nil {
		return false
	}
	
	errStr := err.Error()
	nonRetryablePatterns := []string{
		"context canceled",
		"deadline exceeded",
		"unavailable",
		"permission denied",
	}
	
	for _, pattern := range nonRetryablePatterns {
		if contains(errStr, pattern) {
			return true
		}
	}
	
	return false
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
