// Package api provides frontend-facing API endpoints consumed by the web-console.
//
// This file implements all endpoints that the web-console needs but were either
// missing from the backend or registered under the wrong path prefix:
//
//	Priority 1 — GET /v1/tenants/current
//	Priority 2 — GET /v1/usage/summary
//	Priority 3 — /v1/cognitive/* aliases for /api/v1/cognitive/*
//	Priority 4 — GET /v1/analytics/cost, /cost/providers, /cost/trend
//	             GET /v1/routing/stats (already exists), /leaderboard (already exists)
//	             GET /v1/audit (already exists in routes_tenancy.go)
//	Priority 5 — GET /v1/routing/speculative/races
//	Priority 6 — Shadow, Council, EscapeVector endpoints
package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/cognitive"
	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
)

// ============================================================================
// REGISTRATION
// ============================================================================

// RegisterFrontendRoutes wires up every endpoint consumed by the web-console
// that was previously missing or mis-routed. Call this once from main.go after
// the database is available.
func RegisterFrontendRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Println("[Routes] RegisterFrontendRoutes: database nil — frontend routes disabled")
		return
	}

	RegisterProjectRoutes(app, db)

	// Priority 1: GET /v1/tenants/current is now registered inside
	// RegisterTenancyRoutes (routes_tenancy.go) BEFORE the /:tenant_id
	// parameterized route so Fiber matches the literal path correctly.
	// No additional registration needed here.

	// Priority 2: GET /v1/usage/summary is already registered by RegisterStatsRoutes.
	// No additional registration needed here.

	if ExperimentalCognitiveRoutesEnabled() {
		// ── Priority 3: /v1/cognitive/* aliases ──────────────────────────────
		cogGroup := app.Group("/v1/cognitive")
		cogGroup.Use(middleware.BetterAuth(db))
		cogGroup.Get("/status", makeGetCognitiveStatus(db))
	}

	if ExperimentalRoutingRoutesEnabled() {
		// ── Priority 5: GET /v1/routing/speculative/races ─────────────────────
		specGroup := app.Group("/v1/routing")
		specGroup.Use(middleware.BetterAuth(db))
		specGroup.Get("/speculative/races", makeGetSpeculativeRaces(db))

		// ── Priority 6a: Shadow endpoints ────────────────────────────────────
		shadowGroup := app.Group("/v1/shadow")
		shadowGroup.Use(middleware.BetterAuth(db))
		shadowGroup.Get("/status", makeGetShadowStatus(db))
		shadowGroup.Get("/config", makeGetShadowConfig(db))
		shadowGroup.Patch("/config", makePatchShadowConfig(db))
		shadowGroup.Get("/analytics", makeGetShadowAnalytics(db))
		shadowGroup.Get("/logs", makeGetShadowLogs(db))
		shadowGroup.Post("/start", makePostShadowToggle(db, true))
		shadowGroup.Post("/stop", makePostShadowToggle(db, false))
		shadowGroup.Post("/promote", makePostShadowPromote(db))

		// ── Priority 6b: Council endpoints ───────────────────────────────────
		councilGroup := app.Group("/v1/council")
		councilGroup.Use(middleware.BetterAuth(db))
		councilGroup.Get("/status", makeGetCouncilStatus(db))
		councilGroup.Get("/config", makeGetCouncilConfig(db))
		councilGroup.Patch("/config", makePatchCouncilConfig(db))
		councilGroup.Get("/analytics", makeGetCouncilAnalytics(db))
		councilGroup.Get("/history", makeGetCouncilHistory(db))
		councilGroup.Post("/test", makePostCouncilTest(db))

		// ── Priority 6c: EscapeVector endpoints ──────────────────────────────
		evGroup := app.Group("/v1/escapevector")
		evGroup.Use(middleware.BetterAuth(db))
		evGroup.Get("/status", makeGetEscapeVectorStatus(db))
		evGroup.Get("/config", makeGetEscapeVectorConfig(db))
		evGroup.Patch("/config", makePatchEscapeVectorConfig(db))
		evGroup.Get("/history", makeGetEscapeVectorHistory(db))
		evGroup.Get("/analytics", makeGetEscapeVectorAnalytics(db))
		evGroup.Post("/refresh", makePostEscapeVectorRefresh(db))
		evGroup.Delete("/cache", makeDeleteEscapeVectorCache(db))
	}

	if ExperimentalConsoleGapRoutesEnabled() {
		// ── Priority 4: Analytics cost endpoints ─────────────────────────────
		analyticsGroup := app.Group("/v1/analytics")
		analyticsGroup.Use(middleware.BetterAuth(db))
		analyticsGroup.Get("/cost", makeGetCostAnalytics(db))
		analyticsGroup.Get("/cost/providers", makeGetCostProviders(db))
		analyticsGroup.Get("/cost/trend", makeGetCostTrend(db))
	}

	log.Println("[Routes] ✓ Registered frontend routes:")
	log.Println("[Routes]   Project:  GET+PATCH /v1/project     (project identity)")
	if ExperimentalCognitiveRoutesEnabled() {
		log.Println("[Routes]   Cognitive: GET /v1/cognitive/status")
	}
	if ExperimentalRoutingRoutesEnabled() {
		log.Println("[Routes]   Routing experiments: /v1/routing/speculative/races, /v1/shadow/*, /v1/council/*, /v1/escapevector/*")
	}
	if ExperimentalConsoleGapRoutesEnabled() {
		log.Println("[Routes]   Console gap analytics: /v1/analytics/cost, /cost/providers, /cost/trend")
	}
}

