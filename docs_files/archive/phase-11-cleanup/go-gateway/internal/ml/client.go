package ml

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/sony/gobreaker"
	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	pb "github.com/schlep-engine/schlep-engine/web/apps/go-gateway/proto/ml"
)

// ClientConfig holds configuration for ML gRPC client
type ClientConfig struct {
	ServiceURL           string
	MaxRetries           int
	RetryDelay           time.Duration
	ConnectionTimeout    time.Duration
	RequestTimeout       time.Duration
	KeepaliveTime        time.Duration
	KeepaliveTimeout     time.Duration
	EnableCircuitBreaker bool
	CircuitBreakerConfig CircuitBreakerConfig
	
	// Authentication config
	JWTSecret            string        // For JWT auth
	APIKey               string        // For API key auth
	AuthType             string        // "jwt" or "api_key" or "none"
	EnableAuth           bool
}

// CircuitBreakerConfig holds circuit breaker settings
type CircuitBreakerConfig struct {
	MaxRequests       uint32
	Interval          time.Duration
	Timeout           time.Duration
	FailureThreshold  uint32
	SuccessThreshold  uint32
}

// Client wraps the gRPC ML service client with resilience patterns
type Client struct {
	config         ClientConfig
	conn           *grpc.ClientConn
	client         pb.MLServiceClient
	circuitBreaker *gobreaker.CircuitBreaker
	logger         zerolog.Logger
	mu             sync.RWMutex
	reconnecting   bool
}

// NewClient creates a new ML service client with connection pooling and resilience
func NewClient(config ClientConfig, logger zerolog.Logger) (*Client, error) {
	if config.ServiceURL == "" {
		return nil, fmt.Errorf("ML service URL is required")
	}

	// Set defaults
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.RetryDelay == 0 {
		config.RetryDelay = 100 * time.Millisecond
	}
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

	client := &Client{
		config: config,
		logger: logger.With().Str("component", "ml-client").Logger(),
	}

	// Initialize circuit breaker if enabled
	if config.EnableCircuitBreaker {
		cbConfig := config.CircuitBreakerConfig
		if cbConfig.MaxRequests == 0 {
			cbConfig.MaxRequests = 5
		}
		if cbConfig.Interval == 0 {
			cbConfig.Interval = 60 * time.Second
		}
		if cbConfig.Timeout == 0 {
			cbConfig.Timeout = 30 * time.Second
		}
		if cbConfig.FailureThreshold == 0 {
			cbConfig.FailureThreshold = 5
		}
		if cbConfig.SuccessThreshold == 0 {
			cbConfig.SuccessThreshold = 2
		}

		client.circuitBreaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
			Name:        "MLService",
			MaxRequests: cbConfig.MaxRequests,
			Interval:    cbConfig.Interval,
			Timeout:     cbConfig.Timeout,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= cbConfig.FailureThreshold
			},
			OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
				client.logger.Warn().
					Str("from", from.String()).
					Str("to", to.String()).
					Msg("Circuit breaker state changed")
			},
		})
	}

	// Establish connection
	if err := client.connect(); err != nil {
		return nil, fmt.Errorf("failed to connect to ML service: %w", err)
	}

	// Start connection monitoring
	go client.monitorConnection()

	return client, nil
}

// connect establishes gRPC connection to ML service
func (c *Client) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Close existing connection if any
	if c.conn != nil {
		c.conn.Close()
	}

	ctx, cancel := context.WithTimeout(context.Background(), c.config.ConnectionTimeout)
	defer cancel()

	// gRPC dial options
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                c.config.KeepaliveTime,
			Timeout:             c.config.KeepaliveTimeout,
			PermitWithoutStream: true,
		}),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(50 * 1024 * 1024), // 50MB
			grpc.MaxCallSendMsgSize(50 * 1024 * 1024), // 50MB
		),
	}

	conn, err := grpc.DialContext(ctx, c.config.ServiceURL, opts...)
	if err != nil {
		return fmt.Errorf("failed to dial ML service: %w", err)
	}

	c.conn = conn
	c.client = pb.NewMLServiceClient(conn)

	c.logger.Info().
		Str("url", c.config.ServiceURL).
		Msg("Connected to ML service")

	return nil
}

// monitorConnection monitors connection health and reconnects if needed
func (c *Client) monitorConnection() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.RLock()
		conn := c.conn
		c.mu.RUnlock()

		if conn == nil {
			continue
		}

		state := conn.GetState()

		// Attempt reconnection if connection is down
		if state == connectivity.TransientFailure || state == connectivity.Shutdown {
			c.logger.Warn().
				Str("state", state.String()).
				Msg("ML service connection unhealthy, attempting reconnect")

			c.mu.Lock()
			if !c.reconnecting {
				c.reconnecting = true
				c.mu.Unlock()

				if err := c.connect(); err != nil {
					c.logger.Error().Err(err).Msg("Failed to reconnect to ML service")
				}

				c.mu.Lock()
				c.reconnecting = false
				c.mu.Unlock()
			} else {
				c.mu.Unlock()
			}
		}
	}
}

// Predict performs a single ML prediction with retries and circuit breaker
func (c *Client) Predict(ctx context.Context, modelID string, features []float64, metadata map[string]string) (*pb.PredictResponse, error) {
	// Apply request timeout
	ctx, cancel := context.WithTimeout(ctx, c.config.RequestTimeout)
	defer cancel()

	request := &pb.PredictRequest{
		ModelId:  modelID,
		Features: features,
		Metadata: metadata,
	}

	// Execute with circuit breaker if enabled
	if c.config.EnableCircuitBreaker {
		result, err := c.circuitBreaker.Execute(func() (interface{}, error) {
			return c.predictWithRetry(ctx, request)
		})
		if err != nil {
			return nil, err
		}
		return result.(*pb.PredictResponse), nil
	}

	// Execute without circuit breaker
	return c.predictWithRetry(ctx, request)
}

