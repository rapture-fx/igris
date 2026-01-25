package api

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/shadow"
)

// AdminOptimizerHandler handles admin API requests for optimizer configuration
type AdminOptimizerHandler struct {
	shadowRunner *shadow.ShadowRunner
	runtimeConfig *config.RuntimeOptimizerConfig
}

// OptimizerUpdateRequest represents the request body for updating optimizer config
type OptimizerUpdateRequest struct {
	Mode       string  `json:"mode"`        // "go", "shadow", "rust"
	SampleRate float64 `json:"sample_rate"` // 0.0 to 1.0
}

// OptimizerUpdateResponse represents the response body for optimizer updates
type OptimizerUpdateResponse struct {
	Status      string    `json:"status"`
	CurrentMode string    `json:"current_mode"`
	SampleRate  float64   `json:"sample_rate"`
	Timestamp   time.Time `json:"timestamp"`
}

// NewAdminOptimizerHandler creates a new admin optimizer handler
func NewAdminOptimizerHandler(runner *shadow.ShadowRunner) *AdminOptimizerHandler {
	return &AdminOptimizerHandler{
		shadowRunner:  runner,
		runtimeConfig: config.GetRuntimeConfig(),
	}
}

// HandleOptimizerUpdate handles POST /admin/optimizer
func (h *AdminOptimizerHandler) HandleOptimizerUpdate(c *fiber.Ctx) error {
	// Authentication check
	adminToken := c.Get("X-Admin-Token")
	if adminToken == "" {
		log.Printf("[Admin API] Missing X-Admin-Token header")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Missing X-Admin-Token header",
				"type":    "authentication_error",
			},
		})
	}

	// Verify admin token
	expectedToken := h.runtimeConfig.GetAdminToken()
	if expectedToken == "" {
		log.Printf("[Admin API] Admin token not configured (set ADMIN_TOKEN env var)")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Admin API is disabled (ADMIN_TOKEN not configured)",
				"type":    "configuration_error",
			},
		})
	}

	if adminToken != expectedToken {
		log.Printf("[Admin API] Invalid admin token provided")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid admin token",
				"type":    "authentication_error",
			},
		})
	}

	// Parse request body
	var req OptimizerUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		log.Printf("[Admin API] Failed to parse request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
			},
		})
	}

	// Validate and apply mode change if provided
	if req.Mode != "" {
		mode := shadow.ShadowMode(req.Mode)

		// Validate mode
		switch mode {
		case shadow.ShadowModeGo, shadow.ShadowModeShadow, shadow.ShadowModeRust:
			// Valid modes
		default:
			log.Printf("[Admin API] Invalid mode: %s", req.Mode)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": map[string]interface{}{
					"message": fmt.Sprintf("Invalid mode '%s'. Must be 'go', 'shadow', or 'rust'", req.Mode),
					"type":    "invalid_request_error",
				},
			})
		}

		// Apply mode change
		h.runtimeConfig.SetMode(mode)
		if h.shadowRunner != nil {
			h.shadowRunner.SetMode(mode)
		}

		log.Printf("[Admin API] Optimizer mode changed to: %s", mode)
	}

	// Validate and apply sample rate change if provided
	if req.SampleRate >= 0 {
		if req.SampleRate < 0 || req.SampleRate > 1 {
			log.Printf("[Admin API] Invalid sample rate: %f", req.SampleRate)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": map[string]interface{}{
					"message": "sample_rate must be between 0.0 and 1.0",
					"type":    "invalid_request_error",
				},
			})
		}

		// Apply sample rate change
		h.runtimeConfig.SetSampleRate(req.SampleRate)
		if h.shadowRunner != nil {
			h.shadowRunner.SetSampleRate(req.SampleRate)
		}

		log.Printf("[Admin API] Optimizer sample rate changed to: %.4f", req.SampleRate)
	}

	// Return current configuration
	currentMode := h.runtimeConfig.GetMode()
	currentSampleRate := h.runtimeConfig.GetSampleRate()

	response := OptimizerUpdateResponse{
		Status:      "ok",
		CurrentMode: string(currentMode),
		SampleRate:  currentSampleRate,
		Timestamp:   time.Now(),
	}

	log.Printf("[Admin API] Configuration updated successfully: mode=%s, sample_rate=%.4f",
		currentMode, currentSampleRate)

	return c.JSON(response)
}

// HandleOptimizerStatus handles GET /admin/optimizer/status
func (h *AdminOptimizerHandler) HandleOptimizerStatus(c *fiber.Ctx) error {
	// Authentication check
	adminToken := c.Get("X-Admin-Token")
	if adminToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Missing X-Admin-Token header",
				"type":    "authentication_error",
			},
		})
	}

	// Verify admin token
	expectedToken := h.runtimeConfig.GetAdminToken()
	if expectedToken == "" || adminToken != expectedToken {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid admin token",
				"type":    "authentication_error",
			},
		})
	}

	// Get current configuration
	currentMode := h.runtimeConfig.GetMode()
	currentSampleRate := h.runtimeConfig.GetSampleRate()
	updatedAt := h.runtimeConfig.GetUpdatedAt()

	// Get optimizer stats if available
	var armStats []map[string]interface{}
	if h.shadowRunner != nil {
		if stats, err := h.shadowRunner.GetStats(); err == nil {
			for _, stat := range stats {
				armStats = append(armStats, map[string]interface{}{
					"action_id": stat.ActionID,
					"alpha":     stat.Alpha,
					"beta":      stat.Beta,
					"mean":      stat.BetaMean,
				})
			}
		}
	}

	return c.JSON(fiber.Map{
		"status":      "ok",
		"current_mode": string(currentMode),
		"sample_rate": currentSampleRate,
		"updated_at":  updatedAt,
		"timestamp":   time.Now(),
		"arm_stats":   armStats,
	})
}
