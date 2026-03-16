// Package middleware provides Better Auth session validation for the Igris Overture API.
// Sessions are cookie-based (set by the Next.js web-console via Better Auth).
// The Go backend validates sessions by looking up the token in the session table.
package middleware

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// BetterAuth validates the Better Auth session cookie and auto-provisions a tenant
// record for new users on their first authenticated request.
func BetterAuth(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Better Auth uses __Secure- prefix on HTTPS (production).
		// Try both names so the same binary works locally and in prod.
		sessionToken := c.Cookies("__Secure-better-auth.session_token")
		if sessionToken == "" {
			sessionToken = c.Cookies("better-auth.session_token")
		}
		if sessionToken == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "MISSING_SESSION",
			})
		}

		userID, email, name, err := lookupSession(db, sessionToken)
		if err == sql.ErrNoRows {
			// Better Auth may store only the session ID portion (before the ".")
			// in the DB while setting the full "id.signature" value in the cookie.
			if dotIdx := strings.Index(sessionToken, "."); dotIdx > 0 {
				userID, email, name, err = lookupSession(db, sessionToken[:dotIdx])
			}
		}
		if err != nil {
			if err != sql.ErrNoRows {
				log.Error().Err(err).Msg("[Auth] Session lookup failed")
			} else {
				prefix := sessionToken
				if len(prefix) > 8 {
					prefix = prefix[:8]
				}
				log.Warn().Str("token_prefix", prefix).Msg("[Auth] Session not found or expired")
			}
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"code":  "INVALID_SESSION",
			})
		}

		// Auto-provision tenant on first request
		_, _ = db.Exec(`
			INSERT INTO tenants (tenant_id, tenant_name, email, api_key_hash, api_key_prefix)
			VALUES ($1, $2, $3, 'placeholder', 'igk_')
			ON CONFLICT (tenant_id) DO NOTHING
		`, userID, name, email)

		// Keep same locals keys so all existing handlers work unchanged
		c.Locals("clerk_user_id", userID)
		c.Locals("clerk_email", email)
		return c.Next()
	}
}

func lookupSession(db *sql.DB, token string) (userID, email, name string, err error) {
	err = db.QueryRow(`
		SELECT u.id, COALESCE(u.email, ''), COALESCE(u.name, '')
		FROM session s
		JOIN "user" u ON u.id = s."userId"
		WHERE s.token = $1 AND s."expiresAt" > NOW()
	`, token).Scan(&userID, &email, &name)
	return
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
