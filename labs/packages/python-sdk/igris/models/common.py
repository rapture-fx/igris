"""
Common data models for Igris-engine SDK
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union, Generic, TypeVar
from datetime import datetime
from enum import Enum
import json

T = TypeVar('T')


@dataclass
class APIResponse(Generic[T]):
    """Generic API response wrapper."""
    
    success: bool
    data: Optional[T] = None
    message: Optional[str] = None
    error_code: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    pagination: Optional['PaginationInfo'] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
    
    @classmethod
    def success_response(cls, data: T, message: Optional[str] = None, **kwargs) -> 'APIResponse[T]':
        """Create a successful response."""
        return cls(success=True, data=data, message=message, **kwargs)
    
    @classmethod
    def error_response(cls, message: str, error_code: Optional[str] = None, **kwargs) -> 'APIResponse[None]':
        """Create an error response."""
        return cls(success=False, message=message, error_code=error_code, **kwargs)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert response to dictionary."""
        result = {
            "success": self.success,
            "message": self.message,
            "error_code": self.error_code,
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
        
        if self.data is not None:
            result["data"] = self.data
            
        if self.pagination is not None:
            result["pagination"] = self.pagination.to_dict()
            
        return {k: v for k, v in result.items() if v is not None}


@dataclass
class PaginationInfo:
    """Pagination information for paginated responses."""
    
    page: int = 1
    page_size: int = 20
    total_items: int = 0
    total_pages: int = 0
    has_next: bool = False
    has_previous: bool = False
    
    def __post_init__(self):
        if self.total_items > 0 and self.page_size > 0:
            self.total_pages = max(1, (self.total_items + self.page_size - 1) // self.page_size)
            self.has_next = self.page < self.total_pages
            self.has_previous = self.page > 1
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert pagination info to dictionary."""
        return {
            "page": self.page,
            "page_size": self.page_size,
            "total_items": self.total_items,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_previous": self.has_previous
        }


class JobStatus(str, Enum):
    """Job status enumeration."""
    
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class FileType(str, Enum):
    """Supported file types."""
    
    CSV = "csv"
    JSON = "json"
    XLSX = "xlsx"
    PARQUET = "parquet"
    TXT = "txt"
    PDF = "pdf"
    IMAGE = "image"
    UNKNOWN = "unknown"


@dataclass
class FileUpload:
    """File upload information."""
    
    filename: str
    file_type: FileType
    size_bytes: int
    content_type: Optional[str] = None
    upload_id: Optional[str] = None
    url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
            
        # Auto-detect file type if not provided
        if self.file_type == FileType.UNKNOWN and self.filename:
            extension = self.filename.lower().split('.')[-1] if '.' in self.filename else ''
            type_mapping = {
                'csv': FileType.CSV,
                'json': FileType.JSON,
                'xlsx': FileType.XLSX,
                'xls': FileType.XLSX,
                'parquet': FileType.PARQUET,
                'txt': FileType.TXT,
                'pdf': FileType.PDF,
                'jpg': FileType.IMAGE,
                'jpeg': FileType.IMAGE,
                'png': FileType.IMAGE,
                'gif': FileType.IMAGE
            }
            self.file_type = type_mapping.get(extension, FileType.UNKNOWN)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert file upload info to dictionary."""
        return {
            "filename": self.filename,
            "file_type": self.file_type.value,
            "size_bytes": self.size_bytes,
            "content_type": self.content_type,
            "upload_id": self.upload_id,
            "url": self.url,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


@dataclass
class JobInfo:
    """General job information."""
    
    job_id: str
    status: JobStatus
    job_type: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percentage: float = 0.0
    message: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert job info to dictionary."""
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "job_type": self.job_type,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress_percentage": self.progress_percentage,
            "message": self.message,
            "error_message": self.error_message,
            "metadata": self.metadata
        }
    
    @property
    def is_completed(self) -> bool:
        """Check if job is completed (success or failure)."""
        return self.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
    
    @property
    def is_running(self) -> bool:
        """Check if job is currently running."""
        return self.status in (JobStatus.PENDING, JobStatus.RUNNING)


def from_dict(data_class: type, data: Dict[str, Any]) -> Any:
    """
    Create dataclass instance from dictionary.
    
    Args:
        data_class: The dataclass type to create
        data: Dictionary data
        
    Returns:
        Instance of the dataclass
    """
    if not data:
        return None
        
    # Handle datetime fields
    datetime_fields = {
        'created_at', 'updated_at', 'completed_at', 'timestamp'
    }
    
    for field_name in datetime_fields:
        if field_name in data and data[field_name]:
            if isinstance(data[field_name], str):
                try:
                    data[field_name] = datetime.fromisoformat(data[field_name].replace('Z', '+00:00'))
                except ValueError:
                    # If parsing fails, keep as string
                    pass
    
    # Handle enum fields
    if 'status' in data and isinstance(data['status'], str):
        try:
            data['status'] = JobStatus(data['status'])
        except ValueError:
            pass
            
    if 'file_type' in data and isinstance(data['file_type'], str):
        try:
            data['file_type'] = FileType(data['file_type'])
        except ValueError:
            data['file_type'] = FileType.UNKNOWN
    
    # Filter out fields that don't exist in the dataclass
    import inspect
    signature = inspect.signature(data_class)
    valid_fields = set(signature.parameters.keys())
    filtered_data = {k: v for k, v in data.items() if k in valid_fields}
    
    return data_class(**filtered_data)