package handlers

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer"
	ffi "github.com/Igris-inertial/system/igris-overture/inference/optimizer/ffi"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/shadow"
	"github.com/Igris-inertial/system/igris-overture/inference/router"
	"github.com/Igris-inertial/system/igris-overture/metrics"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
	"github.com/Igris-inertial/system/igris-overture/providers/anthropic"
	"github.com/Igris-inertial/system/igris-overture/providers/openai"
	specrouter "github.com/Igris-inertial/system/igris-overture/router"
	"github.com/Igris-inertial/system/igris-overture/safety"
	"github.com/Igris-inertial/system/igris-overture/tracing"
	"github.com/gofiber/fiber/v2"
)

func resolveProviderMode() string {
	providerMode := strings.ToLower(strings.TrimSpace(os.Getenv("PROVIDER_MODE")))
	if providerMode != "" {
		return providerMode
	}
	if strings.EqualFold(os.Getenv("ENV"), "production") {
		return "real"
	}
	return "mock"
}

func validateProviderMode(providerMode string) {
	switch providerMode {
	case "mock", "benchmark", "hybrid", "real":
	default:
		log.Fatalf("[Handler] FATAL: Invalid PROVIDER_MODE=%q. Expected one of: mock, benchmark, hybrid, real.", providerMode)
	}

	if strings.EqualFold(os.Getenv("ENV"), "production") &&
		providerMode != "real" &&
		os.Getenv("ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION") != "true" {
		log.Fatal("[Handler] FATAL: Production requires PROVIDER_MODE=real. " +
			"Simulated or hybrid providers are blocked unless ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true.")
	}
}

// RuntimeExecutor forwards inference to a remote Runtime instance.
// Keeping this as an interface avoids a circular import between the
// cmd/handlers package and igris-overture/internal.
type RuntimeExecutor interface {
	ForwardExecution(ctx context.Context, tenantID string, req *models.InferRequest, boundsHeader string) (*models.InferResponse, error)
	OpenStreamingExecution(ctx context.Context, tenantID string, req *models.InferRequest, boundsHeader string) (*http.Response, error)
	Health(ctx context.Context) error
	BaseURL() string
}

// InferHandler handles /v1/infer requests
type InferHandler struct {
	router            *router.InferenceRouter
	speculativeRouter *specrouter.SpeculativeRouter
	shadowRunner      *shadow.ShadowRunner
	sloBreaker        *optimizer.SLOBreaker
	runtimeConfig     *config.RuntimeOptimizerConfig
	activationMetrics *optimizer.ActivationMetricsRecorder
	safetyController  *safety.SafetyController
	rand              *rand.Rand
	// runtimeExecutor forwards execution to igris-server when IGRIS_RUNTIME_URL is set.
	// When nil, Overture routes directly to cloud providers (legacy path).
	runtimeExecutor RuntimeExecutor
}

