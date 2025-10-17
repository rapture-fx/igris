package edge

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	mlv1 "github.com/schlep-engine/schlep-engine/web/apps/go-gateway/proto/ml/v1"
)

// EdgeNodeConfig holds configuration for an edge inference node
type EdgeNodeConfig struct {
	NodeID   string
	Region   string
	Address  string
	Port     int
	Priority int  // Lower = higher priority
	Enabled  bool
}

// EdgeNode represents a regional edge inference node
type EdgeNode struct {
	config     EdgeNodeConfig
	client     mlv1.MLServiceClient
	conn       *grpc.ClientConn
	isHealthy  atomic.Bool
	lastCheck  time.Time
	failCount  int32
	mu         sync.RWMutex
}

// EdgeRouterConfig holds configuration for the edge router
type EdgeRouterConfig struct {
	Enabled           bool
	FailoverEnabled   bool
	HealthCheckInterval time.Duration
	RequestTimeout    time.Duration
	MaxRetries        int
}

// EdgeRouter routes ML inference requests to regional edge nodes
type EdgeRouter struct {
	config      EdgeRouterConfig
	nodes       map[string]*EdgeNode
	nodesByRegion map[string][]*EdgeNode
	logger      zerolog.Logger
	mu          sync.RWMutex

	// Metrics
	totalRequests   int64
	successfulReqs  int64
	failedReqs      int64
	failovers       int64
}

// NewEdgeRouter creates a new edge router instance
func NewEdgeRouter(config EdgeRouterConfig, logger zerolog.Logger) *EdgeRouter {
	er := &EdgeRouter{
		config:        config,
		nodes:         make(map[string]*EdgeNode),
		nodesByRegion: make(map[string][]*EdgeNode),
		logger:        logger.With().Str("component", "edge-router").Logger(),
	}

	er.logger.Info().
		Bool("enabled", config.Enabled).
		Bool("failover", config.FailoverEnabled).
		Dur("health_check", config.HealthCheckInterval).
		Msg("Edge router initialized")

	return er
}

// RegisterNode registers an edge inference node
func (er *EdgeRouter) RegisterNode(config EdgeNodeConfig) error {
	er.mu.Lock()
	defer er.mu.Unlock()

	if !config.Enabled {
		er.logger.Debug().
			Str("node_id", config.NodeID).
			Msg("Skipping disabled edge node")
		return nil
	}

	// Create gRPC connection
	address := fmt.Sprintf("%s:%d", config.Address, config.Port)
	conn, err := grpc.Dial(
		address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(100*1024*1024), // 100MB
			grpc.MaxCallSendMsgSize(100*1024*1024),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to connect to edge node %s: %w", config.NodeID, err)
	}

	client := mlv1.NewMLServiceClient(conn)

	node := &EdgeNode{
		config:    config,
		client:    client,
		conn:      conn,
		lastCheck: time.Now(),
	}
	node.isHealthy.Store(true)

	er.nodes[config.NodeID] = node

	// Index by region
	if er.nodesByRegion[config.Region] == nil {
		er.nodesByRegion[config.Region] = make([]*EdgeNode, 0)
	}
	er.nodesByRegion[config.Region] = append(er.nodesByRegion[config.Region], node)

	er.logger.Info().
		Str("node_id", config.NodeID).
		Str("region", config.Region).
		Str("address", address).
		Msg("Edge node registered")

	return nil
}

