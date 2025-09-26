#!/bin/bash

# Schlep Engine Phase One Deployment Script for Vultr VPS
# Deploys enhanced infrastructure with database monitoring and migration readiness

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.phase-one.yml"
ENV_FILE=".env.phase-one"
PROJECT_NAME="schlep-engine-phase-one"

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
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

# Function to check if running as root
check_user() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
    fi
}

# Function to check system resources
check_system_resources() {
    log "Checking system resources..."

    # Check available memory
    local total_memory=$(free -m | awk 'NR==2{print $2}')
    if [ $total_memory -lt 1500 ]; then
        warning "Low memory detected (${total_memory}MB). Minimum 2GB recommended."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check available disk space
    local available_disk=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ $available_disk -lt 10 ]; then
        warning "Low disk space detected (${available_disk}GB). Minimum 20GB recommended."
    fi

    success "System resources check completed"
}

# Function to install dependencies
install_dependencies() {
    log "Installing/updating dependencies..."

    # Update package list
    sudo apt-get update -qq

    # Install required packages
    sudo apt-get install -y -qq \
        curl \
        jq \
        htop \
        ufw \
        fail2ban \
        logrotate \
        cron

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        log "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        success "Docker installed"
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        log "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        success "Docker Compose installed"
    fi

    success "Dependencies installation completed"
}

# Function to setup firewall
setup_firewall() {
    log "Configuring firewall..."

    # Reset UFW to defaults
    sudo ufw --force reset

    # Default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing

    # SSH (adjust port if you're using a different one)
    sudo ufw allow 22/tcp

    # HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp

    # Enable UFW
    sudo ufw --force enable

    success "Firewall configured"
}

# Function to create directory structure
setup_directories() {
    log "Setting up directory structure..."

    # Create necessary directories
    mkdir -p {database-schemas,postgres,redis,minio,monitoring,nginx/sites-enabled,ssl,backups,uploads,scripts}
    mkdir -p monitoring/{grafana/{provisioning/{datasources,dashboards},dashboards},rules}

    # Set proper permissions
    chmod -R 755 backups uploads

    success "Directory structure created"
}

# Function to setup environment file
setup_environment() {
    log "Setting up environment configuration..."

    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f ".env.phase-one.template" ]]; then
            cp .env.phase-one.template $ENV_FILE
            success "Environment template copied to $ENV_FILE"
            warning "IMPORTANT: Edit $ENV_FILE and replace all REPLACE_WITH_* placeholders with secure values!"
            warning "Generate secrets using: openssl rand -hex 32"

            read -p "Press Enter after editing $ENV_FILE..."
        else
            error "Environment template not found. Please ensure .env.phase-one.template exists."
        fi
    else
        log "Environment file already exists: $ENV_FILE"
    fi
}

