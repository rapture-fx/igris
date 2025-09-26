#!/bin/bash

# MinIO bucket setup script for Schlep Engine
# Creates necessary buckets and policies for metadata and debug logs

set -e

echo "Setting up MinIO buckets for Schlep Engine..."

# MinIO client configuration
MINIO_HOST="${MINIO_HOST:-minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-schlep_admin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-schlep_minio_dev_password_2024}"

# Wait for MinIO to be ready
echo "Waiting for MinIO to start..."
until mc alias set local "http://${MINIO_HOST}" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
    echo "MinIO not ready yet, waiting 5 seconds..."
    sleep 5
done

echo "MinIO is ready. Creating buckets and policies..."

# Create core buckets
echo "Creating core buckets..."

# Task code and artifacts storage
mc mb local/schlep-tasks --region=us-east-1 || echo "Bucket schlep-tasks already exists"
mc policy set public local/schlep-tasks

# System debug and audit logs
mc mb local/schlep-logs --region=us-east-1 || echo "Bucket schlep-logs already exists"
mc policy set private local/schlep-logs

# System configuration and metadata
mc mb local/schlep-config --region=us-east-1 || echo "Bucket schlep-config already exists"
mc policy set private local/schlep-config

# Task execution results and outputs
mc mb local/schlep-results --region=us-east-1 || echo "Bucket schlep-results already exists"
mc policy set private local/schlep-results

# Temporary files and staging area
mc mb local/schlep-temp --region=us-east-1 || echo "Bucket schlep-temp already exists"
mc policy set private local/schlep-temp

# Backup and disaster recovery
mc mb local/schlep-backups --region=us-east-1 || echo "Bucket schlep-backups already exists"
mc policy set private local/schlep-backups

echo "Setting up lifecycle policies for cost optimization..."

# Set lifecycle policy for temporary files (auto-delete after 7 days)
cat > /tmp/temp-lifecycle.json << 'EOF'
{
    "Rules": [
        {
            "ID": "DeleteTempFiles",
            "Status": "Enabled",
            "Filter": {
                "Prefix": ""
            },
            "Expiration": {
                "Days": 7
            }
        }
    ]
}
EOF

mc ilm import local/schlep-temp < /tmp/temp-lifecycle.json || echo "Lifecycle policy already set for temp bucket"

# Set lifecycle policy for logs (delete after 30 days, transition to IA after 7 days)
cat > /tmp/logs-lifecycle.json << 'EOF'
{
    "Rules": [
        {
            "ID": "LogsRetention",
            "Status": "Enabled",
            "Filter": {
                "Prefix": ""
            },
            "Expiration": {
                "Days": 90
            },
            "Transition": {
                "Days": 30,
                "StorageClass": "STANDARD_IA"
            }
        }
    ]
}
EOF

mc ilm import local/schlep-logs < /tmp/logs-lifecycle.json || echo "Lifecycle policy already set for logs bucket"

echo "Creating organization-specific directories..."

# Create directory structure for multi-tenant organization
organizations=("550e8400-e29b-41d4-a716-446655440000" "550e8400-e29b-41d4-a716-446655440001" "550e8400-e29b-41d4-a716-446655440002")

for org_id in "${organizations[@]}"; do
    echo "Setting up directories for organization: $org_id"

    # Create empty marker files to establish directory structure
    echo "Directory marker for org $org_id" | mc pipe local/schlep-tasks/$org_id/.marker
    echo "Directory marker for org $org_id" | mc pipe local/schlep-logs/$org_id/.marker
    echo "Directory marker for org $org_id" | mc pipe local/schlep-results/$org_id/.marker
    echo "Directory marker for org $org_id" | mc pipe local/schlep-config/$org_id/.marker
done

echo "Uploading sample configuration files..."

# Sample task definition
cat > /tmp/sample-task.py << 'EOF'
#!/usr/bin/env python3
"""
Sample Schlep Engine task definition
This demonstrates the basic structure of a task
"""
import asyncio
import json
import sys
from datetime import datetime

async def main():
    """Main task execution function"""
    print(f"Task started at: {datetime.utcnow().isoformat()}")

    # Read input data from environment or stdin
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}

    print(f"Processing input: {json.dumps(input_data, indent=2)}")

    # Simulate some work
    await asyncio.sleep(2)

    # Generate output
    output = {
        "status": "completed",
        "processed_at": datetime.utcnow().isoformat(),
        "input_hash": hash(json.dumps(input_data, sort_keys=True)),
        "result": f"Processed {len(input_data)} input parameters"
    }

    print(f"Task completed: {json.dumps(output, indent=2)}")
    return output

if __name__ == "__main__":
    asyncio.run(main())
EOF

# Upload sample task to the tasks bucket
mc cp /tmp/sample-task.py local/schlep-tasks/550e8400-e29b-41d4-a716-446655440000/sample-task-v1.0.0.py

