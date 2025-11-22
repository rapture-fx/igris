// +build integration

package tests

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// SemanticClassifyRequest matches the API schema
type SemanticClassifyRequest struct {
	Prompt string `json:"prompt"`
}

// SemanticClassifyResponse matches the API response
type SemanticClassifyResponse struct {
	Class         string   `json:"class"`
	Confidence    float64  `json:"confidence"`
	Alternatives  []Alternative `json:"alternatives,omitempty"`
	LatencyMs     float64  `json:"latency_ms"`
	CacheHit      bool     `json:"cache_hit"`
}

type Alternative struct {
	Class      string  `json:"class"`
	Confidence float64 `json:"confidence"`
}

// SemanticStatsResponse matches GET /v1/routing/semantic/stats
type SemanticStatsResponse struct {
	TotalClassifications int                `json:"total_classifications"`
	ByClass              map[string]int     `json:"by_class"`
	AverageConfidence    float64            `json:"average_confidence"`
	AverageLatencyMs     float64            `json:"average_latency_ms"`
	CacheHitRate         float64            `json:"cache_hit_rate"`
}

// TestPhase3SemanticClassification validates the full semantic routing flow
func TestPhase3SemanticClassification(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()
	db := setupTestDatabase(t)
	defer db.Close()

	testCases := []struct {
		name            string
		prompt          string
		expectedClass   string
		minConfidence   float64
	}{
		{
			name:            "Code Generation Task",
			prompt:          "Write a Python function to calculate fibonacci numbers using recursion",
			expectedClass:   "code_generation",
			minConfidence:   0.70,
		},
		{
			name:            "Question Answering Task",
			prompt:          "What is the capital of France and what is its population?",
			expectedClass:   "question_answering",
			minConfidence:   0.60,
		},
		{
			name:            "Translation Task",
			prompt:          "Translate this English text to Spanish: Hello, how are you today?",
			expectedClass:   "translation",
			minConfidence:   0.80,
		},
		{
			name:            "Summarization Task",
			prompt:          "Summarize the following article in 3 sentences: [long text about climate change]",
			expectedClass:   "summarization",
			minConfidence:   0.70,
		},
		{
			name:            "Creative Writing Task",
			prompt:          "Write a short story about a robot who discovers emotions",
			expectedClass:   "creative_writing",
			minConfidence:   0.60,
		},
		{
			name:            "Data Analysis Task",
			prompt:          "Analyze this dataset and identify trends: [CSV data]",
			expectedClass:   "data_analysis",
			minConfidence:   0.75,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Submit classification request
			req := SemanticClassifyRequest{Prompt: tc.prompt}
			resp := classifyPrompt(t, apiURL, req)

			t.Logf("Classified as: %s (confidence: %.2f, latency: %.2fms, cache_hit: %v)",
				resp.Class, resp.Confidence, resp.LatencyMs, resp.CacheHit)

			// Verify classification
			if resp.Class != tc.expectedClass {
				t.Errorf("Expected class %s, got %s", tc.expectedClass, resp.Class)
			}

			if resp.Confidence < tc.minConfidence {
				t.Errorf("Confidence %.2f below threshold %.2f", resp.Confidence, tc.minConfidence)
			}

			// Verify latency target (<20ms for cache miss)
			if !resp.CacheHit && resp.LatencyMs > 20 {
				t.Errorf("Classification latency %.2fms exceeds 20ms target", resp.LatencyMs)
			}

			// Verify database persistence
			verifyClassificationPersisted(t, db, tc.expectedClass)
		})
	}
}

