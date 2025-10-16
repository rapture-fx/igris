package handlers

import (
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/config"
	"github.com/schlep-engine/schlep-engine/internal/inference/optimizer"
	"github.com/schlep-engine/schlep-engine/internal/inference/optimizer/shadow"
	"github.com/schlep-engine/schlep-engine/internal/inference/router"
	"github.com/schlep-engine/schlep-engine/internal/metrics"
	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
	"github.com/schlep-engine/schlep-engine/internal/providers/anthropic"
	"github.com/schlep-engine/schlep-engine/internal/providers/openai"
	"github.com/schlep-engine/schlep-engine/internal/tracing"
)

// InferHandler handles /v1/infer requests
type InferHandler struct {
	router            *router.InferenceRouter
	shadowRunner      *shadow.ShadowRunner
	sloBreaker        *optimizer.SLOBreaker
	runtimeConfig     *config.RuntimeOptimizerConfig
	activationMetrics *optimizer.ActivationMetricsRecorder
	rand              *rand.Rand
}

// NewInferHandler creates a new infer handler
func NewInferHandler() (*InferHandler, error) {
	// Initialize metrics collector
	metrics.InitMetricsCollector()
	
	// Initialize tracing
	tracing.InitGlobalTracer("schlep-engine", 1.0) // 100% sampling for MVP
	
	// Initialize provider registry
	registry := providers.NewProviderRegistry()

	// Check PROVIDER_MODE environment variable
	// Options: "mock" (default), "real", "hybrid", "benchmark"
	providerMode := os.Getenv("PROVIDER_MODE")
	if providerMode == "" {
		providerMode = "mock" // Default to mock mode for development
	}

	log.Printf("[Handler] Provider mode: %s", providerMode)

	// Register providers based on mode
	if providerMode == "mock" || providerMode == "hybrid" {
		// Register Mock OpenAI provider
		mockConfig := &providers.ProviderConfig{
			BaseURL:       "https://mock.schlep-engine.local",
			Timeout:       30,
			MaxRetries:    3,
			EnableMetrics: true,
		}
		mockProvider, err := openai.NewMockOpenAIProvider(mockConfig)
		if err != nil {
			log.Printf("WARNING: Failed to initialize Mock OpenAI provider: %v", err)
		} else {
			registry.Register(mockProvider)
			log.Println("[Handler] ✓ Registered Mock OpenAI provider")
		}
	}

	if providerMode == "benchmark" || providerMode == "hybrid" {
		// Register Benchmark OpenAI provider (Phase 11)
		// Simulates OpenAI with realistic pricing and latency, no API calls
		benchmarkOpenAIConfig := &providers.ProviderConfig{
			BaseURL:       "https://api.openai.com/v1",
			Timeout:       60,
			MaxRetries:    3,
			RetryDelay:    1000,
			EnableMetrics: true,
		}
		benchmarkOpenAI, err := openai.NewBenchmarkOpenAIProvider(benchmarkOpenAIConfig)
		if err != nil {
			log.Printf("WARNING: Failed to initialize Benchmark OpenAI provider: %v", err)
		} else {
			registry.Register(benchmarkOpenAI)
			log.Println("[Handler] ✓ Registered Benchmark OpenAI provider (Phase 11)")
		}

		// Register Benchmark Anthropic provider (Phase 11)
		// Simulates Claude with realistic pricing and latency, no API calls
		benchmarkAnthropicConfig := &providers.ProviderConfig{
			BaseURL:       "https://api.anthropic.com/v1",
			Timeout:       60,
			MaxRetries:    3,
			RetryDelay:    1000,
			EnableMetrics: true,
		}
		benchmarkAnthropic, err := anthropic.NewBenchmarkAnthropicProvider(benchmarkAnthropicConfig)
		if err != nil {
			log.Printf("WARNING: Failed to initialize Benchmark Anthropic provider: %v", err)
		} else {
			registry.Register(benchmarkAnthropic)
			log.Println("[Handler] ✓ Registered Benchmark Anthropic provider (Phase 11)")
		}
	}

	if providerMode == "real" || providerMode == "hybrid" {
		// TODO: Load API keys from environment or config
		// For MVP, using placeholder configs

		// Register OpenAI provider
		openaiConfig := &providers.ProviderConfig{
			APIKey:     os.Getenv("OPENAI_API_KEY"), // Load from env
			BaseURL:    "https://api.openai.com/v1",
			Timeout:    30,
			MaxRetries: 3,
		}
		if openaiConfig.APIKey == "" {
			openaiConfig.APIKey = "sk-placeholder" // Fallback placeholder
		}
		openaiProvider, err := openai.NewOpenAIProvider(openaiConfig)
		if err != nil {
			log.Printf("WARNING: Failed to initialize OpenAI provider: %v", err)
		} else {
			registry.Register(openaiProvider)
			log.Println("[Handler] ✓ Registered OpenAI provider")
		}

		// Register Anthropic provider
		anthropicConfig := &providers.ProviderConfig{
			APIKey:     os.Getenv("ANTHROPIC_API_KEY"), // Load from env
			BaseURL:    "https://api.anthropic.com/v1",
			Timeout:    30,
			MaxRetries: 3,
		}
		if anthropicConfig.APIKey == "" {
			anthropicConfig.APIKey = "sk-ant-placeholder" // Fallback placeholder
		}
		anthropicProvider, err := anthropic.NewAnthropicProvider(anthropicConfig)
		if err != nil {
			log.Printf("WARNING: Failed to initialize Anthropic provider: %v", err)
		} else {
			registry.Register(anthropicProvider)
			log.Println("[Handler] ✓ Registered Anthropic provider")
		}

		// TODO: Register Python adapter provider
	}

	// Verify at least one provider is registered
	if len(registry.List()) == 0 {
		log.Fatal("[Handler] ERROR: No providers registered. Cannot start server.")
	}

	log.Printf("[Handler] Registered providers: %v", registry.List())

	// Create inference router
	inferenceRouter := router.NewInferenceRouter(registry)

	// Initialize optimizer components
	optConfig := config.LoadOptimizerConfig()
	config.InitRuntimeConfig(optConfig)
	runtimeConfig := config.GetRuntimeConfig()

	log.Printf("[Handler] Optimizer mode: %s, sample_rate: %.4f",
		runtimeConfig.GetMode(), runtimeConfig.GetSampleRate())

	// Initialize shadow runner
	shadowConfig := config.CreateShadowConfig(optConfig)
	shadowRunner, err := shadow.NewShadowRunner(shadowConfig)
	if err != nil {
		log.Printf("WARNING: Failed to initialize shadow runner: %v", err)
		shadowRunner = nil
	} else {
		log.Println("[Handler] ✓ Shadow runner initialized")
	}

	// Initialize SLO breaker
	sloBreaker := optimizer.NewSLOBreaker(
		optimizer.DefaultSLOThresholds(),
		shadowRunner,
	)
	log.Println("[Handler] ✓ SLO breaker initialized")

	// Initialize activation metrics recorder
	activationMetrics := optimizer.NewActivationMetricsRecorder()
	activationMetrics.UpdateCurrentMode(string(runtimeConfig.GetMode()))
	activationMetrics.UpdateSampleRate(runtimeConfig.GetSampleRate())

	return &InferHandler{
		router:            inferenceRouter,
		shadowRunner:      shadowRunner,
		sloBreaker:        sloBreaker,
		runtimeConfig:     runtimeConfig,
		activationMetrics: activationMetrics,
		rand:              rand.New(rand.NewSource(time.Now().UnixNano())),
	}, nil
}

