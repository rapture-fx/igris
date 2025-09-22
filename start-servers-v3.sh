#!/bin/bash
cd "/Users/wira/Desktop/schlep-engine"

# Clean server startup script for Schlep Engine
echo "Starting Schlep Engine servers..."

# Start landing page
echo "Starting landing page on port 3000..."
pnpm --filter @schlep-engine/web-landing dev > apps/web-landing/landing.log 2>&1 &
LANDING_PID=$!

# Start console
echo "Starting console on port 3004..."
pnpm --filter @schlep-engine/web-console dev > apps/web-console/console.log 2>&1 &
CONSOLE_PID=$!

# Start docs
echo "Starting docs on port 3005..."
pnpm --filter @schlep-engine/web-docs dev > apps/web-docs/docs.log 2>&1 &
DOCS_PID=$!

echo "Waiting for servers to start..."
sleep 10

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

# Wait for each process to finish
wait $LANDING_PID
wait $CONSOLE_PID
wait $DOCS_PID
