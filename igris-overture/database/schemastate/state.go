package schemastate

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strconv"
)

type Path string

const (
	PathFresh     Path = "fresh-baseline-v066-plus-067-069"
	PathForward   Path = "existing-v066-forward-067-069"
	PathCurrent   Path = "current-v069-noop"
	PathAdoptV066 Path = "explicit-v066-adoption-plus-067-069"
)

type ArtifactSpec struct {
	Version  string
	Kind     string
	Checksum string
}

var ExpectedHistory = []ArtifactSpec{
	{Version: BaselineVersion, Kind: "baseline", Checksum: BaselineSHA256},
	{Version: "067_action_contract_versions", Kind: "migration", Checksum: "c5eea0ec499c758d13ea67310290634b54671a53ffb71e31ac76b0cc7a13a5f9"},
	{Version: "068_sdk_evidence_ingestion", Kind: "migration", Checksum: "87b2401eacb7440d35efa28d10c4d848b7274bb06dcba74514a0b4fd3c424e48"},
	{Version: "069_connected_immutable_records", Kind: "migration", Checksum: "5c0b57dacd7cba2cdf8bc12fec2b3a9a4a066a73b6bb82fba8af29202452fc4d"},
}

type Plan struct {
	Path       Path
	Baseline   string
	Migrations []string
	SchemaHash string
}

// Inspect performs read-only schema, history, and checksum validation.
func Inspect(ctx context.Context, db *sql.DB) (Plan, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return Plan{}, fmt.Errorf("begin schema inspection: %w", err)
	}
	defer tx.Rollback()
	return InspectTx(ctx, tx)
}

// InspectTx performs read-only inspection in the caller's transaction. It is
// also used by the operator executor while holding its advisory lock.
func InspectTx(ctx context.Context, tx *sql.Tx) (Plan, error) {
	if err := checkServerVersion(ctx, tx); err != nil {
		return Plan{}, err
	}
	hash, count, err := manifestHash(ctx, tx)
	if err != nil {
		return Plan{}, err
	}

	var historyExists bool
	if err := tx.QueryRowContext(ctx, `SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&historyExists); err != nil {
		return Plan{}, fmt.Errorf("inspect bootstrap history: %w", err)
	}
	forward := forwardVersions()
	if !historyExists {
		switch {
		case count == 0:
			return Plan{Path: PathFresh, Baseline: BaselineVersion, Migrations: forward, SchemaHash: hash}, nil
		case hash == ExpectedV066SchemaSHA256:
			return Plan{Path: PathAdoptV066, Baseline: BaselineVersion, Migrations: forward, SchemaHash: hash}, nil
		default:
			return Plan{}, fmt.Errorf("refusing non-empty unrecorded public schema: object manifest %s is not the supported v066 adoption state", hash)
		}
	}

	history, err := readHistory(ctx, tx)
	if err != nil {
		return Plan{}, err
	}
	if err := validateHistory(history); err != nil {
		return Plan{}, err
	}
	applied := make(map[string]bool, len(history))
	for _, row := range history {
		applied[row.Version] = true
	}
	forwardCount := 0
	for _, version := range forward {
		if applied[version] {
			forwardCount++
		}
	}
	switch forwardCount {
	case 0:
		if hash != ExpectedV066SchemaSHA256 {
			return Plan{}, fmt.Errorf("ledger claims v066 but required schema objects differ: got %s, want %s", hash, ExpectedV066SchemaSHA256)
		}
		return Plan{Path: PathForward, Baseline: BaselineVersion, Migrations: forward, SchemaHash: hash}, nil
	case len(forward):
		if hash != ExpectedV069SchemaSHA256 {
			return Plan{}, fmt.Errorf("ledger claims v069 but required schema objects differ: got %s, want %s", hash, ExpectedV069SchemaSHA256)
		}
		return Plan{Path: PathCurrent, Baseline: BaselineVersion, SchemaHash: hash}, nil
	default:
		return Plan{}, errors.New("partial 067-069 ledger is unsupported; the forward set must commit atomically")
	}
}

type historyRow struct {
	Version  string
	Kind     string
	Checksum string
}

func readHistory(ctx context.Context, tx *sql.Tx) ([]historyRow, error) {
	rows, err := tx.QueryContext(ctx, `SELECT version, artifact_kind, checksum_sha256 FROM public.igris_schema_history WHERE component = $1 ORDER BY version`, Component)
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

func validateHistory(rows []historyRow) error {
	expected := make(map[string]ArtifactSpec, len(ExpectedHistory))
	for _, artifact := range ExpectedHistory {
		expected[artifact.Version] = artifact
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
	if !seen[BaselineVersion] {
		return errors.New("bootstrap history table exists but the required v066 baseline record is missing")
	}
	return nil
}

func manifestHash(ctx context.Context, tx *sql.Tx) (string, int, error) {
	if _, err := tx.ExecContext(ctx, `SET LOCAL search_path = public, pg_catalog`); err != nil {
		return "", 0, fmt.Errorf("set schema inspection search path: %w", err)
	}
	rows, err := tx.QueryContext(ctx, ManifestSQL)
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
		_, _ = io.WriteString(h, line)
		_, _ = io.WriteString(h, "\n")
		count++
	}
	if err := rows.Err(); err != nil {
		return "", 0, fmt.Errorf("read schema manifest: %w", err)
	}
	return hex.EncodeToString(h.Sum(nil)), count, nil
}

func checkServerVersion(ctx context.Context, tx *sql.Tx) error {
	var raw string
	if err := tx.QueryRowContext(ctx, `SHOW server_version_num`).Scan(&raw); err != nil {
		return fmt.Errorf("read PostgreSQL version: %w", err)
	}
	version, err := strconv.Atoi(raw)
	if err != nil {
		return fmt.Errorf("parse PostgreSQL version %q: %w", raw, err)
	}
	if version < 140000 {
		return fmt.Errorf("unsupported PostgreSQL version %s: version 14 or newer is required", raw)
	}
	return nil
}

func forwardVersions() []string {
	versions := make([]string, 0, len(ExpectedHistory)-1)
	for _, artifact := range ExpectedHistory {
		if artifact.Kind == "migration" {
			versions = append(versions, artifact.Version)
		}
	}
	return versions
}
