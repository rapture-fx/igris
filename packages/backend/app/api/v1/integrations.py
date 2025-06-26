"""
Advanced Data Integration API - Database, Cloud Storage, API, and Real-time Streaming
Provides comprehensive data integration capabilities for Pollarbase
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional, Union
import pandas as pd
import json
import asyncio
from datetime import datetime
import logging
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.services.data_connectors import (
    database_connector,
    cloud_storage_connector,
    api_connector,
    realtime_streamer
)
from app.database.models import User, Investigation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/integrations", tags=["Data Integrations"])

# Enhanced Pydantic models for integration requests
class DatabaseConnectionRequest(BaseModel):
    connection_name: str
    database_type: str = Field(..., description="'postgresql', 'mysql', 'mongodb'")
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl_mode: Optional[str] = 'prefer'

class CloudStorageConnectionRequest(BaseModel):
    connection_name: str
    storage_type: str = Field(..., description="'aws_s3', 'gcs', 'azure_blob'")
    credentials: Dict[str, str]
    config: Optional[Dict[str, Any]] = {}

class APIConnectionRequest(BaseModel):
    connection_name: str
    base_url: str
    headers: Optional[Dict[str, str]] = {}
    auth_token: Optional[str] = None
    api_key: Optional[str] = None

class DataQueryRequest(BaseModel):
    connection_name: str
    query: str
    params: Optional[Dict[str, Any]] = {}

class FileReadRequest(BaseModel):
    connection_name: str
    container_or_bucket: str
    file_path: str

class APIFetchRequest(BaseModel):
    connection_name: str
    endpoint: str
    method: str = 'GET'
    params: Optional[Dict[str, Any]] = {}
    data: Optional[Dict[str, Any]] = {}

class StreamingConnectionRequest(BaseModel):
    stream_name: str
    stream_type: str = Field(..., description="'kafka', 'redis_stream', 'websocket'")
    config: Dict[str, Any]

class WebhookSetupRequest(BaseModel):
    webhook_name: str
    endpoint_path: str
    auth_method: str = 'none'
    secret: Optional[str] = None

# Database Integration Endpoints
@router.post("/database/connect")
async def connect_database(
    request: DatabaseConnectionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Connect to a database (PostgreSQL, MySQL, MongoDB)
    """
    try:
        success = False
        
        if request.database_type == 'postgresql':
            success = await database_connector.connect_postgresql(
                connection_name=request.connection_name,
                host=request.host,
                port=request.port,
                database=request.database,
                username=request.username,
                password=request.password,
                ssl_mode=request.ssl_mode
            )
        
        elif request.database_type == 'mysql':
            success = await database_connector.connect_mysql(
                connection_name=request.connection_name,
                host=request.host,
                port=request.port,
                database=request.database,
                username=request.username,
                password=request.password
            )
        
        elif request.database_type == 'mongodb':
            # For MongoDB, construct connection string
            connection_string = f"mongodb://{request.username}:{request.password}@{request.host}:{request.port}"
            success = database_connector.connect_mongodb(
                connection_name=request.connection_name,
                connection_string=connection_string,
                database=request.database
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported database type: {request.database_type}")
        
        if success:
            return {
                "message": f"Successfully connected to {request.database_type} database",
                "connection_name": request.connection_name,
                "database_type": request.database_type,
                "connected_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Database connection failed")
            
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@router.post("/database/query")
async def execute_database_query(
    request: DataQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute SQL query on connected database
    """
    try:
        # Execute query
        result_df = await database_connector.execute_query(
            connection_name=request.connection_name,
            query=request.query,
            params=request.params
        )
        
        # Create investigation for the results
        investigation = Investigation(
            user_id=current_user.id,
            name=f"Database Query - {request.connection_name}",
            status="completed",
            results={
                "connection_name": request.connection_name,
                "query": request.query,
                "processed_data": result_df.to_dict('records'),
                "data_summary": {
                    "total_rows": len(result_df),
                    "total_columns": len(result_df.columns),
                    "columns": result_df.columns.tolist(),
                    "data_types": result_df.dtypes.astype(str).to_dict()
                },
                "executed_at": datetime.utcnow().isoformat()
            }
        )
        
        db.add(investigation)
        db.commit()
        db.refresh(investigation)
        
        return {
            "investigation_id": investigation.id,
            "rows_returned": len(result_df),
            "columns": result_df.columns.tolist(),
            "preview_data": result_df.head(5).to_dict('records'),
            "executed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Database query error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.get("/database/{connection_name}/tables")
async def list_database_tables(
    connection_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    List all tables in the connected database
    """
    try:
        tables = await database_connector.list_tables(connection_name)
        
        return {
            "connection_name": connection_name,
            "tables": tables,
            "total_tables": len(tables)
        }
        
    except Exception as e:
        logger.error(f"List tables error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list tables: {str(e)}")

@router.get("/database/{connection_name}/tables/{table_name}/schema")
async def get_table_schema(
    connection_name: str,
    table_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get schema information for a specific table
    """
    try:
        schema = await database_connector.get_table_schema(connection_name, table_name)
        
        return schema
        
    except Exception as e:
        logger.error(f"Get schema error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get schema: {str(e)}")

# Cloud Storage Integration Endpoints
@router.post("/storage/connect")
async def connect_cloud_storage(
    request: CloudStorageConnectionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Connect to cloud storage (AWS S3, Google Cloud Storage, Azure Blob)
    """
    try:
        success = False
        
        if request.storage_type == 'aws_s3':
            success = cloud_storage_connector.connect_aws_s3(
                connection_name=request.connection_name,
                access_key_id=request.credentials['access_key_id'],
                secret_access_key=request.credentials['secret_access_key'],
                region_name=request.credentials.get('region', 'us-east-1')
            )
        
        elif request.storage_type == 'gcs':
            success = cloud_storage_connector.connect_google_cloud_storage(
                connection_name=request.connection_name,
                credentials_path=request.credentials['credentials_path'],
                project_id=request.credentials['project_id']
            )
        
        elif request.storage_type == 'azure_blob':
            success = cloud_storage_connector.connect_azure_blob_storage(
                connection_name=request.connection_name,
                connection_string=request.credentials['connection_string']
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported storage type: {request.storage_type}")
        
        if success:
            return {
                "message": f"Successfully connected to {request.storage_type}",
                "connection_name": request.connection_name,
                "storage_type": request.storage_type,
                "connected_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Storage connection failed")
            
    except Exception as e:
        logger.error(f"Storage connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@router.get("/storage/{connection_name}/files")
async def list_storage_files(
    connection_name: str,
    container_or_bucket: str,
    prefix: str = "",
    current_user: User = Depends(get_current_user)
):
    """
    List files in cloud storage
    """
    try:
        files = await cloud_storage_connector.list_files(
            connection_name=connection_name,
            container_or_bucket=container_or_bucket,
            prefix=prefix
        )
        
        return {
            "connection_name": connection_name,
            "container_or_bucket": container_or_bucket,
            "prefix": prefix,
            "files": files,
            "total_files": len(files)
        }
        
    except Exception as e:
        logger.error(f"List files error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@router.post("/storage/read-file")
async def read_storage_file(
    request: FileReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Read file from cloud storage into investigation
    """
    try:
        # Read file into DataFrame
        df = await cloud_storage_connector.read_file(
            connection_name=request.connection_name,
            container_or_bucket=request.container_or_bucket,
            file_path=request.file_path
        )
        
        # Create investigation
        investigation = Investigation(
            user_id=current_user.id,
            name=f"Cloud Storage File - {request.file_path}",
            status="completed",
            results={
                "connection_name": request.connection_name,
                "file_path": request.file_path,
                "container_or_bucket": request.container_or_bucket,
                "processed_data": df.to_dict('records'),
                "data_summary": {
                    "total_rows": len(df),
                    "total_columns": len(df.columns),
                    "columns": df.columns.tolist(),
                    "data_types": df.dtypes.astype(str).to_dict()
                },
                "read_at": datetime.utcnow().isoformat()
            }
        )
        
        db.add(investigation)
        db.commit()
        db.refresh(investigation)
        
        return {
            "investigation_id": investigation.id,
            "rows_loaded": len(df),
            "columns": df.columns.tolist(),
            "preview_data": df.head(5).to_dict('records'),
            "read_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"File read error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

# API Integration Endpoints
@router.post("/api/connect")
async def connect_api(
    request: APIConnectionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Connect to external API
    """
    try:
        success = api_connector.create_api_connection(
            connection_name=request.connection_name,
            base_url=request.base_url,
            headers=request.headers,
            auth_token=request.auth_token,
            api_key=request.api_key
        )
        
        if success:
            return {
                "message": f"Successfully connected to API",
                "connection_name": request.connection_name,
                "base_url": request.base_url,
                "connected_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="API connection failed")
            
    except Exception as e:
        logger.error(f"API connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@router.post("/api/fetch")
async def fetch_api_data(
    request: APIFetchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch data from external API
    """
    try:
        # Fetch data from API
        df = await api_connector.fetch_data(
            connection_name=request.connection_name,
            endpoint=request.endpoint,
            method=request.method,
            params=request.params,
            data=request.data
        )
        
        # Create investigation
        investigation = Investigation(
            user_id=current_user.id,
            name=f"API Data - {request.connection_name}/{request.endpoint}",
            status="completed",
            results={
                "connection_name": request.connection_name,
                "endpoint": request.endpoint,
                "method": request.method,
                "processed_data": df.to_dict('records'),
                "data_summary": {
                    "total_rows": len(df),
                    "total_columns": len(df.columns),
                    "columns": df.columns.tolist(),
                    "data_types": df.dtypes.astype(str).to_dict()
                },
                "fetched_at": datetime.utcnow().isoformat()
            }
        )
        
        db.add(investigation)
        db.commit()
        db.refresh(investigation)
        
        return {
            "investigation_id": investigation.id,
            "rows_fetched": len(df),
            "columns": df.columns.tolist(),
            "preview_data": df.head(5).to_dict('records'),
            "fetched_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"API fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

# Webhook Endpoints
@router.post("/webhooks/setup")
async def setup_webhook(
    request: WebhookSetupRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Setup webhook for receiving data
    """
    try:
        def webhook_callback(data):
            # Process incoming webhook data
            logger.info(f"Webhook {request.webhook_name} received data: {len(str(data))} bytes")
            return {"status": "processed"}
        
        endpoint_path = api_connector.setup_webhook(
            webhook_name=request.webhook_name,
            endpoint_path=request.endpoint_path,
            callback_function=webhook_callback,
            auth_method=request.auth_method,
            secret=request.secret
        )
        
        return {
            "message": f"Webhook '{request.webhook_name}' setup successfully",
            "webhook_name": request.webhook_name,
            "endpoint_path": endpoint_path,
            "setup_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Webhook setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook setup failed: {str(e)}")

# Real-time Streaming Endpoints
@router.post("/streaming/connect")
async def connect_streaming(
    request: StreamingConnectionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Connect to real-time data stream
    """
    try:
        success = False
        
        if request.stream_type == 'kafka':
            success = await realtime_streamer.connect_kafka_stream(
                stream_name=request.stream_name,
                bootstrap_servers=request.config['bootstrap_servers'],
                topic=request.config['topic'],
                group_id=request.config['group_id']
            )
        
        # Add other streaming types as needed
        
        if success:
            # Start background processing
            async def stream_processor(data_batch):
                # Process streaming data
                logger.info(f"Processing {len(data_batch)} streaming records")
                return data_batch
            
            background_tasks.add_task(
                realtime_streamer.process_stream_data,
                request.stream_name,
                stream_processor
            )
            
            return {
                "message": f"Successfully connected to {request.stream_type} stream",
                "stream_name": request.stream_name,
                "stream_type": request.stream_type,
                "connected_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Stream connection failed")
            
    except Exception as e:
        logger.error(f"Streaming connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

# Connection Management
@router.get("/connections")
async def list_connections(
    current_user: User = Depends(get_current_user)
):
    """
    List all active connections
    """
    try:
        connections = {
            "database_connections": list(database_connector.connection_pools.keys()),
            "storage_connections": list(cloud_storage_connector.clients.keys()),
            "api_connections": list(api_connector.sessions.keys()),
            "streaming_connections": list(realtime_streamer.streams.keys()),
            "webhook_handlers": list(api_connector.webhook_handlers.keys())
        }
        
        total_connections = sum(len(conn_list) for conn_list in connections.values())
        
        return {
            "connections": connections,
            "total_connections": total_connections,
            "retrieved_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"List connections error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list connections: {str(e)}")

@router.delete("/connections/{connection_name}")
async def remove_connection(
    connection_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    Remove a connection
    """
    try:
        removed = False
        connection_type = None
        
        # Check different connection types
        if connection_name in database_connector.connection_pools:
            # Close database connection pool
            pool_info = database_connector.connection_pools[connection_name]
            if pool_info['type'] in ['postgresql', 'mysql']:
                await pool_info['pool'].close()
            del database_connector.connection_pools[connection_name]
            removed = True
            connection_type = "database"
        
        elif connection_name in cloud_storage_connector.clients:
            del cloud_storage_connector.clients[connection_name]
            removed = True
            connection_type = "storage"
        
        elif connection_name in api_connector.sessions:
            del api_connector.sessions[connection_name]
            removed = True
            connection_type = "api"
        
        elif connection_name in realtime_streamer.streams:
            del realtime_streamer.streams[connection_name]
            removed = True
            connection_type = "streaming"
        
        if removed:
            return {
                "message": f"Connection '{connection_name}' removed successfully",
                "connection_name": connection_name,
                "connection_type": connection_type,
                "removed_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail="Connection not found")
            
    except Exception as e:
        logger.error(f"Remove connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove connection: {str(e)}")

@router.get("/health")
async def integration_health_check():
    """
    Health check for integration services
    """
    try:
        health_status = {
            "database_connector": "healthy",
            "storage_connector": "healthy", 
            "api_connector": "healthy",
            "streaming_connector": "healthy",
            "total_connections": (
                len(database_connector.connection_pools) +
                len(cloud_storage_connector.clients) +
                len(api_connector.sessions) +
                len(realtime_streamer.streams)
            ),
            "last_check": datetime.utcnow().isoformat()
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "last_check": datetime.utcnow().isoformat()
        } 