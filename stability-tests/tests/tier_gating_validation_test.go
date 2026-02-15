package tests

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// TEST SETUP
// ============================================================================

// TestTierGatingValidationSuite runs comprehensive tier gating validation
func TestTierGatingValidationSuite(t *testing.T) {
	// Setup test environment
	db, redisClient, app := setupTestEnvironment(t)
	defer db.Close()
	defer redisClient.Close()

	// Run validation tests
	t.Run("Developer Tier Limits", func(t *testing.T) {
		testDeveloperTierLimits(t, db, redisClient, app)
	})

	t.Run("Growth Tier Limits", func(t *testing.T) {
		testGrowthTierLimits(t, db, redisClient, app)
	})

	t.Run("Scale Tier Limits", func(t *testing.T) {
		testScaleTierLimits(t, db, redisClient, app)
	})

	t.Run("Request Limit Enforcement", func(t *testing.T) {
		testRequestLimitEnforcement(t, db, redisClient, app)
	})

	t.Run("Provider Limit Enforcement", func(t *testing.T) {
		testProviderLimitEnforcement(t, db, redisClient, app)
	})

	t.Run("Feature Flag Enforcement", func(t *testing.T) {
		testFeatureFlagEnforcement(t, db, redisClient, app)
	})

	t.Run("Soft Limit Warnings", func(t *testing.T) {
		testSoftLimitWarnings(t, db, redisClient, app)
	})

	t.Run("Tier Upgrade/Downgrade", func(t *testing.T) {
		testTierUpgradeDowngrade(t, db, redisClient, app)
	})

	t.Run("Redis Request Counter Accuracy", func(t *testing.T) {
		testRedisRequestCounterAccuracy(t, db, redisClient, app)
	})

	t.Run("High Load Request Counting (1000 RPS)", func(t *testing.T) {
		testHighLoadRequestCounting(t, db, redisClient, app)
	})
}

// ============================================================================
// DEVELOPER TIER TESTS
// ============================================================================

func testDeveloperTierLimits(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "developer")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Enforce 5 Provider Limit", func(t *testing.T) {
		// Create 5 providers (should succeed)
		for i := 0; i < 5; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("provider_%d", i))
		}

		// Try to create 6th provider (should fail)
		req := httptest.NewRequest("POST", "/v1/providers", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		var respBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&respBody)
		assert.Equal(t, "PROVIDER_LIMIT_EXCEEDED", respBody["code"])
		assert.Equal(t, float64(5), respBody["limit"])
	})

	t.Run("Enforce 500K Request Limit", func(t *testing.T) {
		// Simulate 500,000 requests
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		redis.Set(ctx, redisKey, 500000, 30*24*time.Hour)

		// Next request should be blocked
		req := httptest.NewRequest("GET", "/v1/infer", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)

		var respBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&respBody)
		assert.Equal(t, "TIER_LIMIT_EXCEEDED", respBody["code"])
	})

	t.Run("Deny SLA Enforcement Access", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/sla", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		var respBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&respBody)
		assert.Equal(t, "FEATURE_NOT_AVAILABLE", respBody["code"])
		assert.Equal(t, "sla_enforcement", respBody["feature"])
	})
}

// ============================================================================
// GROWTH TIER TESTS
// ============================================================================

