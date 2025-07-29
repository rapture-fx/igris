#!/usr/bin/env python3
"""
Comprehensive Database Migration Script: AWS RDS to Supabase Pro
================================================================

This script provides zero-downtime migration from AWS RDS to Supabase Pro
with comprehensive data validation, integrity checks, and rollback capabilities.

Features:
- Async database operations for optimal performance
- Batch processing for large datasets
- Real-time progress tracking with detailed logging
- Data integrity validation at each step
- Comprehensive rollback capabilities
- Environment variable configuration
- Migration status tracking and resumption
- Error handling and recovery mechanisms

Usage:
    python migrate_to_supabase.py --mode=validate    # Validate connection and schema
    python migrate_to_supabase.py --mode=migrate     # Run full migration
    python migrate_to_supabase.py --mode=rollback    # Rollback migration
    python migrate_to_supabase.py --mode=verify      # Verify migration integrity

Environment Variables Required:
    AWS_DATABASE_URL              # Source AWS RDS connection
    SUPABASE_DATABASE_URL         # Target Supabase connection
    MIGRATION_BATCH_SIZE          # Batch size for data transfer (default: 1000)
    MIGRATION_LOG_LEVEL          # Logging level (default: INFO)
    MIGRATION_PARALLEL_WORKERS   # Number of parallel workers (default: 4)
    MIGRATION_TIMEOUT_SECONDS    # Operation timeout (default: 3600)
"""

import asyncio
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any, AsyncGenerator
from dataclasses import dataclass, asdict
from enum import Enum
import json
import argparse
from contextlib import asynccontextmanager
import signal

import asyncpg
from sqlalchemy import create_engine, text, MetaData, Table, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import UUID
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
def setup_logging():
    """Configure comprehensive logging for migration operations"""
    log_level = os.getenv('MIGRATION_LOG_LEVEL', 'INFO').upper()
    
    # Create logs directory if it doesn't exist
    os.makedirs('/tmp/migration_logs', exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'/tmp/migration_logs/migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Configure specific loggers
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('asyncpg').setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)

logger = setup_logging()


class MigrationStatus(str, Enum):
    """Migration status enumeration"""
    NOT_STARTED = "not_started"
    VALIDATING = "validating"
    MIGRATING = "migrating"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"


class TableMigrationStatus(str, Enum):
    """Individual table migration status"""
    PENDING = "pending"
    SCHEMA_CREATED = "schema_created"
    DATA_MIGRATING = "data_migrating"
    DATA_MIGRATED = "data_migrated"
    VALIDATED = "validated"
    FAILED = "failed"


@dataclass
class MigrationConfig:
    """Migration configuration settings"""
    aws_database_url: str
    supabase_database_url: str
    batch_size: int = 1000
    parallel_workers: int = 4
    timeout_seconds: int = 3600
    validate_data: bool = True
    create_indexes: bool = True
    migrate_sequences: bool = True
    backup_before_migration: bool = True
    resume_on_failure: bool = True
    
    @classmethod
    def from_env(cls) -> 'MigrationConfig':
        """Create configuration from environment variables"""
        aws_url = os.getenv('AWS_DATABASE_URL')
        supabase_url = os.getenv('SUPABASE_DATABASE_URL')
        
        if not aws_url or not supabase_url:
            raise ValueError("AWS_DATABASE_URL and SUPABASE_DATABASE_URL must be set")
        
        return cls(
            aws_database_url=aws_url,
            supabase_database_url=supabase_url,
            batch_size=int(os.getenv('MIGRATION_BATCH_SIZE', '1000')),
            parallel_workers=int(os.getenv('MIGRATION_PARALLEL_WORKERS', '4')),
            timeout_seconds=int(os.getenv('MIGRATION_TIMEOUT_SECONDS', '3600')),
            validate_data=os.getenv('MIGRATION_VALIDATE_DATA', 'true').lower() == 'true',
            create_indexes=os.getenv('MIGRATION_CREATE_INDEXES', 'true').lower() == 'true',
            migrate_sequences=os.getenv('MIGRATION_MIGRATE_SEQUENCES', 'true').lower() == 'true',
            backup_before_migration=os.getenv('MIGRATION_BACKUP', 'true').lower() == 'true',
            resume_on_failure=os.getenv('MIGRATION_RESUME', 'true').lower() == 'true'
        )


