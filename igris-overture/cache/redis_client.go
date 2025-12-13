package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// ProviderStatsClient manages provider statistics in Redis
// Phase 2: Externalize provider performance metrics from in-memory to Redis
type ProviderStatsClient struct {
	client  *redis.Client
	enabled bool
}

// ProviderStats represents performance metrics for a provider
type ProviderStats struct {
	ProviderKey  string    `json:"provider_key"`
	ProviderName string    `json:"provider_name"`
	ModelName    string    `json:"model_name"`

	// Performance metrics
	AvgLatencyMs  float64   `json:"avg_latency_ms"`
	TotalCostUSD  float64   `json:"total_cost_usd"`
	SuccessRate   float64   `json:"success_rate"`

	// Request counts
	TotalRequests int64     `json:"total_requests"`
	SuccessCount  int64     `json:"success_count"`
	ErrorCount    int64     `json:"error_count"`

	// Timestamps
	FirstSeenAt   time.Time `json:"first_seen_at"`
	LastUpdatedAt time.Time `json:"last_updated_at"`
}

// NewProviderStatsClient creates a new Redis client for provider statistics
func NewProviderStatsClient(redisURL string) (*ProviderStatsClient, error) {
	if redisURL == "" {
		return &ProviderStatsClient{enabled: false}, nil
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &ProviderStatsClient{
		client:  client,
		enabled: true,
	}, nil
}

// IsEnabled returns whether Redis persistence is enabled
func (psc *ProviderStatsClient) IsEnabled() bool {
	return psc.enabled
}

// GetClient returns the underlying Redis client for health checks
func (psc *ProviderStatsClient) GetClient() *redis.Client {
	return psc.client
}

// GetStats retrieves statistics for a specific provider
func (psc *ProviderStatsClient) GetStats(ctx context.Context, providerKey string) (*ProviderStats, error) {
	if !psc.enabled {
		return nil, fmt.Errorf("Redis persistence not enabled")
	}

	key := fmt.Sprintf("provider:stats:%s", providerKey)

	data, err := psc.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	if len(data) == 0 {
		return nil, nil // No stats found
	}

	// Parse the hash fields into ProviderStats
	stats := &ProviderStats{}
	if err := unmarshalHash(data, stats); err != nil {
		return nil, fmt.Errorf("failed to unmarshal stats: %w", err)
	}

	return stats, nil
}

// UpdateStats updates provider statistics
func (psc *ProviderStatsClient) UpdateStats(ctx context.Context, stats *ProviderStats) error {
	if !psc.enabled {
		return nil // Silent no-op when disabled
	}

	stats.LastUpdatedAt = time.Now()

	key := fmt.Sprintf("provider:stats:%s", stats.ProviderKey)

	// Convert stats to hash map
	hashData, err := marshalToHash(stats)
	if err != nil {
		return fmt.Errorf("failed to marshal stats: %w", err)
	}

	// Store as Redis hash for easy field updates
	if err := psc.client.HSet(ctx, key, hashData).Err(); err != nil {
		return fmt.Errorf("failed to update stats: %w", err)
	}

	return nil
}

// IncrementRequest increments request counters atomically
func (psc *ProviderStatsClient) IncrementRequest(ctx context.Context, providerKey string, success bool, latencyMs float64, costUSD float64) error {
	if !psc.enabled {
		return nil
	}

	key := fmt.Sprintf("provider:stats:%s", providerKey)

	pipe := psc.client.Pipeline()

	// Increment total requests
	pipe.HIncrBy(ctx, key, "total_requests", 1)

	if success {
		pipe.HIncrBy(ctx, key, "success_count", 1)
	} else {
		pipe.HIncrBy(ctx, key, "error_count", 1)
	}

	// Update latency (store as string for HSet, will recalculate avg later)
	pipe.HIncrByFloat(ctx, key, "total_latency_ms", latencyMs)

	// Update cost
	pipe.HIncrByFloat(ctx, key, "total_cost_usd", costUSD)

	// Update timestamp
	pipe.HSet(ctx, key, "last_updated_at", time.Now().Format(time.RFC3339))

	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("failed to increment request: %w", err)
	}

	return nil
}

