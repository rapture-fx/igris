package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	reconciliationRequired       = "reconciliation_required"
	reconciliationSucceeded      = "confirmed_succeeded"
	reconciliationFailed         = "confirmed_failed"
	reconciliationRemainsUnknown = "remains_unknown"
)

var (
	errReconciliationNotRequired = errors.New("reconciliation_not_required")
	errResolutionConflict        = errors.New("resolution_conflict")
	externalReferencePattern     = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$`)
)

type operatorReconciliationRequest struct {
	RequestID         string `json:"request_id"`
	Resolution        string `json:"resolution"`
	Reason            string `json:"reason"`
	ExternalReference *struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	} `json:"external_reference,omitempty"`
}

type operatorReconciliationEvent struct {
	ID                        uuid.UUID
	TenantID                  string
	TaskID                    uuid.UUID
	BindingID                 uuid.UUID
	ContractHash              string
	TargetActionID            uuid.UUID
	TargetVersionHash         string
	BusinessIdempotencyDigest string
	EventType                 string
	ObservedEffectState       string
	Resolution                string
	ActorType                 string
	ActorID                   string
	ActorEmail                string
	Reason                    string
	ExternalReferenceType     string
	ExternalReferenceValue    string
	TargetHost                string
	SourceStatusCode          int
	OperatorRequestID         *uuid.UUID
	CreatedAt                 time.Time
}

type operatorReconciliationState struct {
	Required     bool
	CurrentState string
	History      []operatorReconciliationEvent
}

type reconciliationQuerier interface {
	QueryContext(context.Context, string, ...interface{}) (*sql.Rows, error)
}

func reconciliationOperator(c *fiber.Ctx) (tenantID, actorID, actorEmail string, err error) {
	tenantID = middleware.GetClerkUserID(c)
	if tenantID == "" {
		return "", "", "", errors.New("unauthenticated")
	}
	if !middleware.IsAdminRequest(c) {
		return "", "", "", errors.New("not_authorized")
	}
	return tenantID, tenantID, strings.TrimSpace(middleware.GetClerkEmail(c)), nil
}

func handleActionReconciliationGet(db *sql.DB, tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID, _, _, authErr := reconciliationOperator(c)
		if authErr != nil {
			if authErr.Error() == "unauthenticated" {
				return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "not_authorized"})
			}
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "not_authorized"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		}
		if _, err := tc.Store().GetBoundActionRun(c.Context(), taskID, tenantID); err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		} else if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		state, err := loadOperatorReconciliationState(c.Context(), db, tenantID, taskID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "reconciliation_not_required"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(operatorReconciliationResponse(taskID, state, true))
	}
}

func handleActionReconciliationAppend(db *sql.DB, tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID, actorID, actorEmail, authErr := reconciliationOperator(c)
		if authErr != nil {
			if authErr.Error() == "unauthenticated" {
				return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "not_authorized"})
			}
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "not_authorized"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		}
		if _, err := tc.Store().GetBoundActionRun(c.Context(), taskID, tenantID); err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		} else if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		req, requestID, err := decodeOperatorReconciliationRequest(c.Body())
		if err != nil {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "invalid_resolution"})
		}
		event, replayed, err := appendOperatorReconciliation(
			c.Context(), db, tenantID, taskID, actorID, actorEmail, requestID, req,
		)
		switch {
		case errors.Is(err, errReconciliationNotRequired):
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "reconciliation_not_required"})
		case errors.Is(err, errResolutionConflict):
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "resolution_conflict"})
		case err != nil:
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		status := http.StatusCreated
		if replayed {
			status = http.StatusOK
		}
		return c.Status(status).JSON(fiber.Map{
			"event":               operatorReconciliationEventResponse(event, true),
			"idempotent_replay":   replayed,
			"claim_type":          "operator_reconciliation",
			"cryptographic_proof": false,
		})
	}
}

func decodeOperatorReconciliationRequest(body []byte) (operatorReconciliationRequest, uuid.UUID, error) {
	var req operatorReconciliationRequest
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		return req, uuid.Nil, err
	}
	var trailing interface{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return req, uuid.Nil, errors.New("trailing JSON")
	}
	requestID, err := uuid.Parse(strings.TrimSpace(req.RequestID))
	if err != nil {
		return req, uuid.Nil, err
	}
	switch req.Resolution {
	case reconciliationSucceeded, reconciliationFailed, reconciliationRemainsUnknown:
	default:
		return req, uuid.Nil, errors.New("invalid resolution")
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len(req.Reason) < 1 || len(req.Reason) > 1000 || containsUnsafeOperatorText(req.Reason) {
		return req, uuid.Nil, errors.New("invalid reason")
	}
	if req.ExternalReference != nil {
		req.ExternalReference.Type = strings.TrimSpace(req.ExternalReference.Type)
		req.ExternalReference.Value = strings.TrimSpace(req.ExternalReference.Value)
		switch req.ExternalReference.Type {
		case "provider_reference", "transaction_id", "deployment_id", "ticket_id":
		default:
			return req, uuid.Nil, errors.New("invalid external reference type")
		}
		if !externalReferencePattern.MatchString(req.ExternalReference.Value) ||
			containsUnsafeOperatorText(req.ExternalReference.Value) {
			return req, uuid.Nil, errors.New("invalid external reference value")
		}
	}
	return req, requestID, nil
}

func containsUnsafeOperatorText(value string) bool {
	for _, r := range value {
		if unicode.IsControl(r) {
			return true
		}
	}
	lower := strings.ToLower(value)
	for _, marker := range []string{
		"authorization:", "bearer ", "basic ", "cookie:", "set-cookie:",
		"password=", "password:", "api_key=", "apikey=", "secret=", "token=",
	} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func appendOperatorReconciliation(
	ctx context.Context,
	db *sql.DB,
	tenantID string,
	taskID uuid.UUID,
	actorID string,
	actorEmail string,
	requestID uuid.UUID,
	req operatorReconciliationRequest,
) (*operatorReconciliationEvent, bool, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, false, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx,
		`SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2::text, 0))`,
		tenantID, taskID,
	); err != nil {
		return nil, false, err
	}

	existing, err := loadOperatorReconciliationRequestEvent(ctx, tx, tenantID, taskID, requestID)
	if err == nil {
		if reconciliationRequestMatches(existing, actorID, req) {
			if err := tx.Commit(); err != nil {
				return nil, false, err
			}
			return existing, true, nil
		}
		return nil, false, errResolutionConflict
	}
	if err != sql.ErrNoRows {
		return nil, false, err
	}

	var terminalResolution string
	err = tx.QueryRowContext(ctx, `
		SELECT resolution
		FROM contract_bound_action_reconciliation_events
		WHERE tenant_id = $1 AND task_id = $2
		  AND resolution IN ('confirmed_succeeded', 'confirmed_failed')
		LIMIT 1`,
		tenantID, taskID,
	).Scan(&terminalResolution)
	if err == nil {
		return nil, false, errResolutionConflict
	}
	if err != sql.ErrNoRows {
		return nil, false, err
	}

	var externalType, externalValue interface{}
	if req.ExternalReference != nil {
		externalType = req.ExternalReference.Type
		externalValue = req.ExternalReference.Value
	}
	row := tx.QueryRowContext(ctx, `
		INSERT INTO contract_bound_action_reconciliation_events (
			tenant_id, task_id, binding_id, contract_hash,
			target_action_id, target_version_hash, business_idempotency_digest,
			event_type, observed_effect_state, resolution,
			actor_type, actor_id, actor_email, reason,
			external_reference_type, external_reference_value, operator_request_id
		)
		SELECT r.tenant_id, r.task_id, r.binding_id, r.contract_hash,
		       r.target_action_id, r.target_version_hash,
		       encode(sha256(convert_to(r.business_idempotency_key, 'UTF8')), 'hex'),
		       'operator_resolution', 'unknown_effect_state', $3,
		       'operator', $4, NULLIF($5, ''), $6, $7, $8, $9
		FROM contract_bound_action_runs r
		WHERE r.tenant_id = $1 AND r.task_id = $2
		  AND EXISTS (
			SELECT 1
			FROM contract_bound_action_reconciliation_events observed
			WHERE observed.tenant_id = r.tenant_id
			  AND observed.task_id = r.task_id
			  AND observed.event_type = 'unresolved_effect_observed'
		  )
		RETURNING id, tenant_id, task_id, binding_id, contract_hash,
		          target_action_id, target_version_hash, business_idempotency_digest,
		          event_type, observed_effect_state, COALESCE(resolution, ''),
		          actor_type, actor_id, COALESCE(actor_email, ''), reason,
		          COALESCE(external_reference_type, ''), COALESCE(external_reference_value, ''),
		          COALESCE(target_host, ''), COALESCE(source_status_code, 0),
		          operator_request_id, created_at`,
		tenantID, taskID, req.Resolution, actorID, actorEmail, req.Reason,
		externalType, externalValue, requestID,
	)
	event, err := scanOperatorReconciliationEvent(row)
	if err == sql.ErrNoRows {
		return nil, false, errReconciliationNotRequired
	}
	if err != nil {
		lower := strings.ToLower(err.Error())
		if strings.Contains(lower, "terminal resolution") ||
			strings.Contains(lower, "duplicate key") {
			return nil, false, errResolutionConflict
		}
		if strings.Contains(lower, "reconciliation is not required") {
			return nil, false, errReconciliationNotRequired
		}
		return nil, false, err
	}
	if err := tx.Commit(); err != nil {
		return nil, false, err
	}
	return event, false, nil
}

func reconciliationRequestMatches(
	event *operatorReconciliationEvent,
	actorID string,
	req operatorReconciliationRequest,
) bool {
	if event == nil || event.ActorID != actorID || event.Resolution != req.Resolution ||
		event.Reason != req.Reason {
		return false
	}
	if req.ExternalReference == nil {
		return event.ExternalReferenceType == "" && event.ExternalReferenceValue == ""
	}
	return event.ExternalReferenceType == req.ExternalReference.Type &&
		event.ExternalReferenceValue == req.ExternalReference.Value
}

func loadOperatorReconciliationRequestEvent(
	ctx context.Context,
	tx *sql.Tx,
	tenantID string,
	taskID uuid.UUID,
	requestID uuid.UUID,
) (*operatorReconciliationEvent, error) {
	return scanOperatorReconciliationEvent(tx.QueryRowContext(ctx, `
		SELECT id, tenant_id, task_id, binding_id, contract_hash,
		       target_action_id, target_version_hash, business_idempotency_digest,
		       event_type, observed_effect_state, COALESCE(resolution, ''),
		       actor_type, actor_id, COALESCE(actor_email, ''), reason,
		       COALESCE(external_reference_type, ''), COALESCE(external_reference_value, ''),
		       COALESCE(target_host, ''), COALESCE(source_status_code, 0),
		       operator_request_id, created_at
		FROM contract_bound_action_reconciliation_events
		WHERE tenant_id = $1 AND task_id = $2 AND operator_request_id = $3`,
		tenantID, taskID, requestID,
	))
}

func loadOperatorReconciliationState(
	ctx context.Context,
	q reconciliationQuerier,
	tenantID string,
	taskID uuid.UUID,
) (*operatorReconciliationState, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT id, tenant_id, task_id, binding_id, contract_hash,
		       target_action_id, target_version_hash, business_idempotency_digest,
		       event_type, observed_effect_state, COALESCE(resolution, ''),
		       actor_type, actor_id, COALESCE(actor_email, ''), reason,
		       COALESCE(external_reference_type, ''), COALESCE(external_reference_value, ''),
		       COALESCE(target_host, ''), COALESCE(source_status_code, 0),
		       operator_request_id, created_at
		FROM contract_bound_action_reconciliation_events
		WHERE tenant_id = $1 AND task_id = $2
		ORDER BY
		  CASE WHEN event_type = 'unresolved_effect_observed' THEN 0 ELSE 1 END,
		  created_at, id`,
		tenantID, taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	state := &operatorReconciliationState{CurrentState: reconciliationRequired}
	terminalResolution := ""
	for rows.Next() {
		event, err := scanOperatorReconciliationEvent(rows)
		if err != nil {
			return nil, err
		}
		state.History = append(state.History, *event)
		if event.Resolution == reconciliationSucceeded || event.Resolution == reconciliationFailed {
			terminalResolution = event.Resolution
		} else if event.Resolution != "" && terminalResolution == "" {
			state.CurrentState = event.Resolution
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(state.History) == 0 || state.History[0].EventType != "unresolved_effect_observed" {
		return nil, sql.ErrNoRows
	}
	if terminalResolution != "" {
		state.CurrentState = terminalResolution
	}
	state.Required = state.CurrentState == reconciliationRequired ||
		state.CurrentState == reconciliationRemainsUnknown
	return state, nil
}

type reconciliationScanner interface {
	Scan(...interface{}) error
}

func scanOperatorReconciliationEvent(scanner reconciliationScanner) (*operatorReconciliationEvent, error) {
	var event operatorReconciliationEvent
	var requestID uuid.NullUUID
	err := scanner.Scan(
		&event.ID, &event.TenantID, &event.TaskID, &event.BindingID, &event.ContractHash,
		&event.TargetActionID, &event.TargetVersionHash, &event.BusinessIdempotencyDigest,
		&event.EventType, &event.ObservedEffectState, &event.Resolution,
		&event.ActorType, &event.ActorID, &event.ActorEmail, &event.Reason,
		&event.ExternalReferenceType, &event.ExternalReferenceValue,
		&event.TargetHost, &event.SourceStatusCode, &requestID, &event.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if requestID.Valid {
		value := requestID.UUID
		event.OperatorRequestID = &value
	}
	return &event, nil
}

func operatorReconciliationResponse(
	taskID uuid.UUID,
	state *operatorReconciliationState,
	includeActors bool,
) fiber.Map {
	resp := fiber.Map{
		"run_id":                  taskID.String(),
		"task_id":                 taskID.String(),
		"claim_type":              "operator_reconciliation",
		"cryptographic_proof":     false,
		"reconciliation_required": state.Required,
		"current_state":           state.CurrentState,
		"history_event_count":     len(state.History),
		"history":                 []fiber.Map{},
		"claim_boundary":          "operator-attested managed state; does not prove the external effect",
	}
	history := make([]fiber.Map, 0, len(state.History))
	for i := range state.History {
		history = append(history, operatorReconciliationEventResponse(&state.History[i], includeActors))
	}
	resp["history"] = history
	if len(state.History) > 0 {
		first := state.History[0]
		resp["contract_hash"] = first.ContractHash
		resp["binding_id"] = first.BindingID.String()
		resp["target_action_id"] = first.TargetActionID.String()
		resp["target_version_hash"] = first.TargetVersionHash
		resp["business_idempotency_digest"] = first.BusinessIdempotencyDigest
	}
	return resp
}

func operatorReconciliationEventResponse(event *operatorReconciliationEvent, includeActor bool) fiber.Map {
	resp := fiber.Map{
		"id":                    event.ID.String(),
		"event_type":            event.EventType,
		"observed_effect_state": event.ObservedEffectState,
		"reason":                event.Reason,
		"created_at":            event.CreatedAt.UTC(),
	}
	if event.Resolution != "" {
		resp["resolution"] = event.Resolution
	}
	if event.OperatorRequestID != nil {
		resp["request_id"] = event.OperatorRequestID.String()
	}
	if event.ExternalReferenceType != "" {
		resp["external_reference"] = fiber.Map{
			"type":  event.ExternalReferenceType,
			"value": event.ExternalReferenceValue,
		}
	}
	if event.TargetHost != "" {
		resp["target_host"] = event.TargetHost
	}
	if event.SourceStatusCode != 0 {
		resp["source_status_code"] = event.SourceStatusCode
	}
	if includeActor {
		resp["actor"] = fiber.Map{
			"type":  event.ActorType,
			"id":    event.ActorID,
			"email": event.ActorEmail,
		}
	}
	return resp
}

func reconciliationProofClaim(state *operatorReconciliationState, historyPath string) fiber.Map {
	claim := fiber.Map{
		"claim_type":              "operator_reconciliation",
		"claim_nature":            "operator_attestation",
		"cryptographic_proof":     false,
		"status":                  state.CurrentState,
		"reconciliation_required": state.Required,
		"history_event_count":     len(state.History),
		"history_path":            historyPath,
		"claim_boundary":          "operator assertion only; does not prove what occurred in the external system",
	}
	if state.CurrentState == reconciliationSucceeded ||
		state.CurrentState == reconciliationFailed ||
		state.CurrentState == reconciliationRemainsUnknown {
		claim["current_resolution"] = state.CurrentState
	}
	if len(state.History) > 0 {
		latest := state.History[len(state.History)-1]
		claim["latest_event_id"] = latest.ID.String()
		claim["latest_event_at"] = latest.CreatedAt.UTC()
	}
	return claim
}

func attachOperatorReconciliationProof(resp fiber.Map, state *operatorReconciliationState) {
	proof, ok := resp["igris_run_proof"].(fiber.Map)
	if !ok {
		return
	}
	runID, _ := proof["run_id"].(string)
	historyPath := fmt.Sprintf("/v1/actions/runs/%s/reconciliation", runID)
	claim := reconciliationProofClaim(state, historyPath)
	proof["operator_reconciliation"] = claim
	if statuses, ok := proof["statuses"].(fiber.Map); ok {
		statuses["reconciliation_status"] = state.CurrentState
	}
	if linked, ok := resp["linked_proof"].(fiber.Map); ok {
		linked["operator_reconciliation"] = claim
	}
	resp["reconciliation_required"] = state.Required
	resp["reconciliation_status"] = state.CurrentState
}
