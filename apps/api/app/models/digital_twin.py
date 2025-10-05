"""
Digital Twin Data Models
========================

SQLAlchemy models for digital twin management, simulation results, and analytics.
Provides database schema for storing digital twin configurations, states, and insights.
"""

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey, JSON, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
from enum import Enum
import uuid

from app.database.models import Base  # Import base from existing models


class TwinType(Enum):
    """Digital twin types."""
    COMPONENT = "component"
    EQUIPMENT = "equipment" 
    PRODUCTION_LINE = "production_line"
    FACTORY = "factory"
    SUPPLY_CHAIN = "supply_chain"


class TwinState(Enum):
    """Digital twin operational states."""
    CREATING = "creating"
    SYNCHRONIZING = "synchronizing"
    ACTIVE = "active"
    SIMULATION = "simulation"
    MAINTENANCE = "maintenance"
    ERROR = "error"
    ARCHIVED = "archived"


class SimulationType(Enum):
    """Types of simulations."""
    PREDICTIVE = "predictive"
    WHAT_IF = "what_if"
    OPTIMIZATION = "optimization"
    FAILURE_ANALYSIS = "failure_analysis"
    MAINTENANCE_PLANNING = "maintenance_planning"


class SimulationStatus(Enum):
    """Simulation execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DigitalTwin(Base):
    """Main digital twin entity."""
    __tablename__ = "digital_twins"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(String, unique=True, index=True, nullable=False)
    twin_name = Column(String, nullable=False)
    twin_type = Column(SQLEnum(TwinType), nullable=False)
    state = Column(SQLEnum(TwinState), default=TwinState.CREATING)
    
    # Metadata
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    facility_id = Column(String)
    asset_id = Column(String, index=True)
    
    # Configuration
    configuration = Column(JSONB)  # Twin configuration parameters
    physics_models = Column(JSONB)  # Physics model definitions
    ml_models = Column(JSONB)  # ML model configurations
    
    # Integration settings
    iot_connections = Column(JSONB)  # IoT integration configuration
    mes_connections = Column(JSONB)  # MES integration configuration
    data_sources = Column(JSONB)  # Connected data sources
    
    # Synchronization settings
    sync_enabled = Column(Boolean, default=True)
    sync_interval_seconds = Column(Integer, default=30)
    auto_sync_enabled = Column(Boolean, default=False)
    
    # Performance metrics
    health_score = Column(Float, default=1.0)
    performance_score = Column(Float, default=0.0)
    data_quality_score = Column(Float, default=1.0)
    last_sync_at = Column(DateTime)
    last_simulation_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    archived_at = Column(DateTime)
    
    # Relationships
    states = relationship("TwinState", back_populates="digital_twin", cascade="all, delete-orphan")
    simulations = relationship("TwinSimulation", back_populates="digital_twin", cascade="all, delete-orphan")
    analytics = relationship("TwinAnalytics", back_populates="digital_twin", cascade="all, delete-orphan")
    insights = relationship("TwinInsight", back_populates="digital_twin", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_digital_twins_state_type', 'state', 'twin_type'),
        Index('ix_digital_twins_facility_asset', 'facility_id', 'asset_id'),
        Index('ix_digital_twins_org_created', 'organization_id', 'created_at'),
    )


class TwinState(Base):
    """Digital twin state history."""
    __tablename__ = "twin_states"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # State data
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    operational_state = Column(String, nullable=False)
    
    # Asset state information
    parameters = Column(JSONB)  # Process parameters
    sensors = Column(JSONB)  # Sensor readings
    performance_metrics = Column(JSONB)  # Performance KPIs
    health_indicators = Column(JSONB)  # Health metrics
    environmental_conditions = Column(JSONB)  # Environmental data
    
    # Quality metrics
    quality_score = Column(Float, default=1.0)
    confidence_score = Column(Float, default=1.0)
    data_completeness = Column(Float, default=1.0)
    
    # Source information
    data_source = Column(String)  # Source of state data
    sync_session_id = Column(String)  # Synchronization session ID
    
    # Flags
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float)
    
    # Relationship
    digital_twin = relationship("DigitalTwin", back_populates="states")
    
    # Indexes
    __table_args__ = (
        Index('ix_twin_states_twin_timestamp', 'twin_id', 'timestamp'),
        Index('ix_twin_states_operational_state', 'operational_state'),
        Index('ix_twin_states_anomaly', 'is_anomaly', 'anomaly_score'),
    )


class TwinSimulation(Base):
    """Digital twin simulation results."""
    __tablename__ = "twin_simulations"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # Simulation metadata
    simulation_id = Column(String, unique=True, nullable=False)
    scenario_name = Column(String, nullable=False)
    simulation_type = Column(SQLEnum(SimulationType), nullable=False)
    status = Column(SQLEnum(SimulationStatus), default=SimulationStatus.PENDING)
    
    # Simulation parameters
    time_horizon_hours = Column(Float, nullable=False)
    parameters = Column(JSONB)  # Input parameters
    constraints = Column(JSONB)  # Simulation constraints
    objectives = Column(JSONB)  # Optimization objectives
    
    # Execution details
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    execution_time_seconds = Column(Float)
    
    # Results
    results = Column(JSONB)  # Simulation results
    performance_predictions = Column(JSONB)  # Performance predictions
    optimization_results = Column(JSONB)  # Optimization outcomes
    
    # Monte Carlo results
    monte_carlo_samples = Column(Integer)
    confidence_intervals = Column(JSONB)
    statistical_summary = Column(JSONB)
    
    # Model information
    physics_models_used = Column(JSONB)
    ml_models_used = Column(JSONB)
    model_accuracy_scores = Column(JSONB)
    
    # Business impact
    business_impact = Column(JSONB)  # Business impact analysis
    roi_analysis = Column(JSONB)  # ROI calculations
    cost_benefit_analysis = Column(JSONB)
    
    # Error handling
    error_message = Column(Text)
    warning_messages = Column(JSONB)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    digital_twin = relationship("DigitalTwin", back_populates="simulations")
    
    # Indexes
    __table_args__ = (
        Index('ix_twin_simulations_twin_type', 'twin_id', 'simulation_type'),
        Index('ix_twin_simulations_status_created', 'status', 'created_at'),
        Index('ix_twin_simulations_scenario', 'scenario_name'),
    )


class TwinAnalytics(Base):
    """Digital twin analytics results."""
    __tablename__ = "twin_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # Analytics metadata
    analytics_id = Column(String, unique=True, nullable=False)
    analysis_type = Column(String, nullable=False)  # performance, energy, anomaly, etc.
    analysis_timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Time range
    time_range_start = Column(DateTime)
    time_range_end = Column(DateTime)
    granularity = Column(String)  # hour, day, week, etc.
    
    # KPI results
    current_kpis = Column(JSONB)  # Current KPI values
    kpi_trends = Column(JSONB)  # KPI trends
    performance_grade = Column(String)  # Overall grade
    performance_score = Column(Float)
    
    # Anomaly detection results
    anomalies_detected = Column(JSONB)  # Detected anomalies
    anomaly_statistics = Column(JSONB)  # Anomaly statistics
    root_cause_analysis = Column(JSONB)  # Root cause analysis
    
    # Energy analysis
    energy_metrics = Column(JSONB)  # Energy performance metrics
    efficiency_opportunities = Column(JSONB)  # Efficiency improvements
    sustainability_metrics = Column(JSONB)  # Environmental impact
    
    # Predictive analytics
    predictions = Column(JSONB)  # Predictive models results
    prediction_accuracy = Column(Float)
    prediction_confidence = Column(Float)
    
    # Business impact
    business_impact = Column(JSONB)  # Business impact analysis
    cost_savings_potential = Column(Float)
    revenue_impact_potential = Column(Float)
    
    # Benchmarking
    benchmark_comparison = Column(JSONB)  # Industry benchmarks
    percentile_ranking = Column(Integer)
    competitive_position = Column(String)
    
    # Data quality
    data_quality_score = Column(Float, default=1.0)
    data_completeness = Column(Float, default=1.0)
    analysis_confidence = Column(Float, default=1.0)
    
    # Processing metadata
    processing_time_seconds = Column(Float)
    data_points_analyzed = Column(Integer)
    models_used = Column(JSONB)
    
    # Relationship
    digital_twin = relationship("DigitalTwin", back_populates="analytics")
    
    # Indexes
    __table_args__ = (
        Index('ix_twin_analytics_twin_type', 'twin_id', 'analysis_type'),
        Index('ix_twin_analytics_timestamp', 'analysis_timestamp'),
        Index('ix_twin_analytics_time_range', 'time_range_start', 'time_range_end'),
    )


class TwinInsight(Base):
    """Digital twin insights and recommendations."""
    __tablename__ = "twin_insights"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    analytics_id = Column(Integer, ForeignKey("twin_analytics.id"))
    
    # Insight metadata
    insight_id = Column(String, unique=True, nullable=False)
    insight_type = Column(String, nullable=False)  # recommendation, alert, optimization
    category = Column(String, nullable=False)  # performance, energy, maintenance, etc.
    
    # Content
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String)  # low, medium, high, critical
    priority = Column(String)  # low, medium, high, critical
    
    # Business context
    business_impact = Column(Text)
    estimated_savings = Column(Float)
    estimated_revenue_impact = Column(Float)
    implementation_cost = Column(Float)
    
    # Implementation details
    recommended_actions = Column(JSONB)  # List of actions
    implementation_effort = Column(String)  # low, medium, high
    estimated_implementation_time = Column(Float)  # hours
    required_resources = Column(JSONB)  # Required resources
    
    # Risk assessment
    risk_level = Column(String)  # low, medium, high
    risk_factors = Column(JSONB)  # Risk factors
    mitigation_strategies = Column(JSONB)  # Risk mitigation
    
    # Success metrics
    success_criteria = Column(JSONB)  # How to measure success
    expected_outcomes = Column(JSONB)  # Expected results
    
    # Timeline and tracking
    target_completion_date = Column(DateTime)
    implementation_status = Column(String, default="pending")  # pending, in_progress, completed, cancelled
    completion_date = Column(DateTime)
    actual_impact = Column(JSONB)  # Actual results after implementation
    
    # Confidence and validation
    confidence_score = Column(Float, default=0.8)
    validation_status = Column(String, default="pending")  # pending, validated, rejected
    feedback_score = Column(Float)  # User feedback
    
    # Source information
    generated_by_model = Column(String)  # Which model generated this insight
    supporting_data = Column(JSONB)  # Supporting data and evidence
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime)  # When insight becomes outdated
    
    # Relationship
    digital_twin = relationship("DigitalTwin", back_populates="insights")
    
    # Indexes
    __table_args__ = (
        Index('ix_twin_insights_twin_category', 'twin_id', 'category'),
        Index('ix_twin_insights_priority_status', 'priority', 'implementation_status'),
        Index('ix_twin_insights_generated_at', 'generated_at'),
        Index('ix_twin_insights_expires_at', 'expires_at'),
    )


class TwinAlert(Base):
    """Digital twin alerts and notifications."""
    __tablename__ = "twin_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # Alert identification
    alert_id = Column(String, unique=True, nullable=False)
    alert_type = Column(String, nullable=False)  # anomaly, performance, maintenance, etc.
    severity = Column(String, nullable=False)  # low, medium, high, critical
    
    # Alert content
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    details = Column(JSONB)  # Additional alert details
    
    # Source information
    triggered_by = Column(String)  # What triggered the alert
    trigger_conditions = Column(JSONB)  # Conditions that triggered alert
    sensor_data = Column(JSONB)  # Related sensor data
    
    # Alert metadata
    triggered_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime)
    acknowledged_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    
    # Status tracking
    status = Column(String, default="active")  # active, acknowledged, resolved, suppressed
    escalation_level = Column(Integer, default=1)
    escalated_at = Column(DateTime)
    
    # Actions and responses
    recommended_actions = Column(JSONB)
    actions_taken = Column(JSONB)
    resolution_notes = Column(Text)
    
    # Business impact
    estimated_impact = Column(String)  # Description of potential impact
    actual_impact = Column(JSONB)  # Actual impact if any
    downtime_minutes = Column(Float)  # Actual downtime caused
    cost_impact = Column(Float)  # Financial impact
    
    # Notification tracking
    notifications_sent = Column(JSONB)  # Record of notifications sent
    notification_channels = Column(JSONB)  # Channels used for notification
    
    # Indexes
    __table_args__ = (
        Index('ix_twin_alerts_twin_severity', 'twin_id', 'severity'),
        Index('ix_twin_alerts_status_triggered', 'status', 'triggered_at'),
        Index('ix_twin_alerts_type_severity', 'alert_type', 'severity'),
    )


class TwinPhysicsModel(Base):
    """Physics-based models for digital twins."""
    __tablename__ = "twin_physics_models"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # Model identification
    model_id = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    model_type = Column(String, nullable=False)  # thermodynamic, mechanical, etc.
    equipment_type = Column(String)  # motor, pump, heat_exchanger, etc.
    
    # Model definition
    equations = Column(JSONB)  # Mathematical equations
    parameters = Column(JSONB)  # Model parameters
    constants = Column(JSONB)  # Physical constants
    material_properties = Column(JSONB)  # Material properties
    
    # Model boundaries and constraints
    valid_range = Column(JSONB)  # Valid parameter ranges
    boundary_conditions = Column(JSONB)  # Boundary conditions
    constraints = Column(JSONB)  # Model constraints
    
    # Calibration and validation
    calibration_data = Column(JSONB)  # Calibration dataset
    validation_metrics = Column(JSONB)  # Validation results
    accuracy_score = Column(Float)
    last_calibrated_at = Column(DateTime)
    
    # Model metadata
    version = Column(String, default="1.0")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Documentation
    description = Column(Text)
    assumptions = Column(JSONB)  # Model assumptions
    limitations = Column(JSONB)  # Known limitations
    references = Column(JSONB)  # Scientific references
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    average_execution_time = Column(Float)  # milliseconds
    
    # Indexes
    __table_args__ = (
        Index('ix_physics_models_twin_type', 'twin_id', 'model_type'),
        Index('ix_physics_models_equipment', 'equipment_type'),
        Index('ix_physics_models_active', 'is_active'),
    )


class TwinMLModel(Base):
    """Machine learning models for digital twins."""
    __tablename__ = "twin_ml_models"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # Model identification
    model_id = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    model_type = Column(String, nullable=False)  # regression, classification, anomaly_detection
    algorithm = Column(String, nullable=False)  # random_forest, neural_network, etc.
    
    # Model purpose
    purpose = Column(String, nullable=False)  # prediction, anomaly_detection, optimization
    target_variables = Column(JSONB)  # Target variables for prediction
    feature_variables = Column(JSONB)  # Input features
    
    # Model artifacts
    model_artifact = Column(Text)  # Serialized model (could be file path or binary)
    preprocessing_pipeline = Column(JSONB)  # Preprocessing steps
    feature_engineering = Column(JSONB)  # Feature engineering steps
    
    # Training information
    training_data_size = Column(Integer)
    training_features = Column(JSONB)  # Features used in training
    hyperparameters = Column(JSONB)  # Model hyperparameters
    
    # Performance metrics
    accuracy_metrics = Column(JSONB)  # R2, RMSE, etc.
    validation_metrics = Column(JSONB)  # Cross-validation results
    test_metrics = Column(JSONB)  # Test set performance
    feature_importance = Column(JSONB)  # Feature importance scores
    
    # Model lifecycle
    version = Column(String, default="1.0")
    trained_at = Column(DateTime)
    last_retrained_at = Column(DateTime)
    next_retraining_at = Column(DateTime)
    
    # Drift detection
    data_drift_score = Column(Float, default=0.0)
    concept_drift_score = Column(Float, default=0.0)
    drift_detection_enabled = Column(Boolean, default=True)
    
    # Model status
    is_active = Column(Boolean, default=True)
    deployment_status = Column(String, default="development")  # development, staging, production
    
    # Usage tracking
    prediction_count = Column(Integer, default=0)
    last_prediction_at = Column(DateTime)
    average_prediction_time = Column(Float)  # milliseconds
    
    # Model monitoring
    performance_degradation = Column(Float, default=0.0)
    alert_thresholds = Column(JSONB)  # Performance alert thresholds
    monitoring_enabled = Column(Boolean, default=True)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Documentation
    description = Column(Text)
    training_notes = Column(Text)
    deployment_notes = Column(Text)
    
    # Indexes
    __table_args__ = (
        Index('ix_ml_models_twin_type', 'twin_id', 'model_type'),
        Index('ix_ml_models_purpose_status', 'purpose', 'deployment_status'),
        Index('ix_ml_models_active', 'is_active'),
        Index('ix_ml_models_retraining', 'next_retraining_at'),
    )


class TwinSynchronization(Base):
    """Digital twin synchronization sessions."""
    __tablename__ = "twin_synchronizations"
    
    id = Column(Integer, primary_key=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id"), nullable=False)
    
    # Synchronization metadata
    sync_id = Column(String, unique=True, nullable=False)
    sync_type = Column(String, nullable=False)  # manual, automatic, scheduled
    sync_scope = Column(JSONB)  # What data was synchronized
    
    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    duration_seconds = Column(Float)
    
    # Data sources
    data_sources_synced = Column(JSONB)  # List of data sources
    iot_connections_used = Column(JSONB)  # IoT connections
    mes_connections_used = Column(JSONB)  # MES connections
    
    # Sync statistics
    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    
    # Data quality
    data_quality_score = Column(Float)
    completeness_score = Column(Float)
    timeliness_score = Column(Float)
    
    # Status and results
    status = Column(String, default="running")  # running, completed, failed, partial
    success_rate = Column(Float)
    error_messages = Column(JSONB)
    warning_messages = Column(JSONB)
    
    # Performance metrics
    throughput_records_per_second = Column(Float)
    data_volume_mb = Column(Float)
    processing_efficiency = Column(Float)
    
    # Triggered by
    triggered_by = Column(String)  # user, schedule, event, threshold
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Indexes
    __table_args__ = (
        Index('ix_twin_sync_twin_started', 'twin_id', 'started_at'),
        Index('ix_twin_sync_status', 'status'),
        Index('ix_twin_sync_type', 'sync_type'),
    )


# Database utility functions for digital twins
def create_digital_twin_tables(engine):
    """Create all digital twin tables."""
    Base.metadata.create_all(bind=engine)


def get_twin_performance_summary(session, twin_id: int) -> dict:
    """Get performance summary for a digital twin."""
    from sqlalchemy import func, desc
    
    # Get latest analytics
    latest_analytics = session.query(TwinAnalytics).filter(
        TwinAnalytics.twin_id == twin_id
    ).order_by(desc(TwinAnalytics.analysis_timestamp)).first()
    
    # Get recent simulations
    recent_simulations = session.query(func.count(TwinSimulation.id)).filter(
        TwinSimulation.twin_id == twin_id,
        TwinSimulation.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    ).scalar()
    
    # Get active alerts
    active_alerts = session.query(func.count(TwinAlert.id)).filter(
        TwinAlert.twin_id == twin_id,
        TwinAlert.status == 'active'
    ).scalar()
    
    return {
        'latest_analytics': latest_analytics,
        'simulations_today': recent_simulations,
        'active_alerts': active_alerts
    }


def get_twin_health_metrics(session, twin_id: int, hours_back: int = 24) -> dict:
    """Get health metrics for a digital twin."""
    from sqlalchemy import and_
    
    cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
    
    # Get recent states
    recent_states = session.query(TwinState).filter(
        and_(
            TwinState.twin_id == twin_id,
            TwinState.timestamp >= cutoff_time
        )
    ).order_by(desc(TwinState.timestamp)).all()
    
    if not recent_states:
        return {'error': 'No recent state data'}
    
    # Calculate health metrics
    avg_quality = sum(state.quality_score for state in recent_states) / len(recent_states)
    anomaly_count = sum(1 for state in recent_states if state.is_anomaly)
    anomaly_rate = anomaly_count / len(recent_states)
    
    return {
        'average_quality_score': avg_quality,
        'anomaly_count': anomaly_count,
        'anomaly_rate': anomaly_rate,
        'data_points': len(recent_states),
        'time_range_hours': hours_back
    }