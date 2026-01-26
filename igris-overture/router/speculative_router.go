package router

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// SpeculativeRouter implements token-level speculative execution with mid-stream switching.
// It races multiple providers in parallel and selects the winner based on first-token latency,
// quality scoring, and cost optimization.
type SpeculativeRouter struct {
	config          *config.SpeculativeConfig
	adaptiveRouter  *AdaptiveRouter
	providerRegistry *providers.ProviderRegistry
	costAccounting  *CostAccounting
	mu              sync.RWMutex
}

// NewSpeculativeRouter creates a new speculative router that wraps an existing AdaptiveRouter
func NewSpeculativeRouter(
	config *config.SpeculativeConfig,
	adaptiveRouter *AdaptiveRouter,
	providerRegistry *providers.ProviderRegistry,
) *SpeculativeRouter {
	return &SpeculativeRouter{
		config:           config,
		adaptiveRouter:   adaptiveRouter,
		providerRegistry: providerRegistry,
		costAccounting:   NewCostAccounting(config),
	}
}

// ProviderCandidate represents a provider selected for the speculative race
type ProviderCandidate struct {
	Provider     providers.Provider
	ProviderID   string
	Context      context.Context
	Cancel       context.CancelFunc
	TokenChan    chan *models.StreamChunk
	ErrChan      chan error
	FirstTokenAt time.Time
	TokenCount   int
	mu           sync.Mutex
}

// SpeculativeResult contains the result of a speculative execution
type SpeculativeResult struct {
	Winner           *ProviderCandidate
	AllCandidates    []*ProviderCandidate
	WinnerTokens     []*models.StreamChunk
	RaceStartTime    time.Time
	FirstTokenTime   time.Time
	LatencySavedMs   int64
	WastedTokens     int
	SpeculativeCostUSD float64
}

