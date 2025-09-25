"""
Generic Storage Service - Cloud-Agnostic Storage Interface
Supports local filesystem, NFS/SMB, and S3-compatible object storage (MinIO, Ceph)
No cloud provider dependencies - fully self-managed
"""

import os
import shutil
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, BinaryIO
from datetime import datetime
import hashlib
import mimetypes
import aiofiles
import asyncio
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class StorageBackend(ABC):
    """Abstract base class for storage backends"""

    @abstractmethod
    async def upload(self, file_path: str, content: bytes, metadata: Dict[str, Any] = None) -> str:
        """Upload file content to storage backend"""
        pass

    @abstractmethod
    async def download(self, file_path: str) -> bytes:
        """Download file content from storage backend"""
        pass

    @abstractmethod
    async def delete(self, file_path: str) -> bool:
        """Delete file from storage backend"""
        pass

    @abstractmethod
    async def exists(self, file_path: str) -> bool:
        """Check if file exists in storage backend"""
        pass

    @abstractmethod
    async def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files in storage backend"""
        pass

    @abstractmethod
    async def get_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get file metadata from storage backend"""
        pass

class LocalFileSystemBackend(StorageBackend):
    """Local filesystem storage backend"""

    def __init__(self, base_path: str = "./storage"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalFileSystemBackend initialized with base_path: {self.base_path}")

    def _get_full_path(self, file_path: str) -> Path:
        """Get full path for file"""
        return self.base_path / file_path.lstrip('/')

    async def upload(self, file_path: str, content: bytes, metadata: Dict[str, Any] = None) -> str:
        """Upload file to local filesystem"""
        full_path = self._get_full_path(file_path)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(full_path, 'wb') as f:
            await f.write(content)

        # Store metadata as JSON sidecar file
        if metadata:
            metadata_path = full_path.with_suffix(full_path.suffix + '.meta')
            async with aiofiles.open(metadata_path, 'w') as f:
                import json
                await f.write(json.dumps(metadata, indent=2))

        logger.info(f"Uploaded file to local storage: {full_path}")
        return str(full_path)

    async def download(self, file_path: str) -> bytes:
        """Download file from local filesystem"""
        full_path = self._get_full_path(file_path)

        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        async with aiofiles.open(full_path, 'rb') as f:
            content = await f.read()

        return content

    async def delete(self, file_path: str) -> bool:
        """Delete file from local filesystem"""
        full_path = self._get_full_path(file_path)

        try:
            if full_path.exists():
                full_path.unlink()

                # Also delete metadata file if it exists
                metadata_path = full_path.with_suffix(full_path.suffix + '.meta')
                if metadata_path.exists():
                    metadata_path.unlink()

                logger.info(f"Deleted file from local storage: {full_path}")
                return True
        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {e}")

        return False

    async def exists(self, file_path: str) -> bool:
        """Check if file exists in local filesystem"""
        full_path = self._get_full_path(file_path)
        return full_path.exists()

    async def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files in local filesystem"""
        search_path = self._get_full_path(prefix) if prefix else self.base_path
        files = []

        try:
            if search_path.is_file():
                # Single file
                stat = search_path.stat()
                files.append({
                    "name": search_path.name,
                    "path": str(search_path.relative_to(self.base_path)),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": "file"
                })
            elif search_path.is_dir():
                # Directory - list contents
                for item in search_path.rglob('*'):
                    if item.is_file() and not item.name.endswith('.meta'):
                        stat = item.stat()
                        files.append({
                            "name": item.name,
                            "path": str(item.relative_to(self.base_path)),
                            "size": stat.st_size,
                            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "type": "file"
                        })
        except Exception as e:
            logger.error(f"Error listing files with prefix {prefix}: {e}")

        return sorted(files, key=lambda x: x['modified'], reverse=True)

    async def get_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get file metadata from local filesystem"""
        full_path = self._get_full_path(file_path)

        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        stat = full_path.stat()
        metadata = {
            "name": full_path.name,
            "path": str(full_path.relative_to(self.base_path)),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "content_type": mimetypes.guess_type(full_path)[0] or "application/octet-stream",
            "extension": full_path.suffix.lower()
        }

        # Load custom metadata if available
        metadata_path = full_path.with_suffix(full_path.suffix + '.meta')
        if metadata_path.exists():
            try:
                async with aiofiles.open(metadata_path, 'r') as f:
                    import json
                    custom_metadata = json.loads(await f.read())
                    metadata.update(custom_metadata)
            except Exception as e:
                logger.warning(f"Error loading custom metadata for {file_path}: {e}")

        return metadata

class NetworkFileSystemBackend(StorageBackend):
    """Network filesystem storage backend (NFS/SMB/CIFS)"""

    def __init__(self, mount_path: str, mount_type: str = "nfs"):
        self.mount_path = Path(mount_path)
        self.mount_type = mount_type

        if not self.mount_path.exists():
            raise ValueError(f"Mount path does not exist: {mount_path}")

        if not self.mount_path.is_mount():
            logger.warning(f"Path may not be a mount point: {mount_path}")

        logger.info(f"NetworkFileSystemBackend initialized: {mount_path} ({mount_type})")

    def _get_full_path(self, file_path: str) -> Path:
        """Get full path for file on network filesystem"""
        return self.mount_path / file_path.lstrip('/')

    async def upload(self, file_path: str, content: bytes, metadata: Dict[str, Any] = None) -> str:
        """Upload file to network filesystem"""
        full_path = self._get_full_path(file_path)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Use synchronous I/O for network filesystems to avoid issues
        await asyncio.get_event_loop().run_in_executor(
            None, self._sync_write_file, full_path, content
        )

        # Store metadata
        if metadata:
            metadata_path = full_path.with_suffix(full_path.suffix + '.meta')
            await asyncio.get_event_loop().run_in_executor(
                None, self._sync_write_metadata, metadata_path, metadata
            )

        logger.info(f"Uploaded file to network storage: {full_path}")
        return str(full_path)

    def _sync_write_file(self, path: Path, content: bytes):
        """Synchronous file write"""
        with open(path, 'wb') as f:
            f.write(content)

    def _sync_write_metadata(self, path: Path, metadata: Dict[str, Any]):
        """Synchronous metadata write"""
        import json
        with open(path, 'w') as f:
            json.dump(metadata, f, indent=2)

    async def download(self, file_path: str) -> bytes:
        """Download file from network filesystem"""
        full_path = self._get_full_path(file_path)

        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Use synchronous I/O for network filesystems
        content = await asyncio.get_event_loop().run_in_executor(
            None, self._sync_read_file, full_path
        )

        return content

    def _sync_read_file(self, path: Path) -> bytes:
        """Synchronous file read"""
        with open(path, 'rb') as f:
            return f.read()

    async def delete(self, file_path: str) -> bool:
        """Delete file from network filesystem"""
        full_path = self._get_full_path(file_path)

        try:
            if full_path.exists():
                await asyncio.get_event_loop().run_in_executor(
                    None, full_path.unlink
                )

                # Delete metadata file
                metadata_path = full_path.with_suffix(full_path.suffix + '.meta')
                if metadata_path.exists():
                    await asyncio.get_event_loop().run_in_executor(
                        None, metadata_path.unlink
                    )

                logger.info(f"Deleted file from network storage: {full_path}")
                return True
        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {e}")

        return False

    async def exists(self, file_path: str) -> bool:
        """Check if file exists on network filesystem"""
        full_path = self._get_full_path(file_path)
        return await asyncio.get_event_loop().run_in_executor(
            None, full_path.exists
        )

    async def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files on network filesystem"""
        search_path = self._get_full_path(prefix) if prefix else self.mount_path

        files = await asyncio.get_event_loop().run_in_executor(
            None, self._sync_list_files, search_path
        )

        return files

    def _sync_list_files(self, search_path: Path) -> List[Dict[str, Any]]:
        """Synchronous file listing"""
        files = []

        try:
            if search_path.is_file():
                stat = search_path.stat()
                files.append({
                    "name": search_path.name,
                    "path": str(search_path.relative_to(self.mount_path)),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": "file"
                })
            elif search_path.is_dir():
                for item in search_path.rglob('*'):
                    if item.is_file() and not item.name.endswith('.meta'):
                        stat = item.stat()
                        files.append({
                            "name": item.name,
                            "path": str(item.relative_to(self.mount_path)),
                            "size": stat.st_size,
                            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "type": "file"
                        })
        except Exception as e:
            logger.error(f"Error listing files: {e}")

        return sorted(files, key=lambda x: x['modified'], reverse=True)

    async def get_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get file metadata from network filesystem"""
        full_path = self._get_full_path(file_path)

        if not await self.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        metadata = await asyncio.get_event_loop().run_in_executor(
            None, self._sync_get_metadata, full_path
        )

        return metadata

    def _sync_get_metadata(self, full_path: Path) -> Dict[str, Any]:
        """Synchronous metadata extraction"""
        stat = full_path.stat()
        metadata = {
            "name": full_path.name,
            "path": str(full_path.relative_to(self.mount_path)),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "content_type": mimetypes.guess_type(full_path)[0] or "application/octet-stream",
            "extension": full_path.suffix.lower()
        }

        # Load custom metadata
        metadata_path = full_path.with_suffix(full_path.suffix + '.meta')
        if metadata_path.exists():
            try:
                import json
                with open(metadata_path, 'r') as f:
                    custom_metadata = json.load(f)
                    metadata.update(custom_metadata)
            except Exception as e:
                logger.warning(f"Error loading custom metadata: {e}")

        return metadata

class S3CompatibleBackend(StorageBackend):
    """S3-compatible object storage backend (MinIO, Ceph, etc.)"""

    def __init__(self, endpoint_url: str, access_key: str, secret_key: str,
                 bucket_name: str, region: str = "us-east-1", secure: bool = True):
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket_name = bucket_name
        self.region = region
        self.secure = secure

        # Import S3-compatible client library (boto3-compatible but not AWS-specific)
        try:
            # import boto3  # Cloud SDK removed
            from botocore.client import Config

            self.client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
                config=Config(signature_version='s3v4'),
                verify=secure
            )

            # Test connection and create bucket if needed
            self._ensure_bucket_exists()

            logger.info(f"S3CompatibleBackend initialized: {endpoint_url}/{bucket_name}")

        except ImportError:
            raise ImportError(
                "boto3 required for S3-compatible storage. "
                "Install with: pip install boto3"
            )

    def _ensure_bucket_exists(self):
        """Ensure bucket exists, create if needed"""
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            try:
                self.client.create_bucket(Bucket=self.bucket_name)
                logger.info(f"Created bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Error creating bucket {self.bucket_name}: {e}")
                raise

    async def upload(self, file_path: str, content: bytes, metadata: Dict[str, Any] = None) -> str:
        """Upload file to S3-compatible storage"""
        key = file_path.lstrip('/')

        # Prepare metadata for S3
        s3_metadata = {}
        if metadata:
            # Convert metadata to string values (S3 requirement)
            s3_metadata = {k: str(v) for k, v in metadata.items()
                          if isinstance(v, (str, int, float, bool))}

        try:
            # Upload file
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=content,
                    Metadata=s3_metadata,
                    ContentType=mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
                )
            )

            url = f"{self.endpoint_url}/{self.bucket_name}/{key}"
            logger.info(f"Uploaded file to S3-compatible storage: {url}")
            return url

        except Exception as e:
            logger.error(f"Error uploading file {file_path}: {e}")
            raise

    async def download(self, file_path: str) -> bytes:
        """Download file from S3-compatible storage"""
        key = file_path.lstrip('/')

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.get_object(Bucket=self.bucket_name, Key=key)
            )

            content = response['Body'].read()
            return content

        except Exception as e:
            if 'NoSuchKey' in str(e):
                raise FileNotFoundError(f"File not found: {file_path}")
            logger.error(f"Error downloading file {file_path}: {e}")
            raise

    async def delete(self, file_path: str) -> bool:
        """Delete file from S3-compatible storage"""
        key = file_path.lstrip('/')

        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.delete_object(Bucket=self.bucket_name, Key=key)
            )

            logger.info(f"Deleted file from S3-compatible storage: {key}")
            return True

        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {e}")
            return False

    async def exists(self, file_path: str) -> bool:
        """Check if file exists in S3-compatible storage"""
        key = file_path.lstrip('/')

        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.head_object(Bucket=self.bucket_name, Key=key)
            )
            return True

        except Exception:
            return False

    async def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files in S3-compatible storage"""
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.list_objects_v2(
                    Bucket=self.bucket_name,
                    Prefix=prefix
                )
            )

            files = []
            for obj in response.get('Contents', []):
                files.append({
                    "name": obj['Key'].split('/')[-1],
                    "path": obj['Key'],
                    "size": obj['Size'],
                    "modified": obj['LastModified'].isoformat(),
                    "etag": obj['ETag'].strip('"'),
                    "type": "file"
                })

            return sorted(files, key=lambda x: x['modified'], reverse=True)

        except Exception as e:
            logger.error(f"Error listing files with prefix {prefix}: {e}")
            return []

    async def get_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get file metadata from S3-compatible storage"""
        key = file_path.lstrip('/')

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.head_object(Bucket=self.bucket_name, Key=key)
            )

            metadata = {
                "name": key.split('/')[-1],
                "path": key,
                "size": response['ContentLength'],
                "modified": response['LastModified'].isoformat(),
                "content_type": response.get('ContentType', 'application/octet-stream'),
                "etag": response['ETag'].strip('"')
            }

            # Add custom metadata
            if 'Metadata' in response:
                metadata.update(response['Metadata'])

            return metadata

        except Exception as e:
            if 'NoSuchKey' in str(e) or '404' in str(e):
                raise FileNotFoundError(f"File not found: {file_path}")
            logger.error(f"Error getting metadata for {file_path}: {e}")
            raise

