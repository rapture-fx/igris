"""
Advanced DevOps Integration Tests for Igris-engine CLI

This module contains comprehensive tests for DevOps workflows, CI/CD integration,
container orchestration, infrastructure automation, and monitoring scenarios.
"""

import pytest
import tempfile
import os
import yaml
import json
import subprocess
import time
import threading
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, call
from click.testing import CliRunner
from contextlib import contextmanager

from igris_cli.main import cli
from igris_cli.core.config import Config
from igris_cli.core.client import APIClient
from igris_cli.commands.cicd import cicd
from igris_cli.commands.devops import devops
from igris_cli.commands.monitoring import monitoring


class TestAdvancedDevOpsIntegration:
    """Advanced DevOps integration scenarios."""

    @pytest.fixture
    def runner(self):
        """Click CLI test runner."""
        return CliRunner()

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace with DevOps configurations."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            
            # Create DevOps configuration files
            configs = {
                'docker-compose.yml': {
                    'version': '3.8',
                    'services': {
                        'igris-api': {
                            'image': 'igris-inertial:latest',
                            'ports': ['8000:8000'],
                            'environment': {
                                'IGRIS_API_KEY': '${IGRIS_API_KEY}',
                                'ENVIRONMENT': 'production'
                            }
                        },
                        'redis': {
                            'image': 'redis:7-alpine',
                            'ports': ['6379:6379']
                        },
                        'postgres': {
                            'image': 'postgres:15',
                            'environment': {
                                'POSTGRES_DB': 'igris_db',
                                'POSTGRES_USER': 'igris_user',
                                'POSTGRES_PASSWORD': '${DB_PASSWORD}'
                            }
                        }
                    }
                },
                'kubernetes/deployment.yaml': {
                    'apiVersion': 'apps/v1',
                    'kind': 'Deployment',
                    'metadata': {'name': 'igris-inertial'},
                    'spec': {
                        'replicas': 3,
                        'selector': {
                            'matchLabels': {'app': 'igris-inertial'}
                        },
                        'template': {
                            'metadata': {
                                'labels': {'app': 'igris-inertial'}
                            },
                            'spec': {
                                'containers': [{
                                    'name': 'igris-api',
                                    'image': 'igris-inertial:v1.0.0',
                                    'ports': [{'containerPort': 8000}],
                                    'env': [
                                        {'name': 'IGRIS_API_KEY', 'valueFrom': {'secretKeyRef': {'name': 'igris-secrets', 'key': 'api-key'}}}
                                    ]
                                }]
                            }
                        }
                    }
                },
                '.github/workflows/ci-cd.yml': {
                    'name': 'CI/CD Pipeline',
                    'on': ['push', 'pull_request'],
                    'jobs': {
                        'test': {
                            'runs-on': 'ubuntu-latest',
                            'steps': [
                                {'uses': 'actions/checkout@v3'},
                                {'name': 'Setup Python', 'uses': 'actions/setup-python@v4', 'with': {'python-version': '3.11'}},
                                {'name': 'Install CLI', 'run': 'pip install igris-inertial-cli'},
                                {'name': 'Run Tests', 'run': 'igris validate --config config.yml'}
                            ]
                        },
                        'deploy': {
                            'needs': 'test',
                            'runs-on': 'ubuntu-latest',
                            'if': "github.ref == 'refs/heads/main'",
                            'steps': [
                                {'name': 'Deploy', 'run': 'igris deploy --environment production'}
                            ]
                        }
                    }
                },
                'terraform/main.tf': """
                    provider "aws" {
                      region = var.aws_region
                    }
                    
                    resource "aws_ecs_cluster" "igris_cluster" {
                      name = "igris-inertial-cluster"
                    }
                    
                    resource "aws_ecs_service" "igris_service" {
                      name            = "igris-inertial-service"
                      cluster         = aws_ecs_cluster.igris_cluster.id
                      task_definition = aws_ecs_task_definition.igris_task.arn
                      desired_count   = 3
                    }
                """,
                'monitoring/prometheus.yml': {
                    'global': {'scrape_interval': '15s'},
                    'scrape_configs': [{
                        'job_name': 'igris-inertial',
                        'static_configs': [{
                            'targets': ['localhost:8000']
                        }],
                        'metrics_path': '/metrics',
                        'scrape_interval': '5s'
                    }]
                },
                'config.yml': {
                    'api_key': 'test-key',
                    'base_url': 'https://api.igris-inertial.com',
                    'environments': {
                        'development': {
                            'base_url': 'https://dev-api.igris-inertial.com',
                            'debug': True
                        },
                        'staging': {
                            'base_url': 'https://staging-api.igris-inertial.com',
                            'parallel_jobs': 2
                        },
                        'production': {
                            'base_url': 'https://api.igris-inertial.com',
                            'parallel_jobs': 8,
                            'timeout': 30
                        }
                    }
                }
            }
            
            # Write configuration files
            for file_path, content in configs.items():
                full_path = workspace / file_path
                full_path.parent.mkdir(parents=True, exist_ok=True)
                
                if isinstance(content, dict):
                    if file_path.endswith('.yml') or file_path.endswith('.yaml'):
                        with open(full_path, 'w') as f:
                            yaml.dump(content, f, default_flow_style=False)
                    else:
                        with open(full_path, 'w') as f:
                            json.dump(content, f, indent=2)
                else:
                    with open(full_path, 'w') as f:
                        f.write(content)
            
            yield workspace

    @pytest.fixture
    def mock_docker(self):
        """Mock Docker client."""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout="Docker operation completed successfully",
                stderr=""
            )
            yield mock_run

    @pytest.fixture
    def mock_kubernetes(self):
        """Mock Kubernetes client."""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout="deployment.apps/igris-inertial created",
                stderr=""
            )
            yield mock_run

    def test_docker_compose_integration(self, runner, temp_workspace, mock_docker):
        """Test Docker Compose integration and orchestration."""
        os.chdir(temp_workspace)
        
        # Test Docker Compose validation
        result = runner.invoke(cli, ['devops', 'validate-compose', 'docker-compose.yml'])
        
        assert result.exit_code == 0
        assert "Docker Compose configuration is valid" in result.output
        
        # Test Docker Compose deployment
        with patch.dict(os.environ, {'IGRIS_API_KEY': 'test-key', 'DB_PASSWORD': 'test-password'}):
            result = runner.invoke(cli, ['devops', 'deploy-compose', 'docker-compose.yml', '--env', 'production'])
            
            assert result.exit_code == 0
            assert "Deployment started" in result.output
            
            # Verify Docker commands were called
            expected_calls = [
                call(['docker-compose', 'config'], capture_output=True, text=True, check=True),
                call(['docker-compose', 'up', '-d', '--remove-orphans'], capture_output=True, text=True, check=True)
            ]
            mock_docker.assert_has_calls(expected_calls, any_order=True)

    def test_kubernetes_deployment_integration(self, runner, temp_workspace, mock_kubernetes):
        """Test Kubernetes deployment and management."""
        os.chdir(temp_workspace)
        
        # Test Kubernetes manifest validation
        result = runner.invoke(cli, ['devops', 'validate-k8s', 'kubernetes/'])
        
        assert result.exit_code == 0
        assert "Kubernetes manifests are valid" in result.output
        
        # Test Kubernetes deployment
        result = runner.invoke(cli, ['devops', 'deploy-k8s', 'kubernetes/', '--namespace', 'production'])
        
        assert result.exit_code == 0
        assert "Kubernetes deployment initiated" in result.output
        
        # Verify kubectl commands were called
        expected_calls = [
            call(['kubectl', 'apply', '--dry-run=client', '-f', 'kubernetes/'], capture_output=True, text=True),
            call(['kubectl', 'apply', '-f', 'kubernetes/', '--namespace=production'], capture_output=True, text=True, check=True)
        ]
        mock_kubernetes.assert_has_calls(expected_calls, any_order=True)

    def test_ci_cd_pipeline_integration(self, runner, temp_workspace):
        """Test CI/CD pipeline integration and automation."""
        os.chdir(temp_workspace)
        
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            mock_client_instance.create_pipeline.return_value = {
                'pipeline_id': 'pipeline-123',
                'status': 'created',
                'webhook_url': 'https://api.igris-inertial.com/webhooks/pipeline-123'
            }
            
            # Test CI/CD pipeline setup
            result = runner.invoke(cli, [
                'cicd', 'setup',
                '--provider', 'github',
                '--repo', 'my-org/my-repo',
                '--branch', 'main',
                '--config', 'config.yml'
            ])
            
            assert result.exit_code == 0
            assert "CI/CD pipeline configured" in result.output
            assert "pipeline-123" in result.output
            
            # Verify API calls
            mock_client_instance.create_pipeline.assert_called_once()
            call_args = mock_client_instance.create_pipeline.call_args[1]
            assert call_args['provider'] == 'github'
            assert call_args['repository'] == 'my-org/my-repo'
            assert call_args['branch'] == 'main'

    def test_infrastructure_as_code_integration(self, runner, temp_workspace):
        """Test Infrastructure as Code (IaC) integration with Terraform."""
        os.chdir(temp_workspace)
        
        with patch('subprocess.run') as mock_subprocess:
            mock_subprocess.return_value = MagicMock(
                returncode=0,
                stdout="Plan: 3 to add, 0 to change, 0 to destroy.",
                stderr=""
            )
            
            # Test Terraform plan
            result = runner.invoke(cli, [
                'devops', 'terraform-plan',
                '--directory', 'terraform/',
                '--var', 'aws_region=us-west-2'
            ])
            
            assert result.exit_code == 0
            assert "Terraform plan completed" in result.output
            
            # Test Terraform apply
            result = runner.invoke(cli, [
                'devops', 'terraform-apply',
                '--directory', 'terraform/',
                '--auto-approve'
            ])
            
            assert result.exit_code == 0
            assert "Infrastructure deployment completed" in result.output
            
            # Verify Terraform commands
            expected_calls = [
                call(['terraform', 'init'], cwd='terraform/', capture_output=True, text=True, check=True),
                call(['terraform', 'plan', '-var=aws_region=us-west-2'], cwd='terraform/', capture_output=True, text=True, check=True),
                call(['terraform', 'apply', '-auto-approve'], cwd='terraform/', capture_output=True, text=True, check=True)
            ]
            mock_subprocess.assert_has_calls(expected_calls, any_order=True)

    def test_monitoring_and_observability_setup(self, runner, temp_workspace):
        """Test monitoring and observability configuration."""
        os.chdir(temp_workspace)
        
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            mock_client_instance.setup_monitoring.return_value = {
                'monitoring_id': 'monitor-456',
                'dashboard_url': 'https://dashboard.igris-inertial.com/monitor-456',
                'status': 'configured'
            }
            
            # Test monitoring setup
            result = runner.invoke(cli, [
                'monitoring', 'setup',
                '--prometheus-config', 'monitoring/prometheus.yml',
                '--grafana-dashboard',
                '--alerts-email', 'admin@example.com'
            ])
            
            assert result.exit_code == 0
            assert "Monitoring configured" in result.output
            assert "dashboard.igris-inertial.com" in result.output
            
            # Test metrics collection
            mock_client_instance.get_metrics.return_value = {
                'cpu_usage': 65.2,
                'memory_usage': 78.4,
                'request_rate': 1250.5,
                'error_rate': 0.02
            }
            
            result = runner.invoke(cli, ['monitoring', 'status', '--detailed'])
            
            assert result.exit_code == 0
            assert "CPU Usage: 65.2%" in result.output
            assert "Memory Usage: 78.4%" in result.output
            assert "Request Rate: 1250.5/min" in result.output

    def test_environment_specific_deployments(self, runner, temp_workspace):
        """Test environment-specific configuration and deployment."""
        os.chdir(temp_workspace)
        
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Test development environment
            mock_client_instance.deploy.return_value = {
                'deployment_id': 'dev-deploy-123',
                'environment': 'development',
                'status': 'deployed'
            }
            
            result = runner.invoke(cli, [
                'deploy',
                '--environment', 'development',
                '--config', 'config.yml'
            ])
            
            assert result.exit_code == 0
            assert "development environment" in result.output.lower()
            
            # Test production environment with additional validations
            mock_client_instance.deploy.return_value = {
                'deployment_id': 'prod-deploy-456',
                'environment': 'production',
                'status': 'deployed',
                'health_check_url': 'https://api.igris-inertial.com/health'
            }
            
            result = runner.invoke(cli, [
                'deploy',
                '--environment', 'production',
                '--config', 'config.yml',
                '--health-check',
                '--rollback-on-failure'
            ])
            
            assert result.exit_code == 0
            assert "production environment" in result.output.lower()
            assert "Health check passed" in result.output

    def test_secrets_management_integration(self, runner, temp_workspace):
        """Test secrets management and secure configuration."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Test secrets creation
            mock_client_instance.create_secret.return_value = {
                'secret_id': 'secret-789',
                'name': 'api-key',
                'created_at': '2024-01-15T10:30:00Z'
            }
            
            result = runner.invoke(cli, [
                'devops', 'create-secret',
                '--name', 'api-key',
                '--value', 'secret-api-key-value',
                '--environment', 'production'
            ])
            
            assert result.exit_code == 0
            assert "Secret created: secret-789" in result.output
            
            # Test secrets listing
            mock_client_instance.list_secrets.return_value = {
                'secrets': [
                    {'id': 'secret-789', 'name': 'api-key', 'environment': 'production'},
                    {'id': 'secret-790', 'name': 'db-password', 'environment': 'production'}
                ]
            }
            
            result = runner.invoke(cli, ['devops', 'list-secrets', '--environment', 'production'])
            
            assert result.exit_code == 0
            assert "api-key" in result.output
            assert "db-password" in result.output

    def test_backup_and_disaster_recovery(self, runner, temp_workspace):
        """Test backup and disaster recovery procedures."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Test backup creation
            mock_client_instance.create_backup.return_value = {
                'backup_id': 'backup-101',
                'size': '2.3GB',
                'created_at': '2024-01-15T15:30:00Z',
                'status': 'completed'
            }
            
            result = runner.invoke(cli, [
                'devops', 'backup',
                '--include-database',
                '--include-files',
                '--compress',
                '--retention-days', '30'
            ])
            
            assert result.exit_code == 0
            assert "Backup created: backup-101" in result.output
            assert "Size: 2.3GB" in result.output
            
            # Test disaster recovery simulation
            mock_client_instance.restore_backup.return_value = {
                'restore_id': 'restore-201',
                'backup_id': 'backup-101',
                'status': 'in_progress',
                'estimated_duration': '15 minutes'
            }
            
            result = runner.invoke(cli, [
                'devops', 'restore',
                '--backup-id', 'backup-101',
                '--target-environment', 'staging',
                '--dry-run'
            ])
            
            assert result.exit_code == 0
            assert "Restore simulation: restore-201" in result.output
            assert "15 minutes" in result.output

    def test_load_testing_integration(self, runner, temp_workspace):
        """Test load testing and performance validation."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Test load test configuration
            mock_client_instance.create_load_test.return_value = {
                'test_id': 'load-test-301',
                'status': 'running',
                'target_url': 'https://api.igris-inertial.com',
                'concurrent_users': 100,
                'duration': '5m'
            }
            
            result = runner.invoke(cli, [
                'devops', 'load-test',
                '--url', 'https://api.igris-inertial.com',
                '--users', '100',
                '--duration', '5m',
                '--ramp-up', '30s'
            ])
            
            assert result.exit_code == 0
            assert "Load test started: load-test-301" in result.output
            assert "100 concurrent users" in result.output
            
            # Test load test results
            mock_client_instance.get_load_test_results.return_value = {
                'test_id': 'load-test-301',
                'status': 'completed',
                'results': {
                    'avg_response_time': 245,
                    'max_response_time': 1850,
                    'requests_per_second': 387.5,
                    'error_rate': 0.03,
                    'total_requests': 116250
                }
            }
            
            result = runner.invoke(cli, ['devops', 'load-test-results', '--test-id', 'load-test-301'])
            
            assert result.exit_code == 0
            assert "Average Response Time: 245ms" in result.output
            assert "Requests/Second: 387.5" in result.output
            assert "Error Rate: 0.03%" in result.output

    def test_multi_region_deployment(self, runner, temp_workspace):
        """Test multi-region deployment and failover."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Test multi-region deployment
            mock_client_instance.deploy_multi_region.return_value = {
                'deployment_id': 'multi-region-401',
                'regions': {
                    'us-west-2': {'status': 'deployed', 'health': 'healthy'},
                    'us-east-1': {'status': 'deployed', 'health': 'healthy'},
                    'eu-west-1': {'status': 'deployed', 'health': 'healthy'}
                },
                'load_balancer': {
                    'url': 'https://global.igris-inertial.com',
                    'status': 'active'
                }
            }
            
            result = runner.invoke(cli, [
                'devops', 'deploy-multi-region',
                '--regions', 'us-west-2,us-east-1,eu-west-1',
                '--load-balancer',
                '--health-checks',
                '--failover-enabled'
            ])
            
            assert result.exit_code == 0
            assert "Multi-region deployment: multi-region-401" in result.output
            assert "us-west-2: healthy" in result.output
            assert "us-east-1: healthy" in result.output
            assert "eu-west-1: healthy" in result.output
            
            # Test failover simulation
            mock_client_instance.simulate_failover.return_value = {
                'simulation_id': 'failover-sim-501',
                'failed_region': 'us-west-2',
                'active_regions': ['us-east-1', 'eu-west-1'],
                'failover_time': '2.3s',
                'status': 'success'
            }
            
            result = runner.invoke(cli, [
                'devops', 'simulate-failover',
                '--region', 'us-west-2',
                '--deployment-id', 'multi-region-401'
            ])
            
            assert result.exit_code == 0
            assert "Failover simulation: failover-sim-501" in result.output
            assert "Failover time: 2.3s" in result.output
            assert "Active regions: us-east-1, eu-west-1" in result.output

    def test_automated_scaling_configuration(self, runner, temp_workspace):
        """Test automated scaling and resource management."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Test auto-scaling setup
            mock_client_instance.configure_autoscaling.return_value = {
                'autoscaling_id': 'autoscale-601',
                'policy': {
                    'min_instances': 2,
                    'max_instances': 20,
                    'target_cpu': 70,
                    'scale_up_cooldown': '300s',
                    'scale_down_cooldown': '600s'
                },
                'status': 'active'
            }
            
            result = runner.invoke(cli, [
                'devops', 'configure-autoscaling',
                '--min-instances', '2',
                '--max-instances', '20',
                '--cpu-threshold', '70',
                '--memory-threshold', '80',
                '--scale-up-cooldown', '5m',
                '--scale-down-cooldown', '10m'
            ])
            
            assert result.exit_code == 0
            assert "Auto-scaling configured: autoscale-601" in result.output
            assert "Min instances: 2" in result.output
            assert "Max instances: 20" in result.output
            
            # Test scaling event simulation
            mock_client_instance.get_scaling_events.return_value = {
                'events': [
                    {
                        'timestamp': '2024-01-15T16:00:00Z',
                        'action': 'scale_up',
                        'from_instances': 3,
                        'to_instances': 6,
                        'trigger': 'cpu_threshold_exceeded',
                        'cpu_usage': 85.2
                    },
                    {
                        'timestamp': '2024-01-15T16:15:00Z',
                        'action': 'scale_down',
                        'from_instances': 6,
                        'to_instances': 4,
                        'trigger': 'cpu_threshold_normal',
                        'cpu_usage': 45.1
                    }
                ]
            }
            
            result = runner.invoke(cli, ['devops', 'scaling-history', '--hours', '24'])
            
            assert result.exit_code == 0
            assert "scale_up: 3 → 6 instances" in result.output
            assert "scale_down: 6 → 4 instances" in result.output
            assert "CPU: 85.2%" in result.output


class TestContinuousIntegrationScenarios:
    """Test continuous integration specific scenarios."""
    
    @pytest.fixture
    def github_webhook_payload(self):
        """Mock GitHub webhook payload."""
        return {
            'ref': 'refs/heads/main',
            'before': 'abc123',
            'after': 'def456',
            'repository': {
                'name': 'my-repo',
                'full_name': 'my-org/my-repo',
                'clone_url': 'https://github.com/my-org/my-repo.git'
            },
            'commits': [{
                'id': 'def456',
                'message': 'Add new data processing pipeline',
                'author': {'name': 'Developer', 'email': 'dev@example.com'}
            }]
        }
    
    def test_webhook_triggered_pipeline(self, runner, github_webhook_payload):
        """Test webhook-triggered CI/CD pipeline."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Mock pipeline creation from webhook
            mock_client_instance.trigger_pipeline.return_value = {
                'pipeline_run_id': 'run-701',
                'commit_sha': 'def456',
                'branch': 'main',
                'status': 'queued',
                'stages': ['test', 'build', 'deploy']
            }
            
            # Simulate webhook processing
            result = runner.invoke(cli, [
                'cicd', 'process-webhook',
                '--payload', json.dumps(github_webhook_payload),
                '--provider', 'github'
            ])
            
            assert result.exit_code == 0
            assert "Pipeline triggered: run-701" in result.output
            assert "Commit: def456" in result.output
            assert "Branch: main" in result.output
    
    def test_parallel_pipeline_execution(self, runner):
        """Test parallel pipeline stage execution."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Mock parallel pipeline stages
            mock_client_instance.get_pipeline_status.return_value = {
                'pipeline_run_id': 'run-702',
                'status': 'running',
                'stages': {
                    'test': {
                        'status': 'completed',
                        'duration': '2m 30s',
                        'parallel_jobs': {
                            'unit_tests': {'status': 'completed', 'duration': '45s'},
                            'integration_tests': {'status': 'completed', 'duration': '1m 20s'},
                            'lint_checks': {'status': 'completed', 'duration': '15s'}
                        }
                    },
                    'build': {
                        'status': 'running',
                        'duration': '1m 15s',
                        'parallel_jobs': {
                            'docker_build': {'status': 'running', 'progress': '75%'},
                            'asset_compilation': {'status': 'completed', 'duration': '30s'}
                        }
                    },
                    'deploy': {
                        'status': 'pending',
                        'waiting_for': ['build']
                    }
                }
            }
            
            result = runner.invoke(cli, ['cicd', 'status', '--run-id', 'run-702', '--detailed'])
            
            assert result.exit_code == 0
            assert "Pipeline: run-702" in result.output
            assert "test: completed (2m 30s)" in result.output
            assert "build: running (1m 15s)" in result.output
            assert "unit_tests: completed (45s)" in result.output
            assert "docker_build: running (75%)" in result.output
    
    def test_pipeline_failure_and_rollback(self, runner):
        """Test pipeline failure handling and automatic rollback."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Mock failed pipeline
            mock_client_instance.get_pipeline_status.return_value = {
                'pipeline_run_id': 'run-703',
                'status': 'failed',
                'failed_stage': 'deploy',
                'error_message': 'Deployment health check failed',
                'stages': {
                    'test': {'status': 'completed', 'duration': '2m'},
                    'build': {'status': 'completed', 'duration': '3m'},
                    'deploy': {
                        'status': 'failed',
                        'error': 'Health check timeout after 5 minutes',
                        'rollback_initiated': True
                    }
                }
            }
            
            # Mock rollback execution
            mock_client_instance.initiate_rollback.return_value = {
                'rollback_id': 'rollback-801',
                'target_version': 'v1.2.3',
                'status': 'in_progress',
                'estimated_duration': '3m'
            }
            
            result = runner.invoke(cli, [
                'cicd', 'rollback',
                '--run-id', 'run-703',
                '--auto-confirm'
            ])
            
            assert result.exit_code == 0
            assert "Rollback initiated: rollback-801" in result.output
            assert "Target version: v1.2.3" in result.output
            assert "Estimated duration: 3m" in result.output


class TestEnvironmentManagement:
    """Test environment management and configuration."""
    
    def test_environment_provisioning(self, runner):
        """Test automated environment provisioning."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Mock environment creation
            mock_client_instance.create_environment.return_value = {
                'environment_id': 'env-901',
                'name': 'feature-branch-123',
                'type': 'ephemeral',
                'resources': {
                    'instances': 2,
                    'cpu': '2 vCPU',
                    'memory': '4 GB',
                    'storage': '20 GB'
                },
                'endpoints': {
                    'api': 'https://feature-123.staging.igris-inertial.com',
                    'admin': 'https://admin-feature-123.staging.igris-inertial.com'
                },
                'status': 'provisioning'
            }
            
            result = runner.invoke(cli, [
                'devops', 'create-environment',
                '--name', 'feature-branch-123',
                '--type', 'ephemeral',
                '--template', 'staging',
                '--auto-destroy', '24h'
            ])
            
            assert result.exit_code == 0
            assert "Environment created: env-901" in result.output
            assert "feature-branch-123" in result.output
            assert "https://feature-123.staging.igris-inertial.com" in result.output
    
    def test_environment_cleanup_and_cost_optimization(self, runner):
        """Test automatic environment cleanup and cost optimization."""
        with patch('igris_cli.core.client.APIClient') as mock_client:
            mock_client_instance = Mock()
            mock_client.return_value = mock_client_instance
            
            # Mock cost analysis
            mock_client_instance.analyze_environment_costs.return_value = {
                'environments': [
                    {
                        'id': 'env-901',
                        'name': 'feature-branch-123',
                        'age': '25h',
                        'last_activity': '23h ago',
                        'cost_per_hour': 2.50,
                        'total_cost': 62.50,
                        'recommendation': 'destroy'
                    },
                    {
                        'id': 'env-902',
                        'name': 'feature-branch-456',
                        'age': '4h',
                        'last_activity': '30m ago',
                        'cost_per_hour': 2.50,
                        'total_cost': 10.00,
                        'recommendation': 'keep'
                    }
                ],
                'total_monthly_cost': 1840.00,
                'potential_savings': 460.00
            }
            
            result = runner.invoke(cli, ['devops', 'analyze-costs', '--optimize'])
            
            assert result.exit_code == 0
            assert "feature-branch-123: $62.50 (destroy)" in result.output
            assert "feature-branch-456: $10.00 (keep)" in result.output
            assert "Potential savings: $460.00" in result.output
            
            # Mock environment cleanup
            mock_client_instance.cleanup_environments.return_value = {
                'cleaned_up': ['env-901'],
                'kept': ['env-902'],
                'cost_saved': 460.00
            }
            
            result = runner.invoke(cli, [
                'devops', 'cleanup-environments',
                '--older-than', '24h',
                '--inactive-for', '12h',
                '--confirm'
            ])
            
            assert result.exit_code == 0
            assert "Cleaned up: env-901" in result.output
            assert "Cost saved: $460.00" in result.output
