package escapevector

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// InferRequest matches the main SDK's InferRequest
type InferRequest struct {
	Model       string          `json:"model"`
	Messages    []Message       `json:"messages"`
	MaxTokens   *int            `json:"max_tokens,omitempty"`
	Temperature *float64        `json:"temperature,omitempty"`
	TopP        *float64        `json:"top_p,omitempty"`
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// InferResponse matches the main SDK's InferResponse
type InferResponse struct {
	ID      string   `json:"id,omitempty"`
	Object  string   `json:"object,omitempty"`
	Created int64    `json:"created,omitempty"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}

// Choice represents a single response choice
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason,omitempty"`
}

// Usage represents token usage
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// CircuitBreaker tracks provider health with atomic operations (reuses P0-7 pattern)
type CircuitBreaker struct {
	failures   atomic.Int32
	threshold  int32
	isOpen     atomic.Bool
	lastOpened time.Time
	mu         sync.Mutex
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(threshold int) *CircuitBreaker {
	return &CircuitBreaker{
		threshold: int32(threshold),
	}
}

// RecordSuccess resets the circuit breaker
func (cb *CircuitBreaker) RecordSuccess() {
	cb.failures.Store(0)
	cb.isOpen.Store(false)
}

// RecordFailure increments failure count
func (cb *CircuitBreaker) RecordFailure() {
	failures := cb.failures.Add(1)
	if failures >= cb.threshold {
		cb.mu.Lock()
		cb.isOpen.Store(true)
		cb.lastOpened = time.Now()
		cb.mu.Unlock()
	}
}

// IsOpen returns true if circuit is open (provider unhealthy)
func (cb *CircuitBreaker) IsOpen() bool {
	// Auto-reset after 30 seconds
	if cb.isOpen.Load() {
		cb.mu.Lock()
		if time.Since(cb.lastOpened) > 30*time.Second {
			cb.isOpen.Store(false)
			cb.failures.Store(0)
		}
		cb.mu.Unlock()
	}
	return cb.isOpen.Load()
}

// ThompsonRouter implements Thompson Sampling-powered fallback routing
type ThompsonRouter struct {
	state           *BayesianState
	httpClient      *http.Client
	circuitBreakers map[string]*CircuitBreaker
	mu              sync.RWMutex
}

// NewThompsonRouter creates a new Thompson Sampling router
func NewThompsonRouter(state *BayesianState) *ThompsonRouter {
	circuitBreakers := make(map[string]*CircuitBreaker)
	for _, arm := range state.Arms {
		circuitBreakers[arm.ProviderID] = NewCircuitBreaker(state.CircuitBreakerThreshold)
	}

	timeout := time.Duration(state.TimeoutMS) * time.Millisecond
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &ThompsonRouter{
		state: state,
		httpClient: &http.Client{
			Timeout: timeout,
		},
		circuitBreakers: circuitBreakers,
	}
}

// Infer performs inference using Thompson Sampling
func (tr *ThompsonRouter) Infer(ctx context.Context, req *InferRequest) (*InferResponse, error) {
	startTime := time.Now()

	// Try speculative execution if enabled
	if tr.state.SpeculativeExecution {
		return tr.speculativeInfer(ctx, req, startTime)
	}

	// Standard Thompson Sampling with retries
	maxRetries := tr.state.MaxRetries
	if maxRetries == 0 {
		maxRetries = 2
	}

	var lastErr error
	for retry := 0; retry <= maxRetries; retry++ {
		arm := tr.selectArmThompsonSampling()
		if arm == nil {
			return nil, fmt.Errorf("no healthy providers available")
		}

		resp, latencyMS, err := tr.inferWithArm(ctx, arm, req)
		if err == nil {
			// Success - update local Bayesian state
			tr.updateArmSuccess(arm, latencyMS)
			tr.circuitBreakers[arm.ProviderID].RecordSuccess()
			return resp, nil
		}

		// Failure - update local Bayesian state
		tr.updateArmFailure(arm, latencyMS)
		tr.circuitBreakers[arm.ProviderID].RecordFailure()
		lastErr = err

		// Exponential backoff
		if retry < maxRetries {
			backoff := time.Duration(100*(1<<retry)) * time.Millisecond
			time.Sleep(backoff)
		}
	}

	return nil, fmt.Errorf("all providers failed after %d retries: %w", maxRetries, lastErr)
}

// selectArmThompsonSampling performs Thompson Sampling to select provider
func (tr *ThompsonRouter) selectArmThompsonSampling() *BanditArm {
	tr.mu.RLock()
	defer tr.mu.RUnlock()

	// Get healthy arms
	healthyArms := tr.getHealthyArms()
	if len(healthyArms) == 0 {
		return nil
	}

	// Exploration with probability ε
	if shouldExplore(tr.state.ExplorationRate) {
		idx := int(time.Now().UnixNano()) % len(healthyArms)
		return healthyArms[idx]
	}

	// Exploitation: Thompson Sampling - sample from Beta(α, β) for each arm
	var bestArm *BanditArm
	maxSample := -1.0

	for _, arm := range healthyArms {
		sample := arm.SampleBeta()
		if sample > maxSample {
			maxSample = sample
			bestArm = arm
		}
	}

	return bestArm
}

// speculativeInfer races multiple providers with Bayesian winner selection
func (tr *ThompsonRouter) speculativeInfer(ctx context.Context, req *InferRequest, startTime time.Time) (*InferResponse, error) {
	// Get top 3 arms by expected value
	arms := tr.getTopArmsByMean(3)
	if len(arms) == 0 {
		return nil, fmt.Errorf("no healthy providers for speculative execution")
	}

	// Create context with cancellation
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Channel for results
	type result struct {
		resp      *InferResponse
		latencyMS int64
		err       error
		armID     string
	}
	results := make(chan result, len(arms))

	// Launch parallel requests
	for _, arm := range arms {
		go func(a *BanditArm) {
			resp, latency, err := tr.inferWithArm(ctx, a, req)
			results <- result{resp: resp, latencyMS: latency, err: err, armID: a.ProviderID}
		}(arm)
	}

	// Return first successful result
	var lastErr error
	for i := 0; i < len(arms); i++ {
		res := <-results
		if res.err == nil {
			cancel() // Cancel other requests
			// Update the winner
			for _, arm := range arms {
				if arm.ProviderID == res.armID {
					tr.updateArmSuccess(arm, res.latencyMS)
					tr.circuitBreakers[arm.ProviderID].RecordSuccess()
				}
			}
			return res.resp, nil
		}

		// Update failure
		for _, arm := range arms {
			if arm.ProviderID == res.armID {
				tr.updateArmFailure(arm, res.latencyMS)
				tr.circuitBreakers[arm.ProviderID].RecordFailure()
			}
		}
		lastErr = res.err
	}

	return nil, fmt.Errorf("all speculative requests failed: %w", lastErr)
}

// inferWithArm makes an inference request to a specific arm
func (tr *ThompsonRouter) inferWithArm(ctx context.Context, arm *BanditArm, req *InferRequest) (*InferResponse, int64, error) {
	startTime := time.Now()

	// Provider-specific endpoint formatting
	endpoint := arm.Endpoint + "/chat/completions"

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(jsonData))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if arm.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+arm.APIKey)
	}

	resp, err := tr.httpClient.Do(httpReq)
	latencyMS := time.Since(startTime).Milliseconds()

	if err != nil {
		return nil, latencyMS, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, latencyMS, fmt.Errorf("provider returned error %d: %s", resp.StatusCode, string(body))
	}

	var result InferResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, latencyMS, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, latencyMS, nil
}

