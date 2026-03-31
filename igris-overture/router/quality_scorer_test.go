package router

import (
	"fmt"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
)

// TestQualityScorer_LatencyMode tests latency-only scoring
func TestQualityScorer_LatencyMode(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeLatency)

	// Create candidates with different latencies
	candidates := []*ProviderCandidate{
		{
			ProviderID:   "fast",
			FirstTokenAt: time.Now().Add(-100 * time.Millisecond),
			TokenCount:   5,
		},
		{
			ProviderID:   "medium",
			FirstTokenAt: time.Now().Add(-300 * time.Millisecond),
			TokenCount:   5,
		},
		{
			ProviderID:   "slow",
			FirstTokenAt: time.Now().Add(-500 * time.Millisecond),
			TokenCount:   5,
		},
	}

	scores := scorer.ScoreCandidates(candidates)
	winner := scorer.SelectWinner(scores)

	if winner.ProviderID != "fast" { // Most recent FirstTokenAt = fastest
		t.Errorf("Expected fast provider to win, got %s", winner.ProviderID)
	}

	// In latency mode, latency score should be weighted 100%
	weights := scorer.getWeights()
	if weights.Latency != 1.0 {
		t.Errorf("Expected latency weight 1.0, got %.2f", weights.Latency)
	}
	if weights.Quality != 0.0 || weights.Cost != 0.0 {
		t.Error("Expected quality and cost weights to be 0 in latency mode")
	}

	t.Logf("Winner: %s", FormatScore(winner))
}

// TestQualityScorer_QualityMode tests quality-focused scoring
func TestQualityScorer_QualityMode(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeQuality)

	// Create candidates
	candidates := []*ProviderCandidate{
		{
			ProviderID:   "high-quality",
			FirstTokenAt: time.Now().Add(-200 * time.Millisecond),
			TokenCount:   5,
		},
		{
			ProviderID:   "low-quality",
			FirstTokenAt: time.Now().Add(-100 * time.Millisecond),
			TokenCount:   2,
		},
	}

	scores := scorer.ScoreCandidates(candidates)
	winner := scorer.SelectWinner(scores)

	// Quality mode should prefer higher quality
	weights := scorer.getWeights()
	if weights.Quality != 0.7 {
		t.Errorf("Expected quality weight 0.7, got %.2f", weights.Quality)
	}

	t.Logf("Winner: %s", FormatScore(winner))
	t.Logf("High-quality score: quality=%.3f, latency=%.3f, composite=%.3f",
		scores[0].QualityScore, scores[0].LatencyScore, scores[0].CompositeScore)
	t.Logf("Low-quality score: quality=%.3f, latency=%.3f, composite=%.3f",
		scores[1].QualityScore, scores[1].LatencyScore, scores[1].CompositeScore)
}

// TestQualityScorer_CostMode tests cost-optimized scoring
func TestQualityScorer_CostMode(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeCost)

	candidates := []*ProviderCandidate{
		{
			ProviderID:   "openai", // Expensive
			FirstTokenAt: time.Now().Add(-100 * time.Millisecond),
			TokenCount:   5,
		},
		{
			ProviderID:   "deepseek", // Cheap
			FirstTokenAt: time.Now().Add(-300 * time.Millisecond),
			TokenCount:   5,
		},
	}

	scores := scorer.ScoreCandidates(candidates)
	winner := scorer.SelectWinner(scores)

	// Cost mode should heavily weight cost
	weights := scorer.getWeights()
	if weights.Cost != 0.5 {
		t.Errorf("Expected cost weight 0.5, got %.2f", weights.Cost)
	}

	// DeepSeek should have higher cost score (cheaper)
	var deepseekScore, openaiScore *ProviderScore
	for _, score := range scores {
		if score.ProviderID == "deepseek" {
			deepseekScore = score
		} else if score.ProviderID == "openai" {
			openaiScore = score
		}
	}

	if deepseekScore.CostScore <= openaiScore.CostScore {
		t.Errorf("Expected DeepSeek to have higher cost score than OpenAI")
	}

	t.Logf("Winner: %s", FormatScore(winner))
	t.Logf("DeepSeek: cost=%.3f, composite=%.3f, $%.4f/1k",
		deepseekScore.CostScore, deepseekScore.CompositeScore, deepseekScore.EstimatedCostPer1k)
	t.Logf("OpenAI: cost=%.3f, composite=%.3f, $%.4f/1k",
		openaiScore.CostScore, openaiScore.CompositeScore, openaiScore.EstimatedCostPer1k)
}

