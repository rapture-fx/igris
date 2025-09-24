# Schlep-engine Hybrid Python + Rust Architecture Implementation Guide

**Based on Audit Results:** 67 Rust candidates identified, 5.45x Polars speedup potential, 100/100 Rust readiness score

## 🎯 **Architecture Vision**

```
┌─────────────────────────┐    ┌──────────────────────────┐    ┌─────────────────────────┐
│   FastAPI Layer         │    │   Data Processing Layer  │    │   Compute Kernels       │
│   (Python - Keep)       │────│   (Polars - Migrate)     │────│   (Rust - Selective)    │
│                         │    │                          │    │                         │
│ • API endpoints         │    │ • 5.45x immediate gains  │    │ • 10x+ targeted gains   │
│ • Business logic        │    │ • Easy migration         │    │ • CPU-heavy operations  │
│ • Auth & middleware     │    │ • Rust under the hood    │    │ • PyO3 integration      │
│ • Database connections  │    │ • Lazy evaluation        │    │ • Parallel processing   │
│ • Orchestration         │    │ • Memory efficient       │    │ • GIL-free computation  │
└─────────────────────────┘    └──────────────────────────┘    └─────────────────────────┘
```

## 📊 **Audit Results Analysis**

### **Critical Bottlenecks Identified:**

1. **CSV Operations (72.8% of CPU time)**
   - `pandas.read_csv`: 72.8% of processing time
   - Current: 173-257K rows/sec
   - **Polars gain**: 6.22x speedup (Large datasets)
   - **Rust potential**: Additional 2-3x (15-20x total)

2. **Data Processing Pipeline**
   - Current throughput: 130-152K rows/sec
   - Memory growth: 300MB+ on 1M rows
   - **Immediate Polars win**: 5.45x average speedup

3. **Aggregation Operations**
   - groupby operations: 14.4% CPU time
   - **Polars speedup**: 6.36x (Medium datasets)
   - **Rust opportunity**: Parallel aggregations

## 🚀 **Implementation Roadmap**

### **Phase 1: Foundation (Week 1-2) - Polars Migration**

#### **Immediate Actions:**
```bash
# Install Polars
pip install polars

# Test current bottlenecks
python -c "
import polars as pl
import pandas as pd
import time

# Test CSV reading
start = time.time()
df_pandas = pd.read_csv('large_dataset.csv')
pandas_time = time.time() - start

start = time.time()
df_polars = pl.read_csv('large_dataset.csv')
polars_time = time.time() - start

print(f'Pandas: {pandas_time:.3f}s, Polars: {polars_time:.3f}s')
print(f'Speedup: {pandas_time/polars_time:.2f}x')
"
```

#### **Priority Migration Targets:**

1. **CSV Reading Operations:**
```python
# BEFORE (apps/api/app/services/data_processor.py)
import pandas as pd
df = pd.read_csv(file_path)

# AFTER
import polars as pl
df = pl.read_csv(file_path)
# Expected gain: 6.22x speedup on large files
```

2. **Aggregation Operations:**
```python
# BEFORE
result = df.groupby('category').agg({'value': 'mean'})

# AFTER
result = df.group_by('category').agg(pl.col('value').mean())
# Expected gain: 6.36x speedup
```

3. **Data Cleaning:**
```python
# BEFORE
df['column'] = df['column'].fillna(df['column'].median())

# AFTER
df = df.with_columns(
    pl.col('column').fill_null(pl.col('column').median())
)
# Expected gain: 2.6x speedup + lower memory usage
```

### **Phase 2: Rust Compute Kernels (Week 3-6) - Selective Integration**

#### **PyO3 vs Microservice Decision Framework:**

| Use PyO3 When: | Use Microservice When: |
|----------------|------------------------|
| Function-level optimization | Pipeline-level processing |
| < 1MB data transfer | > 10MB data transfer |
| Synchronous operations | Async/background processing |
| Single-node deployment | Multi-node scaling needed |

#### **Target Rust Kernels (10x+ gains required):**

1. **Fast CSV Parser (PyO3 Module):**
```rust
// apps/api/rust_kernels/csv_parser/src/lib.rs
use pyo3::prelude::*;
use csv::ReaderBuilder;
use rayon::prelude::*;

#[pyfunction]
fn fast_csv_parse(file_path: String, chunk_size: usize) -> PyResult<Vec<Vec<String>>> {
    // Parallel CSV parsing implementation
    // Expected: 10-15x faster than pandas for large files
}
```

