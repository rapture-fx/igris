#!/bin/bash

# Quick deployment script for Schlep Engine
# Run this on your local machine to deploy to VPS

VPS_IP="45.77.44.216"
PROJECT_DIR="/opt/igris-inertial"

echo "🚀 Deploying Schlep Engine to VPS ($VPS_IP)..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Upload files to VPS
print_status "Uploading deployment files to VPS..."
rsync -avz --progress \
    --include="docker-compose.production.yml" \
    --include=".env.production" \
    --include="deploy.sh" \
    --include="ssl-setup.sh" \
    --include="nginx/" \
    --include="DEPLOYMENT_GUIDE.md" \
    --include="apps/*/Dockerfile*" \
    --include="apps/api/" \
    --include="apps/web-*/" \
    --exclude="node_modules/" \
    --exclude="venv/" \
    --exclude="__pycache__/" \
    --exclude=".next/" \
    --exclude="*.log" \
    ./ root@$VPS_IP:/tmp/igris-inertial-deploy/

# Step 2: Execute deployment on VPS
print_status "Executing deployment on VPS..."
ssh root@$VPS_IP << 'ENDSSH'
    set -e
    
    # Create project directory
    mkdir -p /opt/igris-inertial
    
    # Copy files
    cp -r /tmp/igris-inertial-deploy/* /opt/igris-inertial/
    cd /opt/igris-inertial
    
    # Make scripts executable
    chmod +x deploy.sh ssl-setup.sh
    
    # Run deployment
    ./deploy.sh
    
    echo ""
    echo "🎉 Deployment completed!"
    echo "📋 Next steps:"
    echo "   1. Edit /opt/igris-inertial/.env with your OAuth credentials"
    echo "   2. Run: cd /opt/igris-inertial && ./ssl-setup.sh"
    echo "   3. Run: docker-compose restart"
ENDSSH

print_status "Deployment script completed!"
print_warning "Don't forget to configure OAuth credentials and run SSL setup!"

echo ""
echo "🌐 Your applications will be available at:"
echo "   Main Site: https://igris-inertial.com"
echo "   API: https://api.igris-inertial.com"  
echo "   Admin: https://admin.igris-inertial.com"
echo "   Docs: https://docs.igris-inertial.com"