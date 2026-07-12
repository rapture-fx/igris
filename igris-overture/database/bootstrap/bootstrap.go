package bootstrap

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	"github.com/Igris-inertial/system/igris-overture/database/migrations"
)

const historyTable = "public.igris_schema_history"

type Path string

const (
	PathFresh     Path = "fresh-baseline-v066-plus-067-069"
	PathForward   Path = "existing-v066-forward-067-069"
	PathCurrent   Path = "current-v069-noop"
	PathAdoptV066 Path = "explicit-v066-adoption-plus-067-069"
)

type Mode string

const (
	ModePreflight Mode = "preflight"
	ModeApply     Mode = "apply"
	ModeAdoptV066 Mode = "adopt-v066"
)

type Artifact struct {
	Version  string
	Kind     string
	Checksum string
	SQL      []byte
}

type Plan struct {
	Path       Path
	Baseline   string
	Migrations []string
	SchemaHash string
}

type Runner struct {
	baseline Artifact
	forward  []Artifact
}

func NewRunner() (*Runner, error) {
	r := &Runner{
		baseline: Artifact{Version: BaselineVersion, Kind: "baseline", Checksum: BaselineSHA256, SQL: BaselineSQL},
		forward: []Artifact{
			{Version: "067_action_contract_versions", Kind: "migration", Checksum: "c5eea0ec499c758d13ea67310290634b54671a53ffb71e31ac76b0cc7a13a5f9"},
			{Version: "068_sdk_evidence_ingestion", Kind: "migration", Checksum: "87b2401eacb7440d35efa28d10c4d848b7274bb06dcba74514a0b4fd3c424e48"},
			{Version: "069_connected_immutable_records", Kind: "migration", Checksum: "5c0b57dacd7cba2cdf8bc12fec2b3a9a4a066a73b6bb82fba8af29202452fc4d"},
		},
	}
	for i := range r.forward {
		name := r.forward[i].Version + ".sql"
		contents, err := migrations.Files.ReadFile(name)
		if err != nil {
			return nil, fmt.Errorf("read forward migration %s: %w", name, err)
		}
		r.forward[i].SQL = contents
	}
	if err := r.verifyArtifacts(); err != nil {
		return nil, err
	}
	return r, nil
}

func (r *Runner) Preflight(ctx context.Context, db *sql.DB) (Plan, error) {
	if err := checkServerVersion(ctx, db); err != nil {
		return Plan{}, err
	}
	return r.inspect(ctx, db)
}

func (r *Runner) Run(ctx context.Context, db *sql.DB, mode Mode, out io.Writer) (Plan, error) {
	if mode != ModePreflight && mode != ModeApply && mode != ModeAdoptV066 {
		return Plan{}, fmt.Errorf("unsupported mode %q", mode)
	}
	plan, err := r.Preflight(ctx, db)
	if err != nil {
		return Plan{}, err
	}
	printPlan(out, plan)
	if mode == ModePreflight {
		return plan, nil
	}
	if mode == ModeAdoptV066 && plan.Path != PathAdoptV066 {
		return Plan{}, fmt.Errorf("adopt-v066 requires an exact unrecorded v066 schema; selected path is %s", plan.Path)
	}
	if mode == ModeApply && plan.Path == PathAdoptV066 {
		return Plan{}, errors.New("exact v066 schema is unrecorded; rerun with --mode=adopt-v066 after reviewing the adoption procedure")
	}
	if plan.Path == PathCurrent {
		return plan, nil
	}
	if err := r.apply(ctx, db, plan); err != nil {
		return Plan{}, err
	}
	final, err := r.inspect(ctx, db)
	if err != nil {
		return Plan{}, fmt.Errorf("post-bootstrap verification failed: %w", err)
	}
	if final.Path != PathCurrent {
		return Plan{}, fmt.Errorf("post-bootstrap state is %s, expected %s", final.Path, PathCurrent)
	}
	fmt.Fprintln(out, "result=current-v069 schema verified")
	return final, nil
}

