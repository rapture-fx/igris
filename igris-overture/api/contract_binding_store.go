package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type contractExecutionBindingRecord struct {
	ID                  uuid.UUID
	TenantID            string
	ActionName          string
	ContractVersionID   uuid.UUID
	ContractHash        string
	TargetActionID      uuid.UUID
	TargetVersionHash   string
	TargetSnapshot      []byte
	InputMapping        []byte
	EndpointConfigRef   string
	TimeoutMS           int
	ReplayClass         string
	IdempotencyRequired bool
	CreatedAt           time.Time
}

const contractExecutionBindingColumns = `
	id, tenant_id, action_name, contract_version_id, contract_hash,
	target_action_id, target_version_hash, target_snapshot, input_mapping,
	endpoint_config_ref, timeout_ms, replay_class, idempotency_required,
	created_at`

func scanContractExecutionBinding(row *sql.Row) (*contractExecutionBindingRecord, error) {
	var binding contractExecutionBindingRecord
	err := row.Scan(
		&binding.ID, &binding.TenantID, &binding.ActionName,
		&binding.ContractVersionID, &binding.ContractHash,
		&binding.TargetActionID, &binding.TargetVersionHash,
		&binding.TargetSnapshot, &binding.InputMapping,
		&binding.EndpointConfigRef, &binding.TimeoutMS,
		&binding.ReplayClass, &binding.IdempotencyRequired,
		&binding.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &binding, nil
}

func getContractExecutionBinding(ctx context.Context, q contractQuerier, tenantID, actionName, contractHash string) (*contractExecutionBindingRecord, error) {
	row := q.QueryRowContext(ctx, `
		SELECT `+contractExecutionBindingColumns+`
		FROM action_contract_execution_bindings
		WHERE tenant_id = $1 AND action_name = $2 AND contract_hash = $3`,
		tenantID, actionName, contractHash,
	)
	return scanContractExecutionBinding(row)
}

func insertContractExecutionBinding(
	ctx context.Context,
	q contractQuerier,
	tenantID, actionName string,
	contractVersionID uuid.UUID,
	contractHash string,
	targetActionID uuid.UUID,
	targetVersionHash string,
	targetSnapshot, inputMapping []byte,
	endpointConfigRef string,
	timeoutMS int,
	replayClass string,
	idempotencyRequired bool,
) (*contractExecutionBindingRecord, error) {
	row := q.QueryRowContext(ctx, `
		INSERT INTO action_contract_execution_bindings (
			tenant_id, action_name, contract_version_id, contract_hash,
			target_action_id, target_version_hash, target_snapshot, input_mapping,
			endpoint_config_ref, timeout_ms, replay_class, idempotency_required
		) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)
		RETURNING `+contractExecutionBindingColumns,
		tenantID, actionName, contractVersionID, contractHash,
		targetActionID, targetVersionHash, targetSnapshot, inputMapping,
		endpointConfigRef, timeoutMS, replayClass, idempotencyRequired,
	)
	return scanContractExecutionBinding(row)
}

type boundTargetSnapshot struct {
	Name             string                 `json:"name"`
	TargetType       string                 `json:"target_type"`
	TargetURL        string                 `json:"target_url"`
	Method           string                 `json:"method"`
	PolicyPreset     string                 `json:"policy_preset"`
	ReplayClass      string                 `json:"replay_class"`
	ApprovalRequired bool                   `json:"approval_required"`
	Irreversible     bool                   `json:"irreversible"`
	SecretRefs       []string               `json:"secret_refs"`
	TargetMetadata   map[string]interface{} `json:"target_metadata"`
}

func (b *contractExecutionBindingRecord) decodeTargetSnapshot() (boundTargetSnapshot, error) {
	var snapshot boundTargetSnapshot
	err := json.Unmarshal(b.TargetSnapshot, &snapshot)
	return snapshot, err
}

func (b *contractExecutionBindingRecord) decodeInputMapping() (map[string]string, error) {
	mapping := make(map[string]string)
	err := json.Unmarshal(b.InputMapping, &mapping)
	return mapping, err
}
