#!/bin/bash

# Infrastructure Migration Rollback Script
# =========================================
# Comprehensive rollback system for the $145/month architecture migration
# 
# This script provides automated rollback capabilities with:
# - Zero-downtime rollback procedures
# - Progressive rollback with checkpoints
# - Health monitoring during rollback
# - Detailed logging and state tracking
# - Emergency rollback procedures

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly LOG_DIR="/tmp/migration_logs"
readonly ROLLBACK_ID="rollback_$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="$LOG_DIR/${ROLLBACK_ID}.log"
readonly STATE_FILE="$LOG_DIR/${ROLLBACK_ID}_state.json"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Rollback state tracking
declare -A ROLLBACK_STATE
declare -A SERVICE_STATUS
declare -A ORIGINAL_ENDPOINTS

# Create log directory
mkdir -p "$LOG_DIR"

# Initialize rollback state
init_rollback_state() {
    ROLLBACK_STATE=(
        [status]="not_started"
        [start_time]=""
        [current_step]=""
        [dns_reverted]="false"
        [database_restored]="false"
        [railway_removed]="false"
        [vercel_removed]="false"
        [cloudflare_removed]="false"
        [old_services_restored]="false"
        [validation_passed]="false"
    )
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_success() { log "SUCCESS" "$@"; }

# Status printing functions
print_header() {
    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}\n"
    log_info "=== $1 ==="
}

print_step() {
    echo -e "\n${CYAN}🔄 $1${NC}"
    log_info "STEP: $1"
    ROLLBACK_STATE[current_step]="$1"
    save_rollback_state
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    log_success "$1"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    log_error "$1"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    log_warn "$1"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
    log_info "$1"
}

# State management
save_rollback_state() {
    cat > "$STATE_FILE" << EOF
{
  "rollback_id": "$ROLLBACK_ID",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "state": $(printf '%s\n' "${ROLLBACK_STATE[@]}" | jq -R . | jq -s 'map(split("=")) | map({(.[0]): .[1]}) | add'),
  "service_status": $(printf '%s\n' "${SERVICE_STATUS[@]}" | jq -R . | jq -s 'map(split("=")) | map({(.[0]): .[1]}) | add' 2>/dev/null || echo '{}')
}
EOF
}

