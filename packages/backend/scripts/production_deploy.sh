#!/bin/bash

# Pollarbase Production Deployment Script
# Automated deployment and management for production environment

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="/opt/pollarbase/backups"
LOG_FILE="/var/log/pollarbase/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if running as root (for production setup)
    if [[ $EUID -ne 0 && "$1" == "setup" ]]; then
        error "This script must be run as root for initial setup"
    fi
    
    # Check if environment file exists
    if [[ ! -f "$PROJECT_ROOT/$ENV_FILE" ]]; then
        warning "Environment file $ENV_FILE not found. Creating template..."
        create_env_template
    fi
    
    success "Prerequisites check completed"
}

# Create environment template
create_env_template() {
    cat > "$PROJECT_ROOT/$ENV_FILE" << EOF
# Pollarbase Production Environment Configuration

# Database Configuration
POSTGRES_PASSWORD=your_secure_postgres_password_here
DATABASE_URL=postgresql://pollarbase:your_secure_postgres_password_here@postgres:5432/pollarbase_prod

# Application Security
SECRET_KEY=your_secret_key_here
ALLOWED_HOSTS=your-domain.com,api.your-domain.com
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Monitoring Credentials
FLOWER_USER=admin
FLOWER_PASSWORD=your_flower_password_here
GRAFANA_PASSWORD=your_grafana_password_here

# SSL Configuration (if using SSL)
SSL_ENABLED=false
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
EOF
    
    warning "Environment template created at $ENV_FILE"
    warning "Please edit the file with your actual configuration before deployment!"
}

# System setup (run once)
setup_system() {
    log "Setting up production system..."
    
    # Create necessary directories
    mkdir -p /opt/pollarbase/{backups,logs,data}
    mkdir -p /var/log/pollarbase
    
    # Create pollarbase user
    if ! id pollarbase &>/dev/null; then
        useradd -r -s /bin/bash -d /opt/pollarbase pollarbase
        log "Created pollarbase user"
    fi
    
    # Set permissions
    chown -R pollarbase:pollarbase /opt/pollarbase
    chmod 755 /opt/pollarbase
    
    # Setup log rotation
    cat > /etc/logrotate.d/pollarbase << EOF
/var/log/pollarbase/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 pollarbase pollarbase
}
EOF
    
    # Setup systemd service for automatic startup
    cat > /etc/systemd/system/pollarbase.service << EOF
[Unit]
Description=Pollarbase API Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_ROOT
ExecStart=$SCRIPT_DIR/production_deploy.sh start
ExecStop=$SCRIPT_DIR/production_deploy.sh stop
User=pollarbase
Group=pollarbase

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable pollarbase
    
    success "System setup completed"
}

# Database backup
backup_database() {
    log "Creating database backup..."
    
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/pollarbase_backup_$BACKUP_DATE.sql"
    
    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"
    
    # Create backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
        -U pollarbase pollarbase_prod > "$BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    
    # Remove old backups (keep last 30 days)
    find "$BACKUP_DIR" -name "pollarbase_backup_*.sql.gz" -mtime +30 -delete
    
    success "Database backup created: ${BACKUP_FILE}.gz"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if services are running
    services=("pollarbase-api" "pollarbase-postgres" "pollarbase-redis")
    
    for service in "${services[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$service"; then
            success "$service is running"
        else
            error "$service is not running"
        fi
    done
    
    # Check API health endpoint
    if curl -f -s http://localhost:8000/health > /dev/null; then
        success "API health check passed"
    else
        error "API health check failed"
    fi
    
    # Check database connectivity
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U pollarbase > /dev/null; then
        success "Database connectivity check passed"
    else
        error "Database connectivity check failed"
    fi
    
    success "All health checks passed"
}

# Deploy application
deploy() {
    log "Starting deployment..."
    
    # Create backup before deployment
    if docker ps --format "table {{.Names}}" | grep -q "pollarbase-postgres"; then
        backup_database
    fi
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Build application image
    log "Building application image..."
    docker-compose -f "$COMPOSE_FILE" build pollarbase-api
    
    # Stop existing services
    log "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # Start services
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Run database migrations
    log "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" exec -T pollarbase-api \
        alembic upgrade head || warning "Migration failed or not needed"
    
    # Health check
    health_check
    
    success "Deployment completed successfully!"
}

# Start services
start_services() {
    log "Starting Pollarbase services..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services
    sleep 15
    health_check
    
    success "All services started successfully"
}

# Stop services
stop_services() {
    log "Stopping Pollarbase services..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down
    
    success "All services stopped"
}

# Restart services
restart_services() {
    log "Restarting Pollarbase services..."
    
    stop_services
    sleep 5
    start_services
    
    success "All services restarted"
}

# View logs
view_logs() {
    SERVICE=${2:-pollarbase-api}
    log "Viewing logs for $SERVICE..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
}

# Cleanup old resources
cleanup() {
    log "Cleaning up old Docker resources..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    success "Cleanup completed"
}

# Monitor resources
monitor() {
    log "System resource monitoring..."
    
    echo "=== Docker Stats ==="
    docker stats --no-stream
    
    echo -e "\n=== Disk Usage ==="
    df -h
    
    echo -e "\n=== Memory Usage ==="
    free -h
    
    echo -e "\n=== Service Status ==="
    docker-compose -f "$COMPOSE_FILE" ps
}

# Update application
update() {
    log "Updating Pollarbase application..."
    
    # Pull latest code (if using git)
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        log "Pulling latest code..."
        cd "$PROJECT_ROOT"
        git pull origin main
    fi
    
    # Deploy with new code
    deploy
    
    success "Update completed"
}

# Show usage
usage() {
    echo "Pollarbase Production Deployment Script"
    echo ""
    echo "Usage: $0 {setup|deploy|start|stop|restart|health|backup|logs|cleanup|monitor|update}"
    echo ""
    echo "Commands:"
    echo "  setup     - Initial system setup (run once as root)"
    echo "  deploy    - Deploy application with backup and migrations"
    echo "  start     - Start all services"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  health    - Perform health check"
    echo "  backup    - Create database backup"
    echo "  logs      - View application logs (optional: specify service name)"
    echo "  cleanup   - Clean up old Docker resources"
    echo "  monitor   - Show system resource usage"
    echo "  update    - Update application (pull code and deploy)"
    echo ""
    echo "Examples:"
    echo "  $0 setup                    # Initial setup"
    echo "  $0 deploy                   # Full deployment"
    echo "  $0 logs pollarbase-api      # View API logs"
    echo "  $0 logs celery-worker       # View worker logs"
}

# Main script logic
main() {
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    case "$1" in
        setup)
            check_prerequisites setup
            setup_system
            ;;
        deploy)
            check_prerequisites
            deploy
            ;;
        start)
            check_prerequisites
            start_services
            ;;
        stop)
            check_prerequisites
            stop_services
            ;;
        restart)
            check_prerequisites
            restart_services
            ;;
        health)
            check_prerequisites
            health_check
            ;;
        backup)
            check_prerequisites
            backup_database
            ;;
        logs)
            check_prerequisites
            view_logs "$@"
            ;;
        cleanup)
            check_prerequisites
            cleanup
            ;;
        monitor)
            check_prerequisites
            monitor
            ;;
        update)
            check_prerequisites
            update
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 