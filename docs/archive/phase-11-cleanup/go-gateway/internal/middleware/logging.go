package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// LoggingConfig holds logging middleware configuration
type LoggingConfig struct {
	Logger        *zerolog.Logger
	SkipPaths     []string
	LogRequestBody bool
	LogResponseBody bool
}

// LoggingMiddleware creates a structured logging middleware
func LoggingMiddleware(config LoggingConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip logging for certain paths
		path := c.Path()
		for _, skipPath := range config.SkipPaths {
			if path == skipPath {
				return c.Next()
			}
		}

		// Generate request ID if not present
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
			c.Set("X-Request-ID", requestID)
		}

		// Start timer
		start := time.Now()

		// Create logger with request context
		logger := config.Logger.With().
			Str("request_id", requestID).
			Str("method", c.Method()).
			Str("path", path).
			Str("ip", c.IP()).
			Str("user_agent", c.Get("User-Agent")).
			Logger()

		// Log request body if enabled
		if config.LogRequestBody && len(c.Body()) > 0 {
			logger = logger.With().Str("request_body", string(c.Body())).Logger()
		}

		// Store logger in context
		c.Locals("logger", &logger)
		c.Locals("request_id", requestID)

		// Execute request
		err := c.Next()

		// Calculate duration
		duration := time.Since(start)
		status := c.Response().StatusCode()

		// Build log event
		logEvent := logger.Info()
		if status >= 500 {
			logEvent = logger.Error()
		} else if status >= 400 {
			logEvent = logger.Warn()
		}

		// Add common fields
		logEvent = logEvent.
			Int("status", status).
			Dur("duration_ms", duration).
			Int64("bytes_sent", int64(len(c.Response().Body())))

		// Add error if present
		if err != nil {
			logEvent = logEvent.Err(err)
		}

		// Add user context if available
		if userID := GetUserID(c); userID != "" {
			logEvent = logEvent.Str("user_id", userID)
		}

		// Log response body if enabled and status is error
		if config.LogResponseBody && status >= 400 && len(c.Response().Body()) > 0 {
			logEvent = logEvent.Str("response_body", string(c.Response().Body()))
		}

		// Send log
		logEvent.Msg("HTTP request completed")

		return err
	}
}

// GetLogger retrieves logger from context
func GetLogger(c *fiber.Ctx) *zerolog.Logger {
	if logger, ok := c.Locals("logger").(*zerolog.Logger); ok {
		return logger
	}
	return nil
}

// GetRequestID retrieves request ID from context
func GetRequestID(c *fiber.Ctx) string {
	if requestID, ok := c.Locals("request_id").(string); ok {
		return requestID
	}
	return ""
}