// RegisterCognitiveV1Aliases adds /v1/cognitive/* aliases pointing at the same
// handlers as /api/v1/cognitive/*.  Call this only when the cognitive advisor
// is enabled so we can pass the applier and db through.
func RegisterCognitiveV1Aliases(app *fiber.App, applier *cognitive.Applier, db *database.DB) {
	handler := NewCognitiveHandlerWithDB(applier, db)

	v1 := app.Group("/v1/cognitive")
	v1.Use(middleware.BetterAuth(db.DB))

	v1.Get("/proposals", handler.V1ListProposals)
	v1.Get("/proposals/:id", handler.V1GetProposal)
	v1.Post("/proposals/:id/apply", handler.V1ApplyProposal)
	v1.Get("/config", handler.GetAutoApplyConfig)
	v1.Put("/config", handler.UpdateAutoApplyConfig)
	v1.Patch("/config", handler.PatchAutoApplyConfig)

	log.Println("[Routes] ✓ Registered /v1/cognitive/* aliases for cognitive advisor")
}

// ============================================================================
// PRIORITY 1 — GET /v1/tenants/current
// ============================================================================

// CurrentTenantResponse mirrors TenantResponse but also exposes trial / tier
// fields that the console dashboard needs.
type CurrentTenantResponse struct {
	TenantID           string  `json:"tenant_id"`
	TenantName         string  `json:"tenant_name"`
	Email              string  `json:"email,omitempty"`
	Company            string  `json:"company,omitempty"`
	Status             string  `json:"status"`
	Tier               string  `json:"tier"`
	APIKeyPrefix       string  `json:"api_key_prefix,omitempty"`
	RuntimeLimit       int     `json:"runtime_limit"`
	CreatedAt          string  `json:"created_at"`
	TrialActive        bool    `json:"trial_active"`
	TrialTier          *string `json:"trial_tier,omitempty"`
	TrialEndsAt        *string `json:"trial_ends_at,omitempty"`
	SubscriptionStatus string  `json:"subscription_status"`
}

func makeGetCurrentTenant(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// The Clerk JWT sub claim is the tenant identifier in the tenants table.
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "MISSING_CLERK_USER_ID",
			})
		}

		var resp CurrentTenantResponse
		var company, email, tier, apiKeyPrefix sql.NullString
		var trialTier, trialEndsAt, subscriptionStatus sql.NullString
		var trialActive sql.NullBool
		var runtimeLimit sql.NullInt64

		err := db.QueryRow(`
			SELECT
				tenant_id,
				tenant_name,
				COALESCE(tenant_email, ''),
				company,
				status,
				COALESCE(tier::text, 'seed'),
				api_key_prefix,
				COALESCE(runtime_limit, 3),
				created_at,
				COALESCE(trial_active, false),
				trial_tier,
				trial_ends_at,
				COALESCE(subscription_status, 'none')
			FROM tenants
			WHERE tenant_id = $1
		`, clerkUserID).Scan(
			&resp.TenantID,
			&resp.TenantName,
			&resp.Email,
			&company,
			&resp.Status,
			&resp.Tier,
			&apiKeyPrefix,
			&runtimeLimit,
			&resp.CreatedAt,
			&trialActive,
			&trialTier,
			&trialEndsAt,
			&subscriptionStatus,
		)

		if err == sql.ErrNoRows {
			// Tenant not provisioned yet — return a minimal "new account" response
			// so the console can render without crashing.
			return c.JSON(&CurrentTenantResponse{
				TenantID:           clerkUserID,
				TenantName:         middleware.GetClerkEmail(c),
				Email:              middleware.GetClerkEmail(c),
				Status:             "active",
				Tier:               "seed",
				RuntimeLimit:       3,
				SubscriptionStatus: "none",
			})
		}
		if err != nil {
			log.Printf("[Frontend] GetCurrentTenant DB error for %s: %v", clerkUserID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed_to_retrieve_tenant",
				"code":  "DB_ERROR",
			})
		}

		// If tenant_name is empty in DB (e.g. OAuth user created before name backfill),
		// fall back to the name stored in Better Auth's user table (set by middleware).
		if resp.TenantName == "" {
			if tc, ok := c.Locals("tenant").(*middleware.TenantContext); ok && tc != nil && tc.TenantName != "" {
				resp.TenantName = tc.TenantName
			} else if e := middleware.GetClerkEmail(c); e != "" {
				// Last resort: use email prefix
				if idx := len(e); idx > 0 {
					for i, ch := range e {
						if ch == '@' {
							resp.TenantName = e[:i]
							break
						}
					}
				}
			}
		}
		if company.Valid {
			resp.Company = company.String
		}
		if email.Valid && resp.Email == "" {
			resp.Email = email.String
		}
		if tier.Valid {
			resp.Tier = tier.String
		}
		if apiKeyPrefix.Valid {
			resp.APIKeyPrefix = apiKeyPrefix.String
		}
		if runtimeLimit.Valid {
			resp.RuntimeLimit = int(runtimeLimit.Int64)
		} else {
			resp.RuntimeLimit = 3
		}
		if trialActive.Valid {
			resp.TrialActive = trialActive.Bool
		}
		if trialTier.Valid {
			s := trialTier.String
			resp.TrialTier = &s
		}
		if trialEndsAt.Valid {
			s := trialEndsAt.String
			resp.TrialEndsAt = &s
		}
		if subscriptionStatus.Valid {
			resp.SubscriptionStatus = subscriptionStatus.String
		}

		return c.JSON(&resp)
	}
}

// ============================================================================
// PROJECT — tenant-scoped project identity (GET + PATCH /v1/project)
// ============================================================================

// RegisterProjectRoutes mounts the tenant-scoped project-identity endpoints.
// Split out from RegisterFrontendRoutes so it can be mounted in isolation by
// tests (mirrors RegisterRuntimeAPIKeyRoutes). The "project" is the user-facing
// name for the tenant — it reads/writes only the tenants.tenant_name column.
func RegisterProjectRoutes(app *fiber.App, db *sql.DB) {
	projectGroup := app.Group("/v1/project")
	projectGroup.Use(middleware.BetterAuth(db))
	projectGroup.Get("/", makeGetProject(db))
	projectGroup.Patch("/", makePatchProject(db))
}

type ProjectResponse struct {
	Name string `json:"name"`
}