// HandleInfer handles POST /v1/infer
func (h *InferHandler) HandleInfer(c *fiber.Ctx) error {
	startTime := time.Now()

	// Start trace for inference request
	ctx, traceCtx := tracing.StartSpan(c.Context(), "inference_execute")
	defer tracing.FinishSpan(ctx, traceCtx, nil)

	// Use the enhanced context
	c.SetUserContext(ctx)

	// Parse request body
	var req models.InferRequest
	if err := c.BodyParser(&req); err != nil {
		log.Printf("[Infer] Failed to parse request: %v", err)
		
		// Record parsing error metrics
		latencyMs := time.Since(startTime).Milliseconds()
		metrics.RecordInferError(c, "error", "parsing_failed", latencyMs, err.Error())
		
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
			},
		})
	}

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("[Infer] Request validation failed: %v", err)
		
		// Record validation error metrics
		latencyMs := time.Since(startTime).Milliseconds()
		metrics.RecordInferError(c, "error", "validation_failed", latencyMs, err.Error())
		
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": err.Error(),
				"type":    "invalid_request_error",
			},
		})
	}

	// Add request attributes to trace
	tracing.TraceInferenceRequest(ctx, "unknown", req.Model, len(req.Messages), req.Stream)

	log.Printf("[Infer] Request: model=%s, messages=%d, stream=%v",
		req.Model, len(req.Messages), req.Stream)

	// Handle streaming requests
	if req.Stream {
		return h.handleStreamingInfer(c, &req)
	}

	// Determine routing decision source based on optimizer mode
	currentMode := h.runtimeConfig.GetMode()
	currentSampleRate := h.runtimeConfig.GetSampleRate()
	useRustOptimizer := false
	decisionSource := "go_router"

	// Phase 10: Phased rollout logic
	if currentMode == shadow.ShadowModeRust && h.shadowRunner != nil {
		// In Rust mode: sample requests based on sample rate
		if h.rand.Float64() < currentSampleRate {
			useRustOptimizer = true
			decisionSource = "rust_optimizer"
		} else {
			// Not sampled, fallback to Go
			h.activationMetrics.RecordGoFallback("sample_skip")
		}
	}

	log.Printf("[Infer] Mode=%s, SampleRate=%.4f, UseRust=%v",
		currentMode, currentSampleRate, useRustOptimizer)

	// Route and execute inference
	var resp *models.InferResponse
	var err error

	if useRustOptimizer {
		// Try Rust optimizer with automatic Go fallback on error
		resp, err = h.routeWithRustOptimizer(c, &req)
		if err != nil {
			// Rust failed, fallback to Go
			log.Printf("[Infer] Rust optimizer failed, falling back to Go: %v", err)
			h.activationMetrics.RecordGoFallback("error")
			h.activationMetrics.RecordRustFailure("routing_error")
			decisionSource = "go_router"
			resp, err = h.router.Route(c.Context(), &req)
		} else {
			h.activationMetrics.RecordRustDecision()
		}
	} else {
		// Use Go router
		resp, err = h.router.Route(c.Context(), &req)
	}

	// Record request with decision source
	h.activationMetrics.RecordRequest(string(currentMode), decisionSource)

	// Calculate latency
	latencyMs := time.Since(startTime).Milliseconds()

	if err != nil {
		log.Printf("[Infer] Inference failed: %v", err)

		// Record failed request metrics with comprehensive tracking
		provider, _ := req.GetProvider()
		if provider == "" {
			provider = "unknown"
		}
		
		tracer := tracing.GetGlobalTracer()
		tracer.AddError(ctx, err)
		tracer.TraceInferenceResponse(ctx, latencyMs, 0, 0, 0, 0, false)
		
		metrics.RecordInferMetrics(c, provider, req.Model, latencyMs, 0, 0, 0, 0, false, err.Error())

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": err.Error(),
				"type":    "api_error",
			},
		})
	}

	// Extract metrics from response
	provider := resp.Metadata.Provider
	model := resp.Model
	promptTokens := resp.Usage.PromptTokens
	completionTokens := resp.Usage.CompletionTokens
	totalTokens := resp.Usage.TotalTokens

	// Calculate cost (simplified - should come from provider pricing)
	costUSD := calculateCost(provider, model, promptTokens, completionTokens)

	// Add response attributes to trace
	tracing.TraceInferenceResponse(ctx, latencyMs, promptTokens, completionTokens, totalTokens, costUSD, true)

	// Store provider and model in context for middleware
	c.Locals("provider", provider)
	c.Locals("model", model)

	// Record successful request metrics with comprehensive tracking
	metrics.RecordInferMetrics(c, provider, model, latencyMs, promptTokens, completionTokens, totalTokens, costUSD, true, "")

	// Record activation metrics
	h.activationMetrics.RecordLatency(decisionSource, float64(latencyMs))
	h.activationMetrics.RecordCost(decisionSource, costUSD)

	// Record SLO metrics
	if decisionSource == "rust_optimizer" {
		h.sloBreaker.RecordRustMetrics(float64(latencyMs), costUSD, false)
	} else {
		h.sloBreaker.RecordGoMetrics(float64(latencyMs), costUSD, false)
	}

	// Periodically check SLO guardrails
	h.sloBreaker.CheckAndEnforce()

	// Log performance metrics
	log.Printf("[Infer] Success: provider=%s, model=%s, latency=%dms, tokens=%d, cost=$%.6f, source=%s",
		provider, model, latencyMs, totalTokens, costUSD, decisionSource)

	// Return response with trace ID header
	c.Set("Content-Type", "application/json")
	traceID := tracing.GetTraceID(ctx)
	c.Set("X-Trace-ID", traceID)
	return c.JSON(resp)
}

