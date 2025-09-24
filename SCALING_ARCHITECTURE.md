# Horizontal Scaling Architecture for Schlep Engine

## Current Architecture Analysis

The hybrid Python + Rust architecture has several characteristics that impact horizontal scaling:

### ✅ **Scaling Advantages**

1. **Stateless Compute Kernels**
   - Rust kernels are pure functions with no shared state
   - PyO3 integration creates isolated execution contexts
   - Each request can be processed independently

2. **Thread-Safe Design**
   - Rayon thread pool handles parallel processing safely
   - No global mutable state in Rust kernels
   - Python GIL limitations bypassed for compute-heavy operations

3. **Memory Efficient**
   - Rust kernels use minimal memory overhead
   - Automatic cleanup prevents memory leaks
   - Streaming processing for large datasets

### ⚠️ **Scaling Challenges**

1. **PyO3 Serialization Overhead**
   - Data crossing Python-Rust boundary requires serialization
   - Large datasets may have significant marshalling costs
   - No direct shared memory between processes

2. **Process-Level Isolation**
   - Each Python process loads its own Rust kernels
   - No kernel sharing across processes
   - Cold start costs for new processes

3. **Coordination Complexity**
   - No built-in distributed coordination
   - Results aggregation must be handled externally
   - No automatic work distribution

## Horizontal Scaling Strategies

### Strategy 1: Process-Level Scaling (Recommended for <100 nodes)

**Architecture:**
```
Load Balancer → FastAPI Instances (with Rust kernels) → Shared Storage
                ↓
              Local Rust Processing
```

**Implementation:**
- Deploy multiple FastAPI instances with embedded Rust kernels
- Use external load balancer for request distribution
- Store intermediate results in Redis/database for coordination

**Pros:**
- Simple deployment model
- Low latency (no network calls to kernels)
- Easy debugging and monitoring

**Cons:**
- Memory duplication of kernels across processes
- Limited by single-machine capabilities
- No work stealing between processes

**Code Example:**
```python
# In FastAPI deployment
import schlep_engine
from fastapi import FastAPI
import asyncio

app = FastAPI()

@app.post("/process-data")
async def process_data(data: DataRequest):
    # Each instance processes independently
    result = schlep_engine.read_csv_fast(data.file_path)
    aggregated = schlep_engine.aggregate_data(result, data.group_by, data.value_col, "mean")

    # Store result in shared cache for coordination
    await store_partial_result(data.job_id, aggregated)
    return {"status": "processed", "job_id": data.job_id}
```

### Strategy 2: Microservice Architecture (Recommended for 100+ nodes)

**Architecture:**
```
API Gateway → Task Queue → Rust Microservices → Results Aggregator
                ↓              ↓
           Work Distribution   Pure Rust Processing
```

**Implementation:**
- Separate Rust kernels into standalone services
- Use message queue for work distribution
- Python orchestration layer for coordination

**Pros:**
- True horizontal scaling
- Language optimization (Rust services can be optimized independently)
- Better resource utilization
- Fault isolation

**Cons:**
- Network overhead for kernel calls
- Complex deployment and monitoring
- Distributed debugging challenges

**Service Design:**
```rust
// Rust microservice
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/csv/read", post(read_csv_handler))
        .route("/aggregate", post(aggregate_handler))
        .route("/strings/process", post(string_handler));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await
}
```

### Strategy 3: Hybrid Approach (Recommended for Production)

**Architecture:**
```
Load Balancer → FastAPI Orchestrators → Rust Kernel Pool
                ↓                       ↓
           Python Business Logic    Distributed Compute
```

**Implementation:**
- Python services handle API, validation, coordination
- Pool of Rust services handle compute-intensive operations
- Intelligent routing based on operation type and load

**Decision Matrix:**
```python
def choose_processing_strategy(operation_type: str, data_size: int, load: float):
    if operation_type == "csv_read" and data_size > 1_000_000:
        return "distributed_rust_service"
    elif load > 0.8:  # High system load
        return "distributed_rust_service"
    else:
        return "local_rust_kernel"
```

## Migration Path for Distributed Deployment

### Phase 1: Local Scaling (Current → 10 nodes)
- Deploy current architecture with multiple FastAPI instances
- Add Redis for session/result coordination
- Implement health checks and monitoring

