package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

type roboticsPolicyRequest struct {
	PolicyVersion    string     `json:"policy_version,omitempty"`
	Permit           bool       `json:"permit"`
	RuntimePermitted bool       `json:"runtime_permitted"`
	RobotMode        string     `json:"robot_mode"`
	AllowedRuntimes  []string   `json:"allowed_runtimes"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
}

type roboticsPolicyAllowListRequest struct {
	AllowedRuntimes []string `json:"allowed_runtimes"`
}

type roboticsPolicyResponse struct {
	TenantID          string     `json:"tenant_id"`
	PolicyVersion     string     `json:"policy_version"`
	Status            string     `json:"status"`
	Permit            bool       `json:"permit"`
	RuntimePermitted  bool       `json:"runtime_permitted"`
	RobotMode         string     `json:"robot_mode"`
	AllowedRuntimes   []string   `json:"allowed_runtimes"`
	Active            bool       `json:"active"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	ActivatedAt       *time.Time `json:"activated_at,omitempty"`
	ExpiredAt         *time.Time `json:"expired_at,omitempty"`
	RevokedAt         *time.Time `json:"revoked_at,omitempty"`
	CreatedBy         string     `json:"created_by,omitempty"`
	UpdatedBy         string     `json:"updated_by,omitempty"`
	RevokedBy         string     `json:"revoked_by,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func RegisterRoboticsPolicyRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Robotics policy endpoints disabled — database not available")
		return
	}

	v1 := app.Group("/v1/robotics/policies")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", listRoboticsPolicies(db))
	v1.Post("", createDraftRoboticsPolicy(db))
	v1.Put("/:version", updateDraftRoboticsPolicy(db))
	v1.Put("/:version/allow-list", updateRoboticsPolicyAllowList(db))
	v1.Post("/:version/activate", activateRoboticsPolicy(db))
	v1.Post("/:version/expire", expireRoboticsPolicy(db))
	v1.Post("/:version/revoke", revokeRoboticsPolicy(db))

	log.Info().Msg("[Routes] Registered robotics policy endpoints (/v1/robotics/policies)")
}

func normalizePolicyVersion(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "robotics-policy.v1"
	}
	return value
}

func normalizeRobotMode(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "supervised", "active", "disabled":
		return value
	default:
		return "disabled"
	}
}

func allowedRuntimesJSON(runtimes []string) ([]byte, error) {
	normalized := make([]string, 0, len(runtimes))
	seen := make(map[string]struct{}, len(runtimes))
	for _, runtimeID := range runtimes {
		runtimeID = strings.TrimSpace(runtimeID)
		if runtimeID == "" {
			continue
		}
		if _, ok := seen[runtimeID]; ok {
			continue
		}
		seen[runtimeID] = struct{}{}
		normalized = append(normalized, runtimeID)
	}
	return json.Marshal(normalized)
}

func createDraftRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req roboticsPolicyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		policy, err := upsertDraftRoboticsPolicy(c, db, tenantID, req)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[RoboticsPolicy] create draft failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(policy)
	}
}

func updateDraftRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req roboticsPolicyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		req.PolicyVersion = c.Params("version")
		policy, err := upsertDraftRoboticsPolicy(c, db, tenantID, req)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Str("policy_version", req.PolicyVersion).Msg("[RoboticsPolicy] update draft failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func upsertDraftRoboticsPolicy(c *fiber.Ctx, db *sql.DB, tenantID string, req roboticsPolicyRequest) (*roboticsPolicyResponse, error) {
	policyVersion := normalizePolicyVersion(req.PolicyVersion)
	robotMode := normalizeRobotMode(req.RobotMode)
	allowed, err := allowedRuntimesJSON(req.AllowedRuntimes)
	if err != nil {
		return nil, err
	}
	row := db.QueryRowContext(c.Context(), `
		INSERT INTO robotics_policy_settings (
			tenant_id, policy_version, status, permit, runtime_permitted,
			robot_mode, allowed_runtimes, active, expires_at, created_by,
			updated_by, created_at, updated_at
		)
		VALUES ($1, $2, 'draft', $3, $4, $5, $6, false, $7, $8, $8, NOW(), NOW())
		ON CONFLICT (tenant_id, policy_version) DO UPDATE SET
			status = 'draft',
			permit = EXCLUDED.permit,
			runtime_permitted = EXCLUDED.runtime_permitted,
			robot_mode = EXCLUDED.robot_mode,
			allowed_runtimes = EXCLUDED.allowed_runtimes,
			active = false,
			expires_at = EXCLUDED.expires_at,
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
		RETURNING tenant_id, policy_version, status, permit, runtime_permitted,
		          robot_mode, allowed_runtimes::text, active, expires_at,
		          activated_at, expired_at, revoked_at, created_by, updated_by,
		          revoked_by, created_at, updated_at`,
		tenantID, policyVersion, req.Permit, req.RuntimePermitted, robotMode,
		allowed, req.ExpiresAt, tenantID,
	)
	return scanRoboticsPolicy(row)
}

func updateRoboticsPolicyAllowList(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req roboticsPolicyAllowListRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		allowed, err := allowedRuntimesJSON(req.AllowedRuntimes)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_allowed_runtimes"})
		}
		policyVersion := normalizePolicyVersion(c.Params("version"))
		row := db.QueryRowContext(c.Context(), `
			UPDATE robotics_policy_settings
			SET allowed_runtimes = $1, updated_by = $2, updated_at = NOW()
			WHERE tenant_id = $3 AND policy_version = $4
			RETURNING tenant_id, policy_version, status, permit, runtime_permitted,
			          robot_mode, allowed_runtimes::text, active, expires_at,
			          activated_at, expired_at, revoked_at, created_by, updated_by,
			          revoked_by, created_at, updated_at`,
			allowed, tenantID, tenantID, policyVersion,
		)
		policy, err := scanRoboticsPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Str("policy_version", policyVersion).Msg("[RoboticsPolicy] allow-list update failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func activateRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		policyVersion := normalizePolicyVersion(c.Params("version"))
		tx, err := db.BeginTx(c.Context(), nil)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer tx.Rollback()
		if _, err := tx.ExecContext(c.Context(), `
			UPDATE robotics_policy_settings
			SET active = false,
			    status = CASE WHEN status = 'active' THEN 'draft' ELSE status END,
			    updated_by = $1,
			    updated_at = NOW()
			WHERE tenant_id = $2 AND active = true`, tenantID, tenantID); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		row := tx.QueryRowContext(c.Context(), `
			UPDATE robotics_policy_settings
			SET status = 'active', active = true, activated_at = NOW(),
			    expired_at = NULL, revoked_at = NULL, revoked_by = NULL,
			    updated_by = $1, updated_at = NOW()
			WHERE tenant_id = $2 AND policy_version = $3
			RETURNING tenant_id, policy_version, status, permit, runtime_permitted,
			          robot_mode, allowed_runtimes::text, active, expires_at,
			          activated_at, expired_at, revoked_at, created_by, updated_by,
			          revoked_by, created_at, updated_at`, tenantID, tenantID, policyVersion)
		policy, err := scanRoboticsPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := tx.Commit(); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func expireRoboticsPolicy(db *sql.DB) fiber.Handler {
	return roboticsPolicyLifecycleUpdate(db, "expired")
}

func revokeRoboticsPolicy(db *sql.DB) fiber.Handler {
	return roboticsPolicyLifecycleUpdate(db, "revoked")
}

func roboticsPolicyLifecycleUpdate(db *sql.DB, status string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		policyVersion := normalizePolicyVersion(c.Params("version"))
		timestampColumn := "expired_at"
		args := []interface{}{status, tenantID, policyVersion}
		extra := ""
		if status == "revoked" {
			timestampColumn = "revoked_at"
			extra = ", revoked_by = $4"
			args = append(args, tenantID)
		}
		row := db.QueryRowContext(c.Context(), `
			UPDATE robotics_policy_settings
			SET status = $1, active = false, `+timestampColumn+` = NOW(),
			    updated_by = $2, updated_at = NOW()`+extra+`
			WHERE tenant_id = $2 AND policy_version = $3
			RETURNING tenant_id, policy_version, status, permit, runtime_permitted,
			          robot_mode, allowed_runtimes::text, active, expires_at,
			          activated_at, expired_at, revoked_at, created_by, updated_by,
			          revoked_by, created_at, updated_at`,
			args...,
		)
		policy, err := scanRoboticsPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Str("policy_version", policyVersion).Msg("[RoboticsPolicy] lifecycle update failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func listRoboticsPolicies(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		rows, err := db.QueryContext(c.Context(), `
			SELECT tenant_id, policy_version, status, permit, runtime_permitted,
			       robot_mode, allowed_runtimes::text, active, expires_at,
			       activated_at, expired_at, revoked_at, created_by, updated_by,
			       revoked_by, created_at, updated_at
			FROM robotics_policy_settings
			WHERE tenant_id = $1
			ORDER BY active DESC, updated_at DESC
			LIMIT 100`, tenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[RoboticsPolicy] list failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer rows.Close()
		policies := make([]*roboticsPolicyResponse, 0)
		for rows.Next() {
			policy, err := scanRoboticsPolicy(rows)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			policies = append(policies, policy)
		}
		return c.JSON(fiber.Map{"policies": policies, "total": len(policies)})
	}
}

func scanRoboticsPolicy(row interface{ Scan(...interface{}) error }) (*roboticsPolicyResponse, error) {
	var policy roboticsPolicyResponse
	var allowedRaw string
	var expiresAt, activatedAt, expiredAt, revokedAt sql.NullTime
	var createdBy, updatedBy, revokedBy sql.NullString
	if err := row.Scan(
		&policy.TenantID,
		&policy.PolicyVersion,
		&policy.Status,
		&policy.Permit,
		&policy.RuntimePermitted,
		&policy.RobotMode,
		&allowedRaw,
		&policy.Active,
		&expiresAt,
		&activatedAt,
		&expiredAt,
		&revokedAt,
		&createdBy,
		&updatedBy,
		&revokedBy,
		&policy.CreatedAt,
		&policy.UpdatedAt,
	); err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(allowedRaw), &policy.AllowedRuntimes)
	if expiresAt.Valid {
		policy.ExpiresAt = &expiresAt.Time
	}
	if activatedAt.Valid {
		policy.ActivatedAt = &activatedAt.Time
	}
	if expiredAt.Valid {
		policy.ExpiredAt = &expiredAt.Time
	}
	if revokedAt.Valid {
		policy.RevokedAt = &revokedAt.Time
	}
	if createdBy.Valid {
		policy.CreatedBy = createdBy.String
	}
	if updatedBy.Valid {
		policy.UpdatedBy = updatedBy.String
	}
	if revokedBy.Valid {
		policy.RevokedBy = revokedBy.String
	}
	return &policy, nil
}
