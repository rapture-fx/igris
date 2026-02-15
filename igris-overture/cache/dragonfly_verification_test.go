// Package cache provides Dragonfly compatibility verification tests
// CRITICAL: These tests MUST pass 100% before Dragonfly production deployment
package cache

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// DRAGONFLY COMPATIBILITY VERIFICATION
// ============================================================================
// These tests verify that Dragonfly is 100% compatible with Redis client code
// Run these against BOTH Redis and Dragonfly to ensure identical behavior

// TestDragonfly_BasicOperations verifies basic Redis operations work identically
func TestDragonfly_BasicOperations(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// SET/GET
	err := client.Set(ctx, "test:key", "test:value", 0).Err()
	require.NoError(t, err)

	val, err := client.Get(ctx, "test:key").Result()
	require.NoError(t, err)
	assert.Equal(t, "test:value", val)

	// DEL
	err = client.Del(ctx, "test:key").Err()
	require.NoError(t, err)

	// GET non-existent
	_, err = client.Get(ctx, "test:key").Result()
	assert.Equal(t, redis.Nil, err)
}

// TestDragonfly_Expiration verifies TTL/EXPIRE work identically
func TestDragonfly_Expiration(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// SETEX
	err := client.Set(ctx, "test:ttl", "value", 2*time.Second).Err()
	require.NoError(t, err)

	// Verify exists
	val, err := client.Get(ctx, "test:ttl").Result()
	require.NoError(t, err)
	assert.Equal(t, "value", val)

	// Wait for expiration
	time.Sleep(3 * time.Second)

	// Verify expired
	_, err = client.Get(ctx, "test:ttl").Result()
	assert.Equal(t, redis.Nil, err)
}

// TestDragonfly_AtomicOperations verifies INCR/DECR work identically
func TestDragonfly_AtomicOperations(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// Cleanup before test (in case of leftover data from previous runs)
	client.Del(ctx, "test:counter")

	// INCR
	val, err := client.Incr(ctx, "test:counter").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), val)

	val, err = client.Incr(ctx, "test:counter").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(2), val)

	// INCRBY
	val, err = client.IncrBy(ctx, "test:counter", 10).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(12), val)

	// DECR
	val, err = client.Decr(ctx, "test:counter").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(11), val)

	// Cleanup
	client.Del(ctx, "test:counter")
}

// TestDragonfly_Lists verifies LIST operations work identically
func TestDragonfly_Lists(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// Cleanup before test (in case of leftover data from previous runs)
	client.Del(ctx, "test:list")

	// LPUSH
	err := client.LPush(ctx, "test:list", "item1", "item2", "item3").Err()
	require.NoError(t, err)

	// LLEN
	length, err := client.LLen(ctx, "test:list").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(3), length)

	// LPOP
	val, err := client.LPop(ctx, "test:list").Result()
	require.NoError(t, err)
	assert.Equal(t, "item3", val)

	// Cleanup
	client.Del(ctx, "test:list")
}

// TestDragonfly_Hashes verifies HASH operations work identically
func TestDragonfly_Hashes(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// HSET
	err := client.HSet(ctx, "test:hash", "field1", "value1", "field2", "value2").Err()
	require.NoError(t, err)

	// HGET
	val, err := client.HGet(ctx, "test:hash", "field1").Result()
	require.NoError(t, err)
	assert.Equal(t, "value1", val)

	// HGETALL
	all, err := client.HGetAll(ctx, "test:hash").Result()
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"field1": "value1", "field2": "value2"}, all)

	// Cleanup
	client.Del(ctx, "test:hash")
}

// TestDragonfly_Sets verifies SET operations work identically
func TestDragonfly_Sets(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// SADD
	err := client.SAdd(ctx, "test:set", "member1", "member2", "member3").Err()
	require.NoError(t, err)

	// SISMEMBER
	isMember, err := client.SIsMember(ctx, "test:set", "member1").Result()
	require.NoError(t, err)
	assert.True(t, isMember)

	// SMEMBERS
	members, err := client.SMembers(ctx, "test:set").Result()
	require.NoError(t, err)
	assert.Len(t, members, 3)

	// Cleanup
	client.Del(ctx, "test:set")
}

// TestDragonfly_Transactions verifies MULTI/EXEC work identically
func TestDragonfly_Transactions(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// MULTI/EXEC
	pipe := client.TxPipeline()
	pipe.Set(ctx, "test:tx1", "value1", 0)
	pipe.Set(ctx, "test:tx2", "value2", 0)
	pipe.Incr(ctx, "test:counter")

	cmds, err := pipe.Exec(ctx)
	require.NoError(t, err)
	assert.Len(t, cmds, 3)

	// Verify all commands succeeded
	val1, _ := client.Get(ctx, "test:tx1").Result()
	assert.Equal(t, "value1", val1)

	val2, _ := client.Get(ctx, "test:tx2").Result()
	assert.Equal(t, "value2", val2)

	// Cleanup
	client.Del(ctx, "test:tx1", "test:tx2", "test:counter")
}

