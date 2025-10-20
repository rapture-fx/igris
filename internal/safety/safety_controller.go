package safety

import (
	"context"
	"fmt"
	"log"

	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
)

// SafetyController orchestrates all safety controls
// FUTURE: This will become the Customer Safety Dashboard backend
type SafetyController struct {
	config         *SafetyConfig
	budgetTracker  *BudgetTracker
	tokenEnforcer  *TokenEnforcer
	keyValidator   *KeyValidator

	// Benchmark provider for fallback
	benchmarkProvider providers.Provider
}

// SafetyCheckResult represents the combined result of all safety checks
type SafetyCheckResult struct {
	Allowed          bool
	UseBenchmark     bool
	Reason           string
	BudgetCheck      *BudgetCheckResult
	TokenCheck       *TokenCheckResult
	WarningMessages  []string
}

// NewSafetyController creates a new safety controller
func NewSafetyController(config *SafetyConfig) *SafetyController {
	return &SafetyController{
		config:        config,
		budgetTracker: NewBudgetTracker(config),
		tokenEnforcer: NewTokenEnforcer(config),
		keyValidator:  NewKeyValidator(config),
	}
}

// SetBenchmarkProvider sets the benchmark provider for fallback
func (sc *SafetyController) SetBenchmarkProvider(provider providers.Provider) {
	sc.benchmarkProvider = provider
	log.Printf("[SafetyController] Benchmark provider registered for fallback: %s", provider.Name())
}

// PreRequestCheck performs all safety checks before executing a request
// FUTURE: This will enforce customer-configured policies
func (sc *SafetyController) PreRequestCheck(req *models.InferRequest, estimatedCost float64) (*SafetyCheckResult, error) {
	warnings := []string{}

	// 1. Check token limits
	tokenCheck, err := sc.tokenEnforcer.CheckAndEnforce(req)
	if err != nil {
		return &SafetyCheckResult{
			Allowed:     false,
			TokenCheck:  tokenCheck,
			Reason:      fmt.Sprintf("Token limit check failed: %v", err),
		}, err
	}

	if tokenCheck.Truncated {
		warnings = append(warnings, fmt.Sprintf("Tokens truncated from %d to %d", tokenCheck.OriginalTokens, tokenCheck.RequestedTokens))
	}

	// 2. Check budget
	budgetCheck := sc.budgetTracker.CheckBudget(estimatedCost)

	if !budgetCheck.Allowed {
		// Budget exceeded - check if we should fallback
		if sc.config.FallbackOnBudgetBreach && sc.config.EnableBenchmarkFallback {
			log.Printf("[SafetyController] ⚠️  Budget exceeded, falling back to benchmark mode")
			return &SafetyCheckResult{
				Allowed:         true,
				UseBenchmark:    true,
				Reason:          "Budget exceeded - using benchmark fallback",
				BudgetCheck:     budgetCheck,
				TokenCheck:      tokenCheck,
				WarningMessages: warnings,
			}, nil
		}

		// No fallback available - reject request
		return &SafetyCheckResult{
			Allowed:         false,
			UseBenchmark:    false,
			Reason:          budgetCheck.Reason,
			BudgetCheck:     budgetCheck,
			TokenCheck:      tokenCheck,
			WarningMessages: warnings,
		}, fmt.Errorf("budget exceeded and fallback disabled")
	}

	// Add budget warnings
	if budgetCheck.PercentageUsed >= 80 {
		warnings = append(warnings, fmt.Sprintf("%.1f%% of monthly budget used", budgetCheck.PercentageUsed))
	}

	return &SafetyCheckResult{
		Allowed:         true,
		UseBenchmark:    false,
		Reason:          "All safety checks passed",
		BudgetCheck:     budgetCheck,
		TokenCheck:      tokenCheck,
		WarningMessages: warnings,
	}, nil
}

// PostRequestRecord records the actual cost after a successful request
func (sc *SafetyController) PostRequestRecord(provider, model string, cost float64) error {
	return sc.budgetTracker.RecordCost(provider, model, cost)
}

// HandleProviderError determines fallback strategy on provider errors
// FUTURE: This will become Customer "Reliability Tier" controls
func (sc *SafetyController) HandleProviderError(err error, req *models.InferRequest) (*models.InferResponse, error) {
	if !sc.config.EnableBenchmarkFallback {
		return nil, fmt.Errorf("provider failed and fallback disabled: %w", err)
	}

	if sc.benchmarkProvider == nil {
		return nil, fmt.Errorf("provider failed and no benchmark provider available: %w", err)
	}

	log.Printf("[SafetyController] Provider error, falling back to benchmark: %v", err)

	// Execute request with benchmark provider
	resp, fallbackErr := sc.benchmarkProvider.Infer(context.Background(), req)
	if fallbackErr != nil {
		return nil, fmt.Errorf("provider and benchmark fallback both failed: %w", fallbackErr)
	}

	// Annotate response to indicate fallback
	if resp.Metadata == nil {
		resp.Metadata = &models.ResponseMetadata{}
	}
	resp.Metadata.Fallback = true
	resp.Metadata.FallbackReason = fmt.Sprintf("Provider error: %v", err)

	return resp, nil
}

// GetBudgetTracker returns the budget tracker for external access
func (sc *SafetyController) GetBudgetTracker() *BudgetTracker {
	return sc.budgetTracker
}

// GetTokenEnforcer returns the token enforcer
func (sc *SafetyController) GetTokenEnforcer() *TokenEnforcer {
	return sc.tokenEnforcer
}

// GetKeyValidator returns the key validator
func (sc *SafetyController) GetKeyValidator() *KeyValidator {
	return sc.keyValidator
}

// GetStats returns comprehensive safety statistics
// FUTURE: This will power the Customer Safety Dashboard
func (sc *SafetyController) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"config": map[string]interface{}{
			"test_mode":              sc.config.TestMode,
			"max_monthly_cost":       sc.config.MaxMonthlyCostUSD,
			"max_tokens_per_request": sc.config.MaxTokensPerRequest,
			"budget_limit_enabled":   sc.config.EnableBudgetLimit,
			"token_limit_enabled":    sc.config.EnableTokenLimit,
			"benchmark_fallback":     sc.config.EnableBenchmarkFallback,
		},
		"budget": sc.budgetTracker.GetStats(),
	}
}

// ValidateConfiguration validates the safety configuration
// FUTURE: This will validate customer-submitted policies
func (sc *SafetyController) ValidateConfiguration() (bool, []string) {
	return sc.config.IsProductionSafe()
}

// TODO Phase 14: Add rate limiting per tenant
// TODO Phase 14: Add custom policy DSL for customer-defined rules
// TODO Phase 15: Add automated budget increase suggestions based on usage
// TODO Phase 15: Add predictive alerts for budget exhaustion
// TODO Phase 15: Add failover to customer's own infrastructure
