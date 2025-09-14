# Schlep-engine Integration Tests

This directory contains comprehensive integration tests for the Schlep-engine platform, validating P0 and P1 features across all system components.

## 🏗️ Test Architecture

The integration test suite is designed to validate the entire system stack:

```
┌─────────────────────────────────────────┐
│           Integration Tests              │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Rate        │  │ RL Optimization │   │
│  │ Limiting    │  │ & ML Pipeline   │   │
│  └─────────────┘  └─────────────────┘   │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ System      │  │ Load &          │   │
│  │ Integration │  │ Performance     │   │
│  └─────────────┘  └─────────────────┘   │
│  ┌─────────────────────────────────────┐ │
│  │       CI/CD Integration             │ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│              Test Fixtures              │
│  Database • Redis • S3 • Auth • Data   │
└─────────────────────────────────────────┘
```

## 📁 Test Structure

### Core Test Files

| File | Purpose | Features Tested |
|------|---------|----------------|
| `conftest.py` | Test configuration and fixtures | Database, Redis, S3, Auth setup |
| `test_rate_limiting_integration.py` | Rate limiting middleware | IP/User-based limits, algorithms, load |
| `test_rl_optimization_integration.py` | RL system integration | Model persistence, cloud backup, strategies |
| `test_ml_pipeline_integration.py` | ML pipeline & monitoring | Data quality, lineage, performance monitoring |
| `test_system_integration.py` | Cross-service integration | Database, Redis, S3, consistency |
| `test_load_performance.py` | Load testing & performance | API load, resource monitoring, stability |
| `test_ci_cd_integration.py` | Deployment validation | Environment config, health checks, rollback |

## 🧪 Test Categories

### P0 Features (Critical)
- **Rate Limiting**: User-based and IP-based rate limiting with Redis backend
- **RL Model Persistence**: Model checkpointing with S3 cloud backup
- **ML Performance Monitoring**: Real-time metrics and alerting
- **Data Lineage Tracking**: End-to-end data flow tracking

### P1 Features (Important)
- **API Integration**: All ML pipeline endpoints
- **System Integration**: Database, Redis, and cloud storage
- **Load Testing**: Performance under various load scenarios
- **CI/CD Integration**: Deployment readiness validation

### Performance Testing
- **Load Scenarios**: Light, moderate, heavy, and stress testing
- **Resource Monitoring**: CPU, memory, and connection usage
- **Throughput Validation**: Request/response performance metrics
- **Stability Testing**: Sustained load and error recovery

## 🚀 Getting Started

### Prerequisites

```bash
# Python 3.8+
python --version

# Install dependencies
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx

# Set up test environment
export ENVIRONMENT=test
export DATABASE_URL=sqlite+aiosqlite:///./test_integration.db
export REDIS_URL=redis://localhost:6379/1
export SECRET_KEY=test-secret-key-for-integration-tests
```

### Running Tests

#### All Integration Tests
```bash
# Run all integration tests
pytest apps/api/tests/integration_tests/ -v

# Run with coverage
pytest apps/api/tests/integration_tests/ --cov=app --cov-report=html

# Run with performance markers
pytest apps/api/tests/integration_tests/ -m "performance" -v
```

#### Specific Test Categories
```bash
# Rate limiting tests
pytest apps/api/tests/integration_tests/test_rate_limiting_integration.py -v

# RL optimization tests
pytest apps/api/tests/integration_tests/test_rl_optimization_integration.py -v

# ML pipeline tests
pytest apps/api/tests/integration_tests/test_ml_pipeline_integration.py -v

# System integration tests
pytest apps/api/tests/integration_tests/test_system_integration.py -v

# Load and performance tests
pytest apps/api/tests/integration_tests/test_load_performance.py -v

# CI/CD integration tests
pytest apps/api/tests/integration_tests/test_ci_cd_integration.py -v
```

#### Performance and Load Tests
```bash
# Light load tests only
pytest apps/api/tests/integration_tests/test_load_performance.py::TestAPILoadPerformance::test_api_endpoint_load_scenarios[light] -v

# All performance tests (may take longer)
pytest apps/api/tests/integration_tests/ -m "performance" -v

# Skip slow tests
pytest apps/api/tests/integration_tests/ -m "not slow" -v
```

## 📊 Test Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `test` | Test environment identifier |
| `DATABASE_URL` | `sqlite+aiosqlite:///./test_integration.db` | Test database URL |
| `REDIS_URL` | `redis://localhost:6379/1` | Test Redis URL |
| `SECRET_KEY` | `test-secret-key` | Test JWT secret |
| `LOG_LEVEL` | `WARNING` | Logging level for tests |
| `ENABLE_STREAM_PRODUCERS` | `false` | Disable streaming in tests |
| `ENABLE_MODEL_SERVING` | `false` | Disable model serving in tests |

