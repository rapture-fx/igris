package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"
)

// PreparedStatementPool manages a pool of prepared statements for high-performance queries
// Enhancement: Eliminates query parsing overhead by reusing prepared statements
type PreparedStatementPool struct {
	db         *sql.DB
	statements map[string]*PreparedStatement
	mu         sync.RWMutex
	logger     *log.Logger
	enabled    bool

	// Statistics
	hits   int64
	misses int64
	mu_stats sync.RWMutex
}

// PreparedStatement wraps a sql.Stmt with metadata
type PreparedStatement struct {
	stmt      *sql.Stmt
	query     string
	createdAt time.Time
	useCount  int64
	lastUsed  time.Time
	mu        sync.RWMutex
}

// CommonQueries defines frequently-used query patterns that benefit from prepared statements
var CommonQueries = map[string]string{
	// Tenant queries
	"get_tenant_status": `
		SELECT status FROM tenants WHERE tenant_id = $1
	`,
	"update_tenant_last_login": `
		SELECT update_tenant_last_login($1)
	`,
	"get_tenant_by_api_key": `
		SELECT tenant_id, tenant_name, status
		FROM tenants
		WHERE api_key_hash = $1
	`,

	// Key vault queries
	"get_active_key": `
		SELECT id, tenant_id, provider, key_name, encrypted_key, encryption_iv,
		       encryption_tag, key_version, is_active, is_valid, last_validated_at,
		       last_used_at, usage_count, created_at, created_by
		FROM tenant_keys
		WHERE tenant_id = $1 AND provider = $2 AND is_active = TRUE
		ORDER BY created_at DESC
		LIMIT 1
	`,
	"update_key_usage": `
		UPDATE tenant_keys
		SET last_used_at = NOW(), usage_count = usage_count + 1
		WHERE id = $1
	`,

	// Session queries
	"check_token_revoked": `
		SELECT revoked_at FROM tenant_sessions
		WHERE token_hash = $1
	`,
	"update_session_last_used": `
		UPDATE tenant_sessions
		SET last_used_at = NOW(), request_count = request_count + 1
		WHERE token_hash = $1
	`,

	// Optimizer state queries
	"load_optimizer_state": `
		SELECT state_id, snapshot_name, optimizer_type, state_data,
		       provider_count, total_samples, version, created_at, updated_at
		FROM optimizer_states
		WHERE snapshot_name = $1
		ORDER BY updated_at DESC
		LIMIT 1
	`,
	"save_optimizer_state": `
		INSERT INTO optimizer_states (
			snapshot_name, optimizer_type, state_data,
			provider_count, total_samples, version,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING state_id
	`,

	// Budget/cost tracking queries
	"get_tenant_budget": `
		SELECT monthly_budget, current_spend, budget_alert_threshold
		FROM tenant_budgets
		WHERE tenant_id = $1 AND month = $2
	`,
	"update_tenant_spend": `
		UPDATE tenant_budgets
		SET current_spend = current_spend + $1, last_updated = NOW()
		WHERE tenant_id = $2 AND month = $3
	`,
}

// NewPreparedStatementPool creates a new prepared statement pool
func NewPreparedStatementPool(db *sql.DB, enabled bool) *PreparedStatementPool {
	if !enabled || db == nil {
		return &PreparedStatementPool{
			db:      db,
			enabled: false,
			logger:  log.Default(),
		}
	}

	pool := &PreparedStatementPool{
		db:         db,
		statements: make(map[string]*PreparedStatement),
		logger:     log.Default(),
		enabled:    true,
	}

	// Pre-warm the pool with common queries
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	warmedCount := 0
	for name, query := range CommonQueries {
		if _, err := pool.Prepare(ctx, name, query); err != nil {
			pool.logger.Printf("[PreparedStmtPool] Failed to prepare '%s': %v", name, err)
		} else {
			warmedCount++
		}
	}

	pool.logger.Printf("[PreparedStmtPool] Pre-warmed %d/%d common queries", warmedCount, len(CommonQueries))
	return pool
}

// Prepare creates or retrieves a prepared statement
func (psp *PreparedStatementPool) Prepare(ctx context.Context, name, query string) (*PreparedStatement, error) {
	if !psp.enabled {
		return nil, fmt.Errorf("prepared statement pool disabled")
	}

	// Check if already prepared
	psp.mu.RLock()
	if stmt, exists := psp.statements[name]; exists {
		psp.mu.RUnlock()
		psp.recordHit()
		return stmt, nil
	}
	psp.mu.RUnlock()

	// Prepare new statement
	psp.mu.Lock()
	defer psp.mu.Unlock()

	// Double-check after acquiring write lock
	if stmt, exists := psp.statements[name]; exists {
		psp.recordHit()
		return stmt, nil
	}

	psp.recordMiss()

	stmt, err := psp.db.PrepareContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare statement '%s': %w", name, err)
	}

	prepStmt := &PreparedStatement{
		stmt:      stmt,
		query:     query,
		createdAt: time.Now(),
		lastUsed:  time.Now(),
		useCount:  0,
	}

	psp.statements[name] = prepStmt
	psp.logger.Printf("[PreparedStmtPool] Prepared statement: %s", name)

	return prepStmt, nil
}

// Get retrieves a prepared statement by name
func (psp *PreparedStatementPool) Get(name string) (*PreparedStatement, error) {
	if !psp.enabled {
		return nil, fmt.Errorf("prepared statement pool disabled")
	}

	psp.mu.RLock()
	defer psp.mu.RUnlock()

	stmt, exists := psp.statements[name]
	if !exists {
		psp.recordMiss()
		return nil, fmt.Errorf("prepared statement '%s' not found", name)
	}

	psp.recordHit()
	return stmt, nil
}

