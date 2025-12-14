package igris

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	tests := []struct{
		name   string
		config *Config
		want   string
	}{
		{
			name:   "default config",
			config: nil,
			want:   DefaultBaseURL,
		},
		{
			name: "custom base URL",
			config: &Config{
				BaseURL: "https://api.igris.com",
			},
			want: "https://api.igris.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient(tt.config)
			if client.baseURL != tt.want {
				t.Errorf("NewClient() baseURL = %v, want %v", client.baseURL, tt.want)
			}
		})
	}
}

func TestClient_Health(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/health" {
			t.Errorf("Expected path '/v1/health', got %s", r.URL.Path)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HealthResponse{
			Status:  "healthy",
			Version: "1.0.0",
		})
	}))
	defer server.Close()

	client := NewClient(&Config{
		BaseURL: server.URL,
	})

	ctx := context.Background()
	health, err := client.Health(ctx)
	if err != nil {
		t.Fatalf("Health() error = %v", err)
	}

	if health.Status != "healthy" {
		t.Errorf("Health() status = %v, want healthy", health.Status)
	}
}

func TestClient_ListModels(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Errorf("Expected path '/v1/models', got %s", r.URL.Path)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ModelsResponse{
			Object: "list",
			Data: []Model{
				{ID: "gpt-4", Object: "model", OwnedBy: "openai"},
				{ID: "claude-3-opus", Object: "model", OwnedBy: "anthropic"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(&Config{
		BaseURL: server.URL,
	})

	ctx := context.Background()
	models, err := client.ListModels(ctx)
	if err != nil {
		t.Fatalf("ListModels() error = %v", err)
	}

	if len(models.Data) != 2 {
		t.Errorf("ListModels() returned %d models, want 2", len(models.Data))
	}
}

func TestClient_Infer(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/infer" {
			t.Errorf("Expected path '/v1/infer', got %s", r.URL.Path)
		}

		if r.Method != "POST" {
			t.Errorf("Expected method POST, got %s", r.Method)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(InferResponse{
			ID:     "chatcmpl-123",
			Object: "chat.completion",
			Model:  "gpt-4",
			Choices: []Choice{
				{
					Index: 0,
					Message: Message{
						Role:    "assistant",
						Content: "Hello! How can I help you?",
					},
					FinishReason: "stop",
				},
			},
			Usage: &Usage{
				PromptTokens:     10,
				CompletionTokens: 20,
				TotalTokens:      30,
			},
		})
	}))
	defer server.Close()

	client := NewClient(&Config{
		BaseURL: server.URL,
	})

	ctx := context.Background()
	response, err := client.Infer(ctx, &InferRequest{
		Model: "gpt-4",
		Messages: []Message{
			{Role: "user", Content: "Hello"},
		},
	})

	if err != nil {
		t.Fatalf("Infer() error = %v", err)
	}

	if len(response.Choices) == 0 {
		t.Error("Infer() returned no choices")
	}

	if response.Choices[0].Message.Content == "" {
		t.Error("Infer() returned empty content")
	}
}

func TestClient_InferWithError(t *testing.T) {
	// Create test server that returns an error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized",
		})
	}))
	defer server.Close()

	client := NewClient(&Config{
		BaseURL: server.URL,
	})

	ctx := context.Background()
	_, err := client.Infer(ctx, &InferRequest{
		Model: "gpt-4",
		Messages: []Message{
			{Role: "user", Content: "Hello"},
		},
	})

	if err == nil {
		t.Fatal("Infer() expected error, got nil")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("Expected APIError, got %T", err)
	}

	if apiErr.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected status code %d, got %d", http.StatusUnauthorized, apiErr.StatusCode)
	}
}

func TestClient_ContextCancellation(t *testing.T) {
	// Create test server with delay
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(&Config{
		BaseURL: server.URL,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := client.Health(ctx)
	if err == nil {
		t.Error("Expected context cancellation error, got nil")
	}
}

func TestHelperFunctions(t *testing.T) {
	t.Run("Int helper", func(t *testing.T) {
		v := Int(42)
		if *v != 42 {
			t.Errorf("Int(42) = %v, want 42", *v)
		}
	})

	t.Run("Float64 helper", func(t *testing.T) {
		v := Float64(0.7)
		if *v != 0.7 {
			t.Errorf("Float64(0.7) = %v, want 0.7", *v)
		}
	})
}
