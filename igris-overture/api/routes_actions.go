package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/agentregistry"
	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// Execution target vocabulary for the unified Action model (Slice 1).
//
// These are not separate products. They are the surfaces a single Igris
// Action can run on. `actionTargetAPIDeprecated` is the legacy alias for
// `actionTargetHostedAPI` that existed before vocabulary normalization;
// it is accepted on input and rewritten to the canonical form, but it is
// never the preferred product term.
const (
	actionTargetHostedAPI      = "hosted_api"
	actionTargetWebhook        = "webhook"
	actionTargetLocalRuntime   = "local_runtime"
	actionTargetHybridFallback = "hybrid_fallback"
	actionTargetMockDemo       = "mock_demo"
	actionTargetAPIDeprecated  = "api"
)

// canonicalActionTargetType normalizes legacy aliases (currently only `api`)
// to the canonical execution target vocabulary. Unknown values are returned
// unchanged so the caller's validation step can report a precise error.
func canonicalActionTargetType(targetType string) string {
	t := strings.TrimSpace(targetType)
	if t == actionTargetAPIDeprecated {
		return actionTargetHostedAPI
	}
	return t
}

type actionRunRequest struct {
	ActionID       string                 `json:"action_id,omitempty"`
	ID             string                 `json:"id,omitempty"`
	Action         string                 `json:"action"`
	Name           string                 `json:"name,omitempty"`
	ActionName     string                 `json:"action_name,omitempty"`
	Input          map[string]interface{} `json:"input"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	RuntimeTarget  string                 `json:"runtime_target,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	DeadlineAt     *time.Time             `json:"deadline_at,omitempty"`
	AgentID        string                 `json:"agent_id,omitempty"`
	AgentName      string                 `json:"agent_name,omitempty"`

	// Internal-only fields populated by the gateway from the registered Action
	// definition. Unexported so encoding/json cannot read or write them —
	// customer payloads cannot spoof which target the gateway selects.
	executedTarget     string
	preferredRuntimeID string
	boundAction        *coordinator.BoundActionRunIdentity
}

// actionFallbackPolicy describes how an Action may fall back from a primary
// execution target to a secondary one. Fallback is always explicit; the
// resolver in a later slice will refuse to silently switch surfaces.
//
// `Enabled` defaults to false. For `hybrid_fallback` actions, the create/patch
// path requires `Enabled = true` plus a primary and secondary target. The
// resolver itself is not implemented in this slice — only the model.
type actionFallbackPolicy struct {
	Enabled            bool     `json:"enabled"`
	PrimaryTarget      string   `json:"primary_target,omitempty"`
	SecondaryTarget    string   `json:"secondary_target,omitempty"`
	AllowedTargets     []string `json:"allowed_targets,omitempty"`
	RequiresReplaySafe bool     `json:"requires_replay_safe"`
	MaxAttempts        int      `json:"max_attempts,omitempty"`
}

type actionDefinition struct {
	ID               string                 `json:"id"`
	TenantID         string                 `json:"-"`
	Name             string                 `json:"name"`
	DisplayName      string                 `json:"display_name"`
	Description      string                 `json:"description"`
	TargetType       string                 `json:"target_type"`
	TargetURL        string                 `json:"target_url"`
	Method           string                 `json:"method"`
	PolicyPreset     string                 `json:"policy_preset"`
	ReplayClass      string                 `json:"replay_class"`
	ApprovalRequired bool                   `json:"approval_required"`
	Irreversible     bool                   `json:"irreversible"`
	SecretRefs       []string               `json:"secret_refs"`
	TargetMetadata   map[string]interface{} `json:"target_metadata,omitempty"`
	FallbackPolicy   actionFallbackPolicy   `json:"fallback_policy"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	ArchivedAt       *time.Time             `json:"archived_at,omitempty"`
}

type actionDefinitionRequest struct {
	Name             string                 `json:"name"`
	DisplayName      string                 `json:"display_name"`
	Description      string                 `json:"description"`
	TargetType       string                 `json:"target_type"`
	TargetURL        string                 `json:"target_url"`
	Method           string                 `json:"method"`
	PolicyPreset     string                 `json:"policy_preset"`
	ReplayClass      string                 `json:"replay_class"`
	ApprovalRequired *bool                  `json:"approval_required"`
	Irreversible     *bool                  `json:"irreversible"`
	SecretRefs       []string               `json:"secret_refs"`
	TargetMetadata   map[string]interface{} `json:"target_metadata"`
	FallbackPolicy   *actionFallbackPolicy  `json:"fallback_policy"`
}

type actionRunByNameRequest struct {
	Input          map[string]interface{} `json:"input"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	ContractHash   string                 `json:"contract_hash,omitempty"`
	DeadlineAt     *time.Time             `json:"deadline_at,omitempty"`
	AgentID        string                 `json:"agent_id,omitempty"`
	AgentName      string                 `json:"agent_name,omitempty"`
}

var actionNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_.]{1,63}$`)
var localWebhookAuthHeaderPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)
var localWebhookSecretEnvPattern = regexp.MustCompile(`^IGRIS_[A-Z0-9_]{1,96}$`)

const (
	localWebhookAuthHeaderNameMetadata = "local_auth_header_name"
	localWebhookAuthSecretEnvMetadata  = "local_auth_secret_env"
)

// RegisterActionRoutes wires the product-facing action gateway. These routes
// adapt customer action calls onto the same durable task path used by /v1/tasks.
func RegisterActionRoutes(app *fiber.App, db *sql.DB, tc *coordinator.TaskCoordinator) {
	RegisterActionPackRoutes(app, db)

	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))

	v1.Get("", handleActionList(db))
	v1.Post("", handleActionCreate(db))
	v1.Post("/run", handleActionRun(db, tc))
	v1.Get("/runs/:id", handleActionGetRun(tc))
	v1.Get("/runs/:id/reconciliation", handleActionReconciliationGet(db, tc))
	v1.Post("/runs/:id/reconciliation", handleActionReconciliationAppend(db, tc))
	v1.Post("/runs/:id/evidence-links", handleActionEvidenceLinkCreate(db, tc))
	v1.Post("/runs/:id/approve", handleActionApproveRun(tc))
	v1.Post("/runs/:id/reject", handleActionRejectRun(tc))
	v1.Post("/:name/run", handleActionRunByName(db, tc))
	v1.Get("/:id", handleActionGet(db))
	v1.Patch("/:id", handleActionPatch(db))
	v1.Delete("/:id", handleActionArchive(db))
}

func handleActionRun(db *sql.DB, tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		var req actionRunRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}

		def, err := loadActionDefinitionForRun(c.Context(), db, tenantID, req)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			if strings.Contains(err.Error(), "action_id or action_name is required") {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":   "action_required",
					"message": "action_id or action_name is required",
				})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		runReq, err := buildActionRunRequestFromDefinition(def, actionRunByNameRequest{
			Input:          req.Input,
			Metadata:       req.Metadata,
			IdempotencyKey: req.IdempotencyKey,
			DeadlineAt:     req.DeadlineAt,
			AgentID:        req.AgentID,
			AgentName:      req.AgentName,
		})
		if err != nil {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "target_not_configured",
				"message": err.Error(),
			})
		}
		if runReq.executedTarget == actionTargetLocalRuntime {
			if !tenantHasHealthyRuntime(c.Context(), db, tenantID, runReq.preferredRuntimeID) {
				return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
					"error":   "runtime_unavailable",
					"message": "no connected runtime is available to execute this local_runtime action; install or reconnect a runtime and retry",
				})
			}
		}
		return submitActionRun(c, db, tc, tenantID, runReq, &def)
	}
}

func handleActionRunByName(db *sql.DB, tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		name := strings.TrimSpace(c.Params("name"))
		if !validActionName(name) {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_name"})
		}
		def, err := loadActionDefinitionByName(c.Context(), db, tenantID, name)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error":   "action_not_found",
				"message": "No action with that name is configured.",
			})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		var req actionRunByNameRequest
		if len(c.Body()) > 0 {
			if err := json.Unmarshal(c.Body(), &req); err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
			}
		}
		if strings.TrimSpace(req.ContractHash) != "" {
			hash := strings.TrimSpace(req.ContractHash)
			if !contractHashPattern.MatchString(hash) {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_contract_hash"})
			}
			if !contractIdempotencyKeyPattern.MatchString(strings.TrimSpace(req.IdempotencyKey)) {
				return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":   "idempotency_key_required",
					"message": "contract-bound durable runs require a 1-128 character idempotency_key",
				})
			}
			binding, err := getContractExecutionBinding(c.Context(), db, tenantID, name, hash)
			if err == sql.ErrNoRows {
				return c.Status(http.StatusConflict).JSON(fiber.Map{
					"error":   "binding_required",
					"message": "the exact contract version has no execution binding",
				})
			}
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			version, err := getContractVersion(c.Context(), db, tenantID, name, hash)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			runReq, targetDef, err := buildBoundActionRunRequest(binding, version, req)
			if err != nil {
				return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
					"error": "invalid_bound_action_request", "message": err.Error(),
				})
			}
			if !tenantHasHealthyRuntime(c.Context(), db, tenantID, runReq.preferredRuntimeID) {
				return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
					"error":   "runtime_unavailable",
					"message": "no connected runtime is available to execute this contract-bound local Action; install or reconnect a runtime and retry",
				})
			}
			return submitActionRun(c, db, tc, tenantID, runReq, &targetDef)
		}
		runReq, err := buildActionRunRequestFromDefinition(def, req)
		if err != nil {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "target_not_configured",
				"message": err.Error(),
			})
		}
		if runReq.executedTarget == actionTargetLocalRuntime {
			if !tenantHasHealthyRuntime(c.Context(), db, tenantID, runReq.preferredRuntimeID) {
				return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
					"error":   "runtime_unavailable",
					"message": "no connected runtime is available to execute this local_runtime action; install or reconnect a runtime and retry",
				})
			}
		}
		return submitActionRun(c, db, tc, tenantID, runReq, &def)
	}
}

// tenantHasHealthyRuntime confirms the tenant has at least one healthy,
// recently-heartbeated runtime — and, if preferredRuntimeID is set, that the
// specific runtime is the one available. The query mirrors selectRuntime so
// the pre-flight and dispatch see the same world. A negative result means the
// gateway must refuse with a clear runtime_unavailable rather than enqueueing
// a task that will fail to dispatch.
func tenantHasHealthyRuntime(ctx context.Context, db *sql.DB, tenantID, preferredRuntimeID string) bool {
	if db == nil || tenantID == "" {
		return false
	}
	preferredRuntimeID = strings.TrimSpace(preferredRuntimeID)
	query := `
		SELECT endpoint
		FROM runtime_instances
		WHERE tenant_id = $1
		  AND is_healthy = true
		  AND status = 'active'
		  AND endpoint IS NOT NULL
		  AND BTRIM(endpoint) <> ''
		  AND last_heartbeat > NOW() - INTERVAL '90 seconds'`
	args := []interface{}{tenantID}
	if preferredRuntimeID != "" {
		query += ` AND runtime_id = $2`
		args = append(args, preferredRuntimeID)
	}
	query += ` LIMIT 10`
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Actions] runtime availability check failed")
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var endpoint string
		if err := rows.Scan(&endpoint); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Actions] runtime availability scan failed")
			return false
		}
		if internal.IsRoutableHTTPRuntimeEndpoint(endpoint) {
			return true
		}
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Actions] runtime availability rows failed")
	}
	return false
}

func submitActionRun(c *fiber.Ctx, db *sql.DB, tc *coordinator.TaskCoordinator, tenantID string, req actionRunRequest, def *actionDefinition) error {
	resolved, err := resolveActionRunAgent(c.Context(), db, tenantID, req.AgentID, req.AgentName)
	if err != nil {
		status := statusForAgentResolveErr(err)
		return c.Status(status).JSON(fiber.Map{
			"error":   "agent_not_found",
			"message": "registered agent not found",
		})
	}
	taskReq, err := buildActionTaskSubmitRequest(req, tenantID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_action_request",
			"message": err.Error(),
		})
	}
	applyResolvedAgentToTaskRequest(taskReq, resolved)

	var task *coordinator.TaskRecord
	if mockDemoFailOnceFirstAttempt(def, req) {
		task, err = tc.SubmitDemoSimulatedFailure(
			c.Context(),
			taskReq,
			"demo.fail_once simulated failure on first attempt; retry with input.retry=true or a new idempotency key",
		)
	} else {
		task, err = tc.Submit(c.Context(), taskReq)
	}
	if err != nil {
		if errors.Is(err, coordinator.ErrTaskIdempotencyConflict) {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "idempotency_key_conflict",
				"message": "this idempotency key is already bound to a different request",
			})
		}
		if errors.Is(err, coordinator.ErrTaskCapabilityDenied) {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{
				"error":   "policy_denied",
				"message": err.Error(),
			})
		}
		if errors.Is(err, coordinator.ErrInvalidTaskDefinition) {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_action_request",
				"message": err.Error(),
			})
		}
		if errors.Is(err, coordinator.ErrExecutionInputProtectionUnavailable) {
			return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   "input_protection_unavailable",
				"message": "this action's input requires encrypted input protection, but the input-ref keyring is not configured or failed; set IGRIS_EXECUTION_INPUT_REF_KEYS and IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION",
			})
		}
		log.Error().Err(err).Str("tenant_id", tenantID).Str("action", req.Action).Msg("[Actions] Run failed")
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "runtime_unavailable",
			"message": "no runtime was available to accept the action",
		})
	}
	if req.boundAction != nil {
		task.BoundAction = req.boundAction
	}

	// Stamp executed_target once a real execution target has been selected.
	// For local_runtime this is what proves the action ran on the customer's
	// connected runtime rather than a hosted surface. Approval-pending tasks
	// still belong to the chosen target — stamping is safe because policy
	// denial would have errored above before reaching this point.
	if req.executedTarget != "" {
		if err := tc.Store().StampExecutedTarget(task.TaskID, tenantID, req.executedTarget); err != nil {
			log.Warn().Err(err).Str("task_id", task.TaskID.String()).Msg("[Actions] stamp executed_target failed")
		}
	}

	status := http.StatusAccepted
	if task.Status == coordinator.TaskStatusApprovalRequired {
		status = http.StatusConflict
	}
	resp := buildActionRunResponse(task, resolved)
	if def != nil {
		resp["action_name"] = def.Name
		resp["target_type"] = def.TargetType
	}
	if req.executedTarget != "" {
		resp["selected_target"] = req.executedTarget
	}
	if task.RuntimeID != nil && *task.RuntimeID != "" {
		resp["runtime_id"] = *task.RuntimeID
	}
	return c.Status(status).JSON(resp)
}

func handleActionGetRun(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_run_id"})
		}
		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if coordinator.TaskProofNeedsReadReconciliation(task.Proof, time.Now().UTC()) {
			if proof, err := tc.Store().SyncTaskProofState(taskID, tenantID); err == nil {
				task.Proof = proof
			}
		}
		if bound, err := tc.Store().GetBoundActionRun(c.Context(), taskID, tenantID); err == nil {
			task.BoundAction = bound
		} else if err != sql.ErrNoRows {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		resp := buildActionRunResponse(task, nil)
		if task.BoundAction != nil {
			var link *actionEvidenceLink
			if loaded, err := loadActionEvidenceLink(c.Context(), tc.Store().DB(), taskID, tenantID); err == nil {
				link = loaded
			} else if err != sql.ErrNoRows {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			var recovery []coordinator.RecoveryEvent
			if events, err := tc.Store().ListRecoveryEvents(tenantID, taskID); err == nil {
				recovery = events
			} else {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			var handoff *coordinator.RuntimeHandoffEvent
			if event, err := tc.Store().LatestRuntimeHandoffEvent(tenantID, taskID); err == nil {
				handoff = event
			} else if err != sql.ErrNoRows {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			attachIgrisRunProof(resp, task, link, recovery, handoff)
			reconciliation := &operatorReconciliationState{
				Required:     false,
				CurrentState: statusNotRequired,
			}
			if coordinator.IsTypedReconciliationFailure(task.FailureDetails) {
				loaded, err := loadOperatorReconciliationState(
					c.Context(), tc.Store().DB(), tenantID, taskID,
				)
				if err == nil {
					reconciliation = loaded
				} else if err == sql.ErrNoRows {
					// A typed Runtime signal alone is not managed eligibility.
					// Without the immutable initial observation, fail closed.
					reconciliation.CurrentState = statusUnavailable
				} else {
					return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
				}
			}
			attachOperatorReconciliationProof(resp, reconciliation)
		}
		return c.JSON(resp)
	}
}

type actionEvidenceLink struct {
	ID          uuid.UUID
	BatchID     uuid.UUID
	ChainDigest string
	CreatedAt   time.Time
}

func handleActionEvidenceLinkCreate(db *sql.DB, tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_run_id"})
		}
		// Tenant-scoped bound-run load prevents IDOR across runs/tenants.
		bound, err := tc.Store().GetBoundActionRun(c.Context(), taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "contract_bound_run_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		task.BoundAction = bound

		var request struct {
			BatchID string `json:"batch_id"`
		}
		if err := json.Unmarshal(c.Body(), &request); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		batchID, err := uuid.Parse(strings.TrimSpace(request.BatchID))
		if err != nil {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "invalid_batch_id"})
		}

		// Fail closed: eligibility requires tenant, action_name, contract_hash,
		// decision input_hash match for this run, and exclusive batch/chain ownership.
		elig, err := evaluateEvidenceLinkEligibility(
			c.Context(), db, tenantID, taskID, bound, task.TaskDefinition, batchID,
		)
		if isEvidenceNotLinkable(err) {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "evidence_not_linkable",
				"message": err.Error(),
			})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		link, err := insertEvidenceLinkExclusive(c.Context(), db, taskID, tenantID, elig)
		if isEvidenceNotLinkable(err) {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "evidence_not_linkable",
				"message": err.Error(),
			})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(fiber.Map{
			"id":                    link.ID.String(),
			"task_id":               taskID.String(),
			"run_id":                taskID.String(),
			"contract_hash":         bound.ContractHash,
			"binding_id":            bound.BindingID.String(),
			"evidence_batch_id":     link.BatchID.String(),
			"evidence_chain_digest": link.ChainDigest,
			"claim_type":            "action_protocol_evidence",
			"execution_provenance":  "embedded",
			"run_linkage_status":    runLinkageEligibleLinked,
			"tool_input_hash":       elig.InputHash,
			"action_name":           elig.ActionName,
			"schema":                igrisRunProofSchemaV1,
		})
	}
}

func loadActionEvidenceLink(ctx context.Context, db *sql.DB, taskID uuid.UUID, tenantID string) (*actionEvidenceLink, error) {
	var link actionEvidenceLink
	err := db.QueryRowContext(ctx, `
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

