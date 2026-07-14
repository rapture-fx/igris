// Package roles implements explicit, fail-closed Connected database role
// provisioning. It is intentionally not imported by application startup and
// never auto-creates roles during API boot.
package roles

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// Default role names for a private Connected staging environment.
const (
	DefaultMigrationOwner   = "igris_migration_owner"
	DefaultAppRuntime       = "igris_app_runtime"
	DefaultReadOnlyOperator = "igris_read_only_operator"
	DefaultBackupRestore    = "igris_backup_restore"
	DefaultAppRuntimePasswd = "" // never default a password
	DefaultMigrationPasswd  = ""
)

// Mode selects preflight (read-only verification / plan) or apply (mutate roles/grants).
type Mode string

const (
	ModePreflight Mode = "preflight"
	ModeApply     Mode = "apply"
)

// Names holds the four required role names. Override via env when repository
// conventions require alternate names; empty fields fall back to defaults.
type Names struct {
	MigrationOwner   string
	AppRuntime       string
	ReadOnlyOperator string
	BackupRestore    string
}

// NamesFromEnv loads role names from IGRIS_DB_ROLE_* environment variables.
func NamesFromEnv() Names {
	return Names{
		MigrationOwner:   firstNonEmpty(os.Getenv("IGRIS_DB_ROLE_MIGRATION_OWNER"), DefaultMigrationOwner),
		AppRuntime:       firstNonEmpty(os.Getenv("IGRIS_DB_ROLE_APP_RUNTIME"), DefaultAppRuntime),
		ReadOnlyOperator: firstNonEmpty(os.Getenv("IGRIS_DB_ROLE_READ_ONLY_OPERATOR"), DefaultReadOnlyOperator),
		BackupRestore:    firstNonEmpty(os.Getenv("IGRIS_DB_ROLE_BACKUP_RESTORE"), DefaultBackupRestore),
	}.Normalized()
}

// Normalized fills defaults for empty role names.
func (n Names) Normalized() Names {
	if n.MigrationOwner == "" {
		n.MigrationOwner = DefaultMigrationOwner
	}
	if n.AppRuntime == "" {
		n.AppRuntime = DefaultAppRuntime
	}
	if n.ReadOnlyOperator == "" {
		n.ReadOnlyOperator = DefaultReadOnlyOperator
	}
	if n.BackupRestore == "" {
		n.BackupRestore = DefaultBackupRestore
	}
	return n
}

// Validate ensures role names are distinct and look like safe SQL identifiers.
func (n Names) Validate() error {
	n = n.Normalized()
	seen := map[string]string{}
	for label, name := range map[string]string{
		"migration_owner":    n.MigrationOwner,
		"app_runtime":        n.AppRuntime,
		"read_only_operator": n.ReadOnlyOperator,
		"backup_restore":     n.BackupRestore,
	} {
		if err := validateRoleName(name); err != nil {
			return fmt.Errorf("%s: %w", label, err)
		}
		if prev, ok := seen[name]; ok {
			return fmt.Errorf("role name %q is reused for %s and %s", name, prev, label)
		}
		seen[name] = label
	}
	return nil
}

// ImmutableConnectedTables must never receive UPDATE/DELETE grants for runtime.
var ImmutableConnectedTables = []string{
	"action_contract_versions",
	"sdk_signing_keys",
	"sdk_evidence_batches",
	"sdk_evidence_events",
}

// IdempotencyTables require narrow UPDATE for claim/complete flows.
var IdempotencyTables = []string{
	"contract_sync_idempotency",
	"evidence_ingest_idempotency",
}

// SensitiveTables must never grant privileges to PUBLIC.
var SensitiveTables = append(append([]string{
	"igris_schema_history",
	"tenant_api_keys",
	"tenants",
	"action_definitions",
}, ImmutableConnectedTables...), IdempotencyTables...)

// Plan describes the provisioning intent or verification outcome.
type Plan struct {
	Mode               Mode
	Names              Names
	ConnectedUser      string
	IsSuperuser        bool
	CanCreateRole      bool
	RolesPresent       map[string]bool
	ImmutableOwnedBy   map[string]string
	RuntimeOwnsObjects bool
	PublicPrivileges   []string
	Issues             []string
}

// Runner applies or verifies the least-privilege role model.
type Runner struct {
	Names Names
}

