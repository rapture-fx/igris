#!/bin/bash

# Schlep-engine CLI CI/CD Integration Examples
# This script demonstrates how to integrate the CLI into CI/CD pipelines

set -e  # Exit on any error

echo "🚀 Schlep-engine CI/CD Integration Example"
echo "=========================================="

# Environment variables that should be set in CI/CD
# SCHLEP_API_KEY - API key for authentication
# SCHLEP_ENVIRONMENT - Environment (dev/staging/prod)
# SCHLEP_PROJECT_ID - Project identifier

# Check required environment variables
check_env_vars() {
    echo "📋 Checking environment variables..."
    
    if [ -z "$SCHLEP_API_KEY" ]; then
        echo "❌ SCHLEP_API_KEY environment variable is required"
        exit 1
    fi
    
    if [ -z "$SCHLEP_ENVIRONMENT" ]; then
        echo "⚠️  SCHLEP_ENVIRONMENT not set, defaulting to 'dev'"
        export SCHLEP_ENVIRONMENT="dev"
    fi
    
    echo "✅ Environment variables validated"
}

# Setup CLI configuration
setup_cli() {
    echo "🔧 Setting up CLI configuration..."
    
    # Initialize configuration
    schlep config init
    
    # Set environment-specific settings
    if [ "$SCHLEP_ENVIRONMENT" = "prod" ]; then
        schlep config set parallel_jobs 16
        schlep config set timeout 120
        schlep config set retry_attempts 5
    else
        schlep config set parallel_jobs 4
        schlep config set timeout 60
        schlep config set retry_attempts 3
    fi
    
    # Authenticate using API key from environment
    schlep auth login --api-key "$SCHLEP_API_KEY"
    
    # Verify authentication
    if ! schlep auth status --json | jq -e '.authenticated == true' > /dev/null; then
        echo "❌ Authentication failed"
        exit 1
    fi
    
    echo "✅ CLI setup completed"
}