// GetAllProviders returns all provider keys with statistics
func (psc *ProviderStatsClient) GetAllProviders(ctx context.Context) ([]string, error) {
	if !psc.enabled {
		return nil, fmt.Errorf("Redis persistence not enabled")
	}

	pattern := "provider:stats:*"

	var keys []string
	iter := psc.client.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		// Extract provider key from "provider:stats:PROVIDER_KEY"
		key := iter.Val()
		providerKey := key[len("provider:stats:"):]
		keys = append(keys, providerKey)
	}

	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("failed to scan providers: %w", err)
	}

	return keys, nil
}

// DeleteStats removes statistics for a provider
func (psc *ProviderStatsClient) DeleteStats(ctx context.Context, providerKey string) error {
	if !psc.enabled {
		return nil
	}

	key := fmt.Sprintf("provider:stats:%s", providerKey)
	return psc.client.Del(ctx, key).Err()
}

// GetStatsSummary returns aggregated statistics across all providers
func (psc *ProviderStatsClient) GetStatsSummary(ctx context.Context) (map[string]interface{}, error) {
	if !psc.enabled {
		return nil, fmt.Errorf("Redis persistence not enabled")
	}

	providers, err := psc.GetAllProviders(ctx)
	if err != nil {
		return nil, err
	}

	var totalRequests int64
	var totalCost float64
	var totalSuccesses int64
	var totalErrors int64

	for _, providerKey := range providers {
		stats, err := psc.GetStats(ctx, providerKey)
		if err != nil || stats == nil {
			continue
		}

		totalRequests += stats.TotalRequests
		totalCost += stats.TotalCostUSD
		totalSuccesses += stats.SuccessCount
		totalErrors += stats.ErrorCount
	}

	successRate := 0.0
	if totalRequests > 0 {
		successRate = float64(totalSuccesses) / float64(totalRequests) * 100
	}

	return map[string]interface{}{
		"total_providers":  len(providers),
		"total_requests":   totalRequests,
		"total_cost_usd":   totalCost,
		"success_count":    totalSuccesses,
		"error_count":      totalErrors,
		"success_rate_pct": successRate,
	}, nil
}

// Close closes the Redis connection
func (psc *ProviderStatsClient) Close() error {
	if !psc.enabled || psc.client == nil {
		return nil
	}
	return psc.client.Close()
}

// Helper functions for hash marshaling

func marshalToHash(v interface{}) (map[string]interface{}, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func unmarshalHash(hash map[string]string, v interface{}) error {
	// Redis stores everything as strings, so we need to convert back to proper types
	// We'll use JSON marshaling/unmarshaling to do the heavy lifting

	// First marshal hash to JSON string
	jsonData, err := json.Marshal(hash)
	if err != nil {
		return err
	}

	// Then unmarshal into a temporary map to handle type conversions
	var tempMap map[string]interface{}
	if err := json.Unmarshal(jsonData, &tempMap); err != nil {
		return err
	}

	// Convert string numbers to proper types
	for key, val := range tempMap {
		if strVal, ok := val.(string); ok {
			// Try to parse as number
			if floatVal, err := strconv.ParseFloat(strVal, 64); err == nil {
				tempMap[key] = floatVal
				continue
			}
			if intVal, err := strconv.ParseInt(strVal, 10, 64); err == nil {
				tempMap[key] = intVal
				continue
			}
			// Keep as string if not a number
		}
	}

	// Marshal back to JSON
	finalJSON, err := json.Marshal(tempMap)
	if err != nil {
		return err
	}

	// Unmarshal into target struct
	return json.Unmarshal(finalJSON, v)
}
