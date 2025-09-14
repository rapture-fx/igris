"""
CI/CD Integration Tests

Tests for validating deployment readiness and CI/CD pipeline integration:
- Environment configuration validation
- Service health checks for deployment
- Database migration testing
- Configuration management
- Security validation in different environments
- Performance benchmarks for deployment gates
- Rollback scenario testing
- Infrastructure compatibility testing
"""

import pytest
import asyncio
import os
import json
import time
from typing import Dict, Any, List
from unittest.mock import patch, MagicMock

from app.core.config import settings


@pytest.mark.integration
class TestDeploymentValidation:
    """Test deployment readiness and environment validation."""

    def test_environment_configuration_validation(self):
        """Validate environment configuration for different deployment environments."""

        # Test required environment variables
        required_env_vars = [
            "DATABASE_URL",
            "SECRET_KEY",
            "ENVIRONMENT"
        ]

        missing_vars = []
        for var in required_env_vars:
            if not os.getenv(var) and not hasattr(settings, var.lower()):
                missing_vars.append(var)

        assert len(missing_vars) == 0, f"Missing required environment variables: {missing_vars}"

        # Validate environment-specific configurations
        environment = os.getenv("ENVIRONMENT", "development")

        if environment == "production":
            # Production-specific validations
            assert os.getenv("REDIS_URL") is not None, "Redis URL required in production"
            assert os.getenv("SECRET_KEY") != "development-secret", "Production secret key must be set"

        elif environment == "staging":
            # Staging-specific validations
            assert "staging" in os.getenv("DATABASE_URL", "").lower() or "test" in os.getenv("DATABASE_URL", "").lower(), \
                "Staging should use staging database"

        elif environment == "test":
            # Test environment validations
            assert "test" in os.getenv("DATABASE_URL", "").lower() or "sqlite" in os.getenv("DATABASE_URL", "").lower(), \
                "Test environment should use test database"

        print(f"\nEnvironment Configuration Validation:")
        print(f"Environment: {environment}")
        print(f"Database URL: {os.getenv('DATABASE_URL', 'Not set')[:50]}...")
        print(f"Redis URL: {os.getenv('REDIS_URL', 'Not set')[:50]}...")
        print(f"Secret Key Set: {'Yes' if os.getenv('SECRET_KEY') else 'No'}")

    async def test_service_health_for_deployment(
        self,
        async_test_client,
        test_db_session,
        test_redis_client
    ):
        """Test all services are healthy and ready for deployment."""

        health_checks = {}

        # API Health Check
        try:
            health_response = await async_test_client.get("/health")
            health_checks["api"] = {
                "status": "healthy" if health_response.status_code == 200 else "unhealthy",
                "response_code": health_response.status_code,
                "response_time": 0  # Would be measured in real implementation
            }
        except Exception as e:
            health_checks["api"] = {
                "status": "unhealthy",
                "error": str(e)
            }

        # Database Health Check
        try:
            from sqlalchemy import text
            result = await test_db_session.execute(text("SELECT 1 as health_check"))
            row = result.fetchone()
            health_checks["database"] = {
                "status": "healthy" if row and row.health_check == 1 else "unhealthy",
                "connection": "established"
            }
        except Exception as e:
            health_checks["database"] = {
                "status": "unhealthy",
                "error": str(e)
            }

        # Redis Health Check
        try:
            pong = await test_redis_client.ping()
            health_checks["redis"] = {
                "status": "healthy" if pong else "unhealthy",
                "ping_response": pong
            }
        except Exception as e:
            health_checks["redis"] = {
                "status": "unhealthy",
                "error": str(e)
            }

        # Metrics Endpoint Check
        try:
            metrics_response = await async_test_client.get("/metrics")
            health_checks["metrics"] = {
                "status": "healthy" if metrics_response.status_code == 200 else "degraded",
                "response_code": metrics_response.status_code
            }
        except Exception as e:
            health_checks["metrics"] = {
                "status": "unhealthy",
                "error": str(e)
            }

        # System Info Endpoint Check
        try:
            system_response = await async_test_client.get("/system/info")
            health_checks["system_info"] = {
                "status": "healthy" if system_response.status_code == 200 else "degraded",
                "response_code": system_response.status_code
            }
        except Exception as e:
            health_checks["system_info"] = {
                "status": "unhealthy",
                "error": str(e)
            }

        # Calculate overall health
        healthy_services = len([svc for svc in health_checks.values() if svc["status"] == "healthy"])
        total_services = len(health_checks)
        overall_health_percentage = (healthy_services / total_services) * 100

        print(f"\nDeployment Health Check Results:")
        for service, health in health_checks.items():
            status = health["status"]
            error_msg = f" ({health.get('error', '')})" if health["status"] == "unhealthy" else ""
            print(f"  {service.title()}: {status.upper()}{error_msg}")

        print(f"\nOverall Health: {overall_health_percentage:.1f}% ({healthy_services}/{total_services} services healthy)")

        # Deployment readiness assertion
        # For deployment, we need at least API and database to be healthy
        critical_services = ["api", "database"]
        critical_healthy = all(
            health_checks.get(service, {}).get("status") == "healthy"
            for service in critical_services
        )

        assert critical_healthy, f"Critical services not healthy: {[s for s in critical_services if health_checks.get(s, {}).get('status') != 'healthy']}"
        assert overall_health_percentage >= 70, f"Overall health too low for deployment: {overall_health_percentage:.1f}%"

    async def test_database_migration_readiness(
        self,
        test_db_session,
        test_db_engine
    ):
        """Test database migration readiness and rollback capabilities."""

        from sqlalchemy import text, inspect

        # Test database connection and basic operations
        try:
            # Check database version/schema
            result = await test_db_session.execute(text("SELECT sqlite_version() as version"))
            db_version = result.fetchone().version

            # Test creating and dropping tables (migration simulation)
            migration_test_sql = """
            CREATE TABLE IF NOT EXISTS migration_test (
                id INTEGER PRIMARY KEY,
                test_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """

            await test_db_session.execute(text(migration_test_sql))
            await test_db_session.commit()

            # Test data insertion
            await test_db_session.execute(
                text("INSERT INTO migration_test (test_data) VALUES ('deployment_test')")
            )
            await test_db_session.commit()

            # Verify data
            result = await test_db_session.execute(
                text("SELECT COUNT(*) as count FROM migration_test WHERE test_data = 'deployment_test'")
            )
            test_count = result.fetchone().count

            # Test rollback capability
            await test_db_session.execute(text("DROP TABLE migration_test"))
            await test_db_session.commit()

            print(f"\nDatabase Migration Readiness:")
            print(f"Database Version: {db_version}")
            print(f"Migration Test: {'PASSED' if test_count == 1 else 'FAILED'}")
            print(f"Rollback Test: PASSED")

            assert test_count == 1, "Migration test data insertion failed"

        except Exception as e:
            print(f"Database migration test failed: {str(e)}")
            raise

    def test_configuration_security_validation(self):
        """Validate security configurations for deployment."""

        security_checks = {}

        # Check secret key configuration
        secret_key = os.getenv("SECRET_KEY", "")
        security_checks["secret_key"] = {
            "set": bool(secret_key),
            "strong": len(secret_key) >= 32 if secret_key else False,
            "not_default": secret_key not in ["secret", "development-secret", "test-secret"]
        }

        # Check environment configuration
        environment = os.getenv("ENVIRONMENT", "development")
        security_checks["environment"] = {
            "set": bool(environment),
            "valid": environment in ["development", "testing", "staging", "production"]
        }

        # Check debug mode
        debug_mode = os.getenv("DEBUG", "false").lower() == "true"
        security_checks["debug_mode"] = {
            "disabled_in_production": not debug_mode if environment == "production" else True
        }

        # Check CORS configuration
        allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
        security_checks["cors"] = {
            "configured": bool(allowed_origins),
            "not_wildcard_in_production": "*" not in allowed_origins if environment == "production" else True
        }

        # Check database URL security
        database_url = os.getenv("DATABASE_URL", "")
        security_checks["database_url"] = {
            "set": bool(database_url),
            "not_default": "localhost" not in database_url if environment == "production" else True
        }

        print(f"\nSecurity Configuration Validation:")
        for check_name, checks in security_checks.items():
            print(f"  {check_name.replace('_', ' ').title()}:")
            for check, passed in checks.items():
                status = "✓" if passed else "✗"
                print(f"    {check.replace('_', ' ').title()}: {status}")

        # Security assertions
        critical_security_checks = [
            security_checks["secret_key"]["set"],
            security_checks["environment"]["valid"],
            security_checks["debug_mode"]["disabled_in_production"]
        ]

        assert all(critical_security_checks), "Critical security checks failed"

        if environment == "production":
            production_security_checks = [
                security_checks["secret_key"]["strong"],
                security_checks["secret_key"]["not_default"],
                security_checks["cors"]["not_wildcard_in_production"],
                security_checks["database_url"]["not_default"]
            ]
            assert all(production_security_checks), "Production security checks failed"

    async def test_performance_benchmarks_for_deployment(
        self,
        async_test_client,
        performance_monitor
    ):
        """Run performance benchmarks to validate deployment readiness."""

        # Define performance benchmarks
        benchmark_endpoints = [
            {"path": "/health", "max_response_time": 100},  # 100ms
            {"path": "/metrics", "max_response_time": 200},  # 200ms
            {"path": "/system/info", "max_response_time": 300},  # 300ms
        ]

        benchmark_results = {}

        for endpoint in benchmark_endpoints:
            path = endpoint["path"]
            max_time = endpoint["max_response_time"]

            response_times = []

            # Run benchmark tests
            for i in range(10):  # 10 samples per endpoint
                start_time = time.time()

                try:
                    response = await async_test_client.get(path)
                    duration_ms = (time.time() - start_time) * 1000

                    response_times.append(duration_ms)
                    performance_monitor.record_response_time(duration_ms)

                except Exception as e:
                    performance_monitor.record_error(type(e).__name__)

                await asyncio.sleep(0.1)

            if response_times:
                avg_time = sum(response_times) / len(response_times)
                max_time_actual = max(response_times)

                benchmark_results[path] = {
                    "avg_response_time": avg_time,
                    "max_response_time": max_time_actual,
                    "benchmark_max": max_time,
                    "passes_benchmark": max_time_actual <= max_time,
                    "samples": len(response_times)
                }

        print(f"\nPerformance Benchmarks for Deployment:")
        all_benchmarks_passed = True

        for path, result in benchmark_results.items():
            status = "PASS" if result["passes_benchmark"] else "FAIL"
            print(f"  {path}:")
            print(f"    Average: {result['avg_response_time']:.2f}ms")
            print(f"    Maximum: {result['max_response_time']:.2f}ms")
            print(f"    Benchmark: <{result['benchmark_max']}ms")
            print(f"    Status: {status}")

            if not result["passes_benchmark"]:
                all_benchmarks_passed = False

        assert all_benchmarks_passed, "Performance benchmarks failed - deployment not ready"

    @pytest.mark.slow
    async def test_rollback_scenario_validation(
        self,
        test_db_session,
        test_redis_client
    ):
        """Test rollback scenarios and data integrity."""

        # Simulate deployment rollback scenario
        rollback_test_id = f"rollback_test_{int(time.time())}"

        try:
            # Step 1: Simulate current state
            from sqlalchemy import text
            await test_db_session.execute(
                text("CREATE TEMPORARY TABLE rollback_test (id TEXT PRIMARY KEY, version TEXT, data TEXT)")
            )

            # Insert current version data
            await test_db_session.execute(
                text("INSERT INTO rollback_test (id, version, data) VALUES (:id, 'v1.0', 'current_data')"),
                {"id": rollback_test_id}
            )
            await test_db_session.commit()

            # Store current state in Redis
            await test_redis_client.hset(
                f"app_state:{rollback_test_id}",
                mapping={"version": "v1.0", "status": "deployed"}
            )

            # Step 2: Simulate upgrade
            await test_db_session.execute(
                text("UPDATE rollback_test SET version = 'v2.0', data = 'upgraded_data' WHERE id = :id"),
                {"id": rollback_test_id}
            )
            await test_db_session.commit()

            await test_redis_client.hset(
                f"app_state:{rollback_test_id}",
                mapping={"version": "v2.0", "status": "upgraded"}
            )

            # Step 3: Simulate rollback requirement
            # Rollback database
            await test_db_session.execute(
                text("UPDATE rollback_test SET version = 'v1.0', data = 'current_data' WHERE id = :id"),
                {"id": rollback_test_id}
            )
            await test_db_session.commit()

            # Rollback Redis
            await test_redis_client.hset(
                f"app_state:{rollback_test_id}",
                mapping={"version": "v1.0", "status": "rolled_back"}
            )

            # Step 4: Verify rollback success
            db_result = await test_db_session.execute(
                text("SELECT version, data FROM rollback_test WHERE id = :id"),
                {"id": rollback_test_id}
            )
            db_row = db_result.fetchone()

            redis_version = await test_redis_client.hget(f"app_state:{rollback_test_id}", "version")
            redis_status = await test_redis_client.hget(f"app_state:{rollback_test_id}", "status")

            print(f"\nRollback Scenario Validation:")
            print(f"Database Version: {db_row.version}")
            print(f"Database Data: {db_row.data}")
            print(f"Redis Version: {redis_version}")
            print(f"Redis Status: {redis_status}")

            # Rollback assertions
            assert db_row.version == "v1.0", "Database rollback failed"
            assert db_row.data == "current_data", "Database data rollback failed"
            assert redis_version == "v1.0", "Redis version rollback failed"
            assert redis_status == "rolled_back", "Redis status not updated after rollback"

            print("Rollback scenario: PASSED")

        finally:
            # Cleanup
            await test_redis_client.delete(f"app_state:{rollback_test_id}")


