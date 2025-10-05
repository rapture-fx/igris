"""
Dataset Marketplace Database Models
===================================

Comprehensive database models for the Dataset Marketplace enabling AI companies to:
- Catalog and manage datasets with versioning and metadata
- Share datasets with granular access control and permissions
- Discover datasets through advanced search and filtering
- Track dataset usage, reviews, and collaboration
- Manage data quality assessments and lineage
- Integrate with MLOps experiments and model training

Features:
- Dataset cataloging with rich metadata and versioning
- Data quality scoring and automated profiling
- Usage tracking and analytics
- Review and rating system
- Access control and permission management
- Dataset lineage and provenance tracking
- Integration with experiment tracking
- Bias detection and fairness metrics
- Format conversion and preprocessing pipelines
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, ForeignKey, 
    Boolean, JSON, Index, Enum as SQLEnum, LargeBinary, BigInteger
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from enum import Enum
import uuid

# Import existing base from MLOps models
try:
    from app.models.mlops import Base
except ImportError:
    try:
        from app.models.manufacturing import Base
    except ImportError:
        Base = declarative_base()


# Enums for Dataset Marketplace
class DatasetStatus(str, Enum):
    """Dataset lifecycle status."""
    DRAFT = "draft"
    VALIDATING = "validating"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"
    PRIVATE = "private"


class DatasetType(str, Enum):
    """Types of datasets."""
    TABULAR = "tabular"
    IMAGE = "image"
    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    TIME_SERIES = "time_series"
    GRAPH = "graph"
    GEOSPATIAL = "geospatial"
    MIXED = "mixed"


class DataFormat(str, Enum):
    """Supported data formats."""
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


class DatasetLicense(str, Enum):
    """Dataset licenses."""
    CC0 = "cc0"
    CC_BY = "cc_by"
    CC_BY_SA = "cc_by_sa"
    CC_BY_NC = "cc_by_nc"
    MIT = "mit"
    APACHE_2_0 = "apache_2_0"
    GPL_3_0 = "gpl_3_0"
    PROPRIETARY = "proprietary"
    COMMERCIAL = "commercial"
    RESEARCH_ONLY = "research_only"
    CUSTOM = "custom"


class AccessLevel(str, Enum):
    """Dataset access levels."""
    PUBLIC = "public"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    PRIVATE = "private"


class DataQualityLevel(str, Enum):
    """Data quality levels."""
    EXCELLENT = "excellent"  # 90-100%
    GOOD = "good"           # 70-89%
    FAIR = "fair"           # 50-69%
    POOR = "poor"           # Below 50%
    UNKNOWN = "unknown"     # Not assessed


class ProcessingStatus(str, Enum):
    """Processing pipeline status."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SharePermission(str, Enum):
    """Dataset sharing permissions."""
    VIEW = "view"
    DOWNLOAD = "download"
    EDIT = "edit"
    ADMIN = "admin"


class UsageType(str, Enum):
    """Types of dataset usage."""
    TRAINING = "training"
    VALIDATION = "validation"
    TESTING = "testing"
    INFERENCE = "inference"
    RESEARCH = "research"
    EXPLORATION = "exploration"


# Main Dataset Models

