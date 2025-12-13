#!/bin/bash

# Schlep Engine Development Server Starter
# This script ensures the dev server runs persistently

PID_FILE="/tmp/igris-inertial-dev.pid"
LOG_FILE="/tmp/igris-inertial-dev.log"
APP_DIR="/Users/wira/Desktop/igris-inertial/web/apps/web-landing"

# Function to check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Function to start the server
start_server() {
    echo "Starting Schlep Engine dev server..."
    cd "$APP_DIR"

    # Start server in background with nohup to survive shell exits
    nohup pnpm --filter @igris-inertial/web-landing dev > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"

    # Wait a moment and check if it started successfully
    sleep 3
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Server started successfully with PID: $PID"
        echo "Logs: $LOG_FILE"
        echo "URL: http://localhost:3000"
        return 0
    else
        echo "❌ Failed to start server"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Function to stop the server
stop_server() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo "Stopping server (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        echo " Server stopped"
    else
        echo " Server is not running"
    fi
}

# Function to restart the server
restart_server() {
    stop_server
    sleep 2
    start_server
}

# Function to show server status
status_server() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo "Server is running (PID: $PID)"
        echo "URL: http://localhost:3000"
        echo "Logs: $LOG_FILE"

        # Show last few log lines
        echo ""
        echo "Recent logs:"
        tail -5 "$LOG_FILE" 2>/dev/null || echo "No logs available"
    else
        echo "❌ Server is not running"
    fi
}

# Main script logic
case "${1:-start}" in
    start)
        if is_running; then
            echo "Server is already running"
            status_server
        else
            start_server
        fi
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        status_server
        ;;
    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "No log file found"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the development server"
        echo "  stop    - Stop the development server"
        echo "  restart - Restart the development server"
        echo "  status  - Show server status"
        echo "  logs    - Follow server logs"
        exit 1
        ;;
esac
