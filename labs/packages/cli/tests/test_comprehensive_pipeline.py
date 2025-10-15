"""
Comprehensive pipeline tests for Schlep-engine CLI tool

This test suite covers complete pipeline workflows, batch processing,
CI/CD integration, and complex command combinations.
"""

import pytest
import json
import yaml
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, mock_open, MagicMock, call
from click.testing import CliRunner
from datetime import datetime, timedelta

from schlep_cli.main import cli
from schlep_cli.commands.pipeline import pipeline
from schlep_cli.commands.batch import batch
from schlep_cli.commands.cicd import cicd
from schlep_cli.core.config import Config
from schlep_cli.core.client import APIClient


class TestPipelineCommands:
    """Test comprehensive pipeline command functionality."""

    @pytest.fixture
    def runner(self):
        """CLI test runner."""
        return CliRunner()

    @pytest.fixture
    def mock_config(self):
        """Mock configuration."""
        config = MagicMock(spec=Config)
        config.api_key = "test-api-key"
        config.base_url = "https://api.test.com"
        config.timeout = 30
        config.max_retries = 3
        return config

    @pytest.fixture
    def mock_client(self):
        """Mock API client."""
        client = MagicMock(spec=APIClient)
        return client

    @pytest.fixture
    def sample_pipeline_config(self):
        """Sample pipeline configuration."""
        return {
            "name": "test-pipeline",
            "version": "1.0.0",
            "description": "Test data processing pipeline",
            "stages": [
                {
                    "name": "upload",
                    "type": "file_upload",
                    "config": {
                        "files": ["data/input.csv"],
                        "validation": True
                    }
                },
                {
                    "name": "process",
                    "type": "data_processing",
                    "depends_on": ["upload"],
                    "config": {
                        "format": "csv",
                        "delimiter": ",",
                        "headers": True,
                        "validation_rules": ["required_fields", "data_types"]
                    }
                },
                {
                    "name": "ml_training",
                    "type": "ml_pipeline",
                    "depends_on": ["process"],
                    "config": {
                        "algorithm": "random_forest",
                        "target_column": "target",
                        "hyperparameters": {
                            "n_estimators": 100,
                            "max_depth": 10
                        }
                    }
                },
                {
                    "name": "export",
                    "type": "export",
                    "depends_on": ["ml_training"],
                    "config": {
                        "format": "json",
                        "destination": "output/"
                    }
                }
            ],
            "notifications": {
                "on_success": {
                    "webhook": "https://webhook.example.com/success"
                },
                "on_failure": {
                    "webhook": "https://webhook.example.com/failure"
                }
            },
            "retry_policy": {
                "max_attempts": 3,
                "backoff": "exponential"
            }
        }

    def test_pipeline_create_from_config(self, runner, mock_client, sample_pipeline_config):
        """Test creating pipeline from configuration file."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            # Mock successful pipeline creation
            mock_client.create_pipeline.return_value = {
                "pipeline_id": "pipeline_123",
                "status": "created",
                "stages": 4
            }
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(sample_pipeline_config, f)
                config_file = f.name

            try:
                result = runner.invoke(pipeline, ['create', '--config', config_file])
                
                assert result.exit_code == 0
                assert "Pipeline created successfully" in result.output
                assert "pipeline_123" in result.output
                mock_client.create_pipeline.assert_called_once()
            finally:
                os.unlink(config_file)

    def test_pipeline_run_with_monitoring(self, runner, mock_client, sample_pipeline_config):
        """Test running pipeline with real-time monitoring."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            # Mock pipeline execution states
            execution_states = [
                {"execution_id": "exec_123", "status": "running", "current_stage": "upload", "progress": 25},
                {"execution_id": "exec_123", "status": "running", "current_stage": "process", "progress": 50},
                {"execution_id": "exec_123", "status": "running", "current_stage": "ml_training", "progress": 75},
                {"execution_id": "exec_123", "status": "completed", "current_stage": "export", "progress": 100}
            ]
            
            mock_client.run_pipeline.return_value = {"execution_id": "exec_123"}
            mock_client.get_pipeline_execution.side_effect = execution_states
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(sample_pipeline_config, f)
                config_file = f.name

            try:
                result = runner.invoke(pipeline, ['run', '--config', config_file, '--watch'])
                
                assert result.exit_code == 0
                assert "Pipeline execution started" in result.output
                assert "exec_123" in result.output
                assert "completed" in result.output
                assert mock_client.get_pipeline_execution.call_count == 4
            finally:
                os.unlink(config_file)

    def test_pipeline_validate_config(self, runner, sample_pipeline_config):
        """Test pipeline configuration validation."""
        # Test valid configuration
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(sample_pipeline_config, f)
            valid_config_file = f.name

        try:
            result = runner.invoke(pipeline, ['validate', '--config', valid_config_file])
            assert result.exit_code == 0
            assert "Pipeline configuration is valid" in result.output
        finally:
            os.unlink(valid_config_file)

        # Test invalid configuration
        invalid_config = sample_pipeline_config.copy()
        del invalid_config['stages']  # Remove required field
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(invalid_config, f)
            invalid_config_file = f.name

        try:
            result = runner.invoke(pipeline, ['validate', '--config', invalid_config_file])
            assert result.exit_code != 0
            assert "validation error" in result.output.lower()
        finally:
            os.unlink(invalid_config_file)

    def test_pipeline_list_with_filters(self, runner, mock_client):
        """Test listing pipelines with filters."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_pipelines = [
                {
                    "pipeline_id": "pipeline_1",
                    "name": "data-processing-pipeline",
                    "status": "active",
                    "created_at": "2024-01-01T00:00:00Z",
                    "last_run": "2024-01-02T12:00:00Z"
                },
                {
                    "pipeline_id": "pipeline_2", 
                    "name": "ml-training-pipeline",
                    "status": "inactive",
                    "created_at": "2024-01-01T00:00:00Z",
                    "last_run": None
                }
            ]
            
            mock_client.list_pipelines.return_value = {
                "pipelines": mock_pipelines,
                "total": 2,
                "page": 1,
                "per_page": 10
            }
            
            result = runner.invoke(pipeline, ['list', '--status', 'active', '--limit', '10'])
            
            assert result.exit_code == 0
            assert "data-processing-pipeline" in result.output
            mock_client.list_pipelines.assert_called_once_with(
                status='active', page=1, per_page=10
            )

    def test_pipeline_status_detailed(self, runner, mock_client):
        """Test detailed pipeline status with execution history."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_pipeline_status = {
                "pipeline_id": "pipeline_123",
                "name": "test-pipeline",
                "status": "active",
                "current_execution": {
                    "execution_id": "exec_456",
                    "status": "running",
                    "current_stage": "process",
                    "progress": 60,
                    "started_at": "2024-01-02T10:00:00Z"
                },
                "recent_executions": [
                    {
                        "execution_id": "exec_455",
                        "status": "completed",
                        "duration": 300,
                        "completed_at": "2024-01-02T09:30:00Z"
                    },
                    {
                        "execution_id": "exec_454",
                        "status": "failed",
                        "error": "Data validation failed",
                        "failed_at": "2024-01-02T08:45:00Z"
                    }
                ],
                "metrics": {
                    "success_rate": 0.85,
                    "average_duration": 280,
                    "total_executions": 20
                }
            }
            
            mock_client.get_pipeline_status.return_value = mock_pipeline_status
            
            result = runner.invoke(pipeline, ['status', 'pipeline_123', '--detailed'])
            
            assert result.exit_code == 0
            assert "test-pipeline" in result.output
            assert "running" in result.output
            assert "60%" in result.output
            assert "Success Rate: 85%" in result.output
            mock_client.get_pipeline_status.assert_called_once_with("pipeline_123")


