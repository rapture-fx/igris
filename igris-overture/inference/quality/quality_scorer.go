package quality

import (
	"context"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// QualityScorer manages quality scoring for inference responses
type QualityScorer struct {
	// Future: Add customer feedback store, quality benchmarks, etc.
}

// NewQualityScorer creates a new quality scorer instance
func NewQualityScorer() *QualityScorer {
	return &QualityScorer{}
}

// ScoreResponse calculates a comprehensive quality score for a response
// Returns a score from 0.0 (lowest quality) to 1.0 (highest quality)
func (qs *QualityScorer) ScoreResponse(
	ctx context.Context,
	req *models.InferRequest,
	resp *models.InferResponse,
	classification RequestClassification,
) (float64, error) {
	// Priority 1: Provider-reported quality score (if available and reliable)
	if resp != nil && resp.Metadata != nil && resp.Metadata.QualityScore > 0 && resp.Metadata.QualityScore <= 1.0 {
		return resp.Metadata.QualityScore, nil
	}

	// Priority 2: Calculate heuristic-based quality score
	score := qs.calculateHeuristicScore(req, resp, classification)

	// Future: Priority 0 would be customer feedback (ground truth)
	// if feedbackScore := qs.getCustomerFeedbackScore(resp.RequestID); feedbackScore != nil {
	//     return *feedbackScore, nil
	// }

	return score, nil
}

// calculateHeuristicScore computes quality score based on heuristics
func (qs *QualityScorer) calculateHeuristicScore(
	req *models.InferRequest,
	resp *models.InferResponse,
	classification RequestClassification,
) float64 {
	// Extract response content
	content := extractResponseContent(resp)
	if content == "" {
		return 0.0 // No content = lowest quality
	}

	// Calculate heuristics
	heuristics := CalculateHeuristics(content, classification.Domain)

	// Base score starts at 0.5 (neutral)
	score := 0.5

	// Factor 1: Response length (weight: 0.15)
	score += (heuristics.ResponseLength - 0.5) * 0.15

	// Factor 2: Refusal detection (weight: -0.4 if refusal detected)
	if heuristics.RefusalDetected {
		score -= 0.4
		// If refusal is detected, cap the score low
		if score > 0.3 {
			score = 0.3
		}
	}

	// Factor 3: Structure quality (weight: 0.2)
	score += (heuristics.StructureQuality - 0.5) * 0.2

	// Factor 4: Coherence (weight: 0.2)
	score += (heuristics.CoherenceScore - 0.5) * 0.2

	// Factor 5: Domain-specific quality (weight: 0.3)
	// This is the most important factor
	score += (heuristics.DomainSpecific - 0.5) * 0.3

	// Adjust score based on complexity
	// More complex requests require higher quality thresholds
	if classification.Complexity == "complex" {
		// For complex requests, penalize if structure is weak
		if heuristics.StructureQuality < 0.5 {
			score -= 0.1
		}
		// Reward high-structure responses for complex requests
		if heuristics.StructureQuality > 0.7 {
			score += 0.1
		}
	}

	// Normalize score to 0.0-1.0 range
	if score < 0.0 {
		score = 0.0
	}
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// extractResponseContent extracts the main content from a response
func extractResponseContent(resp *models.InferResponse) string {
	if len(resp.Choices) == 0 {
		return ""
	}

	// Get content from the first choice
	return resp.Choices[0].Message.Content
}

// ScoreWithTimeout scores a response with a timeout to prevent slow scoring
func (qs *QualityScorer) ScoreWithTimeout(
	ctx context.Context,
	req *models.InferRequest,
	resp *models.InferResponse,
	classification RequestClassification,
	timeout time.Duration,
) (float64, error) {
	// Create a context with timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Channel to receive the score
	scoreChan := make(chan float64, 1)
	errChan := make(chan error, 1)

	// Calculate score in a goroutine
	go func() {
		score, err := qs.ScoreResponse(ctx, req, resp, classification)
		if err != nil {
			errChan <- err
			return
		}
		scoreChan <- score
	}()

	// Wait for either score or timeout
	select {
	case score := <-scoreChan:
		return score, nil
	case err := <-errChan:
		return 0.0, err
	case <-ctx.Done():
		// Timeout: return a default neutral score
		return 0.7, nil
	}
}

// QualityMetrics contains detailed quality metrics for a response
type QualityMetrics struct {
	OverallScore      float64
	Classification    RequestClassification
	Heuristics        QualityHeuristics
	CalculationTimeMs float64
}

// ScoreWithMetrics calculates quality score and returns detailed metrics
func (qs *QualityScorer) ScoreWithMetrics(
	ctx context.Context,
	req *models.InferRequest,
	resp *models.InferResponse,
	classification RequestClassification,
) (*QualityMetrics, error) {
	startTime := time.Now()

	score, err := qs.ScoreResponse(ctx, req, resp, classification)
	if err != nil {
		return nil, err
	}

	content := extractResponseContent(resp)
	heuristics := CalculateHeuristics(content, classification.Domain)

	calculationTime := time.Since(startTime)

	return &QualityMetrics{
		OverallScore:      score,
		Classification:    classification,
		Heuristics:        heuristics,
		CalculationTimeMs: float64(calculationTime.Milliseconds()),
	}, nil
}

// BatchScore scores multiple responses efficiently
func (qs *QualityScorer) BatchScore(
	ctx context.Context,
	requests []*models.InferRequest,
	responses []*models.InferResponse,
	classifications []RequestClassification,
) ([]float64, error) {
	if len(requests) != len(responses) || len(requests) != len(classifications) {
		return nil, nil
	}

	scores := make([]float64, len(requests))

	for i := range requests {
		score, err := qs.ScoreResponse(ctx, requests[i], responses[i], classifications[i])
		if err != nil {
			scores[i] = 0.7 // Default neutral score on error
		} else {
			scores[i] = score
		}
	}

	return scores, nil
}
