#!/bin/bash
set -a
source .env
set +a
PROVIDER_MODE=real
./schlep-engine-api
