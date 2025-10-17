package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/schlep-engine/gateway/internal/ml"
	"github.com/schlep-engine/gateway/pkg/metrics"
)

// MLPredictCached handles ML prediction with Redis caching
// Cache Strategy:
// - Key: ml:predict:<model_id>:<features_hash>
// - TTL: 5 minutes (configurable)
// - Invalidation: Manual or on model update
func MLPredictCached(mlClient *ml.Client, redisClient *redis.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req PredictRequest
		if err := c.BodyParser(&req); err != nil {
			logger.Debug().Err(err).Msg("Failed to parse ML predict request")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// Validate request
		if req.ModelID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "model_id is required",
			})
		}

		if len(req.Features) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "features are required",
			})
		}

		ctx := c.Context()

		// Generate cache key
		cacheKey := generateCacheKey(req.ModelID, req.Features)
		logger.Debug().
			Str("cache_key", cacheKey).
			Str("model_id", req.ModelID).
			Msg("Generated cache key")

		// Try cache first
		cacheStart := time.Now()
		cached, err := redisClient.Get(ctx, cacheKey).Result()
		cacheLookupDuration := time.Since(cacheStart)

		if err == nil {
			// Cache hit
			var cachedResp PredictResponse
			if err := json.Unmarshal([]byte(cached), &cachedResp); err == nil {
				logger.Debug().
					Str("model_id", req.ModelID).
					Float64("prediction", cachedResp.Prediction).
					Dur("cache_lookup", cacheLookupDuration).
					Msg("Cache hit - returning cached prediction")

				metrics.RecordCacheHit("ml_predict", req.ModelID)

				return c.JSON(fiber.Map{
					"prediction":        cachedResp.Prediction,
					"confidence":        cachedResp.Confidence,
					"model_id":          cachedResp.ModelId,
					"probabilities":     cachedResp.Probabilities,
					"cached":            true,
					"cache_lookup_ms":   cacheLookupDuration.Milliseconds(),
					"note":              "Cached result from previous prediction",
				})
			}
		}

		// Cache miss - call ML service
		logger.Debug().
			Str("model_id", req.ModelID).
			Msg("Cache miss - calling ML service")

		metrics.RecordCacheMiss("ml_predict", req.ModelID)

		start := time.Now()
		resp, err := mlClient.Predict(ctx, req.ModelID, req.Features, req.Metadata)
		mlDuration := time.Since(start)

		// Record metrics
		status := "success"
		if err != nil {
			status = "error"
			logger.Error().Err(err).
				Str("model_id", req.ModelID).
				Int("features_count", len(req.Features)).
				Dur("duration", mlDuration).
				Msg("ML prediction failed")
		}
		metrics.RecordGrpcCall("python-ml", "Predict", status, mlDuration)

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "ML prediction failed",
				"message":    err.Error(),
				"latency_ms": mlDuration.Milliseconds(),
			})
		}

		// Cache the response (5 min TTL)
		cacheTTL := 5 * time.Minute
		respJSON, err := json.Marshal(resp)
		if err == nil {
			cacheErr := redisClient.Set(ctx, cacheKey, respJSON, cacheTTL).Err()
			if cacheErr != nil {
				logger.Warn().Err(cacheErr).Msg("Failed to cache ML prediction")
			} else {
				logger.Debug().
					Str("cache_key", cacheKey).
					Dur("ttl", cacheTTL).
					Msg("Cached ML prediction")
			}
		}

		logger.Debug().
			Str("model_id", req.ModelID).
			Float64("prediction", resp.Prediction).
			Float64("confidence", resp.Confidence).
			Int64("latency_ms", resp.LatencyMs).
			Msg("ML prediction successful")

		return c.JSON(fiber.Map{
			"prediction":      resp.Prediction,
			"confidence":      resp.Confidence,
			"model_id":        resp.ModelId,
			"latency_ms":      mlDuration.Milliseconds(),
			"ml_latency_ms":   resp.LatencyMs,
			"probabilities":   resp.Probabilities,
			"cached":          false,
			"cache_key":       cacheKey,
			"cache_ttl_sec":   int(cacheTTL.Seconds()),
			"note":            "Fresh prediction from ML service (now cached)",
		})
	}
}

