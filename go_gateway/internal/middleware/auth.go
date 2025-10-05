package middleware

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT claims structure
type Claims struct {
	UserID   string   `json:"user_id"`
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
	jwt.RegisteredClaims
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWTSecret     string
	TokenDuration time.Duration
	PublicPaths   []string
}

// NewAuthConfig creates a new auth configuration from environment
func NewAuthConfig() *AuthConfig {
	secret := os.Getenv("JWT_SECRET_KEY")
	if secret == "" {
		panic("JWT_SECRET_KEY environment variable is required")
	}

	return &AuthConfig{
		JWTSecret:     secret,
		TokenDuration: 24 * time.Hour,
		PublicPaths: []string{
			"/health",
			"/metrics",
			"/api/v1/auth/login",
			"/api/v1/auth/register",
		},
	}
}

// JWTMiddleware validates JWT tokens
func JWTMiddleware(config *AuthConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if path is public
		path := c.Path()
		for _, publicPath := range config.PublicPaths {
			if strings.HasPrefix(path, publicPath) {
				return c.Next()
			}
		}

		// Extract token from Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authorization header",
			})
		}

		// Expected format: "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authorization header format",
			})
		}

		tokenString := parts[1]

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			// Validate signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(config.JWTSecret), nil
		})

		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		if !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Token validation failed",
			})
		}

		// Extract claims and store in context
		if claims, ok := token.Claims.(*Claims); ok {
			c.Locals("user_id", claims.UserID)
			c.Locals("email", claims.Email)
			c.Locals("roles", claims.Roles)
		}

		return c.Next()
	}
}

// GenerateToken creates a new JWT token for a user
func GenerateToken(config *AuthConfig, userID, email string, roles []string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Roles:  roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(config.TokenDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.JWTSecret))
}

// RequireRole middleware checks if user has required role
func RequireRole(requiredRole string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles := c.Locals("roles")
		if roles == nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "No roles found in token",
			})
		}

		userRoles, ok := roles.([]string)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Invalid roles format",
			})
		}

		// Check if user has required role
		for _, role := range userRoles {
			if role == requiredRole || role == "admin" {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": fmt.Sprintf("Required role: %s", requiredRole),
		})
	}
}

// APIKeyMiddleware validates API keys (alternative to JWT)
type APIKeyConfig struct {
	ValidKeys map[string]string // key -> description
}

func APIKeyMiddleware(config *APIKeyConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := c.Get("X-API-Key")
		if apiKey == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing API key",
			})
		}

		if _, valid := config.ValidKeys[apiKey]; !valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid API key",
			})
		}

		return c.Next()
	}
}
