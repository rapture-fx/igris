// Package routing provides intelligent provider selection and routing logic
package routing

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/Igris-inertial/system/igris-overture/circuitbreaker"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/repository"
)

// SelectionReason describes why a provider was selected
type SelectionReason string

const (
	SelectionReasonHealth     SelectionReason = "health"      // Best health score
	SelectionReasonPreference SelectionReason = "preference"  // User preference
	SelectionReasonFallback   SelectionReason = "fallback"    // Fallback after failure
	SelectionReasonRandom     SelectionReason = "random"      // Random selection
	SelectionReasonDefault    SelectionReason = "default"     // Default provider
)

// ProviderCandidate represents a provider that can handle a request
type ProviderCandidate struct {
	Provider      *models.ProviderRegistry
	HealthScore   float64
	SelectionRank int // 0 = highest priority
}

// ProviderSelector handles intelligent provider selection
type ProviderSelector struct {
	repo            repository.ProviderRegistryRepository
	logger          *log.Logger
	circuitBreakers *circuitbreaker.ProviderCircuitBreakers
}

// NewProviderSelector creates a new provider selector
func NewProviderSelector(repo repository.ProviderRegistryRepository) *ProviderSelector {
	// Initialize circuit breakers with 3 failures threshold and 2 minute recovery
	cbConfig := circuitbreaker.Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * 60 * 1000 * 1000 * 1000, // 2 minutes in nanoseconds
	}

	return &ProviderSelector{
		repo:            repo,
		logger:          log.Default(),
		circuitBreakers: circuitbreaker.NewProviderCircuitBreakers(cbConfig),
	}
}

// SelectionCriteria defines the criteria for provider selection
type SelectionCriteria struct {
	TenantID           string
	Model              string
	ProviderPreference []string // Ordered list of preferred provider names
	MinUptimePercent   float64  // Minimum uptime percentage (default: 80%)
	MaxLatencyMs       int      // Maximum acceptable latency (default: 5000ms)
	ExcludeProviders   []string // Providers to exclude (e.g., already failed)
}

// SelectProvider selects the best provider for a request
func (s *ProviderSelector) SelectProvider(ctx context.Context, criteria *SelectionCriteria) (*ProviderCandidate, SelectionReason, error) {
	// Set defaults
	if criteria.MinUptimePercent == 0 {
		criteria.MinUptimePercent = 80.0
	}
	if criteria.MaxLatencyMs == 0 {
		criteria.MaxLatencyMs = 5000
	}

	// Get all active providers for tenant
	providers, err := s.repo.ListActive(ctx, criteria.TenantID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to list providers: %w", err)
	}

	if len(providers) == 0 {
		return nil, "", fmt.Errorf("no active providers available for tenant")
	}

	// Filter providers based on health and criteria
	candidates := s.filterProviders(providers, criteria)

	if len(candidates) == 0 {
		return nil, "", fmt.Errorf("no healthy providers available matching criteria")
	}

	// Rank candidates
	s.rankCandidates(candidates)

	// Apply user preference if provided
	if len(criteria.ProviderPreference) > 0 {
		for _, prefName := range criteria.ProviderPreference {
			for _, candidate := range candidates {
				if strings.EqualFold(candidate.Provider.Name, prefName) {
					s.logger.Printf("[ProviderSelector] Selected provider '%s' based on user preference", candidate.Provider.Name)
					return candidate, SelectionReasonPreference, nil
				}
			}
		}
		s.logger.Printf("[ProviderSelector] No preferred providers available, falling back to health-based selection")
	}

	// Return highest-ranked provider
	best := candidates[0]
	s.logger.Printf("[ProviderSelector] Selected provider '%s' based on health (score: %.2f, latency: %dms, uptime: %.1f%%)",
		best.Provider.Name, best.HealthScore,
		*best.Provider.Health.LatencyMs, best.Provider.Health.UptimePercent)

	return best, SelectionReasonHealth, nil
}

