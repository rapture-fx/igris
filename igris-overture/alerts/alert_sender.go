package alerts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityError    AlertSeverity = "error"
	SeverityCritical AlertSeverity = "critical"
)

// AlertType categorizes the type of alert
type AlertType string

const (
	AlertTypeBudget      AlertType = "budget"
	AlertTypeSLA         AlertType = "sla"
	AlertTypeProvider    AlertType = "provider"
	AlertTypePerformance AlertType = "performance"
	AlertTypeSystem      AlertType = "system"
	AlertTypeSecurity    AlertType = "security"
	AlertTypeUsage       AlertType = "usage" // Usage notifications (80%, 100%, 120%)
)

// Alert represents an alert to be sent
type Alert struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Type        AlertType              `json:"type"`
	Severity    AlertSeverity          `json:"severity"`
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details"`
	Timestamp   time.Time              `json:"timestamp"`
	TraceID     string                 `json:"trace_id,omitempty"`
	RunbookURL  string                 `json:"runbook_url,omitempty"`

	// Delivery settings
	Channels    []string `json:"channels"`     // email, webhook
	Recipients  []string `json:"recipients"`   // emails, webhook URLs
	Priority    int      `json:"priority"`     // 0-10, higher = more urgent
	DedupeKey   string   `json:"dedupe_key"`   // For deduplication

	// Retry metadata
	Attempts    int       `json:"attempts"`
	MaxAttempts int       `json:"max_attempts"`
	NextRetry   time.Time `json:"next_retry,omitempty"`
}

// AlertProvider defines the interface for alert delivery providers
type AlertProvider interface {
	// Send sends an alert through this provider
	Send(ctx context.Context, alert *Alert) error

	// GetName returns the provider name
	GetName() string

	// ValidateConfig validates provider configuration
	ValidateConfig() error
}

// AlertQueue manages async alert delivery with retries
type AlertQueue struct {
	redisClient *redis.Client
	providers   map[string]AlertProvider
	queueName   string
	dlqName     string
	workers     int
	stopChan    chan struct{}
	wg          sync.WaitGroup
	mu          sync.RWMutex

	// Deduplication
	dedupeWindow time.Duration
	dedupeCache  map[string]time.Time
	dedupeMu     sync.RWMutex

	// Metrics
	stats *AlertStats
}

// AlertQueueConfig holds queue configuration
type AlertQueueConfig struct {
	RedisClient  *redis.Client
	QueueName    string
	DLQName      string
	Workers      int
	DedupeWindow time.Duration
}

// NewAlertQueue creates a new alert queue
func NewAlertQueue(config *AlertQueueConfig) (*AlertQueue, error) {
	if config.RedisClient == nil {
		return nil, errors.New("redis client is required")
	}

	if config.QueueName == "" {
		config.QueueName = "igris:alerts:queue"
	}
	if config.DLQName == "" {
		config.DLQName = "igris:alerts:dlq"
	}
	if config.Workers == 0 {
		config.Workers = 5
	}
	if config.DedupeWindow == 0 {
		config.DedupeWindow = 5 * time.Minute
	}

	return &AlertQueue{
		redisClient:  config.RedisClient,
		providers:    make(map[string]AlertProvider),
		queueName:    config.QueueName,
		dlqName:      config.DLQName,
		workers:      config.Workers,
		stopChan:     make(chan struct{}),
		dedupeWindow: config.DedupeWindow,
		dedupeCache:  make(map[string]time.Time),
		stats:        NewAlertStats(),
	}, nil
}

