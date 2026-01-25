// +build ignore

// This tool is excluded from normal builds as it depends on experimental packages
// To build: go build -tags ignore ./labs/tools/cache_warmer/

package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/web/apps/go-gateway/internal/cache"
	mlv1 "github.com/Igris-inertial/system/web/apps/go-gateway/proto/ml/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// CacheWarmerConfig holds configuration for cache warming
type CacheWarmerConfig struct {
	RedisAddress   string
	RedisDB        int
	RedisTTL       time.Duration
	MLServiceAddr  string
	TopK           int
	DryRun         bool
	ConcurrentJobs int
	UsageLogPath   string
}

// UsageRecord represents a single usage record for cache warming
type UsageRecord struct {
	ModelID   string    `json:"model_id"`
	Features  []float64 `json:"features"`
	Timestamp time.Time `json:"timestamp"`
	Count     int       `json:"count"`
}

// CacheWarmer warms the cache with hot-model predictions
type CacheWarmer struct {
	config      CacheWarmerConfig
	cache       *cache.PredictionCache
	mlClient    mlv1.MLServiceClient
	mlConn      *grpc.ClientConn
	logger      zerolog.Logger
	warmedCount int
	errorCount  int
}

// NewCacheWarmer creates a new cache warmer instance
func NewCacheWarmer(config CacheWarmerConfig) (*CacheWarmer, error) {
	logger := log.Logger.With().Str("component", "cache-warmer").Logger()

	// Initialize Redis cache
	cacheConfig := cache.Config{
		Address:    config.RedisAddress,
		DB:         config.RedisDB,
		TTL:        config.RedisTTL,
		PoolSize:   10,
		MaxRetries: 3,
	}

	redisCache, err := cache.NewPredictionCache(cacheConfig, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cache: %w", err)
	}

	// Connect to ML service
	conn, err := grpc.Dial(
		config.MLServiceAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ML service: %w", err)
	}

	mlClient := mlv1.NewMLServiceClient(conn)

	cw := &CacheWarmer{
		config:   config,
		cache:    redisCache,
		mlClient: mlClient,
		mlConn:   conn,
		logger:   logger,
	}

	logger.Info().
		Str("redis", config.RedisAddress).
		Str("ml_service", config.MLServiceAddr).
		Int("top_k", config.TopK).
		Bool("dry_run", config.DryRun).
		Msg("Cache warmer initialized")

	return cw, nil
}

// WarmFromUsageLogs reads usage logs and warms the cache with top-K queries
func (cw *CacheWarmer) WarmFromUsageLogs(ctx context.Context) error {
	cw.logger.Info().
		Str("log_path", cw.config.UsageLogPath).
		Msg("Reading usage logs for cache warming")

	// Read usage log file
	data, err := os.ReadFile(cw.config.UsageLogPath)
	if err != nil {
		return fmt.Errorf("failed to read usage log: %w", err)
	}

	var records []UsageRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return fmt.Errorf("failed to parse usage log: %w", err)
	}

	cw.logger.Info().
		Int("total_records", len(records)).
		Msg("Loaded usage records")

	// Sort by count (descending) and take top-K
	sortedRecords := cw.getTopKRecords(records, cw.config.TopK)

	cw.logger.Info().
		Int("top_k", len(sortedRecords)).
		Msg("Selected top-K records for warming")

	// Warm cache with top-K queries
	return cw.warmRecords(ctx, sortedRecords)
}

// WarmFromModelList warms cache for specific models with synthetic data
func (cw *CacheWarmer) WarmFromModelList(ctx context.Context, modelIDs []string, sampleFeatures [][]float64) error {
	cw.logger.Info().
		Int("models", len(modelIDs)).
		Int("samples_per_model", len(sampleFeatures)).
		Msg("Warming cache with model list and sample features")

	for _, modelID := range modelIDs {
		for _, features := range sampleFeatures {
			if err := cw.warmSinglePrediction(ctx, modelID, features); err != nil {
				cw.logger.Warn().
					Err(err).
					Str("model_id", modelID).
					Msg("Failed to warm prediction")
				cw.errorCount++
			}
		}
	}

	return nil
}

// warmRecords warms cache with a list of usage records
func (cw *CacheWarmer) warmRecords(ctx context.Context, records []UsageRecord) error {
	semaphore := make(chan struct{}, cw.config.ConcurrentJobs)

	for i, record := range records {
		semaphore <- struct{}{} // Acquire

		go func(idx int, rec UsageRecord) {
			defer func() { <-semaphore }() // Release

			if err := cw.warmSinglePrediction(ctx, rec.ModelID, rec.Features); err != nil {
				cw.logger.Warn().
					Err(err).
					Str("model_id", rec.ModelID).
					Int("index", idx).
					Msg("Failed to warm prediction")
				cw.errorCount++
			} else {
				cw.warmedCount++
				if cw.warmedCount%100 == 0 {
					cw.logger.Info().
						Int("warmed", cw.warmedCount).
						Int("total", len(records)).
						Msg("Cache warming progress")
				}
			}
		}(i, record)
	}

	// Wait for all goroutines to complete
	for i := 0; i < cap(semaphore); i++ {
		semaphore <- struct{}{}
	}

	cw.logger.Info().
		Int("warmed", cw.warmedCount).
		Int("errors", cw.errorCount).
		Msg("Cache warming completed")

	return nil
}