// RouteSpeculative performs speculative execution across multiple providers
// It selects N providers using the AdaptiveRouter, races them in parallel,
// and returns the fastest responding stream with mid-stream fallback capability.
//
// TIER REQUIREMENT: Growth+ (authority level: enforce or prove)
func (sr *SpeculativeRouter) RouteSpeculative(
	ctx context.Context,
	req *models.InferRequest,
	mode config.SpeculativeMode,
) (<-chan *models.StreamChunk, <-chan error, *SpeculativeMetadata, error) {
	// Start OpenTelemetry span for the speculative race
	ctx, span := observability.StartSpan(ctx, "speculative_race")
	defer span.End()

	// Extract tenant ID from context using middleware helper
	// TenantIDFromContext returns "default" if no tenant ID is set (backward compatible)
	tenantID := middleware.TenantIDFromContext(ctx)

	// TIER ENFORCEMENT: Speculative execution requires Growth+ tier
	if err := middleware.RequireFeature(ctx, "speculative_execution"); err != nil {
		log.Printf("[SpeculativeRouter] Tier enforcement: tenant=%s error=%v", tenantID, err)
		return nil, nil, nil, fmt.Errorf("speculative execution requires Growth tier or higher: %w", err)
	}

	// Check if speculative mode is auto-disabled for this tenant
	if disabled, reason := sr.costAccounting.ShouldDisableSpeculative(tenantID); disabled {
		log.Printf("[SpeculativeRouter] Speculative mode auto-disabled for tenant %s: %s", tenantID, reason)
		return nil, nil, nil, fmt.Errorf("speculative mode auto-disabled: %s", reason)
	}

	// Validate mode
	if mode == config.SpeculativeModeOff {
		return nil, nil, nil, fmt.Errorf("speculative mode is disabled")
	}

	// Validate configuration
	if sr.config.MaxProviders < 2 || sr.config.MaxProviders > 4 {
		return nil, nil, nil, fmt.Errorf("invalid MaxProviders: must be 2-4, got %d", sr.config.MaxProviders)
	}

	raceStart := time.Now()

	// Step 1: Select N provider candidates using Thompson Sampling
	candidates, err := sr.selectCandidates(ctx, req, sr.config.MaxProviders)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to select candidates: %w", err)
	}

	if len(candidates) < 2 {
		return nil, nil, nil, fmt.Errorf("insufficient candidates: need at least 2, got %d", len(candidates))
	}

	log.Printf("[SpeculativeRouter] Racing %d providers: %v", len(candidates), getCandidateIDs(candidates))

	// Step 2: Launch all providers in parallel with cancellation contexts and create child spans
	for i, candidate := range candidates {
		// Create child span for each provider
		providerCtx, providerSpan := observability.StartSpan(candidate.Context, fmt.Sprintf("provider_%s_attempt", candidate.ProviderID))
		observability.AddSpeculativeAttributes(providerCtx, string(mode), candidate.ProviderID, i+1)
		candidate.Context = providerCtx

		// Store span for later cleanup
		go func(c *ProviderCandidate, span any) {
			sr.executeProvider(c, req)
			// Span will be ended when provider finishes or is cancelled
		}(candidate, providerSpan)
	}

	// Step 3: Wait for early tokens from all providers (or timeout)
	readyCandidates, err := sr.waitForEarlyTokens(candidates, sr.config.FirstTokenTimeout, mode)
	if err != nil {
		// Cancel all providers on failure
		sr.cancelAllCandidates(candidates)
		return nil, nil, nil, fmt.Errorf("race failed: %w", err)
	}

	// Step 3b: Use quality scorer to select the best provider
	qualityScorer := NewQualityScorer(sr.config, mode)
	scores := qualityScorer.ScoreCandidates(readyCandidates)
	winnerScore := qualityScorer.SelectWinner(scores)

	if winnerScore == nil {
		sr.cancelAllCandidates(candidates)
		return nil, nil, nil, fmt.Errorf("no winner selected from candidates")
	}

	// Find the winner candidate
	var winner *ProviderCandidate
	for _, candidate := range readyCandidates {
		if candidate.ProviderID == winnerScore.ProviderID {
			winner = candidate
			break
		}
	}

	if winner == nil {
		sr.cancelAllCandidates(candidates)
		return nil, nil, nil, fmt.Errorf("winner candidate not found: %s", winnerScore.ProviderID)
	}

	// Step 4: DO NOT cancel losing providers yet - keep them as fallbacks
	// (They will be cancelled when stream merger stops or switches away)
	log.Printf("[SpeculativeRouter] Keeping %d fallback providers alive for mid-stream switching",
		len(candidates)-1)

	// Step 5: Create stream merger for seamless delivery with fallback
	merger := NewStreamMerger(ctx, winner, candidates)
	mergedTokenChan, mergedErrChan := merger.Start()

	// Step 6: Calculate initial metadata with quality scoring results
	firstTokenLatency := winner.FirstTokenAt.Sub(raceStart)
	metadata := &SpeculativeMetadata{
		ProvidersUsed:     getCandidateIDs(candidates),
		WinnerProvider:    winner.ProviderID,
		SwitchTokenNumber: 1, // Initial selection (not a mid-stream switch)
		LatencySavedMs:    firstTokenLatency.Milliseconds(),
		RaceStartTime:     raceStart,
		FirstTokenTime:    winner.FirstTokenAt,
		StreamMerger:      merger, // Store merger for later metadata retrieval

		// Quality scoring metadata
		QualityScore:      winnerScore.QualityScore,
		CompositeScore:    winnerScore.CompositeScore,
		SelectionCriteria: string(mode),
	}

	log.Printf("[SpeculativeRouter] Winner: %s (first token after %dms, composite score: %.3f)",
		winner.ProviderID, firstTokenLatency.Milliseconds(), winnerScore.CompositeScore)

	// Record Prometheus metrics for all candidates
	for _, score := range scores {
		result := "loser"
		if score.ProviderID == winner.ProviderID {
			result = "winner"
			observability.MarkSpanAsWinner(ctx, true)
		}

		// Record race latency
		observability.RecordSpeculativeProviderRace(
			score.ProviderID,
			string(mode),
			result,
			score.FirstTokenLatency.Milliseconds(),
		)

		// Record quality scores
		observability.RecordSpeculativeQualityScore(score.ProviderID, string(mode), "latency", score.LatencyScore)
		observability.RecordSpeculativeQualityScore(score.ProviderID, string(mode), "quality", score.QualityScore)
		observability.RecordSpeculativeQualityScore(score.ProviderID, string(mode), "cost", score.CostScore)
		observability.RecordSpeculativeQualityScore(score.ProviderID, string(mode), "composite", score.CompositeScore)

		// Add quality scores to trace
		if score.ProviderID == winner.ProviderID {
			observability.AddQualityScoreAttributes(ctx,
				score.LatencyScore,
				score.QualityScore,
				score.CostScore,
				score.CompositeScore,
			)
		}
	}

	// Record overall speculative request metrics
	observability.RecordSpeculativeRequest(
		string(mode),
		winner.ProviderID,
		tenantID,
		firstTokenLatency.Milliseconds(),
		len(candidates),
	)

	// Step 7: Return merged stream channels and metadata
	return mergedTokenChan, mergedErrChan, metadata, nil
}

