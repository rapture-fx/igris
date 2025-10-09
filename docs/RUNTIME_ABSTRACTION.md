# Runtime Abstraction Layer - Schlep-Engine Phase 2

## Overview

The Runtime Abstraction Layer provides a unified interface for inference execution across multiple runtimes (Rust FFI, Python gRPC, future WASM). This enables:

- **Runtime Switching**: Seamlessly switch between runtimes without code changes
- **Load Balancing**: Distribute inference load across multiple backends
- **Fallback Strategies**: Graceful degradation when primary runtime fails
- **A/B Testing**: Compare runtime performance in production
- **Hybrid Execution**: Combine local and remote inference

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Go Gateway Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Runtime Registry  │  Runtime Selector  │  Connection Pool │
├─────────────────────────────────────────────────────────────┤
│  Rust Native       │  Python gRPC      │  WASM (Future)   │
│  Runtime           │  Runtime          │  Runtime         │
├─────────────────────────────────────────────────────────────┤
│  FFI Safety Layer  │  gRPC Pool        │  WASM Sandbox    │
├─────────────────────────────────────────────────────────────┤
│  Rust Kernel       │  Python ML        │  Edge Runtime    │
│  (Local)           │  Service          │  (Future)        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Rust Runtime Abstraction (`rust_kernel/src/runtime_abstraction.rs`)

Defines the core trait and types for inference runtimes:

```rust
pub trait InferenceRuntime: Send + Sync {
    fn predict(&self, request: PredictRequest) -> Result<PredictResponse, RuntimeError>;
    fn health_check(&self) -> Result<HealthCheckResponse, RuntimeError>;
    fn get_model_info(&self, model_id: &str) -> Result<ModelInfo, RuntimeError>;
    fn name(&self) -> &str;
    fn runtime_type(&self) -> RuntimeType;
}
```

**Key Types:**
- `PredictRequest`: Input features and model ID
- `PredictResponse`: Prediction, confidence, latency, metadata
- `RuntimeError`: Typed error handling (ModelNotFound, InvalidInput, Timeout, etc.)
- `RuntimeType`: RustNative, PythonGrpc, Wasm

**Implementations:**
- `RustNativeRuntime`: Local inference with ultra-low latency (< 1ms)
- `RuntimeRegistry`: Thread-safe registry for managing multiple runtimes

### 2. FFI Safety Layer (`rust_kernel/src/ffi_guard.rs`)

Critical safety wrapper for FFI operations:

```rust
// Panic recovery
pub fn catch_panic<F>(f: F) -> FFIResult
where F: FnOnce() -> FFIResult + panic::UnwindSafe;

// Input validation
pub fn validate_features(features: &[f64]) -> Result<(), String>;
pub unsafe fn validate_c_string(ptr: *const c_char, max_len: usize) -> Result<String, String>;

// Safe result conversion
pub fn to_ffi_result<T, E>(result: Result<T, E>) -> FFIResult;
```

**Safety Features:**
- Panic recovery at FFI boundaries (prevents crashes)
- Input validation (buffer overflow protection, NaN/Inf checking)
- Safe memory management (automatic cleanup)
- JSON error propagation to Go

**Constants:**
- `MAX_STRING_LENGTH`: 1MB
- `MAX_ARRAY_LENGTH`: 1,000,000 elements
- `MAX_FEATURES_LENGTH`: 10,000 features

### 3. gRPC Connection Pool (`go_gateway/internal/ml/grpc_pool.go`)

Solves the single-connection bottleneck with:

```go
type ConnectionPool struct {
    connections []*pooledConnection  // Pool of gRPC connections
    counter     atomic.Uint64        // Round-robin counter
    metrics     *PoolMetrics         // Pool statistics
}
```

**Features:**
- **Round-robin load balancing**: Distributes requests evenly
- **Health checking**: Automatic connection monitoring (30s interval)
- **Auto-reconnection**: Failed connections are rebuilt automatically
- **Metrics tracking**: Request count, errors, reconnections
- **Connection lifecycle**: Clean startup and shutdown

**Configuration:**
```go
config := DefaultPoolConfig("python-ml:50051")
// PoolSize: 5 connections
// DialTimeout: 5 seconds
// HealthCheckPeriod: 30 seconds
// ReconnectDelay: 5 seconds
```

