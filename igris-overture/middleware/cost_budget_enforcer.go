package middleware

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// CostBudgetEnforcer enforces cost budgets for tenants
type CostBudgetEnforcer struct {
	db          *sql.DB
	redisClient *redis.Client
	config      *CostBudgetConfig

	// In-memory cache for budget info
	budgetCache map[string]*TenantBudget
	cacheMu     sync.RWMutex
	cacheTTL    time.Duration
}

// CostBudgetConfig holds budget enforcement configuration
type CostBudgetConfig struct {
	DB               *sql.DB
	RedisClient      *redis.Client
	AlertLimitPercent float64 // Alert at this percentage (default: 0.75 = 75%)
	SoftLimitPercent  float64 // Warn at this percentage (default: 0.90 = 90%)
	HardLimitPercent  float64 // Block at this percentage (default: 1.00 = 100%)
	CacheTTL          time.Duration
	EnableBlocking    bool // If false, only warn, don't block
}

// TenantBudget represents a tenant's budget configuration and usage
type TenantBudget struct {
	TenantID        string
	MonthlyBudgetUSD float64
	CurrentSpendUSD  float64
	BudgetResetAt   time.Time
	SoftLimitHit    bool
	HardLimitHit    bool
	EnforceBudget   bool
	LastUpdated     time.Time
}

// NewCostBudgetEnforcer creates a new cost budget enforcer
func NewCostBudgetEnforcer(config *CostBudgetConfig) (*CostBudgetEnforcer, error) {
	if config.DB == nil {
		return nil, fmt.Errorf("database connection is required")
	}

	if config.AlertLimitPercent == 0 {
		config.AlertLimitPercent = 0.75 // 75% - P0-5 FIX: Alert threshold
	}
	if config.SoftLimitPercent == 0 {
		config.SoftLimitPercent = 0.90 // 90%
	}
	if config.HardLimitPercent == 0 {
		config.HardLimitPercent = 1.00 // 100%
	}
	if config.CacheTTL == 0 {
		config.CacheTTL = 1 * time.Minute
	}

	enforcer := &CostBudgetEnforcer{
		db:          config.DB,
		redisClient: config.RedisClient,
		config:      config,
		budgetCache: make(map[string]*TenantBudget),
		cacheTTL:    config.CacheTTL,
	}

	return enforcer, nil
}

// Middleware enforces cost budget limits
func (e *CostBudgetEnforcer) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Extract tenant ID
		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Next() // No tenant, skip enforcement
		}

		tenantIDStr, ok := tenantID.(string)
		if !ok {
			return c.Next()
		}

		// Get estimated request cost (set by cost forecast middleware)
		estimatedCost := c.Locals("estimated_cost_usd")
		var costUSD float64
		if estimatedCost != nil {
			if cost, ok := estimatedCost.(float64); ok {
				costUSD = cost
			}
		}

		// Check budget before processing request
		canProceed, warning, err := e.checkBudgetPreAuth(c.Context(), tenantIDStr, costUSD)
		if err != nil {
			// Log error but don't block request on enforcement error
			return c.Next()
		}

		// Set warning header if soft limit reached
		if warning != nil {
			c.Set("X-Igris-Budget-Warning", warning.Message)
			c.Set("X-Igris-Budget-Usage", fmt.Sprintf("%.2f%%", warning.UsagePercent))
		}

		// Block if hard limit reached and blocking enabled
		if !canProceed && e.config.EnableBlocking {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":   "budget_exceeded",
				"message": "Monthly cost budget exceeded. Please upgrade your plan or increase your budget.",
				"details": map[string]interface{}{
					"current_spend_usd":  warning.CurrentSpend,
					"monthly_budget_usd": warning.MonthlyBudget,
					"usage_percent":      warning.UsagePercent,
					"reset_at":           warning.ResetAt,
				},
				"action_required": "upgrade_or_increase_budget",
				"contact": "support@igris-inertial.com",
			})
		}

		// Process request
		err = c.Next()

		// Record actual cost after request (if available)
		actualCost := c.Locals("actual_cost_usd")
		if actualCost != nil {
			if cost, ok := actualCost.(float64); ok {
				e.incrementSpend(c.Context(), tenantIDStr, cost)
			}
		}

		return err
	}
}

