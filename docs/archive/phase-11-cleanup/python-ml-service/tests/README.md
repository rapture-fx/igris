# Python ML Service - Test Suite

Comprehensive test coverage for the Python ML Service gRPC server, covering unit tests, integration tests, performance benchmarks, and more.

## Overview

- **Test Files**: 10 test modules
- **Test Coverage Target**: >70%
- **Total Test Cases**: 200+ tests
- **Test Categories**: Unit, Integration, Performance, Security

## Test Structure

```
tests/
├── __init__.py                  # Test package initialization
├── conftest.py                  # Pytest fixtures and shared utilities
├── test_predict.py              # Tests for Predict RPC handler (30+ tests)
├── test_batch_predict.py        # Tests for BatchPredict RPC (25+ tests)
├── test_health.py               # Tests for HealthCheck & GetModelInfo (20+ tests)
├── test_model_mgmt.py           # Tests for ModelManager class (30+ tests)
├── test_integration.py          # Integration tests (25+ tests)
├── test_performance.py          # Performance benchmarks (20+ tests)
├── test_auth.py                 # Auth interceptor tests (30+ tests)
├── test_training.py             # Training orchestrator tests (40+ tests)
└── README.md                    # This file
```

## Running Tests

### Install Test Dependencies

```bash
cd apps/python-ml-service
pip install -r requirements-test.txt
```

### Run All Tests

```bash
pytest
```

### Run Specific Test Categories

```bash
# Unit tests only
pytest -m unit

# Integration tests
pytest -m integration

# Performance tests
pytest -m performance

# gRPC tests
pytest -m grpc

# Exclude slow tests
pytest -m "not slow"
```

### Run Specific Test Files

```bash
# Test prediction functionality
pytest tests/test_predict.py

# Test batch predictions
pytest tests/test_batch_predict.py

# Test authentication
pytest tests/test_auth.py
```

### Run with Coverage

```bash
# Generate coverage report
pytest --cov=service --cov=orchestration --cov-report=html

# View coverage in terminal
pytest --cov=service --cov=orchestration --cov-report=term-missing

# Generate coverage badge
pytest --cov=service --cov=orchestration --cov-report=xml
```

### Run Tests in Parallel

```bash
# Use multiple CPU cores
pytest -n auto

# Use specific number of workers
pytest -n 4
```

## Test Categories

### Unit Tests (`@pytest.mark.unit`)

Tests for individual components in isolation:

- **test_predict.py**: Predict RPC handler validation, error handling, edge cases
- **test_batch_predict.py**: BatchPredict handler, batch metrics, partial failures
- **test_health.py**: HealthCheck and GetModelInfo RPCs
- **test_model_mgmt.py**: ModelManager lifecycle, predictions, metadata
- **test_auth.py**: JWT and API key authentication, token validation
- **test_training.py**: Training orchestrator, job management, model training

**Run unit tests:**
```bash
pytest -m unit -v
```

### Integration Tests (`@pytest.mark.integration`)

Tests for full system integration:

- gRPC server lifecycle (start/stop)
- End-to-end request/response flow
- Concurrent client connections
- Channel management
- Error recovery

**Run integration tests:**
```bash
pytest -m integration -v
```

### Performance Tests (`@pytest.mark.performance`)

Benchmarks and performance validation:

- Latency measurements (P50, P95, P99)
- Throughput testing
- Memory usage tracking
- Scalability tests
- Batch vs single prediction comparison

**Run performance tests:**
```bash
pytest -m performance -v
```

**Target Metrics:**
- P99 latency: <100ms (mock model)
- Throughput: >10 req/s (single), >50 predictions/s (batch)
- Memory: <50MB increase for 100 predictions

### Slow Tests (`@pytest.mark.slow`)

Long-running tests (sustained load, memory leak detection):

```bash
# Run slow tests explicitly
pytest -m slow -v

# Exclude slow tests from regular runs
pytest -m "not slow"
```

## Test Fixtures

### Shared Fixtures (conftest.py)

**Proto Message Fixtures:**
- `valid_predict_request`: Valid prediction request
- `valid_batch_predict_request`: Valid batch request
- `health_check_request_basic/detailed`: Health check requests
- Various invalid request fixtures for error testing

**Service Component Fixtures:**
- `model_manager`: Fresh ModelManager instance
- `ml_servicer`: MLServiceServicer instance
- `mock_context`: Mock gRPC context
- `training_orchestrator`: TrainingOrchestrator with temp directory

**gRPC Server Fixtures:**
- `grpc_server`: Running gRPC server
- `grpc_channel`: gRPC channel for client
- `grpc_stub`: gRPC stub for making requests

