#!/bin/bash
#
# Igris Inertial Database Backup Script
# Purpose: Create timestamped PostgreSQL backups with optional S3 upload
# Usage: ./backup.sh [options]
# Schedule: Run daily via cron: 0 2 * * * /opt/igris-inertial/ops/backups/backup.sh
#

set -euo pipefail  # Exit on error, undefined variable, or pipe failure

# ============================================================================
# Configuration
# ============================================================================

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/data}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="igris_overture_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Database configuration (from environment or docker-compose)
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-igris_overture}"
DB_USER="${POSTGRES_USER:-igris_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-changeme}"

# S3 configuration (optional)
S3_ENABLED="${S3_BACKUP_ENABLED:-false}"
S3_BUCKET="${S3_BUCKET:-igris-inertial-backups}"
S3_PREFIX="${S3_PREFIX:-backups/}"

# Notification configuration (optional)
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
EMAIL_TO="${BACKUP_EMAIL:-}"

# ============================================================================
# Functions
# ============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

notify_success() {
    local message="$1"
    local size="$2"

    log "$message"

    # Slack notification
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"✅ Igris Inertial Backup Success\\n$message\\nSize: $size\"}" \
            2>/dev/null || true
    fi

    # Email notification
    if [ -n "$EMAIL_TO" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "✅ Igris Inertial Backup Success" "$EMAIL_TO"
    fi
}

notify_failure() {
    local message="$1"

    error "$message"

    # Slack notification
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"❌ Igris Inertial Backup Failed\\n$message\"}" \
            2>/dev/null || true
    fi

    # Email notification
    if [ -n "$EMAIL_TO" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "❌ Igris Inertial Backup Failed" "$EMAIL_TO"
    fi
}

check_dependencies() {
    local missing=()

    # Check required commands
    command -v pg_dump >/dev/null 2>&1 || missing+=("postgresql-client")
    command -v gzip >/dev/null 2>&1 || missing+=("gzip")

    # Check optional S3 command
    if [ "$S3_ENABLED" = "true" ]; then
        command -v aws >/dev/null 2>&1 || missing+=("awscli")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing dependencies: ${missing[*]}"
        error "Install with: apt-get install ${missing[*]}"
        return 1
    fi

    return 0
}

create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

backup_database() {
    log "Starting backup of database '$DB_NAME'..."

    # Set password for pg_dump
    export PGPASSWORD="$DB_PASSWORD"

    # Create backup with pg_dump
    if pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --no-owner \
        --no-acl \
        --verbose \
        2>&1 | gzip > "$BACKUP_PATH"; then

        unset PGPASSWORD

        # Verify backup file exists and has content
        if [ ! -s "$BACKUP_PATH" ]; then
            error "Backup file is empty!"
            return 1
        fi

        local size=$(du -h "$BACKUP_PATH" | cut -f1)
        log "Backup created successfully: $BACKUP_NAME ($size)"
        return 0
    else
        unset PGPASSWORD
        error "pg_dump failed!"
        return 1
    fi
}

upload_to_s3() {
    if [ "$S3_ENABLED" != "true" ]; then
        log "S3 upload disabled, skipping..."
        return 0
    fi

    log "Uploading backup to S3: s3://$S3_BUCKET/$S3_PREFIX$BACKUP_NAME"

    if aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/$S3_PREFIX$BACKUP_NAME" \
        --storage-class STANDARD_IA \
        --metadata "timestamp=$TIMESTAMP,db=$DB_NAME"; then
        log "S3 upload successful"
        return 0
    else
        error "S3 upload failed!"
        return 1
    fi
}

cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    # Local cleanup
    local deleted_count=0
    while IFS= read -r -d '' backup; do
        rm -f "$backup"
        ((deleted_count++))
        log "Deleted old backup: $(basename "$backup")"
    done < <(find "$BACKUP_DIR" -name "igris_overture_backup_*.sql.gz" -mtime +$RETENTION_DAYS -print0)

    log "Deleted $deleted_count old local backups"

    # S3 cleanup (if enabled)
    if [ "$S3_ENABLED" = "true" ]; then
        log "Cleaning up old S3 backups..."
        local cutoff_date=$(date -u -d "$RETENTION_DAYS days ago" +%Y%m%d 2>/dev/null || \
                           date -u -v-${RETENTION_DAYS}d +%Y%m%d)

        aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX" | while read -r line; do
            local file=$(echo "$line" | awk '{print $4}')
            if [[ $file =~ igris_overture_backup_([0-9]{8})_ ]]; then
                local backup_date="${BASH_REMATCH[1]}"
                if [ "$backup_date" -lt "$cutoff_date" ]; then
                    aws s3 rm "s3://$S3_BUCKET/$S3_PREFIX$file"
                    log "Deleted old S3 backup: $file"
                fi
            fi
        done
    fi
}

create_backup_metadata() {
    local metadata_file="$BACKUP_DIR/${BACKUP_NAME}.meta.json"

    cat > "$metadata_file" <<EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "database": "$DB_NAME",
  "host": "$DB_HOST",
  "port": $DB_PORT,
  "size_bytes": $(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH"),
  "checksum": "$(sha256sum "$BACKUP_PATH" | awk '{print $1}')",
  "retention_days": $RETENTION_DAYS,
  "s3_uploaded": $S3_ENABLED
}
EOF

    log "Metadata saved: $metadata_file"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log "=========================================="
    log "Igris Inertial Database Backup"
    log "=========================================="
    log "Database: $DB_NAME@$DB_HOST:$DB_PORT"
    log "Backup dir: $BACKUP_DIR"
    log "Retention: $RETENTION_DAYS days"
    log "S3 enabled: $S3_ENABLED"
    log "=========================================="

    # Pre-flight checks
    if ! check_dependencies; then
        notify_failure "Backup failed: Missing dependencies"
        exit 1
    fi

    create_backup_dir

    # Perform backup
    if ! backup_database; then
        notify_failure "Backup failed: pg_dump error"
        exit 1
    fi

    # Create metadata
    create_backup_metadata

    # Upload to S3 (optional)
    local s3_status="skipped"
    if [ "$S3_ENABLED" = "true" ]; then
        if upload_to_s3; then
            s3_status="success"
        else
            s3_status="failed"
            # Don't exit - local backup still succeeded
        fi
    fi

    # Cleanup old backups
    cleanup_old_backups

    # Success notification
    local size=$(du -h "$BACKUP_PATH" | cut -f1)
    notify_success "Database backup completed successfully" "$size"

    log "=========================================="
    log "Backup Summary:"
    log "  File: $BACKUP_NAME"
    log "  Size: $size"
    log "  Path: $BACKUP_PATH"
    log "  S3: $s3_status"
    log "=========================================="

    exit 0
}

# Run main function
main "$@"
