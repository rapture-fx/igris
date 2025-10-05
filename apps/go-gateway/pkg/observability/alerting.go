package observability

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityCritical AlertSeverity = "critical"
)

// AlertType represents different types of alerts
type AlertType string

const (
	AlertTypeLatencySpike   AlertType = "latency_spike"
	AlertTypeCacheFailure   AlertType = "cache_failure"
	AlertTypeModelLoadError AlertType = "model_load_error"
	AlertTypeHighErrorRate  AlertType = "high_error_rate"
	AlertTypeReplicaDown    AlertType = "replica_down"
	AlertTypeEdgeNodeDown   AlertType = "edge_node_down"
	AlertTypeETLBacklog     AlertType = "etl_backlog"
)

// Alert represents a single alert
type Alert struct {
	ID          string
	Type        AlertType
	Severity    AlertSeverity
	Title       string
	Message     string
	Timestamp   time.Time
	Labels      map[string]string
	Annotations map[string]string
	Resolved    bool
	ResolvedAt  *time.Time
}

// AlertRule defines conditions for triggering alerts
type AlertRule struct {
	Name        string
	Type        AlertType
	Severity    AlertSeverity
	Condition   func(ctx context.Context) (bool, string)
	Cooldown    time.Duration
	LastFired   time.Time
	Enabled     bool
}

// AlertingConfig holds configuration for the alerting system
type AlertingConfig struct {
	EnableConsole      bool
	EnableSlack        bool
	EnableEmail        bool
	SlackWebhookURL    string
	EmailRecipients    []string
	SMTPServer         string
	CheckInterval      time.Duration
	AlertRetention     time.Duration
}

// AlertingManager manages alerts and notifications
type AlertingManager struct {
	config       AlertingConfig
	rules        []*AlertRule
	activeAlerts map[string]*Alert
	alertHistory []*Alert
	logger       zerolog.Logger
	mu           sync.RWMutex

	// Dependencies for rule evaluation
	metricsCollector *MetricsCollector
}

// NewAlertingManager creates a new alerting manager
func NewAlertingManager(config AlertingConfig, metrics *MetricsCollector, logger zerolog.Logger) *AlertingManager {
	if config.CheckInterval == 0 {
		config.CheckInterval = 30 * time.Second
	}
	if config.AlertRetention == 0 {
		config.AlertRetention = 24 * time.Hour
	}

	am := &AlertingManager{
		config:           config,
		rules:            make([]*AlertRule, 0),
		activeAlerts:     make(map[string]*Alert),
		alertHistory:     make([]*Alert, 0),
		logger:           logger.With().Str("component", "alerting-manager").Logger(),
		metricsCollector: metrics,
	}

	am.initializeDefaultRules()

	am.logger.Info().
		Bool("console", config.EnableConsole).
		Bool("slack", config.EnableSlack).
		Bool("email", config.EnableEmail).
		Dur("check_interval", config.CheckInterval).
		Msg("Alerting manager initialized")

	return am
}

// initializeDefaultRules sets up default alert rules
func (am *AlertingManager) initializeDefaultRules() {
	// Latency spike alert (>100ms P99)
	am.AddRule(&AlertRule{
		Name:     "High Latency Alert",
		Type:     AlertTypeLatencySpike,
		Severity: SeverityWarning,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check actual P99 latency from metrics
			// For now, always return false
			return false, ""
		},
		Cooldown: 5 * time.Minute,
		Enabled:  true,
	})

	// Cache failure alert (hit ratio <70%)
	am.AddRule(&AlertRule{
		Name:     "Low Cache Hit Ratio",
		Type:     AlertTypeCacheFailure,
		Severity: SeverityWarning,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check cache hit ratio
			return false, ""
		},
		Cooldown: 5 * time.Minute,
		Enabled:  true,
	})

	// Model load error alert
	am.AddRule(&AlertRule{
		Name:     "Model Load Failure",
		Type:     AlertTypeModelLoadError,
		Severity: SeverityCritical,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check model load errors
			return false, ""
		},
		Cooldown: 1 * time.Minute,
		Enabled:  true,
	})

	// High error rate alert (>5% error rate)
	am.AddRule(&AlertRule{
		Name:     "High Error Rate",
		Type:     AlertTypeHighErrorRate,
		Severity: SeverityCritical,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check error rate
			return false, ""
		},
		Cooldown: 5 * time.Minute,
		Enabled:  true,
	})

	// Replica down alert
	am.AddRule(&AlertRule{
		Name:     "Replica Unhealthy",
		Type:     AlertTypeReplicaDown,
		Severity: SeverityWarning,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check replica health
			return false, ""
		},
		Cooldown: 2 * time.Minute,
		Enabled:  true,
	})

	// Edge node down alert
	am.AddRule(&AlertRule{
		Name:     "Edge Node Unhealthy",
		Type:     AlertTypeEdgeNodeDown,
		Severity: SeverityWarning,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check edge node health
			return false, ""
		},
		Cooldown: 2 * time.Minute,
		Enabled:  true,
	})

	// ETL backlog alert
	am.AddRule(&AlertRule{
		Name:     "ETL Queue Backlog",
		Type:     AlertTypeETLBacklog,
		Severity: SeverityInfo,
		Condition: func(ctx context.Context) (bool, string) {
			// Placeholder: would check ETL queue size
			return false, ""
		},
		Cooldown: 10 * time.Minute,
		Enabled:  true,
	})

	am.logger.Info().
		Int("rules", len(am.rules)).
		Msg("Initialized default alert rules")
}

