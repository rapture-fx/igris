package api

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
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
	TenantID         string     `json:"tenant_id"`
	PolicyVersion    string     `json:"policy_version"`
	Status           string     `json:"status"`
	Permit           bool       `json:"permit"`
	RuntimePermitted bool       `json:"runtime_permitted"`
	RobotMode        string     `json:"robot_mode"`
	AllowedRuntimes  []string   `json:"allowed_runtimes"`
	Active           bool       `json:"active"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	ActivatedAt      *time.Time `json:"activated_at,omitempty"`
	ExpiredAt        *time.Time `json:"expired_at,omitempty"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	CreatedBy        string     `json:"created_by,omitempty"`
	UpdatedBy        string     `json:"updated_by,omitempty"`
	RevokedBy        string     `json:"revoked_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type roboticsPolicyActor struct {
	ID               string
	Email            string
	SignerIdentity   string
	SignerKeyVersion string
	CommandSignature string
}

const (
	roboticsPolicySignerHeader        = "X-Igris-Policy-Signer"
	roboticsPolicyKeyVersionHeader    = "X-Igris-Policy-Key-Version"
	roboticsPolicySignatureHeader     = "X-Igris-Policy-Signature"
	roboticsPolicySignedAtHeader      = "X-Igris-Policy-Signed-At"
	roboticsPolicyCommandMaxClockSkew = 5 * time.Minute
)

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

func roboticsPolicyActorFromContext(c *fiber.Ctx) (roboticsPolicyActor, error) {
	actor := roboticsPolicyActor{
		ID:    middleware.GetClerkUserID(c),
		Email: middleware.GetClerkEmail(c),
	}
	if actor.ID == "" {
		return actor, fiber.NewError(http.StatusUnauthorized, "unauthenticated")
	}
	if !roboticsPolicyAdminAllowed(c) {
		return actor, fiber.NewError(http.StatusForbidden, "admin_required")
	}
	signer := strings.TrimSpace(c.Get(roboticsPolicySignerHeader))
	if signer == "" {
		signer = strings.TrimSpace(actor.Email)
	}
	if signer == "" {
		signer = actor.ID
	}
	actor.SignerIdentity = signer
	return actor, nil
}

func roboticsPolicyAdminAllowed(c *fiber.Ctx) bool {
	if middleware.IsAdminRequest(c) {
		return true
	}
	if role, ok := c.Locals("clerk_role").(string); ok && role == "admin" {
		return true
	}
	if roles, ok := c.Locals("clerk_roles").([]string); ok {
		for _, role := range roles {
			if role == "admin" {
				return true
			}
		}
	}
	return false
}

func roboticsPolicyActorForWrite(c *fiber.Ctx, db *sql.DB) (roboticsPolicyActor, error) {
	actor, err := roboticsPolicyActorFromContext(c)
	if err != nil {
		return actor, err
	}
	if err := verifyRoboticsPolicyCommandSignature(c, db, &actor); err != nil {
		return actor, err
	}
	return actor, nil
}

func roboticsPolicyAuthError(c *fiber.Ctx, err error) error {
	if fiberErr, ok := err.(*fiber.Error); ok {
		return c.Status(fiberErr.Code).JSON(fiber.Map{"error": fiberErr.Message})
	}
	return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
}

func verifyRoboticsPolicyCommandSignature(c *fiber.Ctx, db *sql.DB, actor *roboticsPolicyActor) error {
	if db == nil || actor == nil {
		return fiber.NewError(http.StatusUnauthorized, "policy_signature_required")
	}
	keyVersion := strings.TrimSpace(c.Get(roboticsPolicyKeyVersionHeader))
	signatureValue := strings.TrimSpace(c.Get(roboticsPolicySignatureHeader))
	signedAtValue := strings.TrimSpace(c.Get(roboticsPolicySignedAtHeader))
	if keyVersion == "" || signatureValue == "" || signedAtValue == "" {
		return fiber.NewError(http.StatusUnauthorized, "policy_signature_required")
	}
	signedAtMs, err := strconv.ParseInt(signedAtValue, 10, 64)
	if err != nil {
		return fiber.NewError(http.StatusBadRequest, "invalid_policy_signature_timestamp")
	}
	signedAt := time.UnixMilli(signedAtMs)
	if signedAt.Before(time.Now().Add(-roboticsPolicyCommandMaxClockSkew)) || signedAt.After(time.Now().Add(roboticsPolicyCommandMaxClockSkew)) {
		return fiber.NewError(http.StatusUnauthorized, "policy_signature_expired")
	}

	var publicKeyHex, signerIdentity string
	err = db.QueryRowContext(c.Context(), `
		SELECT public_key_ed25519, signer_identity
		FROM robotics_policy_signing_keys
		WHERE tenant_id = $1
		  AND key_version = $2
		  AND status = 'active'
		  AND not_before <= NOW()
		  AND (expires_at IS NULL OR expires_at > NOW())
		LIMIT 1`, actor.ID, keyVersion).Scan(&publicKeyHex, &signerIdentity)
	if err == sql.ErrNoRows {
		return fiber.NewError(http.StatusForbidden, "invalid_policy_signer_key")
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", actor.ID).Str("key_version", keyVersion).Msg("[RoboticsPolicy] signer key lookup failed")
		return fiber.NewError(http.StatusInternalServerError, "db_error")
	}
	publicKeyBytes, err := hex.DecodeString(strings.TrimSpace(publicKeyHex))
	if err != nil || len(publicKeyBytes) != ed25519.PublicKeySize {
		return fiber.NewError(http.StatusForbidden, "invalid_policy_signer_key")
	}
	signatureBytes, err := decodeRoboticsPolicySignature(signatureValue)
	if err != nil {
		return fiber.NewError(http.StatusForbidden, "invalid_policy_signature")
	}
	canonical := canonicalRoboticsPolicyCommand(c.Method(), c.Path(), keyVersion, signedAtValue, c.Body())
	sum := sha256.Sum256(canonical)
	if !ed25519.Verify(ed25519.PublicKey(publicKeyBytes), sum[:], signatureBytes) {
		return fiber.NewError(http.StatusForbidden, "invalid_policy_signature")
	}
	requestSigner := strings.TrimSpace(c.Get(roboticsPolicySignerHeader))
	if requestSigner != "" && requestSigner != signerIdentity {
		return fiber.NewError(http.StatusForbidden, "policy_signer_identity_mismatch")
	}
	actor.SignerIdentity = signerIdentity
	actor.SignerKeyVersion = keyVersion
	actor.CommandSignature = signatureValue
	return nil
}

func decodeRoboticsPolicySignature(value string) ([]byte, error) {
	if decoded, err := base64.StdEncoding.DecodeString(value); err == nil && len(decoded) == ed25519.SignatureSize {
		return decoded, nil
	}
	decoded, err := hex.DecodeString(value)
	if err != nil || len(decoded) != ed25519.SignatureSize {
		return nil, err
	}
	return decoded, nil
}

func canonicalRoboticsPolicyCommand(method, path, keyVersion, signedAt string, body []byte) []byte {
	bodyHash := sha256.Sum256(body)
	payload := strings.Join([]string{
		strings.ToUpper(strings.TrimSpace(method)),
		strings.TrimSpace(path),
		strings.TrimSpace(keyVersion),
		strings.TrimSpace(signedAt),
		hex.EncodeToString(bodyHash[:]),
	}, "\n")
	return []byte(payload)
}

func insertRoboticsPolicyLifecycleAudit(exec interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
}, ctx context.Context, tenantID string, policy *roboticsPolicyResponse, action string, actor roboticsPolicyActor, previousStatus string) error {
	if policy == nil {
		return nil
	}
	snapshot, err := json.Marshal(policy)
	if err != nil {
		return err
	}
	_, err = exec.ExecContext(ctx, `
		INSERT INTO robotics_policy_lifecycle_audit (
			tenant_id, policy_version, action, actor_id, actor_email,
			signer_identity, signer_key_version, command_signature,
			previous_status, new_status, policy_snapshot, occurred_at
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), $10, $11, NOW())`,
		tenantID,
		policy.PolicyVersion,
		action,
		actor.ID,
		actor.Email,
		actor.SignerIdentity,
		actor.SignerKeyVersion,
		actor.CommandSignature,
		previousStatus,
		policy.Status,
		snapshot,
	)
	return err
}

func createDraftRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		var req roboticsPolicyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		policy, err := upsertDraftRoboticsPolicy(c, db, actor.ID, req)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[RoboticsPolicy] create draft failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertRoboticsPolicyLifecycleAudit(db, c.Context(), actor.ID, policy, "draft", actor, ""); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[RoboticsPolicy] draft audit failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(policy)
	}
}

func updateDraftRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		var req roboticsPolicyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		req.PolicyVersion = c.Params("version")
		policy, err := upsertDraftRoboticsPolicy(c, db, actor.ID, req)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("policy_version", req.PolicyVersion).Msg("[RoboticsPolicy] update draft failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertRoboticsPolicyLifecycleAudit(db, c.Context(), actor.ID, policy, "update", actor, "draft"); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("policy_version", req.PolicyVersion).Msg("[RoboticsPolicy] update audit failed")
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
		actor, authErr := roboticsPolicyActorForWrite(c, db)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
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
			allowed, actor.ID, actor.ID, policyVersion,
		)
		policy, err := scanRoboticsPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("policy_version", policyVersion).Msg("[RoboticsPolicy] allow-list update failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertRoboticsPolicyLifecycleAudit(db, c.Context(), actor.ID, policy, "allow_list", actor, policy.Status); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("policy_version", policyVersion).Msg("[RoboticsPolicy] allow-list audit failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(policy)
	}
}

func activateRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
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
			WHERE tenant_id = $2 AND active = true`, actor.ID, actor.ID); err != nil {
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
			          revoked_by, created_at, updated_at`, actor.ID, actor.ID, policyVersion)
		policy, err := scanRoboticsPolicy(row)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "policy_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertRoboticsPolicyLifecycleAudit(tx, c.Context(), actor.ID, policy, "activate", actor, "draft"); err != nil {
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
		actor, authErr := roboticsPolicyActorForWrite(c, db)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		policyVersion := normalizePolicyVersion(c.Params("version"))
		timestampColumn := "expired_at"
		args := []interface{}{status, actor.ID, policyVersion}
		extra := ""
		if status == "revoked" {
			timestampColumn = "revoked_at"
			extra = ", revoked_by = $4"
			args = append(args, actor.ID)
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
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("policy_version", policyVersion).Msg("[RoboticsPolicy] lifecycle update failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		auditAction := status
		if status == "expired" {
			auditAction = "expire"
		}
		if status == "revoked" {
			auditAction = "revoke"
		}
		if err := insertRoboticsPolicyLifecycleAudit(db, c.Context(), actor.ID, policy, auditAction, actor, "active"); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("policy_version", policyVersion).Msg("[RoboticsPolicy] lifecycle audit failed")
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
