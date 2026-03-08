// Package middleware provides Clerk JWT verification for the Igris Overture API.
// The web-console frontend sends Clerk session tokens as Authorization: Bearer <token>.
// This middleware validates those tokens using Clerk's published JWKS endpoint.
package middleware

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// ClerkClaims represents the JWT claims embedded in a Clerk session token.
// Clerk uses RS256 and signs tokens with keys published at /.well-known/jwks.json.
type ClerkClaims struct {
	jwt.RegisteredClaims

	// Standard identity fields populated by Clerk
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"email_verified,omitempty"`

	// Clerk-specific session and organisation fields
	SessionID string `json:"sid,omitempty"`
	OrgID     string `json:"org_id,omitempty"`
	OrgRole   string `json:"org_role,omitempty"`
}

// clerkJWKS is the package-level JWKS keyfunc initialised by InitClerkJWKS.
// It is intentionally unexported — callers use ClerkAuth() and InitClerkJWKS().
var clerkJWKS keyfunc.Keyfunc

// InitClerkJWKS fetches Clerk's JWKS and keeps it refreshed in the background.
// Call this once at application startup, before registering any routes.
//
// Required env vars (one of):
//   - CLERK_JWKS_URL — full URL to the JWKS endpoint, e.g.
//     https://<instance>.clerk.accounts.dev/.well-known/jwks.json
//   - CLERK_FRONTEND_API — Clerk frontend API base URL; JWKS path is appended.
//
// Returns an error if neither variable is set or if the initial fetch fails.
func InitClerkJWKS() error {
	jwksURL := os.Getenv("CLERK_JWKS_URL")
	if jwksURL == "" {
		frontendAPI := os.Getenv("CLERK_FRONTEND_API")
		if frontendAPI == "" {
			return fmt.Errorf("clerk: CLERK_JWKS_URL or CLERK_FRONTEND_API must be set")
		}
		jwksURL = strings.TrimRight(frontendAPI, "/") + "/.well-known/jwks.json"
	}

	kf, err := keyfunc.NewDefaultCtx(context.Background(), []string{jwksURL})
	if err != nil {
		return fmt.Errorf("clerk: failed to initialise JWKS keyfunc from %s: %w", jwksURL, err)
	}

	clerkJWKS = kf
	return nil
}

// ClerkAuth returns a Fiber middleware that validates Clerk session tokens.
//
// On success it sets the following Fiber locals for downstream handlers:
//   - "clerk_user_id"    — Clerk user ID (JWT `sub` claim, e.g. "user_xxxxxxxx")
//   - "clerk_email"      — user's primary email address
//   - "clerk_session_id" — Clerk session ID (`sid` claim)
//   - "clerk_org_id"     — organisation ID (`org_id` claim), empty if not in an org
//
// Returns 401 Unauthorized if the token is missing, malformed, or invalid.
// Panics if InitClerkJWKS has not been called before the first request.
func ClerkAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if clerkJWKS == nil {
			// Developer error — surface it clearly rather than silently passing.
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Clerk JWKS not initialised — call InitClerkJWKS() at startup",
			})
		}

		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing authorization header",
				"code":  "MISSING_AUTH_HEADER",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid authorization header format — expected: Bearer <token>",
				"code":  "INVALID_AUTH_FORMAT",
			})
		}

		tokenStr := parts[1]

		token, err := jwt.ParseWithClaims(tokenStr, &ClerkClaims{}, clerkJWKS.Keyfunc)
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
				"code":  "INVALID_TOKEN",
			})
		}

		claims, ok := token.Claims.(*ClerkClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token claims",
				"code":  "INVALID_CLAIMS",
			})
		}

		// Populate locals consumed by downstream handlers.
		c.Locals("clerk_user_id", claims.Subject)
		c.Locals("clerk_email", claims.Email)
		c.Locals("clerk_session_id", claims.SessionID)
		c.Locals("clerk_org_id", claims.OrgID)

		return c.Next()
	}
}

// GetClerkUserID is a convenience helper that returns the Clerk user ID stored
// in Fiber locals by ClerkAuth. Returns an empty string if not set.
func GetClerkUserID(c *fiber.Ctx) string {
	if v := c.Locals("clerk_user_id"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// GetClerkEmail returns the email stored in Fiber locals by ClerkAuth.
func GetClerkEmail(c *fiber.Ctx) string {
	if v := c.Locals("clerk_email"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
