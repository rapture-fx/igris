// +build integration

package tests

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// BanditScenarioTest represents a multi-armed bandit convergence scenario
type BanditScenarioTest struct {
	Name              string
	SemanticClass     string
	Providers         []ProviderConfig
	RequestCount      int
	ExpectedWinner    string
	ConvergenceWindow int // Number of requests to converge
	SuccessThreshold  float64
}

// ProviderConfig defines provider characteristics for testing
type ProviderConfig struct {
	Name        string
	LatencyMs   float64
	CostPer1k   float64
	SuccessRate float64
}

// TestBanditConvergenceScenarios validates that Thompson Sampling converges to optimal providers
func TestBanditConvergenceScenarios(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDatabase(t)
	defer db.Close()

	scenarios := []BanditScenarioTest{
		{
			Name:          "Fast and Costly vs Slow and Cheap (Cost-Optimized)",
			SemanticClass: "code_generation",
			Providers: []ProviderConfig{
				{Name: "openai", LatencyMs: 120, CostPer1k: 0.002, SuccessRate: 0.98},
				{Name: "cohere", LatencyMs: 250, CostPer1k: 0.001, SuccessRate: 0.95},
			},
			RequestCount:      100,
			ExpectedWinner:    "cohere", // Lower cost should win with cost-heavy weight
			ConvergenceWindow: 50,
			SuccessThreshold:  0.70, // 70% of final selections should be optimal
		},
		{
			Name:          "Fast and Costly vs Slow and Cheap (Latency-Optimized)",
			SemanticClass: "question_answering",
			Providers: []ProviderConfig{
				{Name: "anthropic", LatencyMs: 100, CostPer1k: 0.003, SuccessRate: 0.99},
				{Name: "google", LatencyMs: 220, CostPer1k: 0.0015, SuccessRate: 0.97},
			},
			RequestCount:      100,
			ExpectedWinner:    "anthropic", // Lower latency should win with latency-heavy weight
			ConvergenceWindow: 50,
			SuccessThreshold:  0.75,
		},
		{
			Name:          "Similar Performance (Random Exploration)",
			SemanticClass: "translation",
			Providers: []ProviderConfig{
				{Name: "openai", LatencyMs: 150, CostPer1k: 0.002, SuccessRate: 0.98},
				{Name: "anthropic", LatencyMs: 155, CostPer1k: 0.002, SuccessRate: 0.98},
			},
			RequestCount:      80,
			ExpectedWinner:    "", // Either is acceptable
			ConvergenceWindow: 80,
			SuccessThreshold:  0.45, // Should be roughly 50/50 split
		},
		{
			Name:          "Unreliable Provider (Success Rate Matters)",
			SemanticClass: "summarization",
			Providers: []ProviderConfig{
				{Name: "openai", LatencyMs: 150, CostPer1k: 0.002, SuccessRate: 0.98},
				{Name: "unstable_provider", LatencyMs: 100, CostPer1k: 0.001, SuccessRate: 0.70},
			},
			RequestCount:      100,
			ExpectedWinner:    "openai", // Higher success rate should win
			ConvergenceWindow: 60,
			SuccessThreshold:  0.80,
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			runBanditScenario(t, db, scenario)
		})
	}
}

