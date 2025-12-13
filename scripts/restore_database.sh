#!/bin/bash
# Database restore script for Schlep Engine

set -e

# Configuration
BACKUP_DIR="/root/backups"
DB_CONTAINER="root-postgres-1"
DB_NAME="igris_overture"
DB_USER="postgres"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Usage function
usage() {
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 igris_overture_backup_20240814_120000.sql.gz"
    echo ""
    echo "Available backups:"
    find "$BACKUP_DIR" -name "igris_overture_backup_*.sql.gz" -printf "%f\n" | sort -r | head -10
    exit 1
}

# Check if backup file is provided
if [ $# -eq 0 ]; then
    usage
fi

BACKUP_FILE="$1"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

# Check if backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
    log "ERROR: Backup file not found: $BACKUP_PATH"
    usage
fi

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    log "ERROR: Database container $DB_CONTAINER is not running"
    exit 1
fi

log "WARNING: This will replace all data in the $DB_NAME database"
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    log "Restore cancelled by user"
    exit 1
fi

log "Starting database restore from: $BACKUP_FILE"

# Create a backup of current database before restore
CURRENT_BACKUP="igris_overture_pre_restore_$(date +%Y%m%d_%H%M%S).sql"
log "Creating backup of current database: $CURRENT_BACKUP"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$CURRENT_BACKUP"
gzip "$BACKUP_DIR/$CURRENT_BACKUP"
log "Current database backed up to: $BACKUP_DIR/$CURRENT_BACKUP.gz"

# Drop and recreate database
log "Dropping and recreating database..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
log "Restoring database from backup..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Compressed backup
    gunzip -c "$BACKUP_PATH" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME"
else
    # Uncompressed backup
    cat "$BACKUP_PATH" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME"
fi

log "Database restore completed successfully"

# Verify restore
log "Verifying restore..."
TABLE_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
log "Tables restored: $(echo $TABLE_COUNT | xargs)"

log "Database restore process completed successfully"