2. **Parallel Aggregations:**
```rust
#[pyfunction]
fn fast_groupby_agg(
    groups: Vec<String>,
    values: Vec<f64>,
    agg_func: String
) -> PyResult<HashMap<String, f64>> {
    // Parallel HashMap-based aggregation
    // Expected: 10-20x faster for complex groupbys
}
```

3. **String Processing Engine:**
```rust
#[pyfunction]
fn fast_string_ops(strings: Vec<String>, operation: String) -> PyResult<Vec<String>> {
    // SIMD-optimized string operations
    // Expected: 15-25x faster for text processing
}
```

### **Phase 3: Integration & Optimization (Week 7-8)**

#### **Hybrid Integration Pattern:**
```python
# apps/api/app/services/hybrid_processor.py
from typing import Optional
import polars as pl

# Try import Rust kernels (graceful degradation)
try:
    import schlep_rust_kernels as rust
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False

class HybridDataProcessor:
    def __init__(self):
        self.rust_enabled = RUST_AVAILABLE

    def process_csv(self, file_path: str, use_rust: bool = True) -> pl.DataFrame:
        if self.rust_enabled and use_rust and self._should_use_rust(file_path):
            # Use Rust for large files (10x+ gain)
            data = rust.fast_csv_parse(file_path)
            return pl.DataFrame(data)
        else:
            # Use Polars (5x gain over pandas)
            return pl.read_csv(file_path)

    def _should_use_rust(self, file_path: str) -> bool:
        # Use Rust for files > 10MB
        return os.path.getsize(file_path) > 10 * 1024 * 1024
```

## 🔧 **Technical Implementation Details**

### **1. Polars Migration Strategy**

#### **File-by-File Migration Plan:**
```bash
# Identify pandas usage
find apps/api -name "*.py" -exec grep -l "pandas\|pd\." {} \; > pandas_files.txt

# Priority order (based on audit):
# 1. CSV reading operations (72.8% CPU time)
# 2. Aggregation functions (14.4% CPU time)
# 3. Data cleaning operations
# 4. Merge/join operations
```

#### **Migration Template:**
```python
# apps/api/app/services/data_migration_template.py
"""
Template for migrating pandas to Polars
"""

class DataProcessorV2:
    def __init__(self, use_polars: bool = True):
        self.use_polars = use_polars

    def read_data(self, file_path: str):
        if self.use_polars:
            import polars as pl
            return pl.read_csv(file_path)
        else:
            import pandas as pd
            return pd.read_csv(file_path)

    def process_data(self, df):
        if self.use_polars:
            # Polars lazy evaluation
            return (df.lazy()
                     .filter(pl.col("status") == "active")
                     .group_by("category")
                     .agg([
                         pl.col("value").mean().alias("avg_value"),
                         pl.col("value").count().alias("count")
                     ])
                     .collect())
        else:
            # Original pandas code
            return (df[df["status"] == "active"]
                     .groupby("category")
                     .agg({"value": ["mean", "count"]}))
```

### **2. Rust Integration Setup**

#### **PyO3 Project Structure:**
```
apps/api/rust_kernels/
├── Cargo.toml
├── pyproject.toml
├── src/
│   ├── lib.rs          # Main PyO3 module
│   ├── csv_ops.rs      # CSV operations
│   ├── aggregations.rs # Parallel aggregations
│   └── string_ops.rs   # String processing
└── python_tests/
    └── test_kernels.py # Integration tests
```

#### **Cargo.toml Configuration:**
```toml
[package]
name = "schlep-rust-kernels"
version = "0.1.0"
edition = "2021"

[lib]
name = "schlep_rust_kernels"
crate-type = ["cdylib"]

[dependencies]
pyo3 = { version = "0.20", features = ["extension-module", "abi3"] }
numpy = "0.20"
rayon = "1.8"      # Parallel processing
csv = "1.3"        # Fast CSV parsing
serde = { version = "1.0", features = ["derive"] }
ahash = "0.8"      # Fast HashMap
memmap2 = "0.9"    # Memory-mapped files

[dependencies.polars]
version = "0.35"
features = ["lazy", "csv-file", "strings", "temporal"]
```

