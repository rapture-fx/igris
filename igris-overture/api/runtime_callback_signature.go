package api

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
)

const (
	runtimeCallbackEnvelopeHeader = "X-Igris-Callback-Envelope"
	runtimeCallbackVersion        = "runtime_callback.v1"
	runtimeCallbackAlgorithm      = "ed25519-sha256-canonical-json"
	runtimeCallbackFreshness      = 5 * time.Minute
	runtimeCallbackNonceRetention = 24 * time.Hour
)

type runtimeCallbackEnvelope struct {
	Version         string `json:"version"`
	TenantID        string `json:"tenant_id"`
	TaskID          string `json:"task_id"`
	RuntimeID       string `json:"runtime_id"`
	CallbackType    string `json:"callback_type"`
	BodyDigest      string `json:"body_digest"`
	TimestampUnixMs int64  `json:"timestamp_unix_ms"`
	Nonce           string `json:"nonce"`
	Algorithm       string `json:"algorithm"`
	Signature       string `json:"signature"`
}

type runtimeCallbackValidation struct {
	envelope   *runtimeCallbackEnvelope
	bodyDigest string
	reason     string
	status     int
}

func validateRuntimeCallback(c *fiber.Ctx, store *coordinator.CheckpointStore, task *coordinator.TaskRecord, tenantID, callbackType string, body []byte) runtimeCallbackValidation {
	bodyDigest := sha256Hex(body)
	result := runtimeCallbackValidation{bodyDigest: bodyDigest, status: http.StatusForbidden}
	rawEnvelope := strings.TrimSpace(c.Get(runtimeCallbackEnvelopeHeader))
	if rawEnvelope == "" {
		if allowUnsignedRuntimeCallbacks() {
			return runtimeCallbackValidation{bodyDigest: bodyDigest}
		}
		result.reason = "missing runtime callback envelope"
		return result
	}

	envelope, err := parseRuntimeCallbackEnvelope(rawEnvelope)
	if err != nil {
		result.reason = "malformed runtime callback envelope"
		result.status = http.StatusBadRequest
		return result
	}
	result.envelope = envelope

	if envelope.Version != runtimeCallbackVersion {
		result.reason = "unsupported runtime callback envelope version"
		return result
	}
	if envelope.Algorithm != runtimeCallbackAlgorithm {
		result.reason = "unsupported runtime callback signature algorithm"
		return result
	}
	if envelope.TenantID != tenantID {
		result.reason = "runtime callback tenant mismatch"
		return result
	}
	if task == nil || envelope.TaskID != task.TaskID.String() {
		result.reason = "runtime callback task mismatch"
		return result
	}
	if envelope.CallbackType != callbackType {
		result.reason = "runtime callback type mismatch"
		return result
	}
	if envelope.BodyDigest != bodyDigest {
		result.reason = "runtime callback body digest mismatch"
		return result
	}
	if strings.TrimSpace(envelope.Nonce) == "" {
		result.reason = "runtime callback nonce missing"
		return result
	}
	if strings.TrimSpace(envelope.RuntimeID) == "" {
		result.reason = "runtime callback runtime missing"
		return result
	}
	if !runtimeCallbackMatchesTask(task, envelope.RuntimeID) {
		result.reason = "runtime callback identity does not match assigned task runtime"
		return result
	}
	if err := validateRuntimeCallbackTimestamp(envelope.TimestampUnixMs, time.Now()); err != nil {
		result.reason = err.Error()
		return result
	}

	publicKeyHex, err := runtimeCallbackPublicKey(store, tenantID, envelope.RuntimeID)
	if err != nil {
		result.reason = "runtime callback public key unavailable"
		return result
	}
	if err := verifyRuntimeCallbackSignature(*envelope, publicKeyHex); err != nil {
		result.reason = err.Error()
		return result
	}
	if err := reserveRuntimeCallbackNonce(store, *envelope); err != nil {
		result.reason = err.Error()
		return result
	}
	return runtimeCallbackValidation{envelope: envelope, bodyDigest: bodyDigest}
}

func parseRuntimeCallbackEnvelope(raw string) (*runtimeCallbackEnvelope, error) {
	data := []byte(raw)
	if !strings.HasPrefix(raw, "{") {
		decoded, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(raw)
		}
		if err != nil {
			decoded, err = base64.RawURLEncoding.DecodeString(raw)
		}
		if err != nil {
			return nil, err
		}
		data = decoded
	}
	var envelope runtimeCallbackEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, err
	}
	return &envelope, nil
}

func validateRuntimeCallbackTimestamp(timestampUnixMs int64, now time.Time) error {
	if timestampUnixMs == 0 {
		return errors.New("runtime callback timestamp missing")
	}
	ts := time.UnixMilli(timestampUnixMs)
	if ts.Before(now.Add(-runtimeCallbackFreshness)) || ts.After(now.Add(runtimeCallbackFreshness)) {
		return errors.New("runtime callback timestamp outside freshness window")
	}
	return nil
}

func verifyRuntimeCallbackSignature(envelope runtimeCallbackEnvelope, publicKeyHex string) error {
	keyBytes, err := hex.DecodeString(strings.TrimSpace(publicKeyHex))
	if err != nil || len(keyBytes) != ed25519.PublicKeySize {
		return errors.New("runtime callback public key invalid")
	}
	signature, err := base64.StdEncoding.DecodeString(strings.TrimSpace(envelope.Signature))
	if err != nil || len(signature) != ed25519.SignatureSize {
		return errors.New("runtime callback signature invalid")
	}
	if strings.TrimSpace(envelope.Signature) == "" {
		return errors.New("runtime callback signature missing")
	}
	canonical, err := canonicalRuntimeCallbackEnvelope(envelope)
	if err != nil {
		return errors.New("runtime callback canonicalization failed")
	}
	digest := sha256.Sum256(canonical)
	if !ed25519.Verify(ed25519.PublicKey(keyBytes), digest[:], signature) {
		return errors.New("runtime callback signature verification failed")
	}
	return nil
}

