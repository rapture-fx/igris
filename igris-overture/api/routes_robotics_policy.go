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
	CommandNonce     string
	CommandHash      string
	CommandSignature string
}

const (
	roboticsPolicySignerHeader        = "X-Igris-Policy-Signer"
	roboticsPolicyKeyVersionHeader    = "X-Igris-Policy-Key-Version"
	roboticsPolicySignatureHeader     = "X-Igris-Policy-Signature"
	roboticsPolicySignedAtHeader      = "X-Igris-Policy-Signed-At"
	roboticsPolicyNonceHeader         = "X-Igris-Policy-Nonce"
	roboticsPolicyCommandMaxClockSkew = 5 * time.Minute
)

type roboticsPolicySigningKeyRequest struct {
	KeyVersion       string     `json:"key_version"`
	SignerIdentity   string     `json:"signer_identity"`
	PublicKeyEd25519 string     `json:"public_key_ed25519"`
	NotBefore        *time.Time `json:"not_before,omitempty"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
}

type roboticsPolicySigningKeyResponse struct {
	TenantID         string     `json:"tenant_id"`
	KeyVersion       string     `json:"key_version"`
	SignerIdentity   string     `json:"signer_identity"`
	PublicKeyEd25519 string     `json:"public_key_ed25519"`
	Status           string     `json:"status"`
	NotBefore        time.Time  `json:"not_before"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	CreatedBy        string     `json:"created_by,omitempty"`
	RevokedBy        string     `json:"revoked_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func RegisterRoboticsPolicyRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Robotics policy endpoints disabled — database not available")
		return
	}

	v1 := app.Group("/v1/robotics/policies")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", listRoboticsPolicies(db))
	v1.Get("/signing-keys", listRoboticsPolicySigningKeys(db))
	v1.Post("/signing-keys", createRoboticsPolicySigningKey(db))
	v1.Post("/signing-keys/:version/activate", roboticsPolicySigningKeyLifecycleUpdate(db, "active"))
	v1.Post("/signing-keys/:version/revoke", roboticsPolicySigningKeyLifecycleUpdate(db, "revoked"))
	v1.Post("/signing-keys/:version/expire", roboticsPolicySigningKeyLifecycleUpdate(db, "expired"))
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

func roboticsPolicyActorForWrite(c *fiber.Ctx, db *sql.DB, action string) (roboticsPolicyActor, error) {
	actor, err := roboticsPolicyActorFromContext(c)
	if err != nil {
		return actor, err
	}
	if err := verifyRoboticsPolicyCommandSignature(c, db, &actor, action); err != nil {
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

func verifyRoboticsPolicyCommandSignature(c *fiber.Ctx, db *sql.DB, actor *roboticsPolicyActor, action string) error {
	if db == nil || actor == nil {
		return fiber.NewError(http.StatusUnauthorized, "policy_signature_required")
	}
	action = strings.TrimSpace(action)
	keyVersion := strings.TrimSpace(c.Get(roboticsPolicyKeyVersionHeader))
	signatureValue := strings.TrimSpace(c.Get(roboticsPolicySignatureHeader))
	signedAtValue := strings.TrimSpace(c.Get(roboticsPolicySignedAtHeader))
	nonce := strings.TrimSpace(c.Get(roboticsPolicyNonceHeader))
	if keyVersion == "" || signatureValue == "" || signedAtValue == "" || nonce == "" || action == "" {
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
	canonical := canonicalRoboticsPolicyCommand(c.Method(), c.Path(), keyVersion, signedAtValue, nonce, action, c.Body())
	sum := sha256.Sum256(canonical)
	if !ed25519.Verify(ed25519.PublicKey(publicKeyBytes), sum[:], signatureBytes) {
		return fiber.NewError(http.StatusForbidden, "invalid_policy_signature")
	}
	requestSigner := strings.TrimSpace(c.Get(roboticsPolicySignerHeader))
	if requestSigner != "" && requestSigner != signerIdentity {
		return fiber.NewError(http.StatusForbidden, "policy_signer_identity_mismatch")
	}
	commandHash := hex.EncodeToString(sum[:])
	result, err := db.ExecContext(c.Context(), `
		INSERT INTO robotics_policy_command_nonces (
			tenant_id, key_version, action, nonce, command_hash,
			command_signature, actor_id, signer_identity, signed_at, expires_at, consumed_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (tenant_id, key_version, action, nonce) DO NOTHING`,
		actor.ID,
		keyVersion,
		action,
		nonce,
		commandHash,
		signatureValue,
		actor.ID,
		signerIdentity,
		signedAt,
		signedAt.Add(roboticsPolicyCommandMaxClockSkew),
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", actor.ID).Str("key_version", keyVersion).Str("action", action).Msg("[RoboticsPolicy] nonce insert failed")
		return fiber.NewError(http.StatusInternalServerError, "db_error")
	}
	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected == 0 {
		return fiber.NewError(http.StatusConflict, "policy_command_replay")
	}
	actor.SignerIdentity = signerIdentity
	actor.SignerKeyVersion = keyVersion
	actor.CommandNonce = nonce
	actor.CommandHash = commandHash
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

func canonicalRoboticsPolicyCommand(method, path, keyVersion, signedAt, nonce, action string, body []byte) []byte {
	bodyHash := sha256.Sum256(body)
	payload := strings.Join([]string{
		strings.ToUpper(strings.TrimSpace(method)),
		strings.TrimSpace(path),
		strings.TrimSpace(keyVersion),
		strings.TrimSpace(signedAt),
		strings.TrimSpace(nonce),
		strings.TrimSpace(action),
		hex.EncodeToString(bodyHash[:]),
	}, "\n")
	return []byte(payload)
}

// CleanupExpiredRoboticsPolicyCommandNonces removes consumed lifecycle command
// nonces after their replay-protection window has elapsed.
func CleanupExpiredRoboticsPolicyCommandNonces(ctx context.Context, db *sql.DB) (int64, error) {
	if db == nil {
		return 0, nil
	}
	result, err := db.ExecContext(ctx, `
		DELETE FROM robotics_policy_command_nonces
		WHERE expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, nil
	}
	return rowsAffected, nil
}