// MLBatchPredictCached handles batch ML predictions with caching
// Strategy: Cache individual predictions, aggregate results
func MLBatchPredictCached(mlClient *ml.Client, redisClient *redis.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req BatchPredictRequest
		if err := c.BodyParser(&req); err != nil {
			logger.Debug().Err(err).Msg("Failed to parse batch predict request")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// Validate request
		if req.ModelID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "model_id is required",
			})
		}

		if len(req.FeatureSets) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "feature_sets are required",
			})
		}

		ctx := c.Context()
		start := time.Now()

		// Check cache for each feature set
		var cachedResults []PredictResponse
		var uncachedFeatures [][]float64
		var featureIndexMap = make(map[int]int) // Maps original index to uncached index

		cacheHits := 0
		cacheMisses := 0

		for i, features := range req.FeatureSets {
			cacheKey := generateCacheKey(req.ModelID, features)
			cached, err := redisClient.Get(ctx, cacheKey).Result()

			if err == nil {
				var cachedResp PredictResponse
				if err := json.Unmarshal([]byte(cached), &cachedResp); err == nil {
					cachedResults = append(cachedResults, cachedResp)
					cacheHits++
					continue
				}
			}

			// Cache miss - add to uncached list
			uncachedFeatures = append(uncachedFeatures, features)
			featureIndexMap[i] = len(uncachedFeatures) - 1
			cacheMisses++
		}

		logger.Debug().
			Str("model_id", req.ModelID).
			Int("total_predictions", len(req.FeatureSets)).
			Int("cache_hits", cacheHits).
			Int("cache_misses", cacheMisses).
			Msg("Batch prediction cache lookup")

		// Record batch cache metrics
		if cacheHits > 0 {
			metrics.RecordBatchCacheHit("ml_batch_predict", req.ModelID, cacheHits)
		}
		if cacheMisses > 0 {
			metrics.RecordBatchCacheMiss("ml_batch_predict", req.ModelID, cacheMisses)
		}

		var uncachedResults []PredictResponse
		var mlDuration time.Duration

		// Call ML service only for uncached predictions
		if len(uncachedFeatures) > 0 {
			mlStart := time.Now()
			batchResp, err := mlClient.BatchPredict(ctx, req.ModelID, uncachedFeatures, req.Metadata)
			mlDuration = time.Since(mlStart)

			status := "success"
			if err != nil {
				status = "error"
				logger.Error().Err(err).
					Str("model_id", req.ModelID).
					Int("batch_size", len(uncachedFeatures)).
					Dur("duration", mlDuration).
					Msg("ML batch prediction failed")
			}
			metrics.RecordGrpcCall("python-ml", "BatchPredict", status, mlDuration)

			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error":      "ML batch prediction failed",
					"message":    err.Error(),
					"latency_ms": mlDuration.Milliseconds(),
				})
			}

			uncachedResults = batchResp.Predictions

			// Cache each uncached result
			cacheTTL := 5 * time.Minute
			for i, pred := range uncachedResults {
				if i < len(uncachedFeatures) {
					cacheKey := generateCacheKey(req.ModelID, uncachedFeatures[i])
					predJSON, err := json.Marshal(pred)
					if err == nil {
						redisClient.Set(ctx, cacheKey, predJSON, cacheTTL)
					}
				}
			}
		}

		// Combine cached and uncached results
		allResults := make([]PredictResponse, len(req.FeatureSets))
		cachedIdx := 0
		uncachedIdx := 0

		for i := range req.FeatureSets {
			if uncachedIndex, exists := featureIndexMap[i]; exists {
				// This was uncached
				if uncachedIndex < len(uncachedResults) {
					allResults[i] = uncachedResults[uncachedIdx]
					uncachedIdx++
				}
			} else {
				// This was cached
				if cachedIdx < len(cachedResults) {
					allResults[i] = cachedResults[cachedIdx]
					cachedIdx++
				}
			}
		}

		totalDuration := time.Since(start)

		logger.Debug().
			Str("model_id", req.ModelID).
			Int("total", len(req.FeatureSets)).
			Int("cached", cacheHits).
			Int("fresh", cacheMisses).
			Int64("total_latency_ms", totalDuration.Milliseconds()).
			Msg("Batch prediction completed")

		return c.JSON(fiber.Map{
			"predictions":       allResults,
			"success_count":     len(allResults),
			"error_count":       0,
			"total_latency_ms":  totalDuration.Milliseconds(),
			"ml_latency_ms":     mlDuration.Milliseconds(),
			"batch_size":        len(req.FeatureSets),
			"cache_hits":        cacheHits,
			"cache_misses":      cacheMisses,
			"cache_hit_rate":    float64(cacheHits) / float64(len(req.FeatureSets)),
			"note":              "Batch prediction with caching",
		})
	}
}

