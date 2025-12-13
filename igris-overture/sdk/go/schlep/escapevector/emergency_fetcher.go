package escapevector

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/schlep-ai/igris-inertial/igris-overture/emergency"
)

// EmergencyFetcher periodically checks for emergency policy updates
//
// This allows the SDK to receive policy updates even when the main
// control plane is completely dead. The updates are served from a
// static endpoint (e.g., S3 + Cloudflare) with signed policy blobs.
type EmergencyFetcher struct {
	endpoint    string
	client      *http.Client
	currentVersion uint64
	lastCheck   time.Time
	checkInterval time.Duration

	mu       sync.RWMutex
	stopped  bool
	stopChan chan struct{}

	// Callback when new policy is received
	onPolicyUpdate func(*emergency.EmergencyPolicy)
}

// NewEmergencyFetcher creates a new emergency policy fetcher
//
// endpoint: URL of the emergency policy endpoint (e.g., "https://emergency.schlep.ai/v1/emergency/policy")
// checkInterval: How often to poll for updates (e.g., 30 seconds)
// onPolicyUpdate: Callback function when a new policy is received
func NewEmergencyFetcher(
	endpoint string,
	checkInterval time.Duration,
	onPolicyUpdate func(*emergency.EmergencyPolicy),
) *EmergencyFetcher {
	if checkInterval == 0 {
		checkInterval = 30 * time.Second
	}

	return &EmergencyFetcher{
		endpoint:       endpoint,
		client:         &http.Client{Timeout: 10 * time.Second},
		checkInterval:  checkInterval,
		stopChan:       make(chan struct{}),
		onPolicyUpdate: onPolicyUpdate,
	}
}

// Start begins polling for emergency policy updates
func (ef *EmergencyFetcher) Start(ctx context.Context) {
	ef.mu.Lock()
	if ef.stopped {
		ef.mu.Unlock()
		return
	}
	ef.mu.Unlock()

	ticker := time.NewTicker(ef.checkInterval)
	defer ticker.Stop()

	// Immediate check on start
	ef.checkForUpdate(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ef.stopChan:
			return
		case <-ticker.C:
			ef.checkForUpdate(ctx)
		}
	}
}

// Stop stops the emergency fetcher
func (ef *EmergencyFetcher) Stop() {
	ef.mu.Lock()
	defer ef.mu.Unlock()

	if !ef.stopped {
		ef.stopped = true
		close(ef.stopChan)
	}
}

// checkForUpdate checks for a new emergency policy
func (ef *EmergencyFetcher) checkForUpdate(ctx context.Context) {
	ef.mu.RLock()
	currentVersion := ef.currentVersion
	ef.mu.RUnlock()

	// Build URL with 'since' parameter
	url := fmt.Sprintf("%s?since=%d", ef.endpoint, currentVersion)

	// Create request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		// Log error but don't crash
		return
	}

	// Make request
	resp, err := ef.client.Do(req)
	if err != nil {
		// Network error - control plane may be down, which is expected
		return
	}
	defer resp.Body.Close()

	// 204 = no new policy
	if resp.StatusCode == http.StatusNoContent {
		ef.mu.Lock()
		ef.lastCheck = time.Now()
		ef.mu.Unlock()
		return
	}

	// 200 = new policy available
	if resp.StatusCode != http.StatusOK {
		// Unexpected status - ignore
		return
	}

	// Parse policy
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	policy, err := emergency.DeserializePolicy(body)
	if err != nil {
		return
	}

	// Update current version
	ef.mu.Lock()
	ef.currentVersion = policy.Version
	ef.lastCheck = time.Now()
	ef.mu.Unlock()

	// Call callback
	if ef.onPolicyUpdate != nil {
		ef.onPolicyUpdate(policy)
	}
}

// GetMetrics returns metrics about the emergency fetcher
func (ef *EmergencyFetcher) GetMetrics() map[string]interface{} {
	ef.mu.RLock()
	defer ef.mu.RUnlock()

	return map[string]interface{}{
		"current_version": ef.currentVersion,
		"last_check":      ef.lastCheck.Unix(),
		"check_interval":  ef.checkInterval.Seconds(),
		"stopped":         ef.stopped,
	}
}
