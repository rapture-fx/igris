package api

// Persistence for Connected contract synchronization
// (docs/architecture/igris-connected-first-slice.md).
//
// Discipline: action_contract_versions is append-only — this file exposes
// INSERT and SELECT only, and there is deliberately no UPDATE or DELETE
// statement anywhere in it. Every query predicate includes tenant_id; there
// is no tenant-null lookup path. Concurrent duplicate syncs are resolved by
// the database uniqueness constraints (ON CONFLICT DO NOTHING + re-read),
// never by application-level pre-checks alone.

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"time"
)

// contractLogicalActionTargetType is the target_type stamped on logical
// actions created by SDK contract sync. It is intentionally NOT part of the
// executable target vocabulary: buildActionRunRequestFromDefinition refuses
// unknown target types, so a synchronized declaration can never be executed
// through the action gateway until an operator explicitly configures a real
// target. Registration grants nothing.
const contractLogicalActionTargetType = "embedded_sdk"

const (
	contractOriginSDKSync = "sdk_sync"
	contractSyncOperation = "contract_sync"
)

type contractVersionRecord struct {
	ID                      string
	ContractHash            string
	SchemaVersion           string
	Contract                []byte
	Risk                    string
	ApprovalMode            string
	ExecutionMode           string
	CodeFingerprint         *string
	SecuritySensitiveChange bool
	PolicyFlags             []string
	CreatedAt               time.Time
}

// contractQuerier is satisfied by both *sql.DB and *sql.Tx so the same
// statements run inside and outside the sync transaction.
type contractQuerier interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// ensureContractLogicalAction creates the tenant-owned logical action if it
// does not exist (origin=sdk_sync, non-executable target) and returns its
// origin. An existing manual action is never modified — the version history
// simply attaches to it and the caller reports origin divergence.
func ensureContractLogicalAction(ctx context.Context, q contractQuerier, tenantID, actionName string) (actionID, origin string, err error) {
	_, err = q.ExecContext(ctx, `
		INSERT INTO action_definitions (tenant_id, name, display_name, target_type, origin)
		VALUES ($1, $2, $2, $3, $4)
		ON CONFLICT (tenant_id, name) WHERE archived_at IS NULL DO NOTHING
	`, tenantID, actionName, contractLogicalActionTargetType, contractOriginSDKSync)
	if err != nil {
		return "", "", err
	}
	err = q.QueryRowContext(ctx, `
		SELECT id, COALESCE(origin, 'manual')
		FROM action_definitions
		WHERE tenant_id = $1 AND name = $2 AND archived_at IS NULL
	`, tenantID, actionName).Scan(&actionID, &origin)
	if err != nil {
		return "", "", err
	}
	return actionID, origin, nil
}

const contractVersionColumns = `
	id, contract_hash, schema_version, contract, risk, approval_mode,
	execution_mode, code_fingerprint, security_sensitive_change,
	policy_flags, created_at`

