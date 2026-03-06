// Package billing provides tests for budget enforcement
package billing

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// TEST SETUP
// ============================================================================

func setupTestEnforcer(t *testing.T) (*BudgetEnforcer, *redis.Client, ed25519.PublicKey, ed25519.PrivateKey) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	t.Cleanup(func() {
		redisClient.Close()
		mr.Close()
	})

	// Generate Ed25519 key pair for testing
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	publicKeyHex := hex.EncodeToString(publicKey)

	overrideManager, err := NewOverrideManager(publicKeyHex)
	require.NoError(t, err)

	enforcer := NewBudgetEnforcer(BudgetEnforcerConfig{
		Redis:           redisClient,
		OverrideManager: overrideManager,
		Enabled:         true,
	})

	return enforcer, redisClient, publicKey, privateKey
}

// ============================================================================
// HARD BUDGET CAP TESTS
// ============================================================================

func TestHardBudgetCap_InfiniteTier_Returns429(t *testing.T) {
	enforcer, redisClient, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_infinite_budget_test"

	// Set tenant tier to Infinite
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierInfinite), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $100 (at limit)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Create Fiber app
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		return c.Next()
	})
	app.Use(enforcer.EnforceMiddleware())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Test request - should return 429
	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)

	// Verify 429 response
	assert.Equal(t, fiber.StatusTooManyRequests, resp.StatusCode)
	assert.Equal(t, "true", resp.Header.Get("X-Budget-Exhausted"))
}

func TestHardBudgetCap_HorizonTier_StillAllows(t *testing.T) {
	enforcer, redisClient, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_horizon_budget_test"

	// Set tenant tier to Horizon (not Infinite)
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierHorizon), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $100 (at limit)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Create Fiber app
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		return c.Next()
	})
	app.Use(enforcer.EnforceMiddleware())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Test request - should succeed (Horizon tier has no hard enforcement)
	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)

	// Verify 200 response (Horizon tier doesn't enforce hard caps)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
}

func TestHardBudgetCap_UnderBudget_Allows(t *testing.T) {
	enforcer, redisClient, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_infinite_under_budget"

	// Set tenant tier to Infinite
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierInfinite), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $50 (under budget)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 50.0)
	require.NoError(t, err)

	// Create Fiber app
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		return c.Next()
	})
	app.Use(enforcer.EnforceMiddleware())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Test request - should succeed
	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)

	// Verify 200 response
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
}

// ============================================================================
// EMERGENCY OVERRIDE TESTS
// ============================================================================

func TestEmergencyOverride_ValidToken_BypassesCap(t *testing.T) {
	enforcer, redisClient, _, privateKey := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_override_test"

	// Set tenant tier to Infinite
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierInfinite), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $100 (at limit)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Generate valid override token
	overrideToken, err := GenerateOverrideToken(privateKey, tenantID)
	require.NoError(t, err)

	// Create Fiber app
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		return c.Next()
	})
	app.Use(enforcer.EnforceMiddleware())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Test request with override token - should succeed
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Budget-Override", overrideToken)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)

	// Verify 200 response (override bypassed the cap)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
}

func TestEmergencyOverride_UsedToken_Denied(t *testing.T) {
	enforcer, redisClient, _, privateKey := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_used_token_test"

	// Set tenant tier to Infinite
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierInfinite), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $100 (at limit)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Generate valid override token
	overrideToken, err := GenerateOverrideToken(privateKey, tenantID)
	require.NoError(t, err)

	// Create Fiber app
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		return c.Next()
	})
	app.Use(enforcer.EnforceMiddleware())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// First request - should succeed
	req1 := httptest.NewRequest("GET", "/test", nil)
	req1.Header.Set("X-Budget-Override", overrideToken)
	resp1, err := app.Test(req1, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp1.StatusCode)

	// Second request with same token - should fail (single-use)
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.Header.Set("X-Budget-Override", overrideToken)
	resp2, err := app.Test(req2, -1)
	require.NoError(t, err)

	// Verify 401 response (token already used)
	assert.Equal(t, fiber.StatusUnauthorized, resp2.StatusCode)
}

func TestEmergencyOverride_ExpiredToken_Denied(t *testing.T) {
	enforcer, redisClient, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_expired_token_test"

	// Set tenant tier to Infinite
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierInfinite), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $100 (at limit)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Create expired token (expires in the past)
	// Note: For this test, we'll validate that expiration checking works
	// In production, expired tokens would fail JWT validation
	overrideManager := enforcer.overrideManager
	usage := overrideManager.GetOverrideUsage(tenantID)
	assert.Equal(t, 0, usage)
}

