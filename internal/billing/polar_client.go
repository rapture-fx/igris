// Package billing provides Polar.sh integration for subscription management
package billing

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// ============================================================================
// POLAR CLIENT
// ============================================================================

// PolarClient wraps Polar.sh API interactions
type PolarClient struct {
	apiKey      string
	baseURL     string
	redis       *redis.Client
	logger      *log.Logger
	webhookSecret string
}

// PolarConfig holds Polar client configuration
type PolarConfig struct {
	APIKey        string
	BaseURL       string
	Redis         *redis.Client
	WebhookSecret string
}

// NewPolarClient creates a new Polar.sh API client
func NewPolarClient(cfg PolarConfig) (*PolarClient, error) {
	if cfg.APIKey == "" {
		return nil, errors.New("POLAR_API_KEY required")
	}

	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.polar.sh"
	}

	if cfg.Redis == nil {
		return nil, errors.New("Redis client required")
	}

	client := &PolarClient{
		apiKey:        cfg.APIKey,
		baseURL:       cfg.BaseURL,
		redis:         cfg.Redis,
		logger:        log.Default(),
		webhookSecret: cfg.WebhookSecret,
	}

	client.logger.Printf("[Polar] Client initialized (baseURL: %s)", cfg.BaseURL)

	return client, nil
}

// ============================================================================
// SUBSCRIPTION MODELS
// ============================================================================

// SubscriptionStatus represents Polar subscription state
type SubscriptionStatus string

const (
	StatusActive    SubscriptionStatus = "active"
	StatusTrialing  SubscriptionStatus = "trialing"
	StatusPastDue   SubscriptionStatus = "past_due"
	StatusCanceled  SubscriptionStatus = "canceled"
	StatusIncomplete SubscriptionStatus = "incomplete"
)

// Subscription represents a Polar subscription
type Subscription struct {
	ID               string             `json:"id"`
	CustomerID       string             `json:"customer_id"`
	ProductID        string             `json:"product_id"`
	PriceID          string             `json:"price_id"`
	Status           SubscriptionStatus `json:"status"`
	CurrentPeriodEnd time.Time          `json:"current_period_end"`
	TrialEnd         *time.Time         `json:"trial_end,omitempty"`
	CanceledAt       *time.Time         `json:"canceled_at,omitempty"`
	CreatedAt        time.Time          `json:"created_at"`
	Metadata         map[string]string  `json:"metadata,omitempty"`
}

// TierPlan represents a pricing tier
type TierPlan struct {
	ID                     string
	Name                   string
	MonthlyPriceID         string
	AnnualPriceID          string
	MonthlyPriceCents      int
	AnnualPriceCents       int
	MaxRequestsPerMonth    int
	MaxProviders           int
	MaxTenants             int
	Features               TierFeatures
}