class TestBatchProcessing:
    """Test batch processing functionality."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @pytest.fixture
    def mock_client(self):
        return MagicMock(spec=APIClient)

    @pytest.fixture
    def batch_job_config(self):
        """Sample batch job configuration."""
        return {
            "name": "daily-data-processing",
            "schedule": "0 2 * * *",  # Daily at 2 AM
            "pipeline_config": {
                "stages": [
                    {
                        "name": "fetch_data",
                        "type": "data_fetch",
                        "config": {
                            "source": "s3://bucket/daily-data/",
                            "pattern": "data-*.csv"
                        }
                    },
                    {
                        "name": "process",
                        "type": "data_processing",
                        "config": {
                            "format": "csv",
                            "validation": True
                        }
                    }
                ]
            },
            "retry_policy": {
                "max_attempts": 3,
                "retry_delay": 300
            },
            "notifications": {
                "on_failure": {
                    "email": ["admin@example.com"]
                }
            }
        }

    def test_batch_job_create(self, runner, mock_client, batch_job_config):
        """Test creating batch job."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_client.create_batch_job.return_value = {
                "job_id": "batch_job_123",
                "status": "scheduled",
                "next_run": "2024-01-03T02:00:00Z"
            }
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(batch_job_config, f)
                config_file = f.name

            try:
                result = runner.invoke(batch, ['create', '--config', config_file])
                
                assert result.exit_code == 0
                assert "Batch job created" in result.output
                assert "batch_job_123" in result.output
                mock_client.create_batch_job.assert_called_once()
            finally:
                os.unlink(config_file)

    def test_batch_job_list_with_status(self, runner, mock_client):
        """Test listing batch jobs with status filtering."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_jobs = [
                {
                    "job_id": "batch_1",
                    "name": "daily-processing",
                    "status": "active",
                    "schedule": "0 2 * * *",
                    "next_run": "2024-01-03T02:00:00Z",
                    "last_run_status": "completed"
                },
                {
                    "job_id": "batch_2",
                    "name": "weekly-report",
                    "status": "paused",
                    "schedule": "0 9 * * 1",
                    "next_run": None,
                    "last_run_status": "failed"
                }
            ]
            
            mock_client.list_batch_jobs.return_value = {
                "jobs": mock_jobs,
                "total": 2
            }
            
            result = runner.invoke(batch, ['list', '--status', 'active'])
            
            assert result.exit_code == 0
            assert "daily-processing" in result.output
            assert "active" in result.output
            mock_client.list_batch_jobs.assert_called_once_with(status='active')

    def test_batch_job_run_now(self, runner, mock_client):
        """Test manually triggering batch job execution."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_client.trigger_batch_job.return_value = {
                "execution_id": "exec_789",
                "status": "started",
                "triggered_at": "2024-01-02T15:30:00Z"
            }
            
            result = runner.invoke(batch, ['run', 'batch_job_123'])
            
            assert result.exit_code == 0
            assert "Batch job triggered" in result.output
            assert "exec_789" in result.output
            mock_client.trigger_batch_job.assert_called_once_with("batch_job_123")

    def test_batch_job_history(self, runner, mock_client):
        """Test viewing batch job execution history."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_executions = [
                {
                    "execution_id": "exec_1",
                    "status": "completed",
                    "started_at": "2024-01-02T02:00:00Z",
                    "completed_at": "2024-01-02T02:15:00Z",
                    "duration": 900,
                    "records_processed": 10000
                },
                {
                    "execution_id": "exec_2",
                    "status": "failed",
                    "started_at": "2024-01-01T02:00:00Z",
                    "failed_at": "2024-01-01T02:05:00Z",
                    "error": "Source data not available"
                }
            ]
            
            mock_client.get_batch_job_history.return_value = {
                "executions": mock_executions,
                "total": 2
            }
            
            result = runner.invoke(batch, ['history', 'batch_job_123', '--limit', '10'])
            
            assert result.exit_code == 0
            assert "completed" in result.output
            assert "failed" in result.output
            assert "10000" in result.output  # records processed
            mock_client.get_batch_job_history.assert_called_once_with("batch_job_123", limit=10)


class TestCICDIntegration:
    """Test CI/CD integration functionality."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @pytest.fixture
    def mock_client(self):
        return MagicMock(spec=APIClient)

    @pytest.fixture
    def github_workflow_config(self):
        """Sample GitHub Actions workflow configuration."""
        return {
            "name": "Data Pipeline CI/CD",
            "on": {
                "push": {
                    "branches": ["main", "develop"]
                },
                "pull_request": {
                    "branches": ["main"]
                },
                "schedule": [
                    {"cron": "0 6 * * *"}  # Daily at 6 AM
                ]
            },
            "jobs": {
                "test": {
                    "runs-on": "ubuntu-latest",
                    "steps": [
                        {"uses": "actions/checkout@v3"},
                        {"name": "Setup Python", "uses": "actions/setup-python@v4"},
                        {"name": "Install dependencies", "run": "pip install schlep-engine-cli"},
                        {"name": "Validate pipeline", "run": "schlep pipeline validate --config pipeline.yaml"},
                        {"name": "Run tests", "run": "schlep validate --config test-pipeline.yaml"}
                    ]
                },
                "deploy": {
                    "needs": "test",
                    "runs-on": "ubuntu-latest",
                    "if": "github.ref == 'refs/heads/main'",
                    "steps": [
                        {"name": "Deploy pipeline", "run": "schlep pipeline create --config pipeline.yaml"},
                        {"name": "Run smoke test", "run": "schlep pipeline run --config smoke-test.yaml"}
                    ]
                }
            }
        }

    def test_cicd_generate_github_workflow(self, runner, github_workflow_config):
        """Test generating GitHub Actions workflow."""
        with tempfile.TemporaryDirectory() as temp_dir:
            pipeline_config = {
                "name": "test-pipeline",
                "stages": [
                    {"name": "process", "type": "data_processing"}
                ]
            }
            
            # Create pipeline config file
            pipeline_file = Path(temp_dir) / "pipeline.yaml"
            with open(pipeline_file, 'w') as f:
                yaml.dump(pipeline_config, f)
            
            result = runner.invoke(cicd, [
                'generate', 'github',
                '--pipeline-config', str(pipeline_file),
                '--output', temp_dir,
                '--on-push', 'main,develop',
                '--on-schedule', '0 6 * * *'
            ])
            
            assert result.exit_code == 0
            assert "GitHub workflow generated" in result.output
            
            # Verify workflow file was created
            workflow_file = Path(temp_dir) / ".github" / "workflows" / "schlep-pipeline.yml"
            assert workflow_file.exists()
            
            # Verify workflow content
            with open(workflow_file) as f:
                workflow_content = yaml.safe_load(f)
            
            assert workflow_content["name"] == "Schlep Engine Pipeline CI/CD"
            assert "main" in workflow_content["on"]["push"]["branches"]
            assert "develop" in workflow_content["on"]["push"]["branches"]

    def test_cicd_validate_environment(self, runner, mock_client):
        """Test validating CI/CD environment setup."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            # Mock environment validation
            mock_client.validate_api_access.return_value = {"valid": True, "permissions": ["read", "write"]}
            mock_client.get_user_info.return_value = {"user_id": "user123", "plan": "pro"}
            
            result = runner.invoke(cicd, ['validate-env'])
            
            assert result.exit_code == 0
            assert "Environment validation successful" in result.output
            assert "API access: ✓" in result.output
            assert "Permissions: read, write" in result.output

    def test_cicd_deploy_pipeline(self, runner, mock_client):
        """Test deploying pipeline in CI/CD environment."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config, \
             patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'GITHUB_SHA': 'abc123'}):
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            pipeline_config = {
                "name": "ci-pipeline",
                "stages": [{"name": "test", "type": "validation"}]
            }
            
            mock_client.create_pipeline.return_value = {
                "pipeline_id": "pipeline_ci_123",
                "status": "deployed",
                "version": "abc123"
            }
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(pipeline_config, f)
                config_file = f.name

            try:
                result = runner.invoke(cicd, [
                    'deploy',
                    '--config', config_file,
                    '--environment', 'staging',
                    '--wait-for-completion'
                ])
                
                assert result.exit_code == 0
                assert "Pipeline deployed successfully" in result.output
                assert "pipeline_ci_123" in result.output
                mock_client.create_pipeline.assert_called_once()
            finally:
                os.unlink(config_file)

    def test_cicd_run_tests(self, runner, mock_client):
        """Test running pipeline tests in CI/CD."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            test_config = {
                "tests": [
                    {
                        "name": "data_validation_test",
                        "type": "validation",
                        "config": {
                            "test_data": "test-data.csv",
                            "expected_schema": "schema.json"
                        }
                    },
                    {
                        "name": "performance_test",
                        "type": "performance",
                        "config": {
                            "max_duration": 300,
                            "max_memory": "1GB"
                        }
                    }
                ]
            }
            
            mock_client.run_pipeline_tests.return_value = {
                "test_run_id": "test_123",
                "results": [
                    {"name": "data_validation_test", "status": "passed", "duration": 45},
                    {"name": "performance_test", "status": "passed", "duration": 180}
                ],
                "summary": {"passed": 2, "failed": 0, "total": 2}
            }
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(test_config, f)
                config_file = f.name

            try:
                result = runner.invoke(cicd, ['test', '--config', config_file, '--report-format', 'junit'])
                
                assert result.exit_code == 0
                assert "All tests passed" in result.output
                assert "2/2" in result.output
                mock_client.run_pipeline_tests.assert_called_once()
            finally:
                os.unlink(config_file)

    def test_cicd_rollback(self, runner, mock_client):
        """Test pipeline rollback functionality."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            mock_client.list_pipeline_versions.return_value = {
                "versions": [
                    {"version": "v1.2.0", "status": "active", "deployed_at": "2024-01-02T10:00:00Z"},
                    {"version": "v1.1.0", "status": "inactive", "deployed_at": "2024-01-01T10:00:00Z"},
                    {"version": "v1.0.0", "status": "archived", "deployed_at": "2023-12-01T10:00:00Z"}
                ]
            }
            
            mock_client.rollback_pipeline.return_value = {
                "pipeline_id": "pipeline_123",
                "rolled_back_from": "v1.2.0",
                "rolled_back_to": "v1.1.0",
                "status": "success"
            }
            
            result = runner.invoke(cicd, ['rollback', 'pipeline_123', '--to-version', 'v1.1.0'])
            
            assert result.exit_code == 0
            assert "Pipeline rolled back successfully" in result.output
            assert "v1.1.0" in result.output
            mock_client.rollback_pipeline.assert_called_once_with("pipeline_123", "v1.1.0")


