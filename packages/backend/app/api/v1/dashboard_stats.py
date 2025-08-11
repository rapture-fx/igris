"""
Dashboard Statistics API
========================

Provides real-time dashboard statistics and metrics for the Schlep-engine platform.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
import uuid
import random

from app.database.connection import get_db
from app.database.models import User, DataInvestigation, ProcessingJob, JobStatus
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# ==================== RESPONSE MODELS ====================

class DashboardStats(BaseModel):
    data_sources: int
    total_records: int
    quality_score: float
    active_jobs: int
    completed_jobs: int
    failed_jobs: int
    storage_used_mb: float
    processing_time_saved_hours: float

class DatasetStats(BaseModel):
    in_progress: int
    completed: int
    failed: int
    drafts: int

class Dataset(BaseModel):
    id: str
    name: str
    status: str
    source_type: str
    created_at: datetime
    rows: int
    quality_score: int  # as a percentage

class Pipeline(BaseModel):
    id: str
    name: str
    description: str
    sourceType: str
    destinationType: str
    status: str
    lastRun: datetime
    runCount: int
    successCount: int
    errorCount: int

class Model(BaseModel):
    id: str
    name: str
    version: str
    description: str
    status: str
    accuracy: float
    lastTrained: str
    tags: List[str]

class LabelingRule(BaseModel):
    id: str
    name: str
    description: str
    label: str
    criteria: str
    isActive: bool
    coverage: float
    createdAt: str

class RecentActivity(BaseModel):
    id: str
    type: str
    title: str
    description: str
    status: str
    timestamp: datetime
    user_email: Optional[str]

class DataQualityMetrics(BaseModel):
    overall_score: float
    investigations_count: int
    issues_count: int
    excellent_count: int  # 90-100%
    good_count: int       # 80-89%
    fair_count: int       # 70-79%
    poor_count: int       # <70%
    trend_direction: str  # 'up', 'down', 'stable'

class ProcessingJobStats(BaseModel):
    job_id: str
    investigation_name: str
    status: str
    progress_percentage: float
    started_at: datetime
    estimated_completion: Optional[datetime]

# ==================== TEAM MANAGEMENT ENDPOINTS ====================

class TeamMemberCreate(BaseModel):
    email: str
    role: str

class TeamMember(BaseModel):
    id: str
    email: str
    role: str
    status: str
    last_active: str

class InviteRequest(BaseModel):
    email: str
    role: str

# Simple in-memory store for demonstration purposes (replace with DB integration)
mock_team_members: List[dict] = [
    {
        "id": "1",
        "email": "admin@example.com",
        "role": "admin",
        "status": "active",
        "last_active": datetime.utcnow().isoformat()
    },
    {
        "id": "2",
        "email": "user@example.com",
        "role": "member",
        "status": "active",
        "last_active": datetime.utcnow().isoformat()
    }
]

@router.get("/team", response_model=List[TeamMember])
async def get_team_members():
    """Return the list of team members (mock implementation)."""
    return mock_team_members

@router.post("/team/invite")
async def invite_team_member(request: InviteRequest):
    """Invite a new team member (mock implementation)."""
    new_member = {
        "id": str(uuid.uuid4()),
        "email": request.email,
        "role": request.role,
        "status": "pending",
        "last_active": datetime.utcnow().isoformat()
    }
    mock_team_members.append(new_member)
    return {"message": "Invitation sent successfully", "member": new_member}

@router.delete("/team/{member_id}")
async def remove_team_member(member_id: str):
    """Remove a team member (mock implementation)."""
    global mock_team_members
    mock_team_members = [m for m in mock_team_members if m["id"] != member_id]
    return {"message": "Team member removed successfully"}

# ==================== DASHBOARD ENDPOINTS ====================

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive dashboard statistics"""
    try:
        # Get total data sources (investigations)
        data_sources_result = await db.execute(
            select(func.count(DataInvestigation.id))
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        data_sources = data_sources_result.scalar() or 0

        # Get total records processed (sum from all investigations)
        total_records_result = await db.execute(
            select(func.coalesce(func.sum(DataInvestigation.total_records), 0))
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        total_records = total_records_result.scalar() or 0

        # Calculate average quality score
        quality_result = await db.execute(
            select(func.avg(DataInvestigation.quality_score))
            .where(
                and_(
                    DataInvestigation.created_by_id == current_user.id,
                    DataInvestigation.quality_score.is_not(None)
                )
            )
        )
        avg_quality = quality_result.scalar() or 0.0
        quality_score = float(avg_quality * 100) if avg_quality else 0.0

        # Get job counts
        active_jobs_result = await db.execute(
            select(func.count(DataInvestigation.id))
            .where(
                and_(
                    DataInvestigation.created_by_id == current_user.id,
                    DataInvestigation.status.in_([JobStatus.PROCESSING, JobStatus.PENDING])
                )
            )
        )
        active_jobs = active_jobs_result.scalar() or 0

        completed_jobs_result = await db.execute(
            select(func.count(DataInvestigation.id))
            .where(
                and_(
                    DataInvestigation.created_by_id == current_user.id,
                    DataInvestigation.status == JobStatus.COMPLETED
                )
            )
        )
        completed_jobs = completed_jobs_result.scalar() or 0

        failed_jobs_result = await db.execute(
            select(func.count(DataInvestigation.id))
            .where(
                and_(
                    DataInvestigation.created_by_id == current_user.id,
                    DataInvestigation.status == JobStatus.FAILED
                )
            )
        )
        failed_jobs = failed_jobs_result.scalar() or 0

        # Calculate storage used (approximate)
        storage_result = await db.execute(
            select(func.coalesce(func.sum(DataInvestigation.file_size_bytes), 0))
            .where(DataInvestigation.created_by_id == current_user.id)
        )
        storage_bytes = storage_result.scalar() or 0
        storage_used_mb = float(storage_bytes / (1024 * 1024))

        # Estimate processing time saved (rough calculation)
        processing_time_saved_hours = float(data_sources * 2.5)  # Assume 2.5 hours saved per dataset

        return DashboardStats(
            data_sources=data_sources,
            total_records=total_records,
            quality_score=quality_score,
            active_jobs=active_jobs,
            completed_jobs=completed_jobs,
            failed_jobs=failed_jobs,
            storage_used_mb=storage_used_mb,
            processing_time_saved_hours=processing_time_saved_hours
        )

    except Exception as e:
        logger.error(f"Failed to get dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard statistics"
        )

@router.get("/datasets/stats", response_model=DatasetStats)
async def get_dataset_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get statistics about dataset statuses for the sidebar."""
    try:
        # This query groups investigations by status and counts them.
        # It's more efficient than running separate queries for each status.
        result = await db.execute(
            select(
                DataInvestigation.status,
                func.count(DataInvestigation.id)
            )
            .where(DataInvestigation.created_by_id == current_user.id)
            .group_by(DataInvestigation.status)
        )
        
        stats = result.all()
        
        # Initialize stats with zeros
        dataset_stats = {
            "in_progress": 0,
            "completed": 0,
            "failed": 0,
            "drafts": 0  # Assuming 'draft' is a status, otherwise it remains 0
        }
        
        # Populate stats from the query result
        for status, count in stats:
            if status in [JobStatus.PENDING, JobStatus.PROCESSING]:
                dataset_stats["in_progress"] += count
            elif status == JobStatus.COMPLETED:
                dataset_stats["completed"] = count
            elif status == JobStatus.FAILED:
                dataset_stats["failed"] = count
            # Add other status mappings here if they exist, e.g., for 'drafts'
            
        return DatasetStats(**dataset_stats)

    except Exception as e:
        logger.error(f"Failed to get dataset stats: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch dataset statistics")

@router.get("/datasets", response_model=List[Dataset])
async def get_datasets_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return a list of datasets (mock implementation)."""
    # In a real implementation, this would query the DataInvestigation table
    # and format the results. For now, we return mock data.
    
    # We can add some randomness to the mock data to make it feel more dynamic
    mock_datasets: List[dict] = [
        {
            "id": str(uuid.uuid4()),
            "name": "Q4 Customer Analytics",
            "status": "Completed",
            "source_type": "Snowflake",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 5)),
            "rows": random.randint(10000, 20000),
            "quality_score": random.randint(90, 99),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "User Upload - Raw Logs",
            "status": "In Progress",
            "source_type": "File Upload",
            "created_at": datetime.utcnow() - timedelta(hours=random.randint(1, 5)),
            "rows": random.randint(5000, 10000),
            "quality_score": random.randint(65, 80),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Marketing Campaign Results",
            "status": "Failed",
            "source_type": "PostgreSQL",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 3)),
            "rows": random.randint(1000, 5000),
            "quality_score": random.randint(30, 50),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Website Traffic Analysis",
            "status": "Draft",
            "source_type": "API",
            "created_at": datetime.utcnow() - timedelta(minutes=random.randint(10, 60)),
            "rows": 0,
            "quality_score": 0,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Archived Sales Data 2022",
            "status": "Completed",
            "source_type": "S3 Bucket",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(80, 120)),
            "rows": random.randint(1000000, 1500000),
            "quality_score": random.randint(85, 95),
        },
    ]
    return mock_datasets

