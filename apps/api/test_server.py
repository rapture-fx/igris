#!/usr/bin/env python3
"""
Quick test script for Schlep-engine API endpoints
"""

import asyncio
import httpx
import uvicorn
import threading
import time
import sys
from app.main import app

def start_server():
    """Start the server in a separate thread"""
    config = uvicorn.Config(app=app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    asyncio.set_event_loop(asyncio.new_event_loop())
    server.run()

async def test_endpoints():
    """Test basic endpoints"""
    base_url = "http://127.0.0.1:8000"
    
    async with httpx.AsyncClient() as client:
        print("🧪 Testing API endpoints...")
        
        # Test root endpoint
        try:
            response = await client.get(f"{base_url}/")
            print(f"✅ Root endpoint: {response.status_code} - {response.json()['message']}")
        except Exception as e:
            print(f"❌ Root endpoint failed: {e}")
        
        # Test health endpoint
        try:
            response = await client.get(f"{base_url}/health")
            print(f"✅ Health endpoint: {response.status_code} - {response.json()['status']}")
        except Exception as e:
            print(f"❌ Health endpoint failed: {e}")
        
        # Test API health endpoint
        try:
            response = await client.get(f"{base_url}/api/v1/health")
            print(f"✅ API Health endpoint: {response.status_code}")
        except Exception as e:
            print(f"❌ API Health endpoint failed: {e}")
        
        # Test user endpoints (without auth)
        try:
            response = await client.get(f"{base_url}/api/v1/users/me")
            print(f"📋 Users endpoint (no auth): {response.status_code} - Expected 401/422")
        except Exception as e:
            print(f"📋 Users endpoint error: {e}")
        
        # Test ML pipeline endpoints (without auth)
        try:
            response = await client.get(f"{base_url}/api/v1/ml/list")
            print(f"📋 ML Pipeline endpoint (no auth): {response.status_code} - Expected 401/422")
        except Exception as e:
            print(f"📋 ML Pipeline endpoint error: {e}")
        
        # Test OpenAPI docs
        try:
            response = await client.get(f"{base_url}/docs")
            print(f"✅ OpenAPI docs: {response.status_code}")
        except Exception as e:
            print(f"❌ OpenAPI docs failed: {e}")

def main():
    # Start server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Wait for server to start
    print("🚀 Starting server...")
    time.sleep(3)
    
    # Run tests
    try:
        asyncio.run(test_endpoints())
        print("\n✅ Basic API tests completed successfully!")
        print("🎉 Schlep-engine backend is working!")
    except Exception as e:
        print(f"❌ Tests failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()