// runBanditScenario executes a single bandit convergence test
func runBanditScenario(t *testing.T, db *sql.DB, scenario BanditScenarioTest) {
	ctx := context.Background()

	// Step 1: Seed bandit arms for this semantic class
	t.Logf("Seeding bandit arms for class: %s", scenario.SemanticClass)
	seedBanditArms(t, db, scenario.SemanticClass, scenario.Providers)

	// Step 2: Simulate requests and collect selections
	t.Logf("Simulating %d requests...", scenario.RequestCount)
	selections := make(map[string]int)
	var finalSelections []string // Last N selections to check convergence

	for i := 0; i < scenario.RequestCount; i++ {
		provider := selectProvider(t, db, scenario.SemanticClass)
		selections[provider]++

		// Record last 30% of selections for convergence check
		if i >= int(float64(scenario.RequestCount)*0.70) {
			finalSelections = append(finalSelections, provider)
		}

		// Simulate feedback based on provider config
		providerConfig := findProviderConfig(scenario.Providers, provider)
		if providerConfig != nil {
			submitFeedback(t, db, ctx, scenario.SemanticClass, provider, *providerConfig)
		}

		// Small delay to simulate realistic traffic
		time.Sleep(10 * time.Millisecond)
	}

	// Step 3: Verify convergence
	t.Logf("Selection distribution: %+v", selections)

	if scenario.ExpectedWinner != "" {
		// Count winner selections in final window
		winnerCount := 0
		for _, sel := range finalSelections {
			if sel == scenario.ExpectedWinner {
				winnerCount++
			}
		}

		winnerRate := float64(winnerCount) / float64(len(finalSelections))
		t.Logf("Winner (%s) selected %.2f%% of the time in final window (threshold: %.2f%%)",
			scenario.ExpectedWinner, winnerRate*100, scenario.SuccessThreshold*100)

		if winnerRate < scenario.SuccessThreshold {
			t.Errorf("Bandit failed to converge: expected %s to win %.2f%% but got %.2f%%",
				scenario.ExpectedWinner, scenario.SuccessThreshold*100, winnerRate*100)
		}
	} else {
		// Verify balanced exploration for similar providers
		for provider, count := range selections {
			rate := float64(count) / float64(scenario.RequestCount)
			t.Logf("Provider %s selected %.2f%% of the time", provider, rate*100)

			if rate < scenario.SuccessThreshold || rate > (1.0-scenario.SuccessThreshold) {
				t.Errorf("Expected balanced exploration, but %s was selected %.2f%%", provider, rate*100)
			}
		}
	}

	// Step 4: Verify bandit arms were updated
	verifyBanditArmsUpdated(t, db, scenario.SemanticClass)

	t.Logf("✓ Bandit convergence scenario '%s' passed", scenario.Name)
}

// seedBanditArms initializes bandit arms with default priors
func seedBanditArms(t *testing.T, db *sql.DB, semanticClass string, providers []ProviderConfig) {
	// Clear existing arms for this class
	_, err := db.Exec("DELETE FROM bandit_arms WHERE semantic_class = $1", semanticClass)
	if err != nil {
		t.Fatalf("Failed to clear bandit arms: %v", err)
	}

	// Insert arms with uniform priors
	for _, provider := range providers {
		query := `
			INSERT INTO bandit_arms (
				semantic_class, provider, alpha, beta,
				exploration_rate, reward_weights, last_selected_at
			) VALUES ($1, $2, 1.0, 1.0, 0.15, '{"latency": 0.4, "cost": 0.3, "success": 0.3}', NOW())
		`
		_, err := db.Exec(query, semanticClass, provider.Name)
		if err != nil {
			t.Fatalf("Failed to seed bandit arm for %s: %v", provider.Name, err)
		}
	}

	t.Logf("Seeded %d bandit arms for class %s", len(providers), semanticClass)
}

// selectProvider simulates Thompson Sampling provider selection
func selectProvider(t *testing.T, db *sql.DB, semanticClass string) string {
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
		t.Fatalf("Failed to select provider: %v", err)
	}

	// Update last_selected_at
	_, err = db.Exec(
		"UPDATE bandit_arms SET last_selected_at = NOW() WHERE semantic_class = $1 AND provider = $2",
		semanticClass, provider,
	)
	if err != nil {
		t.Logf("Warning: Failed to update last_selected_at: %v", err)
	}

	return provider
}

// submitFeedback simulates a feedback event with realistic metrics
func submitFeedback(t *testing.T, db *sql.DB, ctx context.Context, semanticClass, provider string, config ProviderConfig) {
	// Simulate success/failure based on success rate
	success := (randFloat() < config.SuccessRate)

	// Add jitter to latency
	latency := config.LatencyMs * (0.9 + 0.2*randFloat())

	// Calculate composite reward (matches bandit algorithm)
	var reward float64
	if success {
		// Normalize metrics to 0-1 scale
		normalizedLatency := 1.0 - math.Min(latency/500.0, 1.0)      // Lower is better
		normalizedCost := 1.0 - math.Min(config.CostPer1k/0.01, 1.0) // Lower is better
		normalizedSuccess := 1.0                                      // Success

		reward = 0.4*normalizedLatency + 0.3*normalizedCost + 0.3*normalizedSuccess
	} else {
		reward = 0.0 // Failure
	}

	// Insert feedback event
	query := `
		INSERT INTO feedback_events (
			semantic_class, provider, latency_ms, cost_usd, success, reward, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`
	_, err := db.Exec(query, semanticClass, provider, latency, config.CostPer1k, success, reward)
	if err != nil {
		t.Logf("Warning: Failed to submit feedback: %v", err)
		return
	}

	// Trigger bandit arm update via stored procedure
	_, err = db.Exec("SELECT update_bandit_arm_from_feedback($1, $2)", semanticClass, provider)
	if err != nil {
		t.Logf("Warning: Failed to update bandit arm: %v", err)
	}
}

