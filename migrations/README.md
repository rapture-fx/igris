# Database Migrations

This directory contains SQL migration scripts for Schlep-Engine database schema.

## Migration Files

| File | Purpose | Phase |
|------|---------|-------|
| `001_create_optimizer_states.sql` | Optimizer state persistence (Thompson Sampling) | Phase 2 |
| `002_create_tenant_budgets.sql` | Multi-tenant budget tracking | Phase 2 |
| `003_create_api_keys_table.sql` | Encrypted tenant API key storage (BYOK) | Phase 2 |

## Running Migrations

### Option 1: Using psql (Recommended for Production)

```bash
# Set your database URL
export DATABASE_URL="postgres://user:password@localhost:5432/igris_overture"

# Run all migrations in order
psql $DATABASE_URL -f migrations/001_create_optimizer_states.sql
psql $DATABASE_URL -f migrations/002_create_tenant_budgets.sql
psql $DATABASE_URL -f migrations/003_create_api_keys_table.sql
```

### Option 2: Using Docker Compose

Migrations are automatically run on container startup:

```bash
# Start the database with migrations
docker-compose -f docker-compose.production.yml up -d postgres

# Check migration status
docker-compose -f docker-compose.production.yml logs postgres
```

### Option 3: Manual Execution

```bash
# Connect to database
psql postgres://user:password@localhost:5432/igris_overture

-- Run migrations
\i migrations/001_create_optimizer_states.sql
\i migrations/002_create_tenant_budgets.sql
\i migrations/003_create_api_keys_table.sql
```

## Migration Details

### 001_create_optimizer_states.sql

Creates table for persisting Thompson Sampling optimizer state across restarts.

**Tables:**
- `optimizer_states` - JSONB storage for optimizer state

**Features:**
- Automatic `updated_at` trigger
- GIN index on JSONB for fast queries
- Version tracking
- Snapshot naming support

**Sample Query:**
```sql
-- Get latest optimizer state
SELECT * FROM optimizer_states
WHERE snapshot_name = 'latest'
ORDER BY created_at DESC
LIMIT 1;
```

### 002_create_tenant_budgets.sql

Creates multi-tenant budget tracking infrastructure.

**Tables:**
- `tenants` - Tenant configuration and budget limits
- `tenant_budget_usage` - Monthly aggregated usage per tenant
- `tenant_request_log` - Detailed audit log of all requests

**Features:**
- Automatic budget reset tracking
- JSONB breakdown by provider and model
- Audit trail with trace IDs
- Default tenant for backward compatibility

**Sample Queries:**
```sql
-- Get current month usage for a tenant
SELECT * FROM tenant_budget_usage
WHERE tenant_id = 'acme-corp'
  AND billing_month = DATE_TRUNC('month', CURRENT_DATE);

-- Get top spending tenants this month
SELECT t.tenant_name, u.total_cost_usd, u.total_requests
FROM tenant_budget_usage u
JOIN tenants t ON t.tenant_id = u.tenant_id
WHERE u.billing_month = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY u.total_cost_usd DESC
LIMIT 10;
```

### 003_create_api_keys_table.sql

Creates encrypted storage for tenant-provided API keys (BYOK model).

**Tables:**
- `tenant_api_keys` - Encrypted API keys with validation status

**Features:**
- AES-256 encryption using `VAULT_MASTER_KEY`
- SHA-256 hash for duplicate detection
- Key validation tracking
- Usage statistics
- Expiration support

**Sample Query:**
```sql
-- Get active keys for a tenant
SELECT key_id, provider, key_prefix, is_valid, last_validated_at
FROM tenant_api_keys
WHERE tenant_id = 'acme-corp'
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > NOW());
```

## Schema Overview

```
┌─────────────────┐
│    tenants      │
│  - tenant_id    │ (PK)
│  - budget_usd   │
└────────┬────────┘
         │
         │ 1:N
         ├─────────────────┐
         │                 │
┌────────▼────────┐  ┌────▼──────────────┐
│tenant_api_keys  │  │tenant_budget_usage│
│ - encrypted_key │  │ - total_cost_usd  │
│ - provider      │  │ - provider_usage  │
└─────────────────┘  └────┬──────────────┘
                          │
                          │ Related
                          │
                  ┌───────▼─────────────┐
                  │tenant_request_log   │
                  │ - request_id        │
                  │ - cost_usd          │
                  │ - trace_id          │
                  └─────────────────────┘
```

## Verification

After running migrations, verify schema:

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Check indexes
psql $DATABASE_URL -c "\di"

# Verify default tenant exists
psql $DATABASE_URL -c "SELECT * FROM tenants WHERE tenant_id = 'default';"
```

Expected output:
```
 tenant_id |  tenant_name   | monthly_budget_usd | is_active
-----------+----------------+--------------------+-----------
 default   | Default Tenant |             100.00 | t
```

## Rollback

To rollback migrations (⚠️ destructive):

```sql
-- Rollback 003
DROP TABLE IF EXISTS tenant_api_keys CASCADE;
DROP FUNCTION IF EXISTS update_api_keys_updated_at() CASCADE;

-- Rollback 002
DROP TABLE IF EXISTS tenant_request_log CASCADE;
DROP TABLE IF EXISTS tenant_budget_usage CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP FUNCTION IF EXISTS update_tenants_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_budget_usage_updated_at() CASCADE;

-- Rollback 001
DROP TABLE IF EXISTS optimizer_states CASCADE;
DROP FUNCTION IF EXISTS update_optimizer_states_updated_at() CASCADE;
```

## Production Recommendations

1. **Backup First:** Always backup production database before migrations
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test Locally:** Run migrations on a local/staging database first
   ```bash
   # Use docker-compose for local testing
   docker-compose up -d postgres
   ```

3. **Monitor Performance:** Check query performance after migrations
   ```sql
   -- Analyze tables for optimal query planning
   ANALYZE optimizer_states;
   ANALYZE tenants;
   ANALYZE tenant_budget_usage;
   ANALYZE tenant_request_log;
   ANALYZE tenant_api_keys;
   ```

4. **Enable SSL:** Use `sslmode=require` in production DATABASE_URL
   ```bash
   DATABASE_URL="postgres://user:pass@host:5432/db?sslmode=require"
   ```

5. **Connection Pooling:** Configure appropriate pool sizes
   ```bash
   DB_MAX_OPEN_CONNS=25
   DB_MAX_IDLE_CONNS=5
   ```

## Troubleshooting

### Migration fails with "relation already exists"

Migrations are idempotent (use `IF NOT EXISTS`). Safe to re-run.

### Permission denied errors

Ensure database user has CREATE privileges:
```sql
GRANT CREATE ON SCHEMA public TO schlep_user;
```

### Performance issues after migration

Run ANALYZE and VACUUM:
```sql
VACUUM ANALYZE;
```

## Next Steps

After running migrations:

1. ✅ Verify all tables created
2. ✅ Check default tenant exists
3. ✅ Test optimizer state save/load
4. ✅ Test tenant budget tracking
5. ✅ Test API key encryption/decryption
6. ✅ Run integration tests
7. ✅ Configure backup strategy

## Support

For issues or questions, see:
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide
- [docker-compose.production.yml](../docker-compose.production.yml) - Docker configuration
- [Phase 2 Completion Report](../reports/phase2_completion_summary.md) - Implementation details
