"""Add feedback learning system tables

Revision ID: 003_feedback_learning_system
Revises: 002_performance_indexes
Create Date: 2025-08-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_feedback_learning_system'
down_revision = '002_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create feedback learning system tables"""
    
    # Create feedback type enum
    feedback_type_enum = postgresql.ENUM(
        'transformation_rating',
        'prediction_accuracy',
        'pattern_relevance',
        'data_quality_improvement',
        'feature_usefulness',
        'model_performance',
        'ui_experience',
        'api_satisfaction',
        name='feedbacktypeenum'
    )
    feedback_type_enum.create(op.get_bind())
    
    # Create feedback sentiment enum
    feedback_sentiment_enum = postgresql.ENUM(
        'positive',
        'negative',
        'neutral',
        name='feedbacksentimentenum'
    )
    feedback_sentiment_enum.create(op.get_bind())
    
    # Create user_feedback table
    op.create_table('user_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('feedback_type', feedback_type_enum, nullable=False),
        sa.Column('rating', sa.Float(), nullable=True),
        sa.Column('binary_feedback', sa.Boolean(), nullable=True),
        sa.Column('text_feedback', sa.Text(), nullable=True),
        sa.Column('sentiment', feedback_sentiment_enum, nullable=True),
        sa.Column('service_name', sa.String(), nullable=True),
        sa.Column('operation_type', sa.String(), nullable=True),
        sa.Column('context_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('processed', sa.Boolean(), nullable=True),
        sa.Column('processing_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for user_feedback
    op.create_index('idx_user_feedback_user_type', 'user_feedback', ['user_id', 'feedback_type'])
    op.create_index('idx_user_feedback_service', 'user_feedback', ['service_name', 'created_at'])
    op.create_index('idx_user_feedback_rating', 'user_feedback', ['rating', 'feedback_type'])
    
    # Create user_learning_profiles table
    op.create_table('user_learning_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expertise_level', sa.String(), nullable=True),
        sa.Column('preferences', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('behavior_patterns', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('total_feedback_count', sa.Integer(), nullable=True),
        sa.Column('average_satisfaction', sa.Float(), nullable=True),
        sa.Column('engagement_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_activity', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    
    # Create learning_rules table
    op.create_table('learning_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rule_id', sa.String(), nullable=False),
        sa.Column('rule_type', sa.String(), nullable=False),
        sa.Column('condition', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('action', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('support', sa.Integer(), nullable=True),
        sa.Column('effectiveness', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('validation_count', sa.Integer(), nullable=True),
        sa.Column('last_validated', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rule_id')
    )
    
    # Create indexes for learning_rules
    op.create_index('idx_learning_rules_type_confidence', 'learning_rules', ['rule_type', 'confidence'])
    op.create_index('idx_learning_rules_active', 'learning_rules', ['is_active', 'confidence'])
    
    # Create ab_tests table
    op.create_table('ab_tests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('test_name', sa.String(), nullable=False),
        sa.Column('test_id', sa.String(), nullable=False),
        sa.Column('variants', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('success_metric', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('results', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('winner_variant', sa.String(), nullable=True),
        sa.Column('confidence_level', sa.Float(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('test_id')
    )
    
    # Create ab_test_results table
    op.create_table('ab_test_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('test_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('variant_name', sa.String(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('context_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['test_id'], ['ab_tests.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for ab_test_results
    op.create_index('idx_ab_test_results_test_variant', 'ab_test_results', ['test_id', 'variant_name'])
    op.create_index('idx_ab_test_results_user', 'ab_test_results', ['user_id', 'recorded_at'])
    
    # Create service_improvement_logs table
    op.create_table('service_improvement_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('service_name', sa.String(), nullable=False),
        sa.Column('improvement_type', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('old_configuration', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('new_configuration', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('feedback_basis', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('expected_impact', sa.String(), nullable=True),
        sa.Column('measured_impact', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('implemented', sa.Boolean(), nullable=True),
        sa.Column('implementation_notes', sa.Text(), nullable=True),
        sa.Column('rollback_needed', sa.Boolean(), nullable=True),
        sa.Column('created_by_rule', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('implemented_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_rule'], ['learning_rules.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop feedback learning system tables"""
    
    # Drop tables in reverse order
    op.drop_table('service_improvement_logs')
    op.drop_table('ab_test_results')
    op.drop_table('ab_tests')
    op.drop_table('learning_rules')
    op.drop_table('user_learning_profiles')
    op.drop_table('user_feedback')
    
    # Drop enums
    feedback_sentiment_enum = postgresql.ENUM(name='feedbacksentimentenum')
    feedback_sentiment_enum.drop(op.get_bind())
    
    feedback_type_enum = postgresql.ENUM(name='feedbacktypeenum')
    feedback_type_enum.drop(op.get_bind())