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

// FeedbackRequest matches the API schema for feedback submission
type FeedbackRequest struct {
	SemanticClass string  `json:"semantic_class"`
	Provider      string  `json:"provider"`
	LatencyMs     float64 `json:"latency_ms"`
	CostUSD       float64 `json:"cost_usd"`
	Success       bool    `json:"success"`
	Reward        float64 `json:"reward"`
}

// BatchFeedbackRequest for batch submissions
type BatchFeedbackRequest struct {
	Events []FeedbackRequest `json:"events"`
}

// FeedbackStatsResponse matches the /v1/feedback/stats API response
type FeedbackStatsResponse struct {
	TotalEvents      int                      `json:"total_events"`
	ByClass          map[string]int           `json:"by_class"`
	ByProvider       map[string]int           `json:"by_provider"`
	AverageReward    float64                  `json:"average_reward"`
	AverageLatencyMs float64                  `json:"average_latency_ms"`
	SuccessRate      float64                  `json:"success_rate"`
	Last24Hours      FeedbackStats24HResponse `json:"last_24_hours"`
}

type FeedbackStats24HResponse struct {
	EventCount int     `json:"event_count"`
	SuccessRate float64 `json:"success_rate"`
}

// TestFeedbackAPISingleSubmission validates POST /v1/feedback
func TestFeedbackAPISingleSubmission(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()
	db := setupTestDatabase(t)
	defer db.Close()

	// Prepare feedback event
	feedback := FeedbackRequest{
		SemanticClass: "code_generation",
		Provider:      "openai",
		LatencyMs:     150.5,
		CostUSD:       0.002,
		Success:       true,
		Reward:        0.85,
	}

	// Submit via API
	t.Log("Submitting single feedback event via API...")
	resp := submitFeedbackAPI(t, apiURL+"/v1/feedback", feedback)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 201/200, got %d: %s", resp.StatusCode, string(body))
	}

	// Verify database insertion
	time.Sleep(100 * time.Millisecond) // Allow async processing

	var count int
	query := `SELECT COUNT(*) FROM feedback_events WHERE semantic_class = $1 AND provider = $2`
	err := db.QueryRow(query, feedback.SemanticClass, feedback.Provider).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query feedback events: %v", err)
	}

	if count == 0 {
		t.Error("Feedback event was not persisted to database")
	}

	t.Logf("✓ Single feedback submission successful (count: %d)", count)
}

// TestFeedbackAPIBatchSubmission validates POST /v1/feedback/batch
func TestFeedbackAPIBatchSubmission(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()
	db := setupTestDatabase(t)
	defer db.Close()

	// Prepare batch of feedback events
	batch := BatchFeedbackRequest{
		Events: []FeedbackRequest{
			{SemanticClass: "code_generation", Provider: "openai", LatencyMs: 145, CostUSD: 0.002, Success: true, Reward: 0.88},
			{SemanticClass: "code_generation", Provider: "anthropic", LatencyMs: 120, CostUSD: 0.003, Success: true, Reward: 0.92},
			{SemanticClass: "question_answering", Provider: "cohere", LatencyMs: 200, CostUSD: 0.001, Success: false, Reward: 0.0},
			{SemanticClass: "translation", Provider: "google", LatencyMs: 180, CostUSD: 0.0015, Success: true, Reward: 0.75},
		},
	}

	// Submit batch via API
	t.Logf("Submitting batch of %d feedback events...", len(batch.Events))
	payload, _ := json.Marshal(batch)
	resp, err := http.Post(apiURL+"/v1/feedback/batch", "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("Failed to submit batch feedback: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 201/200, got %d: %s", resp.StatusCode, string(body))
	}

	// Verify all events were persisted
	time.Sleep(200 * time.Millisecond)

	var count int
	query := `SELECT COUNT(*) FROM feedback_events WHERE created_at >= NOW() - INTERVAL '10 seconds'`
	err = db.QueryRow(query).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query feedback events: %v", err)
	}

	if count < len(batch.Events) {
		t.Errorf("Expected at least %d events, got %d", len(batch.Events), count)
	}

	t.Logf("✓ Batch feedback submission successful (%d events)", count)
}