// SelectProviders returns an ordered list of provider candidates for fallback
func (s *ProviderSelector) SelectProviders(ctx context.Context, criteria *SelectionCriteria, maxCount int) ([]*ProviderCandidate, error) {
	// Set defaults
	if criteria.MinUptimePercent == 0 {
		criteria.MinUptimePercent = 80.0
	}
	if criteria.MaxLatencyMs == 0 {
		criteria.MaxLatencyMs = 5000
	}
	if maxCount == 0 {
		maxCount = 3 // Default: try up to 3 providers
	}

	// Get all active providers for tenant
	providers, err := s.repo.ListActive(ctx, criteria.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list providers: %w", err)
	}

	if len(providers) == 0 {
		return nil, fmt.Errorf("no active providers available for tenant")
	}

	// Filter providers
	candidates := s.filterProviders(providers, criteria)

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no healthy providers available matching criteria")
	}

	// Rank candidates
	s.rankCandidates(candidates)

	// Apply user preference ordering
	if len(criteria.ProviderPreference) > 0 {
		candidates = s.applyPreferenceOrder(candidates, criteria.ProviderPreference)
	}

	// Limit to maxCount
	if len(candidates) > maxCount {
		candidates = candidates[:maxCount]
	}

	s.logger.Printf("[ProviderSelector] Selected %d provider candidates for tenant %s", len(candidates), criteria.TenantID)

	return candidates, nil
}

// filterProviders filters providers based on health and criteria
func (s *ProviderSelector) filterProviders(providers []*models.ProviderRegistry, criteria *SelectionCriteria) []*ProviderCandidate {
	candidates := make([]*ProviderCandidate, 0, len(providers))

	for _, provider := range providers {
		// Skip if provider is in exclusion list
		if s.isExcluded(provider.Name, criteria.ExcludeProviders) {
			continue
		}

		// Skip if provider is disabled or invalid
		if provider.Status == models.StatusDisabled || provider.Status == models.StatusInvalid {
			continue
		}

		// Check circuit breaker - skip if circuit is open
		if !s.circuitBreakers.IsProviderAvailable(provider.ID) {
			state := s.circuitBreakers.GetState(provider.ID)
			s.logger.Printf("[ProviderSelector] Skipping provider '%s': circuit breaker is %s",
				provider.Name, state.String())
			continue
		}

		// Check uptime
		if provider.Health.UptimePercent < criteria.MinUptimePercent {
			s.logger.Printf("[ProviderSelector] Skipping provider '%s': uptime %.1f%% < minimum %.1f%%",
				provider.Name, provider.Health.UptimePercent, criteria.MinUptimePercent)
			continue
		}

		// Check latency
		if provider.Health.LatencyMs != nil && *provider.Health.LatencyMs > criteria.MaxLatencyMs {
			s.logger.Printf("[ProviderSelector] Skipping provider '%s': latency %dms > maximum %dms",
				provider.Name, *provider.Health.LatencyMs, criteria.MaxLatencyMs)
			continue
		}

		// Check consecutive failures
		if provider.Health.ConsecutiveFailures >= 3 {
			s.logger.Printf("[ProviderSelector] Skipping provider '%s': too many consecutive failures (%d)",
				provider.Name, provider.Health.ConsecutiveFailures)
			continue
		}

		// Calculate health score
		healthScore := s.calculateHealthScore(provider)

		candidates = append(candidates, &ProviderCandidate{
			Provider:    provider,
			HealthScore: healthScore,
		})
	}

	return candidates
}

// calculateHealthScore computes a composite health score for a provider
// Score components:
// - Uptime: 40% weight
// - Latency: 30% weight (inverse relationship)
// - Success rate: 30% weight
func (s *ProviderSelector) calculateHealthScore(provider *models.ProviderRegistry) float64 {
	// Uptime component (0-40 points)
	uptimeScore := provider.Health.UptimePercent * 0.4

	// Latency component (0-30 points, inverse relationship)
	latencyScore := 30.0
	if provider.Health.LatencyMs != nil {
		latencyMs := *provider.Health.LatencyMs
		if latencyMs < 500 {
			latencyScore = 30.0
		} else if latencyMs < 1000 {
			latencyScore = 25.0
		} else if latencyMs < 2000 {
			latencyScore = 20.0
		} else if latencyMs < 3000 {
			latencyScore = 15.0
		} else if latencyMs < 5000 {
			latencyScore = 10.0
		} else {
			latencyScore = 5.0
		}
	}

	// Success rate component (0-30 points)
	successRate := 100.0
	if provider.Health.TotalChecks > 0 {
		successRate = (float64(provider.Health.SuccessfulChecks) / float64(provider.Health.TotalChecks)) * 100.0
	}
	successScore := successRate * 0.3

	totalScore := uptimeScore + latencyScore + successScore

	return totalScore
}

