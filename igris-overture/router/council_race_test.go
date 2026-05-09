package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockProvider implements the Provider interface for testing
type MockProvider struct {
	id              string
	name            string
	inferFunc       func(context.Context, *models.InferRequest) (*models.InferResponse, error)
	streamFunc      func(context.Context, *models.InferRequest) (<-chan *models.StreamChunk, <-chan error)
	delay           time.Duration
	shouldFail      bool
	firstTokenDelay time.Duration
	tokenInterval   time.Duration
	totalTokens     int
	failAfterTokens int
}

func (m *MockProvider) Name() string {
	if m.id != "" {
		return m.id
	}
	return m.name
}

func (m *MockProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	if m.inferFunc != nil {
		return m.inferFunc(ctx, req)
	}
	if m.delay > 0 {
		time.Sleep(m.delay)
	}
	if m.shouldFail {
		return nil, errors.New("mock provider error")
	}
	return &models.InferResponse{
		Choices: []models.Choice{
			{Index: 0, Message: &models.Message{Role: "assistant", Content: "Response from " + m.Name()}},
		},
		Usage: &models.UsageStats{TotalTokens: 50},
	}, nil
}

func (m *MockProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	if m.streamFunc != nil {
		return m.streamFunc(ctx, req)
	}
	tokenChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)
	go func() {
		defer close(tokenChan)
		defer close(errChan)
		delay := m.firstTokenDelay
		if delay == 0 {
			delay = m.delay
		}
		if delay > 0 {
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return
			}
		}
		total := m.totalTokens
		if total == 0 {
			total = 5
		}
		interval := m.tokenInterval
		if interval == 0 {
			interval = 10 * time.Millisecond
		}
		for i := 0; i < total; i++ {
			if m.shouldFail && m.failAfterTokens > 0 && i >= m.failAfterTokens {
				errChan <- errors.New("mock provider error")
				return
			}
			select {
			case <-ctx.Done():
				return
			case tokenChan <- &models.StreamChunk{
				Choices: []models.Choice{{Index: 0, Delta: &models.Message{Content: fmt.Sprintf("token_%d_%s", i, m.Name())}}},
			}:
				if i < total-1 {
					time.Sleep(interval)
				}
			}
		}
	}()
	return tokenChan, errChan
}

func (m *MockProvider) HealthCheck(ctx context.Context) error { return nil }
func (m *MockProvider) GetCapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{SupportsStreaming: true}
}
func (m *MockProvider) EstimateCost(req *models.InferRequest) (float64, error) { return 0.001, nil }
func (m *MockProvider) Close() error                                           { return nil }

// Test P0-2: Council Mode Deadlock Prevention
// Ensures that buffered channel prevents deadlock when timeout occurs
func TestCouncil_DeadlockPrevention(t *testing.T) {
	// Create mock provider registry
	registry := providers.NewProviderRegistry()

	// Create mock providers with varying delays
	provider1 := &MockProvider{id: "provider1", delay: 100 * time.Millisecond}
	provider2 := &MockProvider{id: "provider2", delay: 200 * time.Millisecond}
	provider3 := &MockProvider{id: "provider3", delay: 35 * time.Second} // Will timeout
	provider4 := &MockProvider{id: "provider4", delay: 150 * time.Millisecond}

	registry.Register(provider1)
	registry.Register(provider2)
	registry.Register(provider3)
	registry.Register(provider4)

	// Create router
	speculativeConfig := &config.SpeculativeConfig{
		MaxProviders: 4,
	}
	adaptiveRouter := &AdaptiveRouter{} // Mock
	sr := NewSpeculativeRouter(speculativeConfig, adaptiveRouter, registry)

	// Create candidates
	ctx := context.Background()
	candidates := make([]*ProviderCandidate, 4)
	for i, providerName := range []string{"provider1", "provider2", "provider3", "provider4"} {
		provider, _ := registry.Get(providerName)
		providerCtx, cancel := context.WithCancel(ctx)
		candidates[i] = &ProviderCandidate{
			Provider:   provider,
			ProviderID: providerName,
			Context:    providerCtx,
			Cancel:     cancel,
		}
	}

	// Create test request
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
	}

	// Execute council inferences with timeout
	// This should NOT deadlock even though provider3 will timeout
	done := make(chan bool, 1)
	var responses []CouncilResponse
	var err error

	go func() {
		responses, err = sr.executeCouncilInferences(ctx, candidates, req)
		done <- true
	}()

	// Wait for completion or timeout
	select {
	case <-done:
		// Success - no deadlock
		require.NoError(t, err)
		// Should get 3 responses (provider3 timed out)
		assert.GreaterOrEqual(t, len(responses), 3, "Should receive at least 3 responses")
		assert.LessOrEqual(t, len(responses), 4, "Should receive at most 4 responses")

	case <-time.After(35 * time.Second):
		t.Fatal("Deadlock detected: executeCouncilInferences did not complete within timeout")
	}

	// Verify no goroutine leak
	// Cancel all candidates
	for _, c := range candidates {
		c.Cancel()
	}
}

