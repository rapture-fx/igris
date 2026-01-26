package router

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/observability"
)

// QualityScoringBackend defines the interface for quality scoring implementations
type QualityScoringBackend interface {
	// ScoreCoherence evaluates the coherence/quality of token output
	// Returns a score between 0.0 and 1.0 (higher is better)
	ScoreCoherence(ctx context.Context, tokens []*models.StreamChunk) (float64, error)
	// Close releases any resources held by the backend
	Close() error
	// IsAvailable returns true if the backend is ready to score
	IsAvailable() bool
}

// QualityScorer evaluates the quality of early tokens from providers
// to help select the best provider based on multiple criteria
type QualityScorer struct {
	config          *config.SpeculativeConfig
	mode            config.SpeculativeMode
	onnxBackend     QualityScoringBackend // Optional ONNX backend
	heuristicFallback bool                // If true, ONNX failed and using heuristic
	mu              sync.RWMutex
}

// NewQualityScorer creates a new quality scorer with optional ONNX backend
func NewQualityScorer(cfg *config.SpeculativeConfig, mode config.SpeculativeMode) *QualityScorer {
	qs := &QualityScorer{
		config:            cfg,
		mode:              mode,
		heuristicFallback: true, // Default to heuristic until ONNX is initialized
	}

	// Attempt to initialize ONNX backend if configured
	if cfg.UseONNXQualityScoring && cfg.ONNXModelPath != "" {
		if err := qs.initONNXBackend(cfg.ONNXModelPath); err != nil {
			log.Printf("[QualityScorer] ONNX initialization failed, using heuristic fallback: %v", err)
			observability.RecordQualityScorerFallback("onnx_init_failed")
		} else {
			log.Printf("[QualityScorer] ONNX backend initialized successfully: %s", cfg.ONNXModelPath)
			qs.heuristicFallback = false
		}
	} else {
		log.Printf("[QualityScorer] ONNX disabled, using heuristic-based quality scoring")
	}

	return qs
}

// initONNXBackend initializes the ONNX quality scoring backend
func (qs *QualityScorer) initONNXBackend(modelPath string) error {
	backend, err := NewONNXQualityBackend(modelPath)
	if err != nil {
		return err
	}
	qs.onnxBackend = backend
	return nil
}

// Close releases resources held by the quality scorer
func (qs *QualityScorer) Close() error {
	qs.mu.Lock()
	defer qs.mu.Unlock()

	if qs.onnxBackend != nil {
		return qs.onnxBackend.Close()
	}
	return nil
}