// routeWithRustOptimizer routes inference using the Rust optimizer
func (h *InferHandler) routeWithRustOptimizer(c *fiber.Ctx, req *models.InferRequest) (*models.InferResponse, error) {
	// Get Rust optimizer decision
	if h.shadowRunner == nil {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "Shadow runner not initialized")
	}

	// For Phase 10, we use the Rust optimizer to select the provider/model
	// but still execute through the Go router with that selection
	// TODO: In a future phase, fully integrate Rust optimizer decision execution

	// For now, fallback to Go router with Rust decision guidance
	// This is a simplified implementation for MVP
	log.Printf("[Infer] Rust optimizer mode active, executing via Go router")

	return h.router.Route(c.Context(), req)
}

// GetShadowRunner returns the shadow runner instance (for Admin API access)
func (h *InferHandler) GetShadowRunner() *shadow.ShadowRunner {
	return h.shadowRunner
}

// handleStreamingInfer handles streaming inference requests
func (h *InferHandler) handleStreamingInfer(c *fiber.Ctx, req *models.InferRequest) error {
	startTime := time.Now()
	ctx := c.Context()

	// Start trace for streaming inference
	userCtx := c.UserContext()
	traceContext, traceCtx := tracing.StartSpan(userCtx, "inference_stream_execute")
	defer tracing.FinishSpan(traceContext, traceCtx, nil)

	// Add streaming attributes to trace
	tracing.TraceInferenceRequest(traceContext, "unknown", req.Model, len(req.Messages), true)

	log.Printf("[Infer] Starting streaming inference for model: %s", req.Model)

	// Set headers for Server-Sent Events
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Trace-ID", traceCtx.TraceID)

	// Get streaming channels
	chunkChan, errChan := h.router.RouteStream(traceContext, req)

	// Initialize streaming metrics
	var totalTokens int
	var totalCost float64
	var chunkCount int

	// For now, return streaming as a single response (simplified for MVP)
	// TODO: Implement proper Server-Sent Events streaming in a later phase
	allChunks := []*models.StreamChunk{}
	
	for chunk := range chunkChan {
		allChunks = append(allChunks, chunk)
	}
	
	// Check for any errors
	if err, ok := <-errChan; ok && err != nil {
		// Record streaming error metrics
		latencyMs := time.Since(startTime).Milliseconds()
		provider, _ := req.GetProvider()
		if provider == "" {
			provider = "unknown"
		}

		tracer := tracing.GetGlobalTracer()
		tracer.AddError(traceContext, err)
		tracer.TraceInferenceResponse(traceContext, latencyMs, 0, 0, totalTokens, totalCost, false)
		
		metrics.RecordInferMetrics(c, provider, req.Model, latencyMs, 0, 0, totalTokens, totalCost, false, err.Error())
		
		log.Printf("[Infer] Streaming error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	// Create combined response from all chunks
	combinedContent := ""
	for _, chunk := range allChunks {
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
			combinedContent += chunk.Choices[0].Delta.Content
		}
	}

	// Create final response structure
	response := models.InferResponse{
		ID:      tracing.GetTraceID(ctx),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []models.Choice{
			{
				Index: 0,
				Message: &models.Message{
					Role:    "assistant",
					Content: combinedContent,
				},
				FinishReason: "stop",
			},
		},
		Usage: &models.UsageStats{
			PromptTokens:     100, // Simplified for MVP
			CompletionTokens: len(combinedContent) / 4, // Estimate
			TotalTokens:      100 + (len(combinedContent) / 4),
		},
		Metadata: &models.ResponseMetadata{
			Provider:    "mock-openai",
			ModelUsed:   req.Model,
			RouteDecision: "simple_stream",
		},
	}

	// Record streaming completion metrics
	latencyMs := time.Since(startTime).Milliseconds()
	provider, _ := req.GetProvider()
	if provider == "" {
		provider = "mock-openai"
	}

	metrics.RecordInferMetrics(c, provider, req.Model, latencyMs, response.Usage.PromptTokens, response.Usage.CompletionTokens, response.Usage.TotalTokens, totalCost, true, "")
	tracing.TraceInferenceResponse(traceContext, latencyMs, response.Usage.PromptTokens, response.Usage.CompletionTokens, response.Usage.TotalTokens, totalCost, true)
	tracing.AddAttribute(traceContext, "stream.chunk_count", chunkCount)

	// Return response with trace ID header
	c.Set("Content-Type", "application/json")
	c.Set("X-Trace-ID", tracing.GetTraceID(traceContext))
	return c.JSON(response)
		}

// HandleHealth handles GET /v1/health
func (h *InferHandler) HandleHealth(c *fiber.Ctx) error {
	// Start trace for health check
	fiberCtx := c.UserContext()
	ctx, traceCtx := tracing.StartSpan(fiberCtx, "health_check")
	defer tracing.FinishSpan(ctx, traceCtx, nil)

	// TODO: Check provider health
	// TODO: Check Rust optimizer health

	stats := h.router.GetStats()

	// Add trace ID to response
	c.Set("X-Trace-ID", traceCtx.TraceID)

	return c.JSON(fiber.Map{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"providers": len(stats),
		"stats":     stats,
		"trace_id":  traceCtx.TraceID,
	})
}

// HandleModels handles GET /v1/models
func (h *InferHandler) HandleModels(c *fiber.Ctx) error {
	// Start trace for models request
	fiberCtx := c.UserContext()
	ctx, traceCtx := tracing.StartSpan(fiberCtx, "models_list")
	defer tracing.FinishSpan(ctx, traceCtx, nil)

	// TODO: Aggregate models from all providers

	// Add trace ID to response
	c.Set("X-Trace-ID", traceCtx.TraceID)

	return c.JSON(fiber.Map{
		"object": "list",
		"data": []fiber.Map{
			{
				"id":      "gpt-4",
				"object":  "model",
				"created": 1687882411,
				"owned_by": "openai",
			},
			{
				"id":      "claude-3-opus-20240229",
				"object":  "model",
				"created": 1709251200,
				"owned_by": "anthropic",
			},
		},
		"trace_id": traceCtx.TraceID,
	})
}

// HandleProviderStats handles GET /v1/providers/stats
func (h *InferHandler) HandleProviderStats(c *fiber.Ctx) error {
	// Start trace for provider stats request
	fiberCtx := c.UserContext()
	ctx, traceCtx := tracing.StartSpan(fiberCtx, "provider_stats")
	defer tracing.FinishSpan(ctx, traceCtx, nil)

	// Get router stats
	stats := h.router.GetStats()
	
	// Get aggregated metrics from collector
	collector := metrics.GetMetricsCollector()
	aggregatedMetrics := collector.GetProviderMetrics()

	// Add trace ID to response
	c.Set("X-Trace-ID", traceCtx.TraceID)

	return c.JSON(fiber.Map{
		"router_stats":     stats,
		"aggregated":       aggregatedMetrics,
		"timestamp":        time.Now().Unix(),
		"trace_id":         traceCtx.TraceID,
	})
}



// calculateCost calculates the cost of an inference request using the centralized cost model
func calculateCost(provider, model string, promptTokens, completionTokens int) float64 {
	// Use the centralized cost model from Phase 11
	costModel := providers.NewCostModel()

	cost, err := costModel.EstimateCost(provider, model, promptTokens, completionTokens)
	if err != nil {
		// Fallback to simple estimation if model not found
		log.Printf("WARNING: Cost estimation failed for %s:%s, using fallback: %v", provider, model, err)
		return (float64(promptTokens+completionTokens) / 1000.0) * 0.001
	}

	return cost
}
