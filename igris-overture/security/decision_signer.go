// Package security provides the decision signing service for cryptographic routing enforcement.
package security

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// DecisionSigner handles signing routing decisions before sending to Runtime
type DecisionSigner struct {
	keyManager          *TenantKeyManager
	db                  *sql.DB
	enabled             bool
	strictMode          bool // If true, fail if signing fails; if false, log warning and continue
	auditEnabled        bool
}

// DecisionSignerConfig holds configuration for the decision signer
type DecisionSignerConfig struct {
	Enabled      bool
	StrictMode   bool
	AuditEnabled bool
}

// DefaultDecisionSignerConfig returns default configuration
func DefaultDecisionSignerConfig() DecisionSignerConfig {
	return DecisionSignerConfig{
		Enabled:      true,
		StrictMode:   false, // Start non-strict for gradual rollout
		AuditEnabled: true,
	}
}

// RoutingDecision represents a routing decision to be signed
type RoutingDecision struct {
	RequestID   string                 `json:"request_id"`
	TenantID    string                 `json:"tenant_id"`
	ProviderID  string                 `json:"provider_id"`
	ModelID     string                 `json:"model_id,omitempty"`
	Intent      string                 `json:"intent,omitempty"`
	Strategy    string                 `json:"strategy"` // e.g., "thompson_sampling", "speculative", "fallback"
	Confidence  float64                `json:"confidence,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// SignedRoutingDecision wraps a routing decision with its signature
type SignedRoutingDecision struct {
	Envelope    *SignedDecisionEnvelope `json:"envelope"`
	RequestID   string                  `json:"request_id"`
	ProviderID  string                  `json:"provider_id"`
	// Original decision fields for backward compatibility
	Decision    *RoutingDecision        `json:"-"` // Not serialized, for internal use
}

// NewDecisionSigner creates a new decision signer
func NewDecisionSigner(keyManager *TenantKeyManager, db *sql.DB, config DecisionSignerConfig) *DecisionSigner {
	return &DecisionSigner{
		keyManager:   keyManager,
		db:           db,
		enabled:      config.Enabled,
		strictMode:   config.StrictMode,
		auditEnabled: config.AuditEnabled,
	}
}

// SignRoutingDecision signs a routing decision before sending to Runtime
func (s *DecisionSigner) SignRoutingDecision(ctx context.Context, decision *RoutingDecision) (*SignedRoutingDecision, error) {
	if !s.enabled {
		// Return unsigned decision for backward compatibility
		return &SignedRoutingDecision{
			RequestID:  decision.RequestID,
			ProviderID: decision.ProviderID,
			Decision:   decision,
		}, nil
	}

	start := time.Now()

	// Sign the decision
	envelope, err := s.keyManager.SignDecision(ctx, decision.TenantID, decision)
	if err != nil {
		observability.RecordVerificationFailure(decision.TenantID, "signing_failed")

		if s.strictMode {
			return nil, fmt.Errorf("failed to sign routing decision: %w", err)
		}

		log.Warn().
			Err(err).
			Str("tenant_id", decision.TenantID).
			Str("request_id", decision.RequestID).
			Msg("Failed to sign routing decision, continuing without signature (non-strict mode)")

		return &SignedRoutingDecision{
			RequestID:  decision.RequestID,
			ProviderID: decision.ProviderID,
			Decision:   decision,
		}, nil
	}

	latencyUs := time.Since(start).Microseconds()
	observability.RecordDecisionSigningLatency(decision.TenantID, latencyUs)

	// Record audit entry if enabled
	if s.auditEnabled {
		if err := s.recordDecisionAudit(ctx, decision, envelope); err != nil {
			log.Error().Err(err).
				Str("decision_id", envelope.Decision.DecisionID).
				Msg("Failed to record decision audit")
			// Don't fail the request for audit errors
		}
	}

	log.Debug().
		Str("tenant_id", decision.TenantID).
		Str("request_id", decision.RequestID).
		Str("decision_id", envelope.Decision.DecisionID).
		Int("key_version", envelope.Decision.KeyVersion).
		Int64("latency_us", latencyUs).
		Msg("Routing decision signed")

	return &SignedRoutingDecision{
		Envelope:   envelope,
		RequestID:  decision.RequestID,
		ProviderID: decision.ProviderID,
		Decision:   decision,
	}, nil
}

// VerifyAndRecordExecution verifies an execution envelope and records the audit
func (s *DecisionSigner) VerifyAndRecordExecution(
	ctx context.Context,
	signedDecision *SignedDecisionEnvelope,
	executionEnvelope *SignedExecutionEnvelope,
	runtimePublicKey string,
) error {
	if !s.enabled {
		return nil
	}

	start := time.Now()
	tenantID := signedDecision.Decision.TenantID

	// Verify execution envelope signature
	if err := s.keyManager.VerifyExecutionEnvelope(ctx, executionEnvelope, runtimePublicKey); err != nil {
		observability.RecordVerificationFailure(tenantID, "execution_signature_invalid")
		observability.RecordTamperDetection(tenantID, "signature_mismatch")

		if err := s.recordTamperDetection(ctx, signedDecision, executionEnvelope, "execution_signature_invalid"); err != nil {
			log.Error().Err(err).Msg("Failed to record tamper detection")
		}

		return fmt.Errorf("execution envelope verification failed: %w", err)
	}

	// Verify decision hash matches
	expectedHash, err := HashDecision(signedDecision)
	if err != nil {
		return fmt.Errorf("failed to hash decision: %w", err)
	}

	if executionEnvelope.Envelope.DecisionHash != expectedHash {
		observability.RecordVerificationFailure(tenantID, "decision_hash_mismatch")
		observability.RecordTamperDetection(tenantID, "decision_mismatch")

		if err := s.recordTamperDetection(ctx, signedDecision, executionEnvelope, "decision_hash_mismatch"); err != nil {
			log.Error().Err(err).Msg("Failed to record tamper detection")
		}

		return fmt.Errorf("decision hash mismatch: expected %s, got %s", expectedHash, executionEnvelope.Envelope.DecisionHash)
	}

	latencyUs := time.Since(start).Microseconds()
	observability.RecordExecutionEnvelopeVerificationLatency(tenantID, latencyUs)

	// Update audit record with verified execution
	if s.auditEnabled {
		if err := s.updateAuditWithExecution(ctx, signedDecision.Decision.DecisionID, executionEnvelope); err != nil {
			log.Error().Err(err).Msg("Failed to update audit with execution")
		}
	}

	log.Debug().
		Str("tenant_id", tenantID).
		Str("decision_id", signedDecision.Decision.DecisionID).
		Bool("success", executionEnvelope.Envelope.Success).
		Int("latency_ms", executionEnvelope.Envelope.LatencyMs).
		Int64("verification_latency_us", latencyUs).
		Msg("Execution envelope verified")

	return nil
}

// recordDecisionAudit records a signed decision to the audit log
func (s *DecisionSigner) recordDecisionAudit(ctx context.Context, decision *RoutingDecision, envelope *SignedDecisionEnvelope) error {
	decisionJSON, err := json.Marshal(envelope.Decision)
	if err != nil {
		return fmt.Errorf("failed to marshal decision: %w", err)
	}

	query := `
		INSERT INTO decision_execution_audit (
			tenant_id,
			decision_id,
			request_id,
			signed_decision,
			decision_signature,
			decision_key_version,
			decision_verified,
			decision_timestamp,
			verification_status,
			provider_id
		) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, 'pending', $8)
	`

	_, err = s.db.ExecContext(ctx, query,
		decision.TenantID,
		envelope.Decision.DecisionID,
		decision.RequestID,
		decisionJSON,
		envelope.Signature,
		envelope.Decision.KeyVersion,
		time.Unix(envelope.Decision.Timestamp, 0),
		decision.ProviderID,
	)

	return err
}

// updateAuditWithExecution updates the audit record with execution results
func (s *DecisionSigner) updateAuditWithExecution(ctx context.Context, decisionID string, envelope *SignedExecutionEnvelope) error {
	envelopeJSON, err := json.Marshal(envelope.Envelope)
	if err != nil {
		return fmt.Errorf("failed to marshal envelope: %w", err)
	}

	query := `
		UPDATE decision_execution_audit
		SET
			execution_envelope = $1,
			execution_signature = $2,
			execution_verified = TRUE,
			execution_timestamp = $3,
			execution_success = $4,
			latency_ms = $5,
			verification_status = 'verified',
			verified_at = NOW()
		WHERE decision_id = $6
	`

	_, err = s.db.ExecContext(ctx, query,
		envelopeJSON,
		envelope.Signature,
		time.Unix(envelope.Envelope.Timestamp, 0),
		envelope.Envelope.Success,
		envelope.Envelope.LatencyMs,
		decisionID,
	)

	return err
}

// recordTamperDetection records a tamper detection event
func (s *DecisionSigner) recordTamperDetection(
	ctx context.Context,
	decision *SignedDecisionEnvelope,
	execution *SignedExecutionEnvelope,
	reason string,
) error {
	var executionJSON []byte
	if execution != nil {
		var err error
		executionJSON, err = json.Marshal(execution)
		if err != nil {
			executionJSON = []byte("{}")
		}
	}

	query := `
		UPDATE decision_execution_audit
		SET
			execution_envelope = $1,
			execution_signature = $2,
			execution_verified = FALSE,
			verification_status = 'tamper_detected',
			verification_error = $3,
			verified_at = NOW()
		WHERE decision_id = $4
	`

	var sig string
	if execution != nil {
		sig = execution.Signature
	}

	_, err := s.db.ExecContext(ctx, query,
		executionJSON,
		sig,
		reason,
		decision.Decision.DecisionID,
	)

	return err
}

// IsEnabled returns whether decision signing is enabled
func (s *DecisionSigner) IsEnabled() bool {
	return s.enabled
}

// SetStrictMode enables or disables strict mode
func (s *DecisionSigner) SetStrictMode(strict bool) {
	s.strictMode = strict
	log.Info().Bool("strict_mode", strict).Msg("Decision signer strict mode updated")
}

// GetAuditStats returns audit statistics
func (s *DecisionSigner) GetAuditStats(ctx context.Context, tenantID string, since time.Time) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as total_decisions,
			COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_count,
			COUNT(CASE WHEN verification_status = 'tamper_detected' THEN 1 END) as tamper_count,
			COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_count,
			AVG(latency_ms) as avg_latency_ms
		FROM decision_execution_audit
		WHERE tenant_id = $1 AND created_at >= $2
	`

	var stats struct {
		TotalDecisions int64
		VerifiedCount  int64
		TamperCount    int64
		PendingCount   int64
		AvgLatencyMs   sql.NullFloat64
	}

	err := s.db.QueryRowContext(ctx, query, tenantID, since).Scan(
		&stats.TotalDecisions,
		&stats.VerifiedCount,
		&stats.TamperCount,
		&stats.PendingCount,
		&stats.AvgLatencyMs,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit stats: %w", err)
	}

	return map[string]interface{}{
		"total_decisions":   stats.TotalDecisions,
		"verified_count":    stats.VerifiedCount,
		"tamper_count":      stats.TamperCount,
		"pending_count":     stats.PendingCount,
		"avg_latency_ms":    stats.AvgLatencyMs.Float64,
		"verification_rate": float64(stats.VerifiedCount) / float64(max(stats.TotalDecisions, 1)),
	}, nil
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
