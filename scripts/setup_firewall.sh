#!/bin/bash
# Firewall configuration script for Schlep Engine

set -e

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Setting up firewall rules for Schlep Engine..."

# Reset UFW to defaults
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (be careful not to lock yourself out!)
ufw allow 22/tcp comment "SSH"

# Allow HTTP and HTTPS (Nginx)
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Allow application ports (only if needed for direct access)
# In production, these should be blocked and only accessible via Nginx
ufw allow 8000/tcp comment "API (remove in production)"
ufw allow 3000/tcp comment "Frontend (remove in production)"

# Allow monitoring ports (restrict to specific IPs in production)
ufw allow 9090/tcp comment "Prometheus (restrict IP)"
ufw allow 3001/tcp comment "Grafana Logs (restrict IP)"
ufw allow 3002/tcp comment "Grafana Metrics (restrict IP)"

# Rate limiting for SSH (prevent brute force)
ufw limit ssh comment "SSH rate limiting"

# Enable UFW
ufw --force enable

log "Firewall rules configured successfully"

# Display status
ufw status numbered

log "IMPORTANT: In production, restrict monitoring ports to specific IPs:"
log "ufw delete allow 9090/tcp"
log "ufw allow from YOUR_IP to any port 9090"