package main

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/Igris-inertial/system/igris-overture/ml"
	"github.com/Igris-inertial/system/igris-overture/rust"
)

func main() {
	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Igris Overture",
		ServerHeader: "Igris-Overture",
		ErrorHandler: customErrorHandler,
	})

	// Middleware
	app.Use(logger.New(logger.Config{
		Format:     "${time} | ${status} | ${latency} | ${method} ${path}\n",
		TimeFormat: "15:04:05",
	}))
	app.Use(recover.New())

	// Initialize ML gRPC client
	mlClient, err := ml.NewClient("python-ml:50051")
	if err != nil {
		log.Printf("WARNING: ML service connection failed: %v (will retry on request)", err)
		// Don't fail startup - service might not be ready yet
		mlClient = nil
	}

	// Routes
	setupRoutes(app, mlClient)

	// Start server
	port := "8080"
	log.Printf("🚀 Go Gateway starting on port %s", port)
	log.Printf("📊 Health check: http://localhost:%s/health", port)
	log.Printf("🦀 Rust FFI test: http://localhost:%s/rust/add?x=5&y=3", port)
	log.Printf("🐍 Python ML test: http://localhost:%s/ml/predict", port)

	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}

func setupRoutes(app *fiber.App, mlClient *ml.Client) {
	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"service":   "igris-overture",
			"timestamp": time.Now().Unix(),
			"version":   "0.1.0-prototype",
		})
	})

	// Rust FFI test endpoint
	app.Get("/rust/add", func(c *fiber.Ctx) error {
		x := c.QueryInt("x", 0)
		y := c.QueryInt("y", 0)

		startTime := time.Now()
		result := rust.Add(x, y)
		duration := time.Since(startTime)

		return c.JSON(fiber.Map{
			"operation": "rust_add",
			"x":         x,
			"y":         y,
			"result":    result,
			"latency_us": duration.Microseconds(),
			"note":      "FFI call via cgo",
		})
	})

	// Rust string operations test
	app.Get("/rust/hello", func(c *fiber.Ctx) error {
		name := c.Query("name", "World")

		startTime := time.Now()
		message := rust.HelloFrom(name)
		duration := time.Since(startTime)

		return c.JSON(fiber.Map{
			"operation":  "rust_hello",
			"message":    message,
			"latency_us": duration.Microseconds(),
		})
	})

	// Python ML gRPC test endpoint
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		if mlClient == nil {
			// Try to reconnect
			var err error
			mlClient, err = ml.NewClient("python-ml:50051")
			if err != nil {
				return c.Status(503).JSON(fiber.Map{
					"error":   "ML service unavailable",
					"message": err.Error(),
				})
			}
		}

		type PredictRequest struct {
			Features []float64 `json:"features"`
			ModelID  string    `json:"model_id"`
		}

		var req PredictRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		startTime := time.Now()
		resp, err := mlClient.Predict(c.Context(), req.Features, req.ModelID)
		duration := time.Since(startTime)

		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error":      "ML prediction failed",
				"message":    err.Error(),
				"latency_ms": duration.Milliseconds(),
			})
		}

		return c.JSON(fiber.Map{
			"prediction":  resp.Prediction,
			"confidence":  resp.Confidence,
			"model_id":    resp.ModelId,
			"latency_ms":  duration.Milliseconds(),
			"note":        "gRPC call to Python service",
		})
	})

	// Combined test: Go -> Rust -> Python
	app.Get("/test/hybrid", func(c *fiber.Ctx) error {
		if mlClient == nil {
			return c.Status(503).JSON(fiber.Map{
				"error": "ML service unavailable",
			})
		}

		totalStart := time.Now()

		// Step 1: Rust FFI call
		rustStart := time.Now()
		sum := rust.Add(10, 20)
		rustDuration := time.Since(rustStart)

		// Step 2: Python gRPC call
		pythonStart := time.Now()
		features := []float64{float64(sum), 5.0, 3.0}
		mlResp, err := mlClient.Predict(c.Context(), features, "test-model")
		pythonDuration := time.Since(pythonStart)

		totalDuration := time.Since(totalStart)

		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": "Hybrid test failed",
				"step":  "python_grpc",
			})
		}

		return c.JSON(fiber.Map{
			"test":           "hybrid_architecture",
			"rust_result":    sum,
			"ml_prediction":  mlResp.Prediction,
			"ml_confidence":  mlResp.Confidence,
			"timing": fiber.Map{
				"rust_ffi_us":     rustDuration.Microseconds(),
				"python_grpc_ms":  pythonDuration.Milliseconds(),
				"total_ms":        totalDuration.Milliseconds(),
			},
			"architecture": "Go -> Rust (FFI) -> Python (gRPC)",
		})
	})

	// Benchmark endpoint
	app.Get("/benchmark", func(c *fiber.Ctx) error {
		iterations := c.QueryInt("iterations", 1000)

		// Benchmark Rust FFI
		rustStart := time.Now()
		for i := 0; i < iterations; i++ {
			rust.Add(i, i+1)
		}
		rustTotal := time.Since(rustStart)

		return c.JSON(fiber.Map{
			"iterations":           iterations,
			"rust_ffi_total_ms":    rustTotal.Milliseconds(),
			"rust_ffi_avg_us":      rustTotal.Microseconds() / int64(iterations),
			"rust_ffi_ops_per_sec": float64(iterations) / rustTotal.Seconds(),
		})
	})
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(fiber.Map{
		"error":     err.Error(),
		"timestamp": time.Now().Unix(),
	})
}
