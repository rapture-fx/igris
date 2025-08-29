import Link from 'next/link'
import { ArrowRightIcon, CommandLineIcon, CogIcon, ChartBarIcon, CloudIcon, PlayIcon } from '@heroicons/react/24/outline'

export default function CLIPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Schlep-engine CLI</h1>
        <p className="text-xl text-gray-600 mb-6">
          Official command-line interface for Schlep-engine with advanced data processing, DevOps automation, 
          and CI/CD integration capabilities. Perfect for automation workflows and batch processing.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="https://pypi.org/project/schlep-engine-cli/"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on PyPI
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/cli"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </div>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Installation</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">From PyPI (Recommended)</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <code className="text-green-400">pip install schlep-engine-cli</code>
            </div>
            <p className="text-gray-600">Install the latest stable version from PyPI.</p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Development Installation</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm">
{`git clone https://github.com/schlep-engine/cli.git
cd cli
pip install -e ".[dev]"`}
              </pre>
            </div>
            <p className="text-gray-600">Install from source with development dependencies.</p>
          </div>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Requirements</h3>
          <ul className="text-blue-800 space-y-1">
            <li>• Python 3.8 or later</li>
            <li>• Active Schlep-engine API key</li>
            <li>• Network access to api.schlep-engine.com</li>
          </ul>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Start</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Authentication</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Interactive login
schlep auth login

# Or with API key directly
schlep auth login --api-key sk-your-api-key-here

# Check authentication status
schlep auth status`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Process Data</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Process a single file
schlep process file data.csv --output processed.parquet

# Batch process multiple files
schlep process batch "data/*.csv" --parallel 4 --clean

# Upload file to storage
schlep process upload data.csv --public`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Manage ML Pipelines</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Create pipeline from config
schlep pipeline create fraud-detection.yml --auto-start

# Monitor pipeline progress
schlep pipeline status my-pipeline --watch

# View pipeline logs
schlep pipeline logs my-pipeline --follow`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Core Features</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <CommandLineIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Complete CLI Interface</h3>
            <p className="text-gray-600">
              Full access to all Schlep-engine API features with intuitive command-line syntax.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <PlayIcon className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Batch Processing</h3>
            <p className="text-gray-600">
              Process multiple files in parallel with intelligent queue management and error handling.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <ChartBarIcon className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pipeline Management</h3>
            <p className="text-gray-600">
              Create, monitor, and manage ML pipelines with real-time updates and progress tracking.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🎨</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rich Terminal UI</h3>
            <p className="text-gray-600">
              Beautiful progress bars, tables, live dashboards, and status displays for better UX.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CloudIcon className="h-8 w-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">DevOps Integration</h3>
            <p className="text-gray-600">
              Deploy infrastructure, setup CI/CD pipelines, and manage Kubernetes workloads.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CogIcon className="h-8 w-8 text-red-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration Management</h3>
            <p className="text-gray-600">
              Flexible configuration system with validation, templates, and environment support.
            </p>
          </div>
        </div>
      </section>

      {/* Command Reference */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Command Reference</h2>
        
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Authentication Commands</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Login with API key
schlep auth login --api-key sk-123...

# Interactive login
schlep auth login --interactive

# Check authentication status
schlep auth status

# Show current user info
schlep auth whoami

# Logout and clear credentials
schlep auth logout`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Processing Commands</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Process single file
schlep process file input.csv \\
  --output processed.parquet \\
  --format parquet \\
  --clean \\
  --profile

# Batch process files
schlep process batch "data/*.csv" \\
  --parallel 8 \\
  --format parquet \\
  --output-dir processed/ \\
  --continue-on-error

# Upload file
schlep process upload data.csv \\
  --bucket my-bucket \\
  --public \\
  --metadata project=demo`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Pipeline Management</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# Create pipeline
schlep pipeline create config.yml --name "My Pipeline"

# List pipelines
schlep pipeline list --status running --limit 20

# Get pipeline details
schlep pipeline status my-pipeline --json

# Start/stop pipeline
schlep pipeline start my-pipeline
schlep pipeline stop my-pipeline --force

# View logs
schlep pipeline logs my-pipeline --lines 500 --follow`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Monitoring Commands</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# System status
schlep monitoring status --detailed

# System metrics
schlep monitoring metrics --watch --interval 5

# List jobs
schlep monitoring jobs --status running

# Job details
schlep monitoring job job-12345 --watch

