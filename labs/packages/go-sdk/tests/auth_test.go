package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockHTTPClient is a mock implementation of the HTTPClient interface
type MockHTTPClient struct {
	mock.Mock
}

func (m *MockHTTPClient) Post(ctx context.Context, path string, body interface{}) ([]byte, error) {
	args := m.Called(ctx, path, body)
	return args.Get(0).([]byte), args.Error(1)
}

func TestAuthManager_SetAPIKey(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Test setting API key
	apiKey := "test-api-key"
	manager.SetAPIKey(apiKey)

	assert.True(t, manager.IsAuthenticated())
	assert.Equal(t, auth.AuthMethodAPIKey, manager.GetAuthMethod())

	headers := manager.GetAuthHeaders()
	assert.Equal(t, apiKey, headers["X-API-Key"])
}

func TestAuthManager_Login(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Mock successful login response
	loginResp := auth.LoginResponse{
		AccessToken:  "test-access-token",
		RefreshToken: "test-refresh-token",
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		ExpiresAt:    time.Now().Add(time.Hour),
		User: auth.UserInfo{
			ID:    "user123",
			Email: "test@example.com",
			Name:  "Test User",
			Role:  "user",
		},
	}

	respBytes, err := json.Marshal(loginResp)
	require.NoError(t, err)

	mockClient.On("Post", mock.Anything, "/auth/login", mock.MatchedBy(func(req interface{}) bool {
		loginReq, ok := req.(auth.LoginRequest)
		return ok && loginReq.Email == "test@example.com" && loginReq.Password == "password123"
	})).Return(respBytes, nil)

	// Test login
	ctx := context.Background()
	result, err := manager.Login(ctx, "test@example.com", "password123")

	require.NoError(t, err)
	assert.Equal(t, "test-access-token", result.AccessToken)
	assert.Equal(t, "user123", result.User.ID)
	assert.True(t, manager.IsAuthenticated())
	assert.Equal(t, auth.AuthMethodJWT, manager.GetAuthMethod())

	// Check auth headers
	headers := manager.GetAuthHeaders()
	assert.Equal(t, "Bearer test-access-token", headers["Authorization"])

	mockClient.AssertExpectations(t)
}

func TestAuthManager_LoginFailed(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Mock failed login
	mockClient.On("Post", mock.Anything, "/auth/login", mock.Anything).
		Return([]byte{}, fmt.Errorf("authentication failed"))

	ctx := context.Background()
	result, err := manager.Login(ctx, "test@example.com", "wrongpassword")

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.False(t, manager.IsAuthenticated())
	assert.Contains(t, err.Error(), "login request failed")

	mockClient.AssertExpectations(t)
}

func TestAuthManager_RefreshToken(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Set initial token
	initialExpiry := time.Now().Add(time.Hour)
	err := manager.SetToken("initial-token", initialExpiry)
	require.NoError(t, err)

	// Mock refresh response
	refreshResp := auth.LoginResponse{
		AccessToken: "new-access-token",
		TokenType:   "Bearer",
		ExpiresIn:   3600,
		ExpiresAt:   time.Now().Add(time.Hour),
	}

	respBytes, err := json.Marshal(refreshResp)
	require.NoError(t, err)

	mockClient.On("Post", mock.Anything, "/auth/refresh", mock.MatchedBy(func(req interface{}) bool {
		refreshReq, ok := req.(map[string]string)
		return ok && refreshReq["refresh_token"] == "initial-token"
	})).Return(respBytes, nil)

	// Test token refresh
	ctx := context.Background()
	err = manager.RefreshToken(ctx)

	require.NoError(t, err)
	
	// Check that token was updated
	tokenInfo := manager.GetTokenInfo()
	assert.Equal(t, "new-access-token", tokenInfo.Token)
	assert.Equal(t, "Bearer", tokenInfo.Type)

	mockClient.AssertExpectations(t)
}

func TestAuthManager_IsTokenExpired(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Test with expired token (5 minutes ago)
	expiredTime := time.Now().Add(-5 * time.Minute)
	err := manager.SetToken("expired-token", expiredTime)
	require.NoError(t, err)
	
	assert.True(t, manager.IsTokenExpired())

	// Test with valid token (1 hour from now)
	validTime := time.Now().Add(time.Hour)
	err = manager.SetToken("valid-token", validTime)
	require.NoError(t, err)
	
	assert.False(t, manager.IsTokenExpired())

	// Test with token expiring soon (3 minutes from now - should be considered expired)
	soonTime := time.Now().Add(3 * time.Minute)
	err = manager.SetToken("soon-token", soonTime)
	require.NoError(t, err)
	
	assert.True(t, manager.IsTokenExpired()) // Should be true due to 5-minute buffer
}

func TestAuthManager_SetBearerToken(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Test setting bearer token
	token := "bearer-token-123"
	manager.SetBearerToken(token)

	assert.True(t, manager.IsAuthenticated())
	assert.Equal(t, auth.AuthMethodBearer, manager.GetAuthMethod())

	headers := manager.GetAuthHeaders()
	assert.Equal(t, "Bearer bearer-token-123", headers["Authorization"])

	tokenInfo := manager.GetTokenInfo()
	assert.Equal(t, token, tokenInfo.Token)
	assert.Equal(t, "Bearer", tokenInfo.Type)
}

func TestAuthManager_Logout(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Set up authenticated state
	err := manager.SetToken("test-token", time.Now().Add(time.Hour))
	require.NoError(t, err)
	assert.True(t, manager.IsAuthenticated())

	// Mock logout response (successful)
	mockClient.On("Post", mock.Anything, "/auth/logout", mock.MatchedBy(func(req interface{}) bool {
		logoutReq, ok := req.(map[string]string)
		return ok && logoutReq["token"] == "test-token"
	})).Return([]byte(`{"success": true}`), nil)

	// Test logout
	ctx := context.Background()
	err = manager.Logout(ctx)

	require.NoError(t, err)
	assert.False(t, manager.IsAuthenticated())
	assert.Equal(t, auth.AuthMethodAPIKey, manager.GetAuthMethod())
	assert.Nil(t, manager.GetTokenInfo())

	mockClient.AssertExpectations(t)
}

func TestAuthManager_GetAuthHeaders(t *testing.T) {
	tests := []struct {
		name           string
		setupAuth      func(*auth.Manager)
		expectedHeaders map[string]string
	}{
		{
			name: "API Key authentication",
			setupAuth: func(m *auth.Manager) {
				m.SetAPIKey("test-api-key")
			},
			expectedHeaders: map[string]string{
				"X-API-Key": "test-api-key",
			},
		},
		{
			name: "JWT authentication",
			setupAuth: func(m *auth.Manager) {
				err := m.SetToken("jwt-token", time.Now().Add(time.Hour))
				if err != nil {
					panic(err)
				}
			},
			expectedHeaders: map[string]string{
				"Authorization": "Bearer jwt-token",
			},
		},
		{
			name: "Bearer token authentication",
			setupAuth: func(m *auth.Manager) {
				m.SetBearerToken("bearer-token")
			},
			expectedHeaders: map[string]string{
				"Authorization": "Bearer bearer-token",
			},
		},
		{
			name:            "No authentication",
			setupAuth:       func(m *auth.Manager) {}, // No setup
			expectedHeaders: map[string]string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &MockHTTPClient{}
			manager := auth.NewManager("", mockClient)

			tt.setupAuth(manager)
			headers := manager.GetAuthHeaders()

			assert.Equal(t, tt.expectedHeaders, headers)
		})
	}
}

func TestAuthManager_AutoRefresh(t *testing.T) {
	mockClient := &MockHTTPClient{}
	manager := auth.NewManager("", mockClient)

	// Test enabling auto-refresh
	manager.SetAutoRefresh(true)

	// Set a token that expires soon
	expiryTime := time.Now().Add(15 * time.Minute) // Will trigger refresh in 5 minutes
	err := manager.SetToken("test-token", expiryTime)
	require.NoError(t, err)

	// Mock refresh response for auto-refresh
	refreshResp := auth.LoginResponse{
		AccessToken: "refreshed-token",
		TokenType:   "Bearer",
		ExpiresIn:   3600,
		ExpiresAt:   time.Now().Add(time.Hour),
	}

	respBytes, err := json.Marshal(refreshResp)
	require.NoError(t, err)

	mockClient.On("Post", mock.Anything, "/auth/refresh", mock.Anything).
		Return(respBytes, nil).Maybe() // Maybe because timing-dependent

	// Test disabling auto-refresh
	manager.SetAutoRefresh(false)

	// The auto-refresh should not trigger
	time.Sleep(100 * time.Millisecond) // Small delay to ensure no refresh happens

	// Token should still be the original one
	tokenInfo := manager.GetTokenInfo()
	assert.Equal(t, "test-token", tokenInfo.Token)
}