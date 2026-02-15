// Package scheduler provides background job scheduling for Igris Inertial
package scheduler

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/repository"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/Igris-inertial/system/igris-overture/services"
)

// ProviderHealthMonitor monitors provider health and automatically disables unhealthy providers
type ProviderHealthMonitor struct {
	service          *services.ProviderRegistryService
	repo             repository.ProviderRegistryRepository
	interval         time.Duration
	maxConsecutiveFail int
	ctx              context.Context
	cancel           context.CancelFunc
	wg               sync.WaitGroup
	logger           *log.Logger
	running          bool
	mu               sync.RWMutex
}

// ProviderHealthMonitorConfig holds configuration for provider health monitoring
type ProviderHealthMonitorConfig struct {
	Interval                time.Duration // How often to check provider health
	MaxConsecutiveFailures  int           // Number of consecutive failures before disabling
}

// DefaultProviderHealthMonitorConfig returns default configuration
func DefaultProviderHealthMonitorConfig() *ProviderHealthMonitorConfig {
	return &ProviderHealthMonitorConfig{
		Interval:               10 * time.Minute, // Check every 10 minutes
		MaxConsecutiveFailures: 3,                // Disable after 3 consecutive failures
	}
}

// NewProviderHealthMonitor creates a new provider health monitor
func NewProviderHealthMonitor(db *sql.DB, keyVault *security.KeyVault, config *ProviderHealthMonitorConfig) *ProviderHealthMonitor {
	if config == nil {
		config = DefaultProviderHealthMonitorConfig()
	}

	repo := repository.NewProviderRegistryRepository(db)
	service := services.NewProviderRegistryService(repo, keyVault)

	ctx, cancel := context.WithCancel(context.Background())

	return &ProviderHealthMonitor{
		service:            service,
		repo:               repo,
		interval:           config.Interval,
		maxConsecutiveFail: config.MaxConsecutiveFailures,
		ctx:                ctx,
		cancel:             cancel,
		logger:             log.Default(),
		running:            false,
	}
}

// Start starts the health monitoring background job
func (m *ProviderHealthMonitor) Start() {
	m.mu.Lock()
	if m.running {
		m.mu.Unlock()
		m.logger.Println("[ProviderHealthMonitor] Already running")
		return
	}
	m.running = true
	m.mu.Unlock()

	m.logger.Printf("[ProviderHealthMonitor] Starting health monitor (interval: %v, max failures: %d)",
		m.interval, m.maxConsecutiveFail)

	m.wg.Add(1)
	go m.monitorLoop()
}

// Stop stops the health monitoring background job
func (m *ProviderHealthMonitor) Stop() {
	m.mu.Lock()
	if !m.running {
		m.mu.Unlock()
		m.logger.Println("[ProviderHealthMonitor] Not running")
		return
	}
	m.mu.Unlock()

	m.logger.Println("[ProviderHealthMonitor] Stopping health monitor...")
	m.cancel()
	m.wg.Wait()

	m.mu.Lock()
	m.running = false
	m.mu.Unlock()

	m.logger.Println("[ProviderHealthMonitor] Health monitor stopped")
}

// IsRunning returns whether the monitor is currently running
func (m *ProviderHealthMonitor) IsRunning() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.running
}

// monitorLoop is the main monitoring loop
func (m *ProviderHealthMonitor) monitorLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Run initial check immediately
	m.checkAllProviders()

	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.checkAllProviders()
		}
	}
}