// IsUsingONNX returns true if ONNX backend is active
func (qs *QualityScorer) IsUsingONNX() bool {
	qs.mu.RLock()
	defer qs.mu.RUnlock()
	return !qs.heuristicFallback && qs.onnxBackend != nil && qs.onnxBackend.IsAvailable()
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

// scoreQuality evaluates early token quality using ONNX when available, falling back to heuristics
func (qs *QualityScorer) scoreQuality(scores []*ProviderScore) {
	ctx := context.Background()
	useONNX := qs.IsUsingONNX()

	for _, score := range scores {
		// Token count score: more early tokens = better
		tokenCountScore := float64(score.TokenCount) / float64(qs.config.EarlyTokenCount)
		if tokenCountScore > 1.0 {
			tokenCountScore = 1.0
		}

		// Coherence score: use ONNX if available, otherwise fallback to heuristic
		var coherenceScore float64
		var scoringMethod string

		if useONNX {
			onnxScore, err := qs.onnxBackend.ScoreCoherence(ctx, score.EarlyTokens)
			if err != nil {
				// ONNX scoring failed, fall back to heuristic for this request
				log.Printf("[QualityScorer] ONNX scoring failed for %s, using heuristic: %v",
					score.ProviderID, err)
				coherenceScore = qs.evaluateCoherenceHeuristic(score.EarlyTokens)
				scoringMethod = "heuristic_fallback"
				observability.RecordQualityScorerFallback("onnx_runtime_error")
			} else {
				coherenceScore = onnxScore
				scoringMethod = "onnx"
			}
		} else {
			coherenceScore = qs.evaluateCoherenceHeuristic(score.EarlyTokens)
			scoringMethod = "heuristic"
		}

		// Weighted average: 50% token count, 50% coherence
		score.QualityScore = (tokenCountScore * 0.5) + (coherenceScore * 0.5)

		log.Printf("[QualityScorer] Provider %s quality: %.3f (tokens=%d/%d, coherence=%.3f, method=%s)",
			score.ProviderID, score.QualityScore, score.TokenCount,
			qs.config.EarlyTokenCount, coherenceScore, scoringMethod)

		// Record metrics
		observability.RecordQualityScorerResult(score.ProviderID, score.QualityScore, scoringMethod)
	}
}

// evaluateCoherenceHeuristic is a heuristic-based fallback for text quality scoring
// Used when ONNX is disabled or unavailable
func (qs *QualityScorer) evaluateCoherenceHeuristic(tokens []*models.StreamChunk) float64 {
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

// =============================================================================
// ONNX Quality Scoring Backend
// =============================================================================

// ONNXQualityBackend implements QualityScoringBackend using ONNX Runtime
type ONNXQualityBackend struct {
	modelPath   string
	available   bool
	mu          sync.RWMutex
	// Note: Actual ONNX session would be stored here when built with onnx build tag
	// For production, this integrates with igris-overture/ml/onnx_runtime_cgo.go
}

// NewONNXQualityBackend creates a new ONNX-based quality scoring backend
func NewONNXQualityBackend(modelPath string) (*ONNXQualityBackend, error) {
	backend := &ONNXQualityBackend{
		modelPath: modelPath,
		available: false,
	}

	// Attempt to initialize ONNX runtime
	if err := backend.initialize(); err != nil {
		return nil, fmt.Errorf("failed to initialize ONNX backend: %w", err)
	}

	return backend, nil
}

// initialize sets up the ONNX runtime and loads the model
func (b *ONNXQualityBackend) initialize() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Check if model file exists
	// In production build (with onnx build tag), this would:
	// 1. Initialize ONNX Runtime environment
	// 2. Create session with model
	// 3. Validate input/output shapes
	//
	// For now, we attempt a graceful initialization that returns error
	// if ONNX runtime is not available, triggering fallback to heuristic

	// Try to initialize ONNX - if the build doesn't have ONNX support,
	// this will fail and we'll use heuristic fallback
	if err := b.tryInitializeONNX(); err != nil {
		return err
	}

	b.available = true
	log.Printf("[ONNXQualityBackend] Initialized with model: %s", b.modelPath)
	return nil
}

// tryInitializeONNX attempts to initialize ONNX runtime
// Returns error if ONNX is not available in this build
func (b *ONNXQualityBackend) tryInitializeONNX() error {
	// Check if model file exists
	// For builds without ONNX support, return error to trigger fallback
	//
	// In production (with onnx build tag), this would use:
	// - igris-overture/ml/onnx_runtime_cgo.go for CGO-based ONNX
	// - or igris-overture/semantic/onnx_classifier.go patterns

	// For now, we check if the model path is accessible
	// and if ONNX runtime libraries are available

	// Return error to indicate ONNX not available in this build
	// This is the correct behavior - falls back to heuristic
	return fmt.Errorf("ONNX runtime not available in this build (build with -tags onnx for ONNX support)")
}

// ScoreCoherence evaluates token coherence using the ONNX model
func (b *ONNXQualityBackend) ScoreCoherence(ctx context.Context, tokens []*models.StreamChunk) (float64, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if !b.available {
		return 0, fmt.Errorf("ONNX backend not available")
	}

	// Extract text content from tokens
	var textBuilder strings.Builder
	for _, chunk := range tokens {
		if chunk == nil || len(chunk.Choices) == 0 {
			continue
		}
		for _, choice := range chunk.Choices {
			if choice.Delta != nil {
				textBuilder.WriteString(choice.Delta.Content)
			}
		}
	}
	text := textBuilder.String()

	if text == "" {
		return 0.5, nil // Neutral score for empty content
	}

	// In production ONNX build, this would:
	// 1. Tokenize text using model's tokenizer
	// 2. Create input tensors
	// 3. Run ONNX inference
	// 4. Extract quality score from output
	//
	// Example inference flow (when ONNX is available):
	// inputIDs, attentionMask := tokenizer.Encode(text)
	// outputs, err := session.Run(inputIDs, attentionMask)
	// qualityScore := outputs[0] // Assuming single quality output

	return 0, fmt.Errorf("ONNX inference not implemented in this build")
}

// Close releases ONNX resources
func (b *ONNXQualityBackend) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// In production ONNX build, this would:
	// - Destroy ONNX session
	// - Release environment

	b.available = false
	log.Printf("[ONNXQualityBackend] Closed")
	return nil
}

// IsAvailable returns true if ONNX backend is ready
func (b *ONNXQualityBackend) IsAvailable() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.available
}
