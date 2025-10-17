# Developer Experience Guide

Complete guide for developers using Schlep-Engine (Phases 1-6).

## Table of Contents

- [Quick Start](#quick-start)
- [CLI Tool](#cli-tool)
- [Python SDK](#python-sdk)
- [Go SDK](#go-sdk)
- [API Reference](#api-reference)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)

## Quick Start

### Installation

**CLI:**
```bash
pip install schlep-engine-cli
```

**Python SDK:**
```bash
pip install schlep-engine
```

**Go SDK:**
```bash
go get github.com/schlep-engine/go-sdk
```

### Authentication

**CLI:**
```bash
schlep auth login --api-key sk-your-api-key
```

**Python:**
```python
from schlep_engine import SchlepEngineClient

client = SchlepEngineClient(api_key="sk-your-api-key")
```

**Go:**
```go
import "github.com/schlep-engine/go-sdk/pkg/client"

cfg := &config.Config{APIKey: "sk-your-api-key"}
client, _ := client.NewClient(cfg)
```

## CLI Tool

The Schlep-Engine CLI provides access to all platform features.

### Phase 1-5 Commands

#### Data Processing (Phase 1)
```bash
# Process files
schlep process file data.csv --output processed.parquet

# Batch processing
schlep process batch "data/*.csv" --parallel 8
```

#### Model Registry (Phase 2)
```bash
# Upload model
schlep ml registry-upload model.pt --name fraud-detector --version 2.0.0

# List models
schlep ml registry-list --filter pytorch

# Hot reload
schlep ml hot-reload model-123 --version 2.0.0
```

#### Cache Management (Phase 3)
```bash
# View stats
schlep cache stats --layer all

# Warm cache
schlep cache warm --model-id model-123 --layer both

# Invalidate
schlep cache invalidate --model-id model-123 --confirm
```

#### Observability (Phase 4)
```bash
# Prometheus metrics
schlep monitoring prometheus-metrics

# Distributed traces
schlep monitoring traces --service ml-service

# Alerts
schlep monitoring alerts --severity critical

# Dashboards
schlep monitoring dashboard --dashboard inference
```

#### Infrastructure (Phase 5)
```bash
# Health checks
schlep monitoring status --detailed

# Deploy
helm upgrade --install schlep-engine helm/schlep-engine/
```

## Python SDK

The Python SDK provides async/sync clients for all APIs.

### Basic Usage

```python
import asyncio
from schlep_engine import SchlepEngineClient

async def main():
    client = SchlepEngineClient(api_key="sk-your-key")

    # Phase 1: Process data
    result = await client.data.process_file("data.csv")

    # Phase 2: Upload model
    with open("model.pt", "rb") as f:
        model = await client.model_registry.upload_model(
            f, "fraud-detector", "1.0.0", "pytorch"
        )

    # Phase 3: Cache operations
    stats = await client.cache.get_stats()
    await client.cache.warm_cache(model['model_id'])

    # Phase 4: Observability
    metrics = await client.observability.get_metrics()
    traces = await client.observability.get_traces()

    await client.close()

asyncio.run(main())
```

### Synchronous Usage

```python
from schlep_engine import SchlepEngineClientSync

client = SchlepEngineClientSync(api_key="sk-your-key")

# Same API, but synchronous
result = client.data.process_file("data.csv")
models = client.model_registry.list_models()
```

### Context Manager

```python
async with SchlepEngineClient(api_key="sk-your-key") as client:
    result = await client.data.process_file("data.csv")
    # Automatic cleanup on exit
```

## Go SDK

The Go SDK is designed for cloud-native applications.

### Basic Usage

```go
package main

import (
    "context"
    "github.com/schlep-engine/go-sdk/pkg/client"
    "github.com/schlep-engine/go-sdk/pkg/config"
)

func main() {
    cfg := &config.Config{
        APIKey:        "sk-your-key",
        EnableMetrics: true,
        EnableTracing: true,
    }

    schlepClient, _ := client.NewClient(cfg)
    defer schlepClient.Close()

    ctx := context.Background()

    // Phase 1: Process data
    result, _ := schlepClient.Data.ProcessFile(ctx, "data.csv")

    // Phase 2: Model registry
    models, _ := schlepClient.ModelRegistry.ListModels(ctx)

    // Phase 3: Cache
    stats, _ := schlepClient.Cache.GetStats(ctx, "all")

    // Phase 4: Observability
    metrics, _ := schlepClient.Observability.GetMetrics(ctx)
}
```

### Observability Integration

```go
// Built-in Prometheus metrics
cfg := &config.Config{
    EnableMetrics:   true,
    MetricsPort:     9090,
    ServiceName:     "my-service",
    ServiceVersion:  "1.0.0",
}

// Built-in OpenTelemetry tracing
cfg.EnableTracing = true
cfg.JaegerEndpoint = "http://jaeger:14268/api/traces"
```

## API Reference

### Phase 1: Data Processing

**Endpoints:**
- `POST /api/data/process` - Process single file
- `POST /api/data/batch` - Batch processing
- `GET /api/data/jobs/{id}` - Get job status

**Python:**
```python
await client.data.process_file(
    file_path="data.csv",
    transformations=[
        {"type": "filter", "condition": "amount > 100"},
        {"type": "deduplicate", "columns": ["id"]}
    ]
)
```

**Go:**
```go
result, err := schlepClient.Data.ProcessFile(ctx, &models.ProcessFileRequest{
    FilePath: "data.csv",
    Format:   models.DataFormatCSV,
})
```

### Phase 2: Model Registry

**Endpoints:**
- `POST /api/ml/registry/upload` - Upload model
- `GET /api/ml/registry` - List models
- `POST /api/ml/models/{id}/hot-reload` - Hot reload
- `GET /api/ml/registry/{id}/versions` - List versions

**Python:**
```python
# Upload
with open("model.pt", "rb") as f:
    result = await client.model_registry.upload_model(
        f, "fraud-detector", "2.0.0", "pytorch",
        metadata={"accuracy": 0.95}
    )

# List
models = await client.model_registry.list_models(framework="pytorch")

# Hot reload
result = await client.model_registry.hot_reload("model-123", "2.0.0")
```

### Phase 3: Cache Management

**Endpoints:**
- `GET /api/cache/stats` - Get statistics
- `POST /api/cache/warm` - Warm cache
- `POST /api/cache/invalidate` - Invalidate entries
- `GET /api/cache/topology` - Get topology

**Python:**
```python
# Stats
stats = await client.cache.get_stats(layer='all')

# Warm
result = await client.cache.warm_cache(model_id="model-123", layer="both")

# Invalidate
result = await client.cache.invalidate(model_id="model-123")

# Topology
topology = await client.cache.get_topology()
```

### Phase 4: Observability

**Endpoints:**
- `GET /api/observability/metrics` - Prometheus metrics
- `GET /api/observability/traces` - Jaeger traces
- `GET /api/observability/alerts` - Active alerts
- `GET /api/observability/dashboards/{name}` - Dashboard info

**Python:**
```python
# Metrics
metrics = await client.observability.get_metrics()

# PromQL query
result = await client.observability.query_prometheus(
    'rate(ml_inference_total[5m])'
)

# Traces
traces = await client.observability.get_traces(
    service="ml-service",
    min_duration=100
)

# Alerts
alerts = await client.observability.get_alerts(severity="critical")
```

## Integration Examples

### End-to-End ML Pipeline

```python
import asyncio
from schlep_engine import SchlepEngineClient

async def ml_pipeline():
    client = SchlepEngineClient(api_key="sk-your-key")

    # 1. Process training data (Phase 1)
    print("Processing training data...")
    train_result = await client.data.process_file(
        "training_data.csv",
        transformations=[
            {"type": "clean"},
            {"type": "normalize"}
        ]
    )

    # 2. Upload trained model (Phase 2)
    print("Uploading model...")
    with open("trained_model.pt", "rb") as f:
        model = await client.model_registry.upload_model(
            f, "classifier", "1.0.0", "pytorch"
        )

    # 3. Warm cache (Phase 3)
    print("Warming cache...")
    await client.cache.warm_cache(model['model_id'])

    # 4. Make predictions with caching
    print("Running predictions...")
    prediction = await client.ml.predict(
        model_id=model['model_id'],
        data={"feature1": 0.5, "feature2": 0.8}
    )
    print(f"Prediction: {prediction['result']}")
    print(f"Cache hit: {prediction['cache_hit']}")

    # 5. Monitor performance (Phase 4)
    print("Checking metrics...")
    metrics = await client.observability.get_metrics()
    print(f"Inference latency P99: {metrics['ml_inference_latency_p99']}ms")

    await client.close()

asyncio.run(ml_pipeline())
```

### Real-time Data Pipeline

```python
async def realtime_pipeline():
    client = SchlepEngineClient(api_key="sk-your-key")

    # Process streaming data
    while True:
        # Read from stream
        data = await read_from_stream()

        # Process with ETL
        result = await client.data.process(data)

        # Run inference with cache
        prediction = await client.ml.predict(
            model_id="fraud-detector",
            data=result['features']
        )

        # Check if cached
        if prediction['cache_hit']:
            print(f"Cache hit! Latency: {prediction['latency_ms']}ms")

        # Monitor traces
        if prediction['latency_ms'] > 100:
            traces = await client.observability.get_traces(
                trace_id=prediction['trace_id']
            )
            print(f"Slow request analyzed: {traces}")

        await asyncio.sleep(0.1)
```

## Best Practices

### 1. Authentication

**Use environment variables:**
```bash
export SCHLEP_API_KEY="sk-your-key"
```

```python
# Client automatically reads from env
client = SchlepEngineClient()
```

### 2. Error Handling

**Python:**
```python
from schlep_engine.exceptions import SchlepEngineError, RateLimitError

try:
    result = await client.data.process_file("data.csv")
except RateLimitError:
    await asyncio.sleep(60)  # Wait and retry
except SchlepEngineError as e:
    print(f"Error: {e}")
```

**Go:**
```go
result, err := schlepClient.Data.ProcessFile(ctx, req)
if err != nil {
    if errors.Is(err, client.ErrRateLimit) {
        time.Sleep(60 * time.Second)
    }
    return err
}
```

### 3. Context Management

**Always use context managers:**
```python
async with SchlepEngineClient(api_key="sk-key") as client:
    result = await client.data.process_file("data.csv")
    # Automatic cleanup
```

### 4. Caching Strategy

**Warm cache after deployment:**
```bash
schlep ml deploy model-123
schlep cache warm --model-id model-123 --layer both
```

**Monitor cache hit rate:**
```python
stats = await client.cache.get_stats()
if stats['l1_hit_rate'] < 0.8:
    await client.cache.warm_cache(model_id="model-123")
```

### 5. Observability

**Always enable tracing in production:**
```python
client = SchlepEngineClient(
    api_key="sk-key",
    enable_tracing=True,
    service_name="my-app"
)
```

**Monitor critical metrics:**
```python
metrics = await client.observability.get_metrics()
if metrics['ml_inference_latency_p99'] > 100:
    print("WARNING: High latency detected")
```

### 6. Batch Processing

**Use parallel processing:**
```bash
schlep process batch "data/*.csv" --parallel 16
```

```python
results = await client.data.batch_process(
    files=glob("data/*.csv"),
    parallel=16
)
```

## Troubleshooting

### Common Issues

**1. Authentication Errors**
```bash
schlep auth status  # Verify authentication
schlep auth login --api-key sk-new-key  # Re-authenticate
```

**2. Slow Inference**
```bash
# Check cache stats
schlep cache stats

# Warm cache
schlep cache warm --model-id model-123

# Check traces
schlep monitoring traces --min-duration 100
```

**3. Connection Issues**
```bash
# Check health
schlep health

# Verify base URL
export SCHLEP_BASE_URL="https://api.schlep-engine.com"
```

### Debug Mode

**CLI:**
```bash
SCHLEP_DEBUG=1 schlep process file data.csv
```

**Python:**
```python
client = SchlepEngineClient(api_key="sk-key", debug=True)
```

**Go:**
```go
cfg := &config.Config{
    APIKey:      "sk-key",
    EnableLogs:  true,
    LogLevel:    "DEBUG",
}
```

## Resources

- **CLI Documentation:** See [CLI_TUTORIAL.md](../examples/CLI_TUTORIAL.md)
- **API Reference:** https://docs.schlep-engine.com/api
- **Python SDK:** https://github.com/schlep-engine/python-sdk
- **Go SDK:** https://github.com/schlep-engine/go-sdk
- **Examples:** [/examples](../examples/)
- **Support:** support@schlep-engine.com

## Next Steps

1. Try the [End-to-End Example](../examples/phase_integration_e2e.py)
2. Read the [CLI Tutorial](../examples/CLI_TUTORIAL.md)
3. Explore [Observability Guide](./OBSERVABILITY_GUIDE.md)
4. Check [Infrastructure Automation Guide](./INFRA_AUTOMATION_GUIDE.md)
