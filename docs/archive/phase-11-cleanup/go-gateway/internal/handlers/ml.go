package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"github.com/schlep-engine/gateway/internal/ml"
	"github.com/schlep-engine/gateway/pkg/metrics"
)

// PredictRequest represents ML prediction request
type PredictRequest struct {
	Features []float64         `json:"features"`
	ModelID  string            `json:"model_id"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// BatchPredictRequest represents batch ML prediction request
type BatchPredictRequest struct {
	ModelID     string              `json:"model_id"`
	FeatureSets [][]float64         `json:"feature_sets"`
	Metadata    map[string]string   `json:"metadata,omitempty"`
}

// MLPredict handles ML prediction via gRPC with resilience
func MLPredict(mlClient *ml.Client, logger zerolog.Logger) fiber.Handler {
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

		start := time.Now()
		resp, err := mlClient.Predict(c.Context(), req.ModelID, req.Features, req.Metadata)
		duration := time.Since(start)

		// Record metrics
		status := "success"
		if err != nil {
			status = "error"
			logger.Error().Err(err).
				Str("model_id", req.ModelID).
				Int("features_count", len(req.Features)).
				Dur("duration", duration).
				Msg("ML prediction failed")
		}
		metrics.RecordGrpcCall("python-ml", "Predict", status, duration)

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "ML prediction failed",
				"message":    err.Error(),
				"latency_ms": duration.Milliseconds(),
			})
		}

		logger.Debug().
			Str("model_id", req.ModelID).
			Float64("prediction", resp.Prediction).
			Float64("confidence", resp.Confidence).
			Int64("latency_ms", resp.LatencyMs).
			Msg("ML prediction successful")

		return c.JSON(fiber.Map{
			"prediction":  resp.Prediction,
			"confidence":  resp.Confidence,
			"model_id":    resp.ModelId,
			"latency_ms":  duration.Milliseconds(),
			"ml_latency_ms": resp.LatencyMs,
			"probabilities": resp.Probabilities,
			"note":        "gRPC call to Python ML service",
		})
	}
}

// MLBatchPredict handles batch ML predictions via gRPC
func MLBatchPredict(mlClient *ml.Client, logger zerolog.Logger) fiber.Handler {
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

		start := time.Now()
		resp, err := mlClient.BatchPredict(c.Context(), req.ModelID, req.FeatureSets, req.Metadata)
		duration := time.Since(start)

		// Record metrics
		status := "success"
		if err != nil {
			status = "error"
			logger.Error().Err(err).
				Str("model_id", req.ModelID).
				Int("batch_size", len(req.FeatureSets)).
				Dur("duration", duration).
				Msg("ML batch prediction failed")
		}
		metrics.RecordGrpcCall("python-ml", "BatchPredict", status, duration)

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "ML batch prediction failed",
				"message":    err.Error(),
				"latency_ms": duration.Milliseconds(),
			})
		}

		logger.Debug().
			Str("model_id", req.ModelID).
			Int32("success_count", resp.SuccessCount).
			Int32("error_count", resp.ErrorCount).
			Int64("total_latency_ms", resp.TotalLatencyMs).
			Msg("ML batch prediction completed")

		return c.JSON(fiber.Map{
			"predictions":       resp.Predictions,
			"success_count":     resp.SuccessCount,
			"error_count":       resp.ErrorCount,
			"total_latency_ms":  resp.TotalLatencyMs,
			"client_latency_ms": duration.Milliseconds(),
			"batch_size":        len(req.FeatureSets),
			"note":              "Batch gRPC call to Python ML service",
		})
	}
}

// MLModelInfo retrieves ML model metadata
func MLModelInfo(mlClient *ml.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		modelID := c.Params("model_id")
		if modelID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "model_id parameter is required",
			})
		}

		start := time.Now()
		resp, err := mlClient.GetModelInfo(c.Context(), modelID)
		duration := time.Since(start)

		status := "success"
		if err != nil {
			status = "error"
			logger.Error().Err(err).
				Str("model_id", modelID).
				Dur("duration", duration).
				Msg("Failed to get model info")
		}
		metrics.RecordGrpcCall("python-ml", "GetModelInfo", status, duration)

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "Failed to retrieve model info",
				"message":    err.Error(),
				"latency_ms": duration.Milliseconds(),
			})
		}

		return c.JSON(fiber.Map{
			"model_id":       resp.ModelId,
			"model_type":     resp.ModelType,
			"version":        resp.Version,
			"input_features": resp.InputFeatures,
			"output_classes": resp.OutputClasses,
			"loaded":         resp.Loaded,
			"metadata":       resp.Metadata,
			"latency_ms":     duration.Milliseconds(),
		})
	}
}

// MLHealthCheck checks ML service health
func MLHealthCheck(mlClient *ml.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		detailed := c.QueryBool("detailed", false)

		start := time.Now()
		resp, err := mlClient.HealthCheck(c.Context(), detailed)
		duration := time.Since(start)

		if err != nil {
			logger.Error().Err(err).Msg("ML health check failed")
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status":     "unhealthy",
				"error":      err.Error(),
				"latency_ms": duration.Milliseconds(),
			})
		}

		statusCode := fiber.StatusOK
		if resp.Status != "healthy" {
			statusCode = fiber.StatusServiceUnavailable
		}

		result := fiber.Map{
			"status":               resp.Status,
			"uptime_seconds":       resp.UptimeSeconds,
			"loaded_models_count":  resp.LoadedModelsCount,
			"connection_state":     mlClient.GetConnectionState().String(),
			"circuit_breaker":      mlClient.GetCircuitBreakerState(),
			"latency_ms":           duration.Milliseconds(),
		}

		if detailed {
			result["loaded_models"] = resp.LoadedModels
			result["system_metrics"] = resp.SystemMetrics
		}

		return c.Status(statusCode).JSON(result)
	}
}

// HybridTest tests full hybrid architecture (Go → Rust → Python)
func HybridTest(mlClient *ml.Client, logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		totalStart := time.Now()

		// Step 1: Rust FFI call
		rustStart := time.Now()
		sum := rust.Add(10, 20)
		rustDuration := time.Since(rustStart)
		metrics.RecordRustFFICall("add", "success", rustDuration)

		// Step 2: Python gRPC call
		pythonStart := time.Now()
		features := []float64{float64(sum), 5.0, 3.0}
		mlResp, err := mlClient.Predict(c.Context(), "iris-classifier", features, nil)
		pythonDuration := time.Since(pythonStart)

		status := "success"
		if err != nil {
			status = "error"
		}
		metrics.RecordGrpcCall("python-ml", "Predict", status, pythonDuration)

		totalDuration := time.Since(totalStart)

		if err != nil {
			logger.Error().Err(err).Msg("Hybrid test failed at Python gRPC step")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Hybrid test failed",
				"step":  "python_grpc",
				"message": err.Error(),
			})
		}

		logger.Debug().
			Int("rust_result", sum).
			Float64("ml_prediction", mlResp.Prediction).
			Int64("rust_us", rustDuration.Microseconds()).
			Int64("python_ms", pythonDuration.Milliseconds()).
			Int64("total_ms", totalDuration.Milliseconds()).
			Msg("Hybrid architecture test successful")

		return c.JSON(fiber.Map{
			"test":          "hybrid_architecture",
			"rust_result":   sum,
			"ml_prediction": mlResp.Prediction,
			"ml_confidence": mlResp.Confidence,
			"timing": fiber.Map{
				"rust_ffi_us":    rustDuration.Microseconds(),
				"python_grpc_ms": pythonDuration.Milliseconds(),
				"ml_internal_ms": mlResp.LatencyMs,
				"total_ms":       totalDuration.Milliseconds(),
			},
			"architecture": "Go → Rust (FFI) → Python (gRPC)",
			"performance": fiber.Map{
				"rust_overhead_pct": float64(rustDuration.Microseconds()) / float64(totalDuration.Microseconds()) * 100,
				"python_overhead_pct": float64(pythonDuration.Milliseconds()) / float64(totalDuration.Milliseconds()) * 100,
			},
		})
	}
}
