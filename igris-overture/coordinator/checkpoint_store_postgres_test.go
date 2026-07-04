package coordinator

import (
	"context"
	"crypto/ed25519"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestRoboticsReceiptReplayWithPostgresMigrations(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run real Postgres receipt replay test")
	}

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_RUNTIME_PUBLIC_KEY", hex.EncodeToString(publicKey))

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	schema := "robotics_replay_test_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	_, err = db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)

	for _, name := range []string{
		"005_runtime_instances.sql",
		"031_task_records.sql",
		"037_robotics_receipt_audit.sql",
		"039_robotics_policy_decision_audit.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	taskID := uuid.New()
	tenantID := "tenant-replay-pg"
	runtimeID := "runtime-replay-pg"
	_, err = db.Exec(`
		INSERT INTO runtime_instances (
			runtime_id, public_key_ed25519, endpoint, capabilities,
			platform, version, is_edge, is_healthy, last_seen_at, registered_at
		)
		VALUES ($1, $2, 'http://runtime-replay-pg', '["robotics"]'::jsonb, 'test', 'test', true, true, NOW(), NOW())`,
		runtimeID, hex.EncodeToString(publicKey),
	)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO task_records (
			task_id, tenant_id, status, runtime_id, runtime_endpoint,
			task_definition, idempotency_key, created_at
		)
		VALUES ($1, $2, 'dispatched', $3, 'http://runtime-replay-pg', '{}'::jsonb, $4, NOW())`,
		taskID, tenantID, runtimeID, "idempotency-"+taskID.String(),
	)
	require.NoError(t, err)

	target := "mobile-base"
	decision := signedGovernedPolicyDecision{
		SchemaVersion: "governed_policy_decision.v1",
		DecisionID:    "decision-replay-pg",
		TenantID:      tenantID,
		TaskID:        taskID.String(),
		RuntimeID:     &runtimeID,
		Action: governedAction{
			SchemaVersion:      "governed_action.v1",
			Domain:             "robotics",
			ActionType:         "ros2_action",
			ActionName:         "publish_zero_velocity",
			NodeID:             "robotics-step-0",
			StepIndex:          0,
			Target:             &target,
			RequiresPolicy:     true,
			SafetyModeRequired: true,
		},
		Permit:             true,
		Reason:             "permitted",
		PolicyVersion:      "robotics-policy.pg-active",
		RuntimePermitted:   true,
		TenantPermitted:    true,
		PolicyPermitted:    true,
		RobotModePermitted: true,
		IssuedAtUnixMs:     1_900_310_000_000,
		ExpiresAtUnixMs:    1_900_310_030_000,
		Signature:          "policy-sig-pg",
	}
	decisionHash := governedPolicyDecisionHash(decision)
	envelope := signedRuntimeArtifactJSON(t, privateKey, map[string]any{
		"execution_id":         "exec-replay-pg",
		"tenant_id":            tenantID,
		"policy_decision_id":   "decision-replay-pg",
		"policy_decision_hash": decisionHash,
		"governed_action_hash": "action-hash-replay-pg",
		"routing_decision":     "ros2:publish_zero_velocity",
	})
	// Receipts are signed over the runtime's fixed-field canonical form
	// (see internal.canonicalReceiptBytes), not the whole-JSON form used
	// for envelopes — signedRuntimeArtifactJSON would fail verification.
	receipt := signedReceiptJSON(t, privateKey, map[string]any{
		"execution_id":       "exec-replay-pg",
		"receipt_hash":       "receipt-hash-replay-pg",
		"violation_occurred": false,
	})

	store := NewCheckpointStore(db)
	require.NoError(t, store.SaveRoboticsPolicyDecisions(taskID, []signedGovernedPolicyDecision{decision}))
	require.NoError(t, store.SaveRoboticsReceiptAudit(taskID, envelope, receipt))

	replays, err := store.ReplayRoboticsAudit(tenantID, RoboticsAuditReceiptFilter{
		TaskID:           &taskID,
		PolicyDecisionID: "decision-replay-pg",
		RobotAction:      "publish_zero_velocity",
	})
	require.NoError(t, err)
	require.Len(t, replays, 1)
	require.True(t, replays[0].Valid, replays[0].ValidationErrors)
	require.Equal(t, tenantID, replays[0].TenantID)
	require.Equal(t, runtimeID, replays[0].RuntimeID)
	require.Equal(t, "robotics-policy.pg-active", replays[0].PolicyVersion)
	require.Equal(t, "publish_zero_velocity", replays[0].RobotAction)
	require.Equal(t, "robotics-step-0", replays[0].RobotNodeID)
	require.Equal(t, target, replays[0].RobotTarget)
	require.Equal(t, decisionHash, replays[0].PolicyDecisionHash)
	require.Equal(t, "action-hash-replay-pg", replays[0].GovernedActionHash)
	require.Equal(t, mustJSONFieldString(t, receipt, "signature"), replays[0].ReceiptSignature)
	require.Equal(t, mustJSONFieldString(t, envelope, "signature"), replays[0].RuntimeSignature)
	require.True(t, replays[0].RuntimeSignaturePresent)
	require.True(t, replays[0].RuntimeSignatureVerified)
	require.Equal(t, "runtime_registry", replays[0].RuntimeSignatureKeySource)

	var persistedDecision signedGovernedPolicyDecision
	require.NoError(t, json.Unmarshal(replays[0].SignedPolicyDecision, &persistedDecision))
	require.Equal(t, decision.DecisionID, persistedDecision.DecisionID)
	require.Equal(t, decision.PolicyVersion, persistedDecision.PolicyVersion)
}

func TestAIToolReplayPostgres043(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run real Postgres AI tool replay test")
	}

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	_, overturePrivateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	schema := "ai_tool_replay_test_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	_, err = db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)

	// The artifact-persistence path reads task_records through the full
	// TaskRecord scan (GetTask column list), so every migration that adds a
	// scanned column must be applied here: 034 canceled_at, 035
	// failure_details, 049 proof verification summary, 055 execution
	// targets, 062 registered agent.
	for _, name := range []string{
		"005_runtime_instances.sql",
		"006_execution_lineage.sql",
		"031_task_records.sql",
		"032_task_record_artifacts.sql",
		"033_task_proof_state.sql",
		"034_task_cancellation.sql",
		"035_task_failure_details.sql",
		"043_ai_capability_governance_audit.sql",
		"047_execution_context.sql",
		"049_task_proof_verification_summary.sql",
		"054_action_definitions.sql",
		"055_action_execution_targets.sql",
		"062_task_records_registered_agent.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err, name)
	}

	taskID := uuid.New()
	tenantID := "tenant-ai-tool-pg"
	runtimeID := "runtime-ai-tool-pg"
	_, err = db.Exec(`
		INSERT INTO runtime_instances (
			runtime_id, public_key_ed25519, endpoint, capabilities,
			platform, version, is_edge, is_healthy, last_seen_at, registered_at
		)
		VALUES ($1, $2, 'http://runtime-ai-tool-pg', '["tools.github.issues.write"]'::jsonb, 'test', 'test', true, true, NOW(), NOW())`,
		runtimeID, hex.EncodeToString(publicKey),
	)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO task_records (
			task_id, tenant_id, status, runtime_id, runtime_endpoint,
			task_definition, idempotency_key, created_at
		)
		VALUES ($1, $2, 'dispatched', $3, 'http://runtime-ai-tool-pg', '{}'::jsonb, $4, NOW())`,
		taskID, tenantID, runtimeID, "idempotency-"+taskID.String(),
	)
	require.NoError(t, err)

	envelope := &TaskPermissionEnvelope{
		SchemaVersion: "task_permission_envelope.v1",
		EnvelopeID:    "permission-envelope-pg",
		TenantID:      tenantID,
		TaskID:        taskID.String(),
		RuntimeID:     &runtimeID,
		AgentIdentity: AgentIdentity{
			AgentID:          "agent-researcher",
			PrincipalID:      "user-123",
			SubmittedBy:      "user-123",
			ActingOnBehalfOf: "user-123",
			DelegationChain:  []string{"user-123", "agent-researcher"},
		},
		RequiredCapabilities: []string{"tools.github.issues.write"},
		Decisions: []CapabilityDecision{{
			Capability:    "tools.github.issues.write",
			Permit:        true,
			Reason:        "capability explicitly allowed",
			PolicyVersion: "capabilities-policy.pg",
		}},
		CredentialRefs: []CredentialReference{{
			ReferenceID:     "credref-pg",
			TenantID:        tenantID,
			TaskID:          taskID.String(),
			Tool:            "github.issues.write",
			Capability:      "tools.github.issues.write",
			Scope:           "task",
			ExpiresAtUnixMs: 1_900_310_030_000,
			Revocable:       true,
		}},
		IssuedAtUnixMs:  1_900_310_000_000,
		ExpiresAtUnixMs: 1_900_310_030_000,
	}
	envelope.Signature = signTaskPermissionEnvelope(*envelope, overturePrivateKey)

	store := NewCheckpointStore(db)
	require.NoError(t, store.SaveTaskPermissionEnvelope(taskID, envelope))

	runtimeEnvelope := signedRuntimeArtifactJSON(t, privateKey, map[string]any{
		"execution_id":         "exec-tool-pg",
		"tenant_id":            tenantID,
		"model":                "github.issues.write",
		"policy_decision_id":   envelope.EnvelopeID,
		"policy_decision_hash": taskPermissionEnvelopeHash(*envelope),
		"governed_action_hash": "tool-action-hash-pg",
		"routing_decision":     "tool:github.issues.write",
		"request_hash":         "args-hash-pg",
		"response_hash":        "result-hash-pg",
	})
	// signedReceiptJSON signs the canonical receipt form and computes the
	// canonical "hash" field itself, as the real runtime does.
	runtimeReceipt := signedReceiptJSON(t, privateKey, map[string]any{
		"execution_id":       "exec-tool-pg",
		"tool_calls":         float64(1),
		"violation_occurred": false,
	})

	require.NoError(t, store.SaveExecutionArtifacts(taskID, runtimeEnvelope, runtimeReceipt))

	receipts, err := store.GetAIToolAuditReceipts(tenantID, AIToolAuditReceiptFilter{
		TaskID:   &taskID,
		ToolName: "github.issues.write",
	})
	require.NoError(t, err)
	require.Len(t, receipts, 1)
	require.Equal(t, envelope.EnvelopeID, receipts[0].EnvelopeID)
	require.Equal(t, "tools.github.issues.write", receipts[0].Capability)
	require.Equal(t, mustJSONFieldString(t, runtimeReceipt, "hash"), receipts[0].ReceiptHash)

	replays, err := store.ReplayAIToolAudit(tenantID, AIToolAuditReceiptFilter{
		TaskID:     &taskID,
		EnvelopeID: envelope.EnvelopeID,
		ToolName:   "github.issues.write",
	})
	require.NoError(t, err)
	require.Len(t, replays, 1)
	require.True(t, replays[0].Valid, replays[0].ValidationErrors)
	require.True(t, replays[0].RuntimeSignaturePresent)
	require.True(t, replays[0].RuntimeSignatureVerified)
	require.Equal(t, "runtime_registry", replays[0].RuntimeSignatureKeySource)
	require.Equal(t, mustJSONFieldString(t, runtimeEnvelope, "signature"), replays[0].RuntimeSignature)

	revoked, err := store.RevokeAICredentialReference(context.Background(), tenantID, "credref-pg")
	require.NoError(t, err)
	require.NotNil(t, revoked.RevokedAt)
	require.Equal(t, "credref-pg", revoked.ReferenceID)

	revokedRuntimeEnvelope := signedRuntimeArtifactJSON(t, privateKey, map[string]any{
		"execution_id":         "exec-tool-revoked-pg",
		"tenant_id":            tenantID,
		"model":                "github.issues.write",
		"policy_decision_id":   envelope.EnvelopeID,
		"policy_decision_hash": taskPermissionEnvelopeHash(*envelope),
		"governed_action_hash": "tool-action-hash-pg",
		"routing_decision":     "tool:github.issues.write",
		"request_hash":         "args-hash-revoked-pg",
		"response_hash":        "result-hash-revoked-pg",
	})
	revokedRuntimeReceipt := signedReceiptJSON(t, privateKey, map[string]any{
		"execution_id":       "exec-tool-revoked-pg",
		"tool_calls":         float64(1),
		"violation_occurred": false,
	})
	err = store.SaveExecutionArtifacts(taskID, revokedRuntimeEnvelope, revokedRuntimeReceipt)
	require.ErrorIs(t, err, ErrCredentialReferenceRevoked)
}

