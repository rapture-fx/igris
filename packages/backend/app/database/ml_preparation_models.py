"""
ML Data Preparation Models
=========================

Enhanced database models specifically designed for data infrastructure data preparation workflows.
These models extend the existing schema to better support ML-ready data preparation.

Key Features:
- Data preparation pipelines with step tracking
- ML framework integration metadata
- Automated preprocessing workflow history
- Quality scoring and pattern recognition results
- Framework-ready output management
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON, ForeignKey, Float, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base
import uuid
import enum
from datetime import datetime


class PreparationStage(str, enum.Enum):
    """Stages in the data preparation pipeline"""
    INGESTION = "ingestion"
    PROFILING = "profiling"
    CLEANING = "cleaning"
    TRANSFORMATION = "transformation"
    LABELING = "labeling"
    VALIDATION = "validation"
    EXPORT = "export"
    COMPLETED = "completed"


class DataQualityLevel(str, enum.Enum):
    """Data quality assessment levels"""
    EXCELLENT = "excellent"  # 95-100%
    GOOD = "good"           # 80-94%
    FAIR = "fair"           # 60-79%
    POOR = "poor"           # Below 60%


class MLFrameworkType(str, enum.Enum):
    """Supported ML frameworks"""
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    SCIKIT_LEARN = "scikit_learn"
    HUGGINGFACE = "huggingface"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    PANDAS = "pandas"
    NUMPY = "numpy"


class DataPreparationPipeline(Base):
    """
    Main model for ML data preparation pipelines
    Tracks the complete flow from raw data to ML-ready format
    """
    __tablename__ = "data_preparation_pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # Link to existing models
    investigation_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"))
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Pipeline configuration
    source_data_path = Column(String, nullable=False)
    target_frameworks = Column(ARRAY(String), default=list)  # Multiple target frameworks
    pipeline_config = Column(JSON, default=dict)
    
    # Pipeline state
    current_stage = Column(Enum(PreparationStage), default=PreparationStage.INGESTION)
    progress_percentage = Column(Float, default=0.0)
    quality_score = Column(Float)
    quality_level = Column(Enum(DataQualityLevel))
    
    # Metrics and insights
    total_records = Column(Integer)
    total_columns = Column(Integer)
    data_size_mb = Column(Float)
    processing_time_seconds = Column(Float)
    
    # AI insights
    patterns_detected = Column(JSON, default=list)
    anomalies_found = Column(JSON, default=list)
    recommendations = Column(JSON, default=list)
    auto_labels_applied = Column(JSON, default=list)
    
    # Status tracking
    is_active = Column(Boolean, default=True)
    is_ml_ready = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    investigation = relationship("DataInvestigation", back_populates="preparation_pipeline")
    workspace = relationship("Workspace")
    created_by = relationship("User")
    preparation_steps = relationship("PreparationStep", back_populates="pipeline", cascade="all, delete-orphan")
    framework_outputs = relationship("FrameworkOutput", back_populates="pipeline", cascade="all, delete-orphan")
    quality_assessments = relationship("DataQualityAssessment", back_populates="pipeline", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_pipeline_workspace', 'workspace_id'),
        Index('idx_pipeline_stage', 'current_stage', 'is_active'),
        Index('idx_pipeline_quality', 'quality_level', 'is_ml_ready'),
    )


class PreparationStep(Base):
    """
    Individual steps in the data preparation pipeline
    Tracks each transformation and its results
    """
    __tablename__ = "preparation_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("data_preparation_pipelines.id"))
    
    # Step details
    step_name = Column(String, nullable=False)
    step_type = Column(Enum(PreparationStage), nullable=False)
    step_order = Column(Integer, nullable=False)
    
    # Configuration
    step_config = Column(JSON, default=dict)
    input_schema = Column(JSON, default=dict)
    output_schema = Column(JSON, default=dict)
    
    # Results
    transformation_applied = Column(Text)
    records_processed = Column(Integer)
    records_modified = Column(Integer)
    execution_time_seconds = Column(Float)
    
    # Quality impact
    quality_improvement = Column(Float)  # Change in quality score
    issues_resolved = Column(JSON, default=list)
    
    # Status
    status = Column(String, default="pending")  # pending, running, completed, failed
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    pipeline = relationship("DataPreparationPipeline", back_populates="preparation_steps")
    
    # Indexes
    __table_args__ = (
        Index('idx_step_pipeline', 'pipeline_id', 'step_order'),
        Index('idx_step_type', 'step_type', 'status'),
    )


class DataQualityAssessment(Base):
    """
    Comprehensive data quality assessment results
    Tracks quality metrics throughout the preparation process
    """
    __tablename__ = "data_quality_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("data_preparation_pipelines.id"))
    
    # Assessment metadata
    assessment_stage = Column(Enum(PreparationStage), nullable=False)
    assessment_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Quality dimensions (0-1 scale)
    completeness_score = Column(Float)      # Missing values
    validity_score = Column(Float)          # Data type correctness
    consistency_score = Column(Float)       # Format consistency
    accuracy_score = Column(Float)          # Data accuracy
    uniqueness_score = Column(Float)        # Duplicate detection
    timeliness_score = Column(Float)        # Data freshness
    
    # Overall quality
    overall_quality_score = Column(Float)
    quality_level = Column(Enum(DataQualityLevel))
    
    # Detailed metrics
    quality_metrics = Column(JSON, default=dict)
    issues_detected = Column(JSON, default=list)
    recommendations = Column(JSON, default=list)
    
    # Data profiling results
    column_profiles = Column(JSON, default=dict)
    statistical_summary = Column(JSON, default=dict)
    correlation_matrix = Column(JSON, default=dict)
    
    # Relationships
    pipeline = relationship("DataPreparationPipeline", back_populates="quality_assessments")
    
    # Indexes
    __table_args__ = (
        Index('idx_quality_pipeline', 'pipeline_id', 'assessment_stage'),
        Index('idx_quality_score', 'overall_quality_score', 'quality_level'),
    )


class FrameworkOutput(Base):
    """
    ML framework-specific outputs and configurations
    Tracks exports to different ML frameworks
    """
    __tablename__ = "framework_outputs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("data_preparation_pipelines.id"))
    
    # Framework details
    framework_type = Column(Enum(MLFrameworkType), nullable=False)
    framework_version = Column(String)
    output_format = Column(String)  # dataset, dataloader, array, etc.
    
    # Output configuration
    export_config = Column(JSON, default=dict)
    train_test_split = Column(JSON, default=dict)  # Split configuration
    feature_columns = Column(ARRAY(String))
    target_column = Column(String)
    
    # Output paths and metadata
    output_path = Column(String)
    output_size_mb = Column(Float)
    output_schema = Column(JSON, default=dict)
    
    # Export metrics
    export_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    export_duration_seconds = Column(Float)
    records_exported = Column(Integer)
    
    # Validation results
    validation_passed = Column(Boolean, default=False)
    validation_metrics = Column(JSON, default=dict)
    
    # Status
    status = Column(String, default="pending")  # pending, exporting, completed, failed
    error_message = Column(Text)
    
    # Relationships
    pipeline = relationship("DataPreparationPipeline", back_populates="framework_outputs")
    
    # Indexes
    __table_args__ = (
        Index('idx_framework_pipeline', 'pipeline_id', 'framework_type'),
        Index('idx_framework_status', 'status', 'export_timestamp'),
    )


class AutoLabelingResult(Base):
    """
    Results from automated labeling and classification
    Tracks AI-generated labels and categories
    """
    __tablename__ = "auto_labeling_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("data_preparation_pipelines.id"))
    
    # Labeling details
    labeling_algorithm = Column(String)  # clustering, classification, etc.
    target_column = Column(String)
    confidence_threshold = Column(Float)
    
    # Results
    labels_generated = Column(JSON, default=list)
    categories_detected = Column(JSON, default=list)
    outliers_flagged = Column(JSON, default=list)
    
    # Quality metrics
    confidence_scores = Column(JSON, default=dict)
    accuracy_estimate = Column(Float)
    coverage_percentage = Column(Float)
    
    # Validation
    human_validation_required = Column(Boolean, default=False)
    validation_sample_size = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    pipeline = relationship("DataPreparationPipeline")
    
    # Indexes
    __table_args__ = (
        Index('idx_labeling_pipeline', 'pipeline_id'),
        Index('idx_labeling_confidence', 'confidence_threshold', 'accuracy_estimate'),
    )


# Update existing DataInvestigation model to include preparation pipeline
def enhance_data_investigation():
    """
    This function would be used to add the relationship to existing DataInvestigation model
    """
    # Add to DataInvestigation model:
    # preparation_pipeline = relationship("DataPreparationPipeline", back_populates="investigation", uselist=False)
    pass 