class Dataset(Base):
    """Core dataset catalog table."""
    
    __tablename__ = 'datasets'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    title = Column(String(300))  # Human-readable title
    description = Column(Text)
    
    # Dataset classification
    dataset_type = Column(SQLEnum(DatasetType), nullable=False, index=True)
    categories = Column(JSON)  # List of category tags
    tags = Column(JSON)  # List of tags for search
    keywords = Column(JSON)  # Search keywords
    
    # Creator and ownership
    created_by = Column(String(100), nullable=False, index=True)
    organization = Column(String(200))
    maintainer = Column(String(100))
    contact_email = Column(String(200))
    
    # Access control
    access_level = Column(SQLEnum(AccessLevel), default=AccessLevel.PRIVATE, index=True)
    license_type = Column(SQLEnum(DatasetLicense), default=DatasetLicense.PROPRIETARY)
    license_text = Column(Text)
    terms_of_use = Column(Text)
    
    # Dataset metadata
    source_description = Column(Text)
    collection_methodology = Column(Text)
    data_sources = Column(JSON)  # List of data sources
    geographic_coverage = Column(String(500))
    temporal_coverage = Column(JSON)  # Start and end dates
    update_frequency = Column(String(100))  # Daily, weekly, etc.
    
    # Technical specifications
    primary_format = Column(SQLEnum(DataFormat), nullable=False)
    supported_formats = Column(JSON)  # List of available formats
    schema_config = Column(JSON)  # Dataset schema definition
    column_descriptions = Column(JSON)  # Column metadata
    
    # Size and statistics
    total_size_bytes = Column(BigInteger, default=0)
    row_count = Column(BigInteger, default=0)
    column_count = Column(Integer, default=0)
    file_count = Column(Integer, default=1)
    sample_count = Column(BigInteger)  # For non-tabular data
    
    # Quality metrics
    quality_score = Column(Float, default=0.0, index=True)
    quality_level = Column(SQLEnum(DataQualityLevel), default=DataQualityLevel.UNKNOWN, index=True)
    completeness_score = Column(Float, default=0.0)
    consistency_score = Column(Float, default=0.0)
    validity_score = Column(Float, default=0.0)
    accuracy_score = Column(Float, default=0.0)
    
    # Bias and fairness metrics
    bias_assessment_score = Column(Float)
    fairness_metrics = Column(JSON)
    demographic_parity_score = Column(Float)
    equalized_odds_score = Column(Float)
    
    # Usage tracking
    download_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    usage_count = Column(Integer, default=0)
    citation_count = Column(Integer, default=0)
    
    # Ratings and reviews
    average_rating = Column(Float, default=0.0, index=True)
    rating_count = Column(Integer, default=0)
    
    # Status and lifecycle
    status = Column(SQLEnum(DatasetStatus), default=DatasetStatus.DRAFT, index=True)
    is_featured = Column(Boolean, default=False, index=True)
    is_verified = Column(Boolean, default=False, index=True)
    verification_date = Column(DateTime)
    verified_by = Column(String(100))
    
    # Versioning
    current_version = Column(String(50), default="1.0")
    version_count = Column(Integer, default=1)
    
    # External references
    doi = Column(String(200))  # Digital Object Identifier
    citation = Column(Text)
    external_urls = Column(JSON)
    related_papers = Column(JSON)
    
    # Processing and ML readiness
    preprocessing_applied = Column(JSON)  # List of preprocessing steps
    ml_ready_formats = Column(JSON)  # Available ML-ready formats
    train_test_split_available = Column(Boolean, default=False)
    cross_validation_splits = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime)
    last_accessed_at = Column(DateTime)
    
    # Storage and location
    storage_backend = Column(String(50), default="local")  # local, s3, gcs, azure
    storage_config = Column(JSON)
    primary_location = Column(String(1000))
    backup_locations = Column(JSON)
    
    # Relationships
    versions = relationship("DatasetVersion", back_populates="dataset", cascade="all, delete-orphan")
    quality_reports = relationship("DataQualityReport", back_populates="dataset", cascade="all, delete-orphan")
    usage_logs = relationship("DatasetUsageLog", back_populates="dataset")
    reviews = relationship("DatasetReview", back_populates="dataset", cascade="all, delete-orphan")
    shares = relationship("DatasetShare", back_populates="dataset", cascade="all, delete-orphan")
    processing_jobs = relationship("DatasetProcessingJob", back_populates="dataset")
    lineage_sources = relationship("DatasetLineage", foreign_keys="DatasetLineage.target_dataset_id", back_populates="target_dataset")
    lineage_targets = relationship("DatasetLineage", foreign_keys="DatasetLineage.source_dataset_id", back_populates="source_dataset")
    
    # Indexes
    __table_args__ = (
        Index('idx_dataset_status_access', 'status', 'access_level'),
        Index('idx_dataset_quality_rating', 'quality_score', 'average_rating'),
        Index('idx_dataset_type_category', 'dataset_type'),
        Index('idx_dataset_created_by', 'created_by'),
        Index('idx_dataset_featured', 'is_featured'),
        Index('idx_dataset_name_search', 'name'),
    )
    
    @property
    def is_public(self) -> bool:
        """Check if dataset is publicly accessible."""
        return self.access_level == AccessLevel.PUBLIC and self.status == DatasetStatus.PUBLISHED
    
    @property
    def size_mb(self) -> float:
        """Get dataset size in MB."""
        return self.total_size_bytes / (1024 * 1024) if self.total_size_bytes else 0.0
    
    @property
    def latest_version(self) -> Optional["DatasetVersion"]:
        """Get the latest version of the dataset."""
        if self.versions:
            return max(self.versions, key=lambda v: v.created_at)
        return None