// RegisterProvider registers an alert provider
func (q *AlertQueue) RegisterProvider(provider AlertProvider) error {
	if err := provider.ValidateConfig(); err != nil {
		return fmt.Errorf("invalid provider config: %w", err)
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	q.providers[provider.GetName()] = provider
	return nil
}

// Enqueue adds an alert to the delivery queue
func (q *AlertQueue) Enqueue(ctx context.Context, alert *Alert) error {
	// Set defaults
	if alert.ID == "" {
		alert.ID = generateAlertID()
	}
	if alert.Timestamp.IsZero() {
		alert.Timestamp = time.Now()
	}
	if alert.MaxAttempts == 0 {
		alert.MaxAttempts = 3
	}

	// Check for deduplication
	if alert.DedupeKey != "" {
		if q.isDuplicate(alert.DedupeKey) {
			q.stats.RecordDeduplicated()
			return nil // Silent dedupe
		}
		q.markSent(alert.DedupeKey)
	}

	// Redact sensitive information
	alert = q.redactSensitive(alert)

	// Serialize alert
	data, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("failed to marshal alert: %w", err)
	}

	// Add to Redis stream
	err = q.redisClient.LPush(ctx, q.queueName, data).Err()
	if err != nil {
		return fmt.Errorf("failed to enqueue alert: %w", err)
	}

	q.stats.RecordEnqueued()
	return nil
}

// Start starts the alert worker pool
func (q *AlertQueue) Start(ctx context.Context) {
	for i := 0; i < q.workers; i++ {
		q.wg.Add(1)
		go q.worker(ctx, i)
	}

	// Start deduplication cleanup
	q.wg.Add(1)
	go q.cleanupDedupeCache()
}

// Stop gracefully stops the alert queue
func (q *AlertQueue) Stop() {
	close(q.stopChan)
	q.wg.Wait()
}

// worker processes alerts from the queue
func (q *AlertQueue) worker(ctx context.Context, id int) {
	defer q.wg.Done()

	for {
		select {
		case <-q.stopChan:
			return
		default:
			// Block and wait for alert (BRPOP with timeout)
			result, err := q.redisClient.BRPop(ctx, 1*time.Second, q.queueName).Result()
			if err != nil {
				if err == redis.Nil {
					continue // Timeout, try again
				}
				continue
			}

			if len(result) < 2 {
				continue
			}

			// Deserialize alert
			var alert Alert
			if err := json.Unmarshal([]byte(result[1]), &alert); err != nil {
				continue
			}

			// Process alert
			q.processAlert(ctx, &alert)
		}
	}
}

// processAlert sends an alert through all configured channels
func (q *AlertQueue) processAlert(ctx context.Context, alert *Alert) {
	alert.Attempts++

	var deliveryErrors []error
	deliveredCount := 0

	// Send through each channel
	for _, channel := range alert.Channels {
		provider, err := q.getProvider(channel)
		if err != nil {
			deliveryErrors = append(deliveryErrors, fmt.Errorf("%s: %w", channel, err))
			continue
		}

		// Send with timeout
		sendCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		err = provider.Send(sendCtx, alert)
		cancel()

		if err != nil {
			deliveryErrors = append(deliveryErrors, fmt.Errorf("%s: %w", channel, err))
		} else {
			deliveredCount++
		}
	}

	// Handle delivery results
	if deliveredCount > 0 {
		q.stats.RecordDelivered()
	}

	if len(deliveryErrors) > 0 {
		// Retry or send to DLQ
		if alert.Attempts < alert.MaxAttempts {
			q.retryAlert(ctx, alert, deliveryErrors)
		} else {
			q.sendToDLQ(ctx, alert, deliveryErrors)
		}
	}
}

// retryAlert schedules an alert for retry with exponential backoff
func (q *AlertQueue) retryAlert(ctx context.Context, alert *Alert, errors []error) {
	// Exponential backoff: 1min, 2min, 4min...
	backoff := time.Duration(1<<uint(alert.Attempts-1)) * time.Minute
	alert.NextRetry = time.Now().Add(backoff)

	// Re-enqueue with delay (simplified - use Redis sorted set in production)
	time.AfterFunc(backoff, func() {
		data, _ := json.Marshal(alert)
		q.redisClient.LPush(ctx, q.queueName, data)
	})

	q.stats.RecordRetry()
}

// sendToDLQ sends a failed alert to the dead letter queue
func (q *AlertQueue) sendToDLQ(ctx context.Context, alert *Alert, errors []error) {
	// Add error details to alert
	alert.Details["delivery_errors"] = errors
	alert.Details["failed_at"] = time.Now()

	data, _ := json.Marshal(alert)
	q.redisClient.LPush(ctx, q.dlqName, data)

	q.stats.RecordFailed()
}

