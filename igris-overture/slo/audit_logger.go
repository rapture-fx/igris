// Package slo provides HMAC-signed audit logging for SLO enforcement
package slo

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
)

// AuditLogger logs SLO enforcement actions to database with HMAC signatures
type AuditLogger struct {
	db         *sql.DB
	hmacSecret string
	enabled    bool
	logger     *log.Logger
}

// AuditEvent represents an SLO audit event
type AuditEvent struct {
	EventUUID      uuid.UUID              `json:"event_uuid"`
	EventType      string                 `json:"event_type"`
	SLOType        string                 `json:"slo_type,omitempty"`
	SLOStatus      string                 `json:"slo_status,omitempty"`
	CurrentValue   float64                `json:"current_value,omitempty"`
	ThresholdValue float64                `json:"threshold_value,omitempty"`
	ActionType     string                 `json:"action_type,omitempty"`
	ActionTarget   string                 `json:"action_target,omitempty"`
	ActionReason   string                 `json:"action_reason,omitempty"`
	ActionResult   string                 `json:"action_result,omitempty"`
	Actor          string                 `json:"actor"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CheckpointID   string                 `json:"checkpoint_id,omitempty"`
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(db *sql.DB) *AuditLogger {
	hmacSecret := os.Getenv("SLO_AUDIT_HMAC_SECRET")
	if hmacSecret == "" {
		log.Println("[SLO] Warning: SLO_AUDIT_HMAC_SECRET not set, using default (INSECURE)")
		hmacSecret = "default-slo-audit-secret-change-in-production"
	}

	enabled := db != nil

	return &AuditLogger{
		db:         db,
		hmacSecret: hmacSecret,
		enabled:    enabled,
		logger:     log.Default(),
	}
}

// LogAction logs a remediation action to the audit trail
func (al *AuditLogger) LogAction(action RemediationAction) error {
	return al.LogEvent(AuditEvent{
		EventType:      "action.executed",
		SLOType:        action.SLOType,
		CurrentValue:   action.CurrentValue,
		ThresholdValue: action.ThresholdValue,
		ActionType:     action.ActionType,
		ActionTarget:   action.Target,
		ActionReason:   action.Reason,
		ActionResult:   "success",
		Actor:          "slo_enforcer",
	})
}

// LogBreach logs an SLO breach event
func (al *AuditLogger) LogBreach(sloType, sloStatus string, currentValue, thresholdValue float64) error {
	return al.LogEvent(AuditEvent{
		EventType:      "slo.breach",
		SLOType:        sloType,
		SLOStatus:      sloStatus,
		CurrentValue:   currentValue,
		ThresholdValue: thresholdValue,
		Actor:          "slo_enforcer",
	})
}

// LogCompliant logs when SLOs return to compliant state
func (al *AuditLogger) LogCompliant(sloType string, currentValue, thresholdValue float64) error {
	return al.LogEvent(AuditEvent{
		EventType:      "slo.compliant",
		SLOType:        sloType,
		SLOStatus:      "Compliant",
		CurrentValue:   currentValue,
		ThresholdValue: thresholdValue,
		Actor:          "slo_enforcer",
	})
}

// LogActionFailure logs when an action execution fails
func (al *AuditLogger) LogActionFailure(action RemediationAction, err error) error {
	metadata := map[string]interface{}{
		"error": err.Error(),
	}

	return al.LogEvent(AuditEvent{
		EventType:      "action.failed",
		SLOType:        action.SLOType,
		CurrentValue:   action.CurrentValue,
		ThresholdValue: action.ThresholdValue,
		ActionType:     action.ActionType,
		ActionTarget:   action.Target,
		ActionReason:   action.Reason,
		ActionResult:   "failed",
		Actor:          "slo_enforcer",
		Metadata:       metadata,
	})
}

// LogEvent logs a generic audit event
func (al *AuditLogger) LogEvent(event AuditEvent) error {
	if !al.enabled {
		al.logger.Printf("[SLO] Audit logging disabled (no database), event: %s", event.EventType)
		return nil
	}

	// Generate UUID if not provided
	if event.EventUUID == uuid.Nil {
		event.EventUUID = uuid.New()
	}

	// Default actor
	if event.Actor == "" {
		event.Actor = "slo_enforcer"
	}

	// Convert metadata to JSONB
	var metadataJSON []byte
	var err error
	if event.Metadata != nil {
		metadataJSON, err = json.Marshal(event.Metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %w", err)
		}
	}

	// Call stored procedure to log event with HMAC
	var eventUUID uuid.UUID
	err = al.db.QueryRow(`
		SELECT log_slo_audit_event($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		event.EventType,
		sqlNullString(event.SLOType),
		sqlNullString(event.SLOStatus),
		sqlNullFloat64(event.CurrentValue),
		sqlNullFloat64(event.ThresholdValue),
		sqlNullString(event.ActionType),
		sqlNullString(event.ActionTarget),
		sqlNullString(event.ActionReason),
		sqlNullString(event.ActionResult),
		event.Actor,
		metadataJSON,
		sqlNullString(event.CheckpointID),
		al.hmacSecret,
	).Scan(&eventUUID)

	if err != nil {
		return fmt.Errorf("failed to log audit event: %w", err)
	}

	al.logger.Printf("[SLO] Audit event logged: %s (uuid=%s)", event.EventType, eventUUID)
	return nil
}