// selectCandidates uses the AdaptiveRouter to select N provider candidates
// based on Thompson Sampling and health status
func (sr *SpeculativeRouter) selectCandidates(
	ctx context.Context,
	req *models.InferRequest,
	count int,
) ([]*ProviderCandidate, error) {
	candidates := make([]*ProviderCandidate, 0, count)

	// Get all available providers from registry
	providerNames := sr.providerRegistry.List()
	if len(providerNames) < count {
		log.Printf("[SpeculativeRouter] Warning: requested %d providers but only %d available", count, len(providerNames))
		count = len(providerNames)
	}

	// Select top N providers
	// (In PR#1, we use simple selection. PR#3 will add Thompson Sampling integration)
	selectedIDs := make(map[string]bool)
	for i := 0; i < count && i < len(providerNames); i++ {
		// For now, select providers in order (will be enhanced in PR#3 with Thompson Sampling)
		providerName := providerNames[i]
		if selectedIDs[providerName] {
			continue
		}

		provider, ok := sr.providerRegistry.Get(providerName)
		if !ok {
			continue
		}

		// Create cancellable context for this provider
		providerCtx, cancel := context.WithCancel(ctx)

		candidate := &ProviderCandidate{
			Provider:   provider,
			ProviderID: providerName,
			Context:    providerCtx,
			Cancel:     cancel,
			TokenChan:  make(chan *models.StreamChunk, sr.config.EarlyTokenCount*2), // Buffered
			ErrChan:    make(chan error, 1),
			TokenCount: 0,
		}

		candidates = append(candidates, candidate)
		selectedIDs[providerName] = true
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no healthy providers available")
	}

	return candidates, nil
}

// executeProvider executes a streaming request on a single provider candidate
func (sr *SpeculativeRouter) executeProvider(candidate *ProviderCandidate, req *models.InferRequest) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[SpeculativeRouter] Provider %s panicked: %v", candidate.ProviderID, r)
			candidate.ErrChan <- fmt.Errorf("provider panic: %v", r)
		}
	}()

	// Call provider's InferStream method
	chunkChan, errChan := candidate.Provider.InferStream(candidate.Context, req)

	// Forward tokens and errors to candidate's channels
	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				// Stream completed successfully
				close(candidate.TokenChan)
				return
			}

			candidate.mu.Lock()
			if candidate.TokenCount == 0 {
				// Record first token arrival time
				candidate.FirstTokenAt = time.Now()
			}
			candidate.TokenCount++
			candidate.mu.Unlock()

			// Send chunk to candidate's output channel
			select {
			case candidate.TokenChan <- chunk:
			case <-candidate.Context.Done():
				// Provider was cancelled (lost the race)
				return
			}

		case err := <-errChan:
			candidate.ErrChan <- err
			return

		case <-candidate.Context.Done():
			// Provider was cancelled (lost the race)
			return
		}
	}
}

