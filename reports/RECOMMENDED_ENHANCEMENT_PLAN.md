# Recommended Enhancement Plan
**Schlep-Engine Inference Core - Production Roadmap**

**Date:** 2025-10-06
**Based On:** Inference Core Audit Report (Score: 74/100)
**Goal:** Achieve production-ready status (Score: 90+) in 6-8 weeks
**Positioning:** "Unified API for Data-to-Inference Orchestration"

---

## Executive Summary

**Current Status:** C+ (74/100) - Functional prototype, NOT production-ready
**Target:** A- (92/100) - Production-ready with monitoring
**Timeline:** 6-8 weeks (3 phases)
**Team Size:** 2-3 engineers

**Expected Outcomes:**
- ✅ 80%+ test coverage
- ✅ Real ML model serving (PyTorch/scikit-learn)
- ✅ Batch inference (10-100x throughput improvement)
- ✅ Circuit breakers and retry logic
- ✅ Binary size reduction (-10.5 MB via deprecated module removal)
- ✅ Production-grade observability

---

## Three-Phase Roadmap

### **Phase 1: Technical Debt & Critical Fixes** (Weeks 1-3)
**Goal:** Remove blockers, achieve basic production viability
**Target Score:** 82/100 (B-)

### **Phase 2: Performance & Resilience** (Weeks 4-5)
**Goal:** Scale to 10K RPS, add fault tolerance
**Target Score:** 88/100 (B+)

### **Phase 3: Advanced Features** (Weeks 6-8)
**Goal:** Production hardening, monitoring, GPU support
**Target Score:** 92/100 (A-)

---

## Phase 1: Technical Debt & Critical Fixes (Weeks 1-3)

**Objective:** Remove deprecated code, add tests, fix critical safety issues

### Week 1: Cleanup & Foundation

#### 1.1 Delete Deprecated Rust Modules (P0, 1 day)
**Files to Delete:**
```bash
rm rust_kernel/src/data_normalizer.rs  # 472 lines
rm rust_kernel/src/data_registry.rs
rm rust_kernel/src/etl_runner.rs

# Update lib.rs
# REMOVE: pub mod data_normalizer;
# REMOVE: pub mod data_registry;
# REMOVE: pub mod etl_runner;
```

**Update Cargo.toml:**
```toml
[dependencies]
# REMOVE these lines:
# csv = "1.3"
# polars = "0.51.0"
# arrow = "56.2.0"
# parquet = "56.2.0"
# avro-rs = "0.13.0"

# KEEP only:
serde_json = "1.0.145"
serde = { version = "1.0", features = ["derive"] }
chrono = "0.4.42"
libc = "0.2"
tokio = { version = "1.47", features = ["full"] }
```

**Expected Impact:**
- Binary size: 12.3 MB → 1.8 MB (-85%)
- Compile time: -30%
- Dependencies: 42 → 27 crates

**Validation:**
```bash
cargo build --release
ls -lh target/release/libschlep_kernel.so
# Should be ~1.8 MB

cargo test
# All tests should pass
```

**Owner:** Backend Engineer
**Est. Time:** 4 hours

---

#### 1.2 Fix Rust FFI Memory Safety (P0, 1 day)
**Issue:** FFI functions can panic across boundary (undefined behavior)

**Fix `rust_hello()` and all string-returning FFI functions:**
```rust
// BEFORE (UNSAFE):
pub extern "C" fn rust_hello(name: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(name) };
    let name_str = c_str.to_str().unwrap_or("World"); // ← Can panic
    let message = format!("Hello {} from Rust kernel!", name_str);
    CString::new(message).unwrap().into_raw() // ← Can panic on null bytes
}

// AFTER (SAFE):
pub extern "C" fn rust_hello(name: *const c_char) -> *mut c_char {
    if name.is_null() {
        return std::ptr::null_mut();
    }

    let c_str = unsafe { CStr::from_ptr(name) };
    let name_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let message = format!("Hello {} from Rust kernel!", name_str);
    match CString::new(message) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}
```

**Apply to all FFI functions:**
- `rust_validate_schema()`
- `rust_transform_json()`
- `rust_sanitize_string()`
- `rust_hash_string()`
- `rust_filter_array()`
- `rust_sort_array()`

