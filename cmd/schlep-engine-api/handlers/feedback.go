package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/schlep-engine/schlep-engine/internal/bandit"
	"github.com/schlep-engine/schlep-engine/internal/observability"
)

// FeedbackHandler handles inference feedback submissions
type FeedbackHandler struct {
	db           *sql.DB
	rewardEngine *bandit.RewardEngine
}

// NewFeedbackHandler creates a new feedback handler
func NewFeedbackHandler(db *sql.DB, rewardEngine *bandit.RewardEngine) *FeedbackHandler {
	return &FeedbackHandler{
		db:           db,
		rewardEngine: rewardEngine,
	}
}

// FeedbackRequest represents a feedback submission
type FeedbackRequest struct {
	RequestID     string  `json:"request_id"`      // UUID of the inference request
	Rating        float64 `json:"rating"`          // User rating 0-5 (optional)
	Latency       int64   `json:"latency"`         // Latency in milliseconds
	Cost          float64 `json:"cost"`            // Cost in USD
	Success       bool    `json:"success"`         // Whether the request succeeded
	ProviderID    string  `json:"provider_id"`     // Provider UUID (optional, can be inferred)
	SemanticClass string  `json:"semantic_class"`  // Semantic class (optional, can be inferred)
}

// FeedbackResponse represents the feedback submission response
type FeedbackResponse struct {
	FeedbackID      string  `json:"feedback_id"`
	RequestID       string  `json:"request_id"`
	ProcessedAt     string  `json:"processed_at"`
	CompositeReward float64 `json:"composite_reward"`
	Status          string  `json:"status"`
}

// HandleFeedback processes an inference feedback submission
func (fh *FeedbackHandler) HandleFeedback(c *fiber.Ctx) error {
	ctx := c.Context()

	// Parse request body
	var req FeedbackRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		log.Error().Err(err).Msg("Failed to parse feedback request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.RequestID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "request_id is required",
		})
	}

	if req.Latency < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "latency must be non-negative",
		})
	}

	if req.Cost < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cost must be non-negative",
		})
	}

	if req.Rating < 0 || req.Rating > 5 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "rating must be between 0 and 5",
		})
	}

	// Get tenant ID from context (set by auth middleware)
	tenantID := c.Locals("tenant_id")
	if tenantID == nil {
		tenantID = "00000000-0000-0000-0000-000000000000" // Default/system tenant
	}

	// If provider_id or semantic_class not provided, try to infer from routing telemetry
	if req.ProviderID == "" || req.SemanticClass == "" {
		provider, class, err := fh.inferFromTelemetry(ctx, req.RequestID)
		if err != nil {
			log.Warn().Err(err).Str("request_id", req.RequestID).Msg("Failed to infer provider/class from telemetry")
			// Continue with defaults if inference fails
			if req.ProviderID == "" {
				req.ProviderID = "00000000-0000-0000-0000-000000000000"
			}
			if req.SemanticClass == "" {
				req.SemanticClass = "default"
			}
		} else {
			if req.ProviderID == "" {
				req.ProviderID = provider
			}
			if req.SemanticClass == "" {
				req.SemanticClass = class
			}
		}
	}

	// Calculate composite reward
	startTime := time.Now()
	reward := fh.rewardEngine.CalculateCompositeReward(
		req.Latency,
		req.Cost,
		req.Success,
		req.SemanticClass,
	)

	processingLatencyMs := time.Since(startTime).Milliseconds()

	// Store feedback event in database
	feedbackID, err := fh.storeFeedbackEvent(ctx, tenantID.(string), req, reward, processingLatencyMs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to store feedback event")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to store feedback",
		})
	}

	// Update bandit arm asynchronously (fire and forget)
	go fh.processFeedbackAsync(context.Background(), req.ProviderID, req.SemanticClass, reward, req.Success)

	// Record metrics
	observability.RecordFeedbackEvent(req.ProviderID, req.SemanticClass, req.Success, processingLatencyMs)

	// Return response
	return c.Status(fiber.StatusOK).JSON(FeedbackResponse{
		FeedbackID:      feedbackID,
		RequestID:       req.RequestID,
		ProcessedAt:     time.Now().UTC().Format(time.RFC3339),
		CompositeReward: reward.Total,
		Status:          "queued",
	})
}

// storeFeedbackEvent stores a feedback event in the database
func (fh *FeedbackHandler) storeFeedbackEvent(
	ctx context.Context,
	tenantID string,
	req FeedbackRequest,
	reward bandit.CompositeReward,
	processingLatencyMs int64,
) (string, error) {
	query := `
		INSERT INTO feedback_events (
			request_id, tenant_id, provider_id, semantic_class,
			rating, latency_ms, cost_usd, success,
			latency_score, cost_efficiency, success_rate, composite_reward,
			processing_latency_ms, processed
		) VALUES (
			$1::UUID, $2::UUID, $3::UUID, $4,
			$5, $6, $7, $8,
			$9, $10, $11, $12,
			$13, false
		) RETURNING id
	`

	var feedbackID string
	err := fh.db.QueryRowContext(ctx, query,
		req.RequestID,
		tenantID,
		req.ProviderID,
		req.SemanticClass,
		sql.NullFloat64{Float64: req.Rating, Valid: req.Rating > 0},
		req.Latency,
		req.Cost,
		req.Success,
		reward.Components.LatencyScore,
		reward.Components.CostEfficiency,
		reward.Components.SuccessRate,
		reward.Total,
		processingLatencyMs,
	).Scan(&feedbackID)

	if err != nil {
		return "", err
	}

	return feedbackID, nil
}

