package roles

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"strings"

	"github.com/Igris-inertial/system/igris-overture/database/bootstrap"
)

// StagingPreflightResult captures Connected staging readiness checks.
type StagingPreflightResult struct {
	SchemaHash           string
	StructuralHash       string
	HistoryVersions      []string
	TriggersEnabled      map[string]bool
	RuntimeRole          string
	RuntimeOwnsImmutable bool
	RuntimeCanUpdateImm  bool
	RuntimeCanDeleteImm  bool
	RuntimeInsertOK      bool
	IdempotencyUpdateOK  bool
	RLSActive            bool
	Issues               []string
	OK                   bool
}

// StagingPreflight verifies schema history, catalog state, migration-069
// triggers, and runtime privilege boundaries. It fails closed on any mismatch.
// adminDB must be able to SET ROLE to the runtime role for privilege probes.
//
// Catalog hash notes: bootstrap.ExpectedV069SchemaSHA256 pins the post-bootstrap
// pre-role ACL state. Role provisioning intentionally rewrites ACLs and
// function settings, so staging also pins a separate post-role structural
// manifest that excludes ownership/grants but retains schema objects.
func StagingPreflight(ctx context.Context, adminDB *sql.DB, names Names, out io.Writer) (StagingPreflightResult, error) {
	names = names.Normalized()
	res := StagingPreflightResult{
		TriggersEnabled: map[string]bool{},
		RuntimeRole:     names.AppRuntime,
	}

	hash, err := computeSchemaHash(ctx, adminDB)
	if err != nil {
		return res, err
	}
	res.SchemaHash = hash
	structuralHash, err := computeStructuralHash(ctx, adminDB)
	if err != nil {
		return res, err
	}
	res.StructuralHash = structuralHash
	if structuralHash != ExpectedV069PostRoleStructureSHA256 {
		res.Issues = append(res.Issues, fmt.Sprintf("structural catalog hash mismatch: got %s want %s", structuralHash, ExpectedV069PostRoleStructureSHA256))
	}

	// History must record baseline + 067/068/069 with pinned checksums.
	type histRow struct {
		Version  string
		Kind     string
		Checksum string
	}
	rows, err := adminDB.QueryContext(ctx, `
		SELECT version, artifact_kind, checksum_sha256
		FROM public.igris_schema_history
		WHERE component = $1 ORDER BY version`, bootstrap.Component)
	if err != nil {
		return res, fmt.Errorf("read schema history: %w", err)
	}
	defer rows.Close()
	var history []histRow
	for rows.Next() {
		var row histRow
		if err := rows.Scan(&row.Version, &row.Kind, &row.Checksum); err != nil {
			return res, err
		}
		history = append(history, row)
		res.HistoryVersions = append(res.HistoryVersions, row.Version)
	}
	if err := rows.Err(); err != nil {
		return res, err
	}

	// Bootstrap preflight validates ledger checksums and the pre-role hash. A
	// raw hash mismatch is acceptable only when the independently pinned
	// post-role structural manifest still matches exactly.
	br, err := bootstrap.NewRunner()
	if err != nil {
		return res, err
	}
	bootPlan, bootErr := br.Preflight(ctx, adminDB)
	if bootErr != nil {
		if !strings.Contains(bootErr.Error(), "ledger claims v069 but required schema objects differ") {
			res.Issues = append(res.Issues, fmt.Sprintf("bootstrap preflight: %v", bootErr))
		} else if hash == bootstrap.ExpectedV069SchemaSHA256 {
			res.Issues = append(res.Issues, fmt.Sprintf("bootstrap preflight: %v", bootErr))
		} else if structuralHash == ExpectedV069PostRoleStructureSHA256 {
			fmt.Fprintf(out, "catalog_hash_note=acl_sensitive_hash_differs_after_role_provision expected_bootstrap_v069=%s\n", bootstrap.ExpectedV069SchemaSHA256)
		}
	} else if bootPlan.Path != bootstrap.PathCurrent {
		res.Issues = append(res.Issues, fmt.Sprintf("bootstrap path is %s, want %s", bootPlan.Path, bootstrap.PathCurrent))
	} else if hash != bootstrap.ExpectedV069SchemaSHA256 {
		res.Issues = append(res.Issues, fmt.Sprintf("catalog hash mismatch: got %s want %s", hash, bootstrap.ExpectedV069SchemaSHA256))
	}

	required := map[string]string{
		bootstrap.BaselineVersion:         "baseline",
		"067_action_contract_versions":    "migration",
		"068_sdk_evidence_ingestion":      "migration",
		"069_connected_immutable_records": "migration",
	}
	have := map[string]histRow{}
	for _, row := range history {
		have[row.Version] = row
	}
	for version, kind := range required {
		row, ok := have[version]
		if !ok {
			res.Issues = append(res.Issues, fmt.Sprintf("missing schema history version %s", version))
			continue
		}
		if row.Kind != kind {
			res.Issues = append(res.Issues, fmt.Sprintf("history kind mismatch for %s: got %s want %s", version, row.Kind, kind))
		}
	}

	// Migration-069 triggers enabled.
	for _, pair := range [][2]string{
		{"action_contract_versions", "action_contract_versions_immutable"},
		{"sdk_signing_keys", "sdk_signing_keys_immutable"},
		{"sdk_evidence_batches", "sdk_evidence_batches_immutable"},
		{"sdk_evidence_events", "sdk_evidence_events_immutable"},
	} {
		var enabled string
		err := adminDB.QueryRowContext(ctx, `
			SELECT t.tgenabled::text
			FROM pg_trigger t
			JOIN pg_class c ON c.oid = t.tgrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND c.relname = $1 AND t.tgname = $2 AND NOT t.tgisinternal`,
			pair[0], pair[1]).Scan(&enabled)
		if err != nil {
			res.Issues = append(res.Issues, fmt.Sprintf("trigger %s missing: %v", pair[1], err))
			res.TriggersEnabled[pair[1]] = false
			continue
		}
		ok := enabled == "O"
		res.TriggersEnabled[pair[1]] = ok
		if !ok {
			res.Issues = append(res.Issues, fmt.Sprintf("trigger %s enable mode is %s, want O (origin)", pair[1], enabled))
		}
	}

	// Role model preflight (ownership / PUBLIC / grants).
	roleRunner, err := NewRunner(names)
	if err != nil {
		return res, err
	}
	rolePlan, err := roleRunner.inspect(ctx, adminDB)
	if err != nil {
		return res, err
	}
	res.Issues = append(res.Issues, rolePlan.Issues...)
	res.RuntimeOwnsImmutable = rolePlan.RuntimeOwnsObjects

	// Privilege probes as runtime role.
	if rolePlan.RolesPresent[names.AppRuntime] {
		if err := probeRuntimePrivileges(ctx, adminDB, names, &res); err != nil {
			return res, err
		}
	} else {
		res.Issues = append(res.Issues, "app runtime role not present")
	}

	// RLS still active on at least one tenant-scoped baseline table.
	var rls bool
	if err := adminDB.QueryRowContext(ctx, `
		SELECT relrowsecurity FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relname = 'licenses'`).Scan(&rls); err == nil {
		res.RLSActive = rls
		if !rls {
			res.Issues = append(res.Issues, "RLS disabled on licenses")
		}
	}

	res.OK = len(res.Issues) == 0
	writeStagingPreflight(out, res)
	if !res.OK {
		return res, fmt.Errorf("staging preflight failed closed: %s", strings.Join(res.Issues, "; "))
	}
	fmt.Fprintln(out, "result=staging_preflight_ok")
	return res, nil
}

