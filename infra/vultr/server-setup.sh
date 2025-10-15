#!/bin/bash
# =============================================================================
# VULTR SERVER INITIAL SETUP SCRIPT
# Run this script on a fresh Ubuntu 22.04 Vultr VPS
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_USER="deploy"
PROJECT_NAME="schlep-engine"
GITHUB_REPO="https://github.com/wiramahendra/schlep-engine.git"

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

check_root() {
    if [ "$(id -u)" != "0" ]; then
        error "This script must be run as root"
    fi
}

update_system() {
    log "Updating system packages..."
    
    apt update
    apt upgrade -y
    
    # Install essential packages
    apt install -y \
        curl \
        wget \
        git \
        htop \
        nano \
        vim \
        unzip \
        zip \
        fail2ban \
        ufw \
        logrotate \
        cron \
        ca-certificates \
        gnupg \
        lsb-release
    
    success "System updated and essential packages installed"
}

configure_firewall() {
    log "Configuring UFW firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful not to lock yourself out!)
    ufw allow ssh
    ufw allow 22
    
    # Allow HTTP and HTTPS
    ufw allow 80
    ufw allow 443
    
    # Enable firewall
    ufw --force enable
    
    success "Firewall configured"
}

configure_fail2ban() {
    log "Configuring Fail2ban..."
    
    # Create local jail configuration
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
destemail = root@localhost
sendername = Fail2Ban

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
EOF

    systemctl enable fail2ban
    systemctl restart fail2ban
    
    success "Fail2ban configured"
}

create_deploy_user() {
    log "Creating deploy user..."
    
    # Create user if not exists
    if ! id "$DEPLOY_USER" &>/dev/null; then
        adduser --disabled-password --gecos "" $DEPLOY_USER
        usermod -aG sudo $DEPLOY_USER
        
        # Create SSH directory
        mkdir -p /home/$DEPLOY_USER/.ssh
        
        # Copy root's authorized_keys if exists
        if [ -f /root/.ssh/authorized_keys ]; then
            cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
        fi
        
        # Set proper permissions
        chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
        chmod 700 /home/$DEPLOY_USER/.ssh
        chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
        
        success "Deploy user created"
    else
        warning "Deploy user already exists"
    fi
}

install_docker() {
    log "Installing Docker..."
    
    # Remove old Docker installations
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add deploy user to docker group
    usermod -aG docker $DEPLOY_USER
    
    # Enable and start Docker
    systemctl enable docker
    systemctl start docker
    
    success "Docker installed"
}

install_docker_compose() {
    log "Installing Docker Compose..."
    
    # Get latest version
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    
    # Download and install
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for convenience
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    success "Docker Compose installed (version: $DOCKER_COMPOSE_VERSION)"
}

install_nodejs() {
    log "Installing Node.js..."
    
    # Install Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    
    # Install yarn globally
    npm install -g yarn
    
    success "Node.js and Yarn installed"
}

clone_repository() {
    log "Cloning repository..."
    
    # Switch to deploy user
    sudo -u $DEPLOY_USER bash << EOF
cd /home/$DEPLOY_USER

# Clone repository if not exists
if [ ! -d "$PROJECT_NAME" ]; then
    git clone $GITHUB_REPO $PROJECT_NAME
    cd $PROJECT_NAME
    
    # Create necessary directories
    mkdir -p infrastructure/vultr/ssl
    mkdir -p infrastructure/vultr/backups
    mkdir -p infrastructure/vultr/logs
    
    # Copy environment template
    if [ -f infrastructure/vultr/.env.production.template ]; then
        cp infrastructure/vultr/.env.production.template infrastructure/vultr/.env.production
        echo "IMPORTANT: Edit infrastructure/vultr/.env.production with your actual values!"
    fi
else
    echo "Repository already exists, pulling latest changes..."
    cd $PROJECT_NAME
    git pull origin main
fi
EOF

    success "Repository cloned/updated"
}

setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/schlep-engine << EOF
/home/$DEPLOY_USER/$PROJECT_NAME/infrastructure/vultr/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $DEPLOY_USER $DEPLOY_USER
}
EOF

    success "Log rotation configured"
}

setup_system_monitoring() {
    log "Setting up basic system monitoring..."
    
    # Install system monitoring tools
    apt install -y iotop nethogs ncdu
    
    # Create monitoring script
    cat > /usr/local/bin/system-status << 'EOF'
#!/bin/bash
echo "=== System Status ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo ""
echo "=== Memory Usage ==="
free -h
echo ""
echo "=== Disk Usage ==="
df -h
echo ""
echo "=== Docker Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== Load Average ==="
cat /proc/loadavg
echo ""
EOF
    
    chmod +x /usr/local/bin/system-status
    
    success "System monitoring tools installed"
}

create_deployment_aliases() {
    log "Creating deployment aliases..."
    
    # Add aliases to deploy user's bashrc
    sudo -u $DEPLOY_USER bash << 'EOF'
cat >> /home/deploy/.bashrc << 'ALIASES'

# Schlep Engine aliases
alias sl-deploy='cd /home/deploy/schlep-engine && ./infrastructure/vultr/deploy.sh'
alias sl-logs='cd /home/deploy/schlep-engine && docker-compose -f infrastructure/vultr/docker-compose.production.yml logs -f'
alias sl-status='cd /home/deploy/schlep-engine && docker-compose -f infrastructure/vultr/docker-compose.production.yml ps'
alias sl-restart='cd /home/deploy/schlep-engine && docker-compose -f infrastructure/vultr/docker-compose.production.yml restart'
alias sl-stop='cd /home/deploy/schlep-engine && docker-compose -f infrastructure/vultr/docker-compose.production.yml stop'
alias sl-backup='cd /home/deploy/schlep-engine && ./infrastructure/vultr/deploy.sh backup'
alias sl-update='cd /home/deploy/schlep-engine && git pull origin main'

# System aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias h='htop'
alias df='df -h'
alias du='du -h'
alias free='free -h'
alias ports='netstat -tulpn'
alias status='system-status'
ALIASES
EOF

    success "Deployment aliases created"
}

setup_automatic_updates() {
    log "Setting up automatic security updates..."
    
    apt install -y unattended-upgrades
    
    # Configure unattended-upgrades
    cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

    # Enable automatic updates
    cat > /etc/apt/apt.conf.d/20auto-upgrades << EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

    success "Automatic security updates enabled"
}

show_summary() {
    echo ""
    echo "============================================================================="
    echo "                        SETUP COMPLETE!"
    echo "============================================================================="
    echo ""
    echo "Your Vultr server is now ready for Schlep Engine deployment!"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. EDIT ENVIRONMENT FILE:"
    echo "   su - $DEPLOY_USER"
    echo "   cd $PROJECT_NAME"
    echo "   nano infrastructure/vultr/.env.production"
    echo ""
    echo "2. CONFIGURE CLOUDFLARE:"
    echo "   Follow instructions in infrastructure/vultr/cloudflare-setup.md"
    echo ""
    echo "3. DEPLOY APPLICATION:"
    echo "   ./infrastructure/vultr/deploy.sh"
    echo ""
    echo "4. INSTALL CLAUDE CODE:"
    echo "   Follow instructions in infrastructure/vultr/claude-code-setup.md"
    echo ""
    echo "Useful commands (as deploy user):"
    echo "   sl-deploy    - Deploy/update the application"
    echo "   sl-logs      - View application logs"
    echo "   sl-status    - Show container status"
    echo "   sl-restart   - Restart services"
    echo "   status       - Show system status"
    echo ""
    echo "Security:"
    echo "   - UFW firewall is enabled (ports 22, 80, 443)"
    echo "   - Fail2ban is protecting against brute force"
    echo "   - Automatic security updates are enabled"
    echo ""
    echo "Server Info:"
    echo "   - Deploy user: $DEPLOY_USER"
    echo "   - Project path: /home/$DEPLOY_USER/$PROJECT_NAME"
    echo "   - Docker and Docker Compose installed"
    echo "   - Node.js and Yarn installed"
    echo ""
}

main() {
    echo "==============================================================================="
    echo "                    HETZNER SERVER SETUP SCRIPT"
    echo "                         for Schlep Engine"
    echo "==============================================================================="
    echo ""
    echo "This script will:"
    echo "  - Update system and install essential packages"
    echo "  - Configure firewall and security"
    echo "  - Create deploy user"
    echo "  - Install Docker and Docker Compose"
    echo "  - Install Node.js"
    echo "  - Clone your repository"
    echo "  - Set up monitoring and log rotation"
    echo "  - Create deployment aliases"
    echo ""
    
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    echo "Starting setup..."
    echo ""
    
    check_root
    update_system
    configure_firewall
    configure_fail2ban
    create_deploy_user
    install_docker
    install_docker_compose
    install_nodejs
    clone_repository
    setup_log_rotation
    setup_system_monitoring
    create_deployment_aliases
    setup_automatic_updates
    show_summary
    
    success "🎉 Server setup completed successfully!"
}

main "$@"