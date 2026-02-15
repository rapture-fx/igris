package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
)

var (
	// Redis pool metrics
	redisPoolActiveConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "igris_redis_pool_active_connections",
			Help: "Number of active Redis pool connections",
		},
	)

	redisPoolIdleConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "igris_redis_pool_idle_connections",
			Help: "Number of idle Redis pool connections",
		},
	)

	redisLatencyMs = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_redis_latency_ms",
			Help:    "Redis operation latency in milliseconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 25, 50, 100},
		},
		[]string{"operation"},
	)
)

// RedisPoolConfig holds connection pool configuration
type RedisPoolConfig struct {
	URL              string
	MinIdleConns     int
	MaxActiveConns   int
	ConnMaxLifetime  time.Duration
	ConnMaxIdleTime  time.Duration
	DialTimeout      time.Duration
	ReadTimeout      time.Duration
	WriteTimeout     time.Duration
	PoolTimeout      time.Duration
}

// DefaultRedisPoolConfig returns optimized pool configuration
// Updated for Dragonfly: 5× pool size for 200k+ RPS headroom (was 8k RPS with Redis)
func DefaultRedisPoolConfig(url string) *RedisPoolConfig {
	return &RedisPoolConfig{
		URL:              url,
		MinIdleConns:     100, // Keep 100 idle connections warm (was 10)
		MaxActiveConns:   500, // Allow up to 500 concurrent connections (was 100) - Dragonfly handles this easily
		ConnMaxLifetime:  30 * time.Minute,
		ConnMaxIdleTime:  10 * time.Minute,
		DialTimeout:      5 * time.Second,
		ReadTimeout:      2 * time.Second,
		WriteTimeout:     2 * time.Second,
		PoolTimeout:      3 * time.Second,
	}
}

// OptimizedRedisClient creates a Redis client with connection pooling
func OptimizedRedisClient(config *RedisPoolConfig) (*redis.Client, error) {
	opt, err := redis.ParseURL(config.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL: %w", err)
	}

	// Apply pool configuration
	opt.MinIdleConns = config.MinIdleConns
	opt.PoolSize = config.MaxActiveConns
	opt.ConnMaxLifetime = config.ConnMaxLifetime
	opt.ConnMaxIdleTime = config.ConnMaxIdleTime
	opt.DialTimeout = config.DialTimeout
	opt.ReadTimeout = config.ReadTimeout
	opt.WriteTimeout = config.WriteTimeout
	opt.PoolTimeout = config.PoolTimeout

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	// Start metrics collector
	go collectPoolMetrics(client)

	return client, nil
}

// collectPoolMetrics periodically collects pool statistics
func collectPoolMetrics(client *redis.Client) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		stats := client.PoolStats()
		redisPoolActiveConnections.Set(float64(stats.TotalConns - stats.IdleConns))
		redisPoolIdleConnections.Set(float64(stats.IdleConns))
	}
}

// PipelinedGet performs pipelined GET operations
func PipelinedGet(ctx context.Context, client *redis.Client, keys []string) ([]string, error) {
	start := time.Now()
	defer func() {
		redisLatencyMs.WithLabelValues("pipelined_get").Observe(float64(time.Since(start).Milliseconds()))
	}()

	pipe := client.Pipeline()
	cmds := make([]*redis.StringCmd, len(keys))

	for i, key := range keys {
		cmds[i] = pipe.Get(ctx, key)
	}

	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, err
	}

	results := make([]string, len(keys))
	for i, cmd := range cmds {
		val, err := cmd.Result()
		if err == redis.Nil {
			results[i] = ""
		} else if err != nil {
			return nil, err
		} else {
			results[i] = val
		}
	}

	return results, nil
}

// PipelinedSet performs pipelined SET operations
func PipelinedSet(ctx context.Context, client *redis.Client, keyValues map[string]string, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		redisLatencyMs.WithLabelValues("pipelined_set").Observe(float64(time.Since(start).Milliseconds()))
	}()

	pipe := client.Pipeline()

	for key, value := range keyValues {
		pipe.Set(ctx, key, value, ttl)
	}

	_, err := pipe.Exec(ctx)
	return err
}

// OptimizedSet performs a SET with latency tracking
func OptimizedSet(ctx context.Context, client *redis.Client, key, value string, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		redisLatencyMs.WithLabelValues("set").Observe(float64(time.Since(start).Milliseconds()))
	}()

	return client.Set(ctx, key, value, ttl).Err()
}

// OptimizedGet performs a GET with latency tracking
func OptimizedGet(ctx context.Context, client *redis.Client, key string) (string, error) {
	start := time.Now()
	defer func() {
		redisLatencyMs.WithLabelValues("get").Observe(float64(time.Since(start).Milliseconds()))
	}()

	return client.Get(ctx, key).Result()
}
