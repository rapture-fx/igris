package api

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal"
)

type queuedRouteQueryExpectation struct {
	columns  []string
	rows     [][]driver.Value
	rowsFunc func() [][]driver.Value
	err      error
	// Optional hook to inspect the query string and args the route layer
	// actually issued (e.g. to assert tenant-id propagation from the
	// auth middleware into the SQL WHERE clause). nil = skip.
	checkArgs func(query string, args []driver.NamedValue)
}

type queuedRouteExecExpectation struct {
	rowsAffected int64
	err          error
	check        func(query string, args []driver.NamedValue)
}

type signedRuntimeCallbackFixture struct {
	publicKey  ed25519.PublicKey
	privateKey ed25519.PrivateKey
}

type queuedRouteDriver struct {
	queries []queuedRouteQueryExpectation
	execs   []queuedRouteExecExpectation
}

type queuedRouteConn struct {
	driver *queuedRouteDriver
}

type queuedRouteTx struct {
	driver *queuedRouteDriver
}

func newQueuedRouteDB(t *testing.T, queries []queuedRouteQueryExpectation, execs ...queuedRouteExecExpectation) (*sql.DB, *queuedRouteDriver) {
	t.Helper()

	name := "queued-route-" + uuid.NewString()
	driver := &queuedRouteDriver{
		queries: append([]queuedRouteQueryExpectation(nil), queries...),
		execs:   append([]queuedRouteExecExpectation(nil), execs...),
	}
	sql.Register(name, driver)

	db, err := sql.Open(name, "")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() {
		_ = db.Close()
	})

	return db, driver
}

func (d *queuedRouteDriver) Open(string) (driver.Conn, error) {
	return &queuedRouteConn{driver: d}, nil
}

func (d *queuedRouteDriver) nextQueryRows(query string, args []driver.NamedValue) (driver.Rows, error) {
	if len(d.queries) == 0 {
		return nil, errors.New("unexpected query")
	}
	next := d.queries[0]
	d.queries = d.queries[1:]
	if next.checkArgs != nil {
		next.checkArgs(query, args)
	}
	if next.err != nil {
		return nil, next.err
	}
	if next.rowsFunc != nil {
		return &queuedRouteRows{columns: next.columns, values: next.rowsFunc()}, nil
	}
	return &queuedRouteRows{columns: next.columns, values: next.rows}, nil
}

func (d *queuedRouteDriver) nextExecResult(query string, args []driver.NamedValue) (driver.Result, error) {
	if len(d.execs) == 0 {
		return nil, errors.New("unexpected exec")
	}
	next := d.execs[0]
	d.execs = d.execs[1:]
	if next.check != nil {
		next.check(query, args)
	}
	if next.err != nil {
		return nil, next.err
	}
	return driver.RowsAffected(next.rowsAffected), nil
}

func (d *queuedRouteDriver) remainingQueries() int {
	return len(d.queries)
}

func (d *queuedRouteDriver) remainingExecs() int {
	return len(d.execs)
}

func (c *queuedRouteConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("prepare not implemented")
}

func (c *queuedRouteConn) Close() error {
	return nil
}

func (c *queuedRouteConn) Begin() (driver.Tx, error) {
	return queuedRouteTx{driver: c.driver}, nil
}

func (c *queuedRouteConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return queuedRouteTx{driver: c.driver}, nil
}

func (c *queuedRouteConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	return c.driver.nextExecResult(query, args)
}

func (c *queuedRouteConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	return c.driver.nextQueryRows(query, args)
}

func (tx queuedRouteTx) Commit() error {
	return nil
}

func (tx queuedRouteTx) Rollback() error {
	return nil
}

func (tx queuedRouteTx) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	return tx.driver.nextExecResult(query, args)
}

func (tx queuedRouteTx) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	return tx.driver.nextQueryRows(query, args)
}

type queuedRouteRows struct {
	columns []string
	values  [][]driver.Value
	index   int
}

func (r *queuedRouteRows) Columns() []string {
	return r.columns
}

func (r *queuedRouteRows) Close() error {
	return nil
}

func (r *queuedRouteRows) Next(dest []driver.Value) error {
	if r.index >= len(r.values) {
		return io.EOF
	}
	copy(dest, r.values[r.index])
	r.index++
	return nil
}

func newSignedRuntimeCallbackFixture(t *testing.T) signedRuntimeCallbackFixture {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	return signedRuntimeCallbackFixture{publicKey: publicKey, privateKey: privateKey}
}

func signRuntimeCallbackHeader(t *testing.T, fixture signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID, callbackType string, body []byte, nonce string, timestamp time.Time) string {
	t.Helper()
	envelope := map[string]any{
		"version":           runtimeCallbackVersion,
		"tenant_id":         tenantID,
		"task_id":           taskID.String(),
		"runtime_id":        runtimeID,
		"callback_type":     callbackType,
		"body_digest":       sha256Hex(body),
		"timestamp_unix_ms": timestamp.UnixMilli(),
		"nonce":             nonce,
		"algorithm":         runtimeCallbackAlgorithm,
	}
	canonical, err := json.Marshal(envelope)
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	envelope["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(fixture.privateKey, sum[:]))
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	return base64.StdEncoding.EncodeToString(raw)
}

func runtimePublicKeyQueryExpectation(publicKey ed25519.PublicKey) queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"public_key_ed25519"},
		rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
	}
}

func runtimeCallbackNonceExecExpectation() queuedRouteExecExpectation {
	return queuedRouteExecExpectation{rowsAffected: 1}
}

func attachRuntimeCallbackHeader(t *testing.T, req *http.Request, fixture signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID, callbackType string, body []byte) {
	t.Helper()
	req.Header.Set(runtimeCallbackEnvelopeHeader, signRuntimeCallbackHeader(
		t,
		fixture,
		tenantID,
		taskID,
		runtimeID,
		callbackType,
		body,
		uuid.NewString(),
		time.Now().UTC(),
	))
}