**Add Go-side null checks:**
```go
// ffi.go
func HelloFrom(name string) string {
    cName := C.CString(name)
    defer C.free(unsafe.Pointer(cName))

    cResult := C.rust_hello(cName)
    if cResult == nil {  // ← ADD null check
        return "Error: Rust FFI returned null"
    }
    defer C.rust_free_string(cResult)

    return C.GoString(cResult)
}
```

**Owner:** Rust Developer
**Est. Time:** 6 hours

---

#### 1.3 Add Go Gateway Test Suite (P0, 2 days)
**Current:** 0 test files
**Target:** 80% coverage

**Test Structure:**
```
go_gateway/
├── internal/
│   ├── ml/
│   │   ├── client_test.go          ← NEW
│   │   ├── client_optimized_test.go ← NEW
│   ├── router/
│   │   ├── adaptive_router_test.go  ← NEW
│   ├── cache/
│   │   ├── redis_cache_test.go      ← NEW
│   ├── rust/
│   │   ├── ffi_test.go              ← NEW
├── cmd/api/
│   ├── handlers_test.go             ← NEW
```

**Example: `ml/client_test.go`**
```go
package ml_test

import (
    "context"
    "testing"
    "time"

    "github.com/schlep-engine/go-gateway/internal/ml"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestMLClient_Predict(t *testing.T) {
    // Mock gRPC server
    mockServer := startMockMLServer(t)
    defer mockServer.Stop()

    client, err := ml.NewClient(mockServer.Address())
    require.NoError(t, err)
    defer client.Close()

    ctx := context.Background()
    resp, err := client.Predict(ctx, []float64{1.0, 2.0, 3.0}, "test-model")

    assert.NoError(t, err)
    assert.NotNil(t, resp)
    assert.Equal(t, "test-model", resp.ModelId)
    assert.Greater(t, resp.Confidence, 0.0)
}

func TestMLClient_Reconnect(t *testing.T) {
    // Test reconnection logic
}

func TestMLClient_Timeout(t *testing.T) {
    // Test request timeout
}
```

**Coverage Targets:**
- Handlers: 80%
- ML Client: 90%
- Adaptive Router: 95%
- Redis Cache: 85%
- FFI Bindings: 75%

**Dependencies:**
```go
go get github.com/stretchr/testify@latest
go get github.com/golang/mock@latest
```

**Owner:** Backend Engineer
**Est. Time:** 16 hours

---

### Week 2: Circuit Breakers & Error Handling

#### 2.1 Implement Circuit Breaker (P0, 2 days)
**Issue:** ML service failures cascade to entire system

**Install Library:**
```bash
go get github.com/sony/gobreaker@v0.5.0
```

**Wrap ML Client:**
```go
// internal/ml/circuit_breaker.go
package ml

import (
    "context"
    "time"

    "github.com/sony/gobreaker"
)

type CircuitBreakerClient struct {
    client *Client
    cb     *gobreaker.CircuitBreaker
}

func NewCircuitBreakerClient(address string) (*CircuitBreakerClient, error) {
    client, err := NewClient(address)
    if err != nil {
        return nil, err
    }

    cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        "ML-Service",
        MaxRequests: 3,                 // Half-open state: test with 3 requests
        Interval:    10 * time.Second,  // Reset error count every 10s
        Timeout:     30 * time.Second,  // Open → Half-open after 30s
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.5 // 50% error rate
        },
        OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
            log.Printf("Circuit breaker %s: %s → %s", name, from, to)
        },
    })

    return &CircuitBreakerClient{
        client: client,
        cb:     cb,
    }, nil
}

func (c *CircuitBreakerClient) Predict(ctx context.Context, features []float64, modelId string) (*PredictResponse, error) {
    result, err := c.cb.Execute(func() (interface{}, error) {
        return c.client.Predict(ctx, features, modelId)
    })

    if err != nil {
        return nil, err
    }

    return result.(*PredictResponse), nil
}
```

**Update Handlers:**
```go
// cmd/api/main.go
mlClient, err := ml.NewCircuitBreakerClient("python-ml:50051") // ← Use CB wrapper
```