// GetRecentEvents retrieves recent audit events
func (al *AuditLogger) GetRecentEvents(limit int) ([]AuditEvent, error) {
	if !al.enabled {
		return nil, fmt.Errorf("audit logging disabled")
	}

	rows, err := al.db.Query(`
		SELECT event_uuid, event_type, slo_type, slo_status,
		       current_value, threshold_value, action_type, action_target,
		       action_reason, action_result, actor, metadata, checkpoint_id
		FROM slo_audit_events
		ORDER BY timestamp DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []AuditEvent
	for rows.Next() {
		var event AuditEvent
		var sloType, sloStatus, actionType, actionTarget, actionReason, actionResult, checkpointID sql.NullString
		var currentValue, thresholdValue sql.NullFloat64
		var metadataJSON []byte

		err := rows.Scan(
			&event.EventUUID,
			&event.EventType,
			&sloType,
			&sloStatus,
			&currentValue,
			&thresholdValue,
			&actionType,
			&actionTarget,
			&actionReason,
			&actionResult,
			&event.Actor,
			&metadataJSON,
			&checkpointID,
		)
		if err != nil {
			return nil, err
		}

		// Populate nullable fields
		if sloType.Valid {
			event.SLOType = sloType.String
		}
		if sloStatus.Valid {
			event.SLOStatus = sloStatus.String
		}
		if currentValue.Valid {
			event.CurrentValue = currentValue.Float64
		}
		if thresholdValue.Valid {
			event.ThresholdValue = thresholdValue.Float64
		}
		if actionType.Valid {
			event.ActionType = actionType.String
		}
		if actionTarget.Valid {
			event.ActionTarget = actionTarget.String
		}
		if actionReason.Valid {
			event.ActionReason = actionReason.String
		}
		if actionResult.Valid {
			event.ActionResult = actionResult.String
		}
		if checkpointID.Valid {
			event.CheckpointID = checkpointID.String
		}

		// Parse metadata
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &event.Metadata); err != nil {
				al.logger.Printf("[SLO] Failed to parse metadata: %v", err)
			}
		}

		events = append(events, event)
	}

	return events, nil
}

// Helper functions for SQL NULL types
func sqlNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func sqlNullFloat64(f float64) sql.NullFloat64 {
	if f == 0 {
		return sql.NullFloat64{Valid: false}
	}
	return sql.NullFloat64{Float64: f, Valid: true}
}
