package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// PredictionCache provides caching for ML predictions
type PredictionCache struct {
	client *redis.Client
	ttl    time.Duration
}

// NewPredictionCache creates a new prediction cache
func NewPredictionCache(redisURL string, ttl time.Duration) (*PredictionCache, error) {
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

	return &PredictionCache{
		client: client,
		ttl:    ttl,
	}, nil
}

// CachedPrediction represents a cached prediction result
type CachedPrediction struct {
	Prediction float64            `json:"prediction"`
	Confidence float64            `json:"confidence"`
	ModelID    string             `json:"model_id"`
	Timestamp  time.Time          `json:"timestamp"`
	Metadata   map[string]string  `json:"metadata,omitempty"`
}

// hashFeatures creates a deterministic hash of features for cache key
func hashFeatures(features []float64) string {
	data, _ := json.Marshal(features)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// Get retrieves a cached prediction if available
func (c *PredictionCache) Get(ctx context.Context, modelID string, features []float64) (*CachedPrediction, error) {
	key := fmt.Sprintf("ml:%s:%s", modelID, hashFeatures(features))

	cached, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // Cache miss
	} else if err != nil {
		return nil, fmt.Errorf("cache get error: %w", err)
	}

	var prediction CachedPrediction
	if err := json.Unmarshal([]byte(cached), &prediction); err != nil {
		return nil, fmt.Errorf("cache unmarshal error: %w", err)
	}

	return &prediction, nil
}

// Set stores a prediction in the cache
func (c *PredictionCache) Set(ctx context.Context, modelID string, features []float64, prediction *CachedPrediction) error {
	key := fmt.Sprintf("ml:%s:%s", modelID, hashFeatures(features))

	prediction.Timestamp = time.Now()
	data, err := json.Marshal(prediction)
	if err != nil {
		return fmt.Errorf("cache marshal error: %w", err)
	}

	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err != nil {
		return fmt.Errorf("cache set error: %w", err)
	}

	return nil
}

// Invalidate removes a specific prediction from cache
func (c *PredictionCache) Invalidate(ctx context.Context, modelID string, features []float64) error {
	key := fmt.Sprintf("ml:%s:%s", modelID, hashFeatures(features))
	return c.client.Del(ctx, key).Err()
}

// InvalidateModel removes all predictions for a specific model
func (c *PredictionCache) InvalidateModel(ctx context.Context, modelID string) error {
	pattern := fmt.Sprintf("ml:%s:*", modelID)

	iter := c.client.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		if err := c.client.Del(ctx, iter.Val()).Err(); err != nil {
			return err
		}
	}

	return iter.Err()
}

// Stats returns cache statistics
func (c *PredictionCache) Stats(ctx context.Context) (map[string]string, error) {
	info, err := c.client.Info(ctx, "stats").Result()
	if err != nil {
		return nil, err
	}

	return map[string]string{
		"info": info,
	}, nil
}

// Close closes the Redis connection
func (c *PredictionCache) Close() error {
	return c.client.Close()
}
