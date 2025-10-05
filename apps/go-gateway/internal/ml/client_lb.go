package ml

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	pb "github.com/schlep-engine/go-gateway/proto/ml"
)

// LoadBalancingStrategy defines load balancing behavior
type LoadBalancingStrategy string

const (
	// StrategyRoundRobin uses DNS-based round-robin (recommended for K8s)
	StrategyRoundRobin LoadBalancingStrategy = "round_robin"

	// StrategyClientSide uses manual client-side load balancing
	StrategyClientSide LoadBalancingStrategy = "client_side"
)

// LoadBalancedClient wraps multiple ML service clients with load balancing
type LoadBalancedClient struct {
	config   ClientConfig
	strategy LoadBalancingStrategy

	// For DNS-based load balancing
	conn   *grpc.ClientConn
	client pb.MLServiceClient

	// For client-side load balancing
	pool    []*Client
	current int
	mu      sync.RWMutex

	logger zerolog.Logger
}

// NewLoadBalancedClientWithDNS creates a client with DNS-based load balancing
// Recommended for Kubernetes where service name resolves to multiple pod IPs
func NewLoadBalancedClientWithDNS(config ClientConfig, logger zerolog.Logger) (*LoadBalancedClient, error) {
	if config.ServiceURL == "" {
		return nil, fmt.Errorf("ML service URL is required")
	}

	lbClient := &LoadBalancedClient{
		config:   config,
		strategy: StrategyRoundRobin,
		logger:   logger.With().Str("component", "ml-lb-client").Logger(),
	}

	// Set defaults
	if config.ConnectionTimeout == 0 {
		config.ConnectionTimeout = 5 * time.Second
	}
	if config.RequestTimeout == 0 {
		config.RequestTimeout = 10 * time.Second
	}
	if config.KeepaliveTime == 0 {
		config.KeepaliveTime = 30 * time.Second
	}
	if config.KeepaliveTimeout == 0 {
		config.KeepaliveTimeout = 10 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), config.ConnectionTimeout)
	defer cancel()

	// gRPC dial options with DNS round-robin load balancing
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),

		// Enable DNS-based load balancing
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),

		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                config.KeepaliveTime,
			Timeout:             config.KeepaliveTimeout,
			PermitWithoutStream: true,
		}),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(50 * 1024 * 1024), // 50MB
			grpc.MaxCallSendMsgSize(50 * 1024 * 1024), // 50MB
		),
	}

	// Connect with dns:/// scheme for service discovery
	// For Kubernetes: "dns:///python-ml:50051" resolves to all pod IPs
	// For Docker Compose: "dns:///python-ml:50051" works with multiple replicas
	serviceURL := config.ServiceURL
	if len(serviceURL) > 4 && serviceURL[:4] != "dns:" {
		// Prepend dns:/// if not already present
		serviceURL = "dns:///" + serviceURL
	}

	conn, err := grpc.DialContext(ctx, serviceURL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to dial ML service with load balancing: %w", err)
	}

	lbClient.conn = conn
	lbClient.client = pb.NewMLServiceClient(conn)

	lbClient.logger.Info().
		Str("url", serviceURL).
		Str("strategy", string(StrategyRoundRobin)).
		Msg("Connected to ML service with DNS load balancing")

	return lbClient, nil
}

// NewLoadBalancedClientPool creates a client pool for manual load balancing
// Useful for Docker Compose or when you have explicit replica addresses
func NewLoadBalancedClientPool(addresses []string, config ClientConfig, logger zerolog.Logger) (*LoadBalancedClient, error) {
	if len(addresses) == 0 {
		return nil, fmt.Errorf("at least one ML service address is required")
	}

	lbClient := &LoadBalancedClient{
		config:   config,
		strategy: StrategyClientSide,
		pool:     make([]*Client, 0, len(addresses)),
		logger:   logger.With().Str("component", "ml-pool-client").Logger(),
	}

	// Create a client for each address
	for i, addr := range addresses {
		clientConfig := config
		clientConfig.ServiceURL = addr

		client, err := NewClient(clientConfig, logger)
		if err != nil {
			lbClient.logger.Error().
				Err(err).
				Str("address", addr).
				Int("index", i).
				Msg("Failed to create ML client for address")
			continue
		}

		lbClient.pool = append(lbClient.pool, client)
	}

	if len(lbClient.pool) == 0 {
		return nil, fmt.Errorf("failed to create any ML clients")
	}

	lbClient.logger.Info().
		Int("pool_size", len(lbClient.pool)).
		Str("strategy", string(StrategyClientSide)).
		Msg("Created ML client pool")

	return lbClient, nil
}

