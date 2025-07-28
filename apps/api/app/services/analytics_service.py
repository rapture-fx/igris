"""
Analytics Service
================

Comprehensive analytics service for tracking team productivity, time savings,
and data preparation insights across projects and users.

Key Features:
- Time saved calculations
- Team productivity metrics
- Cross-project analytics
- Data quality trends
- Cost optimization insights
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import pandas as pd

from app.database.connection import get_db
from app.database.ml_preparation_models import (
    DataPreparationPipeline, PreparationStep, DataQualityAssessment,
    PreparationStage, DataQualityLevel
)
from app.database.models import User, Workspace

logger = logging.getLogger(__name__)


@dataclass
class TimeSavingsMetrics:
    """Time savings metrics for data preparation"""
    total_pipelines: int
    automated_processing_hours: float
    estimated_manual_hours: float
    time_saved_hours: float
    time_saved_percentage: float
    average_quality_improvement: float
    cost_savings_estimate: float


@dataclass
class TeamProductivityMetrics:
    """Team productivity analytics"""
    team_member_count: int
    active_pipelines: int
    completed_pipelines: int
    average_pipeline_time: float
    quality_trend: str
    top_performers: List[Dict[str, Any]]
    bottlenecks: List[str]
    efficiency_score: float


@dataclass
class ProjectAnalytics:
    """Project-level analytics"""
    project_id: str
    project_name: str
    datasets_processed: int
    quality_improvements: Dict[str, float]
    framework_usage: Dict[str, int]
    time_savings: TimeSavingsMetrics
    success_rate: float


class AnalyticsService:
    """
    Analytics service for tracking data preparation productivity and insights
    """
    
    def __init__(self):
        # Time estimation constants based on industry benchmarks
        self.MANUAL_PROCESSING_RATES = {
            "data_profiling": 0.5,  # hours per 1000 records
            "data_cleaning": 1.0,   # hours per 1000 records
            "transformation": 0.8,  # hours per 1000 records
            "quality_validation": 0.3,  # hours per 1000 records
            "format_conversion": 0.2,  # hours per 1000 records
        }
        
        self.HOURLY_COST_ESTIMATE = 75  # Average data scientist hourly cost
    
    async def get_time_savings_metrics(
        self,
        workspace_id: Optional[str] = None,
        user_id: Optional[str] = None,
        date_range: Optional[Tuple[datetime, datetime]] = None
    ) -> TimeSavingsMetrics:
        """
        Calculate comprehensive time savings metrics
        """
        
        async with get_db_session() as db:
            # Build query
            query = select(DataPreparationPipeline)
            
            if workspace_id:
                query = query.where(DataPreparationPipeline.workspace_id == workspace_id)
            
            if user_id:
                query = query.where(DataPreparationPipeline.created_by_id == user_id)
            
            if date_range:
                start_date, end_date = date_range
                query = query.where(
                    and_(
                        DataPreparationPipeline.created_at >= start_date,
                        DataPreparationPipeline.created_at <= end_date
                    )
                )
            
            # Get completed pipelines
            query = query.where(DataPreparationPipeline.is_ml_ready == True)
            
            result = await db.execute(query)
            pipelines = result.scalars().all()
            
            if not pipelines:
                return TimeSavingsMetrics(0, 0, 0, 0, 0, 0, 0)
            
            # Calculate metrics
            total_pipelines = len(pipelines)
            automated_hours = sum(p.processing_time_seconds / 3600 for p in pipelines if p.processing_time_seconds)
            
            # Estimate manual processing time
            estimated_manual_hours = 0
            quality_scores = []
            
            for pipeline in pipelines:
                records = pipeline.total_records or 1000  # Default if missing
                record_thousands = records / 1000
                
                # Estimate manual time based on pipeline complexity
                manual_estimate = (
                    self.MANUAL_PROCESSING_RATES["data_profiling"] * record_thousands +
                    self.MANUAL_PROCESSING_RATES["data_cleaning"] * record_thousands +
                    self.MANUAL_PROCESSING_RATES["transformation"] * record_thousands +
                    self.MANUAL_PROCESSING_RATES["quality_validation"] * record_thousands +
                    self.MANUAL_PROCESSING_RATES["format_conversion"] * record_thousands
                )
                
                estimated_manual_hours += manual_estimate
                
                if pipeline.quality_score:
                    quality_scores.append(pipeline.quality_score)
            
            time_saved = max(0, estimated_manual_hours - automated_hours)
            time_saved_percentage = (time_saved / estimated_manual_hours * 100) if estimated_manual_hours > 0 else 0
            avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
            cost_savings = time_saved * self.HOURLY_COST_ESTIMATE
            
            return TimeSavingsMetrics(
                total_pipelines=total_pipelines,
                automated_processing_hours=automated_hours,
                estimated_manual_hours=estimated_manual_hours,
                time_saved_hours=time_saved,
                time_saved_percentage=time_saved_percentage,
                average_quality_improvement=avg_quality,
                cost_savings_estimate=cost_savings
            )
    
    async def get_team_productivity_metrics(
        self,
        workspace_id: str,
        date_range: Optional[Tuple[datetime, datetime]] = None
    ) -> TeamProductivityMetrics:
        """
        Get team productivity analytics for workspace
        """
        
        async with get_db_session() as db:
            # Get team members
            team_query = select(User).join(
                DataPreparationPipeline,
                User.id == DataPreparationPipeline.created_by_id
            ).where(DataPreparationPipeline.workspace_id == workspace_id)
            
            if date_range:
                start_date, end_date = date_range
                team_query = team_query.where(
                    and_(
                        DataPreparationPipeline.created_at >= start_date,
                        DataPreparationPipeline.created_at <= end_date
                    )
                )
            
            team_result = await db.execute(team_query.distinct())
            team_members = team_result.scalars().all()
            
            # Get pipeline metrics
            pipeline_query = select(DataPreparationPipeline).where(
                DataPreparationPipeline.workspace_id == workspace_id
            )
            
            if date_range:
                pipeline_query = pipeline_query.where(
                    and_(
                        DataPreparationPipeline.created_at >= start_date,
                        DataPreparationPipeline.created_at <= end_date
                    )
                )
            
            pipeline_result = await db.execute(pipeline_query)
            pipelines = pipeline_result.scalars().all()
            
            # Calculate metrics
            active_pipelines = len([p for p in pipelines if not p.is_ml_ready])
            completed_pipelines = len([p for p in pipelines if p.is_ml_ready])
            
            # Average pipeline time
            completed_times = [p.processing_time_seconds for p in pipelines if p.processing_time_seconds and p.is_ml_ready]
            avg_time = sum(completed_times) / len(completed_times) / 60 if completed_times else 0  # minutes
            
            # Quality trend
            quality_scores = [p.quality_score for p in pipelines if p.quality_score]
            quality_trend = "improving" if len(quality_scores) > 1 and quality_scores[-1] > quality_scores[0] else "stable"
            
            # Top performers
            user_performance = {}
            for pipeline in pipelines:
                if pipeline.is_ml_ready and pipeline.quality_score:
                    user_id = pipeline.created_by_id
                    if user_id not in user_performance:
                        user_performance[user_id] = {"pipelines": 0, "avg_quality": 0, "total_time": 0}
                    
                    user_performance[user_id]["pipelines"] += 1
                    user_performance[user_id]["avg_quality"] += pipeline.quality_score
                    if pipeline.processing_time_seconds:
                        user_performance[user_id]["total_time"] += pipeline.processing_time_seconds
            
            # Calculate averages and sort
            for user_id in user_performance:
                perf = user_performance[user_id]
                perf["avg_quality"] /= perf["pipelines"]
                perf["avg_time"] = perf["total_time"] / perf["pipelines"] if perf["pipelines"] > 0 else 0
            
            top_performers = sorted(
                user_performance.items(),
                key=lambda x: (x[1]["avg_quality"], -x[1]["avg_time"]),
                reverse=True
            )[:3]
            
            # Format top performers
            top_performer_list = []
            for user_id, perf in top_performers:
                user = next((u for u in team_members if str(u.id) == user_id), None)
                if user:
                    top_performer_list.append({
                        "user_id": user_id,
                        "username": user.username,
                        "pipelines_completed": perf["pipelines"],
                        "average_quality": perf["avg_quality"],
                        "average_time_minutes": perf["avg_time"] / 60
                    })
            
            # Identify bottlenecks
            bottlenecks = []
            if avg_time > 30:  # More than 30 minutes average
                bottlenecks.append("Long processing times")
            if active_pipelines > completed_pipelines * 0.5:
                bottlenecks.append("High number of incomplete pipelines")
            if len(quality_scores) > 0 and sum(quality_scores) / len(quality_scores) < 0.8:
                bottlenecks.append("Quality scores below target")
            
            # Efficiency score (0-100)
            efficiency_factors = []
            if avg_time > 0:
                efficiency_factors.append(min(100, 600 / avg_time))  # 10 minutes = 100%
            if quality_scores:
                efficiency_factors.append(sum(quality_scores) / len(quality_scores) * 100)
            if completed_pipelines > 0:
                completion_rate = completed_pipelines / (completed_pipelines + active_pipelines)
                efficiency_factors.append(completion_rate * 100)
            
            efficiency_score = sum(efficiency_factors) / len(efficiency_factors) if efficiency_factors else 0
            
            return TeamProductivityMetrics(
                team_member_count=len(team_members),
                active_pipelines=active_pipelines,
                completed_pipelines=completed_pipelines,
                average_pipeline_time=avg_time,
                quality_trend=quality_trend,
                top_performers=top_performer_list,
                bottlenecks=bottlenecks,
                efficiency_score=efficiency_score
            )
    
    async def get_project_analytics(
        self,
        workspace_id: str,
        date_range: Optional[Tuple[datetime, datetime]] = None
    ) -> ProjectAnalytics:
        """
        Get comprehensive project analytics
        """
        
        async with get_db_session() as db:
            # Get workspace info
            workspace = await db.get(Workspace, workspace_id)
            project_name = workspace.name if workspace else "Unknown Project"
            
            # Get time savings metrics
            time_savings = await self.get_time_savings_metrics(workspace_id, None, date_range)
            
            # Get pipeline data
            query = select(DataPreparationPipeline).where(
                DataPreparationPipeline.workspace_id == workspace_id
            )
            
            if date_range:
                start_date, end_date = date_range
                query = query.where(
                    and_(
                        DataPreparationPipeline.created_at >= start_date,
                        DataPreparationPipeline.created_at <= end_date
                    )
                )
            
            result = await db.execute(query)
            pipelines = result.scalars().all()
            
            # Quality improvements
            quality_improvements = {
                "average_initial_quality": 0.6,  # Estimated baseline
                "average_final_quality": sum(p.quality_score for p in pipelines if p.quality_score) / len([p for p in pipelines if p.quality_score]) if pipelines else 0,
                "improvement_percentage": 0
            }
            
            if quality_improvements["average_final_quality"] > 0:
                quality_improvements["improvement_percentage"] = (
                    (quality_improvements["average_final_quality"] - quality_improvements["average_initial_quality"]) 
                    / quality_improvements["average_initial_quality"] * 100
                )
            
            # Framework usage
            framework_usage = {}
            for pipeline in pipelines:
                for framework in pipeline.target_frameworks or []:
                    framework_usage[framework] = framework_usage.get(framework, 0) + 1
            
            # Success rate
            completed_pipelines = len([p for p in pipelines if p.is_ml_ready])
            success_rate = completed_pipelines / len(pipelines) * 100 if pipelines else 0
            
            return ProjectAnalytics(
                project_id=workspace_id,
                project_name=project_name,
                datasets_processed=len(pipelines),
                quality_improvements=quality_improvements,
                framework_usage=framework_usage,
                time_savings=time_savings,
                success_rate=success_rate
            )
    
    async def get_dashboard_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get dashboard summary for team leads
        """
        
        async with get_db_session() as db:
            # Get user's workspaces
            user = await db.get(User, user_id)
            if not user:
                return {}
            
            # Get recent pipelines (last 30 days)
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            date_range = (thirty_days_ago, datetime.utcnow())
            
            # Overall time savings
            time_savings = await self.get_time_savings_metrics(None, user_id, date_range)
            
            # Recent activity
            recent_query = select(DataPreparationPipeline).where(
                and_(
                    DataPreparationPipeline.created_by_id == user_id,
                    DataPreparationPipeline.created_at >= thirty_days_ago
                )
            ).order_by(DataPreparationPipeline.created_at.desc()).limit(5)
            
            recent_result = await db.execute(recent_query)
            recent_pipelines = recent_result.scalars().all()
            
            return {
                "time_savings": {
                    "hours_saved": time_savings.time_saved_hours,
                    "percentage_saved": time_savings.time_saved_percentage,
                    "cost_savings": time_savings.cost_savings_estimate,
                    "pipelines_completed": time_savings.total_pipelines
                },
                "recent_activity": [
                    {
                        "pipeline_id": str(p.id),
                        "name": p.name,
                        "quality_score": p.quality_score,
                        "is_completed": p.is_ml_ready,
                        "created_at": p.created_at.isoformat()
                    }
                    for p in recent_pipelines
                ],
                "quality_trend": time_savings.average_quality_improvement,
                "active_pipelines": len([p for p in recent_pipelines if not p.is_ml_ready])
            }


# Global instance
analytics_service = AnalyticsService() 