# Data processing pipeline
run_data_processing() {
    echo "📊 Running data processing pipeline..."
    
    # Check if data directory exists
    if [ ! -d "data/" ]; then
        echo "⚠️  No data directory found, skipping data processing"
        return 0
    fi
    
    # Process all CSV files in data directory
    if ls data/*.csv 1> /dev/null 2>&1; then
        echo "Processing CSV files..."
        schlep process batch "data/*.csv" \
            --format parquet \
            --clean \
            --profile \
            --parallel 4 \
            --output-dir "processed_data/" \
            --continue-on-error
    fi
    
    # Process JSON files if they exist
    if ls data/*.json 1> /dev/null 2>&1; then
        echo "Processing JSON files..."
        schlep process batch "data/*.json" \
            --format parquet \
            --parallel 2 \
            --output-dir "processed_data/"
    fi
    
    echo "✅ Data processing completed"
}

# Model training and deployment
deploy_ml_pipeline() {
    echo "🤖 Deploying ML pipeline..."
    
    # Check if pipeline configuration exists
    if [ ! -f "pipeline.yml" ]; then
        echo "⚠️  No pipeline.yml found, creating default configuration"
        cat > pipeline.yml << EOF
name: ci-cd-pipeline-${SCHLEP_ENVIRONMENT}
description: Automated pipeline deployed from CI/CD
model_type: auto
auto_deploy: true
environment: ${SCHLEP_ENVIRONMENT}
tags:
  - ci-cd
  - automated
  - ${SCHLEP_ENVIRONMENT}
EOF
    fi
    
    # Create and start pipeline
    PIPELINE_ID=$(schlep pipeline create pipeline.yml --auto-start --json | jq -r '.pipeline_id')
    
    if [ "$PIPELINE_ID" = "null" ] || [ -z "$PIPELINE_ID" ]; then
        echo "❌ Failed to create pipeline"
        exit 1
    fi
    
    echo "📈 Pipeline created: $PIPELINE_ID"
    
    # Wait for pipeline completion (with timeout)
    echo "⏳ Waiting for pipeline completion..."
    TIMEOUT=1800  # 30 minutes
    ELAPSED=0
    
    while [ $ELAPSED -lt $TIMEOUT ]; do
        STATUS=$(schlep pipeline status "$PIPELINE_ID" --json | jq -r '.status')
        
        case $STATUS in
            "completed")
                echo "✅ Pipeline completed successfully"
                return 0
                ;;
            "failed")
                echo "❌ Pipeline failed"
                schlep pipeline logs "$PIPELINE_ID" --lines 50
                exit 1
                ;;
            "running"|"pending")
                echo "⏳ Pipeline status: $STATUS (elapsed: ${ELAPSED}s)"
                sleep 30
                ELAPSED=$((ELAPSED + 30))
                ;;
            *)
                echo "⚠️  Unknown pipeline status: $STATUS"
                sleep 30
                ELAPSED=$((ELAPSED + 30))
                ;;
        esac
    done
    
    echo "❌ Pipeline timed out after ${TIMEOUT} seconds"
    exit 1
}

# Quality gates and validation
run_quality_gates() {
    echo "🔍 Running quality gates..."
    
    # Check system health
    if ! schlep monitoring status --json | jq -e '.api_connection == "healthy"' > /dev/null; then
        echo "❌ API health check failed"
        exit 1
    fi
    
    # Validate configuration
    if ! schlep config validate; then
        echo "❌ Configuration validation failed"
        exit 1
    fi
    
    # Check for failed jobs
    FAILED_JOBS=$(schlep monitoring jobs --status failed --json | jq length)
    if [ "$FAILED_JOBS" -gt 0 ]; then
        echo "⚠️  Warning: $FAILED_JOBS failed jobs found"
        # In production, you might want to fail the build here
    fi
    
    echo "✅ Quality gates passed"
}

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    
    # Clean up temporary files
    rm -rf temp_data/ || true
    rm -f temp_*.csv temp_*.json || true
    
    # Optionally clean up old pipelines (keep last 5)
    echo "🗑️  Cleaning up old pipelines..."
    OLD_PIPELINES=$(schlep pipeline list --json | jq -r '.[] | select(.created_at < (now - 86400*7)) | .id' | head -n -5)
    
    if [ -n "$OLD_PIPELINES" ]; then
        echo "$OLD_PIPELINES" | while read -r pipeline_id; do
            echo "Deleting old pipeline: $pipeline_id"
            schlep pipeline delete "$pipeline_id" --force || true
        done
    fi
    
    echo "✅ Cleanup completed"
}

# Generate deployment report
generate_report() {
    echo "📊 Generating deployment report..."
    
    # Create deployment report
    REPORT_FILE="deployment_report_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$REPORT_FILE" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$SCHLEP_ENVIRONMENT",
    "commit": "${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}",
    "branch": "${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')}",
    "build_number": "${GITHUB_RUN_NUMBER:-unknown}"
  },
  "system_status": $(schlep monitoring status --json 2>/dev/null || echo '{}'),
  "pipeline_count": $(schlep pipeline list --json 2>/dev/null | jq length || echo '0'),
  "recent_jobs": $(schlep monitoring jobs --limit 10 --json 2>/dev/null || echo '[]')
}
EOF
    
    echo "📄 Report saved to: $REPORT_FILE"
    
    # If running in GitHub Actions, add as artifact
    if [ -n "$GITHUB_ACTIONS" ]; then
        echo "report_file=$REPORT_FILE" >> "$GITHUB_OUTPUT"
    fi
}

# Main execution flow
main() {
    echo "🏁 Starting CI/CD pipeline..."
    
    # Trap for cleanup on exit
    trap cleanup EXIT
    
    check_env_vars
    setup_cli
    run_quality_gates
    run_data_processing
    deploy_ml_pipeline
    generate_report
    
    echo "🎉 CI/CD pipeline completed successfully!"
}

# Script usage examples
show_usage() {
    cat << EOF
Usage: $0 [command]

Commands:
  setup     - Only setup CLI and authenticate
  process   - Only run data processing
  deploy    - Only deploy ML pipeline
  validate  - Only run quality gates
  cleanup   - Only run cleanup
  report    - Only generate report
  all       - Run complete pipeline (default)

Environment Variables:
  SCHLEP_API_KEY (required)     - API key for authentication
  SCHLEP_ENVIRONMENT (optional) - Environment (dev/staging/prod)
  SCHLEP_PROJECT_ID (optional)  - Project identifier

Examples:
  # Complete pipeline
  SCHLEP_API_KEY=sk-123... $0

  # Only data processing
  SCHLEP_API_KEY=sk-123... $0 process

  # Production deployment
  SCHLEP_API_KEY=sk-123... SCHLEP_ENVIRONMENT=prod $0 deploy
EOF
}

# Handle command line arguments
case "${1:-all}" in
    setup)
        check_env_vars
        setup_cli
        ;;
    process)
        check_env_vars
        setup_cli
        run_data_processing
        ;;
    deploy)
        check_env_vars
        setup_cli
        deploy_ml_pipeline
        ;;
    validate)
        check_env_vars
        setup_cli
        run_quality_gates
        ;;
    cleanup)
        cleanup
        ;;
    report)
        check_env_vars
        setup_cli
        generate_report
        ;;
    all)
        main
        ;;
    --help|-h)
        show_usage
        ;;
    *)
        echo "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac