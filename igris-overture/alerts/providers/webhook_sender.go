package providers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Igris-inertial/system/igris-overture/alerts"
)

// WebhookProvider sends alerts to generic webhook endpoints
type WebhookProvider struct {
	httpClient *http.Client
	config     *WebhookConfig
}

// WebhookConfig holds webhook provider configuration
type WebhookConfig struct {
	// Webhook endpoint URL (can be overridden per alert via Recipients)
	DefaultURL string

	// Request timeout
	Timeout time.Duration

	// Authentication
	SigningSecret string // For HMAC signature verification
	APIKey        string // For API key authentication
	BearerToken   string // For Bearer token authentication

	// Custom headers
	Headers map[string]string

	// Retry configuration
	MaxRetries int
	RetryDelay time.Duration
}

// NewWebhookProvider creates a new webhook alert provider
func NewWebhookProvider(config *WebhookConfig) (*WebhookProvider, error) {
	if config == nil {
		return nil, fmt.Errorf("config cannot be nil")
	}

	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}

	if config.RetryDelay == 0 {
		config.RetryDelay = 2 * time.Second
	}

	return &WebhookProvider{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}, nil
}

// Send sends an alert to a webhook endpoint
func (p *WebhookProvider) Send(ctx context.Context, alert *alerts.Alert) error {
	// Determine webhook URL
	webhookURL := p.config.DefaultURL
	if len(alert.Recipients) > 0 {
		webhookURL = alert.Recipients[0] // Use first recipient as webhook URL
	}

	if webhookURL == "" {
		return fmt.Errorf("no webhook URL specified")
	}

	// Build webhook payload
	payload := p.buildPayload(alert)

	// Serialize to JSON
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Send with retries
	var lastErr error
	for attempt := 0; attempt <= p.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry
			select {
			case <-time.After(p.config.RetryDelay):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		err := p.sendRequest(ctx, webhookURL, data)
		if err == nil {
			return nil // Success
		}

		lastErr = err
	}

	return fmt.Errorf("webhook delivery failed after %d attempts: %w", p.config.MaxRetries+1, lastErr)
}

// GetName returns the provider name
func (p *WebhookProvider) GetName() string {
	return "webhook"
}

// ValidateConfig validates the webhook configuration
func (p *WebhookProvider) ValidateConfig() error {
	// Webhook URL can be empty if specified per-alert
	return nil
}

// sendRequest sends a single webhook request
func (p *WebhookProvider) sendRequest(ctx context.Context, url string, data []byte) error {
	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Igris Inertial-Alerts/1.0")

	// Add custom headers
	for key, value := range p.config.Headers {
		req.Header.Set(key, value)
	}

	// Add authentication
	if p.config.BearerToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.config.BearerToken))
	} else if p.config.APIKey != "" {
		req.Header.Set("X-API-Key", p.config.APIKey)
	}

	// Add HMAC signature if signing secret is configured
	if p.config.SigningSecret != "" {
		timestamp := time.Now().Unix()
		signature := p.generateSignature(data, timestamp)

		req.Header.Set("X-Igris-Signature", signature)
		req.Header.Set("X-Igris-Timestamp", fmt.Sprintf("%d", timestamp))
	}

	// Send request
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook endpoint returned status %d", resp.StatusCode)
	}

	return nil
}

// buildPayload constructs the webhook payload
func (p *WebhookProvider) buildPayload(alert *alerts.Alert) *WebhookPayload {
	return &WebhookPayload{
		Version:   "1.0",
		ID:        alert.ID,
		Timestamp: alert.Timestamp.Unix(),
		Type:      string(alert.Type),
		Severity:  string(alert.Severity),
		Tenant: TenantInfo{
			ID: alert.TenantID,
		},
		Alert: AlertInfo{
			Title:      alert.Title,
			Message:    alert.Message,
			Details:    alert.Details,
			TraceID:    alert.TraceID,
			RunbookURL: alert.RunbookURL,
		},
	}
}

// generateSignature creates an HMAC signature for payload verification
func (p *WebhookProvider) generateSignature(payload []byte, timestamp int64) string {
	message := fmt.Sprintf("%d.%s", timestamp, string(payload))

	h := hmac.New(sha256.New, []byte(p.config.SigningSecret))
	h.Write([]byte(message))

	return hex.EncodeToString(h.Sum(nil))
}

// VerifySignature verifies an HMAC signature (for webhook receivers)
func (p *WebhookProvider) VerifySignature(payload []byte, timestamp int64, receivedSignature string) bool {
	expectedSignature := p.generateSignature(payload, timestamp)
	return hmac.Equal([]byte(expectedSignature), []byte(receivedSignature))
}

// WebhookPayload represents the webhook JSON payload
type WebhookPayload struct {
	Version   string                 `json:"version"`
	ID        string                 `json:"id"`
	Timestamp int64                  `json:"timestamp"`
	Type      string                 `json:"type"`
	Severity  string                 `json:"severity"`
	Tenant    TenantInfo             `json:"tenant"`
	Alert     AlertInfo              `json:"alert"`
}

// TenantInfo holds tenant information in webhook payload
type TenantInfo struct {
	ID string `json:"id"`
}

// AlertInfo holds alert details in webhook payload
type AlertInfo struct {
	Title      string                 `json:"title"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	TraceID    string                 `json:"trace_id,omitempty"`
	RunbookURL string                 `json:"runbook_url,omitempty"`
}

// WebhookDeliveryResult represents the result of a webhook delivery attempt
type WebhookDeliveryResult struct {
	URL        string
	StatusCode int
	Success    bool
	Error      error
	Duration   time.Duration
	Attempts   int
}
