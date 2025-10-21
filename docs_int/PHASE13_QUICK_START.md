# Phase 13 Quick Start Guide

Get started with Schlep-engine persistence in 5 minutes!

## Prerequisites

- PostgreSQL 13+ installed
- Go 1.21+ installed
- Git repository cloned

## Option 1: Docker Quick Start (Recommended)

```bash
# 1. Start PostgreSQL with Docker
docker run --name schlep-postgres \
  -e POSTGRES_USER=schlep \
  -e POSTGRES_PASSWORD=schlep \
  -e POSTGRES_DB=schlep \
  -p 5432:5432 \
  -d postgres:13

# 2. Set environment variables
export DATABASE_URL="postgres://schlep:schlep@localhost:5432/schlep?sslmode=disable"
export ENABLE_PERSISTENCE=true

# 3. Run migrations
./scripts/migrations/migrate.sh

# 4. Verify setup
psql $DATABASE_URL -c "SELECT COUNT(*) FROM budgets;"

# 5. Run test suite (optional)
./scripts/test_persistence.sh

# 6. Start your application
# The persistence layer will automatically activate!
```

## Option 2: Existing PostgreSQL

```bash
# 1. Create database and user
createdb schlep
createuser -P schlep_user  # Enter password when prompted

# 2. Grant permissions
psql -c "GRANT ALL PRIVILEGES ON DATABASE schlep TO schlep_user;"

# 3. Set environment variables
export DATABASE_URL="postgres://schlep_user:your_password@localhost:5432/schlep?sslmode=disable"
export ENABLE_PERSISTENCE=true

# 4. Run migrations
./scripts/migrations/migrate.sh

# 5. Verify
psql $DATABASE_URL -c "\dt"
```

## Option 3: In-Memory Only (No Database)

```bash
# Use Phase 12 behavior - no persistence required
export ENABLE_PERSISTENCE=false

# Or simply don't set DATABASE_URL at all
# Application will run in in-memory mode automatically
```

## Verify Installation

```bash
# Check database tables
psql $DATABASE_URL -c "\dt"

# Expected output:
#              List of relations
#  Schema |       Name        | Type  | Owner
# --------+-------------------+-------+-------
#  public | api_keys          | table | schlep
#  public | audit_events      | table | schlep
#  public | budgets           | table | schlep
#  public | policy_settings   | table | schlep
#  public | schema_migrations | table | schlep
#  public | spending_log      | table | schlep

# Check database functions
psql $DATABASE_URL -c "\df"

# Check default policy
psql $DATABASE_URL -c "SELECT * FROM policy_settings;"
```

## Configuration Quick Reference

### Minimal Configuration (Local Development)

```bash
DATABASE_URL="postgres://schlep:schlep@localhost:5432/schlep?sslmode=disable"
ENABLE_PERSISTENCE=true
```

### Production Configuration

```bash
DATABASE_URL="postgres://user:pass@prod-db:5432/schlep?sslmode=require"
ENABLE_PERSISTENCE=true
DB_MAX_OPEN_CONNS=100
DB_MAX_IDLE_CONNS=20
DB_FAIL_FAST=true
```

### All Available Options

See [config/database_example.env](../config/database_example.env) for complete configuration.

## Testing Your Setup

```bash
# Run comprehensive test suite
./scripts/test_persistence.sh

# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Test budget creation
psql $DATABASE_URL -c "
  INSERT INTO budgets (tenant_id, year_month, budget_limit_usd)
  VALUES ('test', '$(date +%Y-%m)', 10.0);
"

# View budgets
psql $DATABASE_URL -c "SELECT * FROM budgets;"

# Clean up test data
psql $DATABASE_URL -c "DELETE FROM budgets WHERE tenant_id = 'test';"
```

## Integration Example

```go
package main

import (
    "log"
    "github.com/schlep-engine/schlep-engine/internal/database"
    "github.com/schlep-engine/schlep-engine/internal/safety"
)

func main() {
    // 1. Load database configuration
    dbConfig := database.NewConfig()
    db, err := database.Connect(dbConfig)
    if err != nil && dbConfig.FailFastOnError {
        log.Fatal("Database connection failed:", err)
    }

    // 2. Initialize safety with persistence
    safetyConfig := safety.LoadConfig()
    var controller *safety.SafetyController

    if db != nil && db.IsEnabled() {
        controller = safety.NewSafetyControllerWithDB(
            safetyConfig,
            db.DB,
            "default",  // tenant ID
        )
        log.Println("✓ Persistence enabled")
    } else {
        controller = safety.NewSafetyController(safetyConfig)
        log.Println("⚠ Using in-memory mode")
    }

    // 3. Ensure cleanup on shutdown
    defer func() {
        controller.Close()
        if db != nil {
            db.Close()
        }
    }()

    // 4. Use as normal!
    // Budget tracking and audit logging now persist to database
}
```

## Common Issues

### "connection refused"

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
# Docker: docker start schlep-postgres
```

### "database does not exist"

```bash
# Create database
createdb schlep

# Or using psql
psql postgres -c "CREATE DATABASE schlep;"
```

### "permission denied for schema public"

```bash
# Grant permissions
psql -c "GRANT ALL PRIVILEGES ON DATABASE schlep TO your_user;"
psql schlep -c "GRANT ALL ON SCHEMA public TO your_user;"
```

### "relation budgets does not exist"

```bash
# Run migrations
./scripts/migrations/migrate.sh

# Or manually apply schema
psql $DATABASE_URL < internal/database/schema.sql
```

## Next Steps

1. **Read the full documentation:** [PHASE13_PERSISTENCE_REPORT.md](PHASE13_PERSISTENCE_REPORT.md)
2. **Configure for your environment:** Copy [config/database_example.env](../config/database_example.env)
3. **Set up backups:** See [database backup guide](../internal/database/README.md#backup-and-recovery)
4. **Monitor performance:** Check [performance tuning](../internal/database/README.md#performance-tuning)
5. **Enable multi-tenancy:** Use different tenant IDs for isolation

## Help

- **Documentation:** See [docs/](.)
- **Database Guide:** [internal/database/README.md](../internal/database/README.md)
- **Migration Guide:** [scripts/migrations/migrate.sh](../scripts/migrations/migrate.sh)
- **Configuration:** [config/database_example.env](../config/database_example.env)

## Development Workflow

```bash
# 1. Start database
docker-compose up -d postgres

# 2. Run migrations
./scripts/migrations/migrate.sh

# 3. Start development server
go run cmd/schlep-api/main.go

# 4. Watch logs for persistence confirmation
# Look for: "[Database] Connected successfully"
#           "[BudgetTracker] Loaded from database"

# 5. Test budget persistence
curl -X POST http://localhost:8080/infer -d '{...}'

# 6. Restart server and verify recovery
# Budget state should be restored from database!
```

---

**You're ready to go!** 🚀

The persistence layer will activate automatically when `DATABASE_URL` and `ENABLE_PERSISTENCE=true` are set.
