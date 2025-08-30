# Schlep-engine Performance Testing Framework

A comprehensive performance testing framework designed to validate actual performance claims with real measured data, replacing false claims with honest, evidence-based metrics.

## Overview

This framework provides end-to-end performance testing capabilities including:

- **Load Testing** with realistic user behavior simulation
- **Data Volume Testing** with 1K, 10K, and 50K+ record datasets
- **Memory Profiling** and leak detection
- **Performance Regression** detection and monitoring
- **Benchmark Storage** and historical comparison
- **Real-time Dashboards** and comprehensive reporting
- **CI/CD Integration** for automated performance validation

## Quick Start

### 1. Install Dependencies

```bash
cd apps/api
pip install -r requirements.txt
```

### 2. Run Basic Performance Tests

```bash
# Run all performance tests
python -m pytest tests/performance_framework.py -v

# Run specific test categories  
python -m pytest -m performance -v
python -m pytest -m memory_test -v
python -m pytest -m volume_test -v
```

### 3. Run Load Tests with Locust

```bash
# Interactive load testing
locust -f tests/locust_load_tests.py --host=http://localhost:8000

# Headless load testing
locust -f tests/locust_load_tests.py \
    --host=http://localhost:8000 \
    --users 50 \
    --spawn-rate 10 \
    --run-time 300s \
    --headless
```

### 4. Run Data Volume Tests

```bash
# Test with different data volumes
python tests/data_volume_tests.py --volumes 1000 10000 50000

# Test specific dataset types
python tests/data_volume_tests.py --dataset employees --volume 10000
```

### 5. Memory Profiling

```bash
# Run memory profiling tests
python -m pytest tests/memory_profiling_tests.py -v -s

# Generate memory profiling report
python tests/memory_profiling_tests.py --profile-report
```

### 6. Performance Dashboard

```bash
# Start the performance dashboard
python tests/performance_dashboard.py --port 8080

# Generate static reports
python tests/performance_dashboard.py --generate-report --output reports/
```

## Framework Components

### 1. Performance Testing Framework (`performance_framework.py`)

Core framework providing:
- **BenchmarkResult**: Structured performance metrics
- **PerformanceBenchmarkDB**: SQLite-based benchmark storage
- **TestDataGenerator**: Realistic test data generation
- **PerformanceProfiler**: System resource monitoring
- **APIPerformanceTester**: Endpoint performance testing
- **PerformanceReporter**: HTML/JSON report generation

**Key Features:**
- Baseline comparison and regression detection
- Memory usage tracking
- CPU monitoring
- Throughput measurement
- Response time analysis (avg, P95, P99)
- Performance grading system

### 2. Load Testing (`locust_load_tests.py`)

Locust-based load testing with:
- **Multiple User Types**: API users, data processors, dashboard users, ML users
- **Realistic Behavior**: Weighted task distribution
- **Custom Metrics**: Performance threshold validation  
- **Load Patterns**: Spike testing, ramp-up scenarios
- **Real-time Monitoring**: Custom metrics collection

**User Simulation:**
- `APIUser`: Basic API interactions
- `DataProcessingUser`: Data processing operations
- `DashboardUser`: Analytics and dashboard usage
- `MLProcessingUser`: Machine learning operations
- `SpikeTestUser`: High-frequency requests

### 3. Data Volume Testing (`data_volume_tests.py`)

Scalability testing with:
- **Realistic Data**: Employee, sales, IoT sensor datasets
- **Volume Scaling**: 1K to 100K+ records
- **Throughput Measurement**: Records processed per second
- **Memory Monitoring**: Peak usage and growth patterns
- **Scalability Analysis**: Linear vs exponential scaling detection
- **Performance Grading**: A+ to F grading system

**Dataset Types:**
- **Employee Data**: HR records with complex nested structures
- **Sales Data**: Transaction records with calculations
- **IoT Sensor Data**: Time-series sensor readings

### 4. Memory Profiling (`memory_profiling_tests.py`)

