package router

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/config"
	"github.com/schlep-engine/schlep-engine/internal/models"
)

// QualityScorer evaluates the quality of early tokens from providers
// to help select the best provider based on multiple criteria
type QualityScorer struct {
	config *config.SpeculativeConfig
	mode   config.SpeculativeMode
}

// NewQualityScorer creates a new quality scorer
func NewQualityScorer(cfg *config.SpeculativeConfig, mode config.SpeculativeMode) *QualityScorer {
	return &QualityScorer{
		config: cfg,
		mode:   mode,
	}
}

// ProviderScore represents a multi-criteria score for a provider
type ProviderScore struct {
	ProviderID       string
	FirstTokenLatency time.Duration
	EarlyTokens      []*models.StreamChunk

	// Individual scores (0.0-1.0, higher is better)
	LatencyScore     float64
	QualityScore     float64
	CostScore        float64

	// Composite score (weighted based on mode)
	CompositeScore   float64

	// Metadata
	TokenCount       int
	EstimatedCostPer1k float64
}

// ScoreCandidates evaluates all candidates and returns scored results
func (qs *QualityScorer) ScoreCandidates(candidates []*ProviderCandidate) []*ProviderScore {
	scores := make([]*ProviderScore, 0, len(candidates))

	// Collect all candidates' metrics
	for _, candidate := range candidates {
		score := &ProviderScore{
			ProviderID:        candidate.ProviderID,
			FirstTokenLatency: time.Since(candidate.FirstTokenAt),
			TokenCount:        candidate.TokenCount,
		}

		// Collect early tokens for quality evaluation
		candidate.mu.Lock()
		score.EarlyTokens = qs.collectEarlyTokens(candidate)
		candidate.mu.Unlock()

		scores = append(scores, score)
	}

	// Calculate individual scores
	qs.scoreLatency(scores)
	qs.scoreQuality(scores)
	qs.scoreCost(scores)

	// Calculate composite scores based on mode
	qs.calculateCompositeScores(scores)

	return scores
}

// SelectWinner returns the best provider based on composite score
func (qs *QualityScorer) SelectWinner(scores []*ProviderScore) *ProviderScore {
	if len(scores) == 0 {
		return nil
	}

	var winner *ProviderScore
	maxScore := -1.0

	for _, score := range scores {
		if score.CompositeScore > maxScore {
			maxScore = score.CompositeScore
			winner = score
		}
	}

	log.Printf("[QualityScorer] Winner: %s (composite=%.3f, latency=%.3f, quality=%.3f, cost=%.3f)",
		winner.ProviderID, winner.CompositeScore, winner.LatencyScore,
		winner.QualityScore, winner.CostScore)

	return winner
}

// collectEarlyTokens extracts early tokens from a candidate's buffer
// This is a non-destructive read for quality evaluation
func (qs *QualityScorer) collectEarlyTokens(candidate *ProviderCandidate) []*models.StreamChunk {
	maxTokens := qs.config.EarlyTokenCount
	tokens := make([]*models.StreamChunk, 0, maxTokens)

	// Try to peek at tokens without consuming them
	// In practice, we'll collect tokens that have already been buffered
	collected := 0
	for collected < maxTokens && collected < candidate.TokenCount {
		// Tokens are already in the channel buffer, we can't peek without consuming
		// For now, we'll just track the count
		collected++
	}

	return tokens
}

// scoreLatency assigns latency scores (inverse of latency, normalized)
func (qs *QualityScorer) scoreLatency(scores []*ProviderScore) {
	if len(scores) == 0 {
		return
	}

	// Find fastest and slowest
	var fastest, slowest time.Duration
	for i, score := range scores {
		if i == 0 {
			fastest = score.FirstTokenLatency
			slowest = score.FirstTokenLatency
		} else {
			if score.FirstTokenLatency < fastest {
				fastest = score.FirstTokenLatency
			}
			if score.FirstTokenLatency > slowest {
				slowest = score.FirstTokenLatency
			}
		}
	}

	// Normalize scores (1.0 = fastest, 0.0 = slowest)
	latencyRange := float64(slowest - fastest)
	if latencyRange == 0 {
		// All same latency
		for _, score := range scores {
			score.LatencyScore = 1.0
		}
		return
	}

	for _, score := range scores {
		// Inverse score: faster = higher score
		normalizedLatency := float64(score.FirstTokenLatency - fastest) / latencyRange
		score.LatencyScore = 1.0 - normalizedLatency
	}
}

