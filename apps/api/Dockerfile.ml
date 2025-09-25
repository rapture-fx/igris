# Schlep Engine - ML-Enhanced Production Dockerfile
# Multi-stage build with optional ML frameworks (PyTorch, TensorFlow)

# ===== Stage 1: Base Dependencies =====
FROM python:3.11-slim as base-dependencies

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install base dependencies
COPY requirements.lock .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.lock

# ===== Stage 2: ML Framework Dependencies (Optional) =====
FROM base-dependencies as ml-dependencies

# Copy ML requirements
COPY requirements-ml.txt .

# Install ML dependencies conditionally
ARG ENABLE_TORCH=false
ARG ENABLE_TF=false
ARG ENABLE_GPU=false

# Install PyTorch if enabled
RUN if [ "$ENABLE_TORCH" = "true" ]; then \
        if [ "$ENABLE_GPU" = "true" ]; then \
            pip install --no-cache-dir torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118; \
        else \
            pip install --no-cache-dir torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cpu; \
        fi; \
    fi

# Install TensorFlow if enabled
RUN if [ "$ENABLE_TF" = "true" ]; then \
        if [ "$ENABLE_GPU" = "true" ]; then \
            pip install --no-cache-dir tensorflow==2.15.0; \
        else \
            pip install --no-cache-dir tensorflow-cpu==2.15.0; \
        fi; \
    fi

# Install additional ML packages if any frameworks are enabled
RUN if [ "$ENABLE_TORCH" = "true" ] || [ "$ENABLE_TF" = "true" ]; then \
        pip install --no-cache-dir \
            transformers==4.35.0 \
            scikit-learn==1.6.0 \
            matplotlib==3.8.2 \
            seaborn==0.13.0 \
            mlflow==2.8.1 \
            optuna==3.4.0 \
            shap==0.43.0; \
    fi

# ===== Stage 3: Application Runtime =====
FROM python:3.11-slim as runtime

# Install runtime system dependencies only
RUN apt-get update && apt-get install -y \
    libpq5 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r schlep && useradd -r -g schlep schlep

# Copy installed packages from dependencies stage
COPY --from=ml-dependencies /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ml-dependencies /usr/local/bin /usr/local/bin

# Set working directory
WORKDIR /app

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY .env.example .env

# Change ownership to non-root user
RUN chown -R schlep:schlep /app

# Switch to non-root user
USER schlep

# Expose port
EXPOSE 8000

# Environment variables for ML framework control
ENV ENABLE_TORCH=false
ENV ENABLE_TF=false
ENV ENABLE_GPU=false
ENV ML_BACKEND=auto
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=10s --retries=3 \
    CMD python -c "\
import requests; \
import os; \
try: \
    response = requests.get('http://localhost:8000/health', timeout=10); \
    response.raise_for_status(); \
    print('Health check passed'); \
except Exception as e: \
    print(f'Health check failed: {e}'); \
    exit(1)" || exit 1

# Default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

# Metadata
LABEL maintainer="Schlep Engine Team"
LABEL version="2.0.0"
LABEL description="Schlep Engine - ML-Enhanced Production API"
LABEL ml_frameworks="pytorch,tensorflow"
LABEL dependencies="25 base + 40 ML packages"

# Build-time labels for framework detection
LABEL torch_enabled="${ENABLE_TORCH:-false}"
LABEL tensorflow_enabled="${ENABLE_TF:-false}"
LABEL gpu_enabled="${ENABLE_GPU:-false}"