// TestQualityScorer_BalancedMode tests balanced scoring
func TestQualityScorer_BalancedMode(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeBalanced)

	weights := scorer.getWeights()

	// Verify balanced weights
	if weights.Latency != 0.4 {
		t.Errorf("Expected latency weight 0.4, got %.2f", weights.Latency)
	}
	if weights.Quality != 0.35 {
		t.Errorf("Expected quality weight 0.35, got %.2f", weights.Quality)
	}
	if weights.Cost != 0.25 {
		t.Errorf("Expected cost weight 0.25, got %.2f", weights.Cost)
	}

	// Verify weights sum to 1.0
	total := weights.Latency + weights.Quality + weights.Cost
	if total < 0.99 || total > 1.01 {
		t.Errorf("Expected weights to sum to 1.0, got %.2f", total)
	}
}

// TestQualityScorer_CompositeScoring tests composite score calculation
func TestQualityScorer_CompositeScoring(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeBalanced)

	candidates := []*ProviderCandidate{
		{
			ProviderID:   "provider1",
			FirstTokenAt: time.Now().Add(-100 * time.Millisecond),
			TokenCount:   5,
		},
	}

	scores := scorer.ScoreCandidates(candidates)

	if len(scores) != 1 {
		t.Fatalf("Expected 1 score, got %d", len(scores))
	}

	score := scores[0]

	// Verify composite score is calculated
	expectedComposite := (score.LatencyScore * 0.4) + (score.QualityScore * 0.35) + (score.CostScore * 0.25)
	if score.CompositeScore < expectedComposite-0.01 || score.CompositeScore > expectedComposite+0.01 {
		t.Errorf("Composite score mismatch: expected %.3f, got %.3f", expectedComposite, score.CompositeScore)
	}

	t.Logf("Score breakdown: latency=%.3f, quality=%.3f, cost=%.3f, composite=%.3f",
		score.LatencyScore, score.QualityScore, score.CostScore, score.CompositeScore)
}

// TestQualityScorer_NormalizationWorks tests score normalization
func TestQualityScorer_NormalizationWorks(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeLatency)

	candidates := []*ProviderCandidate{
		{
			ProviderID:   "fastest",
			FirstTokenAt: time.Now().Add(-50 * time.Millisecond),
			TokenCount:   5,
		},
		{
			ProviderID:   "slowest",
			FirstTokenAt: time.Now().Add(-500 * time.Millisecond),
			TokenCount:   5,
		},
	}

	scores := scorer.ScoreCandidates(candidates)

	// Find scores
	var fastestScore, slowestScore *ProviderScore
	for _, score := range scores {
		if score.ProviderID == "fastest" {
			fastestScore = score
		} else {
			slowestScore = score
		}
	}

	// Fastest should have highest latency score (close to 1.0)
	if fastestScore.LatencyScore < 0.9 {
		t.Errorf("Expected fastest to have latency score ~1.0, got %.3f", fastestScore.LatencyScore)
	}

	// Slowest should have lowest latency score (close to 0.0)
	if slowestScore.LatencyScore > 0.1 {
		t.Errorf("Expected slowest to have latency score ~0.0, got %.3f", slowestScore.LatencyScore)
	}

	t.Logf("Fastest: latency score=%.3f", fastestScore.LatencyScore)
	t.Logf("Slowest: latency score=%.3f", slowestScore.LatencyScore)
}

// TestQualityScorer_CoherenceEvaluation tests text coherence scoring
func TestQualityScorer_CoherenceEvaluation(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		EarlyTokenCount: 5,
	}
	scorer := NewQualityScorer(cfg, config.SpeculativeModeQuality)

	// Good coherence: varied, valid words
	goodTokens := createTestTokens(5, "good", false)
	goodScore := scorer.evaluateCoherenceHeuristic(goodTokens)

	// Bad coherence: repetitive
	badTokens := createTestTokens(5, "bad", true)
	badScore := scorer.evaluateCoherenceHeuristic(badTokens)

	if goodScore <= badScore {
		t.Errorf("Expected good coherence (%.3f) > bad coherence (%.3f)", goodScore, badScore)
	}

	t.Logf("Good coherence score: %.3f", goodScore)
	t.Logf("Bad coherence score: %.3f", badScore)
}

// Helper functions

func createTestTokens(count int, provider string, repetitive bool) []*models.StreamChunk {
	tokens := make([]*models.StreamChunk, count)
	for i := 0; i < count; i++ {
		content := ""
		if repetitive {
			content = "the " // Repetitive content
		} else {
			content = fmt.Sprintf("word%d ", i) // Varied content
		}

		tokens[i] = models.NewStreamChunk(
			"test-req",
			"test-model",
			content,
			0,
			"",
		)
	}
	return tokens
}