func StartRoboticsPolicyCommandNonceCleanup(ctx context.Context, db *sql.DB, interval time.Duration) {
	if db == nil {
		return
	}
	if interval <= 0 {
		interval = time.Hour
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				deleted, err := CleanupExpiredRoboticsPolicyCommandNonces(ctx, db)
				if err != nil {
					log.Error().Err(err).Msg("[RoboticsPolicy] nonce cleanup failed")
					continue
				}
				if deleted > 0 {
					log.Info().Int64("deleted", deleted).Msg("[RoboticsPolicy] expired command nonces cleaned")
				}
			}
		}
	}()
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
			command_nonce, command_hash, previous_status, new_status,
			policy_snapshot, occurred_at
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''), $12, $13, NOW())`,
		tenantID,
		policy.PolicyVersion,
		action,
		actor.ID,
		actor.Email,
		actor.SignerIdentity,
		actor.SignerKeyVersion,
		actor.CommandSignature,
		actor.CommandNonce,
		actor.CommandHash,
		previousStatus,
		policy.Status,
		snapshot,
	)
	return err
}

func createDraftRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db, "draft")
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

func listRoboticsPolicySigningKeys(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorFromContext(c)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		rows, err := db.QueryContext(c.Context(), `
			SELECT tenant_id, key_version, signer_identity, public_key_ed25519,
			       status, not_before, expires_at, created_by, revoked_by,
			       created_at, updated_at
			FROM robotics_policy_signing_keys
			WHERE tenant_id = $1
			ORDER BY updated_at DESC
			LIMIT 100`, actor.ID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[RoboticsPolicy] list signing keys failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer rows.Close()
		keys := make([]*roboticsPolicySigningKeyResponse, 0)
		for rows.Next() {
			key, err := scanRoboticsPolicySigningKey(rows)
			if err != nil {
				log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[RoboticsPolicy] scan signing key failed")
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			keys = append(keys, key)
		}
		if err := rows.Err(); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"signing_keys": keys, "total": len(keys)})
	}
}

func createRoboticsPolicySigningKey(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorFromContext(c)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		hasActiveKey, err := roboticsPolicyTenantHasActiveSigningKey(c, db, actor.ID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Msg("[RoboticsPolicy] signing key bootstrap lookup failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if hasActiveKey {
			if err := verifyRoboticsPolicyCommandSignature(c, db, &actor, "signing_key_create"); err != nil {
				return roboticsPolicyAuthError(c, err)
			}
		}

		var req roboticsPolicySigningKeyRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		req.KeyVersion = strings.TrimSpace(req.KeyVersion)
		req.SignerIdentity = strings.TrimSpace(req.SignerIdentity)
		req.PublicKeyEd25519 = strings.TrimSpace(req.PublicKeyEd25519)
		if req.KeyVersion == "" || req.PublicKeyEd25519 == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_signing_key"})
		}
		if req.SignerIdentity == "" {
			req.SignerIdentity = actor.SignerIdentity
		}
		if decoded, err := hex.DecodeString(req.PublicKeyEd25519); err != nil || len(decoded) != ed25519.PublicKeySize {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_public_key"})
		}

		row := db.QueryRowContext(c.Context(), `
			INSERT INTO robotics_policy_signing_keys (
				tenant_id, key_version, signer_identity, public_key_ed25519,
				status, not_before, expires_at, created_by, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, 'draft', COALESCE($5, NOW()), $6, $7, NOW(), NOW())
			RETURNING tenant_id, key_version, signer_identity, public_key_ed25519,
			          status, not_before, expires_at, created_by, revoked_by,
			          created_at, updated_at`,
			actor.ID,
			req.KeyVersion,
			req.SignerIdentity,
			req.PublicKeyEd25519,
			req.NotBefore,
			req.ExpiresAt,
			actor.ID,
		)
		key, err := scanRoboticsPolicySigningKey(row)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("key_version", req.KeyVersion).Msg("[RoboticsPolicy] create signing key failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := insertRoboticsPolicySigningKeyAudit(db, c.Context(), key, "create", actor, ""); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("key_version", key.KeyVersion).Msg("[RoboticsPolicy] create signing key audit failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(key)
	}
}

func roboticsPolicySigningKeyLifecycleUpdate(db *sql.DB, status string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		action := "signing_key_" + strings.TrimSuffix(status, "d")
		if status == "active" {
			action = "signing_key_activate"
		}
		actor, authErr := roboticsPolicyActorForWrite(c, db, action)
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		keyVersion := strings.TrimSpace(c.Params("version"))
		if keyVersion == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_key_version"})
		}
		previousStatus := ""
		if err := db.QueryRowContext(c.Context(), `
			SELECT status
			FROM robotics_policy_signing_keys
			WHERE tenant_id = $1 AND key_version = $2`, actor.ID, keyVersion).Scan(&previousStatus); err != nil {
			if err == sql.ErrNoRows {
				return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "signing_key_not_found"})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		revokedBySQL := "revoked_by"
		revokedByArg := ""
		if status == "revoked" {
			revokedBySQL = "$4"
			revokedByArg = actor.ID
		}
		args := []interface{}{status, actor.ID, keyVersion}
		if status == "revoked" {
			args = append(args, revokedByArg)
		}
		row := db.QueryRowContext(c.Context(), `
			UPDATE robotics_policy_signing_keys
			SET status = $1,
			    revoked_by = `+revokedBySQL+`,
			    updated_at = NOW()
			WHERE tenant_id = $2 AND key_version = $3
			RETURNING tenant_id, key_version, signer_identity, public_key_ed25519,
			          status, not_before, expires_at, created_by, revoked_by,
			          created_at, updated_at`,
			args...,
		)
		key, err := scanRoboticsPolicySigningKey(row)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "signing_key_not_found"})
			}
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("key_version", keyVersion).Msg("[RoboticsPolicy] signing key lifecycle update failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		auditAction := "activate"
		if status == "revoked" {
			auditAction = "revoke"
		}
		if status == "expired" {
			auditAction = "expire"
		}
		if err := insertRoboticsPolicySigningKeyAudit(db, c.Context(), key, auditAction, actor, previousStatus); err != nil {
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("key_version", keyVersion).Msg("[RoboticsPolicy] signing key lifecycle audit failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(key)
	}
}

func roboticsPolicyTenantHasActiveSigningKey(c *fiber.Ctx, db *sql.DB, tenantID string) (bool, error) {
	var exists bool
	err := db.QueryRowContext(c.Context(), `
		SELECT EXISTS (
			SELECT 1
			FROM robotics_policy_signing_keys
			WHERE tenant_id = $1
			  AND status = 'active'
			  AND not_before <= NOW()
			  AND (expires_at IS NULL OR expires_at > NOW())
		)`, tenantID).Scan(&exists)
	return exists, err
}

func insertRoboticsPolicySigningKeyAudit(exec interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
}, ctx context.Context, key *roboticsPolicySigningKeyResponse, action string, actor roboticsPolicyActor, previousStatus string) error {
	if key == nil {
		return nil
	}
	snapshot, err := json.Marshal(key)
	if err != nil {
		return err
	}
	_, err = exec.ExecContext(ctx, `
		INSERT INTO robotics_policy_key_lifecycle_audit (
			tenant_id, key_version, action, actor_id, actor_email,
			signer_identity, signer_key_version, command_nonce, command_hash,
			command_signature, previous_status, new_status, key_snapshot, occurred_at
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''), $12, $13, NOW())`,
		key.TenantID,
		key.KeyVersion,
		action,
		actor.ID,
		actor.Email,
		actor.SignerIdentity,
		actor.SignerKeyVersion,
		actor.CommandNonce,
		actor.CommandHash,
		actor.CommandSignature,
		previousStatus,
		key.Status,
		snapshot,
	)
	return err
}

func updateDraftRoboticsPolicy(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db, "update")
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
		actor, authErr := roboticsPolicyActorForWrite(c, db, "allow_list")
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
		actor, authErr := roboticsPolicyActorForWrite(c, db, "activate")
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

func scanRoboticsPolicySigningKey(row interface{ Scan(...interface{}) error }) (*roboticsPolicySigningKeyResponse, error) {
	var key roboticsPolicySigningKeyResponse
	var expiresAt sql.NullTime
	var createdBy, revokedBy sql.NullString
	if err := row.Scan(
		&key.TenantID,
		&key.KeyVersion,
		&key.SignerIdentity,
		&key.PublicKeyEd25519,
		&key.Status,
		&key.NotBefore,
		&expiresAt,
		&createdBy,
		&revokedBy,
		&key.CreatedAt,
		&key.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		key.ExpiresAt = &expiresAt.Time
	}
	if createdBy.Valid {
		key.CreatedBy = createdBy.String
	}
	if revokedBy.Valid {
		key.RevokedBy = revokedBy.String
	}
	return &key, nil
}
