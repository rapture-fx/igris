"""
Manufacturing Execution System (MES) Integration API Schemas
==========================================================

Pydantic schemas for MES integration API endpoints providing:
- Request/response validation for MES connectivity
- Work order management schemas
- Production scheduling and optimization schemas
- Quality management and traceability schemas
- Performance analytics and reporting schemas
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from enum import Enum

from app.models.manufacturing_mes import (
    MESSystemType, ConnectionStatus, WorkOrderStatus, 
    ProductionPriority, QualityStatus
)


# Base response schemas

class BaseResponse(BaseModel):
    """Base response schema."""
    success: bool
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# MES System Connection Schemas

class MESConnectionConfig(BaseModel):
    """MES system connection configuration."""
    system_name: str = Field(..., min_length=1, max_length=200)
    system_type: MESSystemType
    facility_id: str = Field(..., min_length=1, max_length=100)
    plant_code: Optional[str] = Field(None, max_length=50)
    
    # Connection details
    endpoint_url: str = Field(..., min_length=1, max_length=500)
    authentication_method: str = Field(default="oauth2", max_length=50)
    api_version: Optional[str] = Field(None, max_length=20)
    
    # Connection parameters
    connection_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    enabled_modules: Optional[List[str]] = Field(default_factory=list)
    custom_field_mappings: Optional[Dict[str, str]] = Field(default_factory=dict)
    
    # Sync configuration
    auto_sync_enabled: bool = Field(default=True)
    sync_interval_minutes: int = Field(default=15, ge=5, le=1440)


class MESConnectionRequest(BaseModel):
    """Request to connect to MES system."""
    connection_id: str = Field(..., min_length=1, max_length=100)
    connection_config: MESConnectionConfig
    
    # Authentication credentials
    credentials: Dict[str, Any] = Field(..., description="Authentication credentials")
    
    # Connection options
    validate_connection: bool = Field(default=True)
    enable_real_time_sync: bool = Field(default=True)
    initial_sync_scope: Optional[List[str]] = Field(default=None)


class MESConnectionResponse(BaseResponse):
    """Response for MES system connection."""
    connection_id: str
    status: ConnectionStatus
    system_info: Optional[Dict[str, Any]] = None
    available_modules: Optional[List[str]] = None
    sync_status: Optional[Dict[str, Any]] = None


class MESSystemInfo(BaseModel):
    """MES system information."""
    connection_id: str
    system_name: str
    system_type: MESSystemType
    facility_id: str
    status: ConnectionStatus
    
    # Performance metrics
    health_score: float = Field(ge=0.0, le=1.0)
    uptime_hours: float
    last_sync_at: Optional[datetime] = None
    sync_success_rate: float = Field(ge=0.0, le=100.0)
    avg_response_time_ms: float
    
    # Data statistics
    total_work_orders: int
    active_work_orders: int
    production_lines_connected: int
    quality_records_count: int
    
    # Configuration
    enabled_modules: List[str]
    auto_sync_enabled: bool
    sync_interval_minutes: int


class MESConnectionListResponse(BaseResponse):
    """Response for listing MES connections."""
    connections: List[MESSystemInfo]
    total_connections: int


# Work Order Management Schemas

class WorkOrderCreate(BaseModel):
    """Schema for creating work orders."""
    work_order_number: str = Field(..., min_length=1, max_length=100)
    product_code: str = Field(..., min_length=1, max_length=100)
    product_name: Optional[str] = Field(None, max_length=200)
    product_version: Optional[str] = Field(None, max_length=50)
    
    # Production details
    planned_quantity: float = Field(..., gt=0)
    unit_of_measure: str = Field(..., max_length=20)
    batch_number: Optional[str] = Field(None, max_length=100)
    lot_number: Optional[str] = Field(None, max_length=100)
    
    # Scheduling
    planned_start_time: Optional[datetime] = None
    planned_end_time: Optional[datetime] = None
    estimated_duration_hours: Optional[float] = Field(None, gt=0)
    
    # Priority and assignment
    priority: ProductionPriority = Field(default=ProductionPriority.NORMAL)
    assigned_line_id: Optional[str] = Field(None, max_length=100)
    assigned_equipment_ids: Optional[List[str]] = Field(default_factory=list)
    assigned_operators: Optional[List[str]] = Field(default_factory=list)
    
    # Requirements and specifications
    quality_requirements: Optional[Dict[str, Any]] = Field(default_factory=dict)
    resource_requirements: Optional[Dict[str, Any]] = Field(default_factory=dict)
    routing_sequence: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    
    # Cost and targets
    standard_cost_per_unit: Optional[float] = Field(None, gt=0)
    efficiency_target_percentage: float = Field(default=85.0, ge=0, le=100)
    
    # References and metadata
    customer_order_ref: Optional[str] = Field(None, max_length=100)
    sales_order_number: Optional[str] = Field(None, max_length=100)
    delivery_date: Optional[datetime] = None
    special_instructions: Optional[str] = None
    custom_attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)


class WorkOrderUpdate(BaseModel):
    """Schema for updating work orders."""
    status: Optional[WorkOrderStatus] = None
    produced_quantity: Optional[float] = Field(None, ge=0)
    rejected_quantity: Optional[float] = Field(None, ge=0)
    
    # Timing updates
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    actual_duration_hours: Optional[float] = Field(None, gt=0)
    
    # Performance updates
    completion_percentage: Optional[float] = Field(None, ge=0, le=100)
    actual_efficiency_percentage: Optional[float] = Field(None, ge=0, le=200)
    actual_cost_per_unit: Optional[float] = Field(None, gt=0)
    
    # Resource updates
    assigned_operators: Optional[List[str]] = None
    setup_time_minutes: Optional[float] = Field(None, ge=0)
    cycle_time_minutes: Optional[float] = Field(None, gt=0)
    
    # Metadata updates
    special_instructions: Optional[str] = None
    custom_attributes: Optional[Dict[str, Any]] = None


class WorkOrderInfo(BaseModel):
    """Work order information schema."""
    work_order_id: str
    work_order_number: str
    product_code: str
    product_name: Optional[str] = None
    
    # Production details
    planned_quantity: float
    produced_quantity: float
    rejected_quantity: float
    unit_of_measure: str
    completion_percentage: float
    
    # Status and timing
    status: WorkOrderStatus
    priority: ProductionPriority
    planned_start_time: Optional[datetime] = None
    planned_end_time: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    
    # Performance metrics
    efficiency_percentage: Optional[float] = None
    cycle_time_minutes: Optional[float] = None
    downtime_minutes: Optional[float] = None
    
    # Assignment
    assigned_line_id: Optional[str] = None
    assigned_equipment_ids: List[str]
    assigned_operators: List[str]
    
    # Metadata
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None


class WorkOrderListResponse(BaseResponse):
    """Response for work order listing."""
    work_orders: List[WorkOrderInfo]
    total_count: int
    filters_applied: Dict[str, Any]
    pagination: Optional[Dict[str, int]] = None


# Production Scheduling Schemas

class ProductionScheduleRequest(BaseModel):
    """Request for production schedule creation/optimization."""
    schedule_name: str = Field(..., min_length=1, max_length=200)
    facility_id: str = Field(..., min_length=1, max_length=100)
    production_line_id: Optional[str] = Field(None, max_length=100)
    
    # Time planning
    schedule_start_date: datetime
    schedule_end_date: datetime
    planning_horizon_days: int = Field(default=30, ge=1, le=365)
    
    # Work orders to schedule
    work_order_ids: List[str] = Field(..., min_items=1)
    
    # Optimization parameters
    optimization_objectives: List[str] = Field(
        default=["maximize_throughput", "minimize_makespan"],
        description="Optimization objectives: maximize_throughput, minimize_makespan, minimize_cost, maximize_efficiency"
    )
    constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)
    optimization_algorithm: str = Field(default="genetic_algorithm")
    
    # Scheduling preferences
    consider_material_availability: bool = Field(default=True)
    consider_resource_capacity: bool = Field(default=True)
    allow_overtime: bool = Field(default=False)
    consider_setup_times: bool = Field(default=True)


class ScheduleOptimizationResult(BaseModel):
    """Result of schedule optimization."""
    optimization_score: float
    objectives_achieved: Dict[str, float]
    schedule_duration_hours: float
    resource_utilization_percentage: float
    
    # Performance predictions
    estimated_throughput: float
    estimated_completion_date: datetime
    estimated_total_cost: float
    
    # Optimization metadata
    algorithm_used: str
    iterations_performed: int
    computation_time_seconds: float
    constraints_satisfied: Dict[str, bool]


class ProductionScheduleResponse(BaseResponse):
    """Response for production schedule operations."""
    schedule_id: str
    schedule_name: str
    facility_id: str
    
    # Schedule details
    scheduled_work_orders: List[Dict[str, Any]]
    resource_allocations: Dict[str, Any]
    capacity_utilization: Dict[str, Any]
    
    # Optimization results
    optimization_result: Optional[ScheduleOptimizationResult] = None
    
    # Schedule status
    is_active: bool
    is_optimized: bool
    adherence_percentage: float
    
    # Timing
    schedule_start_date: datetime
    schedule_end_date: datetime
    created_at: datetime
    optimized_at: Optional[datetime] = None


# Quality Management Schemas

class QualityInspectionRequest(BaseModel):
    """Request for quality inspection recording."""
    work_order_id: Optional[str] = None
    inspection_type: str = Field(..., max_length=100)
    inspection_point: Optional[str] = Field(None, max_length=100)
    inspector_id: Optional[str] = Field(None, max_length=100)
    
    # Item details
    item_identifier: Optional[str] = Field(None, max_length=100)
    product_code: Optional[str] = Field(None, max_length=100)
    batch_number: Optional[str] = Field(None, max_length=100)
    
    # Quality measurements
    measured_values: Dict[str, float] = Field(..., min_items=1)
    specifications: Optional[Dict[str, Dict[str, float]]] = None
    test_results: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # Quality status
    overall_status: QualityStatus
    defects_found: Optional[List[str]] = Field(default_factory=list)
    
    # Process control data
    statistical_data: Optional[Dict[str, float]] = Field(default_factory=dict)
    control_limits: Optional[Dict[str, Dict[str, float]]] = None
    
    # Actions and disposition
    disposition: Optional[str] = Field(None, max_length=50)
    corrective_actions: Optional[str] = None
    preventive_actions: Optional[str] = None
    
    # Timing
    inspection_start_time: Optional[datetime] = None
    inspection_end_time: Optional[datetime] = None
    
    # Cost and compliance
    cost_of_quality: Optional[float] = Field(None, ge=0)
    standards_referenced: Optional[List[str]] = Field(default_factory=list)


class QualityRecordInfo(BaseModel):
    """Quality record information."""
    quality_record_id: str
    inspection_type: str
    overall_status: QualityStatus
    
    # Item details
    product_code: Optional[str] = None
    batch_number: Optional[str] = None
    item_identifier: Optional[str] = None
    
    # Quality metrics
    passed_tests: int
    failed_tests: int
    first_pass_yield_percentage: Optional[float] = None
    
    # Statistical data
    statistical_data: Dict[str, float]
    out_of_control_points: Optional[List[Dict[str, Any]]] = None
    
    # Actions taken
    disposition: Optional[str] = None
    corrective_actions: Optional[str] = None
    follow_up_required: bool
    
    # Timing and cost
    inspection_start_time: Optional[datetime] = None
    inspection_duration_minutes: Optional[float] = None
    cost_of_poor_quality: Optional[float] = None
    
    created_at: datetime


class QualityReportRequest(BaseModel):
    """Request for quality data reporting."""
    report_type: str = Field(..., description="daily_summary, weekly_trend, spc_analysis, defect_analysis")
    facility_id: Optional[str] = None
    product_codes: Optional[List[str]] = None
    date_from: datetime
    date_to: datetime
    
    # Report parameters
    include_trends: bool = Field(default=True)
    include_spc_data: bool = Field(default=True)
    include_cost_analysis: bool = Field(default=False)
    
    # Filters
    inspection_types: Optional[List[str]] = None
    quality_status_filter: Optional[List[QualityStatus]] = None
    
    # Output format
    format: str = Field(default="json", pattern="^(json|csv|pdf)$")


# OEE and Performance Analytics Schemas

class OEECalculationRequest(BaseModel):
    """Request for OEE calculation."""
    equipment_id: str = Field(..., max_length=100)
    measurement_period_start: datetime
    measurement_period_end: datetime
    
    # Calculation parameters
    include_planned_downtime: bool = Field(default=True)
    target_oee_percentage: Optional[float] = Field(None, ge=0, le=100)
    benchmark_comparison: bool = Field(default=True)
    
    # Data sources
    include_real_time_data: bool = Field(default=True)
    data_sources: Optional[List[str]] = Field(default_factory=list)


class OEEMetrics(BaseModel):
    """OEE metrics data."""
    equipment_id: str
    measurement_period_start: datetime
    measurement_period_end: datetime
    
    # OEE components
    availability_percentage: float = Field(ge=0, le=100)
    performance_percentage: float = Field(ge=0, le=200)  # Can exceed 100% if faster than ideal
    quality_percentage: float = Field(ge=0, le=100)
    
    # Overall OEE
    oee_percentage: float = Field(ge=0, le=100)
    
    # Detailed metrics
    planned_run_time_minutes: float
    actual_run_time_minutes: float
    downtime_minutes: float
    total_pieces_produced: int
    good_pieces: int
    rejected_pieces: int
    
    # Performance analysis
    ideal_cycle_time_seconds: float
    performance_rate_pieces_per_minute: float
    first_pass_yield_percentage: float
    
    # Benchmarking
    target_oee_percentage: Optional[float] = None
    world_class_benchmark: float = Field(default=85.0)
    improvement_potential: float
    
    # Loss analysis
    downtime_categories: Dict[str, float]  # Category: minutes
    top_loss_events: List[Dict[str, Any]]
    
    # Operational context
    shift: Optional[str] = None
    operator_ids: List[str]
    product_mix: Dict[str, int]  # Product: quantity


class OEEAnalysisResponse(BaseResponse):
    """Response for OEE analysis."""
    equipment_id: str
    oee_metrics: OEEMetrics
    
    # Analysis insights
    performance_trends: Dict[str, List[float]]
    improvement_opportunities: List[Dict[str, Any]]
    benchmarking_analysis: Dict[str, Any]
    
    # Recommendations
    recommended_actions: List[str]
    potential_improvements: Dict[str, float]
    maintenance_recommendations: Optional[List[str]] = None


# Production Analytics and Optimization Schemas

class ProductionOptimizationRequest(BaseModel):
    """Request for production optimization."""
    facility_id: str = Field(..., max_length=100)
    optimization_scope: str = Field(..., description="line, facility, plant")
    optimization_timeframe: str = Field(..., description="shift, daily, weekly, monthly")
    
    # Optimization targets
    target_equipment_ids: Optional[List[str]] = None
    target_product_codes: Optional[List[str]] = None
    
    # Optimization objectives
    primary_objective: str = Field(..., description="throughput, cost, quality, oee, lead_time")
    secondary_objectives: Optional[List[str]] = Field(default_factory=list)
    objective_weights: Optional[Dict[str, float]] = Field(default_factory=dict)
    
    # Constraints
    capacity_constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)
    resource_constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)
    quality_constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # Optimization parameters
    algorithm: str = Field(default="multi_objective_genetic")
    max_iterations: int = Field(default=1000, ge=100, le=10000)
    convergence_threshold: float = Field(default=0.001, gt=0)
    
    # Data considerations
    historical_data_days: int = Field(default=30, ge=7, le=365)
    include_external_factors: bool = Field(default=True)
    consider_demand_forecast: bool = Field(default=True)


class OptimizationResult(BaseModel):
    """Production optimization result."""
    optimization_id: str
    facility_id: str
    optimization_scope: str
    
    # Optimization outcomes
    current_performance: Dict[str, float]
    optimized_performance: Dict[str, float]
    improvement_potential: Dict[str, float]
    
    # Recommended changes
    equipment_utilization_changes: Dict[str, Dict[str, float]]
    scheduling_recommendations: List[Dict[str, Any]]
    resource_reallocation: Optional[Dict[str, Any]] = None
    
    # Implementation plan
    implementation_steps: List[Dict[str, Any]]
    estimated_roi: Optional[float] = None
    implementation_timeline_days: Optional[int] = None
    
    # Analysis metadata
    algorithm_used: str
    iterations_performed: int
    convergence_achieved: bool
    computation_time_seconds: float
    confidence_score: float = Field(ge=0, le=1)


class ProductionOptimizationResponse(BaseResponse):
    """Response for production optimization."""
    optimization_result: OptimizationResult
    
    # Performance projections
    performance_projections: Dict[str, List[float]]
    risk_analysis: Dict[str, Any]
    sensitivity_analysis: Optional[Dict[str, Any]] = None
    
    # Monitoring recommendations
    kpi_monitoring_plan: List[Dict[str, str]]
    alert_thresholds: Dict[str, Dict[str, float]]


# Sync and Data Management Schemas

class SyncDataRequest(BaseModel):
    """Request for data synchronization with MES."""
    connection_id: str
    sync_scope: List[str] = Field(..., description="work_orders, schedules, quality, materials, oee")
    
    # Sync parameters
    full_sync: bool = Field(default=False)
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    
    # Filters
    facility_filter: Optional[List[str]] = None
    equipment_filter: Optional[List[str]] = None
    product_filter: Optional[List[str]] = None
    
    # Sync options
    validate_data: bool = Field(default=True)
    resolve_conflicts: bool = Field(default=True)
    backup_before_sync: bool = Field(default=True)


class SyncResult(BaseModel):
    """Data synchronization result."""
    sync_id: str
    connection_id: str
    sync_scope: List[str]
    
    # Sync statistics
    records_processed: Dict[str, int]  # Entity type: count
    records_created: Dict[str, int]
    records_updated: Dict[str, int]
    records_failed: Dict[str, int]
    
    # Sync status
    success: bool
    errors: List[Dict[str, str]]
    warnings: List[str]
    
    # Performance metrics
    sync_duration_seconds: float
    throughput_records_per_second: float
    
    # Data quality
    data_quality_score: float = Field(ge=0, le=1)
    validation_issues: List[Dict[str, str]]
    
    # Timing
    started_at: datetime
    completed_at: datetime


class SyncStatusResponse(BaseResponse):
    """Response for sync status and results."""
    sync_results: List[SyncResult]
    last_successful_sync: Optional[datetime] = None
    next_scheduled_sync: Optional[datetime] = None
    sync_health_status: str  # healthy, degraded, error
    
    # Sync performance trends
    sync_performance_trends: Optional[Dict[str, List[float]]] = None
    data_quality_trends: Optional[Dict[str, List[float]]] = None


# Alert and Notification Schemas

class ProductionAlertCreate(BaseModel):
    """Schema for creating production alerts."""
    alert_type: str = Field(..., max_length=50)
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    category: Optional[str] = Field(None, max_length=50)
    
    # Source information
    equipment_id: Optional[str] = Field(None, max_length=100)
    work_order_id: Optional[str] = Field(None, max_length=100)
    facility_id: Optional[str] = Field(None, max_length=100)
    
    # Alert content
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    root_cause: Optional[str] = None
    recommended_actions: Optional[List[str]] = Field(default_factory=list)
    
    # Impact assessment
    production_impact: Optional[str] = Field(None, pattern="^(none|low|medium|high)$")
    quality_impact: Optional[str] = Field(None, pattern="^(none|low|medium|high)$")
    cost_impact: Optional[float] = Field(None, ge=0)
    schedule_impact_hours: Optional[float] = Field(None, ge=0)
    
    # Escalation
    escalation_level: int = Field(default=0, ge=0, le=5)
    escalated_to: Optional[str] = Field(None, max_length=100)
    escalation_deadline: Optional[datetime] = None
    
    # Metadata
    custom_attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ProductionAlertInfo(BaseModel):
    """Production alert information."""
    alert_id: str
    alert_type: str
    severity: str
    status: str
    
    # Alert content
    title: str
    description: Optional[str] = None
    root_cause: Optional[str] = None
    recommended_actions: List[str]
    
    # Source and context
    equipment_id: Optional[str] = None
    work_order_id: Optional[str] = None
    facility_id: Optional[str] = None
    
    # Impact
    production_impact: Optional[str] = None
    cost_impact: Optional[float] = None
    schedule_impact_hours: Optional[float] = None
    
    # Status tracking
    acknowledged: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    
    # Timing
    triggered_at: datetime
    occurrence_count: int
    
    # Analytics
    similar_alerts_count: int
    pattern_identified: bool


class AlertListResponse(BaseResponse):
    """Response for alert listing."""
    alerts: List[ProductionAlertInfo]
    total_count: int
    
    # Summary statistics
    alerts_by_severity: Dict[str, int]
    alerts_by_type: Dict[str, int]
    acknowledged_count: int
    resolved_count: int
    
    # Filters applied
    filters_applied: Dict[str, Any]


# Configuration and validation

class Config:
    """Pydantic configuration."""
    use_enum_values = True
    validate_assignment = True
    arbitrary_types_allowed = True