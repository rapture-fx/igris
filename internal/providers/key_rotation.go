package providers

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// P0-8: BYOK Key Rotation Manager
// Supports dual-key rotation with zero downtime

// KeyRotationManager manages API key rotation for providers
type KeyRotationManager struct {
	// Dual key storage per tenant per provider
	tenantKeys map[string]map[string]*TenantProviderKeys // tenantID -> providerID -> keys
	mu         sync.RWMutex

	// Vault client for fetching keys
	vaultClient VaultClient

	// Background refresh interval
	refreshInterval time.Duration

	// Rotation grace period (how long to keep old key active)
	gracePeriod time.Duration

	// Shutdown channel
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// TenantProviderKeys holds active and pending keys for a tenant's provider
type TenantProviderKeys struct {
	ProviderID string
	TenantID   string

	// P0-8 FIX: Support TWO active keys during rotation
	ActiveKey  *ProviderKey // Current active key
	PendingKey *ProviderKey // New key being rotated to (nil if no rotation in progress)

	// Rotation metadata
	RotationStartedAt *time.Time
	GracePeriodEnds   *time.Time
}

// ProviderKey represents a provider API key
type ProviderKey struct {
	KeyID       string
	KeyValue    string // Encrypted or actual key
	CreatedAt   time.Time
	ActivatedAt *time.Time
	ExpiresAt   *time.Time
}

// VaultClient interface for fetching keys from Vault
type VaultClient interface {
	GetProviderKey(ctx context.Context, tenantID, providerID string) (*ProviderKey, error)
	ListProviderKeys(ctx context.Context, tenantID, providerID string) ([]*ProviderKey, error)
}

// NewKeyRotationManager creates a new key rotation manager
func NewKeyRotationManager(vaultClient VaultClient, refreshInterval, gracePeriod time.Duration) *KeyRotationManager {
	if refreshInterval == 0 {
		refreshInterval = 60 * time.Second // P0-8: Default 60s refresh
	}
	if gracePeriod == 0 {
		gracePeriod = 15 * time.Minute // P0-8: Default 15min grace period
	}

	krm := &KeyRotationManager{
		tenantKeys:      make(map[string]map[string]*TenantProviderKeys),
		vaultClient:     vaultClient,
		refreshInterval: refreshInterval,
		gracePeriod:     gracePeriod,
		stopChan:        make(chan struct{}),
	}

	// P0-8 FIX: Start background key refresh goroutine
	krm.wg.Add(1)
	go krm.backgroundRefresh()

	log.Printf("[KeyRotation] Manager started (refresh: %v, grace: %v)", refreshInterval, gracePeriod)

	return krm
}

// GetActiveKey returns the current active key for a tenant's provider
// P0-8 FIX: Returns FIRST valid key (active or pending if grace period active)
func (krm *KeyRotationManager) GetActiveKey(tenantID, providerID string) (*ProviderKey, error) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	tenantProviders, exists := krm.tenantKeys[tenantID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant %s", tenantID)
	}

	keys, exists := tenantProviders[providerID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant %s provider %s", tenantID, providerID)
	}

	// P0-8 FIX: During rotation, try pending key first, then fall back to active key
	if keys.PendingKey != nil && keys.GracePeriodEnds != nil {
		if time.Now().Before(*keys.GracePeriodEnds) {
			// Still within grace period, pending key is preferred
			return keys.PendingKey, nil
		} else {
			// Grace period expired, pending key is now fully active
			// (This should have been promoted by background refresh, but handle it here too)
			return keys.PendingKey, nil
		}
	}

	// No pending key or outside grace period
	if keys.ActiveKey != nil {
		return keys.ActiveKey, nil
	}

	return nil, fmt.Errorf("no valid key available for tenant %s provider %s", tenantID, providerID)
}

// GetFallbackKey returns the old key during rotation grace period
// P0-8 FIX: Allows retry with old key if new key fails
func (krm *KeyRotationManager) GetFallbackKey(tenantID, providerID string) (*ProviderKey, error) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	tenantProviders, exists := krm.tenantKeys[tenantID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant %s", tenantID)
	}

	keys, exists := tenantProviders[providerID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant %s provider %s", tenantID, providerID)
	}

	// During rotation, return active key as fallback
	if keys.PendingKey != nil && keys.ActiveKey != nil {
		if keys.GracePeriodEnds != nil && time.Now().Before(*keys.GracePeriodEnds) {
			return keys.ActiveKey, nil
		}
	}

	return nil, fmt.Errorf("no fallback key available")
}

// InitiateRotation starts a key rotation for a tenant's provider
// P0-8 FIX: Sets up dual-key configuration with grace period
func (krm *KeyRotationManager) InitiateRotation(tenantID, providerID string, newKey *ProviderKey) error {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	// Ensure tenant map exists
	if krm.tenantKeys[tenantID] == nil {
		krm.tenantKeys[tenantID] = make(map[string]*TenantProviderKeys)
	}

	// Get or create keys entry
	keys, exists := krm.tenantKeys[tenantID][providerID]
	if !exists {
		keys = &TenantProviderKeys{
			ProviderID: providerID,
			TenantID:   tenantID,
		}
		krm.tenantKeys[tenantID][providerID] = keys
	}

	// P0-8 FIX: Move current active key to old slot, new key to pending
	// Both keys remain valid for grace period
	now := time.Now()
	gracePeriodEnd := now.Add(krm.gracePeriod)

	keys.PendingKey = newKey
	keys.RotationStartedAt = &now
	keys.GracePeriodEnds = &gracePeriodEnd

	log.Printf("[KeyRotation] Initiated rotation for tenant %s provider %s (grace period ends: %v)",
		tenantID, providerID, gracePeriodEnd)

	return nil
}

