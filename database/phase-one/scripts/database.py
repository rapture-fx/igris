#!/usr/bin/env python3
"""
Database connection management and migration utilities for Schlep Engine Phase One
Optimized for PostgreSQL with YugabyteDB migration compatibility
"""

import asyncio
import asyncpg
import psycopg2
from psycopg2.extras import RealDictCursor
import redis.asyncio as redis
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
from dataclasses import dataclass
import os
from pathlib import Path
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DatabaseConfig:
    """Database configuration for Phase One setup"""

    # PostgreSQL configuration
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_database: str = "schlep_engine"
    postgres_user: str = "schlep_user"
    postgres_password: str = "schlep_postgres_dev_2024"
    postgres_ssl_mode: str = "disable"
    postgres_pool_min_size: int = 10
    postgres_pool_max_size: int = 100

    # Redis configuration
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = "schlep_redis_dev_2024"
    redis_db: int = 0
    redis_pool_max_connections: int = 100

    # MinIO/S3 configuration
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "schlep_admin"
    s3_secret_key: str = "schlep_minio_dev_password_2024"
    s3_region: str = "us-east-1"
    s3_bucket_prefix: str = "schlep-"

    @classmethod
    def from_env(cls) -> 'DatabaseConfig':
        """Create configuration from environment variables"""
        return cls(
            postgres_host=os.getenv("POSTGRES_HOST", "localhost"),
            postgres_port=int(os.getenv("POSTGRES_PORT", "5432")),
            postgres_database=os.getenv("POSTGRES_DB", "schlep_engine"),
            postgres_user=os.getenv("POSTGRES_USER", "schlep_user"),
            postgres_password=os.getenv("POSTGRES_PASSWORD", "schlep_postgres_dev_2024"),
            redis_host=os.getenv("REDIS_HOST", "localhost"),
            redis_port=int(os.getenv("REDIS_PORT", "6379")),
            redis_password=os.getenv("REDIS_PASSWORD", "schlep_redis_dev_2024"),
            s3_endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
            s3_access_key=os.getenv("MINIO_ROOT_USER", "schlep_admin"),
            s3_secret_key=os.getenv("MINIO_ROOT_PASSWORD", "schlep_minio_dev_password_2024"),
        )

class DatabaseManager:
    """
    Manages database connections for PostgreSQL and Redis
    Designed for easy migration to YugabyteDB and DragonflyDB
    """

    def __init__(self, config: DatabaseConfig):
        self.config = config
        self._postgres_pool: Optional[asyncpg.Pool] = None
        self._redis_pool: Optional[redis.ConnectionPool] = None
        self._redis: Optional[redis.Redis] = None

    async def initialize(self):
        """Initialize all database connections"""
        logger.info("Initializing database connections...")

        # Initialize PostgreSQL connection pool
        await self._init_postgres()

        # Initialize Redis connection pool
        await self._init_redis()

        logger.info("Database connections initialized successfully")

    async def _init_postgres(self):
        """Initialize PostgreSQL connection pool"""
        try:
            self._postgres_pool = await asyncpg.create_pool(
                host=self.config.postgres_host,
                port=self.config.postgres_port,
                database=self.config.postgres_database,
                user=self.config.postgres_user,
                password=self.config.postgres_password,
                min_size=self.config.postgres_pool_min_size,
                max_size=self.config.postgres_pool_max_size,
                ssl=self.config.postgres_ssl_mode,
                command_timeout=60,
            )

            # Test connection
            async with self._postgres_pool.acquire() as conn:
                version = await conn.fetchval("SELECT version()")
                logger.info(f"PostgreSQL connected: {version}")

        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL: {e}")
            raise

    async def _init_redis(self):
        """Initialize Redis connection pool"""
        try:
            self._redis_pool = redis.ConnectionPool(
                host=self.config.redis_host,
                port=self.config.redis_port,
                password=self.config.redis_password,
                db=self.config.redis_db,
                max_connections=self.config.redis_pool_max_connections,
                decode_responses=True,
                retry_on_timeout=True,
            )

            self._redis = redis.Redis(connection_pool=self._redis_pool)

            # Test connection
            pong = await self._redis.ping()
            if pong:
                info = await self._redis.info()
                logger.info(f"Redis connected: {info['redis_version']}")

        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            raise

    @asynccontextmanager
    async def postgres_connection(self):
        """Get a PostgreSQL connection from the pool"""
        if not self._postgres_pool:
            raise RuntimeError("PostgreSQL pool not initialized")

        async with self._postgres_pool.acquire() as connection:
            yield connection

    @asynccontextmanager
    async def postgres_transaction(self):
        """Get a PostgreSQL transaction"""
        async with self.postgres_connection() as conn:
            async with conn.transaction():
                yield conn

    @property
    def redis(self) -> redis.Redis:
        """Get Redis connection"""
        if not self._redis:
            raise RuntimeError("Redis not initialized")
        return self._redis

    async def close(self):
        """Close all database connections"""
        logger.info("Closing database connections...")

        if self._postgres_pool:
            await self._postgres_pool.close()

        if self._redis:
            await self._redis.close()

        if self._redis_pool:
            await self._redis_pool.disconnect()

        logger.info("Database connections closed")

