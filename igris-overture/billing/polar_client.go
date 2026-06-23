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
	apiKey        string
	baseURL       string
	redis         *redis.Client
	logger        *log.Logger
	webhookSecret string
}

// PolarConfig holds Polar client configuration
type PolarConfig struct {
	APIKey        string
	BaseURL       string
	Redis         *redis.Client
	WebhookSecret string
}

// getEnvOrDefault returns the value of the environment variable key, or
// fallback if the variable is not set or is empty.
func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// NewPolarClient creates a new Polar.sh API client.
// Price IDs are resolved from environment variables at construction time so that
// operators can set them without recompiling:
//
//	POLAR_PRICE_SEED      — monthly price ID for the Seed plan
//	POLAR_PRICE_HORIZON   — monthly price ID for the Horizon plan
//	POLAR_PRICE_INFINITE  — monthly price ID for the Infinite plan
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

	// Override price IDs from environment variables at runtime.
	// This lets operators set the real Polar price IDs without touching source.
	PlanSeed.MonthlyPriceID = getEnvOrDefault("POLAR_PRICE_SEED", PlanSeed.MonthlyPriceID)
	PlanHorizon.MonthlyPriceID = getEnvOrDefault("POLAR_PRICE_HORIZON", PlanHorizon.MonthlyPriceID)
	PlanInfinite.MonthlyPriceID = getEnvOrDefault("POLAR_PRICE_INFINITE", PlanInfinite.MonthlyPriceID)

	client := &PolarClient{
		apiKey:        cfg.APIKey,
		baseURL:       cfg.BaseURL,
		redis:         cfg.Redis,
		logger:        log.Default(),
		webhookSecret: cfg.WebhookSecret,
	}

	client.logger.Printf("[Polar] Client initialized (baseURL: %s)", cfg.BaseURL)
	client.logger.Printf("[Polar] Price IDs: seed=%s horizon=%s infinite=%s",
		PlanSeed.MonthlyPriceID, PlanHorizon.MonthlyPriceID, PlanInfinite.MonthlyPriceID)

	return client, nil
}

// ============================================================================
// SUBSCRIPTION MODELS
// ============================================================================

// SubscriptionStatus represents Polar subscription state
type SubscriptionStatus string

const (
	StatusActive     SubscriptionStatus = "active"
	StatusPastDue    SubscriptionStatus = "past_due"
	StatusCanceled   SubscriptionStatus = "canceled"
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
	CanceledAt       *time.Time         `json:"canceled_at,omitempty"`
	CreatedAt        time.Time          `json:"created_at"`
	Metadata         map[string]string  `json:"metadata,omitempty"`
}

