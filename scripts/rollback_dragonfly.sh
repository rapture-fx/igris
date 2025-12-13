#!/bin/bash
# EMERGENCY ROLLBACK SCRIPT
# Rolls back Dragonfly deployment to Redis
# Use ONLY if issues detected during monitoring window

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "EMERGENCY ROLLBACK TO REDIS"
echo "=========================================="
echo ""

echo -e "${RED}WARNING: This will rollback to Redis${NC}"
echo ""
read -p "Are you sure you want to rollback? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "Step 1: Checking current state"
echo "-------------------------------"

# Check if Dragonfly is running
if docker ps | grep -q schlep-dragonfly; then
    echo -e "${YELLOW}Dragonfly is currently running${NC}"
else
    echo -e "${YELLOW}Dragonfly is not running${NC}"
fi

echo ""
echo "Step 2: Stop current services"
echo "------------------------------"
docker-compose -f docker-compose.production.yml down cache api
echo -e "${GREEN}✓ Services stopped${NC}"
echo ""

echo "Step 3: Restore docker-compose.production.yml to Redis"
echo "-------------------------------------------------------"

# Create backup of current file
cp docker-compose.production.yml docker-compose.production.yml.dragonfly.bak
echo "Created backup: docker-compose.production.yml.dragonfly.bak"

# Restore Redis configuration
cat > docker-compose.production.yml.redis.tmp <<'EOF'
  # Redis Cache
  cache:
    image: redis:7-alpine
    container_name: schlep-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-changeme}
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-changeme}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - schlep-network
EOF

echo -e "${YELLOW}Manual step required:${NC}"
echo "1. Edit docker-compose.production.yml"
echo "2. Replace the 'cache' service with Redis configuration"
echo "3. Change volumes section: dragonfly_data -> redis_data"
echo ""
echo "Redis config saved to: docker-compose.production.yml.redis.tmp"
echo ""
read -p "Press ENTER after manually updating docker-compose.production.yml..."

echo ""
echo "Step 4: Restore redis_pool.go to original settings"
echo "---------------------------------------------------"

# Create backup
cp internal/cache/redis_pool.go internal/cache/redis_pool.go.dragonfly.bak
echo "Created backup: internal/cache/redis_pool.go.dragonfly.bak"

# Restore original pool settings
sed -i.bak 's/MinIdleConns:     100/MinIdleConns:     10/' internal/cache/redis_pool.go
sed -i.bak 's/MaxActiveConns:   500/MaxActiveConns:   100/' internal/cache/redis_pool.go
echo -e "${GREEN}✓ Pool settings restored to Redis defaults${NC}"
echo ""

echo "Step 5: Rebuild and deploy with Redis"
echo "--------------------------------------"
docker-compose -f docker-compose.production.yml build api
docker-compose -f docker-compose.production.yml up -d cache
sleep 10
docker-compose -f docker-compose.production.yml up -d api
sleep 20

echo ""
echo "Step 6: Verify health"
echo "---------------------"

# Check Redis
if docker exec schlep-redis redis-cli -a "${REDIS_PASSWORD:-changeme}" ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
else
    echo -e "${RED}✗ Redis health check failed${NC}"
    exit 1
fi

# Check API
if curl -f http://localhost:${API_PORT:-8080}/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${RED}✗ API health check failed${NC}"
    echo "Check logs: docker logs igris-overture"
    exit 1
fi

echo ""
echo "=========================================="
echo "ROLLBACK SUCCESSFUL"
echo "=========================================="
echo ""
echo "System has been rolled back to Redis."
echo ""
echo "Next steps:"
echo "1. Monitor application logs: docker logs -f igris-overture"
echo "2. Check Redis logs: docker logs -f schlep-redis"
echo "3. Verify critical features are working"
echo "4. Review what went wrong before attempting Dragonfly again"
echo ""
echo "Backups created:"
echo "  - docker-compose.production.yml.dragonfly.bak"
echo "  - internal/cache/redis_pool.go.dragonfly.bak"
echo ""
echo -e "${GREEN}Rollback completed at: $(date)${NC}"
echo ""
