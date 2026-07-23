package api

// Igris Run Proof (Clock 3C) — stable linked proof view for one contract-bound
// durable run.
//
// This is an operator/API representation that truthfully joins distinct claim
// types for the same durable run. It is NOT a new cryptographic protocol, NOT
// a universal Evidence object, and does NOT unify Action Protocol Evidence
// with Runtime receipts.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
)

const (
	igrisRunProofSchemaV1 = "igris_run_proof.v1"

	// Status vocabulary for machine-readable operator claims.
	statusObserved    = "observed"
	statusVerified    = "verified"
	statusPending     = "pending"
	statusUnavailable = "unavailable"
	statusNotLinked   = "not_linked"
	statusLinked      = "linked"
	statusRejected    = "rejected"
	statusUnknown     = "unknown"
	statusCompleted   = "completed"
	statusInProgress  = "in_progress"
	statusRequired    = "required"
	statusNotRequired = "not_required"
	statusFailed      = "failed"
	statusRecovering  = "recovering"
	statusNone        = "none"
	statusPresent     = "present"

	// Run linkage: strongest server-side eligibility without frozen protocol
	// run identity. "cryptographically_run_bound" is intentionally unused —
	// Action Protocol Evidence v1 has no run_id field.
	runLinkageNotApplicable  = "not_applicable"
	runLinkageNotLinked      = "not_linked"
	runLinkageEligibleLinked = "eligible_linked"
	runLinkageUnverified     = "unverified_for_run"
)

// igrisRunProofClaimBoundary documents that Runtime and Action Protocol
// claims remain distinct. Kept stable for operators and proof scripts.
func igrisRunProofClaimBoundary() fiber.Map {
	return fiber.Map{
		"action_protocol_evidence": "separate SDK-signed decision/outcome claim; does not prove managed Overture dispatch or Runtime recovery",
		"runtime_receipt":          "separate Runtime-signed managed execution claim; does not prove external side-effect uniqueness or Action Protocol chain validity",
		"operator_reconciliation":  "separate authenticated operator assertion over managed unresolved-effect state; not cryptographic proof of the external effect",
		"external_effect":          "neither cryptographic claim independently proves the external effect",
		"linked_view":              "Igris Run Proof joins claims for one durable run; it is not protocol-level cryptographic unification",
		"run_scoped_evidence":      "server eligibility requires tenant, action_name, contract_hash, decision input_hash match, exclusive batch/chain ownership; Evidence v1 has no run_id so identical tool inputs across different business keys cannot be cryptographically distinguished",
	}
}

type evidenceLinkEligibility struct {
	ChainDigest string
	BatchID     uuid.UUID
	InputHash   string
	ActionName  string
}