// scoreQuality evaluates early token quality
// For PR#3, we use a heuristic-based approach (ONNX integration can be added later)
func (qs *QualityScorer) scoreQuality(scores []*ProviderScore) {
	for _, score := range scores {
		// Heuristic quality metrics:
		// 1. Token count (more early tokens = better)
		// 2. Text coherence (simple heuristic)
		// 3. Average token length

		tokenCountScore := float64(score.TokenCount) / float64(qs.config.EarlyTokenCount)
		if tokenCountScore > 1.0 {
			tokenCountScore = 1.0
		}

		// For now, combine with latency as a proxy for quality
		// Real ONNX scoring would go here
		coherenceScore := qs.evaluateCoherence(score.EarlyTokens)

		// Weighted average
		score.QualityScore = (tokenCountScore * 0.5) + (coherenceScore * 0.5)

		log.Printf("[QualityScorer] Provider %s quality: %.3f (tokens=%d/%d, coherence=%.3f)",
			score.ProviderID, score.QualityScore, score.TokenCount,
			qs.config.EarlyTokenCount, coherenceScore)
	}
}

// evaluateCoherence is a simple heuristic for text quality
// In production, this would use ONNX model for semantic similarity
func (qs *QualityScorer) evaluateCoherence(tokens []*models.StreamChunk) float64 {
	if len(tokens) == 0 {
		// No tokens yet, assume neutral quality
		return 0.5
	}

	// Simple heuristic: check for common quality indicators
	// - Presence of complete words
	// - Reasonable token length
	// - No repetitive patterns

	var totalLength int
	var validWords int
	seenTokens := make(map[string]int)

	for _, chunk := range tokens {
		if chunk == nil || len(chunk.Choices) == 0 {
			continue
		}

		for _, choice := range chunk.Choices {
			if choice.Delta == nil {
				continue
			}

			content := choice.Delta.Content
			totalLength += len(content)

			// Check for repetition
			seenTokens[content]++

			// Check if it looks like a valid word (contains letters)
			if containsLetters(content) {
				validWords++
			}
		}
	}

	if len(tokens) == 0 {
		return 0.5
	}

	// Calculate quality score
	avgLength := float64(totalLength) / float64(len(tokens))
	wordRatio := float64(validWords) / float64(len(tokens))

	// Penalize repetition
	maxRepetition := 0
	for _, count := range seenTokens {
		if count > maxRepetition {
			maxRepetition = count
		}
	}
	repetitionPenalty := 1.0
	if len(tokens) > 0 {
		repetitionPenalty = 1.0 - (float64(maxRepetition) / float64(len(tokens)))
	}

	// Combine metrics
	lengthScore := normalizeScore(avgLength, 0, 50) // Expect avg 0-50 chars
	qualityScore := (lengthScore * 0.3) + (wordRatio * 0.5) + (repetitionPenalty * 0.2)

	return qualityScore
}