func probeRuntimePrivileges(ctx context.Context, adminDB *sql.DB, names Names, res *StagingPreflightResult) error {
	// Ownership of immutable tables.
	for _, table := range ImmutableConnectedTables {
		var owner string
		if err := adminDB.QueryRowContext(ctx, `
			SELECT pg_catalog.pg_get_userbyid(c.relowner)
			FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND c.relname = $1`, table).Scan(&owner); err != nil {
			return err
		}
		if owner == names.AppRuntime {
			res.RuntimeOwnsImmutable = true
			res.Issues = append(res.Issues, fmt.Sprintf("runtime owns immutable table %s", table))
		}
	}

	tx, err := adminDB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`SET LOCAL ROLE %s`, quoteIdent(names.AppRuntime))); err != nil {
		return fmt.Errorf("set local role to runtime: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return err
	}

	// Each probe uses a SAVEPOINT so expected failures do not abort the tx.
	probe := func(name, sqlText string, args ...any) error {
		sp := "sp_" + strings.ReplaceAll(name, "-", "_")
		if _, err := tx.ExecContext(ctx, `SAVEPOINT `+sp); err != nil {
			return fmt.Errorf("savepoint %s: %w", name, err)
		}
		_, err := tx.ExecContext(ctx, sqlText, args...)
		if err != nil {
			_, _ = tx.ExecContext(ctx, `ROLLBACK TO SAVEPOINT `+sp)
			_, _ = tx.ExecContext(ctx, `RELEASE SAVEPOINT `+sp)
			return err
		}
		_, _ = tx.ExecContext(ctx, `RELEASE SAVEPOINT `+sp)
		return nil
	}

	err = probe("insert_contract", `
		INSERT INTO action_contract_versions (
			tenant_id, action_name, contract_hash, schema_version, contract,
			risk, approval_mode, execution_mode
		) VALUES (
			'__staging_preflight__', 'preflight.probe', repeat('a', 64), '1', '{}'::jsonb,
			'low', 'never', 'embedded'
		)`)
	if err != nil {
		res.Issues = append(res.Issues, fmt.Sprintf("runtime INSERT into action_contract_versions failed: %v", err))
	} else {
		res.RuntimeInsertOK = true
	}

	if err := probe("update_contract", `UPDATE action_contract_versions SET risk = 'high' WHERE tenant_id = '__staging_preflight__'`); err == nil {
		res.RuntimeCanUpdateImm = true
		res.Issues = append(res.Issues, "runtime was allowed to UPDATE action_contract_versions")
	}
	if err := probe("delete_contract", `DELETE FROM action_contract_versions WHERE tenant_id = '__staging_preflight__'`); err == nil {
		res.RuntimeCanDeleteImm = true
		res.Issues = append(res.Issues, "runtime was allowed to DELETE action_contract_versions")
	}

	if err := probe("insert_history", `
		INSERT INTO igris_schema_history (component, version, artifact_kind, checksum_sha256)
		VALUES ('connected-actions', 'should_fail', 'migration', repeat('0', 64))`); err == nil {
		res.Issues = append(res.Issues, "runtime was allowed to INSERT into igris_schema_history")
	}

	if err := probe("disable_trigger", `ALTER TABLE action_contract_versions DISABLE TRIGGER action_contract_versions_immutable`); err == nil {
		res.Issues = append(res.Issues, "runtime was allowed to DISABLE immutability trigger")
	}

	err = probe("idem_insert", `
		INSERT INTO contract_sync_idempotency (
			tenant_id, operation, action_name, idempotency_key,
			request_fingerprint, response_status, response_body
		) VALUES (
			'__staging_preflight__', 'contract_sync', 'preflight.probe', 'k1',
			repeat('b', 64), 0, '{}'::jsonb
		)`)
	if err != nil {
		res.Issues = append(res.Issues, fmt.Sprintf("runtime idempotency INSERT failed: %v", err))
	} else {
		if err := probe("idem_update", `
			UPDATE contract_sync_idempotency
			SET response_status = 200, response_body = '{"ok":true}'::jsonb
			WHERE tenant_id = '__staging_preflight__' AND idempotency_key = 'k1'`); err != nil {
			res.Issues = append(res.Issues, fmt.Sprintf("runtime idempotency UPDATE failed: %v", err))
		} else {
			res.IdempotencyUpdateOK = true
		}
	}

	if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
		return err
	}
	return nil
}