class DatasetVersion(Base):
    """Dataset versioning and change tracking."""
    
    __tablename__ = 'dataset_versions'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    version = Column(String(50), nullable=False)
    
    # Version metadata
    version_name = Column(String(200))
    description = Column(Text)
    changelog = Column(Text)
    is_current = Column(Boolean, default=False)
    
    # Parent version tracking
    parent_version_id = Column(String(100), ForeignKey('dataset_versions.version_id'))
    diff_summary = Column(JSON)  # Summary of changes from parent
    
    # Version statistics
    size_bytes = Column(BigInteger)
    row_count = Column(BigInteger)
    column_count = Column(Integer)
    checksum = Column(String(128))  # SHA-256 of the data
    
    # Quality metrics for this version
    quality_score = Column(Float)
    quality_report_id = Column(String(100), ForeignKey('data_quality_reports.report_id'))
    
    # Storage information
    storage_location = Column(String(1000))
    storage_config = Column(JSON)
    
    # Processing status
    processing_status = Column(SQLEnum(ProcessingStatus), default=ProcessingStatus.QUEUED)
    processing_notes = Column(Text)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    tags = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="versions")
    parent_version = relationship("DatasetVersion", remote_side=[version_id])
    quality_report = relationship("DataQualityReport", back_populates="dataset_version")
    
    # Indexes
    __table_args__ = (
        Index('idx_version_dataset_version', 'dataset_id', 'version', unique=True),
        Index('idx_version_current', 'is_current'),
        Index('idx_version_created', 'created_at'),
    )


class DataQualityReport(Base):
    """Comprehensive data quality assessment reports."""
    
    __tablename__ = 'data_quality_reports'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    version_id = Column(String(100), ForeignKey('dataset_versions.version_id'))
    
    # Overall quality metrics
    overall_score = Column(Float, nullable=False, index=True)
    quality_level = Column(SQLEnum(DataQualityLevel), nullable=False)
    
    # Detailed quality dimensions
    completeness_score = Column(Float, nullable=False)
    consistency_score = Column(Float, nullable=False)
    validity_score = Column(Float, nullable=False)
    accuracy_score = Column(Float, nullable=False)
    uniqueness_score = Column(Float, nullable=False)
    timeliness_score = Column(Float, nullable=False)
    
    # Data profiling results
    column_profiles = Column(JSON)  # Detailed column statistics
    missing_value_analysis = Column(JSON)
    outlier_analysis = Column(JSON)
    distribution_analysis = Column(JSON)
    correlation_analysis = Column(JSON)
    
    # Data types and schema validation
    schema_validation_results = Column(JSON)
    data_type_consistency = Column(JSON)
    constraint_violations = Column(JSON)
    
    # Bias and fairness assessment
    bias_analysis = Column(JSON)
    fairness_metrics = Column(JSON)
    demographic_analysis = Column(JSON)
    protected_attributes_analysis = Column(JSON)
    
    # Anomaly detection
    anomalies_detected = Column(Integer, default=0)
    anomaly_types = Column(JSON)
    anomaly_severity = Column(String(20))  # low, medium, high, critical
    
    # Statistical summaries
    statistical_summary = Column(JSON)
    sample_statistics = Column(JSON)
    
    # Quality issues and recommendations
    quality_issues = Column(JSON)  # List of identified issues
    recommendations = Column(JSON)  # Improvement recommendations
    action_items = Column(JSON)  # Specific action items
    
    # Assessment configuration
    assessment_config = Column(JSON)  # Configuration used for assessment
    assessment_methods = Column(JSON)  # Methods and tools used
    sample_size = Column(Integer)  # Size of sample assessed
    
    # Report metadata
    generated_by = Column(String(50), default="automated")  # automated, manual, hybrid
    assessment_duration_seconds = Column(Integer)
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="quality_reports")
    dataset_version = relationship("DatasetVersion", back_populates="quality_report")
    
    # Indexes
    __table_args__ = (
        Index('idx_quality_dataset_score', 'dataset_id', 'overall_score'),
        Index('idx_quality_level', 'quality_level'),
        Index('idx_quality_generated', 'generated_at'),
    )
    
    @property
    def has_critical_issues(self) -> bool:
        """Check if report has critical quality issues."""
        return self.overall_score < 50.0 or self.anomaly_severity == "critical"
    
    @property
    def passes_threshold(self, threshold: float = 70.0) -> bool:
        """Check if quality score passes a threshold."""
        return self.overall_score >= threshold


