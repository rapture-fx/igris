package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Config holds Redis cache configuration
type Config struct {
	Address     string
	Password    string
	DB          int
	MaxRetries  int
	PoolSize    int
	MinIdleConns int
	TTL         time.Duration
}

// PredictionCache provides caching for ML predictions
type PredictionCache struct {
	client *redis.Client
	config Config
	logger zerolog.Logger
}

// CachedPrediction represents a cached prediction result
type CachedPrediction struct {
	Prediction   float64           `json:"prediction"`
	Confidence   float64           `json:"confidence"`
	ModelID      string            `json:"model_id"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
	LatencyMs    int64             `json:"latency_ms"`
	CachedAt     time.Time         `json:"cached_at"`
}

// NewPredictionCache creates a new Redis-based prediction cache
func NewPredictionCache(config Config, logger zerolog.Logger) (*PredictionCache, error) {
	// Set defaults
	if config.Address == "" {
		config.Address = "localhost:6379"
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.PoolSize == 0 {
		config.PoolSize = 10
	}
	if config.MinIdleConns == 0 {
		config.MinIdleConns = 5
	}
	if config.TTL == 0 {
		config.TTL = 1 * time.Hour // Default 1 hour TTL
	}

	// Create Redis client
	client := redis.NewClient(&redis.Options{
		Addr:         config.Address,
		Password:     config.Password,
		DB:           config.DB,
		MaxRetries:   config.MaxRetries,
		PoolSize:     config.PoolSize,
		MinIdleConns: config.MinIdleConns,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	cache := &PredictionCache{
		client: client,
		config: config,
		logger: logger.With().Str("component", "redis-cache").Logger(),
	}

	cache.logger.Info().
		Str("address", config.Address).
		Dur("ttl", config.TTL).
		Msg("Redis prediction cache initialized")

	return cache, nil
}

// generateKey creates a deterministic cache key from model ID and features
func (c *PredictionCache) generateKey(modelID string, features []float64) string {
	// Serialize features for hashing
	data, _ := json.Marshal(map[string]interface{}{
		"model_id": modelID,
		"features": features,
	})

	// SHA-256 hash for consistent key
	hash := sha256.Sum256(data)
	hashStr := hex.EncodeToString(hash[:])

	return fmt.Sprintf("ml:pred:%s:%s", modelID, hashStr[:16])
}

// Get retrieves a cached prediction if available
func (c *PredictionCache) Get(ctx context.Context, modelID string, features []float64) (*CachedPrediction, error) {
	key := c.generateKey(modelID, features)

	data, err := c.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			// Cache miss - not an error
			c.logger.Debug().
				Str("key", key).
				Str("model_id", modelID).
				Msg("Cache miss")
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get from cache: %w", err)
	}

	var cached CachedPrediction
	if err := json.Unmarshal([]byte(data), &cached); err != nil {
		c.logger.Warn().
			Err(err).
			Str("key", key).
			Msg("Failed to unmarshal cached prediction, invalidating")

		// Invalidate corrupted cache entry
		c.client.Del(ctx, key)
		return nil, nil
	}

	c.logger.Debug().
		Str("key", key).
		Str("model_id", modelID).
		Dur("age", time.Since(cached.CachedAt)).
		Msg("Cache hit")

	return &cached, nil
}

// Set stores a prediction in the cache
func (c *PredictionCache) Set(ctx context.Context, modelID string, features []float64, prediction *CachedPrediction) error {
	key := c.generateKey(modelID, features)

	prediction.CachedAt = time.Now()
	prediction.ModelID = modelID

	data, err := json.Marshal(prediction)
	if err != nil {
		return fmt.Errorf("failed to marshal prediction: %w", err)
	}

	if err := c.client.Set(ctx, key, data, c.config.TTL).Err(); err != nil {
		return fmt.Errorf("failed to set cache: %w", err)
	}

	c.logger.Debug().
		Str("key", key).
		Str("model_id", modelID).
		Dur("ttl", c.config.TTL).
		Msg("Cached prediction")

	return nil
}

// Delete removes a cached prediction
func (c *PredictionCache) Delete(ctx context.Context, modelID string, features []float64) error {
	key := c.generateKey(modelID, features)

	if err := c.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete from cache: %w", err)
	}

	c.logger.Debug().
		Str("key", key).
		Str("model_id", modelID).
		Msg("Deleted cached prediction")

	return nil
}

// InvalidateModel clears all cached predictions for a specific model
func (c *PredictionCache) InvalidateModel(ctx context.Context, modelID string) error {
	pattern := fmt.Sprintf("ml:pred:%s:*", modelID)

	iter := c.client.Scan(ctx, 0, pattern, 100).Iterator()
	deleted := 0

	for iter.Next(ctx) {
		if err := c.client.Del(ctx, iter.Val()).Err(); err != nil {
			c.logger.Warn().
				Err(err).
				Str("key", iter.Val()).
				Msg("Failed to delete key during invalidation")
			continue
		}
		deleted++
	}

	if err := iter.Err(); err != nil {
		return fmt.Errorf("failed to scan cache for invalidation: %w", err)
	}

	c.logger.Info().
		Str("model_id", modelID).
		Int("deleted", deleted).
		Msg("Invalidated model cache")

	return nil
}

// GetStats returns cache statistics
func (c *PredictionCache) GetStats(ctx context.Context) (map[string]interface{}, error) {
	info, err := c.client.Info(ctx, "stats").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get Redis stats: %w", err)
	}

	dbSize, err := c.client.DBSize(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get DB size: %w", err)
	}

	stats := map[string]interface{}{
		"db_size":  dbSize,
		"info":     info,
		"address":  c.config.Address,
		"ttl_sec":  c.config.TTL.Seconds(),
	}

	return stats, nil
}

// Close closes the Redis connection
func (c *PredictionCache) Close() error {
	if err := c.client.Close(); err != nil {
		return fmt.Errorf("failed to close Redis client: %w", err)
	}

	c.logger.Info().Msg("Redis cache connection closed")
	return nil
}

// Ping checks Redis connectivity
func (c *PredictionCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// FlushAll clears the entire cache (use with caution!)
func (c *PredictionCache) FlushAll(ctx context.Context) error {
	if err := c.client.FlushDB(ctx).Err(); err != nil {
		return fmt.Errorf("failed to flush cache: %w", err)
	}

	c.logger.Warn().Msg("Flushed entire prediction cache")
	return nil
}