// checkAllProviders checks health of all active providers
func (m *ProviderHealthMonitor) checkAllProviders() {
	m.logger.Println("[ProviderHealthMonitor] Starting health check cycle...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Get all active providers
	providers, err := m.repo.ListAll(ctx, 1000, 0) // Get up to 1000 providers
	if err != nil {
		m.logger.Printf("[ProviderHealthMonitor] Failed to list providers: %v", err)
		return
	}

	m.logger.Printf("[ProviderHealthMonitor] Found %d providers to check", len(providers))

	// Check each provider
	checkedCount := 0
	disabledCount := 0

	for _, provider := range providers {
		// Skip already disabled or invalid providers
		if provider.Status == "disabled" || provider.Status == "invalid" {
			continue
		}

		// Skip system/verified providers in pending state (they haven't been configured yet)
		if provider.IsVerified && provider.Status == "pending" {
			continue
		}

		// Check provider health
		result := m.checkProviderHealth(ctx, provider.ID)
		checkedCount++

		// Handle consecutive failures
		if !result && provider.Health.ConsecutiveFailures >= m.maxConsecutiveFail {
			m.logger.Printf("[ProviderHealthMonitor] Disabling provider '%s' after %d consecutive failures",
				provider.Name, provider.Health.ConsecutiveFailures)

			// Update status to disabled
			if err := m.repo.UpdateStatus(ctx, provider.ID, "disabled"); err != nil {
				m.logger.Printf("[ProviderHealthMonitor] Failed to disable provider %s: %v", provider.ID, err)
			} else {
				disabledCount++
			}
		}
	}

	m.logger.Printf("[ProviderHealthMonitor] Health check cycle complete: checked %d providers, disabled %d providers",
		checkedCount, disabledCount)
}

// checkProviderHealth checks a single provider's health
func (m *ProviderHealthMonitor) checkProviderHealth(ctx context.Context, providerID string) bool {
	validationLog, err := m.service.ValidateProvider(ctx, providerID)
	if err != nil {
		m.logger.Printf("[ProviderHealthMonitor] Validation failed for provider %s: %v", providerID, err)
		return false
	}

	return validationLog.Success
}

// TriggerHealthCheck manually triggers a health check (useful for testing)
func (m *ProviderHealthMonitor) TriggerHealthCheck() {
	m.logger.Println("[ProviderHealthMonitor] Manual health check triggered")
	go m.checkAllProviders()
}

// ReenableProvider attempts to re-enable a disabled provider
func (m *ProviderHealthMonitor) ReenableProvider(ctx context.Context, providerID string) error {
	provider, err := m.repo.GetByID(ctx, providerID)
	if err != nil {
		return err
	}

	if provider.Status != "disabled" {
		return nil // Already enabled
	}

	// Validate provider
	validationLog, err := m.service.ValidateProvider(ctx, providerID)
	if err != nil {
		return err
	}

	if validationLog.Success {
		// Reset health metrics and re-enable
		provider.Health.ConsecutiveFailures = 0
		if err := m.repo.UpdateHealth(ctx, providerID, provider.Health); err != nil {
			return err
		}

		if err := m.repo.UpdateStatus(ctx, providerID, "active"); err != nil {
			return err
		}

		m.logger.Printf("[ProviderHealthMonitor] Re-enabled provider '%s'", provider.Name)
	}

	return nil
}

// AutoRetryDisabled automatically retries disabled providers every 24 hours
type AutoRetryDisabled struct {
	monitor  *ProviderHealthMonitor
	interval time.Duration
	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	logger   *log.Logger
	running  bool
	mu       sync.RWMutex
}

// NewAutoRetryDisabled creates a new auto-retry job for disabled providers
func NewAutoRetryDisabled(monitor *ProviderHealthMonitor) *AutoRetryDisabled {
	ctx, cancel := context.WithCancel(context.Background())

	return &AutoRetryDisabled{
		monitor:  monitor,
		interval: 24 * time.Hour, // Retry every 24 hours
		ctx:      ctx,
		cancel:   cancel,
		logger:   log.Default(),
		running:  false,
	}
}

// Start starts the auto-retry background job
func (a *AutoRetryDisabled) Start() {
	a.mu.Lock()
	if a.running {
		a.mu.Unlock()
		return
	}
	a.running = true
	a.mu.Unlock()

	a.logger.Printf("[AutoRetryDisabled] Starting auto-retry job (interval: %v)", a.interval)

	a.wg.Add(1)
	go a.retryLoop()
}

// Stop stops the auto-retry background job
func (a *AutoRetryDisabled) Stop() {
	a.mu.Lock()
	if !a.running {
		a.mu.Unlock()
		return
	}
	a.mu.Unlock()

	a.logger.Println("[AutoRetryDisabled] Stopping auto-retry job...")
	a.cancel()
	a.wg.Wait()

	a.mu.Lock()
	a.running = false
	a.mu.Unlock()

	a.logger.Println("[AutoRetryDisabled] Auto-retry job stopped")
}

// retryLoop is the main retry loop
func (a *AutoRetryDisabled) retryLoop() {
	defer a.wg.Done()

	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			a.retryDisabledProviders()
		}
	}
}

// retryDisabledProviders attempts to re-enable all disabled providers
func (a *AutoRetryDisabled) retryDisabledProviders() {
	a.logger.Println("[AutoRetryDisabled] Starting retry cycle for disabled providers...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Get all providers
	providers, err := a.monitor.repo.ListAll(ctx, 1000, 0)
	if err != nil {
		a.logger.Printf("[AutoRetryDisabled] Failed to list providers: %v", err)
		return
	}

	retriedCount := 0
	reenabledCount := 0

	for _, provider := range providers {
		if provider.Status != "disabled" {
			continue
		}

		a.logger.Printf("[AutoRetryDisabled] Retrying disabled provider '%s'...", provider.Name)
		retriedCount++

		if err := a.monitor.ReenableProvider(ctx, provider.ID); err == nil {
			reenabledCount++
		}
	}

	a.logger.Printf("[AutoRetryDisabled] Retry cycle complete: tried %d providers, re-enabled %d providers",
		retriedCount, reenabledCount)
}