class DatasetUsageLog(Base):
    """Dataset usage tracking and analytics."""
    
    __tablename__ = 'dataset_usage_logs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Usage details
    user_id = Column(String(100), nullable=False, index=True)
    usage_type = Column(SQLEnum(UsageType), nullable=False, index=True)
    access_method = Column(String(50))  # api, download, streaming, view
    
    # Session information
    session_id = Column(String(100))
    ip_address = Column(String(45))  # IPv6 support
    user_agent = Column(Text)
    referrer = Column(String(500))
    
    # Usage context
    project_id = Column(String(100))  # Associated project/experiment
    experiment_id = Column(String(100))  # MLOps experiment ID
    purpose = Column(String(200))  # Purpose of usage
    
    # Data accessed
    columns_accessed = Column(JSON)  # Specific columns accessed
    rows_accessed = Column(BigInteger)  # Number of rows accessed
    bytes_transferred = Column(BigInteger)  # Data transferred
    format_used = Column(SQLEnum(DataFormat))
    
    # Performance metrics
    request_duration_ms = Column(Integer)
    processing_time_ms = Column(Integer)
    
    # Geographic and temporal info
    geographic_location = Column(String(200))
    timezone = Column(String(50))
    
    # Success and error tracking
    success = Column(Boolean, default=True, index=True)
    error_code = Column(String(50))
    error_message = Column(Text)
    
    # Timestamps
    accessed_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="usage_logs")
    
    # Indexes
    __table_args__ = (
        Index('idx_usage_dataset_time', 'dataset_id', 'accessed_at'),
        Index('idx_usage_user_type', 'user_id', 'usage_type'),
        Index('idx_usage_project', 'project_id'),
        Index('idx_usage_success', 'success'),
    )


class DatasetReview(Base):
    """Dataset reviews and ratings from users."""
    
    __tablename__ = 'dataset_reviews'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Review details
    reviewer_id = Column(String(100), nullable=False, index=True)
    title = Column(String(200))
    review_text = Column(Text)
    
    # Ratings (1-5 scale)
    overall_rating = Column(Integer, nullable=False, index=True)
    quality_rating = Column(Integer)
    completeness_rating = Column(Integer)
    accuracy_rating = Column(Integer)
    usability_rating = Column(Integer)
    documentation_rating = Column(Integer)
    
    # Review context
    use_case = Column(String(200))  # How they used the dataset
    model_type_used = Column(String(100))  # Type of model trained
    results_achieved = Column(Text)  # Results they achieved
    
    # Review metadata
    is_verified_user = Column(Boolean, default=False)
    is_featured_review = Column(Boolean, default=False)
    helpful_votes = Column(Integer, default=0)
    total_votes = Column(Integer, default=0)
    
    # Moderation
    is_moderated = Column(Boolean, default=False)
    moderation_status = Column(String(20), default="pending")  # pending, approved, rejected
    moderated_by = Column(String(100))
    moderation_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="reviews")
    
    # Indexes
    __table_args__ = (
        Index('idx_review_dataset_rating', 'dataset_id', 'overall_rating'),
        Index('idx_review_reviewer', 'reviewer_id'),
        Index('idx_review_featured', 'is_featured_review'),
        Index('idx_review_moderation', 'moderation_status'),
    )
    
    @property
    def helpfulness_score(self) -> float:
        """Calculate helpfulness score."""
        if self.total_votes > 0:
            return self.helpful_votes / self.total_votes
        return 0.0


