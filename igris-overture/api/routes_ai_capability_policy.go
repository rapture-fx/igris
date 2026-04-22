package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

type aiCapabilityPolicyRequest struct {
	PolicyVersion string                 `json:"policy_version,omitempty"`
	Policy        map[string]interface{} `json:"policy"`
	ExpiresAt     *time.Time             `json:"expires_at,omitempty"`
}

type aiCapabilityPolicyResponse struct {
	TenantID      string                 `json:"tenant_id"`
	PolicyVersion string                 `json:"policy_version"`
	Status        string                 `json:"status"`
	Active        bool                   `json:"active"`
	Policy        map[string]interface{} `json:"policy"`
	ExpiresAt     *time.Time             `json:"expires_at,omitempty"`
	ActivatedAt   *time.Time             `json:"activated_at,omitempty"`
	ExpiredAt     *time.Time             `json:"expired_at,omitempty"`
	RevokedAt     *time.Time             `json:"revoked_at,omitempty"`
	CreatedBy     string                 `json:"created_by,omitempty"`
	UpdatedBy     string                 `json:"updated_by,omitempty"`
	RevokedBy     string                 `json:"revoked_by,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

func RegisterAICapabilityPolicyRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] AI capability policy endpoints disabled — database not available")
		return
	}

	v1 := app.Group("/v1/ai/capabilities/policies")
	v1.Use(middlewareBetterAuth(db))
	v1.Get("", listAICapabilityPolicies(db))
	v1.Post("", createDraftAICapabilityPolicy(db))
	v1.Put("/:version", updateDraftAICapabilityPolicy(db))
	v1.Post("/:version/activate", activateAICapabilityPolicy(db))
	v1.Post("/:version/expire", aiCapabilityPolicyLifecycleUpdate(db, "expired"))
	v1.Post("/:version/revoke", aiCapabilityPolicyLifecycleUpdate(db, "revoked"))

	log.Info().Msg("[Routes] Registered AI capability policy endpoints (/v1/ai/capabilities/policies)")
}

func middlewareBetterAuth(db *sql.DB) fiber.Handler {
	return middleware.BetterAuth(db)
}

func normalizeCapabilityPolicyVersion(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "capabilities-policy.v1"
	}
	return value
}

func createDraftAICapabilityPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db, "draft")
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		var req aiCapabilityPolicyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		policy, err := upsertDraftAICapabilityPolicy(c, db, actor.ID, req)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[AICapabilityPolicy] create draft failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertAICapabilityPolicyLifecycleAudit(db, c.Context(), policy, "draft", actor, ""); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[AICapabilityPolicy] draft audit failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(policy)
	}
}

func updateDraftAICapabilityPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db, "update")
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		var req aiCapabilityPolicyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		req.PolicyVersion = c.Params("version")
		policy, err := upsertDraftAICapabilityPolicy(c, db, actor.ID, req)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[AICapabilityPolicy] update draft failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertAICapabilityPolicyLifecycleAudit(db, c.Context(), policy, "update", actor, "draft"); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[AICapabilityPolicy] update audit failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func upsertDraftAICapabilityPolicy(c *fiber.Ctx, db *sql.DB, tenantID string, req aiCapabilityPolicyRequest) (*aiCapabilityPolicyResponse, error) {
	policyVersion := normalizeCapabilityPolicyVersion(req.PolicyVersion)
	if req.Policy == nil {
		req.Policy = map[string]interface{}{}
	}
	policyBytes, err := json.Marshal(req.Policy)
	if err != nil {
		return nil, err
	}
	row := db.QueryRowContext(c.Context(), `
		INSERT INTO ai_capability_policy_settings (
			tenant_id, policy_version, status, active, policy, expires_at,
			created_by, updated_by, created_at, updated_at
		)
		VALUES ($1, $2, 'draft', false, $3::jsonb, $4, $5, $5, NOW(), NOW())
		ON CONFLICT (tenant_id, policy_version) DO UPDATE SET
			status = 'draft',
			active = false,
			policy = EXCLUDED.policy,
			expires_at = EXCLUDED.expires_at,
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
		RETURNING tenant_id, policy_version, status, active, policy::text,
		          expires_at, activated_at, expired_at, revoked_at,
		          created_by, updated_by, revoked_by, created_at, updated_at`,
		tenantID, policyVersion, string(policyBytes), req.ExpiresAt, tenantID,
	)
	return scanAICapabilityPolicy(row)
}

func listAICapabilityPolicies(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorFromContext(c)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		rows, err := db.QueryContext(c.Context(), `
			SELECT tenant_id, policy_version, status, active, policy::text,
			       expires_at, activated_at, expired_at, revoked_at,
			       created_by, updated_by, revoked_by, created_at, updated_at
			FROM ai_capability_policy_settings
			WHERE tenant_id = $1
			ORDER BY active DESC, updated_at DESC`, actor.ID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[AICapabilityPolicy] list failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer rows.Close()
		policies := make([]*aiCapabilityPolicyResponse, 0)
		for rows.Next() {
			policy, err := scanAICapabilityPolicy(rows)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			policies = append(policies, policy)
		}
		return c.JSON(policies)
	}
}

func activateAICapabilityPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db, "activate")
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		policyVersion := normalizeCapabilityPolicyVersion(c.Params("version"))
		tx, err := db.BeginTx(c.Context(), nil)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer tx.Rollback()
		if _, err := tx.ExecContext(c.Context(), `
			UPDATE ai_capability_policy_settings
			SET active = false,
			    status = CASE WHEN status = 'active' THEN 'draft' ELSE status END,
			    updated_by = $1,
			    updated_at = NOW()
			WHERE tenant_id = $2 AND active = true`, actor.ID, actor.ID); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		row := tx.QueryRowContext(c.Context(), `
			UPDATE ai_capability_policy_settings
			SET status = 'active', active = true, activated_at = NOW(),
			    expired_at = NULL, revoked_at = NULL, revoked_by = NULL,
			    updated_by = $1, updated_at = NOW()
			WHERE tenant_id = $2 AND policy_version = $3
			RETURNING tenant_id, policy_version, status, active, policy::text,
			          expires_at, activated_at, expired_at, revoked_at,
			          created_by, updated_by, revoked_by, created_at, updated_at`,
			actor.ID, actor.ID, policyVersion,
		)
		policy, err := scanAICapabilityPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		policyBytes, _ := json.Marshal(policy.Policy)
		if _, err := tx.ExecContext(c.Context(), `
			UPDATE tenants
			SET capabilities_policy = $2::jsonb, updated_at = NOW()
			WHERE tenant_id = $1`, actor.ID, string(policyBytes)); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertAICapabilityPolicyLifecycleAudit(tx, c.Context(), policy, "activate", actor, "draft"); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := tx.Commit(); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func aiCapabilityPolicyLifecycleUpdate(db *sql.DB, status string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auditAction := status
		if status == "expired" {
			auditAction = "expire"
		}
		if status == "revoked" {
			auditAction = "revoke"
		}
		actor, authErr := roboticsPolicyActorForWrite(c, db, auditAction)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		policyVersion := normalizeCapabilityPolicyVersion(c.Params("version"))
		timestampColumn := "expired_at"
		args := []interface{}{status, actor.ID, policyVersion}
		extra := ""
		if status == "revoked" {
			timestampColumn = "revoked_at"
			extra = ", revoked_by = $4"
			args = append(args, actor.ID)
		}
		row := db.QueryRowContext(c.Context(), `
			UPDATE ai_capability_policy_settings
			SET status = $1, active = false, `+timestampColumn+` = NOW(),
			    updated_by = $2, updated_at = NOW()`+extra+`
			WHERE tenant_id = $2 AND policy_version = $3
			RETURNING tenant_id, policy_version, status, active, policy::text,
			          expires_at, activated_at, expired_at, revoked_at,
			          created_by, updated_by, revoked_by, created_at, updated_at`,
			args...,
		)
		policy, err := scanAICapabilityPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertAICapabilityPolicyLifecycleAudit(db, c.Context(), policy, auditAction, actor, "active"); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func insertAICapabilityPolicyLifecycleAudit(execer interface {
	ExecContext(context.Context, string, ...interface{}) (sql.Result, error)
}, ctx context.Context, policy *aiCapabilityPolicyResponse, action string, actor roboticsPolicyActor, previousStatus string) error {
	if policy == nil {
		return nil
	}
	snapshot, err := json.Marshal(policy)
	if err != nil {
		return err
	}
	_, err = execer.ExecContext(ctx, `
		INSERT INTO ai_capability_policy_lifecycle_audit (
			tenant_id, policy_version, action, actor_id, actor_email,
			signer_identity, signer_key_version, command_nonce, command_hash,
			command_signature, previous_status, new_status, policy_snapshot, occurred_at
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''),
		        NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''),
		        $12, $13, NOW())`,
		policy.TenantID,
		policy.PolicyVersion,
		action,
		actor.ID,
		actor.Email,
		actor.SignerIdentity,
		actor.SignerKeyVersion,
		actor.CommandNonce,
		actor.CommandHash,
		actor.CommandSignature,
		previousStatus,
		policy.Status,
		string(snapshot),
	)
	return err
}

func scanAICapabilityPolicy(row interface{ Scan(...interface{}) error }) (*aiCapabilityPolicyResponse, error) {
	var policy aiCapabilityPolicyResponse
	var policyRaw string
	var expiresAt, activatedAt, expiredAt, revokedAt sql.NullTime
	var createdBy, updatedBy, revokedBy sql.NullString
	if err := row.Scan(
		&policy.TenantID,
		&policy.PolicyVersion,
		&policy.Status,
		&policy.Active,
		&policyRaw,
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
	_ = json.Unmarshal([]byte(policyRaw), &policy.Policy)
	if policy.Policy == nil {
		policy.Policy = map[string]interface{}{}
	}
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