// validProjectName trims and validates a user-facing project name. It returns
// the trimmed name and an empty reason on success, or ("", reasonCode) on
// failure. The character allow-list deliberately excludes '<', '>', '/', and
// '=', so HTML/script fragments are rejected outright.
func validProjectName(raw string) (string, string) {
	name := strings.TrimSpace(raw)
	if len(name) < 2 || len(name) > 80 {
		return "", "INVALID_NAME_LENGTH"
	}
	for _, r := range name {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == ' ' || r == '-' ||
			r == '_' || r == '\'' || r == '.' || r == '&' || r == ',') {
			return "", "INVALID_NAME_CHARS"
		}
	}
	return name, ""
}

func makeGetProject(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "MISSING_CLERK_USER_ID",
			})
		}

		var tenantName sql.NullString
		err := db.QueryRow(`
			SELECT tenant_name
			FROM tenants
			WHERE tenant_id = $1
		`, clerkUserID).Scan(&tenantName)

		if err == sql.ErrNoRows {
			return c.JSON(&ProjectResponse{Name: ""})
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed_to_retrieve_project",
				"code":  "DB_ERROR",
			})
		}

		return c.JSON(&ProjectResponse{Name: tenantName.String})
	}
}

// ============================================================================
// PROJECT — PATCH /v1/project
// ============================================================================

func makePatchProject(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "MISSING_CLERK_USER_ID",
			})
		}

		var req struct {
			Name string `json:"name"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid_request",
				"code":  "INVALID_JSON",
			})
		}

		name, reason := validProjectName(req.Name)
		switch reason {
		case "INVALID_NAME_LENGTH":
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Project name must be between 2 and 80 characters.",
				"code":  reason,
			})
		case "INVALID_NAME_CHARS":
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Project name may only contain letters, numbers, spaces, hyphens, underscores, apostrophes, periods, ampersands, and commas.",
				"code":  reason,
			})
		}

		result, err := db.Exec(`
			UPDATE tenants
			SET tenant_name = $2
			WHERE tenant_id = $1
		`, clerkUserID, name)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed_to_update_project",
				"code":  "DB_ERROR",
			})
		}

		n, _ := result.RowsAffected()
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "tenant_not_found",
				"code":  "TENANT_NOT_FOUND",
			})
		}

		return c.JSON(&ProjectResponse{Name: name})
	}
}

// ============================================================================
// PRIORITY 2 — GET /v1/usage/summary
// ============================================================================

// ============================================================================
// PRIORITY 3 — GET /v1/cognitive/status
// ============================================================================

func makeGetCognitiveStatus(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			tenantID = middleware.GetTenantID(c)
		}

		// Count how many proposals exist for this tenant to determine activity
		var proposalCount int
		_ = db.QueryRow(`
			SELECT COUNT(*) FROM cognitive_proposals WHERE tenant_id = $1
		`, tenantID).Scan(&proposalCount)

		return c.JSON(fiber.Map{
			"enabled":            true,
			"proposal_count":     proposalCount,
			"auto_apply_enabled": false,
			"last_run":           nil,
			"tenant_id":          tenantID,
		})
	}
}

// ============================================================================
// PRIORITY 5 — GET /v1/routing/speculative/races
// ============================================================================

func makeGetSpeculativeRaces(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		limit := c.QueryInt("limit", 50)
		if limit > 200 {
			limit = 200
		}

		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			tenantID = middleware.GetTenantID(c)
		}

		type RaceEntry struct {
			ID                   string   `json:"id"`
			CreatedAt            string   `json:"created_at"`
			Winner               *string  `json:"winner"`
			Providers            []string `json:"providers"`
			LatencyImprovementMs int      `json:"latency_improvement_ms"`
			CostDeltaPercent     float64  `json:"cost_delta_percent"`
		}

		var races []RaceEntry

		rows, err := db.Query(`
			SELECT id, created_at, winner,
			       COALESCE(latency_improvement_ms, 0),
			       COALESCE(cost_delta_percent, 0)
			FROM routing_telemetry
			WHERE tenant_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, tenantID, limit)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r RaceEntry
				var winner sql.NullString
				var ts time.Time
				if scanErr := rows.Scan(&r.ID, &ts, &winner,
					&r.LatencyImprovementMs, &r.CostDeltaPercent); scanErr != nil {
					continue
				}
				r.CreatedAt = ts.Format(time.RFC3339)
				if winner.Valid {
					r.Winner = &winner.String
				}
				r.Providers = []string{}
				races = append(races, r)
			}
		}
		// If table doesn't exist or no rows, return empty list — not an error.

		if races == nil {
			races = []RaceEntry{}
		}

		return c.JSON(fiber.Map{
			"races": races,
			"count": len(races),
		})
	}
}

// ============================================================================
// PRIORITY 6a — Shadow endpoints
// ============================================================================

// shadowConfigKey is used to persist shadow config per-tenant in the
// policy_settings table (jsonb metadata column).
const shadowConfigKey = "shadow_mode_config"

func makeGetShadowStatus(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		var enabled bool
		var shadowPercent int
		var requests24h int
		var qualityDelta float64
		var discrepancies int
		var lastUpdated = time.Now().Format(time.RFC3339)

		// Try to pull aggregate from shadow_comparisons table
		err := db.QueryRow(`
			SELECT
				COUNT(*),
				COALESCE(AVG(quality_delta), 0),
				COUNT(*) FILTER (WHERE discrepancy IS NOT NULL AND discrepancy != '')
			FROM shadow_comparisons
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
		`, tenantID).Scan(&requests24h, &qualityDelta, &discrepancies)

		if err == nil && requests24h > 0 {
			enabled = true
		}

		// Read config for shadow_percent
		_ = db.QueryRow(`
			SELECT
				COALESCE((settings->>'shadow_percent')::int, 10),
				COALESCE((settings->>'enabled')::boolean, false)
			FROM policy_settings
			WHERE tenant_id = $1
		`, tenantID).Scan(&shadowPercent, &enabled)

		if shadowPercent == 0 {
			shadowPercent = 10
		}

		return c.JSON(fiber.Map{
			"enabled":                enabled,
			"shadow_traffic_percent": shadowPercent,
			"requests_24h":           requests24h,
			"quality_delta":          qualityDelta,
			"discrepancies_found":    discrepancies,
			"last_updated":           lastUpdated,
		})
	}
}

func makeGetShadowConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		var shadowPercent int
		var primaryProvider, shadowProvider string
		var qualityThreshold float64
		var autoPromote bool
		var autoPromoteThreshold float64
		var enabled bool

		_ = db.QueryRow(`
			SELECT
				COALESCE((settings->>'shadow_percent')::int, 10),
				COALESCE(settings->>'primary_provider', 'openai'),
				COALESCE(settings->>'shadow_provider', 'anthropic'),
				COALESCE((settings->>'quality_threshold')::float, 85),
				COALESCE((settings->>'auto_promote')::boolean, false),
				COALESCE((settings->>'auto_promote_threshold')::float, 95),
				COALESCE((settings->>'enabled')::boolean, false)
			FROM policy_settings
			WHERE tenant_id = $1
		`, tenantID).Scan(
			&shadowPercent, &primaryProvider, &shadowProvider,
			&qualityThreshold, &autoPromote, &autoPromoteThreshold, &enabled,
		)

		if shadowPercent == 0 {
			shadowPercent = 10
		}
		if primaryProvider == "" {
			primaryProvider = "openai"
		}
		if shadowProvider == "" {
			shadowProvider = "anthropic"
		}
		if qualityThreshold == 0 {
			qualityThreshold = 85
		}
		if autoPromoteThreshold == 0 {
			autoPromoteThreshold = 95
		}

		return c.JSON(fiber.Map{
			"enabled":                enabled,
			"shadow_percent":         shadowPercent,
			"primary_provider":       primaryProvider,
			"shadow_provider":        shadowProvider,
			"quality_threshold":      qualityThreshold,
			"auto_promote":           autoPromote,
			"auto_promote_threshold": autoPromoteThreshold,
		})
	}
}

func makePatchShadowConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var req map[string]interface{}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
		}

		// Upsert into policy_settings (merge with existing settings jsonb)
		_, err := db.Exec(`
			INSERT INTO policy_settings (tenant_id, settings, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (tenant_id)
			DO UPDATE SET
				settings   = policy_settings.settings || $2::jsonb,
				updated_at = NOW()
		`, tenantID, marshalJSON(req))

		if err != nil {
			log.Printf("[Frontend] PatchShadowConfig upsert error for %s: %v", tenantID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		return c.JSON(fiber.Map{"status": "updated"})
	}
}

func makeGetShadowAnalytics(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		type latencyPoint struct {
			Timestamp      string  `json:"timestamp"`
			PrimaryLatency float64 `json:"primary_latency"`
			ShadowLatency  float64 `json:"shadow_latency"`
		}
		type costPoint struct {
			Timestamp   string  `json:"timestamp"`
			PrimaryCost float64 `json:"primary_cost"`
			ShadowCost  float64 `json:"shadow_cost"`
		}
		type qualityPoint struct {
			Timestamp      string  `json:"timestamp"`
			PrimaryQuality float64 `json:"primary_quality"`
			ShadowQuality  float64 `json:"shadow_quality"`
		}
		type discrepancyPoint struct {
			Timestamp string  `json:"timestamp"`
			Rate      float64 `json:"rate"`
		}

		var latency []latencyPoint
		var cost []costPoint
		var quality []qualityPoint
		var discrepancy []discrepancyPoint

		rows, err := db.Query(`
			SELECT
				DATE_TRUNC('hour', created_at) AS hour,
				COALESCE(AVG(primary_latency_ms), 0),
				COALESCE(AVG(shadow_latency_ms), 0),
				COALESCE(AVG(primary_cost_usd), 0),
				COALESCE(AVG(shadow_cost_usd), 0),
				COALESCE(AVG(primary_quality), 0),
				COALESCE(AVG(shadow_quality), 0),
				COALESCE(
					100.0 * COUNT(*) FILTER (WHERE discrepancy IS NOT NULL AND discrepancy != '')
					/ NULLIF(COUNT(*), 0), 0
				)
			FROM shadow_comparisons
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
			GROUP BY hour
			ORDER BY hour ASC
		`, tenantID)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var ts time.Time
				var pl, sl, pc, sc, pq, sq, dr float64
				if scanErr := rows.Scan(&ts, &pl, &sl, &pc, &sc, &pq, &sq, &dr); scanErr != nil {
					continue
				}
				tStr := ts.Format(time.RFC3339)
				latency = append(latency, latencyPoint{tStr, pl, sl})
				cost = append(cost, costPoint{tStr, pc, sc})
				quality = append(quality, qualityPoint{tStr, pq, sq})
				discrepancy = append(discrepancy, discrepancyPoint{tStr, dr})
			}
		}

		if latency == nil {
			latency = []latencyPoint{}
		}
		if cost == nil {
			cost = []costPoint{}
		}
		if quality == nil {
			quality = []qualityPoint{}
		}
		if discrepancy == nil {
			discrepancy = []discrepancyPoint{}
		}

		return c.JSON(fiber.Map{
			"latency_comparison": latency,
			"cost_comparison":    cost,
			"quality_comparison": quality,
			"discrepancy_rate":   discrepancy,
		})
	}
}

