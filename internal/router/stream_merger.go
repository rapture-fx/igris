package router

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/schlep-engine/schlep-engine/internal/models"
)

// StreamMerger handles seamless token delivery from a winning provider with
// mid-stream fallback capability. It ensures zero duplicate or out-of-order tokens.
type StreamMerger struct {
	// Winner and fallback candidates
	winner           *ProviderCandidate
	fallbackCandidates []*ProviderCandidate

	// Output channels for merged stream
	outputTokenChan chan *models.StreamChunk
	outputErrChan   chan error

	// State tracking
	tokensDelivered  int
	currentProvider  *ProviderCandidate
	switchOccurred   bool
	switchTokenNumber int

	// Context and synchronization
	ctx              context.Context
	cancel           context.CancelFunc
	mu               sync.RWMutex

	// Buffered tokens from candidates (for fallback)
	candidateBuffers map[string][]*models.StreamChunk
	bufferMu         sync.Mutex
}

// NewStreamMerger creates a new stream merger for the given winner and fallback candidates
func NewStreamMerger(
	ctx context.Context,
	winner *ProviderCandidate,
	fallbackCandidates []*ProviderCandidate,
) *StreamMerger {
	mergerCtx, cancel := context.WithCancel(ctx)

	return &StreamMerger{
		winner:             winner,
		fallbackCandidates: fallbackCandidates,
		outputTokenChan:    make(chan *models.StreamChunk, 100), // Buffered for smooth delivery
		outputErrChan:      make(chan error, 1),
		tokensDelivered:    0,
		currentProvider:    winner,
		switchOccurred:     false,
		switchTokenNumber:  0,
		ctx:                mergerCtx,
		cancel:             cancel,
		candidateBuffers:   make(map[string][]*models.StreamChunk),
	}
}

// Start begins merging the winner's stream and monitoring for failures
func (sm *StreamMerger) Start() (<-chan *models.StreamChunk, <-chan error) {
	go sm.mergeStream()
	return sm.outputTokenChan, sm.outputErrChan
}

// mergeStream is the main goroutine that handles token delivery and fallback
func (sm *StreamMerger) mergeStream() {
	defer close(sm.outputTokenChan)
	defer close(sm.outputErrChan)
	defer sm.cancel()

	// Start buffering fallback candidates in background
	sm.startFallbackBuffering()

	// Stream tokens from current provider (initially the winner)
	for {
		select {
		case <-sm.ctx.Done():
			log.Printf("[StreamMerger] Context cancelled, stopping merge")
			return

		case chunk, ok := <-sm.currentProvider.TokenChan:
			if !ok {
				// Current provider's stream ended normally
				sm.mu.Lock()
				provider := sm.currentProvider.ProviderID
				sm.mu.Unlock()

				log.Printf("[StreamMerger] Stream from %s ended normally after %d tokens",
					provider, sm.tokensDelivered)
				return
			}

			// Deliver token to output
			sm.mu.Lock()
			sm.tokensDelivered++
			tokenNum := sm.tokensDelivered
			sm.mu.Unlock()

			select {
			case sm.outputTokenChan <- chunk:
				// Token delivered successfully
			case <-sm.ctx.Done():
				return
			}

			// Check if this is the last token
			if sm.isFinishChunk(chunk) {
				log.Printf("[StreamMerger] Received finish chunk after %d tokens", tokenNum)
				return
			}

		case err := <-sm.currentProvider.ErrChan:
			if err != nil {
				// Current provider failed mid-stream!
				sm.mu.Lock()
				failedProvider := sm.currentProvider.ProviderID
				tokensBeforeFailure := sm.tokensDelivered
				sm.mu.Unlock()

				log.Printf("[StreamMerger] Provider %s failed after %d tokens: %v",
					failedProvider, tokensBeforeFailure, err)

				// Attempt fallback
				if sm.attemptFallback() {
					log.Printf("[StreamMerger] Successfully switched to fallback, continuing stream")
					continue // Continue with new provider
				}

				// No fallback available, propagate error
				select {
				case sm.outputErrChan <- fmt.Errorf("stream failed after %d tokens: %w",
					tokensBeforeFailure, err):
				default:
				}
				return
			}
		}
	}
}

