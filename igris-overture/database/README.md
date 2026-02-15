# Database Package - Phase 13 Persistence Layer

This package provides PostgreSQL persistence for Igris Inertial's safety features, enabling production-grade budget tracking, policy storage, and audit logging.

## Quick Start

### 1. Local Development Setup

```bash
# Start PostgreSQL with Docker
docker run --name igris-postgres \
  -e POSTGRES_USER=igris \
  -e POSTGRES_PASSWORD=igris \
  -e POSTGRES_DB=igris \
  -p 5432:5432 \
  -d postgres:13

# Set database URL
export DATABASE_URL="postgres://igris:igris@localhost:5432/igris?sslmode=disable"
export ENABLE_PERSISTENCE=true

# Run migrations
./scripts/migrations/migrate.sh

# Verify setup
psql $DATABASE_URL -c "SELECT COUNT(*) FROM budgets;"
```

### 2. Production Setup

```bash
# Set database URL (use secrets management in production)
export DATABASE_URL="postgres://user:pass@prod-db:5432/igris?sslmode=require"
export ENABLE_PERSISTENCE=true
export DB_MAX_OPEN_CONNS=50
export DB_MAX_IDLE_CONNS=10
export DB_FAIL_FAST=true  # Fail fast in production

# Run migrations
./scripts/migrations/migrate.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` or `POSTGRES_URL` | - | PostgreSQL connection string (required) |
| `ENABLE_PERSISTENCE` | `false` | Enable database persistence |
| `DB_MAX_OPEN_CONNS` | `25` | Maximum open connections |
| `DB_MAX_IDLE_CONNS` | `5` | Maximum idle connections |
| `DB_CONN_MAX_LIFETIME` | `15` | Connection max lifetime (minutes) |
| `DB_CONN_MAX_IDLE_TIME` | `5` | Connection max idle time (minutes) |
| `DB_FAIL_FAST` | `false` | Fail on database connection error |
| `DB_ENABLE_QUERY_LOGGING` | `false` | Log all database queries |

## Usage in Code

### Basic Setup

```go
package main

import (
    "log"
    "github.com/igris-inertial/igris-inertial/internal/database"
    "github.com/igris-inertial/igris-inertial/internal/safety"
)

func main() {
    // Load database configuration from environment
    dbConfig := database.NewConfig()

    // Connect to database (gracefully falls back to in-memory if unavailable)
    db, err := database.Connect(dbConfig)
    if err != nil && dbConfig.FailFastOnError {
        log.Fatal("Database connection failed:", err)
    }

    // Initialize schema (development only - use migrations in production)
    if db != nil && db.IsEnabled() {
        err := db.InitializeSchema("internal/database/schema.sql")
        if err != nil {
            log.Printf("Warning: Schema initialization failed: %v", err)
        }
    }

    // Create safety controller with persistence
    safetyConfig := safety.LoadConfig()
    var safetyController *safety.SafetyController

    if db != nil && db.IsEnabled() {
        safetyController = safety.NewSafetyControllerWithDB(
            safetyConfig,
            db.DB,  // Pass underlying *sql.DB
            "default",  // Tenant ID
        )
    } else {
        // Fallback to in-memory mode
        safetyController = safety.NewSafetyController(safetyConfig)
    }

    // Ensure audit logger flushes on shutdown
    defer func() {
        if err := safetyController.Close(); err != nil {
            log.Printf("Error closing safety controller: %v", err)
        }
        if db != nil {
            db.Close()
        }
    }()

    // Use safety controller as normal...
}
```

### Health Check Endpoint

```go
func healthCheckHandler(db *database.DB) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        health := map[string]interface{}{
            "status": "healthy",
            "database": map[string]interface{}{
                "enabled": db.IsEnabled(),
            },
        }

        if db.IsEnabled() {
            if err := db.HealthCheck(); err != nil {
                health["status"] = "degraded"
                health["database"].(map[string]interface{})["error"] = err.Error()
                w.WriteHeader(http.StatusServiceUnavailable)
            }

            // Add connection pool stats
            stats := db.Stats()
            health["database"].(map[string]interface{})["pool"] = map[string]interface{}{
                "open_connections": stats.OpenConnections,
                "in_use": stats.InUse,
                "idle": stats.Idle,
            }
        }

        json.NewEncoder(w).Encode(health)
    }
}
```

