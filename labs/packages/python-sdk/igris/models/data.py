"""
Data processing models for Igris-engine SDK
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from enum import Enum

from .common import JobStatus, FileUpload


class DataFormat(str, Enum):
    """Supported data formats."""
    
    CSV = "csv"
    JSON = "json"
    XLSX = "xlsx"
    PARQUET = "parquet"
    AVRO = "avro"
    ORC = "orc"


class ProcessingMode(str, Enum):
    """Data processing modes."""
    
    BATCH = "batch"
    STREAMING = "streaming"
    REAL_TIME = "real_time"


class QualityLevel(str, Enum):
    """Data quality levels."""
    
    EXCELLENT = "excellent"  # 90-100%
    GOOD = "good"           # 75-89%
    FAIR = "fair"           # 60-74%
    POOR = "poor"           # Below 60%


@dataclass
class DataProcessingRequest:
    """Request for data processing operation."""
    
    source_path: Optional[str] = None
    source_url: Optional[str] = None
    data_format: DataFormat = DataFormat.CSV
    processing_mode: ProcessingMode = ProcessingMode.BATCH
    transformations: List[Dict[str, Any]] = field(default_factory=list)
    output_format: DataFormat = DataFormat.JSON
    options: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        return {
            "source_path": self.source_path,
            "source_url": self.source_url,
            "data_format": self.data_format.value,
            "processing_mode": self.processing_mode.value,
            "transformations": self.transformations,
            "output_format": self.output_format.value,
            "options": self.options
        }


@dataclass
class DataProcessingResult:
    """Result of data processing operation."""
    
    job_id: str
    status: JobStatus
    input_records: int = 0
    output_records: int = 0
    processing_time_seconds: float = 0.0
    output_path: Optional[str] = None
    output_url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    @property
    def success_rate(self) -> float:
        """Calculate processing success rate."""
        if self.input_records == 0:
            return 0.0
        return (self.output_records / self.input_records) * 100
    
    @property
    def records_per_second(self) -> float:
        """Calculate processing throughput."""
        if self.processing_time_seconds == 0:
            return 0.0
        return self.input_records / self.processing_time_seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "input_records": self.input_records,
            "output_records": self.output_records,
            "processing_time_seconds": self.processing_time_seconds,
            "output_path": self.output_path,
            "output_url": self.output_url,
            "metadata": self.metadata,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "success_rate": self.success_rate,
            "records_per_second": self.records_per_second
        }


@dataclass
class DataQualityMetric:
    """Individual data quality metric."""
    
    name: str
    score: float
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def quality_level(self) -> QualityLevel:
        """Get quality level based on score."""
        if self.score >= 90:
            return QualityLevel.EXCELLENT
        elif self.score >= 75:
            return QualityLevel.GOOD
        elif self.score >= 60:
            return QualityLevel.FAIR
        else:
            return QualityLevel.POOR


@dataclass
class DataQualityReport:
    """Comprehensive data quality assessment report."""
    
    overall_score: float
    total_records: int
    valid_records: int
    invalid_records: int
    metrics: List[DataQualityMetric] = field(default_factory=list)
    column_profiles: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    issues: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    generated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.generated_at is None:
            self.generated_at = datetime.now()
    
    @property
    def overall_quality_level(self) -> QualityLevel:
        """Get overall quality level."""
        if self.overall_score >= 90:
            return QualityLevel.EXCELLENT
        elif self.overall_score >= 75:
            return QualityLevel.GOOD
        elif self.overall_score >= 60:
            return QualityLevel.FAIR
        else:
            return QualityLevel.POOR
    
    @property
    def validity_rate(self) -> float:
        """Calculate data validity rate."""
        if self.total_records == 0:
            return 0.0
        return (self.valid_records / self.total_records) * 100
    
    def get_metric(self, name: str) -> Optional[DataQualityMetric]:
        """Get specific quality metric by name."""
        for metric in self.metrics:
            if metric.name == name:
                return metric
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "overall_score": self.overall_score,
            "overall_quality_level": self.overall_quality_level.value,
            "total_records": self.total_records,
            "valid_records": self.valid_records,
            "invalid_records": self.invalid_records,
            "validity_rate": self.validity_rate,
            "metrics": [
                {
                    "name": m.name,
                    "score": m.score,
                    "quality_level": m.quality_level.value,
                    "description": m.description,
                    "details": m.details
                }
                for m in self.metrics
            ],
            "column_profiles": self.column_profiles,
            "issues": self.issues,
            "recommendations": self.recommendations,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None
        }


@dataclass
class TransformationRule:
    """Data transformation rule."""
    
    name: str
    type: str  # e.g., "filter", "map", "aggregate", "join"
    parameters: Dict[str, Any] = field(default_factory=dict)
    condition: Optional[str] = None
    description: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "type": self.type,
            "parameters": self.parameters,
            "condition": self.condition,
            "description": self.description
        }


@dataclass
class DataPipeline:
    """Data processing pipeline configuration."""
    
    name: str
    description: Optional[str] = None
    source_config: Dict[str, Any] = field(default_factory=dict)
    transformations: List[TransformationRule] = field(default_factory=list)
    destination_config: Dict[str, Any] = field(default_factory=dict)
    schedule: Optional[str] = None  # Cron expression
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_transformation(self, transformation: TransformationRule):
        """Add transformation rule to pipeline."""
        self.transformations.append(transformation)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "source_config": self.source_config,
            "transformations": [t.to_dict() for t in self.transformations],
            "destination_config": self.destination_config,
            "schedule": self.schedule,
            "is_active": self.is_active,
            "metadata": self.metadata
        }