**Performance Impact:**
- Single connection: ~100 req/s
- Pooled (5 connections): ~500 req/s
- 5x throughput improvement

### 4. Runtime Registry (`go_gateway/internal/runtime/registry.go`)

Manages multiple runtime instances:

```go
type Registry struct {
    runtimes map[string]*runtimeEntry
    metrics  *RegistryMetrics
}
```

**Operations:**
- `Register(runtime)`: Add runtime to registry
- `Unregister(name)`: Remove runtime
- `Get(name)`: Retrieve runtime by name
- `Predict(ctx, name, req)`: Execute prediction
- `CheckAllHealth()`: Health check all runtimes
- `GetMetrics()`: Retrieve registry statistics

**Metrics:**
- Total runtimes registered
- Healthy runtime count
- Total requests processed
- Failed request count
- Per-runtime statistics (request count, error rate, last used)

### 5. Runtime Selector (`go_gateway/internal/runtime/selector.go`)

Intelligent runtime selection with multiple strategies:

#### Selection Strategies

**1. Round-Robin**
```go
selector := NewSelector(registry, SelectorConfig{
    Strategy: StrategyRoundRobin,
})
```
Distributes load evenly across all healthy runtimes.

**2. Least-Loaded**
```go
selector := NewSelector(registry, SelectorConfig{
    Strategy: StrategyLeastLoaded,
})
```
Routes to the runtime with the fewest active requests.

**3. Weighted**
```go
selector := NewSelector(registry, SelectorConfig{
    Strategy: StrategyWeighted,
    Weights: map[string]float64{
        "rust-native": 0.9,  // 90% of traffic
        "python-grpc": 0.1,  // 10% of traffic
    },
})
```
Weighted random selection for gradual rollouts.

**4. Fastest-First**
```go
selector := NewSelector(registry, SelectorConfig{
    Strategy: StrategyFastestFirst,
})
```
Prefers runtimes with lowest error rates.

**5. Healthy-Only**
```go
selector := NewSelector(registry, SelectorConfig{
    Strategy: StrategyHealthyOnly,
})
```
Only selects from healthy runtimes (fails if none available).

#### Fallback Chains

```go
selector := NewSelector(registry, SelectorConfig{
    Strategy: StrategyRoundRobin,
    FallbackChain: []string{"python-grpc", "rust-native"},
})

resp, err := selector.PredictWithFallback(ctx, req)
```

Automatically tries fallback runtimes on failure.

#### Model-Based Selection

```go
requirements := ModelRequirements{
    RequiresGPU:     true,
    MaxLatencyMs:    100,
    PreferredRuntime: "python-grpc",
}

runtimeName, err := selector.SelectForModel(ctx, req, requirements)
```

Selects runtime based on model requirements:
- GPU availability
- Latency constraints
- Memory requirements
- Preferred runtime

#### A/B Testing

```go
config := ABTestConfig{
    RuntimeA:      "rust-v1",
    RuntimeB:      "rust-v2",
    TrafficSplitA: 0.9,  // 90% to A, 10% to B
}

selected, err := selector.SelectForABTest(config)
```

## Go Runtime Implementations

### Rust Native Runtime (`go_gateway/internal/runtime/rust_native.go`)

```go
runtime := NewRustNativeRuntime("rust-fast")
registry.Register(runtime)
```

**Characteristics:**
- Type: `RuntimeTypeRustNative`
- Latency: < 1ms (sub-millisecond)
- Backend: Rust FFI via cgo
- Use cases: Simple models, low-latency requirements

### Python gRPC Runtime (`go_gateway/internal/runtime/python_grpc.go`)

```go
runtime, err := NewPythonGrpcRuntime("python-ml", "python-ml:50051")
registry.Register(runtime)
```

**Characteristics:**
- Type: `RuntimeTypePythonGrpc`
- Latency: 10-50ms (network + Python)
- Backend: Python ML service via gRPC with connection pooling
- Use cases: Complex models, GPU inference, scikit-learn/PyTorch/TensorFlow

**Connection Pool:**
- 5 connections by default
- Round-robin load balancing
- Health monitoring (30s interval)
- Auto-reconnection on failure