// getProvider retrieves a registered provider by name
func (q *AlertQueue) getProvider(name string) (AlertProvider, error) {
	q.mu.RLock()
	defer q.mu.RUnlock()

	provider, ok := q.providers[name]
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", name)
	}

	return provider, nil
}

// isDuplicate checks if an alert has been recently sent
func (q *AlertQueue) isDuplicate(dedupeKey string) bool {
	q.dedupeMu.RLock()
	defer q.dedupeMu.RUnlock()

	lastSent, exists := q.dedupeCache[dedupeKey]
	if !exists {
		return false
	}

	return time.Since(lastSent) < q.dedupeWindow
}

// markSent marks an alert as sent for deduplication
func (q *AlertQueue) markSent(dedupeKey string) {
	q.dedupeMu.Lock()
	defer q.dedupeMu.Unlock()

	q.dedupeCache[dedupeKey] = time.Now()
}

// cleanupDedupeCache periodically removes old deduplication entries
func (q *AlertQueue) cleanupDedupeCache() {
	defer q.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			q.dedupeMu.Lock()
			now := time.Now()
			for key, timestamp := range q.dedupeCache {
				if now.Sub(timestamp) > q.dedupeWindow {
					delete(q.dedupeCache, key)
				}
			}
			q.dedupeMu.Unlock()

		case <-q.stopChan:
			return
		}
	}
}

// redactSensitive removes sensitive information from alerts
func (q *AlertQueue) redactSensitive(alert *Alert) *Alert {
	// Redact common sensitive fields
	sensitiveKeys := []string{
		"api_key", "api_secret", "password", "token",
		"client_secret", "private_key", "credential",
	}

	if alert.Details != nil {
		for _, key := range sensitiveKeys {
			if _, exists := alert.Details[key]; exists {
				alert.Details[key] = "[REDACTED]"
			}
		}
	}

	return alert
}

// GetStats returns queue statistics
func (q *AlertQueue) GetStats() AlertStatsSnapshot {
	return q.stats.Snapshot()
}

// GetQueueLength returns the current queue length
func (q *AlertQueue) GetQueueLength(ctx context.Context) (int64, error) {
	return q.redisClient.LLen(ctx, q.queueName).Result()
}

// GetDLQLength returns the dead letter queue length
func (q *AlertQueue) GetDLQLength(ctx context.Context) (int64, error) {
	return q.redisClient.LLen(ctx, q.dlqName).Result()
}

// generateAlertID generates a unique alert ID
func generateAlertID() string {
	return fmt.Sprintf("alert_%d", time.Now().UnixNano())
}

// AlertStats tracks alert delivery statistics
type AlertStats struct {
	enqueued     int64
	delivered    int64
	failed       int64
	retries      int64
	deduplicated int64
	mu           sync.RWMutex
}

// NewAlertStats creates a new stats tracker
func NewAlertStats() *AlertStats {
	return &AlertStats{}
}

// RecordEnqueued increments enqueued count
func (s *AlertStats) RecordEnqueued() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.enqueued++
}

// RecordDelivered increments delivered count
func (s *AlertStats) RecordDelivered() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.delivered++
}

// RecordFailed increments failed count
func (s *AlertStats) RecordFailed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failed++
}

// RecordRetry increments retry count
func (s *AlertStats) RecordRetry() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.retries++
}

// RecordDeduplicated increments deduplicated count
func (s *AlertStats) RecordDeduplicated() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deduplicated++
}

// Snapshot returns a snapshot of current statistics
func (s *AlertStats) Snapshot() AlertStatsSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return AlertStatsSnapshot{
		Enqueued:     s.enqueued,
		Delivered:    s.delivered,
		Failed:       s.failed,
		Retries:      s.retries,
		Deduplicated: s.deduplicated,
	}
}

// AlertStatsSnapshot represents a point-in-time snapshot of statistics
type AlertStatsSnapshot struct {
	Enqueued     int64
	Delivered    int64
	Failed       int64
	Retries      int64
	Deduplicated int64
}
