package providers

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockVaultClient for testing
type MockVaultClient struct {
	keys map[string]*ProviderKey
}

func (m *MockVaultClient) GetProviderKey(ctx context.Context, tenantID, providerID string) (*ProviderKey, error) {
	key := fmt.Sprintf("%s:%s", tenantID, providerID)
	if k, exists := m.keys[key]; exists {
		return k, nil
	}
	return nil, fmt.Errorf("key not found")
}

func (m *MockVaultClient) ListProviderKeys(ctx context.Context, tenantID, providerID string) ([]*ProviderKey, error) {
	return nil, nil
}

// Test P0-8: Dual Key Support During Rotation
// Ensures both old and new keys work during grace period
func TestKeyRotation_DualKeySupport(t *testing.T) {
	vault := &MockVaultClient{keys: make(map[string]*ProviderKey)}
	krm := NewKeyRotationManager(vault, 1*time.Second, 5*time.Second)
	defer krm.Stop()

	tenantID := "tenant-a"
	providerID := "openai"

	// Set initial key
	oldKey := &ProviderKey{
		KeyID:     "key-old",
		KeyValue:  "sk-old-xxxxx",
		CreatedAt: time.Now().Add(-24 * time.Hour),
	}

	krm.mu.Lock()
	krm.tenantKeys[tenantID] = make(map[string]*TenantProviderKeys)
	krm.tenantKeys[tenantID][providerID] = &TenantProviderKeys{
		ProviderID: providerID,
		TenantID:   tenantID,
		ActiveKey:  oldKey,
	}
	krm.mu.Unlock()

	// Verify old key works
	key, err := krm.GetActiveKey(tenantID, providerID)
	require.NoError(t, err)
	assert.Equal(t, "key-old", key.KeyID)

	// Initiate rotation with new key
	newKey := &ProviderKey{
		KeyID:     "key-new",
		KeyValue:  "sk-new-xxxxx",
		CreatedAt: time.Now(),
	}

	err = krm.InitiateRotation(tenantID, providerID, newKey)
	require.NoError(t, err)

	// P0-8 FIX: During grace period, BOTH keys should be usable
	// New key should be preferred
	activeKey, err := krm.GetActiveKey(tenantID, providerID)
	require.NoError(t, err)
	assert.Equal(t, "key-new", activeKey.KeyID, "New key should be active")

	// Old key should still be available as fallback
	fallbackKey, err := krm.GetFallbackKey(tenantID, providerID)
	require.NoError(t, err)
	assert.Equal(t, "key-old", fallbackKey.KeyID, "Old key should be fallback")

	// Verify rotation status
	status, err := krm.GetRotationStatus(tenantID, providerID)
	require.NoError(t, err)
	assert.True(t, status.RotationInProgress)
	assert.True(t, status.HasActiveKey)
	assert.True(t, status.HasPendingKey)
	assert.NotNil(t, status.GracePeriodRemaining)
}

// Test P0-8: Zero Downtime Key Rotation
// Simulates rotating key while requests are in flight
func TestKeyRotation_ZeroDowntime(t *testing.T) {
	vault := &MockVaultClient{keys: make(map[string]*ProviderKey)}
	krm := NewKeyRotationManager(vault, 1*time.Second, 2*time.Second)
	defer krm.Stop()

	tenantID := "tenant-b"
	providerID := "anthropic"

	// Set initial key
	oldKey := &ProviderKey{
		KeyID:    "key-v1",
		KeyValue: "sk-v1-xxxxx",
	}

	krm.mu.Lock()
	krm.tenantKeys[tenantID] = make(map[string]*TenantProviderKeys)
	krm.tenantKeys[tenantID][providerID] = &TenantProviderKeys{
		ActiveKey: oldKey,
	}
	krm.mu.Unlock()

	// Simulate 100 concurrent requests DURING rotation
	requestErrors := make(chan error, 100)
	var wg sync.WaitGroup

	// Start requests
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			// Simulate request: get key and use it
			key, err := krm.GetActiveKey(tenantID, providerID)
			if err != nil {
				requestErrors <- err
				return
			}

			// Simulate API call with key
			if key.KeyValue == "" {
				requestErrors <- fmt.Errorf("empty key")
			}

			// If primary key fails, try fallback
			if key.KeyID == "key-v2" && idx%10 == 0 {
				// Simulate new key failure, retry with fallback
				fallback, err := krm.GetFallbackKey(tenantID, providerID)
				if err != nil {
					requestErrors <- err
					return
				}
				if fallback.KeyValue == "" {
					requestErrors <- fmt.Errorf("empty fallback key")
				}
			}

			time.Sleep(10 * time.Millisecond)
		}(i)

		// Rotate key mid-flight at request 50
		if i == 50 {
			newKey := &ProviderKey{
				KeyID:    "key-v2",
				KeyValue: "sk-v2-xxxxx",
			}
			_ = krm.InitiateRotation(tenantID, providerID, newKey)
			t.Log("Key rotated mid-flight")
		}
	}

	wg.Wait()
	close(requestErrors)

	// Count errors
	errorCount := 0
	for err := range requestErrors {
		t.Logf("Request error: %v", err)
		errorCount++
	}

	// P0-8 FIX: Zero errors during rotation (dual key ensures continuity)
	assert.Equal(t, 0, errorCount, "Should have ZERO errors during key rotation")
}