// AddRule adds a new alert rule
func (am *AlertingManager) AddRule(rule *AlertRule) {
	am.mu.Lock()
	defer am.mu.Unlock()

	am.rules = append(am.rules, rule)
	am.logger.Info().
		Str("name", rule.Name).
		Str("type", string(rule.Type)).
		Str("severity", string(rule.Severity)).
		Msg("Alert rule added")
}

// TriggerAlert manually triggers an alert
func (am *AlertingManager) TriggerAlert(alertType AlertType, severity AlertSeverity, title, message string, labels map[string]string) {
	am.mu.Lock()
	defer am.mu.Unlock()

	alert := &Alert{
		ID:          fmt.Sprintf("%s-%d", alertType, time.Now().Unix()),
		Type:        alertType,
		Severity:    severity,
		Title:       title,
		Message:     message,
		Timestamp:   time.Now(),
		Labels:      labels,
		Annotations: make(map[string]string),
		Resolved:    false,
	}

	am.activeAlerts[alert.ID] = alert
	am.alertHistory = append(am.alertHistory, alert)

	am.logger.Warn().
		Str("id", alert.ID).
		Str("type", string(alertType)).
		Str("severity", string(severity)).
		Str("title", title).
		Msg("Alert triggered")

	// Send notifications
	am.sendNotifications(alert)
}

// ResolveAlert marks an alert as resolved
func (am *AlertingManager) ResolveAlert(alertID string) {
	am.mu.Lock()
	defer am.mu.Unlock()

	if alert, exists := am.activeAlerts[alertID]; exists {
		now := time.Now()
		alert.Resolved = true
		alert.ResolvedAt = &now

		delete(am.activeAlerts, alertID)

		am.logger.Info().
			Str("id", alertID).
			Str("type", string(alert.Type)).
			Dur("duration", now.Sub(alert.Timestamp)).
			Msg("Alert resolved")
	}
}

// StartAlertChecker starts the background alert checker
func (am *AlertingManager) StartAlertChecker(ctx context.Context) {
	ticker := time.NewTicker(am.config.CheckInterval)
	defer ticker.Stop()

	am.logger.Info().
		Dur("interval", am.config.CheckInterval).
		Msg("Started alert checker worker")

	for {
		select {
		case <-ctx.Done():
			am.logger.Info().Msg("Stopping alert checker worker")
			return
		case <-ticker.C:
			am.evaluateRules(ctx)
			am.cleanupOldAlerts()
		}
	}
}

// evaluateRules evaluates all alert rules
func (am *AlertingManager) evaluateRules(ctx context.Context) {
	am.mu.RLock()
	rules := make([]*AlertRule, len(am.rules))
	copy(rules, am.rules)
	am.mu.RUnlock()

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		// Check cooldown
		if time.Since(rule.LastFired) < rule.Cooldown {
			continue
		}

		// Evaluate condition
		triggered, message := rule.Condition(ctx)
		if triggered {
			rule.LastFired = time.Now()

			am.TriggerAlert(
				rule.Type,
				rule.Severity,
				rule.Name,
				message,
				map[string]string{"rule": rule.Name},
			)
		}
	}
}

