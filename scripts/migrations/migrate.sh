#!/bin/bash

# Migration script for Igris-engine Phase 13 persistence
# This script applies database migrations in order

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ] && [ -z "$POSTGRES_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL or POSTGRES_URL environment variable is not set${NC}"
    echo "Example: export DATABASE_URL='postgres://user:pass@localhost:5432/igris?sslmode=disable'"
    exit 1
fi

# Use DATABASE_URL if set, otherwise use POSTGRES_URL
DB_URL="${DATABASE_URL:-$POSTGRES_URL}"

echo -e "${GREEN}Igris-engine Database Migration Tool${NC}"
echo "========================================"
echo ""

# Function to run a migration file
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sql)

    echo -e "${YELLOW}Running migration: $migration_name${NC}"

    if psql "$DB_URL" -f "$migration_file"; then
        echo -e "${GREEN}✓ Migration $migration_name completed successfully${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ Migration $migration_name failed${NC}"
        return 1
    fi
}

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Test database connection
echo "Testing database connection..."
if ! psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Failed to connect to database${NC}"
    echo "Please check your DATABASE_URL and ensure PostgreSQL is running."
    exit 1
fi
echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Create migrations tracking table if it doesn't exist
echo "Setting up migrations tracking..."
psql "$DB_URL" <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
EOF
echo -e "${GREEN}✓ Migrations tracking ready${NC}"
echo ""

# Get list of applied migrations
applied_migrations=$(psql "$DB_URL" -t -c "SELECT migration_name FROM schema_migrations ORDER BY id;")

# Find and run pending migrations
echo "Checking for pending migrations..."
pending_count=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    # Skip if no migration files found
    [ -e "$migration_file" ] || continue

    migration_name=$(basename "$migration_file" .sql)

    # Check if migration has been applied
    if echo "$applied_migrations" | grep -q "$migration_name"; then
        echo -e "  - $migration_name ${GREEN}(already applied)${NC}"
    else
        echo -e "  - $migration_name ${YELLOW}(pending)${NC}"
        pending_count=$((pending_count + 1))
    fi
done

echo ""

if [ $pending_count -eq 0 ]; then
    echo -e "${GREEN}All migrations are up to date!${NC}"
    exit 0
fi

echo -e "${YELLOW}Found $pending_count pending migration(s)${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to apply these migrations? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Applying migrations..."
echo ""

# Apply each pending migration
migration_success=true

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    [ -e "$migration_file" ] || continue

    migration_name=$(basename "$migration_file" .sql)

    # Skip if already applied
    if echo "$applied_migrations" | grep -q "$migration_name"; then
        continue
    fi

    # Run the migration
    if run_migration "$migration_file"; then
        # Record successful migration
        psql "$DB_URL" -c "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name');"
    else
        migration_success=false
        echo -e "${RED}Migration failed. Stopping.${NC}"
        break
    fi
done

echo ""
if [ "$migration_success" = true ]; then
    echo -e "${GREEN}✓ All migrations completed successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ Migration process failed${NC}"
    exit 1
fi