func (r *Runner) inspect(ctx context.Context, db *sql.DB) (Plan, error) {
	hash, count, err := schemaHashDB(ctx, db)
	if err != nil {
		return Plan{}, err
	}
	history, err := historyExists(ctx, db)
	if err != nil {
		return Plan{}, err
	}
	if !history {
		switch {
		case count == 0:
			return Plan{Path: PathFresh, Baseline: r.baseline.Version, Migrations: r.forwardVersions(), SchemaHash: hash}, nil
		case hash == ExpectedV066SchemaSHA256:
			return Plan{Path: PathAdoptV066, Baseline: r.baseline.Version, Migrations: r.forwardVersions(), SchemaHash: hash}, nil
		default:
			return Plan{}, fmt.Errorf("refusing non-empty unrecorded public schema: object manifest %s is not the supported v066 adoption state", hash)
		}
	}

	rows, err := readHistory(ctx, db)
	if err != nil {
		return Plan{}, err
	}
	if err := r.validateHistory(rows); err != nil {
		return Plan{}, err
	}
	applied := make(map[string]bool, len(rows))
	for _, row := range rows {
		applied[row.Version] = true
	}
	forwardCount := 0
	for _, migration := range r.forward {
		if applied[migration.Version] {
			forwardCount++
		}
	}
	switch forwardCount {
	case 0:
		if hash != ExpectedV066SchemaSHA256 {
			return Plan{}, fmt.Errorf("ledger claims v066 but required schema objects differ: got %s, want %s", hash, ExpectedV066SchemaSHA256)
		}
		return Plan{Path: PathForward, Baseline: r.baseline.Version, Migrations: r.forwardVersions(), SchemaHash: hash}, nil
	case len(r.forward):
		if hash != ExpectedV069SchemaSHA256 {
			return Plan{}, fmt.Errorf("ledger claims v069 but required schema objects differ: got %s, want %s", hash, ExpectedV069SchemaSHA256)
		}
		return Plan{Path: PathCurrent, Baseline: r.baseline.Version, SchemaHash: hash}, nil
	default:
		return Plan{}, errors.New("partial 067-069 ledger is unsupported; the forward set must commit atomically")
	}
}

func (r *Runner) apply(ctx context.Context, db *sql.DB, plan Plan) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin bootstrap transaction: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(438774918066)`); err != nil {
		return fmt.Errorf("acquire bootstrap lock: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return fmt.Errorf("set bootstrap search path: %w", err)
	}
	if err := r.ensurePlanUnderLock(ctx, tx, plan); err != nil {
		return err
	}

	switch plan.Path {
	case PathFresh:
		if _, err := tx.ExecContext(ctx, string(r.baseline.SQL)); err != nil {
			return fmt.Errorf("install baseline %s: %w", r.baseline.Version, err)
		}
		hash, _, err := schemaHashTx(ctx, tx)
		if err != nil {
			return err
		}
		if hash != ExpectedV066SchemaSHA256 {
			return fmt.Errorf("installed baseline schema mismatch: got %s, want %s", hash, ExpectedV066SchemaSHA256)
		}
		if err := createHistory(ctx, tx); err != nil {
			return err
		}
		if err := insertHistory(ctx, tx, r.baseline); err != nil {
			return err
		}
	case PathAdoptV066:
		if err := createHistory(ctx, tx); err != nil {
			return err
		}
		if err := insertHistory(ctx, tx, r.baseline); err != nil {
			return err
		}
	case PathForward:
		// The preflight already verified the recorded baseline checksum and schema.
	default:
		return fmt.Errorf("cannot apply path %s", plan.Path)
	}

	for _, migration := range r.forward {
		if _, err := tx.ExecContext(ctx, string(migration.SQL)); err != nil {
			return fmt.Errorf("apply %s: %w", migration.Version, err)
		}
		if err := insertHistory(ctx, tx, migration); err != nil {
			return err
		}
	}
	hash, _, err := schemaHashTx(ctx, tx)
	if err != nil {
		return err
	}
	if hash != ExpectedV069SchemaSHA256 {
		return fmt.Errorf("final schema mismatch: got %s, want %s", hash, ExpectedV069SchemaSHA256)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit bootstrap transaction: %w", err)
	}
	return nil
}

func (r *Runner) ensurePlanUnderLock(ctx context.Context, tx *sql.Tx, plan Plan) error {
	hash, count, err := schemaHashTx(ctx, tx)
	if err != nil {
		return err
	}
	var history bool
	if err := tx.QueryRowContext(ctx, `SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&history); err != nil {
		return fmt.Errorf("recheck bootstrap history under lock: %w", err)
	}
	switch plan.Path {
	case PathFresh:
		if count != 0 || history {
			return errors.New("database state changed after preflight; fresh bootstrap refused under lock")
		}
	case PathAdoptV066:
		if history || hash != ExpectedV066SchemaSHA256 {
			return errors.New("database state changed after preflight; v066 adoption refused under lock")
		}
	case PathForward:
		if !history || hash != ExpectedV066SchemaSHA256 {
			return errors.New("database state changed after preflight; v066 forward migration refused under lock")
		}
		rows, err := readHistoryTx(ctx, tx)
		if err != nil {
			return err
		}
		if err := r.validateHistory(rows); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot validate path %s under lock", plan.Path)
	}
	return nil
}