### **3. Benchmark Suite**

#### **Performance Comparison Framework:**
```python
# benchmark_hybrid_performance.py
import time
import pandas as pd
import polars as pl
from typing import Dict, List, Any

class HybridBenchmark:
    def __init__(self):
        self.results = {}

    def benchmark_csv_reading(self, file_paths: List[str]) -> Dict[str, Any]:
        results = {}

        for file_path in file_paths:
            file_size_mb = os.path.getsize(file_path) / 1024 / 1024

            # Pandas baseline
            start = time.time()
            df_pandas = pd.read_csv(file_path)
            pandas_time = time.time() - start

            # Polars comparison
            start = time.time()
            df_polars = pl.read_csv(file_path)
            polars_time = time.time() - start

            # Rust comparison (if available)
            rust_time = None
            if RUST_AVAILABLE:
                start = time.time()
                df_rust = rust.fast_csv_parse(file_path)
                rust_time = time.time() - start

            results[file_path] = {
                'file_size_mb': file_size_mb,
                'pandas_time': pandas_time,
                'polars_time': polars_time,
                'rust_time': rust_time,
                'polars_speedup': pandas_time / polars_time,
                'rust_speedup': pandas_time / rust_time if rust_time else None,
                'rows': len(df_pandas)
            }

        return results

    def benchmark_aggregations(self, df_size: int = 1000000):
        # Generate test data
        df_pandas = pd.DataFrame({
            'group': np.random.choice(['A', 'B', 'C', 'D'], df_size),
            'value': np.random.randn(df_size)
        })
        df_polars = pl.from_pandas(df_pandas)

        # Pandas baseline
        start = time.time()
        result_pandas = df_pandas.groupby('group').agg({'value': ['mean', 'std', 'count']})
        pandas_time = time.time() - start

        # Polars comparison
        start = time.time()
        result_polars = df_polars.group_by('group').agg([
            pl.col('value').mean().alias('mean'),
            pl.col('value').std().alias('std'),
            pl.col('value').count().alias('count')
        ])
        polars_time = time.time() - start

        # Rust comparison (if available)
        rust_time = None
        if RUST_AVAILABLE:
            start = time.time()
            result_rust = rust.fast_groupby_agg(
                df_pandas['group'].tolist(),
                df_pandas['value'].tolist()
            )
            rust_time = time.time() - start

        return {
            'rows': df_size,
            'pandas_time': pandas_time,
            'polars_time': polars_time,
            'rust_time': rust_time,
            'polars_speedup': pandas_time / polars_time,
            'rust_speedup': pandas_time / rust_time if rust_time else None
        }

    def run_complete_benchmark(self) -> Dict[str, Any]:
        """Run comprehensive benchmark suite"""
        print("🚀 Running Hybrid Architecture Benchmark...")

        # Test different dataset sizes
        test_files = self._create_test_datasets()

        results = {
            'csv_reading': self.benchmark_csv_reading(test_files),
            'aggregations': {},
            'memory_usage': {},
            'summary': {}
        }

        # Test aggregations at different scales
        for size in [10_000, 100_000, 1_000_000]:
            results['aggregations'][f'{size}_rows'] = self.benchmark_aggregations(size)

        # Calculate overall recommendations
        results['summary'] = self._generate_recommendations(results)

        return results
```

### **4. CI/CD Pipeline for Hybrid Deployment**

#### **GitHub Actions Workflow:**
```yaml
# .github/workflows/hybrid-build.yml
name: Hybrid Python + Rust Build

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install Python dependencies
        run: |
          pip install -r requirements.txt
          pip install polars
      - name: Run Python tests
        run: pytest apps/api/tests/

  build-rust-kernels:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          profile: minimal
          override: true
      - name: Install maturin
        run: pip install maturin
      - name: Build Rust kernels
        run: |
          cd apps/api/rust_kernels
          maturin build --release
      - name: Test Rust integration
        run: |
          pip install target/wheels/*.whl
          python -c "import schlep_rust_kernels; print('Rust kernels loaded successfully')"

  integration-test:
    needs: [test-python, build-rust-kernels]
    runs-on: ubuntu-latest
    steps:
      - name: Run hybrid benchmark
        run: python benchmark_hybrid_performance.py
      - name: Performance regression test
        run: |
          # Ensure Polars provides >= 3x speedup
          # Ensure Rust provides >= 10x speedup where enabled
          python scripts/performance_regression_test.py

  deploy:
    needs: integration-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Build Docker image with Rust
        run: |
          docker build -f Dockerfile.hybrid -t schlep-engine:hybrid .
      - name: Deploy to production
        run: |
          # Deploy with both Python and Rust components
          ./scripts/deploy-hybrid.sh
```

