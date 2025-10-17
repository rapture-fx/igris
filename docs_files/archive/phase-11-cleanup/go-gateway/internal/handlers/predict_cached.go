package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"

	"github.com/schlep-engine/schlep-engine/web/apps/go-gateway/internal/cache"
	"github.com/schlep-engine/schlep-engine/web/apps/go-gateway/internal/ml"
)

// PredictWithCacheHandler handles ML predictions with Redis caching
type PredictWithCacheHandler struct {
	mlClient *ml.LoadBalancedClient
	cache    *cache.PredictionCache
	logger   zerolog.Logger
}

// PredictRequest represents an ML prediction request
type PredictRequest struct {
	ModelID  string             `json:"model_id" validate:"required"`
	Features []float64          `json:"features" validate:"required,min=1"`
	Metadata map[string]string  `json:"metadata,omitempty"`
}

// PredictResponse represents an ML prediction response
type PredictResponse struct {
	Prediction    float64            `json:"prediction"`
	Confidence    float64            `json:"confidence"`
	ModelID       string             `json:"model_id"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
	LatencyMs     int64              `json:"latency_ms"`
	CacheHit      bool               `json:"cache_hit"`
	ReplicaInfo   string             `json:"replica_info,omitempty"`
}

// NewPredictWithCacheHandler creates a new prediction handler with caching
func NewPredictWithCacheHandler(mlClient *ml.LoadBalancedClient, cache *cache.PredictionCache, logger zerolog.Logger) *PredictWithCacheHandler {
	return &PredictWithCacheHandler{
		mlClient: mlClient,
		cache:    cache,
		logger:   logger.With().Str("handler", "predict-cached").Logger(),
	}
}

// Handle processes ML prediction requests with caching
func (h *PredictWithCacheHandler) Handle(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	startTime := time.Now()

	// Parse request
	var req PredictRequest
	if err := c.BodyParser(&req); err != nil {
		h.logger.Warn().Err(err).Msg("Failed to parse prediction request")
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format",
		})
	}

	// Validate request
	if req.ModelID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "model_id is required",
		})
	}
	if len(req.Features) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "features are required",
		})
	}

	// Check cache first
	cached, err := h.cache.Get(ctx, req.ModelID, req.Features)
	if err != nil {
		h.logger.Warn().
			Err(err).
			Str("model_id", req.ModelID).
			Msg("Cache lookup error")
		// Continue to ML service on cache error
	}

	if cached != nil {
		// Cache hit - return cached prediction
		latency := time.Since(startTime).Milliseconds()

		h.logger.Info().
			Str("model_id", req.ModelID).
			Int64("latency_ms", latency).
			Bool("cache_hit", true).
			Msg("Prediction served from cache")

		return c.JSON(PredictResponse{
			Prediction:    cached.Prediction,
			Confidence:    cached.Confidence,
			ModelID:       cached.ModelID,
			Probabilities: cached.Probabilities,
			LatencyMs:     latency,
			CacheHit:      true,
		})
	}

	// Cache miss - call ML service
	mlStart := time.Now()
	resp, err := h.mlClient.Predict(ctx, req.ModelID, req.Features, req.Metadata)
	if err != nil {
		h.logger.Error().
			Err(err).
			Str("model_id", req.ModelID).
			Msg("ML prediction failed")

		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Prediction service unavailable",
		})
	}
	mlLatency := time.Since(mlStart).Milliseconds()

	// Cache the result
	cachedPred := &cache.CachedPrediction{
		Prediction:    resp.Prediction,
		Confidence:    resp.Confidence,
		ModelID:       resp.ModelId,
		Probabilities: resp.Probabilities,
		LatencyMs:     mlLatency,
	}

	if err := h.cache.Set(ctx, req.ModelID, req.Features, cachedPred); err != nil {
		h.logger.Warn().
			Err(err).
			Str("model_id", req.ModelID).
			Msg("Failed to cache prediction")
		// Continue - caching failure is not critical
	}

	totalLatency := time.Since(startTime).Milliseconds()

	h.logger.Info().
		Str("model_id", req.ModelID).
		Int64("latency_ms", totalLatency).
		Int64("ml_latency_ms", mlLatency).
		Bool("cache_hit", false).
		Msg("Prediction served from ML service")

	return c.JSON(PredictResponse{
		Prediction:    resp.Prediction,
		Confidence:    resp.Confidence,
		ModelID:       resp.ModelId,
		Probabilities: resp.Probabilities,
		LatencyMs:     totalLatency,
		CacheHit:      false,
	})
}

// BatchPredictRequest represents a batch prediction request
type BatchPredictRequest struct {
	ModelID     string              `json:"model_id" validate:"required"`
	FeatureSets [][]float64         `json:"feature_sets" validate:"required,min=1"`
	Metadata    map[string]string   `json:"metadata,omitempty"`
}

// BatchPredictResponse represents a batch prediction response
type BatchPredictResponse struct {
	Predictions   []PredictResponse `json:"predictions"`
	TotalLatencyMs int64            `json:"total_latency_ms"`
	SuccessCount   int              `json:"success_count"`
	ErrorCount     int              `json:"error_count"`
	CacheHitCount  int              `json:"cache_hit_count"`
}

// HandleBatch processes batch ML prediction requests with caching
func (h *PredictWithCacheHandler) HandleBatch(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 60*time.Second)
	defer cancel()

	startTime := time.Now()

	// Parse request
	var req BatchPredictRequest
	if err := c.BodyParser(&req); err != nil {
		h.logger.Warn().Err(err).Msg("Failed to parse batch prediction request")
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format",
		})
	}

	if req.ModelID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "model_id is required",
		})
	}
	if len(req.FeatureSets) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "feature_sets are required",
		})
	}

	predictions := make([]PredictResponse, 0, len(req.FeatureSets))
	var cacheHits, successCount, errorCount int

	// Check cache for each feature set
	uncachedIndices := make([]int, 0)
	uncachedFeatures := make([][]float64, 0)

	for i, features := range req.FeatureSets {
		cached, err := h.cache.Get(ctx, req.ModelID, features)
		if err != nil || cached == nil {
			uncachedIndices = append(uncachedIndices, i)
			uncachedFeatures = append(uncachedFeatures, features)
		} else {
			// Cache hit
			predictions = append(predictions, PredictResponse{
				Prediction:    cached.Prediction,
				Confidence:    cached.Confidence,
				ModelID:       cached.ModelID,
				Probabilities: cached.Probabilities,
				LatencyMs:     0, // From cache
				CacheHit:      true,
			})
			cacheHits++
			successCount++
		}
	}

	// Call ML service for uncached predictions
	if len(uncachedFeatures) > 0 {
		resp, err := h.mlClient.BatchPredict(ctx, req.ModelID, uncachedFeatures, req.Metadata)
		if err != nil {
			h.logger.Error().
				Err(err).
				Str("model_id", req.ModelID).
				Int("uncached_count", len(uncachedFeatures)).
				Msg("Batch ML prediction failed")

			errorCount = len(uncachedFeatures)
		} else {
			// Process ML responses
			for i, pred := range resp.Predictions {
				if pred.Error != "" {
					errorCount++
					continue
				}

				predictions = append(predictions, PredictResponse{
					Prediction:    pred.Prediction,
					Confidence:    pred.Confidence,
					ModelID:       pred.ModelId,
					Probabilities: pred.Probabilities,
					LatencyMs:     pred.LatencyMs,
					CacheHit:      false,
				})

				// Cache the result
				cachedPred := &cache.CachedPrediction{
					Prediction:    pred.Prediction,
					Confidence:    pred.Confidence,
					ModelID:       pred.ModelId,
					Probabilities: pred.Probabilities,
					LatencyMs:     pred.LatencyMs,
				}

				originalFeatures := req.FeatureSets[uncachedIndices[i]]
				h.cache.Set(ctx, req.ModelID, originalFeatures, cachedPred)

				successCount++
			}
		}
	}

	totalLatency := time.Since(startTime).Milliseconds()

	h.logger.Info().
		Str("model_id", req.ModelID).
		Int("total_count", len(req.FeatureSets)).
		Int("cache_hits", cacheHits).
		Int("ml_calls", len(uncachedFeatures)).
		Int("success", successCount).
		Int("errors", errorCount).
		Int64("latency_ms", totalLatency).
		Msg("Batch prediction completed")

	return c.JSON(BatchPredictResponse{
		Predictions:    predictions,
		TotalLatencyMs: totalLatency,
		SuccessCount:   successCount,
		ErrorCount:     errorCount,
		CacheHitCount:  cacheHits,
	})
}

// HandleInvalidateCache invalidates cache for a specific model
func (h *PredictWithCacheHandler) HandleInvalidateCache(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	modelID := c.Params("model_id")
	if modelID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "model_id is required",
		})
	}

	if err := h.cache.InvalidateModel(ctx, modelID); err != nil {
		h.logger.Error().
			Err(err).
			Str("model_id", modelID).
			Msg("Failed to invalidate cache")

		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to invalidate cache",
		})
	}

	h.logger.Info().
		Str("model_id", modelID).
		Msg("Cache invalidated for model")

	return c.JSON(fiber.Map{
		"message":  "Cache invalidated successfully",
		"model_id": modelID,
	})
}

// HandleCacheStats returns cache statistics
func (h *PredictWithCacheHandler) HandleCacheStats(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 5*time.Second)
	defer cancel()

	stats, err := h.cache.GetStats(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get cache stats")
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve cache statistics",
		})
	}

	return c.JSON(fiber.Map{
		"stats": stats,
	})
}
