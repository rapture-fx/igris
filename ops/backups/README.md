# Schlep-Engine Database Backup & Restore

Automated PostgreSQL backup and restore scripts with S3 integration and notification support.

---

## Quick Start

### Backup Database

```bash
# Basic backup (saves to ./data/)
./backup.sh

# Backup with S3 upload
S3_BACKUP_ENABLED=true S3_BUCKET=my-backups ./backup.sh

# Custom retention (14 days instead of 7)
RETENTION_DAYS=14 ./backup.sh
```

### Restore Database

```bash
# Restore from latest backup
./restore.sh latest

# Restore from specific file
./restore.sh ./data/schlep_engine_backup_20251026_143000.sql.gz

# List available backups
./restore.sh --list

# Verify backup without restoring
./restore.sh --verify ./data/schlep_engine_backup_20251026_143000.sql.gz
```

---

## Features

✅ **Automated Backups**
- Timestamped backup files
- Compressed with gzip (~70% size reduction)
- Automatic cleanup of old backups
- Configurable retention period

✅ **S3 Integration**
- Optional upload to S3
- Automatic S3 lifecycle management
- Disaster recovery with offsite storage

✅ **Notifications**
- Slack webhook integration
- Email alerts (via `mail` command)
- Success and failure notifications

✅ **Safety Features**
- Backup verification before restore
- Confirmation prompt for destructive operations
- Automatic service stop/start during restore
- Connection termination before drop/create

✅ **Metadata Tracking**
- JSON metadata for each backup
- SHA-256 checksums
- Size and timestamp information

---

## Scheduling

### Cron Job (Daily at 2 AM)

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/schlep-engine/ops/backups/backup.sh >> /var/log/schlep-backup.log 2>&1
```

### Docker Cron Container

```yaml
# docker-compose.production.yml
services:
  backup-cron:
    image: alpine:latest
    command: |
      sh -c "
        apk add --no-cache postgresql-client gzip aws-cli &&
        echo '0 2 * * * /opt/schlep-engine/ops/backups/backup.sh' | crontab - &&
        crond -f
      "
    volumes:
      - ./ops/backups:/opt/schlep-engine/ops/backups
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DB=schlep_engine
      - POSTGRES_USER=schlep_user
      - POSTGRES_PASSWORD=changeme
    networks:
      - schlep-network
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `./data` | Local backup directory |
| `RETENTION_DAYS` | `7` | Days to keep backups |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | `schlep_engine` | Database name |
| `POSTGRES_USER` | `schlep_user` | Database user |
| `POSTGRES_PASSWORD` | `changeme` | Database password |
| `S3_BACKUP_ENABLED` | `false` | Enable S3 upload |
| `S3_BUCKET` | `schlep-engine-backups` | S3 bucket name |
| `S3_PREFIX` | `backups/` | S3 key prefix |
| `SLACK_WEBHOOK_URL` | `` | Slack webhook for notifications |
| `BACKUP_EMAIL` | `` | Email for notifications |

### S3 Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::schlep-engine-backups/*",
        "arn:aws:s3:::schlep-engine-backups"
      ]
    }
  ]
}
```

---

## Backup Strategy

### Local Backups
- **Location**: `./ops/backups/data/`
- **Format**: `schlep_engine_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Retention**: 7 days (configurable)
- **Cleanup**: Automatic daily cleanup

### S3 Backups (Optional)
- **Location**: `s3://BUCKET/PREFIX/schlep_engine_backup_*.sql.gz`
- **Storage Class**: STANDARD_IA (Infrequent Access)
- **Retention**: 7 days in S3, then lifecycle to Glacier
- **Cost**: ~$0.01/GB/month (STANDARD_IA)

---

## Recovery Scenarios

### Scenario 1: Accidental Data Loss (Today)

```bash
# Restore from latest backup
./restore.sh latest
```

**RTO**: <5 minutes
**RPO**: <24 hours (depending on backup schedule)

### Scenario 2: Corruption (Specific Date)

```bash
# List backups
./restore.sh --list

# Restore specific backup
./restore.sh ./data/schlep_engine_backup_20251025_020000.sql.gz
```

**RTO**: <10 minutes
**RPO**: Point-in-time to last backup

### Scenario 3: Complete Infrastructure Loss

```bash
# Download from S3
S3_BACKUP_ENABLED=true ./restore.sh schlep_engine_backup_20251026_020000.sql.gz

# Or manually
aws s3 cp s3://schlep-engine-backups/backups/schlep_engine_backup_20251026_020000.sql.gz ./data/
./restore.sh ./data/schlep_engine_backup_20251026_020000.sql.gz
```