@router.get("/pipelines", response_model=List[Pipeline])
async def get_pipelines_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return a list of pipelines (mock implementation)."""
    mock_pipelines: List[dict] = [
        {
            "id": "pl_1",
            "name": "User Data ETL",
            "description": "Extracts user data from production DB and loads to warehouse.",
            "sourceType": "PostgreSQL",
            "destinationType": "BigQuery",
            "status": "active",
            "lastRun": datetime.utcnow() - timedelta(hours=2),
            "runCount": 152,
            "successCount": 151,
            "errorCount": 1,
        },
        {
            "id": "pl_2",
            "name": "Salesforce Sync",
            "description": "Syncs customer data with Salesforce.",
            "sourceType": "API",
            "destinationType": "Salesforce",
            "status": "inactive",
            "lastRun": datetime.utcnow() - timedelta(days=1),
            "runCount": 50,
            "successCount": 50,
            "errorCount": 0,
        },
        {
            "id": "pl_3",
            "name": "Billing Data Processor",
            "description": "Processes monthly billing data and generates reports.",
            "sourceType": "S3",
            "destinationType": "Redshift",
            "status": "error",
            "lastRun": datetime.utcnow() - timedelta(minutes=30),
            "runCount": 5,
            "successCount": 4,
            "errorCount": 1,
        },
    ]
    return mock_pipelines

@router.get("/models", response_model=List[Model])
async def get_models_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return a list of models (mock implementation)."""
    mock_models: List[dict] = [
        {
            "id": "mdl_1",
            "name": "Customer Churn Predictor",
            "version": "2.1.0",
            "description": "Predicts customer churn based on usage patterns.",
            "status": "deployed",
            "accuracy": 0.92,
            "lastTrained": (datetime.utcnow() - timedelta(days=70)).isoformat(),
            "tags": ["Classification", "Churn", "Production"],
        },
        {
            "id": "mdl_2",
            "name": "Sentiment Analysis",
            "version": "1.0.0",
            "description": "Analyzes sentiment of user feedback.",
            "status": "deployed",
            "accuracy": 0.88,
            "lastTrained": (datetime.utcnow() - timedelta(days=90)).isoformat(),
            "tags": ["NLP", "Sentiment"],
        },
        {
            "id": "mdl_3",
            "name": "Fraud Detection",
            "version": "3.0.0-beta",
            "description": "Detects fraudulent transactions in real-time.",
            "status": "training",
            "accuracy": 0.95,
            "lastTrained": datetime.utcnow().isoformat(),
            "tags": ["Fraud", "Real-time", "Finance"],
        },
        {
            "id": "mdl_4",
            "name": "Legacy Demand Forecaster",
            "version": "0.8.7",
            "description": "Old model for forecasting product demand.",
            "status": "archived",
            "accuracy": 0.76,
            "lastTrained": (datetime.utcnow() - timedelta(days=500)).isoformat(),
            "tags": ["Forecasting", "Legacy"],
        },
    ]
    return mock_models

