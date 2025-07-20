import uuid
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.database.models import JobStatus, DataSourceType # Assuming enums are accessible here

class DataInvestigationBase(BaseModel):
    name: str
    description: Optional[str] = None
    data_source_type: Optional[DataSourceType] = None
    data_source_config: Optional[Dict[str, Any]] = {}
    analysis_config: Optional[Dict[str, Any]] = {}
    original_file_path: Optional[str] = None

class DataInvestigationCreate(DataInvestigationBase):
    workspace_id: uuid.UUID

class DataInvestigationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    data_source_type: Optional[DataSourceType] = None
    data_source_config: Optional[Dict[str, Any]] = None
    analysis_config: Optional[Dict[str, Any]] = None
    status: Optional[JobStatus] = None # Allow status updates, e.g., to cancel

class DataInvestigationInDBBase(DataInvestigationBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_by_id: uuid.UUID
    
    schema_info: Optional[Dict[str, Any]] = {}
    processed_file_path: Optional[str] = None
    quality_score: Optional[float] = None
    anomalies_detected: Optional[List[Any]] = []
    patterns_found: Optional[List[Any]] = []
    recommendations: Optional[List[Any]] = []
    
    status: JobStatus = JobStatus.PENDING
    progress_percentage: Optional[float] = 0.0
    error_message: Optional[str] = None
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DataInvestigation(DataInvestigationInDBBase):
    pass # For now, same as InDBBase, can be extended later

# --- ProcessingJob Schemas ---

class ProcessingJobBase(BaseModel):
    job_type: str
    config: Optional[Dict[str, Any]] = {}

class ProcessingJobCreate(ProcessingJobBase):
    investigation_id: uuid.UUID

class ProcessingJobUpdate(BaseModel):
    config: Optional[Dict[str, Any]] = None
    status: Optional[JobStatus] = None
    progress_percentage: Optional[float] = None
    output_summary: Optional[Dict[str, Any]] = None
    output_artifact_path: Optional[str] = None
    error_message: Optional[str] = None

class ProcessingJobInDBBase(ProcessingJobBase):
    id: uuid.UUID
    investigation_id: uuid.UUID
    
    status: JobStatus = JobStatus.PENDING
    progress_percentage: Optional[float] = 0.0
    output_summary: Optional[Dict[str, Any]] = {}
    output_artifact_path: Optional[str] = None
    error_message: Optional[str] = None
    
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProcessingJob(ProcessingJobInDBBase):
    pass # For now, same as InDBBase 