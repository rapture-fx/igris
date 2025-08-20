#!/bin/bash

cd "/Users/wira/Desktop/schlep-engine"

echo "Starting Schlep Engine servers..."

# Start backend API
echo "🔌 Starting backend API on port 8000..."
(cd "apps/api" && source venv/bin/activate && uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 > api.log 2>&1) &
BACKEND_PID=$!

# Start landing page
echo "Starting landing page on port 3000..."
(cd "apps/web-landing" && pnpm dev > landing.log 2>&1) &
LANDING_PID=$!

# Start docs
echo "Starting docs on port 3003..."
(cd "apps/web-docs" && pnpm dev > docs.log 2>&1) &
DOCS_PID=$!

# Start admin
echo "Starting admin on port 3002..."
(cd "apps/web-admin" && pnpm dev > admin.log 2>&1) &
ADMIN_PID=$!

echo "Waiting for servers to start..."
sleep 10

# Check if servers are running
echo ""
echo "Checking server status..."

if curl -s http://localhost:8000/health > /dev/null 2>&1 || curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "Backend API running: http://localhost:8000"
else
    echo "❌ Backend API failed to start"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Landing page running: http://localhost:3000"
else
    echo "❌ Landing page failed to start"
fi

if curl -s http://localhost:3003 > /dev/null 2>&1; then
    echo "Docs running: http://localhost:3003"
else
    echo "❌ Docs failed to start"
fi

if curl -s http://localhost:3002 > /dev/null 2>&1; then
    echo "Admin running: http://localhost:3002"
else
    echo "❌ Admin failed to start"
fi

echo ""
echo "Servers started! Access your applications:"
echo "   Landing Page: http://localhost:3000"
echo "   Documentation: http://localhost:3003"
echo "   Admin Dashboard: http://localhost:3002"
echo "   API Backend: http://localhost:8000"
echo ""
echo "Logs are available in:"
echo "   Backend: apps/api/api.log"
echo "   Landing: apps/web-landing/landing.log"
echo "   Docs: apps/web-docs/docs.log"
echo "   Admin: apps/web-admin/admin.log"
echo ""
echo "Press Ctrl+C to stop all servers."

# Keep script running and handle Ctrl+C
trap 'echo ""; echo "Stopping servers..."; kill $BACKEND_PID $LANDING_PID $DOCS_PID $ADMIN_PID 2>/dev/null; exit 0' INT

# Wait for any process to finish
wait