func makeGetShadowLogs(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		limit := c.QueryInt("limit", 50)
		if limit > 200 {
			limit = 200
		}

		type LogEntry struct {
			RequestID       string  `json:"request_id"`
			Timestamp       string  `json:"timestamp"`
			PrimaryProvider string  `json:"primary_provider"`
			ShadowProvider  string  `json:"shadow_provider"`
			PrimaryLatency  float64 `json:"primary_latency"`
			ShadowLatency   float64 `json:"shadow_latency"`
			PrimaryCost     float64 `json:"primary_cost"`
			ShadowCost      float64 `json:"shadow_cost"`
			QualityMatch    bool    `json:"quality_match"`
			Discrepancy     *string `json:"discrepancy"`
		}

		var entries []LogEntry

		rows, err := db.Query(`
			SELECT
				COALESCE(request_id, id::text),
				created_at,
				COALESCE(primary_provider, ''),
				COALESCE(shadow_provider, ''),
				COALESCE(primary_latency_ms, 0),
				COALESCE(shadow_latency_ms, 0),
				COALESCE(primary_cost_usd, 0),
				COALESCE(shadow_cost_usd, 0),
				COALESCE(quality_match, true),
				discrepancy
			FROM shadow_comparisons
			WHERE tenant_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, tenantID, limit)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e LogEntry
				var ts time.Time
				var discrepancy sql.NullString
				if scanErr := rows.Scan(
					&e.RequestID, &ts,
					&e.PrimaryProvider, &e.ShadowProvider,
					&e.PrimaryLatency, &e.ShadowLatency,
					&e.PrimaryCost, &e.ShadowCost,
					&e.QualityMatch, &discrepancy,
				); scanErr != nil {
					continue
				}
				e.Timestamp = ts.Format(time.RFC3339)
				if discrepancy.Valid && discrepancy.String != "" {
					e.Discrepancy = &discrepancy.String
				}
				entries = append(entries, e)
			}
		}

		if entries == nil {
			entries = []LogEntry{}
		}

		return c.JSON(entries)
	}
}

func makePostShadowToggle(db *sql.DB, enable bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		enabledStr := "false"
		if enable {
			enabledStr = "true"
		}

		_, _ = db.Exec(`
			INSERT INTO policy_settings (tenant_id, settings, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (tenant_id) DO UPDATE SET
				settings   = policy_settings.settings || $2::jsonb,
				updated_at = NOW()
		`, tenantID, `{"enabled":`+enabledStr+`}`)

		status := "stopped"
		if enable {
			status = "started"
		}
		return c.JSON(fiber.Map{"status": status})
	}
}

func makePostShadowPromote(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		// Swap primary and shadow providers in the config
		_, _ = db.Exec(`
			UPDATE policy_settings
			SET settings = settings ||
				jsonb_build_object(
					'primary_provider', COALESCE(settings->>'shadow_provider', 'anthropic'),
					'shadow_provider',  COALESCE(settings->>'primary_provider', 'openai')
				),
				updated_at = NOW()
			WHERE tenant_id = $1
		`, tenantID)

		return c.JSON(fiber.Map{"status": "promoted"})
	}
}

// ============================================================================
// PRIORITY 6b — Council endpoints
// ============================================================================

func makeGetCouncilStatus(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		var councilSize int
		var qualityImprovement float64
		var costOverhead24h float64
		var lastRunAt *string
		var lastRunSummary = "No runs yet"

		_ = db.QueryRow(`
			SELECT
				COALESCE(AVG(council_size), 0),
				COALESCE(AVG(quality_improvement_pct), 0),
				COALESCE(SUM(cost_usd), 0),
				MAX(created_at)
			FROM council_performance
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
		`, tenantID).Scan(&councilSize, &qualityImprovement, &costOverhead24h, &lastRunAt)

		enabled := councilSize > 0

		var lastRun fiber.Map
		if lastRunAt != nil && *lastRunAt != "" {
			lastRun = fiber.Map{
				"timestamp": *lastRunAt,
				"summary":   lastRunSummary,
			}
		} else {
			lastRun = fiber.Map{
				"timestamp": time.Now().Format(time.RFC3339),
				"summary":   "No council runs recorded yet",
			}
		}

		return c.JSON(fiber.Map{
			"enabled":                 enabled,
			"current_council_size":    councilSize,
			"avg_quality_improvement": qualityImprovement,
			"cost_overhead_24h":       costOverhead24h,
			"last_run":                lastRun,
		})
	}
}

func makeGetCouncilConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		var numModels int
		var votingStrategy, chairmanModel, modelsJSON string
		var qualityThreshold, costLimit float64
		var maxTokens int
		var enabled bool

		_ = db.QueryRow(`
			SELECT
				COALESCE((settings->>'council_num_models')::int, 3),
				COALESCE(settings->>'council_voting_strategy', 'majority'),
				COALESCE((settings->>'council_quality_threshold')::float, 85),
				COALESCE((settings->>'council_max_tokens')::int, 2000),
				COALESCE((settings->>'council_cost_limit')::float, 0.5),
				COALESCE((settings->>'council_enabled')::boolean, false),
				COALESCE(settings->>'council_chairman_model', ''),
				COALESCE((settings->'council_models')::text, '[]')
			FROM policy_settings
			WHERE tenant_id = $1
		`, tenantID).Scan(
			&numModels, &votingStrategy, &qualityThreshold,
			&maxTokens, &costLimit, &enabled, &chairmanModel, &modelsJSON,
		)

		models := []string{}
		if modelsJSON != "" {
			_ = json.Unmarshal([]byte(modelsJSON), &models)
		}

		if numModels == 0 {
			numModels = 3
		}
		if votingStrategy == "" {
			votingStrategy = "majority"
		}
		if qualityThreshold == 0 {
			qualityThreshold = 85
		}
		if maxTokens == 0 {
			maxTokens = 2000
		}
		if costLimit == 0 {
			costLimit = 0.5
		}

		resp := fiber.Map{
			"enabled":           enabled,
			"num_models":        numModels,
			"models":            models,
			"voting_strategy":   votingStrategy,
			"quality_threshold": qualityThreshold,
			"max_tokens":        maxTokens,
			"cost_limit":        costLimit,
		}
		if chairmanModel != "" {
			resp["chairman_model"] = chairmanModel
		}

		return c.JSON(resp)
	}
}

func makePatchCouncilConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var req map[string]interface{}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
		}

		// Prefix all keys with "council_" to namespace in the shared settings jsonb
		prefixed := make(map[string]interface{})
		for k, v := range req {
			prefixed["council_"+k] = v
		}

		_, err := db.Exec(`
			INSERT INTO policy_settings (tenant_id, settings, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (tenant_id) DO UPDATE SET
				settings   = policy_settings.settings || $2::jsonb,
				updated_at = NOW()
		`, tenantID, marshalJSON(prefixed))

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		return c.JSON(fiber.Map{"status": "updated"})
	}
}

func makeGetCouncilAnalytics(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		type qualityDeltaPoint struct {
			Timestamp string  `json:"timestamp"`
			Council   float64 `json:"council"`
			Single    float64 `json:"single"`
			Delta     float64 `json:"delta"`
		}
		type latencyOverhead struct {
			ModelCount   int     `json:"model_count"`
			AvgLatencyMs float64 `json:"avg_latency_ms"`
		}
		type modelWinRate struct {
			Model   string  `json:"model"`
			Wins    int     `json:"wins"`
			Total   int     `json:"total"`
			WinRate float64 `json:"win_rate"`
		}

		var qualityDelta []qualityDeltaPoint
		var modelWinRates []modelWinRate

		rows, err := db.Query(`
			SELECT
				DATE_TRUNC('hour', created_at) AS hour,
				COALESCE(AVG(council_quality_score), 0),
				COALESCE(AVG(single_quality_score), 0),
				COALESCE(AVG(quality_improvement_pct), 0)
			FROM council_performance
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
			GROUP BY hour ORDER BY hour ASC
		`, tenantID)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var ts time.Time
				var c, s, d float64
				if scanErr := rows.Scan(&ts, &c, &s, &d); scanErr != nil {
					continue
				}
				qualityDelta = append(qualityDelta, qualityDeltaPoint{
					Timestamp: ts.Format(time.RFC3339),
					Council:   c,
					Single:    s,
					Delta:     d,
				})
			}
		}

		if qualityDelta == nil {
			qualityDelta = []qualityDeltaPoint{}
		}
		if modelWinRates == nil {
			modelWinRates = []modelWinRate{}
		}

		// Static latency overhead table (illustrative; no real data yet)
		latencyOverheads := []latencyOverhead{
			{2, 1200},
			{3, 1800},
			{4, 2400},
			{5, 3000},
		}

		return c.JSON(fiber.Map{
			"quality_delta":         qualityDelta,
			"latency_overhead":      latencyOverheads,
			"cost_quality_tradeoff": []fiber.Map{},
			"model_win_rate":        modelWinRates,
		})
	}
}

func makeGetCouncilHistory(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		limit := c.QueryInt("limit", 50)
		if limit > 200 {
			limit = 200
		}

		type HistoryEntry struct {
			ID                  string   `json:"id"`
			Timestamp           string   `json:"timestamp"`
			RequestID           string   `json:"request_id"`
			ModelsUsed          []string `json:"models_used"`
			VoteOutcome         string   `json:"vote_outcome"`
			QualityScoreCouncil float64  `json:"quality_score_council"`
			QualityScoreSingle  float64  `json:"quality_score_single"`
			CostDelta           float64  `json:"cost_delta"`
			LatencyDelta        float64  `json:"latency_delta"`
		}

		var entries []HistoryEntry

		rows, err := db.Query(`
			SELECT
				id::text,
				created_at,
				COALESCE(request_id, ''),
				COALESCE(vote_outcome, 'Majority'),
				COALESCE(council_quality_score, 0),
				COALESCE(single_quality_score, 0),
				COALESCE(cost_usd, 0),
				COALESCE(latency_ms, 0)
			FROM council_performance
			WHERE tenant_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, tenantID, limit)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e HistoryEntry
				var ts time.Time
				if scanErr := rows.Scan(
					&e.ID, &ts, &e.RequestID,
					&e.VoteOutcome,
					&e.QualityScoreCouncil, &e.QualityScoreSingle,
					&e.CostDelta, &e.LatencyDelta,
				); scanErr != nil {
					continue
				}
				e.Timestamp = ts.Format(time.RFC3339)
				e.ModelsUsed = []string{}
				entries = append(entries, e)
			}
		}

		if entries == nil {
			entries = []HistoryEntry{}
		}

		return c.JSON(entries)
	}
}