// waitForEarlyTokens waits for early tokens from candidates for quality evaluation
func (sr *SpeculativeRouter) waitForEarlyTokens(
	candidates []*ProviderCandidate,
	timeout time.Duration,
	mode config.SpeculativeMode,
) ([]*ProviderCandidate, error) {
	// In latency mode, select winner on first token
	if mode == config.SpeculativeModeLatency {
		winner, err := sr.waitForFirstToken(candidates, timeout)
		if err != nil {
			return nil, err
		}
		return []*ProviderCandidate{winner}, nil
	}

	// For other modes, wait for early tokens from multiple providers
	earlyTokenTimeout := timeout + (200 * time.Millisecond) // Extra time for quality eval
	timer := time.NewTimer(earlyTokenTimeout)
	defer timer.Stop()

	readyCandidates := make([]*ProviderCandidate, 0, len(candidates))

	// Wait for candidates to produce at least 1 token
	<-time.After(timeout)

	// Check which candidates have tokens
	for _, candidate := range candidates {
		candidate.mu.Lock()
		if candidate.TokenCount > 0 {
			readyCandidates = append(readyCandidates, candidate)
		}
		candidate.mu.Unlock()
	}

	if len(readyCandidates) == 0 {
		return nil, fmt.Errorf("no providers produced tokens within timeout")
	}

	log.Printf("[SpeculativeRouter] %d/%d candidates ready for quality evaluation",
		len(readyCandidates), len(candidates))

	return readyCandidates, nil
}

// waitForFirstToken waits for the first token from any candidate or timeout
func (sr *SpeculativeRouter) waitForFirstToken(
	candidates []*ProviderCandidate,
	timeout time.Duration,
) (*ProviderCandidate, error) {
	// Create a channel to receive the winner
	winnerChan := make(chan *ProviderCandidate, 1)
	errorsChan := make(chan error, len(candidates))

	// Monitor each candidate for first token
	for _, candidate := range candidates {
		go func(c *ProviderCandidate) {
			select {
			case chunk, ok := <-c.TokenChan:
				if ok && chunk != nil {
					// First token received! This is the winner
					// Put the chunk back into the channel (non-blocking)
					select {
					case c.TokenChan <- chunk:
					default:
						// Channel full, this shouldn't happen with buffered channel
						log.Printf("[SpeculativeRouter] Warning: failed to return chunk to buffer for %s", c.ProviderID)
					}

					// Signal winner
					select {
					case winnerChan <- c:
					default:
						// Another provider already won
					}
				}
			case err := <-c.ErrChan:
				// Provider failed
				errorsChan <- fmt.Errorf("provider %s failed: %w", c.ProviderID, err)
			case <-c.Context.Done():
				// Provider was cancelled
				return
			}
		}(candidate)
	}

	// Wait for winner or timeout
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case winner := <-winnerChan:
		return winner, nil

	case <-timer.C:
		// Timeout: give providers a grace period to deliver tokens, then select fastest
		gracePeriod := 200 * time.Millisecond
		log.Printf("[SpeculativeRouter] Initial timeout reached, waiting %v for tokens...", gracePeriod)

		select {
		case winner := <-winnerChan:
			log.Printf("[SpeculativeRouter] Winner arrived during grace period: %s", winner.ProviderID)
			return winner, nil
		case <-time.After(gracePeriod):
			// After grace period, select the candidate with the lowest first-token latency
			var fastest *ProviderCandidate
			var fastestTime time.Time

			for _, c := range candidates {
				c.mu.Lock()
				if !c.FirstTokenAt.IsZero() {
					if fastest == nil || c.FirstTokenAt.Before(fastestTime) {
						fastest = c
						fastestTime = c.FirstTokenAt
					}
				}
				c.mu.Unlock()
			}

			if fastest != nil {
				log.Printf("[SpeculativeRouter] Timeout reached, selecting fastest: %s", fastest.ProviderID)
				return fastest, nil
			}

			return nil, fmt.Errorf("timeout waiting for first token (%v), no providers responded", timeout)
		}

	case err := <-errorsChan:
		// If we get errors from all providers, fail
		// For now, continue waiting for others
		log.Printf("[SpeculativeRouter] Provider error during race: %v", err)
		// Try to wait for other providers
		select {
		case winner := <-winnerChan:
			return winner, nil
		case <-time.After(timeout):
			return nil, fmt.Errorf("all providers failed or timed out")
		}
	}
}