// inferFromTelemetry attempts to infer provider_id and semantic_class from routing telemetry
func (fh *FeedbackHandler) inferFromTelemetry(ctx context.Context, requestID string) (providerID, semanticClass string, err error) {
	query := `
		SELECT provider_id::TEXT, COALESCE(semantic_class, 'default')
		FROM policy_audit_log
		WHERE trace_id = $1::UUID
		ORDER BY created_at DESC
		LIMIT 1
	`

	err = fh.db.QueryRowContext(ctx, query, requestID).Scan(&providerID, &semanticClass)
	if err != nil {
		if err == sql.ErrNoRows {
			// Try routing_telemetry as fallback
			query2 := `
				SELECT provider_id::TEXT, 'default'
				FROM routing_telemetry
				WHERE trace_id = $1::UUID
				ORDER BY created_at DESC
				LIMIT 1
			`
			err = fh.db.QueryRowContext(ctx, query2, requestID).Scan(&providerID, &semanticClass)
		}
	}

	return
}

// processFeedbackAsync processes feedback asynchronously to update bandit arms
func (fh *FeedbackHandler) processFeedbackAsync(
	ctx context.Context,
	providerID string,
	semanticClass string,
	reward bandit.CompositeReward,
	success bool,
) {
	startTime := time.Now()

	// Update bandit arm
	err := fh.rewardEngine.UpdateBanditArm(ctx, providerID, semanticClass, reward, success)

	processingLatencyMs := time.Since(startTime).Milliseconds()

	if err != nil {
		log.Error().
			Err(err).
			Str("provider_id", providerID).
			Str("semantic_class", semanticClass).
			Msg("Failed to update bandit arm asynchronously")
		observability.RecordFeedbackProcessed(false)
		return
	}

	observability.RecordFeedbackProcessed(true)
	observability.RecordBanditRewardUpdate(providerID, semanticClass, processingLatencyMs, true)

	log.Debug().
		Str("provider_id", providerID).
		Str("semantic_class", semanticClass).
		Float64("composite_reward", reward.Total).
		Int64("processing_latency_ms", processingLatencyMs).
		Msg("Feedback processed asynchronously")
}

// HandleBatchFeedback processes multiple feedback submissions in a batch
func (fh *FeedbackHandler) HandleBatchFeedback(c *fiber.Ctx) error {
	ctx := c.Context()

	var requests []FeedbackRequest
	if err := json.Unmarshal(c.Body(), &requests); err != nil {
		log.Error().Err(err).Msg("Failed to parse batch feedback request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if len(requests) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No feedback events provided",
		})
	}

	if len(requests) > 100 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Maximum 100 feedback events per batch",
		})
	}

	tenantID := c.Locals("tenant_id")
	if tenantID == nil {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}

	responses := make([]FeedbackResponse, 0, len(requests))

	for _, req := range requests {
		// Validate
		if req.RequestID == "" || req.Latency < 0 || req.Cost < 0 {
			continue // Skip invalid requests
		}

		// Calculate reward
		reward := fh.rewardEngine.CalculateCompositeReward(
			req.Latency,
			req.Cost,
			req.Success,
			req.SemanticClass,
		)

		// Store feedback
		feedbackID, err := fh.storeFeedbackEvent(ctx, tenantID.(string), req, reward, 0)
		if err != nil {
			log.Error().Err(err).Str("request_id", req.RequestID).Msg("Failed to store batch feedback")
			continue
		}

		// Process asynchronously
		go fh.processFeedbackAsync(context.Background(), req.ProviderID, req.SemanticClass, reward, req.Success)

		responses = append(responses, FeedbackResponse{
			FeedbackID:      feedbackID,
			RequestID:       req.RequestID,
			ProcessedAt:     time.Now().UTC().Format(time.RFC3339),
			CompositeReward: reward.Total,
			Status:          "queued",
		})

		// Record metrics
		observability.RecordFeedbackEvent(req.ProviderID, req.SemanticClass, req.Success, 0)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"total":     len(requests),
		"processed": len(responses),
		"feedback":  responses,
	})
}

// HandleGetFeedbackStats returns statistics about feedback events
func (fh *FeedbackHandler) HandleGetFeedbackStats(c *fiber.Ctx) error {
	ctx := c.Context()

	query := `
		SELECT
			COUNT(*) as total_feedback,
			COUNT(*) FILTER (WHERE processed = true) as processed_count,
			COUNT(*) FILTER (WHERE processed = false) as pending_count,
			COALESCE(AVG(processing_latency_ms) FILTER (WHERE processed = true), 0) as avg_processing_latency_ms,
			COALESCE(AVG(composite_reward), 0) as avg_composite_reward
		FROM feedback_events
		WHERE created_at > NOW() - INTERVAL '24 hours'
	`

	var stats struct {
		TotalFeedback           int     `json:"total_feedback"`
		ProcessedCount          int     `json:"processed_count"`
		PendingCount            int     `json:"pending_count"`
		AvgProcessingLatencyMs  float64 `json:"avg_processing_latency_ms"`
		AvgCompositeReward      float64 `json:"avg_composite_reward"`
	}

	err := fh.db.QueryRowContext(ctx, query).Scan(
		&stats.TotalFeedback,
		&stats.ProcessedCount,
		&stats.PendingCount,
		&stats.AvgProcessingLatencyMs,
		&stats.AvgCompositeReward,
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to get feedback stats")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get feedback stats",
		})
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}