class TestComplexWorkflows:
    """Test complex multi-command workflows."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @pytest.fixture
    def mock_client(self):
        return MagicMock(spec=APIClient)

    def test_end_to_end_data_pipeline(self, runner, mock_client):
        """Test complete end-to-end data pipeline workflow."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config, \
             patch('builtins.open', mock_open(read_data="col1,col2\nval1,val2")):
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            # Mock responses for each step
            mock_client.upload_file.return_value = {"file_id": "file_123", "status": "uploaded"}
            mock_client.create_processing_job.return_value = {"job_id": "job_456", "status": "running"}
            mock_client.get_job_status.return_value = {"job_id": "job_456", "status": "completed", "results": {"output_url": "https://output.com/result.csv"}}
            mock_client.create_ml_training_job.return_value = {"model_id": "model_789", "status": "training"}
            mock_client.get_model_status.return_value = {"model_id": "model_789", "status": "completed", "metrics": {"accuracy": 0.95}}
            
            # Step 1: Upload file
            result1 = runner.invoke(cli, ['process', 'upload', 'test-data.csv'])
            assert result1.exit_code == 0
            
            # Step 2: Process data
            result2 = runner.invoke(cli, ['process', 'create', '--files', 'file_123'])
            assert result2.exit_code == 0
            
            # Step 3: Check processing status
            result3 = runner.invoke(cli, ['process', 'status', 'job_456'])
            assert result3.exit_code == 0
            
            # Step 4: Train ML model
            result4 = runner.invoke(cli, ['ml', 'train', '--dataset', 'job_456', '--target', 'target_column'])
            assert result4.exit_code == 0
            
            # Step 5: Check model status
            result5 = runner.invoke(cli, ['ml', 'status', 'model_789'])
            assert result5.exit_code == 0
            assert "0.95" in result5.output

    def test_batch_processing_workflow(self, runner, mock_client):
        """Test batch processing workflow with monitoring."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            batch_config = {
                "name": "daily-batch",
                "schedule": "0 2 * * *",
                "pipeline_config": {
                    "stages": [
                        {"name": "process", "type": "data_processing"}
                    ]
                }
            }
            
            # Mock batch job lifecycle
            mock_client.create_batch_job.return_value = {"job_id": "batch_123"}
            mock_client.trigger_batch_job.return_value = {"execution_id": "exec_456"}
            mock_client.get_batch_execution_status.return_value = {"status": "completed", "duration": 300}
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(batch_config, f)
                config_file = f.name

            try:
                # Create batch job
                result1 = runner.invoke(batch, ['create', '--config', config_file])
                assert result1.exit_code == 0
                
                # Run batch job
                result2 = runner.invoke(batch, ['run', 'batch_123'])
                assert result2.exit_code == 0
                
                # Monitor execution
                result3 = runner.invoke(batch, ['status', 'exec_456'])
                assert result3.exit_code == 0
                assert "completed" in result3.output
            finally:
                os.unlink(config_file)

    def test_multi_environment_deployment(self, runner, mock_client):
        """Test deploying pipeline across multiple environments."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            pipeline_config = {
                "name": "multi-env-pipeline",
                "stages": [{"name": "process", "type": "data_processing"}]
            }
            
            # Mock deployment to different environments
            mock_client.create_pipeline.return_value = {"pipeline_id": "pipeline_123"}
            mock_client.deploy_to_environment.return_value = {"status": "deployed"}
            mock_client.run_smoke_test.return_value = {"status": "passed"}
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(pipeline_config, f)
                config_file = f.name

            try:
                environments = ["development", "staging", "production"]
                
                for env in environments:
                    # Deploy to environment
                    result = runner.invoke(cicd, [
                        'deploy',
                        '--config', config_file,
                        '--environment', env,
                        '--wait-for-completion'
                    ])
                    assert result.exit_code == 0
                    assert f"deployed to {env}" in result.output.lower()
                    
                    # Run smoke tests
                    smoke_result = runner.invoke(cicd, ['test', '--environment', env, '--smoke-test'])
                    assert smoke_result.exit_code == 0
            finally:
                os.unlink(config_file)


