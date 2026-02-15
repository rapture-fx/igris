package logging

import (
	"strings"
	"testing"
)

func TestSanitizeForLog(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "OpenAI API key",
			input:    "Using api_key: sk-proj1234567890123456789012345678901234567890",
			expected: `Using api_key="***REDACTED***"`,
		},
		{
			name:     "Bearer token",
			input:    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			expected: "Authorization: Bearer ***REDACTED***",
		},
		{
			name:     "Anthropic key",
			input:    "Key: sk-ant-api03-1234567890123456789012345678901234567890123456789012345678901234567890123456789012345",
			expected: "Key: sk-ant-***REDACTED***",
		},
		{
			name:     "URL with API key param",
			input:    "https://api.example.com/v1?api_key=secret123&foo=bar",
			expected: "https://api.example.com/v1?api_key=***REDACTED***&foo=bar",
		},
		{
			name:     "Database connection string",
			input:    "postgres://user:password@localhost:5432/db",
			expected: "postgres://***REDACTED***:***REDACTED***@localhost:5432/db",
		},
		{
			name:     "Authorization header",
			input:    "Authorization: Bearer sk-1234567890",
			expected: "Authorization: ***REDACTED***",
		},
		{
			name:     "X-API-Key header",
			input:    "x-api-key: secret-key-value",
			expected: "x-api-key: ***REDACTED***",
		},
		{
			name:     "Safe message",
			input:    "Request completed successfully with status 200",
			expected: "Request completed successfully with status 200",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeForLog(tt.input)
			if !strings.Contains(result, "***REDACTED***") && strings.Contains(tt.expected, "***REDACTED***") {
				t.Errorf("Expected redaction in output, got: %s", result)
			}

			// Ensure no sensitive data remains
			if tt.name == "OpenAI API key" && strings.Contains(result, "sk-proj") {
				t.Errorf("API key not fully redacted: %s", result)
			}
			if tt.name == "Database connection string" && strings.Contains(result, "password") {
				t.Errorf("Database password not redacted: %s", result)
			}
		})
	}
}

func TestSanitizeHeaders(t *testing.T) {
	tests := []struct {
		name     string
		headers  map[string]string
		expected map[string]string
	}{
		{
			name: "Authorization header",
			headers: map[string]string{
				"Authorization": "Bearer secret-token",
				"Content-Type":  "application/json",
			},
			expected: map[string]string{
				"Authorization": "***REDACTED***",
				"Content-Type":  "application/json",
			},
		},
		{
			name: "API key header",
			headers: map[string]string{
				"X-API-Key":    "secret-key",
				"User-Agent":   "Igris Inertial/1.0",
			},
			expected: map[string]string{
				"X-API-Key":    "***REDACTED***",
				"User-Agent":   "Igris Inertial/1.0",
			},
		},
		{
			name: "Token in custom header",
			headers: map[string]string{
				"X-Auth-Token": "my-secret-token",
				"Accept":       "application/json",
			},
			expected: map[string]string{
				"X-Auth-Token": "***REDACTED***",
				"Accept":       "application/json",
			},
		},
		{
			name: "Safe headers only",
			headers: map[string]string{
				"Content-Type": "application/json",
				"User-Agent":   "Mozilla/5.0",
			},
			expected: map[string]string{
				"Content-Type": "application/json",
				"User-Agent":   "Mozilla/5.0",
			},
		},
		{
			name:     "Nil headers",
			headers:  nil,
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeHeaders(tt.headers)

			if tt.expected == nil {
				if result != nil {
					t.Errorf("Expected nil, got %v", result)
				}
				return
			}

			for key, expectedValue := range tt.expected {
				if result[key] != expectedValue {
					t.Errorf("For key %s: expected %s, got %s", key, expectedValue, result[key])
				}
			}
		})
	}
}

func TestMaskAPIKey(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		expected string
	}{
		{
			name:     "Long API key",
			key:      "sk-proj1234567890123456789012345678901234567890",
			expected: "sk-p****7890",
		},
		{
			name:     "Short key",
			key:      "short",
			expected: "****",
		},
		{
			name:     "Medium key",
			key:      "12345678",
			expected: "****",
		},
		{
			name:     "Very long key",
			key:      "sk-ant-api03-very-long-key-with-many-characters-1234567890",
			expected: "sk-a****7890",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskAPIKey(tt.key)

			// Ensure sensitive parts are masked
			if len(tt.key) > 8 {
				middlePart := tt.key[4:len(tt.key)-4]
				if strings.Contains(result, middlePart) {
					t.Errorf("Key not properly masked, sensitive part visible: %s", result)
				}
			}

			// Ensure result is masked
			if !strings.Contains(result, "****") && len(tt.key) > 8 {
				t.Errorf("Expected masking in result: %s", result)
			}
		})
	}
}

func TestMaskProviderID(t *testing.T) {
	tests := []struct {
		name     string
		id       string
		expected string
	}{
		{
			name:     "UUID",
			id:       "550e8400-e29b-41d4-a716-446655440000",
			expected: "550e8400****",
		},
		{
			name:     "Short ID",
			id:       "short",
			expected: "****",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskProviderID(tt.id)
			if len(tt.id) > 8 && !strings.Contains(result, "****") {
				t.Errorf("Provider ID not masked: %s", result)
			}
		})
	}
}

func TestSafeLogValue(t *testing.T) {
	tests := []struct {
		key  string
		safe bool
	}{
		{"username", true},
		{"password", false},
		{"user_id", true},
		{"api_key", false},
		{"apikey", false},
		{"token", false},
		{"auth_token", false},
		{"secret", false},
		{"public_id", true},
		{"Authorization", false},
		{"content_type", true},
	}

	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			result := SafeLogValue(tt.key)
			if result != tt.safe {
				t.Errorf("For key %s: expected safe=%v, got %v", tt.key, tt.safe, result)
			}
		})
	}
}

func TestSanitizeMap(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "Mixed safe and sensitive",
			input: map[string]interface{}{
				"user_id":  "123",
				"password": "secret123",
				"api_key":  "sk-1234",
				"status":   "active",
			},
			expected: map[string]interface{}{
				"user_id":  "123",
				"password": "***REDACTED***",
				"api_key":  "***REDACTED***",
				"status":   "active",
			},
		},
		{
			name: "All safe",
			input: map[string]interface{}{
				"user_id": "123",
				"status":  "active",
			},
			expected: map[string]interface{}{
				"user_id": "123",
				"status":  "active",
			},
		},
		{
			name:     "Nil map",
			input:    nil,
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeMap(tt.input)

			if tt.expected == nil {
				if result != nil {
					t.Errorf("Expected nil, got %v", result)
				}
				return
			}

			for key, expectedValue := range tt.expected {
				if result[key] != expectedValue {
					t.Errorf("For key %s: expected %v, got %v", key, expectedValue, result[key])
				}
			}
		})
	}
}

// Benchmark tests
func BenchmarkSanitizeForLog(b *testing.B) {
	message := "Authorization: Bearer sk-proj1234567890 and api_key=secret123 with password=test"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SanitizeForLog(message)
	}
}

func BenchmarkSanitizeHeaders(b *testing.B) {
	headers := map[string]string{
		"Authorization": "Bearer token",
		"X-API-Key":     "secret",
		"Content-Type":  "application/json",
		"User-Agent":    "test",
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SanitizeHeaders(headers)
	}
}
