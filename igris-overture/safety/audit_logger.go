// Package safety provides audit logging for Phase 13+.
//
// This file implements database-backed audit logging for compliance and debugging
// of safety-related events including budget checks, token limits, and key validation.
package safety

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// AuditLogger provides database-backed audit logging for safety events
type AuditLogger struct {
	db       *sql.DB
	mu       sync.Mutex
	enabled  bool
	tenantID string
	logger   *log.Logger

	// Buffered channel for async logging
	eventChan chan *AuditEvent
	stopChan  chan struct{}
	wg        sync.WaitGroup
}

// AuditEvent represents a safety-related event to be logged
type AuditEvent struct {
	TenantID       string
	EventType      string
	EventCategory  string
	Severity       string
	Provider       string
	Model          string
	Action         string
	CostUSD        float64
	TokensRequested int
	TokensAllowed   int
	RequestID      string
	TraceID        string
	Metadata       map[string]interface{}
	ErrorMessage   string
	Timestamp      time.Time
}

// Event types
const (
	EventTypeBudgetCheck       = "budget_check"
	EventTypeBudgetBreach      = "budget_breach"
	EventTypeTokenLimit        = "token_limit"
	EventTypeKeyValidation     = "key_validation"
	EventTypeFallbackTriggered = "fallback_triggered"
	EventTypePolicyViolation   = "policy_violation"
	EventTypeMonthReset        = "month_reset"
)

// Event categories
const (
	CategoryBudget   = "budget"
	CategoryToken    = "token"
	CategoryKey      = "key"
	CategoryFallback = "fallback"
	CategoryPolicy   = "policy"
	CategorySystem   = "system"
)

// Severity levels
const (
	SeverityInfo     = "info"
	SeverityWarning  = "warning"
	SeverityError    = "error"
	SeverityCritical = "critical"
)

// Actions
const (
	ActionAllowed   = "allowed"
	ActionRejected  = "rejected"
	ActionTruncated = "truncated"
	ActionFallback  = "fallback"
	ActionValid     = "valid"
	ActionInvalid   = "invalid"
)

// NewAuditLogger creates a new audit logger
// If db is nil, audit logging is disabled
func NewAuditLogger(db *sql.DB, tenantID string) *AuditLogger {
	enabled := db != nil

	al := &AuditLogger{
		db:        db,
		enabled:   enabled,
		tenantID:  tenantID,
		logger:    log.Default(),
		eventChan: make(chan *AuditEvent, 1000), // Buffer 1000 events
		stopChan:  make(chan struct{}),
	}

	if enabled {
		// Start background worker for async logging
		al.wg.Add(1)
		go al.worker()
		log.Printf("[AuditLogger] Enabled for tenant: %s\n", tenantID)
	} else {
		log.Println("[AuditLogger] Disabled - no audit events will be persisted")
	}

	return al
}

// IsEnabled returns whether audit logging is enabled
func (al *AuditLogger) IsEnabled() bool {
	return al.enabled
}