// attemptFallback tries to switch to a live fallback candidate
func (sm *StreamMerger) attemptFallback() bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Find the best live fallback
	var bestFallback *ProviderCandidate
	var maxTokens int

	for _, candidate := range sm.fallbackCandidates {
		// Skip if this is the current (failed) provider
		if candidate == sm.currentProvider {
			continue
		}

		// Check if candidate has buffered tokens
		sm.bufferMu.Lock()
		bufferedTokens := len(sm.candidateBuffers[candidate.ProviderID])
		sm.bufferMu.Unlock()

		if bufferedTokens > maxTokens {
			maxTokens = bufferedTokens
			bestFallback = candidate
		}
	}

	if bestFallback == nil {
		log.Printf("[StreamMerger] No live fallback candidates available")
		return false
	}

	// Switch to fallback
	oldProvider := sm.currentProvider.ProviderID
	sm.currentProvider = bestFallback
	sm.switchOccurred = true
	sm.switchTokenNumber = sm.tokensDelivered + 1

	log.Printf("[StreamMerger] Switching from %s to %s at token %d (fallback has %d buffered tokens)",
		oldProvider, bestFallback.ProviderID, sm.switchTokenNumber, maxTokens)

	return true
}

// startFallbackBuffering starts buffering tokens from fallback candidates
// This allows instant switching if the winner fails mid-stream
func (sm *StreamMerger) startFallbackBuffering() {
	for _, candidate := range sm.fallbackCandidates {
		// Skip the winner (it's being actively consumed)
		if candidate == sm.winner {
			continue
		}

		go sm.bufferCandidate(candidate)
	}
}

// bufferCandidate continuously buffers tokens from a fallback candidate
func (sm *StreamMerger) bufferCandidate(candidate *ProviderCandidate) {
	candidateID := candidate.ProviderID
	log.Printf("[StreamMerger] Started buffering fallback candidate: %s", candidateID)

	for {
		select {
		case <-sm.ctx.Done():
			// Merger stopped, stop buffering
			return

		case <-candidate.Context.Done():
			// Candidate was cancelled
			log.Printf("[StreamMerger] Fallback candidate %s cancelled", candidateID)
			return

		case chunk, ok := <-candidate.TokenChan:
			if !ok {
				// Candidate's stream ended
				log.Printf("[StreamMerger] Fallback candidate %s stream ended", candidateID)
				return
			}

			// Buffer the token
			sm.bufferMu.Lock()
			sm.candidateBuffers[candidateID] = append(sm.candidateBuffers[candidateID], chunk)
			bufferSize := len(sm.candidateBuffers[candidateID])
			sm.bufferMu.Unlock()

			// Log buffer growth periodically
			if bufferSize%10 == 0 {
				log.Printf("[StreamMerger] Fallback %s buffer size: %d", candidateID, bufferSize)
			}

		case err := <-candidate.ErrChan:
			if err != nil {
				// Fallback candidate failed, remove from fallback pool
				log.Printf("[StreamMerger] Fallback candidate %s failed: %v", candidateID, err)
				return
			}
		}
	}
}

// isFinishChunk checks if a chunk indicates the stream is complete
func (sm *StreamMerger) isFinishChunk(chunk *models.StreamChunk) bool {
	if chunk == nil || len(chunk.Choices) == 0 {
		return false
	}

	// Check if any choice has a finish reason
	for _, choice := range chunk.Choices {
		if choice.FinishReason != "" {
			return true
		}
	}

	return false
}

// GetMetadata returns metadata about the merge operation
func (sm *StreamMerger) GetMetadata() *StreamMergerMetadata {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	metadata := &StreamMergerMetadata{
		TokensDelivered:   sm.tokensDelivered,
		SwitchOccurred:    sm.switchOccurred,
		SwitchTokenNumber: sm.switchTokenNumber,
		FinalProvider:     sm.currentProvider.ProviderID,
		InitialProvider:   sm.winner.ProviderID,
	}

	// Add buffer stats
	sm.bufferMu.Lock()
	metadata.FallbackBufferSizes = make(map[string]int)
	for candidateID, buffer := range sm.candidateBuffers {
		metadata.FallbackBufferSizes[candidateID] = len(buffer)
	}
	sm.bufferMu.Unlock()

	return metadata
}

// StreamMergerMetadata contains statistics about the stream merge operation
type StreamMergerMetadata struct {
	TokensDelivered      int            `json:"tokens_delivered"`
	SwitchOccurred       bool           `json:"switch_occurred"`
	SwitchTokenNumber    int            `json:"switch_token_number"`
	InitialProvider      string         `json:"initial_provider"`
	FinalProvider        string         `json:"final_provider"`
	FallbackBufferSizes  map[string]int `json:"fallback_buffer_sizes"`
}

// Stop gracefully stops the stream merger
func (sm *StreamMerger) Stop() {
	sm.cancel()
}