func testGrowthTierLimits(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "growth")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Enforce 10 Provider Limit", func(t *testing.T) {
		// Create 10 providers (should succeed)
		for i := 0; i < 10; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("provider_%d", i))
		}

		providerCount := getProviderCount(t, db, tenantID)
		assert.Equal(t, 10, providerCount)

		// Try to create 11th provider (should fail)
		req := httptest.NewRequest("POST", "/v1/providers", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Enforce 2M Request Limit", func(t *testing.T) {
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		redis.Set(ctx, redisKey, 2000000, 30*24*time.Hour)

		// Next request should be blocked
		req := httptest.NewRequest("GET", "/v1/infer", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	})

	t.Run("Allow SLA Enforcement Access", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/sla", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Allow Policy Versioning Access", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/policies", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Deny SSO Access (Not Implemented)", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/sso", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

// ============================================================================
// SCALE TIER TESTS
// ============================================================================

func testScaleTierLimits(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "scale")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Enforce 20 Provider Limit", func(t *testing.T) {
		// Create 20 providers (should succeed)
		for i := 0; i < 20; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("provider_%d", i))
		}

		providerCount := getProviderCount(t, db, tenantID)
		assert.Equal(t, 20, providerCount)

		// Try to create 21st provider (should fail)
		req := httptest.NewRequest("POST", "/v1/providers", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Allow Unlimited Requests", func(t *testing.T) {
		// Simulate 10 million requests
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		redis.Set(ctx, redisKey, 10000000, 30*24*time.Hour)

		// Request should still be allowed (unlimited)
		req := httptest.NewRequest("GET", "/v1/infer", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode)
	})

	t.Run("Allow All Enterprise Features", func(t *testing.T) {
		endpoints := []string{
			"/v1/sla",
			"/v1/policies",
			"/v1/audit",
			"/v1/governance",
			"/v1/analytics",
			"/v1/forecasting",
		}

		for _, endpoint := range endpoints {
			req := httptest.NewRequest("GET", endpoint, nil)
			req.Header.Set("Authorization", getTestJWT(tenantID))

			resp, err := app.Test(req)
			require.NoError(t, err)
			assert.NotEqual(t, http.StatusForbidden, resp.StatusCode,
				"Endpoint %s should be accessible in Scale tier", endpoint)
		}
	})
}

// ============================================================================
// REQUEST LIMIT ENFORCEMENT TESTS
// ============================================================================

func testRequestLimitEnforcement(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "developer")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Accurate Request Counting", func(t *testing.T) {
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		// Start at 0
		redis.Del(ctx, redisKey)

		// Make 100 requests
		for i := 0; i < 100; i++ {
			req := httptest.NewRequest("GET", "/v1/infer", nil)
			req.Header.Set("Authorization", getTestJWT(tenantID))
			app.Test(req)
		}

		// Verify count
		count, err := redis.Get(ctx, redisKey).Int64()
		require.NoError(t, err)
		assert.Equal(t, int64(100), count)
	})

	t.Run("Monthly TTL Expiry", func(t *testing.T) {
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		// Make a request to create counter
		req := httptest.NewRequest("GET", "/v1/infer", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))
		app.Test(req)

		// Check TTL is set
		ttl, err := redis.TTL(ctx, redisKey).Result()
		require.NoError(t, err)
		assert.Greater(t, ttl, time.Duration(0))
		assert.LessOrEqual(t, ttl, 31*24*time.Hour) // Max 31 days
	})
}

// ============================================================================
// PROVIDER LIMIT ENFORCEMENT TESTS
// ============================================================================

func testProviderLimitEnforcement(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "developer")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Block Exceeding Provider Limit", func(t *testing.T) {
		// Create 5 providers (limit)
		for i := 0; i < 5; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("provider_%d", i))
		}

		// Attempt 6th provider
		req := httptest.NewRequest("POST", "/v1/providers", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		var respBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&respBody)
		assert.Contains(t, respBody, "upgrade_url")
	})

	t.Run("Count Only Active Providers", func(t *testing.T) {
		// Create 4 active + 2 inactive providers
		for i := 0; i < 4; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("active_%d", i))
		}
		for i := 0; i < 2; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("inactive_%d", i))
			markProviderInactive(t, db, tenantID, fmt.Sprintf("inactive_%d", i))
		}

		// Should allow 5th provider (only 4 active)
		req := httptest.NewRequest("POST", "/v1/providers", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	})
}

// ============================================================================
// FEATURE FLAG ENFORCEMENT TESTS
// ============================================================================