// NewRunner constructs a runner with validated role names.
func NewRunner(names Names) (*Runner, error) {
	names = names.Normalized()
	if err := names.Validate(); err != nil {
		return nil, err
	}
	return &Runner{Names: names}, nil
}

// Run executes preflight or apply. Apply requires a migration-owner-capable
// connection (superuser or CREATEROLE with ownership of managed objects).
func (r *Runner) Run(ctx context.Context, db *sql.DB, mode Mode, out io.Writer) (Plan, error) {
	if mode != ModePreflight && mode != ModeApply {
		return Plan{}, fmt.Errorf("unsupported mode %q (want preflight or apply)", mode)
	}
	plan, err := r.inspect(ctx, db)
	if err != nil {
		return Plan{}, err
	}
	plan.Mode = mode
	printPlan(out, plan)
	if mode == ModePreflight {
		if len(plan.Issues) > 0 {
			return plan, fmt.Errorf("role preflight failed closed: %s", strings.Join(plan.Issues, "; "))
		}
		fmt.Fprintln(out, "result=role_model_ok")
		return plan, nil
	}

	if err := r.requireAuthority(plan); err != nil {
		return plan, err
	}
	if err := r.apply(ctx, db); err != nil {
		return plan, err
	}
	final, err := r.inspect(ctx, db)
	if err != nil {
		return Plan{}, fmt.Errorf("post-provision verification failed: %w", err)
	}
	final.Mode = mode
	printPlan(out, final)
	if len(final.Issues) > 0 {
		return final, fmt.Errorf("role apply verification failed closed: %s", strings.Join(final.Issues, "; "))
	}
	fmt.Fprintln(out, "result=role_model_applied")
	return final, nil
}

func (r *Runner) requireAuthority(plan Plan) error {
	if plan.IsSuperuser {
		return nil
	}
	if !plan.CanCreateRole {
		return errors.New("connected user lacks CREATEROLE and is not superuser; refuse role provisioning")
	}
	// Non-superuser CREATEROLE is accepted only when it already owns the
	// migration-owner role or will operate as the migration owner.
	if plan.ConnectedUser != r.Names.MigrationOwner {
		return fmt.Errorf("connected user %q is not superuser and is not migration owner %q; refuse grant changes",
			plan.ConnectedUser, r.Names.MigrationOwner)
	}
	return nil
}

func (r *Runner) apply(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin role provision transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(438774918067)`); err != nil {
		return fmt.Errorf("acquire role provision lock: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return fmt.Errorf("set role provision search path: %w", err)
	}

	// Create NOLOGIN shell roles first when missing. LOGIN is enabled without
	// embedding passwords; operators set credentials out of band.
	for _, name := range []string{
		r.Names.MigrationOwner,
		r.Names.AppRuntime,
		r.Names.ReadOnlyOperator,
		r.Names.BackupRestore,
	} {
		if err := ensureRole(ctx, tx, name); err != nil {
			return err
		}
	}

	// Harden role attributes.
	stmts := []string{
		fmt.Sprintf(`ALTER ROLE %s NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`, quoteIdent(r.Names.AppRuntime)),
		fmt.Sprintf(`ALTER ROLE %s NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`, quoteIdent(r.Names.ReadOnlyOperator)),
		fmt.Sprintf(`ALTER ROLE %s NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`, quoteIdent(r.Names.BackupRestore)),
		// Migration owner may own objects but must not be a superuser by default.
		fmt.Sprintf(`ALTER ROLE %s NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`, quoteIdent(r.Names.MigrationOwner)),
	}
	for _, stmt := range stmts {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("harden role attributes: %w", err)
		}
	}

	if err := r.reassignOwnership(ctx, tx); err != nil {
		return err
	}
	if err := r.applyGrants(ctx, tx); err != nil {
		return err
	}
	if err := r.hardenSecurityDefinerSearchPath(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit role provision transaction: %w", err)
	}
	return nil
}

func ensureRole(ctx context.Context, tx *sql.Tx, name string) error {
	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)`, name).Scan(&exists); err != nil {
		return fmt.Errorf("inspect role %s: %w", name, err)
	}
	if exists {
		return nil
	}
	// LOGIN without password: authentication is configured by the operator
	// (password, peer, cert). Never embed secrets in repository SQL.
	_, err := tx.ExecContext(ctx, fmt.Sprintf(
		`CREATE ROLE %s LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`,
		quoteIdent(name),
	))
	if err != nil {
		return fmt.Errorf("create role %s: %w", name, err)
	}
	return nil
}

