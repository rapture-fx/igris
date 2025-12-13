#!/bin/bash
# Database backup script for Schlep Engine

set -e

# Configuration
BACKUP_DIR="/root/backups"
DB_CONTAINER="root-postgres-1"
DB_NAME="igris_overture"
DB_USER="postgres"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="igris_overture_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send notification (implement as needed)
notify() {
    local message="$1"
    log "$message"
    # Add notification logic here (email, Slack, etc.)
}

log "Starting database backup..."

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    log "ERROR: Database container $DB_CONTAINER is not running"
    notify "Database backup FAILED: Container not running"
    exit 1
fi

# Create database backup
log "Creating backup: $BACKUP_FILE"
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"; then
    log "Backup created successfully: $BACKUP_DIR/$BACKUP_FILE"
    
    # Compress the backup
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    log "Backup compressed: $BACKUP_DIR/$BACKUP_FILE.gz"
    
    # Get file size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)
    log "Backup size: $BACKUP_SIZE"
    
    notify "Database backup completed successfully. Size: $BACKUP_SIZE"
else
    log "ERROR: Database backup failed"
    notify "Database backup FAILED"
    exit 1
fi

# Clean up old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "igris_overture_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "igris_overture_backup_*.sql.gz" | wc -l)
log "Cleanup completed. Remaining backups: $REMAINING_BACKUPS"

# Verify backup integrity
log "Verifying backup integrity..."
if gunzip -t "$BACKUP_DIR/$BACKUP_FILE.gz" 2>/dev/null; then
    log "Backup integrity check: PASSED"
else
    log "ERROR: Backup integrity check FAILED"
    notify "Database backup FAILED: Corrupted backup file"
    exit 1
fi

log "Database backup process completed successfully"

# Optional: Upload to Vultr Object Storage
if [ -n "$VULTR_ACCESS_KEY" ] && [ -n "$VULTR_SECRET_KEY" ] && [ -n "$VULTR_BUCKET" ]; then
    log "Uploading backup to Vultr Object Storage..."
    
    # Install s3cmd if not present
    if ! command -v s3cmd &> /dev/null; then
        apt update && apt install -y s3cmd
    fi
    
    # Configure s3cmd for Vultr Object Storage
    cat > ~/.s3cfg << EOF
[default]
access_key = $VULTR_ACCESS_KEY
secret_key = $VULTR_SECRET_KEY
host_base = ewr1.vultrobjects.com
host_bucket = %(bucket)s.ewr1.vultrobjects.com
use_https = True
EOF
    
    # Upload backup
    if s3cmd put "$BACKUP_DIR/$BACKUP_FILE.gz" "s3://$VULTR_BUCKET/backups/"; then
        log "Backup uploaded to Vultr Object Storage successfully"
        
        # Clean up old backups in Vultr (keep last 30)
        s3cmd ls "s3://$VULTR_BUCKET/backups/" | sort | head -n -30 | awk '{print $4}' | while read file; do
            if [ -n "$file" ]; then
                s3cmd del "$file"
                log "Deleted old backup from Vultr: $file"
            fi
        done
    else
        log "ERROR: Failed to upload backup to Vultr Object Storage"
    fi
fi