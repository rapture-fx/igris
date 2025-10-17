package cache

import (
	"container/list"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// LRUConfig holds configuration for the LRU cache
type LRUConfig struct {
	Capacity    int           // Max number of entries
	TTL         time.Duration // Time-to-live for entries
	EnableStats bool          // Enable statistics tracking
}

// LRUEntry represents a single cache entry with TTL
type LRUEntry struct {
	Key       string
	Value     *CachedPrediction
	ExpiresAt time.Time
}

// LRUCache implements a thread-safe LRU cache with TTL
type LRUCache struct {
	capacity   int
	ttl        time.Duration
	mu         sync.RWMutex
	cache      map[string]*list.Element // key -> list element
	evictList  *list.List               // LRU eviction list
	logger     zerolog.Logger

	// Statistics
	hits       int64
	misses     int64
	evictions  int64
	expirations int64
	enableStats bool
}

// NewLRUCache creates a new in-memory LRU cache
func NewLRUCache(config LRUConfig, logger zerolog.Logger) *LRUCache {
	// Set defaults
	if config.Capacity <= 0 {
		config.Capacity = 1000 // Default 1000 entries
	}
	if config.TTL == 0 {
		config.TTL = 5 * time.Minute // Default 5 min TTL (shorter than Redis)
	}

	lru := &LRUCache{
		capacity:    config.Capacity,
		ttl:         config.TTL,
		cache:       make(map[string]*list.Element),
		evictList:   list.New(),
		logger:      logger.With().Str("component", "lru-cache").Logger(),
		enableStats: config.EnableStats,
	}

	lru.logger.Info().
		Int("capacity", config.Capacity).
		Dur("ttl", config.TTL).
		Msg("LRU in-memory cache initialized")

	return lru
}

// Get retrieves a value from the LRU cache
func (c *LRUCache) Get(key string) (*CachedPrediction, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, exists := c.cache[key]
	if !exists {
		if c.enableStats {
			c.misses++
		}
		c.logger.Debug().Str("key", key).Msg("LRU cache miss")
		return nil, false
	}

	entry := elem.Value.(*LRUEntry)

	// Check if entry has expired
	if time.Now().After(entry.ExpiresAt) {
		c.removeElement(elem)
		if c.enableStats {
			c.misses++
			c.expirations++
		}
		c.logger.Debug().
			Str("key", key).
			Dur("age", time.Since(entry.ExpiresAt)).
			Msg("LRU cache entry expired")
		return nil, false
	}

	// Move to front (most recently used)
	c.evictList.MoveToFront(elem)

	if c.enableStats {
		c.hits++
	}

	c.logger.Debug().
		Str("key", key).
		Dur("ttl_remaining", time.Until(entry.ExpiresAt)).
		Msg("LRU cache hit")

	return entry.Value, true
}

// Set adds or updates a value in the LRU cache
func (c *LRUCache) Set(key string, value *CachedPrediction) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if key already exists
	if elem, exists := c.cache[key]; exists {
		c.evictList.MoveToFront(elem)
		entry := elem.Value.(*LRUEntry)
		entry.Value = value
		entry.ExpiresAt = time.Now().Add(c.ttl)
		c.logger.Debug().Str("key", key).Msg("LRU cache entry updated")
		return
	}

	// Add new entry
	entry := &LRUEntry{
		Key:       key,
		Value:     value,
		ExpiresAt: time.Now().Add(c.ttl),
	}

	elem := c.evictList.PushFront(entry)
	c.cache[key] = elem

	// Evict oldest entry if capacity exceeded
	if c.evictList.Len() > c.capacity {
		c.evictOldest()
	}

	c.logger.Debug().
		Str("key", key).
		Int("size", c.evictList.Len()).
		Msg("LRU cache entry added")
}

// Delete removes an entry from the cache
func (c *LRUCache) Delete(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, exists := c.cache[key]
	if !exists {
		return false
	}

	c.removeElement(elem)
	c.logger.Debug().Str("key", key).Msg("LRU cache entry deleted")
	return true
}

// Clear removes all entries from the cache
func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]*list.Element)
	c.evictList.Init()

	c.logger.Info().Msg("LRU cache cleared")
}

// Size returns the current number of entries
func (c *LRUCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.evictList.Len()
}

// Capacity returns the maximum capacity
func (c *LRUCache) Capacity() int {
	return c.capacity
}

// GetStats returns cache statistics
func (c *LRUCache) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	totalRequests := c.hits + c.misses
	hitRatio := 0.0
	if totalRequests > 0 {
		hitRatio = float64(c.hits) / float64(totalRequests)
	}

	stats := map[string]interface{}{
		"capacity":     c.capacity,
		"size":         c.evictList.Len(),
		"ttl_seconds":  c.ttl.Seconds(),
		"hits":         c.hits,
		"misses":       c.misses,
		"evictions":    c.evictions,
		"expirations":  c.expirations,
		"hit_ratio":    hitRatio,
		"utilization":  float64(c.evictList.Len()) / float64(c.capacity),
	}

	return stats
}

// ResetStats resets all statistics counters
func (c *LRUCache) ResetStats() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.hits = 0
	c.misses = 0
	c.evictions = 0
	c.expirations = 0

	c.logger.Info().Msg("LRU cache statistics reset")
}

// CleanupExpired removes all expired entries (should be called periodically)
func (c *LRUCache) CleanupExpired() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	removed := 0

	// Iterate from back (oldest) to front
	for elem := c.evictList.Back(); elem != nil; {
		entry := elem.Value.(*LRUEntry)
		prev := elem.Prev()

		if now.After(entry.ExpiresAt) {
			c.removeElement(elem)
			removed++
			if c.enableStats {
				c.expirations++
			}
		} else {
			// Since list is ordered by access time, we can stop here
			break
		}

		elem = prev
	}

	if removed > 0 {
		c.logger.Debug().Int("removed", removed).Msg("Cleaned up expired LRU entries")
	}

	return removed
}

// evictOldest removes the oldest (least recently used) entry
func (c *LRUCache) evictOldest() {
	elem := c.evictList.Back()
	if elem != nil {
		c.removeElement(elem)
		if c.enableStats {
			c.evictions++
		}
	}
}

// removeElement removes an element from the cache and evict list
func (c *LRUCache) removeElement(elem *list.Element) {
	entry := elem.Value.(*LRUEntry)
	delete(c.cache, entry.Key)
	c.evictList.Remove(elem)
}

// Keys returns all keys currently in the cache
func (c *LRUCache) Keys() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	keys := make([]string, 0, len(c.cache))
	for k := range c.cache {
		keys = append(keys, k)
	}
	return keys
}

// MarshalJSON implements json.Marshaler for LRUCache stats
func (c *LRUCache) MarshalJSON() ([]byte, error) {
	return json.Marshal(c.GetStats())
}

// String returns a string representation of the cache
func (c *LRUCache) String() string {
	stats := c.GetStats()
	return fmt.Sprintf("LRUCache{size: %v/%v, hits: %v, misses: %v, hit_ratio: %.2f%%}",
		stats["size"], stats["capacity"], stats["hits"], stats["misses"], stats["hit_ratio"].(float64)*100)
}
