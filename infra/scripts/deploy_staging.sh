#!/bin/bash

# Schlep-Engine Staging Deployment Script
# Phase 5 - Operational Hardening and Pilot Launch
#
# This script automates deployment to Hetzner VPS for staging environment
#
# Usage: ./deploy_staging.sh [--canary-stage STAGE] [--skip-health-check]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="${PROJECT_ROOT}/infra/deploy"
SSH_HOST="${SSH_HOST:-staging.schlep-engine.com}"
SSH_USER="${SSH_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/schlep-engine}"
CANARY_STAGE="${CANARY_STAGE:-initial}"
SKIP_HEALTH_CHECK=false
DRY_RUN=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_deps=()

    for cmd in ssh scp docker docker-compose jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi

    # Check SSH connectivity
    if ! ssh -q -o BatchMode=yes -o ConnectTimeout=5 -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" exit 2>/dev/null; then
        log_error "Cannot connect to ${SSH_HOST}. Please check SSH configuration and credentials."
        exit 1
    fi

    # Check environment file
    if [[ ! -f "${DEPLOY_DIR}/.env.staging" ]]; then
        log_error "Environment file not found: ${DEPLOY_DIR}/.env.staging"
        log_error "Please create .env.staging with required variables"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Create deployment package
create_deployment_package() {
    log_info "Creating deployment package..."

    local temp_dir=$(mktemp -d)
    local package_file="/tmp/schlep-engine-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

    # Copy necessary files
    mkdir -p "$temp_dir/schlep-engine"

    cp -r "${PROJECT_ROOT}/go_gateway" "$temp_dir/schlep-engine/" 2>/dev/null || log_warn "go_gateway not found"
    cp -r "${PROJECT_ROOT}/apps" "$temp_dir/schlep-engine/" 2>/dev/null || log_warn "apps not found"
    cp -r "${PROJECT_ROOT}/infra" "$temp_dir/schlep-engine/"
    cp "${PROJECT_ROOT}/docker-compose.production.yml" "$temp_dir/schlep-engine/" 2>/dev/null || true

    # Create tarball
    tar -czf "$package_file" -C "$temp_dir" schlep-engine

    # Cleanup
    rm -rf "$temp_dir"

    log_success "Deployment package created: $package_file"
    echo "$package_file"
}