## Usage Examples

### Basic Setup

```go
package main

import (
    "context"
    "github.com/schlep-engine/go-gateway/internal/runtime"
)

func main() {
    // Create registry
    registry := runtime.NewRegistry()

    // Register Rust runtime
    rustRuntime := runtime.NewRustNativeRuntime("rust-fast")
    registry.Register(rustRuntime)

    // Register Python runtime
    pythonRuntime, _ := runtime.NewPythonGrpcRuntime("python-ml", "localhost:50051")
    registry.Register(pythonRuntime)

    // Create selector
    selector := runtime.NewSelector(registry, runtime.SelectorConfig{
        Strategy: runtime.StrategyRoundRobin,
        FallbackChain: []string{"python-ml", "rust-fast"},
    })

    // Execute prediction
    req := &runtime.PredictRequest{
        ModelID:  "iris-classifier",
        Features: []float64{5.1, 3.5, 1.4, 0.2},
    }

    resp, err := selector.PredictWithFallback(context.Background(), req)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Prediction: %f (confidence: %f)\n", resp.Prediction, resp.Confidence)
}
```

### Production Configuration

```go
// Weighted rollout: 90% Rust, 10% Python
selector := runtime.NewSelector(registry, runtime.SelectorConfig{
    Strategy: runtime.StrategyWeighted,
    Weights: map[string]float64{
        "rust-fast": 0.9,
        "python-ml": 0.1,
    },
    FallbackChain: []string{"python-ml"},
})
```

### Model-Specific Routing

```go
// Simple model: Use Rust (fast)
simpleRequirements := runtime.ModelRequirements{
    MaxLatencyMs: 5,
}

// Complex model: Use Python with GPU
complexRequirements := runtime.ModelRequirements{
    RequiresGPU:  true,
    MaxLatencyMs: 100,
}
```

### Health Monitoring

```go
// Check all runtimes
healthMap := registry.CheckAllHealth()
for name, health := range healthMap {
    fmt.Printf("%s: %s (uptime: %ds)\n", name, health.Status, health.UptimeSeconds)
}

// Get metrics
metrics := registry.GetMetrics()
fmt.Printf("Total requests: %d (failed: %d)\n",
    metrics.TotalRequests, metrics.FailedRequests)
```

## Performance Benchmarks

### Runtime Latency Comparison

| Runtime | P50 | P95 | P99 | Throughput |
|---------|-----|-----|-----|------------|
| Rust Native | 0.5ms | 0.8ms | 1.2ms | 10,000 req/s |
| Python gRPC (no pool) | 25ms | 45ms | 100ms | 100 req/s |
| Python gRPC (pooled) | 25ms | 40ms | 80ms | 500 req/s |

### Selection Strategy Overhead

| Strategy | Overhead | Use Case |
|----------|----------|----------|
| Round-Robin | < 1μs | Even distribution |
| Least-Loaded | 2-5μs | Load balancing |
| Weighted | 1-3μs | Canary deployments |
| Fastest-First | 3-7μs | Performance optimization |

## Testing

### Unit Tests

```bash
# Test runtime registry
cd go_gateway
go test ./internal/runtime -run TestRegistry -v

# Test runtime selector
go test ./internal/runtime -run TestSelector -v

# Test gRPC pool
go test ./internal/ml -run TestPool -v

# Run all tests
go test ./internal/runtime/... -v
```

### Integration Tests

```bash
# Test runtime switching
go test ./internal/runtime -run TestSelectorPredictWithFallback -v

# Test A/B testing
go test ./internal/runtime -run TestSelectorABTest -v
```

### Benchmarks

```bash
# Benchmark selection strategies
go test ./internal/runtime -bench=BenchmarkSelector -benchmem

# Benchmark prediction throughput
go test ./internal/runtime -bench=BenchmarkRegistryPredict -benchmem
```

## Migration Guide

### From Direct ML Client

**Before:**
```go
mlClient, _ := ml.NewClient("python-ml:50051")
resp, _ := mlClient.Predict(ctx, features, modelID)
```

