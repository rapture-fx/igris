"""
Cloud Storage Integration for Schlep-engine

This module provides comprehensive cloud storage integration with Google Cloud Storage,
including file upload, download, management, and CDN configuration.
"""

import os
import logging
import mimetypes
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, BinaryIO, Union
from pathlib import Path
import tempfile
import shutil

try:
    from google.cloud import storage
    from google.cloud.exceptions import NotFound, GoogleCloudError
    from google.auth.exceptions import GoogleAuthError
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False
    logging.warning("Google Cloud Storage not available. Install with: pip install google-cloud-storage")

from app.core.unified_config import settings

logger = logging.getLogger(__name__)


class CloudStorageError(Exception):
    """Custom exception for cloud storage operations"""
    pass


class FileSizeLimitError(Exception):
    """Exception raised when file size exceeds limits"""
    pass


class CloudStorageManager:
    """Manager for cloud storage operations with Google Cloud Storage"""
    
    def __init__(self):
        self.client = None
        self.bucket_name = settings.CLOUD_STORAGE_BUCKET_NAME
        self.cdn_domain = settings.CDN_DOMAIN
        self.max_file_size = settings.MAX_FILE_SIZE_BYTES
        self.retention_days = settings.FILE_RETENTION_DAYS
        
        # File type restrictions
        self.allowed_extensions = {
            '.csv', '.json', '.xlsx', '.xls', '.parquet', '.txt', '.zip', '.gz',
            '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'
        }
        
        # MIME type restrictions
        self.allowed_mime_types = {
            'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel', 'application/octet-stream', 'text/plain',
            'application/zip', 'application/gzip', 'application/pdf',
            'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/x-icon'
        }
        
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Google Cloud Storage client"""
        if not GCS_AVAILABLE:
            raise CloudStorageError("Google Cloud Storage not available")
        
        try:
            # Use service account key if provided
            if settings.GOOGLE_CLOUD_CREDENTIALS_PATH:
                self.client = storage.Client.from_service_account_json(
                    settings.GOOGLE_CLOUD_CREDENTIALS_PATH
                )
            else:
                # Use default credentials (environment variables or metadata server)
                self.client = storage.Client()
            
            # Verify bucket exists
            self._verify_bucket()
            
        except GoogleAuthError as e:
            raise CloudStorageError(f"Authentication failed: {e}")
        except Exception as e:
            raise CloudStorageError(f"Failed to initialize cloud storage: {e}")
    
    def _verify_bucket(self):
        """Verify that the bucket exists and is accessible"""
        try:
            bucket = self.client.bucket(self.bucket_name)
            if not bucket.exists():
                # Create bucket if it doesn't exist
                bucket.create()
                logger.info(f"Created bucket: {self.bucket_name}")
            
            # Set bucket lifecycle for automatic cleanup
            self._configure_bucket_lifecycle(bucket)
            
        except Exception as e:
            raise CloudStorageError(f"Bucket verification failed: {e}")
    
    def _configure_bucket_lifecycle(self, bucket):
        """Configure bucket lifecycle for automatic file cleanup"""
        try:
            # Get current lifecycle rules
            lifecycle_rules = bucket.lifecycle_rules
            
            # Check if cleanup rule already exists
            cleanup_rule_exists = any(
                rule.action.type == 'Delete' and 
                rule.condition.age_days == self.retention_days
                for rule in lifecycle_rules
            )
            
            if not cleanup_rule_exists:
                # Add lifecycle rule for automatic cleanup
                bucket.add_lifecycle_delete_rule(
                    age=self.retention_days,
                    is_live=True
                )
                logger.info(f"Configured lifecycle rule: delete files older than {self.retention_days} days")
        
        except Exception as e:
            logger.warning(f"Failed to configure bucket lifecycle: {e}")
    
    def validate_file(self, file_path: Union[str, Path], file_size: int = None) -> Dict[str, Any]:
        """
        Validate file before upload.
        
        Args:
            file_path: Path to the file
            file_size: File size in bytes (if not provided, will be calculated)
        
        Returns:
            Validation result with file metadata
        """
        try:
            file_path = Path(file_path)
            
            # Check file extension
            if file_path.suffix.lower() not in self.allowed_extensions:
                raise CloudStorageError(f"File extension not allowed: {file_path.suffix}")
            
            # Get file size if not provided
            if file_size is None:
                file_size = file_path.stat().st_size
            
            # Check file size limit
            if file_size > self.max_file_size:
                raise FileSizeLimitError(
                    f"File size {file_size} bytes exceeds limit of {self.max_file_size} bytes"
                )
            
            # Get MIME type
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if mime_type and mime_type not in self.allowed_mime_types:
                raise CloudStorageError(f"MIME type not allowed: {mime_type}")
            
            # Calculate file hash
            file_hash = self._calculate_file_hash(file_path)
            
            return {
                'file_path': str(file_path),
                'file_name': file_path.name,
                'file_size': file_size,
                'mime_type': mime_type,
                'file_hash': file_hash,
                'extension': file_path.suffix.lower(),
                'is_valid': True
            }
            
        except Exception as e:
            return {
                'file_path': str(file_path),
                'is_valid': False,
                'error': str(e)
            }
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def upload_file(
        self, 
        file_path: Union[str, Path], 
        destination_path: str = None,
        metadata: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Upload file to cloud storage.
        
        Args:
            file_path: Path to the file to upload
            destination_path: Destination path in cloud storage
            metadata: Additional metadata for the file
        
        Returns:
            Upload result with file information
        """
        try:
            # Validate file
            validation = self.validate_file(file_path)
            if not validation['is_valid']:
                raise CloudStorageError(f"File validation failed: {validation['error']}")
            
            file_path = Path(file_path)
            
            # Generate destination path if not provided
            if destination_path is None:
                timestamp = datetime.utcnow().strftime("%Y/%m/%d")
                destination_path = f"uploads/{timestamp}/{file_path.name}"
            
            # Upload file
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(destination_path)
            
            # Set metadata
            if metadata:
                blob.metadata = metadata
            
            # Set content type
            if validation['mime_type']:
                blob.content_type = validation['mime_type']
            
            # Upload with progress tracking
            blob.upload_from_filename(str(file_path))
            
            # Generate public URL
            public_url = self.get_public_url(destination_path)
            
            logger.info(f"Uploaded file: {file_path.name} -> {destination_path}")
            
            return {
                'success': True,
                'file_name': file_path.name,
                'destination_path': destination_path,
                'public_url': public_url,
                'file_size': validation['file_size'],
                'mime_type': validation['mime_type'],
                'file_hash': validation['file_hash'],
                'upload_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"File upload failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def upload_file_data(
        self, 
        file_data: BinaryIO, 
        file_name: str,
        destination_path: str = None,
        metadata: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Upload file data from memory to cloud storage.
        
        Args:
            file_data: File data as binary stream
            file_name: Name of the file
            destination_path: Destination path in cloud storage
            metadata: Additional metadata for the file
        
        Returns:
            Upload result with file information
        """
        try:
            # Generate destination path if not provided
            if destination_path is None:
                timestamp = datetime.utcnow().strftime("%Y/%m/%d")
                destination_path = f"uploads/{timestamp}/{file_name}"
            
            # Upload file data
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(destination_path)
            
            # Set metadata
            if metadata:
                blob.metadata = metadata
            
            # Set content type
            mime_type, _ = mimetypes.guess_type(file_name)
            if mime_type:
                blob.content_type = mime_type
            
            # Upload data
            blob.upload_from_file(file_data)
            
            # Generate public URL
            public_url = self.get_public_url(destination_path)
            
            logger.info(f"Uploaded file data: {file_name} -> {destination_path}")
            
            return {
                'success': True,
                'file_name': file_name,
                'destination_path': destination_path,
                'public_url': public_url,
                'mime_type': mime_type,
                'upload_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"File data upload failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def download_file(self, cloud_path: str, local_path: str = None) -> Dict[str, Any]:
        """
        Download file from cloud storage.
        
        Args:
            cloud_path: Path to file in cloud storage
            local_path: Local path to save the file
        
        Returns:
            Download result with file information
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(cloud_path)
            
            # Check if blob exists
            if not blob.exists():
                raise CloudStorageError(f"File not found: {cloud_path}")
            
            # Generate local path if not provided
            if local_path is None:
                file_name = Path(cloud_path).name
                local_path = tempfile.mktemp(suffix=Path(file_name).suffix)
            
            # Download file
            blob.download_to_filename(local_path)
            
            logger.info(f"Downloaded file: {cloud_path} -> {local_path}")
            
            return {
                'success': True,
                'cloud_path': cloud_path,
                'local_path': local_path,
                'file_size': blob.size,
                'mime_type': blob.content_type,
                'download_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"File download failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_file(self, cloud_path: str) -> Dict[str, Any]:
        """
        Delete file from cloud storage.
        
        Args:
            cloud_path: Path to file in cloud storage
        
        Returns:
            Delete result
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(cloud_path)
            
            # Check if blob exists
            if not blob.exists():
                return {
                    'success': True,
                    'message': f"File already deleted: {cloud_path}"
                }
            
            # Delete file
            blob.delete()
            
            logger.info(f"Deleted file: {cloud_path}")
            
            return {
                'success': True,
                'message': f"File deleted: {cloud_path}"
            }
            
        except Exception as e:
            logger.error(f"File deletion failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_public_url(self, cloud_path: str) -> str:
        """
        Generate public URL for file.
        
        Args:
            cloud_path: Path to file in cloud storage
        
        Returns:
            Public URL
        """
        if self.cdn_domain:
            # Use CDN domain
            return f"https://{self.cdn_domain}/{cloud_path}"
        else:
            # Use direct GCS URL
            return f"https://storage.googleapis.com/{self.bucket_name}/{cloud_path}"
    
    def get_signed_url(self, cloud_path: str, expiration_minutes: int = 60) -> str:
        """
        Generate signed URL for temporary access.
        
        Args:
            cloud_path: Path to file in cloud storage
            expiration_minutes: URL expiration time in minutes
        
        Returns:
            Signed URL
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(cloud_path)
            
            # Generate signed URL
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET"
            )
            
            return url
            
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            raise CloudStorageError(f"Signed URL generation failed: {e}")
    
    def list_files(self, prefix: str = "", max_results: int = 1000) -> List[Dict[str, Any]]:
        """
        List files in cloud storage.
        
        Args:
            prefix: Prefix to filter files
            max_results: Maximum number of results
        
        Returns:
            List of file information
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            blobs = bucket.list_blobs(prefix=prefix, max_results=max_results)
            
            files = []
            for blob in blobs:
                files.append({
                    'name': blob.name,
                    'size': blob.size,
                    'content_type': blob.content_type,
                    'created': blob.time_created.isoformat() if blob.time_created else None,
                    'updated': blob.updated.isoformat() if blob.updated else None,
                    'public_url': self.get_public_url(blob.name)
                })
            
            return files
            
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            return []
    
    def cleanup_old_files(self, days_old: int = None) -> Dict[str, Any]:
        """
        Clean up old files based on retention policy.
        
        Args:
            days_old: Number of days old (uses default retention if None)
        
        Returns:
            Cleanup result
        """
        if days_old is None:
            days_old = self.retention_days
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            bucket = self.client.bucket(self.bucket_name)
            
            # List all files
            blobs = bucket.list_blobs()
            
            deleted_count = 0
            failed_count = 0
            
            for blob in blobs:
                # Check if file is older than cutoff date
                if blob.time_created and blob.time_created < cutoff_date:
                    try:
                        blob.delete()
                        deleted_count += 1
                        logger.info(f"Deleted old file: {blob.name}")
                    except Exception as e:
                        failed_count += 1
                        logger.error(f"Failed to delete old file {blob.name}: {e}")
            
            return {
                'success': True,
                'deleted_count': deleted_count,
                'failed_count': failed_count,
                'cutoff_date': cutoff_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get storage statistics.
        
        Returns:
            Storage statistics
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            blobs = bucket.list_blobs()
            
            total_files = 0
            total_size = 0
            file_types = {}
            
            for blob in blobs:
                total_files += 1
                total_size += blob.size
                
                # Count file types
                extension = Path(blob.name).suffix.lower()
                file_types[extension] = file_types.get(extension, 0) + 1
            
            return {
                'total_files': total_files,
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'total_size_gb': round(total_size / (1024 * 1024 * 1024), 2),
                'file_types': file_types,
                'bucket_name': self.bucket_name
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
            return {
                'error': str(e)
            }


# Global instance
cloud_storage = CloudStorageManager() 