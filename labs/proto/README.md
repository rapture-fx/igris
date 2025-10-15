# Proto Definitions - Unified ML Service Contract

**Version:** v1.0.0
**Last Updated:** 2025-10-09
**Status:** ✅ Production Ready

This directory contains the **single source of truth** for all gRPC proto definitions in Schlep-Engine.

## Quick Start

### Generate Code

```bash
cd proto
./generate.sh
```

This will generate:
- **Go code:** `go_gateway/proto/ml_service.pb.go` and `ml_service_grpc.pb.go`
- **Python code:** `apps/python-ml-service/proto/ml_service_pb2.py` and `ml_service_pb2_grpc.py`

### Prerequisites

**Go:**
```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

**Python:**
```bash
pip install grpcio-tools
```

## Proto Contract Summary

### Core Services (Phase 1 - Production)

| RPC | Request | Response | Status |
|-----|---------|----------|--------|
| `Predict` | `PredictRequest` | `PredictResponse` | ✅ Live |
| `BatchPredict` | `BatchPredictRequest` | `BatchPredictResponse` | ✅ Live |
| `HealthCheck` | `HealthCheckRequest` | `HealthCheckResponse` | ✅ Live |
| `GetModelInfo` | `ModelInfoRequest` | `ModelInfoResponse` | ✅ Live |

### Model Management (Phase 2)

| RPC | Request | Response | Status |
|-----|---------|----------|--------|
| `LoadModel` | `LoadModelRequest` | `LoadModelResponse` | 🚧 In Progress |
| `UnloadModel` | `UnloadModelRequest` | `UnloadModelResponse` | 🚧 In Progress |
| `ListModels` | `ListModelsRequest` | `ListModelsResponse` | 🚧 In Progress |
| `DeleteModel` | `DeleteModelRequest` | `DeleteModelResponse` | 🚧 In Progress |

### Advanced Inference (Phase 2)

| RPC | Request | Response | Status |
|-----|---------|----------|--------|
| `StreamPredict` | `PredictRequest` (stream) | `PredictResponse` (stream) | 🚧 In Progress |
| `ExplainPrediction` | `ExplainRequest` | `ExplainResponse` | 🚧 In Progress |
| `ABTestPredict` | `ABTestRequest` | `ABTestResponse` | 🚧 In Progress |

### Training & Evaluation (Phase 3 - Future)

| RPC | Status |
|-----|--------|
| `TrainModel` | 📋 Planned |
| `RetrainModel` | 📋 Planned |
| `GetTrainingStatus` | 📋 Planned |
| `CancelTraining` | 📋 Planned |
| `EvaluateModel` | 📋 Planned |
| `GetModelMetrics` | 📋 Planned |
| `ValidateModel` | 📋 Planned |

## Breaking Changes from Previous Versions

### v1.0.0 (2025-10-09) - BREAKING CHANGES

**🚨 Critical Field Rename:**
- **OLD (Go):** `PredictResponse.inference_time_ms`
- **NEW (Unified):** `PredictResponse.latency_ms`
- **Impact:** Go clients must update field name
- **Migration:** Search and replace `inference_time_ms` → `latency_ms`

**✨ New Features:**
- Added `api_version` field to all requests/responses for compatibility checking
- Consolidated proto from 2 files → 1 canonical source
- Added extensive documentation in proto file
- Proper Go package path: `github.com/schlep-engine/go-gateway/proto;mlpb`

**Removed:**
- `go_gateway/proto/ml_service_pb_stub.go` (hand-written stub - replaced with proper codegen)
- `apps/python-ml-service/proto/ml_service_extended.proto` (merged into main proto)

## Versioning Strategy

### API Versioning

All requests include `api_version` field:

```protobuf
message PredictRequest {
  string api_version = 1;  // e.g., "v1.0.0"
  // ...
}
```

**Client Compatibility:**
- Clients must send `api_version` (e.g., `"v1.0.0"`)
- Server validates version and rejects incompatible requests
- Server includes `api_version` in responses

**Version Format:** Semantic Versioning (SemVer)
- **Major:** Breaking changes (e.g., v1.0.0 → v2.0.0)
- **Minor:** New features, backward compatible (e.g., v1.0.0 → v1.1.0)
- **Patch:** Bug fixes, backward compatible (e.g., v1.0.0 → v1.0.1)

### Proto Compatibility Rules

1. **Never remove fields** - Mark as deprecated instead
2. **Never change field numbers** - Breaks wire compatibility
3. **Never change field types** - Use new field names
4. **Add new fields at end** - Maintains backward compatibility
5. **Always use optional for new fields** - Allows gradual rollout

## Migration Guide

### Updating Go Code

**Before (v0.x):**
```go
import pb "github.com/schlep-engine/go-gateway/proto"