// CompleteRotation promotes pending key to active and removes old key
// Called automatically after grace period expires
func (krm *KeyRotationManager) CompleteRotation(tenantID, providerID string) error {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	tenantProviders, exists := krm.tenantKeys[tenantID]
	if !exists {
		return fmt.Errorf("no keys found for tenant %s", tenantID)
	}

	keys, exists := tenantProviders[providerID]
	if !exists {
		return fmt.Errorf("no keys found for tenant %s provider %s", tenantID, providerID)
	}

	if keys.PendingKey == nil {
		return fmt.Errorf("no pending key to complete rotation")
	}

	// P0-8 FIX: Promote pending key to active, discard old active key
	keys.ActiveKey = keys.PendingKey
	keys.PendingKey = nil
	keys.RotationStartedAt = nil
	keys.GracePeriodEnds = nil

	log.Printf("[KeyRotation] Completed rotation for tenant %s provider %s", tenantID, providerID)

	return nil
}

// backgroundRefresh periodically refreshes keys from Vault
// P0-8 FIX: Reloads provider clients every 60s without restart
func (krm *KeyRotationManager) backgroundRefresh() {
	defer krm.wg.Done()

	ticker := time.NewTicker(krm.refreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			krm.refreshAllKeys()
		case <-krm.stopChan:
			log.Println("[KeyRotation] Background refresh stopped")
			return
		}
	}
}

// refreshAllKeys fetches latest keys from Vault for all tenants
func (krm *KeyRotationManager) refreshAllKeys() {
	krm.mu.Lock()
	tenantsToRefresh := make([]string, 0, len(krm.tenantKeys))
	for tenantID := range krm.tenantKeys {
		tenantsToRefresh = append(tenantsToRefresh, tenantID)
	}
	krm.mu.Unlock()

	for _, tenantID := range tenantsToRefresh {
		krm.refreshTenantKeys(tenantID)
	}

	// Check for expired grace periods and promote pending keys
	krm.promoteExpiredRotations()
}

// refreshTenantKeys fetches latest keys for a tenant from Vault
func (krm *KeyRotationManager) refreshTenantKeys(tenantID string) {
	krm.mu.RLock()
	providers := make([]string, 0)
	if tenantProviders, exists := krm.tenantKeys[tenantID]; exists {
		for providerID := range tenantProviders {
			providers = append(providers, providerID)
		}
	}
	krm.mu.RUnlock()

	// Fetch keys from Vault (with timeout)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, providerID := range providers {
		key, err := krm.vaultClient.GetProviderKey(ctx, tenantID, providerID)
		if err != nil {
			log.Printf("[KeyRotation] Failed to refresh key for tenant %s provider %s: %v",
				tenantID, providerID, err)
			continue
		}

		// Update active key if changed
		krm.mu.Lock()
		if keys, exists := krm.tenantKeys[tenantID][providerID]; exists {
			if keys.ActiveKey == nil || keys.ActiveKey.KeyID != key.KeyID {
				keys.ActiveKey = key
				log.Printf("[KeyRotation] Updated key for tenant %s provider %s", tenantID, providerID)
			}
		}
		krm.mu.Unlock()
	}
}

// promoteExpiredRotations promotes pending keys to active after grace period
func (krm *KeyRotationManager) promoteExpiredRotations() {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	now := time.Now()
	for tenantID, tenantProviders := range krm.tenantKeys {
		for providerID, keys := range tenantProviders {
			if keys.PendingKey != nil && keys.GracePeriodEnds != nil {
				if now.After(*keys.GracePeriodEnds) {
					// Grace period expired, promote pending to active
					keys.ActiveKey = keys.PendingKey
					keys.PendingKey = nil
					keys.RotationStartedAt = nil
					keys.GracePeriodEnds = nil

					log.Printf("[KeyRotation] Auto-promoted pending key for tenant %s provider %s",
						tenantID, providerID)
				}
			}
		}
	}
}

// Stop gracefully stops the background refresh
func (krm *KeyRotationManager) Stop() {
	close(krm.stopChan)
	krm.wg.Wait()
	log.Println("[KeyRotation] Manager stopped")
}

// GetRotationStatus returns rotation status for a tenant's provider
func (krm *KeyRotationManager) GetRotationStatus(tenantID, providerID string) (*RotationStatus, error) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	tenantProviders, exists := krm.tenantKeys[tenantID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant %s", tenantID)
	}

	keys, exists := tenantProviders[providerID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant %s provider %s", tenantID, providerID)
	}

	status := &RotationStatus{
		TenantID:         tenantID,
		ProviderID:       providerID,
		HasActiveKey:     keys.ActiveKey != nil,
		HasPendingKey:    keys.PendingKey != nil,
		RotationInProgress: keys.PendingKey != nil,
	}

	if keys.RotationStartedAt != nil {
		status.RotationStartedAt = keys.RotationStartedAt
	}
	if keys.GracePeriodEnds != nil {
		status.GracePeriodEnds = keys.GracePeriodEnds
		remaining := time.Until(*keys.GracePeriodEnds)
		if remaining > 0 {
			status.GracePeriodRemaining = &remaining
		}
	}

	return status, nil
}

// RotationStatus holds status information about an ongoing rotation
type RotationStatus struct {
	TenantID             string
	ProviderID           string
	HasActiveKey         bool
	HasPendingKey        bool
	RotationInProgress   bool
	RotationStartedAt    *time.Time
	GracePeriodEnds      *time.Time
	GracePeriodRemaining *time.Duration
}
