#!/bin/bash

# SSL Certificate Setup for Schlep Engine
# This script sets up Let's Encrypt certificates for Cloudflare integration

set -e

echo "🔒 Setting up SSL certificates for Schlep Engine..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in project directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the project directory (/opt/schlep-engine)"
    exit 1
fi

# Create initial certificate (dry run first)
print_status "Running dry-run for SSL certificate..."
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@schlep-engine.com \
    --agree-tos \
    --no-eff-email \
    --dry-run \
    -d schlep-engine.com \
    -d api.schlep-engine.com \
    -d admin.schlep-engine.com \
    -d docs.schlep-engine.com

print_status "Dry-run successful. Getting real certificates..."

# Get real certificates
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@schlep-engine.com \
    --agree-tos \
    --no-eff-email \
    -d schlep-engine.com \
    -d api.schlep-engine.com \
    -d admin.schlep-engine.com \
    -d docs.schlep-engine.com

print_status "Certificates obtained successfully!"

# Restart nginx to load certificates
print_status "Restarting nginx to load SSL certificates..."
docker-compose restart nginx

# Set up auto-renewal
print_status "Setting up certificate auto-renewal..."
cat << 'EOF' > /etc/cron.d/certbot-renew
# Renew SSL certificates twice daily
0 12 * * * root cd /opt/schlep-engine && docker-compose run --rm certbot renew --quiet && docker-compose restart nginx
EOF

chmod 644 /etc/cron.d/certbot-renew

print_status "SSL setup completed!"
echo ""
echo "🔒 SSL certificates are now active for:"
echo "   • schlep-engine.com"
echo "   • api.schlep-engine.com"
echo "   • admin.schlep-engine.com"
echo "   • docs.schlep-engine.com"
echo ""
print_status "Certificates will auto-renew twice daily via cron job"