resp, err := client.Predict(ctx, &pb.PredictRequest{
    ModelId: "iris",
    Features: []float64{5.1, 3.5, 1.4, 0.2},
})

latency := resp.InferenceTimeMs  // OLD field name
```

**After (v1.0.0):**
```go
import mlpb "github.com/schlep-engine/go-gateway/proto"

resp, err := client.Predict(ctx, &mlpb.PredictRequest{
    ApiVersion: "v1.0.0",  // NEW: Required
    ModelId: "iris",
    Features: []float64{5.1, 3.5, 1.4, 0.2},
})

latency := resp.LatencyMs  // FIXED field name
```

### Updating Python Code

**Before (v0.x):**
```python
from proto import ml_service_pb2, ml_service_pb2_grpc

request = ml_service_pb2.PredictRequest(
    model_id="iris",
    features=[5.1, 3.5, 1.4, 0.2]
)
```

**After (v1.0.0):**
```python
from proto import ml_service_pb2, ml_service_pb2_grpc

request = ml_service_pb2.PredictRequest(
    api_version="v1.0.0",  # NEW: Required
    model_id="iris",
    features=[5.1, 3.5, 1.4, 0.2]
)
```

## Development Workflow

### Making Changes

1. **Edit proto file:** `proto/ml_service.proto`
2. **Increment version** in proto comments
3. **Regenerate code:** `./generate.sh`
4. **Update version in code:** Search for `v1.0.0` and update
5. **Test compatibility:** Run integration tests
6. **Document breaking changes** in this README

### Adding New RPCs

```protobuf
// In proto/ml_service.proto, add to service definition:

service MLService {
  // ... existing RPCs ...

  // NEW: Your new RPC
  rpc YourNewMethod (YourRequest) returns (YourResponse);
}

// Define messages:

message YourRequest {
  string api_version = 1;
  // your fields...
}

message YourResponse {
  string api_version = 1;
  // your fields...
}
```

Then run `./generate.sh` to generate code.

## CI/CD Integration

### GitHub Actions Validation

Add to `.github/workflows/proto-validation.yml`:

```yaml
name: Proto Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install protoc
        run: |
          wget https://github.com/protocolbuffers/protobuf/releases/download/v21.12/protoc-21.12-linux-x86_64.zip
          unzip protoc-21.12-linux-x86_64.zip -d $HOME/.local
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Validate proto
        run: |
          cd proto
          protoc --proto_path=. --descriptor_set_out=/dev/null ml_service.proto

      - name: Generate code
        run: |
          cd proto
          ./generate.sh

      - name: Check for uncommitted changes
        run: |
          git diff --exit-code go_gateway/proto/
          git diff --exit-code apps/python-ml-service/proto/
```

## Troubleshooting

### Issue: `protoc: command not found`

**Solution:**
```bash
# macOS
brew install protobuf

# Ubuntu/Debian
sudo apt-get install protobuf-compiler

# Or download from: https://github.com/protocolbuffers/protobuf/releases
```

### Issue: `protoc-gen-go: program not found or is not executable`

**Solution:**
```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Add to PATH
export PATH="$PATH:$(go env GOPATH)/bin"
```

### Issue: Python import error `ModuleNotFoundError: No module named 'grpc_tools'`

**Solution:**
```bash
pip install grpcio-tools
```

### Issue: Generated files not matching proto

**Solution:**
```bash
# Clean and regenerate
rm go_gateway/proto/*.pb.go
rm apps/python-ml-service/proto/*_pb2*.py
cd proto && ./generate.sh
```

## References

- [Protocol Buffers Language Guide](https://developers.google.com/protocol-buffers/docs/proto3)
- [gRPC Go Quick Start](https://grpc.io/docs/languages/go/quickstart/)
- [gRPC Python Quick Start](https://grpc.io/docs/languages/python/quickstart/)
- [Proto Best Practices](https://developers.google.com/protocol-buffers/docs/proto3#backwards_compatibility)

---

**Maintained by:** Schlep-Engine Team
**Issues:** Report to #engineering-runtime channel
