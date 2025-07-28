"""
Analytics and Monitoring API
============================

API endpoints for analytics, monitoring, and webhook management.
Addresses user stories for team leads tracking time savings and DevOps monitoring.

Key Features:
- Time savings analytics for team leads
- System health monitoring for DevOps
- Webhook configuration for integrators
- Performance metrics and alerts
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from uuid import uuid4

from app.database.connection import get_db
from app.database.models import User, Workspace
from app.auth.dependencies import get_current_user
from app.services.analytics_service import analytics_service, TimeSavingsMetrics, TeamProductivityMetrics
from app.services.system_monitoring import system_monitoring, HealthStatus
from app.services.webhook_service import (
    webhook_service, WebhookConfiguration, WebhookEventType
)

router = APIRouter(prefix="/analytics", tags=["Analytics & Monitoring"])

# ==================== REQUEST/RESPONSE MODELS ====================

class TimeSavingsResponse(BaseModel):
    total_pipelines: int
    automated_processing_hours: float
    estimated_manual_hours: float
    time_saved_hours: float
    time_saved_percentage: float
    average_quality_improvement: float
    cost_savings_estimate: float


class TeamProductivityResponse(BaseModel):
    team_member_count: int
    active_pipelines: int
    completed_pipelines: int
    average_pipeline_time: float
    quality_trend: str
    top_performers: List[Dict[str, Any]]
    bottlenecks: List[str]
    efficiency_score: float


class SystemStatusResponse(BaseModel):
    overall_status: str
    timestamp: str
    system_metrics: Dict[str, Any]
    job_metrics: Dict[str, Any]
    database_metrics: Dict[str, Any]
    application_metrics: Dict[str, Any]
    health_checks: List[Dict[str, Any]]
    alerts: Dict[str, int]


class WebhookConfigRequest(BaseModel):
    url: str
    secret: Optional[str] = None
    events: List[str]
    workspace_id: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    retry_attempts: int = Field(default=3, ge=1, le=10)
    timeout_seconds: int = Field(default=30, ge=5, le=300)


class WebhookConfigResponse(BaseModel):
    webhook_id: str
    url: str
    events: List[str]
    active: bool
    workspace_id: Optional[str]
    created_at: str


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/time-savings", response_model=TimeSavingsResponse)
async def get_time_savings(
    workspace_id: Optional[str] = None,
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📊 GET TIME SAVINGS ANALYTICS
    
    Track time saved across projects for team leads.
    Shows automation benefits and productivity improvements.
    """
    
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        date_range = (start_date, end_date)
        
        # Get time savings metrics
        metrics = await analytics_service.get_time_savings_metrics(
            workspace_id=workspace_id,
            user_id=str(current_user.id),
            date_range=date_range
        )
        
        return TimeSavingsResponse(
            total_pipelines=metrics.total_pipelines,
            automated_processing_hours=metrics.automated_processing_hours,
            estimated_manual_hours=metrics.estimated_manual_hours,
            time_saved_hours=metrics.time_saved_hours,
            time_saved_percentage=metrics.time_saved_percentage,
            average_quality_improvement=metrics.average_quality_improvement,
            cost_savings_estimate=metrics.cost_savings_estimate
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get time savings analytics: {str(e)}"
        )


@router.get("/team-productivity", response_model=TeamProductivityResponse)
async def get_team_productivity(
    workspace_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    👥 GET TEAM PRODUCTIVITY METRICS
    
    Track team performance and identify bottlenecks.
    Helps team leads optimize workflows and resource allocation.
    """
    
    try:
        # Verify workspace access
        workspace = await db.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        date_range = (start_date, end_date)
        
        # Get team productivity metrics
        metrics = await analytics_service.get_team_productivity_metrics(
            workspace_id=workspace_id,
            date_range=date_range
        )
        
        return TeamProductivityResponse(
            team_member_count=metrics.team_member_count,
            active_pipelines=metrics.active_pipelines,
            completed_pipelines=metrics.completed_pipelines,
            average_pipeline_time=metrics.average_pipeline_time,
            quality_trend=metrics.quality_trend,
            top_performers=metrics.top_performers,
            bottlenecks=metrics.bottlenecks,
            efficiency_score=metrics.efficiency_score
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get team productivity metrics: {str(e)}"
        )


@router.get("/dashboard-summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📈 GET DASHBOARD SUMMARY
    
    Get comprehensive dashboard summary for team leads.
    Includes time savings, recent activity, and key metrics.
    """
    
    try:
        summary = await analytics_service.get_dashboard_summary(str(current_user.id))
        return summary
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard summary: {str(e)}"
        )


# ==================== SYSTEM MONITORING ENDPOINTS ====================