**Add Fallback Logic:**
```go
app.Post("/ml/predict", func(c *fiber.Ctx) error {
    resp, err := mlClient.Predict(c.Context(), req.Features, req.ModelID)
    if err != nil {
        // Check if circuit breaker is open
        if errors.Is(err, gobreaker.ErrOpenState) {
            // Return cached prediction if available
            cached, cacheErr := predictionCache.Get(c.Context(), req.ModelID, req.Features)
            if cacheErr == nil && cached != nil {
                return c.JSON(fiber.Map{
                    "prediction": cached.Prediction,
                    "confidence": cached.Confidence,
                    "source":     "cache_fallback",
                    "note":       "Circuit breaker open - serving cached result",
                })
            }
        }
        return c.Status(503).JSON(fiber.Map{"error": "ML service unavailable"})
    }
    return c.JSON(resp)
})
```

**Owner:** Backend Engineer
**Est. Time:** 12 hours

---

#### 2.2 Add Retry Logic with Exponential Backoff (P0, 1 day)
**Issue:** Transient failures (network hiccups) cause request failures

**Install Library:**
```bash
go get github.com/cenkalti/backoff/v4@latest
```

**Implement Retry Wrapper:**
```go
// internal/ml/retry.go
package ml

import (
    "context"
    "time"

    "github.com/cenkalti/backoff/v4"
)

type RetryConfig struct {
    MaxRetries     int
    InitialBackoff time.Duration
    MaxBackoff     time.Duration
    Multiplier     float64
}

func (c *CircuitBreakerClient) PredictWithRetry(ctx context.Context, features []float64, modelId string, cfg RetryConfig) (*PredictResponse, error) {
    bo := backoff.NewExponentialBackOff()
    bo.InitialInterval = cfg.InitialBackoff
    bo.MaxInterval = cfg.MaxBackoff
    bo.Multiplier = cfg.Multiplier
    bo.MaxElapsedTime = 0 // No max elapsed time (use max retries instead)

    backoffWithRetries := backoff.WithMaxRetries(bo, uint64(cfg.MaxRetries))

    var resp *PredictResponse
    operation := func() error {
        var err error
        resp, err = c.Predict(ctx, features, modelId)
        return err
    }

    err := backoff.Retry(operation, backoffWithRetries)
    return resp, err
}
```

**Default Configuration:**
```go
var DefaultRetryConfig = RetryConfig{
    MaxRetries:     3,
    InitialBackoff: 100 * time.Millisecond,
    MaxBackoff:     2 * time.Second,
    Multiplier:     2.0,
}
```

**Owner:** Backend Engineer
**Est. Time:** 6 hours

---

#### 2.3 Structured Error Handling (P0, 1 day)
**Issue:** Generic errors make debugging impossible

**Define Error Types:**
```go
// internal/errors/errors.go
package errors

type SchlepError struct {
    Code      string                 `json:"code"`
    Message   string                 `json:"message"`
    Details   map[string]interface{} `json:"details,omitempty"`
    TraceID   string                 `json:"trace_id"`
    Timestamp time.Time              `json:"timestamp"`
}

func (e *SchlepError) Error() string {
    return fmt.Sprintf("[%s] %s (trace: %s)", e.Code, e.Message, e.TraceID)
}

// Error codes
const (
    ErrMLServiceUnavailable  = "ML_SERVICE_UNAVAILABLE"
    ErrInvalidFeatures       = "INVALID_FEATURES"
    ErrModelNotFound         = "MODEL_NOT_FOUND"
    ErrCircuitBreakerOpen    = "CIRCUIT_BREAKER_OPEN"
    ErrRateLimitExceeded     = "RATE_LIMIT_EXCEEDED"
    ErrInvalidRequest        = "INVALID_REQUEST"
    ErrInternalServer        = "INTERNAL_SERVER_ERROR"
)

func New(code, message string, details map[string]interface{}) *SchlepError {
    return &SchlepError{
        Code:      code,
        Message:   message,
        Details:   details,
        TraceID:   generateTraceID(),
        Timestamp: time.Now(),
    }
}
```

**Update Error Responses:**
```go
if err != nil {
    schlepErr := errors.New(
        errors.ErrMLServiceUnavailable,
        "Failed to get prediction from ML service",
        map[string]interface{}{
            "model_id": req.ModelID,
            "error":    err.Error(),
        },
    )
    return c.Status(503).JSON(schlepErr)
}
```

**Owner:** Backend Engineer
**Est. Time:** 6 hours

---

### Week 3: Python ML Service - Real Model Integration

#### 3.1 Implement Real Model Loading (P0, 2 days)
**Issue:** Current service is mock-only (returns sum of features)