# Function to copy Phase One database files
setup_database_files() {
    log "Setting up Phase One database files..."

    # Copy database schemas from phase-one directory
    local phase_one_dir="../../database/phase-one"

    if [[ -d "$phase_one_dir" ]]; then
        # Copy database schemas
        if [[ -d "$phase_one_dir/schemas" ]]; then
            cp -r $phase_one_dir/schemas/* database-schemas/
            success "Database schemas copied"
        fi

        # Copy Redis configuration
        if [[ -f "$phase_one_dir/redis/redis.conf" ]]; then
            cp $phase_one_dir/redis/redis.conf redis/
            success "Redis configuration copied"
        fi

        if [[ -f "$phase_one_dir/redis/init-scripts.sh" ]]; then
            cp $phase_one_dir/redis/init-scripts.sh redis/
            chmod +x redis/init-scripts.sh
            success "Redis initialization scripts copied"
        fi

        # Copy MinIO setup
        if [[ -f "$phase_one_dir/minio/setup-buckets.sh" ]]; then
            cp $phase_one_dir/minio/setup-buckets.sh minio/
            chmod +x minio/setup-buckets.sh
            success "MinIO setup scripts copied"
        fi

        # Copy monitoring configuration
        if [[ -d "$phase_one_dir/monitoring" ]]; then
            cp -r $phase_one_dir/monitoring/* monitoring/
            success "Monitoring configuration copied"
        fi

        # Copy database management scripts
        if [[ -d "$phase_one_dir/scripts" ]]; then
            cp -r $phase_one_dir/scripts/* scripts/
            chmod +x scripts/*.py scripts/*.sh 2>/dev/null || true
            success "Database management scripts copied"
        fi
    else
        warning "Phase One directory not found at $phase_one_dir"
        warning "Please ensure Phase One database setup is available"
    fi
}

# Function to setup PostgreSQL configuration
setup_postgres_config() {
    log "Setting up PostgreSQL configuration..."

    cat > postgres/postgresql.conf << 'EOF'
# PostgreSQL Configuration for Vultr VPS - Phase One
# Optimized for 2-4GB VPS with YugabyteDB migration readiness

# Connection Settings
listen_addresses = '*'
port = 5432
max_connections = 100
superuser_reserved_connections = 3

# Memory Settings (adjust based on VPS RAM)
shared_buffers = 256MB
effective_cache_size = 512MB
work_mem = 4MB
maintenance_work_mem = 64MB
dynamic_shared_memory_type = posix

# Checkpoint and WAL Settings
wal_level = replica
wal_buffers = 16MB
checkpoint_completion_target = 0.9
max_wal_size = 1GB
min_wal_size = 80MB

# Performance Settings
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d '

# Locale Settings
lc_messages = 'en_US.utf8'
lc_monetary = 'en_US.utf8'
lc_numeric = 'en_US.utf8'
lc_time = 'en_US.utf8'
default_text_search_config = 'pg_catalog.english'

# Timezone
timezone = 'UTC'
EOF

    cat > postgres/pg_hba.conf << 'EOF'
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             postgres                                peer
local   all             all                                     scram-sha-256

# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             172.20.0.0/16           scram-sha-256

# IPv6 local connections:
host    all             all             ::1/128                 scram-sha-256

# Replication connections
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             172.20.0.0/16           scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
EOF

    success "PostgreSQL configuration created"
}

# Function to validate environment file
validate_environment() {
    log "Validating environment configuration..."

    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file $ENV_FILE not found"
    fi

    # Check for placeholder values
    if grep -q "REPLACE_WITH_" $ENV_FILE; then
        error "Environment file contains placeholder values. Please replace all REPLACE_WITH_* values with secure passwords."
    fi

    # Source the env file for validation
    set -a
    source $ENV_FILE
    set +a

    # Check critical variables
    local required_vars=(
        "SECRET_KEY"
        "JWT_SECRET_KEY"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "MINIO_ROOT_PASSWORD"
        "GRAFANA_ADMIN_PASSWORD"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done

    success "Environment validation passed"
}

# Function to build and start services
deploy_services() {
    log "Building and deploying services..."

    # Pull latest images
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME pull

    # Build custom images
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache

    # Start services
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d

    success "Services deployed"
}

# Function to wait for services to be healthy
wait_for_services() {
    log "Waiting for services to become healthy..."

    local max_attempts=60
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log "Health check attempt $attempt/$max_attempts"

        # Check if all services are healthy
        local unhealthy=$(docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps --services --filter "health=unhealthy" | wc -l)
        local starting=$(docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps --services --filter "health=starting" | wc -l)

        if [ $unhealthy -eq 0 ] && [ $starting -eq 0 ]; then
            success "All services are healthy"
            return 0
        fi

        sleep 10
        ((attempt++))
    done

    warning "Some services may not be fully healthy yet. Check with: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps"
}

# Function to setup monitoring dashboards
setup_monitoring() {
    log "Setting up monitoring dashboards..."

    # Wait for Grafana to be ready
    sleep 30

    # Import dashboards (if Grafana API is accessible)
    local grafana_url="http://localhost:3100"
    local grafana_user="admin"

    # Source environment for Grafana password
    source $ENV_FILE

    # Test Grafana connection
    if curl -s -f "$grafana_url/api/health" > /dev/null; then
        success "Grafana is accessible"
        success "Access Grafana at: $grafana_url"
        success "Username: $grafana_user"
        success "Password: Check your $ENV_FILE file"
    else
        warning "Grafana not yet accessible. It may still be starting up."
    fi
}

# Function to create management aliases
setup_management_aliases() {
    log "Setting up management aliases..."

    cat >> ~/.bashrc << EOF

# Schlep Engine Phase One Management Aliases
alias sl-deploy='cd $(pwd) && docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d'
alias sl-logs='docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f'
alias sl-status='docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps'
alias sl-restart='docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME restart'
alias sl-stop='docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME stop'
alias sl-down='docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down'
alias sl-update='git pull && docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache && docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d'
alias sl-backup='docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME run --rm backup-service'
alias sl-health='python3 scripts/database.py health'
alias sl-migrate='python3 scripts/database.py migrate'

# Monitoring shortcuts
alias sl-grafana='echo "Grafana: http://localhost:3100"'
alias sl-prometheus='echo "Prometheus: http://localhost:9090"'
alias sl-minio='echo "MinIO Console: http://localhost:9001"'

# System monitoring
alias sl-resources='docker stats --no-stream'
alias sl-disk='df -h'
alias sl-memory='free -h'
alias sl-top='htop'
EOF

    success "Management aliases added to ~/.bashrc"
    success "Reload with: source ~/.bashrc"
}

# Function to display deployment summary
display_summary() {
    echo
    success "🎉 Schlep Engine Phase One deployment completed successfully!"
    echo
    echo -e "${BLUE}=== DEPLOYMENT SUMMARY ===${NC}"
    echo
    echo -e "${GREEN}Services deployed:${NC}"
    echo "  • PostgreSQL 16 (YugabyteDB-ready)"
    echo "  • Redis 7 (DragonflyDB-compatible)"
    echo "  • MinIO S3-compatible storage"
    echo "  • Prometheus monitoring"
    echo "  • Grafana dashboards"
    echo "  • FastAPI backend"
    echo "  • Next.js web applications"
    echo "  • Nginx reverse proxy"
    echo
    echo -e "${GREEN}Access Points:${NC}"
    echo "  • Application: https://$DOMAIN"
    echo "  • Admin: https://admin.$DOMAIN"
    echo "  • API: https://api.$DOMAIN"
    echo "  • Docs: https://docs.$DOMAIN"
    echo "  • Grafana: http://localhost:3100"
    echo "  • Prometheus: http://localhost:9090"
    echo "  • MinIO Console: http://localhost:9001"
    echo
    echo -e "${GREEN}Management Commands:${NC}"
    echo "  • sl-status    - Show service status"
    echo "  • sl-logs      - View logs"
    echo "  • sl-restart   - Restart services"
    echo "  • sl-health    - Check database health"
    echo "  • sl-backup    - Create backup"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Configure SSL certificates"
    echo "  2. Set up domain DNS records"
    echo "  3. Configure Cloudflare (optional)"
    echo "  4. Run initial database migrations"
    echo "  5. Set up automated backups"
    echo
    echo -e "${YELLOW}Important Files:${NC}"
    echo "  • Environment: $ENV_FILE"
    echo "  • Docker Compose: $COMPOSE_FILE"
    echo "  • Database Scripts: ./scripts/"
    echo "  • Monitoring Config: ./monitoring/"
    echo
    echo -e "${GREEN}Cost Optimization:${NC}"
    echo "  • Target: <$25/month on Vultr VPS"
    echo "  • Monitoring: Grafana dashboards"
    echo "  • Scaling: Ready for Phase Two migration"
    echo
}

# Main deployment function
main() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ____  _____________________    ______   __
   / __ \/ ___/ ___/ ___/ ___/   / ____/  / /
  / /_/ /\__ \\__ \\__ \\__ \   / __/ /__/ /
 / _, _/___/ /__/ /__/ /__/ /  / /_____/_/
/_/ |_|/____/____/____/____/  /____/____/

Schlep Engine Phase One Deployment
EOF
    echo -e "${NC}"

    log "Starting Schlep Engine Phase One deployment on Vultr VPS..."

    # Run deployment steps
    check_user
    check_system_resources
    install_dependencies
    setup_firewall
    setup_directories
    setup_environment
    setup_database_files
    setup_postgres_config
    validate_environment
    deploy_services
    wait_for_services
    setup_monitoring
    setup_management_aliases

    # Display final summary
    display_summary

    success "Deployment completed successfully! 🚀"
}

# Error handling
trap 'error "Deployment failed. Check the logs above for details."' ERR

# Run main function
main "$@"