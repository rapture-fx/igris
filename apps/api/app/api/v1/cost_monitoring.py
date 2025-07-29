"""
Cost Monitoring API Endpoints
Provides comprehensive cost tracking, forecasting, and alerting for Schlep Engine infrastructure.

Tracks all services in the $145/month architecture plan:
- Supabase Pro: $25/mo
- Railway Backend: $50/mo  
- Vercel Admin: $20/mo
- AWS S3 + CloudFront: $25/mo
- Railway Redis: $12/mo
- Railway Metrics: $13/mo
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from decimal import Decimal
import asyncio
import json
import logging
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.database.models import User
from app.core.config import settings

# Import the cost monitoring service
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../../../infrastructure/monitoring'))
from cost_monitor import cost_monitor, CostAlert, AlertSeverity, SERVICE_BUDGETS, MONTHLY_BUDGET

router = APIRouter()
logger = logging.getLogger(__name__)

# Pydantic Models for API responses
class ServiceCostSummary(BaseModel):
    """Summary of costs for a specific service"""
    service_name: str = Field(..., description="Name of the service")
    current_cost: float = Field(..., description="Current month cost in USD")
    daily_cost: float = Field(..., description="Average daily cost in USD")
    budget: float = Field(..., description="Monthly budget allocation in USD")
    budget_utilization_percent: float = Field(..., description="Percentage of budget used")
    forecast: float = Field(..., description="Forecasted monthly cost in USD")
    usage_metrics: Dict[str, Any] = Field(default_factory=dict, description="Service-specific usage metrics")
    last_updated: datetime = Field(..., description="Last time metrics were updated")

class OverallCostSummary(BaseModel):
    """Overall cost summary across all services"""
    current_month_total: float = Field(..., description="Total current month cost")
    daily_average: float = Field(..., description="Average daily cost")
    monthly_budget: float = Field(..., description="Total monthly budget")
    budget_utilization_percent: float = Field(..., description="Overall budget utilization percentage")
    forecasted_month_total: float = Field(..., description="Forecasted total monthly cost")
    forecast_vs_budget_percent: float = Field(..., description="Forecast vs budget percentage")
    days_remaining_in_month: int = Field(..., description="Days remaining in current month")
    services: Dict[str, ServiceCostSummary] = Field(..., description="Cost breakdown by service")
    active_alerts: List[Dict[str, Any]] = Field(default_factory=list, description="Active cost alerts")

class CostForecast(BaseModel):
    """Cost forecasting data"""
    service_name: str = Field(..., description="Name of the service")
    current_trend: str = Field(..., description="Current cost trend (increasing/decreasing/stable)")
    forecast_amount: float = Field(..., description="Forecasted monthly cost")
    confidence_level: float = Field(..., description="Forecast confidence level (0-1)")
    trend_analysis: Dict[str, Any] = Field(..., description="Detailed trend analysis")

class CostAlert(BaseModel):
    """Cost alert information"""
    alert_id: str = Field(..., description="Unique alert identifier")
    service: str = Field(..., description="Service name")
    severity: str = Field(..., description="Alert severity (info/warning/critical)")
    message: str = Field(..., description="Alert message")
    threshold: float = Field(..., description="Alert threshold value")
    current_value: float = Field(..., description="Current value that triggered alert")
    timestamp: datetime = Field(..., description="When alert was triggered")
    acknowledged: bool = Field(default=False, description="Whether alert has been acknowledged")

class CostOptimizationRecommendation(BaseModel):
    """Cost optimization recommendation"""
    service_name: str = Field(..., description="Service to optimize")
    recommendation_type: str = Field(..., description="Type of optimization")
    potential_savings: float = Field(..., description="Potential monthly savings in USD")
    implementation_effort: str = Field(..., description="Implementation effort level")
    description: str = Field(..., description="Detailed recommendation description")
    priority: str = Field(..., description="Recommendation priority")

class UsageLimit(BaseModel):
    """Usage limit tracking"""
    metric_name: str = Field(..., description="Name of the usage metric")
    current_usage: float = Field(..., description="Current usage amount")
    limit: float = Field(..., description="Usage limit")
    utilization_percent: float = Field(..., description="Percentage of limit used")
    projected_usage: float = Field(..., description="Projected end-of-month usage")
    status: str = Field(..., description="Status (ok/warning/critical)")

# API Endpoints

@router.get("/summary", response_model=OverallCostSummary)
async def get_cost_summary(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive cost summary across all services"""
    try:
        # Collect latest metrics
        metrics = await cost_monitor.collect_all_metrics()
        
        if not metrics:
            raise HTTPException(status_code=503, detail="Cost monitoring service unavailable")
        
        # Generate cost summary
        summary = cost_monitor.get_cost_summary(metrics)
        
        # Convert to response model
        services_summary = {}
        for service_name, service_data in summary['services'].items():
            service_metrics = metrics.get(service_name)
            services_summary[service_name] = ServiceCostSummary(
                service_name=service_name,
                current_cost=service_data['current_cost'],
                daily_cost=service_data['daily_cost'],
                budget=service_data['budget'],
                budget_utilization_percent=(service_data['current_cost'] / service_data['budget'] * 100) if service_data['budget'] > 0 else 0,
                forecast=service_data['forecast'],
                usage_metrics=service_data['usage_metrics'],
                last_updated=service_metrics.last_updated if service_metrics else datetime.utcnow()
            )
        
        return OverallCostSummary(
            current_month_total=summary['current_month_total'],
            daily_average=summary['daily_average'],
            monthly_budget=summary['monthly_budget'],
            budget_utilization_percent=summary['budget_utilization_percent'],
            forecasted_month_total=summary['forecasted_month_total'],
            forecast_vs_budget_percent=summary['forecast_vs_budget_percent'],
            days_remaining_in_month=summary['days_remaining_in_month'],
            services=services_summary,
            active_alerts=summary['active_alerts']
        )
        
    except Exception as e:
        logger.error(f"Failed to get cost summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve cost summary: {str(e)}")

