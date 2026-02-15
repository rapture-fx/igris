"""
Comprehensive command tests for Igris-engine CLI
"""

import pytest
import json
import tempfile
import os
import time
from pathlib import Path
from unittest.mock import Mock, patch, mock_open
from click.testing import CliRunner

from igris_cli.main import cli
from igris_cli.core.config import Config
from igris_cli.commands import process, pipeline, config as config_cmd, validate, batch, monitoring


class TestProcessCommands:
    """Comprehensive tests for data processing commands."""

    def test_process_file_success(self, runner, auth_context, sample_data_file, mock_client):
        """Test successful file processing."""
        mock_client.data.process_file.return_value = {
            'job_id': 'process-job-123',
            'status': 'running',
            'progress': {'current': 0, 'total': 100}
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'file', str(sample_data_file),
                    '--format', 'json',
                    '--output', 'processed_output.json'
                ])

        assert result.exit_code == 0
        assert 'process-job-123' in result.output
        assert 'Processing started' in result.output

    def test_process_file_with_progress(self, runner, auth_context, sample_data_file, mock_client):
        """Test file processing with progress tracking."""
        job_states = [
            {'job_id': 'progress-job-123', 'status': 'running', 'progress': {'current': 25, 'total': 100}},
            {'job_id': 'progress-job-123', 'status': 'running', 'progress': {'current': 75, 'total': 100}},
            {'job_id': 'progress-job-123', 'status': 'completed', 'progress': {'current': 100, 'total': 100}}
        ]

        mock_client.data.process_file.return_value = job_states[0]
        mock_client.data.get_job_status.side_effect = job_states

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                with patch('time.sleep'):  # Speed up polling
                    result = runner.invoke(cli, [
                        'process', 'file', str(sample_data_file),
                        '--format', 'json',
                        '--wait'
                    ])

        assert result.exit_code == 0
        assert 'Processing completed' in result.output
        assert '100%' in result.output or 'completed' in result.output.lower()

    def test_process_file_validation_options(self, runner, auth_context, sample_data_file, mock_client):
        """Test file processing with various validation options."""
        mock_client.data.process_file.return_value = {
            'job_id': 'validation-job-123',
            'status': 'running',
            'validation': {
                'is_valid': True,
                'warnings': ['Column "age" has missing values'],
                'suggestions': ['Consider filling missing values']
            }
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'file', str(sample_data_file),
                    '--format', 'json',
                    '--validate',
                    '--quality-check',
                    '--verbose'
                ])

        assert result.exit_code == 0
        assert 'validation-job-123' in result.output
        assert 'Validation passed' in result.output
        mock_client.data.process_file.assert_called_once()

    def test_process_file_transformation_pipeline(self, runner, auth_context, sample_data_file, mock_client):
        """Test file processing with transformation pipeline."""
        mock_client.data.process_file.return_value = {
            'job_id': 'transform-job-123',
            'status': 'running',
            'transformations_applied': [
                {'type': 'normalize', 'column': 'value'},
                {'type': 'encode', 'column': 'category'}
            ]
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'file', str(sample_data_file),
                    '--format', 'json',
                    '--transform', 'normalize:value',
                    '--transform', 'encode:category',
                    '--output', 'transformed.json'
                ])

        assert result.exit_code == 0
        assert 'transform-job-123' in result.output
        assert 'Transformations applied' in result.output

    def test_process_status_command(self, runner, auth_context, mock_client):
        """Test process status command."""
        mock_client.data.get_job_status.return_value = {
            'job_id': 'status-job-123',
            'status': 'running',
            'progress': {'current': 60, 'total': 100},
            'created_at': '2024-01-01T12:00:00Z',
            'estimated_completion': '2024-01-01T12:30:00Z'
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['process', 'status', 'status-job-123'])

        assert result.exit_code == 0
        assert 'status-job-123' in result.output
        assert 'Status: running' in result.output
        assert '60%' in result.output

    def test_process_list_command(self, runner, auth_context, mock_client, sample_jobs):
        """Test process list command."""
        mock_client.data.list_jobs.return_value = {
            'jobs': sample_jobs,
            'pagination': {'page': 1, 'total': len(sample_jobs), 'pages': 1}
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['process', 'list'])

        assert result.exit_code == 0
        assert 'job-1' in result.output
        assert 'job-2' in result.output
        assert 'data_processing' in result.output

    def test_process_cancel_command(self, runner, auth_context, mock_client):
        """Test process cancel command."""
        mock_client.data.cancel_job.return_value = {
            'message': 'Job cancelled successfully'
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['process', 'cancel', 'cancel-job-123'])

        assert result.exit_code == 0
        assert 'cancelled successfully' in result.output
        mock_client.data.cancel_job.assert_called_once_with('cancel-job-123')

    def test_process_download_result(self, runner, auth_context, mock_client, temp_dir):
        """Test downloading process results."""
        result_data = b'[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]'
        mock_client.data.download_result.return_value = result_data

        output_file = temp_dir / "result.json"

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'download', 'download-job-123',
                    '--output', str(output_file)
                ])

        assert result.exit_code == 0
        assert 'Downloaded result' in result.output
        assert output_file.exists()
        assert json.loads(output_file.read_text())[0]['name'] == 'Alice'