func runtimeCallbackHeaderWithOptions(t *testing.T, fixture signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID, callbackType string, signedBody []byte, nonce string, timestamp time.Time, includeSignature bool) string {
	t.Helper()
	envelope := map[string]any{
		"version":           runtimeCallbackVersion,
		"tenant_id":         tenantID,
		"task_id":           taskID.String(),
		"runtime_id":        runtimeID,
		"callback_type":     callbackType,
		"body_digest":       sha256Hex(signedBody),
		"timestamp_unix_ms": timestamp.UnixMilli(),
		"nonce":             nonce,
		"algorithm":         runtimeCallbackAlgorithm,
	}
	if includeSignature {
		canonical, err := json.Marshal(envelope)
		require.NoError(t, err)
		sum := sha256.Sum256(canonical)
		envelope["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(fixture.privateKey, sum[:]))
	}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	return base64.StdEncoding.EncodeToString(raw)
}

func runtimeCallbackTaskQuery(taskID uuid.UUID, tenantID string, status coordinator.TaskRecordStatus, runtimeID string, createdAt time.Time) queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			status,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[]}}`),
			nil,
			"idem-runtime-callback-test",
			nil,
			nil,
			nil,
			createdAt,
		)},
	}
}

func taskRecordRouteRow(taskID uuid.UUID, tenantID string, status coordinator.TaskRecordStatus, runtimeID, runtimeEndpoint string, taskDefinition json.RawMessage, checkpoint *coordinator.CheckpointPayload, idempotencyKey string, failureReason *string, canceledAt, completedAt *time.Time, createdAt time.Time, failureDetails ...*coordinator.TaskFailureDetails) []driver.Value {
	var checkpointBytes []byte
	if checkpoint != nil {
		checkpointBytes, _ = json.Marshal(checkpoint)
	}
	var failureDetailBytes []byte
	if len(failureDetails) > 0 && failureDetails[0] != nil {
		failureDetailBytes, _ = json.Marshal(failureDetails[0])
	}

	return []driver.Value{
		taskID.String(),
		tenantID,
		string(status),
		runtimeID,
		runtimeEndpoint,
		[]byte(taskDefinition),
		checkpointBytes,
		nil, // execution_envelope
		nil, // execution_receipt
		nil, // proof_execution_id
		nil, // proof_expected_hash
		nil, // proof_stored_hash
		nil, // proof_signature
		nil, // proof_status
		nil, // proof_checked_at
		nil, // proof_verified
		nil, // proof_hash_valid
		nil, // proof_signature_matches
		nil, // proof_runtime_key_found
		nil, // proof_chain_link_valid
		nil, // proof_verification_reason
		nil, // proof_verified_at
		idempotencyKey,
		failureReason,
		failureDetailBytes,
		nil,
		nil,
		completedAt,
		canceledAt,
		createdAt,
		nil, // executed_target
		nil, // fallback_reason
		nil, // registered_agent_id
		"",  // registered_agent_name
	}
}

func TestBuildTaskResponseIncludesFailureReasonAndCheckpointMetadata(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-1"
	failureReason := "navigation canceled"
	createdAt := time.Unix(1_700_000_000, 0).UTC()
	completedAt := createdAt.Add(2 * time.Minute)

	task := &coordinator.TaskRecord{
		TaskID:        taskID,
		Status:        coordinator.TaskStatusFailed,
		RuntimeID:     &runtimeID,
		FailureReason: &failureReason,
		FailureDetails: &coordinator.TaskFailureDetails{
			Source:        "runtime",
			Operation:     "resume",
			StatusCode:    http.StatusConflict,
			RejectionType: "checkpoint_mismatch",
			Message:       "Checkpoint digest mismatch - WAL state diverged",
		},
		CreatedAt:      createdAt,
		CompletedAt:    &completedAt,
		DeadlineAt:     &completedAt,
		TaskDefinition: json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"cancel_navigation"}]}`),
		LastCheckpoint: &coordinator.CheckpointPayload{
			ResumeToken: coordinator.ResumeToken{
				LastCommittedStep: 3,
				CheckpointDigest:  "abc123",
				RuntimeID:         "checkpoint-runtime-1",
			},
			WalEntries: []coordinator.WalEntry{
				{EntryID: uuid.New(), TaskID: taskID, StepIndex: 3, RuntimeID: "checkpoint-runtime-1"},
			},
			Metadata: json.RawMessage(`{
				"domain":"robotics",
				"action":"cancel_navigation",
				"requested_mode":"quality",
				"resolved_strategy":"provider_race_quality",
				"graph_blackboard":{
					"last_node_id":"robotics-1",
					"nodes":{"robotics-1":{"status":"canceled"}},
					"slots":{"robotics.robotics_1":{"status":"canceled"}}
				}
			}`),
		},
		ExecutionEnvelope: json.RawMessage(`{"execution_id":"exec-1","provider":"openai","signature":"sig-env"}`),
		ExecutionReceipt:  json.RawMessage(`{"execution_id":"exec-1","receipt_hash":"hash-1","signature":"sig-rcpt"}`),
	}

	resp := buildTaskResponse(task)

	require.Equal(t, taskID, resp["task_id"])
	require.Equal(t, coordinator.TaskStatusFailed, resp["status"])
	require.Equal(t, &runtimeID, resp["runtime_id"])
	require.Equal(t, failureReason, resp["failure_reason"])
	require.Equal(t, fiber.Map{
		"source":         "runtime",
		"operation":      "resume",
		"status_code":    http.StatusConflict,
		"rejection_type": "checkpoint_mismatch",
		"message":        "Checkpoint digest mismatch - WAL state diverged",
	}, resp["failure_details"])
	require.Equal(t, &completedAt, resp["deadline_at"])
	require.Equal(t, "robotics_workflow", resp["task_type"])
	require.Equal(t, fiber.Map{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, resp["lifecycle"])
	require.Equal(t, fiber.Map{
		"class":            coordinator.TaskDurabilityClassResumable,
		"streaming":        false,
		"resume_supported": true,
	}, resp["durability"])
	require.Equal(t, fiber.Map{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, resp["recovery"])
	require.Equal(t, "quality", resp["requested_mode"])
	require.Equal(t, "provider_race_quality", resp["resolved_strategy"])
	require.EqualValues(t, 3, resp["last_step"])
	require.Equal(t, "abc123", resp["checkpoint_digest"])
	require.Equal(t, "checkpoint-runtime-1", resp["checkpoint_runtime_id"])
	require.Equal(t, fiber.Map{
		"checkpoint_status":     "failed",
		"last_committed_step":   uint32(3),
		"checkpoint_digest":     "abc123",
		"checkpoint_runtime_id": "checkpoint-runtime-1",
		"resume_token_present":  true,
		"wal_entry_count":       1,
	}, resp["checkpoint_summary"])
	require.NotNil(t, resp["checkpoint_metadata"])
	require.JSONEq(t, `{"last_node_id":"robotics-1","nodes":{"robotics-1":{"status":"canceled"}},"slots":{"robotics.robotics_1":{"status":"canceled"}}}`, string(resp["graph_blackboard"].(json.RawMessage)))
	require.JSONEq(t, `{"robotics-1":{"status":"canceled"}}`, string(resp["graph_nodes"].(json.RawMessage)))
	require.JSONEq(t, `{"robotics.robotics_1":{"status":"canceled"}}`, string(resp["graph_slots"].(json.RawMessage)))
	require.JSONEq(t, `{"execution_id":"exec-1","provider":"openai","signature":"sig-env"}`, string(resp["execution_envelope"].(json.RawMessage)))
	require.JSONEq(t, `{"execution_id":"exec-1","receipt_hash":"hash-1","signature":"sig-rcpt"}`, string(resp["execution_receipt"].(json.RawMessage)))
	require.Equal(t, fiber.Map{
		"available":         true,
		"execution_id":      "exec-1",
		"receipt_hash":      "hash-1",
		"signature_present": true,
	}, resp["receipt"])
}

func TestBuildTaskFailureDetailsResponseIncludesTypedReconciliationSignal(t *testing.T) {
	details := typedReconciliationFailure()
	resp := buildTaskFailureDetailsResponse(details)

	require.Equal(t, "unknown_effect_state", resp["effect_state"])
	require.Equal(t, true, resp["reconciliation_required"])
	require.Equal(t, "idempotency_unresolved", resp["target_error_code"])
	require.Equal(t, "adapter.internal", resp["target_host"])
	require.Equal(t, strings.Repeat("a", 64), resp["target_response_digest"])
}

func TestFailedCallbackBodyPreservesTypedReconciliationSignal(t *testing.T) {
	raw, err := json.Marshal(taskFailedCallbackBody{
		Reason:         "unknown effect",
		FailureDetails: typedReconciliationFailure(),
	})
	require.NoError(t, err)
	var decoded taskFailedCallbackBody
	require.NoError(t, json.Unmarshal(raw, &decoded))
	require.True(t, coordinator.IsTypedReconciliationFailure(decoded.FailureDetails))
}

func TestBuildTaskResponseRedactsHistoricalUnsafeTaskDefinitionInputs(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	task := &coordinator.TaskRecord{
		TaskID: uuid.New(),
		Status: coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{
				"kind":"tool",
				"node_id":"unsafe-http",
				"tool_name":"http_request",
				"args":{
					"method":"POST",
					"url":"https://api.example.test/hook?token=` + marker + `",
					"body":"` + marker + `",
					"headers":{"Authorization":"Bearer ` + marker + `","Cookie":"session=` + marker + `"}
				}
			},{
				"kind":"tool",
				"node_id":"unsafe-file",
				"tool_name":"filesystem",
				"args":{"path":"/Users/customer/private/` + marker + `.txt"}
			}]}
		}`),
		CreatedAt: time.Now().UTC(),
	}

	resp := buildTaskResponse(task)
	raw, err := json.Marshal(resp)
	require.NoError(t, err)
	body := string(raw)

	require.NotContains(t, body, marker)
	require.NotContains(t, body, "Bearer")
	require.NotContains(t, body, "session=")
	require.NotContains(t, body, "/Users/customer/private")
	require.NotContains(t, body, "?token=")
	require.NotContains(t, resp, "task_definition")
	require.Contains(t, body, "input_summary")
	require.Contains(t, body, "input_redacted")
	require.Contains(t, body, "input_digest_sha256")
	require.Contains(t, body, "input_bytes")
	require.Contains(t, body, responseRedactionPolicyVersion)
}

// TestBuildTaskResponseExposesSafeApprovalFields proves the approval panel's
// fields are present and safe for an approval_required run: name-only required
// capabilities, a dedicated approval_reason (not just failure_reason), the
// configured action_target_type, and the policy_preset — while any raw payload
// in the definition is still redacted.
func TestBuildTaskResponseExposesSafeApprovalFields(t *testing.T) {
	t.Parallel()

	const secret = "IGRIS_APPROVAL_SECRET_MUST_NOT_LEAK"
	reason := "Human-gated policy — this action requires human approval before it can run."
	target := "webhook"
	task := &coordinator.TaskRecord{
		TaskID:               uuid.New(),
		Status:               coordinator.TaskStatusApprovalRequired,
		FailureReason:        &reason,
		ExecutedTarget:       &target,
		RequiredCapabilities: []string{"network.api", "tools.http_request"},
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"required_capabilities":["network.api","tools.http_request"],
			"graph":{"nodes":[{
				"kind":"tool","node_id":"n0","tool_name":"http_request",
				"metadata":{"target_type":"webhook","policy_preset":"Human-gated","action_name":"refund_charge","request_summary":"apply 064_execution_evals.sql sha256 3471cf5d (auth Bearer leaked-token)"},
				"args":{"method":"POST","url":"https://api.example.test/hook?token=` + secret + `","body":"` + secret + `"}
			}]}
		}`),
		CreatedAt: time.Now().UTC(),
	}

	resp := buildTaskResponse(task)

	require.Equal(t, []string{"network.api", "tools.http_request"}, resp["required_capabilities"])
	require.Equal(t, reason, resp["approval_reason"])
	require.Equal(t, "webhook", resp["action_target_type"])
	require.Equal(t, "Human-gated", resp["policy_preset"])
	require.Equal(t, "refund_charge", resp["action_name"])

	// The caller-provided approval summary is exposed for the reviewer, with
	// inline auth material redacted on the way out.
	summary, _ := resp["request_summary"].(string)
	require.Contains(t, summary, "064_execution_evals.sql")
	require.Contains(t, summary, "[redacted-auth]")
	require.NotContains(t, summary, "Bearer leaked-token")

	// Nothing sensitive from the definition leaks.
	body, err := json.Marshal(resp)
	require.NoError(t, err)
	require.NotContains(t, string(body), secret)
	require.NotContains(t, string(body), "?token=")

	// A metadata action_name that is not a valid action identifier (e.g. a
	// smuggled payload) is dropped rather than echoed.
	hostile := *task
	hostile.TaskDefinition = json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool","node_id":"n0","tool_name":"http_request",
			"metadata":{"action_name":"` + secret + ` with spaces!"}
		}]}
	}`)
	hostileResp := buildTaskResponse(&hostile)
	require.NotContains(t, hostileResp, "action_name")
}

// TestBuildTaskResponseApprovalReasonOnlyForApprovalRuns confirms approval_reason
// is emitted only while awaiting approval — a terminal failed run keeps its
// failure_reason but exposes no approval_reason.
func TestBuildTaskResponseApprovalReasonOnlyForApprovalRuns(t *testing.T) {
	t.Parallel()

	reason := "target returned 500"
	task := &coordinator.TaskRecord{
		TaskID:        uuid.New(),
		Status:        coordinator.TaskStatusFailed,
		FailureReason: &reason,
		CreatedAt:     time.Now().UTC(),
	}

	resp := buildTaskResponse(task)
	require.Equal(t, reason, resp["failure_reason"])
	_, hasApproval := resp["approval_reason"]
	require.False(t, hasApproval, "approval_reason must not be set for a failed run")
}

// TestBuildTaskResponseOmitsUnsafeOrUnknownApprovalEnums proves the enum
// validators drop anything that is not a known-safe target/preset, so arbitrary
// stamped metadata can never leak through these fields. The legacy `api` alias
// is canonicalized.
func TestBuildTaskResponseNormalizesAndValidatesApprovalEnums(t *testing.T) {
	t.Parallel()

	legacy := "api"
	task := &coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusApprovalRequired,
		ExecutedTarget: &legacy,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{"kind":"tool","node_id":"n0","tool_name":"http_request",
				"metadata":{"policy_preset":"Totally Made Up Preset"}}]}
		}`),
		CreatedAt: time.Now().UTC(),
	}

	resp := buildTaskResponse(task)
	require.Equal(t, "hosted_api", resp["action_target_type"], "legacy api alias must canonicalize")
	_, hasPreset := resp["policy_preset"]
	require.False(t, hasPreset, "an unknown policy_preset must be omitted")
}

func TestBuildTaskResponseOmitsEmptyOptionalFields(t *testing.T) {
	t.Parallel()

	task := &coordinator.TaskRecord{
		TaskID:    uuid.New(),
		Status:    coordinator.TaskStatusPending,
		CreatedAt: time.Unix(1_700_000_100, 0).UTC(),
	}

	resp := buildTaskResponse(task)

	require.Equal(t, fiber.Map{
		"terminal":                    false,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            true,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        true,
	}, resp["lifecycle"])
	require.Equal(t, fiber.Map{
		"class":            coordinator.TaskDurabilityClassResumable,
		"streaming":        false,
		"resume_supported": true,
	}, resp["durability"])
	require.Equal(t, fiber.Map{
		"redispatch_eligible": false,
	}, resp["recovery"])
	require.NotContains(t, resp, "failure_reason")
	require.NotContains(t, resp, "failure_details")
	require.NotContains(t, resp, "deadline_at")
	require.NotContains(t, resp, "task_type")
	require.NotContains(t, resp, "requested_mode")
	require.NotContains(t, resp, "resolved_strategy")
	require.NotContains(t, resp, "last_step")
	require.NotContains(t, resp, "checkpoint_digest")
	require.NotContains(t, resp, "checkpoint_runtime_id")
	require.NotContains(t, resp, "checkpoint_summary")
	require.NotContains(t, resp, "checkpoint_metadata")
	require.NotContains(t, resp, "execution_envelope")
	require.NotContains(t, resp, "execution_receipt")
	require.NotContains(t, resp, "receipt")
}

func TestBuildTaskFailureDetailsResponse(t *testing.T) {
	t.Parallel()

	stepIndex := uint32(3)
	requestedLastStep := uint32(2)
	localLastStep := uint32(1)
	resumeCheckpointProvided := true
	resp := buildTaskFailureDetailsResponse(&coordinator.TaskFailureDetails{
		Source:                    "runtime",
		Operation:                 "submit",
		StatusCode:                http.StatusConflict,
		RejectionType:             "idempotency_conflict",
		Message:                   "Idempotency key already used for a different task submission",
		StepIndex:                 &stepIndex,
		Domain:                    "agent",
		NodeID:                    "reason-3",
		RequestedLastStep:         &requestedLastStep,
		LocalLastStep:             &localLastStep,
		RequestedCheckpointDigest: "digest-2",
		LocalCheckpointDigest:     "digest-local",
		ResumeCheckpointProvided:  &resumeCheckpointProvided,
	})

	require.Equal(t, fiber.Map{
		"source":                      "runtime",
		"operation":                   "submit",
		"status_code":                 http.StatusConflict,
		"rejection_type":              "idempotency_conflict",
		"message":                     "Idempotency key already used for a different task submission",
		"step_index":                  uint32(3),
		"domain":                      "agent",
		"node_id":                     "reason-3",
		"requested_last_step":         uint32(2),
		"local_last_step":             uint32(1),
		"requested_checkpoint_digest": "digest-2",
		"local_checkpoint_digest":     "digest-local",
		"resume_checkpoint_provided":  true,
	}, resp)

	reason := "runtime submit rejected (idempotency_conflict): Idempotency key already used for a different task submission"
	require.Equal(t, fiber.Map{
		"reason":      reason,
		"source":      "runtime",
		"operation":   "submit",
		"type":        "idempotency_conflict",
		"message":     "Idempotency key already used for a different task submission",
		"status_code": http.StatusConflict,
		"execution": map[string]interface{}{
			"step_index": uint32(3),
			"domain":     "agent",
			"node_id":    "reason-3",
		},
		"resume": map[string]interface{}{
			"requested_last_step":         uint32(2),
			"local_last_step":             uint32(1),
			"requested_checkpoint_digest": "digest-2",
			"local_checkpoint_digest":     "digest-local",
			"resume_checkpoint_provided":  true,
		},
	}, buildTaskFailureResponse(&reason, &coordinator.TaskFailureDetails{
		Source:                    "runtime",
		Operation:                 "submit",
		StatusCode:                http.StatusConflict,
		RejectionType:             "idempotency_conflict",
		Message:                   "Idempotency key already used for a different task submission",
		StepIndex:                 &stepIndex,
		Domain:                    "agent",
		NodeID:                    "reason-3",
		RequestedLastStep:         &requestedLastStep,
		LocalLastStep:             &localLastStep,
		RequestedCheckpointDigest: "digest-2",
		LocalCheckpointDigest:     "digest-local",
		ResumeCheckpointProvided:  &resumeCheckpointProvided,
	}))
	require.Nil(t, buildTaskFailureDetailsResponse(nil))
	require.Nil(t, buildTaskFailureResponse(nil, nil))
}

