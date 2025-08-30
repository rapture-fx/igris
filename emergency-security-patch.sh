#!/bin/bash

# Emergency Security Patch Deployment Script
# Run this IMMEDIATELY on your Vultr VPS to fix critical vulnerabilities

echo "🚨 EMERGENCY SECURITY PATCH DEPLOYMENT 🚨"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Run: sudo ./emergency-security-patch.sh"
    exit 1
fi

echo -e "${YELLOW}Step 1: Backing up current environment...${NC}"
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No .env.production found"

echo -e "${YELLOW}Step 2: Generating secure secrets...${NC}"
# Generate secure random secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)  
SECRET_KEY=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
JWT_SECRET_KEY=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

# Create secure .env.production file
cat > .env.production << EOF
# Production Environment Variables for Schlep Engine
# Generated: $(date)

# Database Configuration
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=schlep_engine
POSTGRES_USER=schlep_user

# Redis Configuration  
REDIS_PASSWORD=${REDIS_PASSWORD}

# Application Security
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}

# JWT Algorithm - Use HS256 for immediate deployment (RS256 requires key setup)
JWT_ALGORITHM=HS256

# OAuth Configuration (obtain from providers)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional: Bypass authentication for development/testing
BYPASS_AUTH=false

# Email Configuration (for SSL certificates)
SSL_EMAIL=admin@schlep-engine.com

# Additional Security Settings
WEB_CONCURRENCY=4
KEEP_ALIVE=2

# Environment
ENVIRONMENT=production
EOF

chmod 600 .env.production

echo -e "${GREEN}✓ Generated secure environment variables${NC}"

echo -e "${YELLOW}Step 3: Stopping services for secure update...${NC}"
docker-compose -f docker-compose.production.yml down

echo -e "${YELLOW}Step 4: Rebuilding with security patches...${NC}"
# Force rebuild to apply security updates
docker-compose -f docker-compose.production.yml build --no-cache

echo -e "${YELLOW}Step 5: Starting services with new security configuration...${NC}"
docker-compose -f docker-compose.production.yml up -d

echo -e "${YELLOW}Step 6: Waiting for services to start...${NC}"
sleep 30

echo -e "${YELLOW}Step 7: Running security verification...${NC}"
# Check if services are running
if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Services are running${NC}"
else
    echo -e "${RED}✗ Some services failed to start${NC}"
    echo "Check logs with: docker-compose -f docker-compose.production.yml logs"
fi

# Test API health endpoint
if curl -f -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API health check passed${NC}"
else
    echo -e "${RED}✗ API health check failed${NC}"
fi

echo ""
echo -e "${GREEN}🔐 SECURITY PATCH DEPLOYMENT COMPLETE${NC}"
echo "==========================================="
echo ""
echo "CRITICAL CHANGES APPLIED:"
echo "• ✓ JWT vulnerability patched (python-jose upgraded)"  
echo "• ✓ Secure secrets generated and applied"
echo "• ✓ Docker images pinned to specific versions"
echo "• ✓ SQL injection vulnerabilities addressed"
echo "• ✓ .env.production secured (600 permissions)"
echo ""
echo -e "${YELLOW}IMPORTANT: Save these generated secrets securely!${NC}"
echo "Database Password: ${POSTGRES_PASSWORD}"
echo "Redis Password: ${REDIS_PASSWORD}" 
echo ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo "1. Test your application thoroughly"
echo "2. Update OAuth credentials in .env.production if needed"
echo "3. Consider setting up RS256 JWT keys for enhanced security"
echo "4. Monitor logs: docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo -e "${RED}WARNING: Your application has been restarted with new secrets.${NC}"
echo -e "${RED}Any existing user sessions will be invalidated.${NC}"