// RoutePredict routes a prediction request to the appropriate edge node
func (er *EdgeRouter) RoutePredict(ctx context.Context, region string, req *mlv1.PredictRequest) (*mlv1.PredictResponse, error) {
	if !er.config.Enabled {
		return nil, fmt.Errorf("edge routing is disabled")
	}

	atomic.AddInt64(&er.totalRequests, 1)

	// Set timeout
	if er.config.RequestTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, er.config.RequestTimeout)
		defer cancel()
	}

	// Get nodes for the requested region
	nodes := er.getHealthyNodesForRegion(region)
	if len(nodes) == 0 {
		// Fallback: try all healthy nodes
		er.logger.Warn().
			Str("region", region).
			Msg("No healthy nodes in region, trying all nodes")
		nodes = er.getAllHealthyNodes()
	}

	if len(nodes) == 0 {
		atomic.AddInt64(&er.failedReqs, 1)
		return nil, fmt.Errorf("no healthy edge nodes available")
	}

	// Try primary node first
	node := nodes[0]
	resp, err := er.executePredict(ctx, node, req)

	if err == nil {
		atomic.AddInt64(&er.successfulReqs, 1)
		return resp, nil
	}

	er.logger.Warn().
		Err(err).
		Str("node_id", node.config.NodeID).
		Msg("Edge node prediction failed")

	// Mark node as unhealthy
	node.isHealthy.Store(false)
	atomic.AddInt32(&node.failCount, 1)

	// Failover to backup nodes if enabled
	if er.config.FailoverEnabled && len(nodes) > 1 {
		for i := 1; i < len(nodes) && i < er.config.MaxRetries; i++ {
			atomic.AddInt64(&er.failovers, 1)
			backupNode := nodes[i]

			er.logger.Info().
				Str("from_node", node.config.NodeID).
				Str("to_node", backupNode.config.NodeID).
				Msg("Failing over to backup edge node")

			resp, err = er.executePredict(ctx, backupNode, req)
			if err == nil {
				atomic.AddInt64(&er.successfulReqs, 1)
				return resp, nil
			}

			er.logger.Warn().
				Err(err).
				Str("node_id", backupNode.config.NodeID).
				Msg("Backup edge node prediction failed")

			backupNode.isHealthy.Store(false)
			atomic.AddInt32(&backupNode.failCount, 1)
		}
	}

	atomic.AddInt64(&er.failedReqs, 1)
	return nil, fmt.Errorf("all edge nodes failed for region %s: %w", region, err)
}

// RouteBatchPredict routes a batch prediction request
func (er *EdgeRouter) RouteBatchPredict(ctx context.Context, region string, req *mlv1.BatchPredictRequest) (*mlv1.BatchPredictResponse, error) {
	if !er.config.Enabled {
		return nil, fmt.Errorf("edge routing is disabled")
	}

	atomic.AddInt64(&er.totalRequests, 1)

	// Set timeout
	if er.config.RequestTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, er.config.RequestTimeout)
		defer cancel()
	}

	nodes := er.getHealthyNodesForRegion(region)
	if len(nodes) == 0 {
		nodes = er.getAllHealthyNodes()
	}

	if len(nodes) == 0 {
		atomic.AddInt64(&er.failedReqs, 1)
		return nil, fmt.Errorf("no healthy edge nodes available")
	}

	node := nodes[0]
	resp, err := er.executeBatchPredict(ctx, node, req)

	if err == nil {
		atomic.AddInt64(&er.successfulReqs, 1)
		return resp, nil
	}

	er.logger.Warn().
		Err(err).
		Str("node_id", node.config.NodeID).
		Msg("Edge node batch prediction failed")

	node.isHealthy.Store(false)
	atomic.AddInt32(&node.failCount, 1)

	// Failover
	if er.config.FailoverEnabled && len(nodes) > 1 {
		for i := 1; i < len(nodes) && i < er.config.MaxRetries; i++ {
			atomic.AddInt64(&er.failovers, 1)
			backupNode := nodes[i]

			resp, err = er.executeBatchPredict(ctx, backupNode, req)
			if err == nil {
				atomic.AddInt64(&er.successfulReqs, 1)
				return resp, nil
			}

			backupNode.isHealthy.Store(false)
			atomic.AddInt32(&backupNode.failCount, 1)
		}
	}

	atomic.AddInt64(&er.failedReqs, 1)
	return nil, fmt.Errorf("all edge nodes failed for region %s: %w", region, err)
}

// executePredict executes a prediction request on a specific node
func (er *EdgeRouter) executePredict(ctx context.Context, node *EdgeNode, req *mlv1.PredictRequest) (*mlv1.PredictResponse, error) {
	node.mu.RLock()
	client := node.client
	node.mu.RUnlock()

	return client.Predict(ctx, req)
}

// executeBatchPredict executes a batch prediction request on a specific node
func (er *EdgeRouter) executeBatchPredict(ctx context.Context, node *EdgeNode, req *mlv1.BatchPredictRequest) (*mlv1.BatchPredictResponse, error) {
	node.mu.RLock()
	client := node.client
	node.mu.RUnlock()

	return client.BatchPredict(ctx, req)
}