// QueryRow executes a named prepared statement for single-row results
func (psp *PreparedStatementPool) QueryRow(ctx context.Context, name string, args ...interface{}) (*sql.Row, error) {
	stmt, err := psp.Get(name)
	if err != nil {
		return nil, err
	}

	stmt.mu.Lock()
	stmt.useCount++
	stmt.lastUsed = time.Now()
	stmt.mu.Unlock()

	return stmt.stmt.QueryRowContext(ctx, args...), nil
}

// Query executes a named prepared statement for multi-row results
func (psp *PreparedStatementPool) Query(ctx context.Context, name string, args ...interface{}) (*sql.Rows, error) {
	stmt, err := psp.Get(name)
	if err != nil {
		return nil, err
	}

	stmt.mu.Lock()
	stmt.useCount++
	stmt.lastUsed = time.Now()
	stmt.mu.Unlock()

	return stmt.stmt.QueryContext(ctx, args...)
}

// Exec executes a named prepared statement (INSERT/UPDATE/DELETE)
func (psp *PreparedStatementPool) Exec(ctx context.Context, name string, args ...interface{}) (sql.Result, error) {
	stmt, err := psp.Get(name)
	if err != nil {
		return nil, err
	}

	stmt.mu.Lock()
	stmt.useCount++
	stmt.lastUsed = time.Now()
	stmt.mu.Unlock()

	return stmt.stmt.ExecContext(ctx, args...)
}

// Close closes a specific prepared statement
func (psp *PreparedStatementPool) CloseStatement(name string) error {
	if !psp.enabled {
		return nil
	}

	psp.mu.Lock()
	defer psp.mu.Unlock()

	stmt, exists := psp.statements[name]
	if !exists {
		return fmt.Errorf("statement '%s' not found", name)
	}

	if err := stmt.stmt.Close(); err != nil {
		return err
	}

	delete(psp.statements, name)
	psp.logger.Printf("[PreparedStmtPool] Closed statement: %s", name)
	return nil
}

// CloseAll closes all prepared statements
func (psp *PreparedStatementPool) CloseAll() error {
	if !psp.enabled {
		return nil
	}

	psp.mu.Lock()
	defer psp.mu.Unlock()

	var firstErr error
	for name, stmt := range psp.statements {
		if err := stmt.stmt.Close(); err != nil && firstErr == nil {
			firstErr = err
			psp.logger.Printf("[PreparedStmtPool] Error closing '%s': %v", name, err)
		}
	}

	psp.statements = make(map[string]*PreparedStatement)
	psp.logger.Println("[PreparedStmtPool] Closed all prepared statements")

	return firstErr
}

// GetStats returns statistics about prepared statement usage
func (psp *PreparedStatementPool) GetStats() map[string]interface{} {
	if !psp.enabled {
		return map[string]interface{}{
			"enabled": false,
		}
	}

	psp.mu.RLock()
	defer psp.mu.RUnlock()

	stmtStats := make([]map[string]interface{}, 0, len(psp.statements))

	for name, stmt := range psp.statements {
		stmt.mu.RLock()
		stmtStats = append(stmtStats, map[string]interface{}{
			"name":       name,
			"use_count":  stmt.useCount,
			"created_at": stmt.createdAt,
			"last_used":  stmt.lastUsed,
			"age_seconds": time.Since(stmt.createdAt).Seconds(),
		})
		stmt.mu.RUnlock()
	}

	psp.mu_stats.RLock()
	hits := psp.hits
	misses := psp.misses
	psp.mu_stats.RUnlock()

	hitRate := 0.0
	total := hits + misses
	if total > 0 {
		hitRate = float64(hits) / float64(total) * 100
	}

	return map[string]interface{}{
		"enabled":       true,
		"total_stmts":   len(psp.statements),
		"cache_hits":    hits,
		"cache_misses":  misses,
		"hit_rate_pct":  hitRate,
		"statements":    stmtStats,
	}
}

// recordHit increments hit counter
func (psp *PreparedStatementPool) recordHit() {
	psp.mu_stats.Lock()
	psp.hits++
	psp.mu_stats.Unlock()
}

// recordMiss increments miss counter
func (psp *PreparedStatementPool) recordMiss() {
	psp.mu_stats.Lock()
	psp.misses++
	psp.mu_stats.Unlock()
}

// CleanupStale removes statements that haven't been used recently
func (psp *PreparedStatementPool) CleanupStale(maxAge time.Duration) int {
	if !psp.enabled {
		return 0
	}

	psp.mu.Lock()
	defer psp.mu.Unlock()

	cutoff := time.Now().Add(-maxAge)
	removed := 0

	for name, stmt := range psp.statements {
		stmt.mu.RLock()
		lastUsed := stmt.lastUsed
		stmt.mu.RUnlock()

		if lastUsed.Before(cutoff) {
			if err := stmt.stmt.Close(); err != nil {
				psp.logger.Printf("[PreparedStmtPool] Error closing stale statement '%s': %v", name, err)
			} else {
				delete(psp.statements, name)
				removed++
			}
		}
	}

	if removed > 0 {
		psp.logger.Printf("[PreparedStmtPool] Cleaned up %d stale statements (unused for %s)", removed, maxAge)
	}

	return removed
}

// StartCleanupWorker starts a background worker to periodically clean up stale statements
func (psp *PreparedStatementPool) StartCleanupWorker(interval, maxAge time.Duration) {
	if !psp.enabled {
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			psp.CleanupStale(maxAge)
		}
	}()

	psp.logger.Printf("[PreparedStmtPool] Started cleanup worker (interval=%s, max_age=%s)", interval, maxAge)
}
