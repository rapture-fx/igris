#!/bin/bash

# =============================================================================
# POLLARBASE WORKER MANAGEMENT SCRIPT
# =============================================================================
# This script starts optimized Celery workers for the Pollarbase platform
# with performance enhancements and monitoring capabilities.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_APP="app.core.celery_app"
LOG_LEVEL="info"
MAX_WORKERS=4
REDIS_URL="redis://localhost:6379/0"

echo -e "${BLUE}Starting Pollarbase Celery Workers${NC}"
echo "=============================================="

# Check if Redis is running
echo -e "${BLUE}Checking Redis connection...${NC}"
if redis-cli -u $REDIS_URL ping > /dev/null 2>&1; then
    echo -e "${GREEN}Redis is running${NC}"
else
    echo -e "${RED}Redis is not running. Please start Redis first.${NC}"
    echo "   sudo service redis-server start"
    exit 1
fi

# Check if virtual environment is activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo -e "${YELLOW}Warning: No virtual environment detected${NC}"
    echo "   Consider activating your virtual environment"
fi

# Function to start a worker
start_worker() {
    local worker_name=$1
    local queue=$2
    local concurrency=$3
    local log_file="logs/worker_${worker_name}.log"
    
    echo -e "${BLUE} Starting worker: ${worker_name} (Queue: ${queue}, Concurrency: ${concurrency})${NC}"
    
    # Create logs directory if it doesn't exist
    mkdir -p logs
    
    # Start worker in background
    celery -A $WORKER_APP worker \
        --loglevel=$LOG_LEVEL \
        --concurrency=$concurrency \
        --hostname="${worker_name}@%h" \
        --queues=$queue \
        --logfile=$log_file \
        --pidfile="pids/${worker_name}.pid" \
        --max-tasks-per-child=1000 \
        --optimization=fair \
        --without-gossip \
        --without-mingle \
        --without-heartbeat \
        --detach
    
    echo -e "${GREEN} Worker ${worker_name} started${NC}"
}

# Function to start beat scheduler
start_beat() {
    echo -e "${BLUE} Starting Celery Beat scheduler...${NC}"
    
    mkdir -p logs pids
    
    celery -A $WORKER_APP beat \
        --loglevel=$LOG_LEVEL \
        --logfile=logs/celery_beat.log \
        --pidfile=pids/celery_beat.pid \
        --detach
    
    echo -e "${GREEN} Celery Beat started${NC}"
}

# Function to start flower monitoring
start_flower() {
    echo -e "${BLUE} Starting Flower monitoring (optional)...${NC}"
    
    if command -v flower &> /dev/null; then
        mkdir -p logs pids
        
        flower -A $WORKER_APP \
            --port=5555 \
            --basic_auth=admin:pollarbase123 \
            --logging=info \
            --logfile=logs/flower.log \
            --pidfile=pids/flower.pid \
            &
        
        echo -e "${GREEN} Flower started on http://localhost:5555${NC}"
        echo -e "${YELLOW}   Username: admin, Password: pollarbase123${NC}"
    else
        echo -e "${YELLOW}  Flower not installed. Skipping monitoring.${NC}"
        echo "   Install with: pip install flower"
    fi
}

# Create necessary directories
mkdir -p logs pids

# Start workers with different configurations
echo -e "${BLUE}🏭 Starting worker pool...${NC}"

# High-priority AI processing worker (1 worker, high memory)
start_worker "ai_worker" "ai_processing" 2

# Medium-priority data processing workers (2 workers, balanced)
start_worker "data_worker_1" "data_processing" 2
start_worker "data_worker_2" "data_processing" 2

# Low-priority monitoring and maintenance worker (1 worker, low resources)
start_worker "monitoring_worker" "monitoring,default" 1

# Start beat scheduler for periodic tasks
start_beat

# Start flower monitoring (optional)
start_flower

echo ""
echo -e "${GREEN} All workers started successfully!${NC}"
echo ""
echo -e "${BLUE} Worker Status:${NC}"
echo "   • AI Processing Worker: 2 processes (high memory)"
echo "   • Data Processing Workers: 4 processes (balanced)"
echo "   • Monitoring Worker: 1 process (maintenance)"
echo "   • Beat Scheduler: Periodic tasks"
echo "   • Flower Monitor: http://localhost:5555"
echo ""
echo -e "${BLUE} Log Files:${NC}"
echo "   • Worker logs: logs/worker_*.log"
echo "   • Beat log: logs/celery_beat.log"
echo "   • Flower log: logs/flower.log"
echo ""
echo -e "${BLUE}  Management Commands:${NC}"
echo "   • Check status: ./scripts/worker_status.sh"
echo "   • Stop workers: ./scripts/stop_workers.sh"
echo "   • Monitor workers: celery -A $WORKER_APP inspect active"
echo ""
echo -e "${YELLOW} Performance Tips:${NC}"
echo "   • Monitor memory usage with: htop or ps aux | grep celery"
echo "   • Check queue lengths: celery -A $WORKER_APP inspect reserved"
echo "   • View worker statistics: celery -A $WORKER_APP inspect stats" 