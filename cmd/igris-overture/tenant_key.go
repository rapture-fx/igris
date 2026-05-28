package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// runTenantKeyCommand mints a new `igris_` API key for a tenant directly
// against the database — no HTTP, no session cookie required.
//
// Intended use: bootstrap the Rails console's service-principal key
// without depending on the parked Next.js console for the initial mint.
// Once a key exists, normal rotation can use POST /v1/account/api-key
// from inside the console.
//
// Flags:
//
//	--email             tenant email to identify the row (required)
//	--name              tenant display name (used if --create-if-missing)
//	--create-if-missing create the tenant row if no match is found
//	--dry-run           validate inputs, do not write or print a key
//
// Reads connection from DATABASE_URL_DIRECT when set, else DATABASE_URL.
// (Direct is preferred — Neon's PgBouncer transaction-mode is fine here
// but the migrations story already calls for it, so we keep one rule.)
//
// Prints the raw key exactly once to stdout, prefixed `igris_`. Anything
// else (status, errors) goes to stderr. This makes
//
//	OVERTURE_API_KEY="$(./bin/igris-overture tenant-key --email me@x ...)"
//
// safe to redirect.
func runTenantKeyCommand(args []string) error {
	fs := flag.NewFlagSet("tenant-key", flag.ContinueOnError)
	email := fs.String("email", "", "tenant email (required)")
	name := fs.String("name", "", "tenant display name (used when --create-if-missing)")
	createIfMissing := fs.Bool("create-if-missing", false, "create the tenant row if it does not exist")
	dryRun := fs.Bool("dry-run", false, "validate inputs and exit; do not write or print a key")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*email) == "" {
		return errors.New("--email is required")
	}

	dsn := os.Getenv("DATABASE_URL_DIRECT")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		return errors.New("DATABASE_URL_DIRECT or DATABASE_URL must be set")
	}

	if *dryRun {
		fmt.Fprintf(os.Stderr, "[tenant-key] dry-run ok: would mint key for %q (create_if_missing=%v)\n", *email, *createIfMissing)
		return nil
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(2)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	return mintTenantKey(ctx, db, *email, *name, *createIfMissing, os.Stdout, os.Stderr)
}

// mintTenantKey is the testable core: resolves the tenant by email (or
// creates one), generates a random igris_ key, stores its sha256 hash on
// the tenant row, and writes the raw key to stdout.
//
// Separated from runTenantKeyCommand so tests can exercise it against a
// stubbed database without dealing with the flag set / env vars.
func mintTenantKey(ctx context.Context, db *sql.DB, email, name string, createIfMissing bool, stdout, stderr interface{ Write([]byte) (int, error) }) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return errors.New("email cannot be empty")
	}

	tenantID, err := lookupTenantIDByEmail(ctx, db, email)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		if !createIfMissing {
			return fmt.Errorf("no tenant with email %q (pass --create-if-missing to create one)", email)
		}
		tenantID = uuid.NewString()
		displayName := strings.TrimSpace(name)
		if displayName == "" {
			displayName = email
		}
		if _, err := db.ExecContext(ctx, `
			INSERT INTO tenants (tenant_id, tenant_name, tenant_email, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, true, NOW(), NOW())
			ON CONFLICT (tenant_id) DO NOTHING
		`, tenantID, displayName, email); err != nil {
			return fmt.Errorf("create tenant: %w", err)
		}
		fmt.Fprintf(stderr, "[tenant-key] created new tenant: id=%s email=%s\n", tenantID, email)
	case err != nil:
		return fmt.Errorf("lookup tenant: %w", err)
	default:
		fmt.Fprintf(stderr, "[tenant-key] found existing tenant: id=%s email=%s\n", tenantID, email)
	}

	rawKey, prefix, keyHash, err := generateIgrisKey()
	if err != nil {
		return fmt.Errorf("generate key: %w", err)
	}

	now := time.Now().UTC()
	res, err := db.ExecContext(ctx, `
		UPDATE tenants
		   SET api_key_hash       = $1,
		       api_key_prefix     = $2,
		       api_key_created_at = $3,
		       updated_at         = $3,
		       is_active          = true
		 WHERE tenant_id = $4
	`, keyHash, prefix, now, tenantID)
	if err != nil {
		return fmt.Errorf("store key hash: %w", err)
	}
	if affected, _ := res.RowsAffected(); affected != 1 {
		return fmt.Errorf("expected 1 row updated, got %d", affected)
	}

	fmt.Fprintf(stderr, "[tenant-key] new key minted, prefix=%s (any previous key revoked)\n", prefix)
	fmt.Fprintf(stderr, "[tenant-key] copy the line on stdout into OVERTURE_API_KEY — it will NOT be shown again\n")
	if _, err := stdout.Write([]byte(rawKey + "\n")); err != nil {
		return fmt.Errorf("write key to stdout: %w", err)
	}
	return nil
}

func lookupTenantIDByEmail(ctx context.Context, db *sql.DB, email string) (string, error) {
	var id string
	err := db.QueryRowContext(ctx,
		`SELECT tenant_id FROM tenants WHERE LOWER(tenant_email) = LOWER($1) LIMIT 1`,
		email,
	).Scan(&id)
	return id, err
}

// generateIgrisKey returns (rawKey, prefix, sha256hash) — same shape as
// the HTTP handler in api/routes_apikey.go::GenerateAPIKey, so the
// CLI-minted key is indistinguishable from a UI-minted one at the auth
// middleware layer.
func generateIgrisKey() (raw, prefix, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", "", err
	}
	raw = "igris_" + hex.EncodeToString(buf)
	prefix = raw[:12]
	hash = security.HashAPIKey(raw)
	return raw, prefix, hash, nil
}

// Ensure the postgres driver registers itself when this file is built
// into the main binary. database.Connect already imports it, but the
// CLI path uses sql.Open directly so we depend on database for the
// side-effect import.
var _ = database.Connect
