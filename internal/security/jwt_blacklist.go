package security

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// JWTBlacklist provides high-performance token revocation using Dragonfly/Redis
// Enhancement: Enables instant token revocation with <1ms lookup time
type JWTBlacklist struct {
	cache   *redis.Client
	enabled bool
	logger  *log.Logger

	// Performance optimization: bloom filter for negative lookups
	// (token definitely NOT revoked if not in bloom filter)
	useBloomFilter bool
}

// BlacklistConfig holds configuration for JWT blacklist
type BlacklistConfig struct {
	Enabled        bool
	RedisURL       string
	UseBloomFilter bool // Use Bloom filter for faster negative lookups
}

// NewJWTBlacklist creates a new JWT blacklist manager
func NewJWTBlacklist(config *BlacklistConfig) (*JWTBlacklist, error) {
	if !config.Enabled || config.RedisURL == "" {
		return &JWTBlacklist{
			enabled: false,
			logger:  log.Default(),
		}, nil
	}

	// Parse Redis URL
	opt, err := redis.ParseURL(config.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL: %w", err)
	}

	// Optimize for low-latency blacklist lookups
	opt.MinIdleConns = 20
	opt.PoolSize = 100
	opt.ConnMaxLifetime = 30 * time.Minute
	opt.ConnMaxIdleTime = 10 * time.Minute
	opt.DialTimeout = 2 * time.Second
	opt.ReadTimeout = 500 * time.Millisecond  // Very fast reads
	opt.WriteTimeout = 1 * time.Second

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to blacklist Redis: %w", err)
	}

	bl := &JWTBlacklist{
		cache:          client,
		enabled:        true,
		logger:         log.Default(),
		useBloomFilter: config.UseBloomFilter,
	}

	// Initialize Bloom filter if enabled
	if bl.useBloomFilter {
		if err := bl.initBloomFilter(ctx); err != nil {
			bl.logger.Printf("[JWTBlacklist] Warning: Failed to initialize Bloom filter: %v", err)
			bl.useBloomFilter = false
		}
	}

	log.Printf("[JWTBlacklist] Enabled with Bloom filter: %v", bl.useBloomFilter)
	return bl, nil
}

// RevokeToken adds a token to the blacklist
func (bl *JWTBlacklist) RevokeToken(ctx context.Context, tokenString string, expiresAt time.Time, reason string) error {
	if !bl.enabled {
		return fmt.Errorf("JWT blacklist not enabled")
	}

	tokenHash := hashJWT(tokenString)

	// Calculate TTL (only need to keep in blacklist until token expires)
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		// Token already expired, no need to blacklist
		return nil
	}

	// Store in Redis with automatic expiry
	key := fmt.Sprintf("jwt:blacklist:%s", tokenHash)

	err := bl.cache.Set(ctx, key, reason, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to blacklist token: %w", err)
	}

	// Update Bloom filter if enabled
	if bl.useBloomFilter {
		bl.addToBloomFilter(ctx, tokenHash)
	}

	bl.logger.Printf("[JWTBlacklist] Revoked token: %s (reason: %s, ttl: %s)", tokenHash[:16], reason, ttl)
	return nil
}

// IsRevoked checks if a token has been revoked
// This is optimized for sub-millisecond lookups
func (bl *JWTBlacklist) IsRevoked(ctx context.Context, tokenString string) (bool, error) {
	if !bl.enabled {
		return false, nil
	}

	tokenHash := hashJWT(tokenString)

	// Bloom filter optimization: if not in bloom filter, definitely not revoked
	if bl.useBloomFilter {
		inBloom, err := bl.checkBloomFilter(ctx, tokenHash)
		if err != nil {
			bl.logger.Printf("[JWTBlacklist] Bloom filter check failed: %v", err)
			// Fall through to direct check
		} else if !inBloom {
			// Definitely not revoked (Bloom filter negative)
			return false, nil
		}
		// Might be revoked (Bloom filter positive - could be false positive)
		// Continue to direct check
	}

	// Direct Redis check
	key := fmt.Sprintf("jwt:blacklist:%s", tokenHash)

	exists, err := bl.cache.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check blacklist: %w", err)
	}

	return exists > 0, nil
}

// RevokeAllUserTokens revokes all tokens for a specific user
// This is done by adding a user-level revocation entry
func (bl *JWTBlacklist) RevokeAllUserTokens(ctx context.Context, userID string, reason string) error {
	if !bl.enabled {
		return fmt.Errorf("JWT blacklist not enabled")
	}

	// Set a user-level revocation timestamp
	key := fmt.Sprintf("jwt:user_revoked:%s", userID)

	// Store revocation timestamp (tokens issued before this are invalid)
	err := bl.cache.Set(ctx, key, time.Now().Unix(), 7*24*time.Hour).Err() // Keep for 7 days
	if err != nil {
		return fmt.Errorf("failed to revoke user tokens: %w", err)
	}

	bl.logger.Printf("[JWTBlacklist] Revoked all tokens for user: %s (reason: %s)", userID, reason)
	return nil
}

