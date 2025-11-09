package router

import (
	"context"
	"fmt"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/bandit"
	"github.com/schlep-engine/schlep-engine/internal/semantic"
)

// SemanticRouter combines semantic classification with Thompson Sampling routing
type SemanticRouter struct {
	classifier       *semantic.Classifier
	rewardEngine     *bandit.RewardEngine
	adaptiveRouter   *AdaptiveRouter
	explorationRate  float64
}

// SemanticRoutingRequest extends RoutingRequest with prompt information
type SemanticRoutingRequest struct {
	*RoutingRequest
	Prompt     string
	TenantID   string
	TraceID    string
}

// SemanticRoutingDecision extends RoutingDecision with semantic information
type SemanticRoutingDecision struct {
	*RoutingDecision
	SemanticClass      string
	Classification     *semantic.ClassificationResult
	BanditArm          *bandit.BanditArm
	ThompsonSample     float64
	ExplorationMode    bool
}

// NewSemanticRouter creates a new semantic router
func NewSemanticRouter(
	classifier *semantic.Classifier,
	rewardEngine *bandit.RewardEngine,
	adaptiveRouter *AdaptiveRouter,
) *SemanticRouter {
	return &SemanticRouter{
		classifier:      classifier,
		rewardEngine:    rewardEngine,
		adaptiveRouter:  adaptiveRouter,
		explorationRate: 0.15, // 15% exploration rate (configurable)
	}
}

// Route performs semantic classification and Thompson Sampling-based routing
func (sr *SemanticRouter) Route(ctx context.Context, req *SemanticRoutingRequest) (*SemanticRoutingDecision, error) {
	// Step 1: Classify the prompt
	classification, err := sr.classifier.Classify(ctx, req.Prompt)
	if err != nil {
		return nil, fmt.Errorf("classification failed: %w", err)
	}

	// Step 2: Get available providers from adaptive router
	routingReq := req.RoutingRequest
	routingReq.Capabilities = []string{classification.Class}

	// Filter backends by capability and health
	candidates := sr.adaptiveRouter.filterByCapability(routingReq.Capabilities)
	candidates = sr.adaptiveRouter.filterHealthy(candidates)

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no healthy backends available for class %s", classification.Class)
	}

	// Step 3: Get bandit arms for all candidate providers
	providerIDs := make([]string, len(candidates))
	for i, backend := range candidates {
		providerIDs[i] = backend.ID
	}

	arms, err := sr.getBanditArms(ctx, providerIDs, classification.Class)
	if err != nil {
		return nil, fmt.Errorf("failed to get bandit arms: %w", err)
	}

	// Step 4: Perform Thompson Sampling to select the best provider
	selectedArm := sr.rewardEngine.SelectArmThompsonSampling(arms, sr.explorationRate)
	if selectedArm == nil {
		// Fallback to first candidate
		selectedArm = &bandit.BanditArm{
			ProviderID:    candidates[0].ID,
			SemanticClass: classification.Class,
			Alpha:         1.0,
			Beta:          1.0,
		}
	}

	// Find the corresponding backend
	var selectedBackend *Backend
	for _, backend := range candidates {
		if backend.ID == selectedArm.ProviderID {
			selectedBackend = backend
			break
		}
	}

	if selectedBackend == nil {
		return nil, fmt.Errorf("selected provider %s not found in candidates", selectedArm.ProviderID)
	}

	// Build decision
	decision := &SemanticRoutingDecision{
		RoutingDecision: &RoutingDecision{
			Backend: selectedBackend,
			Reason: fmt.Sprintf(
				"Thompson Sampling: class=%s, α=%.2f, β=%.2f, reward=%.3f",
				classification.Class,
				selectedArm.Alpha,
				selectedArm.Beta,
				selectedArm.CompositeReward,
			),
			Confidence:     selectedArm.GetMean(),
			AlternativeIDs: sr.getAlternativeIDs(arms, selectedArm.ProviderID),
		},
		SemanticClass:   classification.Class,
		Classification:  classification,
		BanditArm:       selectedArm,
		ThompsonSample:  selectedArm.GetMean(),
		ExplorationMode: false, // Set this based on actual exploration
	}

	return decision, nil
}

// RecordFeedback records feedback for a routing decision
func (sr *SemanticRouter) RecordFeedback(
	ctx context.Context,
	providerID string,
	semanticClass string,
	latencyMs int64,
	costUSD float64,
	success bool,
) error {
	// Calculate composite reward
	reward := sr.rewardEngine.CalculateCompositeReward(
		latencyMs,
		costUSD,
		success,
		semanticClass,
	)

	// Update bandit arm
	if err := sr.rewardEngine.UpdateBanditArm(ctx, providerID, semanticClass, reward, success); err != nil {
		return fmt.Errorf("failed to update bandit arm: %w", err)
	}

	// Also record in adaptive router for backward compatibility
	sr.adaptiveRouter.RecordResult(providerID, time.Duration(latencyMs)*time.Millisecond, nil)

	return nil
}

// getBanditArms retrieves bandit arms for all providers in a semantic class
func (sr *SemanticRouter) getBanditArms(ctx context.Context, providerIDs []string, semanticClass string) ([]*bandit.BanditArm, error) {
	arms := make([]*bandit.BanditArm, 0, len(providerIDs))

	for _, providerID := range providerIDs {
		arm, err := sr.rewardEngine.GetBanditArm(ctx, providerID, semanticClass)
		if err != nil {
			// Skip this provider on error, don't fail the entire request
			continue
		}
		arms = append(arms, arm)
	}

	if len(arms) == 0 {
		return nil, fmt.Errorf("no bandit arms available")
	}

	return arms, nil
}

// getAlternativeIDs returns provider IDs excluding the selected one
func (sr *SemanticRouter) getAlternativeIDs(arms []*bandit.BanditArm, selectedProviderID string) []string {
	alternatives := make([]string, 0, len(arms)-1)

	for _, arm := range arms {
		if arm.ProviderID != selectedProviderID {
			alternatives = append(alternatives, arm.ProviderID)
		}
	}

	return alternatives
}

// SetExplorationRate updates the exploration rate for Thompson Sampling
func (sr *SemanticRouter) SetExplorationRate(rate float64) error {
	if rate < 0 || rate > 1 {
		return fmt.Errorf("exploration rate must be between 0 and 1")
	}

	sr.explorationRate = rate
	return nil
}

// GetExplorationRate returns the current exploration rate
func (sr *SemanticRouter) GetExplorationRate() float64 {
	return sr.explorationRate
}

// GetClassificationStats returns statistics for semantic classifications
func (sr *SemanticRouter) GetClassificationStats(ctx context.Context) (map[string]semantic.ClassStats, error) {
	return sr.classifier.GetStats(ctx)
}

// GetProviderStats returns statistics for providers per semantic class
func (sr *SemanticRouter) GetProviderStats(ctx context.Context, semanticClass string) ([]*bandit.BanditArm, error) {
	return sr.rewardEngine.GetAllArmsForClass(ctx, semanticClass)
}

// UpdateWeights updates the composite reward weights for a semantic class
func (sr *SemanticRouter) UpdateWeights(semanticClass string, weights bandit.RewardWeights) error {
	return sr.rewardEngine.SetWeights(semanticClass, weights)
}
