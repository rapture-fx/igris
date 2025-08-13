#!/bin/bash

# Schlep Engine Production Deployment Script
# For VPS: 45.77.44.216
# Domain: schlep-engine.com

set -e

echo "🚀 Starting Schlep Engine deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run with sudo or as root"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    print_status "Docker is already installed"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    print_status "Docker Compose is already installed"
fi

# Create project directory
PROJECT_DIR="/opt/schlep-engine"
print_status "Creating project directory at $PROJECT_DIR..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Clone or update repository
if [ ! -d ".git" ]; then
    print_status "Cloning Schlep Engine repository..."
    git clone https://github.com/wiramahendra/Schlep-engine.git .
else
    print_status "Updating repository..."
    git pull origin main
fi

# Copy production files
print_status "Setting up production configuration..."
cp docker-compose.production.yml docker-compose.yml

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating environment file..."
    cp .env.production .env
    
    # Generate secure passwords
    POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    REDIS_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    SECRET_KEY=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
    
    # Replace placeholders in .env file
    sed -i "s/REPLACE_WITH_SECURE_PASSWORD_32_CHARS_MIN/$POSTGRES_PASS/g" .env
    sed -i "s/REPLACE_WITH_SECURE_PASSWORD_32_CHARS_MIN/$REDIS_PASS/g" .env
    sed -i "s/REPLACE_WITH_SECURE_SECRET_KEY_64_CHARS_MIN/$SECRET_KEY/g" .env
    sed -i "s/REPLACE_WITH_SECURE_JWT_SECRET_64_CHARS_MIN/$JWT_SECRET/g" .env
    
    print_warning "Environment file created with generated passwords."
    print_warning "Please edit .env file and add your OAuth credentials."
else
    print_status "Environment file already exists"
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p certbot/conf certbot/www postgres/init

# Set proper permissions
chown -R 1000:1000 certbot/
chmod -R 755 nginx/

# Build and start services
print_status "Building and starting services..."
docker-compose build
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check service health
print_status "Checking service health..."
docker-compose ps

# Display access information
print_status "Deployment completed!"
echo ""
echo "🌐 Access your applications:"
echo "   Main Site: https://schlep-engine.com"
echo "   API: https://api.schlep-engine.com"
echo "   Admin: https://admin.schlep-engine.com"
echo "   Docs: https://docs.schlep-engine.com"
echo ""
echo "📋 Next steps:"
echo "   1. Configure your OAuth credentials in .env"
echo "   2. Run SSL certificate setup: ./ssl-setup.sh"
echo "   3. Restart services: docker-compose restart"
echo ""
print_warning "Remember to secure your .env file and backup your data!"