**Test Data Generators:**
- `sample_features`: Single feature vector
- `sample_features_batch`: Batch of feature vectors
- `training_data_sample`: Training dataset

**Authentication Fixtures:**
- `jwt_secret`: JWT secret key
- `valid_jwt_token`: Valid JWT token
- `expired_jwt_token`: Expired token
- `valid_api_keys`: Set of valid API keys

## Coverage Goals

### Target Coverage: >70%

**Coverage by Module:**

| Module | Target | Focus Areas |
|--------|--------|-------------|
| `service/server.py` | >80% | RPC handlers, ModelManager |
| `service/auth_interceptor.py` | >70% | Auth validation, token handling |
| `orchestration/training_orchestrator.py` | >70% | Training lifecycle, metrics |

**Excluded from Coverage:**
- Proto-generated files (`*_pb2.py`, `*_pb2_grpc.py`)
- Main entry points (`if __name__ == '__main__'`)

## Test Best Practices

### Writing New Tests

1. **Use Descriptive Names**: `test_predict_with_valid_features_returns_success`
2. **Test One Thing**: Each test should verify a single behavior
3. **Use Fixtures**: Leverage shared fixtures from conftest.py
4. **Mark Tests**: Add appropriate markers (@pytest.mark.unit, etc.)
5. **Test Edge Cases**: Include boundary conditions and error paths

### Example Test

```python
@pytest.mark.unit
@pytest.mark.grpc
def test_predict_missing_model_id(ml_servicer, invalid_predict_request_no_model, mock_context):
    """Test prediction fails when model_id is missing"""
    response = ml_servicer.Predict(invalid_predict_request_no_model, mock_context)

    assert response.error == "model_id is required"
    mock_context.set_code.assert_called_with(grpc.StatusCode.INVALID_ARGUMENT)
```

## CI/CD Integration

### GitHub Actions

The test suite integrates with CI/CD pipelines:

```yaml
# .github/workflows/test-python-ml.yml
- name: Run Tests
  run: |
    cd apps/python-ml-service
    pytest --cov --cov-report=xml

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./apps/python-ml-service/coverage.xml
```

### Pre-commit Hooks

Run tests before committing:

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Run manually
pre-commit run --all-files
```

## Debugging Tests

### Verbose Output

```bash
# Show detailed test output
pytest -v

# Show print statements
pytest -s

# Show local variables on failure
pytest -l
```

### Run Single Test

```bash
# Run specific test
pytest tests/test_predict.py::TestPredictRPC::test_predict_valid_request

# Run tests matching pattern
pytest -k "test_predict_valid"
```

### Debug with PDB

```bash
# Drop into debugger on failure
pytest --pdb

# Drop into debugger on first failure
pytest -x --pdb
```

### Test Logs

```bash
# Show log output
pytest --log-cli-level=DEBUG

# Capture logs to file
pytest --log-file=test.log
```

## Common Issues

### gRPC Port Conflicts

If tests fail with "Address already in use":

```bash
# Find process using port 50052
lsof -i :50052

# Kill process
kill -9 <PID>
```

### Import Errors

Ensure proto files are generated:

```bash
cd apps/python-ml-service
./generate_proto.sh
```

### Fixture Issues

Reset singleton instances if tests interfere:

```python
@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset singleton between tests"""
    import training_orchestrator
    training_orchestrator._orchestrator = None
    yield
    training_orchestrator._orchestrator = None
```

## Performance Benchmarking

### Benchmark Tests

Use `pytest-benchmark` for performance testing:

```bash
# Run benchmarks
pytest tests/test_performance.py --benchmark-only

# Compare benchmarks
pytest --benchmark-compare

# Save benchmark results
pytest --benchmark-save=baseline
```

### Memory Profiling

Profile memory usage:

```bash
# Install memory profiler
pip install memory-profiler

# Run with memory profiling
python -m memory_profiler tests/test_performance.py
```

## Contributing

### Adding New Tests

1. Create test file in `tests/` directory
2. Import necessary fixtures from `conftest.py`
3. Add appropriate test markers
4. Follow naming conventions
5. Update this README if adding new test categories

### Test Review Checklist

- [ ] Tests are isolated and don't depend on execution order
- [ ] Appropriate fixtures are used
- [ ] Test markers are applied
- [ ] Edge cases and error paths are tested
- [ ] Tests are deterministic (no flaky tests)
- [ ] Clear assertion messages
- [ ] Documentation updated if needed

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-benchmark](https://pytest-benchmark.readthedocs.io/)
- [gRPC Python Testing](https://grpc.io/docs/languages/python/basics/#testing)
- [Coverage.py](https://coverage.readthedocs.io/)

## Contact

For questions about the test suite:
- Review test code comments
- Check fixture documentation in `conftest.py`
- Consult main project README