// updateArmSuccess updates arm's Bayesian parameters on success
func (tr *ThompsonRouter) updateArmSuccess(arm *BanditArm, latencyMS int64) {
	tr.mu.Lock()
	defer tr.mu.Unlock()

	// Update Thompson Sampling parameters
	arm.Alpha += 1.0
	arm.TotalSelections++
	arm.TotalSuccesses++

	// Update composite reward components
	latencyScore := tr.normalizeLatency(float64(latencyMS))
	arm.AvgLatencyScore = updateMovingAverage(arm.AvgLatencyScore, latencyScore, arm.TotalSelections)
	arm.AvgSuccessRate = float64(arm.TotalSuccesses) / float64(arm.TotalSelections)

	arm.UpdatedAt = time.Now().Unix()
}

// updateArmFailure updates arm's Bayesian parameters on failure
func (tr *ThompsonRouter) updateArmFailure(arm *BanditArm, latencyMS int64) {
	tr.mu.Lock()
	defer tr.mu.Unlock()

	// Update Thompson Sampling parameters
	arm.Beta += 1.0
	arm.TotalSelections++
	arm.TotalFailures++

	// Update latency score even on failure
	latencyScore := tr.normalizeLatency(float64(latencyMS))
	arm.AvgLatencyScore = updateMovingAverage(arm.AvgLatencyScore, latencyScore, arm.TotalSelections)
	arm.AvgSuccessRate = float64(arm.TotalSuccesses) / float64(arm.TotalSelections)

	arm.UpdatedAt = time.Now().Unix()
}

