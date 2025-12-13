// Package logging provides secure structured logging with automatic sanitization
package logging

import (
	"regexp"
	"strings"
)

// Sensitive patterns that should be redacted from logs
var (
	// API keys and tokens
	apiKeyPattern      = regexp.MustCompile(`(?i)(api[_-]?key|token|secret|password|auth)["\s:=]+([a-zA-Z0-9_\-\.]+)`)
	bearerTokenPattern = regexp.MustCompile(`(?i)Bearer\s+([a-zA-Z0-9_\-\.]+)`)

	// Authorization headers
	authHeaderPattern = regexp.MustCompile(`(?i)Authorization:\s*(.+)`)
	apiKeyHeaderPattern = regexp.MustCompile(`(?i)x-api-key:\s*(.+)`)

	// Sensitive query params
	sensitiveParamPattern = regexp.MustCompile(`(?i)([?&](api_key|token|secret|password)=)([^&\s]+)`)

	// Database connection strings
	dbConnPattern = regexp.MustCompile(`(?i)(postgres|mysql|mongodb):\/\/([^:]+):([^@]+)@`)

	// Provider-specific keys
	openAIKeyPattern = regexp.MustCompile(`sk-[a-zA-Z0-9_\-]{20,}`)
	anthropicKeyPattern = regexp.MustCompile(`sk-ant-[a-zA-Z0-9\-]{20,}`)
)

// SanitizeForLog redacts sensitive information from log messages
func SanitizeForLog(message string) string {
	// Redact API keys and tokens
	message = apiKeyPattern.ReplaceAllString(message, `$1="***REDACTED***"`)
	message = bearerTokenPattern.ReplaceAllString(message, "Bearer ***REDACTED***")

	// Redact authorization headers
	message = authHeaderPattern.ReplaceAllString(message, "Authorization: ***REDACTED***")
	message = apiKeyHeaderPattern.ReplaceAllString(message, "x-api-key: ***REDACTED***")

	// Redact sensitive URL params
	message = sensitiveParamPattern.ReplaceAllString(message, `$1***REDACTED***`)

	// Redact database credentials
	message = dbConnPattern.ReplaceAllString(message, `$1://***REDACTED***:***REDACTED***@`)

	// Redact provider-specific keys
	message = openAIKeyPattern.ReplaceAllString(message, "sk-***REDACTED***")
	message = anthropicKeyPattern.ReplaceAllString(message, "sk-ant-***REDACTED***")

	return message
}

// SanitizeHeaders creates a safe copy of headers with sensitive values redacted
func SanitizeHeaders(headers map[string]string) map[string]string {
	if headers == nil {
		return nil
	}

	sanitized := make(map[string]string, len(headers))

	for key, value := range headers {
		lowerKey := strings.ToLower(key)

		// Redact sensitive headers
		if lowerKey == "authorization" ||
		   lowerKey == "x-api-key" ||
		   lowerKey == "api-key" ||
		   strings.Contains(lowerKey, "token") ||
		   strings.Contains(lowerKey, "secret") ||
		   strings.Contains(lowerKey, "password") {
			sanitized[key] = "***REDACTED***"
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

// MaskAPIKey masks an API key showing only prefix and suffix
func MaskAPIKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}

	// Show first 4 and last 4 characters
	prefix := key[:4]
	suffix := key[len(key)-4:]

	return prefix + "****" + suffix
}

// MaskProviderID masks a provider ID for safe logging
func MaskProviderID(providerID string) string {
	if len(providerID) <= 8 {
		return "****"
	}

	// Show first 8 characters only
	return providerID[:8] + "****"
}

// SanitizeError sanitizes error messages that might contain sensitive data
func SanitizeError(err error) string {
	if err == nil {
		return ""
	}

	return SanitizeForLog(err.Error())
}

// SafeLogValue determines if a value is safe to log without redaction
func SafeLogValue(key string) bool {
	lowerKey := strings.ToLower(key)

	sensitiveKeys := []string{
		"password", "secret", "token", "api_key", "apikey",
		"authorization", "auth", "key", "credential", "private",
	}

	for _, sensitive := range sensitiveKeys {
		if strings.Contains(lowerKey, sensitive) {
			return false
		}
	}

	return true
}

// SanitizeMap sanitizes a map of values for safe logging
func SanitizeMap(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}

	sanitized := make(map[string]interface{}, len(data))

	for key, value := range data {
		if SafeLogValue(key) {
			sanitized[key] = value
		} else {
			sanitized[key] = "***REDACTED***"
		}
	}

	return sanitized
}
