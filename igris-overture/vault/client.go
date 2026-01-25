// Package vault provides HashiCorp Vault integration for secure secret management.
//
// Features:
// - Read secrets from Vault KV v2 engine
// - Automatic fallback to environment variables when Vault unavailable
// - Periodic health checks and secret rotation
// - Prometheus metrics for monitoring
package vault

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/Schlep-engine/igris-inertial/igris-overture/observability"
)

// Config holds Vault client configuration
type Config struct {
	Address          string        `json:"address"`           // Vault server address (e.g., https://vault.example.com:8200)
	Token            string        `json:"token"`             // Vault token for authentication
	Namespace        string        `json:"namespace"`         // Vault namespace (enterprise feature)
	MountPath        string        `json:"mount_path"`        // KV v2 mount path (default: "secret")
	Timeout          time.Duration `json:"timeout"`           // Request timeout
	HealthCheckIntv  time.Duration `json:"health_check_intv"` // Health check interval
	RotationInterval time.Duration `json:"rotation_interval"` // Secret rotation check interval
	RetryAttempts    int           `json:"retry_attempts"`    // Number of retry attempts
	RetryDelay       time.Duration `json:"retry_delay"`       // Delay between retries
	FallbackToEnv    bool          `json:"fallback_to_env"`   // Fall back to env vars if Vault unavailable
}

// DefaultConfig returns sensible default configuration
func DefaultConfig() *Config {
	return &Config{
		Address:          os.Getenv("VAULT_ADDR"),
		Token:            os.Getenv("VAULT_TOKEN"),
		Namespace:        os.Getenv("VAULT_NAMESPACE"),
		MountPath:        "secret",
		Timeout:          10 * time.Second,
		HealthCheckIntv:  30 * time.Second,
		RotationInterval: 1 * time.Hour,
		RetryAttempts:    3,
		RetryDelay:       1 * time.Second,
		FallbackToEnv:    true,
	}
}

// Client is a HashiCorp Vault client with automatic fallback
type Client struct {
	config     *Config
	httpClient *http.Client
	enabled    bool
	healthy    bool
	healthyMu  sync.RWMutex
	cache      map[string]*cachedSecret
	cacheMu    sync.RWMutex
	done       chan struct{}
}

type cachedSecret struct {
	data      map[string]interface{}
	version   int
	fetchedAt time.Time
	ttl       time.Duration
}

// VaultResponse represents a Vault API response
type VaultResponse struct {
	RequestID     string                 `json:"request_id"`
	LeaseID       string                 `json:"lease_id"`
	Renewable     bool                   `json:"renewable"`
	LeaseDuration int                    `json:"lease_duration"`
	Data          map[string]interface{} `json:"data"`
	Warnings      []string               `json:"warnings"`
	Auth          *VaultAuth             `json:"auth"`
	Errors        []string               `json:"errors"`
}

// VaultAuth represents Vault authentication data
type VaultAuth struct {
	ClientToken   string   `json:"client_token"`
	Accessor      string   `json:"accessor"`
	Policies      []string `json:"policies"`
	TokenPolicies []string `json:"token_policies"`
	Renewable     bool     `json:"renewable"`
	LeaseDuration int      `json:"lease_duration"`
}

// VaultHealthResponse represents Vault health check response
type VaultHealthResponse struct {
	Initialized   bool   `json:"initialized"`
	Sealed        bool   `json:"sealed"`
	Standby       bool   `json:"standby"`
	ServerTimeUTC int64  `json:"server_time_utc"`
	Version       string `json:"version"`
	ClusterName   string `json:"cluster_name"`
	ClusterID     string `json:"cluster_id"`
}

// NewClient creates a new Vault client
func NewClient(address string) (*Client, error) {
	return NewClientWithConfig(&Config{
		Address:       address,
		Token:         os.Getenv("VAULT_TOKEN"),
		MountPath:     "secret",
		Timeout:       10 * time.Second,
		FallbackToEnv: true,
	})
}

// NewClientWithConfig creates a new Vault client with full configuration
func NewClientWithConfig(config *Config) (*Client, error) {
	if config == nil {
		config = DefaultConfig()
	}

	client := &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		cache: make(map[string]*cachedSecret),
		done:  make(chan struct{}),
	}

	// Check if Vault is configured
	if config.Address == "" {
		log.Info().Msg("Vault address not configured, running in fallback mode")
		client.enabled = false
		return client, nil
	}

	client.enabled = true

	// Perform initial health check
	if err := client.checkHealth(); err != nil {
		log.Warn().Err(err).Msg("Vault health check failed on startup, will retry")
		client.setHealthy(false)
		if !config.FallbackToEnv {
			return nil, fmt.Errorf("vault not healthy and fallback disabled: %w", err)
		}
	} else {
		client.setHealthy(true)
		log.Info().Str("address", config.Address).Msg("Vault client initialized successfully")
	}

	// Start background health checker
	if config.HealthCheckIntv > 0 {
		go client.healthCheckLoop()
	}

	return client, nil
}