class TestErrorHandlingAndRecovery:
    """Test error handling and recovery scenarios."""

    @pytest.fixture
    def runner(self):
        return CliRunner()

    @pytest.fixture
    def mock_client(self):
        return MagicMock(spec=APIClient)

    def test_pipeline_failure_recovery(self, runner, mock_client):
        """Test pipeline failure detection and recovery."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key")
            
            # Mock failed pipeline execution
            mock_client.get_pipeline_execution.return_value = {
                "execution_id": "exec_123",
                "status": "failed",
                "error": "Data validation failed at stage 2",
                "failed_stage": "validation",
                "retry_count": 2
            }
            
            mock_client.retry_pipeline_execution.return_value = {
                "execution_id": "exec_124",
                "status": "running",
                "retried_from": "exec_123"
            }
            
            # Check failed status
            result1 = runner.invoke(pipeline, ['status', 'exec_123'])
            assert result1.exit_code == 0
            assert "failed" in result1.output
            assert "Data validation failed" in result1.output
            
            # Retry execution
            result2 = runner.invoke(pipeline, ['retry', 'exec_123'])
            assert result2.exit_code == 0
            assert "Pipeline execution retried" in result2.output
            assert "exec_124" in result2.output

    def test_network_error_handling(self, runner, mock_client):
        """Test handling of network errors with retries."""
        with patch('schlep_cli.core.client.APIClient') as MockAPIClient, \
             patch('schlep_cli.core.config.Config.load') as mock_load_config:
            
            MockAPIClient.return_value = mock_client
            mock_load_config.return_value = MagicMock(api_key="test-key", max_retries=3)
            
            # Mock network error followed by success
            mock_client.get_pipeline_status.side_effect = [
                Exception("Network error"),
                Exception("Network error"), 
                {"pipeline_id": "pipeline_123", "status": "active"}
            ]
            
            result = runner.invoke(pipeline, ['status', 'pipeline_123'])
            
            # Should succeed after retries
            assert result.exit_code == 0
            assert "active" in result.output
            assert mock_client.get_pipeline_status.call_count == 3

    def test_configuration_validation_errors(self, runner):
        """Test handling of configuration validation errors."""
        invalid_configs = [
            {},  # Empty config
            {"name": "test"},  # Missing required fields
            {"name": "test", "stages": []},  # Empty stages
            {"name": "test", "stages": [{"invalid": "stage"}]}  # Invalid stage format
        ]
        
        for i, config in enumerate(invalid_configs):
            with tempfile.NamedTemporaryFile(mode='w', suffix=f'.yaml', delete=False) as f:
                yaml.dump(config, f)
                config_file = f.name

            try:
                result = runner.invoke(pipeline, ['validate', '--config', config_file])
                assert result.exit_code != 0
                assert "validation" in result.output.lower() or "error" in result.output.lower()
            finally:
                os.unlink(config_file)