#!/bin/bash

# Schlep Engine VPS Deployment Script
# Simple deployment for VPS hosting

set -e

echo "🚀 Starting Schlep Engine VPS deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is required. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is required. Please install Docker Compose first."
    exit 1
fi

# Work from current directory (assuming we're already in the project)
print_status "Working from current directory: $(pwd)"

# Setup environment file
if [ ! -f ".env" ]; then
    print_status "Creating environment file from template..."
    if [ -f "env.production.template" ]; then
        cp env.production.template .env
        print_warning "Please edit .env file with your configuration"
    else
        print_error ".env file and template not found. Please create .env manually."
        exit 1
    fi
else
    print_status "Environment file already exists"
fi

# Pull latest images and deploy
print_status "Pulling latest images..."
docker-compose -f docker-compose.production.yml pull

print_status "Building and starting services..."
docker-compose -f docker-compose.production.yml up -d --build

# Wait for services to start
print_status "Waiting for services to start..."
sleep 15

# Check service health
print_status "Checking service status..."
docker-compose -f docker-compose.production.yml ps

print_status "Deployment completed!"
print_status "Services are running on your VPS"

# Show running services
echo ""
echo "📋 Running services:"
docker-compose -f docker-compose.production.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"