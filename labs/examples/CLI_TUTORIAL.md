# Schlep-Engine CLI Tutorial

Complete guide to using the Schlep-Engine CLI for Phases 1-5.

## Installation

```bash
pip install igris-inertial-cli
```

## Authentication

```bash
# Login with API key
schlep auth login --api-key sk-your-api-key

# Check authentication status
schlep auth status
```

## Phase 1: Multi-Format Data Processing

### Process CSV Files

```bash
# Single file processing
schlep process file data/transactions.csv \
  --output processed.parquet \
  --clean

# Batch processing
schlep process batch "data/*.csv" \
  --parallel 4 \
  --format parquet \
  --output-dir processed/
```

### ETL Pipeline

```bash
# Create ETL pipeline
schlep pipeline create fraud-detection.yml --auto-start

# Monitor pipeline
schlep pipeline status fraud-detection --watch

# View pipeline logs
schlep pipeline logs fraud-detection --follow
```

## Phase 2: Model Registry & Lifecycle

### Upload Models

```bash
# Upload model to registry
schlep ml registry-upload models/fraud_detector_v2.pt \
  --name fraud-detector \
  --version 2.0.0 \
  --framework pytorch \
  --metadata '{"accuracy": 0.95}'
```

### List & Manage Models

```bash
# List all models
schlep ml registry-list

# Filter by framework
schlep ml registry-list --filter pytorch --limit 10

# Get model details
schlep ml registry-get model-123
```

### Hot Reload

```bash
# Hot reload model without downtime
schlep ml hot-reload model-123 --version 2.0.0

# Deploy model
schlep ml deploy model-123 \
  --environment production \
  --replicas 5 \
  --strategy canary
```

## Phase 3: Cache Management

### Cache Statistics

```bash
# View cache stats
schlep cache stats --layer all

# Watch cache stats in real-time
schlep cache stats --watch
```

### Warm Cache

```bash
# Warm cache for model
schlep cache warm \
  --model-id model-123 \
  --dataset data/sample_inputs.csv \
  --layer both
```

### Cache Inspection

```bash
# Inspect cache entry
schlep cache inspect "inference:model-123:hash" --layer l1

# View cache topology
schlep cache topology
```

### Cache Invalidation

```bash
# Invalidate specific model cache
schlep cache invalidate --model-id model-123 --confirm

# Invalidate by pattern
schlep cache invalidate --pattern "inference:*" --layer l2 --confirm
```

## Phase 4: Observability

### Prometheus Metrics

```bash
# View all metrics
schlep monitoring prometheus-metrics

# Query specific metric
schlep monitoring prometheus-metrics --metric ml_inference_latency_p99

# Export in Prometheus format
schlep monitoring prometheus-metrics --format prometheus > metrics.txt
```

### Distributed Traces

```bash
# View recent traces
schlep monitoring traces --service ml-service --limit 20

# Filter slow traces
schlep monitoring traces --min-duration 100

# View specific trace details
schlep monitoring traces --trace-id abc123
```

### Alerts

```bash
# View active alerts
schlep monitoring alerts --status active

# View critical alerts only
schlep monitoring alerts --severity critical

# View all alert history
schlep monitoring alerts --status all --limit 50
```

### Dashboards

```bash
# View inference dashboard
schlep monitoring dashboard --dashboard inference

# View cache dashboard
schlep monitoring dashboard --dashboard cache

# View ETL dashboard
schlep monitoring dashboard --dashboard etl
```

## Phase 5: Infrastructure & DevOps

### System Health

```bash
# System status
schlep monitoring status --detailed

# Watch system metrics
schlep monitoring metrics --watch --interval 5
```

### Kubernetes Deployment

```bash
# Deploy to staging
helm upgrade --install igris-inertial helm/igris-inertial/ \
  --namespace schlep-staging \
  --create-namespace \
  --wait

# Deploy canary to production
helm upgrade --install igris-inertial-canary helm/igris-inertial/ \
  --namespace schlep-production \
  --set canary.enabled=true \
  --set canary.weight=10
```

### DevOps Automation

```bash
# Deploy infrastructure
schlep devops deploy infra/ --env production

# Setup CI/CD pipeline
schlep cicd setup-pipeline . \
  --provider github \
  --template ml-training

# Validate deployment
schlep validate deployment --env production
```

