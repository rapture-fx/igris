package escapevector

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// InertialCache manages 72-hour persistent Bayesian state cache
type InertialCache struct {
	cachePath string
	signer    *BayesianSigner
	mu        sync.RWMutex
}

// NewInertialCache creates a new inertial cache
func NewInertialCache(cacheDir string, encryptionKey []byte) (*InertialCache, error) {
	// Ensure cache directory exists
	if err := os.MkdirAll(cacheDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	signer, err := NewBayesianSigner(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create signer: %w", err)
	}

	return &InertialCache{
		cachePath: filepath.Join(cacheDir, "bayesian_state.enc"),
		signer:    signer,
	}, nil
}

// Save encrypts and saves Bayesian state to disk
func (ic *InertialCache) Save(state *BayesianState) error {
	ic.mu.Lock()
	defer ic.mu.Unlock()

	// Encrypt state
	encrypted, err := ic.signer.EncryptState(state)
	if err != nil {
		return fmt.Errorf("failed to encrypt state: %w", err)
	}

	// Serialize encrypted state
	data, err := json.Marshal(encrypted)
	if err != nil {
		return fmt.Errorf("failed to marshal encrypted state: %w", err)
	}

	// Write to disk atomically
	tempPath := ic.cachePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	if err := os.Rename(tempPath, ic.cachePath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	return nil
}

// Load decrypts and loads Bayesian state from disk
func (ic *InertialCache) Load() (*BayesianState, error) {
	ic.mu.RLock()
	defer ic.mu.RUnlock()

	// Read encrypted state
	data, err := os.ReadFile(ic.cachePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("no cached state found")
		}
		return nil, fmt.Errorf("failed to read cache file: %w", err)
	}

	// Deserialize
	var encrypted EncryptedBayesianState
	if err := json.Unmarshal(data, &encrypted); err != nil {
		return nil, fmt.Errorf("failed to unmarshal encrypted state: %w", err)
	}

	// Decrypt and verify
	state, err := ic.signer.DecryptState(&encrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt state (may be expired or tampered): %w", err)
	}

	return state, nil
}

// Exists checks if cache file exists
func (ic *InertialCache) Exists() bool {
	ic.mu.RLock()
	defer ic.mu.RUnlock()

	_, err := os.Stat(ic.cachePath)
	return err == nil
}

// Clear removes the cache file
func (ic *InertialCache) Clear() error {
	ic.mu.Lock()
	defer ic.mu.Unlock()

	if err := os.Remove(ic.cachePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to clear cache: %w", err)
	}
	return nil
}
