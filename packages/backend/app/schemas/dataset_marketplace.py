"""
Dataset Marketplace Pydantic schemas for request/response validation
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, validator
from enum import Enum

# Import enums from models
from app.database.models import (
    DatasetStatus, DatasetFormat, DatasetCategory, 
    AccessLevel, QualityGrade
)

# Base Schemas

class DatasetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Dataset identifier name")
    title: str = Field(..., min_length=1, max_length=500, description="Human-readable title")
    description: Optional[str] = Field(None, max_length=5000, description="Dataset description")
    category: DatasetCategory = Field(..., description="Dataset category")
    format: DatasetFormat = Field(..., description="Dataset format")
    tags: List[str] = Field(default_factory=list, description="Dataset tags")
    access_level: AccessLevel = Field(default=AccessLevel.PRIVATE, description="Access level")

    @validator('tags')
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError('Maximum 20 tags allowed')
        return [tag.strip().lower() for tag in v if tag.strip()]

    @validator('name')
    def validate_name(cls, v):
        # Dataset name should be slug-like
        import re
        if not re.match(r'^[a-z0-9_-]+$', v):
            raise ValueError('Dataset name must contain only lowercase letters, numbers, hyphens, and underscores')
        return v

class DatasetCreate(DatasetBase):
    file_data: Optional[str] = Field(None, description="Base64 encoded file data for small files")
    file_url: Optional[str] = Field(None, description="URL to file for larger datasets")
    
    @validator('file_data', 'file_url', pre=True, always=True)
    def validate_file_source(cls, v, values, field):
        file_data = values.get('file_data') if field.name != 'file_data' else v
        file_url = values.get('file_url') if field.name != 'file_url' else v
        
        if not file_data and not file_url:
            raise ValueError('Either file_data or file_url must be provided')
        if file_data and file_url:
            raise ValueError('Only one of file_data or file_url should be provided')
        return v

class DatasetUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=5000)
    tags: Optional[List[str]] = None
    access_level: Optional[AccessLevel] = None
    status: Optional[DatasetStatus] = None

    @validator('tags')
    def validate_tags(cls, v):
        if v is not None and len(v) > 20:
            raise ValueError('Maximum 20 tags allowed')
        return [tag.strip().lower() for tag in v if tag.strip()] if v else v

class DatasetResponse(DatasetBase):
    id: uuid.UUID
    version: str
    status: DatasetStatus
    size_bytes: Optional[int] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    schema_info: Dict[str, Any] = Field(default_factory=dict)
    sample_data: Dict[str, Any] = Field(default_factory=dict)
    
    # Quality metrics
    quality_score: Optional[float] = None
    quality_grade: Optional[QualityGrade] = None
    completeness_score: Optional[float] = None
    consistency_score: Optional[float] = None
    validity_score: Optional[float] = None
    uniqueness_score: Optional[float] = None
    bias_score: Optional[float] = None
    
    # Statistics
    download_count: int = 0
    view_count: int = 0
    rating_average: Optional[float] = None
    rating_count: int = 0
    
    # Metadata
    created_by_id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DatasetListResponse(BaseModel):
    datasets: List[DatasetResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool

# Dataset Version Schemas

class DatasetVersionCreate(BaseModel):
    version: str = Field(..., description="Version string (e.g., 1.1.0)")
    description: Optional[str] = Field(None, max_length=5000)
    file_data: Optional[str] = Field(None, description="Base64 encoded file data")
    file_url: Optional[str] = Field(None, description="URL to file")
    changes_summary: Optional[str] = Field(None, max_length=2000)

class DatasetVersionResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    version: str
    description: Optional[str] = None
    size_bytes: Optional[int] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    schema_info: Dict[str, Any] = Field(default_factory=dict)
    changes_summary: Optional[str] = None
    quality_score: Optional[float] = None
    quality_grade: Optional[QualityGrade] = None
    created_by_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

# Dataset Quality Report Schemas

class DatasetQualityReportResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    dataset_version_id: Optional[uuid.UUID] = None
    quality_score: float
    quality_grade: QualityGrade
    
    # Detailed metrics
    completeness_score: Optional[float] = None
    consistency_score: Optional[float] = None
    validity_score: Optional[float] = None
    uniqueness_score: Optional[float] = None
    bias_score: Optional[float] = None
    
    # Analysis results
    missing_values_analysis: Dict[str, Any] = Field(default_factory=dict)
    data_types_analysis: Dict[str, Any] = Field(default_factory=dict)
    statistical_summary: Dict[str, Any] = Field(default_factory=dict)
    anomalies_detected: List[Any] = Field(default_factory=list)
    bias_analysis: Dict[str, Any] = Field(default_factory=dict)
    schema_validation: Dict[str, Any] = Field(default_factory=dict)
    
    processing_time_seconds: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Dataset Review Schemas

class DatasetReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Overall rating (1-5 stars)")
    title: Optional[str] = Field(None, max_length=200)
    comment: Optional[str] = Field(None, max_length=2000)
    data_quality_rating: Optional[int] = Field(None, ge=1, le=5)
    documentation_rating: Optional[int] = Field(None, ge=1, le=5)
    usability_rating: Optional[int] = Field(None, ge=1, le=5)

class DatasetReviewResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    reviewer_id: uuid.UUID
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    data_quality_rating: Optional[int] = None
    documentation_rating: Optional[int] = None
    usability_rating: Optional[int] = None
    is_verified_purchase: bool = False
    is_flagged: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Dataset Share Schemas

class DatasetShareCreate(BaseModel):
    shared_with_user_id: Optional[uuid.UUID] = None
    shared_with_organization_id: Optional[uuid.UUID] = None
    access_level: AccessLevel = Field(default=AccessLevel.SHARED)
    permissions: Dict[str, bool] = Field(
        default_factory=lambda: {
            "read": True,
            "write": False,
            "delete": False,
            "share": False
        }
    )
    expires_at: Optional[datetime] = None

    @validator('shared_with_user_id', 'shared_with_organization_id')
    def validate_share_target(cls, v, values):
        user_id = values.get('shared_with_user_id')
        org_id = values.get('shared_with_organization_id')
        
        if not user_id and not org_id:
            raise ValueError('Must specify either shared_with_user_id or shared_with_organization_id')
        if user_id and org_id:
            raise ValueError('Cannot share with both user and organization simultaneously')
        return v

class DatasetShareResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    shared_by_id: uuid.UUID
    shared_with_user_id: Optional[uuid.UUID] = None
    shared_with_organization_id: Optional[uuid.UUID] = None
    access_level: AccessLevel
    permissions: Dict[str, bool] = Field(default_factory=dict)
    expires_at: Optional[datetime] = None
    download_count: int = 0
    last_accessed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Dataset Collaboration Schemas

class DatasetCollaborationCreate(BaseModel):
    collaborator_id: uuid.UUID
    role: str = Field(default="contributor", regex="^(viewer|contributor|maintainer)$")
    permissions: Dict[str, bool] = Field(
        default_factory=lambda: {
            "read": True,
            "write": True,
            "delete": False,
            "share": False
        }
    )

class DatasetCollaborationResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    collaborator_id: uuid.UUID
    invited_by_id: uuid.UUID
    role: str
    permissions: Dict[str, bool] = Field(default_factory=dict)
    status: str
    invited_at: datetime
    responded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Search and Filter Schemas

class DatasetSearchFilter(BaseModel):
    query: Optional[str] = Field(None, description="Text search query")
    category: Optional[DatasetCategory] = None
    format: Optional[DatasetFormat] = None
    tags: Optional[List[str]] = None
    quality_grade_min: Optional[QualityGrade] = None
    size_min: Optional[int] = Field(None, description="Minimum size in bytes")
    size_max: Optional[int] = Field(None, description="Maximum size in bytes")
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    access_level: Optional[AccessLevel] = None
    organization_id: Optional[uuid.UUID] = None
    
    # Sorting
    sort_by: str = Field(
        default="created_at",
        regex="^(created_at|updated_at|name|title|quality_score|download_count|rating_average)$"
    )
    sort_order: str = Field(default="desc", regex="^(asc|desc)$")
    
    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

# Usage Analytics Schemas

class DatasetUsageAnalytics(BaseModel):
    dataset_id: uuid.UUID
    total_views: int = 0
    total_downloads: int = 0
    unique_users: int = 0
    downloads_by_day: Dict[str, int] = Field(default_factory=dict)
    views_by_day: Dict[str, int] = Field(default_factory=dict)
    top_users: List[Dict[str, Any]] = Field(default_factory=list)
    conversion_rate: Optional[float] = None  # views to downloads

class DatasetRecommendation(BaseModel):
    dataset: DatasetResponse
    score: float = Field(..., description="Recommendation score (0-1)")
    reason: str = Field(..., description="Why this dataset is recommended")

class DatasetRecommendationsResponse(BaseModel):
    recommendations: List[DatasetRecommendation]
    based_on: List[str] = Field(default_factory=list, description="What the recommendations are based on")

# Conversion and Processing Schemas

class DatasetConversionRequest(BaseModel):
    target_format: DatasetFormat
    options: Dict[str, Any] = Field(default_factory=dict)
    include_preprocessing: bool = Field(default=False)
    preprocessing_config: Dict[str, Any] = Field(default_factory=dict)

class DatasetConversionResponse(BaseModel):
    conversion_id: uuid.UUID
    status: str  # pending, processing, completed, failed
    target_format: DatasetFormat
    progress_percentage: float = 0.0
    output_file_path: Optional[str] = None
    error_message: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    created_at: datetime

# Bulk Operations

class BulkDatasetOperation(BaseModel):
    dataset_ids: List[uuid.UUID] = Field(..., max_items=100)
    operation: str = Field(..., regex="^(publish|unpublish|delete|update_tags)$")
    parameters: Dict[str, Any] = Field(default_factory=dict)

class BulkOperationResponse(BaseModel):
    operation_id: uuid.UUID
    total_datasets: int
    successful: int = 0
    failed: int = 0
    errors: List[Dict[str, str]] = Field(default_factory=list)
    status: str  # processing, completed, failed