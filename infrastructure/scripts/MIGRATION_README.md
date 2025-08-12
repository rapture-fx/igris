# Database Migration Guide: AWS RDS to Supabase Pro

This comprehensive guide covers the complete migration process from AWS RDS to Supabase Pro with zero downtime and data integrity validation.

## 🚀 Quick Start

```bash
# 1. Copy and configure environment variables
cp migration_config.example.env migration_config.env
# Edit migration_config.env with your database credentials

# 2. Load environment variables
source migration_config.env

# 3. Validate configuration and connections
python migrate_to_supabase.py --config-check

# 4. Run the migration
python migrate_to_supabase.py --mode=migrate
```

## 📋 Prerequisites

### System Requirements
- Python 3.8+
- PostgreSQL client libraries
- Sufficient disk space for logs and temporary files
- Network connectivity to both AWS RDS and Supabase

### Required Python Packages
```bash
pip install asyncpg sqlalchemy psycopg2-binary asyncio-pool
```

### Database Permissions

#### Source Database (AWS RDS) - Read-Only Access Required
```sql
-- Minimum required permissions for migration user
GRANT CONNECT ON DATABASE your_database TO migration_user;
GRANT USAGE ON SCHEMA public TO migration_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO migration_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO migration_user;

-- For custom schemas
GRANT USAGE ON SCHEMA custom_schema TO migration_user;
GRANT SELECT ON ALL TABLES IN SCHEMA custom_schema TO migration_user;
```

#### Target Database (Supabase) - Full Access Required
```sql
-- Full permissions required for target database
GRANT ALL PRIVILEGES ON DATABASE postgres TO migration_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migration_user;
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AWS_DATABASE_URL` | Source AWS RDS database URL | - | ✅ |
| `SUPABASE_DATABASE_URL` | Target Supabase database URL | - | ✅ |
| `MIGRATION_BATCH_SIZE` | Records per batch | 1000 | ❌ |
| `MIGRATION_PARALLEL_WORKERS` | Parallel table processors | 4 | ❌ |
| `MIGRATION_TIMEOUT_SECONDS` | Operation timeout | 3600 | ❌ |
| `MIGRATION_VALIDATE_DATA` | Enable data validation | true | ❌ |
| `MIGRATION_CREATE_INDEXES` | Create indexes and constraints | true | ❌ |
| `MIGRATION_MIGRATE_SEQUENCES` | Migrate database sequences | true | ❌ |
| `MIGRATION_LOG_LEVEL` | Logging verbosity | INFO | ❌ |

### Database URL Format
```
postgresql://username:password@hostname:port/database_name
```

**Example:**
```bash
AWS_DATABASE_URL="postgresql://user:pass@mydb.123456789.us-east-1.rds.amazonaws.com:5432/myapp"
SUPABASE_DATABASE_URL="postgresql://postgres:mypass@db.abcdefghijklmnop.supabase.co:5432/postgres"
```

## 🏃‍♂️ Migration Modes

### 1. Configuration Check
Validates configuration and tests database connections without making changes.

```bash
python migrate_to_supabase.py --config-check
```

### 2. Connection Validation
Tests database connections and required permissions.

```bash
python migrate_to_supabase.py --mode=validate
```

### 3. Full Migration
Performs complete migration with schema creation, data transfer, and validation.

```bash
python migrate_to_supabase.py --mode=migrate
```

### 4. Migration Verification
Verifies data integrity after migration completion.

```bash
python migrate_to_supabase.py --mode=verify
```

### 5. Migration Rollback
Rolls back migration by cleaning the target database.

```bash
python migrate_to_supabase.py --mode=rollback
```

## 📊 Migration Process Overview

The migration follows these sequential steps:

1. **Connection Validation** - Verify database connectivity and permissions
2. **Schema Discovery** - Identify all tables, indexes, and constraints
3. **Schema Creation** - Replicate database structure in target
4. **Data Migration** - Transfer data in batches with progress tracking
5. **Index Creation** - Recreate indexes and constraints
6. **Sequence Migration** - Update sequence values
7. **Data Validation** - Verify data integrity and completeness
8. **Final Report** - Generate comprehensive migration summary

## 🔄 Resume and Recovery

The migration script supports automatic resumption in case of interruptions:

### Automatic State Saving
- Migration state is saved every 10 batches
- Complete state saved on shutdown or failure
- State files stored in `/tmp/migration_logs/`

### Manual Resume
```bash
# Resume from specific state file
python migrate_to_supabase.py --mode=migrate --resume /tmp/migration_logs/migration_state_123.json
```

### Recovery from Failures
1. Check the error logs in `/tmp/migration_logs/`
2. Fix any identified issues (connectivity, permissions, etc.)
3. Resume migration from saved state
4. The script will skip already migrated data

## 📈 Performance Optimization

### Batch Size Tuning
- **Small datasets (< 100K rows)**: `MIGRATION_BATCH_SIZE=500`
- **Medium datasets (100K - 1M rows)**: `MIGRATION_BATCH_SIZE=1000`
- **Large datasets (> 1M rows)**: `MIGRATION_BATCH_SIZE=2000`

