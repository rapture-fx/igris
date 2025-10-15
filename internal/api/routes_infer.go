package api

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/cmd/schlep-api/handlers"
)

// RegisterInferRoutes registers /v1/infer and related endpoints
func RegisterInferRoutes(app *fiber.App) error {
	// Initialize handler
	inferHandler, err := handlers.NewInferHandler()
	if err != nil {
		return err
	}

	log.Println("[Routes] Registering /v1/infer endpoints...")

	// Create v1 route group
	v1 := app.Group("/v1")

	// Main inference endpoint
	// Compatible with OpenAI and Anthropic chat completion APIs
	v1.Post("/infer", inferHandler.HandleInfer)
	log.Println("[Routes] ✓ POST /v1/infer")

	// OpenAI-compatible alias
	v1.Post("/chat/completions", inferHandler.HandleInfer)
	log.Println("[Routes] ✓ POST /v1/chat/completions (OpenAI-compatible)")

	// Health and monitoring endpoints
	v1.Get("/health", inferHandler.HandleHealth)
	log.Println("[Routes] ✓ GET /v1/health")

	// Model listing endpoint
	v1.Get("/models", inferHandler.HandleModels)
	log.Println("[Routes] ✓ GET /v1/models")

	// Provider statistics (Schlep-engine specific)
	v1.Get("/providers/stats", inferHandler.HandleProviderStats)
	log.Println("[Routes] ✓ GET /v1/providers/stats")

	log.Println("[Routes] All /v1/infer routes registered successfully")

	return nil
}

// RegisterV1Routes is a convenience function that registers all v1 routes
func RegisterV1Routes(app *fiber.App) error {
	// Register inference routes
	if err := RegisterInferRoutes(app); err != nil {
		return err
	}

	// TODO: Register other v1 routes as they are developed
	// - Embeddings: POST /v1/embeddings
	// - Fine-tuning: POST /v1/fine-tunes
	// - Files: POST /v1/files
	// - etc.

	return nil
}
