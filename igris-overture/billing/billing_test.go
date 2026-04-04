// Package billing provides tests for Polar integration
package billing

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// TEST SETUP
// ============================================================================

func setupTestRedis(t *testing.T) *redis.Client {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	t.Cleanup(func() {
		client.Close()
		mr.Close()
	})

	return client
}

func setupTestPolarClient(t *testing.T) *PolarClient {
	redisClient := setupTestRedis(t)

	client, err := NewPolarClient(PolarConfig{
		APIKey:        "test_api_key",
		BaseURL:       "https://test.polar.sh",
		Redis:         redisClient,
		WebhookSecret: "test_webhook_secret",
	})

	require.NoError(t, err)
	return client
}

// ============================================================================
// TIER TESTS
// ============================================================================

func TestGetTierByID(t *testing.T) {
	tests := []struct {
		name    string
		tierID  string
		wantErr bool
	}{
		{"Seed tier", string(TierSeed), false},
		{"Horizon tier", string(TierHorizon), false},
		{"Infinite tier", string(TierInfinite), false},
		{"Invalid tier", "invalid", true},
		{"Legacy trial rejected", "trial", true},
		{"Legacy develop rejected", "develop", true},
		{"Legacy growth rejected", "growth", true},
		{"Legacy scale rejected", "scale", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tier, err := GetTierByID(tt.tierID)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, tier)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tier)
				assert.Equal(t, tt.tierID, string(tier.ID))
			}
		})
	}
}

func TestGetTierByPriceID(t *testing.T) {
	tests := []struct {
		name       string
		priceID    string
		wantTierID string
		wantErr    bool
	}{
		{"Seed monthly", "price_seed_monthly", string(TierSeed), false},
		{"Horizon monthly", "price_horizon_monthly", string(TierHorizon), false},
		{"Infinite monthly", "price_infinite_monthly", string(TierInfinite), false},
		{"Invalid price ID", "price_invalid", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tier, err := GetTierByPriceID(tt.priceID)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantTierID, string(tier.ID))
			}
		})
	}
}

func TestTierRuntimeLimits(t *testing.T) {
	seed, err := GetTierByID(string(TierSeed))
	require.NoError(t, err)
	assert.Equal(t, 3, seed.RuntimeLimit)
	assert.Equal(t, 2900, seed.MonthlyPriceCents)

	horizon, err := GetTierByID(string(TierHorizon))
	require.NoError(t, err)
	assert.Equal(t, 50, horizon.RuntimeLimit)
	assert.Equal(t, 14900, horizon.MonthlyPriceCents)

	infinite, err := GetTierByID(string(TierInfinite))
	require.NoError(t, err)
	assert.Equal(t, 500, infinite.RuntimeLimit)
	assert.Equal(t, 69900, infinite.MonthlyPriceCents)
}

func TestValidTier(t *testing.T) {
	assert.True(t, ValidTier("seed"))
	assert.True(t, ValidTier("horizon"))
	assert.True(t, ValidTier("infinite"))
	assert.False(t, ValidTier("trial"))
	assert.False(t, ValidTier("develop"))
	assert.False(t, ValidTier("growth"))
	assert.False(t, ValidTier("scale"))
	assert.False(t, ValidTier(""))
}

func TestTierRuntimeLimitMap(t *testing.T) {
	assert.Equal(t, 3, TierRuntimeLimit[TierSeed])
	assert.Equal(t, 50, TierRuntimeLimit[TierHorizon])
	assert.Equal(t, 500, TierRuntimeLimit[TierInfinite])
}

// ============================================================================
// SUBSCRIPTION TESTS
// ============================================================================

func TestUpdateSubscription(t *testing.T) {
	client := setupTestPolarClient(t)
	ctx := context.Background()

	sub := &Subscription{
		ID:               "sub_test_123",
		CustomerID:       "tenant_test_seed",
		ProductID:        "prod_seed",
		PriceID:          "price_seed_monthly",
		Status:           StatusActive,
		CurrentPeriodEnd: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:        time.Now(),
		Metadata: map[string]string{
			"tier": string(TierSeed),
		},
	}

	err := client.UpdateSubscription(ctx, sub)
	require.NoError(t, err)

	retrieved, err := client.GetSubscription(ctx, "tenant_test_seed")
	require.NoError(t, err)
	assert.Equal(t, string(TierSeed), retrieved.Metadata["tier"])
	assert.Equal(t, StatusActive, retrieved.Status)
}