// predictWithRetry performs prediction with retry logic
func (c *Client) predictWithRetry(ctx context.Context, request *pb.PredictRequest) (*pb.PredictResponse, error) {
	var lastErr error

	// Add authentication metadata
	ctx = c.authenticateContext(ctx)

	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			delay := c.config.RetryDelay * time.Duration(1<<uint(attempt-1))
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}

			c.logger.Debug().
				Int("attempt", attempt+1).
				Int("max_retries", c.config.MaxRetries).
				Msg("Retrying ML prediction")
		}

		c.mu.RLock()
		client := c.client
		c.mu.RUnlock()

		if client == nil {
			lastErr = fmt.Errorf("ML client not initialized")
			continue
		}

		resp, err := client.Predict(ctx, request)
		if err != nil {
			// Check if error is retryable
			st, ok := status.FromError(err)
			if !ok {
				return nil, err
			}

			// Don't retry on client errors
			if st.Code() == codes.InvalidArgument || st.Code() == codes.NotFound {
				return nil, err
			}

			lastErr = err
			continue
		}

		// Check for application-level errors
		if resp.Error != "" {
			return nil, fmt.Errorf("ML service error: %s", resp.Error)
		}

		return resp, nil
	}

	return nil, fmt.Errorf("ML prediction failed after %d retries: %w", c.config.MaxRetries, lastErr)
}

// authenticateContext adds authentication metadata to gRPC context
func (c *Client) authenticateContext(ctx context.Context) context.Context {
	if !c.config.EnableAuth || c.config.AuthType == "none" {
		return ctx
	}

	var md metadata.MD

	switch c.config.AuthType {
	case "jwt":
		// Generate JWT token for service-to-service communication
		if c.config.JWTSecret != "" {
			token := c.generateServiceJWT()
			md = metadata.Pairs("authorization", "bearer "+token)
		} else {
			c.logger.Warn().Msg("JWT authentication enabled but no JWT secret provided")
		}
	case "api_key":
		if c.config.APIKey != "" {
			md = metadata.Pairs("x-api-key", c.config.APIKey)
		} else {
			c.logger.Warn().Msg("API key authentication enabled but no API key provided")
		}
	default:
		c.logger.Warn().Str("auth_type", c.config.AuthType).Msg("Unknown auth type")
		return ctx
	}

	if len(md) > 0 {
		return metadata.NewOutgoingContext(ctx, md)
	}

	return ctx
}

// generateServiceJWT creates a JWT token for service-to-service communication
func (c *Client) generateServiceJWT() string {
	if c.config.JWTSecret == "" {
		c.logger.Warn().Msg("Cannot generate JWT: no secret provided")
		return ""
	}

	claims := &jwt.MapClaims{
		"user_id": "ml-service",
		"email":   "ml-service@schlep-engine.internal",
		"roles":   []string{"service"},
		"exp":     time.Now().Add(time.Hour).Unix(),  // 1 hour expiry
		"iat":     time.Now().Unix(),
		"iss":     "schlep-gateway",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(c.config.JWTSecret))
	if err != nil {
		c.logger.Error().Err(err).Msg("Failed to generate JWT token")
		return ""
	}

	return tokenString
}

// BatchPredict performs batch predictions
func (c *Client) BatchPredict(ctx context.Context, modelID string, featureSets [][]float64, metadata map[string]string) (*pb.BatchPredictResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, c.config.RequestTimeout*time.Duration(len(featureSets)))
	defer cancel()

	// Convert feature sets to protobuf format
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

	c.mu.RLock()
	client := c.client
	c.mu.RUnlock()

	if client == nil {
		return nil, fmt.Errorf("ML client not initialized")
	}

	return client.BatchPredict(ctx, request)
}

// HealthCheck checks ML service health
func (c *Client) HealthCheck(ctx context.Context, detailed bool) (*pb.HealthCheckResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	c.mu.RLock()
	client := c.client
	c.mu.RUnlock()

	if client == nil {
		return nil, fmt.Errorf("ML client not initialized")
	}

	return client.HealthCheck(ctx, &pb.HealthCheckRequest{Detailed: detailed})
}

// GetModelInfo retrieves model metadata
func (c *Client) GetModelInfo(ctx context.Context, modelID string) (*pb.ModelInfoResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	c.mu.RLock()
	client := c.client
	c.mu.RUnlock()

	if client == nil {
		return nil, fmt.Errorf("ML client not initialized")
	}

	return client.GetModelInfo(ctx, &pb.ModelInfoRequest{ModelId: modelID})
}

// Close closes the gRPC connection
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		err := c.conn.Close()
		c.conn = nil
		c.client = nil
		c.logger.Info().Msg("ML client connection closed")
		return err
	}

	return nil
}

// GetConnectionState returns current connection state
func (c *Client) GetConnectionState() connectivity.State {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.conn == nil {
		return connectivity.Shutdown
	}

	return c.conn.GetState()
}

// GetCircuitBreakerState returns current circuit breaker state
func (c *Client) GetCircuitBreakerState() string {
	if c.circuitBreaker == nil {
		return "disabled"
	}
	return c.circuitBreaker.State().String()
}