func TestBuildTaskProofResponse(t *testing.T) {
	t.Parallel()

	checkedAt := time.Unix(1_700_000_200, 0).UTC()
	resp := buildTaskProofResponse(&coordinator.TaskProofState{
		ExecutionID:  "exec-1",
		ExpectedHash: "hash-expected",
		StoredHash:   "hash-expected",
		Signature:    "sig-proof",
		Status:       "verified",
		CheckedAt:    &checkedAt,
	})

	require.Equal(t, "exec-1", resp["execution_id"])
	require.Equal(t, "hash-expected", resp["expected_hash"])
	require.Equal(t, "hash-expected", resp["stored_hash"])
	require.Equal(t, "sig-proof", resp["signature"])
	require.Equal(t, "verified", resp["status"])
	require.Equal(t, true, resp["needs_refresh"])
	require.Equal(t, false, resp["reconcile_on_read"])
	require.Equal(t, true, resp["present"])
	require.Equal(t, true, resp["matched"])
	require.Equal(t, &checkedAt, resp["checked_at"])
	require.Nil(t, buildTaskProofResponse(nil))
}

func TestBuildTaskProofResponseFreshPendingState(t *testing.T) {
	t.Parallel()

	checkedAt := time.Now().UTC().Add(-10 * time.Second)
	resp := buildTaskProofResponse(&coordinator.TaskProofState{
		ExecutionID: "exec-pending",
		Status:      "pending",
		CheckedAt:   &checkedAt,
	})

	require.Equal(t, "pending", resp["status"])
	require.Equal(t, false, resp["needs_refresh"])
	require.Equal(t, false, resp["reconcile_on_read"])
	require.Equal(t, &checkedAt, resp["checked_at"])
}

func TestBuildTaskProofResponseResolvedStateCanBeStaleWithoutReadReconcile(t *testing.T) {
	t.Parallel()

	checkedAt := time.Unix(1_700_000_200, 0).UTC()
	resp := buildTaskProofResponse(&coordinator.TaskProofState{
		ExecutionID:  "exec-present",
		ExpectedHash: "hash-present",
		StoredHash:   "hash-present",
		Signature:    "sig-present",
		Status:       "present",
		CheckedAt:    &checkedAt,
	})

	require.Equal(t, "present", resp["status"])
	require.Equal(t, true, resp["needs_refresh"])
	require.Equal(t, false, resp["reconcile_on_read"])
	require.Equal(t, true, resp["present"])
}

func TestBuildTaskProofResponseStaleMissingStateReconcilesOnRead(t *testing.T) {
	t.Parallel()

	checkedAt := time.Now().UTC().Add(-3 * time.Minute)
	resp := buildTaskProofResponse(&coordinator.TaskProofState{
		ExecutionID: "exec-missing",
		Status:      "missing",
		CheckedAt:   &checkedAt,
	})

	require.Equal(t, "missing", resp["status"])
	require.Equal(t, true, resp["needs_refresh"])
	require.Equal(t, true, resp["reconcile_on_read"])
}

func TestBuildTaskProofReadinessResponse(t *testing.T) {
	t.Parallel()

	triggerResp := buildTaskProofReadinessResponse(true)
	require.Equal(t, "trigger", triggerResp["proof_sync_mode"])
	require.Equal(t, true, triggerResp["trigger_available"])
	require.Equal(t, true, triggerResp["read_reconciliation_fallback"])

	fallbackResp := buildTaskProofReadinessResponse(false)
	require.Equal(t, "fallback", fallbackResp["proof_sync_mode"])
	require.Equal(t, false, fallbackResp["trigger_available"])
	require.Equal(t, true, fallbackResp["read_reconciliation_fallback"])
}

func TestBuildTaskResponseIncludesCanceledAtWhenPresent(t *testing.T) {
	t.Parallel()

	canceledAt := time.Unix(1_700_000_300, 0).UTC()
	resp := buildTaskResponse(&coordinator.TaskRecord{
		TaskID:     uuid.New(),
		Status:     coordinator.TaskStatusCanceled,
		CanceledAt: &canceledAt,
		CreatedAt:  time.Unix(1_700_000_100, 0).UTC(),
	})

	require.Equal(t, &canceledAt, resp["canceled_at"])
	require.Equal(t, fiber.Map{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, resp["lifecycle"])
	require.Equal(t, fiber.Map{
		"class":            coordinator.TaskDurabilityClassResumable,
		"streaming":        false,
		"resume_supported": true,
	}, resp["durability"])
	require.Equal(t, fiber.Map{
		"redispatch_eligible": false,
		"skip_reason":         "task_canceled",
	}, resp["recovery"])
}

func TestBuildTaskResponseReturnsFiberMap(t *testing.T) {
	t.Parallel()

	resp := buildTaskResponse(&coordinator.TaskRecord{
		TaskID:    uuid.New(),
		Status:    coordinator.TaskStatusCompleted,
		CreatedAt: time.Now().UTC(),
	})

	_, ok := any(resp).(fiber.Map)
	require.True(t, ok)
}

func TestBuildTaskLinks(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()

	// Without an execution_id we still expose task / steps / verify / receipt_verify so consumers know where to poll.
	withoutRun := buildTaskLinks(&coordinator.TaskRecord{
		TaskID:    taskID,
		Status:    coordinator.TaskStatusDispatched,
		CreatedAt: time.Now().UTC(),
	})
	require.Equal(t, "/v1/tasks/"+taskID.String(), withoutRun["task"])
	require.Equal(t, "/v1/tasks/"+taskID.String()+"/steps", withoutRun["steps"])
	require.Equal(t, "/v1/tasks/"+taskID.String()+"/proof/verify", withoutRun["verify"])
	require.Equal(t, "/proof/receipts/verify", withoutRun["receipt_verify"])
	require.NotContains(t, withoutRun, "run")

	// Once a proof.execution_id has been recorded we expose the run-detail link too.
	withRun := buildTaskLinks(&coordinator.TaskRecord{
		TaskID:    taskID,
		Status:    coordinator.TaskStatusCompleted,
		CreatedAt: time.Now().UTC(),
		Proof: &coordinator.TaskProofState{
			ExecutionID: "exec-123",
			Status:      "verified",
		},
	})
	require.Equal(t, "/v1/execution/runs/exec-123", withRun["run"])
}

func TestBuildTaskAcceptedResponse(t *testing.T) {
	t.Parallel()

	createdAt := time.Unix(1_700_000_700, 0).UTC()
	taskID := uuid.New()
	resp := buildTaskAcceptedResponse(&coordinator.TaskRecord{
		TaskID:         taskID,
		Status:         coordinator.TaskStatusDispatched,
		CreatedAt:      createdAt,
		TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}`),
	})

	links, ok := resp["links"].(fiber.Map)
	require.True(t, ok, "links should be present on submit response")
	require.Equal(t, "/v1/tasks/"+taskID.String(), links["task"])
	require.Equal(t, "/v1/tasks/"+taskID.String()+"/proof/verify", links["verify"])

	require.Equal(t, createdAt, resp["created_at"])
	require.Equal(t, "single_inference", resp["task_type"])
	require.Equal(t, fiber.Map{
		"terminal":                    false,
		"runtime_mutation_allowed":    true,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        true,
	}, resp["lifecycle"])
	require.Equal(t, fiber.Map{
		"class":            coordinator.TaskDurabilityClassResumable,
		"streaming":        false,
		"resume_supported": true,
	}, resp["durability"])
	require.Equal(t, fiber.Map{
		"redispatch_eligible": false,
	}, resp["recovery"])
}

func TestHandleTaskSubmitRejectsStreamingSingleInferenceDefinition(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-1")
		return c.Next()
	})
	app.Post("/v1/tasks/submit", handleTaskSubmit(&coordinator.TaskCoordinator{}))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/submit", strings.NewReader(`{
		"task_type":"single_inference",
		"task_definition":{
			"model":"gpt-4.1-mini",
			"messages":[{"role":"user","content":"hello"}],
			"stream":true
		}
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "invalid_task_definition", body["error"])
	require.Contains(t, body["message"], "single_inference.stream=true is not supported on Overture durable tasks")
}

func TestBuildTaskCanceledResponse(t *testing.T) {
	t.Parallel()

	createdAt := time.Unix(1_700_000_800, 0).UTC()
	canceledAt := createdAt.Add(10 * time.Second)
	resp := buildTaskCanceledResponse(&coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusCanceled,
		CreatedAt:      createdAt,
		CanceledAt:     &canceledAt,
		TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}`),
	}, true, false, fiber.Map{
		"status_code":          http.StatusConflict,
		"known":                true,
		"reason":               "task_execution_failed",
		"last_step":            float64(3),
		"checkpoint_digest":    "abc123",
		"checkpoint_persisted": true,
		"durability": fiber.Map{
			"mode":                 "streaming",
			"resume_supported":     false,
			"replay_supported":     false,
			"replay_condition":     "completed-final-output",
			"checkpoint_persisted": true,
		},
	})

	require.Equal(t, true, resp["ok"])
	require.Equal(t, true, resp["runtime_cancel_attempted"])
	require.Equal(t, false, resp["runtime_cancel_signaled"])
	require.Equal(t, fiber.Map{
		"status_code":          http.StatusConflict,
		"known":                true,
		"reason":               "task_execution_failed",
		"last_step":            float64(3),
		"checkpoint_digest":    "abc123",
		"checkpoint_persisted": true,
		"durability": fiber.Map{
			"mode":                 "streaming",
			"resume_supported":     false,
			"replay_supported":     false,
			"replay_condition":     "completed-final-output",
			"checkpoint_persisted": true,
		},
	}, resp["runtime_cancel"])
	require.Equal(t, &canceledAt, resp["canceled_at"])
	require.Equal(t, fiber.Map{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, resp["lifecycle"])
	require.Equal(t, fiber.Map{
		"class":            coordinator.TaskDurabilityClassResumable,
		"streaming":        false,
		"resume_supported": true,
	}, resp["durability"])
	require.Equal(t, fiber.Map{
		"redispatch_eligible": false,
		"skip_reason":         "task_canceled",
	}, resp["recovery"])
}

func TestHandleGetTaskReturnsRecoveryMetadata(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-route"
	runtimeID := "runtime-route"
	failureReason := "no runtime available for recovery"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "overture",
		Operation:     "recovery",
		RejectionType: "no_runtime_available",
		Message:       "no runtime available for recovery",
	}
	completedAt := time.Unix(1_700_001_000, 0).UTC()
	createdAt := completedAt.Add(-2 * time.Minute)
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 11,
			CheckpointDigest:  "digest-11",
			RuntimeID:         runtimeID,
		},
	}

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
			checkpoint,
			"idem-route",
			&failureReason,
			nil,
			&completedAt,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks/:id", handleGetTask(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/"+taskID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "overture",
		"operation":      "recovery",
		"rejection_type": "no_runtime_available",
		"message":        "no runtime available for recovery",
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"class":            string(coordinator.TaskDurabilityClassResumable),
		"streaming":        false,
		"resume_supported": true,
	}, body["durability"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "no_runtime_available_for_recovery",
	}, body["recovery"])
	require.EqualValues(t, 11, body["last_step"])
	require.Equal(t, "digest-11", body["checkpoint_digest"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleListTasksIncludesLifecycleDurabilityAndRecovery(t *testing.T) {
	t.Parallel()

	tenantID := "tenant-list"
	canceledAt := time.Unix(1_700_001_100, 0).UTC()
	createdAt := canceledAt.Add(-3 * time.Minute)
	taskID := uuid.New()

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{"task_id", "proof_status", "proof_checked_at"},
				rows:    nil,
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCanceled,
					"",
					"",
					json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}`),
					nil,
					"idem-list",
					nil,
					&canceledAt,
					nil,
					createdAt,
				)},
			},
		},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks", handleListTasks(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.EqualValues(t, 1, body["total"])

	tasks, ok := body["tasks"].([]any)
	require.True(t, ok)
	require.Len(t, tasks, 1)

	task, ok := tasks[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "canceled", task["status"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, task["lifecycle"])
	require.Equal(t, map[string]any{
		"class":            string(coordinator.TaskDurabilityClassResumable),
		"streaming":        false,
		"resume_supported": true,
	}, task["durability"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_canceled",
	}, task["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleListTasksFiltersByAgentID(t *testing.T) {
	t.Parallel()

	tenantID := "tenant-agent-scope"
	agentID := uuid.New()
	createdAt := time.Unix(1_700_002_000, 0).UTC()
	taskID := uuid.New()

	var sawAgentScope bool
	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{"task_id", "proof_status", "proof_checked_at"},
				rows:    nil,
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				// The agent-scoped listing must constrain on registered_agent_id
				// and pass the parsed agent UUID as an argument — never an
				// unscoped tenant query.
				checkArgs: func(query string, args []driver.NamedValue) {
					require.Contains(t, query, "registered_agent_id = $2")
					var found bool
					for _, a := range args {
						if id, ok := a.Value.(string); ok && id == agentID.String() {
							found = true
						}
						if id, ok := a.Value.([]byte); ok && string(id) == agentID.String() {
							found = true
						}
					}
					require.True(t, found, "expected agent id in query args")
					sawAgentScope = true
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCompleted,
					"",
					"",
					json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hi"}]}`),
					nil,
					"idem-agent",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
		},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks", handleListTasks(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks?agent_id="+agentID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.EqualValues(t, 1, body["total"])
	require.True(t, sawAgentScope, "agent-scoped query was not issued")
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleListTasksRejectsInvalidAgentID(t *testing.T) {
	t.Parallel()

	tenantID := "tenant-bad-agent"
	// RefreshPendingProofStates runs before the agent_id is validated; a malformed
	// id then yields 400 without ever issuing an unscoped tenant listing.
	db, _ := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{"task_id", "proof_status", "proof_checked_at"},
				rows:    nil,
			},
		},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks", handleListTasks(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks?agent_id=not-a-uuid", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "invalid_agent_id", body["error"])
}