// IsUserRevoked checks if all tokens for a user have been revoked
func (bl *JWTBlacklist) IsUserRevoked(ctx context.Context, userID string, issuedAt time.Time) (bool, error) {
	if !bl.enabled {
		return false, nil
	}

	key := fmt.Sprintf("jwt:user_revoked:%s", userID)

	revokedAtStr, err := bl.cache.Get(ctx, key).Result()
	if err == redis.Nil {
		// No user-level revocation
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check user revocation: %w", err)
	}

	// Parse revocation timestamp
	var revokedAt int64
	fmt.Sscanf(revokedAtStr, "%d", &revokedAt)

	// If token was issued before revocation, it's invalid
	return issuedAt.Unix() < revokedAt, nil
}

// GetRevocationReason returns why a token was revoked
func (bl *JWTBlacklist) GetRevocationReason(ctx context.Context, tokenString string) (string, error) {
	if !bl.enabled {
		return "", fmt.Errorf("JWT blacklist not enabled")
	}

	tokenHash := hashJWT(tokenString)
	key := fmt.Sprintf("jwt:blacklist:%s", tokenHash)

	reason, err := bl.cache.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", fmt.Errorf("token not revoked")
	}
	if err != nil {
		return "", err
	}

	return reason, nil
}

// CleanupExpired removes expired blacklist entries (this happens automatically via TTL)
// This method is mainly for stats and monitoring
func (bl *JWTBlacklist) CleanupExpired(ctx context.Context) (int64, error) {
	if !bl.enabled {
		return 0, nil
	}

	// Redis automatically removes expired keys, so we just return stats
	pattern := "jwt:blacklist:*"

	var count int64
	iter := bl.cache.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		count++
	}

	if err := iter.Err(); err != nil {
		return 0, err
	}

	return count, nil
}

// GetStats returns blacklist statistics
func (bl *JWTBlacklist) GetStats(ctx context.Context) (map[string]interface{}, error) {
	if !bl.enabled {
		return map[string]interface{}{
			"enabled": false,
		}, nil
	}

	blacklistedCount, err := bl.CleanupExpired(ctx)
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"enabled":           true,
		"blacklisted_count": blacklistedCount,
		"bloom_filter":      bl.useBloomFilter,
	}

	return stats, nil
}

// initBloomFilter initializes a Bloom filter for faster negative lookups
func (bl *JWTBlacklist) initBloomFilter(ctx context.Context) error {
	// Use Redis Bloom filter if available (requires RedisBloom module)
	// For now, we'll use a simple implementation with Redis BF commands

	// Check if BF.RESERVE is available
	_, err := bl.cache.Do(ctx, "BF.RESERVE", "jwt:bloom", "0.001", "10000").Result()
	if err != nil {
		// Bloom filter not available
		return fmt.Errorf("Bloom filter not available: %w", err)
	}

	bl.logger.Println("[JWTBlacklist] Initialized Bloom filter with 0.1% false positive rate")
	return nil
}

// addToBloomFilter adds a token hash to the Bloom filter
func (bl *JWTBlacklist) addToBloomFilter(ctx context.Context, tokenHash string) {
	if !bl.useBloomFilter {
		return
	}

	_, err := bl.cache.Do(ctx, "BF.ADD", "jwt:bloom", tokenHash).Result()
	if err != nil {
		bl.logger.Printf("[JWTBlacklist] Failed to add to Bloom filter: %v", err)
	}
}

// checkBloomFilter checks if a token hash might be in the blacklist
// Returns false if definitely NOT in blacklist, true if MIGHT be in blacklist
func (bl *JWTBlacklist) checkBloomFilter(ctx context.Context, tokenHash string) (bool, error) {
	if !bl.useBloomFilter {
		return true, nil // Conservative: assume might be blacklisted
	}

	result, err := bl.cache.Do(ctx, "BF.EXISTS", "jwt:bloom", tokenHash).Result()
	if err != nil {
		return true, err // Conservative: assume might be blacklisted on error
	}

	exists, ok := result.(int64)
	if !ok {
		return true, fmt.Errorf("unexpected Bloom filter response type")
	}

	return exists > 0, nil
}

// hashJWT creates a SHA256 hash of a JWT token for storage
func hashJWT(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Close closes the Redis connection
func (bl *JWTBlacklist) Close() error {
	if bl.cache != nil {
		return bl.cache.Close()
	}
	return nil
}

// BatchRevoke revokes multiple tokens in a single operation
// Enhancement: Reduces overhead for bulk revocations
func (bl *JWTBlacklist) BatchRevoke(ctx context.Context, tokens []string, expiresAt []time.Time, reasons []string) error {
	if !bl.enabled {
		return fmt.Errorf("JWT blacklist not enabled")
	}

	if len(tokens) != len(expiresAt) || len(tokens) != len(reasons) {
		return fmt.Errorf("mismatched array lengths")
	}

	pipe := bl.cache.Pipeline()

	for i, token := range tokens {
		tokenHash := hashJWT(token)
		ttl := time.Until(expiresAt[i])

		if ttl > 0 {
			key := fmt.Sprintf("jwt:blacklist:%s", tokenHash)
			pipe.Set(ctx, key, reasons[i], ttl)

			if bl.useBloomFilter {
				pipe.Do(ctx, "BF.ADD", "jwt:bloom", tokenHash)
			}
		}
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("batch revoke failed: %w", err)
	}

	bl.logger.Printf("[JWTBlacklist] Batch revoked %d tokens", len(tokens))
	return nil
}