func canonicalRuntimeCallbackEnvelope(envelope runtimeCallbackEnvelope) ([]byte, error) {
	return json.Marshal(map[string]any{
		"algorithm":         envelope.Algorithm,
		"body_digest":       envelope.BodyDigest,
		"callback_type":     envelope.CallbackType,
		"nonce":             envelope.Nonce,
		"runtime_id":        envelope.RuntimeID,
		"task_id":           envelope.TaskID,
		"tenant_id":         envelope.TenantID,
		"timestamp_unix_ms": envelope.TimestampUnixMs,
		"version":           envelope.Version,
	})
}

func runtimeCallbackPublicKey(store *coordinator.CheckpointStore, tenantID, runtimeID string) (string, error) {
	if store == nil || store.DB() == nil {
		return "", errors.New("database unavailable")
	}
	var publicKeyHex string
	err := store.DB().QueryRow(`
		SELECT COALESCE(public_key_ed25519, '')
		FROM runtime_instances
		WHERE tenant_id = $1 AND runtime_id::text = $2
		LIMIT 1
	`, tenantID, runtimeID).Scan(&publicKeyHex)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(publicKeyHex) == "" {
		return "", sql.ErrNoRows
	}
	return publicKeyHex, nil
}

func reserveRuntimeCallbackNonce(store *coordinator.CheckpointStore, envelope runtimeCallbackEnvelope) error {
	if store == nil || store.DB() == nil {
		return errors.New("runtime callback replay store unavailable")
	}
	taskID, err := uuid.Parse(envelope.TaskID)
	if err != nil {
		return errors.New("runtime callback task id invalid")
	}
	result, err := store.DB().Exec(`
		INSERT INTO runtime_callback_nonces (
			tenant_id, task_id, runtime_id, callback_type, nonce, body_digest, timestamp_unix_ms
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (tenant_id, runtime_id, nonce) DO NOTHING`,
		envelope.TenantID,
		taskID,
		envelope.RuntimeID,
		envelope.CallbackType,
		envelope.Nonce,
		envelope.BodyDigest,
		envelope.TimestampUnixMs,
	)
	if err != nil {
		return fmt.Errorf("runtime callback replay store failed: %w", err)
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return errors.New("runtime callback replay detected")
	}
	return nil
}

// CleanupExpiredRuntimeCallbackNonces removes accepted callback nonces after
// their replay-protection retention window has elapsed. Retention is floored at
// the signed callback freshness window so cleanup never removes replay
// protection while a callback timestamp may still be accepted.
func CleanupExpiredRuntimeCallbackNonces(ctx context.Context, db *sql.DB, retention time.Duration) (int64, error) {
	if db == nil {
		return 0, nil
	}
	if retention <= 0 {
		retention = runtimeCallbackNonceRetention
	}
	if retention < runtimeCallbackFreshness {
		retention = runtimeCallbackFreshness
	}
	cutoff := time.Now().UTC().Add(-retention)
	result, err := db.ExecContext(ctx, `
		DELETE FROM runtime_callback_nonces
		WHERE accepted_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, nil
	}
	return rowsAffected, nil
}

func StartRuntimeCallbackNonceCleanup(ctx context.Context, db *sql.DB, interval, retention time.Duration) {
	if db == nil {
		return
	}
	if interval <= 0 {
		interval = time.Hour
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				deleted, err := CleanupExpiredRuntimeCallbackNonces(ctx, db, retention)
				if err != nil {
					log.Error().Err(err).Msg("[RuntimeCallback] nonce cleanup failed")
					continue
				}
				if deleted > 0 {
					log.Info().Int64("deleted", deleted).Msg("[RuntimeCallback] expired callback nonces cleaned")
				}
			}
		}
	}()
}

func persistRejectedRuntimeCallback(store *coordinator.CheckpointStore, tenantID string, taskID uuid.UUID, runtimeID, callbackType, reason, bodyDigest string) {
	if store == nil || store.DB() == nil || tenantID == "" || taskID == uuid.Nil {
		return
	}
	runtimeID = strings.TrimSpace(runtimeID)
	_, _ = store.DB().Exec(`
		INSERT INTO boundary_violations (
			tenant_id, task_id, runtime_id, violation_type, severity, reason, evidence_digest
		) VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,NULLIF($7,''))`,
		tenantID,
		taskID,
		runtimeID,
		"runtime_callback_rejected_"+callbackType,
		"critical",
		reason,
		bodyDigest,
	)
}

func runtimeCallbackRejection(c *fiber.Ctx, store *coordinator.CheckpointStore, task *coordinator.TaskRecord, tenantID, callbackType string, validation runtimeCallbackValidation) error {
	runtimeID := ""
	if validation.envelope != nil {
		runtimeID = validation.envelope.RuntimeID
	}
	if runtimeID == "" {
		runtimeID = c.Get("X-Igris-Runtime-ID")
	}
	status := validation.status
	if status == 0 {
		status = http.StatusForbidden
	}
	reason := validation.reason
	if reason == "" {
		reason = "runtime callback rejected"
	}
	if task != nil {
		persistRejectedRuntimeCallback(store, tenantID, task.TaskID, runtimeID, callbackType, reason, validation.bodyDigest)
	}
	return c.Status(status).JSON(fiber.Map{
		"error":   "runtime_callback_rejected",
		"message": reason,
	})
}

func sha256Hex(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func allowUnsignedRuntimeCallbacks() bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS")))
	return value == "true" || value == "1" || value == "yes"
}