func TestHandleGetTaskReturnsRuntimeSubmitConflictFailureReason(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-runtime-submit-conflict"
	runtimeID := "runtime-conflict"
	failureReason := "runtime submit rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "submit",
		StatusCode:    http.StatusConflict,
		RejectionType: "checkpoint_mismatch",
		Message:       "Checkpoint digest mismatch - WAL state diverged",
	}
	createdAt := time.Unix(1_700_001_150, 0).UTC()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
			nil,
			"idem-runtime-submit-conflict",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks/:id", handleGetTask(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/"+taskID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "submit",
		"status_code":    float64(http.StatusConflict),
		"rejection_type": "checkpoint_mismatch",
		"message":        "Checkpoint digest mismatch - WAL state diverged",
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"reason":      failureReason,
		"source":      "runtime",
		"operation":   "submit",
		"status_code": float64(http.StatusConflict),
		"type":        "checkpoint_mismatch",
		"message":     "Checkpoint digest mismatch - WAL state diverged",
	}, body["failure"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleGetTaskReturnsRuntimeResumeConflictFailureReason(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-runtime-resume-conflict"
	runtimeID := "runtime-recovery-conflict"
	failureReason := "runtime resume rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged"
	requestedLastStep := uint32(7)
	resumeCheckpointProvided := true
	failureDetails := &coordinator.TaskFailureDetails{
		Source:                    "runtime",
		Operation:                 "resume",
		StatusCode:                http.StatusConflict,
		RejectionType:             "checkpoint_mismatch",
		Message:                   "Checkpoint digest mismatch - WAL state diverged",
		RequestedLastStep:         &requestedLastStep,
		RequestedCheckpointDigest: "digest-7",
		LocalCheckpointDigest:     "digest-local",
		ResumeCheckpointProvided:  &resumeCheckpointProvided,
	}
	createdAt := time.Unix(1_700_001_160, 0).UTC()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
			nil,
			"idem-runtime-resume-conflict",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks/:id", handleGetTask(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/"+taskID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":                      "runtime",
		"operation":                   "resume",
		"status_code":                 float64(http.StatusConflict),
		"rejection_type":              "checkpoint_mismatch",
		"message":                     "Checkpoint digest mismatch - WAL state diverged",
		"requested_last_step":         float64(7),
		"requested_checkpoint_digest": "digest-7",
		"local_checkpoint_digest":     "digest-local",
		"resume_checkpoint_provided":  true,
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"reason":      failureReason,
		"source":      "runtime",
		"operation":   "resume",
		"status_code": float64(http.StatusConflict),
		"type":        "checkpoint_mismatch",
		"message":     "Checkpoint digest mismatch - WAL state diverged",
		"resume": map[string]any{
			"requested_last_step":         float64(7),
			"requested_checkpoint_digest": "digest-7",
			"local_checkpoint_digest":     "digest-local",
			"resume_checkpoint_provided":  true,
		},
	}, body["failure"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleGetTaskReturnsRuntimeExecutionFailureDetails(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-runtime-execution-failure"
	runtimeID := "runtime-execution-failure"
	stepIndex := uint32(3)
	failureReason := "Step 3 failed: approval required for tool execution"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "execution",
		RejectionType: "step_failed",
		Message:       "approval required for tool execution",
		StepIndex:     &stepIndex,
		Domain:        "tool",
		NodeID:        "tool-3",
	}
	createdAt := time.Unix(1_700_001_170, 0).UTC()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"tool-3","tool_name":"web.search"}]}}`),
			nil,
			"idem-runtime-execution-failure",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks/:id", handleGetTask(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/"+taskID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "execution",
		"rejection_type": "step_failed",
		"message":        "approval required for tool execution",
		"step_index":     float64(3),
		"domain":         "tool",
		"node_id":        "tool-3",
	}, body["failure_details"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleGetTaskReturnsRuntimeExecutionFailureDetailsWithCheckpointProgress(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-runtime-execution-failure-checkpoint"
	runtimeID := "runtime-execution-failure-checkpoint"
	stepIndex := uint32(5)
	failureReason := "Step 5 failed: approval required for tool execution"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "execution",
		RejectionType: "step_failed",
		Message:       "approval required for tool execution",
		StepIndex:     &stepIndex,
		Domain:        "tool",
		NodeID:        "tool-5",
	}
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 5,
			CheckpointDigest:  "digest-5",
			RuntimeID:         runtimeID,
		},
		WalEntries: []coordinator.WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 5, RuntimeID: runtimeID}},
		Metadata:   json.RawMessage(`{"domain":"tool","node_id":"tool-5"}`),
		CapturedAt: time.Unix(1_700_001_180, 0).UTC(),
	}
	createdAt := time.Unix(1_700_001_181, 0).UTC()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"tool-5","tool_name":"web.search"}]}}`),
			checkpoint,
			"idem-runtime-execution-failure-checkpoint",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks/:id", handleGetTask(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/"+taskID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "execution",
		"rejection_type": "step_failed",
		"message":        "approval required for tool execution",
		"step_index":     float64(5),
		"domain":         "tool",
		"node_id":        "tool-5",
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"reason":    failureReason,
		"source":    "runtime",
		"operation": "execution",
		"type":      "step_failed",
		"message":   "approval required for tool execution",
		"execution": map[string]any{
			"step_index": float64(5),
			"domain":     "tool",
			"node_id":    "tool-5",
		},
	}, body["failure"])
	require.EqualValues(t, 5, body["last_step"])
	require.Equal(t, "digest-5", body["checkpoint_digest"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleListTasksIncludesRuntimeSubmitConflictFailureReason(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-runtime-submit-list"
	runtimeID := "runtime-conflict-list"
	failureReason := "runtime submit rejected (idempotency_conflict): Idempotency key already used for a different task submission"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "submit",
		StatusCode:    http.StatusConflict,
		RejectionType: "idempotency_conflict",
		Message:       "Idempotency key already used for a different task submission",
	}
	createdAt := time.Unix(1_700_001_175, 0).UTC()

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{"task_id", "proof_status", "proof_checked_at"},
				rows:    nil,
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusFailed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"agent_workflow","steps":[{"step_index":1,"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}]}`),
					nil,
					"idem-runtime-submit-list",
					&failureReason,
					nil,
					nil,
					createdAt,
					failureDetails,
				)},
			},
		},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Get("/v1/tasks", handleListTasks(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.EqualValues(t, 1, body["total"])

	tasks, ok := body["tasks"].([]any)
	require.True(t, ok)
	require.Len(t, tasks, 1)

	task, ok := tasks[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "failed", task["status"])
	require.Equal(t, failureReason, task["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "submit",
		"status_code":    float64(http.StatusConflict),
		"rejection_type": "idempotency_conflict",
		"message":        "Idempotency key already used for a different task submission",
	}, task["failure_details"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, task["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleTaskCheckpointReturnsLifecycleMetadata(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-checkpoint"
	runtimeID := "runtime-checkpoint"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_200, 0).UTC()
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 12,
			CheckpointDigest:  "digest-12",
			RuntimeID:         runtimeID,
		},
		WalEntries: []coordinator.WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 12, RuntimeID: runtimeID},
		},
	}

	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusDispatched,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-checkpoint",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{"last_checkpoint"},
				rows:    [][]driver.Value{{nil}},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCheckpointed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					checkpoint,
					"idem-checkpoint",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 1},
		queuedRouteExecExpectation{rowsAffected: 1},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/checkpoint", handleTaskCheckpoint(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/checkpoint", strings.NewReader(string(checkpointBytes)))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "checkpoint", checkpointBytes)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, true, body["ok"])
	require.EqualValues(t, 12, body["step"])
	require.Equal(t, "checkpointed", body["status"])
	require.Equal(t, "digest-12", body["checkpoint_digest"])
	require.Equal(t, map[string]any{
		"terminal":                    false,
		"runtime_mutation_allowed":    true,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        true,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCheckpointRejectsWrongRuntime(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-checkpoint-runtime-mismatch"
	runtimeID := "runtime-assigned"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_450, 0).UTC()
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 0,
			CheckpointDigest:  "digest-0",
			RuntimeID:         "runtime-wrong",
		},
	}
	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{
				"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
				"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
				"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
				"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
				"idempotency_key", "failure_reason", "failure_details",
				"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
			},
			rows: [][]driver.Value{taskRecordRouteRow(
				taskID,
				tenantID,
				coordinator.TaskStatusDispatched,
				runtimeID,
				"http://runtime.test",
				json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[]}}`),
				nil,
				"idem-checkpoint-runtime-mismatch",
				nil,
				nil,
				nil,
				createdAt,
			)},
		},
		runtimePublicKeyQueryExpectation(signing.publicKey),
	}, runtimeCallbackNonceExecExpectation(), queuedRouteExecExpectation{rowsAffected: 1})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/checkpoint", handleTaskCheckpoint(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/checkpoint", strings.NewReader(string(checkpointBytes)))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "checkpoint", checkpointBytes)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "runtime_callback_rejected", body["error"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCompleteRejectsWrongRuntimeHeader(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-complete-runtime-mismatch"
	runtimeID := "runtime-assigned"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_460, 0).UTC()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{
				"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
				"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
				"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
				"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
				"idempotency_key", "failure_reason", "failure_details",
				"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
			},
			rows: [][]driver.Value{taskRecordRouteRow(
				taskID,
				tenantID,
				coordinator.TaskStatusDispatched,
				runtimeID,
				"http://runtime.test",
				json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[]}}`),
				nil,
				"idem-complete-runtime-mismatch",
				nil,
				nil,
				nil,
				createdAt,
			)},
		},
		runtimePublicKeyQueryExpectation(signing.publicKey),
	}, runtimeCallbackNonceExecExpectation(), queuedRouteExecExpectation{rowsAffected: 1})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", nil)
	req.Header.Set("X-Igris-Runtime-ID", "runtime-wrong")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "complete", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "runtime_callback_rejected", body["error"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeCallbackEnvelopeRejectionPathsPersistViolations(t *testing.T) {
	t.Setenv("IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS", "")

	testCases := []struct {
		name       string
		header     func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string
		queries    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation
		execs      []queuedRouteExecExpectation
		wantStatus int
	}{
		{
			name: "missing envelope",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return ""
			},
			queries:    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation { return nil },
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "malformed envelope",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return "not-valid-base64"
			},
			queries:    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation { return nil },
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "stale timestamp",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, taskID, runtimeID, "complete", body, uuid.NewString(), time.Now().Add(-10*time.Minute), true)
			},
			queries:    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation { return nil },
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "body digest mismatch",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, taskID, runtimeID, "complete", []byte(`{"tampered":false}`), uuid.NewString(), time.Now(), true)
			},
			queries:    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation { return nil },
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "callback type mismatch",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, taskID, runtimeID, "failed", body, uuid.NewString(), time.Now(), true)
			},
			queries:    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation { return nil },
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "task mismatch",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, uuid.New(), runtimeID, "complete", body, uuid.NewString(), time.Now(), true)
			},
			queries:    func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation { return nil },
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "missing signature",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, taskID, runtimeID, "complete", body, uuid.NewString(), time.Now(), false)
			},
			queries: func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation {
				return []queuedRouteQueryExpectation{runtimePublicKeyQueryExpectation(signing.publicKey)}
			},
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "unknown runtime key",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, taskID, runtimeID, "complete", body, uuid.NewString(), time.Now(), true)
			},
			queries: func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation {
				return []queuedRouteQueryExpectation{{columns: []string{"public_key_ed25519"}, rows: nil}}
			},
			execs:      []queuedRouteExecExpectation{{rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "replayed nonce",
			header: func(t *testing.T, signing signedRuntimeCallbackFixture, tenantID string, taskID uuid.UUID, runtimeID string, body []byte) string {
				return runtimeCallbackHeaderWithOptions(t, signing, tenantID, taskID, runtimeID, "complete", body, "nonce-replay", time.Now(), true)
			},
			queries: func(signing signedRuntimeCallbackFixture) []queuedRouteQueryExpectation {
				return []queuedRouteQueryExpectation{runtimePublicKeyQueryExpectation(signing.publicKey)}
			},
			execs:      []queuedRouteExecExpectation{{rowsAffected: 0}, {rowsAffected: 1}},
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			taskID := uuid.New()
			tenantID := "tenant-callback-rejection"
			runtimeID := "runtime-callback-rejection"
			signing := newSignedRuntimeCallbackFixture(t)
			bodyBytes := []byte(`{}`)

			queries := []queuedRouteQueryExpectation{
				runtimeCallbackTaskQuery(taskID, tenantID, coordinator.TaskStatusDispatched, runtimeID, time.Now().UTC()),
			}
			queries = append(queries, tc.queries(signing)...)
			db, queued := newQueuedRouteDB(t, queries, tc.execs...)

			app := fiber.New()
			app.Use(func(c *fiber.Ctx) error {
				c.Locals("clerk_user_id", tenantID)
				return c.Next()
			})
			app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

			req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", strings.NewReader(string(bodyBytes)))
			req.Header.Set("Content-Type", "application/json")
			if header := tc.header(t, signing, tenantID, taskID, runtimeID, bodyBytes); header != "" {
				req.Header.Set(runtimeCallbackEnvelopeHeader, header)
			}
			resp, err := app.Test(req)
			require.NoError(t, err)
			require.Equal(t, tc.wantStatus, resp.StatusCode)
			var response map[string]any
			require.NoError(t, json.NewDecoder(resp.Body).Decode(&response))
			require.Equal(t, "runtime_callback_rejected", response["error"])
			require.Equal(t, 0, queued.remainingQueries())
			require.Equal(t, 0, queued.remainingExecs())
		})
	}
}

