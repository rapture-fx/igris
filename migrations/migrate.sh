#!/bin/bash
# Igris Database Migration Runner
# Usage: ./migrate.sh [up|down|status] [version]

set -e

# Configuration
MIGRATIONS_DIR="$(dirname "$0")"
DATABASE_URL="${DATABASE_URL:-postgresql://localhost:5432/igris}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse database URL
parse_db_url() {
    # Extract components from DATABASE_URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    elif [[ $DATABASE_URL =~ postgresql://([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS=""
        DB_HOST="${BASH_REMATCH[2]}"
        DB_PORT="${BASH_REMATCH[3]}"
        DB_NAME="${BASH_REMATCH[4]}"
    else
        echo -e "${RED}Error: Invalid DATABASE_URL format${NC}"
        exit 1
    fi
}

# Create migration tracking table if it doesn't exist
init_migrations_table() {
    psql "$DATABASE_URL" -q <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true,
    duration_ms INTEGER
);
EOF
}

# Get list of applied migrations
get_applied_migrations() {
    psql "$DATABASE_URL" -t -A -c "SELECT version FROM schema_migrations WHERE success = true ORDER BY version"
}

# Get list of pending migrations
get_pending_migrations() {
    local applied=$(get_applied_migrations)
    local all_migrations=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | xargs -n1 basename | sort)

    for migration in $all_migrations; do
        version=$(echo "$migration" | sed 's/\.sql$//')
        if ! echo "$applied" | grep -q "^${version}$"; then
            echo "$migration"
        fi
    done
}

# Apply a single migration
apply_migration() {
    local migration_file="$1"
    local version=$(basename "$migration_file" .sql)
    local start_time=$(date +%s%3N)

    echo -e "${YELLOW}Applying migration: $version${NC}"

    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration_file" > /dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))

        psql "$DATABASE_URL" -q -c "INSERT INTO schema_migrations (version, duration_ms) VALUES ('$version', $duration) ON CONFLICT (version) DO UPDATE SET applied_at = CURRENT_TIMESTAMP, success = true, duration_ms = $duration"

        echo -e "${GREEN}✓ Applied $version (${duration}ms)${NC}"
        return 0
    else
        psql "$DATABASE_URL" -q -c "INSERT INTO schema_migrations (version, success) VALUES ('$version', false) ON CONFLICT (version) DO UPDATE SET applied_at = CURRENT_TIMESTAMP, success = false"

        echo -e "${RED}✗ Failed to apply $version${NC}"
        return 1
    fi
}

# Rollback a migration (if down file exists)
rollback_migration() {
    local version="$1"
    local down_file="$MIGRATIONS_DIR/${version}.down.sql"

    if [ -f "$down_file" ]; then
        echo -e "${YELLOW}Rolling back: $version${NC}"

        if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$down_file" > /dev/null 2>&1; then
            psql "$DATABASE_URL" -q -c "DELETE FROM schema_migrations WHERE version = '$version'"
            echo -e "${GREEN}✓ Rolled back $version${NC}"
            return 0
        else
            echo -e "${RED}✗ Failed to rollback $version${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}No down migration found for $version${NC}"
        return 1
    fi
}

# Show migration status
show_status() {
    echo -e "${GREEN}=== Migration Status ===${NC}"
    echo ""

    echo "Applied migrations:"
    psql "$DATABASE_URL" -c "SELECT version, applied_at, duration_ms || 'ms' as duration FROM schema_migrations WHERE success = true ORDER BY version"

    echo ""
    echo "Pending migrations:"
    local pending=$(get_pending_migrations)
    if [ -z "$pending" ]; then
        echo "  (none)"
    else
        for m in $pending; do
            echo "  - $m"
        done
    fi
}

# Main command handler
main() {
    local command="${1:-status}"
    local version="$2"

    # Initialize
    init_migrations_table

    case "$command" in
        up)
            if [ -n "$version" ]; then
                # Apply specific migration
                local migration_file="$MIGRATIONS_DIR/${version}.sql"
                if [ -f "$migration_file" ]; then
                    apply_migration "$migration_file"
                else
                    echo -e "${RED}Migration not found: $version${NC}"
                    exit 1
                fi
            else
                # Apply all pending migrations
                local pending=$(get_pending_migrations)
                if [ -z "$pending" ]; then
                    echo -e "${GREEN}All migrations are up to date${NC}"
                else
                    for migration in $pending; do
                        apply_migration "$MIGRATIONS_DIR/$migration"
                    done
                fi
            fi
            ;;
        down)
            if [ -n "$version" ]; then
                rollback_migration "$version"
            else
                # Rollback last migration
                local last=$(psql "$DATABASE_URL" -t -A -c "SELECT version FROM schema_migrations WHERE success = true ORDER BY version DESC LIMIT 1")
                if [ -n "$last" ]; then
                    rollback_migration "$last"
                else
                    echo -e "${YELLOW}No migrations to rollback${NC}"
                fi
            fi
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 [up|down|status] [version]"
            echo ""
            echo "Commands:"
            echo "  up [version]    Apply pending migrations (or specific version)"
            echo "  down [version]  Rollback last migration (or specific version)"
            echo "  status          Show migration status"
            exit 1
            ;;
    esac
}

# Run
main "$@"
