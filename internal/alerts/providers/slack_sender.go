package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/schlep-engine/internal/alerts"
)

// SlackProvider sends alerts to Slack via webhook
type SlackProvider struct {
	webhookURL string
	httpClient *http.Client
	config     *SlackConfig
}

// SlackConfig holds Slack provider configuration
type SlackConfig struct {
	WebhookURL  string
	Username    string
	IconEmoji   string
	DefaultChannel string
	Timeout     time.Duration
}

// NewSlackProvider creates a new Slack alert provider
func NewSlackProvider(config *SlackConfig) (*SlackProvider, error) {
	if config == nil {
		return nil, fmt.Errorf("config cannot be nil")
	}

	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	return &SlackProvider{
		webhookURL: config.WebhookURL,
		config:     config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}, nil
}

// Send sends an alert to Slack
func (p *SlackProvider) Send(ctx context.Context, alert *alerts.Alert) error {
	// Build Slack message
	message := p.buildSlackMessage(alert)

	// Serialize to JSON
	payload, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack message: %w", err)
	}

	// Send POST request to webhook
	req, err := http.NewRequestWithContext(ctx, "POST", p.webhookURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send Slack message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack API error: status %d", resp.StatusCode)
	}

	return nil
}

// GetName returns the provider name
func (p *SlackProvider) GetName() string {
	return "slack"
}

// ValidateConfig validates the Slack configuration
func (p *SlackProvider) ValidateConfig() error {
	if p.webhookURL == "" {
		return fmt.Errorf("webhook URL is required")
	}
	return nil
}

// buildSlackMessage constructs a Slack message from an alert
func (p *SlackProvider) buildSlackMessage(alert *alerts.Alert) *SlackMessage {
	// Map severity to color
	color := p.severityToColor(alert.Severity)

	// Build attachment
	attachment := SlackAttachment{
		Color:      color,
		Title:      alert.Title,
		Text:       alert.Message,
		Timestamp:  alert.Timestamp.Unix(),
		Footer:     "Schlep-Engine Alerts",
		FooterIcon: "https://schlep-engine.com/icon.png",
		Fields:     p.buildFields(alert),
	}

	// Add runbook link if present
	if alert.RunbookURL != "" {
		attachment.Actions = []SlackAction{
			{
				Type: "button",
				Text: "View Runbook",
				URL:  alert.RunbookURL,
			},
		}
	}

	message := &SlackMessage{
		Username:    p.config.Username,
		IconEmoji:   p.config.IconEmoji,
		Attachments: []SlackAttachment{attachment},
	}

	// Set channel if specified in alert or config
	if len(alert.Recipients) > 0 {
		message.Channel = alert.Recipients[0]
	} else if p.config.DefaultChannel != "" {
		message.Channel = p.config.DefaultChannel
	}

	return message
}

// severityToColor maps alert severity to Slack attachment color
func (p *SlackProvider) severityToColor(severity alerts.AlertSeverity) string {
	switch severity {
	case alerts.SeverityInfo:
		return "#36a64f" // Green
	case alerts.SeverityWarning:
		return "#FFA500" // Orange
	case alerts.SeverityError:
		return "#E01E5A" // Red
	case alerts.SeverityCritical:
		return "#8B0000" // Dark red
	default:
		return "#808080" // Gray
	}
}

// buildFields creates Slack attachment fields from alert details
func (p *SlackProvider) buildFields(alert *alerts.Alert) []SlackField {
	fields := []SlackField{
		{
			Title: "Tenant ID",
			Value: alert.TenantID,
			Short: true,
		},
		{
			Title: "Type",
			Value: string(alert.Type),
			Short: true,
		},
		{
			Title: "Severity",
			Value: string(alert.Severity),
			Short: true,
		},
	}

	if alert.TraceID != "" {
		fields = append(fields, SlackField{
			Title: "Trace ID",
			Value: alert.TraceID,
			Short: true,
		})
	}

	// Add custom details
	for key, value := range alert.Details {
		// Skip internal/sensitive fields
		if key == "delivery_errors" || key == "failed_at" {
			continue
		}

		fields = append(fields, SlackField{
			Title: key,
			Value: fmt.Sprintf("%v", value),
			Short: false,
		})
	}

	return fields
}

// Slack message structures

// SlackMessage represents a Slack message
type SlackMessage struct {
	Channel     string             `json:"channel,omitempty"`
	Username    string             `json:"username,omitempty"`
	Text        string             `json:"text,omitempty"`
	IconEmoji   string             `json:"icon_emoji,omitempty"`
	IconURL     string             `json:"icon_url,omitempty"`
	Attachments []SlackAttachment  `json:"attachments,omitempty"`
}

// SlackAttachment represents a Slack message attachment
type SlackAttachment struct {
	Color      string        `json:"color,omitempty"`
	Title      string        `json:"title,omitempty"`
	TitleLink  string        `json:"title_link,omitempty"`
	Text       string        `json:"text,omitempty"`
	Fields     []SlackField  `json:"fields,omitempty"`
	Timestamp  int64         `json:"ts,omitempty"`
	Footer     string        `json:"footer,omitempty"`
	FooterIcon string        `json:"footer_icon,omitempty"`
	Actions    []SlackAction `json:"actions,omitempty"`
}

// SlackField represents a field in a Slack attachment
type SlackField struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

// SlackAction represents an action button in Slack
type SlackAction struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	URL   string `json:"url"`
	Style string `json:"style,omitempty"`
}
