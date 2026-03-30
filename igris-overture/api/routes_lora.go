package api

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterLoRARoutes registers LoRA training proxy routes.
// These forward requests to the runtime's /v1/lora/* endpoints, scoped per
// tenant via BetterAuth. The runtime is reached via RUNTIME_URL (default
// http://localhost:8080), which maps to the runtime instance for this tenant.
func RegisterLoRARoutes(app *fiber.App, db *sql.DB) {
	runtimeURL := os.Getenv("RUNTIME_URL")
	if runtimeURL == "" {
		log.Println("[LoRA] WARNING: RUNTIME_URL not set — lora proxy disabled, requests return degraded status")
		runtimeURL = "http://localhost:8080" // kept for compat; non-200 responses now handled gracefully
	}

	h := &loraProxyHandler{
		runtimeURL: runtimeURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	auth := middleware.BetterAuth(db)

	app.Get("/v1/lora/status", auth, h.getStatus)
	app.Post("/v1/lora/trigger", auth, h.triggerTraining)

	log.Println("[LoRA] ✅ LoRA training proxy endpoints registered (/v1/lora/*)")
}

type loraProxyHandler struct {
	runtimeURL string
	httpClient *http.Client
}

// getStatus proxies GET /v1/lora/status to the runtime.
func (h *loraProxyHandler) getStatus(c *fiber.Ctx) error {
	return h.proxyGET(c, "/v1/lora/status")
}

// triggerTraining informs the caller that training is automatic.
// The runtime triggers background training after reaching the configured
// inference threshold — there is no manual trigger endpoint.
// Returns 202 Accepted with current status so the console can refresh state.
func (h *loraProxyHandler) triggerTraining(c *fiber.Ctx) error {
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"accepted": true,
		"message":  "LoRA training triggers automatically after the inference threshold is reached. Check /v1/lora/status for current training state.",
	})
}

func (h *loraProxyHandler) proxyGET(c *fiber.Ctx, path string) error {
	req, err := http.NewRequestWithContext(
		c.UserContext(),
		http.MethodGet,
		h.runtimeURL+path,
		nil,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create proxy request",
		})
	}
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		// Runtime unreachable — return a degraded status so the console
		// can display "runtime offline" rather than a hard error.
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"enabled":       false,
			"runtime_error": "runtime unreachable: " + err.Error(),
		})
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "failed to read runtime response",
		})
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"enabled":       false,
			"runtime_error": fmt.Sprintf("runtime returned HTTP %d — check RUNTIME_URL configuration", resp.StatusCode),
		})
	}
	c.Set("Content-Type", "application/json")
	return c.Status(fiber.StatusOK).Send(body)
}