// cancelAllCandidates cancels all provider contexts
func (sr *SpeculativeRouter) cancelAllCandidates(candidates []*ProviderCandidate) {
	for _, candidate := range candidates {
		candidate.Cancel()
	}
}

// cancelLosingCandidates cancels all candidates except the winner
func (sr *SpeculativeRouter) cancelLosingCandidates(candidates []*ProviderCandidate, winner *ProviderCandidate) {
	cancelledCount := 0
	for _, candidate := range candidates {
		if candidate != winner {
			candidate.Cancel()
			cancelledCount++
		}
	}
	log.Printf("[SpeculativeRouter] Cancelled %d losing providers", cancelledCount)
}

// SpeculativeMetadata contains metadata about the speculative execution
type SpeculativeMetadata struct {
	ProvidersUsed      []string         `json:"speculative_providers_used"`
	WinnerProvider     string           `json:"winner_provider"`
	SwitchTokenNumber  int              `json:"switch_token_number"`
	LatencySavedMs     int64            `json:"latency_saved_ms"`
	SpeculativeCostUSD float64          `json:"speculative_cost_usd,omitempty"`
	WastedTokens       int              `json:"wasted_tokens,omitempty"`
	RaceStartTime      time.Time        `json:"race_start_time"`
	FirstTokenTime     time.Time        `json:"first_token_time"`

	// PR#2: Stream merger metadata
	StreamMerger       *StreamMerger    `json:"-"` // Internal, not serialized
	MidStreamSwitch    bool             `json:"mid_stream_switch,omitempty"`
	FinalProvider      string           `json:"final_provider,omitempty"`
	TotalTokens        int              `json:"total_tokens,omitempty"`

	// PR#3: Quality scoring metadata
	QualityScore       float64          `json:"quality_score,omitempty"`
	CompositeScore     float64          `json:"composite_score,omitempty"`
	SelectionCriteria  string           `json:"selection_criteria,omitempty"` // latency|quality|cost|balanced
}

// GetFinalMetadata retrieves complete metadata including stream merger stats
// Call this after the stream has completed
func (sm *SpeculativeMetadata) GetFinalMetadata() *SpeculativeMetadata {
	if sm.StreamMerger != nil {
		mergerMeta := sm.StreamMerger.GetMetadata()
		sm.MidStreamSwitch = mergerMeta.SwitchOccurred
		sm.FinalProvider = mergerMeta.FinalProvider
		sm.TotalTokens = mergerMeta.TokensDelivered
		if mergerMeta.SwitchOccurred {
			sm.SwitchTokenNumber = mergerMeta.SwitchTokenNumber
		}
	}
	return sm
}