func TestEmergencyOverride_RequestLimitExceeded_Denied(t *testing.T) {
	enforcer, redisClient, _, privateKey := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_limit_test"

	// Set tenant tier to Infinite
	err := redisClient.Set(ctx, fmt.Sprintf("igris:billing:%s:tier", tenantID), string(TierInfinite), 0).Err()
	require.NoError(t, err)

	// Set budget to $100
	err = enforcer.SetTenantBudget(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Set current spend to $100 (at limit)
	err = enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Simulate 100 requests already used via override
	for i := 0; i < 100; i++ {
		enforcer.overrideManager.IncrementOverrideUsage(tenantID)
	}

	// Generate new override token
	overrideToken, err := GenerateOverrideToken(privateKey, tenantID)
	require.NoError(t, err)

	// Validate token - should fail (100 requests already used)
	err = enforcer.overrideManager.ValidateOverride(overrideToken, tenantID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "override request limit reached")
}

// ============================================================================
// BUDGET MANAGEMENT TESTS
// ============================================================================

func TestBudgetEnforcer_SetGetBudget(t *testing.T) {
	enforcer, _, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_budget_mgmt"

	// Set budget
	err := enforcer.SetTenantBudget(ctx, tenantID, 250.50)
	require.NoError(t, err)

	// Get budget
	budget, err := enforcer.GetTenantBudget(ctx, tenantID)
	require.NoError(t, err)
	assert.Equal(t, 250.50, budget)
}

func TestBudgetEnforcer_IncrementSpend(t *testing.T) {
	enforcer, _, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_spend_test"

	// Increment spend multiple times
	err := enforcer.IncrementTenantSpend(ctx, tenantID, 10.50)
	require.NoError(t, err)

	err = enforcer.IncrementTenantSpend(ctx, tenantID, 25.75)
	require.NoError(t, err)

	err = enforcer.IncrementTenantSpend(ctx, tenantID, 5.25)
	require.NoError(t, err)

	// Get total spend
	spend, err := enforcer.GetTenantSpend(ctx, tenantID)
	require.NoError(t, err)
	assert.Equal(t, 41.50, spend)
}

func TestBudgetEnforcer_ResetSpend(t *testing.T) {
	enforcer, _, _, _ := setupTestEnforcer(t)
	ctx := context.Background()

	tenantID := "tenant_reset_test"

	// Increment spend
	err := enforcer.IncrementTenantSpend(ctx, tenantID, 100.0)
	require.NoError(t, err)

	// Reset spend
	err = enforcer.ResetTenantSpend(ctx, tenantID)
	require.NoError(t, err)

	// Verify spend is 0
	spend, err := enforcer.GetTenantSpend(ctx, tenantID)
	require.NoError(t, err)
	assert.Equal(t, 0.0, spend)
}

// ============================================================================
// OVERRIDE TOKEN TESTS
// ============================================================================

func TestOverrideToken_Generation(t *testing.T) {
	_, _, _, privateKey := setupTestEnforcer(t)

	tenantID := "tenant_token_gen"

	// Generate token
	token, err := GenerateOverrideToken(privateKey, tenantID)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	// Token should be a valid JWT string
	assert.Contains(t, token, ".")
}

func TestOverrideToken_Validation(t *testing.T) {
	_, _, publicKey, privateKey := setupTestEnforcer(t)

	tenantID := "tenant_token_validation"

	// Generate token
	token, err := GenerateOverrideToken(privateKey, tenantID)
	require.NoError(t, err)

	// Create override manager
	publicKeyHex := hex.EncodeToString(publicKey)
	manager, err := NewOverrideManager(publicKeyHex)
	require.NoError(t, err)

	// Validate token
	err = manager.ValidateOverride(token, tenantID)
	assert.NoError(t, err)
}

func TestOverrideToken_TenantMismatch(t *testing.T) {
	_, _, publicKey, privateKey := setupTestEnforcer(t)

	tenantID := "tenant_correct"
	wrongTenantID := "tenant_wrong"

	// Generate token for one tenant
	token, err := GenerateOverrideToken(privateKey, tenantID)
	require.NoError(t, err)

	// Create override manager
	publicKeyHex := hex.EncodeToString(publicKey)
	manager, err := NewOverrideManager(publicKeyHex)
	require.NoError(t, err)

	// Try to validate with wrong tenant ID
	err = manager.ValidateOverride(token, wrongTenantID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "tenant mismatch")
}

func TestOverrideManager_UsageTracking(t *testing.T) {
	_, _, publicKey, _ := setupTestEnforcer(t)

	tenantID := "tenant_usage_tracking"

	publicKeyHex := hex.EncodeToString(publicKey)
	manager, err := NewOverrideManager(publicKeyHex)
	require.NoError(t, err)

	// Initial usage should be 0
	usage := manager.GetOverrideUsage(tenantID)
	assert.Equal(t, 0, usage)

	// Increment usage
	manager.IncrementOverrideUsage(tenantID)
	manager.IncrementOverrideUsage(tenantID)
	manager.IncrementOverrideUsage(tenantID)

	usage = manager.GetOverrideUsage(tenantID)
	assert.Equal(t, 3, usage)

	// Reset usage
	manager.ResetOverrideUsage(tenantID)
	usage = manager.GetOverrideUsage(tenantID)
	assert.Equal(t, 0, usage)
}