func (r *Runner) reassignOwnership(ctx context.Context, tx *sql.Tx) error {
	// Collect first, then ALTER. PostgreSQL forbids interleaved queries on an
	// open result set within the same transaction connection.
	type rel struct {
		name string
		kind string
	}
	rows, err := tx.QueryContext(ctx, `
		SELECT c.relname, c.relkind
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public'
		  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
		  AND c.relname <> 'schema_migrations'`)
	if err != nil {
		return fmt.Errorf("list public relations for ownership: %w", err)
	}
	var relations []rel
	for rows.Next() {
		var item rel
		if err := rows.Scan(&item.name, &item.kind); err != nil {
			rows.Close()
			return err
		}
		relations = append(relations, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, item := range relations {
		kind := "TABLE"
		switch item.kind {
		case "S":
			kind = "SEQUENCE"
		case "v":
			kind = "VIEW"
		case "m":
			kind = "MATERIALIZED VIEW"
		}
		stmt := fmt.Sprintf(`ALTER %s public.%s OWNER TO %s`, kind, quoteIdent(item.name), quoteIdent(r.Names.MigrationOwner))
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("reassign ownership of %s: %w", item.name, err)
		}
	}

	fnRows, err := tx.QueryContext(ctx, `
		SELECT p.oid::regprocedure::text
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
		  AND NOT EXISTS (
		    SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
		  )`)
	if err != nil {
		return fmt.Errorf("list public functions for ownership: %w", err)
	}
	var functions []string
	for fnRows.Next() {
		var identity string
		if err := fnRows.Scan(&identity); err != nil {
			fnRows.Close()
			return err
		}
		functions = append(functions, identity)
	}
	if err := fnRows.Err(); err != nil {
		fnRows.Close()
		return err
	}
	fnRows.Close()

	for _, identity := range functions {
		stmt := fmt.Sprintf(`ALTER FUNCTION %s OWNER TO %s`, identity, quoteIdent(r.Names.MigrationOwner))
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("reassign function ownership of %s: %w", identity, err)
		}
	}
	return nil
}

