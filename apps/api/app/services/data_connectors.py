"""
Universal Data Connectors Service for Schlep-engine
Provides comprehensive data integration capabilities including databases, cloud storage, APIs, and real-time streaming
"""

import asyncio
import pandas as pd
import json
import logging
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime, timedelta
import aiohttp
import asyncpg
import aiomysql
import motor.motor_asyncio
# Cloud storage SDKs removed - placeholders for future cloud integration
# # import boto3  # Cloud SDK removed
# from google.cloud import storage as gcs
# from azure.storage.blob.aio import BlobServiceClient
import redis.asyncio as redis
from kafka import KafkaConsumer, KafkaProducer
import websockets
from urllib.parse import urlparse
import ssl
from pathlib import Path
import io
import threading
import hashlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class CloudStorageConfig:
    """Configuration for enhanced cloud storage operations"""
    multipart_threshold: int = 100 * 1024 * 1024  # 100MB
    multipart_chunksize: int = 50 * 1024 * 1024   # 50MB per part
    max_parallel_uploads: int = 10
    max_parallel_downloads: int = 10
    enable_caching: bool = True
    cache_ttl_seconds: int = 3600  # 1 hour
    enable_compression: bool = True
    retry_attempts: int = 3
    timeout_seconds: int = 300

@dataclass
class CacheEntry:
    """Cache entry for storing file data"""
    data: Any
    timestamp: float
    size_bytes: int
    etag: Optional[str] = None

    def is_expired(self, ttl_seconds: int) -> bool:
        return time.time() - self.timestamp > ttl_seconds

class CloudStorageCache:
    """In-memory cache for cloud storage data with TTL"""

    def __init__(self, max_size_mb: int = 1000):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.current_size_bytes = 0
        self.lock = threading.RLock()

    def _generate_key(self, connection_name: str, container: str, file_path: str) -> str:
        """Generate cache key"""
        key_string = f"{connection_name}:{container}:{file_path}"
        return hashlib.md5(key_string.encode()).hexdigest()

    def get(self, connection_name: str, container: str, file_path: str,
            ttl_seconds: int) -> Optional[Any]:
        """Get cached data if valid"""
        key = self._generate_key(connection_name, container, file_path)

        with self.lock:
            if key in self.cache:
                entry = self.cache[key]
                if not entry.is_expired(ttl_seconds):
                    logger.debug(f"Cache hit for {file_path}")
                    return entry.data
                else:
                    # Remove expired entry
                    self._remove_entry(key)

        logger.debug(f"Cache miss for {file_path}")
        return None

    def put(self, connection_name: str, container: str, file_path: str,
            data: Any, etag: Optional[str] = None):
        """Store data in cache"""
        key = self._generate_key(connection_name, container, file_path)

        # Estimate data size
        try:
            if isinstance(data, pd.DataFrame):
                size_bytes = data.memory_usage(deep=True).sum()
            elif isinstance(data, bytes):
                size_bytes = len(data)
            elif isinstance(data, str):
                size_bytes = len(data.encode('utf-8'))
            else:
                size_bytes = 0  # Skip caching for unknown types
                return
        except:
            size_bytes = 0
            return

        with self.lock:
            # Check if we need to make space
            while (self.current_size_bytes + size_bytes > self.max_size_bytes
                   and len(self.cache) > 0):
                self._evict_oldest()

            # Store entry
            entry = CacheEntry(
                data=data,
                timestamp=time.time(),
                size_bytes=size_bytes,
                etag=etag
            )

            # Remove old entry if exists
            if key in self.cache:
                self._remove_entry(key)

            self.cache[key] = entry
            self.current_size_bytes += size_bytes

            logger.debug(f"Cached {file_path}, cache size: {len(self.cache)} entries, "
                        f"{self.current_size_bytes / (1024*1024):.1f}MB")

    def _remove_entry(self, key: str):
        """Remove entry from cache"""
        if key in self.cache:
            entry = self.cache[key]
            self.current_size_bytes -= entry.size_bytes
            del self.cache[key]

    def _evict_oldest(self):
        """Evict oldest cache entry"""
        if not self.cache:
            return

        oldest_key = min(self.cache.keys(),
                        key=lambda k: self.cache[k].timestamp)
        self._remove_entry(oldest_key)

    def invalidate(self, connection_name: str, container: str, file_path: str):
        """Invalidate specific cache entry"""
        key = self._generate_key(connection_name, container, file_path)
        with self.lock:
            if key in self.cache:
                self._remove_entry(key)

    def clear(self):
        """Clear all cache entries"""
        with self.lock:
            self.cache.clear()
            self.current_size_bytes = 0