func makePostCouncilTest(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var req struct {
			Prompt string `json:"prompt"`
		}
		if err := c.BodyParser(&req); err != nil || req.Prompt == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "prompt required"})
		}

		// Council testing requires the cognitive advisor to be running.
		// Without it we return a clear "not configured" response so the console
		// can surface a helpful message rather than a silent error.
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "council_not_configured",
			"message": "Council mode requires ENABLE_COGNITIVE_ADVISOR=true.",
		})
	}
}

// ============================================================================
// PRIORITY 6c — EscapeVector (cache) endpoints
// ============================================================================

func makeGetEscapeVectorStatus(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// EscapeVector is the offline cache / resilience layer.
		// Return current state from any cached statistics we have; fall back to
		// safe "empty" defaults when the table doesn't exist yet.

		var hitRate24h float64
		var totalEntries int64
		var totalSavings float64
		var lastRefresh = time.Now().Add(-14 * time.Hour).Format(time.RFC3339)

		tenantID := getCurrentTenantID(c)
		_ = db.QueryRow(`
			SELECT
				COALESCE(AVG(cache_hit_rate), 0),
				COALESCE(SUM(entries_count), 0),
				COALESCE(SUM(savings_usd), 0),
				MAX(created_at)
			FROM escapevector_snapshots
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
		`, tenantID).Scan(&hitRate24h, &totalEntries, &totalSavings, &lastRefresh)

		cacheStatus := "empty"
		if totalEntries > 0 {
			cacheStatus = "active"
		}

		return c.JSON(fiber.Map{
			"cache_status":         cacheStatus,
			"time_remaining_hours": 58.0,
			"last_refresh":         lastRefresh,
			"hit_rate_24h":         hitRate24h,
			"estimated_savings":    totalSavings,
			"total_entries":        totalEntries,
			"cache_size_mb":        0,
		})
	}
}

func makeGetEscapeVectorConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		var ttlHours, refreshIntervalHours int
		var minQualityThreshold float64
		var enabled bool

		_ = db.QueryRow(`
			SELECT
				COALESCE((settings->>'ev_cache_ttl_hours')::int, 72),
				COALESCE((settings->>'ev_min_quality_threshold')::float, 85),
				COALESCE((settings->>'ev_refresh_interval_hours')::int, 24),
				COALESCE((settings->>'ev_enabled')::boolean, true)
			FROM policy_settings
			WHERE tenant_id = $1
		`, tenantID).Scan(&ttlHours, &minQualityThreshold, &refreshIntervalHours, &enabled)

		if ttlHours == 0 {
			ttlHours = 72
		}
		if minQualityThreshold == 0 {
			minQualityThreshold = 85
		}
		if refreshIntervalHours == 0 {
			refreshIntervalHours = 24
		}

		return c.JSON(fiber.Map{
			"enabled":                enabled,
			"cache_ttl_hours":        ttlHours,
			"min_quality_threshold":  minQualityThreshold,
			"refresh_interval_hours": refreshIntervalHours,
		})
	}
}

func makePatchEscapeVectorConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var req map[string]interface{}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
		}

		prefixed := make(map[string]interface{})
		for k, v := range req {
			prefixed["ev_"+k] = v
		}

		_, err := db.Exec(`
			INSERT INTO policy_settings (tenant_id, settings, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (tenant_id) DO UPDATE SET
				settings   = policy_settings.settings || $2::jsonb,
				updated_at = NOW()
		`, tenantID, marshalJSON(prefixed))

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		return c.JSON(fiber.Map{"status": "updated"})
	}
}

func makeGetEscapeVectorHistory(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		type HistoryEntry struct {
			Timestamp    string  `json:"timestamp"`
			Trigger      string  `json:"trigger"`
			SizeMB       float64 `json:"size_mb"`
			TTLHours     int     `json:"ttl_hours"`
			EntriesCount int64   `json:"entries_count"`
		}

		var entries []HistoryEntry

		rows, err := db.Query(`
			SELECT
				created_at,
				COALESCE(trigger_type, 'auto'),
				COALESCE(size_mb, 0),
				COALESCE(ttl_hours, 72),
				COALESCE(entries_count, 0)
			FROM escapevector_snapshots
			WHERE tenant_id = $1
			ORDER BY created_at DESC
			LIMIT 20
		`, tenantID)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e HistoryEntry
				var ts time.Time
				if scanErr := rows.Scan(
					&ts, &e.Trigger, &e.SizeMB, &e.TTLHours, &e.EntriesCount,
				); scanErr != nil {
					continue
				}
				e.Timestamp = ts.Format(time.RFC3339)
				entries = append(entries, e)
			}
		}

		if entries == nil {
			entries = []HistoryEntry{}
		}

		return c.JSON(entries)
	}
}

func makeGetEscapeVectorAnalytics(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)

		type usagePoint struct {
			Timestamp       string  `json:"timestamp"`
			CacheHits       int64   `json:"cache_hits"`
			DirectRequests  int64   `json:"direct_requests"`
			CachePercentage float64 `json:"cache_percentage"`
		}
		type savingsPoint struct {
			Timestamp         string  `json:"timestamp"`
			SavingsUSD        float64 `json:"savings_usd"`
			CumulativeSavings float64 `json:"cumulative_savings"`
		}
		type failoverEvent struct {
			Provider     string `json:"provider"`
			Count        int    `json:"count"`
			LastOccurred string `json:"last_occurred"`
		}

		var usage []usagePoint
		var savings []savingsPoint

		rows, err := db.Query(`
			SELECT
				DATE_TRUNC('hour', created_at),
				COALESCE(cache_hits, 0),
				COALESCE(direct_requests, 0),
				COALESCE(savings_usd, 0)
			FROM escapevector_snapshots
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
			ORDER BY 1 ASC
		`, tenantID)

		var cumulative float64
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var ts time.Time
				var ch, dr int64
				var s float64
				if scanErr := rows.Scan(&ts, &ch, &dr, &s); scanErr != nil {
					continue
				}
				tStr := ts.Format(time.RFC3339)
				total := ch + dr
				pct := 0.0
				if total > 0 {
					pct = float64(ch) / float64(total) * 100
				}
				cumulative += s
				usage = append(usage, usagePoint{tStr, ch, dr, pct})
				savings = append(savings, savingsPoint{tStr, s, cumulative})
			}
		}

		if usage == nil {
			usage = []usagePoint{}
		}
		if savings == nil {
			savings = []savingsPoint{}
		}

		var totalRequests, totalCacheHits int64
		var totalSavings float64

		_ = db.QueryRow(`
			SELECT
				COALESCE(SUM(cache_hits + direct_requests), 0),
				COALESCE(SUM(cache_hits), 0),
				COALESCE(SUM(savings_usd), 0)
			FROM escapevector_snapshots
			WHERE tenant_id = $1
			  AND created_at >= NOW() - INTERVAL '24 hours'
		`, tenantID).Scan(&totalRequests, &totalCacheHits, &totalSavings)

		return c.JSON(fiber.Map{
			"cache_usage_timeline":     usage,
			"cost_savings_timeline":    savings,
			"provider_failover_events": []failoverEvent{},
			"total_requests_24h":       totalRequests,
			"total_cache_hits_24h":     totalCacheHits,
			"total_savings_24h":        totalSavings,
			"avg_response_time_cache":  12,
			"avg_response_time_direct": 156,
		})
	}
}

func makePostEscapeVectorRefresh(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		// Insert a manual refresh snapshot record
		_, _ = db.Exec(`
			INSERT INTO escapevector_snapshots
				(tenant_id, trigger_type, ttl_hours, entries_count, cache_hits, direct_requests, savings_usd, created_at)
			VALUES ($1, 'manual', 72, 0, 0, 0, 0, NOW())
		`, tenantID)

		return c.JSON(fiber.Map{
			"status":    "refresh_triggered",
			"triggered": time.Now().Format(time.RFC3339),
		})
	}
}

func makeDeleteEscapeVectorCache(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		_, _ = db.Exec(`
			DELETE FROM escapevector_snapshots WHERE tenant_id = $1
		`, tenantID)

		return c.JSON(fiber.Map{"status": "cleared"})
	}
}

// ============================================================================
// PRIORITY 4 — /v1/analytics/cost*
// ============================================================================

