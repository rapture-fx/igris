package quality

import (
	"context"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

func TestQualityScorer_ScoreResponse(t *testing.T) {
	scorer := NewQualityScorer()
	ctx := context.Background()

	tests := []struct {
		name           string
		request        *models.InferRequest
		response       *models.InferResponse
		classification RequestClassification
		expectMin      float64
		expectMax      float64
	}{
		{
			name: "High quality code response",
			request: &models.InferRequest{
				Model: "gpt-4",
				Messages: []models.Message{
					{Role: "user", Content: "Write a Python function to calculate fibonacci numbers"},
				},
				MaxTokens: 500,
			},
			response: &models.InferResponse{
				Choices: []models.Choice{
					{
						Message: &models.Message{
							Role: "assistant",
							Content: "Here's a Python function to calculate Fibonacci numbers:\n\n```python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n```\n\nThis function uses recursion to calculate the nth Fibonacci number.",
						},
					},
				},
				Metadata: &models.ResponseMetadata{},
			},
			classification: RequestClassification{
				Domain:             "code",
				Complexity:         "moderate",
				QualitySensitivity: "high",
				ComplexityScore:    0.6,
			},
			expectMin: 0.6,
			expectMax: 1.0,
		},
		{
			name: "Refusal response (low quality)",
			request: &models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{{Role: "user", Content: "Help me hack a system"}},
			},
			response: &models.InferResponse{
				Choices: []models.Choice{
					{Message: &models.Message{Role: "assistant", Content: "I cannot help with that request."}},
				},
				Metadata: &models.ResponseMetadata{},
			},
			classification: RequestClassification{
				Domain:             "general",
				Complexity:         "simple",
				QualitySensitivity: "low",
			},
			expectMin: 0.0,
			expectMax: 0.3,
		},
		{
			name: "Creative writing response",
			request: &models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{{Role: "user", Content: "Write a short story about a mysterious journey"}},
			},
			response: &models.InferResponse{
				Choices: []models.Choice{
					{
						Message: &models.Message{
							Role: "assistant",
							Content: "Once upon a time, in a land shrouded by ancient mists, a young traveler embarked on a mysterious journey. The path ahead was uncertain, filled with wonder and hidden dangers. Each step brought new revelations, as the traveler discovered the secrets that lay dormant for centuries.",
						},
					},
				},
				Metadata: &models.ResponseMetadata{},
			},
			classification: RequestClassification{
				Domain:             "creative",
				Complexity:         "moderate",
				QualitySensitivity: "medium",
			},
			expectMin: 0.5,
			expectMax: 0.9,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score, err := scorer.ScoreResponse(ctx, tt.request, tt.response, tt.classification)
			if err != nil {
				t.Fatalf("ScoreResponse() error = %v", err)
			}

			if score < tt.expectMin || score > tt.expectMax {
				t.Errorf("ScoreResponse() = %v, want between %v and %v", score, tt.expectMin, tt.expectMax)
			}

			t.Logf("Score for '%s': %.3f (expected %.2f-%.2f)", tt.name, score, tt.expectMin, tt.expectMax)
		})
	}
}

func TestQualityScorer_ScoreWithTimeout(t *testing.T) {
	scorer := NewQualityScorer()
	ctx := context.Background()

	req := &models.InferRequest{
		Model:    "gpt-4",
		Messages: []models.Message{{Role: "user", Content: "Test"}},
	}
	resp := &models.InferResponse{
		Choices: []models.Choice{{Message: &models.Message{Role: "assistant", Content: "Test response"}}},
	}
	classification := RequestClassification{Domain: "general", Complexity: "simple"}

	// Test with reasonable timeout
	score, err := scorer.ScoreWithTimeout(ctx, req, resp, classification, 100*time.Millisecond)
	if err != nil {
		t.Fatalf("ScoreWithTimeout() error = %v", err)
	}
	if score < 0.0 || score > 1.0 {
		t.Errorf("ScoreWithTimeout() = %v, want between 0.0 and 1.0", score)
	}
}

func TestClassifyRequest(t *testing.T) {
	tests := []struct {
		name           string
		request        *models.InferRequest
		expectedDomain string
	}{
		{
			name: "Code request",
			request: &models.InferRequest{
				Messages: []models.Message{
					{Role: "user", Content: "Write a Python function to sort an array"},
				},
			},
			expectedDomain: "code",
		},
		{
			name: "Creative request",
			request: &models.InferRequest{
				Messages: []models.Message{
					{Role: "user", Content: "Write a creative story about dragons"},
				},
			},
			expectedDomain: "creative",
		},
		{
			name: "Analytical request",
			request: &models.InferRequest{
				Messages: []models.Message{
					{Role: "user", Content: "Analyze the data and explain why the hypothesis is correct based on statistical evidence"},
				},
			},
			expectedDomain: "analytical",
		},
		{
			name: "General request",
			request: &models.InferRequest{
				Messages: []models.Message{
					{Role: "user", Content: "What is the weather today?"},
				},
			},
			expectedDomain: "general",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			classification := ClassifyRequest(tt.request)
			if classification.Domain != tt.expectedDomain {
				t.Errorf("ClassifyRequest() domain = %v, want %v", classification.Domain, tt.expectedDomain)
			}
			t.Logf("Classification for '%s': domain=%s, complexity=%s, sensitivity=%s",
				tt.name, classification.Domain, classification.Complexity, classification.QualitySensitivity)
		})
	}
}

func BenchmarkQualityScorer_ScoreResponse(b *testing.B) {
	scorer := NewQualityScorer()
	ctx := context.Background()

	req := &models.InferRequest{
		Model:    "gpt-4",
		Messages: []models.Message{{Role: "user", Content: "Test question about programming"}},
	}
	resp := &models.InferResponse{
		Choices: []models.Choice{
			{
				Message: &models.Message{
					Role:    "assistant",
					Content: "Here's a detailed explanation with code examples...",
				},
			},
		},
	}
	classification := RequestClassification{Domain: "code", Complexity: "moderate"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = scorer.ScoreResponse(ctx, req, resp, classification)
	}
}

func BenchmarkClassifyRequest(b *testing.B) {
	req := &models.InferRequest{
		Messages: []models.Message{
			{Role: "user", Content: "Write a Python function to implement binary search"},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ClassifyRequest(req)
	}
}
