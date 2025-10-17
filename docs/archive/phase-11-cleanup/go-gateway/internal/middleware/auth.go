package middleware

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT claims
type Claims struct {
	UserID   string   `json:"user_id"`
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
	jwt.RegisteredClaims
}

// AuthConfig holds authentication middleware configuration
type AuthConfig struct {
	JWTSecret      string
	TokenLookup    string // "header:Authorization" or "cookie:token"
	TokenPrefix    string // "Bearer "
	SkipPaths      []string
	RequiredRoles  []string
}

// AuthMiddleware creates a JWT authentication middleware
func AuthMiddleware(config AuthConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip authentication for certain paths
		path := c.Path()
		for _, skipPath := range config.SkipPaths {
			if strings.HasPrefix(path, skipPath) {
				return c.Next()
			}
		}

		// Extract token from request
		token := extractToken(c, config.TokenLookup, config.TokenPrefix)
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing or invalid authorization token",
			})
		}

		// Parse and validate token
		claims, err := validateToken(token, config.JWTSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
				"details": err.Error(),
			})
		}

		// Check required roles if specified
		if len(config.RequiredRoles) > 0 {
			if !hasRequiredRole(claims.Roles, config.RequiredRoles) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "Insufficient permissions",
				})
			}
		}

		// Store claims in context
		c.Locals("user_id", claims.UserID)
		c.Locals("user_email", claims.Email)
		c.Locals("user_roles", claims.Roles)
		c.Locals("claims", claims)

		return c.Next()
	}
}

// extractToken extracts JWT token from request based on TokenLookup config
func extractToken(c *fiber.Ctx, tokenLookup, tokenPrefix string) string {
	parts := strings.Split(tokenLookup, ":")
	if len(parts) != 2 {
		return ""
	}

	source := parts[0]
	key := parts[1]

	var token string
	switch source {
	case "header":
		token = c.Get(key)
	case "cookie":
		token = c.Cookies(key)
	case "query":
		token = c.Query(key)
	}

	// Remove prefix if specified
	if tokenPrefix != "" && strings.HasPrefix(token, tokenPrefix) {
		token = strings.TrimPrefix(token, tokenPrefix)
	}

	return token
}

// validateToken validates JWT token and returns claims
func validateToken(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, jwt.ErrInvalidKey
}

// hasRequiredRole checks if user has at least one of the required roles
func hasRequiredRole(userRoles, requiredRoles []string) bool {
	roleMap := make(map[string]bool)
	for _, role := range userRoles {
		roleMap[role] = true
	}

	for _, required := range requiredRoles {
		if roleMap[required] {
			return true
		}
	}

	return false
}

// GetUserID retrieves user ID from context
func GetUserID(c *fiber.Ctx) string {
	if userID, ok := c.Locals("user_id").(string); ok {
		return userID
	}
	return ""
}

// GetUserEmail retrieves user email from context
func GetUserEmail(c *fiber.Ctx) string {
	if email, ok := c.Locals("user_email").(string); ok {
		return email
	}
	return ""
}

// GetUserRoles retrieves user roles from context
func GetUserRoles(c *fiber.Ctx) []string {
	if roles, ok := c.Locals("user_roles").([]string); ok {
		return roles
	}
	return []string{}
}

// GenerateToken generates a new JWT token (helper for auth endpoints)
func GenerateToken(userID, email string, roles []string, secret string, expiration time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Roles:  roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
