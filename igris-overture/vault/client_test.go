package vault

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestNewClient_DisabledWithoutAddress(t *testing.T) {
	client, err := NewClient("")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	if client.IsEnabled() {
		t.Error("Expected client to be disabled when no address provided")
	}

	if client.IsHealthy() {
		t.Error("Expected client to not be healthy when disabled")
	}
}

func TestNewClientWithConfig_DefaultConfig(t *testing.T) {
	client, err := NewClientWithConfig(nil)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	// Should default to fallback mode if no VAULT_ADDR env var
	if client.IsEnabled() && os.Getenv("VAULT_ADDR") == "" {
		t.Error("Expected client to be disabled without VAULT_ADDR")
	}
}

func TestFallbackToEnv(t *testing.T) {
	// Set test environment variables
	os.Setenv("API_KEYS_OPENAI_API_KEY", "test-key-123")
	os.Setenv("API_KEYS_OPENAI_ORG_ID", "org-456")
	defer os.Unsetenv("API_KEYS_OPENAI_API_KEY")
	defer os.Unsetenv("API_KEYS_OPENAI_ORG_ID")

	client, err := NewClient("")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	defer client.Close()

	// Test fallback to environment variables
	data, err := client.GetSecret("api/keys/openai")
	if err != nil {
		t.Fatalf("GetSecret failed: %v", err)
	}

	if data["api_key"] != "test-key-123" {
		t.Errorf("Expected api_key=test-key-123, got %v", data["api_key"])
	}

	if data["org_id"] != "org-456" {
		t.Errorf("Expected org_id=org-456, got %v", data["org_id"])
	}
}

func TestFallbackToEnv_NoVars(t *testing.T) {
	client, err := NewClient("")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	defer client.Close()

	// Should fail with no matching env vars
	_, err = client.GetSecret("nonexistent/path")
	if err == nil {
		t.Error("Expected error when no env vars match")
	}
}

func TestVaultMockServer_GetSecret(t *testing.T) {
	// Create mock Vault server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/sys/health":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"initialized":true,"sealed":false,"standby":false}`))
		case "/v1/secret/data/test/key":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"request_id": "abc123",
				"data": {
					"data": {
						"api_key": "secret-value-123",
						"endpoint": "https://api.example.com"
					},
					"metadata": {
						"version": 1
					}
				}
			}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	config := &Config{
		Address:         server.URL,
		Token:           "test-token",
		MountPath:       "secret",
		Timeout:         5 * time.Second,
		HealthCheckIntv: 0, // Disable background health check
		FallbackToEnv:   true,
	}

	client, err := NewClientWithConfig(config)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	if !client.IsEnabled() {
		t.Error("Expected client to be enabled")
	}

	if !client.IsHealthy() {
		t.Error("Expected client to be healthy")
	}

	// Test getting a secret
	data, err := client.GetSecret("test/key")
	if err != nil {
		t.Fatalf("GetSecret failed: %v", err)
	}

	if data["api_key"] != "secret-value-123" {
		t.Errorf("Expected api_key=secret-value-123, got %v", data["api_key"])
	}

	if data["endpoint"] != "https://api.example.com" {
		t.Errorf("Expected endpoint=https://api.example.com, got %v", data["endpoint"])
	}
}

func TestVaultMockServer_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/sys/health":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"initialized":true,"sealed":false}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	config := &Config{
		Address:         server.URL,
		Token:           "test-token",
		MountPath:       "secret",
		Timeout:         5 * time.Second,
		HealthCheckIntv: 0,
		FallbackToEnv:   false, // Disable fallback
		RetryAttempts:   0,     // No retries
	}

	client, err := NewClientWithConfig(config)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	// Should fail for non-existent secret
	_, err = client.GetSecret("nonexistent/path")
	if err == nil {
		t.Error("Expected error for non-existent secret")
	}
}

func TestVaultMockServer_Unhealthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return sealed status
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"initialized":true,"sealed":true}`))
	}))
	defer server.Close()

	// Set fallback env var
	os.Setenv("TEST_SECRET_VALUE", "fallback-value")
	defer os.Unsetenv("TEST_SECRET_VALUE")

	config := &Config{
		Address:         server.URL,
		Token:           "test-token",
		MountPath:       "secret",
		Timeout:         5 * time.Second,
		HealthCheckIntv: 0,
		FallbackToEnv:   true,
	}

	client, err := NewClientWithConfig(config)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	// Client should be enabled but not healthy
	if !client.IsEnabled() {
		t.Error("Expected client to be enabled")
	}

	if client.IsHealthy() {
		t.Error("Expected client to not be healthy with sealed Vault")
	}
}

func TestGetSecretValue(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/sys/health":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"initialized":true,"sealed":false}`))
		case "/v1/secret/data/test/creds":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"data": {
					"data": {
						"username": "admin",
						"password": "secret123"
					}
				}
			}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	config := &Config{
		Address:         server.URL,
		Token:           "test-token",
		MountPath:       "secret",
		Timeout:         5 * time.Second,
		HealthCheckIntv: 0,
	}

	client, err := NewClientWithConfig(config)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	// Test GetSecretValue
	password, err := client.GetSecretValue("test/creds", "password")
	if err != nil {
		t.Fatalf("GetSecretValue failed: %v", err)
	}

	if password != "secret123" {
		t.Errorf("Expected password=secret123, got %s", password)
	}

	// Test non-existent key
	_, err = client.GetSecretValue("test/creds", "nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent key")
	}
}

func TestCaching(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/sys/health":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"initialized":true,"sealed":false}`))
		case "/v1/secret/data/cached/key":
			callCount++
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"data":{"data":{"value":"cached"}}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	config := &Config{
		Address:         server.URL,
		Token:           "test-token",
		MountPath:       "secret",
		Timeout:         5 * time.Second,
		HealthCheckIntv: 0,
	}

	client, err := NewClientWithConfig(config)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	// First call should hit Vault
	_, err = client.GetSecret("cached/key")
	if err != nil {
		t.Fatalf("First GetSecret failed: %v", err)
	}

	if callCount != 1 {
		t.Errorf("Expected 1 Vault call, got %d", callCount)
	}

	// Second call should use cache
	_, err = client.GetSecret("cached/key")
	if err != nil {
		t.Fatalf("Second GetSecret failed: %v", err)
	}

	if callCount != 1 {
		t.Errorf("Expected 1 Vault call (cached), got %d", callCount)
	}
}

func TestRotateSecrets(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/sys/health":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"initialized":true,"sealed":false}`))
		case "/v1/secret/data/rotate/key":
			callCount++
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"data":{"data":{"value":"rotated"}}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	config := &Config{
		Address:         server.URL,
		Token:           "test-token",
		MountPath:       "secret",
		Timeout:         5 * time.Second,
		HealthCheckIntv: 0,
	}

	client, err := NewClientWithConfig(config)
	if err != nil {
		t.Fatalf("NewClientWithConfig failed: %v", err)
	}
	defer client.Close()

	// First call
	_, _ = client.GetSecret("rotate/key")
	if callCount != 1 {
		t.Errorf("Expected 1 call, got %d", callCount)
	}

	// Rotate secrets (clears cache)
	if err := client.RotateSecrets(); err != nil {
		t.Fatalf("RotateSecrets failed: %v", err)
	}

	// Next call should hit Vault again
	_, _ = client.GetSecret("rotate/key")
	if callCount != 2 {
		t.Errorf("Expected 2 calls after rotation, got %d", callCount)
	}
}