// NewInferHandler creates a new infer handler
func NewInferHandler(db *database.DB) (*InferHandler, error) {
	// Initialize metrics collector
	metrics.InitMetricsCollector()

	// Initialize tracing
	tracing.InitGlobalTracer("igris-inertial", 1.0) // 100% sampling for MVP

	// Initialize provider registry
	registry := providers.NewProviderRegistry()

	// Check PROVIDER_MODE environment variable
	// Options: "mock" (dev), "real", "hybrid", "benchmark"
	providerMode := resolveProviderMode()
	validateProviderMode(providerMode)

	log.Printf("[Handler] Provider mode: %s", providerMode)

	// Register providers based on mode
	if providerMode == "mock" || providerMode == "hybrid" {
		// Register Mock OpenAI provider
		mockConfig := &providers.ProviderConfig{
			BaseURL:       "https://mock.igris-inertial.local",
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

		// Register Mock Anthropic provider
		mockAnthropicConfig := &providers.ProviderConfig{
			BaseURL:       "https://mock.anthropic.igris-inertial.local",
			Timeout:       30,
			MaxRetries:    3,
			EnableMetrics: true,
		}
		mockAnthropicProvider, err := anthropic.NewMockAnthropicProvider(mockAnthropicConfig)
		if err != nil {
			log.Printf("WARNING: Failed to initialize Mock Anthropic provider: %v", err)
		} else {
			registry.Register(mockAnthropicProvider)
			log.Println("[Handler] ✓ Registered Mock Anthropic provider")
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
		// PHASE 12: Real provider integration with BYOK (Bring Your Own Key)

		// Register OpenAI provider (if API key available)
		openaiAPIKey := os.Getenv("OPENAI_API_KEY")
		if openaiAPIKey != "" {
			// Validate API key format
			if !validateOpenAIKey(openaiAPIKey) {
				log.Printf("ERROR: Invalid OPENAI_API_KEY format. Expected format: sk-...")
			} else {
				openaiConfig := &providers.ProviderConfig{
					APIKey:        openaiAPIKey,
					BaseURL:       "https://api.openai.com/v1",
					Timeout:       30,
					MaxRetries:    3,
					RetryDelay:    500,
					EnableMetrics: true,
				}
				openaiProvider, err := openai.NewOpenAIProvider(openaiConfig)
				if err != nil {
					log.Printf("ERROR: Failed to initialize OpenAI provider: %v", err)
				} else {
					registry.Register(openaiProvider)
					log.Println("[Handler] ✓ Registered OpenAI provider (REAL MODE)")
				}
			}
		} else {
			log.Println("[Handler] ⚠ OPENAI_API_KEY not set - OpenAI provider not registered")
		}

		// Register Anthropic provider (if API key available)
		anthropicAPIKey := os.Getenv("ANTHROPIC_API_KEY")
		if anthropicAPIKey != "" {
			// Validate API key format
			if !validateAnthropicKey(anthropicAPIKey) {
				log.Printf("ERROR: Invalid ANTHROPIC_API_KEY format. Expected format: sk-ant-...")
			} else {
				// Load rate limiter configuration from environment
				rateLimiterConfig := loadAnthropicRateLimiterConfig()

				anthropicConfig := &providers.ProviderConfig{
					APIKey:        anthropicAPIKey,
					BaseURL:       "https://api.anthropic.com/v1",
					Timeout:       30,
					MaxRetries:    3,
					RetryDelay:    500,
					EnableMetrics: true,
					Custom:        rateLimiterConfig,
				}
				anthropicProvider, err := anthropic.NewAnthropicProvider(anthropicConfig)
				if err != nil {
					log.Printf("ERROR: Failed to initialize Anthropic provider: %v", err)
				} else {
					registry.Register(anthropicProvider)
					log.Println("[Handler] ✓ Registered Anthropic provider (REAL MODE)")
					log.Printf("[Handler]   Rate Limiting: enabled=%v, rpm=%d, tpm=%d",
						rateLimiterConfig["rate_limit_enabled"],
						rateLimiterConfig["rate_limit_rpm"],
						rateLimiterConfig["rate_limit_tpm"])
				}
			}
		} else {
			log.Println("[Handler] ⚠ ANTHROPIC_API_KEY not set - Anthropic provider not registered")
		}

		// Fail fast if no providers registered in real mode
		if providerMode == "real" && len(registry.List()) == 0 {
			log.Fatal("[Handler] FATAL: PROVIDER_MODE=real but no API keys provided. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")
		}
	}

	// Verify at least one provider is registered
	if len(registry.List()) == 0 {
		log.Fatal("[Handler] ERROR: No providers registered. Cannot start server.")
	}

	log.Printf("[Handler] Registered providers: %v", registry.List())

	// Create inference router with database for quality routing
	var dbInstance *sql.DB
	if db != nil && db.IsEnabled() {
		dbInstance = db.DB
	}
	inferenceRouter := router.NewInferenceRouter(registry, dbInstance)

	// PHASE 1.2: Initialize Rust Thompson Sampling optimizer
	log.Println("[Handler] Initializing Rust Thompson Sampling optimizer...")
	if err := inferenceRouter.InitializeOptimizer(); err != nil {
		log.Printf("[Handler] ⚠️  WARNING: Failed to initialize Rust optimizer: %v", err)
		log.Println("[Handler] ⚠️  Falling back to Go-based routing")
	} else {
		log.Println("[Handler] 🦀 Rust optimizer initialized successfully")
	}

	// Initialize Speculative Router (PR #6)
	// Check if speculative execution is enabled
	var speculativeRouter *specrouter.SpeculativeRouter
	if os.Getenv("ENABLE_SPECULATIVE") == "true" {
		log.Println("[Handler] Initializing Speculative Router...")
		specConfig := &config.SpeculativeConfig{
			Enabled:           true,
			DefaultMode:       config.SpeculativeModeLatency,
			MaxProviders:      3,
			FirstTokenTimeout: 5 * time.Second,
			EarlyTokenCount:   5,
			WasteThreshold:    0.30, // 30% waste threshold for auto-disable
		}

		// Create a minimal AdaptiveRouter (for speculative routing)
		adaptiveRouter := &specrouter.AdaptiveRouter{
			// Note: Using unexported fields requires constructor or reflection,
			// but for streamlined integration we'll create an empty router
			// as it's not actively used in speculative routing
		}

		speculativeRouter = specrouter.NewSpeculativeRouter(specConfig, adaptiveRouter, registry)
		log.Println("[Handler] ✓ Speculative Router initialized")
		log.Printf("[Handler]   Default mode: %s, Max providers: %d, Waste threshold: %.0f%%",
			specConfig.DefaultMode, specConfig.MaxProviders, specConfig.WasteThreshold*100)
	} else {
		log.Println("[Handler] Speculative execution disabled (set ENABLE_SPECULATIVE=true to enable)")
	}

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

	// PHASE 2: Initialize Safety Controller (multi-tenant or single-tenant mode)
	safetyConfig := safety.LoadSafetyConfig()
	var safetyController *safety.SafetyController

	enableMultiTenancy := os.Getenv("ENABLE_MULTI_TENANCY") == "true"
	if enableMultiTenancy {
		// Multi-tenant mode: Connect to database
		log.Println("[Handler] Initializing multi-tenant safety controller...")

		dbConfig := database.NewConfig()
		db, err := database.Connect(dbConfig)
		if err != nil {
			log.Printf("[Handler] WARNING: Failed to connect to database for multi-tenancy: %v", err)
			log.Println("[Handler] Falling back to single-tenant mode")
			safetyController = safety.NewSafetyController(safetyConfig)
		} else if db != nil && db.IsEnabled() {
			// Multi-tenant mode with database
			safetyController = safety.NewMultiTenantSafetyController(safetyConfig, db.DB)
			log.Println("[Handler] ✅ Multi-tenant safety controller initialized")
		} else {
			log.Println("[Handler] WARNING: Database not available, falling back to single-tenant mode")
			safetyController = safety.NewSafetyController(safetyConfig)
		}
	} else {
		// Single-tenant mode (legacy)
		safetyController = safety.NewSafetyController(safetyConfig)
		log.Println("[Handler] Single-tenant safety controller initialized")
	}

	// Set benchmark provider for fallback (if available)
	benchmarkProvider, _ := registry.Get("benchmark-openai")
	if benchmarkProvider != nil {
		safetyController.SetBenchmarkProvider(benchmarkProvider)
		log.Println("[Handler] ✓ Benchmark fallback configured")
	}

	// Validate API keys if in real mode
	if providerMode == "real" || providerMode == "hybrid" {
		openaiKey := os.Getenv("OPENAI_API_KEY")
		anthropicKey := os.Getenv("ANTHROPIC_API_KEY")

		keyValidator := safetyController.GetKeyValidator()
		if err := keyValidator.ValidateAllKeys(openaiKey, anthropicKey); err != nil {
			log.Fatalf("[Handler] FATAL: API key validation failed: %v", err)
		}
	}

	// Log production safety status
	if safe, warnings := safetyController.ValidateConfiguration(); !safe {
		log.Println("[Handler] ⚠️  PRODUCTION SAFETY WARNINGS:")
		for _, warning := range warnings {
			log.Printf("  - %s", warning)
		}
	}

	return &InferHandler{
		router:            inferenceRouter,
		speculativeRouter: speculativeRouter,
		shadowRunner:      shadowRunner,
		sloBreaker:        sloBreaker,
		runtimeConfig:     runtimeConfig,
		activationMetrics: activationMetrics,
		safetyController:  safetyController,
		rand:              rand.New(rand.NewSource(time.Now().UnixNano())),
	}, nil
}

// SetRuntimeExecutor attaches a RuntimeExecutor to the handler.  When set,
// HandleInfer forwards non-streaming requests to the Runtime instead of
// calling cloud providers directly.  On Runtime failure, execution falls back
// to the direct-routing path for backward compatibility.
func (h *InferHandler) SetRuntimeExecutor(e RuntimeExecutor) {
	h.runtimeExecutor = e
	log.Printf("[Handler] Runtime executor attached: %s", e.BaseURL())
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

	// Phase 2: Extract tenant ID from context (multi-tenancy)
	tenantID := middleware.GetTenantIDFromContext(c)
	traceID := tracing.GetTraceID(ctx)

	log.Printf("[Infer] Request: tenant=%s, model=%s, messages=%d, stream=%v",
		tenantID, req.Model, len(req.Messages), req.Stream)

	// PHASE 2: Safety checks (Budget + Token Limits) - per-tenant
	estimatedCost := 0.01 // Rough estimate, will be refined
	safetyCheck, err := h.safetyController.PreRequestCheckForTenant(&req, estimatedCost, tenantID, traceID)
	if err != nil || !safetyCheck.Allowed {
		log.Printf("[Infer] Safety check failed for tenant %s: %v", tenantID, safetyCheck.Reason)

		// Record safety rejection metrics
		latencyMs := time.Since(startTime).Milliseconds()
		safety.RecordSafetyCheck(false, false, float64(latencyMs))

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": safetyCheck.Reason,
				"type":    "safety_limit_exceeded",
				"details": map[string]interface{}{
					"budget_check": safetyCheck.BudgetCheck,
					"token_check":  safetyCheck.TokenCheck,
				},
			},
		})
	}

	// Log safety warnings
	for _, warning := range safetyCheck.WarningMessages {
		log.Printf("[Infer] Safety warning: %s", warning)
	}

	// Check if we should use benchmark fallback
	useBenchmark := safetyCheck.UseBenchmark
	if useBenchmark {
		log.Printf("[Infer] Using benchmark mode due to: %s", safetyCheck.Reason)
		traceID := tracing.GetTraceID(ctx)
		safety.RecordBudgetFallback(time.Now().Format("2006-01"), traceID)
	}

	// Route and execute inference.
	var resp *models.InferResponse

	// Runtime executor intercepts durable request paths first. Streaming requests use
	// the Runtime durable stream endpoint when available; fallback paths stay in
	// Overture only when Runtime is unreachable or the request mode is unsupported.
	if h.runtimeExecutor != nil {
		boundsHeader := string(c.Request().Header.Peek("X-Igris-Bounds"))
		resp, err = h.runtimeExecutor.ForwardExecution(ctx, tenantID, &req, boundsHeader)
		if err != nil {
			if errors.Is(err, models.ErrRuntimeSecurity) {
				// Security rejection (auth failure, signature mismatch, envelope tamper):
				// hard-fail and return 502 — never fall back to direct provider routing.
				log.Printf("[Infer] Runtime security rejection — not falling back: %v", err)
				return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
					"error": "upstream security rejection",
				})
			}
			// Connectivity / timeout failure: fall back to direct routing.
			log.Printf("[Infer] Runtime forward failed, falling back to direct routing: %v", err)
			err = nil
			resp = nil
		}
	}

	// Fallback paths — only used when runtimeExecutor is not configured or forward failed.
	if resp == nil {
		// Handle streaming requests first so council/speculative streaming can still
		// try the Runtime durable stream path before any non-streaming fallback.
		if req.Stream {
			return h.handleStreamingInfer(c, &req)
		}

		// Handle council mode (non-streaming only)
		if req.CouncilMode {
			return h.handleCouncilInfer(c, &req)
		}
	}

	// Determine routing decision source based on optimizer mode
	currentMode := h.runtimeConfig.GetMode()
	currentSampleRate := h.runtimeConfig.GetSampleRate()
	useRustOptimizer := false
	decisionSource := "go_router"
	if resp != nil {
		decisionSource = "runtime"
	}

	// Phase 10: Phased rollout logic (only relevant for direct routing path)
	if resp == nil {
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
	}

	if resp == nil {
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

	// PHASE 2: Record cost in budget tracker (per-tenant)
	requestID := c.Get("X-Request-ID")
	if err := h.safetyController.PostRequestRecordForTenant(provider, model, costUSD, tenantID, requestID, traceID); err != nil {
		log.Printf("[Infer] WARNING: Failed to record cost for tenant %s: %v", tenantID, err)
	}
	safety.RecordCost(provider, model, costUSD)
	safety.RecordSafetyCheck(true, useBenchmark, float64(latencyMs))

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
	c.Set("X-Trace-ID", traceID)
	return c.JSON(resp)
}

