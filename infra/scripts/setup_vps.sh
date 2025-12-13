#!/bin/bash

# Schlep-Engine VPS Initial Setup Script
# Phase 5 - Operational Hardening and Pilot Launch
#
# This script prepares a fresh Hetzner CX31 VPS for Schlep-Engine deployment
#
# Usage: ./setup_vps.sh

set -euo pipefail

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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Update system
update_system() {
    log_info "Updating system packages..."

    apt-get update
    apt-get upgrade -y
    apt-get autoremove -y

    log_success "System updated"
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."

    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        log_warn "Docker is already installed"
        docker --version
        return 0
    fi

    # Install dependencies
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Set up the stable repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io

    # Enable Docker service
    systemctl enable docker
    systemctl start docker

    log_success "Docker installed successfully"
    docker --version
}

# Install Docker Compose
install_docker_compose() {
    log_info "Installing Docker Compose..."

    # Check if Docker Compose is already installed
    if command -v docker-compose &> /dev/null; then
        log_warn "Docker Compose is already installed"
        docker-compose --version
        return 0
    fi

    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    log_success "Docker Compose installed successfully"
    docker-compose --version
}

# Install additional tools
install_tools() {
    log_info "Installing additional tools..."

    apt-get install -y \
        git \
        vim \
        htop \
        net-tools \
        jq \
        curl \
        wget \
        unzip \
        bc \
        certbot \
        python3-certbot-nginx

    log_success "Additional tools installed"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."

    # Install UFW if not present
    apt-get install -y ufw

    # Configure firewall rules
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH
    ufw allow 22/tcp

    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Allow application ports
    ufw allow 8080/tcp  # Go Gateway
    ufw allow 3001/tcp  # Grafana
    ufw allow 9091/tcp  # Prometheus

    ufw --force enable

    log_success "Firewall configured"
    ufw status
}

# Create directory structure
create_directories() {
    log_info "Creating directory structure..."

    mkdir -p /opt/igris-inertial/{data,backups,logs}
    mkdir -p /opt/igris-inertial/data/{postgres,redis,prometheus,grafana}

    chmod -R 755 /opt/igris-inertial

    log_success "Directory structure created"
}

# Optimize system for Docker
optimize_system() {
    log_info "Optimizing system for Docker..."

    # Increase file descriptors
    cat >> /etc/security/limits.conf <<EOF

# Schlep-Engine optimizations
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF

    # Optimize kernel parameters
    cat >> /etc/sysctl.conf <<EOF

# Schlep-Engine optimizations
vm.max_map_count=262144
fs.file-max=2097152
net.core.somaxconn=32768
net.ipv4.tcp_max_syn_backlog=8192
net.ipv4.ip_local_port_range=1024 65535
EOF

    sysctl -p

    log_success "System optimized"
}

# Setup swap
setup_swap() {
    log_info "Setting up swap..."

    # Check if swap already exists
    if swapon --show | grep -q '/swapfile'; then
        log_warn "Swap already configured"
        return 0
    fi

    # Create 4GB swap file (for 8GB RAM VPS)
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Make swap permanent
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

    # Adjust swappiness
    echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf
    sysctl -p

    log_success "Swap configured (4GB)"
}

# Configure log rotation
configure_log_rotation() {
    log_info "Configuring log rotation..."

    cat > /etc/logrotate.d/igris-inertial <<EOF
/opt/igris-inertial/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF

    log_success "Log rotation configured"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up basic monitoring..."

    # Install node_exporter for system metrics
    cd /tmp
    wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
    tar xvfz node_exporter-1.6.1.linux-amd64.tar.gz
    mv node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
    rm -rf node_exporter-1.6.1.linux-amd64*

    # Create systemd service
    cat > /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable node_exporter
    systemctl start node_exporter

    log_success "Node exporter installed and started"
}

# Setup automated backups
setup_backups() {
    log_info "Setting up automated backups..."

    # Create backup script
    cat > /opt/igris-inertial/scripts/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/igris-inertial/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker exec schlep-postgres-staging pg_dumpall -U schlep_user > "${BACKUP_DIR}/postgres_${DATE}.sql"

# Backup Redis
docker exec schlep-redis-staging redis-cli --rdb /data/dump.rdb SAVE
docker cp schlep-redis-staging:/data/dump.rdb "${BACKUP_DIR}/redis_${DATE}.rdb"

# Compress backups older than 1 day
find ${BACKUP_DIR} -name "*.sql" -mtime +1 -exec gzip {} \;
find ${BACKUP_DIR} -name "*.rdb" -mtime +1 -exec gzip {} \;

# Delete backups older than 30 days
find ${BACKUP_DIR} -name "*.gz" -mtime +30 -delete

echo "Backup completed: ${DATE}"
EOF

    chmod +x /opt/igris-inertial/scripts/backup.sh

    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/igris-inertial/scripts/backup.sh >> /opt/igris-inertial/logs/backup.log 2>&1") | crontab -

    log_success "Automated backups configured (daily at 2 AM)"
}

# Display summary
display_summary() {
    log_info "=========================================="
    log_info "VPS Setup Complete"
    log_info "=========================================="
    echo "Hostname: $(hostname)"
    echo "IP Address: $(hostname -I | awk '{print $1}')"
    echo "OS: $(lsb_release -d | cut -f2)"
    echo "Kernel: $(uname -r)"
    echo "Docker: $(docker --version)"
    echo "Docker Compose: $(docker-compose --version)"
    log_info "=========================================="

    log_success "VPS is ready for Schlep-Engine deployment!"
    log_info "Next steps:"
    echo "  1. Configure DNS to point to this server"
    echo "  2. Create .env.staging file with required variables"
    echo "  3. Run: ./deploy_staging.sh --canary-stage initial"
    echo "  4. Monitor deployment: journalctl -u docker -f"
}

# Main execution
main() {
    log_info "Starting Schlep-Engine VPS setup..."

    check_root
    update_system
    install_docker
    install_docker_compose
    install_tools
    create_directories
    setup_swap
    optimize_system
    configure_firewall
    configure_log_rotation
    setup_monitoring
    setup_backups

    display_summary
}

main "$@"
