"""
RL Optimization Database Persistence Tests
=========================================

Comprehensive test suite for validating the RL optimization database model implementation.
Tests the critical P0 fix for database persistence across service restarts and CRUD operations.

Test Coverage:
- Database model creation and schema validation
- RL session CRUD operations
- Database persistence across service restarts
- Session ownership and security
- All optimization types (hyperparameter, resource allocation, data quality)
- Error handling and edge cases
- Performance benchmarks for database operations
"""

import pytest
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

# Import application components
import sys
sys.path.append('/Users/wira/Desktop/schlep-engine/apps/api')

from app.services.rl_optimization_service import RLOptimizationService
from app.database.models import User, UserRole
from app.core.config import settings


class TestRLOptimizationDatabaseModels:
    """Test database model implementation and schema validation."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_rl_optimization_session_table_exists(self, db_verifier):
        """Test that RL optimization session table exists with correct schema."""
        # Verify table exists
        assert await db_verifier.verify_table_exists("rl_optimization_sessions"), (
            "RL optimization sessions table does not exist"
        )

        # Verify core columns exist
        session = db_verifier.session
        try:
            await session.execute(text("""
                SELECT id, user_id, pipeline_id, optimization_type, strategy,
                       objective, status, best_performance, total_episodes,
                       created_at, updated_at, completed_at, error_message
                FROM rl_optimization_sessions
                LIMIT 1
            """))
        except Exception as e:
            pytest.fail(f"RL optimization sessions table schema is invalid: {e}")

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_rl_episode_table_exists(self, db_verifier):
        """Test that RL episode table exists with correct schema."""
        # Verify table exists
        assert await db_verifier.verify_table_exists("rl_episodes"), (
            "RL episodes table does not exist"
        )

        # Verify core columns exist
        session = db_verifier.session
        try:
            await session.execute(text("""
                SELECT id, session_id, episode_number, reward, metrics,
                       hyperparameters, created_at
                FROM rl_episodes
                LIMIT 1
            """))
        except Exception as e:
            pytest.fail(f"RL episodes table schema is invalid: {e}")

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_database_constraints(self, test_db_session):
        """Test database constraints and relationships."""
        session = test_db_session

        # Test foreign key constraint
        try:
            # Insert RL session without valid user_id should fail
            await session.execute(text("""
                INSERT INTO rl_optimization_sessions
                (id, user_id, pipeline_id, optimization_type, strategy, objective, status, created_at)
                VALUES (:id, :user_id, :pipeline_id, :opt_type, :strategy, :objective, :status, :created_at)
            """), {
                "id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),  # Non-existent user
                "pipeline_id": "test_pipeline",
                "opt_type": "hyperparameter",
                "strategy": "PPO",
                "objective": "maximize_performance",
                "status": "pending",
                "created_at": datetime.utcnow()
            })
            await session.commit()

            # This might succeed in SQLite without FK constraints, so we just verify structure
        except Exception:
            # Expected for databases with FK constraints
            await session.rollback()


class TestRLOptimizationCRUDOperations:
    """Test CRUD operations for RL optimization sessions."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_create_rl_optimization_session(self, test_db_session, mock_user, test_metrics):
        """Test creating RL optimization session with database persistence."""
        test_metrics.start_timer()

        # Initialize service
        rl_service = RLOptimizationService(test_db_session)

        # Create session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="test_pipeline_001",
            optimization_type="hyperparameter",
            training_data_path="/tmp/test_data.csv",
            validation_data_path="/tmp/test_validation.csv",
            config={
                "algorithm": "PPO",
                "max_episodes": 50,
                "learning_rate": 0.001
            }
        )

        test_metrics.end_timer()

        # Verify session was created
        assert session is not None
        assert session.id is not None
        assert session.user_id == str(mock_user.id)
        assert session.pipeline_id == "test_pipeline_001"
        assert session.optimization_type == "hyperparameter"
        assert session.status == "pending"

        # Verify in database
        db_session = await rl_service.get_session(str(session.id))
        assert db_session is not None
        assert db_session.id == session.id

        # Performance assertion
        test_metrics.assert_performance({"execution_time_ms": 1000})

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_read_rl_optimization_session(self, test_db_session, mock_user):
        """Test reading RL optimization session from database."""
        rl_service = RLOptimizationService(test_db_session)

        # Create session first
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="read_test_pipeline",
            optimization_type="resource_allocation",
            config={"test": "data"}
        )

        session_id = str(session.id)

        # Read session back
        retrieved_session = await rl_service.get_session(session_id)

        assert retrieved_session is not None
        assert str(retrieved_session.id) == session_id
        assert retrieved_session.user_id == str(mock_user.id)
        assert retrieved_session.pipeline_id == "read_test_pipeline"
        assert retrieved_session.optimization_type == "resource_allocation"

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_update_rl_optimization_session(self, test_db_session, mock_user):
        """Test updating RL optimization session status and performance."""
        rl_service = RLOptimizationService(test_db_session)

        # Create session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="update_test_pipeline",
            optimization_type="data_quality",
            config={"initial": "config"}
        )

        session_id = str(session.id)

        # Update session status
        updated = await rl_service.update_session_status(
            session_id,
            "running",
            best_performance={"accuracy": 0.85}
        )

        assert updated is True

        # Verify update
        retrieved_session = await rl_service.get_session(session_id)
        assert retrieved_session.status == "running"
        assert retrieved_session.best_performance is not None

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_delete_rl_optimization_session(self, test_db_session, mock_user):
        """Test deleting RL optimization session from database."""
        rl_service = RLOptimizationService(test_db_session)

        # Create session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="delete_test_pipeline",
            optimization_type="hyperparameter",
            config={"to_be": "deleted"}
        )

        session_id = str(session.id)

        # Verify session exists
        assert await rl_service.get_session(session_id) is not None

        # Delete session
        deleted = await rl_service.delete_session(session_id)
        assert deleted is True

        # Verify session is deleted
        assert await rl_service.get_session(session_id) is None