// routeWithRustOptimizer routes inference using the Rust optimizer
func (h *InferHandler) routeWithRustOptimizer(c *fiber.Ctx, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Get Rust optimizer decision
	if h.shadowRunner == nil {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "Shadow runner not initialized")
	}

	// Get optimizer handle from shadow runner
	optimizerHandle := h.shadowRunner.GetOptimizerHandle()
	if optimizerHandle == nil {
		log.Printf("[Infer] Rust optimizer not available, falling back to Go router")
		return h.router.Route(c.Context(), req)
	}

	// Select action using Thompson Sampling
	action, err := optimizerHandle.SelectAction()
	if err != nil {
		log.Printf("[Infer] Rust optimizer SelectAction failed: %v, falling back to Go router", err)
		h.activationMetrics.RecordGoFallback("optimizer_error")
		return h.router.Route(c.Context(), req)
	}

	log.Printf("[Infer] Rust optimizer selected action: %s", action.ActionID)

	// Parse action ID to get provider name
	// Action ID format: "openai/gpt-4" or "anthropic/claude-3-5-sonnet"
	providerName := parseActionToProvider(action.ActionID)
	if providerName == "" {
		log.Printf("[Infer] Failed to parse action ID %s, falling back to Go router", action.ActionID)
		h.activationMetrics.RecordGoFallback("parse_error")
		return h.router.Route(c.Context(), req)
	}

	// Execute inference with selected provider
	resp, err := h.router.RouteToProvider(c.Context(), req, providerName)
	if err != nil {
		log.Printf("[Infer] Provider %s failed: %v, attempting fallback", providerName, err)

		// Record failure with negative reward
		metrics := ffi.RewardMetrics{
			LatencyMs:    float64(time.Since(startTime).Milliseconds()),
			Success:      false,
			CacheHit:     false,
			CostUsd:      0.0,
			QualityScore: nil,
		}
		_ = optimizerHandle.UpdateMetrics(action.ActionID, metrics)

		// Fallback to Go router for alternative provider
		h.activationMetrics.RecordGoFallback("provider_error")
		return h.router.Route(c.Context(), req)
	}

	// Calculate reward and update optimizer
	latencyMs := float64(time.Since(startTime).Milliseconds())
	costUsd := resp.Metadata.CostUSD

	rewardMetrics := ffi.RewardMetrics{
		LatencyMs:    latencyMs,
		Success:      true,
		CacheHit:     false, // TODO: Check cache status
		CostUsd:      costUsd,
		QualityScore: nil, // TODO: Quality scoring
	}

	if err := optimizerHandle.UpdateMetrics(action.ActionID, rewardMetrics); err != nil {
		log.Printf("[Infer] Failed to update optimizer metrics: %v", err)
	}

	// Add optimizer metadata to response
	if resp.Metadata == nil {
		resp.Metadata = &models.ResponseMetadata{}
	}
	resp.Metadata.RouteDecision = fmt.Sprintf("Rust Thompson Sampling: %s", action.ActionID)

	return resp, nil
}