// handleActionApproveRun approves an approval_required durable action run and
// dispatches it through the coordinator/runtime path. Approval is a real two-way
// gate: the coordinator enforces tenant ownership, the awaiting-approval
// precondition, and an atomic claim that prevents a second approval from
// dispatching the same run twice.
func handleActionApproveRun(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_run_id"})
		}
		approver := actionApproverIdentity(c, tenantID)
		task, err := tc.ApproveTask(c.Context(), taskID, tenantID, approver)
		if err != nil {
			return actionApprovalErrorResponse(c, err)
		}
		resp := buildActionRunResponse(task, nil)
		resp["decision"] = "approved"
		resp["approved_by"] = approver
		return c.Status(http.StatusAccepted).JSON(resp)
	}
}

// handleActionRejectRun rejects an approval_required durable action run. A
// rejected run is marked terminal and is never dispatched.
func handleActionRejectRun(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_run_id"})
		}
		var body struct {
			Reason string `json:"reason"`
		}
		if len(c.Body()) > 0 {
			if err := json.Unmarshal(c.Body(), &body); err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
			}
		}
		rejector := actionApproverIdentity(c, tenantID)
		task, err := tc.RejectTask(c.Context(), taskID, tenantID, rejector, body.Reason)
		if err != nil {
			return actionApprovalErrorResponse(c, err)
		}
		resp := buildActionRunResponse(task, nil)
		resp["decision"] = "rejected"
		resp["rejected_by"] = rejector
		resp["dispatched"] = false
		return c.JSON(resp)
	}
}

// actionApproverIdentity returns the authenticated principal recorded as the
// approver/rejector. Under BetterAuth the tenant id is the user id.
func actionApproverIdentity(c *fiber.Ctx, tenantID string) string {
	if principal := strings.TrimSpace(middleware.GetClerkUserID(c)); principal != "" {
		return principal
	}
	return tenantID
}

// actionApprovalErrorResponse maps coordinator approval errors to HTTP codes.
func actionApprovalErrorResponse(c *fiber.Ctx, err error) error {
	switch {
	case err == sql.ErrNoRows:
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
	case errors.Is(err, coordinator.ErrTaskNotAwaitingApproval):
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error":   "not_awaiting_approval",
			"message": "this run is not awaiting approval, or has already been approved or rejected",
		})
	case errors.Is(err, coordinator.ErrNoRuntimeForApproval):
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "runtime_unavailable",
			"message": "no connected runtime is available to dispatch this approved run; reconnect a runtime and approve again",
		})
	case errors.Is(err, coordinator.ErrExecutionInputRefUnavailable):
		// The run has been marked terminal failed by the coordinator; the
		// message carries only the safe failure code (e.g. scope_mismatch,
		// key_unavailable), never key material or plaintext.
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error":   "input_ref_unavailable",
			"message": err.Error() + "; the run was marked failed and was not dispatched",
		})
	default:
		log.Error().Err(err).Msg("[Actions] approval decision failed")
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
	}
}

func handleActionList(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		rows, err := db.QueryContext(c.Context(), `
			SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
			       policy_preset, replay_class, approval_required, irreversible, secret_refs,
			       target_metadata, fallback_policy, created_at, updated_at, archived_at
			FROM action_definitions
			WHERE tenant_id = $1 AND archived_at IS NULL
			ORDER BY updated_at DESC
			LIMIT 200`, tenantID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer rows.Close()

		actions := make([]actionDefinition, 0)
		for rows.Next() {
			def, err := scanActionDefinition(rows)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			actions = append(actions, def)
		}
		if err := rows.Err(); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"actions": actions})
	}
}

func handleActionCreate(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req actionDefinitionRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		def, err := normalizeActionDefinitionRequest(req, nil)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}
		def.ID = uuid.NewString()
		def.TenantID = tenantID
		secretRefs, targetMetadata, fallbackPolicy, err := marshalActionJSON(def)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}

		created, err := queryActionDefinition(c.Context(), db, `
			INSERT INTO action_definitions (
				id, tenant_id, name, display_name, description, target_type, target_url, method,
				policy_preset, replay_class, approval_required, irreversible, secret_refs, target_metadata,
				fallback_policy
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb)
			RETURNING id, tenant_id, name, display_name, description, target_type, target_url, method,
			          policy_preset, replay_class, approval_required, irreversible, secret_refs,
			          target_metadata, fallback_policy, created_at, updated_at, archived_at`,
			def.ID, def.TenantID, def.Name, def.DisplayName, def.Description, def.TargetType, def.TargetURL, def.Method,
			def.PolicyPreset, def.ReplayClass, def.ApprovalRequired, def.Irreversible, string(secretRefs), string(targetMetadata),
			string(fallbackPolicy))
		if err != nil {
			if isLikelyUniqueViolation(err) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "action_name_conflict"})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(created)
	}
}

func handleActionGet(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		def, err := loadActionDefinitionByID(c.Context(), db, tenantID, c.Params("id"))
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(def)
	}
}

func handleActionPatch(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		current, err := loadActionDefinitionByID(c.Context(), db, tenantID, c.Params("id"))
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		var req actionDefinitionRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		def, err := normalizeActionDefinitionRequest(req, &current)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}
		secretRefs, targetMetadata, fallbackPolicy, err := marshalActionJSON(def)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}
		updated, err := queryActionDefinition(c.Context(), db, `
			UPDATE action_definitions
			SET name = $3, display_name = $4, description = $5, target_type = $6, target_url = $7,
			    method = $8, policy_preset = $9, replay_class = $10, approval_required = $11,
			    irreversible = $12, secret_refs = $13::jsonb, target_metadata = $14::jsonb,
			    fallback_policy = $15::jsonb, updated_at = NOW()
			WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL
			RETURNING id, tenant_id, name, display_name, description, target_type, target_url, method,
			          policy_preset, replay_class, approval_required, irreversible, secret_refs,
			          target_metadata, fallback_policy, created_at, updated_at, archived_at`,
			tenantID, current.ID, def.Name, def.DisplayName, def.Description, def.TargetType, def.TargetURL, def.Method,
			def.PolicyPreset, def.ReplayClass, def.ApprovalRequired, def.Irreversible, string(secretRefs), string(targetMetadata),
			string(fallbackPolicy))
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			if isLikelyUniqueViolation(err) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "action_name_conflict"})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(updated)
	}
}

