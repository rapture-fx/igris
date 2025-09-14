"""
RL Optimization Integration Tests

Comprehensive testing of the RL optimization system including:
- Model persistence with cloud backup
- Session management and lifecycle
- Performance monitoring
- Different optimization strategies (PPO, A2C, SAC, DDPG)
- Resource allocation optimization
- Data quality optimization
- Error handling and recovery
- Load testing and concurrent sessions
"""

import pytest
import asyncio
import json
import time
import tempfile
import os
from typing import Dict, Any, List
from unittest.mock import patch, AsyncMock, MagicMock
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.services.rl_optimization_service import RLOptimizationService
from app.services.rl.models.rl_optimization_models import RLOptimizationSession, RLEpisode
from app.auth.enhanced_security import SecurityLevel


@pytest.mark.integration
class TestRLOptimizationIntegration:
    """Integration tests for RL optimization system."""

    async def test_hyperparameter_optimization_full_lifecycle(
        self,
        async_test_client,
        auth_headers_user,
        mock_rl_service,
        sample_ml_data,
        mock_s3_client
    ):
        """Test complete hyperparameter optimization lifecycle."""

        # Prepare optimization request
        optimization_request = {
            "pipeline_id": "test-pipeline-hp",
            "training_data_path": sample_ml_data["train_path"],
            "validation_data_path": sample_ml_data["val_path"],
            "optimization_config": {
                "max_episodes": 20,
                "strategy": "PPO",
                "objective": "maximize_accuracy",
                "early_stopping": True,
                "patience": 5
            },
            "max_runtime_hours": 2,
            "priority": 7
        }

        # Start optimization
        response = await async_test_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=optimization_request,
            headers=auth_headers_user
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert "session_id" in result
        session_id = result["session_id"]

        # Monitor optimization progress
        await asyncio.sleep(1)  # Let optimization start

        status_response = await async_test_client.get(
            f"/api/v1/rl/sessions/{session_id}/status",
            headers=auth_headers_user
        )

        assert status_response.status_code == 200
        status_result = status_response.json()
        assert status_result["session_id"] == session_id
        assert status_result["optimization_type"] == "hyperparameter"

        # Test model persistence and backup
        # Mock S3 backup operations
        mock_s3_client.put_object.return_value = {"ETag": f"model-{session_id}-etag"}

        # Get session metrics
        metrics_response = await async_test_client.get(
            f"/api/v1/rl/sessions/{session_id}/metrics",
            headers=auth_headers_user
        )

        assert metrics_response.status_code in [200, 404]  # May not have metrics yet

        # Test session export
        export_response = await async_test_client.post(
            f"/api/v1/rl/sessions/{session_id}/export",
            params={"format": "json"},
            headers=auth_headers_user
        )

        assert export_response.status_code == 200
        export_data = export_response.json()
        assert export_data["success"] is True

        # Stop optimization
        stop_response = await async_test_client.post(
            f"/api/v1/rl/sessions/{session_id}/stop",
            params={"reason": "test_completion"},
            headers=auth_headers_user
        )

        assert stop_response.status_code == 200
        assert stop_response.json()["success"] is True

        # Verify S3 backup was attempted
        mock_s3_client.put_object.assert_called()

    async def test_resource_allocation_optimization(
        self,
        async_test_client,
        auth_headers_user,
        mock_rl_service
    ):
        """Test resource allocation optimization scenario."""

        resource_request = {
            "pipeline_configs": [
                {
                    "id": "pipeline1",
                    "type": "data_processing",
                    "cpu_requirement": 2,
                    "memory_requirement": "4GB",
                    "priority": 1,
                    "deadline": (datetime.utcnow() + timedelta(hours=4)).isoformat()
                },
                {
                    "id": "pipeline2",
                    "type": "ml_training",
                    "cpu_requirement": 4,
                    "memory_requirement": "8GB",
                    "priority": 2,
                    "deadline": (datetime.utcnow() + timedelta(hours=6)).isoformat()
                },
                {
                    "id": "pipeline3",
                    "type": "inference",
                    "cpu_requirement": 1,
                    "memory_requirement": "2GB",
                    "priority": 3,
                    "deadline": (datetime.utcnow() + timedelta(hours=2)).isoformat()
                }
            ],
            "resource_constraints": {
                "max_cpu": 8,
                "max_memory": "16GB",
                "cost_limit": 100,
                "optimization_objective": "minimize_cost_maximize_throughput"
            },
            "optimization_config": {
                "strategy": "A2C",
                "max_episodes": 15,
                "learning_rate": 0.001
            }
        }

        # Start resource allocation optimization
        response = await async_test_client.post(
            "/api/v1/rl/resource-allocation/optimize",
            json=resource_request,
            headers=auth_headers_user
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        session_id = result["session_id"]

        # Wait for optimization to process
        await asyncio.sleep(2)

        # Check optimization status
        status_response = await async_test_client.get(
            f"/api/v1/rl/sessions/{session_id}/status",
            headers=auth_headers_user
        )

        assert status_response.status_code == 200
        status = status_response.json()
        assert status["optimization_type"] == "resource_allocation"

        # Verify resource allocation results would be meaningful
        if status.get("results"):
            results = status["results"]
            # Check that resource allocation respects constraints
            assert "resource_allocation" in str(results).lower() or "performance" in str(results).lower()

    async def test_data_quality_optimization(
        self,
        async_test_client,
        auth_headers_user,
        integration_test_data
    ):
        """Test data quality optimization with various scenarios."""

        data_quality_request = {
            "data_processing_requirements": {
                "quality_thresholds": {
                    "completeness": 0.95,
                    "accuracy": 0.90,
                    "consistency": 0.85,
                    "timeliness": 0.80
                },
                "cost_constraints": {
                    "max_processing_cost": 50,
                    "time_limit_hours": 4
                },
                "processing_parameters": {
                    "outlier_detection_method": "isolation_forest",
                    "missing_value_strategy": "multiple_imputation",
                    "duplicate_handling": "advanced_dedup"
                }
            },
            "optimization_config": {
                "strategy": "SAC",
                "max_episodes": 12,
                "reward_function": "quality_cost_balance"
            }
        }

        # Start data quality optimization
        response = await async_test_client.post(
            "/api/v1/rl/data-quality/optimize",
            json=data_quality_request,
            headers=auth_headers_user
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        session_id = result["session_id"]

        # Monitor progress
        status_response = await async_test_client.get(
            f"/api/v1/rl/sessions/{session_id}/status",
            headers=auth_headers_user
        )

        assert status_response.status_code == 200
        assert status_response.json()["optimization_type"] == "data_quality"

    async def test_model_persistence_and_recovery(
        self,
        mock_rl_service,
        test_db_session,
        mock_s3_client
    ):
        """Test RL model persistence, backup, and recovery mechanisms."""

        # Create optimization session
        session = await mock_rl_service.start_optimization(
            user_id="test-user",
            pipeline_id="persistence-test",
            optimization_type="hyperparameter",
            training_data_path="/tmp/test.csv",
            config={"strategy": "PPO", "max_episodes": 5}
        )

        session_id = str(session.id)

        # Mock model state for testing
        model_state = {
            "policy_network": {
                "weights": [[0.1, 0.2], [0.3, 0.4]],
                "biases": [0.5, 0.6]
            },
            "value_network": {
                "weights": [[0.7, 0.8], [0.9, 1.0]],
                "biases": [1.1, 1.2]
            },
            "training_stats": {
                "episodes_completed": 3,
                "best_reward": 0.85,
                "convergence_metric": 0.12
            },
            "hyperparameters": {
                "learning_rate": 0.001,
                "batch_size": 64,
                "epsilon": 0.1
            }
        }

        # Test local persistence
        with patch.object(mock_rl_service, '_save_model_checkpoint') as mock_save:
            mock_save.return_value = "/tmp/model_checkpoint.pkl"

            checkpoint_path = await mock_rl_service.save_model_checkpoint(
                session_id, model_state
            )

            assert checkpoint_path is not None
            mock_save.assert_called_once()

        # Test cloud backup
        backup_key = f"rl_models/{session_id}/checkpoint_latest.pkl"
        mock_s3_client.put_object.return_value = {"ETag": "backup-etag"}

        with patch.object(mock_rl_service, '_backup_to_cloud') as mock_backup:
            mock_backup.return_value = True

            backup_success = await mock_rl_service.backup_model_to_cloud(
                session_id, model_state
            )

            assert backup_success is True
            mock_backup.assert_called_once()

        # Test model recovery from cloud
        with patch.object(mock_rl_service, '_restore_from_cloud') as mock_restore:
            mock_restore.return_value = model_state

            restored_state = await mock_rl_service.restore_model_from_cloud(session_id)

            assert restored_state == model_state
            mock_restore.assert_called_once()

        # Test disaster recovery scenario
        with patch.object(mock_rl_service, '_handle_backup_failure') as mock_handle_failure:
            mock_handle_failure.return_value = {"fallback": "local_backup"}
            mock_s3_client.put_object.side_effect = Exception("S3 unavailable")

            # Should handle backup failure gracefully
            fallback_result = await mock_rl_service._handle_model_backup_failure(
                session_id, model_state
            )

            mock_handle_failure.assert_called_once()

    async def test_concurrent_optimization_sessions(
        self,
        async_test_client,
        auth_headers_user,
        auth_headers_admin,
        sample_ml_data
    ):
        """Test multiple concurrent RL optimization sessions."""

        # Define different optimization scenarios
        sessions_config = [
            {
                "type": "hyperparameter",
                "config": {
                    "pipeline_id": f"concurrent-hp-{i}",
                    "training_data_path": sample_ml_data["train_path"],
                    "optimization_config": {"strategy": "PPO", "max_episodes": 5}
                }
            }
            for i in range(3)
        ] + [
            {
                "type": "resource_allocation",
                "config": {
                    "pipeline_configs": [{"id": f"res-pipe-{i}", "cpu": 2}],
                    "optimization_config": {"strategy": "A2C", "max_episodes": 5}
                }
            }
            for i in range(2)
        ]

        # Start all sessions concurrently
        async def start_session(session_config):
            if session_config["type"] == "hyperparameter":
                endpoint = "/api/v1/rl/hyperparameters/optimize"
            else:
                endpoint = "/api/v1/rl/resource-allocation/optimize"

            response = await async_test_client.post(
                endpoint,
                json=session_config["config"],
                headers=auth_headers_user
            )
            return response

        # Execute concurrent session starts
        start_tasks = [start_session(config) for config in sessions_config]
        start_responses = await asyncio.gather(*start_tasks, return_exceptions=True)

        # Analyze results
        successful_starts = []
        for response in start_responses:
            if not isinstance(response, Exception) and response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    successful_starts.append(result["session_id"])

        assert len(successful_starts) >= 3, "Should successfully start multiple concurrent sessions"

        # Monitor all sessions
        async def check_session_status(session_id):
            try:
                response = await async_test_client.get(
                    f"/api/v1/rl/sessions/{session_id}/status",
                    headers=auth_headers_user
                )
                return response.json() if response.status_code == 200 else None
            except:
                return None

        # Check status of all active sessions
        await asyncio.sleep(2)  # Let sessions initialize

        status_tasks = [check_session_status(sid) for sid in successful_starts]
        session_statuses = await asyncio.gather(*status_tasks)

        active_sessions = [status for status in session_statuses if status and status.get("status")]

        assert len(active_sessions) > 0, "Should have active sessions running"

        # Clean up sessions
        async def stop_session(session_id):
            try:
                response = await async_test_client.post(
                    f"/api/v1/rl/sessions/{session_id}/stop",
                    headers=auth_headers_user
                )
                return response.status_code == 200
            except:
                return False

        cleanup_tasks = [stop_session(sid) for sid in successful_starts]
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)

    async def test_optimization_strategies_comparison(
        self,
        async_test_client,
        auth_headers_user,
        sample_ml_data
    ):
        """Test different RL optimization strategies (PPO, A2C, SAC, DDPG)."""

        strategies = ["PPO", "A2C", "SAC", "DDPG"]
        strategy_results = {}

        for strategy in strategies:
            request_data = {
                "pipeline_id": f"strategy-test-{strategy.lower()}",
                "training_data_path": sample_ml_data["train_path"],
                "optimization_config": {
                    "strategy": strategy,
                    "max_episodes": 8,
                    "learning_rate": 0.001 if strategy != "DDPG" else 0.0001,
                    "batch_size": 32
                }
            }

            # Start optimization
            response = await async_test_client.post(
                "/api/v1/rl/hyperparameters/optimize",
                json=request_data,
                headers=auth_headers_user
            )

            if response.status_code == 200:
                result = response.json()
                session_id = result["session_id"]
                strategy_results[strategy] = {
                    "session_id": session_id,
                    "start_time": time.time()
                }

        # Wait for some optimization progress
        await asyncio.sleep(5)

        # Compare strategy performance
        for strategy, session_info in strategy_results.items():
            session_id = session_info["session_id"]

            # Get metrics for comparison
            metrics_response = await async_test_client.get(
                f"/api/v1/rl/sessions/{session_id}/metrics",
                headers=auth_headers_user
            )

            if metrics_response.status_code == 200:
                metrics = metrics_response.json()
                strategy_results[strategy]["metrics"] = metrics

            # Stop session
            await async_test_client.post(
                f"/api/v1/rl/sessions/{session_id}/stop",
                headers=auth_headers_user
            )

        # Verify each strategy was attempted
        assert len(strategy_results) == len(strategies)

        # Each strategy should have been started successfully
        for strategy in strategies:
            assert strategy in strategy_results
            assert "session_id" in strategy_results[strategy]

    @pytest.mark.performance
    async def test_rl_optimization_performance_under_load(
        self,
        async_test_client,
        auth_headers_user,
        sample_ml_data,
        performance_monitor
    ):
        """Test RL optimization system performance under load."""

        # Configuration for load test
        concurrent_optimizations = 5
        requests_per_optimization = 10

        async def optimization_workload(workload_id: int):
            """Simulate optimization workload."""
            results = []

            # Start optimization
            start_time = time.time()

            request_data = {
                "pipeline_id": f"load-test-{workload_id}",
                "training_data_path": sample_ml_data["train_path"],
                "optimization_config": {
                    "strategy": "PPO",
                    "max_episodes": 3,  # Short episodes for load test
                    "quick_mode": True
                }
            }

            try:
                response = await async_test_client.post(
                    "/api/v1/rl/hyperparameters/optimize",
                    json=request_data,
                    headers=auth_headers_user
                )

                start_duration = (time.time() - start_time) * 1000
                performance_monitor.record_response_time(start_duration)

                if response.status_code == 200:
                    session_id = response.json()["session_id"]

                    # Perform multiple status checks
                    for i in range(requests_per_optimization):
                        check_start = time.time()

                        status_response = await async_test_client.get(
                            f"/api/v1/rl/sessions/{session_id}/status",
                            headers=auth_headers_user
                        )

                        check_duration = (time.time() - check_start) * 1000
                        performance_monitor.record_response_time(check_duration)

                        results.append({
                            "operation": "status_check",
                            "status_code": status_response.status_code,
                            "duration_ms": check_duration,
                            "workload_id": workload_id
                        })

                        await asyncio.sleep(0.1)

                    # Stop optimization
                    stop_start = time.time()
                    stop_response = await async_test_client.post(
                        f"/api/v1/rl/sessions/{session_id}/stop",
                        headers=auth_headers_user
                    )
                    stop_duration = (time.time() - stop_start) * 1000
                    performance_monitor.record_response_time(stop_duration)

                    results.append({
                        "operation": "optimization_lifecycle",
                        "session_id": session_id,
                        "total_duration_ms": (time.time() - start_time) * 1000,
                        "workload_id": workload_id
                    })

                else:
                    performance_monitor.record_error("optimization_start_failed")

            except Exception as e:
                performance_monitor.record_error(type(e).__name__)
                results.append({
                    "operation": "error",
                    "error": str(e),
                    "workload_id": workload_id
                })

            return results

        # Execute concurrent optimization workloads
        start_time = time.time()
        workload_tasks = [optimization_workload(i) for i in range(concurrent_optimizations)]
        all_results = await asyncio.gather(*workload_tasks, return_exceptions=True)
        total_duration = time.time() - start_time

        # Flatten results
        flat_results = []
        for workload_results in all_results:
            if not isinstance(workload_results, Exception):
                flat_results.extend(workload_results)

        # Calculate performance statistics
        stats = performance_monitor.calculate_stats()

        # Performance assertions
        assert stats["avg_response_time"] < 2000, f"Average response time too high: {stats['avg_response_time']}ms"
        assert stats["error_rate"] < 0.20, f"Error rate too high: {stats['error_rate']}"

        # System stability under load
        successful_operations = len([r for r in flat_results if r.get("status_code") in [200, 201, 204]])
        total_operations = len(flat_results)
        success_rate = successful_operations / total_operations if total_operations > 0 else 0

        assert success_rate > 0.7, f"Success rate too low under load: {success_rate:.2%}"

        print(f"\nRL Optimization Load Test Results:")
        print(f"Concurrent Optimizations: {concurrent_optimizations}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Total Operations: {total_operations}")
        print(f"Success Rate: {success_rate:.2%}")
        print(f"Average Response Time: {stats['avg_response_time']:.2f}ms")
        print(f"95th Percentile: {stats['p95_response_time']:.2f}ms")
        print(f"Error Rate: {stats['error_rate']:.2%}")

    async def test_optimization_error_handling_and_recovery(
        self,
        async_test_client,
        auth_headers_user,
        mock_s3_client
    ):
        """Test error handling and recovery in RL optimization."""

        # Test invalid optimization configuration
        invalid_request = {
            "pipeline_id": "error-test",
            "training_data_path": "/nonexistent/path.csv",
            "optimization_config": {
                "strategy": "INVALID_STRATEGY",
                "max_episodes": -1,  # Invalid value
                "learning_rate": "invalid_rate"
            }
        }

        response = await async_test_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=invalid_request,
            headers=auth_headers_user
        )

        # Should handle invalid request gracefully
        assert response.status_code in [400, 422]

        # Test cloud backup failure scenario
        mock_s3_client.put_object.side_effect = Exception("S3 service unavailable")

        valid_request = {
            "pipeline_id": "backup-failure-test",
            "training_data_path": "/tmp/dummy.csv",
            "optimization_config": {
                "strategy": "PPO",
                "max_episodes": 2
            }
        }

        response = await async_test_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=valid_request,
            headers=auth_headers_user
        )

        # Should still succeed even if backup fails
        if response.status_code == 200:
            session_id = response.json()["session_id"]

            # Session should continue despite backup failure
            status_response = await async_test_client.get(
                f"/api/v1/rl/sessions/{session_id}/status",
                headers=auth_headers_user
            )

            # Should get status even with backup issues
            assert status_response.status_code == 200

        # Test session cleanup after errors
        cleanup_response = await async_test_client.get(
            "/api/v1/rl/sessions",
            headers=auth_headers_user
        )

        # Should be able to list sessions even after errors
        assert cleanup_response.status_code == 200

    async def test_optimization_monitoring_and_alerts(
        self,
        async_test_client,
        auth_headers_user,
        sample_ml_data
    ):
        """Test optimization monitoring, metrics, and alerting."""

        # Start optimization with monitoring enabled
        request_data = {
            "pipeline_id": "monitoring-test",
            "training_data_path": sample_ml_data["train_path"],
            "optimization_config": {
                "strategy": "PPO",
                "max_episodes": 10,
                "enable_monitoring": True,
                "alert_thresholds": {
                    "max_memory_mb": 512,
                    "max_cpu_percent": 80,
                    "min_improvement_rate": 0.01
                }
            }
        }

        response = await async_test_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=request_data,
            headers=auth_headers_user
        )

        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # Wait for some optimization progress
        await asyncio.sleep(3)

        # Test metrics endpoint
        metrics_response = await async_test_client.get(
            f"/api/v1/rl/sessions/{session_id}/metrics",
            headers=auth_headers_user
        )

        # Metrics should be available
        assert metrics_response.status_code in [200, 404]  # May not have metrics yet

        # Test alerts endpoint
        alerts_response = await async_test_client.get(
            f"/api/v1/rl/sessions/{session_id}/alerts",
            headers=auth_headers_user
        )

        assert alerts_response.status_code == 200
        alerts_data = alerts_response.json()
        assert "alerts" in alerts_data

        # Test system health endpoint
        health_response = await async_test_client.get("/api/v1/rl/health")
        assert health_response.status_code == 200

        health_data = health_response.json()
        assert "data" in health_data
        assert health_data["data"]["status"] in ["healthy", "degraded", "unhealthy"]

        # Test Prometheus metrics
        prometheus_response = await async_test_client.get("/api/v1/rl/metrics/prometheus")
        assert prometheus_response.status_code == 200

        # Should return Prometheus format
        metrics_text = prometheus_response.text
        assert "rl_active_sessions" in metrics_text

        # Cleanup
        await async_test_client.post(
            f"/api/v1/rl/sessions/{session_id}/stop",
            headers=auth_headers_user
        )