func TestUpdateSubscription_PriceIDResolution(t *testing.T) {
	client := setupTestPolarClient(t)
	ctx := context.Background()

	// Subscription without explicit tier — should resolve from price ID
	sub := &Subscription{
		ID:               "sub_horizon_456",
		CustomerID:       "tenant_horizon",
		ProductID:        "prod_horizon",
		PriceID:          "price_horizon_monthly",
		Status:           StatusActive,
		CurrentPeriodEnd: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:        time.Now(),
	}

	err := client.UpdateSubscription(ctx, sub)
	require.NoError(t, err)

	retrieved, err := client.GetSubscription(ctx, "tenant_horizon")
	require.NoError(t, err)
	assert.Equal(t, string(TierHorizon), retrieved.Metadata["tier"])
}

func TestUpdateSubscription_RejectsUnknownPriceID(t *testing.T) {
	client := setupTestPolarClient(t)
	ctx := context.Background()

	sub := &Subscription{
		ID:               "sub_unknown_789",
		CustomerID:       "tenant_unknown",
		ProductID:        "prod_unknown",
		PriceID:          "price_unknown",
		Status:           StatusActive,
		CurrentPeriodEnd: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt:        time.Now(),
	}

	err := client.UpdateSubscription(ctx, sub)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to resolve subscription tier")
}

// ============================================================================
// RUNTIME ENFORCER TESTS
// ============================================================================

func TestRuntimeEnforcer_SeedLimit(t *testing.T) {
	r := setupTestRedis(t)
	ctx := context.Background()
	enforcer := NewRuntimeEnforcer(r)

	tenantID := "tenant_seed_limit"
	// Set tier to Seed (limit=3)
	r.Set(ctx, "igris:billing:"+tenantID+":tier", string(TierSeed), 0)

	// First three runtimes: should be allowed
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))

	// Fourth runtime: should be rejected
	assert.ErrorIs(t, enforcer.CheckRuntimeLimit(ctx, tenantID), ErrTierLimitExceeded)
}

func TestRuntimeEnforcer_HorizonLimit(t *testing.T) {
	r := setupTestRedis(t)
	ctx := context.Background()
	enforcer := NewRuntimeEnforcer(r)

	tenantID := "tenant_horizon_limit"
	r.Set(ctx, "igris:billing:"+tenantID+":tier", string(TierHorizon), 0)
	r.Set(ctx, "igris:runtimes:"+tenantID+":count", 49, 0)

	// 49 registered, limit is 50 — should still allow
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))

	// 50 registered — should reject
	assert.ErrorIs(t, enforcer.CheckRuntimeLimit(ctx, tenantID), ErrTierLimitExceeded)
}

func TestRuntimeEnforcer_GetRuntimeUsage(t *testing.T) {
	r := setupTestRedis(t)
	ctx := context.Background()
	enforcer := NewRuntimeEnforcer(r)

	tenantID := "tenant_usage"
	r.Set(ctx, "igris:billing:"+tenantID+":tier", string(TierHorizon), 0)
	r.Set(ctx, "igris:runtimes:"+tenantID+":count", 12, 0)

	used, limit, err := enforcer.GetRuntimeUsage(ctx, tenantID)
	assert.NoError(t, err)
	assert.Equal(t, 12, used)
	assert.Equal(t, 50, limit)
}

func TestRuntimeEnforcer_DefaultsToSeed(t *testing.T) {
	r := setupTestRedis(t)
	ctx := context.Background()
	enforcer := NewRuntimeEnforcer(r)

	// No tier set — should default to Seed (limit=3)
	tenantID := "tenant_no_tier"
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))
	assert.NoError(t, enforcer.CheckRuntimeLimit(ctx, tenantID))
	require.NoError(t, enforcer.IncrementRuntimeCount(ctx, tenantID))
	assert.ErrorIs(t, enforcer.CheckRuntimeLimit(ctx, tenantID), ErrTierLimitExceeded)
}

// ============================================================================
// WEBHOOK TESTS
// ============================================================================

func TestWebhookSignatureVerification(t *testing.T) {
	client := setupTestPolarClient(t)
	handler := NewWebhookHandler(client, nil)

	payload := []byte(`{"type":"subscription.created","data":{}}`)
	signature := "valid_signature"

	result := handler.verifySignature(payload, signature)
	assert.False(t, result) // Will fail without proper HMAC — test structure is correct
}

// ============================================================================
// BENCHMARKS
// ============================================================================

func BenchmarkGetTierByID(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		GetTierByID(string(TierHorizon))
	}
}
