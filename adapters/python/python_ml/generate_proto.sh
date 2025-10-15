#!/bin/bash
set -e

echo "🐍 Generating Python gRPC code from protobuf..."

# Generate Python gRPC code
python -m grpc_tools.protoc \
    -I./proto \
    --python_out=./proto \
    --grpc_python_out=./proto \
    ./proto/ml_service.proto

echo "✅ Python gRPC code generated successfully!"
echo "📍 Generated files:"
echo "   - proto/ml_service_pb2.py"
echo "   - proto/ml_service_pb2_grpc.py"