class TestPipelineCommands:
    """Comprehensive tests for ML pipeline commands."""

    def test_pipeline_create_success(self, runner, auth_context, mock_client, sample_pipeline_config):
        """Test successful pipeline creation."""
        mock_client.ml.create_pipeline.return_value = {
            'pipeline_id': 'new-pipeline-123',
            'name': 'test-pipeline',
            'status': 'created',
            'model_type': 'random_forest'
        }

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'pipeline', 'create',
                    '--name', 'test-pipeline',
                    '--config', str(sample_pipeline_config),
                    '--description', 'Test pipeline for unit tests'
                ])

        assert result.exit_code == 0
        assert 'new-pipeline-123' in result.output
        assert 'Pipeline created successfully' in result.output

    def test_pipeline_train_command(self, runner, auth_context, mock_client):
        """Test pipeline training command."""
        mock_client.ml.train_model.return_value = {
            'job_id': 'training-job-123',
            'pipeline_id': 'pipeline-123',
            'status': 'running',
            'progress': {'current_epoch': 0, 'total_epochs': 100}
        }

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'pipeline', 'train', 'pipeline-123',
                    '--dataset', 'training-data-123',
                    '--epochs', '100',
                    '--batch-size', '32'
                ])

        assert result.exit_code == 0
        assert 'training-job-123' in result.output
        assert 'Training started' in result.output

    def test_pipeline_predict_command(self, runner, auth_context, mock_client, temp_dir):
        """Test pipeline prediction command."""
        # Create input data file
        input_file = temp_dir / "input.json"
        input_file.write_text(json.dumps([
            {'age': 25, 'income': 50000},
            {'age': 35, 'income': 75000}
        ]))

        mock_client.ml.make_prediction.return_value = {
            'predictions': [0.2, 0.8],
            'confidence': [0.85, 0.92]
        }

        output_file = temp_dir / "predictions.json"

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'pipeline', 'predict', 'pipeline-123',
                    '--input', str(input_file),
                    '--output', str(output_file)
                ])

        assert result.exit_code == 0
        assert 'Predictions completed' in result.output
        assert output_file.exists()

        predictions = json.loads(output_file.read_text())
        assert predictions['predictions'] == [0.2, 0.8]

    def test_pipeline_list_command(self, runner, auth_context, mock_client, sample_pipelines):
        """Test pipeline list command."""
        mock_client.ml.list_pipelines.return_value = {
            'pipelines': sample_pipelines,
            'pagination': {'page': 1, 'total': len(sample_pipelines), 'pages': 1}
        }

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['pipeline', 'list'])

        assert result.exit_code == 0
        assert 'pipeline-1' in result.output
        assert 'pipeline-2' in result.output
        assert 'test-pipeline-1' in result.output

    def test_pipeline_status_command(self, runner, auth_context, mock_client):
        """Test pipeline status command."""
        mock_client.ml.get_pipeline.return_value = {
            'pipeline_id': 'status-pipeline-123',
            'name': 'Status Test Pipeline',
            'status': 'active',
            'model_type': 'xgboost',
            'metrics': {
                'accuracy': 0.92,
                'precision': 0.89,
                'recall': 0.94
            }
        }

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['pipeline', 'status', 'status-pipeline-123'])

        assert result.exit_code == 0
        assert 'Status Test Pipeline' in result.output
        assert 'Accuracy: 0.92' in result.output
        assert 'active' in result.output

    def test_pipeline_delete_command(self, runner, auth_context, mock_client):
        """Test pipeline deletion with confirmation."""
        mock_client.ml.delete_pipeline.return_value = {
            'message': 'Pipeline deleted successfully'
        }

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                with patch('click.confirm', return_value=True):
                    result = runner.invoke(cli, ['pipeline', 'delete', 'delete-pipeline-123'])

        assert result.exit_code == 0
        assert 'deleted successfully' in result.output
        mock_client.ml.delete_pipeline.assert_called_once_with('delete-pipeline-123')

    def test_pipeline_evaluate_command(self, runner, auth_context, mock_client):
        """Test pipeline evaluation command."""
        mock_client.ml.evaluate_model.return_value = {
            'metrics': {
                'accuracy': 0.91,
                'precision': 0.88,
                'recall': 0.93,
                'f1_score': 0.90
            },
            'feature_importance': {
                'feature1': 0.45,
                'feature2': 0.35,
                'feature3': 0.20
            }
        }

        with patch('igris_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.pipeline.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'pipeline', 'evaluate', 'eval-pipeline-123',
                    '--test-data', 'test-dataset-456',
                    '--metrics', 'accuracy,precision,recall,f1_score'
                ])

        assert result.exit_code == 0
        assert 'Accuracy: 0.91' in result.output
        assert 'Feature Importance:' in result.output
        assert 'feature1: 0.45' in result.output