// checkBudgetPreAuth checks if request can proceed based on budget
func (e *CostBudgetEnforcer) checkBudgetPreAuth(ctx context.Context, tenantID string, estimatedCost float64) (canProceed bool, warning *BudgetWarning, err error) {
	// Get tenant budget
	budget, err := e.getTenantBudget(ctx, tenantID)
	if err != nil {
		return true, nil, err // Allow on error
	}

	// If budget enforcement disabled for tenant, allow
	if !budget.EnforceBudget {
		return true, nil, nil
	}

	// If no budget set (0 or unlimited), allow
	if budget.MonthlyBudgetUSD <= 0 {
		return true, nil, nil
	}

	// Calculate projected spend
	projectedSpend := budget.CurrentSpendUSD + estimatedCost
	usagePercent := (projectedSpend / budget.MonthlyBudgetUSD) * 100

	// Check hard limit
	if projectedSpend >= budget.MonthlyBudgetUSD*e.config.HardLimitPercent {
		warning = &BudgetWarning{
			Level:          "critical",
			Message:        "Monthly budget limit reached",
			CurrentSpend:   budget.CurrentSpendUSD,
			ProjectedSpend: projectedSpend,
			MonthlyBudget:  budget.MonthlyBudgetUSD,
			UsagePercent:   usagePercent,
			ResetAt:        budget.BudgetResetAt,
		}
		return false, warning, nil
	}

	// Check soft limit (90%)
	if projectedSpend >= budget.MonthlyBudgetUSD*e.config.SoftLimitPercent {
		warning = &BudgetWarning{
			Level:          "warning",
			Message:        fmt.Sprintf("Approaching budget limit (%.0f%% used)", usagePercent),
			CurrentSpend:   budget.CurrentSpendUSD,
			ProjectedSpend: projectedSpend,
			MonthlyBudget:  budget.MonthlyBudgetUSD,
			UsagePercent:   usagePercent,
			ResetAt:        budget.BudgetResetAt,
		}
		return true, warning, nil
	}

	// Check alert threshold (75%) - P0-5 FIX: Added 75% alert
	if projectedSpend >= budget.MonthlyBudgetUSD*e.config.AlertLimitPercent {
		warning = &BudgetWarning{
			Level:          "alert",
			Message:        fmt.Sprintf("Budget usage at %.0f%% - consider reviewing usage", usagePercent),
			CurrentSpend:   budget.CurrentSpendUSD,
			ProjectedSpend: projectedSpend,
			MonthlyBudget:  budget.MonthlyBudgetUSD,
			UsagePercent:   usagePercent,
			ResetAt:        budget.BudgetResetAt,
		}
		return true, warning, nil
	}

	return true, nil, nil
}

// getTenantBudget retrieves tenant budget from cache or database
func (e *CostBudgetEnforcer) getTenantBudget(ctx context.Context, tenantID string) (*TenantBudget, error) {
	// Check cache first
	e.cacheMu.RLock()
	if budget, ok := e.budgetCache[tenantID]; ok {
		if time.Since(budget.LastUpdated) < e.cacheTTL {
			e.cacheMu.RUnlock()
			return budget, nil
		}
	}
	e.cacheMu.RUnlock()

	// Load from database
	budget, err := e.loadBudgetFromDB(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Update cache
	e.cacheMu.Lock()
	e.budgetCache[tenantID] = budget
	e.cacheMu.Unlock()

	return budget, nil
}

// loadBudgetFromDB loads budget information from database
func (e *CostBudgetEnforcer) loadBudgetFromDB(ctx context.Context, tenantID string) (*TenantBudget, error) {
	query := `
		SELECT
			id,
			monthly_budget_usd,
			current_month_spend,
			budget_reset_at,
			enforce_budget
		FROM tenants
		WHERE id = $1
	`

	var budget TenantBudget
	var budgetResetAt sql.NullTime

	err := e.db.QueryRowContext(ctx, query, tenantID).Scan(
		&budget.TenantID,
		&budget.MonthlyBudgetUSD,
		&budget.CurrentSpendUSD,
		&budgetResetAt,
		&budget.EnforceBudget,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tenant not found")
		}
		return nil, err
	}

	if budgetResetAt.Valid {
		budget.BudgetResetAt = budgetResetAt.Time
	} else {
		// Default to start of next month
		now := time.Now()
		budget.BudgetResetAt = time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	}

	budget.LastUpdated = time.Now()

	// Check if limits are hit
	if budget.MonthlyBudgetUSD > 0 {
		usagePercent := budget.CurrentSpendUSD / budget.MonthlyBudgetUSD
		budget.SoftLimitHit = usagePercent >= e.config.SoftLimitPercent
		budget.HardLimitHit = usagePercent >= e.config.HardLimitPercent
	}

	return &budget, nil
}

