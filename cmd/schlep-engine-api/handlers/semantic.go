package handlers

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/schlep-engine/schlep-engine/internal/bandit"
	"github.com/schlep-engine/schlep-engine/internal/semantic"
)

// SemanticHandler handles semantic routing verification endpoints
type SemanticHandler struct {
	classifier   *semantic.Classifier
	rewardEngine *bandit.RewardEngine
	db           *sql.DB
}

// NewSemanticHandler creates a new semantic handler
func NewSemanticHandler(classifier *semantic.Classifier, rewardEngine *bandit.RewardEngine, db *sql.DB) *SemanticHandler {
	return &SemanticHandler{
		classifier:   classifier,
		rewardEngine: rewardEngine,
		db:           db,
	}
}

// ClassifyRequest represents a classification request
type ClassifyRequest struct {
	Prompt string `json:"prompt"`
}

// ClassifyResponse represents a classification response
type ClassifyResponse struct {
	Class              string                          `json:"class"`
	Confidence         float64                         `json:"confidence"`
	LatencyMs          int64                           `json:"latency_ms"`
	CacheHit           bool                            `json:"cache_hit"`
	ClassifierVersion  string                          `json:"classifier_version"`
	Alternatives       []semantic.AlternativeClass     `json:"alternatives,omitempty"`
	RecommendedProviders []*ProviderRecommendation     `json:"recommended_providers,omitempty"`
}

// ProviderRecommendation represents a provider recommendation for a class
type ProviderRecommendation struct {
	ProviderID       string  `json:"provider_id"`
	ProviderName     string  `json:"provider_name"`
	CompositeReward  float64 `json:"composite_reward"`
	Alpha            float64 `json:"alpha"`
	Beta             float64 `json:"beta"`
	Mean             float64 `json:"mean"`
	SuccessRate      float64 `json:"success_rate"`
	TotalSelections  int     `json:"total_selections"`
}

// HandleClassify performs semantic classification on a prompt
func (sh *SemanticHandler) HandleClassify(c *fiber.Ctx) error {
	ctx := c.Context()

	var req ClassifyRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Prompt == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "prompt is required",
		})
	}

	// Classify the prompt
	result, err := sh.classifier.Classify(ctx, req.Prompt)
	if err != nil {
		log.Error().Err(err).Msg("Classification failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Classification failed",
		})
	}

	// Get provider recommendations for this class
	recommendations, err := sh.getProviderRecommendations(ctx, result.Class)
	if err != nil {
		log.Warn().Err(err).Str("class", result.Class).Msg("Failed to get provider recommendations")
		// Continue without recommendations
	}

	response := ClassifyResponse{
		Class:                result.Class,
		Confidence:           result.Confidence,
		LatencyMs:            result.LatencyMs,
		CacheHit:             result.CacheHit,
		ClassifierVersion:    result.ClassifierVersion,
		Alternatives:         result.AlternativeClasses,
		RecommendedProviders: recommendations,
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

// getProviderRecommendations retrieves top providers for a semantic class
func (sh *SemanticHandler) getProviderRecommendations(ctx context.Context, class string) ([]*ProviderRecommendation, error) {
	arms, err := sh.rewardEngine.GetAllArmsForClass(ctx, class)
	if err != nil {
		return nil, err
	}

	if len(arms) == 0 {
		return nil, nil
	}

	// Convert to recommendations and get provider names
	recommendations := make([]*ProviderRecommendation, 0, len(arms))
	for _, arm := range arms {
		providerName, err := sh.getProviderName(ctx, arm.ProviderID)
		if err != nil {
			providerName = "Unknown"
		}

		recommendations = append(recommendations, &ProviderRecommendation{
			ProviderID:      arm.ProviderID,
			ProviderName:    providerName,
			CompositeReward: arm.CompositeReward,
			Alpha:           arm.Alpha,
			Beta:            arm.Beta,
			Mean:            arm.GetMean(),
			SuccessRate:     arm.GetSuccessRate(),
			TotalSelections: arm.TotalSelections,
		})
	}

	// Limit to top 5
	if len(recommendations) > 5 {
		recommendations = recommendations[:5]
	}

	return recommendations, nil
}

// getProviderName retrieves provider name from database
func (sh *SemanticHandler) getProviderName(ctx context.Context, providerID string) (string, error) {
	query := `SELECT name FROM provider_registry WHERE id = $1::UUID LIMIT 1`

	var name string
	err := sh.db.QueryRowContext(ctx, query, providerID).Scan(&name)
	if err != nil {
		return "", err
	}

	return name, nil
}

// HandleGetClassStats returns statistics for all semantic classes
func (sh *SemanticHandler) HandleGetClassStats(c *fiber.Ctx) error {
	ctx := c.Context()

	stats, err := sh.classifier.GetStats(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get class stats")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get statistics",
		})
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}