// extractBoundToolContext recovers action_name and the tool input identity
// digest from the durable task definition for a contract-bound run.
//
// For plaintext HTTP bodies, the digest is the canonical JSON SHA-256 of the
// tool kwargs (matching SDK Evidence decision.input_hash).
// For encrypted input refs (production Clock 3B path), the durable definition
// stores only a redacted placeholder; the server-computed input_digest_sha256
// on that placeholder is the same digest the Embedded adapter journals as
// input_hash, so it is the trustworthy run-scoped identity without decrypting.
func extractBoundToolContext(taskDefinition json.RawMessage) (actionName string, toolInputHash string, err error) {
	if len(taskDefinition) == 0 {
		return "", "", fmt.Errorf("empty task definition")
	}
	var def struct {
		Graph struct {
			Nodes []map[string]interface{} `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(taskDefinition, &def); err != nil {
		return "", "", fmt.Errorf("decode task definition: %w", err)
	}
	for _, node := range def.Graph.Nodes {
		toolName, _ := node["tool_name"].(string)
		nodeID, _ := node["node_id"].(string)
		if toolName != "http_request" {
			continue
		}
		if meta, ok := node["metadata"].(map[string]interface{}); ok {
			if name, ok := meta["action_name"].(string); ok && name != "" {
				actionName = name
			} else if name, ok := meta["action"].(string); ok && name != "" {
				actionName = name
			}
		}
		args, _ := node["args"].(map[string]interface{})
		if args == nil {
			continue
		}
		bodyRaw, ok := args["body"]
		if !ok {
			continue
		}
		hash, hashErr := toolInputHashFromHTTPBody(bodyRaw)
		if hashErr != nil {
			return actionName, "", hashErr
		}
		if hash == "" {
			continue
		}
		toolInputHash = hash
		if nodeID == "contract-bound-http-0" {
			return actionName, toolInputHash, nil
		}
	}
	if toolInputHash == "" {
		return actionName, "", fmt.Errorf("bound tool input not found in task definition")
	}
	return actionName, toolInputHash, nil
}

// toolInputHashFromHTTPBody derives the run-scoped tool input digest from a
// graph node body, which may be plaintext JSON or an encrypted-input-ref stub.
func toolInputHashFromHTTPBody(bodyRaw interface{}) (string, error) {
	// Encrypted input-ref placeholder (object form after JSON unmarshal).
	if bodyMap, ok := bodyRaw.(map[string]interface{}); ok {
		if isEncryptedInputRefStub(bodyMap) {
			digest, _ := bodyMap["input_digest_sha256"].(string)
			if !contractHashPattern.MatchString(digest) {
				return "", fmt.Errorf("encrypted input ref missing valid input_digest_sha256")
			}
			return digest, nil
		}
		// Plain object body (rare in stored definitions; usually a JSON string).
		normalizeCanonicalNumbers(bodyMap)
		canonical, err := canonicaljson.Encode(bodyMap)
		if err != nil {
			return "", fmt.Errorf("canonical tool body: %w", err)
		}
		return canonicaljson.SHA256Hex(canonical), nil
	}

	bodyStr := stringifyActionBody(bodyRaw)
	if strings.TrimSpace(bodyStr) == "" {
		return "", nil
	}
	toolInput, decErr := canonicaljson.DecodeObjectPreserving([]byte(bodyStr))
	if decErr != nil {
		return "", fmt.Errorf("decode tool body: %w", decErr)
	}
	if isEncryptedInputRefStub(toolInput) {
		digest, _ := toolInput["input_digest_sha256"].(string)
		if !contractHashPattern.MatchString(digest) {
			return "", fmt.Errorf("encrypted input ref missing valid input_digest_sha256")
		}
		return digest, nil
	}
	// Normalize json.Number integers so canonical bytes match Python ints.
	normalizeCanonicalNumbers(toolInput)
	canonical, encErr := canonicaljson.Encode(toolInput)
	if encErr != nil {
		return "", fmt.Errorf("canonical tool body: %w", encErr)
	}
	return canonicaljson.SHA256Hex(canonical), nil
}

func isEncryptedInputRefStub(body map[string]interface{}) bool {
	if body == nil {
		return false
	}
	if flag, ok := body["encrypted_input_ref"].(bool); ok && flag {
		return true
	}
	// Redacted inspection form uses input_redacted + digest without plaintext.
	if redacted, ok := body["input_redacted"].(bool); ok && redacted {
		if digest, _ := body["input_digest_sha256"].(string); contractHashPattern.MatchString(digest) {
			return true
		}
	}
	return false
}

func normalizeCanonicalNumbers(v interface{}) {
	switch t := v.(type) {
	case map[string]interface{}:
		for k, child := range t {
			switch n := child.(type) {
			case json.Number:
				if i, err := n.Int64(); err == nil {
					t[k] = i
				} else if f, err := n.Float64(); err == nil {
					t[k] = f
				}
			default:
				normalizeCanonicalNumbers(child)
			}
		}
	case []interface{}:
		for i, child := range t {
			switch n := child.(type) {
			case json.Number:
				if iv, err := n.Int64(); err == nil {
					t[i] = iv
				} else if f, err := n.Float64(); err == nil {
					t[i] = f
				}
			default:
				normalizeCanonicalNumbers(child)
			}
		}
	}
}

// evaluateEvidenceLinkEligibility fails closed unless the batch is verified
// Embedded evidence for this tenant, action, contract, and tool input, and is
// not already exclusively linked to a different run.
func evaluateEvidenceLinkEligibility(
	ctx context.Context,
	db *sql.DB,
	tenantID string,
	taskID uuid.UUID,
	bound *coordinator.BoundActionRunIdentity,
	taskDefinition json.RawMessage,
	batchID uuid.UUID,
) (*evidenceLinkEligibility, error) {
	if bound == nil {
		return nil, errEvidenceNotLinkable("contract_bound_run_required")
	}
	actionName, toolInputHash, err := extractBoundToolContext(taskDefinition)
	if err != nil || actionName == "" || !contractHashPattern.MatchString(toolInputHash) {
		return nil, errEvidenceNotLinkable("bound_run_tool_identity_unproven")
	}
	if !contractHashPattern.MatchString(bound.ContractHash) {
		return nil, errEvidenceNotLinkable("invalid_bound_contract_hash")
	}

	var chainDigest string
	var foundBatch uuid.UUID
	err = db.QueryRowContext(ctx, `
		SELECT b.id, b.chain_head
		FROM sdk_evidence_batches b
		WHERE b.id = $1
		  AND b.tenant_id = $2
		  AND b.evidence_state = 'verified'
		  AND b.execution_provenance = 'embedded'
		  AND b.chain_head IS NOT NULL
		  AND EXISTS (
			SELECT 1 FROM sdk_evidence_events e
			WHERE e.batch_id = b.id
			  AND e.tenant_id = b.tenant_id
			  AND e.contract_hash = $3
			  AND e.action_name = $4
			  AND e.event_type = 'decision'
			  AND e.event->>'input_hash' = $5
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM contract_bound_action_evidence_links l
			WHERE l.tenant_id = b.tenant_id
			  AND (
				l.evidence_batch_id = b.id
				OR l.evidence_chain_digest = b.chain_head
			  )
			  AND l.task_id <> $6
		  )`,
		batchID, tenantID, bound.ContractHash, actionName, toolInputHash, taskID,
	).Scan(&foundBatch, &chainDigest)
	if err == sql.ErrNoRows {
		return nil, errEvidenceNotLinkable("batch must be verified Embedded evidence for this exact run identity (tenant, action_name, contract_hash, tool input_hash) and must not be linked to another run")
	}
	if err != nil {
		return nil, fmt.Errorf("evidence eligibility query: %w", err)
	}
	if !contractHashPattern.MatchString(chainDigest) {
		return nil, errEvidenceNotLinkable("invalid_chain_digest")
	}
	return &evidenceLinkEligibility{
		ChainDigest: chainDigest,
		BatchID:     foundBatch,
		InputHash:   toolInputHash,
		ActionName:  actionName,
	}, nil
}

type evidenceNotLinkableError struct {
	message string
}

func (e *evidenceNotLinkableError) Error() string { return e.message }

func errEvidenceNotLinkable(message string) error {
	return &evidenceNotLinkableError{message: message}
}

func isEvidenceNotLinkable(err error) bool {
	var target *evidenceNotLinkableError
	return errors.As(err, &target)
}

func managedDecisionStatus(task *coordinator.TaskRecord) string {
	if task == nil {
		return statusUnknown
	}
	switch task.Status {
	case coordinator.TaskStatusApprovalRequired:
		return statusRequired
	case coordinator.TaskStatusFailed:
		if task.FailureReason != nil && strings.Contains(strings.ToLower(*task.FailureReason), "den") {
			return statusRejected
		}
		// Failed after dispatch is not a managed-decision denial.
		return statusObserved
	case coordinator.TaskStatusCanceled:
		return statusRejected
	case coordinator.TaskStatusPending, coordinator.TaskStatusDispatched,
		coordinator.TaskStatusCheckpointed, coordinator.TaskStatusCompleted,
		coordinator.TaskStatusRecovering:
		return statusObserved
	default:
		return statusUnknown
	}
}

func durableExecutionStatus(task *coordinator.TaskRecord) string {
	if task == nil {
		return statusUnknown
	}
	switch task.Status {
	case coordinator.TaskStatusCompleted:
		return statusCompleted
	case coordinator.TaskStatusFailed, coordinator.TaskStatusCanceled:
		return statusFailed
	case coordinator.TaskStatusRecovering:
		return statusRecovering
	case coordinator.TaskStatusApprovalRequired:
		return statusPending
	case coordinator.TaskStatusPending, coordinator.TaskStatusDispatched, coordinator.TaskStatusCheckpointed:
		return statusInProgress
	default:
		return statusUnknown
	}
}

func recoveryStatus(task *coordinator.TaskRecord, events []coordinator.RecoveryEvent, handoff *coordinator.RuntimeHandoffEvent) string {
	if task == nil {
		return statusUnknown
	}
	if task.Status == coordinator.TaskStatusRecovering {
		return statusRecovering
	}
	if len(events) > 0 || handoff != nil {
		if task.Status == coordinator.TaskStatusCompleted {
			return statusCompleted
		}
		return statusPresent
	}
	if task.Status == coordinator.TaskStatusCompleted || task.Status == coordinator.TaskStatusFailed {
		return statusNone
	}
	return statusNone
}

func runtimeProofStatus(task *coordinator.TaskRecord) string {
	if task == nil || task.Proof == nil {
		return statusUnavailable
	}
	if task.Proof.Status != "" {
		return task.Proof.Status
	}
	if task.Proof.Verified != nil && *task.Proof.Verified {
		return statusVerified
	}
	return statusPending
}

// attachIgrisRunProof enriches a bound-run response with the stable
// igris_run_proof.v1 contract while preserving Clock 3B linked_proof fields.
func attachIgrisRunProof(
	resp fiber.Map,
	task *coordinator.TaskRecord,
	link *actionEvidenceLink,
	recovery []coordinator.RecoveryEvent,
	handoff *coordinator.RuntimeHandoffEvent,
) {
	if task == nil || task.BoundAction == nil {
		return
	}
	bound := task.BoundAction
	actionName, toolInputHash, _ := extractBoundToolContext(task.TaskDefinition)

	rtStatus := runtimeProofStatus(task)
	executionID := ""
	if task.Proof != nil {
		executionID = task.Proof.ExecutionID
	}

	actionEvidenceStatus := statusNotLinked
	actionEvidenceVerification := statusUnavailable
	runLinkage := runLinkageNotLinked
	var actionEvidence fiber.Map
	if link != nil {
		actionEvidenceStatus = statusLinked
		actionEvidenceVerification = statusVerified
		runLinkage = runLinkageEligibleLinked
		actionEvidence = fiber.Map{
			"batch_id":             link.BatchID.String(),
			"chain_head_digest":    link.ChainDigest,
			"verification":         "verified Embedded Action Protocol evidence",
			"verification_status":  statusVerified,
			"claim_type":           "action_protocol_evidence",
			"execution_provenance": "embedded",
			"run_eligibility":      "server_rules_matched",
		}
	}

	proof := fiber.Map{
		"schema":                   igrisRunProofSchemaV1,
		"product_term":             "Igris Run Proof",
		"run_id":                   task.TaskID.String(),
		"task_id":                  task.TaskID.String(),
		"action_name":              actionName,
		"contract_hash":            bound.ContractHash,
		"binding_id":               bound.BindingID.String(),
		"target_action_id":         bound.TargetActionID.String(),
		"target_version":           bound.TargetVersionHash,
		"target_version_hash":      bound.TargetVersionHash,
		"business_idempotency_key": bound.BusinessIdempotencyKey,
		"request_fingerprint":      bound.RequestFingerprint,
		"tool_input_hash":          toolInputHash,
		"runtime_execution_id":     executionID,
		"statuses": fiber.Map{
			"contract_binding_status":             statusPresent,
			"managed_decision_status":             managedDecisionStatus(task),
			"execution_status":                    durableExecutionStatus(task),
			"recovery_status":                     recoveryStatus(task, recovery, handoff),
			"runtime_proof_status":                rtStatus,
			"action_evidence_status":              actionEvidenceStatus,
			"action_evidence_verification_status": actionEvidenceVerification,
			"run_linkage_status":                  runLinkage,
		},
		"claim_boundary": igrisRunProofClaimBoundary(),
		"runtime_proof": fiber.Map{
			"claim_type":          "runtime_receipt",
			"execution_id":        executionID,
			"status":              rtStatus,
			"verification_status": rtStatus,
		},
	}
	if actionEvidence != nil {
		proof["action_protocol_evidence"] = actionEvidence
	} else {
		proof["action_protocol_evidence"] = fiber.Map{
			"status":              statusNotLinked,
			"verification_status": statusUnavailable,
			"claim_type":          "action_protocol_evidence",
		}
	}
	if recovery != nil {
		proof["recovery_lineage"] = recovery
	} else {
		proof["recovery_lineage"] = []coordinator.RecoveryEvent{}
	}
	if handoff != nil {
		proof["latest_runtime_handoff"] = handoff
	}

	// Stable top-level contract for operators and future clients.
	resp["igris_run_proof"] = proof

	// Backwards-compatible linked_proof view (Clock 3B + additive fields).
	linked := fiber.Map{
		"schema":                   igrisRunProofSchemaV1,
		"product_term":             "Igris Run Proof",
		"claim_boundary":           igrisRunProofClaimBoundary(),
		"contract_hash":            bound.ContractHash,
		"binding_id":               bound.BindingID.String(),
		"task_id":                  task.TaskID.String(),
		"run_id":                   task.TaskID.String(),
		"action_name":              actionName,
		"target_action_id":         bound.TargetActionID.String(),
		"target_version":           bound.TargetVersionHash,
		"business_idempotency_key": bound.BusinessIdempotencyKey,
		"runtime_execution_id":     executionID,
		"statuses":                 proof["statuses"],
		"runtime_proof": fiber.Map{
			"execution_id":        executionID,
			"status":              rtStatus,
			"verification_status": rtStatus,
			"claim_type":          "runtime_receipt",
		},
		"recovery_lineage": proof["recovery_lineage"],
	}
	if actionEvidence != nil {
		linked["action_protocol_evidence"] = actionEvidence
	}
	if handoff != nil {
		linked["latest_runtime_handoff"] = handoff
	}
	resp["linked_proof"] = linked

	// Surface key identities at the top level for operators without nesting.
	if _, ok := resp["action_name"]; !ok && actionName != "" {
		resp["action_name"] = actionName
	}
	resp["durable_execution_status"] = durableExecutionStatus(task)
	resp["managed_decision_status"] = managedDecisionStatus(task)
	resp["recovery_status"] = recoveryStatus(task, recovery, handoff)
	resp["run_linkage_status"] = runLinkage
}

// insertEvidenceLinkExclusive appends an immutable evidence link. Conflicts
// on the same (tenant, task, digest) replay the existing row. Conflicts from
// exclusive batch/chain ownership on another run fail closed.
func insertEvidenceLinkExclusive(
	ctx context.Context,
	db *sql.DB,
	taskID uuid.UUID,
	tenantID string,
	elig *evidenceLinkEligibility,
) (*actionEvidenceLink, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	// Serialize concurrent link attempts for the same batch within a tenant.
	var conflictTask sql.NullString
	err = tx.QueryRowContext(ctx, `
		SELECT task_id::text
		FROM contract_bound_action_evidence_links
		WHERE tenant_id = $1
		  AND (evidence_batch_id = $2 OR evidence_chain_digest = $3)
		  AND task_id <> $4
		LIMIT 1
		FOR SHARE`,
		tenantID, elig.BatchID, elig.ChainDigest, taskID,
	).Scan(&conflictTask)
	if err == nil && conflictTask.Valid {
		return nil, errEvidenceNotLinkable("evidence batch or chain already linked to another run")
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	var link actionEvidenceLink
	err = tx.QueryRowContext(ctx, `
		INSERT INTO contract_bound_action_evidence_links (
			task_id, tenant_id, evidence_chain_digest, evidence_batch_id
		) VALUES ($1,$2,$3,$4)
		ON CONFLICT (tenant_id, task_id, evidence_chain_digest) DO NOTHING
		RETURNING id, evidence_batch_id, evidence_chain_digest, created_at`,
		taskID, tenantID, elig.ChainDigest, elig.BatchID,
	).Scan(&link.ID, &link.BatchID, &link.ChainDigest, &link.CreatedAt)
	if err == sql.ErrNoRows {
		// Idempotent replay of the same link for this run.
		existing, loadErr := loadActionEvidenceLinkTx(ctx, tx, taskID, tenantID)
		if loadErr != nil {
			return nil, loadErr
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return existing, nil
	}
	if err != nil {
		// Unique violation on exclusive indexes → conflict with another run.
		if strings.Contains(strings.ToLower(err.Error()), "unique") ||
			strings.Contains(err.Error(), "duplicate key") {
			return nil, errEvidenceNotLinkable("evidence batch or chain already linked to another run")
		}
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &link, nil
}

func loadActionEvidenceLinkTx(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...interface{}) *sql.Row
}, taskID uuid.UUID, tenantID string) (*actionEvidenceLink, error) {
	var link actionEvidenceLink
	err := q.QueryRowContext(ctx, `
		SELECT id, evidence_batch_id, evidence_chain_digest, created_at
		FROM contract_bound_action_evidence_links
		WHERE task_id = $1 AND tenant_id = $2
		ORDER BY created_at DESC
		LIMIT 1`,
		taskID, tenantID,
	).Scan(&link.ID, &link.BatchID, &link.ChainDigest, &link.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &link, nil
}