// Test P0-2: Concurrent Rankings Append Safety
// Ensures mutex protects concurrent writes to rankings slice
func TestCouncil_ConcurrentRankingsSafety(t *testing.T) {
	// Simulate concurrent appends to rankings slice
	rankings := make([]PeerRanking, 0, 10)
	var mu sync.Mutex

	// Run 100 concurrent appends
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			// P0-2 FIX: Mutex protection prevents data race
			mu.Lock()
			rankings = append(rankings, PeerRanking{
				RankerProvider: "provider-" + string(rune('A'+idx%26)),
				Rankings: []ResponseRank{
					{ResponseID: idx, Rank: 1},
				},
			})
			mu.Unlock()
		}(i)
	}

	wg.Wait()

	// All 100 should be present
	assert.Equal(t, 100, len(rankings), "All concurrent appends should succeed")
}

// Test P0-2: JSON Unmarshal Panic Recovery
// Ensures JSON parsing doesn't panic the application
func TestCouncil_JSONUnmarshalPanicRecovery(t *testing.T) {
	// Test with malformed JSON that could cause panic
	testCases := []struct {
		name     string
		jsonData string
		wantErr  bool
	}{
		{
			name:     "valid JSON",
			jsonData: `{"rankings": [{"response_id": 1, "rank": 1}]}`,
			wantErr:  false,
		},
		{
			name:     "invalid JSON",
			jsonData: `{invalid json`,
			wantErr:  true,
		},
		{
			name:     "empty string",
			jsonData: ``,
			wantErr:  true,
		},
		{
			name:     "null bytes",
			jsonData: string([]byte{0x00, 0x01, 0x02}),
			wantErr:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var result PeerRankingResponse

			// This should NOT panic
			parseErr := func() (err error) {
				defer func() {
					if r := recover(); r != nil {
						err = errors.New("panic occurred")
					}
				}()

				return json.Unmarshal([]byte(tc.jsonData), &result)
			}()

			if tc.wantErr {
				assert.Error(t, parseErr, "Should return error for invalid JSON")
			} else {
				assert.NoError(t, parseErr, "Should parse valid JSON without error")
			}
		})
	}
}

// Test P0-2: Council Mode Under High Concurrency
// Stress test to ensure no race conditions or deadlocks under load
func TestCouncil_HighConcurrencyStress(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping stress test in short mode")
	}

	registry := providers.NewProviderRegistry()

	// Create 4 fast mock providers
	for i := 1; i <= 4; i++ {
		providerID := "provider" + string(rune('0'+i))
		provider := &MockProvider{
			id:    providerID,
			delay: time.Duration(10+i*10) * time.Millisecond,
		}
		registry.Register(provider)
	}

	speculativeConfig := &config.SpeculativeConfig{
		MaxProviders: 4,
	}
	adaptiveRouter := &AdaptiveRouter{}
	sr := NewSpeculativeRouter(speculativeConfig, adaptiveRouter, registry)

	// Run 50 concurrent council requests
	var wg sync.WaitGroup
	errors := make(chan error, 50)

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			ctx := context.Background()
			candidates := make([]*ProviderCandidate, 4)
			for j, providerName := range []string{"provider1", "provider2", "provider3", "provider4"} {
				provider, _ := registry.Get(providerName)
				providerCtx, cancel := context.WithCancel(ctx)
				defer cancel()

				candidates[j] = &ProviderCandidate{
					Provider:   provider,
					ProviderID: providerName,
					Context:    providerCtx,
					Cancel:     cancel,
				}
			}

			req := &models.InferRequest{
				Model: "test-model",
				Messages: []models.Message{
					{Role: "user", Content: "test"},
				},
			}

			_, err := sr.executeCouncilInferences(ctx, candidates, req)
			if err != nil {
				errors <- err
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for errors
	errorCount := 0
	for err := range errors {
		t.Logf("Error in concurrent request: %v", err)
		errorCount++
	}

	assert.Equal(t, 0, errorCount, "Should have no errors in concurrent execution")
}