// rankCandidates sorts candidates by health score (descending)
func (s *ProviderSelector) rankCandidates(candidates []*ProviderCandidate) {
	sort.Slice(candidates, func(i, j int) bool {
		// Primary: health score (descending)
		if candidates[i].HealthScore != candidates[j].HealthScore {
			return candidates[i].HealthScore > candidates[j].HealthScore
		}

		// Secondary: verified providers first
		if candidates[i].Provider.IsVerified != candidates[j].Provider.IsVerified {
			return candidates[i].Provider.IsVerified
		}

		// Tertiary: alphabetical by name
		return candidates[i].Provider.Name < candidates[j].Provider.Name
	})

	// Assign selection ranks
	for i := range candidates {
		candidates[i].SelectionRank = i
	}
}

// applyPreferenceOrder reorders candidates based on user preference
func (s *ProviderSelector) applyPreferenceOrder(candidates []*ProviderCandidate, preference []string) []*ProviderCandidate {
	// Create a map of provider name to candidate
	candidateMap := make(map[string]*ProviderCandidate)
	for _, candidate := range candidates {
		candidateMap[strings.ToLower(candidate.Provider.Name)] = candidate
	}

	// Build ordered list based on preference
	ordered := make([]*ProviderCandidate, 0, len(candidates))
	used := make(map[string]bool)

	// Add preferred providers first
	for _, prefName := range preference {
		key := strings.ToLower(prefName)
		if candidate, exists := candidateMap[key]; exists && !used[key] {
			ordered = append(ordered, candidate)
			used[key] = true
		}
	}

	// Add remaining candidates
	for _, candidate := range candidates {
		key := strings.ToLower(candidate.Provider.Name)
		if !used[key] {
			ordered = append(ordered, candidate)
			used[key] = true
		}
	}

	// Update selection ranks
	for i := range ordered {
		ordered[i].SelectionRank = i
	}

	return ordered
}

// isExcluded checks if a provider is in the exclusion list
func (s *ProviderSelector) isExcluded(providerName string, exclusionList []string) bool {
	for _, excluded := range exclusionList {
		if strings.EqualFold(providerName, excluded) {
			return true
		}
	}
	return false
}

// GetProviderStats returns statistics about available providers for a tenant
func (s *ProviderSelector) GetProviderStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	providers, err := s.repo.ListByTenant(ctx, tenantID, nil)
	if err != nil {
		return nil, err
	}

	activeCount := 0
	pendingCount := 0
	disabledCount := 0
	invalidCount := 0

	var totalLatency int64
	var latencyCount int

	for _, provider := range providers {
		switch provider.Status {
		case models.StatusActive:
			activeCount++
			if provider.Health.LatencyMs != nil {
				totalLatency += int64(*provider.Health.LatencyMs)
				latencyCount++
			}
		case models.StatusPending:
			pendingCount++
		case models.StatusDisabled:
			disabledCount++
		case models.StatusInvalid:
			invalidCount++
		}
	}

	avgLatency := 0
	if latencyCount > 0 {
		avgLatency = int(totalLatency / int64(latencyCount))
	}

	return map[string]interface{}{
		"total_providers":    len(providers),
		"active_providers":   activeCount,
		"pending_providers":  pendingCount,
		"disabled_providers": disabledCount,
		"invalid_providers":  invalidCount,
		"avg_latency_ms":     avgLatency,
	}, nil
}

// RecordSuccess records a successful request for circuit breaker tracking
func (s *ProviderSelector) RecordSuccess(providerID string) {
	s.circuitBreakers.RecordSuccess(providerID)
	s.logger.Printf("[ProviderSelector] Recorded success for provider %s (state: %s)",
		providerID, s.circuitBreakers.GetState(providerID).String())
}

// RecordFailure records a failed request for circuit breaker tracking
func (s *ProviderSelector) RecordFailure(providerID string) {
	s.circuitBreakers.RecordFailure(providerID)
	state := s.circuitBreakers.GetState(providerID)
	s.logger.Printf("[ProviderSelector] Recorded failure for provider %s (state: %s)",
		providerID, state.String())
}

// GetCircuitBreakerStats returns circuit breaker statistics for all providers
func (s *ProviderSelector) GetCircuitBreakerStats() map[string]map[string]interface{} {
	return s.circuitBreakers.GetStats()
}