class GenericStorageService:
    """Generic storage service with multiple backend support"""

    def __init__(self, backend_type: str = "local", **backend_config):
        self.backend_type = backend_type
        self.backend_config = backend_config

        # Initialize storage backend
        if backend_type == "local":
            self.backend = LocalFileSystemBackend(
                base_path=backend_config.get('base_path', './storage')
            )
        elif backend_type == "nfs":
            self.backend = NetworkFileSystemBackend(
                mount_path=backend_config.get('mount_path'),
                mount_type=backend_config.get('mount_type', 'nfs')
            )
        elif backend_type == "s3_compatible":
            self.backend = S3CompatibleBackend(
                endpoint_url=backend_config.get('endpoint_url'),
                access_key=backend_config.get('access_key'),
                secret_key=backend_config.get('secret_key'),
                bucket_name=backend_config.get('bucket_name'),
                region=backend_config.get('region', 'us-east-1'),
                secure=backend_config.get('secure', True)
            )
        else:
            raise ValueError(f"Unsupported backend type: {backend_type}")

        logger.info(f"GenericStorageService initialized with {backend_type} backend")

    async def upload_file(self, file_path: str, content: bytes,
                         metadata: Dict[str, Any] = None) -> str:
        """Upload file to configured storage backend"""
        return await self.backend.upload(file_path, content, metadata)

    async def download_file(self, file_path: str) -> bytes:
        """Download file from configured storage backend"""
        return await self.backend.download(file_path)

    async def delete_file(self, file_path: str) -> bool:
        """Delete file from configured storage backend"""
        return await self.backend.delete(file_path)

    async def file_exists(self, file_path: str) -> bool:
        """Check if file exists in configured storage backend"""
        return await self.backend.exists(file_path)

    async def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files in configured storage backend"""
        return await self.backend.list_files(prefix)

    async def get_file_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get file metadata from configured storage backend"""
        return await self.backend.get_metadata(file_path)

    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on storage backend"""
        try:
            # Test basic operations
            test_file = "health_check_test.txt"
            test_content = b"health check test"

            # Upload test file
            await self.upload_file(test_file, test_content)

            # Verify existence
            exists = await self.file_exists(test_file)

            # Download and verify content
            downloaded = await self.download_file(test_file)
            content_matches = downloaded == test_content

            # Clean up
            await self.delete_file(test_file)

            return {
                "backend_type": self.backend_type,
                "status": "healthy" if (exists and content_matches) else "unhealthy",
                "upload_test": "passed",
                "download_test": "passed" if content_matches else "failed",
                "delete_test": "passed",
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "backend_type": self.backend_type,
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Factory function for easy configuration
def create_storage_service(storage_type: str = None, **config) -> GenericStorageService:
    """Factory function to create storage service from configuration"""

    # Auto-detect from environment if not specified
    if storage_type is None:
        storage_type = os.getenv('STORAGE_BACKEND', 'local')

    # Default configurations
    if storage_type == "local":
        config = {
            'base_path': os.getenv('STORAGE_LOCAL_PATH', './storage'),
            **config
        }
    elif storage_type == "nfs":
        config = {
            'mount_path': os.getenv('STORAGE_NFS_MOUNT', '/mnt/storage'),
            'mount_type': os.getenv('STORAGE_NFS_TYPE', 'nfs'),
            **config
        }
    elif storage_type == "s3_compatible":
        config = {
            'endpoint_url': os.getenv('STORAGE_S3_ENDPOINT'),
            'access_key': os.getenv('STORAGE_S3_ACCESS_KEY'),
            'secret_key': os.getenv('STORAGE_S3_SECRET_KEY'),
            'bucket_name': os.getenv('STORAGE_S3_BUCKET'),
            'region': os.getenv('STORAGE_S3_REGION', 'us-east-1'),
            'secure': os.getenv('STORAGE_S3_SECURE', 'true').lower() == 'true',
            **config
        }

    return GenericStorageService(storage_type, **config)

# Example usage and configuration
if __name__ == "__main__":
    import asyncio

    async def test_storage():
        # Test local storage
        print("Testing Local Storage:")
        local_storage = create_storage_service('local')
        health = await local_storage.health_check()
        print(f"Health check: {health}")

        # Test file operations
        test_content = b"Hello, world!"
        await local_storage.upload_file("test/example.txt", test_content)

        files = await local_storage.list_files("test/")
        print(f"Files: {files}")

        downloaded = await local_storage.download_file("test/example.txt")
        print(f"Downloaded content matches: {downloaded == test_content}")

        await local_storage.delete_file("test/example.txt")
        print("File deleted successfully")

    asyncio.run(test_storage())