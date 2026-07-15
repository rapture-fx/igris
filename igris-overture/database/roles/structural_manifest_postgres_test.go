package roles

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/database/bootstrap"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestStructuralManifestPostgresTypesCoverageAndLength(t *testing.T) {
	db, names := openStructuralManifestTestDatabase(t)
	ctx := testContext(t)

	rows, err := db.QueryContext(ctx, schemaStructureManifestSQL)
	require.NoError(t, err)
	defer rows.Close()
	columnTypes, err := rows.ColumnTypes()
	require.NoError(t, err)
	require.Len(t, columnTypes, 5)
	for _, columnType := range columnTypes {
		require.Equal(t, "TEXT", columnType.DatabaseTypeName(), columnType.Name())
	}

	wantedFamilies := map[string]bool{
		"column": false, "constraint": false, "extension": false,
		"function": false, "index": false,
		"policy": false, "policy_role": false, "relation": false,
		"rule": false, "sequence": false, "trigger": false,
		"type": false, "view": false,
	}
	var foundLongFunction, foundLedger bool
	for rows.Next() {
		var row structuralManifestRow
		require.NoError(t, rows.Scan(
			&row.ObjectType,
			&row.SchemaName,
			&row.ObjectIdentity,
			&row.AttributeName,
			&row.AttributeValue,
		))
		if _, ok := wantedFamilies[row.ObjectType]; ok {
			wantedFamilies[row.ObjectType] = true
		}
		if row.ObjectType == "function" &&
			row.ObjectIdentity == "reject_connected_immutable_record_mutation()" &&
			row.AttributeName == "definition" {
			require.True(t, row.AttributeValue.Valid)
			require.Greater(t, len(row.AttributeValue.String), 63)
			require.Contains(t, row.AttributeValue.String, "immutable Connected record")
			foundLongFunction = true
		}
		if strings.Contains(row.ObjectIdentity, "igris_schema_history") {
			foundLedger = true
		}
	}
	require.NoError(t, rows.Err())
	require.True(t, foundLongFunction)
	require.True(t, foundLedger, "migration-ledger structure must be represented")
	for family, found := range wantedFamilies {
		require.True(t, found, "missing manifest family %s", family)
	}

	first, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	second, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.Equal(t, first, second)
	require.Equal(t, ExpectedV069PostRoleStructureSHA256, first)

	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.NoError(t, err)
}

