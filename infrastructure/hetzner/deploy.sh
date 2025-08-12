#!/bin/bash
# =============================================================================
# SCHLEP ENGINE - HETZNER PRODUCTION DEPLOYMENT SCRIPT
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="schlep-engine"
DEPLOY_USER="deploy"
DEPLOY_PATH="/home/$DEPLOY_USER/$PROJECT_NAME"
ENV_FILE="$DEPLOY_PATH/infrastructure/hetzner/.env.production"
COMPOSE_FILE="$DEPLOY_PATH/infrastructure/hetzner/docker-compose.production.yml"

# Functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

check_requirements() {
    log "Checking deployment requirements..."
    
    # Check if running as deploy user
    if [ "$(whoami)" != "$DEPLOY_USER" ]; then
        error "This script must be run as the '$DEPLOY_USER' user"
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if project directory exists
    if [ ! -d "$DEPLOY_PATH" ]; then
        error "Project directory $DEPLOY_PATH does not exist"
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file $ENV_FILE does not exist. Copy from .env.production.template first!"
    fi
    
    success "All requirements met"
}

backup_database() {
    log "Creating database backup..."
    
    BACKUP_DIR="$DEPLOY_PATH/backups"
    BACKUP_FILE="$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    # Only backup if database is running
    if docker ps | grep -q "schlep-postgres"; then
        docker exec schlep-postgres pg_dump -U schlep_user schlep_engine > "$BACKUP_FILE"
        success "Database backup created: $BACKUP_FILE"
    else
        warning "Database not running, skipping backup"
    fi
}

pull_latest_code() {
    log "Pulling latest code from repository..."
    
    cd "$DEPLOY_PATH"
    
    # Stash any local changes
    git stash
    
    # Pull latest changes
    git pull origin main
    
    success "Code updated to latest version"
}

build_images() {
    log "Building Docker images..."
    
    cd "$DEPLOY_PATH"
    
    # Build all images
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    
    success "Docker images built successfully"
}

start_services() {
    log "Starting services..."
    
    cd "$DEPLOY_PATH"
    
    # Start services in correct order
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 30
    
    # Run database migrations
    log "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" run --rm api python -m alembic upgrade head
    
    # Start remaining services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    success "All services started"
}

verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for services to start
    sleep 30
    
    # Check if all containers are running
    if ! docker ps | grep -q "schlep-postgres"; then
        error "PostgreSQL container is not running"
    fi
    
    if ! docker ps | grep -q "schlep-redis"; then
        error "Redis container is not running"
    fi
    
    if ! docker ps | grep -q "schlep-api"; then
        error "API container is not running"
    fi
    
    if ! docker ps | grep -q "schlep-nginx"; then
        error "Nginx container is not running"
    fi
    
    # Check API health
    log "Checking API health..."
    sleep 10
    
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        success "API health check passed"
    else
        error "API health check failed"
    fi
    
    success "Deployment verification completed"
}

cleanup() {
    log "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove old backup files (keep last 7 days)
    find "$DEPLOY_PATH/backups" -name "database_*.sql" -mtime +7 -delete
    
    success "Cleanup completed"
}

show_status() {
    echo ""
    echo "============================================================================="
    echo "                        DEPLOYMENT STATUS"
    echo "============================================================================="
    
    # Show running containers
    echo "Running Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "Services:"
    echo "- Landing Page: https://schlep-engine.com"
    echo "- Admin Dashboard: https://admin.schlep-engine.com"
    echo "- API Documentation: https://docs.schlep-engine.com"
    echo "- API Backend: https://api.schlep-engine.com"
    echo ""
    echo "Local Access (from server):"
    echo "- API: http://localhost:8000"
    echo "- Landing: http://localhost:3000"
    echo "- Admin: http://localhost:3002"
    echo "- Docs: http://localhost:3001"
    echo ""
}

main() {
    echo "==============================================================================="
    echo "                    SCHLEP ENGINE DEPLOYMENT SCRIPT"
    echo "==============================================================================="
    echo "Starting deployment process..."
    echo ""
    
    check_requirements
    backup_database
    pull_latest_code
    build_images
    start_services
    verify_deployment
    cleanup
    show_status
    
    echo ""
    success "🚀 Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Configure Cloudflare DNS (see cloudflare-setup.md)"
    echo "2. Install Claude Code CLI (see claude-code-setup.md)"
    echo "3. Monitor logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo ""
}

# Handle script arguments
case "$1" in
    "backup")
        backup_database
        ;;
    "pull")
        pull_latest_code
        ;;
    "build")
        build_images
        ;;
    "start")
        start_services
        ;;
    "verify")
        verify_deployment
        ;;
    "status")
        show_status
        ;;
    "logs")
        cd "$DEPLOY_PATH"
        docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
        ;;
    "restart")
        cd "$DEPLOY_PATH"
        docker-compose -f "$COMPOSE_FILE" restart "${2:-}"
        ;;
    "stop")
        cd "$DEPLOY_PATH"
        docker-compose -f "$COMPOSE_FILE" stop
        ;;
    *)
        main
        ;;
esac