class TestValidateCommands:
    """Comprehensive tests for validation commands."""

    def test_validate_file_success(self, runner, auth_context, sample_data_file, mock_client):
        """Test successful file validation."""
        mock_client.data.validate_file.return_value = {
            'validation': {
                'is_valid': True,
                'errors': [],
                'warnings': ['Column "age" has 5% missing values'],
                'suggestions': ['Consider filling missing values in "age" column']
            },
            'source': {
                'name': 'sample.csv',
                'size_bytes': 1024,
                'row_count': 100,
                'column_count': 4
            }
        }

        with patch('igris_cli.commands.validate.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.validate.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['validate', 'file', str(sample_data_file)])

        assert result.exit_code == 0
        assert 'File is valid' in result.output
        assert 'Warnings:' in result.output
        assert 'missing values' in result.output

    def test_validate_file_with_errors(self, runner, auth_context, sample_data_file, mock_client):
        """Test file validation with errors."""
        mock_client.data.validate_file.return_value = {
            'validation': {
                'is_valid': False,
                'errors': [
                    'Column "id" contains duplicate values',
                    'Column "email" has invalid format in rows 5, 12, 23'
                ],
                'warnings': [],
                'suggestions': [
                    'Remove duplicate values in "id" column',
                    'Fix email format validation'
                ]
            },
            'source': {
                'name': 'invalid.csv',
                'size_bytes': 2048,
                'row_count': 50,
                'column_count': 6
            }
        }

        with patch('igris_cli.commands.validate.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.validate.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['validate', 'file', str(sample_data_file)])

        assert result.exit_code != 0
        assert 'File validation failed' in result.output
        assert 'duplicate values' in result.output
        assert 'Suggestions:' in result.output

    def test_validate_pipeline_config(self, runner, auth_context, sample_pipeline_config, mock_client):
        """Test pipeline configuration validation."""
        mock_client.ml.validate_pipeline_config.return_value = {
            'is_valid': True,
            'errors': [],
            'warnings': ['Consider increasing n_estimators for better performance']
        }

        with patch('igris_cli.commands.validate.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.validate.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['validate', 'pipeline', str(sample_pipeline_config)])

        assert result.exit_code == 0
        assert 'Pipeline configuration is valid' in result.output
        assert 'n_estimators' in result.output


class TestBatchCommands:
    """Comprehensive tests for batch processing commands."""

    def test_batch_process_files(self, runner, auth_context, temp_dir, mock_client):
        """Test batch processing multiple files."""
        # Create multiple sample files
        files = []
        for i in range(3):
            file_path = temp_dir / f"batch_file_{i}.csv"
            file_path.write_text(f"id,name,value\n{i+1},User{i+1},{(i+1)*100}")
            files.append(str(file_path))

        mock_client.data.batch_process_files.return_value = {
            'batch_job_id': 'batch-job-123',
            'status': 'running',
            'total_files': 3,
            'processed_files': 0
        }

        with patch('igris_cli.commands.batch.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.batch.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'batch', 'process',
                    '--files', ','.join(files),
                    '--format', 'json',
                    '--output-dir', str(temp_dir / 'output')
                ])

        assert result.exit_code == 0
        assert 'batch-job-123' in result.output
        assert 'Batch processing started' in result.output

    def test_batch_status_command(self, runner, auth_context, mock_client):
        """Test batch status command."""
        mock_client.data.get_batch_status.return_value = {
            'batch_job_id': 'batch-status-123',
            'status': 'running',
            'total_files': 10,
            'processed_files': 7,
            'failed_files': 1,
            'progress': 70.0,
            'files': [
                {'file': 'file1.csv', 'status': 'completed'},
                {'file': 'file2.csv', 'status': 'completed'},
                {'file': 'file3.csv', 'status': 'failed', 'error': 'Invalid format'}
            ]
        }

        with patch('igris_cli.commands.batch.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.batch.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['batch', 'status', 'batch-status-123'])

        assert result.exit_code == 0
        assert '70.0%' in result.output
        assert 'processed: 7' in result.output
        assert 'failed: 1' in result.output
        assert 'Invalid format' in result.output

    def test_batch_cancel_command(self, runner, auth_context, mock_client):
        """Test batch cancel command."""
        mock_client.data.cancel_batch.return_value = {
            'message': 'Batch job cancelled successfully',
            'cancelled_files': 3,
            'completed_files': 2
        }

        with patch('igris_cli.commands.batch.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.batch.APIClient', return_value=mock_client):
                with patch('click.confirm', return_value=True):
                    result = runner.invoke(cli, ['batch', 'cancel', 'batch-cancel-123'])

        assert result.exit_code == 0
        assert 'cancelled successfully' in result.output
        assert 'cancelled_files: 3' in result.output


class TestMonitoringCommands:
    """Comprehensive tests for monitoring commands."""

    def test_monitoring_status_command(self, runner, auth_context, mock_client, sample_metrics):
        """Test monitoring status command."""
        mock_client.monitoring.get_system_status.return_value = sample_metrics

        with patch('igris_cli.commands.monitoring.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.monitoring.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['monitoring', 'status'])

        assert result.exit_code == 0
        assert 'CPU Usage: 65.5%' in result.output
        assert 'Memory Usage: 78.2%' in result.output
        assert 'Active Connections: 150' in result.output

    def test_monitoring_logs_command(self, runner, auth_context, mock_client):
        """Test monitoring logs command."""
        mock_logs = [
            {'timestamp': '2024-01-01T12:00:00Z', 'level': 'INFO', 'message': 'Processing started'},
            {'timestamp': '2024-01-01T12:01:00Z', 'level': 'WARN', 'message': 'High memory usage detected'},
            {'timestamp': '2024-01-01T12:02:00Z', 'level': 'INFO', 'message': 'Processing completed'}
        ]
        mock_client.monitoring.get_logs.return_value = {'logs': mock_logs}

        with patch('igris_cli.commands.monitoring.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.monitoring.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'monitoring', 'logs',
                    '--lines', '10',
                    '--level', 'INFO'
                ])

        assert result.exit_code == 0
        assert 'Processing started' in result.output
        assert 'Processing completed' in result.output

    def test_monitoring_alerts_command(self, runner, auth_context, mock_client):
        """Test monitoring alerts command."""
        mock_alerts = [
            {
                'id': 'alert-1',
                'severity': 'high',
                'message': 'CPU usage above 90%',
                'timestamp': '2024-01-01T12:00:00Z',
                'status': 'active'
            },
            {
                'id': 'alert-2',
                'severity': 'medium',
                'message': 'Disk usage above 80%',
                'timestamp': '2024-01-01T11:30:00Z',
                'status': 'acknowledged'
            }
        ]
        mock_client.monitoring.get_alerts.return_value = {'alerts': mock_alerts}

        with patch('igris_cli.commands.monitoring.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.monitoring.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['monitoring', 'alerts'])

        assert result.exit_code == 0
        assert 'CPU usage above 90%' in result.output
        assert 'HIGH' in result.output
        assert 'MEDIUM' in result.output


class TestConfigCommands:
    """Comprehensive tests for configuration commands."""

    def test_config_show_command(self, runner, sample_config):
        """Test config show command."""
        with patch('igris_cli.commands.config.Config') as MockConfig:
            MockConfig.return_value = sample_config
            
            result = runner.invoke(cli, ['config', 'show'])

        assert result.exit_code == 0
        assert 'api_key: sk-test-key-123' in result.output
        assert 'base_url: https://api.test.com' in result.output
        assert 'parallel_jobs: 4' in result.output

    def test_config_set_command(self, runner, temp_dir):
        """Test config set command."""
        config_file = temp_dir / "config.yml"
        
        with patch('igris_cli.core.config.Config.get_config_file', return_value=config_file):
            result = runner.invoke(cli, [
                'config', 'set',
                'api_key', 'sk-new-api-key-456'
            ])

        assert result.exit_code == 0
        assert 'Configuration updated' in result.output
        # Verify config was written
        assert config_file.exists()

    def test_config_get_command(self, runner, sample_config):
        """Test config get command."""
        with patch('igris_cli.commands.config.Config') as MockConfig:
            MockConfig.return_value = sample_config
            
            result = runner.invoke(cli, ['config', 'get', 'base_url'])

        assert result.exit_code == 0
        assert 'https://api.test.com' in result.output

    def test_config_reset_command(self, runner, temp_dir):
        """Test config reset command."""
        config_file = temp_dir / "config.yml"
        config_file.write_text("api_key: old-key\nbase_url: old-url")

        with patch('igris_cli.core.config.Config.get_config_file', return_value=config_file):
            with patch('click.confirm', return_value=True):
                result = runner.invoke(cli, ['config', 'reset'])

        assert result.exit_code == 0
        assert 'Configuration reset' in result.output


class TestErrorHandling:
    """Test error handling across all commands."""

    def test_unauthenticated_command(self, runner):
        """Test command execution without authentication."""
        with patch('igris_cli.commands.process.get_auth_context', return_value=None):
            result = runner.invoke(cli, ['process', 'list'])

        assert result.exit_code != 0
        assert 'not authenticated' in result.output.lower() or 'login required' in result.output.lower()

    def test_network_error_handling(self, runner, auth_context, mock_client):
        """Test handling of network errors."""
        mock_client.data.list_jobs.side_effect = ConnectionError("Network unreachable")

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['process', 'list'])

        assert result.exit_code != 0
        assert 'network' in result.output.lower() or 'connection' in result.output.lower()

    def test_api_error_handling(self, runner, auth_context, mock_client):
        """Test handling of API errors."""
        mock_client.data.get_job_status.side_effect = Exception("Job not found")

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, ['process', 'status', 'nonexistent-job'])

        assert result.exit_code != 0
        assert 'Job not found' in result.output

    def test_file_not_found_error(self, runner, auth_context, mock_client):
        """Test handling when input file doesn't exist."""
        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            result = runner.invoke(cli, [
                'process', 'file', '/nonexistent/path/file.csv',
                '--format', 'json'
            ])

        assert result.exit_code != 0
        assert 'not found' in result.output.lower() or 'does not exist' in result.output.lower()

    def test_invalid_config_file(self, runner, temp_dir):
        """Test handling of invalid configuration files."""
        invalid_config = temp_dir / "invalid_config.yml"
        invalid_config.write_text("invalid: yaml: content: [")

        result = runner.invoke(cli, [
            'pipeline', 'create',
            '--name', 'test',
            '--config', str(invalid_config)
        ])

        assert result.exit_code != 0
        assert 'invalid' in result.output.lower() or 'error' in result.output.lower()


class TestInteractiveFeatures:
    """Test interactive CLI features."""

    def test_interactive_file_selection(self, runner, auth_context, temp_dir, mock_client):
        """Test interactive file selection."""
        # Create multiple files
        for i in range(3):
            file_path = temp_dir / f"file_{i}.csv"
            file_path.write_text(f"data{i}")

        mock_client.data.process_file.return_value = {
            'job_id': 'interactive-job-123',
            'status': 'running'
        }

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                with patch('click.prompt') as mock_prompt:
                    mock_prompt.return_value = str(temp_dir / "file_0.csv")
                    
                    result = runner.invoke(cli, [
                        'process', 'file', '--interactive'
                    ])

        assert result.exit_code == 0
        mock_prompt.assert_called()

    def test_progress_bar_display(self, runner, auth_context, sample_data_file, mock_client):
        """Test progress bar display during processing."""
        job_states = [
            {'job_id': 'progress-job-123', 'status': 'running', 'progress': {'current': 10, 'total': 100}},
            {'job_id': 'progress-job-123', 'status': 'running', 'progress': {'current': 50, 'total': 100}},
            {'job_id': 'progress-job-123', 'status': 'completed', 'progress': {'current': 100, 'total': 100}}
        ]

        mock_client.data.process_file.return_value = job_states[0]
        mock_client.data.get_job_status.side_effect = job_states

        with patch('igris_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('igris_cli.commands.process.APIClient', return_value=mock_client):
                with patch('time.sleep'):  # Speed up polling
                    result = runner.invoke(cli, [
                        'process', 'file', str(sample_data_file),
                        '--format', 'json',
                        '--wait',
                        '--progress'
                    ])

        assert result.exit_code == 0
        # Should show progress indicators
        assert '10%' in result.output or '50%' in result.output or '100%' in result.output


@pytest.mark.integration
class TestCLIIntegration:
    """Integration tests for CLI commands (requires test API)."""

    @pytest.mark.skip(reason="Requires real API endpoint")
    def test_end_to_end_processing_workflow(self):
        """Test complete processing workflow against real API."""
        pass

    @pytest.mark.skip(reason="Requires real API endpoint")
    def test_ml_pipeline_lifecycle(self):
        """Test complete ML pipeline lifecycle against real API."""
        pass


# Additional fixtures for command tests
@pytest.fixture
def sample_batch_config():
    """Sample batch processing configuration."""
    return {
        'files': ['file1.csv', 'file2.csv', 'file3.csv'],
        'format': 'json',
        'parallel': True,
        'output_dir': '/tmp/batch_output'
    }


@pytest.fixture
def mock_training_job():
    """Mock training job for pipeline tests."""
    return {
        'job_id': 'training-job-456',
        'pipeline_id': 'pipeline-123',
        'status': 'running',
        'progress': {'current_epoch': 25, 'total_epochs': 100},
        'metrics': {
            'accuracy': 0.87,
            'loss': 0.23
        }
    }