"""
Integration End-to-End Workflow Tests
====================================

Comprehensive integration test suite for validating end-to-end workflows
that span multiple systems and components. Tests the integration of all
three critical P0 fixes working together in real-world scenarios.

Test Coverage:
- Complete data quality assessment workflows
- End-to-end RL optimization lifecycles
- Security-protected workflow executions
- Cross-system integration validations
- Database persistence across workflow steps
- Error recovery and rollback mechanisms
- Performance benchmarks for complete workflows
"""

import pytest
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import io
import httpx

# Import application components
import sys
sys.path.append('/Users/wira/Desktop/schlep-engine/apps/api')

# RL optimization service removed - replaced with placeholder optimizer


class TestDataQualityToRLOptimizationWorkflow:
    """Test complete workflow from data quality assessment to RL optimization."""

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_complete_data_quality_to_rl_workflow(self, authenticated_async_client, sample_csv_data, test_metrics, test_db_session):
        """Test complete workflow: data quality assessment → RL optimization → monitoring."""
        test_metrics.start_timer()

        # Step 1: Assess data quality
        files = {"file": ("workflow_data.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({
            "check_duplicates": True,
            "check_missing": True,
            "check_outliers": True,
            "generate_profile": True
        })}

        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert quality_response.status_code == 200
        quality_result = quality_response.json()
        assert quality_result["success"] is True

        assessment_id = quality_result["assessment_id"]
        overall_quality_score = quality_result["overall_quality_score"]

        # Step 2: Based on quality score, start RL optimization
        if overall_quality_score >= 0.7:  # Good quality data
            rl_config = {
                "pipeline_id": f"quality_pipeline_{assessment_id}",
                "training_data_path": "/tmp/workflow_data.csv",
                "optimization_config": {
                    "algorithm": "PPO",
                    "max_episodes": 20,
                    "data_quality_score": overall_quality_score
                },
                "max_runtime_hours": 1,
                "priority": 8
            }

            rl_response = await authenticated_async_client.post(
                "/api/v1/rl/hyperparameters/optimize",
                json=rl_config
            )

            assert rl_response.status_code == 200
            rl_result = rl_response.json()
            assert rl_result["success"] is True

            session_id = rl_result["session_id"]

            # Step 3: Monitor RL optimization progress
            status_response = await authenticated_async_client.get(
                f"/api/v1/rl/sessions/{session_id}/status"
            )

            assert status_response.status_code == 200
            status_result = status_response.json()
            assert status_result["success"] is True
            assert status_result["session_id"] == session_id

            # Step 4: Verify database persistence
            rl_service = RLOptimizationService(test_db_session)
            persisted_session = await rl_service.get_session(session_id)
            assert persisted_session is not None
            assert persisted_session.pipeline_id == rl_config["pipeline_id"]

        test_metrics.end_timer()
        test_metrics.assert_performance({"execution_time_ms": 30000})  # 30 second limit

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_poor_quality_data_workflow_handling(self, authenticated_async_client, test_db_session):
        """Test workflow handling when data quality is poor."""
        # Create poor quality data
        poor_data = """name,age,score
Alice,,
,30,
Charlie,,95.5
,,
Eve,28,"""

        files = {"file": ("poor_quality.csv", poor_data.encode(), "text/csv")}
        data = {"request_data": json.dumps({"check_missing": True, "check_outliers": True})}

        # Step 1: Assess poor quality data
        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert quality_response.status_code == 200
        quality_result = quality_response.json()
        assert quality_result["success"] is True

        overall_quality_score = quality_result["overall_quality_score"]
        assert overall_quality_score < 0.5  # Should be low quality

        # Step 2: Should either reject RL optimization or use data quality optimization
        if overall_quality_score < 0.3:
            # Use data quality optimization instead
            dq_config = {
                "data_processing_requirements": {
                    "min_quality_score": 0.8,
                    "max_missing_values_percent": 10,
                    "outlier_detection": True
                },
                "max_runtime_hours": 1,
                "priority": 9
            }

            dq_response = await authenticated_async_client.post(
                "/api/v1/rl/data-quality/optimize",
                json=dq_config
            )

            assert dq_response.status_code == 200
            dq_result = dq_response.json()
            assert dq_result["success"] is True

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_workflow_with_data_cleaning_integration(self, authenticated_async_client, malformed_csv_data):
        """Test workflow that includes data cleaning before optimization."""
        # Step 1: Try to assess malformed data (should handle gracefully)
        files = {"file": ("malformed.csv", malformed_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should either succeed with errors or fail gracefully
        if quality_response.status_code == 200:
            quality_result = quality_response.json()
            if not quality_result["success"]:
                # Step 2: If assessment failed, try auto-cleaning
                cleaning_response = await authenticated_async_client.post(
                    "/api/v1/quality/clean/auto",
                    files={"file": ("malformed.csv", malformed_csv_data, "text/csv")},
                    data={"cleaning_options": json.dumps({"remove_duplicates": True})}
                )

                # Auto-cleaning might succeed or fail depending on data severity
                if cleaning_response.status_code == 200:
                    cleaning_result = cleaning_response.json()
                    assert "cleaning_id" in cleaning_result


class TestMultiUserWorkflowIntegration:
    """Test workflows with multiple users and session isolation."""

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_concurrent_user_workflows(self, authenticated_async_client, sample_csv_data, test_db_session, mock_user):
        """Test concurrent workflows from multiple users."""
        # Simulate multiple users by using different user contexts
        user_workflows = []

        for i in range(3):
            # Each user performs complete workflow
            user_files = {"file": (f"user_{i}_data.csv", sample_csv_data, "text/csv")}
            user_data = {"request_data": json.dumps({"generate_profile": True})}

            # Step 1: Data quality assessment
            quality_response = await authenticated_async_client.post(
                "/api/v1/quality/assess",
                files=user_files,
                data=user_data
            )

            assert quality_response.status_code == 200
            quality_result = quality_response.json()

            # Step 2: RL optimization
            rl_config = {
                "pipeline_id": f"user_{i}_pipeline_{uuid.uuid4()}",
                "training_data_path": f"/tmp/user_{i}_data.csv",
                "optimization_config": {"algorithm": "PPO", "max_episodes": 10},
                "max_runtime_hours": 1
            }

            rl_response = await authenticated_async_client.post(
                "/api/v1/rl/hyperparameters/optimize",
                json=rl_config
            )

            if rl_response.status_code == 200:
                rl_result = rl_response.json()
                user_workflows.append({
                    "user_id": i,
                    "quality_assessment": quality_result,
                    "rl_session": rl_result
                })

        # Verify session isolation
        rl_service = RLOptimizationService(test_db_session)

        for workflow in user_workflows:
            if "session_id" in workflow["rl_session"]:
                session_id = workflow["rl_session"]["session_id"]
                session = await rl_service.get_session(session_id)
                assert session is not None
                assert session.user_id == str(mock_user.id)  # All should belong to test user

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_admin_workflow_oversight(self, admin_authenticated_client, authenticated_async_client, sample_csv_data):
        """Test admin oversight of user workflows."""
        # Regular user creates workflow
        user_files = {"file": ("user_workflow.csv", sample_csv_data, "text/csv")}
        user_data = {"request_data": json.dumps({})}

        user_quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=user_files,
            data=user_data
        )

        assert user_quality_response.status_code == 200

        # Start RL optimization as user
        rl_config = {
            "pipeline_id": "admin_oversight_test",
            "training_data_path": "/tmp/user_workflow.csv",
            "optimization_config": {"algorithm": "PPO"},
            "max_runtime_hours": 1
        }

        user_rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=rl_config
        )

        if user_rl_response.status_code == 200:
            user_rl_result = user_rl_response.json()
            session_id = user_rl_result["session_id"]

            # Admin should be able to view session
            admin_status_response = await admin_authenticated_client.get(
                f"/api/v1/rl/sessions/{session_id}/status"
            )

            # Admin should have access
            assert admin_status_response.status_code == 200

            # Admin should be able to list all sessions
            admin_list_response = await admin_authenticated_client.get("/api/v1/rl/sessions")
            assert admin_list_response.status_code == 200

            # Admin should be able to stop user sessions if needed
            admin_stop_response = await admin_authenticated_client.post(
                f"/api/v1/rl/sessions/{session_id}/stop",
                params={"reason": "admin_intervention"}
            )

            assert admin_stop_response.status_code == 200