// LogEvent logs an audit event asynchronously
func (al *AuditLogger) LogEvent(event *AuditEvent) {
	if !al.enabled {
		return
	}

	// Set tenant ID and timestamp if not provided
	if event.TenantID == "" {
		event.TenantID = al.tenantID
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	// Send to channel for async processing
	select {
	case al.eventChan <- event:
		// Event queued successfully
	default:
		// Channel full - log warning and drop event
		al.logger.Printf("[AuditLogger] WARNING: Event buffer full, dropping event: %s\n", event.EventType)
	}
}

// worker processes audit events from the channel and writes to database
func (al *AuditLogger) worker() {
	defer al.wg.Done()

	for {
		select {
		case event := <-al.eventChan:
			if err := al.writeEvent(event); err != nil {
				al.logger.Printf("[AuditLogger] ERROR: Failed to write event: %v\n", err)
			}
		case <-al.stopChan:
			// Drain remaining events
			al.logger.Println("[AuditLogger] Shutting down, draining event queue...")
			for {
				select {
				case event := <-al.eventChan:
					if err := al.writeEvent(event); err != nil {
						al.logger.Printf("[AuditLogger] ERROR: Failed to write event during shutdown: %v\n", err)
					}
				default:
					return
				}
			}
		}
	}
}

// writeEvent writes an audit event to the database
func (al *AuditLogger) writeEvent(event *AuditEvent) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Convert metadata to JSON
	var metadataJSON []byte
	if event.Metadata != nil && len(event.Metadata) > 0 {
		var err error
		metadataJSON, err = json.Marshal(event.Metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %w", err)
		}
	}

	query := `
		INSERT INTO audit_events (
			id, tenant_id, event_type, event_category, severity,
			provider, model, action, cost_usd,
			tokens_requested, tokens_allowed,
			request_id, trace_id, metadata, error_message, timestamp
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	eventID := uuid.New().String()

	_, err := al.db.ExecContext(ctx, query,
		eventID,
		event.TenantID,
		event.EventType,
		event.EventCategory,
		event.Severity,
		nullString(event.Provider),
		nullString(event.Model),
		nullString(event.Action),
		nullFloat64(event.CostUSD),
		nullInt(event.TokensRequested),
		nullInt(event.TokensAllowed),
		nullString(event.RequestID),
		nullString(event.TraceID),
		metadataJSON,
		nullString(event.ErrorMessage),
		event.Timestamp,
	)

	if err != nil {
		return fmt.Errorf("failed to insert audit event: %w", err)
	}

	return nil
}

// Close gracefully shuts down the audit logger
func (al *AuditLogger) Close() error {
	if !al.enabled {
		return nil
	}

	al.logger.Println("[AuditLogger] Closing...")
	close(al.stopChan)
	al.wg.Wait()
	al.logger.Println("[AuditLogger] Closed successfully")
	return nil
}

// Helper methods for common audit events

// LogBudgetCheck logs a budget check event
func (al *AuditLogger) LogBudgetCheck(allowed bool, currentSpend, limit, estimatedCost float64, traceID string) {
	action := ActionAllowed
	severity := SeverityInfo
	if !allowed {
		action = ActionRejected
		severity = SeverityWarning
	}

	al.LogEvent(&AuditEvent{
		EventType:     EventTypeBudgetCheck,
		EventCategory: CategoryBudget,
		Severity:      severity,
		Action:        action,
		CostUSD:       estimatedCost,
		TraceID:       traceID,
		Metadata: map[string]interface{}{
			"current_spend": currentSpend,
			"budget_limit":  limit,
			"estimated_cost": estimatedCost,
		},
	})
}

// LogBudgetBreach logs a budget breach event
func (al *AuditLogger) LogBudgetBreach(currentSpend, limit float64, traceID string) {
	al.LogEvent(&AuditEvent{
		EventType:     EventTypeBudgetBreach,
		EventCategory: CategoryBudget,
		Severity:      SeverityCritical,
		TraceID:       traceID,
		Metadata: map[string]interface{}{
			"current_spend": currentSpend,
			"budget_limit":  limit,
			"percentage":    (currentSpend / limit) * 100,
		},
	})
}

// LogTokenLimit logs a token limit enforcement event
func (al *AuditLogger) LogTokenLimit(action string, requested, allowed, limit int, model string, traceID string) {
	severity := SeverityInfo
	if action == ActionRejected {
		severity = SeverityWarning
	}

	al.LogEvent(&AuditEvent{
		EventType:       EventTypeTokenLimit,
		EventCategory:   CategoryToken,
		Severity:        severity,
		Model:           model,
		Action:          action,
		TokensRequested: requested,
		TokensAllowed:   allowed,
		TraceID:         traceID,
		Metadata: map[string]interface{}{
			"token_limit": limit,
		},
	})
}

// LogKeyValidation logs an API key validation event
func (al *AuditLogger) LogKeyValidation(provider string, valid bool, errorMsg string) {
	action := ActionValid
	severity := SeverityInfo
	if !valid {
		action = ActionInvalid
		severity = SeverityError
	}

	al.LogEvent(&AuditEvent{
		EventType:     EventTypeKeyValidation,
		EventCategory: CategoryKey,
		Severity:      severity,
		Provider:      provider,
		Action:        action,
		ErrorMessage:  errorMsg,
	})
}

// LogFallback logs a fallback trigger event
func (al *AuditLogger) LogFallback(reason, provider, model string, traceID string) {
	al.LogEvent(&AuditEvent{
		EventType:     EventTypeFallbackTriggered,
		EventCategory: CategoryFallback,
		Severity:      SeverityWarning,
		Provider:      provider,
		Model:         model,
		Action:        ActionFallback,
		TraceID:       traceID,
		Metadata: map[string]interface{}{
			"reason": reason,
		},
	})
}

// LogMonthReset logs a month reset event
func (al *AuditLogger) LogMonthReset(oldMonth, newMonth string, finalSpend float64) {
	al.LogEvent(&AuditEvent{
		EventType:     EventTypeMonthReset,
		EventCategory: CategorySystem,
		Severity:      SeverityInfo,
		Metadata: map[string]interface{}{
			"old_month":   oldMonth,
			"new_month":   newMonth,
			"final_spend": finalSpend,
		},
	})
}

// Query methods for retrieving audit events

// AuditEventRecord represents a retrieved audit event
type AuditEventRecord struct {
	ID              string
	TenantID        string
	EventType       string
	EventCategory   string
	Severity        string
	Provider        string
	Model           string
	Action          string
	CostUSD         float64
	TokensRequested int
	TokensAllowed   int
	RequestID       string
	TraceID         string
	Metadata        map[string]interface{}
	ErrorMessage    string
	Timestamp       time.Time
}

// GetRecentEvents retrieves recent audit events for the tenant
func (al *AuditLogger) GetRecentEvents(limit int, sinceHours int) ([]AuditEventRecord, error) {
	if !al.enabled {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, event_type, event_category, severity,
		       provider, model, action, cost_usd,
		       tokens_requested, tokens_allowed,
		       request_id, trace_id, metadata, error_message, timestamp
		FROM audit_events
		WHERE tenant_id = $1 AND timestamp >= NOW() - INTERVAL '1 hour' * $2
		ORDER BY timestamp DESC
		LIMIT $3
	`

	rows, err := al.db.QueryContext(ctx, query, al.tenantID, sinceHours, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit events: %w", err)
	}
	defer rows.Close()

	return al.scanEvents(rows)
}