class DatabaseConnector:
    """
    Universal database connector supporting PostgreSQL, MySQL, and MongoDB
    """
    
    def __init__(self):
        self.connections = {}
        self.connection_pools = {}
        
    async def connect_postgresql(
        self,
        connection_name: str,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        ssl_mode: str = 'prefer'
    ) -> bool:
        """Connect to PostgreSQL database"""
        try:
            # Create connection pool
            dsn = f"postgresql://{username}:{password}@{host}:{port}/{database}"
            pool = await asyncpg.create_pool(
                dsn,
                ssl=ssl_mode,
                min_size=1,
                max_size=10,
                command_timeout=60
            )
            
            # Test connection
            async with pool.acquire() as conn:
                await conn.execute("SELECT 1")
                
            self.connection_pools[connection_name] = {
                'type': 'postgresql',
                'pool': pool,
                'config': {
                    'host': host,
                    'port': port,
                    'database': database,
                    'username': username
                }
            }
            
            logger.info(f"PostgreSQL connection '{connection_name}' established successfully")
            return True
            
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {str(e)}")
            return False
    
    async def connect_mysql(
        self,
        connection_name: str,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str
    ) -> bool:
        """Connect to MySQL database"""
        try:
            # Create connection pool
            pool = await aiomysql.create_pool(
                host=host,
                port=port,
                user=username,
                password=password,
                db=database,
                minsize=1,
                maxsize=10
            )
            
            # Test connection
            async with pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute("SELECT 1")
                    
            self.connection_pools[connection_name] = {
                'type': 'mysql',
                'pool': pool,
                'config': {
                    'host': host,
                    'port': port,
                    'database': database,
                    'username': username
                }
            }
            
            logger.info(f"MySQL connection '{connection_name}' established successfully")
            return True
            
        except Exception as e:
            logger.error(f"MySQL connection failed: {str(e)}")
            return False
    
    def connect_mongodb(
        self,
        connection_name: str,
        connection_string: str,
        database: str
    ) -> bool:
        """Connect to MongoDB database"""  
        try:
            client = motor.motor_asyncio.AsyncIOMotorClient(connection_string)
            db = client[database]
            
            # Test connection (will be async when used)
            self.connections[connection_name] = {
                'type': 'mongodb',
                'client': client,
                'database': db,
                'config': {
                    'connection_string': connection_string,
                    'database': database
                }
            }
            
            logger.info(f"MongoDB connection '{connection_name}' established successfully")
            return True
            
        except Exception as e:
            logger.error(f"MongoDB connection failed: {str(e)}")
            return False
    
    async def execute_query(
        self,
        connection_name: str,
        query: str,
        params: Optional[Dict[str, Any]] = None
    ) -> pd.DataFrame:
        """Execute SQL query and return results as DataFrame"""
        if connection_name not in self.connection_pools and connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")
            
        try:
            if connection_name in self.connection_pools:
                conn_info = self.connection_pools[connection_name]
                
                if conn_info['type'] == 'postgresql':
                    async with conn_info['pool'].acquire() as conn:
                        if params:
                            result = await conn.fetch(query, *params.values())
                        else:
                            result = await conn.fetch(query)
                        
                        # Convert to DataFrame
                        if result:
                            columns = list(result[0].keys())
                            data = [list(row.values()) for row in result]
                            return pd.DataFrame(data, columns=columns)
                        else:
                            return pd.DataFrame()
                            
                elif conn_info['type'] == 'mysql':
                    async with conn_info['pool'].acquire() as conn:
                        async with conn.cursor() as cursor:
                            if params:
                                await cursor.execute(query, list(params.values()))
                            else:
                                await cursor.execute(query)
                            result = await cursor.fetchall()
                            
                            # Get column names
                            columns = [desc[0] for desc in cursor.description]
                            return pd.DataFrame(result, columns=columns)
                            
            elif connection_name in self.connections:
                conn_info = self.connections[connection_name]
                
                if conn_info['type'] == 'mongodb':
                    # MongoDB query execution
                    db = conn_info['database']
                    # Parse MongoDB query (simplified - would need more robust parsing)
                    collection_name = query.split('.')[0] if '.' in query else 'default'
                    collection = db[collection_name]
                    
                    # Execute find operation (simplified)
                    cursor = collection.find(params or {})
                    documents = await cursor.to_list(length=None)
                    
                    if documents:
                        return pd.DataFrame(documents)
                    else:
                        return pd.DataFrame()
                        
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            raise
    
    async def list_tables(self, connection_name: str) -> List[str]:
        """List all tables in the database"""
        if connection_name not in self.connection_pools and connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")
            
        try:
            if connection_name in self.connection_pools:
                conn_info = self.connection_pools[connection_name]
                
                if conn_info['type'] == 'postgresql':
                    query = """
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                    """
                    async with conn_info['pool'].acquire() as conn:
                        result = await conn.fetch(query)
                        return [row['table_name'] for row in result]
                        
                elif conn_info['type'] == 'mysql':
                    query = "SHOW TABLES"
                    async with conn_info['pool'].acquire() as conn:
                        async with conn.cursor() as cursor:
                            await cursor.execute(query)
                            result = await cursor.fetchall()
                            return [row[0] for row in result]
                            
            elif connection_name in self.connections:
                conn_info = self.connections[connection_name]
                
                if conn_info['type'] == 'mongodb':
                    db = conn_info['database']
                    collections = await db.list_collection_names()
                    return collections
                    
            return []
            
        except Exception as e:
            logger.error(f"Failed to list tables: {str(e)}")
            raise
    
    async def get_table_schema(self, connection_name: str, table_name: str) -> Dict[str, Any]:
        """Get schema information for a specific table"""
        if connection_name not in self.connection_pools and connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")
            
        try:
            if connection_name in self.connection_pools:
                conn_info = self.connection_pools[connection_name]
                
                if conn_info['type'] == 'postgresql':
                    query = """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND table_schema = 'public'
                    ORDER BY ordinal_position
                    """
                    async with conn_info['pool'].acquire() as conn:
                        result = await conn.fetch(query, table_name)
                        return {
                            'columns': [
                                {
                                    'name': row['column_name'],
                                    'type': row['data_type'],
                                    'nullable': row['is_nullable'] == 'YES',
                                    'default': row['column_default']
                                }
                                for row in result
                            ]
                        }
                        
                elif conn_info['type'] == 'mysql':
                    query = f"DESCRIBE {table_name}"
                    async with conn_info['pool'].acquire() as conn:
                        async with conn.cursor() as cursor:
                            await cursor.execute(query)
                            result = await cursor.fetchall()
                            return {
                                'columns': [
                                    {
                                        'name': row[0],
                                        'type': row[1],
                                        'nullable': row[2] == 'YES',
                                        'default': row[4]
                                    }
                                    for row in result
                                ]
                            }
                            
            elif connection_name in self.connections:
                conn_info = self.connections[connection_name]
                
                if conn_info['type'] == 'mongodb':
                    # MongoDB schema inference (sample documents)
                    db = conn_info['database']
                    collection = db[table_name]
                    sample_docs = await collection.find().limit(100).to_list(length=None)
                    
                    if sample_docs:
                        # Infer schema from sample documents
                        schema = {}
                        for doc in sample_docs:
                            for key, value in doc.items():
                                if key not in schema:
                                    schema[key] = type(value).__name__
                                    
                        return {
                            'columns': [
                                {
                                    'name': key,
                                    'type': value,
                                    'nullable': True,
                                    'default': None
                                }
                                for key, value in schema.items()
                            ]
                        }
                        
            return {'columns': []}
            
        except Exception as e:
            logger.error(f"Failed to get table schema: {str(e)}")
            raise

