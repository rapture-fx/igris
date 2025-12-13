# Schlep-engine CLI

[![PyPI version](https://badge.fury.io/py/igris-inertial-cli.svg)](https://badge.fury.io/py/igris-inertial-cli)
[![Python Support](https://img.shields.io/pypi/pyversions/igris-inertial-cli.svg)](https://pypi.org/project/igris-inertial-cli/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://pepy.tech/badge/igris-inertial-cli)](https://pepy.tech/project/igris-inertial-cli)

Official command-line interface for [Schlep-engine](https://igris-inertial.com) - Advanced data processing, machine learning, DevOps automation, and analytics platform.

## 🚀 Features

### Core Features
- **Complete CLI Interface**: Full access to all Schlep-engine API features
- **Batch Processing**: Process multiple files in parallel with intelligent queue management
- **Pipeline Management**: Create, monitor, and manage ML pipelines with real-time updates
- **Rich Terminal UI**: Beautiful progress bars, tables, live dashboards, and status displays
- **Configuration Management**: Flexible configuration system with validation and templates

### DevOps & Automation
- **Infrastructure Deployment**: Deploy Kubernetes, Docker Compose, Terraform configurations
- **CI/CD Integration**: Setup and manage pipelines for GitHub, GitLab, Jenkins, Azure DevOps, CircleCI
- **Advanced Job Queues**: Sophisticated batch processing with priorities, dependencies, and retry logic
- **Health Monitoring**: Comprehensive infrastructure and service health checks
- **Automated Validation**: System validation, API testing, and performance benchmarks

### Advanced Capabilities
- **Parallel Processing**: Multi-threaded execution with configurable worker pools
- **Real-time Monitoring**: Live dashboard updates with WebSocket connections
- **Cross-Platform**: Works seamlessly on Windows, macOS, and Linux
- **Extensible Architecture**: Plugin system for custom commands and integrations

## 📦 Installation

### From PyPI (Recommended)

```bash
pip install igris-inertial-cli
```

### From Source

```bash
git clone https://github.com/igris-inertial/cli.git
cd cli
pip install -e .
```

### Development Installation

```bash
git clone https://github.com/igris-inertial/cli.git
cd cli
pip install -e ".[dev]"
```

## 🏁 Quick Start

### 1. Authentication

Get your API key from the [Schlep-engine Dashboard](https://dashboard.igris-inertial.com/api-keys):

```bash
# Interactive login
schlep auth login

# Or with API key directly
schlep auth login --api-key sk-your-api-key-here

# Check authentication status
schlep auth status
```

### 2. Process Data

```bash
# Process a single file
schlep process file data.csv --output processed.parquet

# Batch process multiple files
schlep process batch "data/*.csv" --parallel 4 --clean

# Upload file to storage
schlep process upload data.csv --public
```

### 3. Manage Pipelines

```bash
# Create pipeline from config
schlep pipeline create fraud-detection.yml --auto-start

# List all pipelines
schlep pipeline list --status running

# Monitor pipeline progress
schlep pipeline status my-pipeline --watch

# View pipeline logs
schlep pipeline logs my-pipeline --follow
```

### 4. System Monitoring

```bash
# System health check
schlep monitoring status --detailed

# View system metrics
schlep monitoring metrics --watch

# List processing jobs
schlep monitoring jobs --status running
```

## 📚 Documentation

### Command Overview

```
schlep [COMMAND] [SUBCOMMAND] [OPTIONS]

Commands:
  auth        Authentication and user management
  process     Data processing and file operations  
  pipeline    ML pipeline management
  config      Configuration management
  monitoring  System monitoring and analytics
```

### Authentication Commands

```bash
# Login with API key
schlep auth login --api-key sk-123...

# Interactive login
schlep auth login --interactive

# Check authentication status
schlep auth status

# Show current user info
schlep auth whoami

# Logout and clear credentials
schlep auth logout
```

### Data Processing Commands

```bash
# Process single file
schlep process file input.csv \
  --output processed.parquet \
  --format parquet \
  --clean \
  --profile

# Batch process files
schlep process batch "data/*.csv" \
  --parallel 8 \
  --format parquet \
  --output-dir processed/ \
  --continue-on-error

# Upload file
schlep process upload data.csv \
  --bucket my-bucket \
  --public \
  --metadata project=demo

# Download file
schlep process download file-12345 --output data.csv
```

### Pipeline Management

```bash
# Create pipeline
schlep pipeline create config.yml --name "My Pipeline"

# List pipelines
schlep pipeline list --status running --limit 20

# Get pipeline details
schlep pipeline status my-pipeline --json

# Start/stop pipeline
schlep pipeline start my-pipeline
schlep pipeline stop my-pipeline --force

# View logs
schlep pipeline logs my-pipeline --lines 500 --follow

# Delete pipeline
schlep pipeline delete my-pipeline
```

### Configuration Management

```bash
# Initialize config
schlep config init

# List all settings
schlep config list

# Set configuration value
schlep config set parallel_jobs 8
schlep config set timeout 60

# Get configuration value
schlep config get base_url

# Update multiple values
schlep config update parallel_jobs=8 timeout=60 auto_clean=true

# Reset to defaults
schlep config reset
```

### Monitoring Commands

```bash
# System status
schlep monitoring status --detailed

# System metrics
schlep monitoring metrics --watch --interval 5

# List jobs
schlep monitoring jobs --status running

# Job details
schlep monitoring job job-12345 --watch

# Cancel job
schlep monitoring cancel-job job-12345
```

## ⚙️ Configuration

The CLI uses a hierarchical configuration system:

1. **Command line options** (highest priority)
2. **Environment variables** (prefixed with `SCHLEP_`)
3. **Configuration file** (`~/.schlep/config.yml`)
4. **Defaults** (lowest priority)

### Configuration File Example

```yaml
# ~/.schlep/config.yml
api:
  base_url: https://api.igris-inertial.com
  timeout: 30
  verify_ssl: true

processing:
  default_format: parquet
  parallel_jobs: 4
  auto_clean: true
  chunk_size: 1000

output:
  output_dir: output
  log_level: INFO
  show_progress: true

pipelines:
  timeout: 3600
  retry_attempts: 3
  retry_delay: 5
```

### Environment Variables

```bash
# API Configuration
export SCHLEP_API_KEY="sk-your-api-key"
export SCHLEP_BASE_URL="https://api.igris-inertial.com"
export SCHLEP_TIMEOUT=30

# Processing Settings
export SCHLEP_DEFAULT_FORMAT="parquet"
export SCHLEP_PARALLEL_JOBS=8
export SCHLEP_AUTO_CLEAN=true

# Output Settings
export SCHLEP_OUTPUT_DIR="./output"
export SCHLEP_LOG_LEVEL="INFO"
```

## 🔧 Advanced Usage

### Pipeline Configuration Files

Create YAML configuration files for complex ML pipelines:

```yaml
# fraud-detection.yml
name: fraud-detection-pipeline
description: Real-time fraud detection system
model_type: random_forest

features:
  - amount
  - merchant_category
  - time_of_day
  - user_history

target: is_fraud

parameters:
  n_estimators: 100
  max_depth: 10
  random_state: 42

deployment:
  environment: production
  auto_deploy: true
  monitoring: true
```

### Batch Processing with Configuration

```bash
# Create processing config
cat > processing_config.yml << EOF
clean_data: true
normalize_features: true
handle_outliers: true
output_format: parquet
compression: snappy
EOF

# Process with config
schlep process batch "data/*.csv" --config processing_config.yml
```

### CI/CD Integration

```bash
#!/bin/bash
# ci-cd-pipeline.sh

# Authenticate
schlep auth login --api-key $SCHLEP_API_KEY

# Process data
schlep process batch "data/*.csv" --parallel 8 --continue-on-error

# Deploy pipeline
schlep pipeline create production.yml --auto-start

# Monitor deployment
schlep pipeline status production-pipeline --watch
```

### Watch Mode for Real-time Monitoring

```bash
# Watch pipeline progress
schlep pipeline status my-pipeline --watch

# Monitor system metrics
schlep monitoring metrics --watch --interval 10

# Follow pipeline logs
schlep pipeline logs my-pipeline --follow
```

## 🎯 Use Cases

### DevOps Automation

```bash
# Automated data processing in CI/CD
schlep process batch "$DATA_DIR/*.csv" \
  --config production.yml \
  --parallel $CPU_CORES \
  --continue-on-error
```

### Data Science Workflows

```bash
# Process experimental data
schlep process file experiment_data.csv \
  --clean \
  --profile \
  --output experiments/processed_data.parquet

# Create and monitor ML pipeline
schlep pipeline create experiment.yml --auto-start
schlep pipeline status experiment --watch
```

### Batch Processing

```bash
# Process large datasets in parallel
schlep process batch "raw_data/**/*.json" \
  --parallel 16 \
  --format parquet \
  --output-dir processed_data/ \
  --progress
```

## 🐛 Error Handling

The CLI includes comprehensive error handling:

```bash
# Continue processing other files if one fails
schlep process batch "*.csv" --continue-on-error

# Retry failed operations
schlep config set retry_attempts 5
schlep config set retry_delay 10

# Debug mode for troubleshooting
SCHLEP_DEBUG=1 schlep process file data.csv
```

## 📊 Output Formats

The CLI supports multiple output formats:

- **JSON**: Machine-readable output for scripting
- **YAML**: Human-readable configuration format
- **Tables**: Rich formatted tables for terminal display
- **Progress bars**: Real-time progress indication

```bash
# JSON output for scripting
schlep auth status --json | jq '.authenticated'

# Table output for humans
schlep pipeline list --status running
```

## 🔌 Integration Examples

### GitHub Actions

```yaml
name: Data Processing Pipeline
on:
  push:
    paths: ['data/**']

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
          
      - name: Install CLI
        run: pip install igris-inertial-cli
        
      - name: Process Data
        run: |
          schlep auth login --api-key ${{ secrets.SCHLEP_API_KEY }}
          schlep process batch "data/*.csv" --parallel 4
        env:
          SCHLEP_API_KEY: ${{ secrets.SCHLEP_API_KEY }}
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        SCHLEP_API_KEY = credentials('igris-overture-key')
    }
    
    stages {
        stage('Process Data') {
            steps {
                sh '''
                    pip install igris-inertial-cli
                    schlep auth login --api-key $SCHLEP_API_KEY
                    schlep process batch "data/*.csv" --parallel 8
                '''
            }
        }
        
        stage('Deploy Pipeline') {
            steps {
                sh '''
                    schlep pipeline create production.yml --auto-start
                '''
            }
        }
    }
}
```

### Docker

```dockerfile
FROM python:3.9-slim

RUN pip install igris-inertial-cli

COPY data/ /app/data/
COPY pipeline.yml /app/

WORKDIR /app

CMD ["schlep", "pipeline", "create", "pipeline.yml", "--auto-start"]
```

## 🧪 Testing

Run the test suite:

```bash
# Install test dependencies
pip install -e ".[test]"

# Run all tests
pytest

# Run with coverage
pytest --cov=schlep_cli

# Run specific test categories
pytest -m "unit"
pytest -m "integration" 
pytest -m "cli"
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/igris-inertial/cli.git
cd cli
pip install -e ".[dev]"
pre-commit install
```

### Code Quality

```bash
# Format code
black src/ tests/
isort src/ tests/

# Lint code
flake8 src/ tests/
mypy src/

# Run all checks
pre-commit run --all-files
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.igris-inertial.com/cli](https://docs.igris-inertial.com/cli)
- **Issues**: [GitHub Issues](https://github.com/igris-inertial/cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/igris-inertial/cli/discussions)
- **Email**: [support@igris-inertial.com](mailto:support@igris-inertial.com)

## 📈 Roadmap

- [ ] Interactive shell mode
- [ ] Plugin system for custom commands
- [ ] Real-time streaming data processing
- [ ] Advanced workflow orchestration
- [ ] Integration with more CI/CD platforms
- [ ] Kubernetes operator integration

## 🏆 Acknowledgments

Built with:
- [Click](https://click.palletsprojects.com/) - Command line interface framework
- [Rich](https://rich.readthedocs.io/) - Rich text and beautiful formatting
- [Pydantic](https://pydantic-docs.helpmanual.io/) - Data validation
- [PyYAML](https://pyyaml.org/) - YAML parser

---

Made with ❤️ by the [Schlep-engine](https://igris-inertial.com) team.