func TestStructuralManifestRejectsExistingObjectMutations(t *testing.T) {
	db, names := openStructuralManifestTestDatabase(t)
	ctx := testContext(t)

	var originalIndex string
	require.NoError(t, db.QueryRowContext(ctx,
		`SELECT pg_get_indexdef('public.action_definitions_tenant_name_active_idx'::regclass)`).Scan(&originalIndex))
	var originalView string
	require.NoError(t, db.QueryRowContext(ctx,
		`SELECT pg_get_viewdef('public.v_recent_telemetry'::regclass, true)`).Scan(&originalView))
	originalView = strings.TrimSuffix(strings.TrimSpace(originalView), ";")

	cases := []struct {
		name   string
		apply  string
		revert string
	}{
		{
			"function security definer",
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() SECURITY DEFINER`,
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() SECURITY INVOKER`,
		},
		{
			"function search path",
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() SET search_path TO public, pg_catalog`,
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() RESET search_path`,
		},
		{
			"function volatility",
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() STABLE`,
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() VOLATILE`,
		},
		{
			"function strictness",
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() RETURNS NULL ON NULL INPUT`,
			`ALTER FUNCTION public.reject_connected_immutable_record_mutation() CALLED ON NULL INPUT`,
		},
		{
			"trigger disabled mode",
			`ALTER TABLE public.action_contract_versions DISABLE TRIGGER action_contract_versions_immutable`,
			`ALTER TABLE public.action_contract_versions ENABLE TRIGGER action_contract_versions_immutable`,
		},
		{
			"trigger replica mode",
			`ALTER TABLE public.action_contract_versions ENABLE REPLICA TRIGGER action_contract_versions_immutable`,
			`ALTER TABLE public.action_contract_versions ENABLE TRIGGER action_contract_versions_immutable`,
		},
		{
			"trigger always mode",
			`ALTER TABLE public.action_contract_versions ENABLE ALWAYS TRIGGER action_contract_versions_immutable`,
			`ALTER TABLE public.action_contract_versions ENABLE TRIGGER action_contract_versions_immutable`,
		},
		{
			"trigger function binding",
			`DROP TRIGGER action_contract_versions_immutable ON public.action_contract_versions;
			 CREATE TRIGGER action_contract_versions_immutable BEFORE UPDATE OR DELETE ON public.action_contract_versions
			 FOR EACH ROW EXECUTE FUNCTION public.update_fleet_updated_at()`,
			`DROP TRIGGER action_contract_versions_immutable ON public.action_contract_versions;
			 CREATE TRIGGER action_contract_versions_immutable BEFORE UPDATE OR DELETE ON public.action_contract_versions
			 FOR EACH ROW EXECUTE FUNCTION public.reject_connected_immutable_record_mutation()`,
		},
		{
			"trigger timing event and scope",
			`DROP TRIGGER action_contract_versions_immutable ON public.action_contract_versions;
			 CREATE TRIGGER action_contract_versions_immutable AFTER UPDATE ON public.action_contract_versions
			 FOR EACH STATEMENT EXECUTE FUNCTION public.reject_connected_immutable_record_mutation()`,
			`DROP TRIGGER action_contract_versions_immutable ON public.action_contract_versions;
			 CREATE TRIGGER action_contract_versions_immutable BEFORE UPDATE OR DELETE ON public.action_contract_versions
			 FOR EACH ROW EXECUTE FUNCTION public.reject_connected_immutable_record_mutation()`,
		},
		{
			"trigger when expression",
			`DROP TRIGGER action_contract_versions_immutable ON public.action_contract_versions;
			 CREATE TRIGGER action_contract_versions_immutable BEFORE UPDATE OR DELETE ON public.action_contract_versions
			 FOR EACH ROW WHEN (OLD.tenant_id IS NOT NULL)
			 EXECUTE FUNCTION public.reject_connected_immutable_record_mutation()`,
			`DROP TRIGGER action_contract_versions_immutable ON public.action_contract_versions;
			 CREATE TRIGGER action_contract_versions_immutable BEFORE UPDATE OR DELETE ON public.action_contract_versions
			 FOR EACH ROW EXECUTE FUNCTION public.reject_connected_immutable_record_mutation()`,
		},
		{
			"constraint deferrability",
			`ALTER TABLE public.account ALTER CONSTRAINT "account_userId_fkey" DEFERRABLE INITIALLY DEFERRED`,
			`ALTER TABLE public.account ALTER CONSTRAINT "account_userId_fkey" NOT DEFERRABLE INITIALLY IMMEDIATE`,
		},
		{
			"constraint validation",
			`ALTER TABLE public.execution_eval_runs DROP CONSTRAINT execution_eval_runs_failed_count_check;
			 ALTER TABLE public.execution_eval_runs ADD CONSTRAINT execution_eval_runs_failed_count_check CHECK (failed_count >= 0) NOT VALID`,
			`ALTER TABLE public.execution_eval_runs VALIDATE CONSTRAINT execution_eval_runs_failed_count_check`,
		},
		{
			"long index predicate suffix",
			`DROP INDEX public.action_definitions_tenant_name_active_idx;
			 CREATE UNIQUE INDEX action_definitions_tenant_name_active_idx
			 ON public.action_definitions USING btree (tenant_id, name)
			 WHERE archived_at IS NULL AND tenant_id <> repeat('same-prefix-value-', 5) || 'changed-suffix'`,
			`DROP INDEX public.action_definitions_tenant_name_active_idx; ` + originalIndex,
		},
		{
			"long view and return rule definition",
			fmt.Sprintf(`CREATE OR REPLACE VIEW public.v_recent_telemetry AS SELECT * FROM (%s) AS original_view WHERE true`, originalView),
			`CREATE OR REPLACE VIEW public.v_recent_telemetry AS ` + originalView,
		},
		{
			"policy using expression",
			`DROP POLICY licenses_tenant_isolation ON public.licenses;
			 CREATE POLICY licenses_tenant_isolation ON public.licenses USING (true)`,
			`DROP POLICY licenses_tenant_isolation ON public.licenses;
			 CREATE POLICY licenses_tenant_isolation ON public.licenses USING (((customer_id)::text = public.current_tenant_id()))`,
		},
		{
			"policy with check expression",
			`DROP POLICY licenses_tenant_insert ON public.licenses;
			 CREATE POLICY licenses_tenant_insert ON public.licenses FOR INSERT WITH CHECK (true)`,
			`DROP POLICY licenses_tenant_insert ON public.licenses;
			 CREATE POLICY licenses_tenant_insert ON public.licenses FOR INSERT WITH CHECK (((customer_id)::text = public.current_tenant_id()))`,
		},
		{
			"long column default",
			`ALTER TABLE public.tenants ALTER COLUMN tenant_name SET DEFAULT repeat('same-prefix-value-', 5) || 'changed-suffix'`,
			`ALTER TABLE public.tenants ALTER COLUMN tenant_name SET DEFAULT ''::text`,
		},
		{
			"RLS disabled",
			`ALTER TABLE public.licenses DISABLE ROW LEVEL SECURITY`,
			`ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY`,
		},
		{
			"RLS force mode",
			`ALTER TABLE public.licenses NO FORCE ROW LEVEL SECURITY`,
			`ALTER TABLE public.licenses FORCE ROW LEVEL SECURITY`,
		},
		{
			"sequence ownership",
			`ALTER SEQUENCE public.tenant_policies_id_seq OWNED BY NONE`,
			`ALTER SEQUENCE public.tenant_policies_id_seq OWNED BY public.tenant_policies.id`,
		},
		{
			"migration ledger primary key",
			`ALTER TABLE public.igris_schema_history DROP CONSTRAINT igris_schema_history_pkey`,
			`ALTER TABLE public.igris_schema_history ADD CONSTRAINT igris_schema_history_pkey PRIMARY KEY (component, version)`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			requireStructuralMutationRejected(t, ctx, db, names, tc.apply, tc.revert)
		})
	}
}

func TestStructuralManifestRejectsLongPrefixFunctionBypass(t *testing.T) {
	db, names := openStructuralManifestTestDatabase(t)
	ctx := testContext(t)
	before, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)

	var originalDefinition string
	require.NoError(t, db.QueryRowContext(ctx,
		`SELECT pg_get_functiondef('public.reject_connected_immutable_record_mutation()'::regprocedure)`).Scan(&originalDefinition))
	require.Greater(t, len(originalDefinition), 63)

	_, err = db.ExecContext(ctx, `
		INSERT INTO public.action_contract_versions (
			tenant_id, action_name, contract_hash, schema_version, contract,
			risk, approval_mode, execution_mode
		) VALUES (
			'manifest-bypass', 'manifest.bypass', repeat('a', 64), '1', '{}'::jsonb,
			'low', 'never', 'embedded'
		)`)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, `UPDATE public.action_contract_versions SET risk = 'high' WHERE tenant_id = 'manifest-bypass'`)
	require.Error(t, err, "expected intact immutability function to reject update")

	mutatedDefinition := `CREATE OR REPLACE FUNCTION public.reject_connected_immutable_record_mutation()
		RETURNS trigger
		LANGUAGE plpgsql
		SET search_path TO 'pg_catalog', 'public'
		AS $function$
		BEGIN
		    -- This body shares the long rendered definition prefix but bypasses enforcement.
		    RETURN NEW;
		END;
		$function$`
	_, err = db.ExecContext(ctx, mutatedDefinition)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, `UPDATE public.action_contract_versions SET risk = 'high' WHERE tenant_id = 'manifest-bypass'`)
	require.NoError(t, err, "bounded test must demonstrate the altered enforcement behavior")

	after, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.NotEqual(t, before, after)
	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.ErrorContains(t, err, "structural catalog hash mismatch")

	_, err = db.ExecContext(ctx, originalDefinition)
	require.NoError(t, err)
	restored, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.Equal(t, before, restored)
	_, err = db.ExecContext(ctx, `UPDATE public.action_contract_versions SET risk = 'critical' WHERE tenant_id = 'manifest-bypass'`)
	require.Error(t, err, "restored function must reject protected update")
}

func TestStagingPreflightRequiresOriginTriggerMode(t *testing.T) {
	db, names := openStructuralManifestTestDatabase(t)
	ctx := testContext(t)
	for _, tc := range []struct {
		name    string
		command string
		mode    string
	}{
		{"disabled", "DISABLE", "D"},
		{"replica", "ENABLE REPLICA", "R"},
		{"always", "ENABLE ALWAYS", "A"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := db.ExecContext(ctx, fmt.Sprintf(
				`ALTER TABLE public.action_contract_versions %s TRIGGER action_contract_versions_immutable`,
				tc.command,
			))
			require.NoError(t, err)
			_, err = StagingPreflight(ctx, db, names, io.Discard)
			require.ErrorContains(t, err, "structural catalog hash mismatch")
			require.ErrorContains(t, err, "enable mode is "+tc.mode+", want O (origin)")
			_, err = db.ExecContext(ctx,
				`ALTER TABLE public.action_contract_versions ENABLE TRIGGER action_contract_versions_immutable`)
			require.NoError(t, err)
			_, err = StagingPreflight(ctx, db, names, io.Discard)
			require.NoError(t, err)
		})
	}
}

func TestStagingPreflightSeparatesOwnerVerificationFromStructuralHash(t *testing.T) {
	db, names := openStructuralManifestTestDatabase(t)
	ctx := testContext(t)
	before, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx,
		`ALTER FUNCTION public.reject_connected_immutable_record_mutation() OWNER TO postgres`)
	require.NoError(t, err)
	after, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.Equal(t, before, after, "owner changes belong to the separate role-model layer")
	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.ErrorContains(t, err, "public functions are not owned by migration owner")

	_, err = db.ExecContext(ctx, `ALTER FUNCTION public.reject_connected_immutable_record_mutation() OWNER TO `+pq.QuoteIdentifier(names.MigrationOwner))
	require.NoError(t, err)
	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.NoError(t, err)
}

func TestStructuralManifestFixtureSemantics(t *testing.T) {
	db, names := openStructuralManifestTestDatabase(t)
	ctx := testContext(t)

	t.Run("identity and generated semantics", func(t *testing.T) {
		_, err := db.ExecContext(ctx, `CREATE TABLE public.manifest_semantics_fixture (
			id bigint GENERATED BY DEFAULT AS IDENTITY,
			input integer,
			doubled integer GENERATED ALWAYS AS (input * 2) STORED
		)`)
		require.NoError(t, err)
		identityBefore, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `ALTER TABLE public.manifest_semantics_fixture ALTER COLUMN id SET GENERATED ALWAYS`)
		require.NoError(t, err)
		identityAfter, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		require.NotEqual(t, identityBefore, identityAfter)
		_, err = StagingPreflight(ctx, db, names, io.Discard)
		require.ErrorContains(t, err, "structural catalog hash mismatch")
		_, err = db.ExecContext(ctx, `DROP TABLE public.manifest_semantics_fixture`)
		require.NoError(t, err)

		_, err = db.ExecContext(ctx, `CREATE TABLE public.manifest_semantics_fixture (
			input integer,
			doubled integer GENERATED ALWAYS AS (input * 2) STORED
		)`)
		require.NoError(t, err)
		generatedBefore, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `ALTER TABLE public.manifest_semantics_fixture DROP COLUMN doubled;
			ALTER TABLE public.manifest_semantics_fixture ADD COLUMN doubled integer GENERATED ALWAYS AS (input * 3) STORED`)
		require.NoError(t, err)
		generatedAfter, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		require.NotEqual(t, generatedBefore, generatedAfter)
		_, err = StagingPreflight(ctx, db, names, io.Discard)
		require.ErrorContains(t, err, "structural catalog hash mismatch")
		_, err = db.ExecContext(ctx, `DROP TABLE public.manifest_semantics_fixture`)
		require.NoError(t, err)
		_, err = StagingPreflight(ctx, db, names, io.Discard)
		require.NoError(t, err)
	})

	t.Run("rule action and enable mode", func(t *testing.T) {
		_, err := db.ExecContext(ctx, `CREATE TABLE public.manifest_rule_fixture (id integer PRIMARY KEY, value integer);
			CREATE TABLE public.manifest_rule_sink (id integer, value integer);
			CREATE RULE manifest_rule_guard AS ON UPDATE TO public.manifest_rule_fixture
			DO ALSO INSERT INTO public.manifest_rule_sink(id, value) VALUES (NEW.id, NEW.value)`)
		require.NoError(t, err)
		before, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `ALTER TABLE public.manifest_rule_fixture DISABLE RULE manifest_rule_guard`)
		require.NoError(t, err)
		disabled, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		require.NotEqual(t, before, disabled)
		_, err = db.ExecContext(ctx, `ALTER TABLE public.manifest_rule_fixture ENABLE RULE manifest_rule_guard;
			DROP RULE manifest_rule_guard ON public.manifest_rule_fixture;
			CREATE RULE manifest_rule_guard AS ON UPDATE TO public.manifest_rule_fixture
			DO ALSO INSERT INTO public.manifest_rule_sink(id, value) VALUES (NEW.id, NEW.value + 1)`)
		require.NoError(t, err)
		changedAction, err := computeStructuralHash(ctx, db)
		require.NoError(t, err)
		require.NotEqual(t, before, changedAction)
		_, err = StagingPreflight(ctx, db, names, io.Discard)
		require.ErrorContains(t, err, "structural catalog hash mismatch")
		_, err = db.ExecContext(ctx, `DROP TABLE public.manifest_rule_fixture, public.manifest_rule_sink`)
		require.NoError(t, err)
		_, err = StagingPreflight(ctx, db, names, io.Discard)
		require.NoError(t, err)
	})
}

func requireStructuralMutationRejected(
	t *testing.T,
	ctx context.Context,
	db *sql.DB,
	names Names,
	apply string,
	revert string,
) {
	t.Helper()
	before, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.Equal(t, ExpectedV069PostRoleStructureSHA256, before)

	_, err = db.ExecContext(ctx, apply)
	require.NoError(t, err)
	after, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.NotEqual(t, before, after)
	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.ErrorContains(t, err, "structural catalog hash mismatch")

	_, err = db.ExecContext(ctx, revert)
	require.NoError(t, err)
	restored, err := computeStructuralHash(ctx, db)
	require.NoError(t, err)
	require.Equal(t, before, restored)
	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.NoError(t, err)
}

func openStructuralManifestTestDatabase(t *testing.T) (*sql.DB, Names) {
	t.Helper()
	adminDSN := os.Getenv("IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN")
	if adminDSN == "" {
		t.Skip("set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN to run structural manifest PostgreSQL tests")
	}

	suffix := randomHex(t, 4)
	names := Names{
		MigrationOwner:   "igris_mig_" + suffix,
		AppRuntime:       "igris_rt_" + suffix,
		ReadOnlyOperator: "igris_ro_" + suffix,
		BackupRestore:    "igris_bk_" + suffix,
	}
	t.Cleanup(func() {
		admin, err := sql.Open("postgres", adminDSN)
		if err != nil {
			return
		}
		defer admin.Close()
		roles := []string{names.AppRuntime, names.ReadOnlyOperator, names.BackupRestore, names.MigrationOwner}
		sort.Strings(roles)
		for _, role := range roles {
			_, _ = admin.Exec(`DROP OWNED BY ` + pq.QuoteIdentifier(role) + ` CASCADE`)
			_, _ = admin.Exec(`DROP ROLE IF EXISTS ` + pq.QuoteIdentifier(role))
		}
	})

	db := openDisposableDatabase(t, adminDSN)
	ctx := testContext(t)
	bootstrapRunner, err := bootstrapRunnerForDB(t, db)
	require.NoError(t, err)
	_, err = bootstrapRunner.Run(ctx, db, bootstrap.ModeApply, io.Discard)
	require.NoError(t, err)
	roleRunner, err := NewRunner(names)
	require.NoError(t, err)
	_, err = roleRunner.Run(ctx, db, ModeApply, io.Discard)
	require.NoError(t, err)
	_, err = StagingPreflight(ctx, db, names, io.Discard)
	require.NoError(t, err)
	return db, names
}