class CloudStorageConnector:
    """
    Universal cloud storage connector supporting AWS S3, Google Cloud Storage, and Azure Blob
    Enhanced with multi-part uploads, parallel processing, and caching
    """

    def __init__(self, config: CloudStorageConfig = None):
        self.connections = {}
        self.config = config or CloudStorageConfig()
        self.cache = CloudStorageCache() if self.config.enable_caching else None
        self.executor = ThreadPoolExecutor(max_workers=max(
            self.config.max_parallel_uploads,
            self.config.max_parallel_downloads
        ))
        
    async def connect_cloud_storage(
        self,
        connection_name: str,
        provider: str,
        credentials: Dict[str, Any]
    ) -> bool:
        """Generic cloud storage connector - placeholder for future implementation"""
        # AWS S3 functionality removed - placeholder for future cloud storage integration
        logger.warning(f"Cloud storage connector for {provider} not implemented yet")
        return False
    
    async def connect_gcs(
        self,
        connection_name: str,
        credentials_path: str,
        project_id: str
    ) -> bool:
        """Connect to Google Cloud Storage - DISABLED (GCS SDK removed)"""
        logger.warning("GCS connector disabled - Google Cloud SDK removed")
        return False
            
            # Test connection
            list(client.list_buckets(max_results=1))
            
            self.connections[connection_name] = {
                'type': 'gcs',
                'client': client,
                'config': {
                    'project_id': project_id
                }
            }
            
            logger.info(f"GCS connection '{connection_name}' established successfully")
            return True
            
        except Exception as e:
            logger.error(f"GCS connection failed: {str(e)}")
            return False
    
    async def connect_azure_blob(
        self,
        connection_name: str,
        account_name: str,
        account_key: str
    ) -> bool:
        """Connect to Azure Blob Storage"""
        try:
            account_url = f"https://{account_name}.blob.core.windows.net"
            client = BlobServiceClient(
                account_url=account_url,
                credential=account_key
            )
            
            # Test connection
            async with client:
                containers = []
                async for container in client.list_containers(max_results=1):
                    containers.append(container)
            
            self.connections[connection_name] = {
                'type': 'azure_blob',
                'client': client,
                'config': {
                    'account_name': account_name
                }
            }
            
            logger.info(f"Azure Blob connection '{connection_name}' established successfully")
            return True
            
        except Exception as e:
            logger.error(f"Azure Blob connection failed: {str(e)}")
            return False
    
    async def list_files(
        self,
        connection_name: str,
        container_or_bucket: str,
        prefix: str = ""
    ) -> List[Dict[str, Any]]:
        """List files in cloud storage"""
        if connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")
            
        conn_info = self.connections[connection_name]
        
        try:
            if conn_info['type'] == 'aws_s3':
                client = conn_info['client']
                response = client.list_objects_v2(
                    Bucket=container_or_bucket,
                    Prefix=prefix
                )
                
                files = []
                for obj in response.get('Contents', []):
                    files.append({
                        'name': obj['Key'],
                        'size': obj['Size'],
                        'modified': obj['LastModified'].isoformat(),
                        'etag': obj['ETag']
                    })
                return files
                
            elif conn_info['type'] == 'gcs':
                client = conn_info['client']
                bucket = client.bucket(container_or_bucket)
                blobs = bucket.list_blobs(prefix=prefix)
                
                files = []
                for blob in blobs:
                    files.append({
                        'name': blob.name,
                        'size': blob.size,
                        'modified': blob.time_created.isoformat() if blob.time_created else None,
                        'etag': blob.etag
                    })
                return files
                
            elif conn_info['type'] == 'azure_blob':
                client = conn_info['client']
                async with client:
                    container_client = client.get_container_client(container_or_bucket)
                    
                    files = []
                    async for blob in container_client.list_blobs(name_starts_with=prefix):
                        files.append({
                            'name': blob.name,
                            'size': blob.size,
                            'modified': blob.last_modified.isoformat() if blob.last_modified else None,
                            'etag': blob.etag
                        })
                    return files
                    
            return []
            
        except Exception as e:
            logger.error(f"Failed to list files: {str(e)}")
            raise
    
    async def read_file_parallel(
        self,
        connection_name: str,
        container_or_bucket: str,
        file_path: str,
        chunk_size: Optional[int] = None
    ) -> pd.DataFrame:
        """Read large file from cloud storage using parallel chunks"""
        if connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")

        # Check cache first
        if self.cache:
            cached_data = self.cache.get(
                connection_name, container_or_bucket, file_path,
                self.config.cache_ttl_seconds
            )
            if cached_data is not None:
                return cached_data

        conn_info = self.connections[connection_name]

        try:
            # Get file info first
            file_info = await self._get_file_info(connection_name, container_or_bucket, file_path)
            file_size = file_info.get('size', 0)

            # Determine if we should use parallel reading
            if file_size > self.config.multipart_threshold:
                logger.info(f"Using parallel reading for large file: {file_size / (1024*1024):.1f}MB")
                df = await self._read_file_parallel_chunks(
                    connection_name, container_or_bucket, file_path, file_size, chunk_size
                )
            else:
                # Use standard reading for smaller files
                df = await self._read_file_standard(connection_name, container_or_bucket, file_path)

            # Cache the result
            if self.cache and df is not None:
                self.cache.put(connection_name, container_or_bucket, file_path, df, file_info.get('etag'))

            return df

        except Exception as e:
            logger.error(f"Failed to read file: {str(e)}")
            raise

    async def _get_file_info(self, connection_name: str, container_or_bucket: str, file_path: str) -> Dict[str, Any]:
        """Get file metadata"""
        conn_info = self.connections[connection_name]

        if conn_info['type'] == 'aws_s3':
            client = conn_info['client']
            response = client.head_object(Bucket=container_or_bucket, Key=file_path)
            return {
                'size': response['ContentLength'],
                'etag': response['ETag'],
                'last_modified': response['LastModified']
            }
        elif conn_info['type'] == 'gcs':
            client = conn_info['client']
            bucket = client.bucket(container_or_bucket)
            blob = bucket.blob(file_path)
            blob.reload()
            return {
                'size': blob.size,
                'etag': blob.etag,
                'last_modified': blob.time_created
            }
        elif conn_info['type'] == 'azure_blob':
            client = conn_info['client']
            async with client:
                blob_client = client.get_blob_client(container=container_or_bucket, blob=file_path)
                properties = await blob_client.get_blob_properties()
                return {
                    'size': properties.size,
                    'etag': properties.etag,
                    'last_modified': properties.last_modified
                }

        return {}

    async def _read_file_parallel_chunks(
        self,
        connection_name: str,
        container_or_bucket: str,
        file_path: str,
        file_size: int,
        chunk_size: Optional[int] = None
    ) -> pd.DataFrame:
        """Read file in parallel chunks for better performance"""

        chunk_size = chunk_size or self.config.multipart_chunksize
        num_chunks = (file_size + chunk_size - 1) // chunk_size

        logger.info(f"Reading file in {num_chunks} parallel chunks")

        # Read chunks in parallel
        futures = []
        for i in range(num_chunks):
            start_byte = i * chunk_size
            end_byte = min(start_byte + chunk_size - 1, file_size - 1)

            future = self.executor.submit(
                self._read_chunk_sync,
                connection_name, container_or_bucket, file_path,
                start_byte, end_byte
            )
            futures.append(future)

        # Collect chunks
        chunks = []
        for future in as_completed(futures):
            try:
                chunk_data = future.result(timeout=self.config.timeout_seconds)
                if chunk_data:
                    chunks.append(chunk_data)
            except Exception as e:
                logger.error(f"Failed to read chunk: {e}")

        if not chunks:
            return pd.DataFrame()

        # Combine chunks into single DataFrame
        try:
            # For CSV-like data, we need to handle headers properly
            file_extension = Path(file_path).suffix.lower()

            if file_extension == '.csv':
                # First chunk contains header, others don't
                combined_data = chunks[0]
                for chunk in chunks[1:]:
                    combined_data += chunk

                return pd.read_csv(io.StringIO(combined_data.decode('utf-8')))
            else:
                # For other formats, combine binary data
                combined_data = b''.join(chunks)
                return self._parse_file_data(combined_data, file_extension)

        except Exception as e:
            logger.error(f"Failed to combine chunks: {e}")
            raise

    def _read_chunk_sync(
        self,
        connection_name: str,
        container_or_bucket: str,
        file_path: str,
        start_byte: int,
        end_byte: int
    ) -> bytes:
        """Read a specific chunk of file (synchronous for thread pool)"""
        conn_info = self.connections[connection_name]

        try:
            if conn_info['type'] == 'aws_s3':
                client = conn_info['client']
                response = client.get_object(
                    Bucket=container_or_bucket,
                    Key=file_path,
                    Range=f'bytes={start_byte}-{end_byte}'
                )
                return response['Body'].read()

            elif conn_info['type'] == 'gcs':
                client = conn_info['client']
                bucket = client.bucket(container_or_bucket)
                blob = bucket.blob(file_path)
                return blob.download_as_bytes(start=start_byte, end=end_byte + 1)

            elif conn_info['type'] == 'azure_blob':
                # Azure Blob doesn't support range reads in sync mode easily
                # Fall back to full download for this chunk
                raise NotImplementedError("Azure Blob parallel reading not implemented")

        except Exception as e:
            logger.error(f"Failed to read chunk {start_byte}-{end_byte}: {e}")
            raise

        return b''

    async def _read_file_standard(self, connection_name: str, container_or_bucket: str, file_path: str) -> pd.DataFrame:
        """Standard file reading method"""
        return await self.read_file(connection_name, container_or_bucket, file_path)

    def _parse_file_data(self, data: bytes, file_extension: str) -> pd.DataFrame:
        """Parse file data based on extension"""
        if file_extension == '.csv':
            return pd.read_csv(io.BytesIO(data))
        elif file_extension in ['.xlsx', '.xls']:
            return pd.read_excel(io.BytesIO(data))
        elif file_extension == '.json':
            json_data = json.loads(data.decode('utf-8'))
            return pd.DataFrame(json_data) if isinstance(json_data, list) else pd.DataFrame([json_data])
        elif file_extension == '.parquet':
            return pd.read_parquet(io.BytesIO(data))
        else:
            # Try CSV as default
            return pd.read_csv(io.BytesIO(data))

    async def upload_large_file(
        self,
        connection_name: str,
        container_or_bucket: str,
        file_path: str,
        local_file_path: str,
        use_multipart: bool = True
    ) -> Dict[str, Any]:
        """Upload large file using multipart upload if supported"""
        if connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")

        local_path = Path(local_file_path)
        if not local_path.exists():
            raise FileNotFoundError(f"Local file not found: {local_file_path}")

        file_size = local_path.stat().st_size
        use_multipart = use_multipart and file_size > self.config.multipart_threshold

        logger.info(f"Uploading file {local_file_path} ({file_size / (1024*1024):.1f}MB) "
                   f"using {'multipart' if use_multipart else 'standard'} method")

        conn_info = self.connections[connection_name]

        try:
            if use_multipart and conn_info['type'] == 'aws_s3':
                return await self._upload_multipart_s3(
                    conn_info['client'], container_or_bucket, file_path, local_file_path, file_size
                )
            else:
                return await self._upload_standard(
                    connection_name, container_or_bucket, file_path, local_file_path
                )

        except Exception as e:
            logger.error(f"Failed to upload file: {e}")
            raise

    async def _upload_multipart_s3(
        self,
        s3_client,
        bucket: str,
        key: str,
        local_file_path: str,
        file_size: int
    ) -> Dict[str, Any]:
        """Upload file to S3 using multipart upload"""

        # Initiate multipart upload
        response = s3_client.create_multipart_upload(Bucket=bucket, Key=key)
        upload_id = response['UploadId']

        try:
            chunk_size = self.config.multipart_chunksize
            num_parts = (file_size + chunk_size - 1) // chunk_size

            logger.info(f"Starting multipart upload with {num_parts} parts")

            # Upload parts in parallel
            futures = []
            parts_info = []

            with open(local_file_path, 'rb') as file:
                for part_number in range(1, num_parts + 1):
                    start_byte = (part_number - 1) * chunk_size
                    file.seek(start_byte)
                    chunk_data = file.read(chunk_size)

                    if not chunk_data:
                        break

                    future = self.executor.submit(
                        self._upload_part_s3,
                        s3_client, bucket, key, upload_id, part_number, chunk_data
                    )
                    futures.append((part_number, future))

            # Collect part results
            for part_number, future in futures:
                try:
                    part_info = future.result(timeout=self.config.timeout_seconds)
                    parts_info.append({
                        'ETag': part_info['ETag'],
                        'PartNumber': part_number
                    })
                except Exception as e:
                    logger.error(f"Failed to upload part {part_number}: {e}")
                    # Abort multipart upload
                    s3_client.abort_multipart_upload(
                        Bucket=bucket, Key=key, UploadId=upload_id
                    )
                    raise

            # Sort parts by part number
            parts_info.sort(key=lambda x: x['PartNumber'])

            # Complete multipart upload
            response = s3_client.complete_multipart_upload(
                Bucket=bucket,
                Key=key,
                UploadId=upload_id,
                MultipartUpload={'Parts': parts_info}
            )

            return {
                'status': 'success',
                'location': response['Location'],
                'etag': response['ETag'],
                'upload_method': 'multipart',
                'parts_uploaded': len(parts_info)
            }

        except Exception as e:
            # Abort multipart upload on failure
            try:
                s3_client.abort_multipart_upload(
                    Bucket=bucket, Key=key, UploadId=upload_id
                )
            except:
                pass
            raise

    def _upload_part_s3(self, s3_client, bucket: str, key: str, upload_id: str,
                       part_number: int, data: bytes) -> Dict[str, Any]:
        """Upload a single part for S3 multipart upload"""
        response = s3_client.upload_part(
            Bucket=bucket,
            Key=key,
            PartNumber=part_number,
            UploadId=upload_id,
            Body=data
        )
        return response

    async def _upload_standard(
        self,
        connection_name: str,
        container_or_bucket: str,
        file_path: str,
        local_file_path: str
    ) -> Dict[str, Any]:
        """Standard upload method"""
        conn_info = self.connections[connection_name]

        try:
            if conn_info['type'] == 'aws_s3':
                client = conn_info['client']
                client.upload_file(local_file_path, container_or_bucket, file_path)

            elif conn_info['type'] == 'gcs':
                client = conn_info['client']
                bucket = client.bucket(container_or_bucket)
                blob = bucket.blob(file_path)
                blob.upload_from_filename(local_file_path)

            elif conn_info['type'] == 'azure_blob':
                client = conn_info['client']
                async with client:
                    blob_client = client.get_blob_client(
                        container=container_or_bucket, blob=file_path
                    )
                    with open(local_file_path, 'rb') as data:
                        await blob_client.upload_blob(data, overwrite=True)

            return {
                'status': 'success',
                'upload_method': 'standard'
            }

        except Exception as e:
            logger.error(f"Standard upload failed: {e}")
            raise

    async def read_file(
        self,
        connection_name: str,
        container_or_bucket: str,
        file_path: str
    ) -> pd.DataFrame:
        """Read file from cloud storage and return as DataFrame"""
        if connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")
            
        conn_info = self.connections[connection_name]
        
        try:
            file_content = None
            
            if conn_info['type'] == 'aws_s3':
                client = conn_info['client']
                response = client.get_object(
                    Bucket=container_or_bucket,
                    Key=file_path
                )
                file_content = response['Body'].read()
                
            elif conn_info['type'] == 'gcs':
                client = conn_info['client']
                bucket = client.bucket(container_or_bucket)
                blob = bucket.blob(file_path)
                file_content = blob.download_as_bytes()
                
            elif conn_info['type'] == 'azure_blob':
                client = conn_info['client']
                async with client:
                    blob_client = client.get_blob_client(
                        container=container_or_bucket,
                        blob=file_path
                    )
                    download_stream = await blob_client.download_blob()
                    file_content = await download_stream.readall()
            
            if file_content:
                # Determine file type and read accordingly
                file_extension = Path(file_path).suffix.lower()
                
                if file_extension == '.csv':
                    return pd.read_csv(io.BytesIO(file_content))
                elif file_extension in ['.xlsx', '.xls']:
                    return pd.read_excel(io.BytesIO(file_content))
                elif file_extension == '.json':
                    data = json.loads(file_content.decode('utf-8'))
                    return pd.DataFrame(data) if isinstance(data, list) else pd.DataFrame([data])
                elif file_extension == '.parquet':
                    return pd.read_parquet(io.BytesIO(file_content))
                else:
                    # Try to read as CSV by default
                    return pd.read_csv(io.BytesIO(file_content))
                    
            return pd.DataFrame()
            
        except Exception as e:
            logger.error(f"Failed to read file: {str(e)}")
            raise