// scoreCost estimates cost efficiency
func (qs *QualityScorer) scoreCost(scores []*ProviderScore) {
	// Cost estimates per provider (in USD per 1k tokens)
	// These would come from provider capabilities in production
	costEstimates := map[string]float64{
		"openai":     0.002,  // GPT-4 Turbo
		"anthropic":  0.003,  // Claude 3
		"gemini":     0.001,  // Gemini Pro
		"grok":       0.002,  // Grok
		"deepseek":   0.0002, // DeepSeek
		"qwen":       0.0002, // Qwen
		"moonshot":   0.001,  // Moonshot
		"zhipu":      0.001,  // Zhipu
		"default":    0.002,  // Fallback
	}

	// Assign cost estimates
	for _, score := range scores {
		providerID := strings.ToLower(score.ProviderID)
		if cost, exists := costEstimates[providerID]; exists {
			score.EstimatedCostPer1k = cost
		} else if strings.Contains(providerID, "openai") {
			score.EstimatedCostPer1k = costEstimates["openai"]
		} else if strings.Contains(providerID, "anthropic") || strings.Contains(providerID, "claude") {
			score.EstimatedCostPer1k = costEstimates["anthropic"]
		} else {
			score.EstimatedCostPer1k = costEstimates["default"]
		}
	}

	// Find cheapest and most expensive
	var cheapest, mostExpensive float64
	for i, score := range scores {
		if i == 0 {
			cheapest = score.EstimatedCostPer1k
			mostExpensive = score.EstimatedCostPer1k
		} else {
			if score.EstimatedCostPer1k < cheapest {
				cheapest = score.EstimatedCostPer1k
			}
			if score.EstimatedCostPer1k > mostExpensive {
				mostExpensive = score.EstimatedCostPer1k
			}
		}
	}

	// Normalize cost scores (lower cost = higher score)
	costRange := mostExpensive - cheapest
	if costRange == 0 {
		for _, score := range scores {
			score.CostScore = 1.0
		}
		return
	}

	for _, score := range scores {
		normalizedCost := (score.EstimatedCostPer1k - cheapest) / costRange
		score.CostScore = 1.0 - normalizedCost // Inverse: cheaper = higher score
	}
}

// calculateCompositeScores computes weighted scores based on mode
func (qs *QualityScorer) calculateCompositeScores(scores []*ProviderScore) {
	weights := qs.getWeights()

	for _, score := range scores {
		score.CompositeScore =
			(score.LatencyScore * weights.Latency) +
			(score.QualityScore * weights.Quality) +
			(score.CostScore * weights.Cost)
	}
}

// ScoringWeights defines the weight distribution for different criteria
type ScoringWeights struct {
	Latency float64
	Quality float64
	Cost    float64
}

// getWeights returns scoring weights based on the current mode
func (qs *QualityScorer) getWeights() ScoringWeights {
	switch qs.mode {
	case config.SpeculativeModeLatency:
		return ScoringWeights{
			Latency: 1.0, // 100% weight on latency
			Quality: 0.0,
			Cost:    0.0,
		}

	case config.SpeculativeModeQuality:
		return ScoringWeights{
			Latency: 0.3, // 30% latency
			Quality: 0.7, // 70% quality
			Cost:    0.0,
		}

	case config.SpeculativeModeCost:
		return ScoringWeights{
			Latency: 0.3,  // 30% latency
			Quality: 0.2,  // 20% quality
			Cost:    0.5,  // 50% cost
		}

	case config.SpeculativeModeBalanced:
		return ScoringWeights{
			Latency: 0.4,  // 40% latency
			Quality: 0.35, // 35% quality
			Cost:    0.25, // 25% cost
		}

	default:
		// Fallback to latency-only
		return ScoringWeights{
			Latency: 1.0,
			Quality: 0.0,
			Cost:    0.0,
		}
	}
}

// Helper functions

func containsLetters(s string) bool {
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			return true
		}
	}
	return false
}

func normalizeScore(value, min, max float64) float64 {
	if max <= min {
		return 0.5
	}
	normalized := (value - min) / (max - min)
	if normalized < 0 {
		return 0
	}
	if normalized > 1 {
		return 1
	}
	return normalized
}

// FormatScore returns a human-readable string representation of a score
func FormatScore(score *ProviderScore) string {
	return fmt.Sprintf("%s: composite=%.3f (latency=%.3f, quality=%.3f, cost=%.3f) | latency=%dms, tokens=%d, cost=$%.4f/1k",
		score.ProviderID,
		score.CompositeScore,
		score.LatencyScore,
		score.QualityScore,
		score.CostScore,
		score.FirstTokenLatency.Milliseconds(),
		score.TokenCount,
		score.EstimatedCostPer1k)
}