// GetSecret retrieves a secret from Vault with automatic fallback
func (c *Client) GetSecret(path string) (map[string]interface{}, error) {
	return c.GetSecretWithContext(context.Background(), path)
}

// GetSecretWithContext retrieves a secret with context support
func (c *Client) GetSecretWithContext(ctx context.Context, path string) (map[string]interface{}, error) {
	// Check cache first
	if cached := c.getCached(path); cached != nil {
		return cached, nil
	}

	// Try Vault if enabled and healthy
	if c.enabled && c.isHealthy() {
		data, err := c.readFromVault(ctx, path)
		if err == nil {
			c.setCache(path, data, 5*time.Minute)
			observability.RecordVaultSecretRead(path, "success")
			return data, nil
		}

		log.Warn().Err(err).Str("path", path).Msg("Failed to read secret from Vault")
		observability.RecordVaultSecretRead(path, "error")

		// Don't fall back if fallback is disabled
		if !c.config.FallbackToEnv {
			return nil, fmt.Errorf("failed to read secret from Vault: %w", err)
		}
	}

	// Fallback to environment variables
	if c.config.FallbackToEnv {
		return c.fallbackToEnv(path)
	}

	return nil, fmt.Errorf("vault not available and fallback disabled")
}

// GetSecretValue retrieves a specific key from a secret
func (c *Client) GetSecretValue(path, key string) (string, error) {
	data, err := c.GetSecret(path)
	if err != nil {
		return "", err
	}

	value, ok := data[key]
	if !ok {
		return "", fmt.Errorf("key %q not found in secret %q", key, path)
	}

	str, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("key %q is not a string", key)
	}

	return str, nil
}

// PutSecret stores a secret in Vault
func (c *Client) PutSecret(path string, data map[string]interface{}) error {
	return c.PutSecretWithContext(context.Background(), path, data)
}

// PutSecretWithContext stores a secret with context support
func (c *Client) PutSecretWithContext(ctx context.Context, path string, data map[string]interface{}) error {
	if !c.enabled {
		return fmt.Errorf("vault client not enabled")
	}

	if !c.isHealthy() {
		return fmt.Errorf("vault is not healthy")
	}

	// Prepare request body for KV v2
	body := map[string]interface{}{
		"data": data,
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal secret: %w", err)
	}

	// Build request URL
	url := fmt.Sprintf("%s/v1/%s/data/%s", c.config.Address, c.config.MountPath, path)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("vault request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vault returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Invalidate cache for this path
	c.cacheMu.Lock()
	delete(c.cache, path)
	c.cacheMu.Unlock()

	return nil
}

// Close closes the Vault client
func (c *Client) Close() error {
	close(c.done)
	return nil
}

// IsEnabled returns whether Vault is enabled
func (c *Client) IsEnabled() bool {
	return c.enabled
}

// IsHealthy returns whether Vault is currently healthy
func (c *Client) IsHealthy() bool {
	return c.isHealthy()
}

// readFromVault reads a secret from Vault KV v2
func (c *Client) readFromVault(ctx context.Context, path string) (map[string]interface{}, error) {
	// Build request URL for KV v2
	url := fmt.Sprintf("%s/v1/%s/data/%s", c.config.Address, c.config.MountPath, path)

	var lastErr error
	for attempt := 0; attempt <= c.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(c.config.RetryDelay):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			lastErr = fmt.Errorf("failed to create request: %w", err)
			continue
		}

		c.setHeaders(req)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("vault request failed: %w", err)
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()

		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %w", err)
			continue
		}

		if resp.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("secret not found: %s", path)
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("vault returned status %d: %s", resp.StatusCode, string(bodyBytes))
			continue
		}

		var vaultResp VaultResponse
		if err := json.Unmarshal(bodyBytes, &vaultResp); err != nil {
			lastErr = fmt.Errorf("failed to decode response: %w", err)
			continue
		}

		if len(vaultResp.Errors) > 0 {
			lastErr = fmt.Errorf("vault errors: %v", vaultResp.Errors)
			continue
		}

		// Extract data from KV v2 response (data is nested under "data" key)
		if vaultResp.Data != nil {
			if innerData, ok := vaultResp.Data["data"].(map[string]interface{}); ok {
				return innerData, nil
			}
		}

		return vaultResp.Data, nil
	}

	return nil, lastErr
}