**Add Dependencies:**
```txt
# requirements-production.txt
torch==2.1.0
torchvision==0.16.0
scikit-learn==1.3.2
onnxruntime==1.16.0
numpy==1.24.3
joblib==1.3.2
```

**Model Manager:**
```python
# service/model_manager.py
import torch
import joblib
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ModelManager:
    """Manages ML model loading and inference"""

    def __init__(self, models_dir: str = "/models"):
        self.models_dir = Path(models_dir)
        self.models: Dict[str, Any] = {}
        self.model_types: Dict[str, str] = {}

    def load_model(self, model_id: str) -> None:
        """Load a model from disk"""
        model_path = self.models_dir / f"{model_id}"

        if not model_path.exists():
            raise FileNotFoundError(f"Model {model_id} not found at {model_path}")

        # Detect model type
        if (model_path / "model.pth").exists():
            self._load_pytorch_model(model_id, model_path / "model.pth")
        elif (model_path / "model.pkl").exists():
            self._load_sklearn_model(model_id, model_path / "model.pkl")
        elif (model_path / "model.onnx").exists():
            self._load_onnx_model(model_id, model_path / "model.onnx")
        else:
            raise ValueError(f"No supported model file found for {model_id}")

        logger.info(f"Loaded model: {model_id} (type: {self.model_types[model_id]})")

    def _load_pytorch_model(self, model_id: str, path: Path):
        model = torch.load(path, map_location="cpu")
        model.eval()
        self.models[model_id] = model
        self.model_types[model_id] = "pytorch"

    def _load_sklearn_model(self, model_id: str, path: Path):
        model = joblib.load(path)
        self.models[model_id] = model
        self.model_types[model_id] = "sklearn"

    def _load_onnx_model(self, model_id: str, path: Path):
        import onnxruntime as ort
        session = ort.InferenceSession(str(path))
        self.models[model_id] = session
        self.model_types[model_id] = "onnx"

    def predict(self, model_id: str, features: list[float]) -> tuple[float, float]:
        """Run inference on a model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not loaded")

        model = self.models[model_id]
        model_type = self.model_types[model_id]

        if model_type == "sklearn":
            return self._predict_sklearn(model, features)
        elif model_type == "pytorch":
            return self._predict_pytorch(model, features)
        elif model_type == "onnx":
            return self._predict_onnx(model, features)

    def _predict_sklearn(self, model, features):
        import numpy as np
        X = np.array(features).reshape(1, -1)
        prediction = model.predict(X)[0]

        # Get confidence if model supports predict_proba
        confidence = 0.95  # Default
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(X)
            confidence = float(proba.max())

        return float(prediction), confidence

    def _predict_pytorch(self, model, features):
        import numpy as np
        X = torch.tensor(features, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            output = model(X)
            prediction = output.item() if output.numel() == 1 else output.argmax().item()
            confidence = torch.softmax(output, dim=1).max().item() if output.numel() > 1 else 0.95

        return float(prediction), confidence

    def _predict_onnx(self, session, features):
        import numpy as np
        X = np.array(features, dtype=np.float32).reshape(1, -1)
        input_name = session.get_inputs()[0].name
        output = session.run(None, {input_name: X})
        prediction = output[0][0]
        confidence = 0.95  # ONNX doesn't provide built-in confidence

        return float(prediction), confidence
```

**Update Server:**
```python
# service/server.py
from service.model_manager import ModelManager

class MLServiceServicer(ml_pb2_grpc.MLServiceServicer):
    def __init__(self, models_dir="/models"):
        logger.info("Initializing ML Service...")
        self.model_manager = ModelManager(models_dir)
        self.version = "1.0.0-production"

        # Auto-load models on startup
        self._load_default_models()

    def _load_default_models(self):
        """Load all models from models directory"""
        models_to_load = ["iris-classifier", "sentiment-analyzer"]
        for model_id in models_to_load:
            try:
                self.model_manager.load_model(model_id)
            except Exception as e:
                logger.warning(f"Failed to load {model_id}: {e}")

    def Predict(self, request, context):
        logger.info(f"Predict: model={request.model_id}, features={list(request.features)}")

        # Validation
        if not request.features:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Features cannot be empty")

        if len(request.features) > 10000:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Too many features")

        try:
            prediction, confidence = self.model_manager.predict(
                request.model_id,
                list(request.features)
            )

            return ml_pb2.PredictResponse(
                prediction=prediction,
                confidence=confidence,
                model_id=request.model_id
            )

        except ValueError as e:
            context.abort(grpc.StatusCode.NOT_FOUND, str(e))
        except Exception as e:
            logger.error(f"Prediction failed: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, "Prediction failed")
```

