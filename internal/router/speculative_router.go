package router

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/config"
	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
)

// SpeculativeRouter implements token-level speculative execution with mid-stream switching.
// It races multiple providers in parallel and selects the winner based on first-token latency,
// quality scoring, and cost optimization.
type SpeculativeRouter struct {
	config          *config.SpeculativeConfig
	adaptiveRouter  *AdaptiveRouter
	providerRegistry *providers.ProviderRegistry
	mu              sync.RWMutex
}

// NewSpeculativeRouter creates a new speculative router that wraps an existing AdaptiveRouter
func NewSpeculativeRouter(
	config *config.SpeculativeConfig,
	adaptiveRouter *AdaptiveRouter,
	providerRegistry *providers.ProviderRegistry,
) *SpeculativeRouter {
	return &SpeculativeRouter{
		config:          config,
		adaptiveRouter:  adaptiveRouter,
		providerRegistry: providerRegistry,
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
func (sr *SpeculativeRouter) RouteSpeculative(
	ctx context.Context,
	req *models.InferRequest,
	mode config.SpeculativeMode,
) (<-chan *models.StreamChunk, <-chan error, *SpeculativeMetadata, error) {
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

	// Step 2: Launch all providers in parallel with cancellation contexts
	for _, candidate := range candidates {
		go sr.executeProvider(candidate, req)
	}

	// Step 3: Wait for first token from any provider (or timeout)
	winner, err := sr.waitForFirstToken(candidates, sr.config.FirstTokenTimeout)
	if err != nil {
		// Cancel all providers on failure
		sr.cancelAllCandidates(candidates)
		return nil, nil, nil, fmt.Errorf("race failed: %w", err)
	}

	// Step 4: DO NOT cancel losing providers yet - keep them as fallbacks
	// (They will be cancelled when stream merger stops or switches away)
	log.Printf("[SpeculativeRouter] Keeping %d fallback providers alive for mid-stream switching",
		len(candidates)-1)

	// Step 5: Create stream merger for seamless delivery with fallback
	merger := NewStreamMerger(ctx, winner, candidates)
	mergedTokenChan, mergedErrChan := merger.Start()

	// Step 6: Calculate initial metadata
	firstTokenLatency := winner.FirstTokenAt.Sub(raceStart)
	metadata := &SpeculativeMetadata{
		ProvidersUsed:     getCandidateIDs(candidates),
		WinnerProvider:    winner.ProviderID,
		SwitchTokenNumber: 1, // Initial selection (not a mid-stream switch)
		LatencySavedMs:    firstTokenLatency.Milliseconds(),
		RaceStartTime:     raceStart,
		FirstTokenTime:    winner.FirstTokenAt,
		StreamMerger:      merger, // Store merger for later metadata retrieval
	}

	log.Printf("[SpeculativeRouter] Winner: %s (first token after %dms)", winner.ProviderID, firstTokenLatency.Milliseconds())

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

// Helper functions

func getCandidateIDs(candidates []*ProviderCandidate) []string {
	ids := make([]string, len(candidates))
	for i, c := range candidates {
		ids[i] = c.ProviderID
	}
	return ids
}
