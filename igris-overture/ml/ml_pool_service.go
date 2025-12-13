package ml

import (
	"context"
	"fmt"
	"time"
	"sync"
	"encoding/json"
	"net/http"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	
	pb "github.com/Schlep-engine/igris-inertial/proto"
	"github.com/Schlep-engine/igris-inertial/igris-overture/metrics"
)

// PoolService manages ML service connections via connection pooling
type PoolService struct {
	pool        *ConnectionPool
	config      *PoolServiceConfig
	modelRouter *ModelRouter
	mu          sync.RWMutex
	
	// Metrics
	predictionCount    int64
	cacheHitsCount     int64
	cacheMissesCount   int64
	errorCount         int64
	lastPredictTime     time.Time
	avgPredictionTime  time.Duration
}

// PoolServiceConfig holds configuration for the ML pool service
type PoolServiceConfig struct {
	MLEndpoint         string        `json:"ml_endpoint"`
	MinConnections     int           `json:"min_connections"`
	MaxConnections     int           `json:"max_connections"`
	ConnectionTimeout  time.Duration `json:"connection_timeout"`
	HealthCheckInterval time.Duration `json:"health_check_interval"`
	MaxConnIdleTime    time.Duration `json:"max_conn_idle_time"`
	EnableCaching      bool          `json:"enable_caching"`
	CacheTTL           time.Duration `json:"cache_ttl"`
	RetryAttempts      int           `json:"retry_attempts"`
	LoadBalanceStrategy string        `json:"load_balance_strategy"`
}

// ModelRouter handles routing requests to appropriate ML models
type ModelRouter struct {
	routingTable map[string]string // model_id -> routing_key
	mu           sync.RWMutex
}

// NewPoolService creates a new ML pool service
func NewPoolService(config *PoolServiceConfig) (*PoolService, error) {
	if config.MLEndpoint == "" {
		return nil, fmt.Errorf("ML endpoint is required")
	}
	
	// Set defaults
	if config.MinConnections == 0 {
		config.MinConnections = 2
	}
	if config.MaxConnections == 0 {
		config.MaxConnections = 10
	}
	if config.ConnectionTimeout == 0 {
		config.ConnectionTimeout = 5 * time.Second
	}
	if config.HealthCheckInterval == 0 {
		config.HealthCheckInterval = 30 * time.Second
	}
	if config.MaxConnIdleTime == 0 {
		config.MaxConnIdleTime = 10 * time.Minute
	}
	if config.CacheTTL == 0 {
		config.CacheTTL = 5 * time.Minute
	}
	if config.RetryAttempts == 0 {
		config.RetryAttempts = 3
	}
	if config.LoadBalanceStrategy == "" {
		config.LoadBalanceStrategy = "round_robin"
	}
	
	// Create connection pool config
	poolConfig := &ConnectionPoolConfig{
		MLServiceEndpoint:   config.MLEndpoint,
		MinConnections:     config.MinConnections,
		MaxConnections:     config.MaxConnections,
		ConnectionTimeout:  config.ConnectionTimeout,
		HealthCheckInterval: config.HealthCheckInterval,
		MaxConnIdleTime:    config.MaxConnIdleTime,
		RetryAttempts:      config.RetryAttempts,
		RetryDelay:         100 * time.Millisecond,
	}
	
	pool, err := NewConnectionPool(poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}
	
	service := &PoolService{
		pool:        pool,
		config:      config,
		modelRouter: &ModelRouter{
			routingTable: make(map[string]string),
		},
	}
	
	log.Info().
		Str("ml_endpoint", config.MLEndpoint).
		Int("min_connections", config.MinConnections).
		Int("max_connections", config.MaxConnections).
		Bool("enable_caching", config.EnableCaching).
		Msg("ML pool service created")
	
	return service, nil
}