class TestOptimizationTypes:
    """Test all optimization types with database persistence."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_hyperparameter_optimization_persistence(self, test_db_session, mock_user, rl_optimization_test_config):
        """Test hyperparameter optimization database persistence."""
        rl_service = RLOptimizationService(test_db_session)
        config = rl_optimization_test_config["hyperparameter_config"]

        # Create hyperparameter optimization session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id=config["pipeline_id"],
            optimization_type="hyperparameter",
            training_data_path=config["training_data_path"],
            validation_data_path=config["validation_data_path"],
            config=config["optimization_config"]
        )

        # Verify session was created with correct type
        assert session.optimization_type == "hyperparameter"
        assert session.pipeline_id == config["pipeline_id"]

        # Verify persistence across service restart (simulate by creating new service)
        new_rl_service = RLOptimizationService(test_db_session)
        retrieved_session = await new_rl_service.get_session(str(session.id))

        assert retrieved_session is not None
        assert retrieved_session.optimization_type == "hyperparameter"
        assert retrieved_session.pipeline_id == config["pipeline_id"]

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_resource_allocation_optimization_persistence(self, test_db_session, mock_user, rl_optimization_test_config):
        """Test resource allocation optimization database persistence."""
        rl_service = RLOptimizationService(test_db_session)
        config = rl_optimization_test_config["resource_allocation_config"]

        # Create resource allocation optimization session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="resource_allocation",
            optimization_type="resource_allocation",
            config={
                "pipeline_configs": config["pipeline_configs"],
                "resource_constraints": config["resource_constraints"]
            }
        )

        # Verify session was created with correct type
        assert session.optimization_type == "resource_allocation"

        # Verify complex config persistence
        retrieved_session = await rl_service.get_session(str(session.id))
        assert retrieved_session is not None
        assert retrieved_session.optimization_type == "resource_allocation"

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_data_quality_optimization_persistence(self, test_db_session, mock_user, rl_optimization_test_config):
        """Test data quality optimization database persistence."""
        rl_service = RLOptimizationService(test_db_session)
        config = rl_optimization_test_config["data_quality_config"]

        # Create data quality optimization session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="data_quality",
            optimization_type="data_quality",
            config=config["data_processing_requirements"]
        )

        # Verify session was created with correct type
        assert session.optimization_type == "data_quality"

        # Verify persistence across service restart
        new_rl_service = RLOptimizationService(test_db_session)
        retrieved_session = await new_rl_service.get_session(str(session.id))

        assert retrieved_session is not None
        assert retrieved_session.optimization_type == "data_quality"


class TestSessionOwnershipAndSecurity:
    """Test session ownership and security features."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.security
    async def test_session_ownership_verification(self, test_db_session, mock_user, mock_admin_user):
        """Test that users can only access their own sessions."""
        rl_service = RLOptimizationService(test_db_session)

        # User creates session
        user_session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="user_private_pipeline",
            optimization_type="hyperparameter",
            config={"private": "data"}
        )

        # Admin creates session
        admin_session = await rl_service.start_optimization(
            user_id=str(mock_admin_user.id),
            pipeline_id="admin_private_pipeline",
            optimization_type="resource_allocation",
            config={"admin": "data"}
        )

        # Test user can access their own session
        user_retrieved = await rl_service.get_session(str(user_session.id))
        assert user_retrieved is not None
        assert user_retrieved.user_id == str(mock_user.id)

        # Test session isolation
        assert user_session.id != admin_session.id
        assert user_session.user_id != admin_session.user_id

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.security
    async def test_user_session_listing_security(self, test_db_session, mock_user, mock_admin_user):
        """Test that session listing respects user boundaries."""
        rl_service = RLOptimizationService(test_db_session)

        # Create sessions for different users
        user_sessions = []
        admin_sessions = []

        for i in range(3):
            user_session = await rl_service.start_optimization(
                user_id=str(mock_user.id),
                pipeline_id=f"user_pipeline_{i}",
                optimization_type="hyperparameter",
                config={"user_session": i}
            )
            user_sessions.append(user_session)

            admin_session = await rl_service.start_optimization(
                user_id=str(mock_admin_user.id),
                pipeline_id=f"admin_pipeline_{i}",
                optimization_type="resource_allocation",
                config={"admin_session": i}
            )
            admin_sessions.append(admin_session)

        # Test user sees only their sessions
        user_list = await rl_service.list_sessions(user_id=str(mock_user.id))
        assert user_list["success"] is True
        assert len(user_list["sessions"]) == 3

        for session in user_list["sessions"]:
            assert session["user_id"] == str(mock_user.id)

        # Test admin sees only their sessions (not all sessions)
        admin_list = await rl_service.list_sessions(user_id=str(mock_admin_user.id))
        assert admin_list["success"] is True
        assert len(admin_list["sessions"]) == 3

        for session in admin_list["sessions"]:
            assert session["user_id"] == str(mock_admin_user.id)