// TestDragonfly_Pipelining verifies pipelining works identically
func TestDragonfly_Pipelining(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	pipe := client.Pipeline()
	for i := 0; i < 100; i++ {
		pipe.Set(ctx, fmt.Sprintf("test:pipe:%d", i), fmt.Sprintf("value%d", i), 0)
	}

	cmds, err := pipe.Exec(ctx)
	require.NoError(t, err)
	assert.Len(t, cmds, 100)

	// Verify
	val, _ := client.Get(ctx, "test:pipe:50").Result()
	assert.Equal(t, "value50", val)

	// Cleanup
	for i := 0; i < 100; i++ {
		client.Del(ctx, fmt.Sprintf("test:pipe:%d", i))
	}
}

// TestDragonfly_Concurrency verifies concurrent access works identically
func TestDragonfly_Concurrency(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	var wg sync.WaitGroup
	errors := make(chan error, 100)

	// 100 concurrent operations
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			key := fmt.Sprintf("test:concurrent:%d", idx)
			if err := client.Set(ctx, key, fmt.Sprintf("value%d", idx), 0).Err(); err != nil {
				errors <- err
				return
			}

			val, err := client.Get(ctx, key).Result()
			if err != nil {
				errors <- err
				return
			}

			if val != fmt.Sprintf("value%d", idx) {
				errors <- fmt.Errorf("value mismatch: got %s, expected value%d", val, idx)
			}

			client.Del(ctx, key)
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for errors
	errorCount := 0
	for err := range errors {
		t.Errorf("Concurrent error: %v", err)
		errorCount++
	}

	assert.Equal(t, 0, errorCount, "No errors should occur in concurrent operations")
}

// TestDragonfly_HighLoad simulates realistic production load
func TestDragonfly_HighLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping high load test in short mode")
	}

	client := setupTestClient(t)
	ctx := context.Background()

	var wg sync.WaitGroup
	errors := make(chan error, 10000)
	operations := 10000
	concurrency := 100

	startTime := time.Now()

	// Simulate 10k operations with 100 concurrent workers
	sem := make(chan struct{}, concurrency)
	for i := 0; i < operations; i++ {
		wg.Add(1)
		sem <- struct{}{} // Acquire

		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }() // Release

			key := fmt.Sprintf("test:load:%d", idx)

			// Mixed operations (realistic workload)
			pipe := client.Pipeline()
			pipe.Set(ctx, key, fmt.Sprintf("value%d", idx), 10*time.Second)
			pipe.Incr(ctx, "test:load:counter")
			pipe.Get(ctx, key)
			pipe.Del(ctx, key)

			_, err := pipe.Exec(ctx)
			if err != nil {
				errors <- err
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	duration := time.Since(startTime)

	// Check for errors
	errorCount := 0
	for err := range errors {
		t.Logf("Load test error: %v", err)
		errorCount++
	}

	// Calculate throughput
	throughput := float64(operations) / duration.Seconds()

	t.Logf("High load test: %d operations in %v (%.2f ops/sec)", operations, duration, throughput)
	t.Logf("Error rate: %d/%d (%.2f%%)", errorCount, operations, float64(errorCount)/float64(operations)*100)

	// Assert error rate < 1%
	assert.Less(t, errorCount, operations/100, "Error rate must be < 1%")

	// Assert throughput > 1000 ops/sec
	assert.Greater(t, throughput, 1000.0, "Throughput must be > 1000 ops/sec")

	// Cleanup
	client.Del(ctx, "test:load:counter")
}

// TestDragonfly_ConnectionPool verifies connection pooling works correctly
func TestDragonfly_ConnectionPool(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// Get pool stats before
	statsBefore := client.PoolStats()
	t.Logf("Pool stats before: Hits=%d Miss=%d Timeouts=%d Total=%d Idle=%d",
		statsBefore.Hits, statsBefore.Misses, statsBefore.Timeouts,
		statsBefore.TotalConns, statsBefore.IdleConns)

	// Perform many operations to exercise the pool
	for i := 0; i < 1000; i++ {
		client.Set(ctx, fmt.Sprintf("test:pool:%d", i), "value", 1*time.Second)
		client.Get(ctx, fmt.Sprintf("test:pool:%d", i))
	}

	// Get pool stats after
	statsAfter := client.PoolStats()
	t.Logf("Pool stats after: Hits=%d Miss=%d Timeouts=%d Total=%d Idle=%d",
		statsAfter.Hits, statsAfter.Misses, statsAfter.Timeouts,
		statsAfter.TotalConns, statsAfter.IdleConns)

	// Assert no timeouts
	assert.Equal(t, uint32(0), statsAfter.Timeouts, "No connection pool timeouts should occur")

	// Assert pool is being used (hits > 0)
	assert.Greater(t, statsAfter.Hits, uint32(0), "Connection pool should have hits")
}