**Owner:** ML Engineer
**Est. Time:** 12 hours

---

#### 3.2 Add Input Validation (P0, 1 day)
**Issue:** No validation of features or model IDs

**Validation Functions:**
```python
# service/validation.py
import re
from typing import List

class ValidationError(Exception):
    pass

def validate_features(features: List[float]) -> None:
    """Validate feature vector"""
    if not features:
        raise ValidationError("Features cannot be empty")

    if len(features) > 10000:
        raise ValidationError(f"Too many features: {len(features)} (max: 10000)")

    if not all(isinstance(f, (int, float)) for f in features):
        raise ValidationError("All features must be numeric")

    if any(abs(f) > 1e10 for f in features):
        raise ValidationError("Feature values too large (overflow risk)")

def validate_model_id(model_id: str) -> None:
    """Validate model ID format"""
    if not model_id:
        raise ValidationError("Model ID cannot be empty")

    if len(model_id) > 100:
        raise ValidationError("Model ID too long")

    if not re.match(r'^[a-zA-Z0-9\-_]+$', model_id):
        raise ValidationError("Invalid model ID format (alphanumeric, -, _ only)")
```

**Apply in Servicer:**
```python
def Predict(self, request, context):
    try:
        validate_model_id(request.model_id)
        validate_features(list(request.features))
    except ValidationError as e:
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))

    # ... rest of prediction logic
```

**Owner:** ML Engineer
**Est. Time:** 4 hours

---

## Phase 2: Performance & Resilience (Weeks 4-5)

### Week 4: Batch Inference & Connection Pooling

#### 4.1 Implement Batch Inference (P1, 3 days)
**Impact:** 10-100x throughput improvement for GPU inference

**Update Protobuf Schema:**
```protobuf
// ml_service.proto
message BatchPredictRequest {
    repeated FeatureVector features = 1;
    string model_id = 2;
    int32 batch_size = 3;
}

message FeatureVector {
    repeated double values = 1;
}

message BatchPredictResponse {
    repeated PredictionResult predictions = 1;
    string model_id = 2;
    int64 latency_ms = 3;
}

message PredictionResult {
    double prediction = 1;
    double confidence = 2;
}

service MLService {
    rpc Predict(PredictRequest) returns (PredictResponse);
    rpc BatchPredict(BatchPredictRequest) returns (BatchPredictResponse); // ← NEW
    rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}
```

**Python Implementation:**
```python
def BatchPredict(self, request, context):
    if not request.features:
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "No features provided")

    # Convert to numpy array
    features_array = np.array([list(fv.values) for fv in request.features])

    try:
        predictions, confidences = self.model_manager.batch_predict(
            request.model_id,
            features_array,
            batch_size=request.batch_size or 32
        )

        results = [
            ml_pb2.PredictionResult(prediction=p, confidence=c)
            for p, c in zip(predictions, confidences)
        ]

        return ml_pb2.BatchPredictResponse(
            predictions=results,
            model_id=request.model_id
        )

    except Exception as e:
        logger.error(f"Batch prediction failed: {e}", exc_info=True)
        context.abort(grpc.StatusCode.INTERNAL, "Batch prediction failed")
```

**Go Client:**
```go
// internal/ml/client.go
func (c *Client) BatchPredict(ctx context.Context, features [][]float64, modelId string) ([]PredictResponse, error) {
    featureVectors := make([]*pb.FeatureVector, len(features))
    for i, feat := range features {
        featureVectors[i] = &pb.FeatureVector{Values: feat}
    }

    req := &pb.BatchPredictRequest{
        Features: featureVectors,
        ModelId:  modelId,
        BatchSize: 32,
    }

    resp, err := c.client.BatchPredict(ctx, req)
    if err != nil {
        return nil, err
    }

    results := make([]PredictResponse, len(resp.Predictions))
    for i, pred := range resp.Predictions {
        results[i] = PredictResponse{
            Prediction: pred.Prediction,
            Confidence: pred.Confidence,
            ModelId:    resp.ModelId,
        }
    }

    return results, nil
}
```

**Owner:** ML Engineer + Backend Engineer
**Est. Time:** 20 hours

---