class DatasetShare(Base):
    """Dataset sharing and access control."""
    
    __tablename__ = 'dataset_shares'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Sharing details
    shared_with_type = Column(String(20), nullable=False)  # user, team, organization, public
    shared_with_id = Column(String(100), nullable=False, index=True)  # ID of user/team/org
    permission = Column(SQLEnum(SharePermission), nullable=False)
    
    # Share configuration
    expires_at = Column(DateTime)  # Expiration date
    max_downloads = Column(Integer)  # Download limit
    current_downloads = Column(Integer, default=0)
    allowed_usage_types = Column(JSON)  # Allowed usage types
    
    # Access restrictions
    ip_restrictions = Column(JSON)  # Allowed IP addresses/ranges
    geographic_restrictions = Column(JSON)  # Allowed countries/regions
    time_restrictions = Column(JSON)  # Allowed time windows
    
    # Share metadata
    shared_by = Column(String(100), nullable=False)
    share_reason = Column(Text)
    terms_accepted = Column(Boolean, default=False)
    terms_accepted_at = Column(DateTime)
    
    # Status tracking
    is_active = Column(Boolean, default=True, index=True)
    last_accessed_at = Column(DateTime)
    access_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="shares")
    
    # Indexes
    __table_args__ = (
        Index('idx_share_dataset_with', 'dataset_id', 'shared_with_id', unique=True),
        Index('idx_share_permission', 'permission'),
        Index('idx_share_active', 'is_active'),
        Index('idx_share_expires', 'expires_at'),
    )
    
    @property
    def is_expired(self) -> bool:
        """Check if share has expired."""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    @property
    def download_limit_reached(self) -> bool:
        """Check if download limit is reached."""
        if self.max_downloads:
            return self.current_downloads >= self.max_downloads
        return False


class DatasetProcessingJob(Base):
    """Dataset processing and transformation jobs."""
    
    __tablename__ = 'dataset_processing_jobs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Job configuration
    job_type = Column(String(50), nullable=False, index=True)  # format_conversion, quality_assessment, preprocessing
    job_name = Column(String(200))
    description = Column(Text)
    
    # Processing configuration
    source_format = Column(SQLEnum(DataFormat))
    target_format = Column(SQLEnum(DataFormat))
    processing_config = Column(JSON)  # Specific processing parameters
    transformation_steps = Column(JSON)  # List of transformation steps
    
    # Input and output
    input_location = Column(String(1000))
    output_location = Column(String(1000))
    temp_location = Column(String(1000))
    
    # Resource configuration
    cpu_cores = Column(Integer, default=1)
    memory_gb = Column(Integer, default=4)
    gpu_enabled = Column(Boolean, default=False)
    max_runtime_minutes = Column(Integer, default=60)
    
    # Job status and progress
    status = Column(SQLEnum(ProcessingStatus), default=ProcessingStatus.QUEUED, index=True)
    progress_percent = Column(Float, default=0.0)
    current_step = Column(String(200))
    
    # Results and metrics
    rows_processed = Column(BigInteger, default=0)
    bytes_processed = Column(BigInteger, default=0)
    output_size_bytes = Column(BigInteger)
    processing_time_seconds = Column(Integer)
    
    # Error handling
    error_count = Column(Integer, default=0)
    error_details = Column(JSON)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Quality results (if quality assessment job)
    quality_score = Column(Float)
    quality_issues = Column(JSON)
    
    # Job metadata
    created_by = Column(String(100), nullable=False)
    priority = Column(Integer, default=1)  # 1-10 priority scale
    tags = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    failed_at = Column(DateTime)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="processing_jobs")
    
    # Indexes
    __table_args__ = (
        Index('idx_job_dataset_type', 'dataset_id', 'job_type'),
        Index('idx_job_status_priority', 'status', 'priority'),
        Index('idx_job_created_by', 'created_by'),
    )
    
    @property
    def is_running(self) -> bool:
        """Check if job is currently running."""
        return self.status == ProcessingStatus.PROCESSING
    
    @property
    def duration_minutes(self) -> Optional[float]:
        """Calculate job duration in minutes."""
        if self.started_at:
            end_time = self.completed_at or self.failed_at or datetime.utcnow()
            return (end_time - self.started_at).total_seconds() / 60
        return None


