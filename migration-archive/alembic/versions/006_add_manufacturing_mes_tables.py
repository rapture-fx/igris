"""add_manufacturing_mes_tables

Revision ID: 006_mes_integration
Revises: 005_database_performance_optimization
Create Date: 2025-09-08 17:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006_mes_integration'
down_revision = '005_database_performance_optimization'
branch_labels = None
depends_on = None


def upgrade():
    """Create Manufacturing Execution System (MES) integration tables."""
    
    # Create MES system types enum
    mes_system_type_enum = postgresql.ENUM(
        'sap_me', 'sap_dmc', 'siemens_mindshpere', 'siemens_opcenter', 
        'rockwell_factorytalk', 'generic_rest', 'custom',
        name='messystemtype'
    )
    mes_system_type_enum.create(op.get_bind())
    
    # Create connection status enum
    connection_status_enum = postgresql.ENUM(
        'disconnected', 'connecting', 'connected', 'error', 'authenticating', 'syncing',
        name='connectionstatus'
    )
    connection_status_enum.create(op.get_bind())
    
    # Create work order status enum
    work_order_status_enum = postgresql.ENUM(
        'planned', 'released', 'started', 'paused', 'completed', 'cancelled', 'on_hold',
        name='workorderstatus'
    )
    work_order_status_enum.create(op.get_bind())
    
    # Create production priority enum
    production_priority_enum = postgresql.ENUM(
        'low', 'normal', 'high', 'urgent', 'critical',
        name='productionpriority'
    )
    production_priority_enum.create(op.get_bind())
    
    # Create quality status enum
    quality_status_enum = postgresql.ENUM(
        'passed', 'failed', 'pending', 'in_review', 'rework_required', 'quarantined',
        name='qualitystatus'
    )
    quality_status_enum.create(op.get_bind())
    
    # Create MES system connections table
    op.create_table(
        'mes_system_connections',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('connection_id', sa.String(100), unique=True, nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), nullable=False, index=True),
        
        # Connection details
        sa.Column('system_name', sa.String(200), nullable=False),
        sa.Column('system_type', mes_system_type_enum, nullable=False),
        sa.Column('facility_id', sa.String(100), nullable=False),
        sa.Column('plant_code', sa.String(50)),
        
        # Connection configuration
        sa.Column('endpoint_url', sa.String(500), nullable=False),
        sa.Column('authentication_method', sa.String(50), nullable=False, default='oauth2'),
        sa.Column('connection_config', sa.JSON()),
        sa.Column('api_version', sa.String(20)),
        
        # Status and monitoring
        sa.Column('status', connection_status_enum, default='disconnected'),
        sa.Column('last_connected_at', sa.DateTime()),
        sa.Column('last_sync_at', sa.DateTime()),
        sa.Column('last_error_message', sa.Text()),
        sa.Column('health_score', sa.Float(), default=0.0),
        
        # Performance metrics
        sa.Column('total_work_orders_synced', sa.Integer(), default=0),
        sa.Column('total_production_records', sa.Integer(), default=0),
        sa.Column('sync_success_rate', sa.Float(), default=0.0),
        sa.Column('avg_response_time_ms', sa.Float(), default=0.0),
        
        # Configuration and metadata
        sa.Column('auto_sync_enabled', sa.Boolean(), default=True),
        sa.Column('sync_interval_minutes', sa.Integer(), default=15),
        sa.Column('enabled_modules', sa.JSON()),
        sa.Column('custom_field_mappings', sa.JSON()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    
    # Create indexes for MES system connections
    op.create_index('idx_mes_user_status', 'mes_system_connections', ['user_id', 'status'])
    op.create_index('idx_mes_facility_type', 'mes_system_connections', ['facility_id', 'system_type'])
    
    # Create work orders table
    op.create_table(
        'work_orders',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('work_order_id', sa.String(100), nullable=False, index=True),
        sa.Column('mes_system_id', sa.Integer(), sa.ForeignKey('mes_system_connections.id'), nullable=False),
        
        # Basic work order information
        sa.Column('work_order_number', sa.String(100), nullable=False),
        sa.Column('product_code', sa.String(100), nullable=False),
        sa.Column('product_name', sa.String(200)),
        sa.Column('product_version', sa.String(50)),
        sa.Column('batch_number', sa.String(100)),
        sa.Column('lot_number', sa.String(100)),
        
        # Production details
        sa.Column('planned_quantity', sa.Float(), nullable=False),
        sa.Column('produced_quantity', sa.Float(), default=0.0),
        sa.Column('rejected_quantity', sa.Float(), default=0.0),
        sa.Column('unit_of_measure', sa.String(20), nullable=False),
        
        # Scheduling
        sa.Column('planned_start_time', sa.DateTime()),
        sa.Column('planned_end_time', sa.DateTime()),
        sa.Column('actual_start_time', sa.DateTime()),
        sa.Column('actual_end_time', sa.DateTime()),
        sa.Column('estimated_duration_hours', sa.Float()),
        sa.Column('actual_duration_hours', sa.Float()),
        
        # Status and priority
        sa.Column('status', work_order_status_enum, default='planned'),
        sa.Column('priority', production_priority_enum, default='normal'),
        sa.Column('completion_percentage', sa.Float(), default=0.0),
        
        # Resource assignment
        sa.Column('assigned_line_id', sa.String(100)),
        sa.Column('assigned_equipment_ids', sa.JSON()),
        sa.Column('assigned_operators', sa.JSON()),
        sa.Column('resource_requirements', sa.JSON()),
        
        # Quality and compliance
        sa.Column('quality_requirements', sa.JSON()),
        sa.Column('compliance_requirements', sa.JSON()),
        sa.Column('routing_sequence', sa.JSON()),
        
        # Cost and performance
        sa.Column('standard_cost_per_unit', sa.Float()),
        sa.Column('actual_cost_per_unit', sa.Float()),
        sa.Column('setup_time_minutes', sa.Float()),
        sa.Column('cycle_time_minutes', sa.Float()),
        sa.Column('efficiency_target_percentage', sa.Float(), default=85.0),
        sa.Column('actual_efficiency_percentage', sa.Float()),
        
        # Metadata and tracking
        sa.Column('customer_order_ref', sa.String(100)),
        sa.Column('sales_order_number', sa.String(100)),
        sa.Column('delivery_date', sa.DateTime()),
        sa.Column('special_instructions', sa.Text()),
        sa.Column('external_references', sa.JSON()),
        sa.Column('custom_attributes', sa.JSON()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('synced_at', sa.DateTime()),
    )
    
    # Create indexes for work orders
    op.create_index('idx_wo_status_priority', 'work_orders', ['status', 'priority'])
    op.create_index('idx_wo_product_batch', 'work_orders', ['product_code', 'batch_number'])
    op.create_index('idx_wo_scheduled_times', 'work_orders', ['planned_start_time', 'planned_end_time'])
    op.create_unique_constraint('uq_work_order_mes', 'work_orders', ['work_order_number', 'mes_system_id'])
    
    # Create production schedules table
    op.create_table(
        'production_schedules',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('schedule_id', sa.String(100), nullable=False, index=True),
        sa.Column('mes_system_id', sa.Integer(), sa.ForeignKey('mes_system_connections.id'), nullable=False),
        
        # Schedule details
        sa.Column('schedule_name', sa.String(200), nullable=False),
        sa.Column('facility_id', sa.String(100), nullable=False),
        sa.Column('production_line_id', sa.String(100)),
        
        # Time planning
        sa.Column('schedule_start_date', sa.DateTime(), nullable=False),
        sa.Column('schedule_end_date', sa.DateTime(), nullable=False),
        sa.Column('planning_horizon_days', sa.Integer(), default=30),
        
        # Schedule data
        sa.Column('scheduled_work_orders', sa.JSON()),
        sa.Column('resource_allocations', sa.JSON()),
        sa.Column('capacity_utilization', sa.JSON()),
        
        # Optimization parameters
        sa.Column('optimization_objectives', sa.JSON()),
        sa.Column('constraints', sa.JSON()),
        sa.Column('optimization_algorithm', sa.String(50)),
        sa.Column('optimization_score', sa.Float()),
        
        # Performance tracking
        sa.Column('adherence_percentage', sa.Float(), default=0.0),
        sa.Column('schedule_changes_count', sa.Integer(), default=0),
        sa.Column('disruptions_log', sa.JSON()),
        
        # Status and metadata
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_optimized', sa.Boolean(), default=False),
        sa.Column('locked_until', sa.DateTime()),
        sa.Column('version', sa.Integer(), default=1),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('optimized_at', sa.DateTime()),
    )
    
    # Create indexes for production schedules
    op.create_index('idx_schedule_facility_active', 'production_schedules', ['facility_id', 'is_active'])
    op.create_index('idx_schedule_dates', 'production_schedules', ['schedule_start_date', 'schedule_end_date'])
    
    # Create production records table
    op.create_table(
        'production_records',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('record_id', sa.String(100), nullable=False, index=True),
        sa.Column('work_order_id', sa.Integer(), sa.ForeignKey('work_orders.id'), nullable=False),
        
        # Production details
        sa.Column('equipment_id', sa.String(100), nullable=False),
        sa.Column('operator_id', sa.String(100)),
        sa.Column('shift_id', sa.String(50)),
        
        # Quantity tracking
        sa.Column('quantity_produced', sa.Float(), nullable=False),
        sa.Column('quantity_rejected', sa.Float(), default=0.0),
        sa.Column('quantity_reworked', sa.Float(), default=0.0),
        sa.Column('unit_of_measure', sa.String(20)),
        
        # Timing
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime()),
        sa.Column('duration_minutes', sa.Float()),
        sa.Column('setup_time_minutes', sa.Float()),
        
        # Performance metrics
        sa.Column('cycle_time_actual', sa.Float()),
        sa.Column('cycle_time_target', sa.Float()),
        sa.Column('efficiency_percentage', sa.Float()),
        sa.Column('downtime_minutes', sa.Float(), default=0.0),
        sa.Column('downtime_reasons', sa.JSON()),
        
        # Quality and compliance
        sa.Column('first_pass_yield_percentage', sa.Float()),
        sa.Column('defect_codes', sa.JSON()),
        sa.Column('inspection_results', sa.JSON()),
        
        # Cost tracking
        sa.Column('labor_cost', sa.Float()),
        sa.Column('material_cost', sa.Float()),
        sa.Column('overhead_cost', sa.Float()),
        sa.Column('total_cost', sa.Float()),
        
        # Metadata
        sa.Column('notes', sa.Text()),
        sa.Column('attachments', sa.JSON()),
        sa.Column('custom_data', sa.JSON()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create indexes for production records
    op.create_index('idx_production_equipment_time', 'production_records', ['equipment_id', 'start_time'])
    op.create_index('idx_production_shift', 'production_records', ['shift_id', 'start_time'])
    
    # Create quality records table
    op.create_table(
        'quality_records',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('quality_record_id', sa.String(100), nullable=False, index=True),
        sa.Column('mes_system_id', sa.Integer(), sa.ForeignKey('mes_system_connections.id'), nullable=False),
        sa.Column('work_order_id', sa.Integer(), sa.ForeignKey('work_orders.id')),
        
        # Quality details
        sa.Column('inspection_type', sa.String(100), nullable=False),
        sa.Column('inspection_point', sa.String(100)),
        sa.Column('inspector_id', sa.String(100)),
        sa.Column('equipment_used', sa.String(100)),
        
        # Item details
        sa.Column('item_identifier', sa.String(100)),
        sa.Column('product_code', sa.String(100)),
        sa.Column('batch_number', sa.String(100)),
        sa.Column('lot_number', sa.String(100)),
        
        # Quality measurements
        sa.Column('measured_values', sa.JSON()),
        sa.Column('specifications', sa.JSON()),
        sa.Column('test_results', sa.JSON()),
        
        # Quality status and decisions
        sa.Column('overall_status', quality_status_enum, nullable=False),
        sa.Column('passed_tests', sa.Integer(), default=0),
        sa.Column('failed_tests', sa.Integer(), default=0),
        sa.Column('defects_found', sa.JSON()),
        
        # Process control
        sa.Column('statistical_data', sa.JSON()),
        sa.Column('control_limits', sa.JSON()),
        sa.Column('out_of_control_points', sa.JSON()),
        
        # Actions and disposition
        sa.Column('disposition', sa.String(50)),
        sa.Column('corrective_actions', sa.Text()),
        sa.Column('preventive_actions', sa.Text()),
        sa.Column('follow_up_required', sa.Boolean(), default=False),
        
        # Compliance and traceability
        sa.Column('standards_referenced', sa.JSON()),
        sa.Column('certificates', sa.JSON()),
        sa.Column('traceability_data', sa.JSON()),
        
        # Timing
        sa.Column('inspection_start_time', sa.DateTime()),
        sa.Column('inspection_end_time', sa.DateTime()),
        sa.Column('inspection_duration_minutes', sa.Float()),
        
        # Cost impact
        sa.Column('cost_of_quality', sa.Float()),
        sa.Column('cost_of_poor_quality', sa.Float()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create indexes for quality records
    op.create_index('idx_quality_status_type', 'quality_records', ['overall_status', 'inspection_type'])
    op.create_index('idx_quality_product_batch', 'quality_records', ['product_code', 'batch_number'])
    op.create_index('idx_quality_inspection_time', 'quality_records', ['inspection_start_time'])
    
    # Create material movements table
    op.create_table(
        'material_movements',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('movement_id', sa.String(100), nullable=False, index=True),
        sa.Column('work_order_id', sa.Integer(), sa.ForeignKey('work_orders.id')),
        
        # Material details
        sa.Column('material_code', sa.String(100), nullable=False),
        sa.Column('material_description', sa.String(200)),
        sa.Column('batch_number', sa.String(100)),
        sa.Column('lot_number', sa.String(100)),
        sa.Column('serial_number', sa.String(100)),
        
        # Movement details
        sa.Column('movement_type', sa.String(50), nullable=False),
        sa.Column('from_location', sa.String(100)),
        sa.Column('to_location', sa.String(100)),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_of_measure', sa.String(20)),
        
        # Cost and valuation
        sa.Column('unit_cost', sa.Float()),
        sa.Column('total_cost', sa.Float()),
        sa.Column('currency', sa.String(3)),
        
        # Tracking and traceability
        sa.Column('supplier_info', sa.JSON()),
        sa.Column('expiry_date', sa.DateTime()),
        sa.Column('quality_status', sa.String(50)),
        sa.Column('quarantine_status', sa.Boolean(), default=False),
        
        # Transaction details
        sa.Column('transaction_id', sa.String(100)),
        sa.Column('reference_document', sa.String(100)),
        sa.Column('reason_code', sa.String(50)),
        
        # Timing
        sa.Column('movement_date', sa.DateTime(), nullable=False),
        sa.Column('requested_date', sa.DateTime()),
        
        # User tracking
        sa.Column('requested_by', sa.String(100)),
        sa.Column('approved_by', sa.String(100)),
        sa.Column('processed_by', sa.String(100)),
        
        # Metadata
        sa.Column('notes', sa.Text()),
        sa.Column('attachments', sa.JSON()),
        sa.Column('custom_attributes', sa.JSON()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create indexes for material movements
    op.create_index('idx_material_code_type', 'material_movements', ['material_code', 'movement_type'])
    op.create_index('idx_material_locations', 'material_movements', ['from_location', 'to_location'])
    op.create_index('idx_material_movement_date', 'material_movements', ['movement_date'])
    
    # Create OEE metrics table
    op.create_table(
        'oee_metrics',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('metric_id', sa.String(100), nullable=False, index=True),
        
        # Equipment and timing
        sa.Column('equipment_id', sa.String(100), nullable=False, index=True),
        sa.Column('facility_id', sa.String(100), nullable=False),
        sa.Column('measurement_period_start', sa.DateTime(), nullable=False),
        sa.Column('measurement_period_end', sa.DateTime(), nullable=False),
        
        # OEE components
        sa.Column('availability_percentage', sa.Float(), nullable=False),
        sa.Column('performance_percentage', sa.Float(), nullable=False),
        sa.Column('quality_percentage', sa.Float(), nullable=False),
        
        # Overall OEE
        sa.Column('oee_percentage', sa.Float(), nullable=False),
        
        # Detailed availability metrics
        sa.Column('planned_run_time_minutes', sa.Float()),
        sa.Column('actual_run_time_minutes', sa.Float()),
        sa.Column('downtime_minutes', sa.Float()),
        sa.Column('planned_downtime_minutes', sa.Float()),
        sa.Column('unplanned_downtime_minutes', sa.Float()),
        
        # Detailed performance metrics
        sa.Column('ideal_cycle_time_seconds', sa.Float()),
        sa.Column('total_pieces_produced', sa.Integer()),
        sa.Column('ideal_pieces_for_run_time', sa.Integer()),
        sa.Column('performance_rate_pieces_per_minute', sa.Float()),
        
        # Detailed quality metrics
        sa.Column('good_pieces', sa.Integer()),
        sa.Column('rejected_pieces', sa.Integer()),
        sa.Column('reworked_pieces', sa.Integer()),
        sa.Column('first_pass_yield_percentage', sa.Float()),
        
        # Downtime analysis
        sa.Column('downtime_categories', sa.JSON()),
        sa.Column('top_loss_events', sa.JSON()),
        
        # Benchmarking
        sa.Column('target_oee_percentage', sa.Float()),
        sa.Column('world_class_benchmark', sa.Float(), default=85.0),
        sa.Column('improvement_potential', sa.Float()),
        
        # Shift and operational context
        sa.Column('shift', sa.String(20)),
        sa.Column('operator_ids', sa.JSON()),
        sa.Column('product_mix', sa.JSON()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create indexes for OEE metrics
    op.create_index('idx_oee_equipment_period', 'oee_metrics', ['equipment_id', 'measurement_period_start'])
    op.create_index('idx_oee_facility_period', 'oee_metrics', ['facility_id', 'measurement_period_start'])
    
    # Create production alerts table
    op.create_table(
        'production_alerts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('alert_id', sa.String(100), nullable=False, index=True),
        
        # Alert classification
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('category', sa.String(50)),
        
        # Source information
        sa.Column('source_system', sa.String(100)),
        sa.Column('equipment_id', sa.String(100)),
        sa.Column('work_order_id', sa.String(100)),
        sa.Column('facility_id', sa.String(100)),
        
        # Alert details
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('root_cause', sa.Text()),
        sa.Column('recommended_actions', sa.JSON()),
        
        # Impact assessment
        sa.Column('production_impact', sa.String(50)),
        sa.Column('quality_impact', sa.String(50)),
        sa.Column('cost_impact', sa.Float()),
        sa.Column('schedule_impact_hours', sa.Float()),
        
        # Status and resolution
        sa.Column('status', sa.String(20), default='open'),
        sa.Column('acknowledged', sa.Boolean(), default=False),
        sa.Column('acknowledged_by', sa.String(100)),
        sa.Column('acknowledged_at', sa.DateTime()),
        sa.Column('assigned_to', sa.String(100)),
        sa.Column('resolved_by', sa.String(100)),
        sa.Column('resolved_at', sa.DateTime()),
        sa.Column('resolution_notes', sa.Text()),
        
        # Escalation
        sa.Column('escalation_level', sa.Integer(), default=0),
        sa.Column('escalated_to', sa.String(100)),
        sa.Column('escalation_deadline', sa.DateTime()),
        
        # Timing
        sa.Column('triggered_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('first_occurrence', sa.DateTime()),
        sa.Column('last_occurrence', sa.DateTime()),
        sa.Column('occurrence_count', sa.Integer(), default=1),
        
        # Analytics
        sa.Column('similar_alerts_count', sa.Integer(), default=0),
        sa.Column('pattern_identified', sa.Boolean(), default=False),
        sa.Column('prevention_suggestions', sa.JSON()),
        
        # Metadata
        sa.Column('custom_attributes', sa.JSON()),
        sa.Column('attachments', sa.JSON()),
        
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create indexes for production alerts
    op.create_index('idx_alert_severity_status', 'production_alerts', ['severity', 'status'])
    op.create_index('idx_alert_equipment_type', 'production_alerts', ['equipment_id', 'alert_type'])
    op.create_index('idx_alert_triggered_at', 'production_alerts', ['triggered_at'])


def downgrade():
    """Remove Manufacturing Execution System (MES) integration tables."""
    
    # Drop tables in reverse dependency order
    op.drop_table('production_alerts')
    op.drop_table('oee_metrics')
    op.drop_table('material_movements')
    op.drop_table('quality_records')
    op.drop_table('production_records')
    op.drop_table('production_schedules')
    op.drop_table('work_orders')
    op.drop_table('mes_system_connections')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS qualitystatus CASCADE')
    op.execute('DROP TYPE IF EXISTS productionpriority CASCADE')
    op.execute('DROP TYPE IF EXISTS workorderstatus CASCADE')
    op.execute('DROP TYPE IF EXISTS connectionstatus CASCADE')
    op.execute('DROP TYPE IF EXISTS messystemtype CASCADE')