# Deploy to server
deploy_to_server() {
    local package_file="$1"

    log_info "Deploying to ${SSH_HOST}..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warn "DRY RUN MODE - Would deploy: $package_file"
        return 0
    fi

    # Create remote directory
    ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "mkdir -p ${REMOTE_DIR}"

    # Upload package
    log_info "Uploading deployment package..."
    scp -P "$SSH_PORT" "$package_file" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/package.tar.gz"

    # Upload environment file
    log_info "Uploading environment configuration..."
    scp -P "$SSH_PORT" "${DEPLOY_DIR}/.env.staging" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/.env"

    # Extract and prepare on server
    log_info "Extracting package on server..."
    ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" bash <<'EOF'
cd /opt/schlep-engine
tar -xzf package.tar.gz
mv schlep-engine/* .
rm -rf schlep-engine package.tar.gz

# Create data directories
mkdir -p data/{postgres,redis,prometheus}
chmod -R 755 data
EOF

    log_success "Deployment package uploaded and extracted"
}

# Update Docker containers
update_containers() {
    log_info "Updating Docker containers on staging server..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warn "DRY RUN MODE - Would update containers"
        return 0
    fi

    ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" bash <<EOF
cd ${REMOTE_DIR}

# Set canary stage
export CANARY_STAGE=${CANARY_STAGE}
export CANARY_PERCENTAGE=\$(case ${CANARY_STAGE} in
    initial) echo 10 ;;
    expand) echo 50 ;;
    full) echo 100 ;;
    *) echo 10 ;;
esac)

echo "Deploying canary stage: ${CANARY_STAGE} (\${CANARY_PERCENTAGE}% traffic)"

# Pull latest images
docker-compose -f infra/deploy/staging_compose.yml pull

# Stop old containers
docker-compose -f infra/deploy/staging_compose.yml down

# Start new containers
docker-compose -f infra/deploy/staging_compose.yml up -d

# Wait for containers to be healthy
echo "Waiting for containers to be healthy..."
sleep 30

# Check container status
docker-compose -f infra/deploy/staging_compose.yml ps
EOF

    log_success "Containers updated successfully"
}

# Run health checks
run_health_checks() {
    if [[ "$SKIP_HEALTH_CHECK" == true ]]; then
        log_warn "Skipping health checks"
        return 0
    fi

    log_info "Running health checks..."

    local max_attempts=12
    local attempt=0
    local health_check_url="http://${SSH_HOST}:8080/v1/health"

    while [[ $attempt -lt $max_attempts ]]; do
        if curl -sf "$health_check_url" > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi

        ((attempt++))
        log_info "Health check attempt $attempt/$max_attempts failed. Retrying in 10s..."
        sleep 10
    done

    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Run canary validation
run_canary_validation() {
    log_info "Running canary validation for stage: ${CANARY_STAGE}..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warn "DRY RUN MODE - Would run canary validation"
        return 0
    fi

    # Copy validation script to server
    scp -P "$SSH_PORT" "${SCRIPT_DIR}/canary_validation.sh" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

    # Run validation on server
    ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" bash <<EOF
cd ${REMOTE_DIR}
chmod +x canary_validation.sh

export API_URL=http://localhost:8080
export PROMETHEUS_URL=http://localhost:9091
export CANARY_STAGE=${CANARY_STAGE}

./canary_validation.sh ${CANARY_STAGE}
EOF

    if [[ $? -eq 0 ]]; then
        log_success "Canary validation passed"
        return 0
    else
        log_error "Canary validation failed"
        return 1
    fi
}

# Rollback deployment
rollback_deployment() {
    log_warn "Rolling back deployment..."

    ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" bash <<EOF
cd ${REMOTE_DIR}

# Restore from backup
if [[ -d backup/previous ]]; then
    docker-compose -f infra/deploy/staging_compose.yml down
    rm -rf infra apps go_gateway
    cp -r backup/previous/* .
    docker-compose -f infra/deploy/staging_compose.yml up -d
    echo "Rollback completed"
else
    echo "No backup found for rollback"
    exit 1
fi
EOF

    log_warn "Rollback completed. Please verify system health."
}

# Create backup
create_backup() {
    log_info "Creating backup of current deployment..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warn "DRY RUN MODE - Would create backup"
        return 0
    fi

    ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" bash <<EOF
cd ${REMOTE_DIR}

# Create backup directory
mkdir -p backup/previous
rm -rf backup/previous/*

# Backup current deployment
if [[ -d infra ]]; then
    cp -r infra apps go_gateway backup/previous/ 2>/dev/null || true
    echo "Backup created: \$(date)"
fi
EOF

    log_success "Backup created"
}

# Display deployment summary
display_summary() {
    log_info "=========================================="
    log_info "Deployment Summary"
    log_info "=========================================="
    echo "Host: ${SSH_HOST}"
    echo "Remote Directory: ${REMOTE_DIR}"
    echo "Canary Stage: ${CANARY_STAGE}"
    echo "Deployment Time: $(date)"
    log_info "=========================================="

    log_success "Deployment completed successfully!"
    log_info "Next steps:"
    echo "  1. Monitor Grafana dashboard: http://${SSH_HOST}:3001"
    echo "  2. Check Prometheus metrics: http://${SSH_HOST}:9091"
    echo "  3. Run canary validation: ./canary_validation.sh ${CANARY_STAGE}"
    echo "  4. Monitor logs: ssh ${SSH_USER}@${SSH_HOST} 'cd ${REMOTE_DIR} && docker-compose -f infra/deploy/staging_compose.yml logs -f'"
}

# Usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Deploy Schlep-Engine to staging environment on Hetzner VPS

OPTIONS:
    --canary-stage STAGE    Canary deployment stage (initial|expand|full) (default: initial)
    --skip-health-check     Skip health checks after deployment
    --dry-run              Simulate deployment without making changes
    --rollback             Rollback to previous deployment
    -h, --help             Show this help message

ENVIRONMENT VARIABLES:
    SSH_HOST               Staging server hostname (default: staging.schlep-engine.com)
    SSH_USER               SSH user (default: root)
    SSH_PORT               SSH port (default: 22)
    REMOTE_DIR             Remote deployment directory (default: /opt/schlep-engine)

EXAMPLES:
    # Deploy initial canary (10% traffic)
    $0 --canary-stage initial

    # Deploy expanded canary (50% traffic)
    $0 --canary-stage expand

    # Deploy full rollout (100% traffic)
    $0 --canary-stage full

    # Dry run
    $0 --dry-run

    # Rollback deployment
    $0 --rollback

EOF
    exit 0
}

# Main execution
main() {
    local rollback=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --canary-stage)
                CANARY_STAGE="$2"
                shift 2
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --rollback)
                rollback=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done

    # Handle rollback
    if [[ "$rollback" == true ]]; then
        rollback_deployment
        exit 0
    fi

    # Normal deployment flow
    log_info "Starting Schlep-Engine staging deployment"
    log_info "Canary stage: ${CANARY_STAGE}"

    check_prerequisites
    create_backup

    local package_file=$(create_deployment_package)
    deploy_to_server "$package_file"
    update_containers
    run_health_checks

    if [[ $? -ne 0 ]]; then
        log_error "Health checks failed. Consider rolling back."
        log_error "To rollback: $0 --rollback"
        exit 1
    fi

    run_canary_validation

    if [[ $? -ne 0 ]]; then
        log_error "Canary validation failed. Consider rolling back."
        log_error "To rollback: $0 --rollback"
        exit 1
    fi

    # Cleanup
    rm -f "$package_file"

    display_summary
}

main "$@"
