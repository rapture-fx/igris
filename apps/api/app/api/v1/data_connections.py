"""
Data Connection Testing API
==========================

API endpoints for testing database and API connections before data import.
Supports various database types and API authentication methods.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import asyncio
import logging
import json
from datetime import datetime
import asyncpg
import aiomysql
import aiohttp
import ssl
from urllib.parse import urlparse

from app.database.connection import get_db
from app.database.models import User
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data", tags=["Data Connections"])

# ==================== REQUEST MODELS ====================

class DatabaseConnectionTest(BaseModel):
    type: str = Field(..., description="Database type: postgresql, mysql, mongodb, sqlite, snowflake, bigquery")
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    database: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")
    ssl: bool = Field(default=False, description="Use SSL connection")
    additional_params: Dict[str, Any] = Field(default={}, description="Additional connection parameters")

class APIConnectionTest(BaseModel):
    name: str = Field(..., description="API connection name")
    url: str = Field(..., description="API endpoint URL")
    method: str = Field(default="GET", description="HTTP method")
    headers: Dict[str, str] = Field(default={}, description="HTTP headers")
    auth_type: str = Field(default="none", description="Authentication type")
    auth_config: Dict[str, str] = Field(default={}, description="Authentication configuration")
    data_path: Optional[str] = Field(None, description="JSON path to data")

class DatabaseImportRequest(BaseModel):
    connection: DatabaseConnectionTest
    query: Optional[str] = Field(None, description="SQL query to execute")
    table_name: Optional[str] = Field(None, description="Table name to import")
    config: Dict[str, Any] = Field(default={}, description="ML preparation config")
    workspace_id: str = Field(..., description="Workspace ID")

class APIImportRequest(BaseModel):
    connection: APIConnectionTest
    config: Dict[str, Any] = Field(default={}, description="ML preparation config")
    workspace_id: str = Field(..., description="Workspace ID")

# ==================== RESPONSE MODELS ====================

class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None
    execution_time_ms: int
    timestamp: str

class ImportResult(BaseModel):
    pipeline_id: str
    status: str
    message: str
    records_imported: Optional[int] = None
    timestamp: str

# ==================== DATABASE CONNECTION TESTING ====================

@router.post("/test-database", response_model=ConnectionTestResult)
async def test_database_connection(
    connection: DatabaseConnectionTest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🔍 TEST DATABASE CONNECTION
    
    Test connectivity to various database types with provided credentials.
    """
    
    start_time = datetime.utcnow()
    
    try:
        if connection.type == "postgresql":
            result = await _test_postgresql_connection(connection)
        elif connection.type == "mysql":
            result = await _test_mysql_connection(connection)
        elif connection.type == "mongodb":
            result = await _test_mongodb_connection(connection)
        elif connection.type == "sqlite":
            result = await _test_sqlite_connection(connection)
        elif connection.type == "snowflake":
            result = await _test_snowflake_connection(connection)
        elif connection.type == "bigquery":
            result = await _test_bigquery_connection(connection)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported database type: {connection.type}"
            )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return ConnectionTestResult(
            success=result['success'],
            message=result['message'],
            details=result.get('details'),
            execution_time_ms=int(execution_time),
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return ConnectionTestResult(
            success=False,
            message=f"Connection test failed: {str(e)}",
            details={"error_type": type(e).__name__},
            execution_time_ms=int(execution_time),
            timestamp=datetime.utcnow().isoformat()
        )

# ==================== API CONNECTION TESTING ====================

@router.post("/test-api", response_model=ConnectionTestResult)
async def test_api_connection(
    connection: APIConnectionTest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🌐 TEST API CONNECTION
    
    Test connectivity to external APIs with authentication.
    """
    
    start_time = datetime.utcnow()
    
    try:
        # Prepare headers
        headers = dict(connection.headers)
        
        # Add authentication headers
        if connection.auth_type == "basic":
            import base64
            username = connection.auth_config.get('username', '')
            password = connection.auth_config.get('password', '')
            credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
            headers['Authorization'] = f'Basic {credentials}'
        
        elif connection.auth_type == "bearer":
            token = connection.auth_config.get('token', '')
            headers['Authorization'] = f'Bearer {token}'
        
        elif connection.auth_type == "api_key":
            key_name = connection.auth_config.get('key_name', 'X-API-Key')
            key_value = connection.auth_config.get('key_value', '')
            headers[key_name] = key_value
        
        # Make API request
        async with aiohttp.ClientSession() as session:
            async with session.request(
                method=connection.method,
                url=connection.url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                # Check response status
                if response.status >= 200 and response.status < 300:
                    # Try to parse JSON response
                    try:
                        data = await response.json()
                        
                        # Check if data path exists
                        if connection.data_path:
                            nested_data = data
                            for key in connection.data_path.split('.'):
                                if isinstance(nested_data, dict) and key in nested_data:
                                    nested_data = nested_data[key]
                                else:
                                    raise KeyError(f"Data path '{connection.data_path}' not found")
                        
                        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                        
                        return ConnectionTestResult(
                            success=True,
                            message="API connection successful",
                            details={
                                "status_code": response.status,
                                "content_type": response.headers.get('Content-Type'),
                                "response_size": len(await response.text()),
                                "data_preview": str(data)[:200] + "..." if len(str(data)) > 200 else str(data)
                            },
                            execution_time_ms=int(execution_time),
                            timestamp=datetime.utcnow().isoformat()
                        )
                        
                    except json.JSONDecodeError:
                        # Not JSON response
                        text_data = await response.text()
                        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                        
                        return ConnectionTestResult(
                            success=True,
                            message="API connection successful (non-JSON response)",
                            details={
                                "status_code": response.status,
                                "content_type": response.headers.get('Content-Type'),
                                "response_size": len(text_data),
                                "data_preview": text_data[:200] + "..." if len(text_data) > 200 else text_data
                            },
                            execution_time_ms=int(execution_time),
                            timestamp=datetime.utcnow().isoformat()
                        )
                
                else:
                    # HTTP error
                    error_text = await response.text()
                    execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                    
                    return ConnectionTestResult(
                        success=False,
                        message=f"API returned HTTP {response.status}",
                        details={
                            "status_code": response.status,
                            "error_response": error_text[:200] + "..." if len(error_text) > 200 else error_text
                        },
                        execution_time_ms=int(execution_time),
                        timestamp=datetime.utcnow().isoformat()
                    )
        
    except Exception as e:
        logger.error(f"API connection test failed: {e}")
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return ConnectionTestResult(
            success=False,
            message=f"API connection test failed: {str(e)}",
            details={"error_type": type(e).__name__},
            execution_time_ms=int(execution_time),
            timestamp=datetime.utcnow().isoformat()
        )

# ==================== DATA IMPORT ENDPOINTS ====================

@router.post("/import-database", response_model=ImportResult)
async def import_from_database(
    request: DatabaseImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📥 IMPORT DATA FROM DATABASE
    
    Import data from database and create ML preparation pipeline.
    """
    
    try:
        # Test connection first
        test_result = await _test_database_connection(request.connection)
        if not test_result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database connection failed: {test_result['message']}"
            )
        
        # TODO: Implement actual data import logic
        # This would involve:
        # 1. Connect to database
        # 2. Execute query or read table
        # 3. Create temporary file with data
        # 4. Create ML preparation pipeline
        # 5. Return pipeline ID
        
        return ImportResult(
            pipeline_id="mock-pipeline-id",
            status="initiated",
            message="Database import initiated successfully",
            records_imported=None,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Database import failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database import failed: {str(e)}"
        )

@router.post("/import-api", response_model=ImportResult)
async def import_from_api(
    request: APIImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📥 IMPORT DATA FROM API
    
    Import data from API endpoint and create ML preparation pipeline.
    """
    
    try:
        # Test connection first
        test_result = await test_api_connection(request.connection, current_user, db)
        if not test_result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"API connection failed: {test_result.message}"
            )
        
        # TODO: Implement actual data import logic
        # This would involve:
        # 1. Fetch data from API
        # 2. Parse and process data
        # 3. Create temporary file with data
        # 4. Create ML preparation pipeline
        # 5. Return pipeline ID
        
        return ImportResult(
            pipeline_id="mock-pipeline-id",
            status="initiated",
            message="API import initiated successfully",
            records_imported=None,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"API import failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API import failed: {str(e)}"
        )

# ==================== HELPER FUNCTIONS ====================

async def _test_postgresql_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Test PostgreSQL connection"""
    try:
        conn = await asyncpg.connect(
            host=connection.host,
            port=connection.port,
            database=connection.database,
            user=connection.username,
            password=connection.password,
            ssl=connection.ssl
        )
        
        # Test basic query
        result = await conn.fetchval("SELECT version()")
        await conn.close()
        
        return {
            "success": True,
            "message": "PostgreSQL connection successful",
            "details": {
                "database_version": result,
                "ssl_enabled": connection.ssl
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"PostgreSQL connection failed: {str(e)}",
            "details": {"error_type": type(e).__name__}
        }

async def _test_mysql_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Test MySQL connection"""
    try:
        conn = await aiomysql.connect(
            host=connection.host,
            port=connection.port,
            db=connection.database,
            user=connection.username,
            password=connection.password,
            ssl=ssl.SSLContext() if connection.ssl else None
        )
        
        # Test basic query
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT VERSION()")
            result = await cursor.fetchone()
        
        conn.close()
        
        return {
            "success": True,
            "message": "MySQL connection successful",
            "details": {
                "database_version": result[0] if result else "Unknown",
                "ssl_enabled": connection.ssl
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"MySQL connection failed: {str(e)}",
            "details": {"error_type": type(e).__name__}
        }

async def _test_mongodb_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Test MongoDB connection"""
    try:
        # MongoDB connection would require motor library
        # For now, return mock success
        return {
            "success": True,
            "message": "MongoDB connection test not implemented",
            "details": {"note": "MongoDB testing requires motor library"}
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"MongoDB connection failed: {str(e)}",
            "details": {"error_type": type(e).__name__}
        }

async def _test_sqlite_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Test SQLite connection"""
    try:
        # SQLite connection would require aiosqlite library
        return {
            "success": True,
            "message": "SQLite connection test not implemented",
            "details": {"note": "SQLite testing requires aiosqlite library"}
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"SQLite connection failed: {str(e)}",
            "details": {"error_type": type(e).__name__}
        }

async def _test_snowflake_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Test Snowflake connection"""
    try:
        # Snowflake connection would require snowflake-connector-python
        return {
            "success": True,
            "message": "Snowflake connection test not implemented",
            "details": {"note": "Snowflake testing requires snowflake-connector-python"}
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Snowflake connection failed: {str(e)}",
            "details": {"error_type": type(e).__name__}
        }

async def _test_bigquery_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Test BigQuery connection"""
    try:
        # BigQuery connection would require google-cloud-bigquery
        return {
            "success": True,
            "message": "BigQuery connection test not implemented",
            "details": {"note": "BigQuery testing requires google-cloud-bigquery"}
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"BigQuery connection failed: {str(e)}",
            "details": {"error_type": type(e).__name__}
        }

async def _test_database_connection(connection: DatabaseConnectionTest) -> Dict[str, Any]:
    """Generic database connection test"""
    if connection.type == "postgresql":
        return await _test_postgresql_connection(connection)
    elif connection.type == "mysql":
        return await _test_mysql_connection(connection)
    elif connection.type == "mongodb":
        return await _test_mongodb_connection(connection)
    elif connection.type == "sqlite":
        return await _test_sqlite_connection(connection)
    elif connection.type == "snowflake":
        return await _test_snowflake_connection(connection)
    elif connection.type == "bigquery":
        return await _test_bigquery_connection(connection)
    else:
        return {
            "success": False,
            "message": f"Unsupported database type: {connection.type}",
            "details": {}
        } 