@router.get("/system-status", response_model=SystemStatusResponse)
async def get_system_status(
    current_user: User = Depends(get_current_user)
):
    """
    🔧 GET SYSTEM STATUS
    
    Comprehensive system health monitoring for DevOps engineers.
    Includes resource usage, job queues, and health checks.
    """
    
    try:
        # Check if user has admin privileges (simplified check)
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required for system monitoring"
            )
        
        status_data = await system_monitoring.get_comprehensive_status()
        
        return SystemStatusResponse(
            overall_status=status_data["overall_status"],
            timestamp=status_data["timestamp"],
            system_metrics=status_data["system_metrics"],
            job_metrics=status_data["job_metrics"],
            database_metrics=status_data["database_metrics"],
            application_metrics=status_data["application_metrics"],
            health_checks=status_data["health_checks"],
            alerts=status_data["alerts"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system status: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """
    ❤️ BASIC HEALTH CHECK
    
    Simple health check endpoint for load balancers and monitoring.
    """
    
    try:
        health_checks = await system_monitoring.perform_health_checks()
        
        # Check if any critical issues
        critical_issues = [hc for hc in health_checks if hc.status == HealthStatus.CRITICAL]
        
        if critical_issues:
            return {
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "issues": [hc.message for hc in critical_issues]
            }
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }
        
    except Exception as e:
        return {
            "status": "unhealthy", 
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }


@router.post("/alerts/check")
async def trigger_alert_check(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    🚨 TRIGGER ALERT CHECK
    
    Manually trigger system alert checks for immediate monitoring.
    """
    
    try:
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required"
            )
        
        # Run alert check in background
        background_tasks.add_task(system_monitoring.check_and_alert)
        
        return {
            "message": "Alert check triggered",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger alert check: {str(e)}"
        )


# ==================== WEBHOOK MANAGEMENT ENDPOINTS ====================

@router.post("/webhooks", response_model=WebhookConfigResponse)
async def create_webhook(
    config: WebhookConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🔗 CREATE WEBHOOK
    
    Configure webhook notifications for pipeline events.
    Addresses integrator user story for completion notifications.
    """
    
    try:
        # Validate workspace access if specified
        if config.workspace_id:
            workspace = await db.get(Workspace, config.workspace_id)
            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )
        
        # Convert event strings to enum
        try:
            event_enums = [WebhookEventType(event) for event in config.events]
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid event type: {str(e)}"
            )
        
        # Create webhook configuration
        webhook_id = str(uuid4())
        webhook_config = WebhookConfiguration(
            webhook_id=webhook_id,
            url=config.url,
            secret=config.secret,
            events=event_enums,
            workspace_id=config.workspace_id,
            user_id=str(current_user.id),
            custom_headers=config.custom_headers,
            retry_attempts=config.retry_attempts,
            timeout_seconds=config.timeout_seconds
        )
        
        # Register webhook
        webhook_service.register_webhook(webhook_config)
        
        return WebhookConfigResponse(
            webhook_id=webhook_id,
            url=config.url,
            events=config.events,
            active=True,
            workspace_id=config.workspace_id,
            created_at=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create webhook: {str(e)}"
        )


@router.get("/webhooks", response_model=List[WebhookConfigResponse])
async def list_webhooks(
    workspace_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    📋 LIST WEBHOOKS
    
    Get all configured webhooks for the user or workspace.
    """
    
    try:
        webhooks = webhook_service.get_webhook_configurations(workspace_id)
        
        # Filter by user
        user_webhooks = [
            webhook for webhook in webhooks
            if not webhook.user_id or webhook.user_id == str(current_user.id)
        ]
        
        return [
            WebhookConfigResponse(
                webhook_id=webhook.webhook_id,
                url=webhook.url,
                events=[event.value for event in webhook.events],
                active=webhook.active,
                workspace_id=webhook.workspace_id,
                created_at=datetime.utcnow().isoformat()  # Would be stored in real implementation
            )
            for webhook in user_webhooks
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list webhooks: {str(e)}"
        )


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    🗑️ DELETE WEBHOOK
    
    Remove webhook configuration.
    """
    
    try:
        success = webhook_service.unregister_webhook(webhook_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook not found"
            )
        
        return {
            "message": "Webhook deleted successfully",
            "webhook_id": webhook_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete webhook: {str(e)}"
        )


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    🧪 TEST WEBHOOK
    
    Send a test notification to verify webhook configuration.
    """
    
    try:
        result = await webhook_service.test_webhook(webhook_id)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        return {
            "message": "Test webhook sent successfully",
            "webhook_id": webhook_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test webhook: {str(e)}"
        )


@router.get("/webhook-events")
async def list_webhook_events():
    """
    📝 LIST WEBHOOK EVENTS
    
    Get all available webhook event types for configuration.
    """
    
    events = [
        {
            "event_type": event.value,
            "description": {
                WebhookEventType.PIPELINE_CREATED: "Pipeline creation started",
                WebhookEventType.PIPELINE_COMPLETED: "Pipeline processing completed successfully",
                WebhookEventType.PIPELINE_FAILED: "Pipeline processing failed",
                WebhookEventType.QUALITY_THRESHOLD_MET: "Data quality threshold achieved",
                WebhookEventType.QUALITY_THRESHOLD_FAILED: "Data quality below threshold",
                WebhookEventType.EXPORT_COMPLETED: "Framework export completed",
                WebhookEventType.EXPORT_FAILED: "Framework export failed",
                WebhookEventType.SYSTEM_ALERT: "System health alert"
            }.get(event, "System event")
        }
        for event in WebhookEventType
    ]
    
    return {
        "available_events": events,
        "integration_examples": [
            {
                "name": "Slack",
                "description": "Send notifications to Slack channels",
                "events": ["pipeline.completed", "pipeline.failed", "quality.threshold_failed"]
            },
            {
                "name": "Discord",
                "description": "Send notifications to Discord channels", 
                "events": ["pipeline.completed", "export.completed"]
            },
            {
                "name": "Custom API",
                "description": "Integrate with your own systems",
                "events": ["pipeline.completed", "pipeline.failed", "system.alert"]
            }
        ]
    } 