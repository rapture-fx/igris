#!/bin/bash

cd "/Users/wira/Wira Cursor/Schlep-engine"

# Clean server startup script for Schlep Engine
echo "🚀 Starting Schlep Engine servers..."

# Start landing page
echo "📱 Starting landing page on port 3000..."
cd apps/landing && pnpm dev > ../landing/landing.log 2>&1 &
LANDING_PID=$!

# Start docs
echo "📚 Starting docs on port 3001..."
cd ../docs && pnpm dev > docs.log 2>&1 &
DOCS_PID=$!

# Return to root
cd ../../

echo "⏳ Waiting for servers to start..."
sleep 8

# Check if servers are running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Landing page running: http://localhost:3000"
else
    echo "❌ Landing page failed to start"
fi

if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Docs running: http://localhost:3001"
else
    echo "❌ Docs failed to start"
fi

echo ""
echo "🎉 Servers started! Press Ctrl+C to stop both servers."
echo ""

# Keep script running and handle Ctrl+C
trap 'echo ""; echo "🛑 Stopping servers..."; kill $LANDING_PID $DOCS_PID 2>/dev/null; exit 0' INT

# Wait for any process to finish
wait