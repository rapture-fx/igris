#!/bin/bash
set -x
cd "/Users/wira/Desktop/schlep-engine"

# Clean server startup script for Schlep Engine
echo "Starting Schlep Engine servers..."

# Start landing page
echo "Starting landing page on port 3000..."
(cd apps/web-landing && pnpm run dev > ../web-landing/landing.log 2>&1) &
LANDING_PID=$!

# Start console
echo "Starting console on port 3004..."
(cd apps/web-console && pnpm run dev > ../web-console/console.log 2>&1) &
CONSOLE_PID=$!

# Start docs
echo "Starting docs on port 3005..."
(cd apps/web-docs && pnpm run dev > ../web-docs/docs.log 2>&1) &
DOCS_PID=$!

echo "Waiting for servers to start..."
sleep 8

# Check if servers are running
if curl -s http://localhost:3000 > /dev/null; then
    echo "Landing page running: http://localhost:3000"
else
    echo "❌ Landing page failed to start"
fi

if curl -s http://localhost:3004 > /dev/null; then
    echo "Console running: http://localhost:3004"
else
    echo "❌ Console failed to start"
fi

if curl -s http://localhost:3005 > /dev/null; then
    echo "Docs running: http://localhost:3005"
else
    echo "❌ Docs failed to start"
fi

echo ""
echo "Servers started! Press Ctrl+C to stop all servers."
echo ""

# Keep script running and handle Ctrl+C
trap 'echo ""; echo "Stopping servers..."; kill $LANDING_PID $CONSOLE_PID $DOCS_PID 2>/dev/null; exit 0' INT

# Wait for any process to finish
wait