// warmSinglePrediction warms cache with a single prediction
func (cw *CacheWarmer) warmSinglePrediction(ctx context.Context, modelID string, features []float64) error {
	if cw.config.DryRun {
		cw.logger.Debug().
			Str("model_id", modelID).
			Int("features_count", len(features)).
			Msg("DRY RUN: Would warm cache")
		return nil
	}

	// Check if already cached
	cached, err := cw.cache.Get(ctx, modelID, features)
	if err != nil {
		return fmt.Errorf("cache lookup error: %w", err)
	}

	if cached != nil {
		cw.logger.Debug().
			Str("model_id", modelID).
			Msg("Prediction already cached, skipping")
		return nil
	}

	// Call ML service to get prediction
	startTime := time.Now()
	req := &mlv1.PredictRequest{
		ModelId:  modelID,
		Features: features,
	}

	resp, err := cw.mlClient.Predict(ctx, req)
	if err != nil {
		return fmt.Errorf("ML prediction failed: %w", err)
	}

	latency := time.Since(startTime).Milliseconds()

	// Cache the result
	cachedPred := &cache.CachedPrediction{
		Prediction:    resp.Prediction,
		Confidence:    resp.Confidence,
		ModelID:       resp.ModelId,
		Probabilities: resp.Probabilities,
		LatencyMs:     latency,
	}

	if err := cw.cache.Set(ctx, modelID, features, cachedPred); err != nil {
		return fmt.Errorf("cache set error: %w", err)
	}

	cw.logger.Debug().
		Str("model_id", modelID).
		Int64("latency_ms", latency).
		Msg("Prediction warmed in cache")

	return nil
}

// getTopKRecords returns top-K records sorted by count
func (cw *CacheWarmer) getTopKRecords(records []UsageRecord, k int) []UsageRecord {
	// Simple bubble sort for demo (use heap in production)
	sorted := make([]UsageRecord, len(records))
	copy(sorted, records)

	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].Count > sorted[i].Count {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	if k < len(sorted) {
		return sorted[:k]
	}
	return sorted
}

// GenerateSyntheticUsageLog generates a synthetic usage log for testing
func GenerateSyntheticUsageLog(outputPath string, numRecords int) error {
	records := make([]UsageRecord, 0, numRecords)

	models := []string{"model_xgb_v1", "model_rf_v2", "model_nn_v3"}

	for i := 0; i < numRecords; i++ {
		modelID := models[i%len(models)]
		features := make([]float64, 10)
		for j := 0; j < 10; j++ {
			features[j] = float64(i*10 + j)
		}

		record := UsageRecord{
			ModelID:   modelID,
			Features:  features,
			Timestamp: time.Now().Add(-time.Duration(i) * time.Minute),
			Count:     numRecords - i, // Higher count for earlier records
		}

		records = append(records, record)
	}

	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal records: %w", err)
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info().
		Str("path", outputPath).
		Int("records", numRecords).
		Msg("Generated synthetic usage log")

	return nil
}

// GetStats returns cache warming statistics
func (cw *CacheWarmer) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"warmed_count": cw.warmedCount,
		"error_count":  cw.errorCount,
		"success_rate": float64(cw.warmedCount) / float64(cw.warmedCount+cw.errorCount),
	}
}

// Close closes all connections
func (cw *CacheWarmer) Close() error {
	if err := cw.cache.Close(); err != nil {
		return fmt.Errorf("failed to close cache: %w", err)
	}

	if err := cw.mlConn.Close(); err != nil {
		return fmt.Errorf("failed to close ML connection: %w", err)
	}

	return nil
}

func main() {
	// Command-line flags
	redisAddr := flag.String("redis", "localhost:6379", "Redis address")
	redisDB := flag.Int("redis-db", 0, "Redis database number")
	redisTTL := flag.Duration("ttl", 1*time.Hour, "Cache TTL")
	mlAddr := flag.String("ml-service", "localhost:50051", "ML service address")
	topK := flag.Int("top-k", 100, "Number of top queries to warm")
	dryRun := flag.Bool("dry-run", false, "Dry run mode (no actual caching)")
	concurrent := flag.Int("concurrent", 10, "Number of concurrent jobs")
	usageLog := flag.String("usage-log", "", "Path to usage log JSON file")
	generateLog := flag.Bool("generate-log", false, "Generate synthetic usage log")
	generateCount := flag.Int("generate-count", 1000, "Number of records to generate")

	flag.Parse()

	// Setup logger
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})

	ctx := context.Background()

	// Generate synthetic log if requested
	if *generateLog {
		if *usageLog == "" {
			*usageLog = "/tmp/cache_warmer_usage.json"
		}
		if err := GenerateSyntheticUsageLog(*usageLog, *generateCount); err != nil {
			log.Fatal().Err(err).Msg("Failed to generate usage log")
		}
		return
	}

	// Validate usage log path
	if *usageLog == "" {
		log.Fatal().Msg("Usage log path is required (use -usage-log flag)")
	}

	// Create cache warmer
	config := CacheWarmerConfig{
		RedisAddress:   *redisAddr,
		RedisDB:        *redisDB,
		RedisTTL:       *redisTTL,
		MLServiceAddr:  *mlAddr,
		TopK:           *topK,
		DryRun:         *dryRun,
		ConcurrentJobs: *concurrent,
		UsageLogPath:   *usageLog,
	}

	warmer, err := NewCacheWarmer(config)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create cache warmer")
	}
	defer warmer.Close()

	// Warm cache from usage logs
	if err := warmer.WarmFromUsageLogs(ctx); err != nil {
		log.Fatal().Err(err).Msg("Cache warming failed")
	}

	// Print stats
	stats := warmer.GetStats()
	log.Info().
		Interface("stats", stats).
		Msg("Cache warming completed successfully")
}
