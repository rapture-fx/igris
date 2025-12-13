// Package billing provides hard budget enforcement for Scale tier
package billing

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// ============================================================================
// BUDGET ENFORCER
// ============================================================================

// BudgetEnforcer enforces hard budget caps for Scale tier
type BudgetEnforcer struct {
	redis           *redis.Client
	overrideManager *OverrideManager
	logger          *log.Logger
	enabled         bool
}

// BudgetEnforcerConfig holds configuration for budget enforcement
type BudgetEnforcerConfig struct {
	Redis           *redis.Client
	OverrideManager *OverrideManager
	Logger          *log.Logger
	Enabled         bool
}

// NewBudgetEnforcer creates a new budget enforcement middleware
func NewBudgetEnforcer(cfg BudgetEnforcerConfig) *BudgetEnforcer {
	if cfg.Logger == nil {
		cfg.Logger = log.Default()
	}

	return &BudgetEnforcer{
		redis:           cfg.Redis,
		overrideManager: cfg.OverrideManager,
		logger:          cfg.Logger,
		enabled:         cfg.Enabled,
	}
}

// EnforceMiddleware is the Fiber middleware for hard budget enforcement
func (be *BudgetEnforcer) EnforceMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip if not enabled
		if !be.enabled {
			return c.Next()
		}

		// Get tenant ID from context (set by auth middleware)
		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Next()
		}

		tenantIDStr, ok := tenantID.(string)
		if !ok {
			return c.Next()
		}

		// Get tenant tier
		tier, err := be.getTenantTier(c.Context(), tenantIDStr)
		if err != nil {
			be.logger.Printf("[BudgetEnforcer] Failed to get tenant tier: %v", err)
			return c.Next()
		}

		// Only enforce for Scale tier
		if tier != "scale" {
			return c.Next()
		}

		// Check for emergency override token
		overrideToken := c.Get("X-Budget-Override")
		if overrideToken != "" {
			if err := be.handleOverride(c.Context(), overrideToken, tenantIDStr); err != nil {
				be.logger.Printf("[BudgetEnforcer] Override validation failed: %v", err)
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error":   "invalid_override",
					"message": fmt.Sprintf("Emergency override failed: %v", err),
				})
			}

			// Override valid - mark token as used and continue
			if err := be.overrideManager.MarkTokenUsed(overrideToken); err != nil {
				be.logger.Printf("[BudgetEnforcer] Failed to mark token as used: %v", err)
			}

			be.overrideManager.IncrementOverrideUsage(tenantIDStr)
			be.logger.Printf("[BudgetEnforcer] Emergency override accepted for tenant %s (usage: %d/100)",
				tenantIDStr, be.overrideManager.GetOverrideUsage(tenantIDStr))

			return c.Next()
		}

		// Check if budget exceeded
		exceeded, currentSpend, budget, err := be.isBudgetExceeded(c.Context(), tenantIDStr)
		if err != nil {
			be.logger.Printf("[BudgetEnforcer] Failed to check budget: %v", err)
			return c.Next() // Fail open
		}

		if exceeded {
			be.logger.Printf("[BudgetEnforcer] Budget exhausted for tenant %s: $%.2f / $%.2f",
				tenantIDStr, currentSpend, budget)

			c.Set("X-Budget-Exhausted", "true")
			c.Set("X-Current-Spend", fmt.Sprintf("%.2f", currentSpend))
			c.Set("X-Monthly-Budget", fmt.Sprintf("%.2f", budget))

			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "budget_exhausted",
				"message": "Monthly budget reached. Contact admin or upgrade.",
				"current_spend": currentSpend,
				"monthly_budget": budget,
			})
		}

		return c.Next()
	}
}

