#!/bin/bash

#  Environment Setup Script
# This script sets up the necessary environment configuration for the frontend

echo " Setting up environment configuration..."

# Navigate to frontend directory
cd "$(dirname "$0")/.."

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo " Creating .env.local file..."
    cat > .env.local << EOL
# API Configuration
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_VERSION=v1

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEMO_MODE=true

# Performance
NEXT_PUBLIC_MAX_UPLOAD_SIZE=100
NEXT_PUBLIC_MAX_CONCURRENT_UPLOADS=5

# UI Configuration
NEXT_PUBLIC_APP_NAME=Sherringfords
NEXT_PUBLIC_APP_DESCRIPTION="AI-Powered Data Intelligence Platform"
EOL
    echo " .env.local created successfully"
else
    echo "INFO  .env.local already exists"
fi

# Create .env.development if it doesn't exist
if [ ! -f .env.development ]; then
    echo " Creating .env.development file..."
    cat > .env.development << EOL
# Development Environment Configuration
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_VERSION=v1
EOL
    echo " .env.development created successfully"
else
    echo "INFO  .env.development already exists"
fi

# Create .env.production if it doesn't exist
if [ ! -f .env.production ]; then
    echo " Creating .env.production file..."
    cat > .env.production << EOL
# Production Environment Configuration
NODE_ENV=production
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_API_URL=https://api.sherringfords.com
NEXT_PUBLIC_API_VERSION=v1
EOL
    echo " .env.production created successfully"
else
    echo "INFO  .env.production already exists"
fi

echo "🎉 Environment setup complete!"
echo " Please review and adjust the environment files as needed:"
echo "   - .env.local (local development)"
echo "   - .env.development (development environment)"
echo "   - .env.production (production environment)" 