// Test P0-8: Grace Period Expiration
// Ensures old key is removed after grace period
func TestKeyRotation_GracePeriodExpiration(t *testing.T) {
	vault := &MockVaultClient{keys: make(map[string]*ProviderKey)}
	// Short grace period for fast test
	krm := NewKeyRotationManager(vault, 500*time.Millisecond, 1*time.Second)
	defer krm.Stop()

	tenantID := "tenant-c"
	providerID := "gemini"

	oldKey := &ProviderKey{KeyID: "old"}
	newKey := &ProviderKey{KeyID: "new"}

	krm.mu.Lock()
	krm.tenantKeys[tenantID] = make(map[string]*TenantProviderKeys)
	krm.tenantKeys[tenantID][providerID] = &TenantProviderKeys{
		ActiveKey: oldKey,
	}
	krm.mu.Unlock()

	// Initiate rotation
	err := krm.InitiateRotation(tenantID, providerID, newKey)
	require.NoError(t, err)

	// Old key should be available as fallback
	fallback, err := krm.GetFallbackKey(tenantID, providerID)
	require.NoError(t, err)
	assert.Equal(t, "old", fallback.KeyID)

	// Wait for grace period to expire
	time.Sleep(1500 * time.Millisecond)

	// After grace period, old key should be gone
	fallback, err = krm.GetFallbackKey(tenantID, providerID)
	assert.Error(t, err, "Fallback key should be unavailable after grace period")

	// New key should be fully promoted to active
	activeKey, err := krm.GetActiveKey(tenantID, providerID)
	require.NoError(t, err)
	assert.Equal(t, "new", activeKey.KeyID)

	// Rotation should be marked as complete
	status, err := krm.GetRotationStatus(tenantID, providerID)
	require.NoError(t, err)
	assert.False(t, status.RotationInProgress)
}

// Test P0-8: Background Key Refresh
// Ensures keys are refreshed from Vault every 60s without restart
func TestKeyRotation_BackgroundRefresh(t *testing.T) {
	vault := &MockVaultClient{keys: make(map[string]*ProviderKey)}

	tenantID := "tenant-d"
	providerID := "openai"

	// Initial key in Vault
	vault.keys[tenantID+":"+providerID] = &ProviderKey{
		KeyID:    "vault-key-v1",
		KeyValue: "sk-vault-v1",
	}

	// Fast refresh for testing
	krm := NewKeyRotationManager(vault, 500*time.Millisecond, 5*time.Second)
	defer krm.Stop()

	// Initialize with old key
	oldKey := &ProviderKey{KeyID: "local-key-old"}
	krm.mu.Lock()
	krm.tenantKeys[tenantID] = make(map[string]*TenantProviderKeys)
	krm.tenantKeys[tenantID][providerID] = &TenantProviderKeys{
		ActiveKey: oldKey,
	}
	krm.mu.Unlock()

	// Wait for background refresh to fetch from Vault
	time.Sleep(1 * time.Second)

	// Key should be updated from Vault
	krm.mu.RLock()
	updatedKey := krm.tenantKeys[tenantID][providerID].ActiveKey
	krm.mu.RUnlock()

	assert.Equal(t, "vault-key-v1", updatedKey.KeyID, "Key should be refreshed from Vault")
}

import (
	"fmt"
	"sync"
)
