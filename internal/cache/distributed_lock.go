package cache

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// DistributedLock implements distributed locking using Redis
// Phase 2: Prevents race conditions during optimizer state updates
type DistributedLock struct {
	client *redis.Client
	key    string
	value  string
	ttl    time.Duration
}

// LockManager manages distributed locks across the system
type LockManager struct {
	client  *redis.Client
	enabled bool
}

var (
	ErrLockNotAcquired = errors.New("failed to acquire lock")
	ErrLockNotHeld     = errors.New("lock not held")
)

// NewLockManager creates a new distributed lock manager
func NewLockManager(redisURL string) (*LockManager, error) {
	if redisURL == "" {
		return &LockManager{enabled: false}, nil
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

	return &LockManager{
		client:  client,
		enabled: true,
	}, nil
}

// IsEnabled returns whether distributed locking is enabled
func (lm *LockManager) IsEnabled() bool {
	return lm.enabled
}

// AcquireLock attempts to acquire a distributed lock with specified TTL
func (lm *LockManager) AcquireLock(ctx context.Context, lockKey string, ttl time.Duration) (*DistributedLock, error) {
	if !lm.enabled {
		// Return a no-op lock when distributed locking is disabled
		return &DistributedLock{key: lockKey, value: "noop"}, nil
	}

	// Generate unique lock value
	lockValue, err := generateLockValue()
	if err != nil {
		return nil, fmt.Errorf("failed to generate lock value: %w", err)
	}

	key := fmt.Sprintf("lock:%s", lockKey)

	// Try to acquire lock with SET NX (set if not exists)
	ok, err := lm.client.SetNX(ctx, key, lockValue, ttl).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to acquire lock: %w", err)
	}

	if !ok {
		return nil, ErrLockNotAcquired
	}

	return &DistributedLock{
		client: lm.client,
		key:    key,
		value:  lockValue,
		ttl:    ttl,
	}, nil
}

// TryAcquireLock attempts to acquire lock with retries
func (lm *LockManager) TryAcquireLock(ctx context.Context, lockKey string, ttl time.Duration, maxRetries int, retryDelay time.Duration) (*DistributedLock, error) {
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		lock, err := lm.AcquireLock(ctx, lockKey, ttl)
		if err == nil {
			return lock, nil
		}

		lastErr = err

		// Don't retry if it's not a lock acquisition failure
		if err != ErrLockNotAcquired {
			return nil, err
		}

		// Wait before retrying
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(retryDelay):
			// Continue to next retry
		}
	}

	return nil, fmt.Errorf("failed to acquire lock after %d retries: %w", maxRetries, lastErr)
}

// Release releases the distributed lock
func (dl *DistributedLock) Release(ctx context.Context) error {
	if dl.client == nil {
		return nil // No-op lock
	}

	// Use Lua script to ensure we only delete our lock
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`

	result, err := dl.client.Eval(ctx, script, []string{dl.key}, dl.value).Result()
	if err != nil {
		return fmt.Errorf("failed to release lock: %w", err)
	}

	if result == int64(0) {
		return ErrLockNotHeld
	}

	return nil
}

// Extend extends the lock TTL (useful for long-running operations)
func (dl *DistributedLock) Extend(ctx context.Context, additionalTTL time.Duration) error {
	if dl.client == nil {
		return nil // No-op lock
	}

	// Use Lua script to extend TTL only if we still hold the lock
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("pexpire", KEYS[1], ARGV[2])
		else
			return 0
		end
	`

	ttlMs := additionalTTL.Milliseconds()
	result, err := dl.client.Eval(ctx, script, []string{dl.key}, dl.value, ttlMs).Result()
	if err != nil {
		return fmt.Errorf("failed to extend lock: %w", err)
	}

	if result == int64(0) {
		return ErrLockNotHeld
	}

	dl.ttl = additionalTTL
	return nil
}

// IsHeld checks if the lock is still held
func (dl *DistributedLock) IsHeld(ctx context.Context) (bool, error) {
	if dl.client == nil {
		return true, nil // No-op lock is always "held"
	}

	value, err := dl.client.Get(ctx, dl.key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check lock: %w", err)
	}

	return value == dl.value, nil
}

// WithLock executes a function while holding a distributed lock
func (lm *LockManager) WithLock(ctx context.Context, lockKey string, ttl time.Duration, fn func(ctx context.Context) error) error {
	lock, err := lm.AcquireLock(ctx, lockKey, ttl)
	if err != nil {
		return fmt.Errorf("failed to acquire lock: %w", err)
	}

	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := lock.Release(releaseCtx); err != nil {
			// Log error but don't fail the operation
			fmt.Printf("[Lock] Warning: Failed to release lock %s: %v\n", lockKey, err)
		}
	}()

	// Execute the function with the lock held
	return fn(ctx)
}

// WithLockRetry executes a function while holding a distributed lock, with retries
func (lm *LockManager) WithLockRetry(ctx context.Context, lockKey string, ttl time.Duration, maxRetries int, retryDelay time.Duration, fn func(ctx context.Context) error) error {
	lock, err := lm.TryAcquireLock(ctx, lockKey, ttl, maxRetries, retryDelay)
	if err != nil {
		return fmt.Errorf("failed to acquire lock: %w", err)
	}

	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := lock.Release(releaseCtx); err != nil {
			fmt.Printf("[Lock] Warning: Failed to release lock %s: %v\n", lockKey, err)
		}
	}()

	return fn(ctx)
}

// Close closes the lock manager
func (lm *LockManager) Close() error {
	if !lm.enabled || lm.client == nil {
		return nil
	}
	return lm.client.Close()
}

// generateLockValue generates a unique lock identifier
func generateLockValue() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// LockOptions provides configuration for lock acquisition
type LockOptions struct {
	TTL         time.Duration
	MaxRetries  int
	RetryDelay  time.Duration
	AutoExtend  bool // Automatically extend lock for long operations
	ExtendEvery time.Duration
}

// DefaultLockOptions returns sensible defaults for lock options
func DefaultLockOptions() *LockOptions {
	return &LockOptions{
		TTL:         30 * time.Second,
		MaxRetries:  3,
		RetryDelay:  100 * time.Millisecond,
		AutoExtend:  false,
		ExtendEvery: 10 * time.Second,
	}
}

// AcquireLockWithOptions acquires a lock with custom options
func (lm *LockManager) AcquireLockWithOptions(ctx context.Context, lockKey string, opts *LockOptions) (*DistributedLock, error) {
	if opts == nil {
		opts = DefaultLockOptions()
	}

	var lock *DistributedLock
	var err error

	if opts.MaxRetries > 0 {
		lock, err = lm.TryAcquireLock(ctx, lockKey, opts.TTL, opts.MaxRetries, opts.RetryDelay)
	} else {
		lock, err = lm.AcquireLock(ctx, lockKey, opts.TTL)
	}

	if err != nil {
		return nil, err
	}

	// Start auto-extend goroutine if enabled
	if opts.AutoExtend && lm.enabled {
		go func() {
			ticker := time.NewTicker(opts.ExtendEvery)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					extendCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					if err := lock.Extend(extendCtx, opts.TTL); err != nil {
						fmt.Printf("[Lock] Warning: Failed to extend lock %s: %v\n", lockKey, err)
						cancel()
						return
					}
					cancel()
				}
			}
		}()
	}

	return lock, nil
}
