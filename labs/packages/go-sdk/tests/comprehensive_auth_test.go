package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/auth"
	"github.com/igris-inertial/go-sdk/pkg/client"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type TokenResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int       `json:"expires_in"`
	User         UserInfo  `json:"user"`
}

type UserInfo struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
	IsActive bool   `json:"is_active"`
}

func TestAuthManager(t *testing.T) {
	t.Run("Login Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/auth/login", r.URL.Path)

			tokenResponse := TokenResponse{
				AccessToken:  "test-access-token",
				RefreshToken: "test-refresh-token",
				TokenType:    "bearer",
				ExpiresIn:    3600,
				User: UserInfo{
					UserID:   "user-123",
					Email:    "test@example.com",
					Username: "testuser",
					Role:     "user",
					IsActive: true,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    tokenResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		token, err := authManager.Login(context.Background(), "test@example.com", "password123")
		require.NoError(t, err)
		
		assert.Equal(t, "test-access-token", token.AccessToken)
		assert.Equal(t, "test@example.com", token.User.Email)
		assert.True(t, authManager.IsAuthenticated())
	})

	t.Run("Login Failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Invalid credentials",
				Code:    "INVALID_CREDENTIALS",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		_, err := authManager.Login(context.Background(), "invalid@example.com", "wrongpassword")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Invalid credentials")
	})

	t.Run("Token Refresh Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/auth/refresh" {
				tokenResponse := TokenResponse{
					AccessToken:  "new-access-token",
					RefreshToken: "new-refresh-token",
					TokenType:    "bearer",
					ExpiresIn:    3600,
					User: UserInfo{
						UserID:   "user-123",
						Email:    "test@example.com",
						Username: "testuser",
						Role:     "user",
						IsActive: true,
					},
				}

				response := common.APIResponse{
					Success: true,
					Data:    tokenResponse,
				}

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
			}
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// Set initial token
		initialToken := &auth.Token{
			AccessToken:  "initial-token",
			RefreshToken: "refresh-token",
			ExpiresAt:    time.Now().Add(time.Hour),
		}
		authManager.SetToken(initialToken)

		newToken, err := authManager.RefreshToken(context.Background())
		require.NoError(t, err)
		
		assert.Equal(t, "new-access-token", newToken.AccessToken)
		assert.Equal(t, "new-refresh-token", newToken.RefreshToken)
	})

	t.Run("Token Expiration Detection", func(t *testing.T) {
		cfg := &config.Config{
			BaseURL: "https://api.test.com",
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// Set expired token
		expiredToken := &auth.Token{
			AccessToken:  "expired-token",
			RefreshToken: "refresh-token",
			ExpiresAt:    time.Now().Add(-time.Hour), // Expired 1 hour ago
		}
		authManager.SetToken(expiredToken)

		assert.True(t, authManager.IsTokenExpired())
		assert.False(t, authManager.IsAuthenticated())
	})

	t.Run("Authorization Headers", func(t *testing.T) {
		cfg := &config.Config{
			BaseURL: "https://api.test.com",
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// Test without token
		headers := authManager.GetAuthHeaders()
		assert.Empty(t, headers)

		// Test with valid token
		token := &auth.Token{
			AccessToken: "test-access-token",
			TokenType:   "bearer",
			ExpiresAt:   time.Now().Add(time.Hour),
		}
		authManager.SetToken(token)

		headers = authManager.GetAuthHeaders()
		assert.Equal(t, "Bearer test-access-token", headers["Authorization"])
	})

	t.Run("Logout Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.URL.Path, "/auth/logout")
			
			response := common.APIResponse{
				Success: true,
				Message: "Logged out successfully",
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// Set token first
		token := &auth.Token{
			AccessToken:  "test-token",
			RefreshToken: "refresh-token",
			ExpiresAt:    time.Now().Add(time.Hour),
		}
		authManager.SetToken(token)

		err := authManager.Logout(context.Background())
		require.NoError(t, err)
		
		assert.False(t, authManager.IsAuthenticated())
		assert.Nil(t, authManager.GetToken())
	})

	t.Run("Concurrent Authentication", func(t *testing.T) {
		callCount := 0
		mu := sync.Mutex{}
		
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			callCount++
			mu.Unlock()

			// Simulate processing delay
			time.Sleep(100 * time.Millisecond)

			tokenResponse := TokenResponse{
				AccessToken:  fmt.Sprintf("token-%d", callCount),
				RefreshToken: "refresh-token",
				TokenType:    "bearer",
				ExpiresIn:    3600,
				User: UserInfo{
					UserID:   "user-123",
					Email:    "test@example.com",
					Username: "testuser",
					Role:     "user",
					IsActive: true,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    tokenResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// Make 5 concurrent login attempts
		var wg sync.WaitGroup
		results := make([]*auth.Token, 5)
		errors := make([]error, 5)

		for i := 0; i < 5; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()
				token, err := authManager.Login(context.Background(), "test@example.com", "password123")
				results[index] = token
				errors[index] = err
			}(i)
		}

		wg.Wait()

		// All should succeed
		for i := 0; i < 5; i++ {
			require.NoError(t, errors[i])
			require.NotNil(t, results[i])
		}
	})
}

func TestAutoTokenRefresh(t *testing.T) {
	refreshCallCount := 0
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/refresh":
			refreshCallCount++
			tokenResponse := TokenResponse{
				AccessToken:  fmt.Sprintf("refreshed-token-%d", refreshCallCount),
				RefreshToken: "new-refresh-token",
				TokenType:    "bearer",
				ExpiresIn:    3600,
				User: UserInfo{
					UserID:   "user-123",
					Email:    "test@example.com",
					Username: "testuser",
					Role:     "user",
					IsActive: true,
				},
			}

			response := common.APIResponse{
				Success: true,
				Data:    tokenResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)

		case "/api/test":
			// First call returns 401, subsequent calls succeed
			if strings.Contains(r.Header.Get("Authorization"), "expired-token") {
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(common.APIError{
					Success: false,
					Message: "Token expired",
					Code:    "TOKEN_EXPIRED",
				})
			} else {
				response := common.APIResponse{
					Success: true,
					Data:    map[string]interface{}{"message": "success"},
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
			}
		}
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	authManager := auth.NewManager(cfg)
	
	// Set expired token
	expiredToken := &auth.Token{
		AccessToken:  "expired-token",
		RefreshToken: "valid-refresh-token",
		ExpiresAt:    time.Now().Add(-time.Hour),
	}
	authManager.SetToken(expiredToken)

	// Make authenticated request (should trigger auto-refresh)
	response, err := authManager.MakeAuthenticatedRequest(context.Background(), "GET", "/api/test", nil)
	require.NoError(t, err)
	
	assert.True(t, response.Success)
	assert.Equal(t, 1, refreshCallCount)
	
	// Token should be updated
	newToken := authManager.GetToken()
	assert.NotNil(t, newToken)
	assert.Equal(t, "refreshed-token-1", newToken.AccessToken)
}

func TestTokenStorage(t *testing.T) {
	t.Run("Memory Storage", func(t *testing.T) {
		storage := auth.NewMemoryStorage()
		
		// Initially empty
		token := storage.GetToken()
		assert.Nil(t, token)

		// Store token
		testToken := &auth.Token{
			AccessToken:  "test-token",
			RefreshToken: "refresh-token",
			TokenType:    "bearer",
			ExpiresAt:    time.Now().Add(time.Hour),
		}
		
		err := storage.StoreToken(testToken)
		require.NoError(t, err)

		// Retrieve token
		retrieved := storage.GetToken()
		require.NotNil(t, retrieved)
		assert.Equal(t, "test-token", retrieved.AccessToken)

		// Clear token
		storage.ClearToken()
		cleared := storage.GetToken()
		assert.Nil(t, cleared)
	})

	t.Run("File Storage", func(t *testing.T) {
		tempFile := fmt.Sprintf("/tmp/test-tokens-%d.json", time.Now().UnixNano())
		storage := auth.NewFileStorage(tempFile)
		
		// Initially empty
		token := storage.GetToken()
		assert.Nil(t, token)

		// Store token
		testToken := &auth.Token{
			AccessToken:  "file-test-token",
			RefreshToken: "file-refresh-token",
			TokenType:    "bearer",
			ExpiresAt:    time.Now().Add(time.Hour),
		}
		
		err := storage.StoreToken(testToken)
		require.NoError(t, err)

		// Create new storage instance (test persistence)
		newStorage := auth.NewFileStorage(tempFile)
		retrieved := newStorage.GetToken()
		require.NotNil(t, retrieved)
		assert.Equal(t, "file-test-token", retrieved.AccessToken)

		// Clear token
		storage.ClearToken()
		cleared := storage.GetToken()
		assert.Nil(t, cleared)
	})
}

func TestSecurityFeatures(t *testing.T) {
	t.Run("Token Sanitization", func(t *testing.T) {
		cfg := &config.Config{
			BaseURL: "https://api.test.com",
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		token := &auth.Token{
			AccessToken:  "sensitive-token-12345",
			RefreshToken: "sensitive-refresh-67890",
			TokenType:    "bearer",
			ExpiresAt:    time.Now().Add(time.Hour),
		}
		authManager.SetToken(token)

		// Token should not appear in string representation
		authStr := fmt.Sprintf("%+v", authManager)
		assert.NotContains(t, authStr, "sensitive-token-12345")
		assert.NotContains(t, authStr, "sensitive-refresh-67890")
	})

	t.Run("Secure Token Comparison", func(t *testing.T) {
		cfg := &config.Config{
			BaseURL: "https://api.test.com",
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		token1 := &auth.Token{
			AccessToken:  "token-123",
			RefreshToken: "refresh-123",
			TokenType:    "bearer",
			ExpiresAt:    time.Now().Add(time.Hour),
		}

		token2 := &auth.Token{
			AccessToken:  "token-456",
			RefreshToken: "refresh-456",
			TokenType:    "bearer",
			ExpiresAt:    time.Now().Add(time.Hour),
		}

		authManager.SetToken(token1)
		
		assert.True(t, authManager.IsTokenValid(token1))
		assert.False(t, authManager.IsTokenValid(token2))
	})

	t.Run("Rate Limiting", func(t *testing.T) {
		rateLimitCount := 0
		
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rateLimitCount++
			
			w.WriteHeader(http.StatusTooManyRequests)
			w.Header().Set("Retry-After", "60")
			json.NewEncoder(w).Encode(common.APIError{
				Success: false,
				Message: "Rate limit exceeded",
				Code:    "RATE_LIMIT_EXCEEDED",
			})
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		_, err := authManager.Login(context.Background(), "test@example.com", "password123")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Rate limit exceeded")
		assert.Equal(t, 1, rateLimitCount)
	})
}

func TestErrorHandling(t *testing.T) {
	t.Run("Network Error", func(t *testing.T) {
		cfg := &config.Config{
			BaseURL: "http://non-existent-server.test",
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		_, err := authManager.Login(context.Background(), "test@example.com", "password123")
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "connection")
	})

	t.Run("Malformed Response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("invalid json"))
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		_, err := authManager.Login(context.Background(), "test@example.com", "password123")
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "json")
	})

	t.Run("Context Cancellation", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate slow response
			time.Sleep(2 * time.Second)
			
			tokenResponse := TokenResponse{
				AccessToken: "test-token",
				TokenType:   "bearer",
				ExpiresIn:   3600,
			}

			response := common.APIResponse{
				Success: true,
				Data:    tokenResponse,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// Create context with short timeout
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		_, err := authManager.Login(ctx, "test@example.com", "password123")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "context")
	})
}

