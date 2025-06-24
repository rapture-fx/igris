"""
UNIFIED RESPONSE MODELS - POLLARBASE API
=======================================

This module provides standardized response models for all API endpoints,
ensuring consistent response formats, error handling, and documentation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Generic, TypeVar
from pydantic import BaseModel, Field
from enum import Enum
import uuid

# Generic type for data payload
T = TypeVar('T')

class ResponseStatus(str, Enum):
    """Standard response status codes"""
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    PROCESSING = "processing"

class ErrorType(str, Enum):
    """Standard error types for categorization"""
    VALIDATION_ERROR = "validation_error"
    AUTHENTICATION_ERROR = "authentication_error"
    AUTHORIZATION_ERROR = "authorization_error"
    NOT_FOUND_ERROR = "not_found_error"
    CONFLICT_ERROR = "conflict_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    INTERNAL_ERROR = "internal_error"
    EXTERNAL_SERVICE_ERROR = "external_service_error"
    DATA_PROCESSING_ERROR = "data_processing_error"

class ResponseMetadata(BaseModel):
    """Standard metadata included in all responses"""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    api_version: str = Field(default="1.0.0")
    response_time_ms: Optional[float] = None

class ErrorDetail(BaseModel):
    """Detailed error information"""
    type: ErrorType
    code: str
    message: str
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class UnifiedResponse(BaseModel, Generic[T]):
    """Unified response model for all API endpoints"""
    status: ResponseStatus
    data: Optional[T] = None
    message: str
    errors: Optional[List[ErrorDetail]] = None
    metadata: ResponseMetadata

class SuccessResponse(UnifiedResponse[T]):
    """Success response with data"""
    status: ResponseStatus = ResponseStatus.SUCCESS
    
    def __init__(self, data: T, message: str = "Request completed successfully", **kwargs):
        super().__init__(
            status=ResponseStatus.SUCCESS,
            data=data,
            message=message,
            **kwargs
        )

def create_success_response(data: Any, message: str = "Request completed successfully") -> SuccessResponse:
    """Create a standardized success response"""
    return SuccessResponse(
        data=data,
        message=message,
        metadata=ResponseMetadata()
    )
