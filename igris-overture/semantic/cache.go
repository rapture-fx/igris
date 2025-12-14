package semantic

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClassificationCache implements ClassificationCache using Redis
type RedisClassificationCache struct {
	client *redis.Client
	prefix string
}

// NewRedisClassificationCache creates a new Redis-backed classification cache
func NewRedisClassificationCache(client *redis.Client) *RedisClassificationCache {
	return &RedisClassificationCache{
		client: client,
		prefix: "igris:semantic:class:",
	}
}

// Get retrieves a cached classification result
func (r *RedisClassificationCache) Get(ctx context.Context, promptHash string) (*ClassificationResult, error) {
	key := r.prefix + promptHash

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Cache miss
		}
		return nil, fmt.Errorf("redis get error: %w", err)
	}

	var result ClassificationResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("json unmarshal error: %w", err)
	}

	return &result, nil
}

// Set stores a classification result in the cache
func (r *RedisClassificationCache) Set(ctx context.Context, promptHash string, result *ClassificationResult, ttl time.Duration) error {
	key := r.prefix + promptHash

	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("json marshal error: %w", err)
	}

	if err := r.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis set error: %w", err)
	}

	return nil
}

// Delete removes a classification from the cache
func (r *RedisClassificationCache) Delete(ctx context.Context, promptHash string) error {
	key := r.prefix + promptHash
	return r.client.Del(ctx, key).Err()
}

// Clear removes all cached classifications
func (r *RedisClassificationCache) Clear(ctx context.Context) error {
	pattern := r.prefix + "*"

	var cursor uint64
	for {
		keys, nextCursor, err := r.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("redis scan error: %w", err)
		}

		if len(keys) > 0 {
			if err := r.client.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("redis del error: %w", err)
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return nil
}

// GetCacheStats returns statistics about the cache
func (r *RedisClassificationCache) GetCacheStats(ctx context.Context) (CacheStats, error) {
	pattern := r.prefix + "*"

	var totalKeys int
	var cursor uint64
	for {
		keys, nextCursor, err := r.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return CacheStats{}, fmt.Errorf("redis scan error: %w", err)
		}

		totalKeys += len(keys)

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return CacheStats{
		TotalCached: totalKeys,
		Prefix:      r.prefix,
	}, nil
}

// CacheStats represents cache statistics
type CacheStats struct {
	TotalCached int
	Prefix      string
}

// NullCache is a no-op cache implementation for testing
type NullCache struct{}

// NewNullCache creates a new null cache
func NewNullCache() *NullCache {
	return &NullCache{}
}

// Get always returns nil (cache miss)
func (n *NullCache) Get(ctx context.Context, promptHash string) (*ClassificationResult, error) {
	return nil, nil
}

// Set is a no-op
func (n *NullCache) Set(ctx context.Context, promptHash string, result *ClassificationResult, ttl time.Duration) error {
	return nil
}