func TestAuthenticationFlow(t *testing.T) {
	t.Run("Complete Authentication Flow", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			
			switch r.URL.Path {
			case "/auth/login":
				tokenResponse := TokenResponse{
					AccessToken:  "flow-test-token",
					RefreshToken: "flow-refresh-token",
					TokenType:    "bearer",
					ExpiresIn:    3600,
					User: UserInfo{
						UserID:   "user-123",
						Email:    "test@example.com",
						Username: "testuser",
						Role:     "user",
						IsActive: true,
					},
				}

				response := common.APIResponse{
					Success: true,
					Data:    tokenResponse,
				}
				json.NewEncoder(w).Encode(response)

			case "/api/user/profile":
				// Authenticated endpoint
				authHeader := r.Header.Get("Authorization")
				if !strings.Contains(authHeader, "flow-test-token") {
					w.WriteHeader(http.StatusUnauthorized)
					json.NewEncoder(w).Encode(common.APIError{
						Success: false,
						Message: "Unauthorized",
						Code:    "UNAUTHORIZED",
					})
					return
				}

				response := common.APIResponse{
					Success: true,
					Data:    map[string]interface{}{"profile": "data"},
				}
				json.NewEncoder(w).Encode(response)

			case "/auth/logout":
				response := common.APIResponse{
					Success: true,
					Message: "Logged out successfully",
				}
				json.NewEncoder(w).Encode(response)
			}
		}))
		defer server.Close()

		cfg := &config.Config{
			BaseURL: server.URL,
			APIKey:  "test-api-key",
		}

		authManager := auth.NewManager(cfg)
		
		// 1. Login
		token, err := authManager.Login(context.Background(), "test@example.com", "password123")
		require.NoError(t, err)
		assert.Equal(t, "flow-test-token", token.AccessToken)
		assert.True(t, authManager.IsAuthenticated())

		// 2. Make authenticated request
		response, err := authManager.MakeAuthenticatedRequest(context.Background(), "GET", "/api/user/profile", nil)
		require.NoError(t, err)
		assert.True(t, response.Success)

		// 3. Logout
		err = authManager.Logout(context.Background())
		require.NoError(t, err)
		assert.False(t, authManager.IsAuthenticated())
		assert.Nil(t, authManager.GetToken())
	})
}

// Benchmark tests
func BenchmarkAuthManager_Login(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenResponse := TokenResponse{
			AccessToken:  "bench-token",
			RefreshToken: "bench-refresh",
			TokenType:    "bearer",
			ExpiresIn:    3600,
			User: UserInfo{
				UserID:   "user-123",
				Email:    "test@example.com",
				Username: "testuser",
				Role:     "user",
				IsActive: true,
			},
		}

		response := common.APIResponse{
			Success: true,
			Data:    tokenResponse,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	authManager := auth.NewManager(cfg)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := authManager.Login(context.Background(), "test@example.com", "password123")
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAuthManager_MakeAuthenticatedRequest(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := common.APIResponse{
			Success: true,
			Data:    map[string]interface{}{"test": "data"},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
	}

	authManager := auth.NewManager(cfg)
	
	// Set token
	token := &auth.Token{
		AccessToken: "bench-token",
		TokenType:   "bearer",
		ExpiresAt:   time.Now().Add(time.Hour),
	}
	authManager.SetToken(token)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := authManager.MakeAuthenticatedRequest(context.Background(), "GET", "/api/test", nil)
		if err != nil {
			b.Fatal(err)
		}
	}
}