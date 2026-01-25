package middleware

import (
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/observability"
)

var (
	// Alphanumeric pattern for model_id validation
	alphanumericPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
)

// MLPredictRequest represents the ML prediction request structure
type MLPredictRequest struct {
	Features []float64 `json:"features"`
	ModelID  string    `json:"model_id"`
}

// ValidationConfig holds validation configuration
type ValidationConfig struct {
	MaxFeaturesLength int
	RequireTraceID    bool
}

// DefaultValidationConfig returns recommended defaults
var DefaultValidationConfig = ValidationConfig{
	MaxFeaturesLength: 10000,
	RequireTraceID:    true,
}

// InputValidationMiddleware validates ML prediction requests
func InputValidationMiddleware(config ValidationConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Only validate /ml/predict endpoints
		if !strings.HasPrefix(c.Path(), "/ml/predict") {
			return c.Next()
		}

		// Generate or extract trace ID for observability
		traceID := c.Get("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
			c.Set("X-Trace-ID", traceID)
		}

		// Parse request body
		var req MLPredictRequest
		if err := c.BodyParser(&req); err != nil {
			observability.RecordValidationError("body", "parse_error")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Invalid request body",
				"trace_id": traceID,
				"details":  "Request body must be valid JSON",
			})
		}

		// Validate model_id: must be alphanumeric only
		if req.ModelID == "" {
			observability.RecordValidationError("model_id", "missing")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Validation failed",
				"trace_id": traceID,
				"field":    "model_id",
				"details":  "model_id is required",
			})
		}

		if !alphanumericPattern.MatchString(req.ModelID) {
			observability.RecordValidationError("model_id", "invalid_format")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Validation failed",
				"trace_id": traceID,
				"field":    "model_id",
				"details":  "model_id must contain only alphanumeric characters, hyphens, or underscores",
			})
		}

		// Validate features: must be non-empty array
		if req.Features == nil || len(req.Features) == 0 {
			observability.RecordValidationError("features", "empty")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Validation failed",
				"trace_id": traceID,
				"field":    "features",
				"details":  "features array cannot be empty",
			})
		}

		// Validate features length: must not exceed limit
		if len(req.Features) > config.MaxFeaturesLength {
			observability.RecordValidationError("features", "too_long")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":    "Validation failed",
				"trace_id": traceID,
				"field":    "features",
				"details":  "features array exceeds maximum length of 10,000",
				"max_length": config.MaxFeaturesLength,
				"actual_length": len(req.Features),
			})
		}

		// Validate feature values: check for NaN or Inf
		for i, feature := range req.Features {
			if feature != feature { // NaN check
				observability.RecordValidationError("features", "invalid_value_nan")
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error":    "Validation failed",
					"trace_id": traceID,
					"field":    "features",
					"details":  "features array contains NaN value",
					"index":    i,
				})
			}
		}

		// Store validated request in context for downstream handlers
		c.Locals("validated_request", req)
		c.Locals("trace_id", traceID)

		return c.Next()
	}
}
