#!/bin/bash
# Proto Code Generation Script
# Generates Go and Python code from unified proto definition

set -e  # Exit on error

PROTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$PROTO_DIR")"

echo "🔧 Generating proto code from: $PROTO_DIR/ml_service.proto"

# ============================================================================
# Go Code Generation
# ============================================================================

GO_OUT_DIR="$ROOT_DIR/go_gateway/proto"
mkdir -p "$GO_OUT_DIR"

echo "📦 Generating Go code..."

protoc \
  --proto_path="$PROTO_DIR" \
  --go_out="$GO_OUT_DIR" \
  --go_opt=paths=source_relative \
  --go-grpc_out="$GO_OUT_DIR" \
  --go-grpc_opt=paths=source_relative \
  "$PROTO_DIR/ml_service.proto"

if [ $? -eq 0 ]; then
  echo "✅ Go code generated: $GO_OUT_DIR/ml_service.pb.go"
  echo "✅ Go gRPC code generated: $GO_OUT_DIR/ml_service_grpc.pb.go"
else
  echo "❌ Go code generation failed"
  exit 1
fi

# ============================================================================
# Python Code Generation
# ============================================================================

PYTHON_OUT_DIR="$ROOT_DIR/apps/python-ml-service/proto"
mkdir -p "$PYTHON_OUT_DIR"

echo "📦 Generating Python code..."

python3 -m grpc_tools.protoc \
  --proto_path="$PROTO_DIR" \
  --python_out="$PYTHON_OUT_DIR" \
  --grpc_python_out="$PYTHON_OUT_DIR" \
  "$PROTO_DIR/ml_service.proto"

if [ $? -eq 0 ]; then
  echo "✅ Python code generated: $PYTHON_OUT_DIR/ml_service_pb2.py"
  echo "✅ Python gRPC code generated: $PYTHON_OUT_DIR/ml_service_pb2_grpc.py"
else
  echo "❌ Python code generation failed"
  exit 1
fi

# ============================================================================
# Fix Python imports (grpc_tools generates incorrect relative imports)
# ============================================================================

echo "🔧 Fixing Python imports..."

# Fix the import in ml_service_pb2_grpc.py
if [ -f "$PYTHON_OUT_DIR/ml_service_pb2_grpc.py" ]; then
  sed -i.bak 's/import ml_service_pb2/from . import ml_service_pb2/' "$PYTHON_OUT_DIR/ml_service_pb2_grpc.py"
  rm "$PYTHON_OUT_DIR/ml_service_pb2_grpc.py.bak" 2>/dev/null || true
  echo "✅ Fixed Python imports"
fi

# ============================================================================
# Validation
# ============================================================================

echo ""
echo "🔍 Validating generated files..."

# Check Go files exist
if [ ! -f "$GO_OUT_DIR/ml_service.pb.go" ] || [ ! -f "$GO_OUT_DIR/ml_service_grpc.pb.go" ]; then
  echo "❌ Go files missing"
  exit 1
fi

# Check Python files exist
if [ ! -f "$PYTHON_OUT_DIR/ml_service_pb2.py" ] || [ ! -f "$PYTHON_OUT_DIR/ml_service_pb2_grpc.py" ]; then
  echo "❌ Python files missing"
  exit 1
fi

echo "✅ All proto files generated successfully!"
echo ""
echo "📋 Summary:"
echo "  Go:     $GO_OUT_DIR/"
echo "  Python: $PYTHON_OUT_DIR/"
echo ""
echo "🎯 Next steps:"
echo "  1. Update Go code to use new proto package: import mlpb \"github.com/schlep-engine/go-gateway/proto\""
echo "  2. Update Python code to import from proto package: from proto import ml_service_pb2"
echo "  3. Fix field name: inference_time_ms → latency_ms in Go code"
echo "  4. Add api_version field to all requests"
echo ""
