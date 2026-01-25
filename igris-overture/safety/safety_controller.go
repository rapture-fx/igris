package safety

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// SafetyController orchestrates all safety controls
// Phase 13: Now supports optional audit logging and persistence
// Phase 2: Now supports per-tenant budget tracking
type SafetyController struct {
	config         *SafetyConfig
	budgetTracker  *BudgetTracker           // Legacy: single-tenant mode
	tenantBudgetMgr *TenantBudgetManager    // Phase 2: multi-tenant mode
	tokenEnforcer  *TokenEnforcer
	keyValidator   *KeyValidator

	// Benchmark provider for fallback
	benchmarkProvider providers.Provider

	// Phase 13: Optional audit logger
	auditLogger *AuditLogger

	// Phase 2: Multi-tenancy mode flag
	multiTenantMode bool
	db              *sql.DB
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

// NewSafetyController creates a new safety controller in single-tenant mode
func NewSafetyController(config *SafetyConfig) *SafetyController {
	return NewSafetyControllerWithDB(config, nil, "default")
}

// NewSafetyControllerWithDB creates a new safety controller with optional database persistence
// Phase 13: If db is provided, enables audit logging and budget persistence
// Single-tenant mode: uses legacy budget tracker
func NewSafetyControllerWithDB(config *SafetyConfig, db *sql.DB, tenantID string) *SafetyController {
	return &SafetyController{
		config:          config,
		budgetTracker:   NewBudgetTrackerWithDB(config, db, tenantID),
		tokenEnforcer:   NewTokenEnforcer(config),
		keyValidator:    NewKeyValidator(config),
		auditLogger:     NewAuditLogger(db, tenantID),
		multiTenantMode: false,
		db:              db,
	}
}

// NewMultiTenantSafetyController creates a new safety controller in multi-tenant mode
// Phase 2: Uses TenantBudgetManager for per-tenant budget isolation
func NewMultiTenantSafetyController(config *SafetyConfig, db *sql.DB) *SafetyController {
	sc := &SafetyController{
		config:          config,
		tenantBudgetMgr: NewTenantBudgetManager(config, db),
		tokenEnforcer:   NewTokenEnforcer(config),
		keyValidator:    NewKeyValidator(config),
		multiTenantMode: true,
		db:              db,
	}

	// Phase 4.3.1: Start background metrics updater
	go sc.startMetricsUpdater()

	return sc
}

// startMetricsUpdater periodically updates Prometheus metrics
// Phase 4.3.1: Updates tenant budget metrics every 30 seconds
func (sc *SafetyController) startMetricsUpdater() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if sc.tenantBudgetMgr != nil {
			sc.tenantBudgetMgr.UpdatePrometheusMetrics()
		}
	}
}

// SetBenchmarkProvider sets the benchmark provider for fallback
func (sc *SafetyController) SetBenchmarkProvider(provider providers.Provider) {
	sc.benchmarkProvider = provider
	log.Printf("[SafetyController] Benchmark provider registered for fallback: %s", provider.Name())
}

// PreRequestCheck performs all safety checks before executing a request
// Phase 13: Now logs audit events for budget and token checks
// Legacy: single-tenant mode (uses default tenant)
func (sc *SafetyController) PreRequestCheck(req *models.InferRequest, estimatedCost float64) (*SafetyCheckResult, error) {
	return sc.PreRequestCheckForTenant(req, estimatedCost, "default", "")
}

