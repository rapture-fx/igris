package handlers

import (
	"database/sql"
	"encoding/json"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/models"
)

// PreferencesHandler handles customer routing preferences operations
type PreferencesHandler struct {
	db     *sql.DB
	logger *log.Logger
}

// NewPreferencesHandler creates a new preferences handler
func NewPreferencesHandler(db *sql.DB) *PreferencesHandler {
	return &PreferencesHandler{
		db:     db,
		logger: log.Default(),
	}
}

// GetPreferencesRequest represents the request to get routing preferences
type GetPreferencesResponse struct {
	TenantID         string                     `json:"tenant_id"`
	OptimizationMode models.OptimizationMode    `json:"optimization_mode"`
	LatencyWeight    *float64                   `json:"latency_weight,omitempty"`
	QualityWeight    *float64                   `json:"quality_weight,omitempty"`
	CostWeight       *float64                   `json:"cost_weight,omitempty"`
	MaxCostPerRequest *float64                  `json:"max_cost_per_request,omitempty"`
	MinQualityScore  *float64                   `json:"min_quality_score,omitempty"`
	MaxLatencyMs     *int                       `json:"max_latency_ms,omitempty"`
	DomainPreferences models.DomainPreferenceMap `json:"domain_preferences,omitempty"`
}

// UpdatePreferencesRequest represents the request to update routing preferences
type UpdatePreferencesRequest struct {
	OptimizationMode  models.OptimizationMode    `json:"optimization_mode"`
	LatencyWeight     *float64                   `json:"latency_weight,omitempty"`
	QualityWeight     *float64                   `json:"quality_weight,omitempty"`
	CostWeight        *float64                   `json:"cost_weight,omitempty"`
	MaxCostPerRequest *float64                   `json:"max_cost_per_request,omitempty"`
	MinQualityScore   *float64                   `json:"min_quality_score,omitempty"`
	MaxLatencyMs      *int                       `json:"max_latency_ms,omitempty"`
	DomainPreferences models.DomainPreferenceMap `json:"domain_preferences,omitempty"`
}

// GetPreferences retrieves routing preferences for the authenticated tenant
// GET /v1/preferences/routing
func (h *PreferencesHandler) GetPreferences(c *fiber.Ctx) error {
	// Extract tenant ID from context (set by auth middleware)
	tenantID := c.Locals("tenant_id")
	if tenantID == nil || tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing tenant_id in request context",
			"code":  "UNAUTHORIZED",
		})
	}

	tenantIDStr := tenantID.(string)

	// Query preferences from database
	prefs, err := h.getPreferencesFromDB(tenantIDStr)
	if err != nil {
		if err == sql.ErrNoRows {
			// No preferences found, return defaults
			defaultPrefs := models.GetDefaultPreferences(tenantIDStr)
			return c.JSON(convertToResponse(defaultPrefs))
		}

		h.logger.Printf("Error fetching preferences for tenant %s: %v", tenantIDStr, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch preferences",
			"code":  "DATABASE_ERROR",
		})
	}

	return c.JSON(convertToResponse(prefs))
}

// UpdatePreferences updates routing preferences for the authenticated tenant
// PUT /v1/preferences/routing
func (h *PreferencesHandler) UpdatePreferences(c *fiber.Ctx) error {
	// Extract tenant ID from context
	tenantID := c.Locals("tenant_id")
	if tenantID == nil || tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing tenant_id in request context",
			"code":  "UNAUTHORIZED",
		})
	}

	tenantIDStr := tenantID.(string)

	// Parse request
	var req UpdatePreferencesRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Build preferences object
	prefs := &models.CustomerRoutingPreferences{
		TenantID:          tenantIDStr,
		OptimizationMode:  req.OptimizationMode,
		LatencyWeight:     req.LatencyWeight,
		QualityWeight:     req.QualityWeight,
		CostWeight:        req.CostWeight,
		MaxCostPerRequest: req.MaxCostPerRequest,
		MinQualityScore:   req.MinQualityScore,
		MaxLatencyMs:      req.MaxLatencyMs,
		DomainPreferences: req.DomainPreferences,
	}

	// Validate preferences
	if err := prefs.Validate(); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
			"code":  "INVALID_PREFERENCES",
		})
	}

	// Update in database
	if err := h.upsertPreferencesInDB(prefs); err != nil {
		h.logger.Printf("Error updating preferences for tenant %s: %v", tenantIDStr, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update preferences",
			"code":  "DATABASE_ERROR",
		})
	}

	// Return updated preferences
	return c.JSON(convertToResponse(prefs))
}