func TestHandleTaskCompleteRejectsTerminalSignedCallbackAndPersistsViolation(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-terminal-callback"
	runtimeID := "runtime-terminal-callback"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_465, 0).UTC()

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			runtimeCallbackTaskQuery(taskID, tenantID, coordinator.TaskStatusCompleted, runtimeID, createdAt),
			runtimePublicKeyQueryExpectation(signing.publicKey),
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 1},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", nil)
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "complete", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "completed", body["status"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCompleteReturnsLifecycleMetadata(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-complete"
	runtimeID := "runtime-complete"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_300, 0).UTC()
	completedAt := createdAt.Add(30 * time.Second)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCheckpointed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
					nil,
					"idem-complete",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCompleted,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
					nil,
					"idem-complete",
					nil,
					nil,
					&completedAt,
					createdAt,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 1},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", nil)
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "complete", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, true, body["ok"])
	require.Equal(t, "completed", body["status"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_completed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskFailedReturnsRecoveryMetadata(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-failed"
	runtimeID := "runtime-failed"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_400, 0).UTC()
	failureReason := "runtime surfaced late failure"
	requestBody := []byte(`{"reason":"` + failureReason + `"}`)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusRecovering,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-failed",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusFailed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-failed",
					&failureReason,
					nil,
					nil,
					createdAt,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 1},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/failed", handleTaskFailed(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/failed", strings.NewReader(string(requestBody)))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "failed", requestBody)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, true, body["ok"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCheckpointReturnsTransitionRejectedPayloadAfterConcurrentCancel(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-checkpoint-conflict"
	runtimeID := "runtime-checkpoint-conflict"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_500, 0).UTC()
	canceledAt := createdAt.Add(20 * time.Second)
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 13,
			CheckpointDigest:  "digest-13",
			RuntimeID:         runtimeID,
		},
		WalEntries: []coordinator.WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 13, RuntimeID: runtimeID},
		},
	}

	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusDispatched,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-checkpoint-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{"last_checkpoint"},
				rows:    [][]driver.Value{{nil}},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCanceled,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-checkpoint-conflict",
					nil,
					&canceledAt,
					nil,
					createdAt,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/checkpoint", handleTaskCheckpoint(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/checkpoint", strings.NewReader(string(checkpointBytes)))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "checkpoint", checkpointBytes)
	resp, err := app.Test(req)
	require.NoError(t, err)
	if resp.StatusCode != http.StatusConflict {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, want %d, body=%s", resp.StatusCode, http.StatusConflict, string(raw))
	}
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "canceled", body["status"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"class":            string(coordinator.TaskDurabilityClassResumable),
		"streaming":        false,
		"resume_supported": true,
	}, body["durability"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_canceled",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCompleteReturnsTransitionRejectedPayloadAfterConcurrentCancel(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-complete-conflict"
	runtimeID := "runtime-complete-conflict"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_600, 0).UTC()
	canceledAt := createdAt.Add(25 * time.Second)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCheckpointed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
					nil,
					"idem-complete-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCanceled,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
					nil,
					"idem-complete-conflict",
					nil,
					&canceledAt,
					nil,
					createdAt,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", nil)
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "complete", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "canceled", body["status"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_canceled",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskFailedReturnsTransitionRejectedPayloadAfterConcurrentCancel(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-failed-conflict"
	runtimeID := "runtime-failed-conflict"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_700, 0).UTC()
	canceledAt := createdAt.Add(40 * time.Second)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusRecovering,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-failed-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCanceled,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-failed-conflict",
					nil,
					&canceledAt,
					nil,
					createdAt,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/failed", handleTaskFailed(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/failed", strings.NewReader(`{"reason":"runtime surfaced late failure"}`))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "failed", []byte(`{"reason":"runtime surfaced late failure"}`))
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "canceled", body["status"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_canceled",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCheckpointReturnsTransitionRejectedPayloadAfterConcurrentFailed(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-checkpoint-failed-conflict"
	runtimeID := "runtime-checkpoint-failed-conflict"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_710, 0).UTC()
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 17,
			CheckpointDigest:  "digest-17",
			RuntimeID:         runtimeID,
		},
		WalEntries: []coordinator.WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 17, RuntimeID: runtimeID},
		},
	}
	failureReason := "Step 3 failed: approval required for tool execution"
	stepIndex := uint32(3)
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "execution",
		RejectionType: "step_failed",
		Message:       "approval required for tool execution",
		StepIndex:     &stepIndex,
		Domain:        "tool",
		NodeID:        "tool-3",
	}

	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusDispatched,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-checkpoint-failed-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{"last_checkpoint"},
				rows:    [][]driver.Value{{nil}},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusFailed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-checkpoint-failed-conflict",
					&failureReason,
					nil,
					nil,
					createdAt,
					failureDetails,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/checkpoint", handleTaskCheckpoint(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/checkpoint", strings.NewReader(string(checkpointBytes)))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "checkpoint", checkpointBytes)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "execution",
		"rejection_type": "step_failed",
		"message":        "approval required for tool execution",
		"step_index":     float64(3),
		"domain":         "tool",
		"node_id":        "tool-3",
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, body["lifecycle"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCompleteReturnsTransitionRejectedPayloadAfterConcurrentFailed(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-complete-failed-conflict"
	runtimeID := "runtime-complete-failed-conflict"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_720, 0).UTC()
	failureReason := "runtime resume rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "resume",
		StatusCode:    http.StatusConflict,
		RejectionType: "checkpoint_mismatch",
		Message:       "Checkpoint digest mismatch - WAL state diverged",
	}

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCheckpointed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
					nil,
					"idem-complete-failed-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusFailed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
					nil,
					"idem-complete-failed-conflict",
					&failureReason,
					nil,
					nil,
					createdAt,
					failureDetails,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", nil)
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "complete", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "resume",
		"status_code":    float64(http.StatusConflict),
		"rejection_type": "checkpoint_mismatch",
		"message":        "Checkpoint digest mismatch - WAL state diverged",
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskFailedReturnsTransitionRejectedPayloadAfterConcurrentFailed(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-failed-failed-conflict"
	runtimeID := "runtime-failed-failed-conflict"
	signing := newSignedRuntimeCallbackFixture(t)
	createdAt := time.Unix(1_700_001_730, 0).UTC()
	failureReason := "no runtime available for recovery"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "overture",
		Operation:     "recovery",
		RejectionType: "no_runtime_available",
		Message:       "no runtime available for recovery",
	}

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusRecovering,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-failed-failed-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			runtimePublicKeyQueryExpectation(signing.publicKey),
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusFailed,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
					nil,
					"idem-failed-failed-conflict",
					&failureReason,
					nil,
					nil,
					createdAt,
					failureDetails,
				)},
			},
		},
		runtimeCallbackNonceExecExpectation(),
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/failed", handleTaskFailed(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/failed", strings.NewReader(`{"reason":"runtime surfaced late failure"}`))
	req.Header.Set("Content-Type", "application/json")
	attachRuntimeCallbackHeader(t, req, signing, tenantID, taskID, runtimeID, "failed", []byte(`{"reason":"runtime surfaced late failure"}`))
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "overture",
		"operation":      "recovery",
		"rejection_type": "no_runtime_available",
		"message":        "no runtime available for recovery",
	}, body["failure_details"])
	require.Equal(t, map[string]any{
		"redispatch_eligible": false,
		"skip_reason":         "no_runtime_available_for_recovery",
	}, body["recovery"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCancelReturnsTransitionRejectedPayloadForStructuredFailedTask(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-cancel-direct-failed-conflict"
	runtimeID := "runtime-cancel-direct-failed-conflict"
	createdAt := time.Unix(1_700_001_740, 0).UTC()
	failureReason := "runtime resume rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "resume",
		StatusCode:    http.StatusConflict,
		RejectionType: "checkpoint_mismatch",
		Message:       "Checkpoint digest mismatch - WAL state diverged",
	}

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"behavior_tree","tree":{"root":{"type":"sequence","children":[]}}}`),
			nil,
			"idem-cancel-direct-failed-conflict",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/cancel", handleTaskCancel(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/cancel", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "resume",
		"status_code":    float64(http.StatusConflict),
		"rejection_type": "checkpoint_mismatch",
		"message":        "Checkpoint digest mismatch - WAL state diverged",
	}, body["failure_details"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleTaskCancelReturnsRuntimeCancelConflictSnapshot(t *testing.T) {
	taskID := uuid.New()
	tenantID := "tenant-cancel-runtime-conflict"
	runtimeID := "runtime-cancel-conflict"
	createdAt := time.Unix(1_700_001_780, 0).UTC()
	canceledAt := createdAt.Add(30 * time.Second)

	originalRuntimeCancelTask := runtimeCancelTask
	runtimeCancelTask = func(_ context.Context, runtimeEndpoint string, incomingTaskID uuid.UUID, incomingTenantID string) (*internal.RuntimeCancelResult, error) {
		require.Equal(t, "http://runtime.test", runtimeEndpoint)
		require.Equal(t, taskID, incomingTaskID)
		require.Equal(t, tenantID, incomingTenantID)
		return &internal.RuntimeCancelResult{
			StatusCode: http.StatusConflict,
			Payload: map[string]any{
				"task_id":              taskID.String(),
				"canceled":             false,
				"known":                true,
				"active_execution":     false,
				"cancellation_allowed": false,
				"reason":               "task_execution_failed",
				"status": map[string]any{
					"status": "failed",
					"reason": "tool approval denied",
				},
				"checkpoint_persisted": true,
				"last_step":            float64(4),
				"checkpoint_digest":    "digest-4",
				"durability": map[string]any{
					"mode":                 "streaming",
					"resume_supported":     false,
					"replay_supported":     false,
					"replay_condition":     "completed-final-output",
					"checkpoint_persisted": true,
				},
				"failure_details": map[string]any{
					"source":         "runtime",
					"operation":      "execution",
					"rejection_type": "step_failed",
					"message":        "tool approval denied",
					"step_index":     float64(4),
					"domain":         "tool",
					"node_id":        "tool-4",
				},
			},
		}, nil
	}
	t.Cleanup(func() {
		runtimeCancelTask = originalRuntimeCancelTask
	})

	db, queued := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusDispatched,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"tool-4","tool_name":"approval"}]}}`),
					nil,
					"idem-cancel-runtime-conflict",
					nil,
					nil,
					nil,
					createdAt,
				)},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				rows: [][]driver.Value{taskRecordRouteRow(
					taskID,
					tenantID,
					coordinator.TaskStatusCanceled,
					runtimeID,
					"http://runtime.test",
					json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"tool-4","tool_name":"approval"}]}}`),
					nil,
					"idem-cancel-runtime-conflict",
					nil,
					&canceledAt,
					nil,
					createdAt,
				)},
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1},
	)

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/cancel", handleTaskCancel(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/cancel", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, true, body["ok"])
	require.Equal(t, "canceled", body["status"])
	require.Equal(t, true, body["runtime_cancel_attempted"])
	require.Equal(t, false, body["runtime_cancel_signaled"])

	runtimeCancel, ok := body["runtime_cancel"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(http.StatusConflict), runtimeCancel["status_code"])
	require.Equal(t, "task_execution_failed", runtimeCancel["reason"])
	require.Equal(t, true, runtimeCancel["known"])
	require.Equal(t, false, runtimeCancel["active_execution"])
	require.Equal(t, true, runtimeCancel["checkpoint_persisted"])
	require.Equal(t, float64(4), runtimeCancel["last_step"])
	require.Equal(t, "digest-4", runtimeCancel["checkpoint_digest"])
	require.Equal(t, map[string]any{
		"mode":                 "streaming",
		"resume_supported":     false,
		"replay_supported":     false,
		"replay_condition":     "completed-final-output",
		"checkpoint_persisted": true,
	}, runtimeCancel["durability"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "execution",
		"rejection_type": "step_failed",
		"message":        "tool approval denied",
		"step_index":     float64(4),
		"domain":         "tool",
		"node_id":        "tool-4",
	}, runtimeCancel["failure_details"])
	require.Equal(t, map[string]any{
		"reason":    "task_execution_failed",
		"source":    "runtime",
		"operation": "execution",
		"type":      "step_failed",
		"message":   "tool approval denied",
		"execution": map[string]any{
			"step_index": float64(4),
			"domain":     "tool",
			"node_id":    "tool-4",
		},
	}, runtimeCancel["failure"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleTaskCheckpointReturnsTransitionRejectedPayloadForStructuredFailedTask(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-checkpoint-direct-failed-conflict"
	runtimeID := "runtime-checkpoint-direct-failed-conflict"
	createdAt := time.Unix(1_700_001_750, 0).UTC()
	failureReason := "Step 4 failed: approval required for tool execution"
	stepIndex := uint32(4)
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "execution",
		RejectionType: "step_failed",
		Message:       "approval required for tool execution",
		StepIndex:     &stepIndex,
		Domain:        "tool",
		NodeID:        "tool-4",
	}
	checkpoint := &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 21,
			CheckpointDigest:  "digest-21",
			RuntimeID:         runtimeID,
		},
		WalEntries: []coordinator.WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 21, RuntimeID: runtimeID},
		},
	}
	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"tool-4","tool_name":"web.search"}]}}`),
			nil,
			"idem-checkpoint-direct-failed-conflict",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/checkpoint", handleTaskCheckpoint(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/checkpoint", strings.NewReader(string(checkpointBytes)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "execution",
		"rejection_type": "step_failed",
		"message":        "approval required for tool execution",
		"step_index":     float64(4),
		"domain":         "tool",
		"node_id":        "tool-4",
	}, body["failure_details"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleTaskCompleteReturnsTransitionRejectedPayloadForStructuredFailedTask(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-complete-direct-failed-conflict"
	runtimeID := "runtime-complete-direct-failed-conflict"
	createdAt := time.Unix(1_700_001_760, 0).UTC()
	failureReason := "no runtime available for recovery"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "overture",
		Operation:     "recovery",
		RejectionType: "no_runtime_available",
		Message:       "no runtime available for recovery",
	}

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
			nil,
			"idem-complete-direct-failed-conflict",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/complete", handleTaskComplete(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/complete", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "overture",
		"operation":      "recovery",
		"rejection_type": "no_runtime_available",
		"message":        "no runtime available for recovery",
	}, body["failure_details"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestHandleTaskFailedReturnsTransitionRejectedPayloadForStructuredFailedTask(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-failed-direct-failed-conflict"
	runtimeID := "runtime-failed-direct-failed-conflict"
	createdAt := time.Unix(1_700_001_770, 0).UTC()
	failureReason := "runtime submit rejected (idempotency_conflict): Idempotency key already used for a different task submission"
	failureDetails := &coordinator.TaskFailureDetails{
		Source:        "runtime",
		Operation:     "submit",
		StatusCode:    http.StatusConflict,
		RejectionType: "idempotency_conflict",
		Message:       "Idempotency key already used for a different task submission",
	}

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
			"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
			"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
			"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
			"idempotency_key", "failure_reason", "failure_details",
			"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
		},
		rows: [][]driver.Value{taskRecordRouteRow(
			taskID,
			tenantID,
			coordinator.TaskStatusFailed,
			runtimeID,
			"http://runtime.test",
			json.RawMessage(`{"type":"agent_workflow","steps":[{"step_index":1,"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}]}`),
			nil,
			"idem-failed-direct-failed-conflict",
			&failureReason,
			nil,
			nil,
			createdAt,
			failureDetails,
		)},
	}})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	app.Post("/v1/tasks/:id/failed", handleTaskFailed(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/tasks/"+taskID.String()+"/failed", strings.NewReader(`{"reason":"runtime surfaced late failure"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "task_transition_rejected", body["error"])
	require.Equal(t, "failed", body["status"])
	require.Equal(t, failureReason, body["failure_reason"])
	require.Equal(t, map[string]any{
		"source":         "runtime",
		"operation":      "submit",
		"status_code":    float64(http.StatusConflict),
		"rejection_type": "idempotency_conflict",
		"message":        "Idempotency key already used for a different task submission",
	}, body["failure_details"])
	require.Equal(t, 0, queued.remainingQueries())
}

func TestBuildTaskLifecycleResponse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status coordinator.TaskRecordStatus
		want   fiber.Map
	}{
		{
			name:   "pending",
			status: coordinator.TaskStatusPending,
			want: fiber.Map{
				"terminal":                    false,
				"runtime_mutation_allowed":    false,
				"dispatch_allowed":            true,
				"recovery_redispatch_allowed": false,
				"cancellation_allowed":        true,
			},
		},
		{
			name:   "recovering",
			status: coordinator.TaskStatusRecovering,
			want: fiber.Map{
				"terminal":                    false,
				"runtime_mutation_allowed":    true,
				"dispatch_allowed":            true,
				"recovery_redispatch_allowed": true,
				"cancellation_allowed":        true,
			},
		},
		{
			name:   "completed",
			status: coordinator.TaskStatusCompleted,
			want: fiber.Map{
				"terminal":                    true,
				"runtime_mutation_allowed":    false,
				"dispatch_allowed":            false,
				"recovery_redispatch_allowed": false,
				"cancellation_allowed":        false,
			},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, test.want, buildTaskLifecycleResponse(test.status))
		})
	}
}