# Cancel job
schlep monitoring cancel-job job-12345`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Configuration</h2>
        
        <p className="text-gray-600 mb-6">
          The CLI uses a hierarchical configuration system with the following priority (highest to lowest):
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Configuration File</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-3">
              <pre className="text-sm text-gray-100">
{`# ~/.schlep/config.yml
api:
  base_url: https://api.schlep-engine.com
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
  retry_delay: 5`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Environment Variables</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-3">
              <pre className="text-sm text-gray-100">
{`# API Configuration
export SCHLEP_API_KEY="sk-your-api-key"
export SCHLEP_BASE_URL="https://api.schlep-engine.com"
export SCHLEP_TIMEOUT=30

# Processing Settings
export SCHLEP_DEFAULT_FORMAT="parquet"
export SCHLEP_PARALLEL_JOBS=8
export SCHLEP_AUTO_CLEAN=true

# Output Settings
export SCHLEP_OUTPUT_DIR="./output"
export SCHLEP_LOG_LEVEL="INFO"`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CI/CD Integration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">CI/CD Integration</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">GitHub Actions</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`name: Data Processing Pipeline
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
        run: pip install schlep-engine-cli
        
      - name: Process Data
        run: |
          schlep auth login --api-key \${{ secrets.SCHLEP_API_KEY }}
          schlep process batch "data/*.csv" --parallel 4
        env:
          SCHLEP_API_KEY: \${{ secrets.SCHLEP_API_KEY }}`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Jenkins Pipeline</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`pipeline {
    agent any
    
    environment {
        SCHLEP_API_KEY = credentials('schlep-api-key')
    }
    
    stages {
        stage('Process Data') {
            steps {
                sh '''
                    pip install schlep-engine-cli
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
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔄 DevOps Automation</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">
                schlep process batch "$DATA_DIR/*.csv" --config production.yml --parallel $CPU_CORES
              </code>
            </div>
            <p className="text-gray-600 text-sm">
              Automated data processing in CI/CD pipelines with configurable parallelism.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔬 Data Science Workflows</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">
                schlep pipeline create experiment.yml --auto-start && schlep pipeline status experiment --watch
              </code>
            </div>
            <p className="text-gray-600 text-sm">
              Create and monitor ML pipelines for experimental data processing workflows.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Batch Processing</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">
                schlep process batch "raw_data/**/*.json" --parallel 16 --format parquet
              </code>
            </div>
            <p className="text-gray-600 text-sm">
              Process large datasets in parallel with format conversion and optimization.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🏗️ Infrastructure Management</h3>
            <div className="bg-gray-900 rounded p-3 mb-3">
              <code className="text-sm text-green-400">
                schlep monitoring status --detailed && schlep monitoring metrics --watch
              </code>
            </div>
            <p className="text-gray-600 text-sm">
              Monitor system health and performance metrics in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Advanced Features</h2>
        
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Pipeline Configuration Files</h3>
            <p className="text-gray-600 mb-3">Create YAML configuration files for complex ML pipelines:</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# fraud-detection.yml
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
  monitoring: true`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Watch Mode for Real-time Monitoring</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-3">
              <pre className="text-sm text-gray-100">
{`# Watch pipeline progress
schlep pipeline status my-pipeline --watch

# Monitor system metrics  
schlep monitoring metrics --watch --interval 10

# Follow pipeline logs
schlep pipeline logs my-pipeline --follow`}
              </pre>
            </div>
            <p className="text-gray-600">Real-time updates with live refreshing displays and progress tracking.</p>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resources</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">📚 Documentation</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/guides/best-practices" className="text-blue-600 hover:text-blue-700">
                  Best Practices Guide →
                </Link>
              </li>
              <li>
                <Link href="/guides/troubleshooting" className="text-blue-600 hover:text-blue-700">
                  Troubleshooting Guide →
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-blue-600 hover:text-blue-700">
                  REST API Reference →
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">💬 Support</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/schlep-engine/cli/issues" className="text-blue-600 hover:text-blue-700">
                  GitHub Issues →
                </Link>
              </li>
              <li>
                <Link href="https://github.com/schlep-engine/cli/discussions" className="text-blue-600 hover:text-blue-700">
                  GitHub Discussions →
                </Link>
              </li>
              <li>
                <Link href="mailto:support@schlep-engine.com" className="text-blue-600 hover:text-blue-700">
                  Email Support →
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">🎯 Examples</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/schlep-engine/cli-examples" className="text-blue-600 hover:text-blue-700">
                  CLI Examples Repository →
                </Link>
              </li>
              <li>
                <Link href="/use-cases" className="text-blue-600 hover:text-blue-700">
                  Use Cases & Tutorials →
                </Link>
              </li>
              <li>
                <Link href="https://github.com/schlep-engine/cli/tree/main/examples" className="text-blue-600 hover:text-blue-700">
                  Configuration Templates →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}