#### 4.2 gRPC Connection Pooling (P1, 1 day)
**Issue:** Single connection = resource leak + poor performance

**Implement Pool:**
```go
// internal/ml/pool.go
package ml

import (
    "context"
    "sync"

    "google.golang.org/grpc"
)

type ConnectionPool struct {
    address string
    size    int
    conns   chan *grpc.ClientConn
    mu      sync.RWMutex
}

func NewConnectionPool(address string, size int) (*ConnectionPool, error) {
    pool := &ConnectionPool{
        address: address,
        size:    size,
        conns:   make(chan *grpc.ClientConn, size),
    }

    // Pre-create connections
    for i := 0; i < size; i++ {
        conn, err := grpc.Dial(address, grpc.WithInsecure())
        if err != nil {
            pool.Close()
            return nil, err
        }
        pool.conns <- conn
    }

    return pool, nil
}

func (p *ConnectionPool) Get() (*grpc.ClientConn, error) {
    return <-p.conns, nil
}

func (p *ConnectionPool) Put(conn *grpc.ClientConn) {
    p.conns <- conn
}

func (p *ConnectionPool) Close() error {
    close(p.conns)
    for conn := range p.conns {
        conn.Close()
    }
    return nil
}
```

**Owner:** Backend Engineer
**Est. Time:** 6 hours

---

### Week 5: Observability & Metrics

#### 5.1 Add Prometheus Metrics to All Components (P1, 2 days)
**Components:** Go Gateway, Python ML Service, Rust FFI

**Go Metrics:**
```go
// internal/observability/metrics.go
var (
    mlRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "ml_requests_total",
        Help: "Total ML prediction requests",
    }, []string{"model_id", "status"})

    mlLatencySeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "ml_latency_seconds",
        Help:    "ML prediction latency",
        Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
    }, []string{"model_id"})

    ffiCallsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "ffi_calls_total",
        Help: "Total FFI calls to Rust kernel",
    }, []string{"function"})

    ffiLatencyMicroseconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "ffi_latency_microseconds",
        Help:    "FFI call latency in microseconds",
        Buckets: prometheus.ExponentialBuckets(1, 2, 15), // 1µs to 16ms
    }, []string{"function"})
)
```

**Python Metrics:**
```python
# service/metrics.py
from prometheus_client import Counter, Histogram, start_http_server

PREDICTIONS_TOTAL = Counter('ml_predictions_total', 'Total predictions', ['model_id', 'status'])
PREDICTION_LATENCY = Histogram('ml_prediction_latency_seconds', 'Prediction latency', ['model_id'])
MODEL_LOAD_TIME = Histogram('ml_model_load_seconds', 'Model loading time', ['model_id'])
BATCH_SIZE = Histogram('ml_batch_size', 'Batch prediction size', ['model_id'])

# Start metrics server on port 8000
start_http_server(8000)
```

**Owner:** DevOps Engineer
**Est. Time:** 12 hours

---

#### 5.2 Enable TLS for gRPC (P1, 1 day)
**Issue:** Insecure gRPC communication

**Generate Certificates:**
```bash
# scripts/generate_certs.sh
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Go Client:**
```go
import "google.golang.org/grpc/credentials"

creds, err := credentials.NewClientTLSFromFile("cert.pem", "")
conn, err := grpc.Dial(address, grpc.WithTransportCredentials(creds))
```

**Python Server:**
```python
import grpc

server_credentials = grpc.ssl_server_credentials(
    [(open('key.pem', 'rb').read(), open('cert.pem', 'rb').read())]
)
server.add_secure_port('[::]:50051', server_credentials)
```

**Owner:** DevOps Engineer
**Est. Time:** 6 hours

---

## Phase 3: Advanced Features (Weeks 6-8)

### Week 6: GPU Support & Model Hot-Reloading

#### 6.1 Deploy GPU Instances (P2, 2 days)
**Hardware:** NVIDIA T4 or A10G GPU

**Update Docker Compose:**
```yaml
# docker-compose.yml
services:
  python-ml:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

**Install CUDA Dependencies:**
```txt
# requirements-gpu.txt
torch==2.1.0+cu118
torchvision==0.16.0+cu118
onnxruntime-gpu==1.16.0
```

**Expected Performance:**
```
CPU Inference:  200-500ms P50
GPU Inference:  20-50ms P50 (10x improvement)
```

**Owner:** ML Engineer + DevOps
**Est. Time:** 12 hours

---