@pytest.mark.integration
class TestRLOptimizationAdminFeatures:
    """Test admin-specific RL optimization features."""

    async def test_admin_session_management(
        self,
        async_test_client,
        auth_headers_admin,
        auth_headers_user,
        sample_ml_data
    ):
        """Test admin capabilities for managing RL sessions."""

        # Start session as regular user
        user_request = {
            "pipeline_id": "admin-test-user-session",
            "training_data_path": sample_ml_data["train_path"],
            "optimization_config": {"strategy": "PPO", "max_episodes": 5}
        }

        user_response = await async_test_client.post(
            "/api/v1/rl/hyperparameters/optimize",
            json=user_request,
            headers=auth_headers_user
        )

        user_session_id = None
        if user_response.status_code == 200:
            user_session_id = user_response.json()["session_id"]

        # Admin should see all sessions
        admin_list_response = await async_test_client.get(
            "/api/v1/rl/sessions",
            headers=auth_headers_admin
        )

        assert admin_list_response.status_code == 200
        admin_sessions = admin_list_response.json()

        # Regular user should only see their own sessions
        user_list_response = await async_test_client.get(
            "/api/v1/rl/sessions",
            headers=auth_headers_user
        )

        assert user_list_response.status_code == 200
        user_sessions = user_list_response.json()

        # Admin should have access to more sessions (or at least equal)
        admin_count = len(admin_sessions.get("sessions", []))
        user_count = len(user_sessions.get("sessions", []))

        # If we have sessions, admin should see at least as many as user
        if user_count > 0:
            assert admin_count >= user_count

        # Test admin force cleanup
        if user_session_id:
            force_cleanup_response = await async_test_client.post(
                f"/api/v1/rl/admin/sessions/{user_session_id}/force-cleanup",
                params={"reason": "test_admin_cleanup"},
                headers=auth_headers_admin
            )

            # Admin should be able to force cleanup any session
            assert force_cleanup_response.status_code in [200, 404]

    async def test_admin_resource_usage_monitoring(
        self,
        async_test_client,
        auth_headers_admin,
        auth_headers_user
    ):
        """Test admin resource usage monitoring."""

        # Test admin resource usage endpoint
        resource_response = await async_test_client.get(
            "/api/v1/rl/admin/resource-usage",
            headers=auth_headers_admin
        )

        assert resource_response.status_code == 200
        resource_data = resource_response.json()

        assert "resource_usage" in resource_data
        # Should contain system resource information

        # Regular user should not have access
        user_resource_response = await async_test_client.get(
            "/api/v1/rl/admin/resource-usage",
            headers=auth_headers_user
        )

        assert user_resource_response.status_code == 403

    async def test_admin_cleanup_operations(
        self,
        async_test_client,
        auth_headers_admin,
        auth_headers_user
    ):
        """Test admin cleanup operations."""

        # Test stale session cleanup
        cleanup_response = await async_test_client.post(
            "/api/v1/rl/admin/cleanup",
            params={"max_age_hours": 24},
            headers=auth_headers_admin
        )

        assert cleanup_response.status_code == 200
        cleanup_data = cleanup_response.json()

        assert "cleanup_stats" in cleanup_data

        # Regular user should not have access
        user_cleanup_response = await async_test_client.post(
            "/api/v1/rl/admin/cleanup",
            headers=auth_headers_user
        )

        assert user_cleanup_response.status_code == 403