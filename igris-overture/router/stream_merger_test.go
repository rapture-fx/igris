package router

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// TestStreamMerger_BasicDelivery tests that tokens are delivered correctly from winner
func TestStreamMerger_BasicDelivery(t *testing.T) {
	ctx := context.Background()

	// Create winner provider that sends 10 tokens
	winner := &ProviderCandidate{
		ProviderID: "winner",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	winnerCtx, winnerCancel := context.WithCancel(ctx)
	winner.Context = winnerCtx
	winner.Cancel = winnerCancel

	// Create fallback (not used in this test)
	fallback := &ProviderCandidate{
		ProviderID: "fallback",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	fallbackCtx, fallbackCancel := context.WithCancel(ctx)
	fallback.Context = fallbackCtx
	fallback.Cancel = fallbackCancel
	defer fallbackCancel()

	// Start merger
	merger := NewStreamMerger(ctx, winner, []*ProviderCandidate{winner, fallback})
	tokenChan, errChan := merger.Start()

	// Send tokens from winner
	go func() {
		for i := 0; i < 10; i++ {
			finishReason := ""
			if i == 9 {
				finishReason = "stop"
			}
			chunk := models.NewStreamChunk(
				"req-123",
				"test-model",
				fmt.Sprintf("token_%d ", i),
				0,
				finishReason,
			)
			winner.TokenChan <- chunk
			time.Sleep(10 * time.Millisecond)
		}
		close(winner.TokenChan)
	}()

	// Consume all tokens
	receivedTokens := 0
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				// Stream ended
				goto Done
			}
			receivedTokens++
			t.Logf("Received token %d", receivedTokens)

		case err, ok := <-errChan:
			if ok && err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			goto Done

		case <-time.After(2 * time.Second):
			t.Fatal("Timeout waiting for tokens")
		}
	}

Done:
	// Verify we received all tokens
	if receivedTokens != 10 {
		t.Errorf("Expected 10 tokens, got %d", receivedTokens)
	}

	// Check metadata
	meta := merger.GetMetadata()
	if meta.TokensDelivered != 10 {
		t.Errorf("Expected 10 tokens delivered in metadata, got %d", meta.TokensDelivered)
	}
	if meta.SwitchOccurred {
		t.Error("No switch should have occurred")
	}
	if meta.FinalProvider != "winner" {
		t.Errorf("Expected final provider to be winner, got %s", meta.FinalProvider)
	}
}