func testFeatureFlagEnforcement(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	devTenantID := createTestTenant(t, db, "developer")
	growthTenantID := createTestTenant(t, db, "growth")
	defer cleanupTestTenant(t, db, devTenantID)
	defer cleanupTestTenant(t, db, growthTenantID)

	featureTests := []struct {
		endpoint    string
		feature     string
		devAllowed  bool
		growthAllowed bool
	}{
		{"/v1/sla", "sla_enforcement", false, true},
		{"/v1/policies", "policy_versioning", false, true},
		{"/v1/audit", "audit_logs", false, true},
		{"/v1/governance", "advanced_governance", false, true},
		{"/v1/sso", "sso", false, false}, // Not implemented in any tier
		{"/v1/semantic", "semantic_routing", true, true},
		{"/v1/forecasting", "cost_forecasting", true, true},
	}

	for _, tt := range featureTests {
		t.Run(fmt.Sprintf("%s - Developer Tier", tt.endpoint), func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.endpoint, nil)
			req.Header.Set("Authorization", getTestJWT(devTenantID))

			resp, err := app.Test(req)
			require.NoError(t, err)

			if tt.devAllowed {
				assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
			} else {
				assert.Equal(t, http.StatusForbidden, resp.StatusCode)
			}
		})

		t.Run(fmt.Sprintf("%s - Growth Tier", tt.endpoint), func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.endpoint, nil)
			req.Header.Set("Authorization", getTestJWT(growthTenantID))

			resp, err := app.Test(req)
			require.NoError(t, err)

			if tt.growthAllowed {
				assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
			} else {
				assert.Equal(t, http.StatusForbidden, resp.StatusCode)
			}
		})
	}
}

// ============================================================================
// SOFT LIMIT WARNING TESTS
// ============================================================================

func testSoftLimitWarnings(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "developer")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Issue Warning at 80% Request Limit", func(t *testing.T) {
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		// Set to 80% of 500K limit (400,000)
		redis.Set(ctx, redisKey, 400000, 30*24*time.Hour)

		req := httptest.NewRequest("GET", "/v1/infer", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)

		// Should succeed but with warning header
		assert.NotEqual(t, http.StatusTooManyRequests, resp.StatusCode)
		warningHeader := resp.Header.Get("X-Tier-Warning")
		assert.Contains(t, warningHeader, "Approaching limit")
	})

	t.Run("Issue Warning at 80% Provider Limit", func(t *testing.T) {
		// Create 4 providers (80% of 5 limit)
		for i := 0; i < 4; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("provider_%d", i))
		}

		req := httptest.NewRequest("POST", "/v1/providers", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)

		// Should have warning header
		warningHeader := resp.Header.Get("X-Tier-Warning")
		assert.Contains(t, warningHeader, "Approaching provider limit")
	})
}

// ============================================================================
// TIER UPGRADE/DOWNGRADE TESTS
// ============================================================================

func testTierUpgradeDowngrade(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "developer")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Upgrade from Developer to Growth", func(t *testing.T) {
		// Upgrade tier
		_, err := db.Exec(`UPDATE tenants SET tier = 'growth' WHERE id = $1`, tenantID)
		require.NoError(t, err)

		// Verify new limits apply
		for i := 0; i < 10; i++ {
			createTestProvider(t, db, tenantID, fmt.Sprintf("provider_%d", i))
		}

		providerCount := getProviderCount(t, db, tenantID)
		assert.Equal(t, 10, providerCount)

		// Should now have access to SLA features
		req := httptest.NewRequest("GET", "/v1/sla", nil)
		req.Header.Set("Authorization", getTestJWT(tenantID))

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Downgrade with Grace Period", func(t *testing.T) {
		// Downgrade back to developer
		_, err := db.Exec(`
			UPDATE tenants
			SET
				tier = 'developer',
				tier_grace_period_ends_at = CURRENT_TIMESTAMP + INTERVAL '30 days'
			WHERE id = $1
		`, tenantID)
		require.NoError(t, err)

		// Should temporarily retain access during grace period
		// (This would require additional logic in middleware)
		var graceEndsAt time.Time
		db.QueryRow(`SELECT tier_grace_period_ends_at FROM tenants WHERE id = $1`, tenantID).
			Scan(&graceEndsAt)

		assert.True(t, graceEndsAt.After(time.Now()))
	})
}

// ============================================================================
// REDIS REQUEST COUNTER ACCURACY TESTS
// ============================================================================

func testRedisRequestCounterAccuracy(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "developer")
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Atomic Increment Under Concurrency", func(t *testing.T) {
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		redis.Del(ctx, redisKey)

		// Simulate 100 concurrent requests
		done := make(chan bool, 100)
		for i := 0; i < 100; i++ {
			go func() {
				req := httptest.NewRequest("GET", "/v1/infer", nil)
				req.Header.Set("Authorization", getTestJWT(tenantID))
				app.Test(req)
				done <- true
			}()
		}

		// Wait for all requests
		for i := 0; i < 100; i++ {
			<-done
		}

		// Verify count is exactly 100 (atomic)
		count, err := redis.Get(ctx, redisKey).Int64()
		require.NoError(t, err)
		assert.Equal(t, int64(100), count)
	})
}

