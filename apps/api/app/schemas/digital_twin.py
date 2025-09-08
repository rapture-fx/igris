"""
Digital Twin API Schemas
========================

Pydantic schemas for digital twin API requests and responses.
Provides data validation and serialization for digital twin operations.
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from enum import Enum


class TwinType(str, Enum):
    """Digital twin types."""
    COMPONENT = "component"
    EQUIPMENT = "equipment"
    PRODUCTION_LINE = "production_line"
    FACTORY = "factory"
    SUPPLY_CHAIN = "supply_chain"


class TwinState(str, Enum):
    """Digital twin operational states."""
    CREATING = "creating"
    SYNCHRONIZING = "synchronizing"
    ACTIVE = "active"
    SIMULATION = "simulation"
    MAINTENANCE = "maintenance"
    ERROR = "error"
    ARCHIVED = "archived"


class SimulationType(str, Enum):
    """Types of simulations."""
    PREDICTIVE = "predictive"
    WHAT_IF = "what_if"
    OPTIMIZATION = "optimization"
    FAILURE_ANALYSIS = "failure_analysis"
    MAINTENANCE_PLANNING = "maintenance_planning"


class AnalyticsType(str, Enum):
    """Types of analytics."""
    PERFORMANCE = "performance"
    PREDICTIVE = "predictive"
    ANOMALY = "anomaly"
    ENERGY = "energy"
    QUALITY = "quality"
    MAINTENANCE = "maintenance"
    BUSINESS_IMPACT = "business_impact"
    BENCHMARKING = "benchmarking"


class OptimizationAlgorithm(str, Enum):
    """Optimization algorithms."""
    GENETIC_ALGORITHM = "genetic_algorithm"
    PARTICLE_SWARM = "particle_swarm"
    SIMULATED_ANNEALING = "simulated_annealing"
    GRADIENT_DESCENT = "gradient_descent"
    BAYESIAN_OPTIMIZATION = "bayesian_optimization"


class Priority(str, Enum):
    """Priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Severity(str, Enum):
    """Severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Base schemas
class BaseResponse(BaseModel):
    """Base response schema."""
    success: bool
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseResponse):
    """Error response schema."""
    success: bool = False
    error: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


# Configuration schemas
class IoTIntegrationConfig(BaseModel):
    """IoT integration configuration."""
    enabled: bool = False
    connection_ids: List[str] = []
    equipment_ids: List[str] = []
    sensor_mappings: Dict[str, str] = {}
    data_filters: Dict[str, Any] = {}
    real_time_enabled: bool = True


class MESIntegrationConfig(BaseModel):
    """MES integration configuration."""
    enabled: bool = False
    connection_id: str
    work_order_sync: bool = True
    production_data_sync: bool = True
    quality_data_sync: bool = True
    sync_interval_minutes: int = 15


class SynchronizationConfig(BaseModel):
    """Synchronization configuration."""
    auto_sync_enabled: bool = False
    interval_seconds: int = 30
    real_time_enabled: bool = False
    data_sources: List[str] = []
    sync_scope: List[str] = ["sensors", "process_data", "performance_metrics"]
    quality_threshold: float = 0.8


class ComponentConfiguration(BaseModel):
    """Component-specific configuration."""
    component_type: str
    specifications: Dict[str, Any] = {}
    failure_modes: List[Dict[str, Any]] = []
    maintenance_schedule: Optional[Dict[str, Any]] = None
    operating_limits: Dict[str, Any] = {}
    sensors: List[Dict[str, Any]] = []


class EquipmentConfiguration(BaseModel):
    """Equipment-specific configuration."""
    equipment_type: str
    components: Dict[str, ComponentConfiguration] = {}
    process_parameters: Dict[str, Any] = {}
    performance_targets: Dict[str, float] = {}
    maintenance_strategy: str = "predictive"
    energy_baseline: Optional[Dict[str, float]] = None


class PhysicsModelConfig(BaseModel):
    """Physics model configuration."""
    model_type: str
    equations: List[str] = []
    parameters: Dict[str, float] = {}
    constraints: Dict[str, Any] = {}
    valid_ranges: Dict[str, List[float]] = {}
    material_properties: Dict[str, Any] = {}


class MLModelConfig(BaseModel):
    """Machine learning model configuration."""
    model_type: str = "random_forest"
    algorithm: str = "RandomForestRegressor"
    features: List[str] = []
    targets: List[str] = []
    hyperparameters: Dict[str, Any] = {}
    training_config: Dict[str, Any] = {}
    retraining_enabled: bool = True
    retraining_interval_days: int = 30


# Digital Twin schemas
class DigitalTwinCreate(BaseModel):
    """Schema for creating a digital twin."""
    twin_id: str = Field(..., min_length=1, max_length=100, description="Unique twin identifier")
    twin_name: str = Field(..., min_length=1, max_length=200, description="Human-readable twin name")
    twin_type: TwinType
    description: Optional[str] = Field(None, max_length=1000)
    facility_id: Optional[str] = None
    asset_id: Optional[str] = None
    
    # Configuration
    configuration: Union[ComponentConfiguration, EquipmentConfiguration, Dict[str, Any]]
    physics_models: List[PhysicsModelConfig] = []
    ml_models: List[MLModelConfig] = []
    
    # Integration settings
    iot_integration: Optional[IoTIntegrationConfig] = None
    mes_integration: Optional[MESIntegrationConfig] = None
    synchronization: Optional[SynchronizationConfig] = None
    
    # Historical data loading
    historical_data: Optional[Dict[str, Any]] = None
    
    @validator('twin_id')
    def validate_twin_id(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Twin ID must contain only alphanumeric characters, hyphens, and underscores')
        return v


class DigitalTwinUpdate(BaseModel):
    """Schema for updating a digital twin."""
    twin_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    state: Optional[TwinState] = None
    configuration: Optional[Dict[str, Any]] = None
    synchronization: Optional[SynchronizationConfig] = None


class DigitalTwinResponse(BaseResponse):
    """Schema for digital twin response."""
    twin_id: str
    twin_name: str
    twin_type: TwinType
    state: TwinState
    description: Optional[str]
    facility_id: Optional[str]
    asset_id: Optional[str]
    health_score: float
    performance_score: float
    data_quality_score: float
    last_sync_at: Optional[datetime]
    last_simulation_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class AssetStateResponse(BaseModel):
    """Schema for asset state response."""
    asset_id: str
    timestamp: datetime
    operational_state: str
    parameters: Dict[str, float] = {}
    sensors: Dict[str, float] = {}
    performance_metrics: Dict[str, float] = {}
    health_indicators: Dict[str, float] = {}
    environmental_conditions: Dict[str, float] = {}
    quality_score: float
    confidence: float


# Simulation schemas
class SimulationScenarioRequest(BaseModel):
    """Schema for simulation scenario request."""
    scenario_id: Optional[str] = None
    scenario_name: str = Field(..., min_length=1, max_length=200)
    simulation_type: SimulationType
    time_horizon_hours: float = Field(..., gt=0, le=8760, description="Time horizon in hours (max 1 year)")
    parameters: Dict[str, Any] = {}
    constraints: Dict[str, Any] = {}
    objectives: List[str] = []
    monte_carlo_samples: int = Field(100, ge=10, le=10000)
    confidence_level: float = Field(0.95, ge=0.5, le=0.99)
    
    @validator('time_horizon_hours')
    def validate_time_horizon(cls, v):
        if v <= 0:
            raise ValueError('Time horizon must be positive')
        return v


class MonteCarloConfig(BaseModel):
    """Monte Carlo simulation configuration."""
    num_samples: int = Field(1000, ge=10, le=100000)
    confidence_levels: List[float] = [0.95, 0.99]
    random_seed: Optional[int] = None
    parallel_execution: bool = True


class OptimizationRequest(BaseModel):
    """Schema for optimization request."""
    objectives: List[str] = Field(..., min_items=1)
    variables: Dict[str, Dict[str, float]] = {}
    constraints: Optional[Dict[str, Any]] = None
    algorithm: OptimizationAlgorithm = OptimizationAlgorithm.GENETIC_ALGORITHM
    max_iterations: int = Field(100, ge=10, le=1000)
    tolerance: float = Field(1e-6, gt=0)


class SimulationResponse(BaseResponse):
    """Schema for simulation response."""
    twin_id: str
    scenario_id: str
    simulation_type: SimulationType
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    execution_time_seconds: Optional[float]
    results: Dict[str, Any]
    business_impact: Optional[Dict[str, Any]] = None


# Analytics schemas
class AnalyticsRequest(BaseModel):
    """Schema for analytics request."""
    twin_id: str
    analytics_types: List[AnalyticsType] = [AnalyticsType.PERFORMANCE]
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    granularity: str = "hour"
    include_predictions: bool = True
    include_recommendations: bool = True
    benchmark_comparison: bool = False
    
    @validator('analytics_types')
    def validate_analytics_types(cls, v):
        if not v:
            raise ValueError('At least one analytics type must be specified')
        return v


class KPIResult(BaseModel):
    """KPI result schema."""
    name: str
    value: float
    unit: str
    target: Optional[float] = None
    status: str  # meets_target, below_target, above_target
    trend: Optional[str] = None  # improving, declining, stable
    importance: float = 1.0


class AnomalyResult(BaseModel):
    """Anomaly detection result schema."""
    timestamp: datetime
    variable_name: str
    anomaly_score: float
    severity: Severity
    description: str
    root_cause: Optional[Dict[str, Any]] = None
    recommended_actions: List[str] = []


class PredictionResult(BaseModel):
    """Prediction result schema."""
    variable_name: str
    predicted_value: float
    confidence_interval_lower: Optional[float] = None
    confidence_interval_upper: Optional[float] = None
    prediction_horizon_hours: float
    confidence_score: float
    model_used: str


class RecommendationResult(BaseModel):
    """Recommendation result schema."""
    category: str
    priority: Priority
    title: str
    description: str
    estimated_impact: str
    implementation_effort: str
    estimated_cost: Optional[float] = None
    estimated_savings: Optional[float] = None
    payback_period_months: Optional[float] = None
    recommended_actions: List[str] = []


class AnalyticsResponse(BaseResponse):
    """Schema for analytics response."""
    twin_id: str
    analysis_timestamp: datetime
    time_range_hours: Optional[float] = None
    analytics_types: List[AnalyticsType]
    
    # Results by category
    performance_kpis: Optional[Dict[str, KPIResult]] = None
    anomalies: Optional[List[AnomalyResult]] = None
    predictions: Optional[List[PredictionResult]] = None
    energy_metrics: Optional[Dict[str, Any]] = None
    quality_metrics: Optional[Dict[str, Any]] = None
    
    # Analysis results
    overall_score: Optional[float] = None
    performance_grade: Optional[str] = None
    health_score: Optional[float] = None
    
    # Business impact
    business_impact: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[RecommendationResult]] = None
    
    # Benchmarking
    benchmark_comparison: Optional[Dict[str, Any]] = None


# Synchronization schemas
class SyncDataRequest(BaseModel):
    """Schema for data synchronization request."""
    twin_id: str
    force_full_sync: bool = False
    data_sources: Optional[List[str]] = None
    sync_scope: List[str] = ["sensors", "process_data", "performance_metrics"]
    
    @validator('sync_scope')
    def validate_sync_scope(cls, v):
        valid_scopes = ["sensors", "process_data", "performance_metrics", "historical"]
        for scope in v:
            if scope not in valid_scopes:
                raise ValueError(f"Invalid sync scope: {scope}")
        return v


class SyncResponse(BaseResponse):
    """Schema for synchronization response."""
    twin_id: str
    sync_duration_seconds: float
    data_sources_synced: List[str]
    records_processed: Dict[str, int]
    data_quality_score: float
    synchronized_at: datetime


# Insight and Alert schemas
class InsightCreate(BaseModel):
    """Schema for creating an insight."""
    insight_type: str
    category: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    severity: Severity = Severity.MEDIUM
    priority: Priority = Priority.MEDIUM
    business_impact: Optional[str] = None
    estimated_savings: Optional[float] = None
    implementation_cost: Optional[float] = None
    recommended_actions: List[str] = []
    confidence_score: float = Field(0.8, ge=0.0, le=1.0)


class InsightResponse(BaseModel):
    """Schema for insight response."""
    insight_id: str
    twin_id: str
    insight_type: str
    category: str
    title: str
    description: str
    severity: Severity
    priority: Priority
    business_impact: Optional[str]
    estimated_savings: Optional[float]
    implementation_cost: Optional[float]
    recommended_actions: List[str]
    implementation_status: str
    confidence_score: float
    generated_at: datetime
    expires_at: Optional[datetime]


class AlertCreate(BaseModel):
    """Schema for creating an alert."""
    alert_type: str
    severity: Severity
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    details: Optional[Dict[str, Any]] = None
    recommended_actions: List[str] = []


class AlertResponse(BaseModel):
    """Schema for alert response."""
    alert_id: str
    twin_id: str
    alert_type: str
    severity: Severity
    title: str
    message: str
    status: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    recommended_actions: List[str]


# Business Impact schemas
class BusinessContext(BaseModel):
    """Business context for impact analysis."""
    production_rate_units_per_hour: float = 100
    operating_hours_per_year: int = 8760
    unit_revenue: float = 50
    labor_cost_per_hour: float = 65
    energy_cost_per_kwh: float = 0.12
    maintenance_cost_per_year: float = 100000
    digital_twin_implementation_cost: float = 150000
    discount_rate: float = 0.08


class BusinessImpactRequest(BaseModel):
    """Schema for business impact analysis request."""
    twin_id: str
    performance_improvements: Dict[str, float]
    business_context: Optional[BusinessContext] = None
    analysis_period_years: int = Field(5, ge=1, le=10)


class ROIAnalysis(BaseModel):
    """ROI analysis result schema."""
    implementation_cost: float
    annual_benefit: float
    payback_period_years: float
    roi_5_year_percent: float
    npv_5_year: float
    business_case_strength: str


class BusinessImpactResponse(BaseResponse):
    """Schema for business impact response."""
    twin_id: str
    total_annual_benefit: float
    annual_revenue_increase: float
    annual_cost_savings: float
    roi_analysis: ROIAnalysis
    impact_breakdown: Dict[str, Any]
    recommendations: List[str]


# Prediction schemas
class PredictionRequest(BaseModel):
    """Schema for prediction request."""
    twin_id: str
    time_horizon_hours: float = Field(168.0, gt=0, le=8760)  # Default 1 week
    prediction_types: List[str] = ["performance", "health", "maintenance"]
    confidence_level: float = Field(0.95, ge=0.5, le=0.99)
    include_uncertainty: bool = True


class MaintenancePrediction(BaseModel):
    """Maintenance prediction schema."""
    urgency: str  # low, medium, high
    estimated_time_to_maintenance_hours: float
    recommended_actions: List[str]
    confidence: float
    cost_estimate: Optional[float] = None


class PredictionResponse(BaseResponse):
    """Schema for prediction response."""
    twin_id: str
    time_horizon_hours: float
    predictions: Dict[str, Any]
    maintenance_predictions: Optional[MaintenancePrediction] = None
    risk_assessment: Optional[Dict[str, Any]] = None
    confidence_scores: Dict[str, float]
    generated_at: datetime


# WebSocket schemas
class WebSocketMessage(BaseModel):
    """Base WebSocket message schema."""
    message_type: str
    twin_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = {}


class RealTimeDataMessage(WebSocketMessage):
    """Real-time data WebSocket message."""
    message_type: str = "realtime_data"
    sensor_data: Dict[str, float]
    performance_metrics: Dict[str, float]
    health_indicators: Dict[str, float]


class AlertMessage(WebSocketMessage):
    """Alert WebSocket message."""
    message_type: str = "alert"
    alert: AlertResponse


class SimulationUpdateMessage(WebSocketMessage):
    """Simulation update WebSocket message."""
    message_type: str = "simulation_update"
    scenario_id: str
    status: str
    progress_percent: Optional[float] = None


# Service Status schemas
class ServiceMetrics(BaseModel):
    """Service metrics schema."""
    total_twins: int
    active_twins: int
    simulations_run_today: int
    analytics_requests_today: int
    average_response_time_ms: float
    uptime_hours: float
    cache_hit_rate_percent: float


class ServiceHealth(BaseModel):
    """Service health schema."""
    status: str  # healthy, degraded, unhealthy
    components: Dict[str, str]  # component -> status
    response_time_ms: float
    error_rate_percent: float
    last_health_check: datetime


class ServiceStatusResponse(BaseResponse):
    """Schema for service status response."""
    service_name: str = "Digital Twin Framework"
    version: str = "1.0.0"
    health: ServiceHealth
    metrics: ServiceMetrics
    integrations: Dict[str, bool]  # integration -> connected


# Batch operation schemas
class BatchTwinOperation(BaseModel):
    """Schema for batch twin operations."""
    operation: str  # create, update, delete, sync
    twin_ids: List[str] = Field(..., min_items=1, max_items=100)
    parameters: Optional[Dict[str, Any]] = None


class BatchOperationResponse(BaseResponse):
    """Schema for batch operation response."""
    operation: str
    total_twins: int
    successful_operations: int
    failed_operations: int
    results: List[Dict[str, Any]]
    errors: List[Dict[str, str]]