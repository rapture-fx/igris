# Pollarbase ML Service Dockerfile
# Optimized for ML workloads with PyTorch, Transformers, and scikit-learn
FROM python:3.11-slim as base

# Set environment variables for ML optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    TORCH_NUM_THREADS=4 \
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4

# Create non-root user
RUN groupadd -r mluser && useradd -r -g mluser mluser

# Install system dependencies for ML libraries
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    libc6-dev \
    libpq-dev \
    libgomp1 \
    libgcc-s1 \
    libblas3 \
    liblapack3 \
    libatlas-base-dev \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Build stage
FROM base as builder

# Copy ML requirements file
ARG REQUIREMENTS_FILE=requirements-ml.txt
COPY ${REQUIREMENTS_FILE} /app/requirements.txt

# Install Python ML dependencies (this will take a while)
RUN pip install --user --no-warn-script-location torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --user --no-warn-script-location -r requirements.txt

# Production stage
FROM base as production

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Update PATH
ENV PATH=/root/.local/bin:$PATH

# Copy ML service application code
COPY app/services/ml_service_client.py /app/app/services/
COPY app/services/advanced_ml_engine.py /app/app/services/
COPY app/services/ai_engine.py /app/app/services/
COPY app/core/ /app/app/core/
COPY app/database/ /app/app/database/
COPY ml_service_main.py /app/

# Create necessary directories
RUN mkdir -p /app/models /app/data /app/logs && \
    chown -R mluser:mluser /app

# Switch to non-root user
USER mluser

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Expose port
EXPOSE 8001

# Start ML service
CMD ["python", "ml_service_main.py"] 