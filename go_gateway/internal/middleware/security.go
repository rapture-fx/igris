package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// SecurityConfig holds security middleware configuration
type SecurityConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
	ExposeHeaders  []string
}

// SetupSecurityMiddleware configures all security middleware
func SetupSecurityMiddleware(app *fiber.App, config *SecurityConfig) {
	// Panic recovery
	app.Use(recover.New(recover.Config{
		EnableStackTrace: true,
	}))

	// Security headers (helmet)
	app.Use(helmet.New())

	// CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins:     getOrigins(config.AllowedOrigins),
		AllowMethods:     getMethods(config.AllowedMethods),
		AllowHeaders:     getHeaders(config.AllowedHeaders),
		AllowCredentials: true,
		MaxAge:           86400, // 24 hours
	}))
}

func getOrigins(origins []string) string {
	if len(origins) == 0 {
		return "http://localhost:3000,http://localhost:3002,http://localhost:3004"
	}
	result := ""
	for i, origin := range origins {
		if i > 0 {
			result += ","
		}
		result += origin
	}
	return result
}

func getMethods(methods []string) string {
	if len(methods) == 0 {
		return "GET,POST,PUT,DELETE,OPTIONS"
	}
	result := ""
	for i, method := range methods {
		if i > 0 {
			result += ","
		}
		result += method
	}
	return result
}

func getHeaders(headers []string) string {
	if len(headers) == 0 {
		return "Origin,Content-Type,Accept,Authorization,X-API-Key"
	}
	result := ""
	for i, header := range headers {
		if i > 0 {
			result += ","
		}
		result += header
	}
	return result
}