### Parallel Workers
- **Small server**: `MIGRATION_PARALLEL_WORKERS=2`
- **Medium server**: `MIGRATION_PARALLEL_WORKERS=4`
- **Large server**: `MIGRATION_PARALLEL_WORKERS=8`

### Network Optimization
- Run migration from same region as databases
- Use high-bandwidth connection
- Consider database connection pooling settings

## 🛡️ Security Considerations

### Database Security
- Use dedicated migration user with minimal required permissions
- Enable SSL/TLS for all database connections
- Use environment variables for sensitive credentials
- Rotate passwords after migration completion

### Data Privacy
- Ensure compliance with data protection regulations
- Consider data anonymization for non-production migrations
- Implement audit logging for all operations
- Secure migration logs and state files

## 📋 Database Model Coverage

The migration script handles all Schlep Engine database models:

### Core Models
- ✅ Users (with enhanced security fields)
- ✅ Organizations
- ✅ Workspaces  
- ✅ API Keys
- ✅ User Sessions
- ✅ Password Reset Tokens
- ✅ Data Investigations
- ✅ Processing Jobs
- ✅ Integrations
- ✅ Audit Logs
- ✅ Webhook Endpoints
- ✅ Usage Metrics

### Security Models
- ✅ Encrypted Fields
- ✅ Audit Trail
- ✅ Data Classification Records
- ✅ Compliance Events
- ✅ Security Policies
- ✅ Security Policy Assignments
- ✅ Data Retention Schedules

### ML Preparation Models
- ✅ Data Preparation Pipelines
- ✅ Preparation Steps
- ✅ Data Quality Assessments
- ✅ Framework Outputs
- ✅ Auto Labeling Results

### Schema Features
- ✅ UUID primary keys
- ✅ JSON/JSONB columns
- ✅ Array columns
- ✅ Enum types
- ✅ Foreign key relationships
- ✅ Indexes and constraints
- ✅ Database sequences

## 🔍 Monitoring and Logging

### Log Files Location
```
/tmp/migration_logs/
├── migration_YYYYMMDD_HHMMSS.log          # Main migration log
├── migration_state_[ID].json              # Migration state
└── migration_report_YYYYMMDD_HHMMSS.html  # Final report
```

### Progress Monitoring
The script provides real-time progress updates:
- Overall migration progress percentage
- Per-table migration status and progress
- Row counts and processing rates
- Error details and resolution steps

### Progress Report Example
```
================================================================================
MIGRATION PROGRESS REPORT
================================================================================
Migration ID: 550e8400-e29b-41d4-a716-446655440000
Status: completed
Overall Progress: 100.0%
Started: 2025-07-29 10:00:00
Completed: 2025-07-29 10:45:32
Duration: 2732.15 seconds

TABLE STATUS:
--------------------------------------------------------------------------------
✅ public.users                    [████████████████████] 12500/12500   (100.0%)
✅ public.organizations            [████████████████████]   150/150     (100.0%)
✅ public.workspaces               [████████████████████]   340/340     (100.0%)
✅ public.data_investigations      [████████████████████]  5670/5670    (100.0%)
...
================================================================================
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Connection Timeouts
```bash
# Increase timeout settings
export MIGRATION_TIMEOUT_SECONDS=7200
export SOURCE_DB_POOL_SIZE=5
export TARGET_DB_POOL_SIZE=5
```

#### Memory Issues with Large Tables
```bash
# Reduce batch size and parallel workers
export MIGRATION_BATCH_SIZE=500
export MIGRATION_PARALLEL_WORKERS=2
```

#### Permission Errors
```sql
-- Grant additional permissions as needed
GRANT USAGE ON SCHEMA information_schema TO migration_user;
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO migration_user;
```

#### SSL Connection Issues
```bash
# Add SSL parameters to database URLs
AWS_DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
SUPABASE_DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### Validation Failures
If data validation fails:
1. Check the detailed error logs
2. Compare sample data between source and target
3. Verify data types and encoding
4. Re-run specific table migration if needed

### Recovery Procedures
1. **Partial Failure**: Resume from saved state
2. **Complete Failure**: Check logs, fix issues, restart
3. **Data Corruption**: Run rollback and restart migration
4. **Performance Issues**: Adjust batch size and worker count

## 📞 Support and Maintenance

### Pre-Migration Checklist
- [ ] Database credentials configured and tested
- [ ] Required permissions granted on both databases  
- [ ] Network connectivity verified
- [ ] Sufficient disk space for logs
- [ ] Backup of target database created
- [ ] Migration scheduled during low-traffic period

### Post-Migration Checklist
- [ ] Data validation completed successfully
- [ ] Application connectivity tested
- [ ] Performance benchmarks verified
- [ ] Backup of migrated database created
- [ ] Migration logs archived
- [ ] Source database credentials rotated
- [ ] Monitoring alerts configured

### Emergency Contacts
- Database Administrator: [Contact Info]
- DevOps Engineer: [Contact Info]  
- Application Team Lead: [Contact Info]

## 📚 Additional Resources

- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/migration.html)
- [AWS RDS Migration Guide](https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html)

---

*This migration script is designed specifically for the Schlep Engine application architecture and database schema. For questions or issues, please consult the development team.*