// getHealthyNodesForRegion returns healthy nodes in a specific region, sorted by priority
func (er *EdgeRouter) getHealthyNodesForRegion(region string) []*EdgeNode {
	er.mu.RLock()
	defer er.mu.RUnlock()

	regionNodes := er.nodesByRegion[region]
	healthy := make([]*EdgeNode, 0, len(regionNodes))

	for _, node := range regionNodes {
		if node.isHealthy.Load() {
			healthy = append(healthy, node)
		}
	}

	// Sort by priority (lower = higher priority)
	for i := 0; i < len(healthy)-1; i++ {
		for j := i + 1; j < len(healthy); j++ {
			if healthy[j].config.Priority < healthy[i].config.Priority {
				healthy[i], healthy[j] = healthy[j], healthy[i]
			}
		}
	}

	return healthy
}

// getAllHealthyNodes returns all healthy nodes across all regions
func (er *EdgeRouter) getAllHealthyNodes() []*EdgeNode {
	er.mu.RLock()
	defer er.mu.RUnlock()

	healthy := make([]*EdgeNode, 0)
	for _, node := range er.nodes {
		if node.isHealthy.Load() {
			healthy = append(healthy, node)
		}
	}

	// Shuffle for load distribution
	rand.Shuffle(len(healthy), func(i, j int) {
		healthy[i], healthy[j] = healthy[j], healthy[i]
	})

	return healthy
}

// StartHealthCheckWorker starts a background worker to check edge node health
func (er *EdgeRouter) StartHealthCheckWorker(ctx context.Context) {
	if er.config.HealthCheckInterval == 0 {
		er.logger.Warn().Msg("Health check disabled (interval is 0)")
		return
	}

	ticker := time.NewTicker(er.config.HealthCheckInterval)
	defer ticker.Stop()

	er.logger.Info().
		Dur("interval", er.config.HealthCheckInterval).
		Msg("Started edge node health check worker")

	for {
		select {
		case <-ctx.Done():
			er.logger.Info().Msg("Stopping edge node health check worker")
			return
		case <-ticker.C:
			er.performHealthChecks(ctx)
		}
	}
}

// performHealthChecks checks health of all registered nodes
func (er *EdgeRouter) performHealthChecks(ctx context.Context) {
	er.mu.RLock()
	nodes := make([]*EdgeNode, 0, len(er.nodes))
	for _, node := range er.nodes {
		nodes = append(nodes, node)
	}
	er.mu.RUnlock()

	for _, node := range nodes {
		go func(n *EdgeNode) {
			checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()

			req := &mlv1.HealthCheckRequest{}
			_, err := n.client.HealthCheck(checkCtx, req)

			n.mu.Lock()
			n.lastCheck = time.Now()
			n.mu.Unlock()

			if err != nil {
				atomic.AddInt32(&n.failCount, 1)
				if n.failCount >= 3 {
					if n.isHealthy.Swap(false) {
						er.logger.Warn().
							Str("node_id", n.config.NodeID).
							Err(err).
							Msg("Edge node marked as unhealthy")
					}
				}
			} else {
				if !n.isHealthy.Swap(true) {
					er.logger.Info().
						Str("node_id", n.config.NodeID).
						Msg("Edge node recovered")
				}
				atomic.StoreInt32(&n.failCount, 0)
			}
		}(node)
	}
}

// GetMetrics returns edge router metrics
func (er *EdgeRouter) GetMetrics() map[string]interface{} {
	er.mu.RLock()
	defer er.mu.RUnlock()

	nodeMetrics := make(map[string]interface{})
	for nodeID, node := range er.nodes {
		nodeMetrics[nodeID] = map[string]interface{}{
			"region":      node.config.Region,
			"is_healthy":  node.isHealthy.Load(),
			"fail_count":  atomic.LoadInt32(&node.failCount),
			"last_check":  node.lastCheck,
		}
	}

	totalReqs := atomic.LoadInt64(&er.totalRequests)
	successRate := 0.0
	if totalReqs > 0 {
		successRate = float64(atomic.LoadInt64(&er.successfulReqs)) / float64(totalReqs)
	}

	return map[string]interface{}{
		"enabled":        er.config.Enabled,
		"total_requests": totalReqs,
		"successful":     atomic.LoadInt64(&er.successfulReqs),
		"failed":         atomic.LoadInt64(&er.failedReqs),
		"failovers":      atomic.LoadInt64(&er.failovers),
		"success_rate":   successRate,
		"nodes":          nodeMetrics,
	}
}

// Close closes all edge node connections
func (er *EdgeRouter) Close() error {
	er.mu.Lock()
	defer er.mu.Unlock()

	var errs []error
	for nodeID, node := range er.nodes {
		if err := node.conn.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close node %s: %w", nodeID, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("edge router close errors: %v", errs)
	}

	er.logger.Info().Msg("Edge router closed")
	return nil
}
