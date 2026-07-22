// Package middleware provides Better Auth session validation for the Igris Overture API.
// Sessions are cookie-based (set by the Next.js web-console via Better Auth).
//
// Better Auth (via better-call) signs cookies as:
//
//	encodeURIComponent("<raw_token>.<HMAC-SHA256-base64>")
//
// The raw_token is what is stored in the session.token column.
// We must URL-decode and strip the signature before the DB lookup.
package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"net/url"
	"os"
	"strings"

	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// BetterAuth validates the Better Auth session cookie or a Bearer API key,
// and auto-provisions a tenant record for new users on their first request.
func BetterAuth(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// --- API key path (Bearer token or X-API-Key header) ---
		apiKey := c.Get("X-API-Key")
		if apiKey == "" {
			if auth := c.Get("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
				apiKey = auth[7:]
			}
		}
		if apiKey != "" && len(apiKey) > 6 && apiKey[:6] == "igris_" {
			keyHash := security.HashAPIKey(apiKey)
			var tenantID, name, email string
			err := db.QueryRowContext(c.Context(), `
				SELECT tenant_id, COALESCE(tenant_name,''), COALESCE(tenant_email,'')
				FROM tenants WHERE api_key_hash = $1 AND COALESCE(is_active, true) = true
			`, keyHash).Scan(&tenantID, &name, &email)

			// Fallback: named tenant keys — agent/app keys and runtime keys —
			// live in tenant_api_keys, separate from the tenant's primary
			// api_key_hash (the console service key). This is what lets an
			// agent call action endpoints with a key minted in Settings without
			// ever rotating the console's own credential. Stays tenant-scoped:
			// the tenant_id is resolved from the matched row, never the caller.
			if err == sql.ErrNoRows {
				err = db.QueryRowContext(c.Context(), `
					SELECT t.tenant_id, COALESCE(t.tenant_name,''), COALESCE(t.tenant_email,'')
					FROM tenant_api_keys k
					JOIN tenants t ON t.tenant_id = k.tenant_id
					WHERE k.key_hash = $1 AND k.status = 'active'
					  AND COALESCE(t.is_active, true) = true
					LIMIT 1
				`, keyHash).Scan(&tenantID, &name, &email)
			}
			if err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "unauthorized",
					"code":  "INVALID_API_KEY",
				})
			}
			c.Locals("clerk_user_id", tenantID)
			c.Locals("clerk_email", email)
			c.Locals("auth_method", "api_key")
			c.Locals("tenant", &TenantContext{TenantID: tenantID, TenantName: name})
			return c.Next()
		}

		// --- Session cookie path ---
		// Better Auth uses __Secure- prefix on HTTPS (production).
		// Try both names so the same binary works locally and in prod.
		cookieValue := c.Cookies("__Secure-better-auth.session_token")
		if cookieValue == "" {
			cookieValue = c.Cookies("better-auth.session_token")
		}
		if cookieValue == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "MISSING_SESSION",
			})
		}

		// Extract the raw session token from the signed cookie value.
		rawToken := extractSessionToken(cookieValue)

		userID, email, name, role, err := lookupSession(db, rawToken)
		if err != nil {
			if err != sql.ErrNoRows {
				log.Error().Err(err).Msg("[Auth] Session lookup failed")
			} else {
				log.Warn().Str("token_prefix", safePrefix(rawToken)).Msg("[Auth] Session not found or expired")
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "INVALID_SESSION",
			})
		}

		// Auto-provision tenant on first authenticated request.
		// On conflict, backfill name/email if they were previously empty
		// (e.g. tenant row created before OAuth display name was available).
		_, _ = db.Exec(`
			INSERT INTO tenants (tenant_id, tenant_name, tenant_email)
			VALUES ($1, $2, $3)
			ON CONFLICT (tenant_id) DO UPDATE SET
				tenant_name  = CASE WHEN tenants.tenant_name  = '' OR tenants.tenant_name  IS NULL THEN EXCLUDED.tenant_name  ELSE tenants.tenant_name  END,
				tenant_email = CASE WHEN tenants.tenant_email = '' OR tenants.tenant_email IS NULL THEN EXCLUDED.tenant_email ELSE tenants.tenant_email END
		`, userID, name, email)

		setBetterAuthSessionContext(c, userID, email, name, role)
		return c.Next()
	}
}

// extractSessionToken parses the signed cookie produced by better-call:
//
//	signCookieValue(token, secret) = encodeURIComponent(token + "." + base64(HMAC-SHA256(token, secret)))
//
// Returns the raw token (part before the last ".").
// If the cookie is not in signed format, returns the value as-is.
func extractSessionToken(cookieValue string) string {
	// 1. URL-decode: better-call uses encodeURIComponent which encodes +, /, = in the base64 signature
	decoded, err := url.QueryUnescape(cookieValue)
	if err != nil {
		decoded = cookieValue
	}

	// 2. Find the last "." separating raw token from HMAC signature
	dotIdx := strings.LastIndex(decoded, ".")
	if dotIdx < 1 {
		// No signature found — use value as-is (shouldn't happen in prod)
		return decoded
	}

	token := decoded[:dotIdx]
	signature := decoded[dotIdx+1:]

	// 3. Verify HMAC-SHA256 signature using BETTER_AUTH_SECRET (defense in depth)
	secret := os.Getenv("BETTER_AUTH_SECRET")
	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(token))
		expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(signature), []byte(expected)) {
			log.Warn().Str("token_prefix", safePrefix(token)).Msg("[Auth] Cookie HMAC signature mismatch")
			// Still proceed with DB lookup; DB is the authoritative validation gate
		}
	}

	return token
}

func lookupSession(db *sql.DB, token string) (userID, email, name, role string, err error) {
	err = db.QueryRow(`
		SELECT u.id, COALESCE(u.email, ''), COALESCE(u.name, ''), COALESCE(u.role, 'user')
		FROM session s
		JOIN "user" u ON u.id = s."userId"
		WHERE s.token = $1 AND s."expiresAt" > NOW()
	`, token).Scan(&userID, &email, &name, &role)
	return
}

func splitBetterAuthRoles(value string) []string {
	parts := strings.Split(value, ",")
	roles := make([]string, 0, len(parts))
	for _, part := range parts {
		role := strings.TrimSpace(part)
		if role != "" {
			roles = append(roles, role)
		}
	}
	return roles
}

func hasExactRole(roles []string, expected string) bool {
	for _, role := range roles {
		if role == expected {
			return true
		}
	}
	return false
}

func setBetterAuthSessionContext(c *fiber.Ctx, userID, email, name, role string) {
	// Keep the established locals keys so existing handlers and RBAC checks
	// share one server-derived operator identity.
	c.Locals("clerk_user_id", userID)
	c.Locals("clerk_email", email)
	c.Locals("auth_method", "session")
	roles := splitBetterAuthRoles(role)
	c.Locals("clerk_role", role)
	c.Locals("clerk_roles", roles)
	c.Locals("tenant", &TenantContext{
		TenantID:   userID,
		TenantName: name,
		Roles:      roles,
		IsAdmin:    hasExactRole(roles, "admin"),
	})
}

func safePrefix(s string) string {
	if len(s) > 8 {
		return s[:8]
	}
	return s
}

// GetClerkUserID returns the authenticated user ID from request locals.
// Kept as-is for backwards compatibility with all existing handlers.
func GetClerkUserID(c *fiber.Ctx) string {
	if v := c.Locals("clerk_user_id"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// GetClerkEmail returns the authenticated user's email from request locals.
func GetClerkEmail(c *fiber.Ctx) string {
	if v := c.Locals("clerk_email"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