#### **Hybrid Dockerfile:**
```dockerfile
# Dockerfile.hybrid
FROM rust:1.70 as rust-builder

WORKDIR /app/rust_kernels
COPY apps/api/rust_kernels/ .
RUN cargo build --release

FROM python:3.11-slim as python-base

# Install system dependencies for compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (needed for maturin)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install polars maturin

# Copy Rust kernels and build
COPY apps/api/rust_kernels/ ./rust_kernels/
RUN cd rust_kernels && maturin build --release
RUN pip install rust_kernels/target/wheels/*.whl

# Copy Python application
COPY apps/api/ ./apps/api/
COPY . .

# Set up environment
ENV PYTHONPATH=/app/apps/api
ENV RUST_KERNELS_AVAILABLE=true

# Health check that includes Rust kernel verification
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import schlep_rust_kernels; print('Health check passed')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "apps.api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📈 **Expected Performance Gains**

### **Phase 1: Polars Migration (Immediate)**
- **CSV Reading**: 6.22x speedup (Large files)
- **Aggregations**: 6.36x speedup (Medium datasets)
- **Memory Usage**: 30-50% reduction
- **Implementation Time**: 2-4 weeks

### **Phase 2: Selective Rust Kernels**
- **Additional CSV Gains**: 2-3x on top of Polars (Total: 15-20x)
- **Parallel Aggregations**: 10-20x for complex operations
- **String Processing**: 15-25x for text-heavy workloads
- **Implementation Time**: 4-6 weeks

### **Combined System Performance**
- **End-to-end Pipeline**: 10-30x improvement
- **Memory Efficiency**: 50-70% reduction
- **Scalability**: Handle 10x larger datasets
- **Latency**: Sub-second processing for most operations

## 🎯 **Success Metrics & Monitoring**

### **Key Performance Indicators:**
```python
# apps/api/app/monitoring/hybrid_metrics.py
class HybridPerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'polars_adoption_rate': 0.0,    # % of operations using Polars
            'rust_utilization_rate': 0.0,   # % of operations using Rust
            'average_speedup_factor': 1.0,  # Overall performance improvement
            'memory_efficiency_gain': 0.0,  # Memory usage reduction
            'error_rate': 0.0               # Hybrid system stability
        }

    def track_operation(self, operation_type: str, engine: str,
                       execution_time: float, memory_usage: float):
        # Track performance by engine type
        pass

    def generate_performance_report(self) -> Dict[str, Any]:
        return {
            'timestamp': datetime.now().isoformat(),
            'polars_vs_pandas_speedup': self._calculate_average_speedup('polars'),
            'rust_vs_python_speedup': self._calculate_average_speedup('rust'),
            'memory_savings': self._calculate_memory_efficiency(),
            'recommendations': self._generate_optimization_recommendations()
        }
```

## 🚀 **Next Steps - Implementation Priority**

### **This Week (Immediate Action):**
1. **Install Polars**: `pip install polars`
2. **Run benchmark**: Test current bottlenecks with Polars
3. **Identify migration targets**: Use audit results to prioritize files

### **Week 1-2: Polars Foundation**
1. Migrate CSV reading operations (72.8% CPU time impact)
2. Convert aggregation functions (14.4% CPU time impact)
3. Update data cleaning operations
4. Add performance monitoring

### **Week 3-4: Rust Setup**
1. Set up PyO3 development environment
2. Create first Rust kernel (CSV parser)
3. Implement benchmark suite
4. Test hybrid integration

### **Week 5-6: Production Integration**
1. Update CI/CD pipeline
2. Add feature flags for gradual rollout
3. Implement monitoring and alerting
4. Performance regression testing

This hybrid architecture will give you the best of all worlds: Python's ecosystem and development speed, Polars' immediate performance gains, and Rust's maximum performance for compute-heavy operations.

Ready to start with the Polars migration? I can help you identify the exact files and functions to migrate first based on the audit results.