class DatasetLineage(Base):
    """Dataset lineage and provenance tracking."""
    
    __tablename__ = 'dataset_lineage'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    lineage_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Lineage relationship
    source_dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    target_dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Relationship details
    relationship_type = Column(String(50), nullable=False, index=True)  # derived_from, merged_with, split_from, transformed_from
    transformation_description = Column(Text)
    transformation_config = Column(JSON)
    
    # Processing information
    processing_job_id = Column(String(100), ForeignKey('dataset_processing_jobs.job_id'))
    processing_tool = Column(String(100))  # Tool/service used for transformation
    processing_version = Column(String(50))
    
    # Data flow metrics
    input_row_count = Column(BigInteger)
    output_row_count = Column(BigInteger)
    data_reduction_ratio = Column(Float)  # Output/Input ratio
    
    # Quality impact
    quality_impact = Column(JSON)  # Quality changes from transformation
    quality_improvement = Column(Float)  # % improvement in quality
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    source_dataset = relationship("Dataset", foreign_keys=[source_dataset_id], back_populates="lineage_targets")
    target_dataset = relationship("Dataset", foreign_keys=[target_dataset_id], back_populates="lineage_sources")
    processing_job = relationship("DatasetProcessingJob")
    
    # Indexes
    __table_args__ = (
        Index('idx_lineage_source_target', 'source_dataset_id', 'target_dataset_id'),
        Index('idx_lineage_relationship', 'relationship_type'),
        Index('idx_lineage_job', 'processing_job_id'),
    )


class DatasetMetrics(Base):
    """Dataset performance and usage metrics over time."""
    
    __tablename__ = 'dataset_metrics'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Timestamp (daily aggregation)
    date = Column(DateTime, nullable=False, index=True)
    
    # Usage metrics
    daily_downloads = Column(Integer, default=0)
    daily_views = Column(Integer, default=0)
    daily_api_calls = Column(Integer, default=0)
    unique_users = Column(Integer, default=0)
    
    # Performance metrics
    avg_download_time_seconds = Column(Float, default=0.0)
    success_rate_percent = Column(Float, default=100.0)
    error_count = Column(Integer, default=0)
    
    # Quality metrics
    quality_score = Column(Float)
    user_satisfaction_score = Column(Float)  # Based on reviews
    
    # Geographic distribution
    usage_by_region = Column(JSON)  # Usage breakdown by region
    
    # Usage patterns
    peak_usage_hour = Column(Integer)  # Hour with peak usage
    usage_pattern = Column(JSON)  # Hourly usage distribution
    
    # Model training outcomes
    models_trained = Column(Integer, default=0)
    avg_model_performance = Column(Float)  # Average performance of models trained
    successful_experiments = Column(Integer, default=0)
    
    # Relationships - none needed for metrics table
    
    # Indexes
    __table_args__ = (
        Index('idx_metrics_dataset_date', 'dataset_id', 'date', unique=True),
        Index('idx_metrics_date', 'date'),
    )