func TestBuildTaskDurabilityResponse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		task *coordinator.TaskRecord
		want fiber.Map
	}{
		{
			name: "resumable task",
			task: &coordinator.TaskRecord{
				TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}`),
			},
			want: fiber.Map{
				"class":            coordinator.TaskDurabilityClassResumable,
				"streaming":        false,
				"resume_supported": true,
			},
		},
		{
			name: "streaming non resumable task",
			task: &coordinator.TaskRecord{
				TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
			},
			want: fiber.Map{
				"class":            coordinator.TaskDurabilityClassStreamingNonResumable,
				"streaming":        true,
				"resume_supported": false,
			},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, test.want, buildTaskDurabilityResponse(test.task))
		})
	}
}

func TestBuildTaskRecoveryResponse(t *testing.T) {
	t.Parallel()

	noRuntimeForRecovery := "no runtime available for recovery"
	invalidRecoveryCheckpoint := coordinator.TaskFailureReasonInvalidRecoveryCheckpoint
	streamingUnsupported := coordinator.TaskFailureReasonStreamingResumeUnsupported
	tests := []struct {
		name string
		task *coordinator.TaskRecord
		want fiber.Map
	}{
		{
			name: "nil task",
			task: nil,
			want: fiber.Map{
				"redispatch_eligible": false,
			},
		},
		{
			name: "recovering task",
			task: &coordinator.TaskRecord{Status: coordinator.TaskStatusRecovering},
			want: fiber.Map{
				"redispatch_eligible": true,
			},
		},
		{
			name: "canceled task",
			task: &coordinator.TaskRecord{Status: coordinator.TaskStatusCanceled},
			want: fiber.Map{
				"redispatch_eligible": false,
				"skip_reason":         "task_canceled",
			},
		},
		{
			name: "completed task",
			task: &coordinator.TaskRecord{Status: coordinator.TaskStatusCompleted},
			want: fiber.Map{
				"redispatch_eligible": false,
				"skip_reason":         "task_completed",
			},
		},
		{
			name: "recovering streaming task",
			task: &coordinator.TaskRecord{
				Status:         coordinator.TaskStatusRecovering,
				TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
			},
			want: fiber.Map{
				"redispatch_eligible": false,
				"skip_reason":         "streaming_resume_unsupported",
			},
		},
		{
			name: "failed recovery exhaustion",
			task: &coordinator.TaskRecord{
				Status:        coordinator.TaskStatusFailed,
				FailureReason: &noRuntimeForRecovery,
			},
			want: fiber.Map{
				"redispatch_eligible": false,
				"skip_reason":         "no_runtime_available_for_recovery",
			},
		},
		{
			name: "failed invalid recovery checkpoint",
			task: &coordinator.TaskRecord{
				Status:        coordinator.TaskStatusFailed,
				FailureReason: &invalidRecoveryCheckpoint,
			},
			want: fiber.Map{
				"redispatch_eligible": false,
				"skip_reason":         "invalid_recovery_checkpoint",
			},
		},
		{
			name: "failed streaming unsupported",
			task: &coordinator.TaskRecord{
				Status:         coordinator.TaskStatusFailed,
				FailureReason:  &streamingUnsupported,
				TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
			},
			want: fiber.Map{
				"redispatch_eligible": false,
				"skip_reason":         "streaming_resume_unsupported",
			},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, test.want, buildTaskRecoveryResponse(test.task))
		})
	}
}

func TestBuildTaskTransitionRejectedPayloadIncludesLifecycle(t *testing.T) {
	t.Parallel()

	completedAt := time.Unix(1_700_000_500, 0).UTC()
	failureReason := "runtime unavailable during recovery"
	resp := buildTaskTransitionRejectedPayload(&coordinator.TaskRecord{
		TaskID:        uuid.New(),
		Status:        coordinator.TaskStatusFailed,
		CompletedAt:   &completedAt,
		FailureReason: &failureReason,
		FailureDetails: &coordinator.TaskFailureDetails{
			Source:        "runtime",
			Operation:     "resume",
			StatusCode:    http.StatusConflict,
			RejectionType: "checkpoint_mismatch",
			Message:       "Checkpoint digest mismatch - WAL state diverged",
		},
	})

	require.Equal(t, "task_transition_rejected", resp["error"])
	require.Equal(t, coordinator.TaskStatusFailed, resp["status"])
	require.Equal(t, &completedAt, resp["completed_at"])
	require.Equal(t, failureReason, resp["failure_reason"])
	require.Equal(t, fiber.Map{
		"source":         "runtime",
		"operation":      "resume",
		"status_code":    http.StatusConflict,
		"rejection_type": "checkpoint_mismatch",
		"message":        "Checkpoint digest mismatch - WAL state diverged",
	}, resp["failure_details"])
	require.Equal(t, fiber.Map{
		"reason":      failureReason,
		"source":      "runtime",
		"operation":   "resume",
		"status_code": http.StatusConflict,
		"type":        "checkpoint_mismatch",
		"message":     "Checkpoint digest mismatch - WAL state diverged",
	}, resp["failure"])
	require.Equal(t, fiber.Map{
		"terminal":                    true,
		"runtime_mutation_allowed":    false,
		"dispatch_allowed":            false,
		"recovery_redispatch_allowed": false,
		"cancellation_allowed":        false,
	}, resp["lifecycle"])
	require.Equal(t, fiber.Map{
		"class":            coordinator.TaskDurabilityClassResumable,
		"streaming":        false,
		"resume_supported": true,
	}, resp["durability"])
	require.Equal(t, fiber.Map{
		"redispatch_eligible": false,
		"skip_reason":         "task_failed",
	}, resp["recovery"])
}

func TestBuildTaskTransitionRejectedPayloadWithoutTask(t *testing.T) {
	t.Parallel()

	resp := buildTaskTransitionRejectedPayload(nil)

	require.Equal(t, fiber.Map{"error": "task_transition_rejected"}, resp)
}

func TestBuildTaskResponseDoesNotReturnRawHistoricalInputs(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	task := &coordinator.TaskRecord{
		TaskID: uuid.New(),
		Status: coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{
				"kind":"tool",
				"node_id":"unsafe-file",
				"tool_name":"filesystem",
				"args":{"path":"/Users/customer/private/` + marker + `.txt","body":"` + marker + `"}
			}]}
		}`),
		CreatedAt: time.Now().UTC(),
	}

	resp := buildTaskResponse(task)
	raw, err := json.Marshal(resp)
	require.NoError(t, err)
	body := string(raw)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "/Users/customer/private")
	require.NotContains(t, body, "task_definition")
	require.Contains(t, body, "input_summary")
	require.Contains(t, body, "input_redacted")
	require.Contains(t, body, "input_digest_sha256")
}