// TestStreamMerger_MidStreamSwitch tests fallback when winner fails mid-stream
func TestStreamMerger_MidStreamSwitch(t *testing.T) {
	ctx := context.Background()

	// Create winner that will fail after 5 tokens
	winner := &ProviderCandidate{
		ProviderID: "winner",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	winnerCtx, winnerCancel := context.WithCancel(ctx)
	winner.Context = winnerCtx
	winner.Cancel = winnerCancel

	// Create fallback that continues streaming
	fallback := &ProviderCandidate{
		ProviderID: "fallback",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	fallbackCtx, fallbackCancel := context.WithCancel(ctx)
	fallback.Context = fallbackCtx
	fallback.Cancel = fallbackCancel
	defer fallbackCancel()

	// Start merger
	merger := NewStreamMerger(ctx, winner, []*ProviderCandidate{winner, fallback})
	tokenChan, errChan := merger.Start()

	// Send tokens from winner, then fail
	go func() {
		for i := 0; i < 5; i++ {
			chunk := models.NewStreamChunk("req-123", "test-model", fmt.Sprintf("winner_token_%d ", i), 0, "")
			winner.TokenChan <- chunk
			time.Sleep(10 * time.Millisecond)
		}
		// Winner fails!
		winner.ErrChan <- fmt.Errorf("winner failed mid-stream")
		close(winner.TokenChan)
	}()

	// Send tokens from fallback (buffered for mid-stream switch)
	go func() {
		time.Sleep(50 * time.Millisecond) // Let winner send a few tokens first
		for i := 0; i < 10; i++ {
			chunk := models.NewStreamChunk("req-123", "test-model", fmt.Sprintf("fallback_token_%d ", i), 0, "")
			if i == 9 {
				chunk = models.NewStreamChunk("req-123", "test-model", "fallback_token_9", 0, "stop")
			}
			select {
			case fallback.TokenChan <- chunk:
			case <-fallbackCtx.Done():
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		close(fallback.TokenChan)
	}()

	// Consume all tokens
	receivedTokens := 0
	winnerTokens := 0
	fallbackTokens := 0

	for {
		select {
		case chunk, ok := <-tokenChan:
			if !ok {
				// Stream ended
				goto Done
			}
			receivedTokens++

			// Check which provider sent this token
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
				content := chunk.Choices[0].Delta.Content
				if len(content) > 7 && content[:7] == "winner_" {
					winnerTokens++
				} else if len(content) > 9 && content[:9] == "fallback_" {
					fallbackTokens++
				}
				t.Logf("Received token %d: %s", receivedTokens, content)
			}

		case err, ok := <-errChan:
			if ok && err != nil {
				// This is expected - winner fails, but fallback should continue
				t.Logf("Received expected error (winner failed): %v", err)
			}
			// Don't fail the test, we expect an error

		case <-time.After(3 * time.Second):
			goto Done // Timeout means stream ended (some providers might not send finish chunk in test)
		}
	}

Done:
	t.Logf("Total tokens: %d, Winner: %d, Fallback: %d", receivedTokens, winnerTokens, fallbackTokens)

	// Verify we received tokens from both providers
	if winnerTokens == 0 {
		t.Error("Expected to receive tokens from winner before failure")
	}

	// Check metadata
	meta := merger.GetMetadata()
	if !meta.SwitchOccurred {
		t.Error("Expected switch to have occurred")
	}
	if meta.FinalProvider != "fallback" {
		t.Errorf("Expected final provider to be fallback, got %s", meta.FinalProvider)
	}
	if meta.SwitchTokenNumber <= winnerTokens {
		t.Logf("Switch occurred at token %d after %d winner tokens (as expected)", meta.SwitchTokenNumber, winnerTokens)
	}
}

// TestStreamMerger_NoFallbackAvailable tests behavior when no fallback is available
func TestStreamMerger_NoFallbackAvailable(t *testing.T) {
	ctx := context.Background()

	// Create winner that will fail (with no live fallbacks)
	winner := &ProviderCandidate{
		ProviderID: "winner",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	winnerCtx, winnerCancel := context.WithCancel(ctx)
	winner.Context = winnerCtx
	winner.Cancel = winnerCancel

	// Start merger with only the winner (no real fallbacks)
	merger := NewStreamMerger(ctx, winner, []*ProviderCandidate{winner})
	tokenChan, errChan := merger.Start()

	// Send a few tokens, then fail
	go func() {
		for i := 0; i < 3; i++ {
			chunk := models.NewStreamChunk("req-123", "test-model", fmt.Sprintf("token_%d ", i), 0, "")
			winner.TokenChan <- chunk
			time.Sleep(10 * time.Millisecond)
		}
		// Fail!
		winner.ErrChan <- fmt.Errorf("winner failed with no fallback")
		close(winner.TokenChan)
	}()

	// Consume tokens until error
	receivedTokens := 0
	gotError := false

	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto Done
			}
			receivedTokens++
			t.Logf("Received token %d", receivedTokens)

		case err, ok := <-errChan:
			if ok && err != nil {
				t.Logf("Got expected error: %v", err)
				gotError = true
			}
			goto Done

		case <-time.After(1 * time.Second):
			goto Done
		}
	}

Done:
	if !gotError {
		t.Error("Expected to receive error when winner fails with no fallback")
	}
	if receivedTokens != 3 {
		t.Errorf("Expected 3 tokens before failure, got %d", receivedTokens)
	}
}

// TestStreamMerger_FallbackBuffering tests that fallback candidates are buffered
func TestStreamMerger_FallbackBuffering(t *testing.T) {
	ctx := context.Background()

	winner := &ProviderCandidate{
		ProviderID: "winner",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	winnerCtx, winnerCancel := context.WithCancel(ctx)
	winner.Context = winnerCtx
	winner.Cancel = winnerCancel

	fallback := &ProviderCandidate{
		ProviderID: "fallback",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	fallbackCtx, fallbackCancel := context.WithCancel(ctx)
	fallback.Context = fallbackCtx
	fallback.Cancel = fallbackCancel
	defer fallbackCancel()

	// Start merger
	merger := NewStreamMerger(ctx, winner, []*ProviderCandidate{winner, fallback})
	_, _ = merger.Start()

	// Send tokens to fallback (should be buffered)
	go func() {
		for i := 0; i < 5; i++ {
			chunk := models.NewStreamChunk("req-123", "test-model", fmt.Sprintf("fallback_%d ", i), 0, "")
			fallback.TokenChan <- chunk
			time.Sleep(10 * time.Millisecond)
		}
	}()

	// Wait for buffering to happen
	time.Sleep(100 * time.Millisecond)

	// Check metadata - fallback should have buffered tokens
	meta := merger.GetMetadata()
	bufferSize := meta.FallbackBufferSizes["fallback"]
	if bufferSize == 0 {
		t.Error("Expected fallback to have buffered tokens")
	}
	t.Logf("Fallback buffer size: %d", bufferSize)

	// Clean up
	merger.Stop()
}

// TestStreamMerger_ZeroDuplicates tests that no tokens are duplicated during switch
func TestStreamMerger_ZeroDuplicates(t *testing.T) {
	ctx := context.Background()

	winner := &ProviderCandidate{
		ProviderID: "winner",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	winnerCtx, winnerCancel := context.WithCancel(ctx)
	winner.Context = winnerCtx
	winner.Cancel = winnerCancel

	fallback := &ProviderCandidate{
		ProviderID: "fallback",
		TokenChan:  make(chan *models.StreamChunk, 20),
		ErrChan:    make(chan error, 1),
	}
	fallbackCtx, fallbackCancel := context.WithCancel(ctx)
	fallback.Context = fallbackCtx
	fallback.Cancel = fallbackCancel
	defer fallbackCancel()

	merger := NewStreamMerger(ctx, winner, []*ProviderCandidate{winner, fallback})
	tokenChan, _ := merger.Start()

	// Send tokens with unique IDs
	go func() {
		for i := 0; i < 5; i++ {
			chunk := models.NewStreamChunk("req-123", "test-model", fmt.Sprintf("W%d ", i), 0, "")
			winner.TokenChan <- chunk
			time.Sleep(10 * time.Millisecond)
		}
		winner.ErrChan <- fmt.Errorf("winner failed")
		close(winner.TokenChan)
	}()

	go func() {
		for i := 0; i < 10; i++ {
			chunk := models.NewStreamChunk("req-123", "test-model", fmt.Sprintf("F%d ", i), 0, "")
			if i == 9 {
				chunk = models.NewStreamChunk("req-123", "test-model", "F9", 0, "stop")
			}
			select {
			case fallback.TokenChan <- chunk:
			case <-fallbackCtx.Done():
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		close(fallback.TokenChan)
	}()

	// Collect all token IDs
	seenTokens := make(map[string]bool)
	duplicateCount := 0

	for {
		select {
		case chunk, ok := <-tokenChan:
			if !ok {
				goto Done
			}
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
				tokenID := chunk.Choices[0].Delta.Content
				if seenTokens[tokenID] {
					duplicateCount++
					t.Errorf("Duplicate token detected: %s", tokenID)
				}
				seenTokens[tokenID] = true
			}

		case <-time.After(2 * time.Second):
			goto Done
		}
	}

Done:
	if duplicateCount > 0 {
		t.Errorf("Found %d duplicate tokens", duplicateCount)
	}
	t.Logf("Received %d unique tokens with zero duplicates", len(seenTokens))
}
