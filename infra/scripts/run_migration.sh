#!/bin/bash

# Database Migration Orchestration Script
# =======================================
# This script provides a user-friendly interface for the Supabase migration process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Logging
LOG_DIR="/tmp/migration_logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/migration_orchestrator_$(date +%Y%m%d_%H%M%S).log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Print colored output
print_status() {
    echo -e "${2}${1}${NC}"
    log "$1"
}

print_header() {
    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}\n"
}

print_success() {
    print_status "✅ $1" "$GREEN"
}

print_error() {
    print_status "❌ $1" "$RED"
}

print_warning() {
    print_status "⚠️  $1" "$YELLOW"
}

print_info() {
    print_status "ℹ️  $1" "$BLUE"
}

# Check if Python is available
check_python() {
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed or not in PATH"
        exit 1
    fi
    
    local python_version=$(python3 --version | cut -d' ' -f2)
    print_success "Python $python_version detected"
}

# Check if required files exist
check_files() {
    local files=(
        "$SCRIPT_DIR/migrate_to_supabase.py"
        "$SCRIPT_DIR/validate_migration_setup.py"
        "$SCRIPT_DIR/requirements-migration.txt"
    )
    
    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
    
    print_success "All required files found"
}

# Install Python dependencies
install_dependencies() {
    print_info "Installing Python dependencies..."
    
    if python3 -m pip install -r "$SCRIPT_DIR/requirements-migration.txt" >> "$LOG_FILE" 2>&1; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies. Check $LOG_FILE for details."
        exit 1
    fi
}

# Load environment configuration
load_config() {
    local config_file="$SCRIPT_DIR/migration_config.env"
    
    if [[ -f "$config_file" ]]; then
        print_info "Loading configuration from $config_file"
        # shellcheck source=/dev/null
        source "$config_file"
        print_success "Configuration loaded"
    else
        print_warning "Configuration file not found: $config_file"
        print_info "Please copy migration_config.example.env to migration_config.env and configure it"
        
        if [[ -f "$SCRIPT_DIR/migration_config.example.env" ]]; then
            read -p "Would you like to copy the example config now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$SCRIPT_DIR/migration_config.example.env" "$config_file"
                print_success "Example configuration copied to $config_file"
                print_warning "Please edit $config_file with your database credentials before proceeding"
                exit 0
            fi
        fi
        exit 1
    fi
}

# Validate environment variables
validate_env() {
    local required_vars=("AWS_DATABASE_URL" "SUPABASE_DATABASE_URL")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    print_success "Environment variables validated"
}

# Run validation
run_validation() {
    print_header "RUNNING MIGRATION VALIDATION"
    
    if python3 "$SCRIPT_DIR/validate_migration_setup.py" 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Validation completed successfully"
        return 0
    else
        print_error "Validation failed"
        return 1
    fi
}

# Run migration
run_migration() {
    print_header "RUNNING DATABASE MIGRATION"
    
    print_warning "This will start the actual migration process"
    print_warning "Make sure you have:"
    echo "  • Backed up your target database"
    echo "  • Verified all configuration settings"
    echo "  • Scheduled this during low-traffic period"
    echo
    
    read -p "Are you sure you want to proceed? (yes/no): " -r
    if [[ ! $REPLY == "yes" ]]; then
        print_info "Migration cancelled by user"
        exit 0
    fi
    
    print_info "Starting migration..."
    
    if python3 "$SCRIPT_DIR/migrate_to_supabase.py" --mode=migrate 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Migration completed successfully!"
        
        print_header "NEXT STEPS"
        echo "1. Verify your application connectivity to Supabase"
        echo "2. Run performance tests"
        echo "3. Update your application configuration"
        echo "4. Monitor for any issues"
        echo "5. Consider running: $0 verify"
        
    else
        print_error "Migration failed. Check logs for details."
        print_info "You can resume the migration using the saved state files"
        return 1
    fi
}

# Verify migration
verify_migration() {
    print_header "VERIFYING MIGRATION"
    
    if python3 "$SCRIPT_DIR/migrate_to_supabase.py" --mode=verify 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Migration verification completed successfully"
    else
        print_error "Migration verification failed"
        return 1
    fi
}

# Rollback migration
rollback_migration() {
    print_header "ROLLING BACK MIGRATION"
    
    print_error "WARNING: This will delete all data in the target database!"
    print_warning "This action cannot be undone!"
    echo
    
    read -p "Type 'ROLLBACK' in all caps to confirm: " -r
    if [[ ! $REPLY == "ROLLBACK" ]]; then
        print_info "Rollback cancelled"
        exit 0
    fi
    
    if python3 "$SCRIPT_DIR/migrate_to_supabase.py" --mode=rollback 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Migration rollback completed"
    else
        print_error "Migration rollback failed"
        return 1
    fi
}

# Show help
show_help() {
    echo -e "${CYAN}Database Migration Orchestration Script${NC}"
    echo -e "${CYAN}=======================================${NC}"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  setup      - Install dependencies and setup configuration"
    echo "  validate   - Validate migration setup and connections"
    echo "  migrate    - Run the full migration process"
    echo "  verify     - Verify migration integrity"
    echo "  rollback   - Rollback migration (WARNING: destructive)"
    echo "  help       - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 setup      # First-time setup"
    echo "  $0 validate   # Test everything before migration"
    echo "  $0 migrate    # Run the migration"
    echo "  $0 verify     # Verify after migration"
    echo
    echo "Environment Variables:"
    echo "  AWS_DATABASE_URL      - Source AWS RDS database URL"
    echo "  SUPABASE_DATABASE_URL - Target Supabase database URL"
    echo "  MIGRATION_BATCH_SIZE  - Batch size for data transfer"
    echo "  MIGRATION_LOG_LEVEL   - Logging level (DEBUG, INFO, WARNING, ERROR)"
    echo
    echo "Logs are stored in: $LOG_DIR"
}

# Main function
main() {
    local command="${1:-help}"
    
    print_header "SUPABASE MIGRATION ORCHESTRATOR"
    print_info "Log file: $LOG_FILE"
    
    case "$command" in
        "setup")
            check_python
            check_files
            install_dependencies
            load_config
            print_success "Setup completed. Run '$0 validate' next."
            ;;
        "validate")
            check_python
            check_files
            load_config
            validate_env
            run_validation
            ;;
        "migrate")
            check_python
            check_files
            load_config
            validate_env
            run_migration
            ;;
        "verify")
            check_python
            check_files
            load_config
            validate_env
            verify_migration
            ;;
        "rollback")
            check_python
            check_files
            load_config
            validate_env
            rollback_migration
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"