func (r *Runner) applyGrants(ctx context.Context, tx *sql.Tx) error {
	owner := quoteIdent(r.Names.MigrationOwner)
	runtime := quoteIdent(r.Names.AppRuntime)
	ro := quoteIdent(r.Names.ReadOnlyOperator)
	backup := quoteIdent(r.Names.BackupRestore)

	// Schema usage for all four roles; only migration owner may create objects.
	for _, role := range []string{runtime, ro, backup, owner} {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT USAGE ON SCHEMA public TO %s`, role)); err != nil {
			return fmt.Errorf("grant schema usage: %w", err)
		}
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT CREATE ON SCHEMA public TO %s`, owner)); err != nil {
		return fmt.Errorf("grant schema create to migration owner: %w", err)
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE CREATE ON SCHEMA public FROM %s`, runtime)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE CREATE ON SCHEMA public FROM %s`, ro)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE CREATE ON SCHEMA public FROM %s`, backup)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `REVOKE CREATE ON SCHEMA public FROM PUBLIC`); err != nil {
		return err
	}

	// Enumerate application tables.
	tables, err := listPublicTables(ctx, tx)
	if err != nil {
		return err
	}
	immutable := toSet(ImmutableConnectedTables)
	idempotency := toSet(IdempotencyTables)

	for _, table := range tables {
		qtable := "public." + quoteIdent(table)

		// Always revoke PUBLIC first (fail closed on ambient grants).
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE ALL ON TABLE %s FROM PUBLIC`, qtable)); err != nil {
			return fmt.Errorf("revoke PUBLIC on %s: %w", table, err)
		}
		// Reset role grants then re-apply least privilege.
		for _, role := range []string{runtime, ro, backup} {
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE ALL ON TABLE %s FROM %s`, qtable, role)); err != nil {
				return err
			}
		}

		if table == "igris_schema_history" {
			// Migration owner retains ownership privileges. Runtime/read-only/backup
			// may SELECT for operational inspection of versions; never mutate.
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT ON TABLE %s TO %s`, qtable, ro)); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT ON TABLE %s TO %s`, qtable, backup)); err != nil {
				return err
			}
			// Explicitly no grants to runtime on schema history.
			continue
		}

		// Read-only operator: SELECT only.
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT ON TABLE %s TO %s`, qtable, ro)); err != nil {
			return fmt.Errorf("grant select to read-only on %s: %w", table, err)
		}

		// Backup role: SELECT for logical dumps. Restore requires owner/superuser
		// and is documented as an explicit administrative procedure.
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT ON TABLE %s TO %s`, qtable, backup)); err != nil {
			return fmt.Errorf("grant select to backup on %s: %w", table, err)
		}

		// Runtime grants.
		switch {
		case immutable[table]:
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT, INSERT ON TABLE %s TO %s`, qtable, runtime)); err != nil {
				return fmt.Errorf("grant immutable privileges on %s: %w", table, err)
			}
		case idempotency[table]:
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT, INSERT, UPDATE ON TABLE %s TO %s`, qtable, runtime)); err != nil {
				return fmt.Errorf("grant idempotency privileges on %s: %w", table, err)
			}
		default:
			// Mutable application surface: DML without ownership or DDL.
			if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO %s`, qtable, runtime)); err != nil {
				return fmt.Errorf("grant runtime DML on %s: %w", table, err)
			}
		}
	}

	// Sequences for DEFAULT nextval / gen helpers that still use serials.
	seqs, err := listPublicSequences(ctx, tx)
	if err != nil {
		return err
	}
	for _, seq := range seqs {
		qseq := "public." + quoteIdent(seq)
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE ALL ON SEQUENCE %s FROM PUBLIC`, qseq)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT USAGE, SELECT ON SEQUENCE %s TO %s`, qseq, runtime)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT ON SEQUENCE %s TO %s`, qseq, ro)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT SELECT ON SEQUENCE %s TO %s`, qseq, backup)); err != nil {
			return err
		}
	}

	// Functions: EXECUTE for runtime/read-only of non-extension public functions.
	// Revoke PUBLIC execute to prevent ambient privilege.
	fnRows, err := tx.QueryContext(ctx, `
		SELECT p.oid::regprocedure::text
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
		  AND NOT EXISTS (
		    SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
		  )`)
	if err != nil {
		return fmt.Errorf("list functions for execute grants: %w", err)
	}
	var functions []string
	for fnRows.Next() {
		var identity string
		if err := fnRows.Scan(&identity); err != nil {
			fnRows.Close()
			return err
		}
		functions = append(functions, identity)
	}
	if err := fnRows.Err(); err != nil {
		fnRows.Close()
		return err
	}
	fnRows.Close()
	for _, identity := range functions {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`REVOKE ALL ON FUNCTION %s FROM PUBLIC`, identity)); err != nil {
			return fmt.Errorf("revoke PUBLIC execute on %s: %w", identity, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT EXECUTE ON FUNCTION %s TO %s`, identity, runtime)); err != nil {
			return fmt.Errorf("grant execute to runtime on %s: %w", identity, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`GRANT EXECUTE ON FUNCTION %s TO %s`, identity, ro)); err != nil {
			return fmt.Errorf("grant execute to read-only on %s: %w", identity, err)
		}
	}
	return nil
}

func (r *Runner) hardenSecurityDefinerSearchPath(ctx context.Context, tx *sql.Tx) error {
	// Ensure SECURITY DEFINER functions pin search_path to a fixed safe value.
	rows, err := tx.QueryContext(ctx, `
		SELECT p.oid::regprocedure::text
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
		  AND p.prosecdef
		  AND NOT EXISTS (
		    SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
		  )`)
	if err != nil {
		return fmt.Errorf("list security definer functions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var identity string
		if err := rows.Scan(&identity); err != nil {
			return fmt.Errorf("scan security definer function: %w", err)
		}
		stmt := fmt.Sprintf(`ALTER FUNCTION %s SET search_path = pg_catalog, public`, identity)
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("pin search_path on %s: %w", identity, err)
		}
	}
	return rows.Err()
}

func (r *Runner) inspect(ctx context.Context, db *sql.DB) (Plan, error) {
	plan := Plan{
		Names:            r.Names,
		RolesPresent:     map[string]bool{},
		ImmutableOwnedBy: map[string]string{},
	}

	if err := db.QueryRowContext(ctx, `SELECT current_user`).Scan(&plan.ConnectedUser); err != nil {
		return plan, fmt.Errorf("read current_user: %w", err)
	}
	if err := db.QueryRowContext(ctx, `
		SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = current_user`).
		Scan(&plan.IsSuperuser, &plan.CanCreateRole); err != nil {
		return plan, fmt.Errorf("inspect connected role attributes: %w", err)
	}

	for _, name := range []string{
		r.Names.MigrationOwner,
		r.Names.AppRuntime,
		r.Names.ReadOnlyOperator,
		r.Names.BackupRestore,
	} {
		var exists bool
		if err := db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)`, name).Scan(&exists); err != nil {
			return plan, err
		}
		plan.RolesPresent[name] = exists
		if !exists {
			plan.Issues = append(plan.Issues, fmt.Sprintf("missing role %s", name))
		}
	}

	// Ownership of immutable tables.
	for _, table := range ImmutableConnectedTables {
		var owner sql.NullString
		err := db.QueryRowContext(ctx, `
			SELECT pg_catalog.pg_get_userbyid(c.relowner)
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`, table).Scan(&owner)
		if err == sql.ErrNoRows {
			plan.Issues = append(plan.Issues, fmt.Sprintf("missing immutable table %s (bootstrap required first)", table))
			continue
		}
		if err != nil {
			return plan, fmt.Errorf("inspect owner of %s: %w", table, err)
		}
		plan.ImmutableOwnedBy[table] = owner.String
		if owner.String != r.Names.MigrationOwner {
			plan.Issues = append(plan.Issues, fmt.Sprintf("table %s owned by %s, want %s", table, owner.String, r.Names.MigrationOwner))
		}
	}

	// Ownership is intentionally excluded from the structural hash because the
	// migration-owner name is run-specific. Verify the complete public relation
	// and function ownership boundary here instead.
	var wrongRelationOwners int
	if err := db.QueryRowContext(ctx, `
		SELECT count(*)
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		JOIN pg_roles owner_role ON owner_role.oid = c.relowner
		WHERE n.nspname = 'public'
		  AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'c')
		  AND owner_role.rolname <> $1`, r.Names.MigrationOwner).Scan(&wrongRelationOwners); err != nil {
		return plan, fmt.Errorf("inspect public relation owners: %w", err)
	}
	if wrongRelationOwners > 0 {
		plan.Issues = append(plan.Issues, fmt.Sprintf("%d public relations are not owned by migration owner %s", wrongRelationOwners, r.Names.MigrationOwner))
	}

	var wrongFunctionOwners int
	if err := db.QueryRowContext(ctx, `
		SELECT count(*)
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		JOIN pg_roles owner_role ON owner_role.oid = p.proowner
		WHERE n.nspname = 'public'
		  AND owner_role.rolname <> $1
		  AND NOT EXISTS (
		    SELECT 1 FROM pg_depend d
		    WHERE d.classid = 'pg_proc'::regclass
		      AND d.objid = p.oid
		      AND d.deptype = 'e'
		  )`, r.Names.MigrationOwner).Scan(&wrongFunctionOwners); err != nil {
		return plan, fmt.Errorf("inspect public function owners: %w", err)
	}
	if wrongFunctionOwners > 0 {
		plan.Issues = append(plan.Issues, fmt.Sprintf("%d public functions are not owned by migration owner %s", wrongFunctionOwners, r.Names.MigrationOwner))
	}

	// Runtime must not own any public relation or function.
	var runtimeOwned int
	if plan.RolesPresent[r.Names.AppRuntime] {
		if err := db.QueryRowContext(ctx, `
			SELECT count(*) FROM (
			  SELECT c.oid FROM pg_class c
			  JOIN pg_namespace n ON n.oid = c.relnamespace
			  JOIN pg_roles r ON r.oid = c.relowner
			  WHERE n.nspname = 'public' AND r.rolname = $1
			  UNION ALL
			  SELECT p.oid FROM pg_proc p
			  JOIN pg_namespace n ON n.oid = p.pronamespace
			  JOIN pg_roles r ON r.oid = p.proowner
			  WHERE n.nspname = 'public' AND r.rolname = $1
			) owned`, r.Names.AppRuntime).Scan(&runtimeOwned); err != nil {
			return plan, err
		}
		if runtimeOwned > 0 {
			plan.RuntimeOwnsObjects = true
			plan.Issues = append(plan.Issues, fmt.Sprintf("runtime role owns %d schema objects", runtimeOwned))
		}
	}

	// PUBLIC privileges on sensitive tables. relacl encodes PUBLIC as an empty
	// grantee, e.g. {=r/owner,runtime=ar/owner}.
	for _, table := range SensitiveTables {
		var acl sql.NullString
		err := db.QueryRowContext(ctx, `
			SELECT c.relacl::text
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r','p','v')`, table).Scan(&acl)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return plan, err
		}
		if acl.Valid && publicACLPresent(acl.String) {
			plan.PublicPrivileges = append(plan.PublicPrivileges, table)
			plan.Issues = append(plan.Issues, fmt.Sprintf("PUBLIC retains privileges on %s", table))
		}
	}

	// Runtime must lack dangerous table privileges on immutable + history.
	if plan.RolesPresent[r.Names.AppRuntime] {
		for _, table := range append([]string{"igris_schema_history"}, ImmutableConnectedTables...) {
			var hasUpdate, hasDelete, hasTruncate, hasTrigger bool
			err := db.QueryRowContext(ctx, `
				SELECT
				  has_table_privilege($1, 'public.' || $2, 'UPDATE'),
				  has_table_privilege($1, 'public.' || $2, 'DELETE'),
				  has_table_privilege($1, 'public.' || $2, 'TRUNCATE'),
				  has_table_privilege($1, 'public.' || $2, 'TRIGGER')
			`, r.Names.AppRuntime, table).Scan(&hasUpdate, &hasDelete, &hasTruncate, &hasTrigger)
			if err != nil {
				// Table may be missing; already recorded above.
				if !strings.Contains(err.Error(), "does not exist") {
					// has_table_privilege errors when relation missing.
					continue
				}
				continue
			}
			if table == "igris_schema_history" {
				var hasInsert, hasSelect bool
				_ = db.QueryRowContext(ctx, `
					SELECT
					  has_table_privilege($1, 'public.igris_schema_history', 'INSERT'),
					  has_table_privilege($1, 'public.igris_schema_history', 'SELECT')
				`, r.Names.AppRuntime).Scan(&hasInsert, &hasSelect)
				if hasInsert || hasUpdate || hasDelete || hasTruncate || hasTrigger || hasSelect {
					plan.Issues = append(plan.Issues, "runtime has privileges on igris_schema_history")
				}
				continue
			}
			if hasUpdate || hasDelete || hasTruncate || hasTrigger {
				plan.Issues = append(plan.Issues, fmt.Sprintf("runtime has mutation/trigger privilege on immutable table %s", table))
			}
		}

		// Runtime must not be able to create schema objects.
		var canCreate bool
		if err := db.QueryRowContext(ctx, `SELECT has_schema_privilege($1, 'public', 'CREATE')`, r.Names.AppRuntime).Scan(&canCreate); err == nil && canCreate {
			plan.Issues = append(plan.Issues, "runtime has CREATE on schema public")
		}
	}

	// Read-only must not mutate.
	if plan.RolesPresent[r.Names.ReadOnlyOperator] {
		for _, table := range ImmutableConnectedTables {
			var hasInsert, hasUpdate, hasDelete bool
			err := db.QueryRowContext(ctx, `
				SELECT
				  has_table_privilege($1, 'public.' || $2, 'INSERT'),
				  has_table_privilege($1, 'public.' || $2, 'UPDATE'),
				  has_table_privilege($1, 'public.' || $2, 'DELETE')
			`, r.Names.ReadOnlyOperator, table).Scan(&hasInsert, &hasUpdate, &hasDelete)
			if err != nil {
				continue
			}
			if hasInsert || hasUpdate || hasDelete {
				plan.Issues = append(plan.Issues, fmt.Sprintf("read-only has write privilege on %s", table))
			}
		}
	}

	// Migration-069 triggers must exist and be enabled when schema is present.
	for _, pair := range [][2]string{
		{"action_contract_versions", "action_contract_versions_immutable"},
		{"sdk_signing_keys", "sdk_signing_keys_immutable"},
		{"sdk_evidence_batches", "sdk_evidence_batches_immutable"},
		{"sdk_evidence_events", "sdk_evidence_events_immutable"},
	} {
		var enabled sql.NullString
		err := db.QueryRowContext(ctx, `
			SELECT t.tgenabled
			FROM pg_trigger t
			JOIN pg_class c ON c.oid = t.tgrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND c.relname = $1 AND t.tgname = $2 AND NOT t.tgisinternal`,
			pair[0], pair[1]).Scan(&enabled)
		if err == sql.ErrNoRows {
			plan.Issues = append(plan.Issues, fmt.Sprintf("missing immutability trigger %s on %s", pair[1], pair[0]))
			continue
		}
		if err != nil {
			continue
		}
		// Only O is the expected normal-session enforcement mode. D disables the
		// trigger, R limits it to replica sessions, and A changes its contract.
		if enabled.String != "O" {
			plan.Issues = append(plan.Issues, fmt.Sprintf("immutability trigger %s enable mode is %s, want O (origin)", pair[1], enabled.String))
		}
	}

	return plan, nil
}