// normalizeLatency converts latency to 0-1 score (lower = better)
func (tr *ThompsonRouter) normalizeLatency(latencyMS float64) float64 {
	if latencyMS <= 0 {
		return 1.0
	}
	score := 1.0 - (latencyMS / tr.state.MaxLatencyMS)
	if score < 0 {
		return 0.0
	}
	if score > 1 {
		return 1.0
	}
	return score
}

// updateMovingAverage calculates exponential moving average
func updateMovingAverage(current, newValue float64, count int) float64 {
	if count == 1 {
		return newValue
	}
	alpha := 2.0 / float64(count+1) // EMA smoothing factor
	return alpha*newValue + (1-alpha)*current
}

// getHealthyArms returns arms with open circuit breakers filtered out
func (tr *ThompsonRouter) getHealthyArms() []*BanditArm {
	healthy := []*BanditArm{}
	for i := range tr.state.Arms {
		arm := &tr.state.Arms[i]
		cb := tr.circuitBreakers[arm.ProviderID]
		if cb != nil && !cb.IsOpen() {
			healthy = append(healthy, arm)
		}
	}
	return healthy
}

// getTopArmsByMean returns top N arms sorted by expected value
func (tr *ThompsonRouter) getTopArmsByMean(n int) []*BanditArm {
	healthy := tr.getHealthyArms()
	if len(healthy) == 0 {
		return nil
	}

	// Sort by expected value (mean of Beta distribution)
	for i := 0; i < len(healthy)-1; i++ {
		for j := i + 1; j < len(healthy); j++ {
			if healthy[i].GetMean() < healthy[j].GetMean() {
				healthy[i], healthy[j] = healthy[j], healthy[i]
			}
		}
	}

	if len(healthy) > n {
		return healthy[:n]
	}
	return healthy
}

// UpdateState updates the Bayesian state (called when control plane returns)
func (tr *ThompsonRouter) UpdateState(state *BayesianState) {
	tr.mu.Lock()
	defer tr.mu.Unlock()

	tr.state = state

	// Update circuit breakers for new arms
	for _, arm := range state.Arms {
		if _, exists := tr.circuitBreakers[arm.ProviderID]; !exists {
			tr.circuitBreakers[arm.ProviderID] = NewCircuitBreaker(state.CircuitBreakerThreshold)
		}
	}
}

// GetState returns current Bayesian state for caching
func (tr *ThompsonRouter) GetState() *BayesianState {
	tr.mu.RLock()
	defer tr.mu.RUnlock()
	return tr.state
}

// shouldExplore returns true with probability ε
func shouldExplore(explorationRate float64) bool {
	nanos := time.Now().UnixNano()
	random := float64(nanos%10000) / 10000.0
	return random < explorationRate
}
