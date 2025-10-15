#!/bin/bash

# 🧪 Integration Test Script
# This script runs end-to-end integration tests for the frontend

echo " Starting integration tests..."

# Navigate to frontend directory
cd "$(dirname "$0")/.."

# Check if backend is running
echo "🔍 Checking backend health..."
if curl -s http://127.0.0.1:8000/health > /dev/null; then
    echo " Backend is running"
else
    echo " Backend is not running. Please start the backend server first."
    exit 1
fi

# Check if frontend is running
echo "🔍 Checking frontend health..."
if curl -s http://localhost:3000 > /dev/null; then
    echo " Frontend is running"
else
    echo " Frontend is not running. Please start the frontend server first."
    exit 1
fi

# Run integration tests
echo "🧪 Running integration tests..."

# Test 1: API Connection
echo "📡 Testing API connection..."
if curl -s http://127.0.0.1:8000/api/v1/health | grep -q "status"; then
    echo " API connection successful"
else
    echo " API connection failed"
    exit 1
fi

# Test 2: Authentication
echo "🔐 Testing authentication..."
if curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' | grep -q "token"; then
    echo " Authentication successful"
else
    echo " Authentication failed"
    exit 1
fi

# Test 3: File Upload
echo "📤 Testing file upload..."
if curl -s -X POST http://127.0.0.1:8000/api/v1/upload/upload \
    -F "file=@test_data.csv" | grep -q "job_id"; then
    echo " File upload successful"
else
    echo " File upload failed"
    exit 1
fi

# Test 4: Job Processing
echo "GEAR Testing job processing..."
JOB_ID=$(curl -s -X POST http://127.0.0.1:8000/api/v1/upload/upload \
    -F "file=@test_data.csv" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$JOB_ID" ]; then
    echo " Job created successfully (ID: $JOB_ID)"
    
    # Wait for job completion
    echo "⏳ Waiting for job completion..."
    for i in {1..30}; do
        STATUS=$(curl -s http://127.0.0.1:8000/api/v1/upload/jobs/$JOB_ID/status | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$STATUS" = "completed" ]; then
            echo " Job completed successfully"
            break
        elif [ "$STATUS" = "failed" ]; then
            echo " Job failed"
            exit 1
        fi
        sleep 1
    done
else
    echo " Job creation failed"
    exit 1
fi

# Test 5: Results Retrieval
echo " Testing results retrieval..."
if curl -s http://127.0.0.1:8000/api/v1/upload/jobs/$JOB_ID/results | grep -q "quality_score"; then
    echo " Results retrieval successful"
else
    echo " Results retrieval failed"
    exit 1
fi

echo "🎉 All integration tests passed successfully!"
echo " Test Summary:"
echo "   API Connection"
echo "   Authentication"
echo "   File Upload"
echo "   Job Processing"
echo "   Results Retrieval" 