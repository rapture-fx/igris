// Package security provides webhook notifications for key vault events
package security

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// WebhookEvent represents a key vault event to be sent via webhook
type WebhookEvent struct {
	EventType    string    `json:"event_type"`    // "key.invalid", "key.expired", "key.rotated", "key.validated"
	EventID      string    `json:"event_id"`      // Unique event ID
	Timestamp    time.Time `json:"timestamp"`
	TenantID     string    `json:"tenant_id"`
	Provider     string    `json:"provider"`
	KeyName      string    `json:"key_name,omitempty"`
	KeyID        string    `json:"key_id,omitempty"`
	Message      string    `json:"message"`
	Severity     string    `json:"severity"`      // "info", "warning", "critical"
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// WebhookConfig configures webhook delivery
type WebhookConfig struct {
	// Webhook URL to send events to
	URL string

	// Timeout for webhook delivery (default: 10s)
	Timeout time.Duration

	// Retry attempts on failure (default: 3)
	RetryAttempts int

	// Retry delay between attempts (default: 5s)
	RetryDelay time.Duration

	// Events to send (empty = all events)
	EnabledEvents []string

	// Custom headers to include
	Headers map[string]string
}

// WebhookNotifier sends webhook notifications for key vault events
type WebhookNotifier struct {
	config WebhookConfig
	client *http.Client
	logger *log.Logger
}

// NewWebhookNotifier creates a new webhook notifier
func NewWebhookNotifier(config WebhookConfig) *WebhookNotifier {
	if config.Timeout == 0 {
		config.Timeout = 10 * time.Second
	}
	if config.RetryAttempts == 0 {
		config.RetryAttempts = 3
	}
	if config.RetryDelay == 0 {
		config.RetryDelay = 5 * time.Second
	}

	return &WebhookNotifier{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
		logger: log.Default(),
	}
}

// SendEvent sends a webhook event
func (wn *WebhookNotifier) SendEvent(event WebhookEvent) error {
	// Check if this event type is enabled
	if len(wn.config.EnabledEvents) > 0 {
		enabled := false
		for _, eventType := range wn.config.EnabledEvents {
			if eventType == event.EventType {
				enabled = true
				break
			}
		}
		if !enabled {
			return nil // Event type not enabled, skip silently
		}
	}

	// Marshal event to JSON
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Attempt delivery with retries
	var lastErr error
	for attempt := 0; attempt <= wn.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(wn.config.RetryDelay)
			wn.logger.Printf("[WebhookNotifier] Retrying webhook delivery (attempt %d/%d)", attempt, wn.config.RetryAttempts)
		}

		req, err := http.NewRequest(http.MethodPost, wn.config.URL, bytes.NewReader(payload))
		if err != nil {
			lastErr = fmt.Errorf("failed to create request: %w", err)
			continue
		}

		// Set headers
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Igris Inertial-KeyVault/1.0")
		req.Header.Set("X-Event-Type", event.EventType)
		req.Header.Set("X-Event-ID", event.EventID)
		req.Header.Set("X-Tenant-ID", event.TenantID)

		// Add custom headers
		for key, value := range wn.config.Headers {
			req.Header.Set(key, value)
		}

		// Send request
		resp, err := wn.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("webhook delivery failed: %w", err)
			continue
		}
		defer resp.Body.Close()

		// Check response status
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			wn.logger.Printf("[WebhookNotifier] Webhook delivered successfully: event=%s tenant=%s provider=%s",
				event.EventType, event.TenantID, event.Provider)
			return nil
		}

		lastErr = fmt.Errorf("webhook returned non-2xx status: %d", resp.StatusCode)
	}

	return fmt.Errorf("webhook delivery failed after %d attempts: %w", wn.config.RetryAttempts+1, lastErr)
}

// SendEventAsync sends a webhook event asynchronously (non-blocking)
func (wn *WebhookNotifier) SendEventAsync(event WebhookEvent) {
	go func() {
		if err := wn.SendEvent(event); err != nil {
			wn.logger.Printf("[WebhookNotifier] Failed to send webhook: %v", err)
		}
	}()
}

// NotifyKeyInvalid sends a notification when a key fails validation
func (wn *WebhookNotifier) NotifyKeyInvalid(tenantID, provider, keyID, validationError string) {
	event := WebhookEvent{
		EventType: "key.invalid",
		EventID:   generateEventID(),
		Timestamp: time.Now(),
		TenantID:  tenantID,
		Provider:  provider,
		KeyID:     keyID,
		Message:   fmt.Sprintf("API key validation failed for %s/%s", tenantID, provider),
		Severity:  "critical",
		Metadata: map[string]interface{}{
			"validation_error": validationError,
		},
	}

	wn.SendEventAsync(event)
}

// NotifyKeyExpired sends a notification when a key is expired
func (wn *WebhookNotifier) NotifyKeyExpired(tenantID, provider, keyName, keyID string) {
	event := WebhookEvent{
		EventType: "key.expired",
		EventID:   generateEventID(),
		Timestamp: time.Now(),
		TenantID:  tenantID,
		Provider:  provider,
		KeyName:   keyName,
		KeyID:     keyID,
		Message:   fmt.Sprintf("API key expired for %s/%s/%s", tenantID, provider, keyName),
		Severity:  "warning",
	}

	wn.SendEventAsync(event)
}

// NotifyKeyRotated sends a notification when a key is rotated
func (wn *WebhookNotifier) NotifyKeyRotated(tenantID, provider, keyName, oldKeyID, newKeyID string, newVersion int) {
	event := WebhookEvent{
		EventType: "key.rotated",
		EventID:   generateEventID(),
		Timestamp: time.Now(),
		TenantID:  tenantID,
		Provider:  provider,
		KeyName:   keyName,
		KeyID:     newKeyID,
		Message:   fmt.Sprintf("API key rotated for %s/%s/%s (version %d)", tenantID, provider, keyName, newVersion),
		Severity:  "info",
		Metadata: map[string]interface{}{
			"old_key_id":  oldKeyID,
			"new_key_id":  newKeyID,
			"new_version": newVersion,
		},
	}

	wn.SendEventAsync(event)
}

// NotifyKeyValidated sends a notification when a key passes validation
func (wn *WebhookNotifier) NotifyKeyValidated(tenantID, provider, keyID string) {
	event := WebhookEvent{
		EventType: "key.validated",
		EventID:   generateEventID(),
		Timestamp: time.Now(),
		TenantID:  tenantID,
		Provider:  provider,
		KeyID:     keyID,
		Message:   fmt.Sprintf("API key validated successfully for %s/%s", tenantID, provider),
		Severity:  "info",
	}

	wn.SendEventAsync(event)
}

// generateEventID generates a unique event ID
func generateEventID() string {
	return fmt.Sprintf("evt_%d", time.Now().UnixNano())
}

// ============================================================================
// Integration with KeyVault
// ============================================================================

// EnableWebhooks adds webhook support to the KeyVault
func (kv *KeyVault) EnableWebhooks(notifier *WebhookNotifier) {
	// This would be called after creating KeyVault
	// The KeyVault would then call notifier methods on key events
	//
	// Example integration points:
	// - In ValidateKey(): call notifier.NotifyKeyInvalid() if validation fails
	// - In ExpireKey(): call notifier.NotifyKeyExpired()
	// - In RotateKey(): call notifier.NotifyKeyRotated()
	//
	// For now, this is a placeholder. Real integration would add a
	// *WebhookNotifier field to KeyVault struct.
}
