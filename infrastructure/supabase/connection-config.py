"""
Supabase connection configuration optimized for ML workloads on Railway
"""
import os
from typing import Optional
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
import redis
import logging

logger = logging.getLogger(__name__)

class SupabaseConfig:
    """Supabase configuration optimized for ML processing"""
    
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.redis_url = os.getenv("REDIS_URL")
        
        # Cost-optimized connection settings for Supabase Free tier
        self.max_connections = int(os.getenv("DB_MAX_CONNECTIONS", "20"))  # Reduced for free tier
        self.pool_size = int(os.getenv("DB_POOL_SIZE", "5"))              # Conservative pool size
        self.max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))       # Limited overflow
        self.pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
        self.pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))  # 1 hour
        
        # Redis configuration for ML model caching
        self.redis_max_connections = int(os.getenv("REDIS_MAX_CONNECTIONS", "50"))
        self.redis_timeout = int(os.getenv("REDIS_TIMEOUT", "5"))
        self.ml_cache_ttl = int(os.getenv("ML_CACHE_TTL", "3600"))  # 1 hour
        
    def create_database_engine(self) -> Engine:
        """Create optimized database engine for ML workloads"""
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")
            
        # Connection string optimizations for Supabase
        connection_params = {
            "application_name": "schlep-engine-ml",
            "connect_timeout": "10",
            "command_timeout": "300",  # 5 minutes for ML queries
            "tcp_keepalives_idle": "600",
            "tcp_keepalives_interval": "30",
            "tcp_keepalives_count": "3",
        }
        
        # Build connection URL with parameters
        if "?" in self.database_url:
            connection_url = f"{self.database_url}&" + "&".join([f"{k}={v}" for k, v in connection_params.items()])
        else:
            connection_url = f"{self.database_url}?" + "&".join([f"{k}={v}" for k, v in connection_params.items()])
        
        # Create engine with optimized pool settings
        engine = create_engine(
            connection_url,
            poolclass=QueuePool,
            pool_size=self.pool_size,
            max_overflow=self.max_overflow,
            pool_timeout=self.pool_timeout,
            pool_recycle=self.pool_recycle,
            pool_pre_ping=True,  # Validate connections before use
            echo=False,  # Set to True for debugging
            future=True,
            connect_args={
                "options": "-c statement_timeout=300000"  # 5 minutes
            }
        )
        
        logger.info(f"Created database engine with pool_size={self.pool_size}, max_overflow={self.max_overflow}")
        return engine
    
    def create_redis_client(self) -> Optional[redis.Redis]:
        """Create Redis client for ML model caching"""
        if not self.redis_url:
            logger.warning("REDIS_URL not configured, caching disabled")
            return None
            
        try:
            # Parse Railway Redis URL
            client = redis.from_url(
                self.redis_url,
                max_connections=self.redis_max_connections,
                socket_timeout=self.redis_timeout,
                socket_connect_timeout=self.redis_timeout,
                retry_on_timeout=True,
                health_check_interval=30,
                decode_responses=True
            )
            
            # Test connection
            client.ping()
            logger.info(f"Redis client created successfully with max_connections={self.redis_max_connections}")
            return client
            
        except Exception as e:
            logger.error(f"Failed to create Redis client: {e}")
            return None
    
    def get_ml_cache_config(self) -> dict:
        """Get ML-specific caching configuration"""
        return {
            "model_cache_ttl": self.ml_cache_ttl,
            "prediction_cache_ttl": 300,  # 5 minutes
            "feature_cache_ttl": 1800,    # 30 minutes
            "dataset_cache_ttl": 7200,    # 2 hours
            "max_cache_size": "512MB",
            "eviction_policy": "allkeys-lru"
        }
    
    def get_database_health_query(self) -> str:
        """Get health check query for database monitoring"""
        return """
        SELECT 
            'database' as component,
            CASE 
                WHEN count(*) < 100 THEN 'healthy'
                WHEN count(*) < 150 THEN 'warning'  
                ELSE 'critical'
            END as status,
            count(*) as active_connections,
            (SELECT round((sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0))::numeric, 2) 
             FROM pg_stat_database) as cache_hit_ratio
        FROM pg_stat_activity 
        WHERE state = 'active';
        """
    
    def get_ml_performance_config(self) -> dict:
        """Get ML performance optimization settings"""
        return {
            # Database query optimizations
            "query_timeout": 300,  # 5 minutes
            "batch_size": 1000,
            "max_workers": 4,
            "connection_pool_size": self.pool_size,
            
            # ML model settings
            "model_batch_size": int(os.getenv("ML_BATCH_SIZE", "32")),
            "max_model_memory": "2GB",
            "model_cache_size": "1GB",
            
            # Processing limits
            "max_file_size": "100MB",
            "max_records_per_job": 1000000,
            "processing_timeout": 1800,  # 30 minutes
        }

# Global configuration instance
supabase_config = SupabaseConfig()

# Factory functions for easy import
def get_database_engine() -> Engine:
    """Get configured database engine"""
    return supabase_config.create_database_engine()

def get_redis_client() -> Optional[redis.Redis]:
    """Get configured Redis client"""
    return supabase_config.create_redis_client()

def get_ml_cache_config() -> dict:
    """Get ML caching configuration"""
    return supabase_config.get_ml_cache_config()

# Railway deployment health check
async def check_infrastructure_health() -> dict:
    """Check health of all infrastructure components"""
    health_status = {
        "database": "unknown",
        "redis": "unknown", 
        "overall": "unknown"
    }
    
    try:
        # Check database
        engine = get_database_engine()
        with engine.connect() as conn:
            result = conn.execute(supabase_config.get_database_health_query())
            db_health = result.fetchone()
            health_status["database"] = db_health[1] if db_health else "error"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status["database"] = "error"
    
    try:
        # Check Redis
        redis_client = get_redis_client()
        if redis_client:
            redis_client.ping()
            health_status["redis"] = "healthy"
        else:
            health_status["redis"] = "disabled"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_status["redis"] = "error"
    
    # Determine overall health
    if health_status["database"] == "healthy" and health_status["redis"] in ["healthy", "disabled"]:
        health_status["overall"] = "healthy"
    elif health_status["database"] in ["warning", "healthy"]:
        health_status["overall"] = "warning"
    else:
        health_status["overall"] = "critical"
    
    return health_status