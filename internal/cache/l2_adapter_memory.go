package cache

import (
	"container/list"
	"context"
	"errors"
	"sync"
	"time"
)

// MemoryL2Cache implements L2Cache using in-process memory with LRU eviction
type MemoryL2Cache struct {
	config *L2CacheConfig
	mu     sync.RWMutex

	// LRU implementation
	items    map[string]*list.Element // Key -> list element
	lruList  *list.List               // Doubly-linked list for LRU tracking
	maxSize  int

	// Statistics
	stats *L2StatsCollector

	// Background cleanup
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// lruEntry represents an entry in the LRU list
type lruEntry struct {
	key   string
	entry *L2CacheEntry
}

// NewMemoryL2Cache creates a new in-memory L2 cache
func NewMemoryL2Cache(config *L2CacheConfig) (*MemoryL2Cache, error) {
	if config == nil {
		return nil, errors.New("config cannot be nil")
	}

	// Default configuration
	if config.MaxSize <= 0 {
		config.MaxSize = 10000 // Default 10K entries
	}
	if config.DefaultTTL == 0 {
		config.DefaultTTL = 5 * time.Minute
	}
	if config.EvictionPolicy == "" {
		config.EvictionPolicy = "lru"
	}

	cache := &MemoryL2Cache{
		config:   config,
		items:    make(map[string]*list.Element, config.MaxSize),
		lruList:  list.New(),
		maxSize:  config.MaxSize,
		stats:    NewL2StatsCollector(),
		stopChan: make(chan struct{}),
	}

	// Start background cleanup goroutine
	cache.wg.Add(1)
	go cache.cleanupExpired()

	return cache, nil
}

// Get retrieves a value from the cache
func (c *MemoryL2Cache) Get(ctx context.Context, key string) (interface{}, bool, error) {
	start := time.Now()
	defer func() {
		c.stats.RecordGetLatency(time.Since(start))
	}()

	c.mu.Lock()
	defer c.mu.Unlock()

	elem, found := c.items[key]
	if !found {
		c.stats.RecordMiss()
		return nil, false, nil
	}

	entry := elem.Value.(*lruEntry).entry

	// Check expiration
	if entry.IsExpired() {
		c.evictElement(elem)
		c.stats.RecordMiss()
		return nil, false, nil
	}

	// Update access metadata
	entry.AccessedAt = time.Now()
	entry.AccessCount++

	// Move to front of LRU list (most recently used)
	c.lruList.MoveToFront(elem)

	c.stats.RecordHit()
	return entry.Value, true, nil
}

// Set stores a value in the cache
func (c *MemoryL2Cache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		c.stats.RecordSetLatency(time.Since(start))
	}()

	if ttl == 0 {
		ttl = c.config.DefaultTTL
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	entry := &L2CacheEntry{
		Key:        key,
		Value:      value,
		ExpiresAt:  now.Add(ttl),
		AccessedAt: now,
		CreatedAt:  now,
		AccessCount: 0,
	}

	// Check if key already exists
	if elem, found := c.items[key]; found {
		// Update existing entry
		elem.Value.(*lruEntry).entry = entry
		c.lruList.MoveToFront(elem)
	} else {
		// Add new entry
		// Evict if at capacity
		if c.lruList.Len() >= c.maxSize {
			c.evictOldest()
		}

		// Add to front of LRU list
		elem := c.lruList.PushFront(&lruEntry{
			key:   key,
			entry: entry,
		})
		c.items[key] = elem
	}

	c.stats.RecordSet()
	return nil
}

// Delete removes a key from the cache
func (c *MemoryL2Cache) Delete(ctx context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, found := c.items[key]; found {
		c.evictElement(elem)
		c.stats.RecordDelete()
	}

	return nil
}

// Clear removes all entries from the cache
func (c *MemoryL2Cache) Clear(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*list.Element, c.maxSize)
	c.lruList.Init()

	return nil
}

