#!/bin/bash
#
# Schlep-Engine Database Restore Script
# Purpose: Restore PostgreSQL database from backup
# Usage: ./restore.sh <backup_file> [options]
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/data}"

# Database configuration
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-schlep_engine}"
DB_USER="${POSTGRES_USER:-schlep_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-changeme}"

# S3 configuration
S3_ENABLED="${S3_BACKUP_ENABLED:-false}"
S3_BUCKET="${S3_BUCKET:-schlep-engine-backups}"
S3_PREFIX="${S3_PREFIX:-backups/}"

# ============================================================================
# Functions
# ============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

usage() {
    cat <<EOF
Usage: $0 <backup_file> [options]

Restore Schlep-Engine database from backup file.

Arguments:
  <backup_file>    Path to backup file or S3 key
                   Examples:
                     - ./data/schlep_engine_backup_20251026_143000.sql.gz
                     - s3://bucket/backups/schlep_engine_backup_20251026_143000.sql.gz
                     - latest  (automatically finds latest backup)

Options:
  --list           List available backups
  --verify         Verify backup before restoring
  --no-confirm     Skip confirmation prompt
  --help           Show this help message

Environment Variables:
  POSTGRES_HOST    Database host (default: localhost)
  POSTGRES_PORT    Database port (default: 5432)
  POSTGRES_DB      Database name (default: schlep_engine)
  POSTGRES_USER    Database user (default: schlep_user)
  POSTGRES_PASSWORD Database password (default: changeme)

Examples:
  # Restore from local file
  $0 ./data/schlep_engine_backup_20251026_143000.sql.gz

  # Restore latest backup
  $0 latest

  # List available backups
  $0 --list

  # Restore from S3
  S3_BACKUP_ENABLED=true $0 schlep_engine_backup_20251026_143000.sql.gz

EOF
    exit 0
}

list_backups() {
    log "Available backups:"
    log "=========================================="

    # List local backups
    if [ -d "$BACKUP_DIR" ]; then
        log "Local backups ($BACKUP_DIR):"
        find "$BACKUP_DIR" -name "schlep_engine_backup_*.sql.gz" -type f | sort -r | while read -r backup; do
            local size=$(du -h "$backup" | cut -f1)
            local date=$(basename "$backup" | sed 's/schlep_engine_backup_\([0-9_]*\)\.sql\.gz/\1/')
            log "  - $(basename "$backup") ($size) - $date"
        done
    fi

    # List S3 backups
    if [ "$S3_ENABLED" = "true" ] && command -v aws >/dev/null 2>&1; then
        log ""
        log "S3 backups (s3://$S3_BUCKET/$S3_PREFIX):"
        aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX" | grep "schlep_engine_backup_" | while read -r line; do
            local file=$(echo "$line" | awk '{print $4}')
            local size=$(echo "$line" | awk '{print $3}')
            log "  - $file ($size)"
        done
    fi

    exit 0
}

find_latest_backup() {
    log "Finding latest backup..."

    local latest=$(find "$BACKUP_DIR" -name "schlep_engine_backup_*.sql.gz" -type f | sort -r | head -n1)

    if [ -z "$latest" ]; then
        error "No backups found in $BACKUP_DIR"
        return 1
    fi

    echo "$latest"
}

download_from_s3() {
    local s3_key="$1"
    local local_path="$BACKUP_DIR/$(basename "$s3_key")"

    log "Downloading from S3: s3://$S3_BUCKET/$S3_PREFIX$s3_key"

    if aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX$s3_key" "$local_path"; then
        log "Download successful: $local_path"
        echo "$local_path"
        return 0
    else
        error "S3 download failed"
        return 1
    fi
}

verify_backup() {
    local backup_file="$1"

    log "Verifying backup file..."

    # Check file exists
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi

    # Check file is not empty
    if [ ! -s "$backup_file" ]; then
        error "Backup file is empty: $backup_file"
        return 1
    fi

    # Test gzip integrity
    if ! gzip -t "$backup_file" 2>/dev/null; then
        error "Backup file is corrupted (gzip test failed)"
        return 1
    fi

    # Check if it contains SQL
    if ! zcat "$backup_file" | head -n 20 | grep -q "PostgreSQL database dump"; then
        error "Backup file doesn't appear to be a PostgreSQL dump"
        return 1
    fi

    local size=$(du -h "$backup_file" | cut -f1)
    log "Backup file verified successfully ($size)"
    return 0
}