func handleActionArchive(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		res, err := db.ExecContext(c.Context(), `
			UPDATE action_definitions
			SET archived_at = NOW(), updated_at = NOW()
			WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL`, tenantID, c.Params("id"))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		return c.SendStatus(http.StatusNoContent)
	}
}

func loadActionDefinitionForRun(ctx context.Context, db *sql.DB, tenantID string, req actionRunRequest) (actionDefinition, error) {
	id := firstNonEmptyString(req.ActionID, req.ID)
	if strings.TrimSpace(id) != "" {
		return loadActionDefinitionByID(ctx, db, tenantID, id)
	}
	name := firstNonEmptyString(req.ActionName, req.Name, req.Action)
	if strings.TrimSpace(name) != "" {
		return loadActionDefinitionByName(ctx, db, tenantID, name)
	}
	return actionDefinition{}, fmt.Errorf("action_id or action_name is required")
}

func buildActionTaskSubmitRequest(req actionRunRequest, tenantID string) (*coordinator.TaskSubmitRequest, error) {
	action := strings.TrimSpace(req.Action)
	if action == "" {
		return nil, fmt.Errorf("action is required")
	}
	if req.Input == nil {
		return nil, fmt.Errorf("input is required")
	}
	var def json.RawMessage
	var err error
	if req.boundAction != nil {
		def, err = buildBoundActionExecutionGraphDefinition(req)
	} else {
		def, err = buildActionExecutionGraphDefinition(req)
	}
	if err != nil {
		return nil, err
	}
	return &coordinator.TaskSubmitRequest{
		TenantID:       tenantID,
		TaskType:       "execution_graph",
		TaskDefinition: def,
		AgentIdentity: &coordinator.AgentIdentity{
			AgentID:     stringFromMap(req.Metadata, "agent_id"),
			PrincipalID: stringFromMap(req.Metadata, "user_id"),
		},
		IdempotencyKey:     req.IdempotencyKey,
		DeadlineAt:         req.DeadlineAt,
		PreferredRuntimeID: req.preferredRuntimeID,
		BoundAction:        req.boundAction,
	}, nil
}

func buildActionRunRequestFromDefinition(def actionDefinition, req actionRunByNameRequest) (actionRunRequest, error) {
	metadata := copyActionMap(req.Metadata)
	metadata["action_definition_id"] = def.ID
	metadata["action_name"] = def.Name
	metadata["target_type"] = def.TargetType
	metadata["policy_preset"] = def.PolicyPreset
	metadata["replay_class"] = def.ReplayClass
	metadata["approval_required"] = def.ApprovalRequired
	metadata["irreversible"] = def.Irreversible

	runReq := actionRunRequest{
		Action:         def.Name,
		Input:          copyActionMap(req.Input),
		Metadata:       metadata,
		IdempotencyKey: req.IdempotencyKey,
		DeadlineAt:     req.DeadlineAt,
		AgentID:        req.AgentID,
		AgentName:      req.AgentName,
	}

	// Resolve legacy `api` rows to `hosted_api` for the dispatch switch.
	// Behavior for hosted_api and webhook is identical in this slice; the
	// target_type only differs in the metadata stamped onto the run.
	targetType := canonicalActionTargetType(def.TargetType)
	switch targetType {
	case actionTargetMockDemo:
		runReq.executedTarget = actionTargetMockDemo
		demoVariant := stringFromMap(def.TargetMetadata, "demo_variant")
		demoBehavior := "mock_demo target; no external API was called"
		if demoVariant == "fail_once" && !mockDemoRetryRequested(req.Input) {
			demoBehavior = "demo.fail_once simulated failure on first attempt; retry with input.retry=true or a new idempotency key"
		}
		record := map[string]interface{}{
			"demo":                 true,
			"demo_behavior":        demoBehavior,
			"action":               def.Name,
			"action_definition_id": def.ID,
			"requested_input":      req.Input,
			"policy_preset":        def.PolicyPreset,
			"replay_class":         def.ReplayClass,
			"approval_required":    def.ApprovalRequired,
			"irreversible":         def.Irreversible,
			"created_by_gateway":   true,
			"target_configuration": "mock_demo",
		}
		if demoVariant != "" {
			record["demo_variant"] = demoVariant
		}
		runReq.RuntimeTarget = "database_write"
		runReq.Input = map[string]interface{}{
			"table":  "action_task_mock_demo",
			"record": record,
		}
	case actionTargetWebhook, actionTargetHostedAPI:
		if strings.TrimSpace(def.TargetURL) == "" {
			return actionRunRequest{}, fmt.Errorf("target URL is not configured")
		}
		// Syntax/literal checks here; bind + Runtime re-resolve DNS near connect.
		if _, err := ValidateActionTargetURLSyntax(def.TargetURL); err != nil {
			return actionRunRequest{}, fmt.Errorf("unsafe_target_url: %w", err)
		}
		headers, err := localWebhookAuthHeaders(def)
		if err != nil {
			return actionRunRequest{}, err
		}
		runReq.executedTarget = targetType
		body := req.Input
		if body == nil {
			body = map[string]interface{}{}
		}
		runReq.RuntimeTarget = "http_request"
		runReq.Input = map[string]interface{}{
			"url":    def.TargetURL,
			"method": def.Method,
			"body":   body,
		}
		if len(headers) > 0 {
			runReq.Input["headers"] = headers
		}
	case actionTargetLocalRuntime:
		// local_runtime actions execute on a tenant-owned runtime. The action's
		// `input` declares the tool call (http_request / filesystem /
		// database_write) — the runtime executes it with its own local
		// capabilities. `target_metadata.runtime_id`, when set, pins dispatch
		// to a specific tenant runtime; all other target_metadata fields
		// (environment, capabilities, working_directory_label, timeout_ms) are
		// reserved for future selector slices and intentionally not echoed
		// back through the public response.
		if req.Input == nil {
			return actionRunRequest{}, fmt.Errorf("input is required for local_runtime actions")
		}
		if rid := stringFromMap(def.TargetMetadata, "runtime_id"); rid != "" {
			runReq.preferredRuntimeID = rid
		}
		runReq.executedTarget = actionTargetLocalRuntime
	case actionTargetHybridFallback:
		// Routing model exists, resolver does not. Refusing here keeps the
		// slice purely additive — no surprise behavior change for callers.
		return actionRunRequest{}, fmt.Errorf("hybrid_fallback resolver is not configured in this slice")
	default:
		return actionRunRequest{}, fmt.Errorf("unsupported target type")
	}
	// Stamp the canonical target on the run metadata so downstream slices
	// (and the console) can render "Routed via …" without re-deriving it.
	runReq.Metadata["target_type"] = targetType
	return runReq, nil
}