// getPreferencesFromDB retrieves preferences from the database
func (h *PreferencesHandler) getPreferencesFromDB(tenantID string) (*models.CustomerRoutingPreferences, error) {
	query := `
		SELECT
			tenant_id,
			optimization_mode,
			latency_weight,
			quality_weight,
			cost_weight,
			max_cost_per_request,
			min_quality_score,
			max_latency_ms,
			domain_preferences,
			created_at,
			updated_at
		FROM customer_routing_preferences
		WHERE tenant_id = $1
	`

	prefs := &models.CustomerRoutingPreferences{}
	var domainPrefsJSON []byte

	err := h.db.QueryRow(query, tenantID).Scan(
		&prefs.TenantID,
		&prefs.OptimizationMode,
		&prefs.LatencyWeight,
		&prefs.QualityWeight,
		&prefs.CostWeight,
		&prefs.MaxCostPerRequest,
		&prefs.MinQualityScore,
		&prefs.MaxLatencyMs,
		&domainPrefsJSON,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Parse domain preferences JSON
	if len(domainPrefsJSON) > 0 {
		var domainPrefs models.DomainPreferenceMap
		if err := json.Unmarshal(domainPrefsJSON, &domainPrefs); err != nil {
			h.logger.Printf("Warning: Failed to parse domain preferences JSON: %v", err)
			prefs.DomainPreferences = make(models.DomainPreferenceMap)
		} else {
			prefs.DomainPreferences = domainPrefs
		}
	} else {
		prefs.DomainPreferences = make(models.DomainPreferenceMap)
	}

	return prefs, nil
}

// upsertPreferencesInDB inserts or updates preferences in the database
func (h *PreferencesHandler) upsertPreferencesInDB(prefs *models.CustomerRoutingPreferences) error {
	// Marshal domain preferences to JSON
	var domainPrefsJSON []byte
	var err error
	if prefs.DomainPreferences != nil && len(prefs.DomainPreferences) > 0 {
		domainPrefsJSON, err = json.Marshal(prefs.DomainPreferences)
		if err != nil {
			return err
		}
	} else {
		domainPrefsJSON = []byte("{}")
	}

	query := `
		INSERT INTO customer_routing_preferences (
			tenant_id,
			optimization_mode,
			latency_weight,
			quality_weight,
			cost_weight,
			max_cost_per_request,
			min_quality_score,
			max_latency_ms,
			domain_preferences
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (tenant_id) DO UPDATE SET
			optimization_mode = EXCLUDED.optimization_mode,
			latency_weight = EXCLUDED.latency_weight,
			quality_weight = EXCLUDED.quality_weight,
			cost_weight = EXCLUDED.cost_weight,
			max_cost_per_request = EXCLUDED.max_cost_per_request,
			min_quality_score = EXCLUDED.min_quality_score,
			max_latency_ms = EXCLUDED.max_latency_ms,
			domain_preferences = EXCLUDED.domain_preferences,
			updated_at = NOW()
	`

	_, err = h.db.Exec(
		query,
		prefs.TenantID,
		prefs.OptimizationMode,
		prefs.LatencyWeight,
		prefs.QualityWeight,
		prefs.CostWeight,
		prefs.MaxCostPerRequest,
		prefs.MinQualityScore,
		prefs.MaxLatencyMs,
		domainPrefsJSON,
	)

	return err
}

// convertToResponse converts internal model to API response
func convertToResponse(prefs *models.CustomerRoutingPreferences) GetPreferencesResponse {
	return GetPreferencesResponse{
		TenantID:          prefs.TenantID,
		OptimizationMode:  prefs.OptimizationMode,
		LatencyWeight:     prefs.LatencyWeight,
		QualityWeight:     prefs.QualityWeight,
		CostWeight:        prefs.CostWeight,
		MaxCostPerRequest: prefs.MaxCostPerRequest,
		MinQualityScore:   prefs.MinQualityScore,
		MaxLatencyMs:      prefs.MaxLatencyMs,
		DomainPreferences: prefs.DomainPreferences,
	}
}

// GetRoutingPreferences is a helper function to get preferences from DB with caching support
func GetRoutingPreferences(db *sql.DB, tenantID string) (*models.CustomerRoutingPreferences, error) {
	handler := NewPreferencesHandler(db)
	prefs, err := handler.getPreferencesFromDB(tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return defaults if not found
			return models.GetDefaultPreferences(tenantID), nil
		}
		return nil, err
	}
	return prefs, nil
}