## Database Schema

The schema includes the following tables:

- **`budgets`** - Monthly budget tracking per tenant
- **`spending_log`** - Detailed cost breakdown by provider and model
- **`policy_settings`** - Safety policy configuration per tenant
- **`audit_events`** - Comprehensive audit trail
- **`api_keys`** - Encrypted tenant API keys (Phase 14+)

See `schema.sql` for complete schema definition.

## Migrations

Migrations are managed using the migration script in `scripts/migrations/`.

### Running Migrations

```bash
# Run all pending migrations
./scripts/migrations/migrate.sh

# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC;"
```

### Creating a New Migration

```bash
# Create new migration file
cat > scripts/migrations/002_add_feature.sql << 'EOF'
-- Migration: 002_add_feature
-- Description: Add new feature to database
-- Date: 2025-10-21

BEGIN;

-- Your migration SQL here
ALTER TABLE budgets ADD COLUMN new_field VARCHAR(255);

COMMIT;
EOF

# Run migration
./scripts/migrations/migrate.sh
```

## Performance Tuning

### Connection Pooling

```bash
# For high-traffic production deployments
export DB_MAX_OPEN_CONNS=100
export DB_MAX_IDLE_CONNS=20
export DB_CONN_MAX_LIFETIME=30
```

### Monitoring

```go
// Log connection pool stats periodically
ticker := time.NewTicker(1 * time.Minute)
go func() {
    for range ticker.C {
        db.LogStats()
    }
}()
```

### Query Performance

```sql
-- Analyze slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%budgets%' OR query LIKE '%spending_log%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Backup and Recovery

### Automated Backups

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/var/backups/igris"
DATE=$(date +%Y%m%d)

pg_dump $DATABASE_URL > $BACKUP_DIR/igris_$DATE.sql
gzip $BACKUP_DIR/igris_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "igris_*.sql.gz" -mtime +30 -delete
```

### Point-in-Time Recovery

```bash
# Restore from backup
gunzip < /var/backups/igris/igris_20251020.sql.gz | psql $DATABASE_URL
```

## Troubleshooting

### Connection Issues

```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'igris';"

# View active queries
psql $DATABASE_URL -c "SELECT pid, query, state FROM pg_stat_activity WHERE datname = 'igris';"
```

### Performance Issues

```sql
-- Find slow queries
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check table bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Vacuum and analyze
VACUUM ANALYZE budgets;
VACUUM ANALYZE spending_log;
VACUUM ANALYZE audit_events;
```

### Data Integrity

```sql
-- Check for orphaned records
SELECT COUNT(*) FROM spending_log sl
LEFT JOIN budgets b ON sl.budget_id = b.id
WHERE b.id IS NULL;

-- Verify budget totals match spending logs
SELECT
    b.id,
    b.total_spend_usd as budget_total,
    COALESCE(SUM(sl.cost_usd), 0) as log_total,
    b.total_spend_usd - COALESCE(SUM(sl.cost_usd), 0) as difference
FROM budgets b
LEFT JOIN spending_log sl ON b.id = sl.budget_id
GROUP BY b.id, b.total_spend_usd
HAVING ABS(b.total_spend_usd - COALESCE(SUM(sl.cost_usd), 0)) > 0.01;
```

## Security Best Practices

1. **Use SSL/TLS:**
   ```bash
   DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
   ```

2. **Least Privilege:**
   ```sql
   -- Create read-only user for reporting
   CREATE USER igris_reader WITH PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE igris TO igris_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO igris_reader;
   ```

3. **Secrets Management:**
   ```bash
   # Use environment variables or secrets managers
   # Never commit credentials to version control
   ```

4. **Connection Limits:**
   ```sql
   -- Set per-user connection limit
   ALTER USER igris CONNECTION LIMIT 50;
   ```

## See Also

- [Phase 13 Persistence Report](../../docs/PHASE13_PERSISTENCE_REPORT.md)
- [Database Schema](schema.sql)
- [Migration Guide](../../scripts/migrations/README.md)