class DatasetRecommendation(Base):
    """Dataset recommendations based on usage patterns and similarity."""
    
    __tablename__ = 'dataset_recommendations'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Recommendation context
    user_id = Column(String(100), nullable=False, index=True)
    source_dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'))  # Dataset that triggered recommendation
    recommended_dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Recommendation scoring
    relevance_score = Column(Float, nullable=False, index=True)
    confidence_score = Column(Float, nullable=False)
    similarity_score = Column(Float)
    
    # Recommendation reasons
    recommendation_type = Column(String(50), nullable=False)  # similar_content, collaborative_filtering, content_based
    recommendation_reasons = Column(JSON)  # List of reasons for recommendation
    similarity_factors = Column(JSON)  # Factors contributing to similarity
    
    # User context
    user_interests = Column(JSON)  # User's interest categories
    usage_history = Column(JSON)  # Relevant usage history
    current_project_context = Column(String(200))
    
    # Recommendation metadata
    algorithm_used = Column(String(100))
    model_version = Column(String(50))
    
    # Interaction tracking
    was_clicked = Column(Boolean, default=False)
    was_downloaded = Column(Boolean, default=False)
    user_feedback_score = Column(Integer)  # 1-5 rating of recommendation quality
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime)  # Recommendation expiry
    
    # Relationships
    source_dataset = relationship("Dataset", foreign_keys=[source_dataset_id])
    recommended_dataset = relationship("Dataset", foreign_keys=[recommended_dataset_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_rec_user_score', 'user_id', 'relevance_score'),
        Index('idx_rec_type', 'recommendation_type'),
        Index('idx_rec_generated', 'generated_at'),
    )


class DatasetTag(Base):
    """Hierarchical tagging system for datasets."""
    
    __tablename__ = 'dataset_tags'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    tag_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False, index=True)
    
    # Tag hierarchy
    parent_tag_id = Column(String(100), ForeignKey('dataset_tags.tag_id'))
    level = Column(Integer, default=0)  # Hierarchy level
    path = Column(String(500))  # Full path from root
    
    # Tag metadata
    description = Column(Text)
    color = Column(String(7))  # Hex color code
    icon = Column(String(50))  # Icon identifier
    
    # Usage statistics
    usage_count = Column(Integer, default=0, index=True)
    dataset_count = Column(Integer, default=0)
    
    # Tag management
    created_by = Column(String(100), nullable=False)
    is_system_tag = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent_tag = relationship("DatasetTag", remote_side=[tag_id])
    child_tags = relationship("DatasetTag", back_populates="parent_tag")
    
    # Indexes
    __table_args__ = (
        Index('idx_tag_parent', 'parent_tag_id'),
        Index('idx_tag_level', 'level'),
        Index('idx_tag_usage', 'usage_count'),
    )


class DatasetCollection(Base):
    """Curated collections of related datasets."""
    
    __tablename__ = 'dataset_collections'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    title = Column(String(300))
    description = Column(Text)
    
    # Collection metadata
    curator_id = Column(String(100), nullable=False)
    category = Column(String(100), index=True)
    tags = Column(JSON)
    
    # Collection settings
    is_public = Column(Boolean, default=True, index=True)
    is_featured = Column(Boolean, default=False, index=True)
    is_curated = Column(Boolean, default=False)  # Professionally curated
    
    # Collection statistics
    dataset_count = Column(Integer, default=0)
    total_size_bytes = Column(BigInteger, default=0)
    avg_quality_score = Column(Float)
    
    # Usage tracking
    view_count = Column(Integer, default=0)
    follow_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    datasets = relationship("DatasetCollectionItem", back_populates="collection", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_collection_curator', 'curator_id'),
        Index('idx_collection_category', 'category'),
        Index('idx_collection_featured', 'is_featured'),
    )


class DatasetCollectionItem(Base):
    """Items in a dataset collection."""
    
    __tablename__ = 'dataset_collection_items'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(String(100), ForeignKey('dataset_collections.collection_id'), nullable=False)
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Item metadata
    added_by = Column(String(100), nullable=False)
    order_index = Column(Integer, default=0)
    notes = Column(Text)
    
    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    collection = relationship("DatasetCollection", back_populates="datasets")
    dataset = relationship("Dataset")
    
    # Indexes
    __table_args__ = (
        Index('idx_collection_item', 'collection_id', 'dataset_id', unique=True),
        Index('idx_collection_order', 'collection_id', 'order_index'),
    )


# Integration tables for MLOps platform

class ExperimentDatasetUsage(Base):
    """Track dataset usage in MLOps experiments."""
    
    __tablename__ = 'experiment_dataset_usage'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), nullable=False, index=True)
    dataset_id = Column(String(100), ForeignKey('datasets.dataset_id'), nullable=False)
    
    # Usage details
    usage_type = Column(SQLEnum(UsageType), nullable=False)
    version_used = Column(String(50))
    columns_used = Column(JSON)  # Specific columns used
    rows_used = Column(BigInteger)  # Number of rows used
    
    # Split information
    split_type = Column(String(20))  # train, validation, test
    split_ratio = Column(Float)
    
    # Performance impact
    model_performance = Column(JSON)  # Performance metrics achieved
    training_duration_minutes = Column(Integer)
    
    # Metadata
    used_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset")
    
    # Indexes
    __table_args__ = (
        Index('idx_exp_dataset_usage', 'experiment_id', 'dataset_id'),
        Index('idx_exp_dataset_type', 'usage_type'),
    )