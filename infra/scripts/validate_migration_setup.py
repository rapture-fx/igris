#!/usr/bin/env python3
"""
Migration Setup Validation Script
=================================

This script validates the migration setup before running the actual migration.
It checks database connectivity, permissions, and requirements.

Usage:
    python validate_migration_setup.py
"""

import asyncio
import os
import sys
from typing import Dict, List, Tuple
import logging
import asyncpg
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MigrationValidator:
    """Validates migration prerequisites"""
    
    def __init__(self):
        self.aws_url = os.getenv('AWS_DATABASE_URL')
        self.supabase_url = os.getenv('SUPABASE_DATABASE_URL')
        self.validation_results = {}
    
    def validate_environment_variables(self) -> bool:
        """Validate required environment variables"""
        logger.info("🔍 Validating environment variables...")
        
        required_vars = ['AWS_DATABASE_URL', 'SUPABASE_DATABASE_URL']
        missing_vars = []
        
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            logger.error(f"❌ Missing required environment variables: {missing_vars}")
            return False
        
        logger.info("✅ All required environment variables are set")
        return True
    
    async def test_database_connection(self, db_url: str, db_name: str) -> Tuple[bool, Dict]:
        """Test database connection and gather info"""
        try:
            logger.info(f"🔌 Testing {db_name} database connection...")
            
            # Convert to asyncpg format
            asyncpg_url = db_url.replace('postgresql://', 'postgresql+asyncpg://')
            engine = create_async_engine(asyncpg_url)
            
            async with engine.begin() as conn:
                # Basic connection test
                result = await conn.execute(text("SELECT 1"))
                await result.fetchone()
                
                # Get database info
                db_info_result = await conn.execute(text("""
                    SELECT 
                        current_database() as db_name,
                        current_user as current_user,
                        version() as version,
                        current_setting('server_version') as server_version
                """))
                db_info = await db_info_result.fetchone()
                
                # Get table count
                table_count_result = await conn.execute(text("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
                table_count = await table_count_result.scalar()
                
                info = {
                    'database': db_info[0],
                    'user': db_info[1],
                    'version': db_info[2][:50] + "..." if len(db_info[2]) > 50 else db_info[2],
                    'server_version': db_info[3],
                    'table_count': table_count,
                    'connected': True
                }
                
                logger.info(f"✅ {db_name} connection successful")
                logger.info(f"   Database: {info['database']}")
                logger.info(f"   User: {info['user']}")
                logger.info(f"   Version: {info['server_version']}")
                logger.info(f"   Tables: {info['table_count']}")
                
            await engine.dispose()
            return True, info
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to {db_name} database: {e}")
            return False, {'error': str(e)}
    
    async def check_source_permissions(self) -> bool:
        """Check required permissions on source database"""
        try:
            logger.info("🔐 Checking source database permissions...")
            
            asyncpg_url = self.aws_url.replace('postgresql://', 'postgresql+asyncpg://')
            engine = create_async_engine(asyncpg_url)
            
            async with engine.begin() as conn:
                # Check basic read permissions
                permissions = []
                
                # Test table access
                try:
                    result = await conn.execute(text("""
                        SELECT schemaname, tablename 
                        FROM pg_tables 
                        WHERE schemaname = 'public' 
                        LIMIT 1
                    """))
                    await result.fetchall()
                    permissions.append("✅ Can read system tables")
                except Exception as e:
                    permissions.append(f"❌ Cannot read system tables: {e}")
                
                # Test schema access
                try:
                    result = await conn.execute(text("""
                        SELECT schema_name 
                        FROM information_schema.schemata 
                        WHERE schema_name = 'public'
                    """))
                    await result.fetchone()
                    permissions.append("✅ Can access information_schema")
                except Exception as e:
                    permissions.append(f"❌ Cannot access information_schema: {e}")
                
                # Check for existing application tables
                try:
                    result = await conn.execute(text("""
                        SELECT COUNT(*) FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name IN ('users', 'organizations', 'workspaces')
                    """))
                    app_tables = await result.scalar()
                    if app_tables > 0:
                        permissions.append(f"✅ Found {app_tables} application tables")
                    else:
                        permissions.append("⚠️ No application tables found")
                except Exception as e:
                    permissions.append(f"❌ Cannot check application tables: {e}")
            
            await engine.dispose()
            
            for perm in permissions:
                logger.info(f"   {perm}")
            
            return all("✅" in perm or "⚠️" in perm for perm in permissions)
            
        except Exception as e:
            logger.error(f"❌ Permission check failed: {e}")
            return False
    
    async def check_target_permissions(self) -> bool:
        """Check required permissions on target database"""
        try:
            logger.info("🔐 Checking target database permissions...")
            
            asyncpg_url = self.supabase_url.replace('postgresql://', 'postgresql+asyncpg://')
            engine = create_async_engine(asyncpg_url)
            
            async with engine.begin() as conn:
                permissions = []
                
                # Test create/drop permissions
                test_table = f"migration_test_{os.getpid()}"
                
                try:
                    # Create test table
                    await conn.execute(text(f"""
                        CREATE TABLE {test_table} (
                            id SERIAL PRIMARY KEY,
                            test_data TEXT
                        )
                    """))
                    permissions.append("✅ Can create tables")
                    
                    # Insert test data
                    await conn.execute(text(f"""
                        INSERT INTO {test_table} (test_data) VALUES ('test')
                    """))
                    permissions.append("✅ Can insert data")
                    
                    # Read test data
                    result = await conn.execute(text(f"SELECT COUNT(*) FROM {test_table}"))
                    count = await result.scalar()
                    if count == 1:
                        permissions.append("✅ Can read data")
                    
                    # Drop test table
                    await conn.execute(text(f"DROP TABLE {test_table}"))
                    permissions.append("✅ Can drop tables")
                    
                except Exception as e:
                    permissions.append(f"❌ Database operation failed: {e}")
                
                # Test schema creation
                test_schema = f"migration_test_schema_{os.getpid()}"
                try:
                    await conn.execute(text(f'CREATE SCHEMA "{test_schema}"'))
                    await conn.execute(text(f'DROP SCHEMA "{test_schema}"'))
                    permissions.append("✅ Can create/drop schemas")
                except Exception as e:
                    permissions.append(f"❌ Cannot manage schemas: {e}")
            
            await engine.dispose()
            
            for perm in permissions:
                logger.info(f"   {perm}")
            
            return all("✅" in perm for perm in permissions)
            
        except Exception as e:
            logger.error(f"❌ Permission check failed: {e}")
            return False
    
    async def check_python_dependencies(self) -> bool:
        """Check required Python packages"""
        logger.info("🐍 Checking Python dependencies...")
        
        required_packages = [
            'asyncpg',
            'sqlalchemy', 
            'psycopg2',
        ]
        
        missing_packages = []
        
        for package in required_packages:
            try:
                __import__(package)
                logger.info(f"   ✅ {package} available")
            except ImportError:
                missing_packages.append(package)
                logger.error(f"   ❌ {package} not found")
        
        if missing_packages:
            logger.error(f"❌ Missing required packages: {missing_packages}")
            logger.info("Install with: pip install " + " ".join(missing_packages))
            return False
        
        return True
    
    def check_system_requirements(self) -> bool:
        """Check system requirements"""
        logger.info("💻 Checking system requirements...")
        
        # Check Python version
        if sys.version_info < (3, 8):
            logger.error(f"❌ Python 3.8+ required, found {sys.version}")
            return False
        else:
            logger.info(f"   ✅ Python {sys.version.split()[0]}")
        
        # Check available disk space (approximate)
        try:
            import shutil
            total, used, free = shutil.disk_usage("/tmp")
            free_gb = free // (1024**3)
            
            if free_gb < 1:
                logger.warning(f"   ⚠️ Low disk space: {free_gb}GB free")
            else:
                logger.info(f"   ✅ Disk space: {free_gb}GB free")
        except Exception:
            logger.warning("   ⚠️ Could not check disk space")
        
        return True
    
    async def analyze_migration_scope(self) -> Dict:
        """Analyze the scope of the migration"""
        logger.info("📊 Analyzing migration scope...")
        
        try:
            asyncpg_url = self.aws_url.replace('postgresql://', 'postgresql+asyncpg://')
            engine = create_async_engine(asyncpg_url)
            
            scope = {
                'tables': [],
                'total_rows': 0,
                'estimated_size_mb': 0,
                'largest_table': None,
                'schemas': set()
            }
            
            async with engine.begin() as conn:
                # Get table information
                result = await conn.execute(text("""
                    SELECT 
                        schemaname,
                        tablename,
                        n_tup_ins as row_count,
                        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                    FROM pg_stat_user_tables 
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """))
                
                tables = await result.fetchall()
                
                max_rows = 0
                
                for schema, table, rows, size_bytes in tables:
                    table_info = {
                        'schema': schema,
                        'table': table,
                        'estimated_rows': rows or 0,
                        'size_mb': (size_bytes or 0) / (1024 * 1024)
                    }
                    
                    scope['tables'].append(table_info)
                    scope['total_rows'] += table_info['estimated_rows']
                    scope['estimated_size_mb'] += table_info['size_mb']
                    scope['schemas'].add(schema)
                    
                    if table_info['estimated_rows'] > max_rows:
                        max_rows = table_info['estimated_rows']
                        scope['largest_table'] = table_info
            
            await engine.dispose()
            
            # Display analysis
            logger.info(f"   📋 Tables to migrate: {len(scope['tables'])}")
            logger.info(f"   📊 Total estimated rows: {scope['total_rows']:,}")
            logger.info(f"   💾 Total estimated size: {scope['estimated_size_mb']:.1f} MB")
            logger.info(f"   📁 Schemas: {', '.join(scope['schemas'])}")
            
            if scope['largest_table']:
                largest = scope['largest_table']
                logger.info(f"   🏆 Largest table: {largest['schema']}.{largest['table']} "
                          f"({largest['estimated_rows']:,} rows, {largest['size_mb']:.1f} MB)")
            
            # Estimate migration time (rough calculation)
            # Assume ~1000 rows/second average processing speed
            estimated_seconds = scope['total_rows'] / 1000
            estimated_minutes = estimated_seconds / 60
            
            if estimated_minutes < 60:
                logger.info(f"   ⏱️ Estimated migration time: {estimated_minutes:.1f} minutes")
            else:
                estimated_hours = estimated_minutes / 60
                logger.info(f"   ⏱️ Estimated migration time: {estimated_hours:.1f} hours")
            
            return scope
            
        except Exception as e:
            logger.error(f"❌ Failed to analyze migration scope: {e}")
            return {}
    
    async def run_full_validation(self) -> bool:
        """Run complete validation suite"""
        logger.info("🚀 Starting migration setup validation...\n")
        
        validations = []
        
        # Environment variables
        validations.append(("Environment Variables", self.validate_environment_variables()))
        
        # System requirements
        validations.append(("System Requirements", self.check_system_requirements()))
        
        # Python dependencies
        validations.append(("Python Dependencies", await self.check_python_dependencies()))
        
        if not self.aws_url or not self.supabase_url:
            logger.error("❌ Cannot proceed without database URLs")
            return False
        
        # Database connections
        aws_success, aws_info = await self.test_database_connection(self.aws_url, "AWS RDS")
        validations.append(("AWS RDS Connection", aws_success))
        
        supabase_success, supabase_info = await self.test_database_connection(self.supabase_url, "Supabase")
        validations.append(("Supabase Connection", supabase_success))
        
        if aws_success and supabase_success:
            # Database permissions
            validations.append(("Source Permissions", await self.check_source_permissions()))
            validations.append(("Target Permissions", await self.check_target_permissions()))
            
            # Migration scope analysis
            await self.analyze_migration_scope()
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("VALIDATION SUMMARY")
        logger.info("="*60)
        
        all_passed = True
        for check_name, result in validations:
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{status} - {check_name}")
            if not result:
                all_passed = False
        
        logger.info("="*60)
        
        if all_passed:
            logger.info("🎉 All validations passed! Ready for migration.")
            logger.info("\nNext steps:")
            logger.info("1. Review the migration scope above")
            logger.info("2. Schedule migration during low-traffic period")
            logger.info("3. Run: python migrate_to_supabase.py --mode=migrate")
        else:
            logger.error("❌ Some validations failed. Please fix issues before migration.")
        
        return all_passed


async def main():
    """Main validation function"""
    validator = MigrationValidator()
    success = await validator.run_full_validation()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)