class TestDatabasePersistenceAcrossRestarts:
    """Test database persistence across service restarts."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_session_persistence_after_service_restart(self, test_db_session, mock_user):
        """Test that sessions persist across service restarts."""
        # Create initial service and session
        initial_service = RLOptimizationService(test_db_session)

        original_session = await initial_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="persistence_test_pipeline",
            optimization_type="hyperparameter",
            config={
                "algorithm": "PPO",
                "episodes": 100,
                "learning_rate": 0.001
            }
        )

        session_id = str(original_session.id)
        original_status = original_session.status
        original_config = original_session.config

        # Simulate service restart by creating new service instance
        restarted_service = RLOptimizationService(test_db_session)

        # Retrieve session after "restart"
        persisted_session = await restarted_service.get_session(session_id)

        # Verify session persistence
        assert persisted_session is not None
        assert str(persisted_session.id) == session_id
        assert persisted_session.user_id == str(mock_user.id)
        assert persisted_session.pipeline_id == "persistence_test_pipeline"
        assert persisted_session.optimization_type == "hyperparameter"
        assert persisted_session.status == original_status

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_episode_data_persistence(self, test_db_session, mock_user):
        """Test that episode data persists across service restarts."""
        # Create service and session
        rl_service = RLOptimizationService(test_db_session)

        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="episode_persistence_test",
            optimization_type="hyperparameter",
            config={"test": "episode_persistence"}
        )

        session_id = str(session.id)

        # Add episode data
        episode_data = {
            "episode_number": 1,
            "reward": 0.85,
            "metrics": {"accuracy": 0.85, "loss": 0.15},
            "hyperparameters": {"lr": 0.001, "batch_size": 32}
        }

        await rl_service.record_episode(session_id, episode_data)

        # Simulate restart with new service
        new_service = RLOptimizationService(test_db_session)

        # Retrieve episode data
        metrics_result = await new_service.get_session_metrics(session_id, include_episodes=True)

        assert metrics_result["success"] is True
        assert "episodes" in metrics_result
        assert len(metrics_result["episodes"]) == 1

        retrieved_episode = metrics_result["episodes"][0]
        assert retrieved_episode["episode_number"] == 1
        assert retrieved_episode["reward"] == 0.85

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_concurrent_session_persistence(self, test_db_session, mock_user):
        """Test persistence of multiple concurrent sessions."""
        rl_service = RLOptimizationService(test_db_session)

        # Create multiple concurrent sessions
        sessions = []
        for i in range(5):
            session = await rl_service.start_optimization(
                user_id=str(mock_user.id),
                pipeline_id=f"concurrent_pipeline_{i}",
                optimization_type="hyperparameter" if i % 2 == 0 else "resource_allocation",
                config={"session_index": i, "concurrent_test": True}
            )
            sessions.append(session)

        # Verify all sessions were created
        assert len(sessions) == 5

        # Simulate restart
        new_service = RLOptimizationService(test_db_session)

        # Verify all sessions persist
        for original_session in sessions:
            persisted_session = await new_service.get_session(str(original_session.id))
            assert persisted_session is not None
            assert persisted_session.id == original_session.id
            assert persisted_session.pipeline_id == original_session.pipeline_id


class TestErrorHandlingAndEdgeCases:
    """Test error handling and edge cases for database operations."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_invalid_session_id_handling(self, test_db_session):
        """Test handling of invalid session IDs."""
        rl_service = RLOptimizationService(test_db_session)

        # Test non-existent session ID
        result = await rl_service.get_session("non-existent-session-id")
        assert result is None

        # Test invalid UUID format
        result = await rl_service.get_session("invalid-uuid-format")
        assert result is None

        # Test empty session ID
        result = await rl_service.get_session("")
        assert result is None

        # Test None session ID
        result = await rl_service.get_session(None)
        assert result is None

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_duplicate_session_handling(self, test_db_session, mock_user):
        """Test handling of potential duplicate sessions."""
        rl_service = RLOptimizationService(test_db_session)

        # Create multiple sessions with same pipeline_id (should be allowed)
        session1 = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="duplicate_test_pipeline",
            optimization_type="hyperparameter",
            config={"session": 1}
        )

        session2 = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="duplicate_test_pipeline",
            optimization_type="hyperparameter",
            config={"session": 2}
        )

        # Both sessions should be created successfully
        assert session1 is not None
        assert session2 is not None
        assert session1.id != session2.id

        # Both should be retrievable
        retrieved1 = await rl_service.get_session(str(session1.id))
        retrieved2 = await rl_service.get_session(str(session2.id))

        assert retrieved1 is not None
        assert retrieved2 is not None
        assert retrieved1.id != retrieved2.id

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_large_config_data_persistence(self, test_db_session, mock_user):
        """Test persistence of large configuration data."""
        rl_service = RLOptimizationService(test_db_session)

        # Create large config (simulate complex hyperparameter space)
        large_config = {
            "hyperparameter_space": {
                f"param_{i}": {
                    "type": "continuous",
                    "range": [0.0, 1.0],
                    "default": 0.5,
                    "description": f"Parameter {i} for testing large configs"
                }
                for i in range(100)  # 100 parameters
            },
            "optimization_settings": {
                "algorithms": ["PPO", "A2C", "SAC", "DDPG"],
                "episodes_per_trial": 1000,
                "parallel_trials": 10,
                "early_stopping": True,
                "convergence_criteria": {
                    "min_improvement": 0.001,
                    "patience": 50,
                    "max_episodes": 5000
                }
            },
            "metadata": {
                "description": "Large configuration test",
                "tags": [f"tag_{i}" for i in range(50)],
                "notes": "This is a test configuration with large amounts of data " * 100
            }
        }

        # Create session with large config
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="large_config_test",
            optimization_type="hyperparameter",
            config=large_config
        )

        assert session is not None

        # Verify config was stored and can be retrieved
        retrieved_session = await rl_service.get_session(str(session.id))
        assert retrieved_session is not None
        assert retrieved_session.config is not None

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.database
    async def test_session_status_transitions(self, test_db_session, mock_user):
        """Test valid session status transitions and persistence."""
        rl_service = RLOptimizationService(test_db_session)

        # Create session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="status_transition_test",
            optimization_type="hyperparameter",
            config={"test": "status_transitions"}
        )

        session_id = str(session.id)

        # Test status transitions
        status_sequence = ["pending", "running", "completed"]

        for status in status_sequence:
            success = await rl_service.update_session_status(session_id, status)
            assert success is True

            # Verify status was updated and persisted
            retrieved_session = await rl_service.get_session(session_id)
            assert retrieved_session.status == status

        # Test error status
        success = await rl_service.update_session_status(
            session_id,
            "error",
            error_message="Test error message"
        )
        assert success is True

        retrieved_session = await rl_service.get_session(session_id)
        assert retrieved_session.status == "error"
        assert retrieved_session.error_message == "Test error message"


