#!/bin/bash

# =============================================================================
# Schlep-engine WORKER STOP SCRIPT
# =============================================================================
# This script gracefully stops all Celery workers and related processes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE} Stopping Schlep-engine Celery Workers${NC}"
echo "=============================================="

# Function to stop process by PID file
stop_by_pidfile() {
    local pidfile=$1
    local process_name=$2
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${BLUE} Stopping ${process_name} (PID: ${pid})...${NC}"
            kill -TERM $pid
            
            # Wait for graceful shutdown
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 30 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}  Force killing ${process_name}...${NC}"
                kill -KILL $pid
            fi
            
            echo -e "${GREEN} ${process_name} stopped${NC}"
        else
            echo -e "${YELLOW}  ${process_name} not running (stale PID file)${NC}"
        fi
        rm -f "$pidfile"
    else
        echo -e "${YELLOW}  No PID file found for ${process_name}${NC}"
    fi
}

# Function to kill all celery processes
kill_all_celery() {
    echo -e "${BLUE} Looking for remaining Celery processes...${NC}"
    
    # Find and kill any remaining celery worker processes
    local celery_pids=$(pgrep -f "celery.*worker" 2>/dev/null || true)
    if [ ! -z "$celery_pids" ]; then
        echo -e "${YELLOW}  Found running Celery workers, stopping them...${NC}"
        echo "$celery_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 5
        echo "$celery_pids" | xargs kill -KILL 2>/dev/null || true
        echo -e "${GREEN} Remaining workers stopped${NC}"
    fi
    
    # Find and kill celery beat processes
    local beat_pids=$(pgrep -f "celery.*beat" 2>/dev/null || true)
    if [ ! -z "$beat_pids" ]; then
        echo -e "${YELLOW}  Found running Celery beat, stopping it...${NC}"
        echo "$beat_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 3
        echo "$beat_pids" | xargs kill -KILL 2>/dev/null || true
        echo -e "${GREEN} Beat scheduler stopped${NC}"
    fi
    
    # Find and kill flower processes
    local flower_pids=$(pgrep -f "flower" 2>/dev/null || true)
    if [ ! -z "$flower_pids" ]; then
        echo -e "${YELLOW}  Found running Flower, stopping it...${NC}"
        echo "$flower_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 3
        echo "$flower_pids" | xargs kill -KILL 2>/dev/null || true
        echo -e "${GREEN} Flower monitor stopped${NC}"
    fi
}

# Stop workers by PID files
if [ -d "pids" ]; then
    echo -e "${BLUE} Stopping workers by PID files...${NC}"
    
    stop_by_pidfile "pids/ai_worker.pid" "AI Worker"
    stop_by_pidfile "pids/data_worker_1.pid" "Data Worker 1"
    stop_by_pidfile "pids/data_worker_2.pid" "Data Worker 2"
    stop_by_pidfile "pids/monitoring_worker.pid" "Monitoring Worker"
    stop_by_pidfile "pids/celery_beat.pid" "Celery Beat"
    stop_by_pidfile "pids/flower.pid" "Flower Monitor"
else
    echo -e "${YELLOW}  No pids directory found${NC}"
fi

# Kill any remaining processes
kill_all_celery

# Clean up
echo -e "${BLUE} Cleaning up...${NC}"
rm -rf pids/*.pid 2>/dev/null || true
rm -f celerybeat-schedule 2>/dev/null || true

echo ""
echo -e "${GREEN} All workers stopped successfully!${NC}"
echo ""
echo -e "${BLUE} Process Status:${NC}"
echo "   • Worker processes: Stopped"
echo "   • Beat scheduler: Stopped"
echo "   • Flower monitor: Stopped"
echo "   • PID files: Cleaned up"
echo ""
echo -e "${BLUE} To start workers again:${NC}"
echo "   ./scripts/start_workers.sh" 