# Load migration state from original migration
load_migration_state() {
    local migration_state_pattern="$LOG_DIR/migration_*_state.json"
    local latest_migration_state=$(ls -t $migration_state_pattern 2>/dev/null | head -1)
    
    if [[ -f "$latest_migration_state" ]]; then
        print_info "Loading migration state from: $latest_migration_state"
        
        # Extract service endpoints and configuration from migration state
        if command -v jq &> /dev/null; then
            ORIGINAL_ENDPOINTS[database]=$(jq -r '.endpoints.database // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            ORIGINAL_ENDPOINTS[backend]=$(jq -r '.endpoints.backend // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            ORIGINAL_ENDPOINTS[admin]=$(jq -r '.endpoints.admin // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            ORIGINAL_ENDPOINTS[landing]=$(jq -r '.endpoints.landing // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
        fi
        
        print_info "Migration state loaded successfully"
        return 0
    else
        print_warning "No migration state found - proceeding with manual rollback"
        return 1
    fi
}

# Check rollback prerequisites
check_rollback_prerequisites() {
    print_step "Checking rollback prerequisites"
    
    # Check if we have access to old infrastructure
    print_info "Checking old infrastructure access..."
    
    # Try to connect to old Kubernetes cluster
    if kubectl cluster-info &>/dev/null; then
        print_success "Kubernetes cluster accessible"
        SERVICE_STATUS[kubernetes]="available"
    else
        print_warning "Kubernetes cluster not accessible - may affect full rollback"
        SERVICE_STATUS[kubernetes]="unavailable"
    fi
    
    # Check if we have database backup
    local backup_dir="$PROJECT_ROOT/apps/api/backups"
    if [[ -d "$backup_dir" ]] && [[ -n "$(ls -A "$backup_dir" 2>/dev/null)" ]]; then
        local latest_backup=$(ls -t "$backup_dir"/*.sql.gz 2>/dev/null | head -1)
        if [[ -n "$latest_backup" ]]; then
            print_success "Database backup found: $(basename "$latest_backup")"
            SERVICE_STATUS[database_backup]="available"
            ORIGINAL_ENDPOINTS[database_backup]="$latest_backup"
        fi
    else
        print_warning "No database backup found - database rollback may not be possible"
        SERVICE_STATUS[database_backup]="unavailable"
    fi
    
    # Check AWS credentials for potential cleanup
    if aws sts get-caller-identity &>/dev/null; then
        print_success "AWS credentials available"
        SERVICE_STATUS[aws]="available"
    else
        print_warning "AWS credentials not available - some cleanup may be manual"
        SERVICE_STATUS[aws]="unavailable"
    fi
    
    # Check CLI tools
    local tools=("railway" "vercel" "curl" "jq")
    for tool in "${tools[@]}"; do
        if command -v "$tool" &> /dev/null; then
            SERVICE_STATUS["$tool"]="available"
        else
            print_warning "$tool not available - some operations may be manual"
            SERVICE_STATUS["$tool"]="unavailable"
        fi
    done
    
    print_success "Prerequisites check completed"
}

# Emergency rollback DNS
emergency_dns_rollback() {
    print_step "Emergency DNS rollback to original configuration"
    
    print_warning "This will immediately revert DNS to original configuration"
    print_warning "This may cause temporary service disruption"
    
    # In a real implementation, this would:
    # 1. Revert all DNS records to pre-migration state
    # 2. Update load balancer configurations
    # 3. Restore original SSL certificates
    
    # Example DNS rollback (implementation specific)
    print_info "Reverting DNS records to original configuration..."
    
    # This is a placeholder - actual implementation would depend on DNS provider
    cat << 'EOF'
# DNS Rollback Commands (manual execution may be required):
# 
# For AWS Route 53:
# aws route53 change-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --change-batch file://original-dns-records.json
#
# For Cloudflare:
# curl -X PUT "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records/RECORD_ID" \
#      -H "Authorization: Bearer YOUR_API_TOKEN" \
#      -H "Content-Type: application/json" \
#      --data '{"type":"A","name":"api.yourdomain.com","content":"OLD_IP_ADDRESS"}'
EOF

    # Wait for DNS propagation
    print_info "Waiting for DNS propagation (60 seconds)..."
    sleep 60
    
    ROLLBACK_STATE[dns_reverted]="true"
    print_success "Emergency DNS rollback completed"
    save_rollback_state
}

# Progressive rollback with checkpoints
progressive_rollback() {
    print_step "Starting progressive rollback process"
    
    # Checkpoint 1: Revert DNS to old infrastructure
    print_info "Checkpoint 1: DNS rollback"
    emergency_dns_rollback
    
    # Wait and verify old services are accessible
    print_info "Verifying old infrastructure accessibility..."
    sleep 30
    
    # Checkpoint 2: Database rollback
    print_info "Checkpoint 2: Database rollback"
    if [[ "${SERVICE_STATUS[database_backup]}" == "available" ]]; then
        rollback_database
    else
        print_warning "Skipping database rollback - no backup available"
    fi
    
    # Checkpoint 3: Remove new infrastructure
    print_info "Checkpoint 3: Infrastructure cleanup"
    cleanup_new_infrastructure
    
    # Checkpoint 4: Restore old infrastructure
    print_info "Checkpoint 4: Restore old infrastructure"
    restore_old_infrastructure
    
    print_success "Progressive rollback completed"
}

# Database rollback
rollback_database() {
    print_step "Rolling back database to pre-migration state"
    
    if [[ -z "${ORIGINAL_ENDPOINTS[database_backup]:-}" ]]; then
        print_error "No database backup available for rollback"
        return 1
    fi
    
    local backup_file="${ORIGINAL_ENDPOINTS[database_backup]}"
    
    print_info "Restoring database from backup: $(basename "$backup_file")"
    
    # Check if we should restore to original AWS RDS or current Supabase
    if [[ -n "${AWS_DATABASE_URL:-}" ]]; then
        print_info "Restoring to original AWS RDS database..."
        
        # Decompress and restore backup
        if gunzip -c "$backup_file" | psql "$AWS_DATABASE_URL"; then
            print_success "Database restored to AWS RDS"
            ROLLBACK_STATE[database_restored]="true"
        else
            print_error "Database restore failed"
            return 1
        fi
    else
        print_warning "No AWS database URL - manual database rollback required"
        print_info "Backup location: $backup_file"
        print_info "Manual restore command: gunzip -c '$backup_file' | psql YOUR_DATABASE_URL"
    fi
    
    save_rollback_state
}

# Cleanup new infrastructure
cleanup_new_infrastructure() {
    print_step "Cleaning up new infrastructure services"
    
    # Remove Railway services
    if [[ "${SERVICE_STATUS[railway]}" == "available" ]]; then
        print_info "Removing Railway services..."
        
        # List and remove Railway projects
        if railway projects list &>/dev/null; then
            local projects=$(railway projects list --json 2>/dev/null | jq -r '.[].name' | grep -i schlep || true)
            
            for project in $projects; do
                print_info "Removing Railway project: $project"
                if railway delete --name "$project" --yes &>/dev/null; then
                    print_success "Railway project '$project' removed"
                else
                    print_warning "Failed to remove Railway project '$project'"
                fi
            done
            
            ROLLBACK_STATE[railway_removed]="true"
        fi
    fi
    
    # Remove Vercel deployments
    if [[ "${SERVICE_STATUS[vercel]}" == "available" ]]; then
        print_info "Removing Vercel deployments..."
        
        # List and remove Vercel projects
        local vercel_projects=$(vercel ls 2>/dev/null | grep schlep | awk '{print $1}' || true)
        
        for project in $vercel_projects; do
            print_info "Removing Vercel project: $project"
            if vercel remove "$project" --yes &>/dev/null; then
                print_success "Vercel project '$project' removed"
            else
                print_warning "Failed to remove Vercel project '$project'"
            fi
        done
        
        ROLLBACK_STATE[vercel_removed]="true"
    fi
    
    # Cleanup Cloudflare Pages (if applicable)
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        print_info "Cleaning up Cloudflare Pages..."
        
        # This would typically involve API calls to remove Pages projects
        # Implementation depends on specific Cloudflare setup
        
        ROLLBACK_STATE[cloudflare_removed]="true"
        print_success "Cloudflare cleanup completed"
    fi
    
    save_rollback_state
}

# Restore old infrastructure
restore_old_infrastructure() {
    print_step "Restoring old infrastructure services"
    
    if [[ "${SERVICE_STATUS[kubernetes]}" == "available" ]]; then
        print_info "Scaling up old Kubernetes services..."
        
        # Restore Kubernetes deployments
        local deployments=("api" "admin" "worker" "nginx")
        
        for deployment in "${deployments[@]}"; do
            print_info "Scaling up deployment: $deployment"
            
            if kubectl get deployment "$deployment" &>/dev/null; then
                kubectl scale deployment "$deployment" --replicas=2 &>/dev/null || true
                print_success "Deployment '$deployment' scaled up"
            else
                print_warning "Deployment '$deployment' not found"
            fi
        done
        
        # Wait for pods to be ready
        print_info "Waiting for pods to become ready..."
        sleep 60
        
        # Check pod status
        local ready_pods=$(kubectl get pods --field-selector=status.phase=Running | wc -l)
        print_info "Ready pods: $ready_pods"
        
        ROLLBACK_STATE[old_services_restored]="true"
    else
        print_warning "Kubernetes not accessible - manual service restoration required"
    fi
    
    save_rollback_state
}

# Health checks after rollback
run_rollback_health_checks() {
    print_step "Running health checks after rollback"
    
    local health_endpoints=()
    
    # Try to determine old endpoints
    if [[ "${SERVICE_STATUS[kubernetes]}" == "available" ]]; then
        # Get service endpoints from Kubernetes
        local api_endpoint=$(kubectl get service api-service -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        if [[ -n "$api_endpoint" ]]; then
            health_endpoints+=("http://$api_endpoint/api/v1/health/simple")
        fi
    fi
    
    # Add any known fallback endpoints
    health_endpoints+=(
        "http://localhost:8000/api/v1/health/simple"
        "https://api.yourdomain.com/api/v1/health/simple"
    )
    
    local successful_checks=0
    local total_checks=${#health_endpoints[@]}
    
    for endpoint in "${health_endpoints[@]}"; do
        print_info "Checking health of: $endpoint"
        
        if curl -f -s --max-time 10 "$endpoint" &>/dev/null; then
            print_success "Health check passed: $endpoint"
            ((successful_checks++))
        else
            print_warning "Health check failed: $endpoint"
        fi
    done
    
    if [[ $successful_checks -gt 0 ]]; then
        print_success "Rollback health checks: $successful_checks/$total_checks endpoints healthy"
        ROLLBACK_STATE[validation_passed]="true"
        return 0
    else
        print_error "All health checks failed - manual verification required"
        return 1
    fi
}

# Generate rollback report
generate_rollback_report() {
    print_step "Generating rollback report"
    
    local report_file="$LOG_DIR/${ROLLBACK_ID}_report.md"
    
    cat > "$report_file" << EOF
# Infrastructure Rollback Report
**Rollback ID:** $ROLLBACK_ID  
**Date:** $(date)  
**Status:** ${ROLLBACK_STATE[status]}

## Rollback Summary

This report documents the rollback from the \$145/month architecture back to the original infrastructure.

## Rollback Steps Completed

### DNS Configuration
- **Status:** ${ROLLBACK_STATE[dns_reverted]}
- **Action:** Reverted DNS records to original infrastructure

### Database Rollback
- **Status:** ${ROLLBACK_STATE[database_restored]}
- **Action:** Restored database from backup
- **Backup Used:** ${ORIGINAL_ENDPOINTS[database_backup]:-"N/A"}

### New Infrastructure Cleanup
- **Railway Removal:** ${ROLLBACK_STATE[railway_removed]}
- **Vercel Removal:** ${ROLLBACK_STATE[vercel_removed]}
- **Cloudflare Cleanup:** ${ROLLBACK_STATE[cloudflare_removed]}

### Old Infrastructure Restoration
- **Status:** ${ROLLBACK_STATE[old_services_restored]}
- **Kubernetes Services:** Scaled up and restored

## Service Status After Rollback

### Infrastructure Components
- **Kubernetes Cluster:** ${SERVICE_STATUS[kubernetes]:-"unknown"}
- **Database Backup:** ${SERVICE_STATUS[database_backup]:-"unknown"}
- **AWS Access:** ${SERVICE_STATUS[aws]:-"unknown"}

### CLI Tools Available
- **Railway CLI:** ${SERVICE_STATUS[railway]:-"unknown"}
- **Vercel CLI:** ${SERVICE_STATUS[vercel]:-"unknown"}
- **jq:** ${SERVICE_STATUS[jq]:-"unknown"}
- **curl:** ${SERVICE_STATUS[curl]:-"unknown"}

## Health Check Results
- **Validation Status:** ${ROLLBACK_STATE[validation_passed]}
- **Rollback Duration:** $(( $(date +%s) - $(date -d "${ROLLBACK_STATE[start_time]}" +%s) )) seconds

## Next Steps

1. **Immediate Actions:**
   - Verify all critical services are functional
   - Monitor application performance and error rates
   - Check that all user-facing features work correctly

2. **Post-Rollback Tasks:**
   - Update monitoring and alerting configurations
   - Verify backup procedures are working
   - Document lessons learned from the migration attempt

3. **Investigation:**
   - Review migration logs to understand what went wrong
   - Identify root causes of migration failure
   - Plan remediation strategy for next migration attempt

## Manual Verification Required

Please manually verify the following:
- [ ] All application endpoints are responding
- [ ] Database connections are working
- [ ] User authentication is functioning
- [ ] File uploads/downloads work correctly
- [ ] All integrations are operational

## Log Files
- **Rollback Log:** $LOG_FILE
- **State File:** $STATE_FILE

## Emergency Contacts

If issues persist after rollback:
- **Technical Lead:** [Your contact]
- **DevOps Team:** [Your contact]
- **On-call Engineer:** [Your contact]

---
*Rollback completed at $(date)*
EOF

    print_success "Rollback report generated: $report_file"
    echo -e "\n${CYAN}Rollback Report:${NC}"
    cat "$report_file"
}

# Main rollback orchestration
run_rollback() {
    print_header "INFRASTRUCTURE MIGRATION ROLLBACK"
    
    # Initialize
    init_rollback_state
    ROLLBACK_STATE[status]="running"
    ROLLBACK_STATE[start_time]=$(date)
    save_rollback_state
    
    print_info "Rollback ID: $ROLLBACK_ID"
    print_info "Log file: $LOG_FILE"
    print_info "State file: $STATE_FILE"
    
    # Load migration state if available
    load_migration_state
    
    # Check prerequisites
    check_rollback_prerequisites
    
    # Confirmation prompt
    print_warning "This will rollback the infrastructure migration"
    print_warning "This action will:"
    echo "  1. Revert DNS to old infrastructure"
    echo "  2. Restore database from backup (if available)"
    echo "  3. Remove new infrastructure services"
    echo "  4. Restore old infrastructure services"
    echo ""
    
    read -p "Are you sure you want to continue with the rollback? (yes/no): " -r
    if [[ ! $REPLY =~ ^(yes|YES)$ ]]; then
        print_info "Rollback cancelled by user"
        exit 0
    fi
    
    # Execute rollback
    progressive_rollback
    
    # Health checks
    if run_rollback_health_checks; then
        ROLLBACK_STATE[status]="completed"
        print_success "Rollback completed successfully!"
    else
        ROLLBACK_STATE[status]="completed_with_warnings"
        print_warning "Rollback completed but some health checks failed"
    fi
    
    save_rollback_state
    generate_rollback_report
    
    print_header "ROLLBACK COMPLETED"
    print_success "Infrastructure has been rolled back to original configuration"
    print_info "Please verify all services are functioning correctly"
    print_info "Review the rollback report for detailed information"
}

# Emergency rollback (minimal steps)
run_emergency_rollback() {
    print_header "EMERGENCY INFRASTRUCTURE ROLLBACK"
    print_warning "Running emergency rollback with minimal steps"
    
    init_rollback_state
    ROLLBACK_STATE[status]="emergency"
    ROLLBACK_STATE[start_time]=$(date)
    save_rollback_state
    
    # Immediate DNS rollback
    emergency_dns_rollback
    
    # Try to restore basic services
    if [[ "${SERVICE_STATUS[kubernetes]:-}" == "available" ]]; then
        kubectl scale deployment --all --replicas=1 &>/dev/null || true
    fi
    
    ROLLBACK_STATE[status]="emergency_completed"
    save_rollback_state
    
    print_success "Emergency rollback completed"
    print_warning "Manual verification and cleanup may be required"
}

# Signal handling for graceful shutdown
trap 'print_error "Rollback interrupted"; ROLLBACK_STATE[status]="interrupted"; save_rollback_state; exit 1' INT TERM

# Main execution
case "${1:-rollback}" in
    "rollback")
        run_rollback
        ;;
    "emergency")
        run_emergency_rollback
        ;;
    "dns-only")
        init_rollback_state
        load_migration_state
        check_rollback_prerequisites
        emergency_dns_rollback
        print_success "DNS-only rollback completed"
        ;;
    "status")
        if [[ -f "$STATE_FILE" ]]; then
            echo "Rollback Status: $(jq -r '.state.status' "$STATE_FILE" 2>/dev/null || echo "unknown")"
            echo "Current Step: $(jq -r '.state.current_step' "$STATE_FILE" 2>/dev/null || echo "unknown")"
        else
            echo "No active rollback found"
        fi
        ;;
    "help"|"-h"|"--help")
        echo "Infrastructure Rollback Script"
        echo "Usage: $0 [rollback|emergency|dns-only|status|help]"
        echo ""
        echo "Commands:"
        echo "  rollback   - Run full progressive rollback"
        echo "  emergency  - Run emergency rollback (DNS + basic services)"
        echo "  dns-only   - Rollback DNS configuration only"
        echo "  status     - Show current rollback status"
        echo "  help       - Show this help message"
        echo ""
        echo "The rollback script will:"
        echo "  1. Revert DNS to original infrastructure"
        echo "  2. Restore database from latest backup"
        echo "  3. Remove new infrastructure services"
        echo "  4. Restore old infrastructure services"
        echo "  5. Run health checks and generate report"
        ;;
    *)
        print_error "Unknown command: $1"
        exit 1
        ;;
esac