### Phase 2: Service Decomposition (10 → 100 nodes)
- Extract Rust kernels into separate services
- Implement async communication between Python and Rust services
- Add circuit breakers and retry logic

### Phase 3: Full Distribution (100+ nodes)
- Implement work-stealing algorithms
- Add auto-scaling based on queue depth
- Implement distributed caching and result aggregation

## Infrastructure Requirements

### Container Strategy
```dockerfile
# Multi-stage build for Rust kernels
FROM rust:1.70 as rust-builder
COPY apps/api/rust_compute_kernels /app
WORKDIR /app
RUN cargo build --release

FROM python:3.11-slim
COPY --from=rust-builder /app/target/release/libschlep_compute_kernels.so /usr/local/lib/
COPY apps/api /app
WORKDIR /app
RUN pip install -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: schlep-engine-api
spec:
  replicas: 10
  selector:
    matchLabels:
      app: schlep-engine
  template:
    metadata:
      labels:
        app: schlep-engine
    spec:
      containers:
      - name: api
        image: schlep-engine:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        env:
        - name: RUST_LOG
          value: "info"
        - name: SCHLEP_PERFORMANCE_MODE
          value: "rust_preferred"
```

### Auto-Scaling Configuration
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: schlep-engine-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: schlep-engine-api
  minReplicas: 5
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Performance Characteristics at Scale

### Expected Throughput
- **Single Node**: 10,000 operations/sec (mixed workload)
- **10 Nodes**: 80,000 operations/sec (80% efficiency due to coordination)
- **100 Nodes**: 600,000 operations/sec (60% efficiency due to network overhead)

### Memory Requirements
- **Base Process**: 50MB (Python + Rust kernels)
- **Per Operation**: 10-50MB depending on data size
- **Coordination Overhead**: 5-10MB per node

### Network Requirements
- **Process Strategy**: Minimal (only result coordination)
- **Microservice Strategy**: High (all data transfers over network)
- **Hybrid Strategy**: Medium (selective network usage)

## Monitoring and Observability

### Metrics to Track
```python
# Key scaling metrics
SCALING_METRICS = {
    "request_rate": "requests per second across all nodes",
    "queue_depth": "pending operations in work queue",
    "node_utilization": "CPU/memory usage per node",
    "cross_node_latency": "network latency between services",
    "coordination_overhead": "time spent on result aggregation",
    "error_rate": "failures due to scaling issues"
}
```

### Health Check Strategy
```python
@app.get("/health")
async def health_check():
    rust_kernel_status = test_rust_kernels()
    memory_usage = get_memory_usage()

    if memory_usage > 0.9:  # >90% memory usage
        return {"status": "degraded", "reason": "high_memory"}
    elif not rust_kernel_status:
        return {"status": "unhealthy", "reason": "rust_kernels_failed"}
    else:
        return {"status": "healthy"}
```

## Security Considerations for Distributed Deployment

### Network Security
- **Internal Communication**: Use mTLS between services
- **API Gateway**: Rate limiting and authentication
- **Data Privacy**: Encrypt data in transit and at rest

### Resource Isolation
- **Container Limits**: Prevent resource exhaustion
- **Network Policies**: Isolate traffic between services
- **Secret Management**: Secure credential distribution

### Audit and Compliance
- **Request Tracing**: Distributed tracing across all services
- **Data Lineage**: Track data processing across nodes
- **Compliance Logging**: Ensure GDPR/SOC2 compliance in distributed setup

## Trade-offs Summary

| Approach | Latency | Throughput | Complexity | Cost | Recommended Use |
|----------|---------|------------|------------|------|-----------------|
| Process Scaling | Low | Medium | Low | Low | < 100 concurrent users |
| Microservices | Medium | High | High | Medium | 100-10k concurrent users |
| Hybrid | Low-Medium | High | Medium | Medium | Production systems |

## Implementation Recommendation

For production deployment of Schlep Engine:

1. **Start with Process Scaling** for initial deployment
2. **Implement monitoring** to understand actual scaling needs
3. **Migrate to Hybrid** when hitting single-machine limits
4. **Consider Microservices** only for very high scale (>1M requests/day)

The hybrid approach provides the best balance of performance, complexity, and maintainability for most production use cases.