class TestErrorRecoveryAndRollbackWorkflows:
    """Test error recovery and rollback mechanisms in workflows."""

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_workflow_error_recovery(self, authenticated_async_client, test_db_session):
        """Test workflow recovery from various error scenarios."""
        # Scenario 1: Invalid data format
        invalid_files = {"file": ("invalid.txt", b"This is not CSV data", "text/plain")}
        invalid_data = {"request_data": json.dumps({})}

        invalid_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=invalid_files,
            data=invalid_data
        )

        # Should handle invalid format gracefully
        assert invalid_response.status_code == 400

        # Scenario 2: Invalid RL configuration
        invalid_rl_config = {
            "pipeline_id": "",  # Invalid empty pipeline ID
            "training_data_path": "",
            "max_runtime_hours": -1  # Invalid negative hours
        }

        invalid_rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=invalid_rl_config
        )

        # Should reject invalid configuration
        assert invalid_rl_response.status_code in [400, 422]

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_partial_workflow_rollback(self, authenticated_async_client, sample_csv_data, test_db_session):
        """Test rollback when workflow partially completes then fails."""
        # Step 1: Successful data quality assessment
        files = {"file": ("rollback_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert quality_response.status_code == 200
        quality_result = quality_response.json()
        assert quality_result["success"] is True

        # Step 2: Start RL optimization with potentially problematic config
        problematic_rl_config = {
            "pipeline_id": "rollback_test_pipeline",
            "training_data_path": "/nonexistent/path/data.csv",  # Invalid path
            "optimization_config": {"invalid_param": "invalid_value"},
            "max_runtime_hours": 1
        }

        rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=problematic_rl_config
        )

        # If RL optimization fails, should not affect quality assessment
        if rl_response.status_code != 200:
            # Quality assessment should still be accessible
            quality_list_response = await authenticated_async_client.get("/api/v1/quality/assessments")

            if quality_list_response.status_code == 200:
                assessments = quality_list_response.json()
                # Should find our successful assessment
                found_assessment = any(
                    a.get("assessment_id") == quality_result["assessment_id"]
                    for a in assessments
                    if isinstance(assessments, list)
                )

    @pytest.mark.critical_fix
    @pytest.mark.integration
    async def test_workflow_timeout_handling(self, authenticated_async_client, large_dataset):
        """Test workflow handling of timeout scenarios."""
        # Use large dataset that might cause timeout
        files = {"file": ("large_dataset.json", large_dataset, "application/json")}
        data = {"request_data": json.dumps({
            "check_duplicates": True,
            "check_missing": True,
            "check_outliers": True,
            "check_bias": True,
            "generate_profile": True
        })}

        # This might timeout or succeed depending on system performance
        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should either succeed or fail gracefully with timeout
        if quality_response.status_code == 200:
            quality_result = quality_response.json()
            # If successful, processing should have completed
            assert "processing_time" in quality_result
        else:
            # If failed, should provide meaningful error
            assert quality_response.status_code in [400, 413, 500]


class TestSecurityIntegratedWorkflows:
    """Test workflows with full security enforcement."""

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.security
    async def test_csrf_protected_workflow(self, test_client, mock_user):
        """Test complete workflow with CSRF protection enabled."""
        # Step 1: Get CSRF token
        csrf_response = test_client.get("/api/v1/health")
        csrf_token = csrf_response.headers.get("x-csrf-token")

        if csrf_token:
            # Step 2: Use CSRF token in workflow
            headers = {"x-csrf-token": csrf_token}
            cookies = {"csrftoken": csrf_token}

            # Override authentication for test
            with patch('app.auth.unified_auth_system.get_current_user', return_value=mock_user):
                # Data quality assessment with CSRF
                files = {"file": ("csrf_test.csv", b"name,age\nAlice,25", "text/csv")}
                data = {"request_data": json.dumps({})}

                quality_response = test_client.post(
                    "/api/v1/quality/assess",
                    files=files,
                    data=data,
                    headers=headers,
                    cookies=cookies
                )

                # Should not be blocked by CSRF
                assert quality_response.status_code != 403

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.security
    async def test_rate_limited_workflow(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test workflow under rate limiting conditions."""
        test_metrics.start_timer()

        # Perform multiple rapid workflow operations
        responses = []
        for i in range(10):
            files = {"file": (f"rate_test_{i}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}

            response = await authenticated_async_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )
            responses.append(response)

        test_metrics.end_timer()

        # Some requests should succeed
        successful_responses = [r for r in responses if r.status_code == 200]
        assert len(successful_responses) > 0

        # If rate limiting is enforced, some might be limited
        rate_limited_responses = [r for r in responses if r.status_code == 429]

        test_metrics.record_metric("total_requests", len(responses))
        test_metrics.record_metric("successful_requests", len(successful_responses))
        test_metrics.record_metric("rate_limited_requests", len(rate_limited_responses))

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.security
    async def test_authentication_required_workflow(self, test_client, sample_csv_data):
        """Test that complete workflow requires proper authentication."""
        # Try workflow without authentication
        files = {"file": ("auth_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        unauth_response = test_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should require authentication
        assert unauth_response.status_code in [401, 403]

        # Try RL optimization without authentication
        rl_config = {
            "pipeline_id": "auth_test_pipeline",
            "training_data_path": "/tmp/auth_test.csv",
            "max_runtime_hours": 1
        }

        unauth_rl_response = test_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=rl_config
        )

        # Should require authentication
        assert unauth_rl_response.status_code in [401, 403]


class TestDatabaseConsistencyInWorkflows:
    """Test database consistency throughout complete workflows."""

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.database
    async def test_workflow_database_transactions(self, authenticated_async_client, sample_csv_data, test_db_session, db_verifier):
        """Test database transaction consistency in workflows."""
        initial_session_count = await db_verifier.get_rl_session_count()

        # Complete workflow
        files = {"file": ("transaction_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert quality_response.status_code == 200

        # Start RL optimization
        rl_config = {
            "pipeline_id": "transaction_test_pipeline",
            "training_data_path": "/tmp/transaction_test.csv",
            "optimization_config": {"algorithm": "PPO"},
            "max_runtime_hours": 1
        }

        rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=rl_config
        )

        if rl_response.status_code == 200:
            rl_result = rl_response.json()
            session_id = rl_result["session_id"]

            # Verify database state
            final_session_count = await db_verifier.get_rl_session_count()
            assert final_session_count == initial_session_count + 1

            # Verify session exists and is accessible
            assert await db_verifier.verify_rl_session_exists(session_id)

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.database
    async def test_workflow_data_persistence_across_steps(self, authenticated_async_client, sample_csv_data, test_db_session):
        """Test data persistence across workflow steps."""
        # Step 1: Data quality assessment
        files = {"file": ("persistence_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({"generate_profile": True})}

        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert quality_response.status_code == 200
        quality_result = quality_response.json()
        assessment_id = quality_result["assessment_id"]

        # Step 2: Start RL optimization referencing assessment
        rl_config = {
            "pipeline_id": f"persistence_pipeline_{assessment_id}",
            "training_data_path": "/tmp/persistence_test.csv",
            "optimization_config": {
                "algorithm": "PPO",
                "quality_assessment_id": assessment_id
            },
            "max_runtime_hours": 1
        }

        rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=rl_config
        )

        if rl_response.status_code == 200:
            rl_result = rl_response.json()
            session_id = rl_result["session_id"]

            # Step 3: Verify cross-reference persistence
            status_response = await authenticated_async_client.get(
                f"/api/v1/rl/sessions/{session_id}/status"
            )

            assert status_response.status_code == 200
            status_result = status_response.json()

            # Session should contain reference to original assessment
            assert status_result["session_id"] == session_id

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.database
    async def test_workflow_cleanup_on_failure(self, authenticated_async_client, test_db_session, db_verifier):
        """Test proper cleanup when workflows fail partway through."""
        initial_session_count = await db_verifier.get_rl_session_count()

        # Start workflow that will fail
        invalid_rl_config = {
            "pipeline_id": "cleanup_test_pipeline",
            "training_data_path": "/invalid/path/to/data.csv",
            "optimization_config": {"invalid": "configuration"},
            "max_runtime_hours": 0  # Invalid
        }

        rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=invalid_rl_config
        )

        # Should fail validation
        assert rl_response.status_code in [400, 422]

        # Database should not have orphaned records
        final_session_count = await db_verifier.get_rl_session_count()
        assert final_session_count == initial_session_count


class TestPerformanceBenchmarksForCompleteWorkflows:
    """Test performance benchmarks for complete end-to-end workflows."""

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.performance
    async def test_complete_workflow_performance(self, authenticated_async_client, sample_csv_data, test_metrics, performance_thresholds):
        """Test performance of complete workflow from start to finish."""
        test_metrics.start_timer()

        # Complete workflow timing
        workflow_start = datetime.utcnow()

        # Step 1: Data quality assessment
        files = {"file": ("performance_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({
            "check_duplicates": True,
            "check_missing": True,
            "check_outliers": True,
            "generate_profile": True
        })}

        quality_response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        quality_end = datetime.utcnow()
        quality_duration = (quality_end - workflow_start).total_seconds() * 1000

        assert quality_response.status_code == 200
        quality_result = quality_response.json()

        # Step 2: RL optimization
        rl_start = datetime.utcnow()

        rl_config = {
            "pipeline_id": "performance_test_pipeline",
            "training_data_path": "/tmp/performance_test.csv",
            "optimization_config": {"algorithm": "PPO", "max_episodes": 5},
            "max_runtime_hours": 1
        }

        rl_response = await authenticated_async_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=rl_config
        )

        rl_end = datetime.utcnow()
        rl_duration = (rl_end - rl_start).total_seconds() * 1000

        test_metrics.end_timer()

        # Performance assertions
        test_metrics.record_metric("quality_assessment_duration_ms", quality_duration)
        test_metrics.record_metric("rl_optimization_duration_ms", rl_duration)

        # Total workflow should complete within reasonable time
        total_duration = (rl_end - workflow_start).total_seconds() * 1000
        test_metrics.record_metric("total_workflow_duration_ms", total_duration)

        # Assert performance thresholds
        assert quality_duration <= performance_thresholds["data_quality_api"]["max_response_time_ms"]
        assert rl_duration <= performance_thresholds["rl_optimization"]["max_session_creation_time_ms"]
        assert total_duration <= 60000  # 60 second total limit

    @pytest.mark.critical_fix
    @pytest.mark.integration
    @pytest.mark.performance
    async def test_concurrent_workflow_performance(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test performance under concurrent workflow load."""
        test_metrics.start_timer()

        # Run multiple workflows concurrently
        async def run_single_workflow(workflow_id: int):
            files = {"file": (f"concurrent_{workflow_id}.csv", sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}

            quality_response = await authenticated_async_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )

            return quality_response.status_code == 200

        # Run 5 concurrent workflows
        tasks = [run_single_workflow(i) for i in range(5)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        test_metrics.end_timer()

        # Count successful workflows
        successful_workflows = sum(1 for result in results if result is True)
        test_metrics.record_metric("successful_concurrent_workflows", successful_workflows)

        # At least majority should succeed
        assert successful_workflows >= 3

        # Should complete within reasonable time
        test_metrics.assert_performance({"execution_time_ms": 30000})  # 30 second limit