class APIConnector:
    """
    Universal API connector for REST and GraphQL APIs
    """
    
    def __init__(self):
        self.connections = {}
        self.sessions = {}
        
    async def connect_api(
        self,
        connection_name: str,
        base_url: str,
        headers: Optional[Dict[str, str]] = None,
        auth_token: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> bool:
        """Connect to REST API"""
        try:
            # Prepare headers
            conn_headers = headers or {}
            if auth_token:
                conn_headers['Authorization'] = f'Bearer {auth_token}'
            if api_key:
                conn_headers['X-API-Key'] = api_key
                
            # Create aiohttp session
            session = aiohttp.ClientSession(
                headers=conn_headers,
                timeout=aiohttp.ClientTimeout(total=30)
            )
            
            # Test connection
            async with session.get(f"{base_url.rstrip('/')}/") as response:
                # Don't require 200, just that we can connect
                pass
                
            self.connections[connection_name] = {
                'type': 'rest_api',
                'base_url': base_url.rstrip('/'),
                'headers': conn_headers
            }
            self.sessions[connection_name] = session
            
            logger.info(f"API connection '{connection_name}' established successfully")
            return True
            
        except Exception as e:
            logger.error(f"API connection failed: {str(e)}")
            if connection_name in self.sessions:
                await self.sessions[connection_name].close()
                del self.sessions[connection_name]
            return False
    
    async def fetch_data(
        self,
        connection_name: str,
        endpoint: str,
        method: str = 'GET',
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> pd.DataFrame:
        """Fetch data from API endpoint"""
        if connection_name not in self.connections:
            raise ValueError(f"Connection '{connection_name}' not found")
            
        conn_info = self.connections[connection_name]
        session = self.sessions[connection_name]
        
        try:
            url = f"{conn_info['base_url']}/{endpoint.lstrip('/')}"
            
            async with session.request(
                method=method.upper(),
                url=url,
                params=params,
                json=data if data else None
            ) as response:
                response.raise_for_status()
                
                content_type = response.headers.get('content-type', '')
                
                if 'application/json' in content_type:
                    json_data = await response.json()
                    
                    # Handle different JSON structures
                    if isinstance(json_data, list):
                        return pd.DataFrame(json_data)
                    elif isinstance(json_data, dict):
                        # Look for common data keys
                        for key in ['data', 'results', 'items', 'records']:
                            if key in json_data and isinstance(json_data[key], list):
                                return pd.DataFrame(json_data[key])
                        # If no common key, treat as single record
                        return pd.DataFrame([json_data])
                    else:
                        return pd.DataFrame([{'response': json_data}])
                        
                elif 'text/csv' in content_type:
                    text_data = await response.text()
                    return pd.read_csv(io.StringIO(text_data))
                    
                else:
                    # Try to parse as JSON anyway
                    text_data = await response.text()
                    try:
                        json_data = json.loads(text_data)
                        return pd.DataFrame([json_data] if isinstance(json_data, dict) else json_data)
                    except:
                        return pd.DataFrame([{'response': text_data}])
                        
        except Exception as e:
            logger.error(f"API fetch failed: {str(e)}")
            raise

class RealtimeStreamer:
    """
    Real-time streaming connector for Kafka, Redis Streams, and WebSockets
    """
    
    def __init__(self):
        self.streams = {}
        self.processors = {}
        
    async def setup_kafka_stream(
        self,
        stream_name: str,
        bootstrap_servers: List[str],
        topic: str,
        group_id: str,
        processor_callback: Callable[[List[Dict]], None]
    ) -> bool:
        """Setup Kafka streaming connection"""
        try:
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=bootstrap_servers,
                group_id=group_id,
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                auto_offset_reset='latest'
            )
            
            self.streams[stream_name] = {
                'type': 'kafka',
                'consumer': consumer,
                'topic': topic
            }
            self.processors[stream_name] = processor_callback
            
            logger.info(f"Kafka stream '{stream_name}' setup successfully")
            return True
            
        except Exception as e:
            logger.error(f"Kafka stream setup failed: {str(e)}")
            return False
    
    async def setup_redis_stream(
        self,
        stream_name: str,
        redis_url: str,
        stream_key: str,
        consumer_group: str,
        processor_callback: Callable[[List[Dict]], None]
    ) -> bool:
        """Setup Redis streams connection"""
        try:
            redis_client = redis.from_url(redis_url)
            
            # Test connection
            await redis_client.ping()
            
            self.streams[stream_name] = {
                'type': 'redis_stream',
                'client': redis_client,
                'stream_key': stream_key,
                'consumer_group': consumer_group
            }
            self.processors[stream_name] = processor_callback
            
            logger.info(f"Redis stream '{stream_name}' setup successfully")
            return True
            
        except Exception as e:
            logger.error(f"Redis stream setup failed: {str(e)}")
            return False
    
    async def setup_websocket_stream(
        self,
        stream_name: str,
        websocket_url: str,
        processor_callback: Callable[[List[Dict]], None]
    ) -> bool:
        """Setup WebSocket streaming connection"""
        try:
            # Test WebSocket connection
            async with websockets.connect(websocket_url) as websocket:
                pass  # Just test the connection
                
            self.streams[stream_name] = {
                'type': 'websocket',
                'url': websocket_url
            }
            self.processors[stream_name] = processor_callback
            
            logger.info(f"WebSocket stream '{stream_name}' setup successfully")
            return True
            
        except Exception as e:
            logger.error(f"WebSocket stream setup failed: {str(e)}")
            return False
    
    async def start_streaming(self, stream_name: str):
        """Start processing stream data"""
        if stream_name not in self.streams:
            raise ValueError(f"Stream '{stream_name}' not found")
            
        stream_info = self.streams[stream_name]
        processor = self.processors[stream_name]
        
        try:
            if stream_info['type'] == 'kafka':
                consumer = stream_info['consumer']
                
                def kafka_processor():
                    for message in consumer:
                        data_batch = [message.value]
                        processor(data_batch)
                        
                # Run in background
                asyncio.create_task(asyncio.to_thread(kafka_processor))
                
            elif stream_info['type'] == 'redis_stream':
                client = stream_info['client']
                stream_key = stream_info['stream_key']
                consumer_group = stream_info['consumer_group']
                
                async def redis_processor():
                    while True:
                        try:
                            messages = await client.xreadgroup(
                                consumer_group,
                                'consumer1',
                                {stream_key: '>'},
                                count=10,
                                block=1000
                            )
                            
                            if messages:
                                data_batch = []
                                for stream, msgs in messages:
                                    for msg_id, fields in msgs:
                                        data_batch.append(dict(fields))
                                        
                                if data_batch:
                                    processor(data_batch)
                                    
                        except Exception as e:
                            logger.error(f"Redis stream processing error: {str(e)}")
                            await asyncio.sleep(5)
                            
                asyncio.create_task(redis_processor())
                
            elif stream_info['type'] == 'websocket':
                websocket_url = stream_info['url']
                
                async def websocket_processor():
                    while True:
                        try:
                            async with websockets.connect(websocket_url) as websocket:
                                async for message in websocket:
                                    try:
                                        data = json.loads(message)
                                        processor([data])
                                    except json.JSONDecodeError:
                                        processor([{'raw_message': message}])
                                        
                        except Exception as e:
                            logger.error(f"WebSocket processing error: {str(e)}")
                            await asyncio.sleep(5)
                            
                asyncio.create_task(websocket_processor())
                
            logger.info(f"Started streaming for '{stream_name}'")
            
        except Exception as e:
            logger.error(f"Failed to start streaming: {str(e)}")
            raise

# Initialize global connectors
database_connector = DatabaseConnector()
cloud_storage_connector = CloudStorageConnector()
api_connector = APIConnector()
realtime_streamer = RealtimeStreamer()

logger.info("Data connectors initialized successfully") 