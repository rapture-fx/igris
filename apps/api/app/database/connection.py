from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from fastapi import HTTPException, status
from app.core.unified_config import settings
import logging
import time
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Enhanced performance monitoring
query_performance_metrics = {
    "total_queries": 0,
    "slow_queries": 0,
    "failed_queries": 0,
    "avg_query_time": 0.0,
    "slow_query_threshold": 1.0,  # seconds
    "very_slow_query_threshold": 5.0,  # seconds
    "connection_errors": 0,
    "pool_timeouts": 0,
    "deadlocks": 0
}

# Initialize engines
async_engine: Optional[create_async_engine] = None
engine: Optional[create_engine] = None
SessionLocal: Optional[sessionmaker] = None
AsyncSessionLocal: Optional[async_sessionmaker] = None

def log_slow_query(query_time: float, statement: str):
    """Enhanced slow query logging with severity levels"""
    if query_time > query_performance_metrics["very_slow_query_threshold"]:
        query_performance_metrics["slow_queries"] += 1
        logger.error(f"Very slow query detected ({query_time:.3f}s): {statement[:200]}...")
        # Log full query for very slow ones
        logger.error(f"Full slow query: {statement}")
    elif query_time > query_performance_metrics["slow_query_threshold"]:
        query_performance_metrics["slow_queries"] += 1
        logger.warning(f"Slow query detected ({query_time:.3f}s): {statement[:100]}...")

