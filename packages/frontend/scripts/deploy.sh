#!/bin/bash

# =============================================================================
# Schlep-engine AI PLATFORM - DEPLOYMENT SCRIPT
# =============================================================================
# Usage: ./scripts/deploy.sh [environment]
# Environments: development, staging, production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-staging}

echo -e "${BLUE} Schlep-engine AI Platform Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo "=============================================="

# Validate environment
case $ENVIRONMENT in
  development|staging|production)
    echo -e "${GREEN} Valid environment: $ENVIRONMENT${NC}"
    ;;
  *)
    echo -e "${RED} Invalid environment: $ENVIRONMENT${NC}"
    echo "Valid environments: development, staging, production"
    exit 1
    ;;
esac

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED} Error: package.json not found. Run this script from the sherringford-web directory.${NC}"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}WARNING  Vercel CLI not found. Installing...${NC}"
    pnpm add -g vercel@latest
fi

# Pre-deployment checks
echo -e "${BLUE}🔍 Running pre-deployment checks...${NC}"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW} Installing dependencies...${NC}"
    pnpm install --frozen-lockfile
fi

# Run type checking
echo -e "${BLUE}🔍 Type checking...${NC}"
if ! pnpm type-check; then
    echo -e "${RED} Type check failed${NC}"
    exit 1
fi

# Run linting
echo -e "${BLUE}🧹 Linting...${NC}"
if ! pnpm lint; then
    echo -e "${RED} Linting failed${NC}"
    exit 1
fi

# Build the project
echo -e "${BLUE}BUILD  Building project...${NC}"
if ! pnpm build; then
    echo -e "${RED} Build failed${NC}"
    exit 1
fi

echo -e "${GREEN} All pre-deployment checks passed${NC}"

# Deploy based on environment
case $ENVIRONMENT in
  development)
    echo -e "${BLUE} Deploying to development (preview)...${NC}"
    vercel --confirm
    ;;
  staging)
    echo -e "${BLUE} Deploying to staging (preview)...${NC}"
    vercel --confirm
    ;;
  production)
    echo -e "${YELLOW}WARNING  Deploying to PRODUCTION...${NC}"
    read -p "Are you sure you want to deploy to production? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        vercel --prod --confirm
        echo -e "${GREEN} Production deployment completed${NC}"
        
        # Optional: Run post-deployment health check
        echo -e "${BLUE}🏥 Running health check...${NC}"
        sleep 10
        
        # Add your production URL here
        PROD_URL="https://Schlep-engine.vercel.app"
        if curl -f -s "$PROD_URL" > /dev/null; then
            echo -e "${GREEN} Health check passed${NC}"
        else
            echo -e "${RED} Health check failed${NC}"
        fi
    else
        echo -e "${YELLOW}WARNING  Production deployment cancelled${NC}"
        exit 1
    fi
    ;;
esac

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "==============================================" 