// parseActionToProvider extracts provider name from action ID
// Action ID format: "provider/model" (e.g., "openai/gpt-4")
func parseActionToProvider(actionID string) string {
	parts := strings.Split(actionID, "/")
	if len(parts) < 1 {
		return ""
	}
	return parts[0]
}

// GetShadowRunner returns the shadow runner instance (for Admin API access)
func (h *InferHandler) GetShadowRunner() *shadow.ShadowRunner {
	return h.shadowRunner
}

// handleCouncilInfer handles council mode inference requests
func (h *InferHandler) handleCouncilInfer(c *fiber.Ctx, req *models.InferRequest) error {
	startTime := time.Now()

	// Start trace for council inference
	ctx := c.UserContext()
	traceContext, traceCtx := tracing.StartSpan(ctx, "council_mode_infer")
	defer tracing.FinishSpan(traceContext, traceCtx, nil)

	// Check if speculative router is available (required for council mode)
	if h.speculativeRouter == nil {
		log.Printf("[Infer] Council mode requested but speculative router not initialized")
		latencyMs := time.Since(startTime).Milliseconds()
		metrics.RecordInferError(c, "error", "council_not_available", latencyMs, "speculative router not enabled")

		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Council mode not available. Enable ENABLE_SPECULATIVE=true",
				"type":    "invalid_request_error",
			},
		})
	}

	log.Printf("[Infer] Starting council mode inference for model: %s", req.Model)
	tracing.AddAttribute(traceContext, "council.enabled", true)

	// Execute council routing
	resp, councilMetadata, err := h.speculativeRouter.RouteCouncil(traceContext, req)

	latencyMs := time.Since(startTime).Milliseconds()

	if err != nil {
		log.Printf("[Infer] Council mode failed: %v, falling back to adaptive routing", err)

		// Fallback to normal routing on error
		resp, err = h.router.Route(c.Context(), req)
		if err != nil {
			log.Printf("[Infer] Fallback routing also failed: %v", err)

			provider, _ := req.GetProvider()
			if provider == "" {
				provider = "unknown"
			}

			tracer := tracing.GetGlobalTracer()
			tracer.AddError(traceContext, err)
			tracer.TraceInferenceResponse(traceContext, latencyMs, 0, 0, 0, 0, false)

			metrics.RecordInferMetrics(c, provider, req.Model, latencyMs, 0, 0, 0, 0, false, err.Error())

			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": map[string]interface{}{
					"message": err.Error(),
					"type":    "api_error",
				},
			})
		}

		// Fallback succeeded
		councilMetadata = nil
	}

	// Extract metrics from response
	provider := resp.Metadata.Provider
	if councilMetadata != nil {
		provider = councilMetadata.ChairmanProvider
	}
	model := resp.Model
	promptTokens := resp.Usage.PromptTokens
	completionTokens := resp.Usage.CompletionTokens
	totalTokens := resp.Usage.TotalTokens

	// Calculate cost
	costUSD := calculateCost(provider, model, promptTokens, completionTokens)
	if councilMetadata != nil {
		// Add council overhead cost
		councilMetadata.CouncilCostUSD = costUSD
		costUSD = costUSD * float64(councilMetadata.ResponseCount+1) // Rough estimate
	}

	// Add council metadata to trace
	if councilMetadata != nil {
		tracing.AddAttribute(traceContext, "council.members", fmt.Sprintf("%v", councilMetadata.ProvidersUsed))
		tracing.AddAttribute(traceContext, "council.chairman", councilMetadata.ChairmanProvider)
		tracing.AddAttribute(traceContext, "council.total_latency_ms", councilMetadata.TotalLatencyMs)
		tracing.AddAttribute(traceContext, "council.winner", councilMetadata.WinnerProvider)
		tracing.AddAttribute(traceContext, "council.response_count", councilMetadata.ResponseCount)
	}

	// Add response attributes to trace
	tracing.TraceInferenceResponse(traceContext, latencyMs, promptTokens, completionTokens, totalTokens, costUSD, true)

	// Store provider and model in context for middleware
	c.Locals("provider", provider)
	c.Locals("model", model)

	// Record successful request metrics
	metrics.RecordInferMetrics(c, provider, model, latencyMs, promptTokens, completionTokens, totalTokens, costUSD, true, "")

	// Record cost in budget tracker
	tenantID := middleware.GetTenantIDFromContext(c)
	requestID := c.Get("X-Request-ID")
	traceID := tracing.GetTraceID(traceContext)

	if err := h.safetyController.PostRequestRecordForTenant(provider, model, costUSD, tenantID, requestID, traceID); err != nil {
		log.Printf("[Infer] WARNING: Failed to record cost for tenant %s: %v", tenantID, err)
	}
	safety.RecordCost(provider, model, costUSD)
	safety.RecordSafetyCheck(true, false, float64(latencyMs))

	// Log performance metrics
	councilSummary := ""
	if councilMetadata != nil {
		councilSummary = fmt.Sprintf(", council_members=%d, winner=%s",
			councilMetadata.ResponseCount, councilMetadata.WinnerProvider)
	}

	log.Printf("[Infer] Council Success: provider=%s, model=%s, latency=%dms, tokens=%d, cost=$%.6f%s",
		provider, model, latencyMs, totalTokens, costUSD, councilSummary)

	// Return response with trace ID and council metadata
	c.Set("Content-Type", "application/json")
	c.Set("X-Trace-ID", traceID)

	// Add council metadata to response if available
	if councilMetadata != nil && resp.Metadata != nil {
		resp.Metadata.RouteDecision = fmt.Sprintf("council_mode (members=%d, winner=%s)",
			councilMetadata.ResponseCount, councilMetadata.WinnerProvider)
	}

	return c.JSON(resp)
}