// isBudgetExceeded checks if tenant has exceeded their monthly budget
func (be *BudgetEnforcer) isBudgetExceeded(ctx context.Context, tenantID string) (bool, float64, float64, error) {
	// Get current spend from Redis
	currentSpendKey := fmt.Sprintf("schlep:billing:%s:current_spend", tenantID)
	currentSpendStr, err := be.redis.Get(ctx, currentSpendKey).Result()
	if err != nil && err != redis.Nil {
		return false, 0, 0, err
	}

	currentSpend := 0.0
	if currentSpendStr != "" {
		currentSpend, _ = strconv.ParseFloat(currentSpendStr, 64)
	}

	// Get monthly budget from tenant config
	budgetKey := fmt.Sprintf("schlep:billing:%s:monthly_budget", tenantID)
	budgetStr, err := be.redis.Get(ctx, budgetKey).Result()
	if err != nil && err != redis.Nil {
		return false, 0, 0, err
	}

	budget := 0.0
	if budgetStr != "" {
		budget, _ = strconv.ParseFloat(budgetStr, 64)
	}

	// If no budget set, don't enforce
	if budget <= 0 {
		return false, currentSpend, budget, nil
	}

	// Check if exceeded
	exceeded := currentSpend >= budget

	return exceeded, currentSpend, budget, nil
}

// handleOverride validates and processes an emergency override token
func (be *BudgetEnforcer) handleOverride(ctx context.Context, token string, tenantID string) error {
	if be.overrideManager == nil {
		return errors.New("override manager not configured")
	}

	return be.overrideManager.ValidateOverride(token, tenantID)
}

// getTenantTier gets the tier for a tenant from Redis cache
func (be *BudgetEnforcer) getTenantTier(ctx context.Context, tenantID string) (string, error) {
	tierKey := fmt.Sprintf("schlep:billing:%s:tier", tenantID)
	tier, err := be.redis.Get(ctx, tierKey).Result()
	if err == redis.Nil {
		return "developer", nil // Default to developer
	}
	if err != nil {
		return "", err
	}

	return tier, nil
}

// SetTenantBudget sets the monthly budget for a tenant (admin operation)
func (be *BudgetEnforcer) SetTenantBudget(ctx context.Context, tenantID string, budgetUSD float64) error {
	budgetKey := fmt.Sprintf("schlep:billing:%s:monthly_budget", tenantID)
	return be.redis.Set(ctx, budgetKey, fmt.Sprintf("%.2f", budgetUSD), 0).Err()
}

// GetTenantBudget gets the monthly budget for a tenant
func (be *BudgetEnforcer) GetTenantBudget(ctx context.Context, tenantID string) (float64, error) {
	budgetKey := fmt.Sprintf("schlep:billing:%s:monthly_budget", tenantID)
	budgetStr, err := be.redis.Get(ctx, budgetKey).Result()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}

	budget, err := strconv.ParseFloat(budgetStr, 64)
	if err != nil {
		return 0, err
	}

	return budget, nil
}

// IncrementTenantSpend increments the current spend for a tenant
func (be *BudgetEnforcer) IncrementTenantSpend(ctx context.Context, tenantID string, amountUSD float64) error {
	currentSpendKey := fmt.Sprintf("schlep:billing:%s:current_spend", tenantID)
	return be.redis.IncrByFloat(ctx, currentSpendKey, amountUSD).Err()
}

// ResetTenantSpend resets the current spend for a tenant (called at start of new billing period)
func (be *BudgetEnforcer) ResetTenantSpend(ctx context.Context, tenantID string) error {
	currentSpendKey := fmt.Sprintf("schlep:billing:%s:current_spend", tenantID)
	return be.redis.Set(ctx, currentSpendKey, "0.00", 0).Err()
}

// GetTenantSpend gets the current spend for a tenant
func (be *BudgetEnforcer) GetTenantSpend(ctx context.Context, tenantID string) (float64, error) {
	currentSpendKey := fmt.Sprintf("schlep:billing:%s:current_spend", tenantID)
	spendStr, err := be.redis.Get(ctx, currentSpendKey).Result()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}

	spend, err := strconv.ParseFloat(spendStr, 64)
	if err != nil {
		return 0, err
	}

	return spend, nil
}