// ClearMLCache clears ML prediction cache for a model (admin endpoint)
func ClearMLCache(redisClient *redis.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		modelID := c.Params("model_id")
		if modelID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "model_id parameter is required",
			})
		}

		ctx := c.Context()
		pattern := fmt.Sprintf("ml:predict:%s:*", modelID)

		// Scan and delete matching keys
		var cursor uint64
		deletedCount := 0

		for {
			var keys []string
			var err error
			keys, cursor, err = redisClient.Scan(ctx, cursor, pattern, 100).Result()
			if err != nil {
				logger.Error().Err(err).Msg("Failed to scan cache keys")
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "Failed to scan cache",
				})
			}

			if len(keys) > 0 {
				deleted, err := redisClient.Del(ctx, keys...).Result()
				if err != nil {
					logger.Error().Err(err).Msg("Failed to delete cache keys")
				} else {
					deletedCount += int(deleted)
				}
			}

			if cursor == 0 {
				break
			}
		}

		logger.Info().
			Str("model_id", modelID).
			Int("deleted_keys", deletedCount).
			Msg("ML cache cleared")

		return c.JSON(fiber.Map{
			"model_id":     modelID,
			"deleted_keys": deletedCount,
			"message":      fmt.Sprintf("Cleared %d cached predictions for model %s", deletedCount, modelID),
		})
	}
}

// GetMLCacheStats returns cache statistics for ML predictions (admin endpoint)
func GetMLCacheStats(redisClient *redis.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := c.Context()

		// Get total cache keys
		var cursor uint64
		totalKeys := 0
		keysByModel := make(map[string]int)

		for {
			var keys []string
			var err error
			keys, cursor, err = redisClient.Scan(ctx, cursor, "ml:predict:*", 100).Result()
			if err != nil {
				logger.Error().Err(err).Msg("Failed to scan cache keys")
				break
			}

			totalKeys += len(keys)

			// Count by model
			for _, key := range keys {
				// Key format: ml:predict:<model_id>:<hash>
				parts := splitCacheKey(key)
				if len(parts) >= 3 {
					modelID := parts[2]
					keysByModel[modelID]++
				}
			}

			if cursor == 0 {
				break
			}
		}

		// Get Redis memory stats
		memStats, err := redisClient.Info(ctx, "memory").Result()
		if err != nil {
			logger.Error().Err(err).Msg("Failed to get Redis memory stats")
		}

		return c.JSON(fiber.Map{
			"total_cached_predictions": totalKeys,
			"predictions_by_model":     keysByModel,
			"redis_memory_stats":       memStats,
			"cache_ttl_seconds":        300, // 5 minutes
		})
	}
}

// Helper: Generate cache key from model ID and features
func generateCacheKey(modelID string, features []float64) string {
	// Sort features to ensure consistent key for same inputs (order-independent)
	sortedFeatures := make([]float64, len(features))
	copy(sortedFeatures, features)
	sort.Float64s(sortedFeatures)

	// Create hash from features
	hash := sha256.New()
	for _, f := range sortedFeatures {
		hash.Write([]byte(fmt.Sprintf("%.6f", f)))
	}
	featureHash := hex.EncodeToString(hash.Sum(nil))[:16] // First 16 chars

	return fmt.Sprintf("ml:predict:%s:%s", modelID, featureHash)
}

// Helper: Split cache key into parts
func splitCacheKey(key string) []string {
	// Simple split by ':'
	var parts []string
	current := ""
	for _, ch := range key {
		if ch == ':' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// PredictResponse represents ML prediction response (copy from ml.go for caching)
type PredictResponse struct {
	Prediction    float64           `json:"prediction"`
	Confidence    float64           `json:"confidence"`
	ModelId       string            `json:"model_id"`
	LatencyMs     int64             `json:"latency_ms"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
}
