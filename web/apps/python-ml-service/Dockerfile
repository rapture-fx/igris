# Python ML Service Dockerfile
# Minimal image for ML operations only

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto definition
COPY proto/ml_service.proto ./proto/

# Generate gRPC code
RUN python -m grpc_tools.protoc \
    -I./proto \
    --python_out=./proto \
    --grpc_python_out=./proto \
    ./proto/ml_service.proto

# Copy service code
COPY service/ ./service/
COPY models/ ./models/

# Set environment variables
ENV ML_SERVICE_PORT=50051
ENV MAX_WORKERS=10
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import grpc; channel = grpc.insecure_channel('localhost:50051'); grpc.channel_ready_future(channel).result(timeout=2)"

# Expose gRPC port
EXPOSE 50051

# Run server
CMD ["python", "service/server.py"]