class MigrationManager:
    """
    Manages database schema migrations with YugabyteDB compatibility
    """

    def __init__(self, db_manager: DatabaseManager, schema_path: Path):
        self.db_manager = db_manager
        self.schema_path = schema_path

    async def apply_migrations(self) -> bool:
        """Apply all pending migrations"""
        logger.info("Starting database migrations...")

        try:
            # Create migrations tracking table if it doesn't exist
            await self._create_migrations_table()

            # Get list of applied migrations
            applied_migrations = await self._get_applied_migrations()

            # Get list of available migrations
            available_migrations = self._get_available_migrations()

            # Apply pending migrations
            pending_migrations = [m for m in available_migrations if m not in applied_migrations]

            if not pending_migrations:
                logger.info("No pending migrations")
                return True

            logger.info(f"Applying {len(pending_migrations)} migrations...")

            for migration in sorted(pending_migrations):
                await self._apply_migration(migration)

            logger.info("All migrations applied successfully")
            return True

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False

    async def _create_migrations_table(self):
        """Create the migrations tracking table"""
        async with self.db_manager.postgres_transaction() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id SERIAL PRIMARY KEY,
                    migration_name VARCHAR(255) UNIQUE NOT NULL,
                    applied_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

    async def _get_applied_migrations(self) -> List[str]:
        """Get list of applied migrations"""
        async with self.db_manager.postgres_connection() as conn:
            rows = await conn.fetch(
                "SELECT migration_name FROM schema_migrations ORDER BY migration_name"
            )
            return [row['migration_name'] for row in rows]

    def _get_available_migrations(self) -> List[str]:
        """Get list of available migration files"""
        if not self.schema_path.exists():
            return []

        migrations = []
        for file_path in self.schema_path.glob("*.sql"):
            if file_path.name.startswith("0"):  # Migration files start with numbers
                migrations.append(file_path.stem)

        return sorted(migrations)

    async def _apply_migration(self, migration_name: str):
        """Apply a single migration"""
        migration_file = self.schema_path / f"{migration_name}.sql"

        if not migration_file.exists():
            raise FileNotFoundError(f"Migration file not found: {migration_file}")

        logger.info(f"Applying migration: {migration_name}")

        # Read migration SQL
        migration_sql = migration_file.read_text(encoding='utf-8')

        async with self.db_manager.postgres_transaction() as conn:
            # Execute migration SQL
            await conn.execute(migration_sql)

            # Record migration as applied
            await conn.execute(
                "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
                migration_name
            )

        logger.info(f"Migration applied: {migration_name}")

class HealthChecker:
    """
    Health check utilities for database services
    """

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    async def check_postgres_health(self) -> Dict[str, Any]:
        """Check PostgreSQL health and performance metrics"""
        try:
            async with self.db_manager.postgres_connection() as conn:
                # Basic connectivity check
                version = await conn.fetchval("SELECT version()")

                # Connection count
                connection_count = await conn.fetchval(
                    "SELECT count(*) FROM pg_stat_activity"
                )

                # Database size
                db_size = await conn.fetchval(
                    "SELECT pg_database_size($1)",
                    self.db_manager.config.postgres_database
                )

                # Cache hit ratio
                cache_hit_ratio = await conn.fetchval("""
                    SELECT
                        sum(blks_hit) / (sum(blks_hit) + sum(blks_read)) as hit_ratio
                    FROM pg_stat_database
                    WHERE datname = $1
                """, self.db_manager.config.postgres_database)

                return {
                    "status": "healthy",
                    "version": version,
                    "connection_count": connection_count,
                    "database_size_bytes": db_size,
                    "cache_hit_ratio": float(cache_hit_ratio) if cache_hit_ratio else 0,
                }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }

    async def check_redis_health(self) -> Dict[str, Any]:
        """Check Redis health and performance metrics"""
        try:
            redis_client = self.db_manager.redis

            # Basic connectivity check
            pong = await redis_client.ping()
            if not pong:
                raise Exception("Redis ping failed")

            # Get Redis info
            info = await redis_client.info()

            # Get memory usage
            memory_info = await redis_client.info("memory")

            # Get keyspace info
            keyspace_info = await redis_client.info("keyspace")

            return {
                "status": "healthy",
                "version": info.get("redis_version"),
                "uptime_seconds": info.get("uptime_in_seconds"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_bytes": memory_info.get("used_memory"),
                "used_memory_human": memory_info.get("used_memory_human"),
                "keyspace": keyspace_info,
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }

    async def check_all_health(self) -> Dict[str, Any]:
        """Check health of all database services"""
        postgres_health = await self.check_postgres_health()
        redis_health = await self.check_redis_health()

        overall_status = "healthy" if (
            postgres_health["status"] == "healthy" and
            redis_health["status"] == "healthy"
        ) else "degraded"

        return {
            "overall_status": overall_status,
            "postgres": postgres_health,
            "redis": redis_health,
        }

# Utility functions for common database operations

async def get_database_manager() -> DatabaseManager:
    """Get initialized database manager"""
    config = DatabaseConfig.from_env()
    db_manager = DatabaseManager(config)
    await db_manager.initialize()
    return db_manager

async def run_health_check():
    """Run complete health check and print results"""
    db_manager = await get_database_manager()
    health_checker = HealthChecker(db_manager)

    try:
        health = await health_checker.check_all_health()
        print(json.dumps(health, indent=2, default=str))
        return health["overall_status"] == "healthy"
    finally:
        await db_manager.close()

async def run_migrations():
    """Run database migrations"""
    db_manager = await get_database_manager()
    schema_path = Path(__file__).parent.parent / "schemas"
    migration_manager = MigrationManager(db_manager, schema_path)

    try:
        success = await migration_manager.apply_migrations()
        return success
    finally:
        await db_manager.close()

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "health":
            success = asyncio.run(run_health_check())
            sys.exit(0 if success else 1)
        elif command == "migrate":
            success = asyncio.run(run_migrations())
            sys.exit(0 if success else 1)
        else:
            print(f"Unknown command: {command}")
            print("Available commands: health, migrate")
            sys.exit(1)
    else:
        print("Usage: python database.py <command>")
        print("Commands:")
        print("  health  - Check database health")
        print("  migrate - Run database migrations")
        sys.exit(1)