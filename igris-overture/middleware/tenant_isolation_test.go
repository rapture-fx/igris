package middleware

import (
	"database/sql"
	"testing"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test P0-3: Row-Level Security Enforcement
// Verifies that RLS prevents one tenant from accessing another tenant's data
func TestTenantIsolation_RLSEnforcement(t *testing.T) {
	// This test requires a database connection
	// Skip if DB_TEST_URL environment variable is not set
	dbURL := "postgres://localhost/igris_overture_test?sslmode=disable"
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Skip("Skipping RLS test: database not available")
		return
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		t.Skip("Skipping RLS test: cannot connect to database")
		return
	}

	// Setup: Create two test tenants
	_, err = db.Exec(`
		INSERT INTO tenants (tenant_id, tenant_name, monthly_budget_usd)
		VALUES
			('test-tenant-a', 'Tenant A', 100.00),
			('test-tenant-b', 'Tenant B', 100.00)
		ON CONFLICT (tenant_id) DO NOTHING
	`)
	require.NoError(t, err)

	// Insert test data for tenant A
	_, err = db.Exec(`
		INSERT INTO tenant_request_log (tenant_id, request_id, provider, model, cost_usd, status)
		VALUES ('test-tenant-a', 'req-a-001', 'openai', 'gpt-4', 0.05, 'success')
		ON CONFLICT DO NOTHING
	`)
	require.NoError(t, err)

	// Insert test data for tenant B
	_, err = db.Exec(`
		INSERT INTO tenant_request_log (tenant_id, request_id, provider, model, cost_usd, status)
		VALUES ('test-tenant-b', 'req-b-001', 'anthropic', 'claude-3', 0.03, 'success')
		ON CONFLICT DO NOTHING
	`)
	require.NoError(t, err)

	// Test 1: Set context to tenant A and verify they can only see their own data
	_, err = db.Exec(`SELECT set_tenant_context('test-tenant-a')`)
	require.NoError(t, err)

	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM tenant_request_log`).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "Tenant A should only see 1 request (their own)")

	var tenantID string
	err = db.QueryRow(`SELECT tenant_id FROM tenant_request_log LIMIT 1`).Scan(&tenantID)
	require.NoError(t, err)
	assert.Equal(t, "test-tenant-a", tenantID, "Tenant A should only see their own tenant_id")

	// Test 2: Set context to tenant B and verify isolation
	_, err = db.Exec(`SELECT set_tenant_context('test-tenant-b')`)
	require.NoError(t, err)

	err = db.QueryRow(`SELECT COUNT(*) FROM tenant_request_log`).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "Tenant B should only see 1 request (their own)")

	err = db.QueryRow(`SELECT tenant_id FROM tenant_request_log LIMIT 1`).Scan(&tenantID)
	require.NoError(t, err)
	assert.Equal(t, "test-tenant-b", tenantID, "Tenant B should only see their own tenant_id")

	// Test 3: Attempt to query another tenant's data explicitly (should return 0 rows)
	_, err = db.Exec(`SELECT set_tenant_context('test-tenant-a')`)
	require.NoError(t, err)

	err = db.QueryRow(`SELECT COUNT(*) FROM tenant_request_log WHERE tenant_id = 'test-tenant-b'`).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "Tenant A should NOT be able to query tenant B's data")

	// Cleanup
	db.Exec(`DELETE FROM tenant_request_log WHERE tenant_id IN ('test-tenant-a', 'test-tenant-b')`)
	db.Exec(`DELETE FROM tenants WHERE tenant_id IN ('test-tenant-a', 'test-tenant-b')`)
}

// Test P0-3: RLS Enabled on All Tenant Tables
// Verifies that RLS is enabled on all critical tenant tables
func TestTenantIsolation_RLSEnabledOnAllTables(t *testing.T) {
	dbURL := "postgres://localhost/igris_overture_test?sslmode=disable"
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Skip("Skipping RLS test: database not available")
		return
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		t.Skip("Skipping RLS test: cannot connect to database")
		return
	}

	// Query RLS status for all tenant tables
	rows, err := db.Query(`
		SELECT * FROM verify_rls_enabled()
	`)
	require.NoError(t, err)
	defer rows.Close()

	rlsStatus := make(map[string]bool)
	for rows.Next() {
		var tableName string
		var rlsEnabled bool
		var policyCount int64

		err := rows.Scan(&tableName, &rlsEnabled, &policyCount)
		require.NoError(t, err)

		rlsStatus[tableName] = rlsEnabled
		t.Logf("Table %s: RLS=%v, Policies=%d", tableName, rlsEnabled, policyCount)

		// Verify RLS is enabled
		assert.True(t, rlsEnabled, "RLS should be enabled on table: "+tableName)
		// Verify at least one policy exists
		assert.Greater(t, policyCount, int64(0), "At least one RLS policy should exist on table: "+tableName)
	}

	// Verify critical tables have RLS
	criticalTables := []string{"tenants", "tenant_budget_usage", "tenant_request_log"}
	for _, table := range criticalTables {
		assert.True(t, rlsStatus[table], "RLS must be enabled on critical table: "+table)
	}
}