// TestFeedbackAPIStatsEndpoint validates GET /v1/feedback/stats
func TestFeedbackAPIStatsEndpoint(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	apiURL := getAPIBaseURL()
	db := setupTestDatabase(t)
	defer db.Close()

	// Seed some feedback data
	seedFeedbackData(t, db)

	// Query stats endpoint
	t.Log("Querying /v1/feedback/stats...")
	resp, err := http.Get(apiURL + "/v1/feedback/stats")
	if err != nil {
		t.Fatalf("Failed to query stats endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var stats FeedbackStatsResponse
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		t.Fatalf("Failed to decode stats response: %v", err)
	}

	// Validate stats structure
	if stats.TotalEvents == 0 {
		t.Error("Expected total_events > 0")
	}

	if len(stats.ByClass) == 0 {
		t.Error("Expected by_class breakdown")
	}

	if len(stats.ByProvider) == 0 {
		t.Error("Expected by_provider breakdown")
	}

	t.Logf("Stats: total=%d, classes=%d, providers=%d, avg_reward=%.3f, success_rate=%.2f%%",
		stats.TotalEvents, len(stats.ByClass), len(stats.ByProvider),
		stats.AverageReward, stats.SuccessRate*100)

	t.Log("✓ Feedback stats endpoint working correctly")
}

// TestFeedbackLoopUpdatesBanditArms verifies that feedback updates bandit parameters
func TestFeedbackLoopUpdatesBanditArms(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDatabase(t)
	defer db.Close()

	semanticClass := "code_generation"
	provider := "openai"

	// Step 1: Seed initial bandit arm
	t.Logf("Seeding bandit arm for %s / %s", semanticClass, provider)
	_, err := db.Exec(`
		INSERT INTO bandit_arms (semantic_class, provider, alpha, beta, exploration_rate, reward_weights)
		VALUES ($1, $2, 1.0, 1.0, 0.15, '{"latency": 0.4, "cost": 0.3, "success": 0.3}')
		ON CONFLICT (semantic_class, provider) DO UPDATE SET alpha = 1.0, beta = 1.0
	`, semanticClass, provider)
	if err != nil {
		t.Fatalf("Failed to seed bandit arm: %v", err)
	}

	// Step 2: Get initial alpha/beta
	var initialAlpha, initialBeta float64
	err = db.QueryRow(
		"SELECT alpha, beta FROM bandit_arms WHERE semantic_class = $1 AND provider = $2",
		semanticClass, provider,
	).Scan(&initialAlpha, &initialBeta)
	if err != nil {
		t.Fatalf("Failed to query initial bandit arm: %v", err)
	}

	t.Logf("Initial: alpha=%.2f, beta=%.2f", initialAlpha, initialBeta)

	// Step 3: Submit positive feedback events (high reward)
	t.Log("Submitting 10 positive feedback events...")
	for i := 0; i < 10; i++ {
		feedback := FeedbackRequest{
			SemanticClass: semanticClass,
			Provider:      provider,
			LatencyMs:     100 + float64(i)*5,
			CostUSD:       0.002,
			Success:       true,
			Reward:        0.85 + float64(i)*0.01,
		}

		_, err := db.Exec(`
			INSERT INTO feedback_events (semantic_class, provider, latency_ms, cost_usd, success, reward)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, feedback.SemanticClass, feedback.Provider, feedback.LatencyMs, feedback.CostUSD, feedback.Success, feedback.Reward)
		if err != nil {
			t.Fatalf("Failed to insert feedback: %v", err)
		}

		// Trigger stored procedure to update bandit arm
		_, err = db.Exec("SELECT update_bandit_arm_from_feedback($1, $2)", semanticClass, provider)
		if err != nil {
			t.Logf("Warning: Failed to trigger update: %v", err)
		}

		time.Sleep(10 * time.Millisecond)
	}

	// Step 4: Get updated alpha/beta
	var updatedAlpha, updatedBeta float64
	err = db.QueryRow(
		"SELECT alpha, beta FROM bandit_arms WHERE semantic_class = $1 AND provider = $2",
		semanticClass, provider,
	).Scan(&updatedAlpha, &updatedBeta)
	if err != nil {
		t.Fatalf("Failed to query updated bandit arm: %v", err)
	}

	t.Logf("Updated: alpha=%.2f, beta=%.2f", updatedAlpha, updatedBeta)

	// Step 5: Verify alpha increased (positive rewards increase alpha)
	if updatedAlpha <= initialAlpha {
		t.Errorf("Alpha did not increase after positive feedback: %.2f -> %.2f", initialAlpha, updatedAlpha)
	}

	// Step 6: Verify total samples increased
	totalSamples := updatedAlpha + updatedBeta
	initialSamples := initialAlpha + initialBeta
	if totalSamples <= initialSamples {
		t.Errorf("Total samples did not increase: %.2f -> %.2f", initialSamples, totalSamples)
	}

	t.Logf("✓ Feedback loop successfully updated bandit arm (samples: %.0f -> %.0f)", initialSamples, totalSamples)
}

// TestFeedbackLoopWithNegativeFeedback verifies beta increases on failures
func TestFeedbackLoopWithNegativeFeedback(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDatabase(t)
	defer db.Close()

	semanticClass := "translation"
	provider := "cohere"

	// Seed initial arm
	_, err := db.Exec(`
		INSERT INTO bandit_arms (semantic_class, provider, alpha, beta, exploration_rate, reward_weights)
		VALUES ($1, $2, 1.0, 1.0, 0.15, '{"latency": 0.4, "cost": 0.3, "success": 0.3}')
		ON CONFLICT (semantic_class, provider) DO UPDATE SET alpha = 1.0, beta = 1.0
	`, semanticClass, provider)
	if err != nil {
		t.Fatalf("Failed to seed bandit arm: %v", err)
	}

	var initialAlpha, initialBeta float64
	db.QueryRow("SELECT alpha, beta FROM bandit_arms WHERE semantic_class = $1 AND provider = $2",
		semanticClass, provider).Scan(&initialAlpha, &initialBeta)

	// Submit negative feedback (failures)
	t.Log("Submitting 10 negative feedback events...")
	for i := 0; i < 10; i++ {
		_, err := db.Exec(`
			INSERT INTO feedback_events (semantic_class, provider, latency_ms, cost_usd, success, reward)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, semanticClass, provider, 300.0, 0.001, false, 0.0)
		if err != nil {
			t.Fatalf("Failed to insert feedback: %v", err)
		}

		db.Exec("SELECT update_bandit_arm_from_feedback($1, $2)", semanticClass, provider)
		time.Sleep(10 * time.Millisecond)
	}

	var updatedAlpha, updatedBeta float64
	db.QueryRow("SELECT alpha, beta FROM bandit_arms WHERE semantic_class = $1 AND provider = $2",
		semanticClass, provider).Scan(&updatedAlpha, &updatedBeta)

	t.Logf("Initial: alpha=%.2f, beta=%.2f", initialAlpha, initialBeta)
	t.Logf("Updated: alpha=%.2f, beta=%.2f", updatedAlpha, updatedBeta)

	// Verify beta increased (failures increase beta)
	if updatedBeta <= initialBeta {
		t.Errorf("Beta did not increase after negative feedback: %.2f -> %.2f", initialBeta, updatedBeta)
	}

	t.Log("✓ Negative feedback correctly increased beta parameter")
}

// Helper functions

func submitFeedbackAPI(t *testing.T, url string, feedback FeedbackRequest) *http.Response {
	payload, err := json.Marshal(feedback)
	if err != nil {
		t.Fatalf("Failed to marshal feedback: %v", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("Failed to POST feedback: %v", err)
	}

	return resp
}

func seedFeedbackData(t *testing.T, db *sql.DB) {
	events := []FeedbackRequest{
		{SemanticClass: "code_generation", Provider: "openai", LatencyMs: 150, CostUSD: 0.002, Success: true, Reward: 0.88},
		{SemanticClass: "code_generation", Provider: "anthropic", LatencyMs: 120, CostUSD: 0.003, Success: true, Reward: 0.92},
		{SemanticClass: "question_answering", Provider: "cohere", LatencyMs: 200, CostUSD: 0.001, Success: false, Reward: 0.0},
		{SemanticClass: "translation", Provider: "google", LatencyMs: 180, CostUSD: 0.0015, Success: true, Reward: 0.75},
		{SemanticClass: "summarization", Provider: "openai", LatencyMs: 160, CostUSD: 0.002, Success: true, Reward: 0.82},
	}

	for _, event := range events {
		_, err := db.Exec(`
			INSERT INTO feedback_events (semantic_class, provider, latency_ms, cost_usd, success, reward)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, event.SemanticClass, event.Provider, event.LatencyMs, event.CostUSD, event.Success, event.Reward)
		if err != nil {
			t.Logf("Warning: Failed to seed feedback: %v", err)
		}
	}

	t.Logf("Seeded %d feedback events", len(events))
}

func getAPIBaseURL() string {
	url := os.Getenv("API_BASE_URL")
	if url == "" {
		url = "http://localhost:8081"
	}
	return url
}