// TierFeatures holds feature flags per tier
type TierFeatures struct {
	ThompsonSampling     bool
	QualityRouting       bool
	CircuitBreaker       bool
	CostTracking         bool
	BYOK                 bool
	SpeculativeExecution bool
	CouncilMode          bool
	CognitiveAdvisor     bool
	SLOEnforcer          string // "none", "basic", "advanced"
	AuditLogs            bool
	PolicyEngine         bool
	SelfHost             bool
	MultiTenancy         int // number of tenants
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

var (
	// TierTrial - 14-day free trial
	TierTrial = TierPlan{
		ID:                  "trial",
		Name:                "Trial",
		MonthlyPriceID:      "", // No price ID for trial
		AnnualPriceID:       "",
		MonthlyPriceCents:   0,
		AnnualPriceCents:    0,
		MaxRequestsPerMonth: 50000,
		MaxProviders:        3,
		MaxTenants:          1,
		Features: TierFeatures{
			ThompsonSampling:     true,
			QualityRouting:       true,
			CircuitBreaker:       true,
			CostTracking:         true,
			BYOK:                 true,
			SpeculativeExecution: true, // Full features for trial
			CouncilMode:          true,
			CognitiveAdvisor:     true,
			SLOEnforcer:          "none",
			AuditLogs:            false,
			PolicyEngine:         false,
			SelfHost:             false,
			MultiTenancy:         1,
		},
	}

	// TierDevelop - $99/mo entry tier
	TierDevelop = TierPlan{
		ID:                  "develop",
		Name:                "Develop",
		MonthlyPriceID:      "price_develop_monthly", // Set in Polar dashboard
		AnnualPriceID:       "price_develop_annual",
		MonthlyPriceCents:   9900,    // $99.00
		AnnualPriceCents:    95000,   // $950/year (save 20%)
		MaxRequestsPerMonth: 500000,
		MaxProviders:        5,
		MaxTenants:          1,
		Features: TierFeatures{
			ThompsonSampling:     true,
			QualityRouting:       true,
			CircuitBreaker:       true,
			CostTracking:         true,
			BYOK:                 true,
			SpeculativeExecution: false,
			CouncilMode:          false,
			CognitiveAdvisor:     false,
			SLOEnforcer:          "none",
			AuditLogs:            false,
			PolicyEngine:         false,
			SelfHost:             false,
			MultiTenancy:         1,
		},
	}

	// TierGrowth - $499/mo mid-tier
	TierGrowth = TierPlan{
		ID:                  "growth",
		Name:                "Growth",
		MonthlyPriceID:      "price_growth_monthly",
		AnnualPriceID:       "price_growth_annual",
		MonthlyPriceCents:   49900,   // $499.00
		AnnualPriceCents:    479000,  // $4,790/year (save 20%)
		MaxRequestsPerMonth: 2000000,
		MaxProviders:        10,
		MaxTenants:          5,
		Features: TierFeatures{
			ThompsonSampling:     true,
			QualityRouting:       true,
			CircuitBreaker:       true,
			CostTracking:         true,
			BYOK:                 true,
			SpeculativeExecution: true,
			CouncilMode:          true,
			CognitiveAdvisor:     true,
			SLOEnforcer:          "basic",
			AuditLogs:            true,
			PolicyEngine:         true,
			SelfHost:             false,
			MultiTenancy:         5,
		},
	}

	// TierScale - $1,499/mo high-tier
	TierScale = TierPlan{
		ID:                  "scale",
		Name:                "Scale",
		MonthlyPriceID:      "price_scale_monthly",
		AnnualPriceID:       "price_scale_annual",
		MonthlyPriceCents:   149900,  // $1,499.00
		AnnualPriceCents:    1439000, // $14,390/year (save 20%)
		MaxRequestsPerMonth: -1,      // Unlimited
		MaxProviders:        20,
		MaxTenants:          -1, // Unlimited
		Features: TierFeatures{
			ThompsonSampling:     true,
			QualityRouting:       true,
			CircuitBreaker:       true,
			CostTracking:         true,
			BYOK:                 true,
			SpeculativeExecution: true,
			CouncilMode:          true,
			CognitiveAdvisor:     true,
			SLOEnforcer:          "advanced",
			AuditLogs:            true,
			PolicyEngine:         true,
			SelfHost:             true,
			MultiTenancy:         -1, // Unlimited
		},
	}

	// TierEnterprise - $5k+ custom (parked)
	TierEnterprise = TierPlan{
		ID:                  "enterprise",
		Name:                "Enterprise",
		MonthlyPriceID:      "price_enterprise_custom",
		AnnualPriceID:       "",
		MonthlyPriceCents:   500000, // $5,000 base
		AnnualPriceCents:    0,
		MaxRequestsPerMonth: -1,
		MaxProviders:        -1,
		MaxTenants:          -1,
		Features: TierFeatures{
			ThompsonSampling:     true,
			QualityRouting:       true,
			CircuitBreaker:       true,
			CostTracking:         true,
			BYOK:                 true,
			SpeculativeExecution: true,
			CouncilMode:          true,
			CognitiveAdvisor:     true,
			SLOEnforcer:          "advanced",
			AuditLogs:            true,
			PolicyEngine:         true,
			SelfHost:             true,
			MultiTenancy:         -1,
		},
	}
)

// GetTierByID returns tier plan by ID
func GetTierByID(tierID string) (*TierPlan, error) {
	switch tierID {
	case "trial":
		return &TierTrial, nil
	case "develop":
		return &TierDevelop, nil
	case "growth":
		return &TierGrowth, nil
	case "scale":
		return &TierScale, nil
	case "enterprise":
		return &TierEnterprise, nil
	default:
		return nil, fmt.Errorf("unknown tier: %s", tierID)
	}
}

// GetTierByPriceID returns tier plan by Polar price ID
func GetTierByPriceID(priceID string) (*TierPlan, error) {
	tiers := []*TierPlan{&TierDevelop, &TierGrowth, &TierScale, &TierEnterprise}

	for _, tier := range tiers {
		if tier.MonthlyPriceID == priceID || tier.AnnualPriceID == priceID {
			return tier, nil
		}
	}

	return nil, fmt.Errorf("unknown price ID: %s", priceID)
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

// GetSubscription retrieves subscription from Redis cache or Polar API
func (c *PolarClient) GetSubscription(ctx context.Context, tenantID string) (*Subscription, error) {
	// Try Redis cache first
	cacheKey := fmt.Sprintf("polar:subscription:%s", tenantID)
	cached, err := c.redis.Get(ctx, cacheKey).Result()
	if err == nil && cached != "" {
		// Parse cached subscription (simplified - in production use JSON)
		return c.getSubscriptionFromPolar(ctx, cached)
	}

	// Fallback to Polar API (mock for now)
	sub, err := c.getSubscriptionFromPolar(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Cache for 5 minutes
	c.cacheSubscription(ctx, tenantID, sub)

	return sub, nil
}

// getSubscriptionFromPolar fetches subscription from Polar API
// TODO: Replace with actual Polar Go SDK calls once available
func (c *PolarClient) getSubscriptionFromPolar(ctx context.Context, tenantID string) (*Subscription, error) {
	// Placeholder: In production, use Polar Go SDK
	// For now, return mock data or read from database

	// Check if trial subscription exists
	trialKey := fmt.Sprintf("polar:trial:%s", tenantID)
	trialEnd, err := c.redis.Get(ctx, trialKey).Result()
	if err == nil && trialEnd != "" {
		endTime, _ := time.Parse(time.RFC3339, trialEnd)
		return &Subscription{
			ID:               fmt.Sprintf("sub_trial_%s", tenantID),
			CustomerID:       tenantID,
			ProductID:        "prod_trial",
			PriceID:          "",
			Status:           StatusTrialing,
			CurrentPeriodEnd: endTime,
			TrialEnd:         &endTime,
			CreatedAt:        time.Now().Add(-7 * 24 * time.Hour),
			Metadata: map[string]string{
				"tier": "trial",
			},
		}, nil
	}

	// Check if paid subscription exists in Redis
	subKey := fmt.Sprintf("polar:sub:%s", tenantID)
	subData, err := c.redis.HGetAll(ctx, subKey).Result()
	if err == nil && len(subData) > 0 {
		status := SubscriptionStatus(subData["status"])
		periodEnd, _ := time.Parse(time.RFC3339, subData["current_period_end"])

		return &Subscription{
			ID:               subData["id"],
			CustomerID:       tenantID,
			ProductID:        subData["product_id"],
			PriceID:          subData["price_id"],
			Status:           status,
			CurrentPeriodEnd: periodEnd,
			CreatedAt:        time.Now(),
			Metadata: map[string]string{
				"tier": subData["tier"],
			},
		}, nil
	}

	return nil, fmt.Errorf("no subscription found for tenant: %s", tenantID)
}

// cacheSubscription stores subscription in Redis
func (c *PolarClient) cacheSubscription(ctx context.Context, tenantID string, sub *Subscription) {
	cacheKey := fmt.Sprintf("polar:subscription:%s", tenantID)
	c.redis.Set(ctx, cacheKey, sub.ID, 5*time.Minute)
}

// CreateTrialSubscription creates a 14-day trial subscription
func (c *PolarClient) CreateTrialSubscription(ctx context.Context, tenantID, email string) (*Subscription, error) {
	trialEnd := time.Now().Add(14 * 24 * time.Hour)

	// Store trial in Redis
	trialKey := fmt.Sprintf("polar:trial:%s", tenantID)
	err := c.redis.Set(ctx, trialKey, trialEnd.Format(time.RFC3339), 15*24*time.Hour).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to create trial: %w", err)
	}

	// Initialize request counter
	reqKey := fmt.Sprintf("polar:requests:%s", tenantID)
	c.redis.Set(ctx, reqKey, 0, 15*24*time.Hour)

	c.logger.Printf("[Polar] Trial created: tenant=%s ends=%s", tenantID, trialEnd.Format(time.RFC3339))

	return &Subscription{
		ID:               fmt.Sprintf("sub_trial_%s", tenantID),
		CustomerID:       tenantID,
		ProductID:        "prod_trial",
		PriceID:          "",
		Status:           StatusTrialing,
		CurrentPeriodEnd: trialEnd,
		TrialEnd:         &trialEnd,
		CreatedAt:        time.Now(),
		Metadata: map[string]string{
			"tier":  "trial",
			"email": email,
		},
	}, nil
}

// UpdateSubscription updates subscription in cache (from webhook)
func (c *PolarClient) UpdateSubscription(ctx context.Context, sub *Subscription) error {
	tenantID := sub.CustomerID

	// Determine tier from price ID
	tier := sub.Metadata["tier"]
	if tier == "" {
		tierPlan, err := GetTierByPriceID(sub.PriceID)
		if err == nil {
			tier = tierPlan.ID
		}
	}

	// Store in Redis
	subKey := fmt.Sprintf("polar:sub:%s", tenantID)
	err := c.redis.HSet(ctx, subKey,
		"id", sub.ID,
		"product_id", sub.ProductID,
		"price_id", sub.PriceID,
		"status", string(sub.Status),
		"tier", tier,
		"current_period_end", sub.CurrentPeriodEnd.Format(time.RFC3339),
	).Err()

	if err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	// Clear cache
	cacheKey := fmt.Sprintf("polar:subscription:%s", tenantID)
	c.redis.Del(ctx, cacheKey)

	c.logger.Printf("[Polar] Subscription updated: tenant=%s status=%s tier=%s",
		tenantID, sub.Status, tier)

	return nil
}

// ============================================================================
// REQUEST LIMIT TRACKING
// ============================================================================

// IncrementRequestCount increments request counter for tenant
func (c *PolarClient) IncrementRequestCount(ctx context.Context, tenantID string) (int64, error) {
	reqKey := fmt.Sprintf("polar:requests:%s", tenantID)
	count, err := c.redis.Incr(ctx, reqKey).Result()
	if err != nil {
		return 0, err
	}

	// Set TTL if first request (monthly reset)
	if count == 1 {
		now := time.Now()
		nextMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())
		ttl := nextMonth.Sub(now)
		c.redis.Expire(ctx, reqKey, ttl)
	}

	return count, nil
}

// GetRequestCount returns current request count
func (c *PolarClient) GetRequestCount(ctx context.Context, tenantID string) (int64, error) {
	reqKey := fmt.Sprintf("polar:requests:%s", tenantID)
	count, err := c.redis.Get(ctx, reqKey).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return count, err
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

// MigrateLegacyTier maps old tier pricing to new tiers
func MigrateLegacyTier(oldTier string, oldPriceCents int) string {
	// Map old pricing to new tiers
	switch {
	case oldPriceCents == 24900: // Old Develop $249 -> New Develop $99
		return "develop"
	case oldPriceCents == 79900: // Old Growth $799 -> New Growth $499
		return "growth"
	case oldPriceCents == 189900: // Old Scale $1,899 -> New Scale $1,499
		return "scale"
	default:
		// Fallback to tier name mapping
		switch oldTier {
		case "developer", "develop":
			return "develop"
		case "growth":
			return "growth"
		case "scale":
			return "scale"
		case "enterprise":
			return "enterprise"
		default:
			return "develop" // Default to develop
		}
	}
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// LoadPolarConfig loads config from environment
func LoadPolarConfig(redis *redis.Client) (*PolarConfig, error) {
	apiKey := os.Getenv("POLAR_API_KEY")
	if apiKey == "" {
		return nil, errors.New("POLAR_API_KEY environment variable required")
	}

	webhookSecret := os.Getenv("POLAR_WEBHOOK_SECRET")
	if webhookSecret == "" {
		log.Println("[Polar] WARNING: POLAR_WEBHOOK_SECRET not set - webhook verification disabled")
	}

	return &PolarConfig{
		APIKey:        apiKey,
		BaseURL:       os.Getenv("POLAR_BASE_URL"),
		Redis:         redis,
		WebhookSecret: webhookSecret,
	}, nil
}
