# Python ML Service Dockerfile

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto files and service
COPY proto/ ./proto/
COPY service/ ./service/

# Generate gRPC code
RUN python -m grpc_tools.protoc \
    -I./proto \
    --python_out=./proto \
    --grpc_python_out=./proto \
    ./proto/ml_service.proto

# Expose gRPC port
EXPOSE 50051

# Health check (using grpc_health_probe would be better in production)
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import grpc; \
        channel = grpc.insecure_channel('localhost:50051'); \
        grpc.channel_ready_future(channel).result(timeout=2)" || exit 1

# Run as non-root
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

CMD ["python", "service/server.py"]