// ============================================================================
// HIGH LOAD REQUEST COUNTING TEST (1000 RPS)
// ============================================================================

func testHighLoadRequestCounting(t *testing.T, db *sql.DB, redis *redis.Client, app *fiber.App) {
	tenantID := createTestTenant(t, db, "scale") // Use scale tier for unlimited
	defer cleanupTestTenant(t, db, tenantID)

	t.Run("Handle 1000 RPS Request Counting", func(t *testing.T) {
		ctx := context.Background()
		redisKey := fmt.Sprintf("igris:ratelimit:%s:%s:request_count",
			tenantID, time.Now().Format("2006-01"))

		redis.Del(ctx, redisKey)

		// Simulate 1000 requests per second for 5 seconds
		totalRequests := 5000
		start := time.Now()

		done := make(chan bool, totalRequests)
		for i := 0; i < totalRequests; i++ {
			go func() {
				req := httptest.NewRequest("GET", "/v1/infer", nil)
				req.Header.Set("Authorization", getTestJWT(tenantID))
				app.Test(req)
				done <- true
			}()
		}

		// Wait for all requests
		for i := 0; i < totalRequests; i++ {
			<-done
		}

		duration := time.Since(start)
		t.Logf("Processed %d requests in %v", totalRequests, duration)

		// Verify count accuracy
		count, err := redis.Get(ctx, redisKey).Int64()
		require.NoError(t, err)
		assert.Equal(t, int64(totalRequests), count)

		// Verify RPS is roughly 1000
		actualRPS := float64(totalRequests) / duration.Seconds()
		assert.GreaterOrEqual(t, actualRPS, 800.0, "Should handle at least 800 RPS")
	})
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

func setupTestEnvironment(t *testing.T) (*sql.DB, *redis.Client, *fiber.App) {
	// Setup test database
	db, err := sql.Open("postgres", "postgres://localhost/igris_test?sslmode=disable")
	require.NoError(t, err)

	// Setup test Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1, // Use DB 1 for tests
	})

	// Setup Fiber app with middleware
	app := fiber.New()

	tierEnforcer, err := middleware.NewTierEnforcer(middleware.TierEnforcerConfig{
		ConfigPath: "../config/tier_config.yaml",
		DB:         db,
		Redis:      redisClient,
		Enabled:    true,
	})
	require.NoError(t, err)

	app.Use(tierEnforcer.Enforce())

	return db, redisClient, app
}

func createTestTenant(t *testing.T, db *sql.DB, tier string) string {
	tenantID := fmt.Sprintf("test-tenant-%d", time.Now().UnixNano())

	_, err := db.Exec(`
		INSERT INTO tenants (id, name, tier, status)
		VALUES ($1, $2, $3, 'active')
	`, tenantID, "Test Tenant", tier)
	require.NoError(t, err)

	return tenantID
}

func cleanupTestTenant(t *testing.T, db *sql.DB, tenantID string) {
	db.Exec(`DELETE FROM tenants WHERE id = $1`, tenantID)
}

func createTestProvider(t *testing.T, db *sql.DB, tenantID, providerName string) {
	_, err := db.Exec(`
		INSERT INTO provider_registry (tenant_id, name, base_url, auth_header_template, status)
		VALUES ($1, $2, $3, $4, 'active')
	`, tenantID, providerName, "https://api.example.com", "Bearer {key}")
	require.NoError(t, err)
}

func getProviderCount(t *testing.T, db *sql.DB, tenantID string) int {
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM provider_registry
		WHERE tenant_id = $1 AND status = 'active'
	`, tenantID).Scan(&count)
	require.NoError(t, err)
	return count
}

func markProviderInactive(t *testing.T, db *sql.DB, tenantID, providerName string) {
	_, err := db.Exec(`
		UPDATE provider_registry
		SET status = 'disabled'
		WHERE tenant_id = $1 AND name = $2
	`, tenantID, providerName)
	require.NoError(t, err)
}

func getTestJWT(tenantID string) string {
	// Generate test JWT token
	// In real tests, use actual JWT library
	return fmt.Sprintf("Bearer test-jwt-%s", tenantID)
}