func TestBuildTaskResponseReturnsEncryptedInputRefMetadataOnly(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_ENCRYPTED_INPUT_SECRET_MARKER"
	task := &coordinator.TaskRecord{
		TaskID: uuid.New(),
		Status: coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{
				"kind":"tool",
				"node_id":"unsafe-http",
				"tool_name":"http_request",
				"args":{"body":{
					"input_redacted":true,
					"encrypted_input_ref":true,
					"encrypted_input_ref_id":"11111111-1111-1111-1111-111111111111",
					"purpose":"execution_payload",
					"input_digest_sha256":"abc123",
					"input_bytes":42,
					"key_version":"test:v1",
					"safe_summary":"redacted",
					"redaction_policy_version":"input-reference-redaction-v1"
				}}
			}]}
		}`),
		ExecutionReceipt: json.RawMessage(`{"ciphertext":"` + marker + `"}`),
		CreatedAt:        time.Now().UTC(),
	}

	resp := buildTaskResponse(task)
	raw, err := json.Marshal(resp)
	require.NoError(t, err)
	body := string(raw)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "ciphertext")
	require.NotContains(t, body, "task_definition")
	require.Contains(t, body, "encrypted_input_refs")
	require.Contains(t, body, "11111111-1111-1111-1111-111111111111")
	require.Contains(t, body, "execution_payload")
}

func TestBuildTaskSubmitRequestIncludesAgentGovernance(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "execution_graph",
		"task_definition": {
			"graph": {
				"nodes": [
					{"kind":"tool","node_id":"github-write","tool_name":"github.issues.write"}
				]
			}
		},
		"agent_identity": {
			"agent_id": "agent-researcher",
			"principal_id": "user-123",
			"submitted_by": "user-123",
			"acting_on_behalf_of": "user-123",
			"delegation_chain": ["user-123", "agent-researcher"]
		},
		"required_capabilities": [
			"tools.github.issues.write",
			"memory.project.read"
		],
		"credential_requests": [
			{"tool":"github.issues.write","capability":"tools.github.issues.write","scope":"task","expires_in_seconds":60}
		]
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-ai")
	require.NoError(t, err)
	require.Equal(t, "tenant-ai", req.TenantID)
	require.Equal(t, "agent-researcher", req.AgentIdentity.AgentID)
	require.Equal(t, []string{"tools.github.issues.write", "memory.project.read"}, req.RequiredCapabilities)
	require.Len(t, req.CredentialRequests, 1)
	require.Equal(t, "github.issues.write", req.CredentialRequests[0].Tool)
}

func TestBuildTaskSubmitRequestBuildsRoboticsMissionDefinition(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"robotics_mission": {
			"name": "warehouse-patrol",
			"waypoints": [
				{"x": 1.5, "y": 2.5, "frame_id": "map"},
				{"x": 3.0, "y": 4.0}
			],
			"prompt": "scan aisle 3",
			"emit_zero_velocity_on_finish": true,
			"approval": {"required": true, "context": {"zone": "aisle-3"}}
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-1")
	require.NoError(t, err)
	require.Equal(t, "tenant-1", req.TenantID)
	require.Equal(t, "robotics_workflow", req.TaskType)

	var definition struct {
		Steps []map[string]any `json:"steps"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Len(t, definition.Steps, 4)
	require.Equal(t, "navigate_to_pose", definition.Steps[0]["action"])
	require.Equal(t, "publish_prompt", definition.Steps[2]["action"])
	require.Equal(t, "publish_zero_velocity", definition.Steps[3]["action"])

	approval, ok := definition.Steps[0]["approval"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, approval["required"])
	require.Equal(t, "warehouse-patrol:navigate_to_pose", approval["task"])
}

func TestBuildTaskSubmitRequestRejectsAmbiguousMissionInput(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"task_definition": {"steps": [{"step_index":1,"action":"publish_zero_velocity"}]},
		"robotics_mission": {"prompt": "hello"}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-1")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "only one of task_definition, agent_task, robotics_mission, or action_task")
}

func TestBuildTaskSubmitRequestCompilesActionTask(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "action_workflow",
		"action_task": {
			"name": "action-task-v1-proof",
			"checkpoint_after_steps": 2,
			"steps": [
				{"action": "read_file", "path": "/tmp/igris-action-proof/input.txt"},
				{"action": "http_call", "method": "POST", "url": "http://127.0.0.1:18099/process", "body": "{}"},
				{"action": "db_write", "table": "action_task_events", "record": {"status": "processed"}}
			]
		},
		"idempotency_key": "action-task-v1-abc"
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-action")
	require.NoError(t, err)
	// Action tasks dispatch to the runtime as an execution graph of sandboxed tools.
	require.Equal(t, "execution_graph", req.TaskType)
	require.Equal(t, "action-task-v1-abc", req.IdempotencyKey)

	var definition struct {
		CheckpointAfterSteps uint32 `json:"checkpoint_after_steps"`
		Graph                struct {
			GraphID string           `json:"graph_id"`
			Nodes   []map[string]any `json:"nodes"`
		} `json:"graph"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Equal(t, uint32(2), definition.CheckpointAfterSteps)
	require.Equal(t, "action-task-v1-proof", definition.Graph.GraphID)
	require.Len(t, definition.Graph.Nodes, 3)

	require.Equal(t, "tool", definition.Graph.Nodes[0]["kind"])
	require.Equal(t, "read_file-0", definition.Graph.Nodes[0]["node_id"])
	require.Equal(t, "filesystem", definition.Graph.Nodes[0]["tool_name"])
	readArgs, ok := definition.Graph.Nodes[0]["args"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "read", readArgs["operation"])
	require.Equal(t, "/tmp/igris-action-proof/input.txt", readArgs["path"])

	require.Equal(t, "http_call-1", definition.Graph.Nodes[1]["node_id"])
	require.Equal(t, "http_request", definition.Graph.Nodes[1]["tool_name"])
	httpArgs, ok := definition.Graph.Nodes[1]["args"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "POST", httpArgs["method"])
	require.Equal(t, "http://127.0.0.1:18099/process", httpArgs["url"])

	require.Equal(t, "db_write-2", definition.Graph.Nodes[2]["node_id"])
	require.Equal(t, "database_write", definition.Graph.Nodes[2]["tool_name"])
	dbArgs, ok := definition.Graph.Nodes[2]["args"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "action_task_events", dbArgs["table"])
	dbRecord, ok := dbArgs["record"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "processed", dbRecord["status"])
}

func TestBuildTaskSubmitRequestUsesAuthenticatedTenantForIdempotency(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"tenant_id": "attacker-tenant",
		"task_type": "execution_graph",
		"task_definition": {
			"graph": {
				"nodes": [
					{"kind":"tool","node_id":"noop","tool_name":"noop","args":{}}
				]
			}
		},
		"idempotency_key": "same-key"
	}`)

	req, err := buildTaskSubmitRequest(body, "authenticated-tenant")
	require.NoError(t, err)
	require.Equal(t, "authenticated-tenant", req.TenantID)
	require.Equal(t, "same-key", req.IdempotencyKey)
}

func TestBuildTaskSubmitRequestRejectsUnknownAction(t *testing.T) {
	t.Parallel()

	body := []byte(`{"task_type":"action_workflow","action_task":{"steps":[{"action":"delete_everything"}]}}`)
	_, err := buildTaskSubmitRequest(body, "tenant-action")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "delete_everything")
}

func TestBuildTaskSubmitRequestRejectsActionTaskOnWrongTaskType(t *testing.T) {
	t.Parallel()

	body := []byte(`{"task_type":"agent_workflow","action_task":{"steps":[{"action":"read_file","path":"/tmp/x"}]}}`)
	_, err := buildTaskSubmitRequest(body, "tenant-action")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "action_task is only valid with task_type=action_workflow")
}

