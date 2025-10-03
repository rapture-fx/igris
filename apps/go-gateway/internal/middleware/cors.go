package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// CORSConfig holds CORS middleware configuration
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	AllowCredentials bool
	MaxAge           int
}

// CORSMiddleware creates a CORS middleware
func CORSMiddleware(config CORSConfig) fiber.Handler {
	// Default configuration
	if len(config.AllowedOrigins) == 0 {
		config.AllowedOrigins = []string{"*"}
	}
	if len(config.AllowedMethods) == 0 {
		config.AllowedMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	}
	if len(config.AllowedHeaders) == 0 {
		config.AllowedHeaders = []string{"Authorization", "Content-Type", "X-Request-ID"}
	}
	if config.MaxAge == 0 {
		config.MaxAge = 3600
	}

	return cors.New(cors.Config{
		AllowOrigins:     joinStrings(config.AllowedOrigins, ","),
		AllowMethods:     joinStrings(config.AllowedMethods, ","),
		AllowHeaders:     joinStrings(config.AllowedHeaders, ","),
		AllowCredentials: config.AllowCredentials,
		MaxAge:           config.MaxAge,
	})
}

func joinStrings(arr []string, sep string) string {
	result := ""
	for i, s := range arr {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