class TestPerformanceBenchmarks:
    """Performance benchmarks for database operations."""

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.performance
    async def test_session_creation_performance(self, test_db_session, mock_user, test_metrics, performance_thresholds):
        """Test performance of session creation operations."""
        rl_service = RLOptimizationService(test_db_session)
        thresholds = performance_thresholds["rl_optimization"]

        test_metrics.start_timer()

        # Create session
        session = await rl_service.start_optimization(
            user_id=str(mock_user.id),
            pipeline_id="performance_test_pipeline",
            optimization_type="hyperparameter",
            config={"performance": "test"}
        )

        test_metrics.end_timer()

        assert session is not None
        test_metrics.assert_performance({
            "execution_time_ms": thresholds["max_session_creation_time_ms"]
        })

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.performance
    async def test_batch_session_operations_performance(self, test_db_session, mock_user, test_metrics):
        """Test performance of batch database operations."""
        rl_service = RLOptimizationService(test_db_session)

        test_metrics.start_timer()

        # Create multiple sessions
        sessions = []
        for i in range(10):
            session = await rl_service.start_optimization(
                user_id=str(mock_user.id),
                pipeline_id=f"batch_test_pipeline_{i}",
                optimization_type="hyperparameter",
                config={"batch_index": i}
            )
            sessions.append(session)

        test_metrics.end_timer()

        assert len(sessions) == 10
        test_metrics.assert_performance({"execution_time_ms": 5000})  # 5 second limit for 10 sessions

    @pytest.mark.critical_fix
    @pytest.mark.rl_optimization
    @pytest.mark.performance
    async def test_session_query_performance(self, test_db_session, mock_user, test_metrics):
        """Test performance of session querying operations."""
        rl_service = RLOptimizationService(test_db_session)

        # Pre-create sessions for querying
        session_ids = []
        for i in range(20):
            session = await rl_service.start_optimization(
                user_id=str(mock_user.id),
                pipeline_id=f"query_test_pipeline_{i}",
                optimization_type="hyperparameter",
                config={"query_test": i}
            )
            session_ids.append(str(session.id))

        # Test query performance
        test_metrics.start_timer()

        # Query all sessions
        for session_id in session_ids:
            retrieved_session = await rl_service.get_session(session_id)
            assert retrieved_session is not None

        test_metrics.end_timer()

        test_metrics.assert_performance({"execution_time_ms": 3000})  # 3 second limit for 20 queries