// PreRequestCheckForTenant performs safety checks for a specific tenant
// Phase 2: Multi-tenant mode - checks budget per tenant
func (sc *SafetyController) PreRequestCheckForTenant(req *models.InferRequest, estimatedCost float64, tenantID string, traceID string) (*SafetyCheckResult, error) {
	warnings := []string{}

	// 1. Check token limits
	tokenCheck, err := sc.tokenEnforcer.CheckAndEnforce(req)
	if err != nil {
		// Phase 13: Log token limit error
		if sc.auditLogger != nil {
			sc.auditLogger.LogTokenLimit(ActionRejected, tokenCheck.OriginalTokens, 0,
				sc.config.MaxTokensPerRequest, req.Model, traceID)
		}

		return &SafetyCheckResult{
			Allowed:     false,
			TokenCheck:  tokenCheck,
			Reason:      fmt.Sprintf("Token limit check failed: %v", err),
		}, err
	}

	// Phase 13: Log token enforcement action
	if tokenCheck.Truncated {
		warnings = append(warnings, fmt.Sprintf("Tokens truncated from %d to %d", tokenCheck.OriginalTokens, tokenCheck.RequestedTokens))
		if sc.auditLogger != nil {
			sc.auditLogger.LogTokenLimit(ActionTruncated, tokenCheck.OriginalTokens,
				tokenCheck.RequestedTokens, sc.config.MaxTokensPerRequest, req.Model, traceID)
		}
	} else if sc.auditLogger != nil {
		sc.auditLogger.LogTokenLimit(ActionAllowed, tokenCheck.RequestedTokens,
			tokenCheck.RequestedTokens, sc.config.MaxTokensPerRequest, req.Model, traceID)
	}

	// 2. Check budget (per-tenant or global)
	var budgetCheck *BudgetCheckResult

	if sc.multiTenantMode {
		// Multi-tenant mode: get tracker for specific tenant
		tracker := sc.tenantBudgetMgr.GetTracker(tenantID)
		budgetCheck = tracker.CheckBudget(estimatedCost)
	} else {
		// Single-tenant mode: use legacy tracker
		budgetCheck = sc.budgetTracker.CheckBudget(estimatedCost)
	}

	// Phase 13: Log budget check
	if sc.auditLogger != nil {
		sc.auditLogger.LogBudgetCheck(budgetCheck.Allowed, budgetCheck.CurrentSpend,
			budgetCheck.Limit, estimatedCost, traceID)
	}

	if !budgetCheck.Allowed {
		// Budget exceeded - check if we should fallback
		if sc.config.FallbackOnBudgetBreach && sc.config.EnableBenchmarkFallback {
			log.Printf("[SafetyController] ⚠️  Budget exceeded for tenant %s, falling back to benchmark mode", tenantID)

			// Phase 13: Log budget breach and fallback
			if sc.auditLogger != nil {
				sc.auditLogger.LogBudgetBreach(budgetCheck.CurrentSpend, budgetCheck.Limit, traceID)
				sc.auditLogger.LogFallback("budget_breach", "", req.Model, traceID)
			}

			return &SafetyCheckResult{
				Allowed:         true,
				UseBenchmark:    true,
				Reason:          fmt.Sprintf("Budget exceeded for tenant %s - using benchmark fallback", tenantID),
				BudgetCheck:     budgetCheck,
				TokenCheck:      tokenCheck,
				WarningMessages: warnings,
			}, nil
		}

		// No fallback available - reject request
		// Phase 13: Log budget breach
		if sc.auditLogger != nil {
			sc.auditLogger.LogBudgetBreach(budgetCheck.CurrentSpend, budgetCheck.Limit, traceID)
		}

		return &SafetyCheckResult{
			Allowed:         false,
			UseBenchmark:    false,
			Reason:          budgetCheck.Reason,
			BudgetCheck:     budgetCheck,
			TokenCheck:      tokenCheck,
			WarningMessages: warnings,
		}, fmt.Errorf("budget exceeded for tenant %s and fallback disabled", tenantID)
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

// PreRequestCheckWithTrace performs safety checks with trace ID for audit logging (Phase 13)
// Legacy: uses default tenant
func (sc *SafetyController) PreRequestCheckWithTrace(req *models.InferRequest, estimatedCost float64, traceID string) (*SafetyCheckResult, error) {
	return sc.PreRequestCheckForTenant(req, estimatedCost, "default", traceID)
}

// DEPRECATED: Old implementation - keeping for reference
func (sc *SafetyController) preRequestCheckWithTraceLegacy(req *models.InferRequest, estimatedCost float64, traceID string) (*SafetyCheckResult, error) {
	warnings := []string{}

	// 1. Check token limits
	tokenCheck, err := sc.tokenEnforcer.CheckAndEnforce(req)
	if err != nil {
		// Phase 13: Log token limit error
		if sc.auditLogger != nil {
			sc.auditLogger.LogTokenLimit(ActionRejected, tokenCheck.OriginalTokens, 0,
				sc.config.MaxTokensPerRequest, req.Model, traceID)
		}

		return &SafetyCheckResult{
			Allowed:     false,
			TokenCheck:  tokenCheck,
			Reason:      fmt.Sprintf("Token limit check failed: %v", err),
		}, err
	}

	// Phase 13: Log token enforcement action
	if tokenCheck.Truncated {
		warnings = append(warnings, fmt.Sprintf("Tokens truncated from %d to %d", tokenCheck.OriginalTokens, tokenCheck.RequestedTokens))
		if sc.auditLogger != nil {
			sc.auditLogger.LogTokenLimit(ActionTruncated, tokenCheck.OriginalTokens,
				tokenCheck.RequestedTokens, sc.config.MaxTokensPerRequest, req.Model, traceID)
		}
	} else if sc.auditLogger != nil {
		sc.auditLogger.LogTokenLimit(ActionAllowed, tokenCheck.RequestedTokens,
			tokenCheck.RequestedTokens, sc.config.MaxTokensPerRequest, req.Model, traceID)
	}

	// 2. Check budget
	budgetCheck := sc.budgetTracker.CheckBudget(estimatedCost)

	// Phase 13: Log budget check
	if sc.auditLogger != nil {
		sc.auditLogger.LogBudgetCheck(budgetCheck.Allowed, budgetCheck.CurrentSpend,
			budgetCheck.Limit, estimatedCost, traceID)
	}

	if !budgetCheck.Allowed {
		// Budget exceeded - check if we should fallback
		if sc.config.FallbackOnBudgetBreach && sc.config.EnableBenchmarkFallback {
			log.Printf("[SafetyController] ⚠️  Budget exceeded, falling back to benchmark mode")

			// Phase 13: Log budget breach and fallback
			if sc.auditLogger != nil {
				sc.auditLogger.LogBudgetBreach(budgetCheck.CurrentSpend, budgetCheck.Limit, traceID)
				sc.auditLogger.LogFallback("budget_breach", "", req.Model, traceID)
			}

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
		// Phase 13: Log budget breach
		if sc.auditLogger != nil {
			sc.auditLogger.LogBudgetBreach(budgetCheck.CurrentSpend, budgetCheck.Limit, traceID)
		}

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
// Legacy: uses default tenant
func (sc *SafetyController) PostRequestRecord(provider, model string, cost float64) error {
	return sc.PostRequestRecordForTenant(provider, model, cost, "default", "", "")
}

// PostRequestRecordWithTrace records cost with trace ID (Phase 13)
// Legacy: uses default tenant
func (sc *SafetyController) PostRequestRecordWithTrace(provider, model string, cost float64, requestID, traceID string) error {
	return sc.PostRequestRecordForTenant(provider, model, cost, "default", requestID, traceID)
}

// PostRequestRecordForTenant records cost for a specific tenant
// Phase 2: Multi-tenant mode - records cost per tenant
func (sc *SafetyController) PostRequestRecordForTenant(provider, model string, cost float64, tenantID string, requestID, traceID string) error {
	if sc.multiTenantMode {
		// Multi-tenant mode: get tracker for specific tenant
		tracker := sc.tenantBudgetMgr.GetTracker(tenantID)
		return tracker.RecordCostWithTrace(provider, model, cost, requestID, traceID)
	} else {
		// Single-tenant mode: use legacy tracker
		return sc.budgetTracker.RecordCostWithTrace(provider, model, cost, requestID, traceID)
	}
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

// GetAuditLogger returns the audit logger (Phase 13)
func (sc *SafetyController) GetAuditLogger() *AuditLogger {
	return sc.auditLogger
}

// Close gracefully shuts down the safety controller (Phase 13)
func (sc *SafetyController) Close() error {
	if sc.auditLogger != nil {
		return sc.auditLogger.Close()
	}
	return nil
}

// ✅ COMPLETED Phase 13: Audit logging for compliance and debugging
// ✅ COMPLETED Phase 13: Database persistence for budget tracking
// TODO Phase 14: Add rate limiting per tenant
// TODO Phase 14: Add custom policy DSL for customer-defined rules
// TODO Phase 15: Add automated budget increase suggestions based on usage
// TODO Phase 15: Add predictive alerts for budget exhaustion
// TODO Phase 15: Add failover to customer's own infrastructure
