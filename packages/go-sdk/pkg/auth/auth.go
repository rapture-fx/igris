package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AuthMethod represents the authentication method
type AuthMethod string

const (
	AuthMethodAPIKey   AuthMethod = "api_key"
	AuthMethodJWT      AuthMethod = "jwt"
	AuthMethodOAuth    AuthMethod = "oauth"
	AuthMethodBearer   AuthMethod = "bearer"
)

// TokenInfo holds information about the current token
type TokenInfo struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	Type      string    `json:"type"`
	Scope     []string  `json:"scope,omitempty"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
	Scope        []string  `json:"scope,omitempty"`
	User         UserInfo  `json:"user,omitempty"`
}

// UserInfo represents user information
type UserInfo struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	Plan     string `json:"plan"`
	Verified bool   `json:"verified"`
}

// Manager handles authentication for API requests
type Manager struct {
	apiKey       string
	token        *TokenInfo
	authMethod   AuthMethod
	httpClient   HTTPClient
	mu           sync.RWMutex
	refreshMu    sync.Mutex
	autoRefresh  bool
	refreshTimer *time.Timer
}

// HTTPClient interface for making HTTP requests
type HTTPClient interface {
	Post(ctx context.Context, path string, body interface{}) ([]byte, error)
}

// NewManager creates a new authentication manager
func NewManager(apiKey string, httpClient HTTPClient) *Manager {
	return &Manager{
		apiKey:      apiKey,
		authMethod:  AuthMethodAPIKey,
		httpClient:  httpClient,
		autoRefresh: true,
	}
}

// SetAPIKey sets the API key for authentication
func (m *Manager) SetAPIKey(apiKey string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.apiKey = apiKey
	m.authMethod = AuthMethodAPIKey
	m.token = nil
	m.stopAutoRefresh()
}

// SetToken sets a JWT token for authentication
func (m *Manager) SetToken(token string, expiresAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Validate JWT token
	if err := m.validateJWTToken(token); err != nil {
		return fmt.Errorf("invalid JWT token: %w", err)
	}

	m.token = &TokenInfo{
		Token:     token,
		ExpiresAt: expiresAt,
		Type:      "Bearer",
	}
	m.authMethod = AuthMethodJWT
	
	// Setup auto-refresh if enabled
	if m.autoRefresh {
		m.scheduleRefresh()
	}
	
	return nil
}

// SetBearerToken sets a bearer token for authentication
func (m *Manager) SetBearerToken(token string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.token = &TokenInfo{
		Token: token,
		Type:  "Bearer",
	}
	m.authMethod = AuthMethodBearer
	m.stopAutoRefresh()
}

// Login authenticates with email and password
func (m *Manager) Login(ctx context.Context, email, password string) (*LoginResponse, error) {
	req := LoginRequest{
		Email:    email,
		Password: password,
	}
	
	respBody, err := m.httpClient.Post(ctx, "/auth/login", req)
	if err != nil {
		return nil, fmt.Errorf("login request failed: %w", err)
	}
	
	var loginResp LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return nil, fmt.Errorf("failed to parse login response: %w", err)
	}
	
	// Calculate expires at
	if loginResp.ExpiresIn > 0 && loginResp.ExpiresAt.IsZero() {
		loginResp.ExpiresAt = time.Now().Add(time.Duration(loginResp.ExpiresIn) * time.Second)
	}
	
	// Set the token
	m.mu.Lock()
	m.token = &TokenInfo{
		Token:     loginResp.AccessToken,
		ExpiresAt: loginResp.ExpiresAt,
		Type:      loginResp.TokenType,
		Scope:     loginResp.Scope,
	}
	m.authMethod = AuthMethodJWT
	m.mu.Unlock()
	
	// Setup auto-refresh
	if m.autoRefresh && !loginResp.ExpiresAt.IsZero() {
		m.scheduleRefresh()
	}
	
	return &loginResp, nil
}

// RefreshToken refreshes the current authentication token
func (m *Manager) RefreshToken(ctx context.Context) error {
	m.refreshMu.Lock()
	defer m.refreshMu.Unlock()
	
	m.mu.RLock()
	currentToken := m.token
	m.mu.RUnlock()
	
	if currentToken == nil {
		return fmt.Errorf("no token to refresh")
	}
	
	// Make refresh request
	respBody, err := m.httpClient.Post(ctx, "/auth/refresh", map[string]string{
		"refresh_token": currentToken.Token,
	})
	if err != nil {
		return fmt.Errorf("token refresh failed: %w", err)
	}
	
	var refreshResp LoginResponse
	if err := json.Unmarshal(respBody, &refreshResp); err != nil {
		return fmt.Errorf("failed to parse refresh response: %w", err)
	}
	
	// Calculate expires at
	if refreshResp.ExpiresIn > 0 && refreshResp.ExpiresAt.IsZero() {
		refreshResp.ExpiresAt = time.Now().Add(time.Duration(refreshResp.ExpiresIn) * time.Second)
	}
	
	// Update token
	m.mu.Lock()
	m.token = &TokenInfo{
		Token:     refreshResp.AccessToken,
		ExpiresAt: refreshResp.ExpiresAt,
		Type:      refreshResp.TokenType,
		Scope:     refreshResp.Scope,
	}
	m.mu.Unlock()
	
	// Schedule next refresh
	if m.autoRefresh && !refreshResp.ExpiresAt.IsZero() {
		m.scheduleRefresh()
	}
	
	return nil
}

// GetAuthHeaders returns the authentication headers for API requests
func (m *Manager) GetAuthHeaders() map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	headers := make(map[string]string)
	
	switch m.authMethod {
	case AuthMethodAPIKey:
		if m.apiKey != "" {
			headers["X-API-Key"] = m.apiKey
		}
	case AuthMethodJWT, AuthMethodBearer:
		if m.token != nil && m.token.Token != "" {
			headers["Authorization"] = fmt.Sprintf("%s %s", m.token.Type, m.token.Token)
		}
	}
	
	return headers
}

// IsAuthenticated checks if the client is authenticated
func (m *Manager) IsAuthenticated() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	switch m.authMethod {
	case AuthMethodAPIKey:
		return m.apiKey != ""
	case AuthMethodJWT:
		return m.token != nil && m.token.Token != "" && !m.isTokenExpired()
	case AuthMethodBearer:
		return m.token != nil && m.token.Token != ""
	default:
		return false
	}
}

// GetAuthMethod returns the current authentication method
func (m *Manager) GetAuthMethod() AuthMethod {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.authMethod
}

// GetTokenInfo returns current token information
func (m *Manager) GetTokenInfo() *TokenInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if m.token == nil {
		return nil
	}
	
	// Return a copy to prevent external modification
	return &TokenInfo{
		Token:     m.token.Token,
		ExpiresAt: m.token.ExpiresAt,
		Type:      m.token.Type,
		Scope:     append([]string(nil), m.token.Scope...),
	}
}

// IsTokenExpired checks if the current token is expired
func (m *Manager) IsTokenExpired() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isTokenExpired()
}

// isTokenExpired checks if the current token is expired (internal, no lock)
func (m *Manager) isTokenExpired() bool {
	if m.token == nil || m.token.ExpiresAt.IsZero() {
		return false // No expiration time set
	}
	
	// Consider token expired if it expires within 5 minutes
	return time.Now().Add(5 * time.Minute).After(m.token.ExpiresAt)
}

// SetAutoRefresh enables or disables automatic token refresh
func (m *Manager) SetAutoRefresh(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.autoRefresh = enabled
	if enabled {
		m.scheduleRefresh()
	} else {
		m.stopAutoRefresh()
	}
}

// scheduleRefresh schedules the next token refresh (internal, must be called with lock held)
func (m *Manager) scheduleRefresh() {
	if m.token == nil || m.token.ExpiresAt.IsZero() {
		return
	}
	
	m.stopAutoRefresh()
	
	// Refresh 10 minutes before expiry
	refreshTime := m.token.ExpiresAt.Add(-10 * time.Minute)
	if refreshTime.Before(time.Now()) {
		refreshTime = time.Now().Add(1 * time.Minute) // Refresh in 1 minute if already past refresh time
	}
	
	m.refreshTimer = time.AfterFunc(time.Until(refreshTime), func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		
		if err := m.RefreshToken(ctx); err != nil {
			// TODO: Add logging or callback for refresh failures
			_ = err
		}
	})
}

// stopAutoRefresh stops the auto-refresh timer (internal, must be called with lock held)
func (m *Manager) stopAutoRefresh() {
	if m.refreshTimer != nil {
		m.refreshTimer.Stop()
		m.refreshTimer = nil
	}
}

// validateJWTToken validates the format of a JWT token
func (m *Manager) validateJWTToken(tokenString string) error {
	// Parse without verification to check format
	_, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return fmt.Errorf("invalid JWT format: %w", err)
	}
	
	return nil
}

// Logout clears the authentication state
func (m *Manager) Logout(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Clear authentication state
	oldToken := m.token
	m.apiKey = ""
	m.token = nil
	m.authMethod = AuthMethodAPIKey
	m.stopAutoRefresh()
	
	// Notify server if we have a token
	if oldToken != nil && oldToken.Token != "" && !strings.HasPrefix(oldToken.Token, "sk-") { // Not an API key
		// Best effort logout - don't return error if it fails
		_, _ = m.httpClient.Post(ctx, "/auth/logout", map[string]string{
			"token": oldToken.Token,
		})
	}
	
	return nil
}

// Close cleans up resources
func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stopAutoRefresh()
}