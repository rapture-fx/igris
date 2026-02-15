# Igris Inertial CLI Tutorial

Complete guide to using the Igris Inertial CLI for Phases 1-5.

## Installation

```bash
pip install igris-inertial-cli
```

## Authentication

```bash
# Login with API key
igris auth login --api-key sk-your-api-key

# Check authentication status
igris auth status
```

## Phase 1: Multi-Format Data Processing

### Process CSV Files

```bash
# Single file processing
igris process file data/transactions.csv \
  --output processed.parquet \
  --clean

# Batch processing
igris process batch "data/*.csv" \
  --parallel 4 \
  --format parquet \
  --output-dir processed/
```

### ETL Pipeline

```bash
# Create ETL pipeline
igris pipeline create fraud-detection.yml --auto-start

# Monitor pipeline
igris pipeline status fraud-detection --watch

# View pipeline logs
igris pipeline logs fraud-detection --follow
```

## Phase 2: Model Registry & Lifecycle

### Upload Models

```bash
# Upload model to registry
igris ml registry-upload models/fraud_detector_v2.pt \
  --name fraud-detector \
  --version 2.0.0 \
  --framework pytorch \
  --metadata '{"accuracy": 0.95}'
```

### List & Manage Models

```bash
# List all models
igris ml registry-list

# Filter by framework
igris ml registry-list --filter pytorch --limit 10

# Get model details
igris ml registry-get model-123
```

### Hot Reload

```bash
# Hot reload model without downtime
igris ml hot-reload model-123 --version 2.0.0

# Deploy model
igris ml deploy model-123 \
  --environment production \
  --replicas 5 \
  --strategy canary
```

## Phase 3: Cache Management

### Cache Statistics

```bash
# View cache stats
igris cache stats --layer all

# Watch cache stats in real-time
igris cache stats --watch
```

### Warm Cache

```bash
# Warm cache for model
igris cache warm \
  --model-id model-123 \
  --dataset data/sample_inputs.csv \
  --layer both
```

### Cache Inspection

```bash
# Inspect cache entry
igris cache inspect "inference:model-123:hash" --layer l1

# View cache topology
igris cache topology
```

### Cache Invalidation

```bash
# Invalidate specific model cache
igris cache invalidate --model-id model-123 --confirm

# Invalidate by pattern
igris cache invalidate --pattern "inference:*" --layer l2 --confirm
```

## Phase 4: Observability

### Prometheus Metrics

```bash
# View all metrics
igris monitoring prometheus-metrics

# Query specific metric
igris monitoring prometheus-metrics --metric ml_inference_latency_p99

# Export in Prometheus format
igris monitoring prometheus-metrics --format prometheus > metrics.txt
```

### Distributed Traces

```bash
# View recent traces
igris monitoring traces --service ml-service --limit 20

# Filter slow traces
igris monitoring traces --min-duration 100

# View specific trace details
igris monitoring traces --trace-id abc123
```

### Alerts

```bash
# View active alerts
igris monitoring alerts --status active

# View critical alerts only
igris monitoring alerts --severity critical

# View all alert history
igris monitoring alerts --status all --limit 50
```

### Dashboards

```bash
# View inference dashboard
igris monitoring dashboard --dashboard inference

# View cache dashboard
igris monitoring dashboard --dashboard cache

# View ETL dashboard
igris monitoring dashboard --dashboard etl
```

## Phase 5: Infrastructure & DevOps

### System Health

```bash
# System status
igris monitoring status --detailed

# Watch system metrics
igris monitoring metrics --watch --interval 5
```

### Kubernetes Deployment

```bash
# Deploy to staging
helm upgrade --install igris-inertial helm/igris-inertial/ \
  --namespace igris-staging \
  --create-namespace \
  --wait

# Deploy canary to production
helm upgrade --install igris-inertial-canary helm/igris-inertial/ \
  --namespace igris-production \
  --set canary.enabled=true \
  --set canary.weight=10
```

### DevOps Automation

```bash
# Deploy infrastructure
igris devops deploy infra/ --env production

# Setup CI/CD pipeline
igris cicd setup-pipeline . \
  --provider github \
  --template ml-training

# Validate deployment
igris validate deployment --env production
```

## Complete Workflow Example

```bash
#!/bin/bash
# Complete Phase 1-5 workflow

# 1. Authenticate
igris auth login --api-key $IGRIS_API_KEY

# 2. Process data (Phase 1)
igris process batch "data/*.csv" --parallel 8 --output-dir processed/

# 3. Upload model (Phase 2)
igris ml registry-upload models/fraud_v2.pt \
  --name fraud-detector \
  --version 2.0.0 \
  --framework pytorch

# 4. Warm cache (Phase 3)
igris cache warm --model-id fraud-detector --layer both

# 5. Check observability (Phase 4)
igris monitoring prometheus-metrics
igris monitoring traces --service ml-service --limit 10
igris monitoring alerts --severity critical

# 6. Verify deployment (Phase 5)
igris monitoring status --detailed
igris monitoring dashboard --dashboard inference
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
igris batch submit-files "data/*.csv" \
  --parallel-jobs 16 \
  --priority high \
  --retry-on-failure

# Monitor batch progress
igris batch status batch-job-123 --watch
```

### Monitoring Watch Mode

```bash
# Watch cache stats
igris cache stats --watch

# Follow pipeline logs
igris pipeline logs my-pipeline --follow

# Watch metrics dashboard
igris monitoring metrics --watch --interval 10
```

## Troubleshooting

### Debug Mode

```bash
# Enable debug logging
IGRIS_DEBUG=1 igris process file data.csv

# Verbose output
igris ml deploy model-123 --verbose
```

### Health Checks

```bash
# Check API connectivity
igris health

# Verify authentication
igris auth status

# System diagnostics
igris monitoring status --detailed
```

## Environment Variables

```bash
# Configuration
export IGRIS_API_KEY="sk-your-api-key"
export IGRIS_BASE_URL="https://api.igris-inertial.com"
export IGRIS_TIMEOUT=60

# Processing settings
export IGRIS_PARALLEL_JOBS=8
export IGRIS_DEFAULT_FORMAT="parquet"

# Output settings
export IGRIS_OUTPUT_DIR="./output"
export IGRIS_LOG_LEVEL="INFO"
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
        run: igris auth login --api-key ${{ secrets.IGRIS_API_KEY }}

      - name: Process Data
        run: igris process batch "data/*.csv" --parallel 4

      - name: Upload Model
        run: igris ml registry-upload model.pt --name my-model --version ${{ github.sha }}

      - name: Deploy
        run: igris ml deploy my-model --environment production
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Process') {
            steps {
                sh 'igris process batch "data/*.csv"'
            }
        }
        stage('Deploy') {
            steps {
                sh 'igris ml deploy model-123 --environment production'
            }
        }
    }
}
```

## Best Practices

1. **Always authenticate first**: Run `igris auth login` before other commands
2. **Use batch processing**: Process multiple files with `--parallel` for efficiency
3. **Monitor with --watch**: Use watch flags for real-time updates
4. **Cache warming**: Warm cache after model deployment for optimal performance
5. **Check metrics**: Monitor Prometheus metrics and traces regularly
6. **Validate deployments**: Always check health after infrastructure changes

## Getting Help

```bash
# General help
igris --help

# Command-specific help
igris ml --help
igris cache --help
igris monitoring --help

# Detailed command help
igris ml registry-upload --help
```

## Resources

- Documentation: https://docs.igris-inertial.com/cli
- API Reference: https://docs.igris-inertial.com/api
- Examples: https://github.com/igris-inertial/examples
- Support: support@igris-inertial.com
