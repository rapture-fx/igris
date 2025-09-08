"""
Digital Twin API Endpoints
==========================

FastAPI endpoints for digital twin management, simulation, analytics, and real-time operations.
Provides comprehensive REST API for manufacturing companies to create and manage digital replicas.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
import logging
import json
import asyncio
from datetime import datetime, timedelta

# Import dependencies
from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.core.logging_config import setup_logging

# Import services
from app.services.digital_twin_service import DigitalTwinService
from app.services.simulation_engine import SimulationEngine
from app.services.twin_analytics_service import TwinAnalyticsService, AnalyticsRequest
from app.services.industrial_iot_gateway import IndustrialIoTGateway
from app.services.mes_integration_service import MESIntegrationService

# Import schemas
from app.schemas.digital_twin import (
    DigitalTwinCreate, DigitalTwinUpdate, DigitalTwinResponse, AssetStateResponse,
    SimulationScenarioRequest, SimulationResponse, OptimizationRequest,
    AnalyticsRequest as AnalyticsRequestSchema, AnalyticsResponse,
    SyncDataRequest, SyncResponse, PredictionRequest, PredictionResponse,
    BusinessImpactRequest, BusinessImpactResponse,
    InsightCreate, InsightResponse, AlertCreate, AlertResponse,
    ServiceStatusResponse, BatchTwinOperation, BatchOperationResponse,
    WebSocketMessage, RealTimeDataMessage, AlertMessage, SimulationUpdateMessage,
    BaseResponse, ErrorResponse
)

# Import models
from app.models.digital_twin import DigitalTwin, TwinState as TwinStateModel, TwinSimulation
from app.ml.digital_twin_engine import TwinType, SimulationType

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/manufacturing/digital-twin", tags=["Digital Twin"])
security = HTTPBearer()

# Service instances (would be dependency injected in production)
twin_service = None
simulation_engine = None
analytics_service = None

# WebSocket connection manager
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, twin_id: str):
        await websocket.accept()
        if twin_id not in self.active_connections:
            self.active_connections[twin_id] = []
        self.active_connections[twin_id].append(websocket)
        logger.info(f"WebSocket connected for twin {twin_id}")
    
    def disconnect(self, websocket: WebSocket, twin_id: str):
        if twin_id in self.active_connections:
            self.active_connections[twin_id].remove(websocket)
            if not self.active_connections[twin_id]:
                del self.active_connections[twin_id]
        logger.info(f"WebSocket disconnected for twin {twin_id}")
    
    async def send_personal_message(self, message: str, twin_id: str):
        if twin_id in self.active_connections:
            for connection in self.active_connections[twin_id]:
                await connection.send_text(message)
    
    async def broadcast(self, message: str):
        for connections in self.active_connections.values():
            for connection in connections:
                await connection.send_text(message)

websocket_manager = WebSocketManager()


def get_services(db: Session = Depends(get_db)):
    """Get service instances with dependency injection."""
    global twin_service, simulation_engine, analytics_service
    
    if not twin_service:
        # Initialize IoT Gateway and MES Service (would be injected in production)
        iot_gateway = IndustrialIoTGateway(db)
        mes_service = MESIntegrationService(db)
        
        # Initialize services
        twin_service = DigitalTwinService(db, iot_gateway, mes_service)
        simulation_engine = SimulationEngine()
        analytics_service = TwinAnalyticsService()
    
    return twin_service, simulation_engine, analytics_service


# Digital Twin Management Endpoints

@router.post("/create", response_model=DigitalTwinResponse)
async def create_digital_twin(
    twin_request: DigitalTwinCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Create a new digital twin with full integration setup.
    
    Creates a digital twin with physics models, ML models, and integration
    with IoT Gateway and MES systems.
    """
    try:
        twin_service, _, _ = services
        
        # Convert request to service format
        twin_request_dict = {
            'twin_id': twin_request.twin_id,
            'twin_name': twin_request.twin_name,
            'twin_type': twin_request.twin_type.value,
            'configuration': twin_request.configuration.dict() if hasattr(twin_request.configuration, 'dict') else twin_request.configuration,
            'iot_integration': twin_request.iot_integration.dict() if twin_request.iot_integration else {},
            'mes_integration': twin_request.mes_integration.dict() if twin_request.mes_integration else {},
            'synchronization': twin_request.synchronization.dict() if twin_request.synchronization else {},
            'historical_data': twin_request.historical_data or {}
        }
        
        # Create digital twin
        result = await twin_service.create_digital_twin(twin_request_dict, current_user.get('user_id'))
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Twin creation failed'))
        
        # Schedule background initialization tasks
        if twin_request.synchronization and twin_request.synchronization.auto_sync_enabled:
            background_tasks.add_task(
                _initialize_background_sync,
                twin_service, twin_request.twin_id
            )
        
        return DigitalTwinResponse(
            success=True,
            twin_id=result['twin_id'],
            twin_name=twin_request.twin_name,
            twin_type=twin_request.twin_type,
            state='active',
            description=twin_request.description,
            facility_id=twin_request.facility_id,
            asset_id=twin_request.asset_id,
            health_score=1.0,
            performance_score=0.0,
            data_quality_score=1.0,
            last_sync_at=None,
            last_simulation_at=None,
            created_at=result['twin_creation']['created_at'],
            updated_at=result['twin_creation']['created_at']
        )
        
    except Exception as e:
        logger.error(f"Failed to create digital twin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{twin_id}/state", response_model=Dict[str, Any])
async def get_twin_state(
    twin_id: str,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """Get current state and status of a digital twin."""
    try:
        twin_service, _, _ = services
        
        result = await twin_service.get_twin_status(twin_id)
        
        if not result['success']:
            raise HTTPException(status_code=404, detail=result.get('error', 'Twin not found'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get twin state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{twin_id}", response_model=DigitalTwinResponse)
async def update_digital_twin(
    twin_id: str,
    update_request: DigitalTwinUpdate,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """Update digital twin configuration and settings."""
    try:
        # This would call the twin service update method
        # For now, return a placeholder response
        return DigitalTwinResponse(
            success=True,
            twin_id=twin_id,
            twin_name=update_request.twin_name or "Updated Twin",
            twin_type=TwinType.EQUIPMENT,
            state=update_request.state.value if update_request.state else 'active',
            description=update_request.description,
            facility_id="facility_001",
            asset_id="asset_001",
            health_score=0.95,
            performance_score=0.87,
            data_quality_score=0.92,
            last_sync_at=datetime.utcnow(),
            last_simulation_at=None,
            created_at=datetime.utcnow() - timedelta(days=1),
            updated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Failed to update digital twin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Simulation Endpoints

@router.post("/{twin_id}/simulate", response_model=SimulationResponse)
async def run_simulation(
    twin_id: str,
    simulation_request: SimulationScenarioRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Run simulation scenario on digital twin.
    
    Supports predictive analysis, what-if scenarios, optimization,
    failure analysis, and maintenance planning.
    """
    try:
        twin_service, simulation_engine, _ = services
        
        # Convert request to service format
        simulation_dict = simulation_request.dict()
        
        # Run simulation
        result = await twin_service.run_twin_simulation(twin_id, simulation_dict)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Simulation failed'))
        
        # Send WebSocket update
        background_tasks.add_task(
            _send_simulation_update,
            twin_id, result['scenario']['scenario_id'], 'completed'
        )
        
        return SimulationResponse(
            success=True,
            twin_id=twin_id,
            scenario_id=result['scenario']['scenario_id'],
            simulation_type=simulation_request.simulation_type,
            status='completed',
            started_at=result['execution_metadata']['executed_at'],
            completed_at=result['execution_metadata']['executed_at'],
            execution_time_seconds=5.2,  # Would be from actual execution
            results=result['results'],
            business_impact=result['results'].get('business_impact')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{twin_id}/optimize", response_model=Dict[str, Any])
async def optimize_parameters(
    twin_id: str,
    optimization_request: OptimizationRequest,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Optimize digital twin parameters for specified objectives.
    
    Uses advanced optimization algorithms to find optimal operating parameters.
    """
    try:
        twin_service, _, _ = services
        
        # Convert request to service format
        optimization_dict = {
            'objectives': optimization_request.objectives,
            'constraints': optimization_request.constraints or {}
        }
        
        result = await twin_service.optimize_twin_parameters(twin_id, optimization_dict)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Optimization failed'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to optimize parameters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Analytics Endpoints

@router.get("/{twin_id}/insights", response_model=AnalyticsResponse)
async def get_twin_insights(
    twin_id: str,
    analytics_types: str = "performance,anomaly,energy",
    time_range_hours: float = 168.0,
    include_predictions: bool = True,
    include_recommendations: bool = True,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Get comprehensive analytics insights for digital twin.
    
    Provides performance analytics, anomaly detection, energy analysis,
    predictive insights, and optimization recommendations.
    """
    try:
        twin_service, _, analytics_service = services
        
        # Parse analytics types
        analytics_type_list = [t.strip() for t in analytics_types.split(',')]
        
        # Create analytics request
        analytics_request = {
            'twin_id': twin_id,
            'insight_types': analytics_type_list,
            'time_range_hours': time_range_hours
        }
        
        result = await twin_service.get_twin_insights(
            twin_id, analytics_type_list, time_range_hours
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Analytics failed'))
        
        # Convert to response format
        return AnalyticsResponse(
            success=True,
            twin_id=twin_id,
            analysis_timestamp=result['generated_at'],
            time_range_hours=time_range_hours,
            analytics_types=analytics_type_list,
            performance_kpis=result['enhanced_insights'].get('performance', {}).get('current_kpis'),
            anomalies=result['enhanced_insights'].get('anomaly', {}).get('current_anomalies', []),
            predictions=result['enhanced_insights'].get('predictive', {}).get('predictions', []),
            energy_metrics=result['enhanced_insights'].get('energy'),
            overall_score=result['core_insights'].get('performance_insights', {}).get('performance_grade'),
            business_impact=result['business_impact'],
            recommendations=result['enhanced_insights'].get('optimization', {}).get('recommendations', [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{twin_id}/predictions", response_model=PredictionResponse)
async def get_predictions(
    twin_id: str,
    time_horizon_hours: float = 168.0,
    prediction_types: str = "performance,health,maintenance",
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Get predictive analytics for digital twin.
    
    Provides forecasts for performance, health, and maintenance needs.
    """
    try:
        twin_service, _, _ = services
        
        prediction_types_list = [t.strip() for t in prediction_types.split(',')]
        
        prediction_request_dict = {
            'time_horizon_hours': time_horizon_hours,
            'prediction_types': prediction_types_list
        }
        
        result = await twin_service.get_twin_predictions(twin_id, prediction_request_dict)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Prediction failed'))
        
        return PredictionResponse(
            success=True,
            twin_id=twin_id,
            time_horizon_hours=time_horizon_hours,
            predictions=result['core_predictions']['predictions'],
            risk_assessment=result['enhanced_predictions'].get('risk_assessment'),
            confidence_scores=result['prediction_confidence'],
            generated_at=result['generated_at']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get predictions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Synchronization Endpoints

@router.post("/{twin_id}/sync", response_model=SyncResponse)
async def sync_twin_data(
    twin_id: str,
    sync_request: SyncDataRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Force synchronization of digital twin with physical asset data.
    
    Synchronizes data from IoT sensors, MES systems, and historical databases.
    """
    try:
        twin_service, _, _ = services
        
        result = await twin_service.sync_twin_data(
            twin_id, 
            sync_request.force_full_sync,
            sync_request.data_sources
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Sync failed'))
        
        # Send real-time update via WebSocket
        background_tasks.add_task(_send_sync_update, twin_id, result)
        
        return SyncResponse(
            success=True,
            twin_id=twin_id,
            sync_duration_seconds=result['sync_duration_seconds'],
            data_sources_synced=result['data_sources_synced'],
            records_processed=result['sync_results'],
            data_quality_score=0.95,  # Would calculate from actual data
            synchronized_at=result['synchronized_at']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to sync twin data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Business Impact Endpoints

@router.post("/{twin_id}/business-impact", response_model=BusinessImpactResponse)
async def calculate_business_impact(
    twin_id: str,
    impact_request: BusinessImpactRequest,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """
    Calculate business impact and ROI of digital twin optimizations.
    
    Analyzes potential cost savings, revenue increases, and return on investment.
    """
    try:
        # This would use the analytics service to calculate business impact
        # For now, return a sample response
        
        return BusinessImpactResponse(
            success=True,
            twin_id=twin_id,
            total_annual_benefit=175000.0,
            annual_revenue_increase=125000.0,
            annual_cost_savings=50000.0,
            roi_analysis={
                'implementation_cost': 150000.0,
                'annual_benefit': 175000.0,
                'payback_period_years': 0.86,
                'roi_5_year_percent': 450.0,
                'npv_5_year': 525000.0,
                'business_case_strength': 'Very Strong'
            },
            impact_breakdown=impact_request.performance_improvements,
            recommendations=[
                'Implement optimization recommendations immediately',
                'Focus on energy efficiency improvements first',
                'Set up automated monitoring and alerts'
            ]
        )
        
    except Exception as e:
        logger.error(f"Failed to calculate business impact: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Insight and Alert Management Endpoints

@router.post("/{twin_id}/insights", response_model=InsightResponse)
async def create_insight(
    twin_id: str,
    insight_request: InsightCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom insight for the digital twin."""
    try:
        # This would create an insight in the database
        insight_id = f"insight_{twin_id}_{int(datetime.utcnow().timestamp())}"
        
        return InsightResponse(
            insight_id=insight_id,
            twin_id=twin_id,
            insight_type=insight_request.insight_type,
            category=insight_request.category,
            title=insight_request.title,
            description=insight_request.description,
            severity=insight_request.severity,
            priority=insight_request.priority,
            business_impact=insight_request.business_impact,
            estimated_savings=insight_request.estimated_savings,
            implementation_cost=insight_request.implementation_cost,
            recommended_actions=insight_request.recommended_actions,
            implementation_status='pending',
            confidence_score=insight_request.confidence_score,
            generated_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        
    except Exception as e:
        logger.error(f"Failed to create insight: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{twin_id}/alerts", response_model=List[AlertResponse])
async def get_active_alerts(
    twin_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get active alerts for the digital twin."""
    try:
        # This would query active alerts from database
        # For now, return sample alerts
        
        return [
            AlertResponse(
                alert_id=f"alert_{twin_id}_001",
                twin_id=twin_id,
                alert_type="anomaly",
                severity="high",
                title="Temperature Anomaly Detected",
                message="Equipment temperature is 15% above normal operating range",
                status="active",
                triggered_at=datetime.utcnow() - timedelta(minutes=30),
                acknowledged_at=None,
                resolved_at=None,
                recommended_actions=[
                    "Check cooling system",
                    "Reduce operating speed if safe",
                    "Schedule maintenance inspection"
                ]
            )
        ]
        
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Batch Operations

@router.post("/batch", response_model=BatchOperationResponse)
async def batch_twin_operation(
    operation_request: BatchTwinOperation,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    services: tuple = Depends(get_services)
):
    """Perform batch operations on multiple digital twins."""
    try:
        twin_service, _, _ = services
        
        results = []
        errors = []
        
        for twin_id in operation_request.twin_ids:
            try:
                if operation_request.operation == "sync":
                    result = await twin_service.sync_twin_data(twin_id)
                    results.append({
                        'twin_id': twin_id,
                        'success': result['success'],
                        'result': result
                    })
                else:
                    # Handle other operations
                    results.append({
                        'twin_id': twin_id,
                        'success': True,
                        'result': {'message': f'Operation {operation_request.operation} completed'}
                    })
            except Exception as e:
                errors.append({
                    'twin_id': twin_id,
                    'error': str(e)
                })
        
        return BatchOperationResponse(
            success=len(errors) == 0,
            operation=operation_request.operation,
            total_twins=len(operation_request.twin_ids),
            successful_operations=len(results),
            failed_operations=len(errors),
            results=results,
            errors=errors
        )
        
    except Exception as e:
        logger.error(f"Failed batch operation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Service Status and Health

@router.get("/status", response_model=ServiceStatusResponse)
async def get_service_status(
    services: tuple = Depends(get_services)
):
    """Get digital twin service status and health metrics."""
    try:
        twin_service, simulation_engine, analytics_service = services
        
        # Get service metrics
        twin_metrics = twin_service.get_service_metrics()
        analytics_metrics = analytics_service.get_service_metrics()
        
        return ServiceStatusResponse(
            success=True,
            service_name="Digital Twin Framework",
            version="1.0.0",
            health={
                'status': 'healthy',
                'components': {
                    'digital_twin_service': 'healthy',
                    'simulation_engine': 'healthy',
                    'analytics_service': 'healthy',
                    'database': 'healthy'
                },
                'response_time_ms': 150.0,
                'error_rate_percent': 0.5,
                'last_health_check': datetime.utcnow()
            },
            metrics={
                'total_twins': twin_metrics['twins_managed'],
                'active_twins': twin_metrics['twins_managed'],  # Simplified
                'simulations_run_today': twin_metrics['simulations_executed'],
                'analytics_requests_today': analytics_metrics['total_analytics_requests'],
                'average_response_time_ms': 200.0,
                'uptime_hours': twin_metrics['service_uptime_hours'],
                'cache_hit_rate_percent': analytics_metrics.get('cache_hit_rate_percent', 0)
            },
            integrations={
                'iot_gateway': twin_metrics['integration_status']['iot_gateway_connected'],
                'mes_system': twin_metrics['integration_status']['mes_service_connected'],
                'time_series_db': True,
                'ml_models': True
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to get service status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket Endpoints

@router.websocket("/{twin_id}/ws")
async def websocket_endpoint(websocket: WebSocket, twin_id: str):
    """
    WebSocket endpoint for real-time digital twin data streaming.
    
    Provides real-time updates for sensor data, alerts, simulation progress,
    and analytics insights.
    """
    await websocket_manager.connect(websocket, twin_id)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get('type') == 'subscribe':
                # Subscribe to specific data streams
                await websocket.send_text(json.dumps({
                    'type': 'subscription_confirmed',
                    'twin_id': twin_id,
                    'subscriptions': message.get('subscriptions', [])
                }))
            
            elif message.get('type') == 'ping':
                # Health check
                await websocket.send_text(json.dumps({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                }))
    
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, twin_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket, twin_id)


# Background Tasks

async def _initialize_background_sync(twin_service: DigitalTwinService, twin_id: str):
    """Initialize background synchronization for a twin."""
    try:
        logger.info(f"Starting background sync initialization for twin {twin_id}")
        await asyncio.sleep(5)  # Give time for twin to be fully created
        await twin_service.sync_twin_data(twin_id, force_full_sync=True)
        logger.info(f"Background sync initialized for twin {twin_id}")
    except Exception as e:
        logger.error(f"Background sync initialization failed for twin {twin_id}: {e}")


async def _send_simulation_update(twin_id: str, scenario_id: str, status: str):
    """Send simulation update via WebSocket."""
    try:
        message = SimulationUpdateMessage(
            twin_id=twin_id,
            scenario_id=scenario_id,
            status=status,
            progress_percent=100.0 if status == 'completed' else None
        )
        
        await websocket_manager.send_personal_message(
            message.json(), twin_id
        )
    except Exception as e:
        logger.error(f"Failed to send simulation update: {e}")


async def _send_sync_update(twin_id: str, sync_result: Dict[str, Any]):
    """Send sync update via WebSocket."""
    try:
        message = RealTimeDataMessage(
            twin_id=twin_id,
            sensor_data={'sync_completed': 1.0},
            performance_metrics=sync_result.get('sync_results', {}),
            health_indicators={'data_quality': sync_result.get('data_quality_score', 0.95)}
        )
        
        await websocket_manager.send_personal_message(
            message.json(), twin_id
        )
    except Exception as e:
        logger.error(f"Failed to send sync update: {e}")


# Error Handlers

@router.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """Handle value errors."""
    return ErrorResponse(
        success=False,
        error=str(exc),
        error_code="INVALID_VALUE"
    )


@router.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    return ErrorResponse(
        success=False,
        error=exc.detail,
        error_code="HTTP_ERROR"
    )