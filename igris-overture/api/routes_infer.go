package api

import (
	"context"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/cmd/igris-overture/handlers"
	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterInferRoutes registers /v1/infer and related endpoints
// Phase 2: Now supports optional JWT authentication for multi-tenancy
func RegisterInferRoutes(app *fiber.App, tenantAuth *middleware.TenantAuth, db *database.DB) error {
	// Initialize handler with database for quality routing
	inferHandler, err := handlers.NewInferHandler(db)
	if err != nil {
		return err
	}

	// Attach Runtime executor.
	// Priority 1: DB-backed registry (dynamic edge/cloud selection + health polling).
	// Priority 2: Single static IGRIS_RUNTIME_URL (backward compat, no DB required).
	// Priority 3: Direct provider routing (no runtime configured).
	if db != nil && db.IsEnabled() {
		repo := internal.NewRuntimeRepository(db.DB)
		sel := internal.NewRuntimeSelector(repo).WithDB(db.DB)
		sel.StartHealthPoller(context.Background())
		inferHandler.SetRuntimeExecutor(sel)
		log.Printf("[Routes] Runtime selector active (DB-backed registry with health polling)")
	} else if runtimeURL := os.Getenv("IGRIS_RUNTIME_URL"); runtimeURL != "" {
		rc := internal.NewRuntimeClient(runtimeURL)
		inferHandler.SetRuntimeExecutor(rc)
		log.Printf("[Routes] Runtime executor configured: %s", runtimeURL)
	} else {
		log.Println("[Routes] IGRIS_RUNTIME_URL not set — direct provider routing active")
	}

	log.Println("[Routes] Registering /v1/infer endpoints...")

	// Create v1 route group
	v1 := app.Group("/v1")

	// Determine authentication mode
	enableMultiTenancy := os.Getenv("ENABLE_MULTI_TENANCY") == "true"
	requireAuth := os.Getenv("REQUIRE_AUTH_FOR_INFERENCE") == "true"

	// Main inference endpoint with optional authentication
	// Compatible with OpenAI and Anthropic chat completion APIs
	if enableMultiTenancy && requireAuth {
		// Protected mode: Require Clerk authentication
		v1.Post("/infer", middleware.BetterAuth(db.DB), inferHandler.HandleInfer)
		log.Println("[Routes] ✓ POST /v1/infer (CLERK AUTH REQUIRED)")

		v1.Post("/chat/completions", middleware.BetterAuth(db.DB), inferHandler.HandleInfer)
		log.Println("[Routes] ✓ POST /v1/chat/completions (CLERK AUTH REQUIRED, OpenAI-compatible)")
	} else if enableMultiTenancy && tenantAuth != nil {
		// Optional auth mode: Extract tenant if token provided, allow anonymous otherwise
		v1.Post("/infer", tenantAuth.OptionalAuth(), inferHandler.HandleInfer)
		log.Println("[Routes] ✓ POST /v1/infer (OPTIONAL AUTH)")

		v1.Post("/chat/completions", tenantAuth.OptionalAuth(), inferHandler.HandleInfer)
		log.Println("[Routes] ✓ POST /v1/chat/completions (OPTIONAL AUTH, OpenAI-compatible)")
	} else {
		// Public mode: No authentication (backward compatible)
		v1.Post("/infer", inferHandler.HandleInfer)
		log.Println("[Routes] ✓ POST /v1/infer (PUBLIC)")

		v1.Post("/chat/completions", inferHandler.HandleInfer)
		log.Println("[Routes] ✓ POST /v1/chat/completions (PUBLIC, OpenAI-compatible)")
	}

	// Health and monitoring endpoints (always public)
	v1.Get("/health", inferHandler.HandleHealth)
	log.Println("[Routes] ✓ GET /v1/health")

	// Model listing endpoint (public)
	v1.Get("/models", inferHandler.HandleModels)
	log.Println("[Routes] ✓ GET /v1/models")

	// Provider statistics (public for now, could be protected later)
	v1.Get("/providers/stats", inferHandler.HandleProviderStats)
	log.Println("[Routes] ✓ GET /v1/providers/stats")

	log.Println("[Routes] All /v1/infer routes registered successfully")
	if enableMultiTenancy {
		log.Printf("[Routes] Multi-tenancy mode: %s", map[bool]string{true: "REQUIRED", false: "OPTIONAL"}[requireAuth])
	}

	return nil
}

// RegisterV1Routes is a convenience function that registers all v1 routes
func RegisterV1Routes(app *fiber.App, tenantAuth *middleware.TenantAuth, db *database.DB) error {
	// Register inference routes with optional tenant auth
	if err := RegisterInferRoutes(app, tenantAuth, db); err != nil {
		return err
	}

	// TODO: Register other v1 routes as they are developed
	// - Embeddings: POST /v1/embeddings
	// - Fine-tuning: POST /v1/fine-tunes
	// - Files: POST /v1/files
	// - etc.

	return nil
}
