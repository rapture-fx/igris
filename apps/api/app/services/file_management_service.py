"""
File Management Service for Schlep-engine

This service provides comprehensive file management capabilities including:
- File upload and validation
- Cloud storage integration
- File cleanup and retention policies
- File size limits enforcement
- CDN integration
"""

import os
import logging
import shutil
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, BinaryIO, Union
from pathlib import Path
import tempfile

from app.core.cloud_storage import CloudStorageManager, CloudStorageError, FileSizeLimitError
from app.core.unified_config import settings
from app.database.connection import get_sync_db

logger = logging.getLogger(__name__)


class FileManagementService:
    """Service for managing files with cloud storage integration"""
    
    def __init__(self, db_session=None):
        self.db = db_session
        self.cloud_storage = CloudStorageManager()
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.max_file_size = settings.MAX_FILE_SIZE_BYTES
        
        # Ensure upload directory exists
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def upload_file(
        self, 
        file_data: BinaryIO, 
        file_name: str,
        user_id: int = None,
        metadata: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Upload file with validation and cloud storage integration.
        
        Args:
            file_data: File data as binary stream
            file_name: Name of the file
            user_id: ID of the user uploading the file
            metadata: Additional metadata for the file
        
        Returns:
            Upload result with file information
        """
        try:
            # Validate file name
            if not self._is_valid_filename(file_name):
                raise ValueError(f"Invalid filename: {file_name}")
            
            # Create temporary file for validation
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file_name).suffix) as temp_file:
                # Copy file data to temporary file
                shutil.copyfileobj(file_data, temp_file)
                temp_file_path = temp_file.name
            
            try:
                # Validate file
                validation = self.cloud_storage.validate_file(temp_file_path)
                if not validation['is_valid']:
                    raise ValueError(f"File validation failed: {validation['error']}")
                
                # Check file size
                file_size = validation['file_size']
                if file_size > self.max_file_size:
                    raise FileSizeLimitError(
                        f"File size {file_size} bytes exceeds limit of {self.max_file_size} bytes"
                    )
                
                # Generate cloud storage path
                timestamp = datetime.utcnow().strftime("%Y/%m/%d")
                cloud_path = f"uploads/{timestamp}/{file_name}"
                
                # Add metadata
                if metadata is None:
                    metadata = {}
                
                metadata.update({
                    'uploaded_by': str(user_id) if user_id else 'anonymous',
                    'upload_time': datetime.utcnow().isoformat(),
                    'file_hash': validation['file_hash'],
                    'original_filename': file_name
                })
                
                # Upload to cloud storage
                upload_result = self.cloud_storage.upload_file(
                    temp_file_path,
                    destination_path=cloud_path,
                    metadata=metadata
                )
                
                if not upload_result['success']:
                    raise CloudStorageError(f"Cloud storage upload failed: {upload_result['error']}")
                
                # Save file record to database
                file_record = self._save_file_record(
                    file_name=file_name,
                    cloud_path=cloud_path,
                    file_size=file_size,
                    mime_type=validation['mime_type'],
                    file_hash=validation['file_hash'],
                    user_id=user_id,
                    metadata=metadata
                )
                
                logger.info(f"File uploaded successfully: {file_name} -> {cloud_path}")
                
                return {
                    'success': True,
                    'file_id': file_record['id'],
                    'file_name': file_name,
                    'cloud_path': cloud_path,
                    'public_url': upload_result['public_url'],
                    'file_size': file_size,
                    'mime_type': validation['mime_type'],
                    'upload_time': upload_result['upload_time']
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"File upload failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def download_file(self, file_id: int, user_id: int = None) -> Dict[str, Any]:
        """
        Download file from cloud storage.
        
        Args:
            file_id: ID of the file to download
            user_id: ID of the user requesting the download
        
        Returns:
            Download result with file information
        """
        try:
            # Get file record from database
            file_record = self._get_file_record(file_id)
            if not file_record:
                raise ValueError(f"File not found: {file_id}")
            
            # Check access permissions
            if user_id and file_record['user_id'] != user_id:
                raise PermissionError("Access denied to this file")
            
            # Download from cloud storage
            download_result = self.cloud_storage.download_file(file_record['cloud_path'])
            
            if not download_result['success']:
                raise CloudStorageError(f"Cloud storage download failed: {download_result['error']}")
            
            logger.info(f"File downloaded successfully: {file_record['file_name']}")
            
            return {
                'success': True,
                'file_path': download_result['local_path'],
                'file_name': file_record['file_name'],
                'file_size': download_result['file_size'],
                'mime_type': download_result['mime_type']
            }
            
        except Exception as e:
            logger.error(f"File download failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_file(self, file_id: int, user_id: int = None) -> Dict[str, Any]:
        """
        Delete file from cloud storage and database.
        
        Args:
            file_id: ID of the file to delete
            user_id: ID of the user requesting the deletion
        
        Returns:
            Delete result
        """
        try:
            # Get file record from database
            file_record = self._get_file_record(file_id)
            if not file_record:
                return {
                    'success': True,
                    'message': f"File already deleted: {file_id}"
                }
            
            # Check access permissions
            if user_id and file_record['user_id'] != user_id:
                raise PermissionError("Access denied to this file")
            
            # Delete from cloud storage
            delete_result = self.cloud_storage.delete_file(file_record['cloud_path'])
            
            if not delete_result['success']:
                raise CloudStorageError(f"Cloud storage deletion failed: {delete_result['error']}")
            
            # Delete from database
            self._delete_file_record(file_id)
            
            logger.info(f"File deleted successfully: {file_record['file_name']}")
            
            return {
                'success': True,
                'message': f"File deleted: {file_record['file_name']}"
            }
            
        except Exception as e:
            logger.error(f"File deletion failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_file_info(self, file_id: int, user_id: int = None) -> Dict[str, Any]:
        """
        Get file information.
        
        Args:
            file_id: ID of the file
            user_id: ID of the user requesting the information
        
        Returns:
            File information
        """
        try:
            # Get file record from database
            file_record = self._get_file_record(file_id)
            if not file_record:
                raise ValueError(f"File not found: {file_id}")
            
            # Check access permissions
            if user_id and file_record['user_id'] != user_id:
                raise PermissionError("Access denied to this file")
            
            # Generate public URL
            public_url = self.cloud_storage.get_public_url(file_record['cloud_path'])
            
            return {
                'success': True,
                'file_id': file_record['id'],
                'file_name': file_record['file_name'],
                'file_size': file_record['file_size'],
                'mime_type': file_record['mime_type'],
                'public_url': public_url,
                'upload_time': file_record['upload_time'],
                'metadata': file_record.get('metadata', {})
            }
            
        except Exception as e:
            logger.error(f"Failed to get file info: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def list_user_files(self, user_id: int, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """
        List files uploaded by a user.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of files to return
            offset: Number of files to skip
        
        Returns:
            List of files
        """
        try:
            # Get file records from database
            file_records = self._get_user_files(user_id, limit, offset)
            
            files = []
            for record in file_records:
                public_url = self.cloud_storage.get_public_url(record['cloud_path'])
                files.append({
                    'file_id': record['id'],
                    'file_name': record['file_name'],
                    'file_size': record['file_size'],
                    'mime_type': record['mime_type'],
                    'public_url': public_url,
                    'upload_time': record['upload_time']
                })
            
            return {
                'success': True,
                'files': files,
                'total': len(files)
            }
            
        except Exception as e:
            logger.error(f"Failed to list user files: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def cleanup_old_files(self, days_old: int = None) -> Dict[str, Any]:
        """
        Clean up old files based on retention policy.
        
        Args:
            days_old: Number of days old (uses default retention if None)
        
        Returns:
            Cleanup result
        """
        try:
            if days_old is None:
                days_old = settings.FILE_RETENTION_DAYS
            
            # Get old file records from database
            old_files = self._get_old_files(days_old)
            
            deleted_count = 0
            failed_count = 0
            
            for file_record in old_files:
                try:
                    # Delete from cloud storage
                    delete_result = self.cloud_storage.delete_file(file_record['cloud_path'])
                    
                    if delete_result['success']:
                        # Delete from database
                        self._delete_file_record(file_record['id'])
                        deleted_count += 1
                        logger.info(f"Deleted old file: {file_record['file_name']}")
                    else:
                        failed_count += 1
                        logger.error(f"Failed to delete old file {file_record['file_name']}: {delete_result['error']}")
                        
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Failed to delete old file {file_record['file_name']}: {e}")
            
            return {
                'success': True,
                'deleted_count': deleted_count,
                'failed_count': failed_count,
                'cutoff_date': (datetime.utcnow() - timedelta(days=days_old)).isoformat()
            }
            
        except Exception as e:
            logger.error(f"File cleanup failed: {e}")
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
            # Get cloud storage stats
            cloud_stats = self.cloud_storage.get_storage_stats()
            
            # Get database stats
            db_stats = self._get_database_stats()
            
            return {
                'success': True,
                'cloud_storage': cloud_stats,
                'database': db_stats
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _is_valid_filename(self, filename: str) -> bool:
        """Check if filename is valid"""
        if not filename or len(filename) > 255:
            return False
        
        # Check for invalid characters
        invalid_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
        return not any(char in filename for char in invalid_chars)
    
    def _save_file_record(
        self, 
        file_name: str, 
        cloud_path: str, 
        file_size: int, 
        mime_type: str, 
        file_hash: str,
        user_id: int = None,
        metadata: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Save file record to database"""
        # This would integrate with your database models
        # For now, return a mock record
        return {
            'id': 1,  # Mock ID
            'file_name': file_name,
            'cloud_path': cloud_path,
            'file_size': file_size,
            'mime_type': mime_type,
            'file_hash': file_hash,
            'user_id': user_id,
            'metadata': metadata or {},
            'upload_time': datetime.utcnow().isoformat()
        }
    
    def _get_file_record(self, file_id: int) -> Optional[Dict[str, Any]]:
        """Get file record from database"""
        # This would integrate with your database models
        # For now, return a mock record
        return {
            'id': file_id,
            'file_name': 'example.csv',
            'cloud_path': 'uploads/2024/01/01/example.csv',
            'file_size': 1024,
            'mime_type': 'text/csv',
            'user_id': 1,
            'upload_time': datetime.utcnow().isoformat()
        }
    
    def _delete_file_record(self, file_id: int) -> bool:
        """Delete file record from database"""
        # This would integrate with your database models
        return True
    
    def _get_user_files(self, user_id: int, limit: int, offset: int) -> List[Dict[str, Any]]:
        """Get files uploaded by user from database"""
        # This would integrate with your database models
        return []
    
    def _get_old_files(self, days_old: int) -> List[Dict[str, Any]]:
        """Get old files from database"""
        # This would integrate with your database models
        return []
    
    def _get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        # This would integrate with your database models
        return {
            'total_files': 0,
            'total_size_bytes': 0
        } 