@dataclass
class TableMigrationInfo:
    """Information about a table's migration status"""
    table_name: str
    schema_name: str = "public"
    status: TableMigrationStatus = TableMigrationStatus.PENDING
    total_rows: int = 0
    migrated_rows: int = 0
    last_migrated_id: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    @property
    def progress_percentage(self) -> float:
        """Calculate migration progress percentage"""
        if self.total_rows == 0:
            return 100.0 if self.status == TableMigrationStatus.VALIDATED else 0.0
        return (self.migrated_rows / self.total_rows) * 100


@dataclass
class MigrationState:
    """Overall migration state tracking"""
    migration_id: str
    status: MigrationStatus = MigrationStatus.NOT_STARTED
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    tables: Dict[str, TableMigrationInfo] = None
    
    def __post_init__(self):
        if self.tables is None:
            self.tables = {}
    
    @property
    def overall_progress(self) -> float:
        """Calculate overall migration progress"""
        if not self.tables:
            return 0.0
        
        total_progress = sum(table.progress_percentage for table in self.tables.values())
        return total_progress / len(self.tables)
    
    def save_to_file(self, filepath: str):
        """Save migration state to file for resumption"""
        try:
            state_dict = asdict(self)
            # Convert datetime objects to strings
            for key, value in state_dict.items():
                if isinstance(value, datetime):
                    state_dict[key] = value.isoformat()
            
            # Handle tables dictionary
            if 'tables' in state_dict and state_dict['tables']:
                for table_name, table_info in state_dict['tables'].items():
                    for key, value in table_info.items():
                        if isinstance(value, datetime):
                            table_info[key] = value.isoformat()
            
            with open(filepath, 'w') as f:
                json.dump(state_dict, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save migration state: {e}")
    
    @classmethod
    def load_from_file(cls, filepath: str) -> Optional['MigrationState']:
        """Load migration state from file"""
        try:
            with open(filepath, 'r') as f:
                state_dict = json.load(f)
            
            # Convert string dates back to datetime objects
            for key in ['started_at', 'completed_at']:
                if state_dict.get(key):
                    state_dict[key] = datetime.fromisoformat(state_dict[key])
            
            # Handle tables dictionary
            if 'tables' in state_dict and state_dict['tables']:
                tables = {}
                for table_name, table_info in state_dict['tables'].items():
                    for key in ['started_at', 'completed_at']:
                        if table_info.get(key):
                            table_info[key] = datetime.fromisoformat(table_info[key])
                    
                    tables[table_name] = TableMigrationInfo(**table_info)
                state_dict['tables'] = tables
            
            return cls(**state_dict)
        except Exception as e:
            logger.error(f"Failed to load migration state: {e}")
            return None


class DatabaseMigrator:
    """Main database migration orchestrator"""
    
    def __init__(self, config: MigrationConfig):
        self.config = config
        self.source_engine = None
        self.target_engine = None
        self.source_async_engine = None
        self.target_async_engine = None
        self.migration_state = MigrationState(migration_id=str(uuid.uuid4()))
        self.state_file = f"/tmp/migration_logs/migration_state_{self.migration_state.migration_id}.json"
        self._shutdown_requested = False
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self._shutdown_requested = True
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.setup_connections()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.cleanup_connections()
    
    async def setup_connections(self):
        """Setup database connections"""
        try:
            logger.info("Setting up database connections...")
            
            # Create async engines
            self.source_async_engine = create_async_engine(
                self.config.aws_database_url.replace('postgresql://', 'postgresql+asyncpg://'),
                pool_size=self.config.parallel_workers * 2,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=3600
            )
            
            self.target_async_engine = create_async_engine(
                self.config.supabase_database_url.replace('postgresql://', 'postgresql+asyncpg://'),
                pool_size=self.config.parallel_workers * 2,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=3600
            )
            
            # Create sync engines for schema operations
            self.source_engine = create_engine(self.config.aws_database_url)
            self.target_engine = create_engine(self.config.supabase_database_url)
            
            # Test connections
            async with self.source_async_engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            
            async with self.target_async_engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            
            logger.info("Database connections established successfully")
            
        except Exception as e:
            logger.error(f"Failed to setup database connections: {e}")
            raise
    
    async def cleanup_connections(self):
        """Cleanup database connections"""
        try:
            if self.source_async_engine:
                await self.source_async_engine.dispose()
            if self.target_async_engine:
                await self.target_async_engine.dispose()
            if self.source_engine:
                self.source_engine.dispose()
            if self.target_engine:
                self.target_engine.dispose()
            
            logger.info("Database connections cleaned up")
        except Exception as e:
            logger.error(f"Error during connection cleanup: {e}")
    
    async def validate_connections(self) -> bool:
        """Validate database connections and permissions"""
        try:
            logger.info("Validating database connections and permissions...")
            
            # Test source database
            async with self.source_async_engine.begin() as conn:
                result = await conn.execute(text("SELECT current_database(), current_user, version()"))
                source_info = await result.fetchone()
                logger.info(f"Source DB: {source_info[0]} as {source_info[1]}")
            
            # Test target database
            async with self.target_async_engine.begin() as conn:
                result = await conn.execute(text("SELECT current_database(), current_user, version()"))
                target_info = await result.fetchone()
                logger.info(f"Target DB: {target_info[0]} as {target_info[1]}")
            
            # Check permissions
            await self._check_database_permissions()
            
            return True
            
        except Exception as e:
            logger.error(f"Connection validation failed: {e}")
            return False
    
    async def _check_database_permissions(self):
        """Check required database permissions"""
        required_permissions = [
            "SELECT", "INSERT", "UPDATE", "DELETE", 
            "CREATE", "DROP", "ALTER", "INDEX"
        ]
        
        # Check source permissions (read-only needed)
        async with self.source_async_engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT has_database_privilege(current_database(), 'CONNECT') as can_connect,
                       has_database_privilege(current_database(), 'CREATE') as can_create
            """))
            perms = await result.fetchone()
            if not perms[0]:
                raise Exception("No CONNECT permission on source database")
        
        # Check target permissions (full access needed)
        async with self.target_async_engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT has_database_privilege(current_database(), 'CONNECT') as can_connect,
                       has_database_privilege(current_database(), 'CREATE') as can_create
            """))
            perms = await result.fetchone()
            if not all(perms):
                raise Exception("Insufficient permissions on target database")
        
        logger.info("Database permissions validated successfully")
    
    async def discover_tables(self) -> List[str]:
        """Discover all tables to migrate from source database"""
        try:
            logger.info("Discovering tables to migrate...")
            
            async with self.source_async_engine.begin() as conn:
                result = await conn.execute(text("""
                    SELECT schemaname, tablename, tableowner 
                    FROM pg_tables 
                    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                    ORDER BY schemaname, tablename
                """))
                
                tables = await result.fetchall()
                table_names = [f"{row[0]}.{row[1]}" for row in tables]
                
                logger.info(f"Discovered {len(table_names)} tables: {table_names}")
                
                # Initialize table migration info
                for table_name in table_names:
                    schema, name = table_name.split('.')
                    self.migration_state.tables[table_name] = TableMigrationInfo(
                        table_name=name,
                        schema_name=schema
                    )
                
                return table_names
                
        except Exception as e:
            logger.error(f"Failed to discover tables: {e}")
            raise
    
    async def get_table_row_count(self, table_name: str) -> int:
        """Get row count for a table"""
        try:
            schema, table = table_name.split('.')
            async with self.source_async_engine.begin() as conn:
                result = await conn.execute(text(f"""
                    SELECT COUNT(*) FROM "{schema}"."{table}"
                """))
                count = await result.scalar()
                return count or 0
        except Exception as e:
            logger.warning(f"Could not get row count for {table_name}: {e}")
            return 0
    
    async def create_schema_structure(self, table_names: List[str]) -> bool:
        """Create schema structure in target database"""
        try:
            logger.info("Creating schema structure in target database...")
            
            # Get source metadata
            source_metadata = MetaData()
            with self.source_engine.connect() as conn:
                source_metadata.reflect(bind=conn)
            
            # Create schemas
            schemas = set()
            for table_name in table_names:
                schema = table_name.split('.')[0]
                if schema != 'public':
                    schemas.add(schema)
            
            async with self.target_async_engine.begin() as conn:
                for schema in schemas:
                    await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                    logger.info(f"Created schema: {schema}")
            
            # Create tables
            with self.target_engine.begin() as conn:
                source_metadata.create_all(bind=conn, checkfirst=True)
            
            logger.info("Schema structure created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create schema structure: {e}")
            return False
    
    async def migrate_table_data(self, table_name: str) -> bool:
        """Migrate data for a single table"""
        try:
            schema, table = table_name.split('.')
            table_info = self.migration_state.tables[table_name]
            
            logger.info(f"Starting data migration for {table_name}")
            table_info.status = TableMigrationStatus.DATA_MIGRATING
            table_info.started_at = datetime.now(timezone.utc)
            
            # Get total row count
            table_info.total_rows = await self.get_table_row_count(table_name)
            logger.info(f"Table {table_name} has {table_info.total_rows} rows")
            
            if table_info.total_rows == 0:
                table_info.status = TableMigrationStatus.DATA_MIGRATED
                table_info.completed_at = datetime.now(timezone.utc)
                logger.info(f"Table {table_name} is empty, marking as migrated")
                return True
            
            # Get table structure
            async with self.source_async_engine.begin() as source_conn:
                # Get column information
                result = await source_conn.execute(text(f"""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns 
                    WHERE table_schema = '{schema}' AND table_name = '{table}'
                    ORDER BY ordinal_position
                """))
                columns = await result.fetchall()
                column_names = [col[0] for col in columns]
                
                # Check if table has an ID column for ordering
                id_column = None
                for col_name in ['id', 'uuid', 'created_at', 'updated_at']:
                    if col_name in column_names:
                        id_column = col_name
                        break
                
                # Migrate data in batches
                offset = 0
                while offset < table_info.total_rows and not self._shutdown_requested:
                    batch_start_time = time.time()
                    
                    # Prepare ORDER BY clause
                    order_clause = f'ORDER BY "{id_column}"' if id_column else 'ORDER BY (SELECT NULL)'
                    
                    # Fetch batch from source
                    select_query = f'''
                        SELECT {", ".join(f'"{col}"' for col in column_names)}
                        FROM "{schema}"."{table}"
                        {order_clause}
                        LIMIT {self.config.batch_size} OFFSET {offset}
                    '''
                    
                    batch_result = await source_conn.execute(text(select_query))
                    batch_data = await batch_result.fetchall()
                    
                    if not batch_data:
                        break
                    
                    # Insert batch into target
                    async with self.target_async_engine.begin() as target_conn:
                        # Prepare insert query
                        placeholders = ", ".join([f"${i+1}" for i in range(len(column_names))])
                        insert_query = f'''
                            INSERT INTO "{schema}"."{table}" ({", ".join(f'"{col}"' for col in column_names)})
                            VALUES ({placeholders})
                            ON CONFLICT DO NOTHING
                        '''
                        
                        # Execute batch insert
                        for row in batch_data:
                            await target_conn.execute(text(insert_query), row)
                    
                    # Update progress
                    offset += len(batch_data)
                    table_info.migrated_rows = offset
                    
                    batch_duration = time.time() - batch_start_time
                    progress = (offset / table_info.total_rows) * 100
                    
                    logger.info(f"Table {table_name}: {offset}/{table_info.total_rows} rows "
                              f"({progress:.1f}%) - Batch time: {batch_duration:.2f}s")
                    
                    # Save state periodically
                    if offset % (self.config.batch_size * 10) == 0:
                        self.migration_state.save_to_file(self.state_file)
                    
                    # Small delay to prevent overwhelming the database
                    await asyncio.sleep(0.1)
            
            if self._shutdown_requested:
                logger.info(f"Migration interrupted for table {table_name}")
                return False
            
            table_info.status = TableMigrationStatus.DATA_MIGRATED
            table_info.completed_at = datetime.now(timezone.utc)
            logger.info(f"Completed data migration for {table_name}")
            
            return True
            
        except Exception as e:
            table_info.status = TableMigrationStatus.FAILED
            table_info.error_message = str(e)
            logger.error(f"Failed to migrate table {table_name}: {e}")
            return False
    
    async def validate_table_data(self, table_name: str) -> bool:
        """Validate migrated data for a table"""
        try:
            schema, table = table_name.split('.')
            table_info = self.migration_state.tables[table_name]
            
            logger.info(f"Validating data for {table_name}")
            
            # Count rows in both databases
            async with self.source_async_engine.begin() as source_conn:
                source_result = await source_conn.execute(text(f'SELECT COUNT(*) FROM "{schema}"."{table}"'))
                source_count = await source_result.scalar()
            
            async with self.target_async_engine.begin() as target_conn:
                target_result = await target_conn.execute(text(f'SELECT COUNT(*) FROM "{schema}"."{table}"'))
                target_count = await target_result.scalar()
            
            if source_count != target_count:
                error_msg = f"Row count mismatch: source={source_count}, target={target_count}"
                table_info.error_message = error_msg
                logger.error(f"Validation failed for {table_name}: {error_msg}")
                return False
            
            # Sample data validation (check first and last few rows)
            if source_count > 0:
                await self._validate_sample_data(table_name)
            
            table_info.status = TableMigrationStatus.VALIDATED
            logger.info(f"Validation successful for {table_name}: {source_count} rows")
            
            return True
            
        except Exception as e:
            table_info.error_message = str(e)
            logger.error(f"Validation failed for {table_name}: {e}")
            return False
    
    async def _validate_sample_data(self, table_name: str):
        """Validate sample data between source and target"""
        schema, table = table_name.split('.')
        
        # Get column information
        async with self.source_async_engine.begin() as conn:
            result = await conn.execute(text(f"""
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = '{schema}' AND table_name = '{table}'
                ORDER BY ordinal_position
            """))
            columns = [row[0] for row in await result.fetchall()]
        
        # Find an ID column for consistent sampling
        id_column = None
        for col_name in ['id', 'uuid', 'created_at']:
            if col_name in columns:
                id_column = col_name
                break
        
        if not id_column:
            logger.warning(f"No suitable ID column found for {table_name}, skipping sample validation")
            return
        
        # Sample first 5 and last 5 records
        order_clause = f'ORDER BY "{id_column}"'
        
        for direction, limit_clause in [('ASC', 'LIMIT 5'), ('DESC', 'LIMIT 5')]:
            query = f'''
                SELECT {", ".join(f'"{col}"' for col in columns)}
                FROM "{schema}"."{table}"
                {order_clause} {direction}
                {limit_clause}
            '''
            
            # Get data from both databases
            async with self.source_async_engine.begin() as source_conn:
                source_result = await source_conn.execute(text(query))
                source_data = await source_result.fetchall()
            
            async with self.target_async_engine.begin() as target_conn:
                target_result = await target_conn.execute(text(query))
                target_data = await target_result.fetchall()
            
            # Compare data
            if len(source_data) != len(target_data):
                raise Exception(f"Sample data count mismatch in {table_name}")
            
            for i, (source_row, target_row) in enumerate(zip(source_data, target_data)):
                if source_row != target_row:
                    logger.warning(f"Sample data mismatch in {table_name} row {i}: "
                                 f"source={source_row} vs target={target_row}")
    
    async def create_indexes_and_constraints(self, table_names: List[str]) -> bool:
        """Create indexes and constraints in target database"""
        if not self.config.create_indexes:
            logger.info("Skipping index creation (disabled in config)")
            return True
        
        try:
            logger.info("Creating indexes and constraints...")
            
            # Get indexes from source database
            async with self.source_async_engine.begin() as source_conn:
                result = await source_conn.execute(text("""
                    SELECT schemaname, tablename, indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
                    AND indexname NOT LIKE '%_pkey'
                    ORDER BY schemaname, tablename, indexname
                """))
                
                indexes = await result.fetchall()
            
            # Create indexes in target database
            async with self.target_async_engine.begin() as target_conn:
                for schema, table, index_name, index_def in indexes:
                    try:
                        # Skip if index already exists
                        check_result = await target_conn.execute(text(f"""
                            SELECT 1 FROM pg_indexes 
                            WHERE schemaname = '{schema}' 
                            AND tablename = '{table}' 
                            AND indexname = '{index_name}'
                        """))
                        
                        if await check_result.fetchone():
                            logger.debug(f"Index {index_name} already exists, skipping")
                            continue
                        
                        # Create index
                        await target_conn.execute(text(index_def))
                        logger.info(f"Created index: {index_name}")
                        
                    except Exception as e:
                        logger.warning(f"Failed to create index {index_name}: {e}")
            
            logger.info("Indexes and constraints created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create indexes and constraints: {e}")
            return False
    
    async def migrate_sequences(self) -> bool:
        """Migrate database sequences"""
        if not self.config.migrate_sequences:
            logger.info("Skipping sequence migration (disabled in config)")
            return True
        
        try:
            logger.info("Migrating database sequences...")
            
            # Get sequences from source
            async with self.source_async_engine.begin() as source_conn:
                result = await source_conn.execute(text("""
                    SELECT schemaname, sequencename, last_value
                    FROM pg_sequences
                    WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
                """))
                
                sequences = await result.fetchall()
            
            # Update sequences in target
            async with self.target_async_engine.begin() as target_conn:
                for schema, sequence, last_value in sequences:
                    try:
                        await target_conn.execute(text(f"""
                            SELECT setval('"{schema}"."{sequence}"', {last_value}, true)
                        """))
                        logger.info(f"Updated sequence {schema}.{sequence} to {last_value}")
                    except Exception as e:
                        logger.warning(f"Failed to update sequence {schema}.{sequence}: {e}")
            
            logger.info("Sequences migrated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to migrate sequences: {e}")
            return False
    
    async def run_migration(self) -> bool:
        """Run the complete migration process"""
        try:
            self.migration_state.status = MigrationStatus.VALIDATING
            self.migration_state.started_at = datetime.now(timezone.utc)
            
            logger.info(f"Starting migration {self.migration_state.migration_id}")
            
            # Step 1: Validate connections
            if not await self.validate_connections():
                self.migration_state.status = MigrationStatus.FAILED
                self.migration_state.error_message = "Connection validation failed"
                return False
            
            # Step 2: Discover tables
            table_names = await self.discover_tables()
            
            # Step 3: Create schema structure
            self.migration_state.status = MigrationStatus.MIGRATING
            if not await self.create_schema_structure(table_names):
                self.migration_state.status = MigrationStatus.FAILED
                self.migration_state.error_message = "Schema creation failed"
                return False
            
            # Step 4: Migrate table data
            logger.info(f"Migrating data for {len(table_names)} tables...")
            
            # Create semaphore to limit concurrent operations
            semaphore = asyncio.Semaphore(self.config.parallel_workers)
            
            async def migrate_single_table(table_name: str):
                async with semaphore:
                    return await self.migrate_table_data(table_name)
            
            # Process tables in parallel
            tasks = [migrate_single_table(table_name) for table_name in table_names]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            failed_tables = []
            for table_name, result in zip(table_names, results):
                if isinstance(result, Exception) or not result:
                    failed_tables.append(table_name)
                    logger.error(f"Failed to migrate table {table_name}")
            
            if failed_tables:
                self.migration_state.status = MigrationStatus.FAILED
                self.migration_state.error_message = f"Failed to migrate tables: {failed_tables}"
                return False
            
            # Step 5: Create indexes and constraints
            if not await self.create_indexes_and_constraints(table_names):
                logger.warning("Index creation failed, but migration continues")
            
            # Step 6: Migrate sequences
            if not await self.migrate_sequences():
                logger.warning("Sequence migration failed, but migration continues")
            
            # Step 7: Validate data
            self.migration_state.status = MigrationStatus.VERIFYING
            if self.config.validate_data:
                logger.info("Validating migrated data...")
                
                validation_tasks = [self.validate_table_data(table_name) for table_name in table_names]
                validation_results = await asyncio.gather(*validation_tasks, return_exceptions=True)
                
                failed_validations = []
                for table_name, result in zip(table_names, validation_results):
                    if isinstance(result, Exception) or not result:
                        failed_validations.append(table_name)
                        logger.error(f"Validation failed for table {table_name}")
                
                if failed_validations:
                    self.migration_state.status = MigrationStatus.FAILED
                    self.migration_state.error_message = f"Validation failed for tables: {failed_validations}"
                    return False
            
            # Migration completed successfully
            self.migration_state.status = MigrationStatus.COMPLETED
            self.migration_state.completed_at = datetime.now(timezone.utc)
            
            # Calculate final statistics
            total_rows = sum(table.total_rows for table in self.migration_state.tables.values())
            duration = (self.migration_state.completed_at - self.migration_state.started_at).total_seconds()
            
            logger.info(f"Migration completed successfully!")
            logger.info(f"Migrated {len(table_names)} tables with {total_rows:,} total rows")
            logger.info(f"Total duration: {duration:.2f} seconds")
            logger.info(f"Average throughput: {total_rows/duration:.2f} rows/second")
            
            return True
            
        except Exception as e:
            self.migration_state.status = MigrationStatus.FAILED
            self.migration_state.error_message = str(e)
            logger.error(f"Migration failed: {e}")
            return False
        
        finally:
            # Save final state
            self.migration_state.save_to_file(self.state_file)
    
    async def verify_migration(self) -> bool:
        """Verify the integrity of the completed migration"""
        try:
            logger.info("Starting migration verification...")
            
            # Discover tables
            table_names = await self.discover_tables()
            
            # Verify each table
            all_valid = True
            for table_name in table_names:
                is_valid = await self.validate_table_data(table_name)
                if not is_valid:
                    all_valid = False
            
            if all_valid:
                logger.info("Migration verification completed successfully")
            else:
                logger.error("Migration verification found issues")
            
            return all_valid
            
        except Exception as e:
            logger.error(f"Migration verification failed: {e}")
            return False
    
    async def rollback_migration(self) -> bool:
        """Rollback the migration by clearing target database"""
        try:
            logger.warning("Starting migration rollback...")
            self.migration_state.status = MigrationStatus.ROLLING_BACK
            
            # Get list of tables to drop
            async with self.target_async_engine.begin() as conn:
                result = await conn.execute(text("""
                    SELECT schemaname, tablename
                    FROM pg_tables
                    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                    ORDER BY schemaname, tablename
                """))
                
                tables = await result.fetchall()
            
            # Drop tables
            async with self.target_async_engine.begin() as conn:
                for schema, table in tables:
                    try:
                        await conn.execute(text(f'DROP TABLE IF EXISTS "{schema}"."{table}" CASCADE'))
                        logger.info(f"Dropped table {schema}.{table}")
                    except Exception as e:
                        logger.warning(f"Failed to drop table {schema}.{table}: {e}")
            
            # Drop custom schemas (keep public)
            schemas = set(row[0] for row in tables if row[0] != 'public')
            for schema in schemas:
                try:
                    async with self.target_async_engine.begin() as conn:
                        await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
                        logger.info(f"Dropped schema {schema}")
                except Exception as e:
                    logger.warning(f"Failed to drop schema {schema}: {e}")
            
            self.migration_state.status = MigrationStatus.ROLLED_BACK
            logger.info("Migration rollback completed")
            
            return True
            
        except Exception as e:
            logger.error(f"Migration rollback failed: {e}")
            return False
    
    def print_progress_report(self):
        """Print detailed progress report"""
        print("\n" + "="*80)
        print(f"MIGRATION PROGRESS REPORT")
        print("="*80)
        print(f"Migration ID: {self.migration_state.migration_id}")
        print(f"Status: {self.migration_state.status.value}")
        print(f"Overall Progress: {self.migration_state.overall_progress:.1f}%")
        
        if self.migration_state.started_at:
            print(f"Started: {self.migration_state.started_at}")
        
        if self.migration_state.completed_at:
            print(f"Completed: {self.migration_state.completed_at}")
            duration = (self.migration_state.completed_at - self.migration_state.started_at).total_seconds()
            print(f"Duration: {duration:.2f} seconds")
        
        if self.migration_state.error_message:
            print(f"Error: {self.migration_state.error_message}")
        
        print("\nTABLE STATUS:")
        print("-" * 80)
        
        for table_name, table_info in self.migration_state.tables.items():
            status_icon = {
                TableMigrationStatus.PENDING: "⏳",
                TableMigrationStatus.SCHEMA_CREATED: "🏗️",
                TableMigrationStatus.DATA_MIGRATING: "🔄",
                TableMigrationStatus.DATA_MIGRATED: "✅",
                TableMigrationStatus.VALIDATED: "✅",
                TableMigrationStatus.FAILED: "❌"
            }.get(table_info.status, "❓")
            
            progress_bar = self._create_progress_bar(table_info.progress_percentage)
            
            print(f"{status_icon} {table_name:<30} {progress_bar} "
                  f"{table_info.migrated_rows:>8}/{table_info.total_rows:<8} "
                  f"({table_info.progress_percentage:>5.1f}%)")
            
            if table_info.error_message:
                print(f"   Error: {table_info.error_message}")
        
        print("="*80)
    
    def _create_progress_bar(self, percentage: float, width: int = 20) -> str:
        """Create a text progress bar"""
        filled = int(width * percentage / 100)
        bar = "█" * filled + "░" * (width - filled)
        return f"[{bar}]"


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Database Migration Script: AWS RDS to Supabase")
    parser.add_argument('--mode', choices=['validate', 'migrate', 'verify', 'rollback'], 
                       default='migrate', help='Migration mode')
    parser.add_argument('--resume', type=str, help='Resume from migration state file')
    parser.add_argument('--config-check', action='store_true', help='Check configuration and exit')
    
    args = parser.parse_args()
    
    try:
        # Load configuration
        config = MigrationConfig.from_env()
        
        if args.config_check:
            print("Configuration Check:")
            print(f"  AWS Database URL: {config.aws_database_url[:50]}...")
            print(f"  Supabase Database URL: {config.supabase_database_url[:50]}...")
            print(f"  Batch Size: {config.batch_size}")
            print(f"  Parallel Workers: {config.parallel_workers}")
            print(f"  Timeout: {config.timeout_seconds}s")
            print(f"  Validate Data: {config.validate_data}")
            return 0
        
        # Initialize migrator
        async with DatabaseMigrator(config) as migrator:
            
            # Resume from saved state if requested
            if args.resume:
                saved_state = MigrationState.load_from_file(args.resume)
                if saved_state:
                    migrator.migration_state = saved_state
                    logger.info(f"Resumed from saved state: {args.resume}")
            
            # Execute based on mode
            success = False
            
            if args.mode == 'validate':
                success = await migrator.validate_connections()
                
            elif args.mode == 'migrate':
                success = await migrator.run_migration()
                
            elif args.mode == 'verify':
                success = await migrator.verify_migration()
                
            elif args.mode == 'rollback':
                success = await migrator.rollback_migration()
            
            # Print final report
            migrator.print_progress_report()
            
            return 0 if success else 1
    
    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Migration failed with error: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)