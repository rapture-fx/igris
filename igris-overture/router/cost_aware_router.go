package router

import (
	"context"
	"fmt"
	"sync"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/policies"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// CostAwareRouter implements cost-based routing decisions
type CostAwareRouter struct {
	policyEngine    *policies.PolicyEngine
	costMap         *config.CostMapConfig
	adapterRegistry *providers.AdapterRegistry
	providerLatency map[string]float64 // Provider -> avg latency ms
	mu              sync.RWMutex
}

// NewCostAwareRouter creates a new cost-aware router
func NewCostAwareRouter() (*CostAwareRouter, error) {
	costMap, err := config.LoadCostMapFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to load cost map: %w", err)
	}

	return &CostAwareRouter{
		policyEngine:    policies.NewPolicyEngine(),
		costMap:         costMap,
		adapterRegistry: providers.NewAdapterRegistry(),
		providerLatency: make(map[string]float64),
	}, nil
}

// RouteRequest routes a request to the best provider based on cost and policy
func (r *CostAwareRouter) RouteRequest(ctx context.Context, tenantID string, estimatedCost float64, inputTokens, outputTokens int) (*RoutingResult, error) {
	// Get available providers from cost map
	availableProviders := r.costMap.ListProviders()

	// Evaluate policy
	decision := r.policyEngine.Evaluate(tenantID, estimatedCost, availableProviders)

	// Calculate per-provider costs
	providerCosts := r.calculateProviderCosts(decision.AllowedProviders, inputTokens, outputTokens)

	// Get provider latencies
	r.mu.RLock()
	providerLatencies := make(map[string]float64)
	for provider, latency := range r.providerLatency {
		providerLatencies[provider] = latency
	}
	r.mu.RUnlock()

	// Select best provider
	selectedProvider := policies.SelectProvider(decision, providerCosts, providerLatencies)

	// Fallback if no provider selected
	if selectedProvider == "" {
		selectedProvider = r.selectFallbackProvider(availableProviders, estimatedCost)
	}

	result := &RoutingResult{
		Provider:         selectedProvider,
		EstimatedCost:    estimatedCost,
		PolicyMatched:    decision.PolicyMatched,
		Preference:       decision.Preference,
		Reason:           decision.Reason,
		AllowedProviders: decision.AllowedProviders,
	}

	// Record telemetry
	r.recordRoutingDecision(result)

	return result, nil
}

// RoutingResult contains the routing decision
type RoutingResult struct {
	Provider         string
	EstimatedCost    float64
	PolicyMatched    bool
	Preference       string
	Reason           string
	AllowedProviders []string
}

// calculateProviderCosts calculates cost for each provider
func (r *CostAwareRouter) calculateProviderCosts(providers []string, inputTokens, outputTokens int) map[string]float64 {
	costs := make(map[string]float64)

	for _, provider := range providers {
		// Use first available model for the provider
		models := r.costMap.ListModels(provider)
		if len(models) > 0 {
			model := models[0]
			if model != "default" {
				cost, err := r.costMap.EstimateCost(provider, model, inputTokens, outputTokens)
				if err == nil {
					costs[provider] = cost
				}
			}
		}
	}

	return costs
}

// selectFallbackProvider selects fallback when policy doesn't match
func (r *CostAwareRouter) selectFallbackProvider(providers []string, maxCost float64) string {
	// Try providers in order, skip if cost exceeds limit
	for _, provider := range providers {
		if provider == "benchmark-openai" || provider == "benchmark-anthropic" {
			continue // Skip benchmark providers
		}
		return provider
	}

	// Default to first provider if all else fails
	if len(providers) > 0 {
		return providers[0]
	}

	return "openai" // Hard fallback
}

// recordRoutingDecision records telemetry for routing decision
func (r *CostAwareRouter) recordRoutingDecision(result *RoutingResult) {
	strategy := "default"
	if result.PolicyMatched {
		strategy = "policy_based"
	}

	// Record policy-based routing decision
	observability.RecordPolicyRouteDecision(result.Provider, strategy, result.Preference)

	// If we fell back due to cost, record it
	if !result.PolicyMatched && result.EstimatedCost > 0 {
		observability.RecordCostBasedFallback(result.Provider)
	}
}

// UpdateProviderLatency updates average latency for a provider
func (r *CostAwareRouter) UpdateProviderLatency(provider string, latencyMs float64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Simple moving average (could be enhanced with exponential moving average)
	if current, exists := r.providerLatency[provider]; exists {
		r.providerLatency[provider] = (current + latencyMs) / 2
	} else {
		r.providerLatency[provider] = latencyMs
	}
}

// LoadPolicy loads a policy for a tenant
func (r *CostAwareRouter) LoadPolicy(tenantID, yamlContent string) error {
	_, err := r.policyEngine.LoadPolicyFromString(tenantID, yamlContent)
	return err
}

// GetPolicy retrieves a tenant's policy
func (r *CostAwareRouter) GetPolicy(tenantID string) (*policies.TenantPolicy, bool) {
	return r.policyEngine.GetPolicy(tenantID)
}
