package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/gateway/internal/rust"
	"github.com/schlep-engine/gateway/pkg/metrics"
)

// RustAdd handles Rust FFI addition
func RustAdd() fiber.Handler {
	return func(c *fiber.Ctx) error {
		x := c.QueryInt("x", 0)
		y := c.QueryInt("y", 0)

		start := time.Now()
		result := rust.Add(x, y)
		duration := time.Since(start)

		// Record metrics
		metrics.RecordRustFFICall("add", "success", duration)

		return c.JSON(fiber.Map{
			"operation":  "rust_add",
			"x":          x,
			"y":          y,
			"result":     result,
			"latency_us": duration.Microseconds(),
			"note":       "FFI call via cgo",
		})
	}
}

// RustHello handles Rust FFI string operations
func RustHello() fiber.Handler {
	return func(c *fiber.Ctx) error {
		name := c.Query("name", "World")

		start := time.Now()
		message := rust.HelloFrom(name)
		duration := time.Since(start)

		// Record metrics
		metrics.RecordRustFFICall("hello", "success", duration)

		return c.JSON(fiber.Map{
			"operation":  "rust_hello",
			"message":    message,
			"latency_us": duration.Microseconds(),
		})
	}
}