**RTO**: <15 minutes (including S3 download)
**RPO**: <24 hours

---

## Testing Backup/Restore

### Test 1: Basic Backup

```bash
# Create backup
./backup.sh

# Verify backup exists
ls -lh ./data/schlep_engine_backup_*.sql.gz

# Check backup content
zcat ./data/schlep_engine_backup_*.sql.gz | head -n 20
```

**Expected**: File ~1-10MB, contains "PostgreSQL database dump"

### Test 2: Restore (Non-Destructive Dry Run)

```bash
# Verify backup without restoring
./restore.sh --verify latest
```

**Expected**: "Backup file verified successfully"

### Test 3: Full Restore (Test Environment Only!)

```bash
# Restore latest backup
./restore.sh --no-confirm latest
```

**Expected**: Database restored, all tables present

### Test 4: S3 Upload/Download

```bash
# Backup with S3 upload
S3_BACKUP_ENABLED=true S3_BUCKET=test-bucket ./backup.sh

# Verify S3 upload
aws s3 ls s3://test-bucket/backups/

# Download and restore
S3_BACKUP_ENABLED=true ./restore.sh schlep_engine_backup_20251026_143000.sql.gz
```

**Expected**: S3 upload/download successful

---

## Monitoring

### Check Backup Status

```bash
# View backup logs
tail -f /var/log/schlep-backup.log

# Check last backup
ls -lht ./data/ | head -n 5

# Verify backup integrity
./restore.sh --verify latest
```

### Alert Rules

1. **No backup in 25 hours** → CRITICAL
2. **Backup failed** → CRITICAL
3. **S3 upload failed** → WARNING
4. **Backup size anomaly (>2x or <0.5x)** → WARNING
5. **Disk usage >80%** → WARNING

---

## Troubleshooting

### Issue: pg_dump command not found

```bash
# Ubuntu/Debian
apt-get install postgresql-client

# RHEL/CentOS
yum install postgresql

# macOS
brew install postgresql
```

### Issue: S3 upload fails

```bash
# Check AWS credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://schlep-engine-backups/

# Check IAM permissions
aws iam get-user-policy --user-name backup-user --policy-name BackupPolicy
```

### Issue: Restore fails with "database is being accessed"

```bash
# Terminate active connections
psql -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='schlep_engine';"

# Then retry restore
./restore.sh latest
```

### Issue: Backup file corrupted

```bash
# Test gzip integrity
gzip -t ./data/schlep_engine_backup_*.sql.gz

# If corrupted, use previous backup
./restore.sh --list
./restore.sh ./data/schlep_engine_backup_PREVIOUS_DATE.sql.gz
```

---

## Best Practices

1. ✅ **Test restores monthly** (in non-prod environment)
2. ✅ **Enable S3 uploads** (offsite disaster recovery)
3. ✅ **Monitor backup success** (alerts for failures)
4. ✅ **Keep 7+ days of backups** (rolling window)
5. ✅ **Document RTO/RPO targets** (business requirements)
6. ✅ **Encrypt S3 backups** (use S3 encryption at rest)
7. ✅ **Rotate backup credentials** (90-day rotation)
8. ✅ **Version control backup scripts** (Git)

---

## Compliance & Security

### Data Protection
- Backups compressed with gzip
- S3 encryption at rest (AES-256)
- IAM role-based access control
- Backup retention per policy (7 days minimum)

### Audit Trail
- Backup metadata in JSON format
- SHA-256 checksums for integrity
- S3 access logging enabled
- Notification logs (Slack/Email)

### Disaster Recovery
- **RTO Target**: <15 minutes
- **RPO Target**: <24 hours
- **Backup Frequency**: Daily
- **Offsite Storage**: AWS S3 (multiple AZs)

---

## Maintenance

### Weekly Tasks
- [ ] Verify latest backup integrity
- [ ] Check disk usage in backup directory
- [ ] Review backup logs for errors

### Monthly Tasks
- [ ] Test restore procedure in non-prod
- [ ] Review retention policy
- [ ] Audit S3 backup costs
- [ ] Update backup scripts if needed

### Quarterly Tasks
- [ ] Full disaster recovery drill
- [ ] Review RTO/RPO requirements
- [ ] Update runbooks
- [ ] Rotate backup credentials

---

## Support

For issues or questions:
- **Documentation**: `/docs_int/reports/phase4_task_4.5.1_database_backups_complete.md`
- **Logs**: `/var/log/schlep-backup.log`
- **Monitoring**: Grafana dashboard "Database Backups"

---

**Last Updated**: 2025-10-26
**Version**: 1.0
**Tested With**: PostgreSQL 15, AWS S3
