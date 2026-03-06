// Package billing provides hard budget enforcement and runtime limit enforcement.
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
// RUNTIME LIMIT ENFORCER
// ============================================================================

// ErrTierLimitExceeded is returned when a tenant tries to register more runtimes
// than their tier allows.
var ErrTierLimitExceeded = errors.New("runtime limit exceeded for current tier")

// RuntimeEnforcer enforces per-tier runtime registration limits.
type RuntimeEnforcer struct {
	redis  *redis.Client
	logger *log.Logger
}

// NewRuntimeEnforcer creates a new runtime limit enforcer.
func NewRuntimeEnforcer(r *redis.Client) *RuntimeEnforcer {
	return &RuntimeEnforcer{redis: r, logger: log.Default()}
}

// CheckRuntimeLimit returns an error if the tenant has reached their tier's
// runtime limit. Call this before registering a new runtime instance.
func (re *RuntimeEnforcer) CheckRuntimeLimit(ctx context.Context, tenantID string) error {
	tier, err := re.getTenantTier(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("could not determine tenant tier: %w", err)
	}

	limit, ok := TierRuntimeLimit[tier]
	if !ok {
		limit = TierRuntimeLimit[TierSeed]
	}

	count, err := re.getRuntimeCount(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("could not read runtime count: %w", err)
	}

	if count >= limit {
		re.logger.Printf("[RuntimeEnforcer] Limit reached: tenant=%s tier=%s count=%d limit=%d",
			tenantID, tier, count, limit)
		return fmt.Errorf("%w: %d/%d runtimes registered (tier: %s)", ErrTierLimitExceeded, count, limit, tier)
	}

	return nil
}

// IncrementRuntimeCount records a new registered runtime for a tenant.
func (re *RuntimeEnforcer) IncrementRuntimeCount(ctx context.Context, tenantID string) error {
	key := fmt.Sprintf("igris:runtimes:%s:count", tenantID)
	return re.redis.Incr(ctx, key).Err()
}

// DecrementRuntimeCount records a deregistered runtime for a tenant.
func (re *RuntimeEnforcer) DecrementRuntimeCount(ctx context.Context, tenantID string) error {
	key := fmt.Sprintf("igris:runtimes:%s:count", tenantID)
	return re.redis.Decr(ctx, key).Err()
}

// GetRuntimeUsage returns (current, limit) for the tenant's tier.
func (re *RuntimeEnforcer) GetRuntimeUsage(ctx context.Context, tenantID string) (int, int, error) {
	tier, err := re.getTenantTier(ctx, tenantID)
	if err != nil {
		return 0, 0, err
	}

	limit, ok := TierRuntimeLimit[tier]
	if !ok {
		limit = TierRuntimeLimit[TierSeed]
	}

	count, err := re.getRuntimeCount(ctx, tenantID)
	if err != nil {
		return 0, limit, err
	}

	return count, limit, nil
}

func (re *RuntimeEnforcer) getRuntimeCount(ctx context.Context, tenantID string) (int, error) {
	key := fmt.Sprintf("igris:runtimes:%s:count", tenantID)
	n, err := re.redis.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil
	}
	return n, err
}

func (re *RuntimeEnforcer) getTenantTier(ctx context.Context, tenantID string) (Tier, error) {
	tierKey := fmt.Sprintf("igris:billing:%s:tier", tenantID)
	t, err := re.redis.Get(ctx, tierKey).Result()
	if err == redis.Nil {
		return TierSeed, nil // Default to Seed
	}
	if err != nil {
		return "", err
	}
	return Tier(t), nil
}

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

		// Only enforce for Infinite tier (top tier with hard budget caps)
		if Tier(tier) != TierInfinite {
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
			// SECURITY: Fail closed — deny request when billing state is unknown
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   "billing_unavailable",
				"message": "Unable to verify billing status. Please try again shortly.",
			})
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
	currentSpendKey := fmt.Sprintf("igris:billing:%s:current_spend", tenantID)
	currentSpendStr, err := be.redis.Get(ctx, currentSpendKey).Result()
	if err != nil && err != redis.Nil {
		return false, 0, 0, err
	}

	currentSpend := 0.0
	if currentSpendStr != "" {
		currentSpend, _ = strconv.ParseFloat(currentSpendStr, 64)
	}

	// Get monthly budget from tenant config
	budgetKey := fmt.Sprintf("igris:billing:%s:monthly_budget", tenantID)
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
	tierKey := fmt.Sprintf("igris:billing:%s:tier", tenantID)
	tier, err := be.redis.Get(ctx, tierKey).Result()
	if err == redis.Nil {
		return string(TierSeed), nil // Default to Seed
	}
	if err != nil {
		return "", err
	}

	return tier, nil
}

// SetTenantBudget sets the monthly budget for a tenant (admin operation)
func (be *BudgetEnforcer) SetTenantBudget(ctx context.Context, tenantID string, budgetUSD float64) error {
	budgetKey := fmt.Sprintf("igris:billing:%s:monthly_budget", tenantID)
	return be.redis.Set(ctx, budgetKey, fmt.Sprintf("%.2f", budgetUSD), 0).Err()
}

// GetTenantBudget gets the monthly budget for a tenant
func (be *BudgetEnforcer) GetTenantBudget(ctx context.Context, tenantID string) (float64, error) {
	budgetKey := fmt.Sprintf("igris:billing:%s:monthly_budget", tenantID)
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
	currentSpendKey := fmt.Sprintf("igris:billing:%s:current_spend", tenantID)
	return be.redis.IncrByFloat(ctx, currentSpendKey, amountUSD).Err()
}

// ResetTenantSpend resets the current spend for a tenant (called at start of new billing period)
func (be *BudgetEnforcer) ResetTenantSpend(ctx context.Context, tenantID string) error {
	currentSpendKey := fmt.Sprintf("igris:billing:%s:current_spend", tenantID)
	return be.redis.Set(ctx, currentSpendKey, "0.00", 0).Err()
}

// GetTenantSpend gets the current spend for a tenant
func (be *BudgetEnforcer) GetTenantSpend(ctx context.Context, tenantID string) (float64, error) {
	currentSpendKey := fmt.Sprintf("igris:billing:%s:current_spend", tenantID)
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