// getNextClient returns the next client in the pool (round-robin)
func (c *LoadBalancedClient) getNextClient() *Client {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.pool) == 0 {
		return nil
	}

	client := c.pool[c.current]
	c.current = (c.current + 1) % len(c.pool)

	return client
}

// Predict performs a single ML prediction with load balancing
func (c *LoadBalancedClient) Predict(ctx context.Context, modelID string, features []float64, metadata map[string]string) (*pb.PredictResponse, error) {
	if c.strategy == StrategyRoundRobin {
		// DNS-based load balancing - gRPC handles distribution
		ctx, cancel := context.WithTimeout(ctx, c.config.RequestTimeout)
		defer cancel()

		request := &pb.PredictRequest{
			ModelId:  modelID,
			Features: features,
			Metadata: metadata,
		}

		return c.client.Predict(ctx, request)
	}

	// Client-side load balancing - round-robin across pool
	client := c.getNextClient()
	if client == nil {
		return nil, fmt.Errorf("no available ML clients in pool")
	}

	return client.Predict(ctx, modelID, features, metadata)
}

// BatchPredict performs batch predictions with load balancing
func (c *LoadBalancedClient) BatchPredict(ctx context.Context, modelID string, featureSets [][]float64, metadata map[string]string) (*pb.BatchPredictResponse, error) {
	if c.strategy == StrategyRoundRobin {
		ctx, cancel := context.WithTimeout(ctx, c.config.RequestTimeout*time.Duration(len(featureSets)))
		defer cancel()

		pbFeatureSets := make([]*pb.FeatureSet, len(featureSets))
		for i, features := range featureSets {
			pbFeatureSets[i] = &pb.FeatureSet{
				Features:   features,
				Identifier: fmt.Sprintf("batch-%d", i),
			}
		}

		request := &pb.BatchPredictRequest{
			ModelId:     modelID,
			FeatureSets: pbFeatureSets,
			Metadata:    metadata,
		}

		return c.client.BatchPredict(ctx, request)
	}

	// Client-side load balancing
	client := c.getNextClient()
	if client == nil {
		return nil, fmt.Errorf("no available ML clients in pool")
	}

	return client.BatchPredict(ctx, modelID, featureSets, metadata)
}

// HealthCheck checks ML service health
func (c *LoadBalancedClient) HealthCheck(ctx context.Context, detailed bool) (*pb.HealthCheckResponse, error) {
	if c.strategy == StrategyRoundRobin {
		ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()

		return c.client.HealthCheck(ctx, &pb.HealthCheckRequest{Detailed: detailed})
	}

	// For client-side pool, check all clients
	c.mu.RLock()
	pool := c.pool
	c.mu.RUnlock()

	if len(pool) == 0 {
		return nil, fmt.Errorf("no ML clients in pool")
	}

	// Return health from first client (or aggregate in production)
	return pool[0].HealthCheck(ctx, detailed)
}

// GetModelInfo retrieves model metadata
func (c *LoadBalancedClient) GetModelInfo(ctx context.Context, modelID string) (*pb.ModelInfoResponse, error) {
	if c.strategy == StrategyRoundRobin {
		ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()

		return c.client.GetModelInfo(ctx, &pb.ModelInfoRequest{ModelId: modelID})
	}

	client := c.getNextClient()
	if client == nil {
		return nil, fmt.Errorf("no available ML clients in pool")
	}

	return client.GetModelInfo(ctx, modelID)
}

// Close closes all connections
func (c *LoadBalancedClient) Close() error {
	if c.strategy == StrategyRoundRobin {
		if c.conn != nil {
			err := c.conn.Close()
			c.logger.Info().Msg("Load balanced ML client connection closed")
			return err
		}
		return nil
	}

	// Close all clients in pool
	c.mu.Lock()
	defer c.mu.Unlock()

	var lastErr error
	for _, client := range c.pool {
		if err := client.Close(); err != nil {
			lastErr = err
		}
	}

	c.logger.Info().
		Int("pool_size", len(c.pool)).
		Msg("ML client pool closed")

	return lastErr
}

// GetPoolSize returns the number of clients in the pool
func (c *LoadBalancedClient) GetPoolSize() int {
	if c.strategy == StrategyRoundRobin {
		return 1 // Single connection with DNS load balancing
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.pool)
}

// GetStrategy returns the current load balancing strategy
func (c *LoadBalancedClient) GetStrategy() LoadBalancingStrategy {
	return c.strategy
}