// cleanupOldAlerts removes old alerts from history
func (am *AlertingManager) cleanupOldAlerts() {
	am.mu.Lock()
	defer am.mu.Unlock()

	cutoff := time.Now().Add(-am.config.AlertRetention)
	newHistory := make([]*Alert, 0)

	for _, alert := range am.alertHistory {
		if alert.Timestamp.After(cutoff) {
			newHistory = append(newHistory, alert)
		}
	}

	removed := len(am.alertHistory) - len(newHistory)
	if removed > 0 {
		am.logger.Debug().
			Int("removed", removed).
			Msg("Cleaned up old alerts")
	}

	am.alertHistory = newHistory
}

// sendNotifications sends alert notifications to configured channels
func (am *AlertingManager) sendNotifications(alert *Alert) {
	// Console notification
	if am.config.EnableConsole {
		am.sendConsoleNotification(alert)
	}

	// Slack notification (stub)
	if am.config.EnableSlack {
		am.sendSlackNotification(alert)
	}

	// Email notification (stub)
	if am.config.EnableEmail {
		am.sendEmailNotification(alert)
	}
}

// sendConsoleNotification outputs alert to console
func (am *AlertingManager) sendConsoleNotification(alert *Alert) {
	logEvent := am.logger.WithLevel(zerolog.WarnLevel)
	if alert.Severity == SeverityCritical {
		logEvent = am.logger.WithLevel(zerolog.ErrorLevel)
	}

	logEvent.
		Str("alert_id", alert.ID).
		Str("type", string(alert.Type)).
		Str("severity", string(alert.Severity)).
		Str("title", alert.Title).
		Str("message", alert.Message).
		Time("timestamp", alert.Timestamp).
		Msg("🚨 ALERT")
}

// sendSlackNotification sends alert to Slack (stub implementation)
func (am *AlertingManager) sendSlackNotification(alert *Alert) {
	am.logger.Info().
		Str("alert_id", alert.ID).
		Str("webhook", am.config.SlackWebhookURL).
		Msg("Slack notification (stub)")

	// In production, would use HTTP POST to Slack webhook
	// payload := map[string]interface{}{
	//     "text": fmt.Sprintf("*%s*: %s", alert.Title, alert.Message),
	//     "attachments": []map[string]interface{}{
	//         {
	//             "color": getSeverityColor(alert.Severity),
	//             "fields": []map[string]interface{}{
	//                 {"title": "Severity", "value": alert.Severity, "short": true},
	//                 {"title": "Type", "value": alert.Type, "short": true},
	//             },
	//         },
	//     },
	// }
}

// sendEmailNotification sends alert via email (stub implementation)
func (am *AlertingManager) sendEmailNotification(alert *Alert) {
	am.logger.Info().
		Str("alert_id", alert.ID).
		Strs("recipients", am.config.EmailRecipients).
		Msg("Email notification (stub)")

	// In production, would use SMTP to send email
}

// GetActiveAlerts returns all currently active alerts
func (am *AlertingManager) GetActiveAlerts() []*Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	alerts := make([]*Alert, 0, len(am.activeAlerts))
	for _, alert := range am.activeAlerts {
		alerts = append(alerts, alert)
	}

	return alerts
}

// GetAlertHistory returns alert history
func (am *AlertingManager) GetAlertHistory(limit int) []*Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	if limit <= 0 || limit > len(am.alertHistory) {
		limit = len(am.alertHistory)
	}

	// Return most recent alerts
	start := len(am.alertHistory) - limit
	if start < 0 {
		start = 0
	}

	return am.alertHistory[start:]
}

// GetAlertStats returns statistics about alerts
func (am *AlertingManager) GetAlertStats() map[string]interface{} {
	am.mu.RLock()
	defer am.mu.RUnlock()

	bySeverity := make(map[AlertSeverity]int)
	byType := make(map[AlertType]int)

	for _, alert := range am.activeAlerts {
		bySeverity[alert.Severity]++
		byType[alert.Type]++
	}

	return map[string]interface{}{
		"active_alerts":    len(am.activeAlerts),
		"total_rules":      len(am.rules),
		"enabled_rules":    am.countEnabledRules(),
		"alerts_by_severity": bySeverity,
		"alerts_by_type":   byType,
		"history_count":    len(am.alertHistory),
	}
}

// countEnabledRules counts enabled rules
func (am *AlertingManager) countEnabledRules() int {
	count := 0
	for _, rule := range am.rules {
		if rule.Enabled {
			count++
		}
	}
	return count
}
