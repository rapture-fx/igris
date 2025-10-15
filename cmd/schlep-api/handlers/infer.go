package handlers

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/inference/router"
	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
	"github.com/schlep-engine/schlep-engine/internal/providers/anthropic"
	"github.com/schlep-engine/schlep-engine/internal/providers/openai"
)

// InferHandler handles /v1/infer requests
type InferHandler struct {
	router *router.InferenceRouter
}

// NewInferHandler creates a new infer handler
func NewInferHandler() (*InferHandler, error) {
	// Initialize provider registry
	registry := providers.NewProviderRegistry()

	// Check PROVIDER_MODE environment variable
	// Options: "mock" (default), "real", "hybrid"
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

	return &InferHandler{
		router: inferenceRouter,
	}, nil
}

// HandleInfer handles POST /v1/infer
func (h *InferHandler) HandleInfer(c *fiber.Ctx) error {
	startTime := time.Now()

	// Parse request body
	var req models.InferRequest
	if err := c.BodyParser(&req); err != nil {
		log.Printf("[Infer] Failed to parse request: %v", err)
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": err.Error(),
				"type":    "invalid_request_error",
			},
		})
	}

	log.Printf("[Infer] Request: model=%s, messages=%d, stream=%v",
		req.Model, len(req.Messages), req.Stream)

	// Handle streaming requests
	if req.Stream {
		return h.handleStreamingInfer(c, &req)
	}

	// Route and execute inference
	ctx := c.Context()
	resp, err := h.router.Route(ctx, &req)

	if err != nil {
		log.Printf("[Infer] Inference failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": err.Error(),
				"type":    "api_error",
			},
		})
	}

	// Log performance metrics
	duration := time.Since(startTime)
	log.Printf("[Infer] Success: provider=%s, latency=%dms, tokens=%d",
		resp.Metadata.Provider, duration.Milliseconds(), resp.Usage.TotalTokens)

	// Return response
	c.Set("Content-Type", "application/json")
	return c.JSON(resp)
}

// handleStreamingInfer handles streaming inference requests
func (h *InferHandler) handleStreamingInfer(c *fiber.Ctx, req *models.InferRequest) error {
	log.Printf("[Infer] Starting streaming inference for model: %s", req.Model)

	// Set headers for Server-Sent Events
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	// Get streaming channels
	ctx := c.Context()
	chunkChan, errChan := h.router.RouteStream(ctx, req)

	// Stream chunks to client
	c.Context().SetBodyStreamWriter(func(w *fiber.StreamWriter) {
		for {
			select {
			case chunk, ok := <-chunkChan:
				if !ok {
					// Stream finished
					w.Write([]byte("data: [DONE]\n\n"))
					return
				}

				// Format as SSE
				data, err := chunk.ToSSE()
				if err != nil {
					log.Printf("[Infer] Failed to format SSE: %v", err)
					continue
				}

				if _, err := w.Write(data); err != nil {
					log.Printf("[Infer] Failed to write chunk: %v", err)
					return
				}

				if err := w.Flush(); err != nil {
					log.Printf("[Infer] Failed to flush: %v", err)
					return
				}

			case err := <-errChan:
				if err != nil {
					log.Printf("[Infer] Streaming error: %v", err)
					w.Write([]byte("data: {\"error\": \"" + err.Error() + "\"}\n\n"))
				}
				return

			case <-ctx.Done():
				log.Println("[Infer] Client disconnected")
				return
			}
		}
	})

	return nil
}

// HandleHealth handles GET /v1/health
func (h *InferHandler) HandleHealth(c *fiber.Ctx) error {
	// TODO: Check provider health
	// TODO: Check Rust optimizer health

	stats := h.router.GetStats()

	return c.JSON(fiber.Map{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"providers": len(stats),
		"stats":     stats,
	})
}

// HandleModels handles GET /v1/models
func (h *InferHandler) HandleModels(c *fiber.Ctx) error {
	// TODO: Aggregate models from all providers

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
	})
}

// HandleProviderStats handles GET /v1/providers/stats
func (h *InferHandler) HandleProviderStats(c *fiber.Ctx) error {
	stats := h.router.GetStats()

	return c.JSON(fiber.Map{
		"providers": stats,
		"timestamp": time.Now().Unix(),
	})
}
