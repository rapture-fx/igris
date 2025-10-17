package middleware

import (
	"fmt"
	"runtime/debug"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
)

// RecoveryConfig holds recovery middleware configuration
type RecoveryConfig struct {
	Logger *zerolog.Logger
	EnableStackTrace bool
}

// RecoveryMiddleware creates a panic recovery middleware
func RecoveryMiddleware(config RecoveryConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				// Get stack trace
				stack := debug.Stack()

				// Log panic
				logEvent := config.Logger.Error().
					Str("request_id", GetRequestID(c)).
					Str("method", c.Method()).
					Str("path", c.Path()).
					Str("ip", c.IP()).
					Interface("panic", r)

				if config.EnableStackTrace {
					logEvent = logEvent.Str("stack_trace", string(stack))
				}

				logEvent.Msg("Panic recovered")

				// Return error response
				c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error":      "Internal server error",
					"message":    "An unexpected error occurred",
					"request_id": GetRequestID(c),
				})
			}
		}()

		return c.Next()
	}
}

// ErrorHandler is a custom Fiber error handler
func ErrorHandler(logger *zerolog.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		// Default to 500
		code := fiber.StatusInternalServerError

		// Retrieve from *fiber.Error
		if e, ok := err.(*fiber.Error); ok {
			code = e.Code
		}

		// Log error
		logger.Error().
			Err(err).
			Str("request_id", GetRequestID(c)).
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", code).
			Msg("Request error")

		// Send error response
		return c.Status(code).JSON(fiber.Map{
			"error":      fmt.Sprintf("%v", err),
			"status":     code,
			"request_id": GetRequestID(c),
		})
	}
}