func listPublicTables(ctx context.Context, tx *sql.Tx) ([]string, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
		ORDER BY c.relname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func listPublicSequences(ctx context.Context, tx *sql.Tx) ([]string, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'S'
		ORDER BY c.relname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func printPlan(out io.Writer, plan Plan) {
	fmt.Fprintf(out, "role_mode=%s\n", plan.Mode)
	fmt.Fprintf(out, "connected_user=%s superuser=%v createrole=%v\n", plan.ConnectedUser, plan.IsSuperuser, plan.CanCreateRole)
	fmt.Fprintf(out, "roles migration_owner=%s app_runtime=%s read_only=%s backup=%s\n",
		plan.Names.MigrationOwner, plan.Names.AppRuntime, plan.Names.ReadOnlyOperator, plan.Names.BackupRestore)
	for name, present := range plan.RolesPresent {
		fmt.Fprintf(out, "role_present %s=%v\n", name, present)
	}
	for table, owner := range plan.ImmutableOwnedBy {
		fmt.Fprintf(out, "immutable_owner %s=%s\n", table, owner)
	}
	fmt.Fprintf(out, "runtime_owns_objects=%v\n", plan.RuntimeOwnsObjects)
	if len(plan.Issues) == 0 {
		fmt.Fprintln(out, "issues=none")
	} else {
		fmt.Fprintf(out, "issues=%s\n", strings.Join(plan.Issues, " | "))
	}
}

func validateRoleName(name string) error {
	if name == "" {
		return errors.New("empty role name")
	}
	if len(name) > 63 {
		return errors.New("role name exceeds 63 characters")
	}
	for i, r := range name {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_'
		if i == 0 && (r < 'a' || r > 'z') {
			return fmt.Errorf("role name %q must start with a-z", name)
		}
		if !ok {
			return fmt.Errorf("role name %q contains invalid character %q", name, string(r))
		}
	}
	return nil
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func toSet(items []string) map[string]bool {
	out := make(map[string]bool, len(items))
	for _, item := range items {
		out[item] = true
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func publicACLPresent(acl string) bool {
	acl = strings.TrimSpace(acl)
	if acl == "" || acl == "{}" {
		return false
	}
	inner := strings.TrimPrefix(strings.TrimSuffix(acl, "}"), "{")
	for _, part := range strings.Split(inner, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "=") {
			return true
		}
	}
	return false
}

// RedactedDSN returns a DSN safe for logs (user + host + db, no password).
func RedactedDSN(dsn string) string {
	if dsn == "" {
		return ""
	}
	// Strip password between : and @ in URL form.
	if i := strings.Index(dsn, "://"); i >= 0 {
		rest := dsn[i+3:]
		if at := strings.Index(rest, "@"); at >= 0 {
			userinfo := rest[:at]
			hostpart := rest[at+1:]
			user := userinfo
			if colon := strings.Index(userinfo, ":"); colon >= 0 {
				user = userinfo[:colon]
			}
			return dsn[:i+3] + user + ":***@" + hostpart
		}
	}
	// libpq keyword form
	fields := strings.Fields(dsn)
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if strings.HasPrefix(strings.ToLower(f), "password=") {
			out = append(out, "password=***")
			continue
		}
		out = append(out, f)
	}
	return strings.Join(out, " ")
}