Advanced memory analysis:
- **Line-by-Line Profiling**: Detailed memory usage tracking
- **Leak Detection**: Statistical analysis of memory growth
- **Resource Monitoring**: RSS, VMS, shared memory tracking
- **Efficiency Scoring**: Memory usage efficiency metrics
- **Visualization**: Memory usage charts and trends

**Memory Metrics:**
- Resident Set Size (RSS)
- Virtual Memory Size (VMS)
- Memory growth patterns
- Peak usage identification
- Leak detection algorithms

### 5. Performance Dashboard (`performance_dashboard.py`)

Web-based monitoring:
- **Real-time Dashboard**: Live performance metrics
- **Historical Trends**: Performance over time
- **Regression Detection**: Automated performance regression alerts
- **Interactive Charts**: Plotly-based visualizations
- **Alert System**: Performance threshold violations
- **Report Generation**: Comprehensive HTML reports

**Dashboard Features:**
- Performance trend visualization
- Regression analysis with severity levels
- Active alert monitoring
- Historical comparison charts
- Executive summary reports

### 6. CI/CD Integration (`.github/workflows/performance-testing.yml`)

Automated testing pipeline:
- **Multi-stage Testing**: Baseline → Load → Volume → Memory → Regression
- **Threshold Validation**: Automated pass/fail criteria
- **Artifact Storage**: Test results and reports
- **PR Comments**: Automatic performance feedback
- **Regression Detection**: Compare with historical baselines
- **Report Generation**: Comprehensive performance summaries

**Pipeline Stages:**
1. **Performance Baseline**: Core API performance tests
2. **Load Testing**: Concurrent user simulation
3. **Volume Testing**: Data scalability validation  
4. **Memory Profiling**: Memory leak detection
5. **Regression Analysis**: Historical comparison
6. **Report Generation**: Executive summaries

## Test Data Generation

The framework includes sophisticated test data generators:

### Employee Dataset
```python
{
    'id': 1,
    'employee_id': 'EMP000001',
    'first_name': 'FirstName1',
    'email': 'employee1@company.com',
    'department': 'Engineering',
    'salary': 75000,
    'skills': ['Python', 'SQL', 'Docker'],
    'metadata': {...}
}
```

### Sales Dataset
```python
{
    'id': 1,
    'transaction_id': 'TXN00000001',
    'customer_id': 1234,
    'product': 'Product A',
    'quantity': 5,
    'total_amount': 247.50,
    'region': 'North',
    'payment_method': 'Credit Card'
}
```

### IoT Sensor Dataset
```python
{
    'id': 1,
    'sensor_id': 'SENSOR0001',
    'sensor_type': 'temperature',
    'value': 23.5,
    'unit': 'celsius',
    'location': 'Building A Floor 1',
    'alerts': ['high_value']
}
```

## Performance Thresholds

Default performance criteria:

```python
PERFORMANCE_THRESHOLDS = {
    'max_avg_response_time_ms': 500,      # Average response time
    'min_success_rate_percent': 95,        # Minimum success rate
    'max_p95_response_time_ms': 1000,      # 95th percentile response time  
    'min_requests_per_second': 10,         # Minimum throughput
    'max_memory_increase_mb': 100,         # Maximum memory increase
}
```

## Performance Grading System

Tests are automatically graded based on performance:

- **A+**: Excellent performance (sub-100ms response, >1000 RPS)
- **A**: Good performance (sub-200ms response, >500 RPS) 
- **B**: Acceptable performance (sub-500ms response, >100 RPS)
- **C**: Poor performance (sub-1000ms response, >50 RPS)
- **D**: Very poor performance (>1000ms response)
- **F**: Failed tests or critical issues

## Benchmark Storage

Performance benchmarks are stored in SQLite with:
- Historical performance data
- Baseline comparisons  
- Regression detection
- Trend analysis
- Alert storage

```sql
CREATE TABLE performance_tests (
    id INTEGER PRIMARY KEY,
    test_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    avg_response_time_ms REAL,
    throughput_rps REAL,
    memory_peak_mb REAL,
    success_rate REAL,
    -- ... additional metrics
);
```

## Regression Detection

Automated regression detection using statistical analysis:

1. **Baseline Establishment**: Historical averages over 30 days
2. **Recent Performance**: Last 7 days performance data
3. **Statistical Comparison**: Percentage change analysis
4. **Severity Assessment**: Warning vs Critical thresholds
5. **Alert Generation**: Automated notification system

## Running Tests in Different Environments

### Local Development
```bash
# Set environment variables
export TEST_API_BASE_URL="http://localhost:8000"
export TEST_DATABASE_URL="postgresql://user:pass@localhost/test_db"

# Run performance tests
python -m pytest tests/ -m performance -v
```

### CI/CD Environment
```bash
# GitHub Actions automatically runs:
# - Performance baseline tests
# - Load testing with Locust  
# - Data volume testing
# - Memory profiling
# - Regression detection
```

### Production Monitoring
```bash
# Deploy performance monitoring
python tests/performance_dashboard.py --port 8080

# Schedule regular performance tests
crontab -e
# 0 2 * * * cd /app && python -m pytest tests/performance_framework.py
```

## Custom Test Development

### Creating New Performance Tests

```python
import pytest
from tests.performance_framework import APIPerformanceTester, BenchmarkResult

class TestCustomPerformance:
    def setup_method(self):
        self.tester = APIPerformanceTester()
    
    @pytest.mark.asyncio
    async def test_custom_endpoint_performance(self):
        result = await self.tester.test_endpoint_performance(
            endpoint="/api/v1/custom",
            method="POST", 
            data={"test": "data"},
            iterations=100
        )
        
        assert result.metrics['success_rate'] >= 95
        assert result.metrics['avg_response_time_ms'] <= 500
        assert result.performance_grade in ['A+', 'A', 'B']
```

### Custom Data Generators

```python
from tests.data_volume_tests import RealisticDataGenerator

class CustomDataGenerator(RealisticDataGenerator):
    @staticmethod
    def generate_custom_data(count: int) -> List[Dict]:
        return [
            {
                'id': i,
                'custom_field': f'value_{i}',
                'complex_data': {...}
            }
            for i in range(count)
        ]
```

## Troubleshooting

### Common Issues

1. **API Server Not Running**
   ```bash
   # Check if server is running
   curl http://localhost:8000/health
   
   # Start server if needed
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. **Database Connection Issues**
   ```bash
   # Check database connectivity
   python -c "from app.core.database import engine; print(engine.url)"
   
   # Initialize test database
   python init_db.py
   ```

3. **Memory Profiling Fails**
   ```bash
   # Install memory profiler
   pip install memory-profiler psutil
   
   # Check permissions (Linux/Mac)
   sudo python tests/memory_profiling_tests.py
   ```

4. **Load Tests Timeout**
   ```bash
   # Increase timeouts in locust configuration
   # Reduce concurrent users
   # Check server resource limits
   ```

### Performance Test Debugging

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Run tests with verbose output
python -m pytest tests/performance_framework.py -v -s --tb=long
```

## Best Practices

### Test Design
- Start with baseline measurements
- Use realistic test data
- Test incrementally (small → large datasets)
- Include error scenarios
- Monitor resource usage

### Performance Criteria
- Set realistic thresholds based on requirements
- Consider different user load patterns
- Account for system resource limits
- Plan for peak usage scenarios

### Continuous Monitoring
- Regular performance test execution
- Trend analysis over time
- Proactive regression detection
- Performance budget enforcement

### Reporting
- Share results with development teams
- Track performance over releases
- Correlate performance with code changes
- Maintain performance documentation

## Contributing

To contribute to the performance testing framework:

1. **Add New Tests**: Follow existing patterns and include proper assertions
2. **Extend Data Generators**: Add realistic datasets for your domain
3. **Improve Visualizations**: Enhance charts and dashboards
4. **Add Integrations**: Connect with monitoring tools
5. **Documentation**: Update README and inline documentation

## License

This performance testing framework is part of the Schlep-engine project and follows the same license terms.

---

**Note**: This framework provides honest, evidence-based performance validation. All performance claims should be backed by actual test results from this framework rather than theoretical estimates.