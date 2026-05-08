package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestHTTPAdapterSendsNativeAnthropicMessage(t *testing.T) {
	var gotPath string
	var gotAPIKey string
	var gotVersion string
	var gotBody anthropicMessageRequest

	adapter := NewHTTPAdapter(5 * time.Second)
	adapter.httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		gotPath = r.URL.Path
		gotAPIKey = r.Header.Get("x-api-key")
		gotVersion = r.Header.Get("anthropic-version")
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"content-type": []string{"application/json"}},
			Body: io.NopCloser(bytes.NewBufferString(`{
			"id":"msg_123",
			"type":"message",
			"role":"assistant",
			"model":"claude-test",
			"content":[{"type":"text","text":"hello"}],
			"stop_reason":"end_turn",
			"usage":{"input_tokens":3,"output_tokens":2}
		}`)),
		}, nil
	})}

	provider := &models.ProviderRegistry{
		ID:                 "provider-1",
		Name:               "anthropic",
		BaseURL:            "https://api.anthropic.test/v1",
		AuthHeaderTemplate: "x-api-key: {key}",
		CompatibilityClass: models.AnthropicCompatible,
	}
	maxTokens := 7
	result := adapter.SendChatCompletion(context.Background(), provider, "sk-ant-test", &ChatCompletionRequest{
		Model:     "claude-test",
		MaxTokens: &maxTokens,
		Messages: []ChatMessage{
			{Role: "system", Content: "be concise"},
			{Role: "user", Content: "hi"},
		},
	})

	if !result.Success {
		t.Fatalf("expected success, got error: %v", result.Error)
	}
	if gotPath != "/v1/messages" {
		t.Fatalf("path = %q, want /v1/messages", gotPath)
	}
	if gotAPIKey != "sk-ant-test" {
		t.Fatalf("x-api-key header = %q", gotAPIKey)
	}
	if gotVersion != anthropicVersion {
		t.Fatalf("anthropic-version = %q, want %q", gotVersion, anthropicVersion)
	}
	if gotBody.System != "be concise" {
		t.Fatalf("system = %q", gotBody.System)
	}
	if len(gotBody.Messages) != 1 || gotBody.Messages[0].Role != "user" || gotBody.Messages[0].Content != "hi" {
		t.Fatalf("messages = %#v", gotBody.Messages)
	}
	if gotBody.MaxTokens != 7 {
		t.Fatalf("max_tokens = %d, want 7", gotBody.MaxTokens)
	}
	if result.Response == nil || result.Response.Choices[0].Message.Content != "hello" {
		t.Fatalf("unexpected normalized response: %#v", result.Response)
	}
	if result.Response.Usage.TotalTokens != 5 {
		t.Fatalf("total tokens = %d, want 5", result.Response.Usage.TotalTokens)
	}
}

func TestHTTPAdapterKeepsOpenAICompatibleChatCompletionsPath(t *testing.T) {
	var gotPath string
	adapter := NewHTTPAdapter(5 * time.Second)
	adapter.httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		gotPath = r.URL.Path
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"content-type": []string{"application/json"}},
			Body: io.NopCloser(bytes.NewBufferString(`{
			"id":"chatcmpl_123",
			"object":"chat.completion",
			"created":1,
			"model":"model-test",
			"choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}
		}`)),
		}, nil
	})}

	provider := &models.ProviderRegistry{
		ID:                 "provider-2",
		Name:               "openai",
		BaseURL:            "https://api.openai.test/v1",
		AuthHeaderTemplate: "Authorization: Bearer {key}",
		CompatibilityClass: models.OpenAICompatible,
	}
	result := adapter.SendChatCompletion(context.Background(), provider, "sk-test", &ChatCompletionRequest{
		Model:    "model-test",
		Messages: []ChatMessage{{Role: "user", Content: "hi"}},
	})

	if !result.Success {
		t.Fatalf("expected success, got error: %v", result.Error)
	}
	if gotPath != "/v1/chat/completions" {
		t.Fatalf("path = %q, want /v1/chat/completions", gotPath)
	}
}