func buildBoundActionRunRequest(
	binding *contractExecutionBindingRecord,
	version *contractVersionRecord,
	req actionRunByNameRequest,
) (actionRunRequest, actionDefinition, error) {
	if binding == nil || version == nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("binding and contract version are required")
	}
	snapshot, err := binding.decodeTargetSnapshot()
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("decode target snapshot: %w", err)
	}
	mapping, err := binding.decodeInputMapping()
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("decode input mapping: %w", err)
	}
	descriptors, err := contractParameterDescriptors(version.Contract)
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("decode contract parameters: %w", err)
	}
	mappedInput, err := mapBoundActionInput(descriptors, mapping, req.Input)
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, err
	}
	targetDef := actionDefinition{
		ID:               binding.TargetActionID.String(),
		Name:             binding.ActionName,
		TargetType:       snapshot.TargetType,
		TargetURL:        snapshot.TargetURL,
		Method:           snapshot.Method,
		PolicyPreset:     snapshot.PolicyPreset,
		ReplayClass:      snapshot.ReplayClass,
		ApprovalRequired: snapshot.ApprovalRequired || version.ApprovalMode == "required",
		Irreversible:     snapshot.Irreversible,
		SecretRefs:       append([]string(nil), snapshot.SecretRefs...),
		TargetMetadata:   copyActionMap(snapshot.TargetMetadata),
	}
	// Re-validate destination policy near dispatch (DNS may have changed since bind).
	if _, err := ValidateActionTargetURL(snapshot.TargetURL); err != nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("unsafe_target_url: %w", err)
	}
	headers, err := localWebhookAuthHeaders(targetDef)
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, err
	}
	if headers == nil {
		headers = map[string]interface{}{}
	}
	headers["Idempotency-Key"] = req.IdempotencyKey

	effectiveReplayClass := binding.ReplayClass
	if snapshot.ReplayClass == "non_retryable" {
		effectiveReplayClass = "non_retryable"
	}
	metadata := map[string]interface{}{
		"action_definition_id": binding.TargetActionID.String(),
		"action_name":          binding.ActionName,
		"target_type":          snapshot.TargetType,
		"policy_preset":        snapshot.PolicyPreset,
		"replay_class":         effectiveReplayClass,
		"approval_required":    targetDef.ApprovalRequired,
		"irreversible":         targetDef.Irreversible,
		"contract_hash":        binding.ContractHash,
		"contract_binding_id":  binding.ID.String(),
		"target_version_hash":  binding.TargetVersionHash,
		"contract_risk":        version.Risk,
		"authorization_layers": []string{"managed", "embedded"},
	}
	bodyBytes, err := json.Marshal(mappedInput)
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("encode mapped input: %w", err)
	}
	fingerprintBody, err := json.Marshal(struct {
		BindingID    string                 `json:"binding_id"`
		ContractHash string                 `json:"contract_hash"`
		Input        map[string]interface{} `json:"input"`
	}{
		BindingID: binding.ID.String(), ContractHash: binding.ContractHash, Input: mappedInput,
	})
	if err != nil {
		return actionRunRequest{}, actionDefinition{}, fmt.Errorf("encode request fingerprint: %w", err)
	}
	boundIdentity := &coordinator.BoundActionRunIdentity{
		BindingID:              binding.ID,
		ContractHash:           binding.ContractHash,
		TargetActionID:         binding.TargetActionID,
		TargetVersionHash:      binding.TargetVersionHash,
		BusinessIdempotencyKey: req.IdempotencyKey,
		RequestFingerprint:     sha256HexString(string(fingerprintBody)),
	}
	runReq := actionRunRequest{
		Action:         binding.ActionName,
		Input:          mappedInput,
		Metadata:       metadata,
		RuntimeTarget:  "http_request",
		IdempotencyKey: req.IdempotencyKey,
		DeadlineAt:     req.DeadlineAt,
		AgentID:        req.AgentID,
		AgentName:      req.AgentName,
		executedTarget: actionTargetLocalRuntime,
		boundAction:    boundIdentity,
	}
	runReq.Input = map[string]interface{}{
		"url":        snapshot.TargetURL,
		"method":     snapshot.Method,
		"body":       string(bodyBytes),
		"headers":    headers,
		"timeout_ms": binding.TimeoutMS,
	}
	return runReq, targetDef, nil
}

func mapBoundActionInput(
	descriptors []contractParameterDescriptor,
	mapping map[string]string,
	input map[string]interface{},
) (map[string]interface{}, error) {
	if input == nil {
		input = map[string]interface{}{}
	}
	known := make(map[string]contractParameterDescriptor, len(descriptors))
	for _, descriptor := range descriptors {
		known[descriptor.Name] = descriptor
	}
	for key := range input {
		if _, ok := known[key]; !ok {
			return nil, fmt.Errorf("unexpected input field %q", key)
		}
	}
	mapped := make(map[string]interface{}, len(input))
	for _, descriptor := range descriptors {
		value, ok := input[descriptor.Name]
		if !ok {
			if descriptor.HasDefault {
				continue
			}
			return nil, fmt.Errorf("missing required input field %q", descriptor.Name)
		}
		if err := validateBoundParameterType(descriptor, value); err != nil {
			return nil, err
		}
		targetField := mapping[descriptor.Name]
		mapped[targetField] = value
	}
	return mapped, nil
}

func validateBoundParameterType(descriptor contractParameterDescriptor, value interface{}) error {
	if descriptor.Annotation == nil || strings.TrimSpace(*descriptor.Annotation) == "" {
		return nil
	}
	annotation := strings.ToLower(strings.TrimSpace(*descriptor.Annotation))
	valid := true
	switch annotation {
	case "str", "string", "<class 'str'>":
		_, valid = value.(string)
	case "int", "integer", "<class 'int'>":
		number, ok := value.(float64)
		valid = ok && number == float64(int64(number))
	case "float", "number", "<class 'float'>":
		_, valid = value.(float64)
	case "bool", "boolean", "<class 'bool'>":
		_, valid = value.(bool)
	case "dict", "object", "<class 'dict'>":
		_, valid = value.(map[string]interface{})
	case "list", "array", "<class 'list'>":
		_, valid = value.([]interface{})
	default:
		// Unknown Python annotations are descriptive in ActionContract v1;
		// rejecting them would make existing valid contracts unbindable.
		return nil
	}
	if !valid {
		return fmt.Errorf("input field %q is incompatible with annotation %q", descriptor.Name, *descriptor.Annotation)
	}
	return nil
}

func localWebhookAuthHeaders(def actionDefinition) (map[string]interface{}, error) {
	headerName := strings.TrimSpace(stringFromMap(def.TargetMetadata, localWebhookAuthHeaderNameMetadata))
	secretEnv := strings.TrimSpace(stringFromMap(def.TargetMetadata, localWebhookAuthSecretEnvMetadata))
	if headerName == "" && secretEnv == "" {
		return nil, nil
	}
	if canonicalActionTargetType(def.TargetType) != actionTargetWebhook {
		return nil, fmt.Errorf("local webhook auth is only allowed for webhook targets")
	}
	if headerName == "" || secretEnv == "" {
		return nil, fmt.Errorf("local webhook auth requires both %s and %s", localWebhookAuthHeaderNameMetadata, localWebhookAuthSecretEnvMetadata)
	}
	if !localWebhookAuthHeaderPattern.MatchString(headerName) || strings.EqualFold(headerName, "authorization") || strings.EqualFold(headerName, "cookie") {
		return nil, fmt.Errorf("local webhook auth header name is not allowed")
	}
	if !localWebhookSecretEnvPattern.MatchString(secretEnv) {
		return nil, fmt.Errorf("local webhook auth secret env name is not allowed")
	}
	if _, err := ValidateActionTargetURL(def.TargetURL); err != nil {
		return nil, fmt.Errorf("webhook auth target URL rejected: %w", err)
	}
	secret, ok := os.LookupEnv(secretEnv)
	if !ok || strings.TrimSpace(secret) == "" {
		return nil, fmt.Errorf("local webhook auth secret env is not configured")
	}
	if strings.ContainsAny(secret, "\r\n") {
		return nil, fmt.Errorf("local webhook auth secret contains invalid characters")
	}
	return map[string]interface{}{headerName: secret}, nil
}

func buildActionExecutionGraphDefinition(req actionRunRequest) (json.RawMessage, error) {
	target := strings.TrimSpace(req.RuntimeTarget)
	if target == "" {
		target = inferRuntimeTarget(req.Input)
	}
	if target == "" {
		return nil, fmt.Errorf("runtime_target is required until this action is registered; use http_request, filesystem, or database_write")
	}

	nodeID := actionNodeID(req.Action)
	node := map[string]interface{}{
		"kind":           "tool",
		"node_id":        nodeID,
		"checkpoint_key": nodeID + "-checkpoint-0",
		"write_slot":     "action." + strings.ReplaceAll(nodeID, "-", "_"),
		"metadata":       actionNodeMetadata(req),
	}

	switch target {
	case "http_request":
		url := stringFromMap(req.Input, "url")
		if url == "" {
			return nil, fmt.Errorf("input.url is required for runtime_target=http_request")
		}
		method := strings.ToUpper(stringFromMap(req.Input, "method"))
		if method == "" {
			method = "POST"
		}
		args := map[string]interface{}{"method": method, "url": url}
		if body, ok := req.Input["body"]; ok {
			args["body"] = stringifyActionBody(body)
		}
		if headers, ok := req.Input["headers"].(map[string]interface{}); ok && len(headers) > 0 {
			args["headers"] = headers
		}
		node["tool_name"] = "http_request"
		node["args"] = args
	case "filesystem":
		path := stringFromMap(req.Input, "path")
		if path == "" {
			return nil, fmt.Errorf("input.path is required for runtime_target=filesystem")
		}
		operation := stringFromMap(req.Input, "operation")
		if operation == "" {
			operation = "read"
		}
		node["tool_name"] = "filesystem"
		node["args"] = map[string]interface{}{"operation": operation, "path": path}
	case "database_write":
		table := stringFromMap(req.Input, "table")
		if table == "" {
			return nil, fmt.Errorf("input.table is required for runtime_target=database_write")
		}
		record, _ := req.Input["record"].(map[string]interface{})
		if record == nil {
			record = map[string]interface{}{}
		}
		node["tool_name"] = "database_write"
		node["args"] = map[string]interface{}{"table": table, "record": record}
	default:
		return nil, fmt.Errorf("runtime_target must be one of http_request, filesystem, or database_write")
	}

	return buildExecutionGraphDefinition(req.Action, []map[string]interface{}{node})
}