// handleStreamingInfer handles streaming inference requests
func (h *InferHandler) handleStreamingInfer(c *fiber.Ctx, req *models.InferRequest) error {
	startTime := time.Now()
	ctx := c.Context()
	tenantID := middleware.GetTenantIDFromContext(c)

	// Start trace for streaming inference
	userCtx := c.UserContext()
	traceContext, traceCtx := tracing.StartSpan(userCtx, "inference_stream_execute")
	defer tracing.FinishSpan(traceContext, traceCtx, nil)

	// Add streaming attributes to trace
	tracing.TraceInferenceRequest(traceContext, "unknown", req.Model, len(req.Messages), true)

	log.Printf("[Infer] Starting streaming inference for model: %s", req.Model)

	// Prefer the Runtime durable stream path for all known streaming modes. When a
	// Runtime executor is configured, keep execution authority strict instead of
	// silently degrading to Overture-local streaming.
	if h.runtimeExecutor != nil {
		boundsHeader := string(c.Request().Header.Peek("X-Igris-Bounds"))
		runtimeResp, err := h.runtimeExecutor.OpenStreamingExecution(traceContext, tenantID, req, boundsHeader)
		if err != nil {
			if errors.Is(err, models.ErrRuntimeSecurity) {
				log.Printf("[Infer] Runtime streaming security rejection — not falling back: %v", err)
				return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
					"error": "upstream security rejection",
				})
			}
			if req.AllowStreamFallback {
				log.Printf("[Infer] Runtime streaming unavailable, using explicit stream fallback opt-in: %v", err)
			} else {
				log.Printf("[Infer] Runtime streaming unavailable, refusing fallback to preserve execution authority: %v", err)
				return c.Status(fiber.StatusServiceUnavailable).JSON(buildRuntimeStreamingUnavailableResponse(err))
			}
		} else {
			setStreamingSSEHeaders(c, traceCtx.TraceID)
			applyRuntimeStreamContractHeaders(c, runtimeResp)

			c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
				defer runtimeResp.Body.Close()
				reader := bufio.NewReader(runtimeResp.Body)
				for {
					line, err := reader.ReadBytes('\n')
					if len(line) > 0 {
						_, _ = w.Write(line)
						_ = w.Flush()
					}
					if err != nil {
						if !errors.Is(err, io.EOF) {
							log.Printf("[Infer] Runtime streaming relay interrupted: %v", err)
						}
						return
					}
				}
			})
			return nil
		}
	}

	// Set headers for Server-Sent Events
	setStreamingSSEHeaders(c, traceCtx.TraceID)
	applyFallbackStreamContractHeaders(c)

	// Check if speculative mode is enabled. Legacy Overture fallback still does not
	// support council streaming; Runtime should own that mode when available.
	var chunkChan <-chan *models.StreamChunk
	var errChan <-chan error
	var speculativeMetadata *specrouter.SpeculativeMetadata

	if req.CouncilMode {
		log.Printf("[Infer] Council streaming unavailable on fallback path, degrading to non-streaming council execution")
		req.Stream = false
		return h.handleCouncilInfer(c, req)
	} else if req.SpeculativeMode != "" && h.speculativeRouter != nil {
		log.Printf("[Infer] Using speculative execution mode: %s", req.SpeculativeMode)

		// Parse mode
		var mode config.SpeculativeMode
		switch req.SpeculativeMode {
		case "latency":
			mode = config.SpeculativeModeLatency
		case "balanced":
			mode = config.SpeculativeModeBalanced
		case "quality":
			mode = config.SpeculativeModeQuality
		case "cost":
			mode = config.SpeculativeModeCost
		default:
			log.Printf("[Infer] Unknown speculative mode '%s', falling back to latency", req.SpeculativeMode)
			mode = config.SpeculativeModeLatency
		}

		// Route speculatively - pass tenant ID through context
		tenantID := middleware.GetTenantIDFromContext(c)
		speculativeCtx := middleware.WithTenantID(traceContext, tenantID)
		tokenChan, errC, metadata, err := h.speculativeRouter.RouteSpeculative(speculativeCtx, req, mode)
		if err != nil {
			log.Printf("[Infer] Speculative routing failed: %v, falling back to normal routing", err)
			chunkChan, errChan = h.router.RouteStream(traceContext, req)
		} else {
			chunkChan = tokenChan
			errChan = errC
			speculativeMetadata = metadata
		}
	} else {
		// Normal routing
		chunkChan, errChan = h.router.RouteStream(traceContext, req)
	}

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
			PromptTokens:     100,                      // Simplified for MVP
			CompletionTokens: len(combinedContent) / 4, // Estimate
			TotalTokens:      100 + (len(combinedContent) / 4),
		},
		Metadata: &models.ResponseMetadata{
			Provider:      "mock-openai",
			ModelUsed:     req.Model,
			RouteDecision: "simple_stream",
		},
	}
	applyStreamContractMetadata(response.Metadata, fallbackStreamContract())

	// If speculative execution was used, add metadata
	if speculativeMetadata != nil {
		finalMeta := speculativeMetadata.GetFinalMetadata()
		response.Metadata.Provider = finalMeta.FinalProvider
		response.Metadata.RouteDecision = "speculative_" + string(speculativeMetadata.SelectionCriteria)

		// Add speculative metadata to tracing
		tracing.AddAttribute(traceContext, "speculative.enabled", true)
		tracing.AddAttribute(traceContext, "speculative.mode", string(speculativeMetadata.SelectionCriteria))
		tracing.AddAttribute(traceContext, "speculative.winner", speculativeMetadata.WinnerProvider)
		tracing.AddAttribute(traceContext, "speculative.providers_raced", len(speculativeMetadata.ProvidersUsed))
		tracing.AddAttribute(traceContext, "speculative.latency_saved_ms", speculativeMetadata.LatencySavedMs)

		log.Printf("[Infer] Speculative execution completed: winner=%s, latency_saved=%dms, providers=%v",
			speculativeMetadata.WinnerProvider, speculativeMetadata.LatencySavedMs, speculativeMetadata.ProvidersUsed)
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

func buildRuntimeStreamingUnavailableResponse(err error) fiber.Map {
	contract := runtimeUnavailableStreamContract()
	resp := fiber.Map{
		"error": fiber.Map{
			"message": "runtime-backed streaming is unavailable; fallback refused to preserve execution authority",
			"type":    "stream_execution_unavailable",
		},
		"stream": contract.ToMap(),
	}
	if err != nil {
		resp["detail"] = err.Error()
	}
	return resp
}

func setStreamingSSEHeaders(c *fiber.Ctx, traceID string) {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Trace-ID", traceID)
}

func applyRuntimeStreamContractHeaders(c *fiber.Ctx, runtimeResp *http.Response) {
	applyStreamContractHeaders(c, runtimeResponseStreamContract(runtimeResp))

	if taskID := runtimeResp.Header.Get("X-Igris-Runtime-Task-Id"); taskID != "" {
		c.Set("X-Igris-Runtime-Task-Id", taskID)
	}
	if resumeSupported := runtimeResp.Header.Get("X-Igris-Runtime-Stream-Resume-Supported"); resumeSupported != "" {
		c.Set("X-Igris-Runtime-Stream-Resume-Supported", resumeSupported)
	}
	if replayCondition := runtimeResp.Header.Get("X-Igris-Runtime-Stream-Replay-Condition"); replayCondition != "" {
		c.Set("X-Igris-Runtime-Stream-Replay-Condition", replayCondition)
	}
	c.Set("X-Accel-Buffering", "no")
}

func applyFallbackStreamContractHeaders(c *fiber.Ctx) {
	applyStreamContractHeaders(c, fallbackStreamContract())
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
				"id":       "gpt-4",
				"object":   "model",
				"created":  1687882411,
				"owned_by": "openai",
			},
			{
				"id":       "claude-3-opus-20240229",
				"object":   "model",
				"created":  1709251200,
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
		"router_stats": stats,
		"aggregated":   aggregatedMetrics,
		"timestamp":    time.Now().Unix(),
		"trace_id":     traceCtx.TraceID,
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

// validateOpenAIKey validates OpenAI API key format
// Valid format: sk-[alphanumeric with hyphens and underscores]{48+}
func validateOpenAIKey(key string) bool {
	if len(key) < 20 { // "sk-" + at least some characters (modern keys vary in length)
		return false
	}
	if !strings.HasPrefix(key, "sk-") {
		return false
	}
	// Check remaining characters are alphanumeric, hyphens, or underscores
	for _, ch := range key[3:] {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_') {
			return false
		}
	}
	return true
}

// validateAnthropicKey validates Anthropic API key format
// Valid format: sk-ant-[alphanumeric with hyphens and underscores]{40+}
func validateAnthropicKey(key string) bool {
	if len(key) < 20 { // "sk-ant-" + at least some characters
		return false
	}
	if !strings.HasPrefix(key, "sk-ant-") {
		return false
	}
	// Check remaining characters are alphanumeric, hyphens, or underscores
	for _, ch := range key[7:] {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_') {
			return false
		}
	}
	return true
}