@router.get("/rules", response_model=List[LabelingRule])
async def get_rules_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return a list of labeling rules (mock implementation)."""
    mock_rules: List[dict] = [
        {
            "id": "rule_1",
            "name": "Identify Urgent Tickets",
            "description": 'Marks tickets containing keywords like "urgent" or "asap".',
            "label": "Urgent",
            "criteria": 'body CONTAINS "urgent" OR body CONTAINS "asap"',
            "isActive": True,
            "coverage": 0.15,
            "createdAt": (datetime.utcnow() - timedelta(days=200)).isoformat(),
        },
        {
            "id": "rule_2",
            "name": "Flag Spam Emails",
            "description": "Flags emails from known spam domains.",
            "label": "Spam",
            "criteria": 'sender_domain IN ["spammer.com", "bad-actor.net"]',
            "isActive": True,
            "coverage": 0.98,
            "createdAt": (datetime.utcnow() - timedelta(days=300)).isoformat(),
        },
        {
            "id": "rule_3",
            "name": "Categorize Feature Requests",
            "description": "Identifies feedback that is a feature request.",
            "label": "Feature Request",
            "criteria": 'title CONTAINS "feature" OR title CONTAINS "idea"',
            "isActive": False,
            "coverage": 0.45,
            "createdAt": (datetime.utcnow() - timedelta(days=150)).isoformat(),
        },
    ]
    return mock_rules

@router.get("/activity", response_model=List[RecentActivity])
async def get_recent_activity(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get recent activity for the user"""
    try:
        # Get recent investigations and their status changes
        result = await db.execute(
            select(DataInvestigation)
            .where(DataInvestigation.created_by_id == current_user.id)
            .order_by(DataInvestigation.updated_at.desc())
            .limit(limit)
        )
        investigations = result.scalars().all()

        activities = []
        for inv in investigations:
            activity_type = "file_upload"
            title = f"Data Analysis: {inv.name}"
            
            if inv.status == JobStatus.COMPLETED:
                activity_type = "data_analysis"
                title = f"Completed: {inv.name}"
                description = f"Quality score: {int(inv.quality_score * 100)}%" if inv.quality_score else "Analysis completed"
            elif inv.status == JobStatus.PROCESSING:
                activity_type = "ai_processing"
                title = f"Processing: {inv.name}"
                description = f"Progress: {int(inv.progress_percentage)}%"
            elif inv.status == JobStatus.FAILED:
                activity_type = "error"
                title = f"Failed: {inv.name}"
                description = "Processing failed - check logs"
            else:
                description = f"Uploaded {inv.data_source_config.get('filename', 'file')} for analysis"

            activities.append(RecentActivity(
                id=str(inv.id),
                type=activity_type,
                title=title,
                description=description,
                status=inv.status.value,
                timestamp=inv.updated_at,
                user_email=current_user.email
            ))

        return activities

    except Exception as e:
        logger.error(f"Failed to get recent activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recent activity"
        )

