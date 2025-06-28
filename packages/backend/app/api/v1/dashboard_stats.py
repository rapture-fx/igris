"""
Dashboard Statistics API
========================

Provides real-time dashboard statistics and metrics for the Pollarbase platform.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
import uuid

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