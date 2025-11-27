package escapevector

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// EscapeVectorMode manages the complete resilience system
type EscapeVectorMode struct {
	detector       *ControlPlaneDetector
	thompsonRouter *ThompsonRouter
	cache          *InertialCache
	goldCodeMode   bool
	mu             sync.RWMutex

	// Metrics
	totalEscapeRequests   int64
	totalNormalRequests   int64
	lastModeSwitch        time.Time
}

// NewEscapeVectorMode creates a new EscapeVector Mode manager
func NewEscapeVectorMode() (*EscapeVectorMode, error) {
	// Check for Gold Code Override
	goldCodeMode := os.Getenv("BYOK_BYPASS_CONTROL_PLANE") == "true"

	// Determine cache directory
	cacheDir := os.Getenv("SCHLEP_CACHE_DIR")
	if cacheDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home directory: %w", err)
		}
		cacheDir = filepath.Join(homeDir, ".config", "schlep")
	}

	// Generate encryption key from API key or use default
	apiKey := os.Getenv("SCHLEP_API_KEY")
	encryptionKey := deriveEncryptionKey(apiKey)

	// Initialize cache
	cache, err := NewInertialCache(cacheDir, encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache: %w", err)
	}

	// Load or create Bayesian state
	var state *BayesianState
	if cache.Exists() {
		loadedState, err := cache.Load()
		if err != nil {
			// Cache expired or tampered - use default
			state = DefaultBayesianState()
		} else {
			state = loadedState
		}
	} else {
		state = DefaultBayesianState()
	}

	evm := &EscapeVectorMode{
		detector:       NewControlPlaneDetector(),
		thompsonRouter: NewThompsonRouter(state),
		cache:          cache,
		goldCodeMode:   goldCodeMode,
		lastModeSwitch: time.Now(),
	}

	// Save initial state
	if err := cache.Save(state); err != nil {
		// Non-fatal - continue with in-memory state
	}

	return evm, nil
}

// ShouldUseEscapeVector returns true if fallback should be used
func (evm *EscapeVectorMode) ShouldUseEscapeVector() bool {
	if evm.goldCodeMode {
		return true
	}
	return evm.detector.IsInEscapeMode()
}

// RecordControlPlaneRequest records control plane request result
func (evm *EscapeVectorMode) RecordControlPlaneRequest(latency time.Duration, err error) {
	evm.mu.Lock()
	evm.totalNormalRequests++
	evm.mu.Unlock()

	if err != nil || latency >= TimeoutThreshold {
		triggered := evm.detector.RecordFailure(latency)
		if triggered {
			evm.mu.Lock()
			evm.lastModeSwitch = time.Now()
			evm.mu.Unlock()
		}
	} else {
		evm.detector.RecordSuccess(latency)
	}
}

// Infer performs inference using Thompson Sampling fallback
func (evm *EscapeVectorMode) Infer(ctx context.Context, req *InferRequest) (*InferResponse, error) {
	evm.mu.Lock()
	evm.totalEscapeRequests++
	evm.mu.Unlock()

	return evm.thompsonRouter.Infer(ctx, req)
}

// SyncStateFromControlPlane updates Bayesian state from control plane
func (evm *EscapeVectorMode) SyncStateFromControlPlane(state *BayesianState) error {
	evm.mu.Lock()
	defer evm.mu.Unlock()

	// Update Thompson router
	evm.thompsonRouter.UpdateState(state)

	// Persist to cache
	if err := evm.cache.Save(state); err != nil {
		return fmt.Errorf("failed to save state to cache: %w", err)
	}

	return nil
}

// GetMetrics returns EscapeVector metrics
func (evm *EscapeVectorMode) GetMetrics() map[string]interface{} {
	evm.mu.RLock()
	defer evm.mu.RUnlock()

	return map[string]interface{}{
		"gold_code_mode":         evm.goldCodeMode,
		"is_in_escape_mode":      evm.detector.IsInEscapeMode(),
		"consecutive_timeouts":   evm.detector.GetConsecutiveTimeouts(),
		"total_escape_requests":  evm.totalEscapeRequests,
		"total_normal_requests":  evm.totalNormalRequests,
		"last_mode_switch":       evm.lastModeSwitch,
		"last_control_plane_success": evm.detector.GetLastSuccessTime(),
	}
}

// deriveEncryptionKey derives a 32-byte key from API key using SHA-256
func deriveEncryptionKey(apiKey string) []byte {
	if apiKey == "" {
		// Default key for development (CHANGE IN PRODUCTION)
		apiKey = "schlep-default-encryption-key-change-me"
	}
	hash := sha256.Sum256([]byte(apiKey))
	return hash[:]
}