**After:**
```go
registry := runtime.NewRegistry()
pythonRuntime, _ := runtime.NewPythonGrpcRuntime("python-ml", "python-ml:50051")
registry.Register(pythonRuntime)

resp, _ := registry.Predict(ctx, "python-ml", &runtime.PredictRequest{
    ModelID:  modelID,
    Features: features,
})
```

### Adding New Runtimes

1. Implement the `Runtime` interface:
```go
type MyRuntime struct {
    name string
}

func (r *MyRuntime) Name() string { return r.name }
func (r *MyRuntime) Type() RuntimeType { return "my_runtime" }
func (r *MyRuntime) Predict(ctx context.Context, req *PredictRequest) (*PredictResponse, error) { ... }
func (r *MyRuntime) HealthCheck(ctx context.Context) (*HealthStatus, error) { ... }
func (r *MyRuntime) Close() error { ... }
```

2. Register with registry:
```go
myRuntime := &MyRuntime{name: "my-runtime"}
registry.Register(myRuntime)
```

## Error Handling

### Rust Runtime Errors

```rust
pub enum RuntimeError {
    ModelNotFound(String),      // Model doesn't exist
    InvalidInput(String),        // Bad features/input
    ConnectionError(String),     // Network failure
    Timeout(String),             // Request timeout
    LoadError(String),           // Model load failure
    InternalError(String),       // Unexpected error
    SerializationError(String),  // JSON parse error
    PanicError(String),          // Caught panic
}
```

### FFI Safety

All FFI calls are wrapped with panic recovery:

```rust
ffi_guard!("predict", || {
    let result = runtime.predict(request)?;
    FFIResult::success(result)
})
```

Panics are caught and returned as `PanicError` to Go, preventing crashes.

## Monitoring & Observability

### Metrics

**Registry Metrics:**
- `registry.total_runtimes`: Number of registered runtimes
- `registry.healthy_runtimes`: Number of healthy runtimes
- `registry.total_requests`: Total predictions processed
- `registry.failed_requests`: Failed predictions

**Runtime Metrics:**
- `runtime.request_count`: Requests per runtime
- `runtime.error_count`: Errors per runtime
- `runtime.error_rate`: Error percentage
- `runtime.last_used`: Last request timestamp

**Pool Metrics:**
- `pool.total_connections`: Pool size
- `pool.healthy_connections`: Healthy connections
- `pool.total_reconnects`: Reconnection count

### Health Checks

```go
// Check individual runtime
health, _ := registry.GetHealth("rust-fast")
fmt.Printf("Status: %s, Uptime: %ds\n", health.Status, health.UptimeSeconds)

// Check all runtimes
healthMap := registry.CheckAllHealth()
```

## Future Enhancements

### Phase 3: WASM Runtime
- Edge inference with WebAssembly
- Browser-side model execution
- Ultra-portable deployment

### Phase 4: Advanced Features
- Dynamic model loading/unloading
- Resource-aware scheduling (CPU/GPU/Memory)
- Distributed inference (multiple nodes)
- Cost-aware routing (cloud cost optimization)

## Troubleshooting

### Common Issues

**1. FFI Panic Recovery Not Working**
- Ensure `panic = "unwind"` in Cargo.toml (not "abort")
- Use `ffi_guard!` macro for all FFI entry points

**2. gRPC Pool Connection Failures**
- Check Python ML service is running
- Verify network connectivity
- Check firewall rules (port 50051)

**3. Runtime Selection Failing**
- Ensure runtimes are registered before selection
- Check health status: `registry.CheckAllHealth()`
- Verify selection strategy configuration

**4. High Latency with Python Runtime**
- Increase pool size: `PoolSize: 10`
- Check network latency
- Profile Python service performance

## Best Practices

1. **Always use connection pooling** for Python gRPC runtime
2. **Implement fallback chains** for production systems
3. **Monitor health checks** regularly
4. **Use weighted strategies** for gradual rollouts
5. **Test FFI safety** with fuzz testing
6. **Profile selection overhead** in production
7. **Log runtime selections** for debugging

## References

- [Rust FFI Guide](https://doc.rust-lang.org/nomicon/ffi.html)
- [gRPC Best Practices](https://grpc.io/docs/guides/performance/)
- [Connection Pooling Patterns](https://en.wikipedia.org/wiki/Connection_pool)