// RecordCosts records cost accounting after stream completion
// This should be called by the handler after consuming all tokens
// P0-1 FIX: Now bills per-provider based on ACTUALLY DELIVERED tokens, not just final provider
func (sr *SpeculativeRouter) RecordCosts(
	ctx context.Context,
	metadata *SpeculativeMetadata,
	candidates []*ProviderCandidate,
	tenantID string,
) error {
	if metadata == nil {
		return fmt.Errorf("metadata is nil")
	}

	// Get final metadata with per-provider token counts
	finalMeta := metadata.GetFinalMetadata()
	mergerMeta := finalMeta.StreamMerger.GetMetadata()

	// Calculate cost per token (simplified - in production would use provider cost models)
	costPerTokenUSD := map[string]float64{
		"openai":     0.002,
		"anthropic":  0.003,
		"gemini":     0.001,
		"deepseek":   0.0002,
		"default":    0.002,
	}

	// P0-1 FIX: Calculate costs PER PROVIDER based on delivered tokens from metadata
	// NOT just billing the final provider for all tokens
	var totalDeliveredCost float64
	var totalDeliveredTokens int
	providerDeliveredCosts := make(map[string]*ProviderDeliveredCost)

	if len(mergerMeta.ProviderTokenCounts) > 0 {
		// Use accurate per-provider counts from StreamMerger
		for providerID, tokensDelivered := range mergerMeta.ProviderTokenCounts {
			costPer1k := costPerTokenUSD["default"]
			if cost, exists := costPerTokenUSD[providerID]; exists {
				costPer1k = cost
			}
			deliveredCost := float64(tokensDelivered) * (costPer1k / 1000.0)

			providerDeliveredCosts[providerID] = &ProviderDeliveredCost{
				ProviderID:       providerID,
				TokensDelivered:  tokensDelivered,
				CostDeliveredUSD: deliveredCost,
			}

			totalDeliveredCost += deliveredCost
			totalDeliveredTokens += tokensDelivered
		}
	} else {
		// Fallback: bill final provider for all tokens (backwards compat)
		winnerProviderID := finalMeta.FinalProvider
		if winnerProviderID == "" {
			winnerProviderID = metadata.WinnerProvider
		}
		winnerTokens := finalMeta.TotalTokens
		if winnerTokens == 0 {
			winnerTokens = 10 // Default if not tracked
		}

		costPer1k := costPerTokenUSD["default"]
		if cost, exists := costPerTokenUSD[winnerProviderID]; exists {
			costPer1k = cost
		}
		deliveredCost := float64(winnerTokens) * (costPer1k / 1000.0)

		providerDeliveredCosts[winnerProviderID] = &ProviderDeliveredCost{
			ProviderID:       winnerProviderID,
			TokensDelivered:  winnerTokens,
			CostDeliveredUSD: deliveredCost,
		}
		totalDeliveredCost = deliveredCost
		totalDeliveredTokens = winnerTokens
	}

	// Calculate waste from ALL providers (including those that delivered some tokens)
	// Waste = tokens generated but NOT delivered to client
	wasteByProvider := make(map[string]*ProviderWasteStats)
	for _, candidate := range candidates {
		candidate.mu.Lock()
		tokensGenerated := candidate.TokenCount
		candidate.mu.Unlock()

		// Tokens delivered from this provider
		tokensDelivered := 0
		if deliveredCost, exists := providerDeliveredCosts[candidate.ProviderID]; exists {
			tokensDelivered = deliveredCost.TokensDelivered
		}

		// Waste = generated - delivered
		tokensWasted := tokensGenerated - tokensDelivered
		if tokensWasted < 0 {
			tokensWasted = 0 // Safety check
		}

		if tokensWasted > 0 {
			costPer1k := costPerTokenUSD["default"]
			if cost, exists := costPerTokenUSD[candidate.ProviderID]; exists {
				costPer1k = cost
			}
			costWasted := float64(tokensWasted) * (costPer1k / 1000.0)

			wasteByProvider[candidate.ProviderID] = &ProviderWasteStats{
				ProviderID:    candidate.ProviderID,
				TokensWasted:  tokensWasted,
				CostWastedUSD: costWasted,
			}
		}
	}

	// Record costs in accounting system with per-provider delivered costs
	err := sr.costAccounting.RecordSpeculativeRequestWithProviderBreakdown(
		ctx,
		tenantID,
		providerDeliveredCosts,
		wasteByProvider,
	)

	if err != nil {
		log.Printf("[SpeculativeRouter] Failed to record costs: %v", err)
		return err
	}

	// Update metadata with cost info
	var wastedCost float64
	var wastedTokens int
	for _, waste := range wasteByProvider {
		wastedCost += waste.CostWastedUSD
		wastedTokens += waste.TokensWasted
	}

	metadata.SpeculativeCostUSD = wastedCost
	metadata.WastedTokens = wastedTokens

	log.Printf("[SpeculativeRouter] Cost breakdown: delivered=%d tokens ($%.4f), wasted=%d tokens ($%.4f)",
		totalDeliveredTokens, totalDeliveredCost, wastedTokens, wastedCost)

	return nil
}

// Helper: find candidate by ID
func findCandidateByID(candidates []*ProviderCandidate, providerID string) *ProviderCandidate {
	for _, c := range candidates {
		if c.ProviderID == providerID {
			return c
		}
	}
	return nil
}

// Helper functions

func getCandidateIDs(candidates []*ProviderCandidate) []string {
	ids := make([]string, len(candidates))
	for i, c := range candidates {
		ids[i] = c.ProviderID
	}
	return ids
}