### Test Data Configuration

```python
# Sample test configurations available in conftest.py
TestConfig.RATE_LIMIT_CONFIGS = {
    "strict": RateLimitConfig(requests_per_minute=5, requests_per_hour=20),
    "user_based": RateLimitConfig(requests_per_minute=10, rate_limit_type=RateLimitType.USER_BASED),
    "admin_bypass": RateLimitConfig(requests_per_minute=1, bypass_for_admin=True)
}

TestConfig.ML_PIPELINE_CONFIGS = {
    "hyperparameter_optimization": {...},
    "resource_allocation": {...}
}

TestConfig.PERFORMANCE_THRESHOLDS = {
    "api_response_time_ms": 500,
    "database_query_time_ms": 100,
    "redis_operation_time_ms": 10
}
```

## 🔧 Test Fixtures

### Database Testing
- **Isolated Sessions**: Each test gets a fresh database session
- **Transaction Rollback**: Automatic cleanup after each test
- **Concurrent Testing**: Connection pool validation
- **Migration Testing**: Schema change validation

### Redis Testing
- **Separate Database**: Uses Redis DB 1 for isolation
- **Automatic Cleanup**: Flushes test data after each test
- **Rate Limiting**: Real Redis-based rate limiting tests
- **Session Management**: Cache testing with TTL

### S3 Mock Integration
- **Mock S3 Client**: Simulates cloud storage operations
- **Backup Testing**: Model persistence and recovery
- **Error Scenarios**: Network failure and fallback testing
- **Performance**: Concurrent upload/download testing

### Authentication Testing
- **JWT Tokens**: Admin and user token generation
- **Role-Based**: Different permission level testing
- **Security Levels**: Rate limiting based on security levels
- **Session Management**: Redis-backed session testing

## 📈 Performance Benchmarks

### API Response Time Targets

| Endpoint Category | Target Response Time |
|-------------------|---------------------|
| Health Checks | < 100ms |
| Authentication | < 200ms |
| Data Quality Assessment | < 2000ms |
| ML Pipeline Operations | < 5000ms |
| RL Optimization | < 10000ms |

### Load Testing Scenarios

| Scenario | Concurrent Users | Requests/User | Duration | Success Rate Target |
|----------|------------------|---------------|----------|-------------------|
| Light | 10 | 20 | 2 min | >98% |
| Moderate | 25 | 50 | 5 min | >95% |
| Heavy | 50 | 100 | 10 min | >90% |
| Stress | 100 | 200 | 15 min | >80% |

### Resource Usage Limits

| Resource | Warning Threshold | Critical Threshold |
|----------|------------------|-------------------|
| Memory Usage | 80% | 90% |
| CPU Usage | 70% | 85% |
| Database Connections | 20 | 30 |
| Redis Memory | 100MB | 200MB |

## 🐛 Debugging Integration Tests

### Common Issues and Solutions

#### Database Connection Issues
```bash
# Check database accessibility
sqlite3 test_integration.db ".tables"

# Reset test database
rm test_integration.db
pytest apps/api/tests/integration_tests/test_system_integration.py::TestDatabaseIntegration::test_database_connection_and_basic_operations -v
```

#### Redis Connection Issues
```bash
# Check Redis connectivity
redis-cli -n 1 ping

# Clear test Redis database
redis-cli -n 1 flushdb

# Test Redis integration
pytest apps/api/tests/integration_tests/test_system_integration.py::TestRedisIntegration::test_redis_basic_operations -v
```

#### Performance Test Failures
```bash
# Run with detailed performance output
pytest apps/api/tests/integration_tests/test_load_performance.py -v -s

# Adjust performance thresholds in conftest.py if needed
# Check system resources during tests
htop  # or Activity Monitor on macOS
```

#### Rate Limiting Test Issues
```bash
# Test rate limiting in isolation
pytest apps/api/tests/integration_tests/test_rate_limiting_integration.py::TestRateLimitingIntegration::test_ip_based_rate_limiting -v -s

# Check Redis rate limiting data
redis-cli -n 1 keys "rate_limit:*"
```

### Verbose Test Output
```bash
# Maximum verbosity with output capture disabled
pytest apps/api/tests/integration_tests/ -v -s --tb=long

# Show local variables in tracebacks
pytest apps/api/tests/integration_tests/ --tb=auto --showlocals

# Run specific failing test with maximum detail
pytest apps/api/tests/integration_tests/test_name.py::TestClass::test_method -v -s --tb=long --showlocals
```