func TestRoboticsPolicyAuthorizationWithPostgresMigrations(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run real Postgres policy authorization test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	schema := "robotics_policy_auth_test_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	_, err = db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)

	for _, name := range []string{
		"036_robotics_policy_settings.sql",
		"038_robotics_policy_lifecycle.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	_, err = db.Exec(`
		INSERT INTO robotics_policy_settings (
			tenant_id, policy_version, status, permit, runtime_permitted,
			robot_mode, allowed_runtimes, active, activated_at, created_by,
			updated_by, created_at, updated_at
		)
		VALUES (
			'tenant-policy-auth', 'robotics-policy.pg-auth', 'active', true, true,
			'supervised', '["runtime-allowed"]'::jsonb, true, NOW(), 'admin',
			'admin', NOW(), NOW()
		)`)
	require.NoError(t, err)

	allowedRuntime := "runtime-allowed"
	allowed := evaluateRoboticsPolicy(context.Background(), db, &TaskRecord{
		TaskID:    uuid.New(),
		TenantID:  "tenant-policy-auth",
		RuntimeID: &allowedRuntime,
	})
	require.True(t, allowed.Permit)
	require.True(t, allowed.RuntimePermitted)
	require.True(t, allowed.TenantPermitted)
	require.True(t, allowed.PolicyPermitted)
	require.True(t, allowed.RobotModePermitted)
	require.Equal(t, "robotics-policy.pg-auth", allowed.PolicyVersion)

	deniedRuntime := "runtime-denied"
	runtimeDenied := evaluateRoboticsPolicy(context.Background(), db, &TaskRecord{
		TaskID:    uuid.New(),
		TenantID:  "tenant-policy-auth",
		RuntimeID: &deniedRuntime,
	})
	require.False(t, runtimeDenied.Permit)
	require.False(t, runtimeDenied.RuntimePermitted)
	require.True(t, runtimeDenied.TenantPermitted)
	require.True(t, runtimeDenied.PolicyPermitted)
	require.True(t, runtimeDenied.RobotModePermitted)

	missingTenant := evaluateRoboticsPolicy(context.Background(), db, &TaskRecord{
		TaskID:    uuid.New(),
		TenantID:  "tenant-policy-missing",
		RuntimeID: &allowedRuntime,
	})
	require.False(t, missingTenant.Permit)
	require.Equal(t, "robotics-policy.missing", missingTenant.PolicyVersion)
}