// fallbackToEnv falls back to environment variables
func (c *Client) fallbackToEnv(path string) (map[string]interface{}, error) {
	// Convert path to environment variable prefix
	// e.g., "api/keys/openai" -> "API_KEYS_OPENAI_"
	prefix := strings.ToUpper(strings.ReplaceAll(path, "/", "_")) + "_"

	result := make(map[string]interface{})

	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key, value := parts[0], parts[1]
		if strings.HasPrefix(key, prefix) {
			shortKey := strings.ToLower(strings.TrimPrefix(key, prefix))
			result[shortKey] = value
		}
	}

	if len(result) == 0 {
		observability.RecordVaultSecretRead(path, "fallback_empty")
		return nil, fmt.Errorf("no environment variables found for path %q (prefix: %s)", path, prefix)
	}

	observability.RecordVaultSecretRead(path, "fallback")
	return result, nil
}

// checkHealth performs a health check against Vault
func (c *Client) checkHealth() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/v1/sys/health", c.config.Address)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health request: %w", err)
	}

	// Health endpoint doesn't require authentication
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	// Vault returns different status codes based on health:
	// 200: initialized, unsealed, active
	// 429: unsealed, standby
	// 472: disaster recovery mode replication secondary and active
	// 473: performance standby
	// 501: not initialized
	// 503: sealed
	if resp.StatusCode != http.StatusOK && resp.StatusCode != 429 && resp.StatusCode != 472 && resp.StatusCode != 473 {
		return fmt.Errorf("vault unhealthy, status code: %d", resp.StatusCode)
	}

	return nil
}

// healthCheckLoop runs periodic health checks
func (c *Client) healthCheckLoop() {
	ticker := time.NewTicker(c.config.HealthCheckIntv)
	defer ticker.Stop()

	for {
		select {
		case <-c.done:
			return
		case <-ticker.C:
			if err := c.checkHealth(); err != nil {
				log.Warn().Err(err).Msg("Vault health check failed")
				c.setHealthy(false)
				observability.RecordVaultHealth(false)
			} else {
				wasUnhealthy := !c.isHealthy()
				c.setHealthy(true)
				observability.RecordVaultHealth(true)
				if wasUnhealthy {
					log.Info().Msg("Vault recovered and is now healthy")
				}
			}
		}
	}
}

func (c *Client) setHealthy(healthy bool) {
	c.healthyMu.Lock()
	c.healthy = healthy
	c.healthyMu.Unlock()
}

func (c *Client) isHealthy() bool {
	c.healthyMu.RLock()
	defer c.healthyMu.RUnlock()
	return c.healthy
}

func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("X-Vault-Token", c.config.Token)
	req.Header.Set("Content-Type", "application/json")
	if c.config.Namespace != "" {
		req.Header.Set("X-Vault-Namespace", c.config.Namespace)
	}
}

func (c *Client) getCached(path string) map[string]interface{} {
	c.cacheMu.RLock()
	defer c.cacheMu.RUnlock()

	cached, ok := c.cache[path]
	if !ok {
		return nil
	}

	if time.Since(cached.fetchedAt) > cached.ttl {
		return nil // Expired
	}

	return cached.data
}

func (c *Client) setCache(path string, data map[string]interface{}, ttl time.Duration) {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()

	c.cache[path] = &cachedSecret{
		data:      data,
		fetchedAt: time.Now(),
		ttl:       ttl,
	}
}

// RotateSecrets checks for secret updates and triggers rotation
func (c *Client) RotateSecrets() error {
	if !c.enabled || !c.isHealthy() {
		return nil
	}

	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()

	// Clear cache to force re-fetch on next access
	c.cache = make(map[string]*cachedSecret)

	observability.RecordVaultRotation()
	log.Info().Msg("Secret cache cleared for rotation")

	return nil
}

// HealthCheck returns the current health status
func (c *Client) HealthCheck() (*VaultHealthResponse, error) {
	if !c.enabled {
		return nil, fmt.Errorf("vault not enabled")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/v1/sys/health", c.config.Address)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("health request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var health VaultHealthResponse
	if err := json.Unmarshal(bodyBytes, &health); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &health, nil
}
