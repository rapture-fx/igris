"""
Dataset Marketplace API Schemas
==============================

Pydantic schemas for dataset marketplace API endpoints providing:
- Request and response models for all marketplace operations
- Data validation and serialization
- API documentation through schema definitions
- Type safety for marketplace interactions

Covers:
- Dataset cataloging and management
- Search and discovery
- Quality assessment
- Sharing and permissions
- Reviews and ratings
- Collections and recommendations
- Processing jobs
- Integration schemas
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator
import uuid


# Enums for API schemas
class DatasetTypeSchema(str, Enum):
    """Dataset type enumeration for API."""
    TABULAR = "tabular"
    IMAGE = "image"
    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    TIME_SERIES = "time_series"
    GRAPH = "graph"
    GEOSPATIAL = "geospatial"
    MIXED = "mixed"


class DataFormatSchema(str, Enum):
    """Data format enumeration for API."""
    CSV = "csv"
    JSON = "json"
    PARQUET = "parquet"
    AVRO = "avro"
    XLSX = "xlsx"
    HDF5 = "hdf5"
    NPY = "npy"
    PKL = "pkl"
    JPEG = "jpeg"
    PNG = "png"
    TIFF = "tiff"
    MP4 = "mp4"
    WAV = "wav"
    MP3 = "mp3"
    TXT = "txt"
    XML = "xml"
    JSONL = "jsonl"
    TFRECORD = "tfrecord"


class AccessLevelSchema(str, Enum):
    """Access level enumeration for API."""
    PUBLIC = "public"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    PRIVATE = "private"


class DatasetStatusSchema(str, Enum):
    """Dataset status enumeration for API."""
    DRAFT = "draft"
    VALIDATING = "validating"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"
    PRIVATE = "private"


class QualityLevelSchema(str, Enum):
    """Quality level enumeration for API."""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    UNKNOWN = "unknown"


class SharePermissionSchema(str, Enum):
    """Share permission enumeration for API."""
    VIEW = "view"
    DOWNLOAD = "download"
    EDIT = "edit"
    ADMIN = "admin"


class UsageTypeSchema(str, Enum):
    """Usage type enumeration for API."""
    TRAINING = "training"
    VALIDATION = "validation"
    TESTING = "testing"
    INFERENCE = "inference"
    RESEARCH = "research"
    EXPLORATION = "exploration"


class ProcessingTypeSchema(str, Enum):
    """Processing type enumeration for API."""
    FORMAT_CONVERSION = "format_conversion"
    QUALITY_ASSESSMENT = "quality_assessment"
    PREPROCESSING = "preprocessing"
    FEATURE_ENGINEERING = "feature_engineering"
    TRAIN_TEST_SPLIT = "train_test_split"
    NORMALIZATION = "normalization"
    IMPUTATION = "imputation"
    ENCODING = "encoding"
    SAMPLING = "sampling"
    VALIDATION = "validation"


# Base schemas
class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""
    created_at: datetime
    updated_at: Optional[datetime] = None


class UserInfoMixin(BaseModel):
    """Mixin for user information."""
    created_by: str
    organization: Optional[str] = None


# Dataset Schemas
class DatasetMetadataCreate(BaseModel):
    """Schema for creating dataset metadata."""
    name: str = Field(..., min_length=1, max_length=200, description="Dataset name")
    title: Optional[str] = Field(None, max_length=300, description="Human-readable title")
    description: Optional[str] = Field(None, description="Dataset description")
    dataset_type: DatasetTypeSchema = Field(..., description="Type of dataset")
    
    # Categorization
    categories: List[str] = Field(default_factory=list, description="Category tags")
    tags: List[str] = Field(default_factory=list, description="Search tags")
    keywords: List[str] = Field(default_factory=list, description="Search keywords")
    
    # Access and licensing
    access_level: AccessLevelSchema = Field(AccessLevelSchema.PRIVATE, description="Access level")
    license_type: str = Field("proprietary", description="License type")
    license_text: Optional[str] = Field(None, description="License text")
    terms_of_use: Optional[str] = Field(None, description="Terms of use")
    
    # Metadata
    source_description: Optional[str] = Field(None, description="Data source description")
    collection_methodology: Optional[str] = Field(None, description="How data was collected")
    geographic_coverage: Optional[str] = Field(None, description="Geographic coverage")
    temporal_coverage: Optional[Dict[str, Any]] = Field(None, description="Temporal coverage")
    update_frequency: Optional[str] = Field(None, description="Update frequency")
    
    # Contact information
    contact_email: Optional[str] = Field(None, description="Contact email")
    maintainer: Optional[str] = Field(None, description="Dataset maintainer")
    
    # External references
    doi: Optional[str] = Field(None, description="Digital Object Identifier")
    citation: Optional[str] = Field(None, description="Citation information")
    external_urls: List[str] = Field(default_factory=list, description="External URLs")
    related_papers: List[Dict[str, str]] = Field(default_factory=list, description="Related papers")
    
    @validator('name')
    def validate_name(cls, v):
        """Validate dataset name."""
        if not v.strip():
            raise ValueError('Dataset name cannot be empty')
        return v.strip()
    
    @validator('tags')
    def validate_tags(cls, v):
        """Validate and clean tags."""
        return [tag.strip().lower() for tag in v if tag.strip()]


class DatasetCatalogRequest(DatasetMetadataCreate, UserInfoMixin):
    """Request schema for cataloging a dataset."""
    file_path: str = Field(..., description="Path to dataset file")
    auto_quality_check: bool = Field(True, description="Run automatic quality assessment")
    custom_metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class DatasetInfo(BaseModel):
    """Basic dataset information."""
    dataset_id: str
    name: str
    title: Optional[str]
    description: Optional[str]
    dataset_type: DatasetTypeSchema
    access_level: AccessLevelSchema
    status: DatasetStatusSchema
    created_by: str
    organization: Optional[str]
    created_at: datetime
    
    # Quality metrics
    quality_score: float = Field(default=0.0, ge=0, le=100)
    quality_level: QualityLevelSchema = QualityLevelSchema.UNKNOWN
    
    # Size and structure
    size_mb: float = Field(default=0.0, ge=0)
    row_count: int = Field(default=0, ge=0)
    column_count: int = Field(default=0, ge=0)
    
    # Usage statistics
    download_count: int = Field(default=0, ge=0)
    view_count: int = Field(default=0, ge=0)
    average_rating: float = Field(default=0.0, ge=0, le=5)
    rating_count: int = Field(default=0, ge=0)
    
    # Metadata
    tags: List[str] = Field(default_factory=list)
    is_featured: bool = Field(default=False)
    is_verified: bool = Field(default=False)


class DatasetDetailResponse(DatasetInfo):
    """Detailed dataset information response."""
    # Extended metadata
    categories: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    license_type: Optional[str]
    terms_of_use: Optional[str]
    source_description: Optional[str]
    collection_methodology: Optional[str]
    contact_email: Optional[str]
    
    # File information
    primary_format: DataFormatSchema
    supported_formats: List[DataFormatSchema] = Field(default_factory=list)
    
    # Quality details
    completeness_score: float = Field(default=0.0, ge=0, le=100)
    consistency_score: float = Field(default=0.0, ge=0, le=100)
    validity_score: float = Field(default=0.0, ge=0, le=100)
    accuracy_score: float = Field(default=0.0, ge=0, le=100)
    
    # Version information
    current_version: str = Field(default="1.0")
    version_count: int = Field(default=1, ge=1)
    
    # Timestamps
    updated_at: Optional[datetime]
    published_at: Optional[datetime]
    last_accessed_at: Optional[datetime]
    
    # User permissions (populated based on requesting user)
    user_permissions: List[str] = Field(default_factory=list)
    
    # Usage statistics
    usage_stats: Optional[Dict[str, Any]] = None


# Search Schemas
class DatasetSearchFilters(BaseModel):
    """Filters for dataset search."""
    query: Optional[str] = Field(None, description="Text search query")
    dataset_types: List[DatasetTypeSchema] = Field(default_factory=list, description="Dataset types filter")
    access_levels: List[AccessLevelSchema] = Field(default_factory=list, description="Access levels filter")
    quality_min: Optional[float] = Field(None, ge=0, le=100, description="Minimum quality score")
    tags: List[str] = Field(default_factory=list, description="Tags filter")
    created_by: Optional[str] = Field(None, description="Creator filter")
    organization: Optional[str] = Field(None, description="Organization filter")
    min_size_mb: Optional[float] = Field(None, ge=0, description="Minimum size in MB")
    max_size_mb: Optional[float] = Field(None, ge=0, description="Maximum size in MB")
    has_splits: Optional[bool] = Field(None, description="Has train/test splits")
    created_after: Optional[datetime] = Field(None, description="Created after date")
    created_before: Optional[datetime] = Field(None, description="Created before date")
    is_featured: Optional[bool] = Field(None, description="Featured datasets only")
    
    @validator('max_size_mb')
    def validate_size_range(cls, v, values):
        """Validate size range."""
        if v is not None and 'min_size_mb' in values and values['min_size_mb'] is not None:
            if v < values['min_size_mb']:
                raise ValueError('max_size_mb must be >= min_size_mb')
        return v


class DatasetSearchRequest(BaseModel):
    """Request schema for dataset search."""
    filters: DatasetSearchFilters = Field(default_factory=DatasetSearchFilters)
    limit: int = Field(20, ge=1, le=100, description="Maximum results")
    offset: int = Field(0, ge=0, description="Result offset")
    sort_by: str = Field("relevance", description="Sort criteria")
    
    @validator('sort_by')
    def validate_sort_by(cls, v):
        """Validate sort criteria."""
        valid_sorts = ["relevance", "created_at", "quality_score", "rating", "downloads", "size"]
        if v not in valid_sorts:
            raise ValueError(f'sort_by must be one of: {", ".join(valid_sorts)}')
        return v


class DatasetSearchResponse(BaseModel):
    """Response schema for dataset search."""
    datasets: List[DatasetInfo]
    total_count: int = Field(ge=0, description="Total matching datasets")
    limit: int = Field(ge=1, description="Applied limit")
    offset: int = Field(ge=0, description="Applied offset")
    has_more: bool = Field(description="More results available")
    search_time_ms: Optional[float] = Field(description="Search execution time")


# Quality Assessment Schemas
class QualityMetrics(BaseModel):
    """Quality assessment metrics."""
    overall_score: float = Field(ge=0, le=100, description="Overall quality score")
    quality_level: QualityLevelSchema = Field(description="Quality level")
    completeness_score: float = Field(ge=0, le=100, description="Data completeness")
    consistency_score: float = Field(ge=0, le=100, description="Data consistency")
    validity_score: float = Field(ge=0, le=100, description="Data validity")
    accuracy_score: float = Field(ge=0, le=100, description="Data accuracy")
    uniqueness_score: float = Field(ge=0, le=100, description="Data uniqueness")
    timeliness_score: float = Field(ge=0, le=100, description="Data timeliness")


class ColumnProfile(BaseModel):
    """Column profiling information."""
    name: str = Field(description="Column name")
    data_type: str = Field(description="Data type")
    null_count: int = Field(ge=0, description="Number of null values")
    null_percentage: float = Field(ge=0, le=100, description="Percentage of null values")
    unique_count: int = Field(ge=0, description="Number of unique values")
    unique_percentage: float = Field(ge=0, le=100, description="Percentage of unique values")
    
    # Statistical measures (for numeric columns)
    mean: Optional[float] = Field(None, description="Mean value")
    median: Optional[float] = Field(None, description="Median value")
    std: Optional[float] = Field(None, description="Standard deviation")
    min_value: Optional[Union[str, float, int]] = Field(None, description="Minimum value")
    max_value: Optional[Union[str, float, int]] = Field(None, description="Maximum value")
    
    # Distribution characteristics
    skewness: Optional[float] = Field(None, description="Skewness")
    kurtosis: Optional[float] = Field(None, description="Kurtosis")
    
    # Quality issues
    outlier_count: int = Field(default=0, ge=0, description="Number of outliers")
    inconsistent_formats: int = Field(default=0, ge=0, description="Format inconsistencies")


class AnomalyInfo(BaseModel):
    """Anomaly detection information."""
    type: str = Field(description="Anomaly type")
    column: Optional[str] = Field(None, description="Affected column")
    count: Optional[int] = Field(None, description="Number of anomalies")
    percentage: Optional[float] = Field(None, description="Percentage of data affected")
    description: str = Field(description="Anomaly description")
    severity: str = Field(description="Severity level")


class QualityAssessmentResponse(BaseModel):
    """Quality assessment response."""
    dataset_id: str
    report_id: str
    assessment_timestamp: datetime
    
    # Quality metrics
    quality_metrics: QualityMetrics
    
    # Detailed analysis
    column_profiles: List[ColumnProfile]
    anomalies: List[AnomalyInfo]
    recommendations: List[str]
    
    # Assessment metadata
    sample_size: int = Field(ge=0, description="Sample size analyzed")
    processing_time_seconds: float = Field(ge=0, description="Processing time")
    generated_by: str = Field(default="automated", description="Assessment method")


# Sharing Schemas
class DatasetShareRequest(BaseModel):
    """Request to share a dataset."""
    shared_with_id: str = Field(..., description="User/team/org ID to share with")
    shared_with_type: str = Field(..., description="Type of recipient")
    permission: SharePermissionSchema = Field(..., description="Permission level")
    expires_at: Optional[datetime] = Field(None, description="Expiration date")
    max_downloads: Optional[int] = Field(None, ge=1, description="Download limit")
    terms: Optional[str] = Field(None, description="Terms of use")
    
    @validator('shared_with_type')
    def validate_share_type(cls, v):
        """Validate share type."""
        valid_types = ["user", "team", "organization"]
        if v not in valid_types:
            raise ValueError(f'shared_with_type must be one of: {", ".join(valid_types)}')
        return v
    
    @validator('expires_at')
    def validate_expiration(cls, v):
        """Validate expiration date."""
        if v and v <= datetime.utcnow():
            raise ValueError('expires_at must be in the future')
        return v


class DatasetShareInfo(BaseModel):
    """Dataset share information."""
    share_id: str
    dataset_id: str
    shared_with_id: str
    shared_with_type: str
    permission: SharePermissionSchema
    shared_by: str
    created_at: datetime
    expires_at: Optional[datetime]
    max_downloads: Optional[int]
    current_downloads: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)
    access_count: int = Field(default=0, ge=0)


class DatasetShareResponse(BaseModel):
    """Response for dataset sharing operation."""
    share_id: str
    success: bool
    message: str


# Download Schemas
class DatasetDownloadRequest(BaseModel):
    """Request to download a dataset."""
    format_requested: Optional[DataFormatSchema] = Field(None, description="Requested format")
    purpose: Optional[str] = Field(None, description="Purpose of download")
    accept_terms: bool = Field(False, description="Accept terms of use")
    
    @validator('accept_terms')
    def validate_terms(cls, v):
        """Validate terms acceptance."""
        if not v:
            raise ValueError('Must accept terms of use to download dataset')
        return v


class DatasetDownloadResponse(BaseModel):
    """Response for dataset download."""
    download_url: Optional[str] = Field(description="Download URL")
    file_path: Optional[str] = Field(description="File path for direct access")
    metadata: Dict[str, Any] = Field(description="Download metadata")
    expires_at: Optional[datetime] = Field(description="Download link expiration")


# Review Schemas
class DatasetReviewCreate(BaseModel):
    """Schema for creating a dataset review."""
    title: Optional[str] = Field(None, max_length=200, description="Review title")
    review_text: Optional[str] = Field(None, description="Review content")
    overall_rating: int = Field(..., ge=1, le=5, description="Overall rating (1-5)")
    quality_rating: Optional[int] = Field(None, ge=1, le=5, description="Quality rating")
    completeness_rating: Optional[int] = Field(None, ge=1, le=5, description="Completeness rating")
    accuracy_rating: Optional[int] = Field(None, ge=1, le=5, description="Accuracy rating")
    usability_rating: Optional[int] = Field(None, ge=1, le=5, description="Usability rating")
    documentation_rating: Optional[int] = Field(None, ge=1, le=5, description="Documentation rating")
    use_case: Optional[str] = Field(None, description="How dataset was used")
    model_type_used: Optional[str] = Field(None, description="Type of model trained")
    results_achieved: Optional[str] = Field(None, description="Results achieved")


class DatasetReviewInfo(BaseModel):
    """Dataset review information."""
    review_id: str
    dataset_id: str
    reviewer_id: str
    title: Optional[str]
    review_text: Optional[str]
    overall_rating: int = Field(ge=1, le=5)
    quality_rating: Optional[int] = Field(None, ge=1, le=5)
    usability_rating: Optional[int] = Field(None, ge=1, le=5)
    use_case: Optional[str]
    is_verified_user: bool = Field(default=False)
    is_featured_review: bool = Field(default=False)
    helpful_votes: int = Field(default=0, ge=0)
    total_votes: int = Field(default=0, ge=0)
    created_at: datetime
    updated_at: Optional[datetime]


class DatasetReviewResponse(BaseModel):
    """Response for review creation."""
    review_id: str
    success: bool
    message: str


# Processing Schemas
class ProcessingJobConfig(BaseModel):
    """Configuration for dataset processing job."""
    job_type: ProcessingTypeSchema = Field(..., description="Type of processing")
    job_name: Optional[str] = Field(None, description="Job name")
    description: Optional[str] = Field(None, description="Job description")
    
    # Format configuration
    source_format: Optional[DataFormatSchema] = Field(None, description="Source format")
    target_format: Optional[DataFormatSchema] = Field(None, description="Target format")
    
    # Processing parameters
    processing_config: Dict[str, Any] = Field(default_factory=dict, description="Processing parameters")
    transformation_steps: List[str] = Field(default_factory=list, description="Transformation steps")
    
    # Resource configuration
    cpu_cores: int = Field(1, ge=1, le=16, description="CPU cores")
    memory_gb: int = Field(4, ge=1, le=64, description="Memory in GB")
    gpu_enabled: bool = Field(False, description="Enable GPU")
    max_runtime_minutes: int = Field(60, ge=1, le=1440, description="Max runtime")
    
    # Output configuration
    output_location: Optional[str] = Field(None, description="Output location")
    
    @validator('processing_config')
    def validate_config(cls, v, values):
        """Validate processing configuration."""
        if 'job_type' in values:
            job_type = values['job_type']
            if job_type == ProcessingTypeSchema.NORMALIZATION:
                if 'method' not in v:
                    v['method'] = 'standard'
                elif v['method'] not in ['standard', 'minmax']:
                    raise ValueError('Invalid normalization method')
        return v


class ProcessingJobInfo(BaseModel):
    """Processing job information."""
    job_id: str
    dataset_id: str
    job_type: ProcessingTypeSchema
    job_name: Optional[str]
    status: str  # ProcessingStatus enum values
    progress_percent: float = Field(default=0.0, ge=0, le=100)
    current_step: Optional[str]
    
    # Results
    rows_processed: int = Field(default=0, ge=0)
    bytes_processed: int = Field(default=0, ge=0)
    output_size_bytes: Optional[int] = Field(None, ge=0)
    processing_time_seconds: Optional[int] = Field(None, ge=0)
    
    # Error information
    error_count: int = Field(default=0, ge=0)
    error_details: Optional[Dict[str, Any]] = None
    
    # Timestamps
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    # Quality results (if applicable)
    quality_score: Optional[float] = Field(None, ge=0, le=100)


class ProcessingJobRequest(BaseModel):
    """Request to create processing job."""
    dataset_id: str = Field(..., description="Dataset to process")
    config: ProcessingJobConfig = Field(..., description="Processing configuration")


class ProcessingJobResponse(BaseModel):
    """Response for processing job creation."""
    job_id: str
    success: bool
    message: str
    estimated_duration_minutes: Optional[float] = None


# Collection Schemas
class DatasetCollectionCreate(BaseModel):
    """Schema for creating a dataset collection."""
    name: str = Field(..., min_length=1, max_length=200, description="Collection name")
    title: Optional[str] = Field(None, max_length=300, description="Collection title")
    description: str = Field(..., description="Collection description")
    category: Optional[str] = Field(None, description="Collection category")
    tags: List[str] = Field(default_factory=list, description="Collection tags")
    is_public: bool = Field(True, description="Public visibility")
    dataset_ids: List[str] = Field(default_factory=list, description="Initial datasets")


class DatasetCollectionInfo(BaseModel):
    """Dataset collection information."""
    collection_id: str
    name: str
    title: Optional[str]
    description: str
    curator_id: str
    category: Optional[str]
    tags: List[str] = Field(default_factory=list)
    is_public: bool
    is_featured: bool = Field(default=False)
    is_curated: bool = Field(default=False)
    dataset_count: int = Field(default=0, ge=0)
    total_size_bytes: int = Field(default=0, ge=0)
    avg_quality_score: Optional[float] = Field(None, ge=0, le=100)
    view_count: int = Field(default=0, ge=0)
    follow_count: int = Field(default=0, ge=0)
    created_at: datetime
    updated_at: Optional[datetime]


class DatasetCollectionResponse(BaseModel):
    """Response for collection creation."""
    collection_id: str
    success: bool
    message: str


# Recommendation Schemas
class RecommendationRequest(BaseModel):
    """Request for dataset recommendations."""
    context_dataset_id: Optional[str] = Field(None, description="Context dataset")
    use_case: Optional[str] = Field(None, description="Intended use case")
    preferred_types: List[DatasetTypeSchema] = Field(default_factory=list, description="Preferred types")
    quality_threshold: float = Field(70.0, ge=0, le=100, description="Quality threshold")
    limit: int = Field(10, ge=1, le=50, description="Number of recommendations")


class RecommendationResponse(BaseModel):
    """Response with dataset recommendations."""
    recommendations: List[DatasetInfo]
    recommendation_reasons: Dict[str, List[str]] = Field(description="Reasons for each recommendation")
    generated_at: datetime
    user_context: Optional[Dict[str, Any]] = None


# Integration Schemas
class ExperimentDatasetLink(BaseModel):
    """Schema for linking dataset to experiment."""
    experiment_id: str = Field(..., description="MLOps experiment ID")
    usage_type: UsageTypeSchema = Field(..., description="How dataset is used")
    version_used: Optional[str] = Field(None, description="Dataset version")
    columns_used: List[str] = Field(default_factory=list, description="Columns used")
    split_type: Optional[str] = Field(None, description="Data split type")
    
    @validator('split_type')
    def validate_split_type(cls, v):
        """Validate split type."""
        if v and v not in ['train', 'validation', 'test']:
            raise ValueError('split_type must be train, validation, or test')
        return v


class ExperimentDatasetLinkResponse(BaseModel):
    """Response for dataset-experiment linking."""
    link_id: str
    success: bool
    message: str


# Analytics Schemas
class UsageAnalytics(BaseModel):
    """Dataset usage analytics."""
    dataset_id: str
    period_start: datetime
    period_end: datetime
    
    # Usage metrics
    total_downloads: int = Field(ge=0)
    total_views: int = Field(ge=0)
    unique_users: int = Field(ge=0)
    total_api_calls: int = Field(ge=0)
    
    # Performance metrics
    avg_download_time_seconds: float = Field(ge=0)
    success_rate_percent: float = Field(ge=0, le=100)
    
    # Geographic distribution
    usage_by_region: Dict[str, int] = Field(default_factory=dict)
    
    # Usage patterns
    usage_by_hour: List[int] = Field(description="24-hour usage pattern")
    usage_by_type: Dict[str, int] = Field(default_factory=dict)
    
    # Model training outcomes
    models_trained: int = Field(default=0, ge=0)
    avg_model_performance: Optional[float] = Field(None, ge=0, le=100)
    successful_experiments: int = Field(default=0, ge=0)


class PlatformAnalytics(BaseModel):
    """Platform-wide analytics."""
    timestamp: datetime
    
    # Dataset statistics
    total_datasets: int = Field(ge=0)
    public_datasets: int = Field(ge=0)
    private_datasets: int = Field(ge=0)
    avg_quality_score: float = Field(ge=0, le=100)
    
    # Usage statistics
    total_downloads: int = Field(ge=0)
    active_users: int = Field(ge=0)
    total_api_calls: int = Field(ge=0)
    
    # Quality distribution
    quality_distribution: Dict[str, int] = Field(default_factory=dict)
    
    # Type distribution
    type_distribution: Dict[str, int] = Field(default_factory=dict)
    
    # Growth metrics
    datasets_created_today: int = Field(ge=0)
    new_users_today: int = Field(ge=0)
    downloads_today: int = Field(ge=0)


# Error Schemas
class ErrorResponse(BaseModel):
    """Standard error response."""
    error: bool = True
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ValidationErrorResponse(BaseModel):
    """Validation error response."""
    error: bool = True
    error_code: str = "validation_error"
    message: str = "Validation failed"
    validation_errors: List[Dict[str, Any]]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Success Schemas
class SuccessResponse(BaseModel):
    """Standard success response."""
    success: bool = True
    message: str
    data: Optional[Any] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Health Check Schema
class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "1.0.0"
    services: Dict[str, str] = Field(description="Service status")
    database_connected: bool
    storage_accessible: bool