func TestBuildTaskSubmitRequestRejectsMissionOnWrongTaskType(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "single_inference",
		"robotics_mission": {"prompt": "hello"}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-1")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "task_type=robotics_workflow")
}

func TestBuildTaskSubmitRequestRejectsEmptyRoboticsMission(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"robotics_mission": {"name": "empty"}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-1")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "must include at least one waypoint, prompt, or velocity action")
}

func TestBuildTaskSubmitRequestBuildsSingleInferenceAgentTask(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "single_inference",
		"agent_task": {
			"name": "summarize-ticket",
			"model": "gpt-4.1-mini",
			"messages": [{"role":"user","content":"summarize this incident"}],
			"mode": "council",
			"memory": {"recall_query":"incident history","store_output":true},
			"approval": {"required": true}
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-2")
	require.NoError(t, err)
	require.Equal(t, "single_inference", req.TaskType)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Equal(t, "gpt-4.1-mini", definition["model"])
	require.Equal(t, "council", definition["mode"])
	require.NotNil(t, definition["memory"])
	require.NotNil(t, definition["approval"])
}

func TestBuildTaskSubmitRequestBuildsExecutionGraphAgentTask(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "execution_graph",
		"agent_task": {
			"name": "reasoning-graph",
			"steps": [
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"plan route"}]
				}
			]
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-graph-agent")
	require.NoError(t, err)
	require.Equal(t, "execution_graph", req.TaskType)

	var definition struct {
		Graph struct {
			GraphID string                   `json:"graph_id"`
			Nodes   []map[string]interface{} `json:"nodes"`
		} `json:"graph"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Equal(t, "reasoning-graph", definition.Graph.GraphID)
	require.Len(t, definition.Graph.Nodes, 1)
	require.Equal(t, "reason", definition.Graph.Nodes[0]["kind"])
	require.Equal(t, "reasoning-graph-0", definition.Graph.Nodes[0]["node_id"])
	require.Equal(t, "reason.reasoning_graph_0", definition.Graph.Nodes[0]["write_slot"])
}

func TestBuildTaskSubmitRequestBuildsAgentWorkflowFromSteps(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "agent_workflow",
		"agent_task": {
			"name": "triage-flow",
			"steps": [
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"system","content":"classify"}]
				},
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"draft response"}],
					"approval": {"required": true}
				}
			]
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-3")
	require.NoError(t, err)
	require.Equal(t, "agent_workflow", req.TaskType)

	var definition struct {
		Steps []map[string]any `json:"steps"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Len(t, definition.Steps, 2)
	require.EqualValues(t, 1, definition.Steps[0]["step_index"])
	require.EqualValues(t, 2, definition.Steps[1]["step_index"])
	approval, ok := definition.Steps[1]["approval"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "triage-flow:agent_step", approval["task"])
}

func TestBuildTaskSubmitRequestBuildsExecutionGraphRoboticsMission(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "execution_graph",
		"robotics_mission": {
			"name": "robot-graph",
			"waypoints": [
				{"x": 2.0, "y": 3.0, "frame_id": "map"}
			],
			"prompt": "inspect station"
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-graph-robotics")
	require.NoError(t, err)
	require.Equal(t, "execution_graph", req.TaskType)

	var definition struct {
		Graph struct {
			Nodes []map[string]interface{} `json:"nodes"`
		} `json:"graph"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Len(t, definition.Graph.Nodes, 2)
	require.Equal(t, "robotics", definition.Graph.Nodes[0]["kind"])
	require.Equal(t, "navigate_to_pose", definition.Graph.Nodes[0]["action"])
	require.Equal(t, "robotics.robot_graph_0", definition.Graph.Nodes[0]["write_slot"])
	require.Equal(t, "publish_prompt", definition.Graph.Nodes[1]["action"])
	require.Equal(t, "robotics.robot_graph_1", definition.Graph.Nodes[1]["write_slot"])
}

func TestBuildTaskSubmitRequestRejectsAgentTaskOnWrongTaskType(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"agent_task": {
			"model": "gpt-4.1-mini",
			"messages": [{"role":"user","content":"hello"}]
		}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-4")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "agent_task is only valid with task_type=single_inference, task_type=agent_workflow, or task_type=execution_graph")
}

func TestBuildTaskSubmitRequestRejectsAgentWorkflowStepsOnSingleInference(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "single_inference",
		"agent_task": {
			"steps": [
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"hello"}]
				}
			]
		}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-5")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "agent_task.steps is only valid with task_type=agent_workflow")
}

func TestBuildTaskResponseIncludesActionEvidence(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	definition := json.RawMessage(`{
		"type": "execution_graph",
		"graph": {
			"graph_id": "action-task-v1-proof",
			"nodes": [
				{"kind":"tool","node_id":"read_file-0","tool_name":"filesystem","args":{"operation":"read","path":"/tmp/igris-action/input.txt"}},
				{"kind":"tool","node_id":"http_call-1","tool_name":"http_request","args":{"method":"post","url":"http://127.0.0.1:18099/process","body":"{\"secret\":\"shhh\"}","headers":{"authorization":"Bearer top-secret"}}},
				{"kind":"tool","node_id":"db_write-2","tool_name":"database_write","args":{"table":"action_task_events","record":{"status":"processed","ssn":"123-45-6789"}}}
			]
		}
	}`)

	outDigest0 := "aa00"
	outDigest1 := "bb11"
	outDigest2 := "cc22"
	recordedMs := uint64(1_700_000_000_000)

	task := &coordinator.TaskRecord{
		TaskID:         taskID,
		Status:         coordinator.TaskStatusCompleted,
		TaskDefinition: definition,
		LastCheckpoint: &coordinator.CheckpointPayload{
			ResumeToken: coordinator.ResumeToken{LastCommittedStep: 2, CheckpointDigest: "digest-1", RuntimeID: "runtime-1"},
			WalEntries: []coordinator.WalEntry{
				{EntryID: uuid.New(), StepIndex: 0, Status: "committed", OutputDigest: &outDigest0, RuntimeID: "runtime-1", TimestampMs: recordedMs},
				{EntryID: uuid.New(), StepIndex: 1, Status: "committed", OutputDigest: &outDigest1, RuntimeID: "runtime-1", TimestampMs: recordedMs + 10},
				{EntryID: uuid.New(), StepIndex: 2, Status: "committed", OutputDigest: &outDigest2, RuntimeID: "runtime-1", TimestampMs: recordedMs + 20},
			},
			Metadata: json.RawMessage(`{
				"graph_blackboard": {
					"nodes": {
						"read_file-0": {"status":"committed","metadata":{"bytes":128,"digest":"fa11"}},
						"http_call-1": {"status":"committed","metadata":{"status_code":200,"digest":"fb22"}},
						"db_write-2": {"status":"committed","metadata":{"row_id":"row-123","table":"action_task_events"}}
					}
				}
			}`),
		},
	}

	resp := buildTaskResponse(task)
	evidence, ok := resp["action_evidence"].([]fiber.Map)
	require.True(t, ok, "action_evidence should be present")
	require.Len(t, evidence, 3)

	require.Equal(t, 0, evidence[0]["step_index"])
	require.Equal(t, "read_file-0", evidence[0]["node_id"])
	require.Equal(t, "read_file", evidence[0]["action_type"])
	require.Equal(t, "filesystem", evidence[0]["tool_name"])
	require.NotContains(t, evidence[0]["target_summary"], "/tmp/igris-action/input.txt")
	require.Contains(t, evidence[0]["target_summary"], "file:")
	require.Equal(t, "committed", evidence[0]["status"])
	require.Equal(t, "aa00", evidence[0]["result_digest"])
	require.Equal(t, "runtime-1", evidence[0]["runtime_id"])
	require.NotEmpty(t, evidence[0]["recorded_at"])
	rs0, ok := evidence[0]["result_summary"].(fiber.Map)
	require.True(t, ok)
	require.EqualValues(t, 128, rs0["bytes_read"])
	require.Equal(t, "fa11", rs0["content_digest"])

	require.Equal(t, "http_call", evidence[1]["action_type"])
	require.Equal(t, "POST http://127.0.0.1:18099/process", evidence[1]["target_summary"])
	rs1, ok := evidence[1]["result_summary"].(fiber.Map)
	require.True(t, ok)
	require.EqualValues(t, 200, rs1["status_code"])

	require.Equal(t, "db_write", evidence[2]["action_type"])
	require.Equal(t, "table action_task_events", evidence[2]["target_summary"])
	rs2, ok := evidence[2]["result_summary"].(fiber.Map)
	require.True(t, ok)
	require.Equal(t, "row-123", rs2["row_id"])

	serialized, err := json.Marshal(evidence)
	require.NoError(t, err)
	require.NotContains(t, string(serialized), "shhh")
	require.NotContains(t, string(serialized), "/tmp/igris-action/input.txt")
	require.NotContains(t, string(serialized), "top-secret")
	require.NotContains(t, string(serialized), "123-45-6789")
	require.NotContains(t, string(serialized), `"body"`)
	require.NotContains(t, string(serialized), `"record"`)
	require.NotContains(t, string(serialized), `"headers"`)
}

func TestBuildTaskResponseActionEvidenceUsesProtectedPathDigest(t *testing.T) {
	t.Parallel()

	task := &coordinator.TaskRecord{
		TaskID: uuid.New(),
		Status: coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{
			"type": "execution_graph",
			"graph": {
				"nodes": [
					{"kind":"tool","node_id":"read_file-0","tool_name":"filesystem","args":{
						"operation":"read",
						"path":{
							"input_redacted":true,
							"encrypted_input_ref":true,
							"encrypted_input_ref_id":"11111111-1111-1111-1111-111111111111",
							"purpose":"private_path",
							"input_digest_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
							"safe_summary":"private path redacted; encrypted input ref available for authorized recovery"
						}
					}}
				]
			}
		}`),
	}

	resp := buildTaskResponse(task)
	evidence, ok := resp["action_evidence"].([]fiber.Map)
	require.True(t, ok, "action_evidence should be present")
	require.Len(t, evidence, 1)
	require.Equal(t, "read_file", evidence[0]["action_type"])
	require.Contains(t, evidence[0]["target_summary"], "file:")

	serialized, err := json.Marshal(evidence)
	require.NoError(t, err)
	require.NotContains(t, string(serialized), "11111111-1111-1111-1111-111111111111")
	require.NotContains(t, string(serialized), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	require.NotContains(t, string(serialized), "private_path")
}

func TestBuildTaskResponseRedactsHistoricalCheckpointMetadata(t *testing.T) {
	t.Parallel()

	marker := "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"
	task := &coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{"type":"agent_workflow","steps":[{"model":"m","messages":[{"role":"user","content":"hi"}]}]}`),
		LastCheckpoint: &coordinator.CheckpointPayload{
			ResumeToken: coordinator.ResumeToken{LastCommittedStep: 1, CheckpointDigest: "digest-1", RuntimeID: "runtime-1"},
			Metadata: json.RawMessage(`{
				"graph_blackboard": {
					"nodes": {
						"tool-1": {
							"content": "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET",
							"metadata": {
								"raw_body": "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET",
								"authorization": "Bearer IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"
							}
						}
					},
					"slots": {
						"tool.fetch": {"password": "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"}
					}
				}
			}`),
		},
	}

	resp := buildTaskResponse(task)
	serialized, err := json.Marshal(resp)
	require.NoError(t, err)
	require.NotContains(t, string(serialized), marker)
	require.Contains(t, string(serialized), responseRedactionPolicyVersion)
	require.Contains(t, string(serialized), "content_digest_sha256")
}

func TestBuildTaskResponseOmitsActionEvidenceForNonActionGraphs(t *testing.T) {
	t.Parallel()

	task := &coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"inference","node_id":"infer-0"}]}}`),
	}
	resp := buildTaskResponse(task)
	_, ok := resp["action_evidence"]
	require.False(t, ok)

	task2 := &coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{"type":"agent_workflow","steps":[{"model":"m","messages":[{"role":"user","content":"hi"}]}]}`),
	}
	resp2 := buildTaskResponse(task2)
	_, ok2 := resp2["action_evidence"]
	require.False(t, ok2)
}