// loadAnthropicRateLimiterConfig loads Anthropic rate limiter configuration from environment variables
func loadAnthropicRateLimiterConfig() map[string]interface{} {
	config := make(map[string]interface{})

	// Load enabled flag (default: true)
	enabled := os.Getenv("ANTHROPIC_RATE_LIMIT_ENABLED")
	if enabled == "" || enabled == "true" {
		config["rate_limit_enabled"] = true
	} else {
		config["rate_limit_enabled"] = false
	}

	// Load requests per minute (default: 50)
	rpm := os.Getenv("ANTHROPIC_RATE_LIMIT_RPM")
	if rpm != "" {
		var rpmInt int
		fmt.Sscanf(rpm, "%d", &rpmInt)
		config["rate_limit_rpm"] = rpmInt
	} else {
		config["rate_limit_rpm"] = 50 // Default
	}

	// Load tokens per minute (default: 400000)
	tpm := os.Getenv("ANTHROPIC_RATE_LIMIT_TPM")
	if tpm != "" {
		var tpmInt int
		fmt.Sscanf(tpm, "%d", &tpmInt)
		config["rate_limit_tpm"] = tpmInt
	} else {
		config["rate_limit_tpm"] = 400000 // Default
	}

	// Load queue size (default: 100)
	queueSize := os.Getenv("ANTHROPIC_RATE_LIMIT_QUEUE_SIZE")
	if queueSize != "" {
		var queueSizeInt int
		fmt.Sscanf(queueSize, "%d", &queueSizeInt)
		config["rate_limit_queue_size"] = queueSizeInt
	} else {
		config["rate_limit_queue_size"] = 100 // Default
	}

	// Load backoff base in milliseconds (default: 200)
	backoffMs := os.Getenv("ANTHROPIC_RATE_LIMIT_BACKOFF_MS")
	if backoffMs != "" {
		var backoffMsInt int
		fmt.Sscanf(backoffMs, "%d", &backoffMsInt)
		config["rate_limit_backoff_ms"] = backoffMsInt
	} else {
		config["rate_limit_backoff_ms"] = 200 // Default
	}

	// Load max retries (default: 5)
	maxRetries := os.Getenv("ANTHROPIC_RATE_LIMIT_MAX_RETRIES")
	if maxRetries != "" {
		var maxRetriesInt int
		fmt.Sscanf(maxRetries, "%d", &maxRetriesInt)
		config["rate_limit_max_retries"] = maxRetriesInt
	} else {
		config["rate_limit_max_retries"] = 5 // Default
	}

	// Load jitter max in milliseconds (default: 100)
	jitterMs := os.Getenv("ANTHROPIC_RATE_LIMIT_JITTER_MS")
	if jitterMs != "" {
		var jitterMsInt int
		fmt.Sscanf(jitterMs, "%d", &jitterMsInt)
		config["rate_limit_jitter_ms"] = jitterMsInt
	} else {
		config["rate_limit_jitter_ms"] = 100 // Default
	}

	return config
}