func computeSchemaHash(ctx context.Context, db *sql.DB) (string, error) {
	return computeManifestHash(ctx, db, bootstrap.SchemaManifestSQL)
}

func computeStructuralHash(ctx context.Context, db *sql.DB) (string, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return "", err
	}
	rows, err := tx.QueryContext(ctx, schemaStructureManifestSQL)
	if err != nil {
		return "", fmt.Errorf("query structural manifest: %w", err)
	}
	defer rows.Close()

	h := sha256.New()
	if _, err := io.WriteString(h, structuralManifestFormatV2); err != nil {
		return "", err
	}
	for rows.Next() {
		var row structuralManifestRow
		if err := rows.Scan(
			&row.ObjectType,
			&row.SchemaName,
			&row.ObjectIdentity,
			&row.AttributeName,
			&row.AttributeValue,
		); err != nil {
			return "", err
		}
		if err := writeStructuralManifestRow(h, row); err != nil {
			return "", err
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

const structuralManifestFormatV2 = "igris-postgresql-structural-manifest-v2\x00"

var structuralManifestFieldLabels = [...]string{
	"object_type",
	"schema_name",
	"object_identity",
	"attribute_name",
	"attribute_value",
}

type structuralManifestRow struct {
	ObjectType     string
	SchemaName     string
	ObjectIdentity string
	AttributeName  string
	AttributeValue sql.NullString
}

func writeStructuralManifestRow(w io.Writer, row structuralManifestRow) error {
	if _, err := w.Write([]byte{0x1e}); err != nil {
		return err
	}
	fields := [...]sql.NullString{
		{String: row.ObjectType, Valid: true},
		{String: row.SchemaName, Valid: true},
		{String: row.ObjectIdentity, Valid: true},
		{String: row.AttributeName, Valid: true},
		row.AttributeValue,
	}
	for i := range fields {
		if err := writeStructuralManifestField(w, structuralManifestFieldLabels[i], fields[i]); err != nil {
			return err
		}
	}
	_, err := w.Write([]byte{0x1f})
	return err
}

func writeStructuralManifestField(w io.Writer, label string, value sql.NullString) error {
	if err := writeLengthPrefixedText(w, label); err != nil {
		return err
	}
	if !value.Valid {
		_, err := w.Write([]byte{0})
		return err
	}
	if _, err := w.Write([]byte{1}); err != nil {
		return err
	}
	return writeLengthPrefixedText(w, value.String)
}

func writeLengthPrefixedText(w io.Writer, value string) error {
	var size [8]byte
	binary.BigEndian.PutUint64(size[:], uint64(len(value)))
	if _, err := w.Write(size[:]); err != nil {
		return err
	}
	_, err := io.WriteString(w, value)
	return err
}

func hashStructuralManifestRows(rows []structuralManifestRow) (string, error) {
	h := sha256.New()
	if _, err := io.WriteString(h, structuralManifestFormatV2); err != nil {
		return "", err
	}
	for _, row := range rows {
		if err := writeStructuralManifestRow(h, row); err != nil {
			return "", err
		}
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func computeManifestHash(ctx context.Context, db *sql.DB, query string) (string, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return "", err
	}
	rows, err := tx.QueryContext(ctx, query)
	if err != nil {
		return "", fmt.Errorf("query schema manifest: %w", err)
	}
	defer rows.Close()
	h := sha256.New()
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			return "", err
		}
		io.WriteString(h, line)
		io.WriteString(h, "\n")
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func writeStagingPreflight(out io.Writer, res StagingPreflightResult) {
	fmt.Fprintf(out, "schema_manifest_sha256=%s\n", res.SchemaHash)
	fmt.Fprintf(out, "structural_manifest_sha256=%s\n", res.StructuralHash)
	fmt.Fprintf(out, "history_versions=%s\n", strings.Join(res.HistoryVersions, ","))
	for name, ok := range res.TriggersEnabled {
		fmt.Fprintf(out, "trigger_enabled %s=%v\n", name, ok)
	}
	fmt.Fprintf(out, "runtime_role=%s\n", res.RuntimeRole)
	fmt.Fprintf(out, "runtime_insert_ok=%v idempotency_update_ok=%v\n", res.RuntimeInsertOK, res.IdempotencyUpdateOK)
	fmt.Fprintf(out, "rls_active=%v\n", res.RLSActive)
	if len(res.Issues) == 0 {
		fmt.Fprintln(out, "issues=none")
	} else {
		fmt.Fprintf(out, "issues=%s\n", strings.Join(res.Issues, " | "))
	}
}
