#!/usr/bin/env python3
"""
Hybrid Architecture Validation Script
Tests critical components before deployment
"""

import asyncio
import sys
import os
from typing import Dict, Any

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

async def test_imports():
    """Test if all critical modules can be imported"""
    print("🔍 Testing imports...")
    
    try:
        # Test core configuration
        from app.core.unified_config import settings
        print("✅ Unified config imported successfully")
        
        # Test Supabase client
        from app.core.supabase_client import get_supabase_client, check_supabase_health
        print("✅ Supabase client imported successfully")
        
        # Test database connection
        from app.database.connection import async_engine, get_db
        print("✅ Database connection imported successfully")
        
        # Test re-enabled modules
        from app.api.v1 import data_processing, advanced_ai, advanced_ml, data_quality
        print("✅ Core API modules imported successfully")
        
        from app.api.v1.dpa_compliance import router as dpa_router
        print("✅ DPA compliance module imported successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

async def test_configuration():
    """Test configuration setup"""
    print("\n🔍 Testing configuration...")
    
    try:
        from app.core.unified_config import settings
        
        # Test basic config
        print(f"✅ Environment: {settings.ENVIRONMENT}")
        print(f"✅ App version: {settings.PROJECT_VERSION}")
        
        # Test database config
        database_uri = settings.ASYNC_DATABASE_URI
        if database_uri:
            print("✅ Database URI configured")
        else:
            print("❌ Database URI not configured")
            
        # Test Supabase config
        if hasattr(settings, 'SUPABASE_URL') and settings.SUPABASE_URL:
            print("✅ Supabase URL configured")
        else:
            print("⚠️  Supabase URL not configured (will use traditional PostgreSQL)")
            
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

async def test_supabase_connection():
    """Test Supabase connection if configured"""
    print("\n🔍 Testing Supabase connection...")
    
    try:
        from app.core.supabase_client import check_supabase_health, get_supabase_client
        from app.core.unified_config import settings
        
        if not settings.is_supabase_enabled:
            print("⚠️  Supabase not configured, skipping connection test")
            return True
            
        client = get_supabase_client()
        if client:
            print("✅ Supabase client created successfully")
            
            # Test health check
            health = await check_supabase_health()
            if health['status'] == 'healthy':
                print("✅ Supabase connection healthy")
            else:
                print(f"❌ Supabase health check failed: {health.get('error', 'Unknown error')}")
                
        else:
            print("❌ Failed to create Supabase client")
            
        return True
        
    except Exception as e:
        print(f"❌ Supabase connection test failed: {e}")
        return False

async def test_database_connection():
    """Test database connection"""
    print("\n🔍 Testing database connection...")
    
    try:
        from app.database.connection import async_engine
        from app.core.unified_config import settings
        
        if async_engine is None:
            print("❌ Database engine not initialized")
            return False
            
        # Test connection
        async with async_engine.begin() as conn:
            result = await conn.execute("SELECT 1 as test")
            test_value = result.scalar()
            if test_value == 1:
                print("✅ Database connection successful")
                return True
            else:
                print("❌ Database connection failed")
                return False
                
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        return False

async def test_api_routes():
    """Test that FastAPI app can be created with all routes"""
    print("\n🔍 Testing API routes...")
    
    try:
        from app.main import app
        
        # Count routes
        route_count = len([route for route in app.router.routes])
        print(f"✅ FastAPI app created with {route_count} routes")
        
        # Test specific routes exist
        routes = {route.path for route in app.router.routes if hasattr(route, 'path')}
        
        critical_routes = [
            '/api/v1/health',
            '/api/v1/auth',
            '/api/v1/data',
            '/api/v1/ml',
            '/api/v1/quality'
        ]
        
        missing_routes = []
        for route in critical_routes:
            found = any(r.startswith(route) for r in routes)
            if found:
                print(f"✅ Route found: {route}")
            else:
                missing_routes.append(route)
                print(f"❌ Route missing: {route}")
                
        if not missing_routes:
            print("✅ All critical routes available")
            return True
        else:
            print(f"❌ Missing {len(missing_routes)} critical routes")
            return False
            
    except Exception as e:
        print(f"❌ API routes test failed: {e}")
        return False

async def main():
    """Run all validation tests"""
    print("🚀 HYBRID ARCHITECTURE VALIDATION")
    print("=" * 50)
    
    tests = [
        ("Imports", test_imports()),
        ("Configuration", test_configuration()),
        ("Supabase Connection", test_supabase_connection()),
        ("Database Connection", test_database_connection()),
        ("API Routes", test_api_routes())
    ]
    
    results = {}
    
    for test_name, test_coro in tests:
        try:
            result = await test_coro
            results[test_name] = result
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results[test_name] = False
    
    print("\n" + "=" * 50)
    print("📊 VALIDATION SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20} {status}")
    
    print(f"\nResult: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Ready for deployment!")
        return 0
    else:
        print("⚠️  Some tests failed - Review issues before deployment")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)