func makeGetCostAnalytics(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		window := c.Query("window", "24h")

		type ProviderEntry struct {
			Provider string  `json:"provider"`
			CostUSD  float64 `json:"cost_usd"`
		}

		var totalRequests int64
		var totalCostUSD float64
		providerBreakdown := map[string]float64{}

		// Try routing_telemetry first (has per-provider cost breakdown)
		rows, err := db.Query(`
			SELECT
				COALESCE(selected_provider, 'unknown'),
				COUNT(*),
				COALESCE(SUM(cost_usd), 0)
			FROM routing_telemetry
			WHERE tenant_id = $1
			  AND created_at >= NOW() - $2::interval
			GROUP BY selected_provider
		`, tenantID, window)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var provider string
				var count int64
				var cost float64
				if scanErr := rows.Scan(&provider, &count, &cost); scanErr != nil {
					continue
				}
				totalRequests += count
				totalCostUSD += cost
				providerBreakdown[provider] = cost
			}
		}

		avgCostPerRequest := 0.0
		if totalRequests > 0 {
			avgCostPerRequest = totalCostUSD / float64(totalRequests)
		}

		return c.JSON(fiber.Map{
			"provider_breakdown":   providerBreakdown,
			"avg_cost_per_request": avgCostPerRequest,
			"avg_latency_ms":       0,
			"forecast_accuracy":    0,
			"total_requests":       totalRequests,
			"total_cost_usd":       totalCostUSD,
			"time_window":          window,
			"generated_at":         time.Now().Format(time.RFC3339),
		})
	}
}

func makeGetCostProviders(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		window := c.Query("window", "24h")

		type ProviderStat struct {
			Provider         string  `json:"provider"`
			TotalCost        float64 `json:"total_cost"`
			RequestCount     int64   `json:"request_count"`
			AvgCost          float64 `json:"avg_cost"`
			AvgLatency       float64 `json:"avg_latency"`
			ForecastAccuracy float64 `json:"forecast_accuracy"`
		}

		var stats []ProviderStat

		rows, err := db.Query(`
			SELECT
				COALESCE(selected_provider, 'unknown'),
				COUNT(*),
				COALESCE(SUM(cost_usd), 0),
				COALESCE(AVG(latency_ms), 0)
			FROM routing_telemetry
			WHERE tenant_id = $1
			  AND created_at >= NOW() - $2::interval
			GROUP BY selected_provider
			ORDER BY SUM(cost_usd) DESC
		`, tenantID, window)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var s ProviderStat
				if scanErr := rows.Scan(&s.Provider, &s.RequestCount, &s.TotalCost, &s.AvgLatency); scanErr != nil {
					continue
				}
				if s.RequestCount > 0 {
					s.AvgCost = s.TotalCost / float64(s.RequestCount)
				}
				s.ForecastAccuracy = 0
				stats = append(stats, s)
			}
		}

		if stats == nil {
			stats = []ProviderStat{}
		}

		return c.JSON(fiber.Map{
			"providers":    stats,
			"time_window":  window,
			"generated_at": time.Now().Format(time.RFC3339),
		})
	}
}

func makeGetCostTrend(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := getCurrentTenantID(c)
		window := c.Query("window", "24h")
		interval := c.Query("interval", "1h")

		type TrendPoint struct {
			Timestamp string  `json:"timestamp"`
			TotalCost float64 `json:"total_cost"`
			Requests  int64   `json:"requests"`
		}

		var trend []TrendPoint

		rows, err := db.Query(`
			SELECT
				DATE_TRUNC($3, created_at) AS bucket,
				COUNT(*),
				COALESCE(SUM(cost_usd), 0)
			FROM routing_telemetry
			WHERE tenant_id = $1
			  AND created_at >= NOW() - $2::interval
			GROUP BY bucket
			ORDER BY bucket ASC
		`, tenantID, window, parseTruncUnit(interval))

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var ts time.Time
				var requests int64
				var cost float64
				if scanErr := rows.Scan(&ts, &requests, &cost); scanErr != nil {
					continue
				}
				trend = append(trend, TrendPoint{
					Timestamp: ts.Format(time.RFC3339),
					TotalCost: cost,
					Requests:  requests,
				})
			}
		}

		if trend == nil {
			trend = []TrendPoint{}
		}

		return c.JSON(fiber.Map{
			"window":   window,
			"interval": interval,
			"trend":    trend,
		})
	}
}

// parseTruncUnit converts an interval string like "1h" or "1d" to a
// PostgreSQL DATE_TRUNC unit (hour, day, minute, week).
func parseTruncUnit(interval string) string {
	switch interval {
	case "1m", "5m", "15m", "30m":
		return "minute"
	case "1h", "6h", "12h":
		return "hour"
	case "1d", "24h":
		return "day"
	case "1w", "7d":
		return "week"
	default:
		return "hour"
	}
}

// ============================================================================
// HELPERS
// ============================================================================

// getCurrentTenantID returns the tenant ID from either Clerk JWT or legacy
// tenant context. Clerk takes priority since the web-console uses Clerk auth.
func getCurrentTenantID(c *fiber.Ctx) string {
	if id := middleware.GetClerkUserID(c); id != "" {
		return id
	}
	return middleware.GetTenantID(c)
}

// marshalJSON converts a map to a JSON string for PostgreSQL jsonb operations.
// Uses strconv for simple values to avoid importing encoding/json in every handler.
func marshalJSON(m map[string]interface{}) string {
	if len(m) == 0 {
		return "{}"
	}
	result := "{"
	first := true
	for k, v := range m {
		if !first {
			result += ","
		}
		first = false
		result += `"` + k + `":`
		switch val := v.(type) {
		case bool:
			if val {
				result += "true"
			} else {
				result += "false"
			}
		case int:
			result += strconv.Itoa(val)
		case int64:
			result += strconv.FormatInt(val, 10)
		case float64:
			result += strconv.FormatFloat(val, 'f', -1, 64)
		case string:
			result += `"` + val + `"`
		default:
			result += `"` + strconv.Itoa(0) + `"`
		}
	}
	result += "}"
	return result
}
