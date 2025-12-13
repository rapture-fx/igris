package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/igris-inertial/go-sdk/pkg/auth"
	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// AuthClient handles authentication operations
type AuthClient struct {
	client *Client
}

// NewAuthClient creates a new auth client
func NewAuthClient(client *Client) *AuthClient {
	return &AuthClient{
		client: client,
	}
}

// Login authenticates with email and password
func (a *AuthClient) Login(ctx context.Context, email, password string) (*auth.LoginResponse, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartAuthSpan(ctx, "login")
	defer span.End()

	span.SetAttributes(attribute.String("auth.email", email))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"email": email,
	}).Info("Authenticating user")

	// Use auth manager to login
	loginResp, err := a.client.authManager.Login(ctx, email, password)
	if err != nil {
		a.client.tracer.RecordError(span, err, "Login failed")
		a.client.metrics.RecordAuthentication("password", false)
		return nil, fmt.Errorf("login failed: %w", err)
	}

	// Record successful authentication
	a.client.tracer.RecordAuthResult(span, true, loginResp.User.ID)
	a.client.metrics.RecordAuthentication("password", true)

	a.client.logger.LogAuthentication(ctx, "password", loginResp.User.ID, true, nil)

	return loginResp, nil
}

// RefreshToken refreshes the current authentication token
func (a *AuthClient) RefreshToken(ctx context.Context) error {
	// Start tracing
	ctx, span := a.client.tracer.StartAuthSpan(ctx, "refresh_token")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Refreshing authentication token")

	err := a.client.authManager.RefreshToken(ctx)
	if err != nil {
		a.client.tracer.RecordError(span, err, "Token refresh failed")
		a.client.metrics.RecordAuthentication("token_refresh", false)
		return fmt.Errorf("token refresh failed: %w", err)
	}

	// Record successful refresh
	span.SetAttributes(attribute.Bool("auth.refresh_success", true))
	a.client.metrics.RecordAuthentication("token_refresh", true)

	a.client.logger.WithContext(ctx).Info("Authentication token refreshed successfully")

	return nil
}

// Logout logs out the current user
func (a *AuthClient) Logout(ctx context.Context) error {
	// Start tracing
	ctx, span := a.client.tracer.StartAuthSpan(ctx, "logout")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Logging out user")

	err := a.client.authManager.Logout(ctx)
	if err != nil {
		a.client.tracer.RecordError(span, err, "Logout failed")
		return fmt.Errorf("logout failed: %w", err)
	}

	span.SetAttributes(attribute.Bool("auth.logout_success", true))

	a.client.logger.WithContext(ctx).Info("User logged out successfully")

	return nil
}

// GetCurrentUser retrieves the current authenticated user information
func (a *AuthClient) GetCurrentUser(ctx context.Context) (*auth.UserInfo, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_current_user")
	defer span.End()

	if !a.client.authManager.IsAuthenticated() {
		err := fmt.Errorf("user is not authenticated")
		a.client.tracer.RecordError(span, err, "Not authenticated")
		return nil, err
	}

	// Make API request
	resp, err := a.client.Get(ctx, "/auth/me")
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get current user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse user info
	userBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %w", err)
	}

	var user auth.UserInfo
	if err := json.Unmarshal(userBytes, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	span.SetAttributes(
		attribute.String("user.id", user.ID),
		attribute.String("user.email", user.Email),
		attribute.String("user.role", user.Role),
		attribute.String("user.plan", user.Plan),
	)

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"plan":    user.Plan,
	}).Debug("Retrieved current user")

	return &user, nil
}

// SetAPIKey sets the API key for authentication
func (a *AuthClient) SetAPIKey(apiKey string) {
	a.client.logger.WithFields(map[string]interface{}{
		"auth_method": "api_key",
	}).Info("Setting API key authentication")

	a.client.authManager.SetAPIKey(apiKey)
}

// SetBearerToken sets a bearer token for authentication
func (a *AuthClient) SetBearerToken(token string) {
	a.client.logger.WithFields(map[string]interface{}{
		"auth_method": "bearer_token",
	}).Info("Setting bearer token authentication")

	a.client.authManager.SetBearerToken(token)
}

// IsAuthenticated checks if the client is authenticated
func (a *AuthClient) IsAuthenticated() bool {
	return a.client.authManager.IsAuthenticated()
}

// GetAuthMethod returns the current authentication method
func (a *AuthClient) GetAuthMethod() auth.AuthMethod {
	return a.client.authManager.GetAuthMethod()
}

// GetTokenInfo returns current token information
func (a *AuthClient) GetTokenInfo() *auth.TokenInfo {
	return a.client.authManager.GetTokenInfo()
}

// IsTokenExpired checks if the current token is expired
func (a *AuthClient) IsTokenExpired() bool {
	return a.client.authManager.IsTokenExpired()
}

// SetAutoRefresh enables or disables automatic token refresh
func (a *AuthClient) SetAutoRefresh(enabled bool) {
	a.client.logger.WithFields(map[string]interface{}{
		"auto_refresh": enabled,
	}).Info("Setting auto-refresh configuration")

	a.client.authManager.SetAutoRefresh(enabled)
}

// CreateAPIKey creates a new API key (if the user has permission)
func (a *AuthClient) CreateAPIKey(ctx context.Context, name, description string, permissions []string) (map[string]interface{}, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "create_api_key")
	defer span.End()

	span.SetAttributes(
		attribute.String("api_key.name", name),
		attribute.String("api_key.description", description),
		attribute.StringSlice("api_key.permissions", permissions),
	)

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_name":    name,
		"description": description,
		"permissions": permissions,
	}).Info("Creating new API key")

	// Prepare request
	req := map[string]interface{}{
		"name":        name,
		"description": description,
		"permissions": permissions,
	}

	// Make API request
	resp, err := a.client.Post(ctx, "/auth/api-keys", req)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Return the API key data
	apiKeyData, ok := apiResp.Data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid API key data format")
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id":   apiKeyData["id"],
		"key_name": name,
	}).Info("API key created successfully")

	return apiKeyData, nil
}

// ListAPIKeys lists the user's API keys
func (a *AuthClient) ListAPIKeys(ctx context.Context) ([]map[string]interface{}, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "list_api_keys")
	defer span.End()

	// Make API request
	resp, err := a.client.Get(ctx, "/auth/api-keys")
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse API keys
	apiKeys, ok := apiResp.Data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid API keys data format")
	}

	// Convert to proper format
	result := make([]map[string]interface{}, len(apiKeys))
	for i, key := range apiKeys {
		keyMap, ok := key.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid API key format")
		}
		result[i] = keyMap
	}

	span.SetAttributes(attribute.Int("api_keys.count", len(result)))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_count": len(result),
	}).Debug("Listed API keys")

	return result, nil
}

// RevokeAPIKey revokes an API key
func (a *AuthClient) RevokeAPIKey(ctx context.Context, keyID string) error {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "revoke_api_key")
	defer span.End()

	span.SetAttributes(attribute.String("api_key.id", keyID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id": keyID,
	}).Info("Revoking API key")

	// Make API request
	path := fmt.Sprintf("/auth/api-keys/%s", keyID)
	resp, err := a.client.Delete(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to revoke API key: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id": keyID,
	}).Info("API key revoked successfully")

	return nil
}