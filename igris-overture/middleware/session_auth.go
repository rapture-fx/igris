// Package middleware provides Better Auth session validation for the Igris Overture API.
// Sessions are cookie-based (set by the Next.js web-console via Better Auth).
//
// Better Auth (via better-call) signs cookies as:
//   encodeURIComponent("<raw_token>.<HMAC-SHA256-base64>")
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

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// BetterAuth validates the Better Auth session cookie and auto-provisions a tenant
// record for new users on their first authenticated request.
func BetterAuth(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
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

		userID, email, name, err := lookupSession(db, rawToken)
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

		// Auto-provision tenant on first authenticated request
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

func lookupSession(db *sql.DB, token string) (userID, email, name string, err error) {
	err = db.QueryRow(`
		SELECT u.id, COALESCE(u.email, ''), COALESCE(u.name, '')
		FROM session s
		JOIN "user" u ON u.id = s."userId"
		WHERE s.token = $1 AND s."expiresAt" > NOW()
	`, token).Scan(&userID, &email, &name)
	return
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
