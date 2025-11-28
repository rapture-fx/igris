#!/bin/bash
# DRAGONFLY PRODUCTION DEPLOYMENT SCRIPT
# Deploys Dragonfly to production with monitoring and safety checks
# Run ONLY after verification passed 100%

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "DRAGONFLY PRODUCTION DEPLOYMENT"
echo "=========================================="
echo ""

# Safety check: Require explicit confirmation
echo -e "${YELLOW}WARNING: This will deploy Dragonfly to production${NC}"
echo ""
echo "Prerequisites:"
echo "  ✓ Verification passed 100% (Phase 1 complete)"
echo "  ✓ All tests passing"
echo "  ✓ Production backups taken"
echo ""
read -p "Have you completed all prerequisites? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 1
fi

echo ""
echo "Step 1: Pre-deployment checks"
echo "------------------------------"

# Check if docker-compose.production.yml exists
if [ ! -f "docker-compose.production.yml" ]; then
    echo -e "${RED}ERROR: docker-compose.production.yml not found${NC}"
    exit 1
fi

# Check if in correct directory
if [ ! -f "go.mod" ]; then
    echo -e "${RED}ERROR: Must run from project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

echo "Step 2: Build updated application"
echo "----------------------------------"
docker-compose -f docker-compose.production.yml build api
echo -e "${GREEN}✓ Application built successfully${NC}"
echo ""

echo "Step 3: Deploy Dragonfly"
echo "------------------------"
echo "Starting Dragonfly cache service..."
docker-compose -f docker-compose.production.yml up -d cache

# Wait for Dragonfly to be healthy
echo "Waiting for Dragonfly to be healthy (30s)..."
sleep 30

# Verify Dragonfly is running
if ! docker exec schlep-dragonfly redis-cli -a "${REDIS_PASSWORD:-changeme}" ping > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Dragonfly is not responding${NC}"
    echo "Rolling back..."
    docker-compose -f docker-compose.production.yml down cache
    exit 1
fi

echo -e "${GREEN}✓ Dragonfly is healthy${NC}"
echo ""

echo "Step 4: Deploy updated API"
echo "---------------------------"
echo "Restarting API with Dragonfly connection..."
docker-compose -f docker-compose.production.yml up -d api

# Wait for API to start
echo "Waiting for API to start (30s)..."
sleep 30

# Verify API health
if ! curl -f http://localhost:${API_PORT:-8080}/healthz > /dev/null 2>&1; then
    echo -e "${RED}ERROR: API health check failed${NC}"
    echo "Check logs: docker logs schlep-api"
    echo ""
    echo "MANUAL INTERVENTION REQUIRED"
    echo "Run rollback script if needed: ./scripts/rollback_dragonfly.sh"
    exit 1
fi

echo -e "${GREEN}✓ API is healthy${NC}"
echo ""

echo "=========================================="
echo "DEPLOYMENT SUCCESSFUL"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. MONITOR for 30 minutes (critical window):"
echo "   - Error rate: must be <0.1%"
echo "   - Latency P95: must be ≤ Redis baseline"
echo "   - Connection pool: no timeouts"
echo "   - Memory usage: stable (no leaks)"
echo ""
echo "2. Check application logs:"
echo "   docker logs -f schlep-api"
echo ""
echo "3. Check Dragonfly logs:"
echo "   docker logs -f schlep-dragonfly"
echo ""
echo "4. Monitor metrics (if enabled):"
echo "   http://localhost:9090 (Prometheus)"
echo "   http://localhost:3000 (Grafana)"
echo ""
echo "5. Test critical features:"
echo "   - Budget tracking"
echo "   - Rate limiting"
echo "   - Speculative execution"
echo "   - Council mode"
echo "   - EscapeVector mode"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "  - If ANY issue detected, run: ./scripts/rollback_dragonfly.sh"
echo "  - Monitor for 30 minutes before declaring success"
echo "  - Keep this terminal open for quick rollback access"
echo ""
echo "=========================================="
echo ""
echo -e "${GREEN}Deployment timestamp: $(date)${NC}"
echo ""