def setup_performance_monitoring(engine_instance):
    """Set up performance monitoring for an engine instance"""
    @event.listens_for(engine_instance, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Start timing queries"""
        context._query_start_time = time.time()

    @event.listens_for(engine_instance, "after_cursor_execute")
    def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Enhanced query performance tracking with error handling"""
        try:
            total_time = time.time() - context._query_start_time
            query_performance_metrics["total_queries"] += 1
            
            # Update average query time with exponential moving average for better performance
            alpha = 0.01  # Smoothing factor
            current_avg = query_performance_metrics["avg_query_time"]
            query_performance_metrics["avg_query_time"] = alpha * total_time + (1 - alpha) * current_avg
            
            # Log slow queries
            log_slow_query(total_time, statement)
            
            # Detect potential deadlocks
            if "deadlock" in statement.lower() or "could not obtain lock" in statement.lower():
                query_performance_metrics["deadlocks"] += 1
                logger.error(f"Deadlock detected in query: {statement[:200]}...")
                
        except Exception as e:
            logger.error(f"Error in query performance tracking: {e}")

try:
    # Basic connection arguments compatible with asyncpg
    connect_args = {
        "server_settings": {
            "application_name": f"schlep-engine-{settings.ENVIRONMENT}",
        },
        "command_timeout": 60,  # Timeout for commands
    }
    
    # Add SSL configuration for production or Supabase (asyncpg format)
    if settings.ENVIRONMENT == "production" or settings.is_supabase_enabled:
        connect_args.update({
            "ssl": "require",
        })

        # Add client certificates only if they exist (for self-hosted PostgreSQL)
        if not settings.is_supabase_enabled:
            connect_args.update({
                "ssl": {
                    "cert": "/app/certs/client-cert.pem",
                    "key": "/app/certs/client-key.pem",
                    "ca": "/app/certs/ca-cert.pem",
                }
            })
    else:
        connect_args["ssl"] = "prefer"
    
    # Enhanced performance-optimized async engine with better pool management
    async_engine = create_async_engine(
        settings.ASYNC_DATABASE_URI,
        echo=settings.ENVIRONMENT == "development",  # Enable SQL logging in dev
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=1800,   # Recycle connections every 30 minutes (reduced)
        pool_size=max(settings.DB_POOL_SIZE, 15),  # Minimum 15 for production loads
        max_overflow=max(settings.DB_MAX_OVERFLOW, 25),  # Minimum 25 overflow
        # Enhanced performance optimizations
        pool_timeout=45,     # Increased timeout for busy periods
        pool_reset_on_return="commit",  # Reset connections on return
        isolation_level="READ_COMMITTED",  # Optimal isolation level
        connect_args=connect_args,
        # Query optimization
        execution_options={
            "isolation_level": "READ_COMMITTED",
            "autocommit": False,
            "compiled_cache": {},  # Enable query compilation caching
        },
        # Connection event handlers removed - pool_events expects iterable, not boolean
    )
    
    # Create sync engine for migrations (build sync URL without query params)
    sync_database_url = (
        f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
        f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )
    engine = create_engine(
        sync_database_url,
        echo=settings.ENVIRONMENT == "development",
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    
    # Optimized session makers with performance configurations
    SessionLocal = sessionmaker(
        autocommit=False, 
        autoflush=False, 
        bind=engine,
        expire_on_commit=False,  # Better performance for read operations
    )
    AsyncSessionLocal = async_sessionmaker(
        autocommit=False, 
        autoflush=False, 
        bind=async_engine,
        expire_on_commit=False,  # Better performance for read operations
        class_=AsyncSession,
    )
    
    # Set up performance monitoring
    if engine:
        setup_performance_monitoring(engine)
    
    # Set up connection pool event monitoring for async engine
    if async_engine:
        # Attach events to the sync_engine for async compatibility
        sync_engine = async_engine.sync_engine

        @event.listens_for(sync_engine, "connect")
        def receive_connect(dbapi_connection, connection_record):
            """Log new database connections"""
            logger.debug("New database connection established")

        @event.listens_for(sync_engine, "checkout")
        def receive_checkout(dbapi_connection, connection_record, connection_proxy):
            """Monitor connection checkout from pool"""
            pool = sync_engine.pool
            if pool.checkedout() > (pool.size() * 0.8):  # 80% utilization warning
                logger.warning(f"High connection pool utilization: {pool.checkedout()}/{pool.size()}")

        @event.listens_for(sync_engine.pool, "invalidate")
        def receive_invalidate(dbapi_connection, connection_record, exception):
            """Track invalid connections"""
            query_performance_metrics["connection_errors"] += 1
            logger.error(f"Database connection invalidated: {exception}")

        @event.listens_for(sync_engine.pool, "soft_invalidate")
        def receive_soft_invalidate(dbapi_connection, connection_record, exception):
            """Track soft connection invalidations"""
            logger.warning(f"Database connection soft invalidated: {exception}")

        setup_performance_monitoring(sync_engine)
    
    logger.info("Database engines initialized successfully")
    
except Exception as e:
    logger.warning(f"Database initialization failed: {e}. Running without database connection.")
    async_engine = None
    engine = None
    SessionLocal = None
    AsyncSessionLocal = None

# Base class for models
Base = declarative_base()

# Performance-optimized database session management
@asynccontextmanager
async def get_optimized_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Optimized database session with performance monitoring"""
    if AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    session_start_time = time.time()
    async with AsyncSessionLocal() as session:
        try:
            # Enhanced query optimization settings
            await session.execute("SET enable_seqscan = off")  # Prefer index scans when possible
            await session.execute("SET random_page_cost = 1.1")  # SSD optimization
            await session.execute("SET effective_cache_size = '2GB'")  # Increased cache assumption
            await session.execute("SET shared_preload_libraries = 'pg_stat_statements'")  # Query stats
            await session.execute("SET work_mem = '32MB'")  # Increased work memory
            await session.execute("SET maintenance_work_mem = '128MB'")  # Better for maintenance
            await session.execute("SET checkpoint_completion_target = 0.9")  # Smoother checkpoints
            await session.execute("SET wal_buffers = '16MB'")  # Better WAL performance
            
            yield session
            await session.commit()
            
            # Log session duration
            session_duration = time.time() - session_start_time
            if session_duration > 5.0:  # Log long sessions
                logger.warning(f"Long database session: {session_duration:.3f}s")
                
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()

# Dependency to get database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

# Alias for backwards compatibility
get_async_session = get_db

def get_sync_db():
    """For migrations and sync operations"""
    if SessionLocal is None:
        raise Exception("Database not available")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Performance monitoring utilities
def get_query_performance_metrics() -> dict:
    """Get current query performance metrics"""
    return query_performance_metrics.copy()

def reset_query_performance_metrics():
    """Reset query performance metrics"""
    global query_performance_metrics
    query_performance_metrics.update({
        "total_queries": 0,
        "slow_queries": 0,
        "avg_query_time": 0.0
    })

async def check_database_health() -> dict:
    """Enhanced database health and performance monitoring"""
    health_status = {
        "status": "healthy",
        "connection_pool": {},
        "performance": {},
        "database_stats": {},
        "errors": [],
        "warnings": []
    }
    
    try:
        if async_engine is not None:
            # Check connection pool status
            pool = async_engine.pool
            pool_utilization = (pool.checkedout() / pool.size()) * 100 if pool.size() > 0 else 0
            
            health_status["connection_pool"] = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "invalid": pool.invalid(),
                "utilization_percent": round(pool_utilization, 2)
            }
            
            # Pool utilization warnings
            if pool_utilization > 90:
                health_status["warnings"].append("Connection pool utilization is very high (>90%)")
            elif pool_utilization > 75:
                health_status["warnings"].append("Connection pool utilization is high (>75%)")
            
            # Test connection and gather database statistics
            async with AsyncSessionLocal() as session:
                # Basic connection test
                result = await session.execute("SELECT 1")
                if not result.scalar():
                    health_status["errors"].append("Database connection test failed")
                    health_status["status"] = "unhealthy"
                
                # Database statistics
                try:
                    # Check for long-running queries
                    long_queries_result = await session.execute("""
                        SELECT COUNT(*) FROM pg_stat_activity 
                        WHERE state = 'active' AND query_start < now() - interval '30 seconds'
                        AND query NOT LIKE '%pg_stat_activity%'
                    """)
                    long_queries_count = long_queries_result.scalar() or 0
                    
                    # Check for blocked queries
                    blocked_queries_result = await session.execute("""
                        SELECT COUNT(*) FROM pg_stat_activity 
                        WHERE waiting = true OR wait_event IS NOT NULL
                    """)
                    blocked_queries_count = blocked_queries_result.scalar() or 0
                    
                    # Check connection count
                    connection_count_result = await session.execute("""
                        SELECT COUNT(*) FROM pg_stat_activity
                    """)
                    total_connections = connection_count_result.scalar() or 0
                    
                    # Check database size
                    db_size_result = await session.execute("""
                        SELECT pg_size_pretty(pg_database_size(current_database()))
                    """)
                    db_size = db_size_result.scalar() or "Unknown"
                    
                    health_status["database_stats"] = {
                        "long_running_queries": long_queries_count,
                        "blocked_queries": blocked_queries_count,
                        "total_connections": total_connections,
                        "database_size": db_size
                    }
                    
                    # Add warnings based on database stats
                    if long_queries_count > 5:
                        health_status["warnings"].append(f"High number of long-running queries: {long_queries_count}")
                    if blocked_queries_count > 0:
                        health_status["warnings"].append(f"Blocked queries detected: {blocked_queries_count}")
                    if total_connections > 100:  # Adjust based on your max_connections setting
                        health_status["warnings"].append(f"High connection count: {total_connections}")
                        
                except Exception as stats_error:
                    health_status["warnings"].append(f"Could not gather database statistics: {str(stats_error)}")
                
        else:
            health_status["errors"].append("Database engine not initialized")
            health_status["status"] = "unhealthy"
            
        # Add performance metrics
        performance_metrics = get_query_performance_metrics()
        health_status["performance"] = performance_metrics
        
        # Performance-based warnings
        if performance_metrics["slow_queries"] > 10:
            health_status["warnings"].append("High number of slow queries detected")
        if performance_metrics["avg_query_time"] > 2.0:
            health_status["warnings"].append("Average query time is high")
        if performance_metrics["connection_errors"] > 5:
            health_status["warnings"].append("Multiple connection errors detected")
            
        # Determine overall health status
        if health_status["errors"]:
            health_status["status"] = "unhealthy"
        elif health_status["warnings"]:
            health_status["status"] = "degraded"
        
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["errors"].append(f"Health check failed: {str(e)}")
        logger.error(f"Database health check failed: {str(e)}")
    
    return health_status