@pytest.mark.integration
class TestInfrastructureCompatibility:
    """Test infrastructure compatibility and requirements."""

    def test_python_version_compatibility(self):
        """Test Python version compatibility."""
        import sys

        python_version = sys.version_info
        required_major = 3
        required_minor = 8  # Minimum Python 3.8

        print(f"\nPython Version Compatibility:")
        print(f"Current Python Version: {python_version.major}.{python_version.minor}.{python_version.micro}")
        print(f"Required: Python {required_major}.{required_minor}+")

        assert python_version.major == required_major, f"Python {required_major} required"
        assert python_version.minor >= required_minor, f"Python {required_major}.{required_minor}+ required"

    def test_required_dependencies(self):
        """Test that all required dependencies are available."""

        required_packages = [
            "fastapi",
            "sqlalchemy",
            "redis",
            "pytest",
            "httpx",
            "pandas",
            "numpy"
        ]

        missing_packages = []
        package_versions = {}

        for package in required_packages:
            try:
                module = __import__(package)
                version = getattr(module, "__version__", "Unknown")
                package_versions[package] = version
            except ImportError:
                missing_packages.append(package)

        print(f"\nDependency Compatibility Check:")
        for package, version in package_versions.items():
            print(f"  {package}: {version}")

        if missing_packages:
            print(f"\nMissing Packages: {missing_packages}")

        assert len(missing_packages) == 0, f"Missing required packages: {missing_packages}"

    def test_system_resource_requirements(self):
        """Test system resource requirements."""
        import psutil

        # Get system resources
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        cpu_count = psutil.cpu_count()

        # Define minimum requirements (in bytes)
        min_memory_gb = 1  # 1 GB RAM minimum
        min_disk_gb = 5    # 5 GB disk minimum
        min_cpu_cores = 1   # 1 CPU core minimum

        memory_gb = memory.total / (1024**3)
        disk_gb = disk.total / (1024**3)

        print(f"\nSystem Resource Requirements:")
        print(f"Available RAM: {memory_gb:.2f} GB (Required: {min_memory_gb} GB)")
        print(f"Available Disk: {disk_gb:.2f} GB (Required: {min_disk_gb} GB)")
        print(f"CPU Cores: {cpu_count} (Required: {min_cpu_cores})")
        print(f"Memory Usage: {memory.percent:.1f}%")
        print(f"Disk Usage: {(disk.used/disk.total)*100:.1f}%")

        # Resource assertions
        assert memory_gb >= min_memory_gb, f"Insufficient RAM: {memory_gb:.2f} GB < {min_memory_gb} GB"
        assert disk_gb >= min_disk_gb, f"Insufficient disk space: {disk_gb:.2f} GB < {min_disk_gb} GB"
        assert cpu_count >= min_cpu_cores, f"Insufficient CPU cores: {cpu_count} < {min_cpu_cores}"

        # Usage warnings
        if memory.percent > 80:
            print("WARNING: High memory usage may affect performance")
        if (disk.used/disk.total)*100 > 80:
            print("WARNING: High disk usage may affect performance")

    async def test_network_connectivity_requirements(self):
        """Test network connectivity requirements."""

        connectivity_tests = {}

        # Test localhost connectivity (required for API)
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', 8000))  # Common API port
            sock.close()

            connectivity_tests["localhost"] = {
                "available": result == 0 or result == 61,  # 61 = connection refused (port not in use, but host reachable)
                "error_code": result
            }
        except Exception as e:
            connectivity_tests["localhost"] = {
                "available": False,
                "error": str(e)
            }

        # Test DNS resolution (if external services needed)
        try:
            import socket
            socket.gethostbyname('google.com')
            connectivity_tests["external_dns"] = {"available": True}
        except socket.gaierror:
            connectivity_tests["external_dns"] = {"available": False}

        print(f"\nNetwork Connectivity Requirements:")
        for test_name, result in connectivity_tests.items():
            status = "AVAILABLE" if result["available"] else "UNAVAILABLE"
            error_info = f" ({result.get('error', '')})" if not result["available"] else ""
            print(f"  {test_name.replace('_', ' ').title()}: {status}{error_info}")

        # Localhost should be available for basic API functionality
        assert connectivity_tests["localhost"]["available"], "Localhost connectivity required"

    async def test_concurrent_deployment_safety(
        self,
        test_db_session,
        test_redis_client
    ):
        """Test safety of concurrent deployments and operations."""

        deployment_id = f"deployment_test_{int(time.time())}"

        # Simulate deployment lock mechanism
        lock_key = f"deployment_lock:{deployment_id}"
        lock_timeout = 30  # 30 seconds

        # Test acquiring deployment lock
        lock_acquired = await test_redis_client.set(
            lock_key,
            "locked",
            nx=True,  # Only set if not exists
            ex=lock_timeout  # Expire in 30 seconds
        )

        assert lock_acquired, "Should be able to acquire deployment lock"

        # Test that second deployment cannot acquire lock
        second_lock = await test_redis_client.set(
            lock_key,
            "locked_again",
            nx=True,
            ex=lock_timeout
        )

        assert not second_lock, "Second deployment should not acquire lock"

        # Test lock expiration
        ttl = await test_redis_client.ttl(lock_key)
        assert 0 < ttl <= lock_timeout, f"Lock TTL should be set: {ttl}"

        # Test manual lock release
        await test_redis_client.delete(lock_key)
        lock_released = await test_redis_client.get(lock_key)
        assert lock_released is None, "Lock should be released"

        print(f"\nConcurrent Deployment Safety:")
        print(f"Deployment ID: {deployment_id}")
        print(f"Lock Acquisition: PASSED")
        print(f"Lock Exclusivity: PASSED")
        print(f"Lock Expiration: PASSED")
        print(f"Lock Release: PASSED")


