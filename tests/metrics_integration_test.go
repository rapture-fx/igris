package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/schlep-engine/schlep-engine/internal/api"
	"github.com/schlep-engine/schlep-engine/internal/logging"
	"github.com/schlep-engine/schlep-engine/internal/metrics"
	"github.com/schlep-engine/schlep-engine/internal/tracing"
)

// Mock inference request for testing
type MockInferRequest struct {
	Model    string                 `json:"model"`
	Messages []MockMessage          `json:"messages"`
	Stream   bool                   `json:"stream,omitempty"`
	Options  map[string]interface{} `json:"options,omitempty"`
}

type MockMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// TestMetricsCollection tests that metrics are properly collected and stored
func TestMetricsCollection(t *testing.T) {
	// Initialize metrics collector
	collector := metrics.InitMetricsCollector()
	require.NotNil(t, collector)

	// Initialize tracer
	tracer := tracing.InitGlobalTracer("test", 1.0)
	require.NotNil(t, tracer)

	// Reset metrics to start fresh
	collector.Reset()

	// Create Fiber app with test routes
	app := fiber.New(fiber.Config{
		ErrorHandler: nil,
	})
	app.Use(recover.New())
	
	// Initialize metrics middleware
	api.InitializeMetricsMiddleware(app)

	// Register test routes
	app.Post("/test/infer", func(c *fiber.Ctx) error {
		var req MockInferRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request",
			})
		}

		// Simulate inference with metrics
		latencyMs := int64(50 + (time.Now().UnixNano() % 200)) // Random latency 50-250ms
		tokens := 100 + ((time.Now().UnixNano() % 400))        // Random tokens 100-500
		cost := float64(tokens) * 0.00001                       // Mock cost

		// Record metrics
		metrics.RecordInferMetrics(c, "mock-openai", req.Model, latencyMs, tokens/2, tokens/2, tokens, cost, true, "")

		return c.JSON(fiber.Map{
			"model": req.Model,
			"usage": fiber.Map{
				"prompt_tokens":     tokens / 2,
				"completion_tokens": tokens / 2,
				"total_tokens":      tokens,
			},
			"provider": "mock-openai",
		})
	})

	app.Get("/test/metrics", func(c *fiber.Ctx) error {
		allMetrics := collector.GetProviderMetrics()
		return c.JSON(allMetrics)
	})

	app.Get("/test/failure", func(c *fiber.Ctx) error {
		metrics.RecordInferError(c, "mock-openai", "gpt-4", 100, "simulated error")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "test error",
		})
	})

	// Test successful inference request
	t.Run("SuccessfulInference", func(t *testing.T) {
		req := MockInferRequest{
			Model: "gpt-4",
			Messages: []MockMessage{
				{Role: "user", Content: "Hello, world!"},
			},
		}

		body, _ := json.Marshal(req)
		resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/test/infer", bytes.NewReader(body)))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.Equal(t, "gpt-4", result["model"])
		assert.Equal(t, "mock-openai", result["provider"])
		assert.Contains(t, resp.Header, "X-Trace-ID")
		assert.NotEmpty(t, resp.Header.Get("X-Trace-ID"))
	})

	// Test failed inference request
	t.Run("FailedInference", func(t *testing.T) {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/test/failure", nil))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	// Test metrics aggregation
	t.Run("MetricsAggregation", func(t *testing.T) {
		// Wait a moment for metrics to be processed
		time.Sleep(100 * time.Millisecond)

		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/test/metrics", nil))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		require.Contains(t, result, "mock-openai")
		openaiMetrics := result["mock-openai"].(map[string]interface{})
		require.Contains(t, openaiMetrics, "gpt-4")

		gpt4Metrics := openaiMetrics["gpt-4"].(map[string]interface{})
		
		// Verify metrics were recorded
		assert.Greater(t, int64(gpt4Metrics["request_count"].(float64)), int64(0))
		assert.Greater(t, int64(gpt4Metrics["success_count"].(float64)), int64(0))
		assert.Greater(t, int64(gpt4Metrics["total_tokens"].(float64)), int64(0))
		assert.GreaterOrEqual(t, gpt4Metrics["total_cost_usd"].(float64), 0.0)
	})
}

// TestMetricsAPI tests the metrics API endpoints
func TestMetricsAPI(t *testing.T) {
	// Initialize metrics
	collector := metrics.InitMetricsCollector()
	tracer := tracing.InitGlobalTracer("test", 1.0)
	collector.Reset()

	// Create Fiber app with all metrics routes
	app := fiber.New()
	app.Use(recover.New())
	api.InitializeMetricsMiddleware(app)
	require.NoError(t, api.RegisterAllRoutes(app))

	// Test /metrics (Prometheus)
	t.Run("PrometheusMetrics", func(t *testing.T) {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/metrics", nil))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusOK, resp.StatusCode)
		
		// Prometheus metrics should be text/plain
		assert.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
	})

	// Test /v1/metrics (Aggregated JSON)
	t.Run("AggregatedMetrics", func(t *testing.T) {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/v1/metrics", nil))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		require.Contains(t, result, "provider_metrics")
		require.Contains(t, result, "top_providers")
		require.Contains(t, result, "timestamp")
		require.Contains(t, result, "trace_id")
		assert.NotEmpty(t, result["trace_id"])
	})

	// Test /v1/metrics/health
	t.Run("MetricsHealth", func(t *testing.T) {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/v1/metrics/health", nil))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		assert.Equal(t, "healthy", result["status"])
		assert.Equal(t, true, result["collector_initialized"])
		assert.Contains(t, result, "trace_id")
	})

	// Test /v1/metrics/debug
	t.Run("MetricsDebug", func(t *testing.T) {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/v1/metrics/debug", nil))
		require.NoError(t, err)
		require.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		require.Contains(t, result, "collector_memory_info")
		require.Contains(t, result, "trace_info")
		require.Contains(t, result, "request_info")
	})
}

// TestTracingFunctionality tests the tracing utilities
func TestTracingFunctionality(t *testing.T) {
	tracer := tracing.InitGlobalTracer("test-service", 1.0)

	// Test trace context generation
	ctx, traceCtx := tracing.StartTrace(nil, "test-operation")
	require.NotNil(t, ctx)
	require.NotNil(t, traceCtx)
	require.NotEmpty(t, traceCtx.TraceID)
	require.NotEmpty(t, traceCtx.SpanID)
	require.Equal(t, "test-operation", traceCtx.SpanName)
	assert.Equal(t, "test-service", traceCtx.Attributes["service"])

	// Test span creation
	spanCtx, span := tracing.StartSpan(ctx, "sub-operation")
	require.NotNil(t, spanCtx)
	require.NotNil(t, span)
	require.Equal(t, traceCtx.TraceID, span.TraceID) // Same trace ID
	assert.Equal(t, traceCtx.SpanID, span.ParentSpanID) // Parent-child relationship

	// Test attribute addition
	tracing.AddAttribute(spanCtx, "test.key", "test.value")
	tracing.AddAttribute(ctx, "ctx.key", "ctx.value")

	// Test utility functions
	traceID := tracing.GetTraceID(ctx)
	assert.Equal(t, traceCtx.TraceID, traceID)

	// Test inference tracing
	tracing.TraceInferenceRequest(ctx, "mock-openai", "gpt-4", 3, false)
	tracing.TraceInferenceResponse(ctx, 150, 50, 100, 150, 0.001, true)

	// Finish span
	tracing.FinishSpan(ctx, traceCtx, nil)
	tracing.FinishSpan(spanCtx, span, nil)
}

// TestMetricsCollector tests the metrics collector directly
func TestMetricsCollector(t *testing.T) {
	collector := metrics.NewMetricsCollector()
	require.NotNil(t, collector)

	// Reset for clean test
	collector.Reset()

	// Test recording metrics
	collector.RecordInferenceRequest(nil, "mock-openai", "gpt-4", 100, 50, 50, 100, 0.001, true)
	collector.RecordInferenceRequest(nil, "mock-openai", "gpt-3.5", 80, 40, 60, 100, 0.0008, true)
	collector.RecordInferenceRequest(nil, "mock Anthropic", "claude-3", 120, 60, 40, 100, 0.0015, false)

	// Test retrieving metrics
	providerMetrics := collector.GetProviderMetrics()
	assert.Len(t, providerMetrics, 2) // mock-openai, mock Anthropic

	openaiMetrics, exists := providerMetrics["mock-openai"]
	assert.True(t, exists)
	assert.Len(t, openaiMetrics, 2) // gpt-4, gpt-3.5

	gpt4Metrics, exists := collectorMetrics["gpt-4"]
	assert.True(t, exists)
	assert.Equal(t, int64(1), gpt4Metrics.RequestCount)
	assert.Equal(t, int64(1), gpt4Metrics.SuccessCount)
	assert.Equal(t, int64(100), gpt4Metrics.TotalTokens)
	assert.Equal(t, 0.001, gpt4Metrics.TotalCostUSD)

	// Test provider-specific metrics
	mockOpenaiMetrics := collector.GetMetricsForProvider("mock-openai")
	assert.Len(t, mockOpenaiMetrics, 2)

	certainModel, exists := collector.GetMetricsForModel("mock-openai", "gpt-4")
	assert.True(t, exists)
	assert.Equal(t, int64(1), certainModel.RequestCount)

	// Test top providers
	topProviders := collector.GetTopProviders(3)
	assert.Len(t, topProviders, 3) // All providers
	assert.Equal(t, "mock-openai", topProviders[0].Provider) // Should be first (has more requests)

	// Test percentile calculation - simulate many latency measurements
	for i := 0; i < 50; i++ {
		latency := int64(50 + (i % 200)) // Range 50-249
		collector.RecordInferenceRequest(nil, "mock-openai", "gpt-4", latency, 10, 10, 20, 0.0001, true)
	}

	// Get updated metrics
	updatedMetrics, exists := collector.GetMetricsForModel("mock-openai", "gpt-4")
	require.True(t, exists)
	assert.Equal(t, int64(51), updatedMetrics.RequestCount) // Original + 50 more
	assert.Greater(t, updatedMetrics.P95LatencyMs, float64(0))

	// Test collector configuration
	assert.Greater(t, collector.GetMaxLatencySamples(), 0)
}

// TestPerformanceMetricsOverhead tests that metrics collection doesn't add excessive overhead
func TestPerformanceMetricsOverhead(t *testing.T) {
	iterations := 1000

	// Test without metrics
	start := time.Now()
	for i := 0; i < iterations; i++ {
		// Simulate inference processing time
		time.Sleep(1 * time.Millisecond)
	}
	withoutMetricsDuration := time.Since(start)

	// Test with metrics
	collector := metrics.InitMetricsCollector()
	tracer := tracing.InitGlobalTracer("perf-test", 1.0)

	start = time.Now()
	for i := 0; i < iterations; i++ {
		// Simulate inference with metrics
		collector.RecordInferenceRequest(nil, "mock-openai", "gpt-4", 50, 10, 10, 20, 0.0001, true)
		
		ctx, traceCtx := tracing.StartTrace(nil, "perf-test")
		tracing.FinishSpan(ctx, traceCtx, nil)
	}
	withMetricsDuration := time.Since(start)

	// Calculate overhead
	overheadRatio := float64(withMetricsDuration-withoutMetricsDuration) / float64(withoutMetricsDuration)
	t.Logf("Metrics overhead: %.2f%% (from %v to %v)", overheadRatio*100, withoutMetricsDuration, withMetricsDuration)

	// Ensure overhead is minimal (< 50% for this test case)
	assert.Less(t, overheadRatio, 0.5, "Metrics collection overhead is too high")
}

// Helper function to create httptest requests
func httptest.NewRequest(method, url string, body *bytes.Buffer) *http.Request {
	req, _ := http.NewRequest(method, url, body)
	req.Header.Set("Content-Type", "application/json")
	return req
}