// HandleGetBanditStats returns bandit arm statistics for a semantic class
func (sh *SemanticHandler) HandleGetBanditStats(c *fiber.Ctx) error {
	ctx := c.Context()
	class := c.Params("class")

	if class == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "class parameter is required",
		})
	}

	arms, err := sh.rewardEngine.GetAllArmsForClass(ctx, class)
	if err != nil {
		log.Error().Err(err).Str("class", class).Msg("Failed to get bandit stats")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get bandit statistics",
		})
	}

	// Enrich with provider names
	enrichedArms := make([]map[string]interface{}, 0, len(arms))
	for _, arm := range arms {
		providerName, _ := sh.getProviderName(ctx, arm.ProviderID)

		enrichedArms = append(enrichedArms, map[string]interface{}{
			"provider_id":       arm.ProviderID,
			"provider_name":     providerName,
			"semantic_class":    arm.SemanticClass,
			"alpha":             arm.Alpha,
			"beta":              arm.Beta,
			"mean":              arm.GetMean(),
			"variance":          arm.GetVariance(),
			"total_selections":  arm.TotalSelections,
			"total_successes":   arm.TotalSuccesses,
			"total_failures":    arm.TotalFailures,
			"success_rate":      arm.GetSuccessRate(),
			"composite_reward":  arm.CompositeReward,
			"avg_latency_score": arm.AvgLatencyScore,
			"avg_cost_efficiency": arm.AvgCostEfficiency,
			"avg_success_rate":  arm.AvgSuccessRate,
			"weights": map[string]float64{
				"latency": arm.Weights.Latency,
				"cost":    arm.Weights.Cost,
				"success": arm.Weights.Success,
			},
			"updated_at": arm.UpdatedAt,
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"class": class,
		"total_arms": len(enrichedArms),
		"arms": enrichedArms,
	})
}

// HandleGetSemanticDistribution returns distribution of requests across semantic classes
func (sh *SemanticHandler) HandleGetSemanticDistribution(c *fiber.Ctx) error {
	ctx := c.Context()

	query := `
		SELECT
			semantic_class,
			COUNT(*) as total_classifications,
			AVG(confidence_score) as avg_confidence,
			COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
			COUNT(*) FILTER (WHERE cache_hit = false) as cache_misses
		FROM semantic_classifications
		WHERE created_at > NOW() - INTERVAL '24 hours'
		GROUP BY semantic_class
		ORDER BY total_classifications DESC
	`

	rows, err := sh.db.QueryContext(ctx, query)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query semantic distribution")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get distribution",
		})
	}
	defer rows.Close()

	type ClassDistribution struct {
		Class               string  `json:"class"`
		TotalClassifications int    `json:"total_classifications"`
		AvgConfidence       float64 `json:"avg_confidence"`
		CacheHits           int     `json:"cache_hits"`
		CacheMisses         int     `json:"cache_misses"`
		CacheHitRate        float64 `json:"cache_hit_rate"`
	}

	var distributions []ClassDistribution
	totalRequests := 0

	for rows.Next() {
		var d ClassDistribution
		if err := rows.Scan(
			&d.Class,
			&d.TotalClassifications,
			&d.AvgConfidence,
			&d.CacheHits,
			&d.CacheMisses,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan row")
			continue
		}

		// Calculate cache hit rate
		totalHits := d.CacheHits + d.CacheMisses
		if totalHits > 0 {
			d.CacheHitRate = float64(d.CacheHits) / float64(totalHits)
		}

		distributions = append(distributions, d)
		totalRequests += d.TotalClassifications
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"total_requests": totalRequests,
		"distribution":   distributions,
	})
}

// HandleGetRewardComposition returns reward composition analysis
func (sh *SemanticHandler) HandleGetRewardComposition(c *fiber.Ctx) error {
	ctx := c.Context()

	query := `
		SELECT
			semantic_class,
			AVG(latency_score) as avg_latency_score,
			AVG(cost_efficiency) as avg_cost_efficiency,
			AVG(success_rate) as avg_success_rate,
			AVG(composite_reward) as avg_composite_reward,
			COUNT(*) as sample_size
		FROM feedback_events
		WHERE created_at > NOW() - INTERVAL '24 hours'
		  AND processed = true
		GROUP BY semantic_class
		ORDER BY avg_composite_reward DESC
	`

	rows, err := sh.db.QueryContext(ctx, query)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query reward composition")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get reward composition",
		})
	}
	defer rows.Close()

	type RewardComposition struct {
		Class              string  `json:"class"`
		AvgLatencyScore    float64 `json:"avg_latency_score"`
		AvgCostEfficiency  float64 `json:"avg_cost_efficiency"`
		AvgSuccessRate     float64 `json:"avg_success_rate"`
		AvgCompositeReward float64 `json:"avg_composite_reward"`
		SampleSize         int     `json:"sample_size"`
	}

	var compositions []RewardComposition
	for rows.Next() {
		var r RewardComposition
		if err := rows.Scan(
			&r.Class,
			&r.AvgLatencyScore,
			&r.AvgCostEfficiency,
			&r.AvgSuccessRate,
			&r.AvgCompositeReward,
			&r.SampleSize,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan row")
			continue
		}

		compositions = append(compositions, r)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"reward_compositions": compositions,
	})
}