@router.get("/services/{service_name}", response_model=ServiceCostSummary)
async def get_service_cost_details(
    service_name: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed cost information for a specific service"""
    try:
        if service_name not in SERVICE_BUDGETS:
            raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
        
        # Collect latest metrics
        metrics = await cost_monitor.collect_all_metrics()
        service_metrics = metrics.get(service_name)
        
        if not service_metrics:
            raise HTTPException(status_code=503, detail=f"Metrics unavailable for service '{service_name}'")
        
        # Calculate budget utilization
        budget = float(SERVICE_BUDGETS[service_name])
        budget_utilization = (float(service_metrics.current_cost) / budget * 100) if budget > 0 else 0
        
        # Get forecast
        forecasts = cost_monitor.get_cost_forecast(metrics)
        forecast = float(forecasts.get(service_name, Decimal('0.00')))
        
        return ServiceCostSummary(
            service_name=service_name,
            current_cost=float(service_metrics.current_cost),
            daily_cost=float(service_metrics.daily_cost),
            budget=budget,
            budget_utilization_percent=budget_utilization,
            forecast=forecast,
            usage_metrics=service_metrics.usage_metrics,
            last_updated=service_metrics.last_updated
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get service cost details for {service_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve service details: {str(e)}")

@router.get("/forecast", response_model=List[CostForecast])
async def get_cost_forecasts(
    days_ahead: int = Query(30, ge=1, le=90, description="Number of days to forecast"),
    current_user: User = Depends(get_current_user)
):
    """Get cost forecasts for all services"""
    try:
        # Collect latest metrics
        metrics = await cost_monitor.collect_all_metrics()
        forecasts = cost_monitor.get_cost_forecast(metrics)
        
        forecast_results = []
        for service_name, forecast_amount in forecasts.items():
            service_metrics = metrics.get(service_name)
            if not service_metrics:
                continue
            
            # Calculate trend analysis
            current_cost = float(service_metrics.current_cost)
            daily_cost = float(service_metrics.daily_cost)
            
            # Simple trend calculation
            if daily_cost > 0:
                if current_cost > (daily_cost * 20):  # If current > 20 days worth
                    trend = "increasing"
                elif current_cost < (daily_cost * 15):  # If current < 15 days worth
                    trend = "decreasing"
                else:
                    trend = "stable"
            else:
                trend = "stable"
            
            # Confidence level based on historical data availability
            confidence = 0.7 if len(cost_monitor.metrics_history) > 10 else 0.5
            
            forecast_results.append(CostForecast(
                service_name=service_name,
                current_trend=trend,
                forecast_amount=float(forecast_amount),
                confidence_level=confidence,
                trend_analysis={
                    "daily_average": daily_cost,
                    "current_monthly": current_cost,
                    "projected_monthly": float(forecast_amount),
                    "variance_from_budget": ((float(forecast_amount) / float(SERVICE_BUDGETS[service_name])) - 1) * 100 if service_name in SERVICE_BUDGETS else 0
                }
            ))
        
        return forecast_results
        
    except Exception as e:
        logger.error(f"Failed to get cost forecasts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve forecasts: {str(e)}")

@router.get("/alerts", response_model=List[CostAlert])
async def get_cost_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity (info/warning/critical)"),
    service: Optional[str] = Query(None, description="Filter by service name"),
    max_age_hours: int = Query(24, ge=1, le=168, description="Maximum age of alerts in hours"),
    current_user: User = Depends(get_current_user)
):
    """Get active cost alerts"""
    try:
        # Get active alerts from cost monitor
        active_alerts = cost_monitor.get_active_alerts(max_age_hours)
        
        # Convert to API response format
        alert_responses = []
        for alert in active_alerts:
            # Apply filters
            if severity and alert.severity.value != severity.lower():
                continue
            if service and alert.service != service:
                continue
            
            alert_responses.append(CostAlert(
                alert_id=f"{alert.service}_{alert.severity.value}_{int(alert.timestamp.timestamp())}",
                service=alert.service,
                severity=alert.severity.value,
                message=alert.message,
                threshold=float(alert.threshold),
                current_value=float(alert.current_value),
                timestamp=alert.timestamp,
                acknowledged=False  # Default - could be stored in database
            ))
        
        return alert_responses
        
    except Exception as e:
        logger.error(f"Failed to get cost alerts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve alerts: {str(e)}")

@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_cost_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
):
    """Acknowledge a cost alert"""
    try:
        # In a real implementation, this would update alert status in database
        logger.info(f"Alert {alert_id} acknowledged by user {current_user.id}")
        
        return {
            "status": "acknowledged",
            "alert_id": alert_id,
            "acknowledged_by": current_user.email,
            "acknowledged_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to acknowledge alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}")

@router.get("/optimization/recommendations", response_model=List[CostOptimizationRecommendation])
async def get_cost_optimization_recommendations(
    current_user: User = Depends(get_current_user)
):
    """Get cost optimization recommendations based on current usage patterns"""
    try:
        # Collect latest metrics
        metrics = await cost_monitor.collect_all_metrics()
        
        recommendations = []
        
        for service_name, service_metrics in metrics.items():
            budget = SERVICE_BUDGETS.get(service_name, Decimal('0.00'))
            if budget == 0:
                continue
            
            current_cost = service_metrics.current_cost
            utilization_percent = (current_cost / budget) * 100
            
            # Generate recommendations based on utilization patterns
            if utilization_percent < 30:
                recommendations.append(CostOptimizationRecommendation(
                    service_name=service_name,
                    recommendation_type="rightsizing",
                    potential_savings=float(budget - current_cost) * 0.5,
                    implementation_effort="low",
                    description=f"{service_name} is only using {utilization_percent:.1f}% of its budget. Consider downsizing the service tier.",
                    priority="medium"
                ))
            elif utilization_percent > 90:
                recommendations.append(CostOptimizationRecommendation(
                    service_name=service_name,
                    recommendation_type="scaling",
                    potential_savings=0.0,
                    implementation_effort="medium",
                    description=f"{service_name} is using {utilization_percent:.1f}% of its budget. Consider optimizing usage or increasing budget allocation.",
                    priority="high"
                ))
            
            # Service-specific recommendations
            if service_name == "supabase":
                db_connections = service_metrics.usage_metrics.get('active_connections', 0)
                if db_connections < 5:
                    recommendations.append(CostOptimizationRecommendation(
                        service_name=service_name,
                        recommendation_type="connection_pooling",
                        potential_savings=5.0,
                        implementation_effort="low",
                        description="Low database connection usage detected. Optimize connection pooling to reduce costs.",
                        priority="low"
                    ))
            
            elif service_name == "railway_backend":
                cpu_hours = service_metrics.usage_metrics.get('cpu_hours', 0)
                if cpu_hours > 500:
                    recommendations.append(CostOptimizationRecommendation(
                        service_name=service_name,
                        recommendation_type="cpu_optimization",
                        potential_savings=10.0,
                        implementation_effort="medium",
                        description="High CPU usage detected. Consider optimizing application performance or scaling strategies.",
                        priority="medium"
                    ))
            
            elif service_name == "aws_s3_cloudfront":
                storage_gb = service_metrics.usage_metrics.get('s3_storage_gb', 0)
                if storage_gb > 50:
                    recommendations.append(CostOptimizationRecommendation(
                        service_name=service_name,
                        recommendation_type="storage_optimization",
                        potential_savings=3.0,
                        implementation_effort="low",
                        description="Consider implementing lifecycle policies to move old data to cheaper storage tiers.",
                        priority="low"
                    ))
        
        return recommendations
        
    except Exception as e:
        logger.error(f"Failed to get optimization recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve recommendations: {str(e)}")

@router.get("/usage/limits", response_model=List[UsageLimit])
async def get_usage_limits(
    current_user: User = Depends(get_current_user)
):
    """Get current usage against defined limits"""
    try:
        # Collect latest metrics
        metrics = await cost_monitor.collect_all_metrics()
        
        usage_limits = []
        
        # Define usage limits for monitoring
        limits_config = {
            "api_requests_monthly": {"limit": 50000, "unit": "requests"},
            "storage_gb": {"limit": 100, "unit": "GB"},
            "database_connections": {"limit": 100, "unit": "connections"},
            "redis_memory_mb": {"limit": 512, "unit": "MB"},
            "bandwidth_gb": {"limit": 1000, "unit": "GB"}
        }
        
        # Aggregate current usage from all services
        current_usage = {
            "api_requests_monthly": 0,
            "storage_gb": 0,
            "database_connections": 0,
            "redis_memory_mb": 0,
            "bandwidth_gb": 0
        }
        
        for service_metrics in metrics.values():
            usage_data = service_metrics.usage_metrics
            current_usage["api_requests_monthly"] += usage_data.get("api_requests", 0)
            current_usage["storage_gb"] += usage_data.get("storage_used_gb", 0)
            current_usage["database_connections"] += usage_data.get("active_connections", 0)
            current_usage["redis_memory_mb"] += usage_data.get("memory_mb", 0)
            current_usage["bandwidth_gb"] += usage_data.get("bandwidth_gb", 0)
        
        # Calculate status and projections
        for metric_name, limit_config in limits_config.items():
            current = current_usage[metric_name]
            limit = limit_config["limit"]
            utilization_percent = (current / limit * 100) if limit > 0 else 0
            
            # Simple projection based on current day of month
            current_day = datetime.utcnow().day
            if current_day > 0:
                projected = (current / current_day) * 30
            else:
                projected = current
            
            # Determine status
            if utilization_percent >= 95:
                status = "critical"
            elif utilization_percent >= 80:
                status = "warning"
            else:
                status = "ok"
            
            usage_limits.append(UsageLimit(
                metric_name=metric_name,
                current_usage=current,
                limit=limit,
                utilization_percent=utilization_percent,
                projected_usage=projected,
                status=status
            ))
        
        return usage_limits
        
    except Exception as e:
        logger.error(f"Failed to get usage limits: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve usage limits: {str(e)}")

@router.get("/metrics/stream")
async def stream_cost_metrics(
    current_user: User = Depends(get_current_user)
):
    """Stream real-time cost metrics via Server-Sent Events"""
    
    async def generate_cost_metrics():
        while True:
            try:
                # Get cost summary
                summary = await get_cost_summary(current_user)
                
                # Format for SSE
                data = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "type": "cost_update",
                    "data": summary.dict()
                }
                
                yield f"data: {json.dumps(data, default=str)}\n\n"
                
                # Update every 30 seconds for cost metrics
                await asyncio.sleep(30)
                
            except Exception as e:
                error_data = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "type": "error",
                    "error": str(e)
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                await asyncio.sleep(60)  # Wait longer on error
    
    return StreamingResponse(
        generate_cost_metrics(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@router.get("/export")
async def export_cost_data(
    format: str = Query("json", description="Export format (json, csv)"),
    days: int = Query(30, ge=1, le=90, description="Number of days of data to export"),
    current_user: User = Depends(get_current_user)
):
    """Export cost monitoring data for external analysis"""
    try:
        # Get historical data
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # For now, use current metrics (in production, would query historical database)
        metrics = await cost_monitor.collect_all_metrics()
        summary = cost_monitor.get_cost_summary(metrics)
        
        export_data = {
            "export_date": end_date.isoformat(),
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "summary": summary,
            "services": [
                {
                    "service_name": service_name,
                    "current_cost": float(service_metrics.current_cost),
                    "daily_cost": float(service_metrics.daily_cost),
                    "usage_metrics": service_metrics.usage_metrics,
                    "last_updated": service_metrics.last_updated.isoformat()
                }
                for service_name, service_metrics in metrics.items()
            ]
        }
        
        if format.lower() == "csv":
            # Convert to CSV format
            import io
            import csv
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                "service_name", "current_cost", "daily_cost", "budget",
                "utilization_percent", "forecast", "last_updated"
            ])
            
            # Write data
            for service_data in export_data["services"]:
                budget = float(SERVICE_BUDGETS.get(service_data["service_name"], 0))
                utilization = (service_data["current_cost"] / budget * 100) if budget > 0 else 0
                forecasts = cost_monitor.get_cost_forecast(metrics)
                forecast = float(forecasts.get(service_data["service_name"], 0))
                
                writer.writerow([
                    service_data["service_name"],
                    service_data["current_cost"],
                    service_data["daily_cost"],
                    budget,
                    utilization,
                    forecast,
                    service_data["last_updated"]
                ])
            
            output.seek(0)
            return StreamingResponse(
                io.StringIO(output.getvalue()),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=cost_monitoring_export.csv"}
            )
        
        return export_data
        
    except Exception as e:
        logger.error(f"Failed to export cost data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")

# Background task to periodically collect metrics
@router.post("/admin/collect-metrics")
async def trigger_metrics_collection(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Manually trigger metrics collection (admin only)"""
    try:
        # Check if user has admin privileges (implement as needed)
        # if not current_user.is_admin:
        #     raise HTTPException(status_code=403, detail="Admin access required")
        
        background_tasks.add_task(cost_monitor.collect_all_metrics)
        
        return {
            "status": "triggered",
            "message": "Cost metrics collection started in background",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger metrics collection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger collection: {str(e)}")

@router.get("/health")
async def cost_monitoring_health():
    """Health check endpoint for cost monitoring service"""
    try:
        # Check if we can collect metrics
        metrics = await cost_monitor.collect_all_metrics()
        
        health_status = {
            "status": "healthy" if metrics else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "services_tracked": len(metrics),
            "active_alerts": len(cost_monitor.get_active_alerts()),
            "last_collection": max([m.last_updated for m in metrics.values()]).isoformat() if metrics else None
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Cost monitoring health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }