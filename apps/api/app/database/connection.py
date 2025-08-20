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

# Performance monitoring
query_performance_metrics = {
    "total_queries": 0,
    "slow_queries": 0,
    "avg_query_time": 0.0,
    "slow_query_threshold": 1.0  # seconds
}

# Initialize engines
async_engine: Optional[create_async_engine] = None
engine: Optional[create_engine] = None
SessionLocal: Optional[sessionmaker] = None
AsyncSessionLocal: Optional[async_sessionmaker] = None

def log_slow_query(query_time: float, statement: str):
    """Log slow queries for monitoring"""
    if query_time > query_performance_metrics["slow_query_threshold"]:
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
        """End timing queries and log performance"""
        total_time = time.time() - context._query_start_time
        query_performance_metrics["total_queries"] += 1
        
        # Update average query time
        current_avg = query_performance_metrics["avg_query_time"]
        count = query_performance_metrics["total_queries"]
        query_performance_metrics["avg_query_time"] = (current_avg * (count - 1) + total_time) / count
        
        # Log slow queries
        log_slow_query(total_time, statement)

try:
    # Performance-optimized connection arguments
    connect_args = {
        "application_name": f"schlep-engine-{settings.ENVIRONMENT}",
        "connect_timeout": 10,
        "command_timeout": 30,
        # Performance optimizations
        "server_side_cursors": True,
        "prepared_statement_cache_size": 100,
        "prepared_statement_name_func": lambda: f"__asyncpg_stmt_{hash(time.time())}__",
    }
    
    # Add SSL configuration for production or Supabase
    if settings.ENVIRONMENT == "production" or settings.is_supabase_enabled:
        connect_args.update({
            "sslmode": "require",
        })
        
        # Add client certificates only if they exist (for self-hosted PostgreSQL)
        if not settings.is_supabase_enabled:
            connect_args.update({
                "sslcert": "/app/certs/client-cert.pem",
                "sslkey": "/app/certs/client-key.pem", 
                "sslrootcert": "/app/certs/ca-cert.pem",
            })
    else:
        connect_args["sslmode"] = "prefer"
    
    # Performance-optimized async engine
    async_engine = create_async_engine(
        settings.ASYNC_DATABASE_URI,
        echo=settings.ENVIRONMENT == "development",  # Enable SQL logging in dev
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=3600,   # Recycle connections every hour
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        # Performance optimizations
        pool_timeout=30,     # Wait up to 30 seconds for connection
        pool_reset_on_return="commit",  # Reset connections on return
        isolation_level="READ_COMMITTED",  # Optimal isolation level for most cases
        connect_args=connect_args
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
    
    # Session makers
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=async_engine)
    
    # Set up performance monitoring
    if engine:
        setup_performance_monitoring(engine)
    
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
            # Enable query optimization
            await session.execute("SET enable_seqscan = off")  # Prefer index scans
            await session.execute("SET random_page_cost = 1.1")  # SSD optimization
            await session.execute("SET effective_cache_size = '1GB'")  # Adjust for your system
            
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
    """Check database health and performance"""
    health_status = {
        "status": "healthy",
        "connection_pool": {},
        "performance": {},
        "errors": []
    }
    
    try:
        if async_engine is not None:
            # Check connection pool status
            pool = async_engine.pool
            health_status["connection_pool"] = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "invalid": pool.invalid()
            }
            
            # Test connection
            async with AsyncSessionLocal() as session:
                result = await session.execute("SELECT 1")
                if not result.scalar():
                    health_status["errors"].append("Database connection test failed")
                    health_status["status"] = "unhealthy"
        else:
            health_status["errors"].append("Database engine not initialized")
            health_status["status"] = "unhealthy"
            
        # Add performance metrics
        health_status["performance"] = get_query_performance_metrics()
        
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["errors"].append(f"Health check failed: {str(e)}")
        logger.error(f"Database health check failed: {str(e)}")
    
    return health_status