// Stats returns cache statistics
func (c *MemoryL2Cache) Stats() L2Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stats := c.stats.GetStats()
	stats.CurrentSize = c.lruList.Len()
	stats.MaxSize = c.maxSize

	return stats
}

// Close closes the cache and stops background tasks
func (c *MemoryL2Cache) Close() error {
	close(c.stopChan)
	c.wg.Wait()
	return nil
}

// evictOldest evicts the least recently used item
func (c *MemoryL2Cache) evictOldest() {
	elem := c.lruList.Back()
	if elem != nil {
		c.evictElement(elem)
	}
}

// evictElement removes a specific element from the cache
func (c *MemoryL2Cache) evictElement(elem *list.Element) {
	if elem == nil {
		return
	}

	entry := elem.Value.(*lruEntry)
	delete(c.items, entry.key)
	c.lruList.Remove(elem)
	c.stats.RecordEviction()
}

// cleanupExpired periodically removes expired entries
func (c *MemoryL2Cache) cleanupExpired() {
	defer c.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.removeExpired()
		case <-c.stopChan:
			return
		}
	}
}

// removeExpired removes all expired entries
func (c *MemoryL2Cache) removeExpired() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	var toEvict []*list.Element

	// Collect expired entries
	for elem := c.lruList.Front(); elem != nil; elem = elem.Next() {
		entry := elem.Value.(*lruEntry).entry
		if !entry.ExpiresAt.IsZero() && now.After(entry.ExpiresAt) {
			toEvict = append(toEvict, elem)
		}
	}

	// Evict collected entries
	for _, elem := range toEvict {
		c.evictElement(elem)
	}
}

// GetSize returns the current number of items in cache
func (c *MemoryL2Cache) GetSize() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lruList.Len()
}

// GetCapacity returns the maximum capacity of the cache
func (c *MemoryL2Cache) GetCapacity() int {
	return c.maxSize
}

// Resize changes the maximum size of the cache
func (c *MemoryL2Cache) Resize(newSize int) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if newSize <= 0 {
		return errors.New("size must be positive")
	}

	c.maxSize = newSize

	// Evict items if necessary
	for c.lruList.Len() > c.maxSize {
		c.evictOldest()
	}

	return nil
}

// GetEntry returns the raw cache entry for inspection
func (c *MemoryL2Cache) GetEntry(key string) (*L2CacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	elem, found := c.items[key]
	if !found {
		return nil, false
	}

	entry := elem.Value.(*lruEntry).entry
	return entry, true
}

// Keys returns all keys currently in cache
func (c *MemoryL2Cache) Keys() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	keys := make([]string, 0, len(c.items))
	for key := range c.items {
		keys = append(keys, key)
	}
	return keys
}

// SetWithAbsoluteExpiration sets a value with an absolute expiration time
func (c *MemoryL2Cache) SetWithAbsoluteExpiration(ctx context.Context, key string, value interface{}, expiresAt time.Time) error {
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		return errors.New("expiration time must be in the future")
	}

	return c.Set(ctx, key, value, ttl)
}

// Peek retrieves a value without updating access metadata (for debugging)
func (c *MemoryL2Cache) Peek(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	elem, found := c.items[key]
	if !found {
		return nil, false
	}

	entry := elem.Value.(*lruEntry).entry
	if entry.IsExpired() {
		return nil, false
	}

	return entry.Value, true
}

// GetOldest returns the least recently used key (for debugging)
func (c *MemoryL2Cache) GetOldest() (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	elem := c.lruList.Back()
	if elem == nil {
		return "", false
	}

	return elem.Value.(*lruEntry).key, true
}

// GetNewest returns the most recently used key (for debugging)
func (c *MemoryL2Cache) GetNewest() (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	elem := c.lruList.Front()
	if elem == nil {
		return "", false
	}

	return elem.Value.(*lruEntry).key, true
}