# Sample configuration file
cat > /tmp/sample-config.json << 'EOF'
{
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "environment": "development",
    "feature_flags": {
        "advanced_analytics": true,
        "priority_support": true,
        "beta_features": false
    },
    "runtime_limits": {
        "max_execution_time": 900,
        "max_memory_mb": 1024,
        "max_concurrent_tasks": 10
    },
    "integrations": {
        "webhook_url": "https://hooks.slack.com/services/...",
        "notification_email": "admin@acme.com"
    },
    "created_at": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
}
EOF

mc cp /tmp/sample-config.json local/schlep-config/550e8400-e29b-41d4-a716-446655440000/config.json

# Sample log file
cat > /tmp/sample-log.jsonl << 'EOF'
{"timestamp": "2024-01-15T10:30:00Z", "level": "INFO", "module": "task_executor", "message": "Starting task execution", "task_id": "990e8400-e29b-41d4-a716-446655440000", "organization_id": "550e8400-e29b-41d4-a716-446655440000"}
{"timestamp": "2024-01-15T10:30:01Z", "level": "DEBUG", "module": "task_executor", "message": "Loading task definition", "task_definition_id": "880e8400-e29b-41d4-a716-446655440000"}
{"timestamp": "2024-01-15T10:30:02Z", "level": "INFO", "module": "task_executor", "message": "Task execution started", "worker_id": "worker-001", "cpu_limit": "75%", "memory_limit": "1GB"}
{"timestamp": "2024-01-15T10:32:27Z", "level": "INFO", "module": "task_executor", "message": "Task execution completed successfully", "duration_seconds": 145.2, "memory_peak": "650MB"}
{"timestamp": "2024-01-15T10:32:28Z", "level": "INFO", "module": "task_executor", "message": "Results uploaded", "output_location": "s3://schlep-results/550e8400-e29b-41d4-a716-446655440000/990e8400-e29b-41d4-a716-446655440000/output.json"}
EOF

mc cp /tmp/sample-log.jsonl local/schlep-logs/550e8400-e29b-41d4-a716-446655440000/$(date +%Y/%m/%d)/task-execution.jsonl

# Sample result file
cat > /tmp/sample-result.json << 'EOF'
{
    "execution_id": "990e8400-e29b-41d4-a716-446655440000",
    "task_definition_id": "880e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "started_at": "2024-01-15T10:30:02Z",
    "completed_at": "2024-01-15T10:32:27Z",
    "duration_seconds": 145.2,
    "resource_usage": {
        "cpu_usage_percent": 75,
        "memory_peak_mb": 650,
        "disk_io_mb": 45.2,
        "network_io_mb": 12.3
    },
    "input_data": {
        "input_file": "s3://data-bucket/2024/01/15/raw-data.csv",
        "processing_mode": "full"
    },
    "output_data": {
        "output_file": "s3://results-bucket/2024/01/15/processed-data.json",
        "records_processed": 15420,
        "records_valid": 15398,
        "records_invalid": 22,
        "summary_stats": {
            "avg_processing_time_ms": 9.4,
            "max_processing_time_ms": 45.2,
            "total_data_size_mb": 245.7
        }
    },
    "metadata": {
        "worker_hostname": "schlep-worker-1a2b3c",
        "runtime_version": "python3.11.7",
        "task_version": "1.2.0"
    }
}
EOF

mc cp /tmp/sample-result.json local/schlep-results/550e8400-e29b-41d4-a716-446655440000/990e8400-e29b-41d4-a716-446655440000/result.json

echo "Setting up backup configuration..."

# Create backup metadata
cat > /tmp/backup-info.json << 'EOF'
{
    "backup_type": "database_dump",
    "backup_schedule": "0 2 * * *",
    "retention_days": 30,
    "compression": "gzip",
    "encryption": "AES-256",
    "last_backup": null,
    "backup_size_mb": null,
    "backup_status": "configured"
}
EOF

mc cp /tmp/backup-info.json local/schlep-backups/config/backup-info.json

echo "Setting up cross-bucket replication policies..."

# Note: In production, you would set up cross-region replication here
# For Phase One, we're keeping it simple with single-instance MinIO

echo "Creating bucket notification configuration..."

# This would be used for webhook notifications when files are uploaded/deleted
# Useful for triggering task processing or cleanup operations

echo "MinIO setup complete!"
echo ""
echo "Buckets created:"
echo "  - schlep-tasks: Task code and artifacts"
echo "  - schlep-logs: Debug and audit logs"
echo "  - schlep-config: System configuration"
echo "  - schlep-results: Task execution outputs"
echo "  - schlep-temp: Temporary files (7-day TTL)"
echo "  - schlep-backups: Database backups and recovery"
echo ""
echo "Directory structure created for organizations:"
for org_id in "${organizations[@]}"; do
    echo "  - Organization: $org_id"
done
echo ""
echo "Sample files uploaded for development and testing"
echo "Lifecycle policies configured for automatic cleanup"
echo ""
echo "MinIO Console available at: http://localhost:9001"
echo "Access Key: $MINIO_ROOT_USER"
echo "Secret Key: $MINIO_ROOT_PASSWORD"

# Clean up temporary files
rm -f /tmp/temp-lifecycle.json /tmp/logs-lifecycle.json /tmp/sample-*.* /tmp/backup-info.json