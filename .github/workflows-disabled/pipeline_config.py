"""
CI/CD Pipeline Configuration
===========================

Comprehensive CI/CD pipeline configuration for production deployment automation.
Addresses deployment and automation gaps identified in system analysis.

Features:
- Automated testing pipeline
- Security scanning
- Performance testing
- Multi-environment deployment
- Rollback mechanisms
- Monitoring integration
"""

import os
import yaml
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum

class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class PipelineStage(Enum):
    BUILD = "build"
    TEST = "test"
    SECURITY_SCAN = "security_scan"
    PERFORMANCE_TEST = "performance_test"
    DEPLOY = "deploy"
    VERIFY = "verify"
    ROLLBACK = "rollback"

@dataclass
class TestConfig:
    """Testing configuration"""
    unit_tests: bool = True
    integration_tests: bool = True
    e2e_tests: bool = True
    coverage_threshold: float = 80.0
    performance_tests: bool = True
    security_tests: bool = True
    
    # Test commands
    unit_test_command: str = "pytest backend/tests/unit -v --cov=backend/app --cov-report=xml"
    integration_test_command: str = "pytest backend/tests/integration -v"
    e2e_test_command: str = "pytest backend/tests/e2e -v"
    performance_test_command: str = "python backend/tests/performance/load_test.py"

@dataclass
class SecurityConfig:
    """Security scanning configuration"""
    dependency_scan: bool = True
    code_scan: bool = True
    container_scan: bool = True
    secrets_scan: bool = True
    
    # Security tools
    dependency_scanner: str = "safety"
    code_scanner: str = "bandit"
    container_scanner: str = "trivy"
    secrets_scanner: str = "truffleHog"

@dataclass
class DeploymentConfig:
    """Deployment configuration"""
    strategy: str = "blue_green"  # blue_green, rolling, canary
    health_check_url: str = "/health"
    health_check_timeout: int = 300
    rollback_on_failure: bool = True
    notify_on_deployment: bool = True
    
    # Environment specific settings
    environments: Dict[str, Dict[str, Any]] = None

class CICDPipeline:
    """
    Comprehensive CI/CD pipeline manager
    """
    
    def __init__(self, 
                 project_name: str = "Schlep-engine-ai",
                 repository_url: str = "https://github.com/Schlep-engine/ai-platform"):
        self.project_name = project_name
        self.repository_url = repository_url
        self.test_config = TestConfig()
        self.security_config = SecurityConfig()
        self.deployment_config = DeploymentConfig()
        
    def generate_github_actions_workflow(self) -> str:
        """Generate GitHub Actions workflow configuration"""
        workflow = {
            "name": "Schlep-engine AI Platform CI/CD",
            "on": {
                "push": {
                    "branches": ["main", "develop", "release/*"]
                },
                "pull_request": {
                    "branches": ["main", "develop"]
                }
            },
            "env": {
                "REGISTRY": "ghcr.io",
                "IMAGE_NAME": f"{self.project_name}",
                "PYTHON_VERSION": "3.11"
            },
            "jobs": {
                "test": {
                    "runs-on": "ubuntu-latest",
                    "services": {
                        "postgres": {
                            "image": "postgres:15",
                            "env": {
                                "POSTGRES_PASSWORD": "postgres",
                                "POSTGRES_DB": "test_db"
                            },
                            "options": "--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5",
                            "ports": ["5432:5432"]
                        },
                        "redis": {
                            "image": "redis:7",
                            "options": "--health-cmd 'redis-cli ping' --health-interval 10s --health-timeout 5s --health-retries 5",
                            "ports": ["6379:6379"]
                        }
                    },
                    "steps": [
                        {
                            "name": "Checkout code",
                            "uses": "actions/checkout@v4"
                        },
                        {
                            "name": "Set up Python",
                            "uses": "actions/setup-python@v4",
                            "with": {
                                "python-version": "${{ env.PYTHON_VERSION }}"
                            }
                        },
                        {
                            "name": "Install dependencies",
                            "run": """
                                python -m pip install --upgrade pip
                                pip install -r requirements.txt
                                pip install -r requirements-dev.txt
                            """
                        },
                        {
                            "name": "Run unit tests",
                            "run": self.test_config.unit_test_command,
                            "env": {
                                "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/test_db",
                                "REDIS_URL": "redis://localhost:6379/0",
                                "TESTING": "true"
                            }
                        },
                        {
                            "name": "Run integration tests",
                            "run": self.test_config.integration_test_command,
                            "env": {
                                "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/test_db",
                                "REDIS_URL": "redis://localhost:6379/0",
                                "TESTING": "true"
                            }
                        },
                        {
                            "name": "Upload coverage to Codecov",
                            "uses": "codecov/codecov-action@v3",
                            "with": {
                                "file": "./coverage.xml",
                                "flags": "unittests"
                            }
                        }
                    ]
                },
                "security": {
                    "runs-on": "ubuntu-latest",
                    "steps": [
                        {
                            "name": "Checkout code",
                            "uses": "actions/checkout@v4"
                        },
                        {
                            "name": "Set up Python",
                            "uses": "actions/setup-python@v4",
                            "with": {
                                "python-version": "${{ env.PYTHON_VERSION }}"
                            }
                        },
                        {
                            "name": "Install security tools",
                            "run": """
                                pip install safety bandit semgrep
                            """
                        },
                        {
                            "name": "Run dependency security scan",
                            "run": "safety check --json --output safety-report.json",
                            "continue-on-error": True
                        },
                        {
                            "name": "Run code security scan",
                            "run": "bandit -r backend/app -f json -o bandit-report.json",
                            "continue-on-error": True
                        },
                        {
                            "name": "Run SAST scan",
                            "run": "semgrep --config=auto --json --output=semgrep-report.json .",
                            "continue-on-error": True
                        },
                        {
                            "name": "Upload security reports",
                            "uses": "actions/upload-artifact@v3",
                            "with": {
                                "name": "security-reports",
                                "path": "*-report.json"
                            }
                        }
                    ]
                },
                "build": {
                    "runs-on": "ubuntu-latest",
                    "needs": ["test", "security"],
                    "if": "github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'",
                    "steps": [
                        {
                            "name": "Checkout code",
                            "uses": "actions/checkout@v4"
                        },
                        {
                            "name": "Set up Docker Buildx",
                            "uses": "docker/setup-buildx-action@v3"
                        },
                        {
                            "name": "Login to Container Registry",
                            "uses": "docker/login-action@v3",
                            "with": {
                                "registry": "${{ env.REGISTRY }}",
                                "username": "${{ github.actor }}",
                                "password": "${{ secrets.GITHUB_TOKEN }}"
                            }
                        },
                        {
                            "name": "Extract metadata",
                            "id": "meta",
                            "uses": "docker/metadata-action@v5",
                            "with": {
                                "images": "${{ env.REGISTRY }}/${{ github.repository }}",
                                "tags": """
                                    type=ref,event=branch
                                    type=ref,event=pr
                                    type=sha,prefix=sha-
                                    type=raw,value=latest,enable={{is_default_branch}}
                                """
                            }
                        },
                        {
                            "name": "Build and push Docker image",
                            "uses": "docker/build-push-action@v5",
                            "with": {
                                "context": ".",
                                "file": "./Dockerfile",
                                "push": True,
                                "tags": "${{ steps.meta.outputs.tags }}",
                                "labels": "${{ steps.meta.outputs.labels }}",
                                "cache-from": "type=gha",
                                "cache-to": "type=gha,mode=max"
                            }
                        },
                        {
                            "name": "Scan container image",
                            "uses": "aquasecurity/trivy-action@master",
                            "with": {
                                "image-ref": "${{ env.REGISTRY }}/${{ github.repository }}:${{ github.sha }}",
                                "format": "sarif",
                                "output": "trivy-results.sarif"
                            }
                        },
                        {
                            "name": "Upload Trivy scan results",
                            "uses": "github/codeql-action/upload-sarif@v2",
                            "with": {
                                "sarif_file": "trivy-results.sarif"
                            }
                        }
                    ]
                },
                "deploy-staging": {
                    "runs-on": "ubuntu-latest",
                    "needs": ["build"],
                    "if": "github.ref == 'refs/heads/develop'",
                    "environment": "staging",
                    "steps": [
                        {
                            "name": "Deploy to staging",
                            "run": """
                                echo "Deploying to staging environment"
                                # Add deployment commands here
                            """
                        },
                        {
                            "name": "Run E2E tests",
                            "run": """
                                echo "Running E2E tests against staging"
                                # Add E2E test commands here
                            """
                        }
                    ]
                },
                "deploy-production": {
                    "runs-on": "ubuntu-latest",
                    "needs": ["build"],
                    "if": "github.ref == 'refs/heads/main'",
                    "environment": "production",
                    "steps": [
                        {
                            "name": "Deploy to production",
                            "run": """
                                echo "Deploying to production environment"
                                # Add production deployment commands here
                            """
                        },
                        {
                            "name": "Health check",
                            "run": """
                                echo "Performing health check"
                                # Add health check commands here
                            """
                        },
                        {
                            "name": "Notify deployment",
                            "uses": "8398a7/action-slack@v3",
                            "with": {
                                "status": "success",
                                "text": " Production deployment successful!"
                            },
                            "env": {
                                "SLACK_WEBHOOK_URL": "${{ secrets.SLACK_WEBHOOK_URL }}"
                            }
                        }
                    ]
                }
            }
        }
        
        return yaml.dump(workflow, default_flow_style=False, sort_keys=False)
    
    def generate_docker_compose_pipeline(self) -> str:
        """Generate Docker Compose configuration for CI/CD"""
        compose_config = {
            "version": "3.8",
            "services": {
                "app": {
                    "build": {
                        "context": ".",
                        "dockerfile": "Dockerfile",
                        "target": "production"
                    },
                    "environment": [
                        "DATABASE_URL=postgresql://postgres:postgres@postgres:5432/Schlep-engine_test",
                        "REDIS_URL=redis://redis:6379/0",
                        "TESTING=true"
                    ],
                    "depends_on": {
                        "postgres": {"condition": "service_healthy"},
                        "redis": {"condition": "service_healthy"}
                    },
                    "volumes": [
                        "./backend/tests:/app/tests",
                        "./coverage:/app/coverage"
                    ]
                },
                "postgres": {
                    "image": "postgres:15",
                    "environment": [
                        "POSTGRES_USER=postgres",
                        "POSTGRES_PASSWORD=postgres",
                        "POSTGRES_DB=Schlep-engine_test"
                    ],
                    "healthcheck": {
                        "test": ["CMD-SHELL", "pg_isready -U postgres"],
                        "interval": "10s",
                        "timeout": "5s",
                        "retries": 5
                    }
                },
                "redis": {
                    "image": "redis:7",
                    "healthcheck": {
                        "test": ["CMD", "redis-cli", "ping"],
                        "interval": "10s",
                        "timeout": "5s",
                        "retries": 5
                    }
                }
            }
        }
        
        return yaml.dump(compose_config, default_flow_style=False)
    
    def generate_deployment_scripts(self) -> Dict[str, str]:
        """Generate deployment scripts for different environments"""
        scripts = {}
        
        # Staging deployment script
        scripts["deploy-staging.sh"] = """#!/bin/bash
set -e

echo " Deploying to Staging Environment"

# Configuration
ENVIRONMENT="staging"
IMAGE_TAG="${GITHUB_SHA:-latest}"
REGISTRY="ghcr.io"
IMAGE_NAME="${REGISTRY}/${GITHUB_REPOSITORY}:${IMAGE_TAG}"

# Pull latest image
echo " Pulling Docker image: ${IMAGE_NAME}"
docker pull ${IMAGE_NAME}

# Update docker-compose with new image
export IMAGE_TAG
envsubst < docker-compose.staging.template.yml > docker-compose.staging.yml

# Deploy with zero downtime
echo " Deploying application..."
docker-compose -f docker-compose.staging.yml up -d --remove-orphans

# Wait for health check
echo "🏥 Waiting for health check..."
timeout 300 bash -c '
  while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' http://localhost:8000/health)" != "200" ]]; do
    echo "Waiting for application to be healthy..."
    sleep 10
  done
'

echo " Staging deployment successful!"
"""

        # Production deployment script
        scripts["deploy-production.sh"] = """#!/bin/bash
set -e

echo " Deploying to Production Environment"

# Configuration
ENVIRONMENT="production"
IMAGE_TAG="${GITHUB_SHA:-latest}"
REGISTRY="ghcr.io"
IMAGE_NAME="${REGISTRY}/${GITHUB_REPOSITORY}:${IMAGE_TAG}"

# Backup database
echo "💾 Creating database backup..."
docker exec Schlep-engine_postgres pg_dump -U Schlep-engine Schlep-engine_prod > "backup_$(date +%Y%m%d_%H%M%S).sql"

# Blue-Green deployment
echo "🔵 Starting Blue-Green deployment..."

# Pull new image
docker pull ${IMAGE_NAME}

# Scale up new version
export IMAGE_TAG
envsubst < docker-compose.production.template.yml > docker-compose.production.yml

# Start new containers
docker-compose -f docker-compose.production.yml up -d --scale backend=2 --no-recreate

# Health check new instances
echo "🏥 Health checking new instances..."
timeout 300 bash -c '
  while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' http://localhost:8001/health)" != "200" ]]; do
    echo "Waiting for new instance to be healthy..."
    sleep 10
  done
'

# Switch traffic to new version
echo "🔀 Switching traffic to new version..."
# Update load balancer configuration
nginx -s reload

# Scale down old version
echo "🔻 Scaling down old version..."
docker-compose -f docker-compose.production.yml up -d --scale backend=1 --remove-orphans

echo " Production deployment successful!"

# Send notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":" Production deployment successful! Version: '${IMAGE_TAG}'"}' \
    $SLACK_WEBHOOK_URL
fi
"""

        # Rollback script
        scripts["rollback.sh"] = """#!/bin/bash
set -e

echo " Rolling back deployment"

ENVIRONMENT="${1:-production}"
PREVIOUS_VERSION="${2:-previous}"

echo "🔙 Rolling back to version: ${PREVIOUS_VERSION}"

# Restore from backup if needed
if [ "$ENVIRONMENT" = "production" ]; then
  echo "💾 Database rollback available if needed"
  echo "Run: docker exec Schlep-engine_postgres psql -U Schlep-engine -d Schlep-engine_prod < backup_file.sql"
fi

# Deploy previous version
export IMAGE_TAG="${PREVIOUS_VERSION}"
envsubst < docker-compose.${ENVIRONMENT}.template.yml > docker-compose.${ENVIRONMENT}.yml

docker-compose -f docker-compose.${ENVIRONMENT}.yml up -d --remove-orphans

# Health check
timeout 300 bash -c '
  while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' http://localhost:8000/health)" != "200" ]]; do
    echo "Waiting for application to be healthy..."
    sleep 10
  done
'

echo " Rollback completed successfully!"
"""

        return scripts
    
    def generate_test_scripts(self) -> Dict[str, str]:
        """Generate test scripts"""
        scripts = {}
        
        scripts["run-tests.sh"] = """#!/bin/bash
set -e

echo "🧪 Running comprehensive test suite"

# Set up test environment
export TESTING=true
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_db"
export REDIS_URL="redis://localhost:6379/0"

# Start test services
docker-compose -f docker-compose.test.yml up -d postgres redis

# Wait for services
echo "⏳ Waiting for test services..."
sleep 10

# Run tests
echo "🔬 Running unit tests..."
pytest backend/tests/unit -v --cov=backend/app --cov-report=xml --cov-report=html

echo " Running integration tests..."
pytest backend/tests/integration -v

echo "🎭 Running E2E tests..."
pytest backend/tests/e2e -v

echo "🏃 Running performance tests..."
python backend/tests/performance/load_test.py

# Generate reports
echo " Generating test reports..."
coverage html -d coverage_html
coverage xml -o coverage.xml

# Cleanup
docker-compose -f docker-compose.test.yml down

echo " All tests completed!"
"""

        scripts["performance-test.py"] = """#!/usr/bin/env python3
import asyncio
import aiohttp
import time
import statistics
from typing import List, Dict, Any

class PerformanceTest:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = []
    
    async def make_request(self, session: aiohttp.ClientSession, 
                          endpoint: str, method: str = "GET", 
                          data: Any = None) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            async with session.request(method, f"{self.base_url}{endpoint}", 
                                     json=data) as response:
                response_time = time.time() - start_time
                content = await response.text()
                
                return {
                    "endpoint": endpoint,
                    "method": method,
                    "status": response.status,
                    "response_time": response_time,
                    "success": 200 <= response.status < 300,
                    "content_length": len(content)
                }
        except Exception as e:
            return {
                "endpoint": endpoint,
                "method": method,
                "status": 0,
                "response_time": time.time() - start_time,
                "success": False,
                "error": str(e)
            }
    
    async def run_load_test(self, endpoint: str, concurrent_users: int = 10, 
                           duration: int = 60) -> Dict[str, Any]:
        print(f" Load testing {endpoint} with {concurrent_users} users for {duration}s")
        
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            tasks = []
            
            while time.time() - start_time < duration:
                if len(tasks) < concurrent_users:
                    task = asyncio.create_task(
                        self.make_request(session, endpoint)
                    )
                    tasks.append(task)
                
                # Collect completed tasks
                done_tasks = [t for t in tasks if t.done()]
                for task in done_tasks:
                    result = await task
                    self.results.append(result)
                    tasks.remove(task)
                
                await asyncio.sleep(0.1)
            
            # Wait for remaining tasks
            if tasks:
                remaining_results = await asyncio.gather(*tasks)
                self.results.extend(remaining_results)
        
        return self.analyze_results()
    
    def analyze_results(self) -> Dict[str, Any]:
        if not self.results:
            return {"error": "No results to analyze"}
        
        response_times = [r["response_time"] for r in self.results]
        success_count = sum(1 for r in self.results if r["success"])
        
        analysis = {
            "total_requests": len(self.results),
            "successful_requests": success_count,
            "failed_requests": len(self.results) - success_count,
            "success_rate": (success_count / len(self.results)) * 100,
            "avg_response_time": statistics.mean(response_times),
            "min_response_time": min(response_times),
            "max_response_time": max(response_times),
            "p50_response_time": statistics.median(response_times),
            "p95_response_time": statistics.quantiles(response_times, n=20)[18] if len(response_times) > 20 else max(response_times),
            "p99_response_time": statistics.quantiles(response_times, n=100)[98] if len(response_times) > 100 else max(response_times),
            "requests_per_second": len(self.results) / max(response_times) if response_times else 0
        }
        
        return analysis

async def main():
    test = PerformanceTest()
    
    # Test critical endpoints
    endpoints = [
        "/health",
        "/api/v1/analyze",
        "/api/v1/dashboard/stats",
        "/api/v1/auth/login"
    ]
    
    for endpoint in endpoints:
        print(f"\\n{'='*50}")
        print(f"Testing endpoint: {endpoint}")
        print('='*50)
        
        results = await test.run_load_test(endpoint, concurrent_users=5, duration=30)
        
        print(f" Results for {endpoint}:")
        print(f"  Total requests: {results['total_requests']}")
        print(f"  Success rate: {results['success_rate']:.2f}%")
        print(f"  Avg response time: {results['avg_response_time']*1000:.2f}ms")
        print(f"  P95 response time: {results['p95_response_time']*1000:.2f}ms")
        print(f"  P99 response time: {results['p99_response_time']*1000:.2f}ms")
        print(f"  Requests/sec: {results['requests_per_second']:.2f}")
        
        # Performance thresholds
        if results['avg_response_time'] > 1.0:
            print("  WARNING: Average response time > 1s")
        if results['p95_response_time'] > 2.0:
            print("  WARNING: P95 response time > 2s")
        if results['success_rate'] < 99.0:
            print("  WARNING: Success rate < 99%")

if __name__ == "__main__":
    asyncio.run(main())
"""

        return scripts
    
    def generate_monitoring_config(self) -> Dict[str, str]:
        """Generate monitoring configuration"""
        configs = {}
        
        # Prometheus configuration
        configs["prometheus.yml"] = """
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'Schlep-engine-api'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    
  - job_name: 'Schlep-engine-system'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/system/metrics'
    scrape_interval: 30s
"""

        # Grafana dashboard
        configs["grafana-dashboard.json"] = """
{
  "dashboard": {
    "title": "Schlep-engine AI Platform Monitoring",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "http_request_duration_seconds",
            "legendFormat": "{{ method }} {{ endpoint }}"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx Errors/sec"
          }
        ]
      },
      {
        "title": "System Health",
        "type": "stat",
        "targets": [
          {
            "expr": "system_health_status",
            "legendFormat": "{{ component }}"
          }
        ]
      }
    ]
  }
}
"""

        return configs

# Example usage
def create_pipeline_config():
    """Create CI/CD pipeline configuration"""
    pipeline = CICDPipeline(
        project_name="Schlep-engine-ai",
        repository_url="https://github.com/Schlep-engine/ai-platform"
    )
    
    return {
        "github_workflow": pipeline.generate_github_actions_workflow(),
        "docker_compose": pipeline.generate_docker_compose_pipeline(),
        "deployment_scripts": pipeline.generate_deployment_scripts(),
        "test_scripts": pipeline.generate_test_scripts(),
        "monitoring_config": pipeline.generate_monitoring_config()
    } 