type historyRow struct {
	Version  string
	Kind     string
	Checksum string
}

func readHistory(ctx context.Context, db *sql.DB) ([]historyRow, error) {
	rows, err := db.QueryContext(ctx, `SELECT version, artifact_kind, checksum_sha256 FROM public.igris_schema_history WHERE component = $1 ORDER BY version`, Component)
	return scanHistory(rows, err)
}

func readHistoryTx(ctx context.Context, tx *sql.Tx) ([]historyRow, error) {
	rows, err := tx.QueryContext(ctx, `SELECT version, artifact_kind, checksum_sha256 FROM public.igris_schema_history WHERE component = $1 ORDER BY version`, Component)
	return scanHistory(rows, err)
}

func scanHistory(rows *sql.Rows, err error) ([]historyRow, error) {
	if err != nil {
		return nil, fmt.Errorf("read bootstrap history: %w", err)
	}
	defer rows.Close()
	var result []historyRow
	for rows.Next() {
		var row historyRow
		if err := rows.Scan(&row.Version, &row.Kind, &row.Checksum); err != nil {
			return nil, fmt.Errorf("scan bootstrap history: %w", err)
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (r *Runner) validateHistory(rows []historyRow) error {
	expected := map[string]Artifact{r.baseline.Version: r.baseline}
	for _, migration := range r.forward {
		expected[migration.Version] = migration
	}
	seen := make(map[string]bool, len(rows))
	for _, row := range rows {
		artifact, ok := expected[row.Version]
		if !ok {
			return fmt.Errorf("unsupported %s history version %q", Component, row.Version)
		}
		if seen[row.Version] {
			return fmt.Errorf("duplicate %s history version %q", Component, row.Version)
		}
		seen[row.Version] = true
		if row.Kind != artifact.Kind || row.Checksum != artifact.Checksum {
			return fmt.Errorf("history checksum mismatch for %s: got kind=%s checksum=%s", row.Version, row.Kind, row.Checksum)
		}
	}
	if !seen[r.baseline.Version] {
		return errors.New("bootstrap history table exists but the required v066 baseline record is missing")
	}
	return nil
}

func createHistory(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
CREATE TABLE public.igris_schema_history (
    component TEXT NOT NULL,
    version TEXT NOT NULL,
    artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('baseline', 'migration')),
    checksum_sha256 CHAR(64) NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (component, version)
);
REVOKE ALL ON TABLE public.igris_schema_history FROM PUBLIC;`)
	if err != nil {
		return fmt.Errorf("create bootstrap history: %w", err)
	}
	return nil
}

func insertHistory(ctx context.Context, tx *sql.Tx, artifact Artifact) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO public.igris_schema_history (component, version, artifact_kind, checksum_sha256) VALUES ($1, $2, $3, $4)`, Component, artifact.Version, artifact.Kind, artifact.Checksum)
	if err != nil {
		return fmt.Errorf("record %s: %w", artifact.Version, err)
	}
	return nil
}

func schemaHashDB(ctx context.Context, db *sql.DB) (string, int, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return "", 0, fmt.Errorf("begin schema inspection: %w", err)
	}
	defer tx.Rollback()
	return schemaHashTx(ctx, tx)
}