// Predict handles prediction requests with connection pooling
func (s *PoolService) Predict(ctx context.Context, req *MLPredictRequest) (*MLPredictResponse, error) {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		s.updatePredictionMetrics(duration)
	}()
	
	// Validate request
	if err := s.validateRequest(req); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}
	
	// Check cache if enabled
	if s.config.EnableCaching {
		if cached, found := s.checkCache(req); found {
			metrics.IncrementCounter("ml_cache_hits")
			s.cacheHitsCount++
			
			log.Debug().
				Str("model_id", req.ModelID).
				Msg("Serving prediction from cache")
			
			return cached, nil
		}
		metrics.IncrementCounter("ml_cache_misses")
		s.cacheMissesCount++
	}
	
	// Get prediction from ML service with retry
	var response *pb.PredictResponse
	err := s.pool.WithRetry(ctx, func(ctx context.Context, client pb.MLServiceClient) error {
		grpcReq := &pb.PredictRequest{
			ModelId:  req.ModelID,
			Features: req.Features,
			Metadata: req.Metadata,
		}
		
		var predictErr error
		response, predictErr = client.Predict(ctx, grpcReq)
		return predictErr
	})
	
	if err != nil {
		s.errorCount++
		
		// Convert gRPC error to appropriate response
		if grpcErr, ok := status.FromError(err); ok {
			switch grpcErr.Code() {
			case codes.NotFound:
				return nil, fmt.Errorf("model not found: %s", req.ModelID)
			case codes.DeadlineExceeded:
				return nil, fmt.Errorf("prediction timeout for model: %s", req.ModelID)
			case codes.Unavailable:
				return nil, fmt.Errorf("ML service unavailable")
			default:
				return nil, fmt.Errorf("prediction failed: %s", grpcErr.Message())
			}
		}
		
		return nil, fmt.Errorf("prediction error: %w", err)
	}
	
	// Convert response
	result := &MLPredictResponse{
		Prediction:    response.Prediction,
		Confidence:    response.Confidence,
		ModelID:       response.ModelId,
		Probabilities: response.Probabilities,
		Metadata: map[string]interface{}{
			"inference_time_ms": response.InferenceTimeMs,
			"runtime_type":      response.RuntimeType,
			"pooled_connection": true,
			"timestamp":         time.Now().UTC().Format(time.RFC3339),
		},
		Cached: false,
	}
	
	// Cache result if enabled
	if s.config.EnableCaching {
		s.setCache(req, result)
	}
	
	metrics.IncrementCounter("ml_predictions")
	s.predictionCount++
	
	log.Debug().
		Str("model_id", req.ModelID).
		Float64("prediction", result.Prediction).
		Dur("inference_time", time.Duration(result.Metadata["inference_time_ms"].(float64))*time.Millisecond).
		Msg("Prediction completed")
	
	return result, nil
}

// BatchPredict handles batch prediction requests
func (s *PoolService) BatchPredict(ctx context.Context, req *MLBatchPredictRequest) (*MLBatchPredictResponse, error) {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		s.updatePredictionMetrics(duration)
	}()
	
	if len(req.Requests) == 0 {
		return nil, fmt.Errorf("empty batch request")
	}
	
	if len(req.Requests) > 100 {
		return nil, fmt.Errorf("batch size too large (max 100)")
	}
	
	responses := make([]*MLPredictResponse, len(req.Requests))
	errors := make([]string, 0)
	
	// Process batch with parallel workers
	const maxWorkers = 5
	workerChan := make(chan int, maxWorkers)
	resultsChan := make(chan batchResult, len(req.Requests))
	
	for i := range req.Requests {
		workerChan <- i
	}
	
	var wg sync.WaitGroup
	for w := 0; w < maxWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range workerChan {
				predictReq := req.Requests[idx]
				response, err := s.Predict(ctx, predictReq)
				
				if err != nil {
					resultsChan <- batchResult{
						index:  idx,
						err:    err.Error(),
						result: nil,
					}
				} else {
					resultsChan <- batchResult{
						index:  idx,
						err:    "",
						result: response,
					}
				}
			}
		}()
	}
	
	wg.Wait()
	close(workerChan)
	close(resultsChan)
	
	// Collect results
	for i := 0; i < len(req.Requests); i++ {
		result := <-resultsChan
		if result.err != "" {
			errors = append(errors, fmt.Sprintf("item %d: %s", result.index, result.err))
			responses[result.index] = &MLPredictResponse{
				Error:   result.err,
				ModelID: req.Requests[result.index].ModelID,
			}
		} else {
			responses[result.index] = result.result
		}
	}
	
	batchResponse := &MLBatchPredictResponse{
		Responses:    responses,
		TotalCount:   len(req.Requests),
		SuccessCount: len(errors),
		ErrorCount:   len(errors),
		Errors:       errors,
	 Metadata: map[string]interface{}{
			"batch_size":        len(req.Requests),
			"processing_time_ms": time.Since(start).Milliseconds(),
			"pooled_connection": true,
		},
	}
	
	metrics.IncrementCounter("ml_batch_predictions")
	
	log.Info().
		Int("batch_size", len(req.Requests)).
		Int("success_count", batchResponse.SuccessCount).
		Int("error_count", batchResponse.ErrorCount).
		Dur("processing_time", time.Since(start)).
		Msg("Batch prediction completed")
	
	return batchResponse, nil
}

