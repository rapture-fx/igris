#!/bin/bash
# Load environment variables from .env
set -a
source .env
set +a

# Override for real provider mode
export PROVIDER_MODE=real
export TRACING_ENABLED=false

# Start the API server
exec ./schlep-engine-api