## Complete Workflow Example

```bash
#!/bin/bash
# Complete Phase 1-5 workflow

# 1. Authenticate
schlep auth login --api-key $SCHLEP_API_KEY

# 2. Process data (Phase 1)
schlep process batch "data/*.csv" --parallel 8 --output-dir processed/

# 3. Upload model (Phase 2)
schlep ml registry-upload models/fraud_v2.pt \
  --name fraud-detector \
  --version 2.0.0 \
  --framework pytorch

# 4. Warm cache (Phase 3)
schlep cache warm --model-id fraud-detector --layer both

# 5. Check observability (Phase 4)
schlep monitoring prometheus-metrics
schlep monitoring traces --service ml-service --limit 10
schlep monitoring alerts --severity critical

# 6. Verify deployment (Phase 5)
schlep monitoring status --detailed
schlep monitoring dashboard --dashboard inference
```

## Advanced Usage

### Pipeline Configuration

```yaml
# fraud-detection.yml
name: fraud-detection-pipeline
description: Real-time fraud detection
model_type: random_forest

features:
  - transaction_amount
  - merchant_category
  - user_country
  - time_of_day

target: is_fraud

parameters:
  n_estimators: 100
  max_depth: 10
  min_samples_split: 5

deployment:
  environment: production
  replicas: 5
  auto_scale: true
  monitoring: true
```

### Batch Processing

```bash
# Submit batch job
schlep batch submit-files "data/*.csv" \
  --parallel-jobs 16 \
  --priority high \
  --retry-on-failure

# Monitor batch progress
schlep batch status batch-job-123 --watch
```

### Monitoring Watch Mode

```bash
# Watch cache stats
schlep cache stats --watch

# Follow pipeline logs
schlep pipeline logs my-pipeline --follow

# Watch metrics dashboard
schlep monitoring metrics --watch --interval 10
```

## Troubleshooting

### Debug Mode

```bash
# Enable debug logging
SCHLEP_DEBUG=1 schlep process file data.csv

# Verbose output
schlep ml deploy model-123 --verbose
```

### Health Checks

```bash
# Check API connectivity
schlep health

# Verify authentication
schlep auth status

# System diagnostics
schlep monitoring status --detailed
```

## Environment Variables

```bash
# Configuration
export SCHLEP_API_KEY="sk-your-api-key"
export SCHLEP_BASE_URL="https://api.igris-inertial.com"
export SCHLEP_TIMEOUT=60

# Processing settings
export SCHLEP_PARALLEL_JOBS=8
export SCHLEP_DEFAULT_FORMAT="parquet"

# Output settings
export SCHLEP_OUTPUT_DIR="./output"
export SCHLEP_LOG_LEVEL="INFO"
```

## CI/CD Integration

### GitHub Actions

```yaml
name: ML Pipeline
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Authenticate
        run: schlep auth login --api-key ${{ secrets.SCHLEP_API_KEY }}

      - name: Process Data
        run: schlep process batch "data/*.csv" --parallel 4

      - name: Upload Model
        run: schlep ml registry-upload model.pt --name my-model --version ${{ github.sha }}

      - name: Deploy
        run: schlep ml deploy my-model --environment production
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Process') {
            steps {
                sh 'schlep process batch "data/*.csv"'
            }
        }
        stage('Deploy') {
            steps {
                sh 'schlep ml deploy model-123 --environment production'
            }
        }
    }
}
```

## Best Practices

1. **Always authenticate first**: Run `schlep auth login` before other commands
2. **Use batch processing**: Process multiple files with `--parallel` for efficiency
3. **Monitor with --watch**: Use watch flags for real-time updates
4. **Cache warming**: Warm cache after model deployment for optimal performance
5. **Check metrics**: Monitor Prometheus metrics and traces regularly
6. **Validate deployments**: Always check health after infrastructure changes

## Getting Help

```bash
# General help
schlep --help

# Command-specific help
schlep ml --help
schlep cache --help
schlep monitoring --help

# Detailed command help
schlep ml registry-upload --help
```

## Resources

- Documentation: https://docs.igris-inertial.com/cli
- API Reference: https://docs.igris-inertial.com/api
- Examples: https://github.com/igris-inertial/examples
- Support: support@igris-inertial.com
