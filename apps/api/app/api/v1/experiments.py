"""
Enhanced Experiment Tracking API Endpoints
===========================================

Comprehensive API endpoints for advanced experiment tracking and management.
Built on top of the existing MLOps platform with enhanced capabilities for
AI companies to manage their complete ML experiment lifecycle.

Features:
- Advanced experiment creation with multi-objective optimization
- Real-time metrics logging and streaming
- Experiment comparison and statistical analysis
- Collaborative experiment sharing and management
- Experiment genealogy and lineage tracking
- Resource efficiency analysis and monitoring
- Automated insights generation and reporting
- Best practice recommendations
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query, Path, Body
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.status import HTTP_201_CREATED, HTTP_200_OK, HTTP_404_NOT_FOUND, HTTP_400_BAD_REQUEST

# Import enhanced experiment tracking components
try:
    from app.ml.enhanced_experiment_tracker import (
        EnhancedExperimentTracker, MetricDefinition, ExperimentLineage,
        CollaborationInfo, ExperimentType, MetricType, OptimizationObjective,
        SharePermission
    )
    from app.services.experiment_analytics_service import (
        ExperimentAnalyticsService, TrendAnalysis, PerformanceComparison,
        ResourceEfficiencyAnalysis, ExperimentPortfolioAnalysis
    )
except ImportError as e:
    logging.warning(f"Could not import enhanced experiment components: {e}")
    EnhancedExperimentTracker = None
    ExperimentAnalyticsService = None

# Import schemas
try:
    from app.schemas.mlops import (
        ExperimentCreate, ExperimentResponse, ExperimentUpdate,
        MetricLogRequest, ExperimentComparisonRequest, ExperimentSharingRequest
    )
except ImportError as e:
    logging.warning(f"Could not import MLOps schemas: {e}")

# Import existing MLOps core
try:
    from app.ml.mlops_platform import MLOpsCore
except ImportError as e:
    logging.warning(f"Could not import MLOps core: {e}")
    MLOpsCore = None

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/experiments", tags=["Enhanced Experiments"])

# Global instances (would be dependency-injected in production)
_enhanced_tracker: Optional[EnhancedExperimentTracker] = None
_analytics_service: Optional[ExperimentAnalyticsService] = None
_mlops_core: Optional[MLOpsCore] = None


def get_enhanced_tracker() -> EnhancedExperimentTracker:
    """Dependency to get enhanced experiment tracker."""
    global _enhanced_tracker
    if _enhanced_tracker is None:
        _enhanced_tracker = EnhancedExperimentTracker()
    return _enhanced_tracker


def get_analytics_service() -> ExperimentAnalyticsService:
    """Dependency to get experiment analytics service."""
    global _analytics_service
    if _analytics_service is None:
        tracker = get_enhanced_tracker()
        _analytics_service = ExperimentAnalyticsService(experiment_tracker=tracker)
    return _analytics_service


def get_mlops_core() -> MLOpsCore:
    """Dependency to get MLOps core."""
    global _mlops_core
    if _mlops_core is None and MLOpsCore:
        _mlops_core = MLOpsCore()
    return _mlops_core


@router.post("/create", status_code=HTTP_201_CREATED)
async def create_enhanced_experiment(
    experiment_data: Dict[str, Any] = Body(...),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker),
    background_tasks: BackgroundTasks = None
):
    """
    Create a new enhanced experiment with advanced tracking capabilities.
    
    Features:
    - Multi-objective optimization support
    - Real-time metrics tracking
    - Experiment lineage and genealogy
    - Collaborative sharing settings
    - Resource monitoring
    """
    
    try:
        # Extract experiment configuration
        name = experiment_data.get("name")
        description = experiment_data.get("description", "")
        experiment_type = ExperimentType(experiment_data.get("experiment_type", "single_model"))
        dataset_config = experiment_data.get("dataset_config", {})
        model_configs = experiment_data.get("model_configs", [])
        created_by = experiment_data.get("created_by", "api_user")
        parent_experiment_ids = experiment_data.get("parent_experiment_ids", [])
        tags = experiment_data.get("tags", [])
        
        # Parse optimization objectives
        optimization_objectives = []
        for obj_data in experiment_data.get("optimization_objectives", []):
            metric_def = MetricDefinition(
                name=obj_data.get("name"),
                description=obj_data.get("description", ""),
                metric_type=MetricType(obj_data.get("metric_type", "custom")),
                objective=OptimizationObjective(obj_data.get("objective", "maximize")),
                weight=obj_data.get("weight", 1.0),
                threshold=obj_data.get("threshold"),
                is_primary=obj_data.get("is_primary", False)
            )
            optimization_objectives.append(metric_def)
        
        # Parse collaboration settings
        collaboration_data = experiment_data.get("collaboration_settings", {})
        collaboration_settings = None
        if collaboration_data:
            shared_with = {}
            for user_id, permission in collaboration_data.get("shared_with", {}).items():
                shared_with[user_id] = SharePermission(permission)
            
            shared_teams = {}
            for team_id, permission in collaboration_data.get("shared_teams", {}).items():
                shared_teams[team_id] = SharePermission(permission)
            
            collaboration_settings = CollaborationInfo(
                shared_with=shared_with,
                shared_teams=shared_teams,
                public=collaboration_data.get("public", False)
            )
        
        if not name or not model_configs:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="Name and model_configs are required"
            )
        
        # Create enhanced experiment
        experiment_id = tracker.create_enhanced_experiment(
            name=name,
            description=description,
            experiment_type=experiment_type,
            dataset_config=dataset_config,
            model_configs=model_configs,
            optimization_objectives=optimization_objectives,
            created_by=created_by,
            parent_experiment_ids=parent_experiment_ids,
            tags=tags,
            collaboration_settings=collaboration_settings,
            **{k: v for k, v in experiment_data.items() 
               if k not in ["name", "description", "experiment_type", "dataset_config", 
                           "model_configs", "optimization_objectives", "created_by",
                           "parent_experiment_ids", "tags", "collaboration_settings"]}
        )
        
        # Start monitoring if requested
        if experiment_data.get("auto_start_monitoring", True):
            tracker.start_experiment_monitoring(experiment_id)
        
        # Schedule background training if requested
        if background_tasks and experiment_data.get("auto_start_training", False):
            background_tasks.add_task(_run_experiment_training, experiment_id)
        
        return {
            "experiment_id": experiment_id,
            "name": name,
            "status": "created",
            "message": "Enhanced experiment created successfully",
            "monitoring_enabled": experiment_data.get("auto_start_monitoring", True),
            "training_scheduled": experiment_data.get("auto_start_training", False),
            "created_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to create enhanced experiment: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to create experiment: {str(e)}"
        )


@router.post("/{experiment_id}/metrics/log")
async def log_experiment_metric(
    experiment_id: str = Path(..., description="Experiment ID"),
    metric_data: Dict[str, Any] = Body(...),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """
    Log metrics for an experiment with real-time tracking.
    
    Supports:
    - Single metric logging
    - Batch metric logging
    - Custom metadata
    - Step-based tracking
    - Timestamp-based tracking
    """
    
    try:
        if "metrics" in metric_data:
            # Batch logging
            results = []
            for metric_entry in metric_data["metrics"]:
                success = tracker.log_metric(
                    experiment_id=experiment_id,
                    metric_name=metric_entry.get("name"),
                    value=metric_entry.get("value"),
                    step=metric_entry.get("step"),
                    timestamp=datetime.fromisoformat(metric_entry["timestamp"]) if metric_entry.get("timestamp") else None,
                    metadata=metric_entry.get("metadata", {})
                )
                results.append({
                    "metric_name": metric_entry.get("name"),
                    "success": success
                })
            
            return {
                "experiment_id": experiment_id,
                "batch_results": results,
                "total_logged": len(results),
                "successful": sum(1 for r in results if r["success"]),
                "timestamp": datetime.utcnow().isoformat()
            }
        
        else:
            # Single metric logging
            success = tracker.log_metric(
                experiment_id=experiment_id,
                metric_name=metric_data.get("name"),
                value=metric_data.get("value"),
                step=metric_data.get("step"),
                timestamp=datetime.fromisoformat(metric_data["timestamp"]) if metric_data.get("timestamp") else None,
                metadata=metric_data.get("metadata", {})
            )
            
            if success:
                return {
                    "experiment_id": experiment_id,
                    "metric_name": metric_data.get("name"),
                    "value": metric_data.get("value"),
                    "status": "logged",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                raise HTTPException(
                    status_code=HTTP_400_BAD_REQUEST,
                    detail="Failed to log metric"
                )
    
    except Exception as e:
        logger.error(f"Failed to log metric for experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to log metric: {str(e)}"
        )


@router.post("/{experiment_id}/hyperparameters/log")
async def log_experiment_hyperparameter(
    experiment_id: str = Path(..., description="Experiment ID"),
    hyperparameter_data: Dict[str, Any] = Body(...),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Log hyperparameters for an experiment."""
    
    try:
        if "hyperparameters" in hyperparameter_data:
            # Batch logging
            results = []
            for param_name, param_value in hyperparameter_data["hyperparameters"].items():
                success = tracker.log_hyperparameter(experiment_id, param_name, param_value)
                results.append({
                    "parameter_name": param_name,
                    "success": success
                })
            
            return {
                "experiment_id": experiment_id,
                "batch_results": results,
                "total_logged": len(results),
                "successful": sum(1 for r in results if r["success"]),
                "timestamp": datetime.utcnow().isoformat()
            }
        
        else:
            # Single parameter logging
            success = tracker.log_hyperparameter(
                experiment_id=experiment_id,
                param_name=hyperparameter_data.get("name"),
                value=hyperparameter_data.get("value")
            )
            
            if success:
                return {
                    "experiment_id": experiment_id,
                    "parameter_name": hyperparameter_data.get("name"),
                    "value": hyperparameter_data.get("value"),
                    "status": "logged",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                raise HTTPException(
                    status_code=HTTP_400_BAD_REQUEST,
                    detail="Failed to log hyperparameter"
                )
    
    except Exception as e:
        logger.error(f"Failed to log hyperparameter for experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to log hyperparameter: {str(e)}"
        )


@router.get("/{experiment_id}/metrics/realtime")
async def get_realtime_metrics(
    experiment_id: str = Path(..., description="Experiment ID"),
    metric_names: Optional[List[str]] = Query(None, description="Specific metrics to retrieve"),
    last_n_points: int = Query(1000, description="Number of recent points to retrieve"),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Get real-time metrics for an experiment."""
    
    try:
        metrics_data = tracker.get_real_time_metrics(
            experiment_id=experiment_id,
            metric_names=metric_names,
            last_n_points=last_n_points
        )
        
        return {
            "experiment_id": experiment_id,
            "metrics": metrics_data,
            "retrieved_at": datetime.utcnow().isoformat(),
            "total_metrics": len(metrics_data),
            "total_points": sum(len(points) for points in metrics_data.values())
        }
    
    except Exception as e:
        logger.error(f"Failed to get real-time metrics for experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to get real-time metrics: {str(e)}"
        )


@router.get("/{experiment_id}/metrics/stream")
async def stream_experiment_metrics(
    experiment_id: str = Path(..., description="Experiment ID"),
    metric_names: Optional[List[str]] = Query(None, description="Specific metrics to stream"),
    update_interval: int = Query(5, description="Update interval in seconds"),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Stream real-time metrics for an experiment using Server-Sent Events."""
    
    async def metric_stream():
        """Generator function for streaming metrics."""
        last_update = datetime.utcnow()
        
        while True:
            try:
                # Get recent metrics since last update
                current_time = datetime.utcnow()
                metrics_data = tracker.get_real_time_metrics(
                    experiment_id=experiment_id,
                    metric_names=metric_names,
                    last_n_points=100  # Get recent points
                )
                
                # Filter metrics newer than last update
                filtered_metrics = {}
                for metric_name, points in metrics_data.items():
                    recent_points = []
                    for point in points:
                        point_time = datetime.fromisoformat(point['timestamp'])
                        if point_time > last_update:
                            recent_points.append(point)
                    
                    if recent_points:
                        filtered_metrics[metric_name] = recent_points
                
                if filtered_metrics:
                    event_data = {
                        "experiment_id": experiment_id,
                        "metrics": filtered_metrics,
                        "timestamp": current_time.isoformat()
                    }
                    
                    yield f"data: {json.dumps(event_data)}\n\n"
                
                last_update = current_time
                await asyncio.sleep(update_interval)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in metric stream for experiment {experiment_id}: {e}")
                error_data = {
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                await asyncio.sleep(update_interval)
    
    return StreamingResponse(
        metric_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/compare")
async def compare_experiments(
    comparison_request: Dict[str, Any] = Body(...),
    analytics: ExperimentAnalyticsService = Depends(get_analytics_service)
):
    """
    Compare multiple experiments with statistical analysis.
    
    Features:
    - Statistical significance testing
    - Performance comparison across metrics
    - Effect size calculation
    - Confidence intervals
    """
    
    try:
        experiment_ids = comparison_request.get("experiment_ids", [])
        comparison_metrics = comparison_request.get("comparison_metrics")
        statistical_test = comparison_request.get("statistical_test", "ttest")
        confidence_level = comparison_request.get("confidence_level", 0.95)
        
        if len(experiment_ids) < 2:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="At least 2 experiments required for comparison"
            )
        
        # Perform comparison
        comparison_result = analytics.compare_experiment_performance(
            experiment_ids=experiment_ids,
            comparison_metrics=comparison_metrics,
            statistical_test=statistical_test,
            confidence_level=confidence_level
        )
        
        return {
            "comparison_id": f"comp_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "comparison_result": {
                "comparison_type": comparison_result.comparison_type,
                "experiments_compared": comparison_result.experiments_compared,
                "winner": comparison_result.winner,
                "performance_improvement": comparison_result.performance_improvement,
                "statistical_significance": comparison_result.statistical_significance,
                "confidence_level": comparison_result.confidence_level,
                "effect_size": comparison_result.effect_size,
                "comparison_metrics": comparison_result.comparison_metrics
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to compare experiments: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to compare experiments: {str(e)}"
        )


@router.get("/{experiment_id}/insights")
async def get_experiment_insights(
    experiment_id: str = Path(..., description="Experiment ID"),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Get automated insights and recommendations for an experiment."""
    
    try:
        insights = tracker.get_experiment_insights(experiment_id)
        
        return {
            "experiment_id": experiment_id,
            "insights": {
                "performance_summary": insights.performance_summary,
                "best_hyperparameters": insights.best_hyperparameters,
                "feature_importance_ranking": insights.feature_importance_ranking,
                "convergence_analysis": insights.convergence_analysis,
                "stability_metrics": insights.stability_metrics,
                "efficiency_score": insights.efficiency_score,
                "recommendations": insights.recommendations,
                "anomalies": insights.anomalies,
                "comparison_insights": insights.comparison_insights
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to get insights for experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND if "not found" in str(e).lower() else HTTP_400_BAD_REQUEST,
            detail=f"Failed to get experiment insights: {str(e)}"
        )


@router.post("/{experiment_id}/share")
async def share_experiment(
    experiment_id: str = Path(..., description="Experiment ID"),
    sharing_request: Dict[str, Any] = Body(...),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Share an experiment with other users or teams."""
    
    try:
        user_id = sharing_request.get("user_id")
        permission = SharePermission(sharing_request.get("permission", "view"))
        shared_by = sharing_request.get("shared_by", "api_user")
        
        if not user_id:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="user_id is required"
            )
        
        success = tracker.share_experiment(
            experiment_id=experiment_id,
            user_id=user_id,
            permission=permission,
            shared_by=shared_by
        )
        
        if success:
            return {
                "experiment_id": experiment_id,
                "shared_with": user_id,
                "permission": permission.value,
                "shared_by": shared_by,
                "status": "shared",
                "shared_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="Failed to share experiment"
            )
    
    except Exception as e:
        logger.error(f"Failed to share experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to share experiment: {str(e)}"
        )


@router.get("/{experiment_id}/genealogy")
async def get_experiment_genealogy(
    experiment_id: str = Path(..., description="Experiment ID"),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Get experiment genealogy and lineage information."""
    
    try:
        genealogy = tracker.get_experiment_genealogy(experiment_id)
        
        return {
            "experiment_id": experiment_id,
            "genealogy": genealogy,
            "retrieved_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to get genealogy for experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND if "not found" in str(e).lower() else HTTP_400_BAD_REQUEST,
            detail=f"Failed to get experiment genealogy: {str(e)}"
        )


@router.get("/analytics/trends")
async def get_experiment_trends(
    experiment_ids: List[str] = Query(..., description="List of experiment IDs"),
    metric_names: List[str] = Query(..., description="Metrics to analyze"),
    time_period_days: int = Query(30, description="Time period for analysis in days"),
    include_predictions: bool = Query(True, description="Include trend predictions"),
    analytics: ExperimentAnalyticsService = Depends(get_analytics_service)
):
    """Analyze performance trends across experiments."""
    
    try:
        trend_analyses = analytics.analyze_experiment_trends(
            experiment_ids=experiment_ids,
            metric_names=metric_names,
            time_period_days=time_period_days,
            include_predictions=include_predictions
        )
        
        return {
            "experiment_ids": experiment_ids,
            "metric_names": metric_names,
            "time_period_days": time_period_days,
            "trends": [
                {
                    "metric_name": trend.metric_name,
                    "trend_direction": trend.trend_direction,
                    "trend_strength": trend.trend_strength,
                    "seasonal_pattern": trend.seasonal_pattern,
                    "volatility": trend.volatility,
                    "predictions": trend.predictions if include_predictions else [],
                    "confidence_interval": trend.confidence_interval
                }
                for trend in trend_analyses
            ],
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to analyze experiment trends: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to analyze trends: {str(e)}"
        )


@router.get("/analytics/efficiency")
async def analyze_resource_efficiency(
    experiment_ids: List[str] = Query(..., description="List of experiment IDs"),
    include_cost_analysis: bool = Query(True, description="Include cost analysis"),
    analytics: ExperimentAnalyticsService = Depends(get_analytics_service)
):
    """Analyze resource efficiency across experiments."""
    
    try:
        efficiency_analyses = analytics.analyze_resource_efficiency(
            experiment_ids=experiment_ids,
            include_cost_analysis=include_cost_analysis
        )
        
        return {
            "experiment_ids": experiment_ids,
            "efficiency_analyses": [
                {
                    "efficiency_score": analysis.efficiency_score,
                    "cpu_efficiency": analysis.cpu_efficiency,
                    "memory_efficiency": analysis.memory_efficiency,
                    "gpu_efficiency": analysis.gpu_efficiency,
                    "time_efficiency": analysis.time_efficiency,
                    "cost_efficiency": analysis.cost_efficiency,
                    "carbon_efficiency": analysis.carbon_efficiency,
                    "recommendations": analysis.recommendations,
                    "benchmark_comparison": analysis.benchmark_comparison
                }
                for analysis in efficiency_analyses
            ],
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to analyze resource efficiency: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to analyze efficiency: {str(e)}"
        )


@router.get("/analytics/best-practices")
async def get_best_practice_recommendations(
    experiment_ids: List[str] = Query(..., description="List of experiment IDs"),
    min_confidence: float = Query(0.7, description="Minimum confidence threshold"),
    analytics: ExperimentAnalyticsService = Depends(get_analytics_service)
):
    """Generate best practice recommendations based on experiment patterns."""
    
    try:
        recommendations = analytics.generate_best_practice_recommendations(
            experiment_ids=experiment_ids,
            min_confidence=min_confidence
        )
        
        return {
            "experiment_ids": experiment_ids,
            "min_confidence": min_confidence,
            "recommendations": [
                {
                    "category": rec.category,
                    "recommendation": rec.recommendation,
                    "confidence": rec.confidence,
                    "supporting_experiments": rec.supporting_experiments,
                    "expected_improvement": rec.expected_improvement,
                    "implementation_difficulty": rec.implementation_difficulty
                }
                for rec in recommendations
            ],
            "total_recommendations": len(recommendations),
            "generated_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to generate best practice recommendations: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


@router.get("/analytics/portfolio")
async def analyze_experiment_portfolio(
    experiment_ids: List[str] = Query(..., description="List of experiment IDs"),
    time_period_days: int = Query(90, description="Time period for analysis in days"),
    analytics: ExperimentAnalyticsService = Depends(get_analytics_service)
):
    """Analyze the overall experiment portfolio for insights and optimization."""
    
    try:
        portfolio_analysis = analytics.analyze_experiment_portfolio(
            experiment_ids=experiment_ids,
            time_period_days=time_period_days
        )
        
        return {
            "experiment_ids": experiment_ids,
            "time_period_days": time_period_days,
            "portfolio_analysis": {
                "total_experiments": portfolio_analysis.total_experiments,
                "success_rate": portfolio_analysis.success_rate,
                "avg_performance": portfolio_analysis.avg_performance,
                "performance_distribution": portfolio_analysis.performance_distribution,
                "resource_utilization": portfolio_analysis.resource_utilization,
                "experiment_diversity": portfolio_analysis.experiment_diversity,
                "exploration_exploitation_balance": portfolio_analysis.exploration_exploitation_balance,
                "portfolio_health_score": portfolio_analysis.portfolio_health_score,
                "recommendations": [
                    {
                        "category": rec.category,
                        "recommendation": rec.recommendation,
                        "confidence": rec.confidence,
                        "expected_improvement": rec.expected_improvement,
                        "implementation_difficulty": rec.implementation_difficulty
                    }
                    for rec in portfolio_analysis.recommendations
                ]
            },
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to analyze experiment portfolio: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to analyze portfolio: {str(e)}"
        )


@router.post("/reports/generate")
async def generate_experiment_report(
    report_request: Dict[str, Any] = Body(...),
    analytics: ExperimentAnalyticsService = Depends(get_analytics_service)
):
    """Generate comprehensive automated experiment analysis report."""
    
    try:
        experiment_ids = report_request.get("experiment_ids", [])
        report_type = report_request.get("report_type", "comprehensive")
        include_visualizations = report_request.get("include_visualizations", True)
        
        if not experiment_ids:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="experiment_ids are required"
            )
        
        # Generate report
        report = analytics.generate_automated_report(
            experiment_ids=experiment_ids,
            report_type=report_type,
            include_visualizations=include_visualizations
        )
        
        return report
    
    except Exception as e:
        logger.error(f"Failed to generate experiment report: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate report: {str(e)}"
        )


@router.post("/{experiment_id}/complete")
async def complete_experiment(
    experiment_id: str = Path(..., description="Experiment ID"),
    completion_data: Dict[str, Any] = Body(None),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Complete an experiment and perform final analysis."""
    
    try:
        final_results = completion_data.get("final_results") if completion_data else None
        
        success = tracker.complete_experiment(experiment_id, final_results)
        
        if success:
            return {
                "experiment_id": experiment_id,
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "final_analysis_generated": True
            }
        else:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="Failed to complete experiment"
            )
    
    except Exception as e:
        logger.error(f"Failed to complete experiment {experiment_id}: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to complete experiment: {str(e)}"
        )


@router.get("/platform/analytics")
async def get_platform_analytics(
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Get comprehensive platform analytics and statistics."""
    
    try:
        analytics = tracker.get_platform_analytics()
        
        return {
            "platform_analytics": analytics,
            "retrieved_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to get platform analytics: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to get platform analytics: {str(e)}"
        )


@router.post("/metrics/define")
async def define_custom_metric(
    metric_definition: Dict[str, Any] = Body(...),
    tracker: EnhancedExperimentTracker = Depends(get_enhanced_tracker)
):
    """Define a custom metric for tracking across experiments."""
    
    try:
        metric_def = MetricDefinition(
            name=metric_definition.get("name"),
            description=metric_definition.get("description", ""),
            metric_type=MetricType(metric_definition.get("metric_type", "custom")),
            objective=OptimizationObjective(metric_definition.get("objective", "maximize")),
            weight=metric_definition.get("weight", 1.0),
            threshold=metric_definition.get("threshold"),
            aggregation_method=metric_definition.get("aggregation_method", "mean"),
            is_primary=metric_definition.get("is_primary", False),
            tags=metric_definition.get("tags", [])
        )
        
        success = tracker.define_custom_metric(metric_def)
        
        if success:
            return {
                "metric_name": metric_def.name,
                "status": "defined",
                "metric_definition": {
                    "name": metric_def.name,
                    "description": metric_def.description,
                    "metric_type": metric_def.metric_type.value,
                    "objective": metric_def.objective.value,
                    "weight": metric_def.weight,
                    "threshold": metric_def.threshold,
                    "aggregation_method": metric_def.aggregation_method,
                    "is_primary": metric_def.is_primary,
                    "tags": metric_def.tags
                },
                "defined_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="Failed to define custom metric"
            )
    
    except Exception as e:
        logger.error(f"Failed to define custom metric: {e}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Failed to define custom metric: {str(e)}"
        )


# Background task functions
async def _run_experiment_training(experiment_id: str):
    """Background task to run experiment training."""
    
    try:
        # This would integrate with the existing MLOps training pipeline
        # For now, this is a placeholder that simulates training
        logger.info(f"Starting background training for experiment {experiment_id}")
        
        # Simulate training process
        import time
        await asyncio.sleep(5)  # Simulate training time
        
        # Here you would integrate with the actual training pipeline
        # mlops_core = get_mlops_core()
        # if mlops_core:
        #     results = await mlops_core.execute_experiment(experiment_id)
        
        logger.info(f"Background training completed for experiment {experiment_id}")
    
    except Exception as e:
        logger.error(f"Background training failed for experiment {experiment_id}: {e}")


# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check endpoint for the enhanced experiments API."""
    
    try:
        tracker = get_enhanced_tracker()
        analytics = get_analytics_service()
        
        return {
            "status": "healthy",
            "enhanced_tracker": tracker is not None,
            "analytics_service": analytics is not None,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }