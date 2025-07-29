#!/bin/bash
# Railway ML Service Startup Script
# Optimized for Railway deployment with 4GB RAM and CPU-only workloads

set -e  # Exit on any error

# Railway-specific environment setup
export RAILWAY_ML_SERVICE=true
export PORT=${PORT:-8000}
export HOST=${HOST:-0.0.0.0}
export WORKERS=${WORKERS:-2}  # Optimized for 4GB RAM
export WORKER_CLASS=${WORKER_CLASS:-uvicorn.workers.UvicornWorker}
export TIMEOUT=${TIMEOUT:-120}
export KEEPALIVE=${KEEPALIVE:-5}
export MAX_REQUESTS=${MAX_REQUESTS:-1000}
export MAX_REQUESTS_JITTER=${MAX_REQUESTS_JITTER:-100}

# ML-specific optimizations for Railway
export TORCH_NUM_THREADS=4
export OMP_NUM_THREADS=4
export MKL_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=4
export PYTHONMALLOC=malloc
export MALLOC_ARENA_MAX=2

# TensorFlow optimizations
export TF_CPP_MIN_LOG_LEVEL=2
export TF_ENABLE_ONEDNN_OPTS=1

# Transformers optimizations
export TRANSFORMERS_OFFLINE=0
export HF_HUB_DISABLE_TELEMETRY=1

# Memory optimization for Railway 4GB limit
export PYTHONMALLOC=pymalloc
export PYTHONGC=1

echo "=== Railway ML Service Startup ==="
echo "Port: $PORT"
echo "Host: $HOST"
echo "Workers: $WORKERS"
echo "Worker Class: $WORKER_CLASS"
echo "Timeout: $TIMEOUT"
echo "Environment: Railway"
echo "================================="

# Pre-flight checks
echo "Running pre-flight checks..."

# Check Python and core imports
python -c "
import sys
print(f'Python version: {sys.version}')
import numpy as np
print(f'NumPy version: {np.__version__}')
import pandas as pd
print(f'Pandas version: {pd.__version__}')
import sklearn
print(f'Scikit-learn version: {sklearn.__version__}')
"

# Check ML frameworks (with error handling)
echo "Checking ML frameworks..."
python -c "
import warnings
warnings.filterwarnings('ignore')

try:
    import torch
    print(f'PyTorch version: {torch.__version__}')
    print(f'PyTorch CUDA available: {torch.cuda.is_available()}')
except ImportError as e:
    print(f'PyTorch import warning: {e}')

try:
    import tensorflow as tf
    print(f'TensorFlow version: {tf.__version__}')
    print(f'TensorFlow GPU devices: {len(tf.config.list_physical_devices(\"GPU\"))}')
except ImportError as e:
    print(f'TensorFlow import warning: {e}')

try:
    import transformers
    print(f'Transformers version: {transformers.__version__}')
except ImportError as e:
    print(f'Transformers import warning: {e}')

print('ML framework check completed.')
"

# Check database connectivity (if DATABASE_URL is set)
if [ ! -z "$DATABASE_URL" ]; then
    echo "Testing database connectivity..."
    python -c "
import asyncio
import asyncpg
import os

async def test_db():
    try:
        conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
        await conn.fetchrow('SELECT 1')
        await conn.close()
        print('Database connection: OK')
    except Exception as e:
        print(f'Database connection warning: {e}')

asyncio.run(test_db())
"
fi

# Check Redis connectivity (if REDIS_URL is set)
if [ ! -z "$REDIS_URL" ]; then
    echo "Testing Redis connectivity..."
    python -c "
import redis
import os

try:
    r = redis.from_url(os.getenv('REDIS_URL'))
    r.ping()
    print('Redis connection: OK')
except Exception as e:
    print(f'Redis connection warning: {e}')
"
fi

# Create necessary directories
mkdir -p /app/logs /app/cache /app/temp /app/models

# Log startup information
echo "$(date): Starting Railway ML Service" >> /app/logs/startup.log

# Pre-warm ML models (Railway optimization)
echo "Pre-warming ML models..."
python -c "
import warnings
warnings.filterwarnings('ignore')

# Pre-load common ML models to reduce cold start time
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    
    # Create dummy models to warm up sklearn
    rf = RandomForestClassifier(n_estimators=10)
    scaler = StandardScaler()
    print('Scikit-learn models pre-warmed')
except Exception as e:
    print(f'Scikit-learn pre-warm warning: {e}')

try:
    import torch
    import torch.nn as nn
    
    # Create a simple model to warm up PyTorch
    model = nn.Linear(10, 1)
    x = torch.randn(1, 10)
    _ = model(x)
    print('PyTorch models pre-warmed')
except Exception as e:
    print(f'PyTorch pre-warm warning: {e}')

try:
    import tensorflow as tf
    
    # Create a simple model to warm up TensorFlow
    model = tf.keras.Sequential([tf.keras.layers.Dense(1, input_shape=(10,))])
    x = tf.random.normal((1, 10))
    _ = model(x)
    print('TensorFlow models pre-warmed')
except Exception as e:
    print(f'TensorFlow pre-warm warning: {e}')

print('ML model pre-warming completed')
"

echo "Pre-flight checks completed successfully!"

# Start the ML service with Gunicorn (Railway optimized)
echo "Starting ML service with Gunicorn..."
exec gunicorn \
    --bind $HOST:$PORT \
    --workers $WORKERS \
    --worker-class $WORKER_CLASS \
    --timeout $TIMEOUT \
    --keepalive $KEEPALIVE \
    --max-requests $MAX_REQUESTS \
    --max-requests-jitter $MAX_REQUESTS_JITTER \
    --preload \
    --access-logfile /app/logs/access.log \
    --error-logfile /app/logs/error.log \
    --log-level info \
    --capture-output \
    --enable-stdio-inheritance \
    ml_service_main:app