#### 6.2 Implement Model Hot-Reloading (P2, 2 days)
**Goal:** Update models without service restart

**File Watcher:**
```python
# service/model_watcher.py
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time

class ModelFileHandler(FileSystemEventHandler):
    def __init__(self, model_manager):
        self.model_manager = model_manager

    def on_modified(self, event):
        if event.src_path.endswith('.pth') or event.src_path.endswith('.pkl'):
            model_id = self._extract_model_id(event.src_path)
            logger.info(f"Model {model_id} updated - reloading...")
            try:
                self.model_manager.reload_model(model_id)
                logger.info(f"Successfully reloaded {model_id}")
            except Exception as e:
                logger.error(f"Failed to reload {model_id}: {e}")

def start_model_watcher(model_manager, models_dir):
    event_handler = ModelFileHandler(model_manager)
    observer = Observer()
    observer.schedule(event_handler, models_dir, recursive=True)
    observer.start()
    return observer
```

**Owner:** ML Engineer
**Est. Time:** 12 hours

---

### Week 7-8: Production Hardening

#### 7.1 Implement Streaming Inference (P2, 3 days)
**Use Case:** Real-time predictions for live data streams

**Protobuf:**
```protobuf
rpc StreamPredict(stream PredictRequest) returns (stream PredictResponse);
```

**Owner:** Backend Engineer
**Est. Time:** 20 hours

---

#### 7.2 Add SLO/SLI Tracking (P2, 2 days)
**Metrics:**
- Availability SLO: 99.9%
- Latency SLI: P95 < 200ms
- Error Rate SLI: < 0.1%

**Grafana Dashboards:**
```yaml
# grafana/dashboards/slo.json
- Uptime gauge
- Error budget burn rate
- SLI compliance charts
```

**Owner:** DevOps Engineer
**Est. Time:** 12 hours

---

## Success Metrics

### Phase 1 Completion (Week 3)
- ✅ Binary size: < 2 MB
- ✅ Test coverage: > 80%
- ✅ Zero Rust FFI panics
- ✅ Real ML models loaded
- ✅ Circuit breakers active

**Score: 82/100 (B-)**

### Phase 2 Completion (Week 5)
- ✅ Batch inference: 10K RPS
- ✅ Connection pooling: < 1% connection errors
- ✅ TLS enabled
- ✅ Prometheus metrics: 100% coverage

**Score: 88/100 (B+)**

### Phase 3 Completion (Week 8)
- ✅ GPU inference: P50 < 50ms
- ✅ Model hot-reload: < 1s downtime
- ✅ SLO compliance: 99.9% uptime
- ✅ Streaming inference: functional

**Score: 92/100 (A-)**

---

## Resource Requirements

**Team:**
- 1x Backend Engineer (Go)
- 1x ML Engineer (Python)
- 0.5x Rust Developer (FFI fixes)
- 0.5x DevOps Engineer (infrastructure)

**Infrastructure:**
- 1x GPU instance (NVIDIA T4) - $300/month
- Redis cluster (3 nodes) - $180/month
- Prometheus + Grafana - $200/month

**Total Cost:** ~$700/month

---

## Risk Mitigation

**Risk 1:** GPU availability
- **Mitigation:** Keep CPU inference as fallback

**Risk 2:** Model hot-reload instability
- **Mitigation:** Canary deployments, rollback mechanism

**Risk 3:** Test coverage not achieved
- **Mitigation:** Mandate 80% coverage in CI/CD

---

## Conclusion

This 3-phase roadmap transforms Schlep-Engine from a **prototype (74/100)** to **production-ready (92/100)** in 6-8 weeks.

**Key Milestones:**
- Week 3: Critical fixes complete (P0 done)
- Week 5: Performance & resilience (P1 done)
- Week 8: Advanced features deployed (P2 done)

**Next Steps:**
1. Approve roadmap and assign teams
2. Create GitHub project board with tasks
3. Set up CI/CD pipeline with test coverage gates
4. Begin Phase 1 cleanup (delete deprecated modules)

**Expected ROI:**
- 10-100x throughput improvement (batch inference + GPU)
- 99.9% uptime (circuit breakers + retry logic)
- 85% reduction in binary size
- Production-grade observability

---

**Roadmap Generated:** 2025-10-06
**Next Review:** End of Week 3 (Phase 1 completion)
**Approval Required:** CTO, Engineering Manager