func scanContractVersion(row *sql.Row) (*contractVersionRecord, error) {
	var rec contractVersionRecord
	var fingerprint sql.NullString
	var policyFlags []byte
	err := row.Scan(
		&rec.ID, &rec.ContractHash, &rec.SchemaVersion, &rec.Contract,
		&rec.Risk, &rec.ApprovalMode, &rec.ExecutionMode, &fingerprint,
		&rec.SecuritySensitiveChange, &policyFlags, &rec.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if fingerprint.Valid {
		rec.CodeFingerprint = &fingerprint.String
	}
	if len(policyFlags) > 0 {
		_ = json.Unmarshal(policyFlags, &rec.PolicyFlags)
	}
	return &rec, nil
}

func getContractVersion(ctx context.Context, q contractQuerier, tenantID, actionName, contractHash string) (*contractVersionRecord, error) {
	row := q.QueryRowContext(ctx, `
		SELECT `+contractVersionColumns+`
		FROM action_contract_versions
		WHERE tenant_id = $1 AND action_name = $2 AND contract_hash = $3
	`, tenantID, actionName, contractHash)
	return scanContractVersion(row)
}

// latestContractVersion returns the most recent version for the logical
// action, or sql.ErrNoRows for a first synchronization.
func latestContractVersion(ctx context.Context, q contractQuerier, tenantID, actionName string) (*contractVersionRecord, error) {
	row := q.QueryRowContext(ctx, `
		SELECT `+contractVersionColumns+`
		FROM action_contract_versions
		WHERE tenant_id = $1 AND action_name = $2
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`, tenantID, actionName)
	return scanContractVersion(row)
}

// insertContractVersion appends a new immutable version. On a concurrent
// duplicate insert the uniqueness constraint wins and (nil, sql.ErrNoRows)
// is returned so the caller re-reads the surviving row.
func insertContractVersion(ctx context.Context, q contractQuerier, tenantID, actionName, contractHash, schemaVersion string, contract []byte, risk, approvalMode, executionMode string, codeFingerprint *string, securitySensitiveChange bool, policyFlags []string) (id string, createdAt time.Time, err error) {
	flags, err := json.Marshal(policyFlags)
	if err != nil {
		return "", time.Time{}, err
	}
	var fingerprint interface{}
	if codeFingerprint != nil {
		fingerprint = *codeFingerprint
	}
	err = q.QueryRowContext(ctx, `
		INSERT INTO action_contract_versions (
			tenant_id, action_name, contract_hash, schema_version, contract,
			risk, approval_mode, execution_mode, code_fingerprint,
			security_sensitive_change, policy_flags, source
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (tenant_id, action_name, contract_hash) DO NOTHING
		RETURNING id, created_at
	`, tenantID, actionName, contractHash, schemaVersion, contract,
		risk, approvalMode, executionMode, fingerprint,
		securitySensitiveChange, flags, contractOriginSDKSync,
	).Scan(&id, &createdAt)
	if err != nil {
		return "", time.Time{}, err
	}
	return id, createdAt, nil
}

type contractLogicalActionRecord struct {
	ID        string
	Origin    string
	CreatedAt time.Time
}

func getContractLogicalAction(ctx context.Context, q contractQuerier, tenantID, actionName string) (*contractLogicalActionRecord, error) {
	var rec contractLogicalActionRecord
	err := q.QueryRowContext(ctx, `
		SELECT id, COALESCE(origin, 'manual'), created_at
		FROM action_definitions
		WHERE tenant_id = $1 AND name = $2 AND archived_at IS NULL
	`, tenantID, actionName).Scan(&rec.ID, &rec.Origin, &rec.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// listContractVersions returns version summaries newest-first, tenant-scoped.
func listContractVersions(ctx context.Context, q contractQuerier, tenantID, actionName string, limit int, before *time.Time) ([]contractVersionRecord, error) {
	query := `
		SELECT ` + contractVersionColumns + `
		FROM action_contract_versions
		WHERE tenant_id = $1 AND action_name = $2`
	args := []interface{}{tenantID, actionName}
	if before != nil {
		query += ` AND created_at < $3`
		args = append(args, *before)
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ` + strconv.Itoa(limit)

	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []contractVersionRecord
	for rows.Next() {
		var rec contractVersionRecord
		var fingerprint sql.NullString
		var policyFlags []byte
		if err := rows.Scan(
			&rec.ID, &rec.ContractHash, &rec.SchemaVersion, &rec.Contract,
			&rec.Risk, &rec.ApprovalMode, &rec.ExecutionMode, &fingerprint,
			&rec.SecuritySensitiveChange, &policyFlags, &rec.CreatedAt,
		); err != nil {
			return nil, err
		}
		if fingerprint.Valid {
			rec.CodeFingerprint = &fingerprint.String
		}
		if len(policyFlags) > 0 {
			_ = json.Unmarshal(policyFlags, &rec.PolicyFlags)
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

type contractSyncIdempotencyRecord struct {
	RequestFingerprint string
	ResponseStatus     int
	ResponseBody       []byte
}

func getContractSyncIdempotencyRecord(ctx context.Context, q contractQuerier, tenantID, actionName, key string) (*contractSyncIdempotencyRecord, error) {
	var rec contractSyncIdempotencyRecord
	err := q.QueryRowContext(ctx, `
		SELECT request_fingerprint, response_status, response_body
		FROM contract_sync_idempotency
		WHERE tenant_id = $1 AND operation = $2 AND action_name = $3 AND idempotency_key = $4
	`, tenantID, contractSyncOperation, actionName, key).Scan(
		&rec.RequestFingerprint, &rec.ResponseStatus, &rec.ResponseBody,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// claimContractSyncIdempotencyRecord atomically claims a tenant/operation/
// action/key slot inside the caller's transaction. A conflicting INSERT
// blocks on PostgreSQL's unique index until the winning transaction commits;
// the loser then re-reads the durable fingerprint and response in a new
// statement snapshot. The placeholder is never externally visible because
// claim, contract persistence, response completion, and commit share one
// transaction.
func claimContractSyncIdempotencyRecord(ctx context.Context, q contractQuerier, tenantID, actionName, key, fingerprint string) (bool, error) {
	var claimedFingerprint string
	err := q.QueryRowContext(ctx, `
		INSERT INTO contract_sync_idempotency (
			tenant_id, operation, action_name, idempotency_key,
			request_fingerprint, response_status, response_body
		)
		VALUES ($1, $2, $3, $4, $5, 0, '{}'::jsonb)
		ON CONFLICT (tenant_id, operation, action_name, idempotency_key) DO NOTHING
		RETURNING request_fingerprint
	`, tenantID, contractSyncOperation, actionName, key, fingerprint).Scan(&claimedFingerprint)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// completeContractSyncIdempotencyRecord stores the response snapshot for a
// claim made by this transaction. The fingerprint predicate prevents an
// unexpected row from ever being overwritten.
func completeContractSyncIdempotencyRecord(ctx context.Context, q contractQuerier, tenantID, actionName, key, fingerprint string, status int, body []byte) error {
	result, err := q.ExecContext(ctx, `
		UPDATE contract_sync_idempotency
		SET response_status = $6, response_body = $7
		WHERE tenant_id = $1 AND operation = $2 AND action_name = $3
		  AND idempotency_key = $4 AND request_fingerprint = $5
	`, tenantID, contractSyncOperation, actionName, key, fingerprint, status, body)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows != 1 {
		return sql.ErrNoRows
	}
	return nil
}