// GetEventsByType retrieves audit events filtered by event type
func (al *AuditLogger) GetEventsByType(eventType string, limit int) ([]AuditEventRecord, error) {
	if !al.enabled {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, event_type, event_category, severity,
		       provider, model, action, cost_usd,
		       tokens_requested, tokens_allowed,
		       request_id, trace_id, metadata, error_message, timestamp
		FROM audit_events
		WHERE tenant_id = $1 AND event_type = $2
		ORDER BY timestamp DESC
		LIMIT $3
	`

	rows, err := al.db.QueryContext(ctx, query, al.tenantID, eventType, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit events by type: %w", err)
	}
	defer rows.Close()

	return al.scanEvents(rows)
}

// GetEventsBySeverity retrieves audit events filtered by severity
func (al *AuditLogger) GetEventsBySeverity(severity string, limit int) ([]AuditEventRecord, error) {
	if !al.enabled {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, event_type, event_category, severity,
		       provider, model, action, cost_usd,
		       tokens_requested, tokens_allowed,
		       request_id, trace_id, metadata, error_message, timestamp
		FROM audit_events
		WHERE tenant_id = $1 AND severity = $2
		ORDER BY timestamp DESC
		LIMIT $3
	`

	rows, err := al.db.QueryContext(ctx, query, al.tenantID, severity, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit events by severity: %w", err)
	}
	defer rows.Close()

	return al.scanEvents(rows)
}

// scanEvents scans database rows into AuditEventRecord structs
func (al *AuditLogger) scanEvents(rows *sql.Rows) ([]AuditEventRecord, error) {
	var records []AuditEventRecord

	for rows.Next() {
		var record AuditEventRecord
		var provider, model, action, requestID, traceID, errorMessage sql.NullString
		var costUSD sql.NullFloat64
		var tokensRequested, tokensAllowed sql.NullInt64
		var metadataJSON []byte

		err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.EventType,
			&record.EventCategory,
			&record.Severity,
			&provider,
			&model,
			&action,
			&costUSD,
			&tokensRequested,
			&tokensAllowed,
			&requestID,
			&traceID,
			&metadataJSON,
			&errorMessage,
			&record.Timestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit event: %w", err)
		}

		// Convert nullable fields
		if provider.Valid {
			record.Provider = provider.String
		}
		if model.Valid {
			record.Model = model.String
		}
		if action.Valid {
			record.Action = action.String
		}
		if costUSD.Valid {
			record.CostUSD = costUSD.Float64
		}
		if tokensRequested.Valid {
			record.TokensRequested = int(tokensRequested.Int64)
		}
		if tokensAllowed.Valid {
			record.TokensAllowed = int(tokensAllowed.Int64)
		}
		if requestID.Valid {
			record.RequestID = requestID.String
		}
		if traceID.Valid {
			record.TraceID = traceID.String
		}
		if errorMessage.Valid {
			record.ErrorMessage = errorMessage.String
		}

		// Parse JSON metadata
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &record.Metadata); err != nil {
				al.logger.Printf("[AuditLogger] Warning: Failed to parse metadata for event %s: %v\n", record.ID, err)
			}
		}

		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return records, nil
}

// Helper functions for nullable types

func nullFloat64(f float64) sql.NullFloat64 {
	if f == 0 {
		return sql.NullFloat64{Valid: false}
	}
	return sql.NullFloat64{Float64: f, Valid: true}
}