@router.get("/data-quality", response_model=DataQualityMetrics)
async def get_data_quality_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get data quality metrics and distribution"""
    try:
        # Get all investigations with quality scores
        result = await db.execute(
            select(DataInvestigation.quality_score)
            .where(
                and_(
                    DataInvestigation.created_by_id == current_user.id,
                    DataInvestigation.quality_score.is_not(None)
                )
            )
        )
        quality_scores = [float(score) * 100 for score in result.scalars().all()]

        investigations_count = len(quality_scores)
        
        if investigations_count == 0:
            return DataQualityMetrics(
                overall_score=0.0,
                investigations_count=0,
                issues_count=0,
                excellent_count=0,
                good_count=0,
                fair_count=0,
                poor_count=0,
                trend_direction='stable'
            )

        # Calculate overall score
        overall_score = sum(quality_scores) / len(quality_scores)

        # Count quality distribution
        excellent_count = len([s for s in quality_scores if s >= 90])
        good_count = len([s for s in quality_scores if 80 <= s < 90])
        fair_count = len([s for s in quality_scores if 70 <= s < 80])
        poor_count = len([s for s in quality_scores if s < 70])

        # Issues count (fair + poor)
        issues_count = fair_count + poor_count

        # Simple trend calculation (could be improved with historical data)
        trend_direction = 'stable'
        if overall_score >= 85:
            trend_direction = 'up'
        elif overall_score < 75:
            trend_direction = 'down'

        return DataQualityMetrics(
            overall_score=overall_score,
            investigations_count=investigations_count,
            issues_count=issues_count,
            excellent_count=excellent_count,
            good_count=good_count,
            fair_count=fair_count,
            poor_count=poor_count,
            trend_direction=trend_direction
        )

    except Exception as e:
        logger.error(f"Failed to get data quality metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve data quality metrics"
        )

@router.get("/active-jobs", response_model=List[ProcessingJobStats])
async def get_active_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get currently active processing jobs"""
    try:
        result = await db.execute(
            select(DataInvestigation)
            .where(
                and_(
                    DataInvestigation.created_by_id == current_user.id,
                    DataInvestigation.status.in_([JobStatus.PROCESSING, JobStatus.PENDING])
                )
            )
            .order_by(DataInvestigation.created_at.desc())
        )
        active_investigations = result.scalars().all()

        jobs = []
        for inv in active_investigations:
            # Estimate completion time based on progress
            estimated_completion = None
            if inv.progress_percentage > 0 and inv.status == JobStatus.PROCESSING:
                time_elapsed = datetime.utcnow() - inv.updated_at
                time_remaining = time_elapsed * ((100 - inv.progress_percentage) / inv.progress_percentage)
                estimated_completion = datetime.utcnow() + time_remaining

            jobs.append(ProcessingJobStats(
                job_id=str(inv.id),
                investigation_name=inv.name,
                status=inv.status.value,
                progress_percentage=inv.progress_percentage,
                started_at=inv.created_at,
                estimated_completion=estimated_completion
            ))

        return jobs

    except Exception as e:
        logger.error(f"Failed to get active jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active jobs"
        ) 