// TestPhase3CacheHitOptimization validates Redis caching
func TestPhase3CacheHitOptimization(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()

	prompt := "Write a function to sort an array in JavaScript"

	// First request - should be cache miss
	t.Log("Sending first request (cache miss expected)...")
	resp1 := classifyPrompt(t, apiURL, SemanticClassifyRequest{Prompt: prompt})
	if resp1.CacheHit {
		t.Log("Warning: Expected cache miss on first request")
	}
	firstLatency := resp1.LatencyMs

	// Second request - should be cache hit
	time.Sleep(100 * time.Millisecond)
	t.Log("Sending second request (cache hit expected)...")
	resp2 := classifyPrompt(t, apiURL, SemanticClassifyRequest{Prompt: prompt})

	if !resp2.CacheHit {
		t.Error("Expected cache hit on second request")
	}

	// Cache hit should be significantly faster
	if resp2.LatencyMs >= firstLatency {
		t.Errorf("Cache hit (%.2fms) not faster than cache miss (%.2fms)",
			resp2.LatencyMs, firstLatency)
	}

	t.Logf("✓ Cache optimization working: %.2fms -> %.2fms (%.1fx speedup)",
		firstLatency, resp2.LatencyMs, firstLatency/resp2.LatencyMs)
}

// TestPhase3SemanticStatsEndpoint validates GET /v1/routing/semantic/stats
func TestPhase3SemanticStatsEndpoint(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()
	db := setupTestDatabase(t)
	defer db.Close()

	// Seed some classification data
	seedSemanticClassifications(t, db)

	// Query stats endpoint
	t.Log("Querying /v1/routing/semantic/stats...")
	resp, err := http.Get(apiURL + "/v1/routing/semantic/stats")
	if err != nil {
		t.Fatalf("Failed to query stats: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	var stats SemanticStatsResponse
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		t.Fatalf("Failed to decode stats: %v", err)
	}

	// Validate stats
	if stats.TotalClassifications == 0 {
		t.Error("Expected total_classifications > 0")
	}

	if len(stats.ByClass) == 0 {
		t.Error("Expected by_class breakdown")
	}

	if stats.AverageConfidence < 0.5 || stats.AverageConfidence > 1.0 {
		t.Errorf("Invalid average_confidence: %.2f", stats.AverageConfidence)
	}

	t.Logf("Stats: total=%d, classes=%d, avg_confidence=%.3f, cache_hit_rate=%.2f%%",
		stats.TotalClassifications, len(stats.ByClass),
		stats.AverageConfidence, stats.CacheHitRate*100)

	t.Log("✓ Semantic stats endpoint working")
}

// TestPhase3AlternativeClassSuggestions validates alternative class suggestions
func TestPhase3AlternativeClassSuggestions(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()

	// Ambiguous prompt that could match multiple classes
	prompt := "Explain how neural networks work and write sample code"

	resp := classifyPrompt(t, apiURL, SemanticClassifyRequest{Prompt: prompt})

	if len(resp.Alternatives) == 0 {
		t.Error("Expected alternative class suggestions for ambiguous prompt")
	}

	// Verify alternatives are sorted by confidence
	for i := 1; i < len(resp.Alternatives); i++ {
		if resp.Alternatives[i].Confidence > resp.Alternatives[i-1].Confidence {
			t.Error("Alternatives not sorted by confidence")
		}
	}

	t.Logf("Primary: %s (%.2f), Alternatives: %d",
		resp.Class, resp.Confidence, len(resp.Alternatives))
	for i, alt := range resp.Alternatives {
		t.Logf("  %d. %s (%.2f)", i+1, alt.Class, alt.Confidence)
	}

	t.Log("✓ Alternative suggestions working")
}

// TestPhase3SemanticRoutingIntegration validates end-to-end routing flow
func TestPhase3SemanticRoutingIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()
	db := setupTestDatabase(t)
	defer db.Close()

	// 1. Classify prompt
	prompt := "Write a Python function to reverse a string"
	t.Log("Step 1: Classifying prompt...")
	classification := classifyPrompt(t, apiURL, SemanticClassifyRequest{Prompt: prompt})
	t.Logf("Classified as: %s", classification.Class)

	// 2. Verify bandit arms exist for this class
	t.Log("Step 2: Verifying bandit arms exist...")
	var armCount int
	err := db.QueryRow(
		"SELECT COUNT(*) FROM bandit_arms WHERE semantic_class = $1",
		classification.Class,
	).Scan(&armCount)
	if err != nil {
		t.Fatalf("Failed to query bandit arms: %v", err)
	}
	if armCount == 0 {
		t.Error("No bandit arms configured for class")
	}
	t.Logf("Found %d bandit arms", armCount)

	// 3. Select provider using Thompson Sampling
	t.Log("Step 3: Selecting provider via Thompson Sampling...")
	provider := selectProviderForClass(t, db, classification.Class)
	t.Logf("Selected provider: %s", provider)

	// 4. Simulate inference and submit feedback
	t.Log("Step 4: Simulating inference and submitting feedback...")
	feedback := FeedbackRequest{
		SemanticClass: classification.Class,
		Provider:      provider,
		LatencyMs:     145.5,
		CostUSD:       0.002,
		Success:       true,
		Reward:        0.88,
	}

	_, err = db.Exec(`
		INSERT INTO feedback_events (semantic_class, provider, latency_ms, cost_usd, success, reward)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, feedback.SemanticClass, feedback.Provider, feedback.LatencyMs,
		feedback.CostUSD, feedback.Success, feedback.Reward)
	if err != nil {
		t.Fatalf("Failed to submit feedback: %v", err)
	}

	// 5. Trigger bandit update
	t.Log("Step 5: Updating bandit arm...")
	_, err = db.Exec("SELECT update_bandit_arm_from_feedback($1, $2)",
		classification.Class, provider)
	if err != nil {
		t.Fatalf("Failed to update bandit arm: %v", err)
	}

	// 6. Verify arm was updated
	var alpha, beta float64
	err = db.QueryRow(
		"SELECT alpha, beta FROM bandit_arms WHERE semantic_class = $1 AND provider = $2",
		classification.Class, provider,
	).Scan(&alpha, &beta)
	if err != nil {
		t.Fatalf("Failed to query updated arm: %v", err)
	}

	totalSamples := alpha + beta
	if totalSamples <= 2.0 {
		t.Error("Bandit arm was not updated")
	}

	t.Logf("Bandit arm updated: alpha=%.2f, beta=%.2f, samples=%.0f", alpha, beta, totalSamples)
	t.Log("✓ End-to-end semantic routing flow complete")
}

// Helper functions

func classifyPrompt(t *testing.T, apiURL string, req SemanticClassifyRequest) SemanticClassifyResponse {
	payload, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	resp, err := http.Post(apiURL+"/v1/routing/semantic/classify",
		"application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("Failed to POST classify: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	var result SemanticClassifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	return result
}

func verifyClassificationPersisted(t *testing.T, db *sql.DB, expectedClass string) {
	var count int
	query := `
		SELECT COUNT(*)
		FROM semantic_classifications
		WHERE class = $1 AND created_at >= NOW() - INTERVAL '10 seconds'
	`
	err := db.QueryRow(query, expectedClass).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query classifications: %v", err)
	}

	if count == 0 {
		t.Error("Classification was not persisted to database")
	}
}

func seedSemanticClassifications(t *testing.T, db *sql.DB) {
	classes := []string{"code_generation", "question_answering", "translation", "summarization"}

	for _, class := range classes {
		_, err := db.Exec(`
			INSERT INTO semantic_classifications (prompt_hash, class, confidence, latency_ms, cache_hit)
			VALUES ($1, $2, $3, $4, $5)
		`, fmt.Sprintf("hash_%s", class), class, 0.85, 10.0, false)
		if err != nil {
			t.Logf("Warning: Failed to seed classification: %v", err)
		}
	}

	t.Log("Seeded semantic classifications")
}

func selectProviderForClass(t *testing.T, db *sql.DB, semanticClass string) string {
	var provider string
	query := `
		SELECT provider
		FROM bandit_arms
		WHERE semantic_class = $1
		ORDER BY RANDOM() * (alpha / (alpha + beta)) DESC
		LIMIT 1
	`
	err := db.QueryRow(query, semanticClass).Scan(&provider)
	if err != nil {
		// If no arms exist, return default
		return "openai"
	}
	return provider
}