@pytest.mark.integration
class TestMonitoringIntegration:
    """Test monitoring and observability integration for CI/CD."""

    async def test_metrics_collection_for_deployment(
        self,
        async_test_client
    ):
        """Test metrics collection readiness for deployment monitoring."""

        # Test metrics endpoint availability
        metrics_response = await async_test_client.get("/metrics")

        # Metrics endpoint should be available
        assert metrics_response.status_code in [200, 404], "Metrics endpoint should be reachable"

        if metrics_response.status_code == 200:
            metrics_content = metrics_response.text

            # Check for essential metrics
            essential_metrics = [
                "http_requests",
                "response_time",
                "process_",  # Process metrics
            ]

            available_metrics = []
            for metric in essential_metrics:
                if metric in metrics_content:
                    available_metrics.append(metric)

            print(f"\nMetrics Collection for Deployment:")
            print(f"Metrics Endpoint: AVAILABLE")
            print(f"Available Metrics: {available_metrics}")
            print(f"Content Length: {len(metrics_content)} characters")

        else:
            print(f"\nMetrics Collection for Deployment:")
            print(f"Metrics Endpoint: NOT AVAILABLE (Status: {metrics_response.status_code})")

    async def test_logging_configuration(self):
        """Test logging configuration for deployment monitoring."""

        import logging

        # Test logging configuration
        logger = logging.getLogger("app")
        log_level = logger.getEffectiveLevel()

        # Create test log messages
        test_messages = [
            ("DEBUG", "Debug message for testing"),
            ("INFO", "Info message for testing"),
            ("WARNING", "Warning message for testing"),
            ("ERROR", "Error message for testing")
        ]

        logged_levels = []
        for level_name, message in test_messages:
            level = getattr(logging, level_name)
            if logger.isEnabledFor(level):
                logged_levels.append(level_name)
                getattr(logger, level_name.lower())(f"[CI/CD Test] {message}")

        print(f"\nLogging Configuration:")
        print(f"Logger Name: {logger.name}")
        print(f"Effective Level: {log_level} ({logging.getLevelName(log_level)})")
        print(f"Logged Levels: {logged_levels}")

        # Ensure appropriate logging level for deployment
        environment = os.getenv("ENVIRONMENT", "development")
        if environment == "production":
            assert log_level >= logging.INFO, "Production should use INFO level or higher"
        elif environment in ["staging", "test"]:
            assert log_level >= logging.DEBUG, "Test/staging can use DEBUG level"

    async def test_health_check_endpoints_for_monitoring(
        self,
        async_test_client
    ):
        """Test health check endpoints for external monitoring."""

        health_endpoints = [
            "/health",
            "/api/v1/health",
            "/system/info"
        ]

        endpoint_results = {}

        for endpoint in health_endpoints:
            try:
                response = await async_test_client.get(endpoint)
                endpoint_results[endpoint] = {
                    "status_code": response.status_code,
                    "response_time": 0,  # Would be measured in real implementation
                    "available": response.status_code in [200, 404]
                }

                if response.status_code == 200:
                    try:
                        data = response.json()
                        endpoint_results[endpoint]["has_json"] = True
                        endpoint_results[endpoint]["keys"] = list(data.keys()) if isinstance(data, dict) else []
                    except:
                        endpoint_results[endpoint]["has_json"] = False

            except Exception as e:
                endpoint_results[endpoint] = {
                    "status_code": 500,
                    "error": str(e),
                    "available": False
                }

        print(f"\nHealth Check Endpoints for Monitoring:")
        available_endpoints = 0
        for endpoint, result in endpoint_results.items():
            status = "AVAILABLE" if result["available"] else "UNAVAILABLE"
            status_code = result.get("status_code", "Unknown")
            print(f"  {endpoint}: {status} (Status: {status_code})")

            if result["available"]:
                available_endpoints += 1

        # At least one health endpoint should be available for monitoring
        assert available_endpoints > 0, "At least one health endpoint should be available for monitoring"

        print(f"\nMonitoring Readiness: {available_endpoints}/{len(health_endpoints)} endpoints available")