func schemaHashTx(ctx context.Context, tx *sql.Tx) (string, int, error) {
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return "", 0, fmt.Errorf("set schema inspection search path: %w", err)
	}
	rows, err := tx.QueryContext(ctx, SchemaManifestSQL)
	if err != nil {
		return "", 0, fmt.Errorf("query schema manifest: %w", err)
	}
	defer rows.Close()
	h := sha256.New()
	count := 0
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			return "", 0, fmt.Errorf("scan schema manifest: %w", err)
		}
		io.WriteString(h, line)
		io.WriteString(h, "\n")
		count++
	}
	if err := rows.Err(); err != nil {
		return "", 0, fmt.Errorf("read schema manifest: %w", err)
	}
	return hex.EncodeToString(h.Sum(nil)), count, nil
}

func historyExists(ctx context.Context, db *sql.DB) (bool, error) {
	var exists bool
	if err := db.QueryRowContext(ctx, `SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&exists); err != nil {
		return false, fmt.Errorf("inspect bootstrap history: %w", err)
	}
	return exists, nil
}

func checkServerVersion(ctx context.Context, db *sql.DB) error {
	var raw string
	if err := db.QueryRowContext(ctx, `SHOW server_version_num`).Scan(&raw); err != nil {
		return fmt.Errorf("read PostgreSQL version: %w", err)
	}
	return validateServerVersion(raw)
}

func validateServerVersion(raw string) error {
	version, err := strconv.Atoi(raw)
	if err != nil {
		return fmt.Errorf("parse PostgreSQL version %q: %w", raw, err)
	}
	if version < 140000 {
		return fmt.Errorf("unsupported PostgreSQL version %s: version 14 or newer is required", raw)
	}
	return nil
}

func (r *Runner) verifyArtifacts() error {
	artifacts := append([]Artifact{r.baseline}, r.forward...)
	for _, artifact := range artifacts {
		sum := sha256.Sum256(artifact.SQL)
		actual := hex.EncodeToString(sum[:])
		if actual != artifact.Checksum {
			return fmt.Errorf("artifact checksum mismatch for %s: got %s, want %s", artifact.Version, actual, artifact.Checksum)
		}
	}
	return nil
}

func (r *Runner) forwardVersions() []string {
	versions := make([]string, 0, len(r.forward))
	for _, migration := range r.forward {
		versions = append(versions, migration.Version)
	}
	sort.Strings(versions)
	return versions
}

func printPlan(out io.Writer, plan Plan) {
	fmt.Fprintf(out, "bootstrap_path=%s\n", plan.Path)
	fmt.Fprintf(out, "baseline=%s checksum=%s\n", plan.Baseline, BaselineSHA256)
	if len(plan.Migrations) == 0 {
		fmt.Fprintln(out, "migration_range=none")
	} else {
		fmt.Fprintf(out, "migration_range=%s\n", strings.Join(plan.Migrations, ","))
	}
	fmt.Fprintf(out, "schema_manifest_sha256=%s\n", plan.SchemaHash)
}
