"""
ML Model Monitoring Dashboard API

Provides endpoints for the ML performance monitoring dashboard with real-time metrics,
alerts, and comprehensive model health insights.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timezone, timedelta

from app.database.connection import get_async_session
from app.auth.unified_auth_system import get_current_user
from app.core.error_decorators import handle_database_errors, handle_auth_errors
from app.services.monitoring.ml_performance_monitor import ml_performance_monitor

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models for API responses
class ModelHealthResponse(BaseModel):
    model_id: str
    status: str
    overall_score: float
    performance_score: float
    drift_score: float
    data_quality_score: float
    last_updated: str
    active_alerts_count: int
    recommendations: List[str]

class DashboardOverview(BaseModel):
    timestamp: str
    time_range: str
    total_models: int
    healthy_models: int
    models_with_alerts: int
    total_predictions: int
    average_latency: float
    system_status: str

class AlertSummary(BaseModel):
    active_alerts: int
    critical_alerts: int
    recent_alerts: List[Dict[str, Any]]

class PerformanceTrend(BaseModel):
    model_id: str
    metric_name: str
    timestamps: List[str]
    values: List[float]
    trend_direction: str  # "improving", "stable", "degrading"

class DriftDetectionResult(BaseModel):
    model_id: str
    timestamp: str
    overall_drift_score: float
    drift_detected: bool
    alerts_count: int
    feature_drift_results: Dict[str, Any]
    recommendations: List[str]

@router.get("/dashboard/overview", response_model=Dict[str, Any])
@handle_auth_errors
async def get_dashboard_overview(
    time_range: str = Query("24h", regex="^(1h|6h|24h|7d|30d)$"),
    model_ids: Optional[str] = Query(None, description="Comma-separated model IDs"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get comprehensive dashboard overview with system metrics and model health
    """
    try:
        # Parse model IDs if provided
        model_id_list = None
        if model_ids:
            model_id_list = [mid.strip() for mid in model_ids.split(",")]

        # Get dashboard data from monitoring service
        dashboard_data = await ml_performance_monitor.create_performance_dashboard_data(
            model_ids=model_id_list,
            time_range=time_range
        )

        if "error" in dashboard_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=dashboard_data["error"]
            )

        return {
            "success": True,
            "data": dashboard_data,
            "time_range": time_range,
            "user_id": str(current_user.id)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dashboard overview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard overview"
        )

@router.get("/models/{model_id}/health", response_model=ModelHealthResponse)
@handle_auth_errors
async def get_model_health(
    model_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get detailed health information for a specific model
    """
    try:
        health_summary = await ml_performance_monitor.get_model_health_summary(model_id)

        if not health_summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model {model_id} not found or no health data available"
            )

        return ModelHealthResponse(
            model_id=health_summary.model_id,
            status=health_summary.status.value,
            overall_score=health_summary.overall_score,
            performance_score=health_summary.performance_score,
            drift_score=health_summary.drift_score,
            data_quality_score=health_summary.data_quality_score,
            last_updated=health_summary.last_updated.isoformat(),
            active_alerts_count=len(health_summary.active_alerts),
            recommendations=health_summary.recommendations
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting model health for {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve health data for model {model_id}"
        )

@router.post("/models/{model_id}/drift-detection", response_model=DriftDetectionResult)
@handle_auth_errors
async def trigger_drift_detection(
    model_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Trigger drift detection analysis for a specific model
    """
    try:
        import pandas as pd
        import numpy as np

        # Mock data for demonstration
        new_data = pd.DataFrame({
            'feature_1': np.random.normal(0, 1, 1000),
            'feature_2': np.random.normal(2, 0.5, 1000),
            'feature_3': np.random.choice(['A', 'B', 'C'], 1000, p=[0.4, 0.4, 0.2])
        })

        # Perform drift detection
        drift_result = await ml_performance_monitor.detect_data_drift(
            model_id=model_id,
            new_data=new_data
        )

        if "error" in drift_result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=drift_result["error"]
            )

        return DriftDetectionResult(
            model_id=drift_result["model_id"],
            timestamp=drift_result["timestamp"],
            overall_drift_score=drift_result["overall_drift_score"],
            drift_detected=drift_result["drift_detected"],
            alerts_count=drift_result["alerts_count"],
            feature_drift_results=drift_result["feature_drift_results"],
            recommendations=drift_result["recommendations"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in drift detection for {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform drift detection for model {model_id}"
        )

@router.get("/models/{model_id}/performance-trends", response_model=List[PerformanceTrend])
@handle_auth_errors
async def get_performance_trends(
    model_id: str,
    time_range: str = Query("7d", regex="^(1h|6h|24h|7d|30d)$"),
    metrics: Optional[str] = Query("accuracy,f1_score,precision,recall", description="Comma-separated metric names"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get performance trends for a specific model over time
    """
    try:
        # Parse requested metrics
        metric_names = [m.strip() for m in metrics.split(",")]
        trends = []

        # Mock implementation - in production, fetch from database
        import numpy as np

        for metric_name in metric_names:
            timestamps = []
            values = []

            current_time = datetime.now(timezone.utc)
            time_delta = timedelta(hours=24) if time_range == "24h" else timedelta(days=7)

            for i in range(20):
                timestamp = current_time - time_delta + (time_delta * i / 19)
                timestamps.append(timestamp.isoformat())

                base_value = 0.8 if metric_name == "accuracy" else 0.75
                noise = np.random.normal(0, 0.02)
                trend_value = max(0, min(1, base_value + noise))
                values.append(float(trend_value))

            # Determine trend direction
            trend_direction = "stable"
            if len(values) >= 2:
                recent_avg = np.mean(values[-5:])
                earlier_avg = np.mean(values[:5])

                if recent_avg > earlier_avg + 0.02:
                    trend_direction = "improving"
                elif recent_avg < earlier_avg - 0.02:
                    trend_direction = "degrading"

            trends.append(PerformanceTrend(
                model_id=model_id,
                metric_name=metric_name,
                timestamps=timestamps,
                values=values,
                trend_direction=trend_direction
            ))

        return trends

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting performance trends for {model_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve performance trends for model {model_id}"
        )