func buildBoundActionExecutionGraphDefinition(req actionRunRequest) (json.RawMessage, error) {
	if req.boundAction == nil {
		return nil, fmt.Errorf("bound action identity is required")
	}
	url := stringFromMap(req.Input, "url")
	if url == "" {
		return nil, fmt.Errorf("bound action target URL is required")
	}
	method := strings.ToUpper(stringFromMap(req.Input, "method"))
	if method == "" {
		method = "POST"
	}
	args := map[string]interface{}{"method": method, "url": url}
	if body, ok := req.Input["body"]; ok {
		args["body"] = stringifyActionBody(body)
	}
	if headers, ok := req.Input["headers"].(map[string]interface{}); ok {
		args["headers"] = headers
	}
	actionNode := map[string]interface{}{
		"kind":           "tool",
		"node_id":        "contract-bound-http-0",
		"checkpoint_key": "contract-bound-http-checkpoint-0",
		"write_slot":     "action.contract_bound_http_0",
		"tool_name":      "http_request",
		"args":           args,
		"metadata":       actionNodeMetadata(req),
	}
	completionNode := map[string]interface{}{
		"kind":           "tool",
		"node_id":        "contract-bound-completion-1",
		"checkpoint_key": "contract-bound-completion-checkpoint-1",
		"write_slot":     "action.contract_bound_completion_1",
		"tool_name":      "database_write",
		"args": map[string]interface{}{
			"table": "action_task_contract_bound_completions",
			"record": map[string]interface{}{
				"binding_id":               req.boundAction.BindingID.String(),
				"contract_hash":            req.boundAction.ContractHash,
				"business_idempotency_key": req.boundAction.BusinessIdempotencyKey,
				"status":                   "completed",
			},
		},
		"metadata": map[string]interface{}{
			"action_name":                   req.Action,
			"contract_hash":                 req.boundAction.ContractHash,
			"contract_binding_id":           req.boundAction.BindingID.String(),
			"deterministic_completion_step": true,
			"irreversible":                  true,
		},
	}
	checkpointAfter := uint32(1)
	definition, err := buildExecutionGraphDefinition(
		req.Action,
		[]map[string]interface{}{actionNode, completionNode},
		&checkpointAfter,
	)
	if err != nil {
		return nil, err
	}
	// Product path: durable mid-effect checkpoint that continues automatically.
	// Recovery proofs that must stop after the HTTP step set
	// IGRIS_BOUND_ACTION_YIELD_AFTER_CHECKPOINT=1 so continue_after_checkpoint
	// is omitted and Runtime yields Checkpointed (Clock 3B harness).
	if boundActionYieldAfterCheckpoint() {
		return definition, nil
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(definition, &decoded); err != nil {
		return nil, fmt.Errorf("decode bound action graph definition: %w", err)
	}
	decoded["continue_after_checkpoint"] = true
	encoded, err := json.Marshal(decoded)
	if err != nil {
		return nil, fmt.Errorf("encode bound action graph definition: %w", err)
	}
	return encoded, nil
}

func boundActionYieldAfterCheckpoint() bool {
	value := strings.TrimSpace(os.Getenv("IGRIS_BOUND_ACTION_YIELD_AFTER_CHECKPOINT"))
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func buildActionRunResponse(task *coordinator.TaskRecord, resolved *agentregistry.ResolvedAgent) fiber.Map {
	proofStatus := "pending"
	executionID := ""
	if task.Proof == nil {
		proofStatus = "unavailable"
	} else {
		if task.Proof.Status != "" {
			proofStatus = task.Proof.Status
		}
		executionID = task.Proof.ExecutionID
	}
	resp := fiber.Map{
		"task_id":      task.TaskID.String(),
		"run_id":       task.TaskID.String(),
		"status":       string(task.Status),
		"proof_status": proofStatus,
	}
	if executionID != "" {
		resp["execution_id"] = executionID
	}
	if task.BoundAction != nil {
		resp["contract_binding"] = fiber.Map{
			"binding_id":               task.BoundAction.BindingID.String(),
			"contract_hash":            task.BoundAction.ContractHash,
			"target_action_id":         task.BoundAction.TargetActionID.String(),
			"target_version_hash":      task.BoundAction.TargetVersionHash,
			"business_idempotency_key": task.BoundAction.BusinessIdempotencyKey,
			"request_fingerprint":      task.BoundAction.RequestFingerprint,
		}
		// Minimal linked_proof scaffold for non-GET paths (run create/approve).
		// GET /runs/:id replaces this via attachIgrisRunProof with full recovery
		// lineage, evidence link, and machine-readable status dimensions.
		resp["linked_proof"] = fiber.Map{
			"schema":                   igrisRunProofSchemaV1,
			"product_term":             "Igris Run Proof",
			"claim_boundary":           igrisRunProofClaimBoundary(),
			"contract_hash":            task.BoundAction.ContractHash,
			"binding_id":               task.BoundAction.BindingID.String(),
			"task_id":                  task.TaskID.String(),
			"run_id":                   task.TaskID.String(),
			"business_idempotency_key": task.BoundAction.BusinessIdempotencyKey,
			"runtime_proof": fiber.Map{
				"execution_id":        executionID,
				"status":              proofStatus,
				"verification_status": proofStatus,
				"claim_type":          "runtime_receipt",
			},
		}
	}
	if task.Status == coordinator.TaskStatusFailed && task.FailureReason != nil {
		resp["error"] = "action_failed"
		resp["message"] = *task.FailureReason
	}
	if task.Status == coordinator.TaskStatusApprovalRequired {
		resp["error"] = "approval_required"
	}
	if task.Status == coordinator.TaskStatusCompleted {
		resp["result"] = fiber.Map{"status": "completed"}
	}
	if inputSummary := safeInputSummaryRaw(task.TaskDefinition); inputSummary != nil {
		resp["input_summary"] = inputSummary
	}
	if consoleURL := actionConsoleURL(task.TaskID.String()); consoleURL != "" {
		resp["console_url"] = consoleURL
	}
	if agent := agentSummaryForTask(task, resolved); agent != nil {
		resp["agent"] = agent
	}
	return resp
}

type actionDefinitionScanner interface {
	Scan(dest ...interface{}) error
}

func loadActionDefinitionByID(ctx context.Context, db *sql.DB, tenantID, id string) (actionDefinition, error) {
	return queryActionDefinition(ctx, db, `
		SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
		       policy_preset, replay_class, approval_required, irreversible, secret_refs,
		       target_metadata, fallback_policy, created_at, updated_at, archived_at
		FROM action_definitions
		WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL`, tenantID, id)
}

func loadActionDefinitionByIDFromQuerier(ctx context.Context, q contractQuerier, tenantID, id string) (actionDefinition, error) {
	row := q.QueryRowContext(ctx, `
		SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
		       policy_preset, replay_class, approval_required, irreversible, secret_refs,
		       target_metadata, fallback_policy, created_at, updated_at, archived_at
		FROM action_definitions
		WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL
		FOR SHARE`,
		tenantID, id,
	)
	return scanActionDefinition(row)
}

func loadActionDefinitionByName(ctx context.Context, db *sql.DB, tenantID, name string) (actionDefinition, error) {
	return queryActionDefinition(ctx, db, `
		SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
		       policy_preset, replay_class, approval_required, irreversible, secret_refs,
		       target_metadata, fallback_policy, created_at, updated_at, archived_at
		FROM action_definitions
		WHERE tenant_id = $1 AND name = $2 AND archived_at IS NULL`, tenantID, name)
}

func queryActionDefinition(ctx context.Context, db *sql.DB, query string, args ...interface{}) (actionDefinition, error) {
	row := db.QueryRowContext(ctx, query, args...)
	return scanActionDefinition(row)
}

func scanActionDefinition(scanner actionDefinitionScanner) (actionDefinition, error) {
	var def actionDefinition
	var secretRefsRaw []byte
	var targetMetadataRaw []byte
	var fallbackPolicyRaw []byte
	err := scanner.Scan(
		&def.ID,
		&def.TenantID,
		&def.Name,
		&def.DisplayName,
		&def.Description,
		&def.TargetType,
		&def.TargetURL,
		&def.Method,
		&def.PolicyPreset,
		&def.ReplayClass,
		&def.ApprovalRequired,
		&def.Irreversible,
		&secretRefsRaw,
		&targetMetadataRaw,
		&fallbackPolicyRaw,
		&def.CreatedAt,
		&def.UpdatedAt,
		&def.ArchivedAt,
	)
	if err != nil {
		return actionDefinition{}, err
	}
	if len(secretRefsRaw) > 0 {
		_ = json.Unmarshal(secretRefsRaw, &def.SecretRefs)
	}
	if len(targetMetadataRaw) > 0 {
		_ = json.Unmarshal(targetMetadataRaw, &def.TargetMetadata)
	}
	if len(fallbackPolicyRaw) > 0 {
		_ = json.Unmarshal(fallbackPolicyRaw, &def.FallbackPolicy)
	}
	if def.SecretRefs == nil {
		def.SecretRefs = []string{}
	}
	def.SecretRefs = sanitizeActionSecretRefs(def.SecretRefs)
	if def.TargetMetadata == nil {
		def.TargetMetadata = map[string]interface{}{}
	}
	// Persisted rows pre-dating migration 055 read back as an empty struct,
	// which is the same as the canonical "disabled" default — no rewrite needed.
	//
	// Canonicalize on read so API responses never leak the deprecated `api`
	// alias — rows persisted before the rename keep working but always present
	// as `hosted_api` to the world.
	def.TargetType = canonicalActionTargetType(def.TargetType)
	def.TargetURL = sanitizeActionTargetURL(def.TargetURL)
	def.TargetMetadata = sanitizeActionMetadata(def.TargetMetadata)
	def.FallbackPolicy.PrimaryTarget = canonicalActionTargetType(def.FallbackPolicy.PrimaryTarget)
	def.FallbackPolicy.SecondaryTarget = canonicalActionTargetType(def.FallbackPolicy.SecondaryTarget)
	for i, allowed := range def.FallbackPolicy.AllowedTargets {
		def.FallbackPolicy.AllowedTargets[i] = canonicalActionTargetType(allowed)
	}
	return def, nil
}

func normalizeActionDefinitionRequest(req actionDefinitionRequest, current *actionDefinition) (actionDefinition, error) {
	def := actionDefinition{
		TargetType:     "mock_demo",
		Method:         "POST",
		PolicyPreset:   "Safe automation",
		ReplayClass:    "retryable",
		SecretRefs:     []string{},
		TargetMetadata: map[string]interface{}{},
	}
	if current != nil {
		def = *current
		def.SecretRefs = append([]string(nil), current.SecretRefs...)
		def.TargetMetadata = copyActionMap(current.TargetMetadata)
	}
	if strings.TrimSpace(req.Name) != "" || current == nil {
		def.Name = normalizeActionName(req.Name)
	}
	if !validActionName(def.Name) {
		return actionDefinition{}, fmt.Errorf("name must match %s", actionNamePattern.String())
	}
	if strings.TrimSpace(req.DisplayName) != "" || current == nil {
		def.DisplayName = strings.TrimSpace(req.DisplayName)
	}
	if def.DisplayName == "" {
		def.DisplayName = def.Name
	}
	if strings.TrimSpace(req.Description) != "" || current == nil {
		def.Description = strings.TrimSpace(req.Description)
	}
	if strings.TrimSpace(req.TargetType) != "" {
		def.TargetType = canonicalActionTargetType(req.TargetType)
	} else {
		// Re-canonicalize any legacy value that may have been carried over
		// from `current` so the normalized definition is always written back
		// using the preferred vocabulary.
		def.TargetType = canonicalActionTargetType(def.TargetType)
	}
	if !validActionTargetType(def.TargetType) {
		return actionDefinition{}, fmt.Errorf(
			"target_type must be one of hosted_api, webhook, local_runtime, hybrid_fallback, or mock_demo",
		)
	}
	if strings.TrimSpace(req.TargetURL) != "" || current == nil {
		def.TargetURL = sanitizeActionTargetURL(req.TargetURL)
	}
	if def.TargetType == actionTargetWebhook || def.TargetType == actionTargetHostedAPI {
		if strings.TrimSpace(def.TargetURL) == "" {
			return actionDefinition{}, fmt.Errorf("target_url is required for %s targets", def.TargetType)
		}
		if _, err := ValidateActionTargetURLSyntax(def.TargetURL); err != nil {
			return actionDefinition{}, fmt.Errorf("unsafe_target_url: %w", err)
		}
	}
	if strings.TrimSpace(req.Method) != "" {
		def.Method = strings.ToUpper(strings.TrimSpace(req.Method))
	}
	if def.Method == "" {
		def.Method = "POST"
	}
	if !validActionMethod(def.Method) {
		return actionDefinition{}, fmt.Errorf("method must be GET, POST, PUT, PATCH, or DELETE")
	}
	if strings.TrimSpace(req.PolicyPreset) != "" || current == nil {
		def.PolicyPreset = strings.TrimSpace(req.PolicyPreset)
	}
	if !validPolicyPreset(def.PolicyPreset) {
		return actionDefinition{}, fmt.Errorf("unsupported policy_preset")
	}
	applyPolicyPresetDefaults(&def)
	if strings.TrimSpace(req.ReplayClass) != "" {
		def.ReplayClass = strings.TrimSpace(req.ReplayClass)
	}
	if !validReplayClass(def.ReplayClass) {
		return actionDefinition{}, fmt.Errorf("replay_class must be retryable, non_retryable, or read_only")
	}
	if req.ApprovalRequired != nil {
		def.ApprovalRequired = *req.ApprovalRequired
	}
	if req.Irreversible != nil {
		def.Irreversible = *req.Irreversible
	}
	if req.SecretRefs != nil {
		for _, ref := range req.SecretRefs {
			if err := validateActionSecretRef(ref); err != nil {
				return actionDefinition{}, err
			}
		}
		def.SecretRefs = sanitizeActionSecretRefs(req.SecretRefs)
	}
	if req.TargetMetadata != nil {
		def.TargetMetadata = sanitizeActionMetadata(copyActionMap(req.TargetMetadata))
	}
	if req.FallbackPolicy != nil {
		def.FallbackPolicy = *req.FallbackPolicy
		def.FallbackPolicy.PrimaryTarget = canonicalActionTargetType(def.FallbackPolicy.PrimaryTarget)
		def.FallbackPolicy.SecondaryTarget = canonicalActionTargetType(def.FallbackPolicy.SecondaryTarget)
		for i, allowed := range def.FallbackPolicy.AllowedTargets {
			def.FallbackPolicy.AllowedTargets[i] = canonicalActionTargetType(allowed)
		}
	}
	if err := validateFallbackPolicy(def); err != nil {
		return actionDefinition{}, err
	}
	return def, nil
}

// validateFallbackPolicy enforces the slice-1 fallback rules:
//
//   - hybrid_fallback actions require an explicit, enabled policy with both
//     primary and secondary targets set, and the two targets must differ.
//   - Both targets, when set, must be canonical execution surfaces (not
//     another `hybrid_fallback`).
//   - Irreversible actions and `non_retryable` replay classes are not
//     fallback-safe by default. Operators may opt in only by explicitly
//     setting `requires_replay_safe: false` on the policy.
//   - For non-hybrid actions a disabled / zero-value policy is accepted and
//     is the canonical default.
func validateFallbackPolicy(def actionDefinition) error {
	fp := def.FallbackPolicy
	if def.TargetType == actionTargetHybridFallback {
		if !fp.Enabled {
			return fmt.Errorf("target_type hybrid_fallback requires fallback_policy.enabled = true")
		}
		if fp.PrimaryTarget == "" || fp.SecondaryTarget == "" {
			return fmt.Errorf("hybrid_fallback requires both fallback_policy.primary_target and secondary_target")
		}
		if fp.PrimaryTarget == fp.SecondaryTarget {
			return fmt.Errorf("hybrid_fallback primary_target and secondary_target must differ")
		}
		if !isCanonicalFallbackSurface(fp.PrimaryTarget) {
			return fmt.Errorf("fallback_policy.primary_target must be a canonical execution surface")
		}
		if !isCanonicalFallbackSurface(fp.SecondaryTarget) {
			return fmt.Errorf("fallback_policy.secondary_target must be a canonical execution surface")
		}
		if fp.MaxAttempts < 0 {
			return fmt.Errorf("fallback_policy.max_attempts must be >= 0")
		}
	}
	if fp.Enabled && !fp.RequiresReplaySafe {
		if def.Irreversible {
			return fmt.Errorf("irreversible actions cannot enable fallback without requires_replay_safe=true")
		}
		if def.ReplayClass == "non_retryable" {
			return fmt.Errorf("non_retryable replay_class cannot enable fallback without requires_replay_safe=true")
		}
	}
	return nil
}

func isCanonicalFallbackSurface(targetType string) bool {
	switch targetType {
	case actionTargetHostedAPI, actionTargetWebhook, actionTargetLocalRuntime, actionTargetMockDemo:
		return true
	default:
		return false
	}
}

func marshalActionJSON(def actionDefinition) ([]byte, []byte, []byte, error) {
	secretRefs, err := json.Marshal(def.SecretRefs)
	if err != nil {
		return nil, nil, nil, err
	}
	targetMetadata, err := json.Marshal(def.TargetMetadata)
	if err != nil {
		return nil, nil, nil, err
	}
	fallbackPolicy, err := json.Marshal(def.FallbackPolicy)
	if err != nil {
		return nil, nil, nil, err
	}
	return secretRefs, targetMetadata, fallbackPolicy, nil
}

func sanitizeActionSecretRefs(refs []string) []string {
	if refs == nil {
		return []string{}
	}
	safe := make([]string, 0, len(refs))
	for _, ref := range refs {
		trimmed := strings.TrimSpace(ref)
		if trimmed == "" {
			continue
		}
		if looksLikeRawActionSecret(trimmed) {
			safe = append(safe, "redacted:"+sha256HexString(trimmed))
			continue
		}
		safe = append(safe, trimmed)
	}
	return safe
}

func validateActionSecretRef(ref string) error {
	trimmed := strings.TrimSpace(ref)
	if trimmed == "" {
		return fmt.Errorf("secret_refs cannot contain empty values")
	}
	if len(trimmed) > 160 {
		return fmt.Errorf("secret_refs must contain references, not secret values")
	}
	for _, r := range trimmed {
		if !(r >= 'a' && r <= 'z') &&
			!(r >= 'A' && r <= 'Z') &&
			!(r >= '0' && r <= '9') &&
			r != '_' && r != '-' && r != '.' && r != '/' && r != ':' && r != '@' {
			return fmt.Errorf("secret_refs must contain safe reference identifiers only")
		}
	}
	if looksLikeRawActionSecret(trimmed) {
		return fmt.Errorf("secret_refs must contain references, not secret values")
	}
	return nil
}

func looksLikeRawActionSecret(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "bearer") ||
		strings.Contains(lower, "basic") ||
		strings.Contains(lower, "password") ||
		strings.Contains(lower, "authorization") ||
		strings.Contains(lower, "cookie") ||
		strings.Contains(lower, "private_key") ||
		strings.Contains(lower, "-----begin") ||
		strings.Contains(lower, "://") {
		return true
	}
	rawPrefixes := []string{
		"sk-", "sk_", "rk-", "rk_", "pk-", "pk_", "xoxb-", "xoxp-", "ghp_", "github_pat_", "ya29.",
	}
	for _, prefix := range rawPrefixes {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return strings.Count(value, ".") == 2 && strings.HasPrefix(value, "eyJ")
}

func inferRuntimeTarget(input map[string]interface{}) string {
	switch {
	case stringFromMap(input, "url") != "":
		return "http_request"
	case stringFromMap(input, "path") != "":
		return "filesystem"
	case stringFromMap(input, "table") != "":
		return "database_write"
	default:
		return ""
	}
}

func actionNodeMetadata(req actionRunRequest) map[string]interface{} {
	metadata := map[string]interface{}{"action": req.Action}
	for key, value := range req.Metadata {
		switch key {
		case "action_definition_id", "action_name", "target_type", "policy_preset",
			"replay_class", "approval_required", "irreversible", "contract_hash",
			"contract_binding_id", "target_version_hash", "contract_risk",
			"authorization_layers":
			metadata[key] = value
		case "request_summary":
			// Caller-provided, operator-facing one-liner ("apply
			// 064_execution_evals.sql sha256 3471cf5d…") so an approver can see
			// WHAT a paused run intends without exposing the raw input. It is
			// advisory context — the execution target stays the source of
			// truth — and is scrubbed before it is stored or echoed.
			if summary := sanitizeActionRequestSummary(value); summary != "" {
				metadata[key] = summary
			}
		}
	}
	return metadata
}

const maxActionRequestSummaryLength = 200

// sanitizeActionRequestSummary bounds the caller-provided approval summary to
// a single short plain-text line: control characters stripped, length capped,
// inline auth material redacted. Anything that is not a string is dropped.
func sanitizeActionRequestSummary(value interface{}) string {
	s, ok := value.(string)
	if !ok {
		return ""
	}
	s = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return ' '
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if len(s) > maxActionRequestSummaryLength {
		s = s[:maxActionRequestSummaryLength]
	}
	return redactInlineAuth(s)
}

func actionNodeID(action string) string {
	replacer := strings.NewReplacer(".", "-", "_", "-", "/", "-", " ", "-")
	nodeID := strings.ToLower(replacer.Replace(strings.TrimSpace(action)))
	nodeID = strings.Trim(nodeID, "-")
	if nodeID == "" {
		return "action-0"
	}
	return nodeID + "-0"
}

func normalizeActionName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "-", "_")
	name = strings.ReplaceAll(name, " ", "_")
	return name
}