## 🔄 CI/CD Integration

### Pre-deployment Validation
```bash
# Full integration test suite for deployment
pytest apps/api/tests/integration_tests/ --maxfail=5

# Critical path tests only
pytest apps/api/tests/integration_tests/ -m "not slow" --maxfail=1

# Performance validation
pytest apps/api/tests/integration_tests/test_load_performance.py::TestAPILoadPerformance::test_api_endpoint_load_scenarios -v
```

### Health Check Validation
```bash
# Deployment readiness
pytest apps/api/tests/integration_tests/test_ci_cd_integration.py::TestDeploymentValidation::test_service_health_for_deployment -v

# Environment configuration
pytest apps/api/tests/integration_tests/test_ci_cd_integration.py::TestDeploymentValidation::test_environment_configuration_validation -v
```

### Rollback Testing
```bash
# Rollback scenario validation
pytest apps/api/tests/integration_tests/test_ci_cd_integration.py::TestDeploymentValidation::test_rollback_scenario_validation -v
```

## 📋 Test Coverage

### Feature Coverage Matrix

| Feature | Unit Tests | Integration Tests | Load Tests | E2E Tests |
|---------|------------|-------------------|------------|-----------|
| Rate Limiting | ✅ | ✅ | ✅ | ✅ |
| RL Optimization | ✅ | ✅ | ✅ | ❌ |
| ML Pipeline | ✅ | ✅ | ✅ | ❌ |
| Data Quality | ✅ | ✅ | ✅ | ❌ |
| Authentication | ✅ | ✅ | ✅ | ✅ |
| Database Ops | ✅ | ✅ | ✅ | ✅ |
| Redis Cache | ✅ | ✅ | ✅ | ✅ |
| S3 Storage | ✅ | ✅ | ✅ | ❌ |

### Code Coverage Targets

| Component | Target Coverage | Current Status |
|-----------|----------------|----------------|
| API Endpoints | 90% | ✅ |
| Middleware | 95% | ✅ |
| Services | 85% | ✅ |
| Database Models | 90% | ✅ |
| Authentication | 95% | ✅ |
| Rate Limiting | 95% | ✅ |

## 🚨 Critical Test Scenarios

### Must-Pass Tests for Production Deployment

1. **System Health Validation**
   ```bash
   pytest apps/api/tests/integration_tests/test_ci_cd_integration.py::TestDeploymentValidation::test_service_health_for_deployment
   ```

2. **Rate Limiting Under Load**
   ```bash
   pytest apps/api/tests/integration_tests/test_rate_limiting_integration.py::TestRateLimitingIntegration::test_rate_limiting_under_load
   ```

3. **Database Transaction Integrity**
   ```bash
   pytest apps/api/tests/integration_tests/test_system_integration.py::TestDatabaseIntegration::test_database_transaction_rollback
   ```

4. **RL Model Persistence**
   ```bash
   pytest apps/api/tests/integration_tests/test_rl_optimization_integration.py::TestRLOptimizationIntegration::test_model_persistence_and_recovery
   ```

5. **Performance Benchmarks**
   ```bash
   pytest apps/api/tests/integration_tests/test_ci_cd_integration.py::TestDeploymentValidation::test_performance_benchmarks_for_deployment
   ```

## 📝 Contributing

### Adding New Integration Tests

1. **Create test file following naming convention**: `test_<feature>_integration.py`
2. **Use existing fixtures from conftest.py** for consistency
3. **Include performance validation** where applicable
4. **Add documentation** for complex test scenarios
5. **Update this README** with new test information

### Test Development Guidelines

- **Use async/await** for all API and database operations
- **Include both success and failure scenarios**
- **Validate performance metrics** in load tests
- **Clean up resources** in test teardown
- **Use descriptive test names** and docstrings
- **Mock external services** appropriately
- **Include error scenarios** and recovery testing

### Code Quality Standards

- **pytest markers**: Use appropriate markers (`@pytest.mark.integration`, `@pytest.mark.performance`)
- **Type hints**: Include type annotations for test parameters
- **Documentation**: Comprehensive docstrings for test classes and methods
- **Error handling**: Proper exception testing and validation
- **Resource management**: Proper cleanup in finally blocks or fixtures

## 🔗 Related Documentation

- [API Documentation](../../docs/api.md)
- [Database Schema](../../docs/database.md)
- [Rate Limiting Configuration](../../docs/rate_limiting.md)
- [RL Optimization Guide](../../docs/rl_optimization.md)
- [Deployment Guide](../../docs/deployment.md)
- [Monitoring Setup](../../docs/monitoring.md)

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Maintainer**: Schlep-engine QA Team