// incrementSpend atomically increments tenant spend
func (e *CostBudgetEnforcer) incrementSpend(ctx context.Context, tenantID string, costUSD float64) error {
	// Use Redis for atomic increment if available
	if e.redisClient != nil {
		key := fmt.Sprintf("igris:budget:spend:%s", tenantID)
		return e.redisClient.IncrByFloat(ctx, key, costUSD).Err()
	}

	// Fall back to database increment
	query := `
		UPDATE tenants
		SET
			current_month_spend = current_month_spend + $1,
			updated_at = NOW()
		WHERE id = $2
	`

	_, err := e.db.ExecContext(ctx, query, costUSD, tenantID)
	if err != nil {
		return err
	}

	// Invalidate cache
	e.cacheMu.Lock()
	delete(e.budgetCache, tenantID)
	e.cacheMu.Unlock()

	return nil
}

// GetBudgetStatus returns current budget status for a tenant
func (e *CostBudgetEnforcer) GetBudgetStatus(ctx context.Context, tenantID string) (*BudgetStatus, error) {
	budget, err := e.getTenantBudget(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var usagePercent float64
	if budget.MonthlyBudgetUSD > 0 {
		usagePercent = (budget.CurrentSpendUSD / budget.MonthlyBudgetUSD) * 100
	}

	remainingBudget := budget.MonthlyBudgetUSD - budget.CurrentSpendUSD
	if remainingBudget < 0 {
		remainingBudget = 0
	}

	return &BudgetStatus{
		TenantID:         budget.TenantID,
		MonthlyBudgetUSD: budget.MonthlyBudgetUSD,
		CurrentSpendUSD:  budget.CurrentSpendUSD,
		RemainingUSD:     remainingBudget,
		UsagePercent:     usagePercent,
		SoftLimitHit:     budget.SoftLimitHit,
		HardLimitHit:     budget.HardLimitHit,
		ResetAt:          budget.BudgetResetAt,
		EnforceBudget:    budget.EnforceBudget,
	}, nil
}

// ResetMonthlyBudgets resets all tenant budgets (run on first day of month)
func (e *CostBudgetEnforcer) ResetMonthlyBudgets(ctx context.Context) (int64, error) {
	query := `
		UPDATE tenants
		SET
			current_month_spend = 0,
			budget_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
			soft_limit_warning_sent = false,
			hard_limit_reached_at = NULL,
			updated_at = NOW()
		WHERE budget_reset_at < NOW()
	`

	result, err := e.db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}

	// Clear cache
	e.cacheMu.Lock()
	e.budgetCache = make(map[string]*TenantBudget)
	e.cacheMu.Unlock()

	return result.RowsAffected()
}

// BudgetWarning represents a budget warning
type BudgetWarning struct {
	Level          string    // "warning" or "critical"
	Message        string
	CurrentSpend   float64
	ProjectedSpend float64
	MonthlyBudget  float64
	UsagePercent   float64
	ResetAt        time.Time
}

// BudgetStatus represents the current budget status
type BudgetStatus struct {
	TenantID         string    `json:"tenant_id"`
	MonthlyBudgetUSD float64   `json:"monthly_budget_usd"`
	CurrentSpendUSD  float64   `json:"current_spend_usd"`
	RemainingUSD     float64   `json:"remaining_usd"`
	UsagePercent     float64   `json:"usage_percent"`
	SoftLimitHit     bool      `json:"soft_limit_hit"`
	HardLimitHit     bool      `json:"hard_limit_hit"`
	ResetAt          time.Time `json:"reset_at"`
	EnforceBudget    bool      `json:"enforce_budget"`
}

// HandleGetBudgetStatus returns budget status for the authenticated tenant
func (e *CostBudgetEnforcer) HandleGetBudgetStatus() fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "tenant_not_authenticated",
			})
		}

		status, err := e.GetBudgetStatus(c.Context(), tenantID.(string))
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "failed_to_get_budget_status",
				"message": err.Error(),
			})
		}

		return c.JSON(status)
	}
}
