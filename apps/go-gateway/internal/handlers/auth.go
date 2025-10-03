package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/gateway/internal/middleware"
	"gorm.io/gorm"
)

// LoginRequest represents login request body
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// RegisterRequest represents registration request body
type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	Name     string `json:"name" validate:"required"`
}

// Login handles user login
func Login(cfg interface{}, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req LoginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// TODO: Validate credentials against database
		// For now, return a mock token

		// Get config
		type Config interface {
			JWTSecret     string
			JWTExpiration time.Duration
		}

		var jwtSecret string
		var jwtExpiration time.Duration
		if config, ok := cfg.(Config); ok {
			jwtSecret = config.JWTSecret
			jwtExpiration = config.JWTExpiration
		}

		// Generate token
		token, err := middleware.GenerateToken(
			"user-123", // TODO: Get from database
			req.Email,
			[]string{"user"},
			jwtSecret,
			jwtExpiration,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to generate token",
			})
		}

		return c.JSON(fiber.Map{
			"access_token": token,
			"token_type":   "Bearer",
			"expires_in":   int(jwtExpiration.Seconds()),
			"user": fiber.Map{
				"id":    "user-123",
				"email": req.Email,
				"roles": []string{"user"},
			},
		})
	}
}

// Register handles user registration
func Register(cfg interface{}, db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req RegisterRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// TODO: Create user in database
		// TODO: Hash password
		// For now, return success

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"message": "User registered successfully",
			"user": fiber.Map{
				"email": req.Email,
				"name":  req.Name,
			},
		})
	}
}

// RefreshToken handles token refresh
func RefreshToken(cfg interface{}) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Implement token refresh logic
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
			"error": "Token refresh not implemented yet",
		})
	}
}

// GetCurrentUser returns current user information
func GetCurrentUser(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := middleware.GetUserID(c)
		email := middleware.GetUserEmail(c)
		roles := middleware.GetUserRoles(c)

		// TODO: Fetch full user data from database

		return c.JSON(fiber.Map{
			"id":    userID,
			"email": email,
			"roles": roles,
		})
	}
}

// UpdateCurrentUser updates current user information
func UpdateCurrentUser(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := middleware.GetUserID(c)

		// TODO: Parse request body and update user in database

		return c.JSON(fiber.Map{
			"message": "User updated successfully",
			"user_id": userID,
		})
	}
}

// ListUsers returns list of users (admin only)
func ListUsers(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Fetch users from database with pagination

		return c.JSON(fiber.Map{
			"users": []fiber.Map{
				{
					"id":    "user-123",
					"email": "user@example.com",
					"roles": []string{"user"},
				},
			},
			"total": 1,
		})
	}
}
