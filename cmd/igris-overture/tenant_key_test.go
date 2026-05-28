package main

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/security"
)

// Stubbed sql/driver that lets us assert what the mintTenantKey core wrote.

type queryResult struct {
	columns []string
	rows    [][]driver.Value
	err     error
}

type execResult struct {
	rowsAffected int64
	err          error
	check        func(query string, args []driver.NamedValue)
}

type stubDriver struct {
	queries []queryResult
	execs   []execResult
}

type stubConn struct{ d *stubDriver }

func (d *stubDriver) Open(string) (driver.Conn, error) { return &stubConn{d: d}, nil }
func (c *stubConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("prepare not implemented")
}
func (c *stubConn) Close() error                   { return nil }
func (c *stubConn) Begin() (driver.Tx, error)      { return nil, errors.New("tx not supported") }
func (c *stubConn) ExecContext(_ context.Context, q string, a []driver.NamedValue) (driver.Result, error) {
	if len(c.d.execs) == 0 {
		return nil, errors.New("unexpected exec")
	}
	next := c.d.execs[0]
	c.d.execs = c.d.execs[1:]
	if next.check != nil {
		next.check(q, a)
	}
	if next.err != nil {
		return nil, next.err
	}
	return driver.RowsAffected(next.rowsAffected), nil
}
func (c *stubConn) QueryContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Rows, error) {
	if len(c.d.queries) == 0 {
		return nil, errors.New("unexpected query")
	}
	next := c.d.queries[0]
	c.d.queries = c.d.queries[1:]
	if next.err != nil {
		return nil, next.err
	}
	return &stubRows{cols: next.columns, vals: next.rows}, nil
}

type stubRows struct {
	cols []string
	vals [][]driver.Value
	i    int
}

func (r *stubRows) Columns() []string { return r.cols }
func (r *stubRows) Close() error      { return nil }
func (r *stubRows) Next(dest []driver.Value) error {
	if r.i >= len(r.vals) {
		return io.EOF
	}
	copy(dest, r.vals[r.i])
	r.i++
	return nil
}

func openStubDB(t *testing.T, d *stubDriver) *sql.DB {
	t.Helper()
	name := "tenant-key-stub-" + uuid.NewString()
	sql.Register(name, d)
	db, err := sql.Open(name, "")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestMintTenantKey_ExistingTenant_UpdatesHashAndPrintsKey(t *testing.T) {
	existing := "tenant-existing-id"

	var capturedHash, capturedPrefix string
	d := &stubDriver{
		queries: []queryResult{
			{
				columns: []string{"tenant_id"},
				rows:    [][]driver.Value{{existing}},
			},
		},
		execs: []execResult{
			{
				rowsAffected: 1,
				check: func(query string, args []driver.NamedValue) {
					require.Contains(t, query, "UPDATE tenants")
					require.Contains(t, query, "api_key_hash")
					require.GreaterOrEqual(t, len(args), 4)
					capturedHash, _ = args[0].Value.(string)
					capturedPrefix, _ = args[1].Value.(string)
					tenantArg, _ := args[3].Value.(string)
					require.Equal(t, existing, tenantArg, "tenant_id must come from the email lookup, not be hardcoded")
				},
			},
		},
	}
	db := openStubDB(t, d)

	var out, errOut bytes.Buffer
	require.NoError(t, mintTenantKey(context.Background(), db, "me@example.test", "", false, &out, &errOut))

	rawKey := strings.TrimSpace(out.String())
	require.True(t, strings.HasPrefix(rawKey, "igris_"), "stdout must contain an igris_ prefixed key")
	require.Equal(t, 70, len(rawKey), "key should be `igris_` + 64 hex chars")
	require.Equal(t, capturedHash, security.HashAPIKey(rawKey), "stored hash must equal sha256(printed key) — middleware lookup contract")
	require.Equal(t, capturedPrefix, rawKey[:12], "stored prefix must equal first 12 chars of the key")

	// Stderr must not echo the raw key.
	require.NotContains(t, errOut.String(), rawKey, "raw key must never appear on stderr")
	// All queued operations should be consumed.
	require.Empty(t, d.queries, "expected exactly one lookup")
	require.Empty(t, d.execs, "expected exactly one update")
}

func TestMintTenantKey_MissingTenant_WithoutCreateFlag_Errors(t *testing.T) {
	d := &stubDriver{
		queries: []queryResult{
			{columns: []string{"tenant_id"}, rows: nil}, // ErrNoRows
		},
	}
	db := openStubDB(t, d)

	var out, errOut bytes.Buffer
	err := mintTenantKey(context.Background(), db, "ghost@example.test", "", false, &out, &errOut)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no tenant with email")
	require.Empty(t, out.String(), "no key must be printed when tenant is missing")
}

func TestMintTenantKey_MissingTenant_WithCreateFlag_InsertsAndMints(t *testing.T) {
	var insertedID, updatedID string
	d := &stubDriver{
		queries: []queryResult{
			{columns: []string{"tenant_id"}, rows: nil}, // not found
		},
		execs: []execResult{
			{
				rowsAffected: 1,
				check: func(query string, args []driver.NamedValue) {
					require.Contains(t, query, "INSERT INTO tenants")
					require.GreaterOrEqual(t, len(args), 3)
					insertedID, _ = args[0].Value.(string)
					emailArg, _ := args[2].Value.(string)
					require.Equal(t, "new@example.test", emailArg, "INSERT must use the normalized email")
				},
			},
			{
				rowsAffected: 1,
				check: func(query string, args []driver.NamedValue) {
					require.Contains(t, query, "UPDATE tenants")
					updatedID, _ = args[3].Value.(string)
				},
			},
		},
	}
	db := openStubDB(t, d)

	var out, errOut bytes.Buffer
	require.NoError(t, mintTenantKey(context.Background(), db, "  NEW@example.test  ", "Founder", true, &out, &errOut))
	require.NotEmpty(t, insertedID)
	require.Equal(t, insertedID, updatedID, "the update must target the freshly-inserted tenant_id")
	require.Contains(t, errOut.String(), "created new tenant")
	require.True(t, strings.HasPrefix(strings.TrimSpace(out.String()), "igris_"))
}

func TestGenerateIgrisKey_ShapeMatchesHandler(t *testing.T) {
	// Belt-and-braces — the CLI must mint keys in the same shape as
	// api.GenerateAPIKey, otherwise the auth middleware can't recognize them.
	raw, prefix, hash, err := generateIgrisKey()
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(raw, "igris_"))
	require.Equal(t, 70, len(raw))
	require.Equal(t, raw[:12], prefix)
	require.Equal(t, hash, security.HashAPIKey(raw))
	require.Len(t, hash, 64)
}
