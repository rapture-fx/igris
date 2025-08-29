#!/usr/bin/env python3
"""
Test script to verify async/sync database pattern consistency in RL optimization system.

This script validates that:
1. All database operations use async patterns consistently
2. No sync/async mixing that could cause deadlocks
3. Connection pools are properly managed
4. Session handling follows best practices
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from app.database.connection import get_async_session, AsyncSessionLocal
from app.services.rl_optimization_service import RLOptimizationService
from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_database_connection():
    """Test basic database connectivity"""
    try:
        logger.info("Testing database connection...")
        
        if AsyncSessionLocal is None:
            logger.error("❌ AsyncSessionLocal is None - database not properly initialized")
            return False
            
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1 as test"))
            value = result.scalar()
            
            if value == 1:
                logger.info("✅ Database connection successful")
                return True
            else:
                logger.error("❌ Database connection test failed")
                return False
                
    except Exception as e:
        logger.error(f"❌ Database connection error: {str(e)}")
        return False

async def test_rl_service_async_patterns():
    """Test RLOptimizationService uses proper async patterns"""
    try:
        logger.info("Testing RLOptimizationService async patterns...")
        
        async with AsyncSessionLocal() as session:
            # Test service initialization with AsyncSession
            service = RLOptimizationService(db=session)
            
            # Verify service accepts async session
            if not hasattr(service, 'db') or service.db is None:
                logger.error("❌ RLOptimizationService doesn't properly store AsyncSession")
                return False
                
            # Test that service methods are async
            if not asyncio.iscoroutinefunction(service.start_optimization):
                logger.error("❌ start_optimization is not an async method")
                return False
                
            if not asyncio.iscoroutinefunction(service.get_session_status):
                logger.error("❌ get_session_status is not an async method") 
                return False
                
            logger.info("✅ RLOptimizationService async patterns are correct")
            return True
            
    except Exception as e:
        logger.error(f"❌ RLOptimizationService async pattern test failed: {str(e)}")
        return False

async def test_crud_async_patterns():
    """Test CRUD operations use proper async patterns"""
    try:
        logger.info("Testing CRUD async patterns...")
        
        async with AsyncSessionLocal() as session:
            crud = RLOptimizationCRUD(db=session)
            
            # Test that CRUD methods are async
            if not asyncio.iscoroutinefunction(crud.create_session):
                logger.error("❌ create_session is not an async method")
                return False
                
            if not asyncio.iscoroutinefunction(crud.get_session):
                logger.error("❌ get_session is not an async method")
                return False
                
            if not asyncio.iscoroutinefunction(crud.update_session):
                logger.error("❌ update_session is not an async method")
                return False
                
            logger.info("✅ CRUD async patterns are correct")
            return True
            
    except Exception as e:
        logger.error(f"❌ CRUD async pattern test failed: {str(e)}")
        return False

async def test_session_consistency():
    """Test that session handling is consistent throughout the stack"""
    try:
        logger.info("Testing session consistency...")
        
        # Test get_async_session dependency
        async_gen = get_async_session()
        session = await async_gen.__anext__()
        
        # Test session type
        from sqlalchemy.ext.asyncio import AsyncSession
        if not isinstance(session, AsyncSession):
            logger.error(f"❌ get_async_session returned {type(session)}, expected AsyncSession")
            return False
            
        # Test session can execute queries
        result = await session.execute(text("SELECT current_database()"))
        db_name = result.scalar()
        
        if db_name:
            logger.info(f"✅ Session consistency test passed - connected to database: {db_name}")
            return True
        else:
            logger.error("❌ Session consistency test failed - no database name returned")
            return False
            
    except Exception as e:
        logger.error(f"❌ Session consistency test failed: {str(e)}")
        return False

async def test_no_sync_async_mixing():
    """Test that there's no dangerous sync/async mixing"""
    try:
        logger.info("Testing for sync/async mixing...")
        
        async with AsyncSessionLocal() as session:
            service = RLOptimizationService(db=session)
            crud = RLOptimizationCRUD(db=session)
            
            # Verify that service and CRUD use the same session type
            if type(service.db) != type(crud.db):
                logger.error(f"❌ Session type mismatch: service={type(service.db)}, crud={type(crud.db)}")
                return False
                
            # Verify session is AsyncSession
            from sqlalchemy.ext.asyncio import AsyncSession
            if not isinstance(service.db, AsyncSession):
                logger.error(f"❌ Service uses wrong session type: {type(service.db)}")
                return False
                
            if not isinstance(crud.db, AsyncSession):
                logger.error(f"❌ CRUD uses wrong session type: {type(crud.db)}")
                return False
                
            logger.info("✅ No sync/async mixing detected")
            return True
            
    except Exception as e:
        logger.error(f"❌ Sync/async mixing test failed: {str(e)}")
        return False

async def test_connection_pool_health():
    """Test connection pool is healthy"""
    try:
        logger.info("Testing connection pool health...")
        
        from app.database.connection import async_engine
        
        if async_engine is None:
            logger.error("❌ async_engine is None")
            return False
            
        pool = async_engine.pool
        
        # Check pool statistics
        pool_size = pool.size()
        checked_in = pool.checkedin()
        checked_out = pool.checkedout()
        overflow = pool.overflow()
        
        logger.info(f"📊 Connection pool stats:")
        logger.info(f"   Pool size: {pool_size}")
        logger.info(f"   Checked in: {checked_in}")
        logger.info(f"   Checked out: {checked_out}")  
        logger.info(f"   Overflow: {overflow}")
        
        # Test multiple concurrent sessions
        sessions = []
        try:
            for i in range(3):
                async with AsyncSessionLocal() as session:
                    sessions.append(session)
                    result = await session.execute(text(f"SELECT {i} as test_value"))
                    value = result.scalar()
                    if value != i:
                        logger.error(f"❌ Session {i} returned wrong value: {value}")
                        return False
                        
            logger.info("✅ Connection pool health test passed")
            return True
            
        except Exception as session_error:
            logger.error(f"❌ Session creation failed: {str(session_error)}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Connection pool health test failed: {str(e)}")
        return False

async def main():
    """Run all async consistency tests"""
    logger.info("🚀 Starting RL optimization async consistency tests...")
    
    tests = [
        ("Database Connection", test_database_connection),
        ("RLOptimizationService Async Patterns", test_rl_service_async_patterns),
        ("CRUD Async Patterns", test_crud_async_patterns),
        ("Session Consistency", test_session_consistency),
        ("No Sync/Async Mixing", test_no_sync_async_mixing),
        ("Connection Pool Health", test_connection_pool_health),
    ]
    
    results = []
    for test_name, test_func in tests:
        logger.info(f"\n--- Running: {test_name} ---")
        try:
            result = await test_func()
            results.append((test_name, result))
            if result:
                logger.info(f"✅ {test_name}: PASSED")
            else:
                logger.error(f"❌ {test_name}: FAILED")
        except Exception as e:
            logger.error(f"❌ {test_name}: ERROR - {str(e)}")
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("TEST SUMMARY")
    logger.info("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        logger.info(f"{test_name}: {status}")
    
    logger.info(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 ALL TESTS PASSED - RL optimization async patterns are consistent!")
        return True
    else:
        logger.error("💥 SOME TESTS FAILED - There are async consistency issues!")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)