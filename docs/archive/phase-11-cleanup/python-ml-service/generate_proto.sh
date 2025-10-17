#!/bin/bash
set -e

echo "Generating Python gRPC code from protobuf..."

# Generate Python code
python -m grpc_tools.protoc \
    -I./proto \
    --python_out=./proto \
    --grpc_python_out=./proto \
    ./proto/ml_service.proto

echo "✅ Python gRPC code generated in proto/"
echo "   - ml_service_pb2.py (messages)"
echo "   - ml_service_pb2_grpc.py (services)"