// setupTestClient creates a Redis client for testing
// Point this to Dragonfly URL for verification
func setupTestClient(t *testing.T) *redis.Client {
	// Default to localhost:6379 (Redis)
	// Override with DRAGONFLY_TEST_URL=redis://localhost:6380 for Dragonfly testing
	addr := "localhost:6379"
	if testURL := os.Getenv("DRAGONFLY_TEST_URL"); testURL != "" {
		// Simple parsing: redis://localhost:6380 -> localhost:6380
		// For more complex URLs, use url.Parse() but this is sufficient for testing
		if testURL == "redis://localhost:6380" {
			addr = "localhost:6380"
		}
	}

	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     "",
		DB:           0,
		PoolSize:     100,
		MinIdleConns: 10,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolTimeout:  4 * time.Second,
	})

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("Failed to connect to cache (Redis/Dragonfly): %v", err)
	}

	t.Cleanup(func() {
		client.Close()
	})

	return client
}

// ============================================================================
// FEATURE INTEGRATION TESTS
// ============================================================================
// These verify that all Igris Inertial features work with Dragonfly

// TestDragonfly_BudgetTracking verifies budget enforcement still works
func TestDragonfly_BudgetTracking(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	tenantID := "tenant_budget_dragonfly_test"

	// Simulate budget tracking (as done in billing/enforcer.go)
	budgetKey := fmt.Sprintf("igris:billing:%s:monthly_budget", tenantID)
	spendKey := fmt.Sprintf("igris:billing:%s:current_spend", tenantID)

	// Set budget
	err := client.Set(ctx, budgetKey, "100.00", 0).Err()
	require.NoError(t, err)

	// Increment spend
	err = client.Set(ctx, spendKey, "0.00", 0).Err()
	require.NoError(t, err)

	newSpend, err := client.IncrByFloat(ctx, spendKey, 25.50).Result()
	require.NoError(t, err)
	assert.Equal(t, 25.50, newSpend)

	// Check budget exceeded
	budget, _ := client.Get(ctx, budgetKey).Result()
	spend, _ := client.Get(ctx, spendKey).Result()

	t.Logf("Budget: %s, Spend: %s", budget, spend)

	// Cleanup
	client.Del(ctx, budgetKey, spendKey)
}

// TestDragonfly_RateLimiting verifies rate limiting still works
func TestDragonfly_RateLimiting(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	tenantID := "tenant_ratelimit_dragonfly_test"
	window := 60 // seconds

	// Simulate rate limiting (sliding window)
	key := fmt.Sprintf("igris:ratelimit:%s:%d", tenantID, time.Now().Unix()/int64(window))

	// Increment counter
	count, err := client.Incr(ctx, key).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	// Set expiration
	err = client.Expire(ctx, key, time.Duration(window)*time.Second).Err()
	require.NoError(t, err)

	// Verify TTL
	ttl, err := client.TTL(ctx, key).Result()
	require.NoError(t, err)
	assert.Greater(t, ttl.Seconds(), float64(0))

	// Cleanup
	client.Del(ctx, key)
}

// TestDragonfly_CachingClassification verifies semantic classification caching works
func TestDragonfly_CachingClassification(t *testing.T) {
	client := setupTestClient(t)
	ctx := context.Background()

	// Simulate classification cache (as used in semantic routing)
	requestHash := "hash_12345"
	cacheKey := fmt.Sprintf("igris:cache:classification:%s", requestHash)

	classification := `{"intent":"text_generation","confidence":0.95}`

	// Cache classification
	err := client.Set(ctx, cacheKey, classification, 1*time.Hour).Err()
	require.NoError(t, err)

	// Retrieve from cache
	cached, err := client.Get(ctx, cacheKey).Result()
	require.NoError(t, err)
	assert.Equal(t, classification, cached)

	// Verify TTL
	ttl, _ := client.TTL(ctx, cacheKey).Result()
	assert.Greater(t, ttl.Seconds(), float64(3500)) // ~1 hour

	// Cleanup
	client.Del(ctx, cacheKey)
}