// HealthCheck checks the health of the connection pool
func (s *PoolService) HealthCheck() *PoolHealthStatus {
	stats := s.pool.Stats()
	
	health := &PoolHealthStatus{
		Healthy:    stats.SuccessRate() >= 95.0 && stats.ActiveConnections > 0,
		Stats:      stats,
		LastCheck:  time.Now().UTC().Format(time.RFC3339),
	}
	
	return health
}

// ListModels lists available models from the ML service
func (s *PoolService) ListModels(ctx context.Context) (*MLModelsResponse, error) {
	var models *pb.ListModelsResponse
	err := s.pool.WithRetry(ctx, func(ctx context.Context, client pb.MLServiceClient) error {
		var listErr error
		models, listErr = client.ListModels(ctx, &emptypb.Empty{})
		return listErr
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to list models: %w", err)
	}
	
	return &MLModelsResponse{
		Models:    models.Models,
		Total:     int32(len(models.Models)),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// GetModelInfo gets information about a specific model
func (s *PoolService) GetModelInfo(ctx context.Context, modelID string) (*MLModelInfo, error) {
	req := &pb.GetModelInfoRequest{
		ModelId: modelID,
	}
	
	var info *pb.GetModelInfoResponse
	err := s.pool.WithRetry(ctx, func(ctx context.Context, client pb.MLServiceClient) error {
		var infoErr error
		info, infoErr = client.GetModelInfo(ctx, req)
		return infoErr
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to get model info: %w", err)
	}
	
	return &MLModelInfo{
		ModelId:            info.ModelId,
		ModelType:          info.ModelType,
		LoadedAt:           info.LoadedAt,
		MemoryUsageMb:      info.MemoryUsageMb,
		InferenceCount:     info.InferenceCount,
		AvgInferenceTimeMs: info.AvgInferenceTimeMs,
		LastUsed:           info.LastUsed,
	}, nil
}

// Cache functions (simplified implementation)
type cacheKey struct {
	ModelID   string
	FeaturesHash string
}

func (s *PoolService) checkCache(req *MLPredictRequest) (*MLPredictResponse, bool) {
	// Simple in-memory cache implementation
	// In production, use Redis or distributed cache
	
	// For now, just return false (not implemented)
	return nil, false
}

func (s *PoolService) setCache(req *MLPredictRequest, response *MLPredictResponse) {
	// Cache setting implementation
	// In production, store in distributed cache with TTL
}

// validateRequest validates the prediction request
func (s *PoolService) validateRequest(req *MLPredictRequest) error {
	if req == nil {
		return fmt.Errorf("request is nil")
	}
	
	if req.ModelID == "" {
		return fmt.Errorf("model_id is required")
	}
	
	if len(req.Features) == 0 {
		return fmt.Errorf("features cannot be empty")
	}
	
	if len(req.Features) > 1000 {
		return fmt.Errorf("too many features (max 1000)")
	}
	
	// Validate features are valid numbers
	for i, f := range req.Features {
		if f < -1e6 || f > 1e6 {
			return fmt.Errorf("feature %d out of range: %f", i, f)
		}
	}
	
	return nil
}

// updatePredictionMetrics updates performance metrics
func (s *PoolService) updatePredictionMetrics(duration time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.lastPredictTime = time.Now()
	
	if s.avgPredictionTime == 0 {
		s.avgPredictionTime = duration
	} else {
		// Exponential moving average
		alpha := 0.1
		s.avgPredictionTime = time.Duration(float64(s.avgPredictionTime)*(1-alpha) + float64(duration)*alpha)
	}
	
	// Update Prometheus metrics
	metrics.RecordDuration("ml_prediction_duration_seconds", duration)
	metrics.SetGauge("ml_active_connections", float64(s.pool.Stats().ActiveConnections))
	metrics.SetGauge("ml_idle_connections", float64(s.pool.Stats().IdleConnections))
}

// GetStats returns detailed statistics about the pool service
func (s *PoolService) GetStats() *PoolServiceStats {
	poolStats := s.pool.Stats()
	
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	stats := &PoolServiceStats{
		PoolStats:    poolStats,
		ServiceStats: ServiceStats{
			PredictionCount:    s.predictionCount,
			CacheHits:          s.cacheHitsCount,
			CacheMisses:        s.cacheMissesCount,
			ErrorCount:         s.errorCount,
			LastPredictTime:    s.lastPredictTime,
			AvgPredictionTime:  s.avgPredictionTime,
		},
		Config: *s.config,
	}
	
	return stats
}

// RegisterRoutes registers HTTP routes for the pool service
func (s *PoolService) RegisterRoutes(app *fiber.App) {
	pool := app.Group("/pool")
	
	// Health check
	pool.Get("/health", func(c *fiber.Ctx) error {
		health := s.HealthCheck()
		return c.JSON(health)
	})
	
	// Pool statistics
	pool.Get("/stats", func(c *fiber.Ctx) error {
		stats := s.GetStats()
		return c.JSON(stats)
	})
	
	// Models
	pool.Get("/models", func(c *fiber.Ctx) error {
		models, err := s.ListModels(c.Context())
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		return c.JSON(models)
	})
	
	pool.Get("/models/:modelId", func(c *fiber.Ctx) error {
		modelID := c.Params("modelId")
		info, err := s.GetModelInfo(c.Context(), modelID)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		return c.JSON(info)
	})
	
	// Reset cache
	pool.Delete("/cache", func(c *fiber.Ctx) error {
		// Cache reset implementation
		return c.JSON(fiber.Map{
			"message": "cache cleared",
		})
	})
}

// Close closes the connection pool and cleans up resources
func (s *PoolService) Close() error {
	if s.pool != nil {
		return s.pool.Close()
	}
	return nil
}

// Response types
type MLPredictRequest struct {
	ModelID   string            `json:"model_id"`
	Features  []float64         `json:"features"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type MLPredictResponse struct {
	Prediction   float64                 `json:"prediction"`
	Confidence   float64                 `json:"confidence"`
	ModelID      string                  `json:"model_id"`
	Probabilities map[string]float64      `json:"probabilities"`
	Metadata     map[string]interface{} `json:"metadata"`
	Cached       bool                    `json:"cached"`
	Error        string                  `json:"error,omitempty"`
}

type MLBatchPredictRequest struct {
	Requests []*MLPredictRequest `json:"requests"`
}

type MLBatchPredictResponse struct {
	Responses    []*MLPredictResponse     `json:"responses"`
	TotalCount   int                      `json:"total_count"`
	SuccessCount int                      `json:"success_count"`
	ErrorCount   int                      `json:"error_count"`
	Errors       []string                 `json:"errors"`
	Metadata     map[string]interface{}   `json:"metadata"`
}

type MLModelsResponse struct {
	Models    []string `json:"models"`
	Total     int32    `json:"total"`
	Timestamp string   `json:"timestamp"`
}

type MLModelInfo struct {
	ModelId            string `json:"model_id"`
	ModelType          string `json:"model_type"`
	LoadedAt           string `json:"loaded_at"`
	MemoryUsageMb      float64 `json:"memory_usage_mb"`
	InferenceCount     uint64 `json:"inference_count"`
	AvgInferenceTimeMs float64 `json:"avg_inference_time_ms"`
	LastUsed           string `json:"last_used"`
}

type PoolHealthStatus struct {
	Healthy   bool       `json:"healthy"`
	Stats     PoolStats  `json:"stats"`
	LastCheck string     `json:"last_check"`
}

type PoolServiceStats struct {
	PoolStats    PoolStats    `json:"pool_stats"`
	ServiceStats ServiceStats `json:"service_stats"`
	Config       PoolServiceConfig `json:"config"`
}

type ServiceStats struct {
	PredictionCount   int64         `json:"prediction_count"`
	CacheHits         int64         `json:"cache_hits"`
	CacheMisses       int64         `json:"cache_misses"`
	ErrorCount        int64         `json:"error_count"`
	LastPredictTime   time.Time     `json:"last_predict_time"`
	AvgPredictionTime time.Duration `json:"avg_prediction_time"`
}

type batchResult struct {
	index  int
	err    string
	result *MLPredictResponse
}
