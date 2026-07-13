package api

import (
	"errors"
	"testing"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func requireImmutableMutationRejected(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	var pqErr *pq.Error
	require.True(t, errors.As(err, &pqErr), "expected PostgreSQL error, got %T: %v", err, err)
	require.Equal(t, pq.ErrorCode("55000"), pqErr.Code)
	require.Contains(t, pqErr.Message, "immutable Connected record")
}

func TestConnectedImmutableRecordsPostgres(t *testing.T) {
	h := openEvidencePostgres(t) // disposable schema with real migrations 054, 067, 068, and 069
	db := h.db

	_, err := db.Exec(`
		INSERT INTO action_contract_versions (
			tenant_id, action_name, contract_hash, schema_version, contract,
			risk, approval_mode, execution_mode
		) VALUES (
			'tenant-immutable', 'tests.immutable.contract', repeat('a', 64), '1', '{}'::jsonb,
			'high', 'required', 'embedded'
		)
	`)
	require.NoError(t, err, "legitimate contract insert must work")
	_, err = db.Exec(`UPDATE action_contract_versions SET risk = 'low' WHERE tenant_id = 'tenant-immutable'`)
	requireImmutableMutationRejected(t, err)
	_, err = db.Exec(`DELETE FROM action_contract_versions WHERE tenant_id = 'tenant-immutable'`)
	requireImmutableMutationRejected(t, err)

	_, err = db.Exec(`
		INSERT INTO sdk_signing_keys (tenant_id, key_id, public_key_pem, fingerprint_sha256)
		VALUES ('tenant-immutable', 'ed25519:test', 'PUBLIC KEY ONLY', repeat('b', 64))
	`)
	require.NoError(t, err, "legitimate signing-key insert must work")
	_, err = db.Exec(`UPDATE sdk_signing_keys SET public_key_pem = 'changed' WHERE tenant_id = 'tenant-immutable'`)
	requireImmutableMutationRejected(t, err)
	_, err = db.Exec(`DELETE FROM sdk_signing_keys WHERE tenant_id = 'tenant-immutable'`)
	requireImmutableMutationRejected(t, err)

	var batchID string
	err = db.QueryRow(`
		INSERT INTO sdk_evidence_batches (
			tenant_id, key_id, evidence_state, content_hash, chain_head,
			events_accepted, events_verified, verified_at
		) VALUES (
			'tenant-immutable', 'ed25519:test', 'verified', repeat('c', 64), repeat('d', 64),
			1, 1, NOW()
		) RETURNING id
	`).Scan(&batchID)
	require.NoError(t, err, "legitimate terminal evidence-batch insert must work")
	_, err = db.Exec(`UPDATE sdk_evidence_batches SET issues = '[{"index":0,"code":"changed"}]'::jsonb WHERE id = $1`, batchID)
	requireImmutableMutationRejected(t, err)
	_, err = db.Exec(`DELETE FROM sdk_evidence_batches WHERE id = $1`, batchID)
	requireImmutableMutationRejected(t, err)

	_, err = db.Exec(`
		INSERT INTO sdk_evidence_events (
			tenant_id, key_id, event_hash, batch_id, event, event_id,
			event_type, action_name, contract_hash, timestamp_utc
		) VALUES (
			'tenant-immutable', 'ed25519:test', repeat('e', 64), $1, '{}'::jsonb, 'event-1',
			'decision', 'tests.immutable.contract', repeat('a', 64), NOW()
		)
	`, batchID)
	require.NoError(t, err, "legitimate evidence-event insert must work")
	_, err = db.Exec(`UPDATE sdk_evidence_events SET action_name = 'changed' WHERE tenant_id = 'tenant-immutable'`)
	requireImmutableMutationRejected(t, err)
	_, err = db.Exec(`DELETE FROM sdk_evidence_events WHERE tenant_id = 'tenant-immutable'`)
	requireImmutableMutationRejected(t, err)

	var contracts, keys, batches, events int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM action_contract_versions WHERE tenant_id = 'tenant-immutable'`).Scan(&contracts))
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM sdk_signing_keys WHERE tenant_id = 'tenant-immutable'`).Scan(&keys))
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = 'tenant-immutable'`).Scan(&batches))
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = 'tenant-immutable'`).Scan(&events))
	require.Equal(t, []int{1, 1, 1, 1}, []int{contracts, keys, batches, events})
}
