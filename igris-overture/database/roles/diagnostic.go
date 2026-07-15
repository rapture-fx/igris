package roles

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"strings"
	"time"
)

// RuntimeDiagnostic reports dangerous ownership or privilege configuration for
// the currently connected database role. It never prints credentials or full
// DSNs and never repairs drift.
type RuntimeDiagnostic struct {
	CurrentUser         string
	IsSuperuser         bool
	IsMigrationOwner    bool
	OwnsSchemaObjects   bool
	CanCreateInPublic   bool
	CanMutateSchemaHist bool
	CanDisableTriggers  bool
	Issues              []string
	OK                  bool
}

// DiagnoseRuntime inspects the active connection for unsafe privilege states.
// expectedMigrationOwner is the configured migration-owner role name (for
// identity comparison only).
func DiagnoseRuntime(ctx context.Context, db *sql.DB, expectedMigrationOwner string) (RuntimeDiagnostic, error) {
	if expectedMigrationOwner == "" {
		expectedMigrationOwner = DefaultMigrationOwner
	}
	d := RuntimeDiagnostic{}
	if err := db.QueryRowContext(ctx, `SELECT current_user`).Scan(&d.CurrentUser); err != nil {
		return d, fmt.Errorf("read current_user: %w", err)
	}
	if err := db.QueryRowContext(ctx, `SELECT rolsuper FROM pg_roles WHERE rolname = current_user`).Scan(&d.IsSuperuser); err != nil {
		return d, fmt.Errorf("read role attributes: %w", err)
	}
	d.IsMigrationOwner = d.CurrentUser == expectedMigrationOwner

	if err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
		  SELECT 1 FROM pg_class c
		  JOIN pg_namespace n ON n.oid = c.relnamespace
		  JOIN pg_roles r ON r.oid = c.relowner
		  WHERE n.nspname = 'public' AND r.rolname = current_user
		)`).Scan(&d.OwnsSchemaObjects); err != nil {
		return d, err
	}
	if err := db.QueryRowContext(ctx, `SELECT has_schema_privilege(current_user, 'public', 'CREATE')`).Scan(&d.CanCreateInPublic); err != nil {
		return d, err
	}

	// Schema history privileges (table may be absent on non-Connected DBs).
	var historyExists bool
	if err := db.QueryRowContext(ctx, `SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&historyExists); err != nil {
		return d, err
	}
	if historyExists {
		var insert, update, deletePriv bool
		if err := db.QueryRowContext(ctx, `
			SELECT
			  has_table_privilege(current_user, 'public.igris_schema_history', 'INSERT'),
			  has_table_privilege(current_user, 'public.igris_schema_history', 'UPDATE'),
			  has_table_privilege(current_user, 'public.igris_schema_history', 'DELETE')
		`).Scan(&insert, &update, &deletePriv); err != nil {
			return d, err
		}
		d.CanMutateSchemaHist = insert || update || deletePriv
	}

	// Trigger privilege on an immutable table is a strong signal the runtime
	// could attempt DISABLE TRIGGER (still requires ownership; we flag both).
	var triggerPriv bool
	_ = db.QueryRowContext(ctx, `
		SELECT has_table_privilege(current_user, 'public.action_contract_versions', 'TRIGGER')
		WHERE to_regclass('public.action_contract_versions') IS NOT NULL
	`).Scan(&triggerPriv)
	d.CanDisableTriggers = triggerPriv || d.OwnsSchemaObjects

	if d.IsSuperuser {
		d.Issues = append(d.Issues, "connected role is a PostgreSQL superuser")
	}
	if d.IsMigrationOwner {
		d.Issues = append(d.Issues, "connected role is the migration owner; runtime must use a separate credential")
	}
	if d.OwnsSchemaObjects {
		d.Issues = append(d.Issues, "connected role owns public schema objects")
	}
	if d.CanCreateInPublic {
		d.Issues = append(d.Issues, "connected role has CREATE on schema public")
	}
	if d.CanMutateSchemaHist {
		d.Issues = append(d.Issues, "connected role can mutate igris_schema_history")
	}
	if triggerPriv {
		d.Issues = append(d.Issues, "connected role has TRIGGER privilege on immutable Connected tables")
	}
	d.OK = len(d.Issues) == 0
	return d, nil
}

// WriteRuntimeDiagnostic writes a credential-safe diagnostic report.
func WriteRuntimeDiagnostic(out io.Writer, d RuntimeDiagnostic) {
	fmt.Fprintf(out, "db_runtime_user=%s\n", d.CurrentUser)
	fmt.Fprintf(out, "db_runtime_superuser=%v\n", d.IsSuperuser)
	fmt.Fprintf(out, "db_runtime_is_migration_owner=%v\n", d.IsMigrationOwner)
	fmt.Fprintf(out, "db_runtime_owns_schema_objects=%v\n", d.OwnsSchemaObjects)
	fmt.Fprintf(out, "db_runtime_can_create_in_public=%v\n", d.CanCreateInPublic)
	fmt.Fprintf(out, "db_runtime_can_mutate_schema_history=%v\n", d.CanMutateSchemaHist)
	if len(d.Issues) == 0 {
		fmt.Fprintln(out, "db_runtime_privilege_status=ok")
		return
	}
	fmt.Fprintf(out, "db_runtime_privilege_status=unsafe\n")
	fmt.Fprintf(out, "db_runtime_privilege_issues=%s\n", strings.Join(d.Issues, " | "))
}

// DiagnoseRuntimeWithTimeout is a convenience wrapper for startup paths.
func DiagnoseRuntimeWithTimeout(db *sql.DB, expectedMigrationOwner string, timeout time.Duration) (RuntimeDiagnostic, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return DiagnoseRuntime(ctx, db, expectedMigrationOwner)
}