// TierPlan represents a pricing tier
type TierPlan struct {
	ID                Tier
	Name              string
	MonthlyPriceID    string
	MonthlyPriceCents int
	RuntimeLimit      int
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

var (
	// PlanSeed - $29/mo, 3 runtime instances
	PlanSeed = TierPlan{
		ID:                TierSeed,
		Name:              "Seed",
		MonthlyPriceID:    "price_seed_monthly", // Set in Polar dashboard
		MonthlyPriceCents: 2900,
		RuntimeLimit:      3,
	}

	// PlanHorizon - $149/mo, 50 runtime instances
	PlanHorizon = TierPlan{
		ID:                TierHorizon,
		Name:              "Horizon",
		MonthlyPriceID:    "price_horizon_monthly", // Set in Polar dashboard
		MonthlyPriceCents: 14900,
		RuntimeLimit:      50,
	}

	// PlanInfinite - $699/mo, 500 runtime instances
	PlanInfinite = TierPlan{
		ID:                TierInfinite,
		Name:              "Infinite",
		MonthlyPriceID:    "price_infinite_monthly", // Set in Polar dashboard
		MonthlyPriceCents: 69900,
		RuntimeLimit:      500,
	}
)

// init binds each plan's Polar price ID to the same env vars the checkout side
// uses (POLAR_PRICE_SEED/HORIZON/INFINITE), falling back to the placeholder when
// unset. This keeps webhook tier resolution (GetTierByPriceID / ResolveTierID)
// consistent with the real price IDs configured in the Polar dashboard, so a
// customer's subscription is tiered correctly after checkout. With the env unset
// (tests, local), the placeholders remain unchanged.
func init() {
	if v := os.Getenv("POLAR_PRICE_SEED"); v != "" {
		PlanSeed.MonthlyPriceID = v
	}
	if v := os.Getenv("POLAR_PRICE_HORIZON"); v != "" {
		PlanHorizon.MonthlyPriceID = v
	}
	if v := os.Getenv("POLAR_PRICE_INFINITE"); v != "" {
		PlanInfinite.MonthlyPriceID = v
	}
}

// GetTierByID returns tier plan by ID
func GetTierByID(tierID string) (*TierPlan, error) {
	switch Tier(tierID) {
	case TierSeed:
		return &PlanSeed, nil
	case TierHorizon:
		return &PlanHorizon, nil
	case TierInfinite:
		return &PlanInfinite, nil
	default:
		return nil, fmt.Errorf("unknown tier: %s", tierID)
	}
}

// GetTierByPriceID returns tier plan by Polar price ID
func GetTierByPriceID(priceID string) (*TierPlan, error) {
	tiers := []*TierPlan{&PlanSeed, &PlanHorizon, &PlanInfinite}
	for _, tier := range tiers {
		if tier.MonthlyPriceID == priceID {
			return tier, nil
		}
	}
	return nil, fmt.Errorf("unknown price ID: %s", priceID)
}

// AllPlans returns all available tier plans in order.
func AllPlans() []TierPlan {
	return []TierPlan{PlanSeed, PlanHorizon, PlanInfinite}
}

// ResolveTierID determines the canonical tier for a subscription payload.
// It first trusts an explicit tier in metadata, then falls back to a known price ID.
func ResolveTierID(metadata map[string]string, priceID string) (string, error) {
	if metadata != nil {
		if tierID := metadata["tier"]; tierID != "" {
			if _, err := GetTierByID(tierID); err != nil {
				return "", err
			}
			return tierID, nil
		}
	}

	if priceID == "" {
		return "", errors.New("subscription tier and price ID are both missing")
	}

	tier, err := GetTierByPriceID(priceID)
	if err != nil {
		return "", err
	}
	return string(tier.ID), nil
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

// GetSubscription retrieves subscription from Redis cache or Polar API
func (c *PolarClient) GetSubscription(ctx context.Context, tenantID string) (*Subscription, error) {
	cacheKey := fmt.Sprintf("polar:subscription:%s", tenantID)
	cached, err := c.redis.Get(ctx, cacheKey).Result()
	if err == nil && cached != "" {
		return c.getSubscriptionFromPolar(ctx, cached)
	}

	sub, err := c.getSubscriptionFromPolar(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	c.cacheSubscription(ctx, tenantID, sub)
	return sub, nil
}

// getSubscriptionFromPolar fetches subscription from Polar API
// TODO: Replace with actual Polar Go SDK calls once available
func (c *PolarClient) getSubscriptionFromPolar(ctx context.Context, tenantID string) (*Subscription, error) {
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

// UpdateSubscription updates subscription in cache (from webhook)
func (c *PolarClient) UpdateSubscription(ctx context.Context, sub *Subscription) error {
	tenantID := sub.CustomerID

	// Determine tier from price ID
	tier, err := ResolveTierID(sub.Metadata, sub.PriceID)
	if err != nil {
		return fmt.Errorf("failed to resolve subscription tier for tenant %s: %w", tenantID, err)
	}

	if sub.Metadata == nil {
		sub.Metadata = make(map[string]string)
	}
	sub.Metadata["tier"] = tier

	subKey := fmt.Sprintf("polar:sub:%s", tenantID)
	err = c.redis.HSet(ctx, subKey,
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
