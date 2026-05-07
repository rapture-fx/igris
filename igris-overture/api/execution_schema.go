package api

import (
	"context"
	"database/sql"
)

type executionSchemaCapabilities struct {
	taskProofLookup        bool
	taskProofDetail        bool
	permissionAudit        bool
	lineageViolationDetail bool
}

func detectExecutionSchemaCapabilities(ctx context.Context, db *sql.DB) (executionSchemaCapabilities, error) {
	caps := executionSchemaCapabilities{}

	err := db.QueryRowContext(ctx, `
		SELECT
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'proof_execution_id'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'proof_status'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'tenant_id'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'created_at'
			) AS task_proof_lookup,
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'proof_execution_id'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'proof_status'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'tenant_id'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'created_at'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'task_id'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'execution_envelope'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'failure_reason'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'failure_details'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'dispatched_at'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'completed_at'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'task_records'
				  AND column_name = 'canceled_at'
			) AS task_proof_detail,
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'ai_task_permission_audit'
				  AND column_name = 'task_id'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'ai_task_permission_audit'
				  AND column_name = 'permission_envelope'
			) AND EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'ai_task_permission_audit'
				  AND column_name = 'persisted_at'
			) AS permission_audit,
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'execution_lineage'
				  AND column_name = 'violation_details'
			) AS lineage_violation_detail
	`).Scan(&caps.taskProofLookup, &caps.taskProofDetail, &caps.permissionAudit, &caps.lineageViolationDetail)
	if err != nil {
		return executionSchemaCapabilities{}, err
	}

	return caps, nil
}

func executionLineageViolationDetailsSQL(enabled bool, lineageAlias string) string {
	if !enabled {
		return "NULL::jsonb AS violation_details"
	}
	return lineageAlias + ".violation_details"
}

func executionTaskProofLookupJoinSQL(enabled bool, lineageAlias string) string {
	if !enabled {
		return `LEFT JOIN LATERAL (
			SELECT ''::text AS proof_status
		) tp ON TRUE`
	}

	return `
		LEFT JOIN LATERAL (
			SELECT proof_status
			FROM task_records
			WHERE tenant_id = ` + lineageAlias + `.tenant_id
			  AND proof_execution_id = ` + lineageAlias + `.execution_id
			ORDER BY created_at DESC
			LIMIT 1
		) tp ON TRUE`
}

func executionTaskProofDetailJoinSQL(taskProofDetail, permissionAudit bool) string {
	if !taskProofDetail {
		return `LEFT JOIN LATERAL (
			SELECT
				''::text AS proof_status,
				NULL::jsonb AS execution_envelope,
				''::text AS task_id,
				''::text AS failure_reason,
				NULL::jsonb AS failure_details,
				NULL::timestamptz AS created_at,
				NULL::timestamptz AS dispatched_at,
				NULL::timestamptz AS completed_at,
				NULL::timestamptz AS canceled_at,
				'{}'::jsonb AS permission_envelope
		) tp ON TRUE`
	}

	permissionEnvelopeSQL := `'{}'::jsonb AS permission_envelope`
	if permissionAudit {
		permissionEnvelopeSQL = `COALESCE((
				SELECT permission_envelope
				FROM ai_task_permission_audit
				WHERE task_id = task_records.task_id
				ORDER BY persisted_at DESC
				LIMIT 1
			), '{}'::jsonb) AS permission_envelope`
	}

	return `
		LEFT JOIN LATERAL (
			SELECT
				proof_status,
				execution_envelope,
				task_records.task_id::text AS task_id,
				failure_reason,
				failure_details,
				created_at,
				dispatched_at,
				completed_at,
				canceled_at,
				` + permissionEnvelopeSQL + `
			FROM task_records
			WHERE tenant_id = execution_lineage.tenant_id
			  AND proof_execution_id = execution_lineage.execution_id
			ORDER BY created_at DESC
			LIMIT 1
		) tp ON TRUE`
}
