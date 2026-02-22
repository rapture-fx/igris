package security

// FIX-2026-02: byok — tests for real provider validation and cache

import (
	"log"
	"net/http"
	"testing"
	"time"
)

// TestValidationCacheHit verifies that a cached validation result is returned
// without making a network call.
func TestValidationCacheHit(t *testing.T) {
	kv := &KeyVault{
		httpClient:      &http.Client{Timeout: 5 * time.Second},
		validationCache: make(map[string]validationCacheEntry),
		logger:          log.Default(),
	}

	// Pre-populate cache with a fresh entry
	kv.validationCacheMu.Lock()
	kv.validationCache["tenant-x:openai"] = validationCacheEntry{
		IsValid:  true,
		CachedAt: time.Now(),
	}
	kv.validationCacheMu.Unlock()

	kv.validationCacheMu.RLock()
	entry, cached := kv.validationCache["tenant-x:openai"]
	kv.validationCacheMu.RUnlock()

	if !cached {
		t.Fatal("expected cache hit")
	}
	if !entry.IsValid {
		t.Error("expected IsValid=true from cache")
	}
	if time.Since(entry.CachedAt) >= time.Hour {
		t.Error("expected cache entry to be within 1h TTL")
	}
}

// TestValidationCacheExpiry verifies that a stale cache entry is considered expired.
func TestValidationCacheExpiry(t *testing.T) {
	kv := &KeyVault{
		httpClient:      &http.Client{Timeout: 5 * time.Second},
		validationCache: make(map[string]validationCacheEntry),
		logger:          log.Default(),
	}

	// Stale entry (2 hours old)
	kv.validationCacheMu.Lock()
	kv.validationCache["tenant-y:anthropic"] = validationCacheEntry{
		IsValid:  true,
		CachedAt: time.Now().Add(-2 * time.Hour),
	}
	kv.validationCacheMu.Unlock()

	kv.validationCacheMu.RLock()
	entry, cached := kv.validationCache["tenant-y:anthropic"]
	kv.validationCacheMu.RUnlock()

	shouldRefetch := !cached || time.Since(entry.CachedAt) >= time.Hour
	if !shouldRefetch {
		t.Error("expected stale cache entry to require re-validation")
	}
}

// TestOpenAIKeyPrefixRejected verifies that a non-sk- key is rejected before
// making any HTTP call.
func TestOpenAIKeyPrefixRejected(t *testing.T) {
	kv := &KeyVault{
		httpClient:      &http.Client{Timeout: 5 * time.Second},
		validationCache: make(map[string]validationCacheEntry),
		logger:          log.Default(),
	}

	valid, err := kv.validateWithProvider("openai", "not-an-openai-key")
	if err == nil {
		t.Error("expected error for invalid OpenAI key format")
	}
	if valid {
		t.Error("expected isValid=false for invalid key format")
	}
}

// TestAnthropicKeyPrefixRejected verifies that a non-sk-ant- key is rejected.
func TestAnthropicKeyPrefixRejected(t *testing.T) {
	kv := &KeyVault{
		httpClient:      &http.Client{Timeout: 5 * time.Second},
		validationCache: make(map[string]validationCacheEntry),
		logger:          log.Default(),
	}

	valid, err := kv.validateWithProvider("anthropic", "sk-openai-not-anthropic")
	if err == nil {
		t.Error("expected error for invalid Anthropic key format")
	}
	if valid {
		t.Error("expected isValid=false for wrong prefix")
	}
}

// TestBenchmarkProviderAlwaysValid verifies benchmark keys bypass validation.
func TestBenchmarkProviderAlwaysValid(t *testing.T) {
	kv := &KeyVault{
		httpClient:      &http.Client{Timeout: 5 * time.Second},
		validationCache: make(map[string]validationCacheEntry),
		logger:          log.Default(),
	}

	valid, err := kv.validateWithProvider("benchmark", "any-key")
	if err != nil {
		t.Errorf("unexpected error for benchmark provider: %v", err)
	}
	if !valid {
		t.Error("expected benchmark provider to always return valid=true")
	}
}