confirm_restore() {
    local backup_file="$1"

    log "=========================================="
    log "WARNING: Database Restore Operation"
    log "=========================================="
    log "This will REPLACE the current database with the backup:"
    log "  Backup file: $(basename "$backup_file")"
    log "  Target database: $DB_NAME@$DB_HOST:$DB_PORT"
    log ""
    log "Current database will be DROPPED and recreated!"
    log "=========================================="

    read -p "Are you sure you want to continue? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

stop_dependent_services() {
    log "Stopping dependent services..."

    # Try to stop Docker Compose services
    if [ -f "$SCRIPT_DIR/../../docker-compose.production.yml" ]; then
        cd "$SCRIPT_DIR/../.."
        docker-compose -f docker-compose.production.yml stop api 2>/dev/null || true
        log "API service stopped"
    fi

    # Wait for connections to close
    log "Waiting for database connections to close..."
    sleep 5
}

restore_database() {
    local backup_file="$1"

    log "Starting database restore..."

    export PGPASSWORD="$DB_PASSWORD"

    # Drop existing database
    log "Dropping existing database..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
        -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>&1; then
        error "Failed to drop database"
        unset PGPASSWORD
        return 1
    fi

    # Create fresh database
    log "Creating fresh database..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE \"$DB_NAME\";" 2>&1; then
        error "Failed to create database"
        unset PGPASSWORD
        return 1
    fi

    # Restore from backup
    log "Restoring from backup..."
    if zcat "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --set ON_ERROR_STOP=on 2>&1; then
        unset PGPASSWORD
        log "Database restored successfully"
        return 0
    else
        unset PGPASSWORD
        error "Database restore failed"
        return 1
    fi
}

start_dependent_services() {
    log "Starting dependent services..."

    # Try to start Docker Compose services
    if [ -f "$SCRIPT_DIR/../../docker-compose.production.yml" ]; then
        cd "$SCRIPT_DIR/../.."
        docker-compose -f docker-compose.production.yml start api 2>/dev/null || true
        log "API service started"
    fi
}

verify_restore() {
    log "Verifying restored database..."

    export PGPASSWORD="$DB_PASSWORD"

    # Check database exists
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "SELECT version();" >/dev/null 2>&1; then
        unset PGPASSWORD
        error "Database verification failed: Cannot connect"
        return 1
    fi

    # Check table count
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')

    unset PGPASSWORD

    log "Verification successful: Database has $table_count tables"
    return 0
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    local backup_file=""
    local verify_only=false
    local no_confirm=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --list)
                list_backups
                ;;
            --verify)
                verify_only=true
                shift
                ;;
            --no-confirm)
                no_confirm=true
                shift
                ;;
            --help|-h)
                usage
                ;;
            *)
                if [ -z "$backup_file" ]; then
                    backup_file="$1"
                fi
                shift
                ;;
        esac
    done

    # Require backup file argument
    if [ -z "$backup_file" ]; then
        error "Missing backup file argument"
        usage
    fi

    log "=========================================="
    log "Schlep-Engine Database Restore"
    log "=========================================="

    # Handle "latest" keyword
    if [ "$backup_file" = "latest" ]; then
        backup_file=$(find_latest_backup)
        if [ -z "$backup_file" ]; then
            error "No backups found"
            exit 1
        fi
        log "Using latest backup: $(basename "$backup_file")"
    fi

    # Download from S3 if needed
    if [[ "$backup_file" == s3://* ]]; then
        local s3_key=$(echo "$backup_file" | sed 's|s3://[^/]*/||')
        backup_file=$(download_from_s3 "$s3_key")
    elif [[ "$backup_file" != /* ]] && [[ "$backup_file" != ./* ]]; then
        # Assume it's in backup directory
        if [ "$S3_ENABLED" = "true" ]; then
            backup_file=$(download_from_s3 "$backup_file")
        else
            backup_file="$BACKUP_DIR/$backup_file"
        fi
    fi

    # Verify backup
    if ! verify_backup "$backup_file"; then
        error "Backup verification failed"
        exit 1
    fi

    if [ "$verify_only" = true ]; then
        log "Verification complete (--verify mode)"
        exit 0
    fi

    # Confirm restore
    if [ "$no_confirm" != true ]; then
        confirm_restore "$backup_file"
    fi

    # Stop dependent services
    stop_dependent_services

    # Perform restore
    if ! restore_database "$backup_file"; then
        error "Restore failed!"
        start_dependent_services
        exit 1
    fi

    # Verify restore
    if ! verify_restore; then
        error "Restore verification failed"
        start_dependent_services
        exit 1
    fi

    # Start dependent services
    start_dependent_services

    log "=========================================="
    log "Restore Summary:"
    log "  Backup: $(basename "$backup_file")"
    log "  Database: $DB_NAME@$DB_HOST:$DB_PORT"
    log "  Status: SUCCESS"
    log "=========================================="

    exit 0
}

# Run main function
main "$@"