func validActionName(name string) bool {
	return actionNamePattern.MatchString(name)
}

func validActionTargetType(targetType string) bool {
	switch targetType {
	case actionTargetHostedAPI,
		actionTargetWebhook,
		actionTargetLocalRuntime,
		actionTargetHybridFallback,
		actionTargetMockDemo:
		return true
	default:
		return false
	}
}

func validActionMethod(method string) bool {
	switch method {
	case "GET", "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}

func validPolicyPreset(preset string) bool {
	switch preset {
	case "Safe automation", "Human-gated", "Non-replayable", "Read-only":
		return true
	default:
		return false
	}
}

func applyPolicyPresetDefaults(def *actionDefinition) {
	switch def.PolicyPreset {
	case "Human-gated":
		def.ReplayClass = "non_retryable"
		def.ApprovalRequired = true
	case "Non-replayable":
		def.ReplayClass = "non_retryable"
		def.Irreversible = true
	case "Read-only":
		def.ReplayClass = "read_only"
		def.ApprovalRequired = false
	default:
		def.ReplayClass = "retryable"
		def.ApprovalRequired = false
	}
}

func validReplayClass(replayClass string) bool {
	switch replayClass {
	case "retryable", "non_retryable", "read_only":
		return true
	default:
		return false
	}
}

func mockDemoRetryRequested(input map[string]interface{}) bool {
	if retry, ok := input["retry"].(bool); ok && retry {
		return true
	}
	return false
}

func mockDemoFailOnceFirstAttempt(def *actionDefinition, req actionRunRequest) bool {
	if def == nil || canonicalActionTargetType(def.TargetType) != actionTargetMockDemo {
		return false
	}
	if stringFromMap(def.TargetMetadata, "demo_variant") != "fail_once" {
		return false
	}
	return !mockDemoRetryRequested(req.Input)
}

func copyActionMap(values map[string]interface{}) map[string]interface{} {
	copied := make(map[string]interface{})
	for key, value := range values {
		copied[key] = value
	}
	return copied
}

func isLikelyUniqueViolation(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}

func stringFromMap(values map[string]interface{}, key string) string {
	if values == nil {
		return ""
	}
	value, ok := values[key]
	if !ok {
		return ""
	}
	if s, ok := value.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func stringifyActionBody(body interface{}) string {
	if s, ok := body.(string); ok {
		return s
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return ""
	}
	return string(raw)
}

func actionConsoleURL(taskID string) string {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("IGRIS_CONSOLE_URL")), "/")
	if base == "" {
		return ""
	}
	return base + "/execution/tasks/" + taskID
}