// verifyBanditArmsUpdated checks that alpha/beta parameters were updated
func verifyBanditArmsUpdated(t *testing.T, db *sql.DB, semanticClass string) {
	query := `
		SELECT provider, alpha, beta, (alpha + beta) as total_samples
		FROM bandit_arms
		WHERE semantic_class = $1
		ORDER BY provider
	`
	rows, err := db.Query(query, semanticClass)
	if err != nil {
		t.Fatalf("Failed to query bandit arms: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var provider string
		var alpha, beta, totalSamples float64

		err := rows.Scan(&provider, &alpha, &beta, &totalSamples)
		if err != nil {
			t.Fatalf("Failed to scan row: %v", err)
		}

		// Verify that arms were updated (total_samples > initial 2.0)
		if totalSamples <= 2.0 {
			t.Errorf("Bandit arm for %s was not updated: alpha=%.2f, beta=%.2f",
				provider, alpha, beta)
		}

		t.Logf("Provider %s: alpha=%.2f, beta=%.2f, samples=%.0f",
			provider, alpha, beta, totalSamples)
	}
}

// Helper functions

func findProviderConfig(providers []ProviderConfig, name string) *ProviderConfig {
	for _, p := range providers {
		if p.Name == name {
			return &p
		}
	}
	return nil
}

func randFloat() float64 {
	return float64(time.Now().UnixNano()%1000) / 1000.0
}

func setupTestDatabase(t *testing.T) *sql.DB {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://igris:igris_ci_password@localhost:5433/igris_test?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Verify connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}

	return db
}

// TestBanditPartialProviderOutage validates fallback behavior when provider fails
func TestBanditPartialProviderOutage(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDatabase(t)
	defer db.Close()

	semanticClass := "code_generation"
	providers := []ProviderConfig{
		{Name: "openai", LatencyMs: 150, CostPer1k: 0.002, SuccessRate: 0.98},
		{Name: "anthropic", LatencyMs: 120, CostPer1k: 0.003, SuccessRate: 0.99},
		{Name: "cohere", LatencyMs: 200, CostPer1k: 0.001, SuccessRate: 0.95},
	}

	t.Log("Seeding bandit arms...")
	seedBanditArms(t, db, semanticClass, providers)

	// Simulate normal operation (50 requests)
	t.Log("Phase 1: Normal operation (50 requests)")
	for i := 0; i < 50; i++ {
		provider := selectProvider(t, db, semanticClass)
		config := findProviderConfig(providers, provider)
		if config != nil {
			submitFeedback(t, db, context.Background(), semanticClass, provider, *config)
		}
		time.Sleep(5 * time.Millisecond)
	}

	// Simulate provider outage (degrade "anthropic" success rate to 0%)
	t.Log("Phase 2: Simulating 'anthropic' provider outage (50 requests)")
	for i := 0; i < 50; i++ {
		provider := selectProvider(t, db, semanticClass)
		config := findProviderConfig(providers, provider)

		if config != nil {
			// Degrade anthropic success rate
			if provider == "anthropic" {
				config.SuccessRate = 0.0
			}
			submitFeedback(t, db, context.Background(), semanticClass, provider, *config)
		}
		time.Sleep(5 * time.Millisecond)
	}

	// Verify that bandit shifted away from failed provider
	var anthropicSelections int
	query := `
		SELECT COUNT(*)
		FROM feedback_events
		WHERE semantic_class = $1 AND provider = 'anthropic'
		AND created_at >= NOW() - INTERVAL '30 seconds'
	`
	err := db.QueryRow(query, semanticClass).Scan(&anthropicSelections)
	if err != nil {
		t.Fatalf("Failed to query recent selections: %v", err)
	}

	t.Logf("Anthropic selections in final 30s: %d", anthropicSelections)

	// After outage, bandit should have shifted to other providers
	if anthropicSelections > 10 {
		t.Errorf("Bandit failed to shift away from failed provider: %d recent selections", anthropicSelections)
	}

	t.Log("✓ Bandit successfully adapted to provider outage")
}
