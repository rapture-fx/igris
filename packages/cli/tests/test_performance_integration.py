"""
Performance and integration tests for Schlep-engine CLI
"""

import pytest
import time
import concurrent.futures
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch
from click.testing import CliRunner

from schlep_cli.main import cli


@pytest.mark.performance
class TestCLIPerformance:
    """Performance tests for CLI operations."""

    def test_large_file_processing_performance(self, runner, auth_context, temp_dir, mock_client):
        """Test performance with large file processing."""
        # Create large CSV file (10MB)
        large_file = temp_dir / "large_file.csv"
        header = "id,name,email,age,salary,department,location"
        
        with open(large_file, 'w') as f:
            f.write(header + "\n")
            for i in range(100000):  # ~10MB file
                f.write(f"{i},User{i},user{i}@example.com,{25+i%40},{50000+i*10},Dept{i%10},City{i%50}\n")

        mock_client.data.process_file.return_value = {
            'job_id': 'large-file-job-123',
            'status': 'running',
            'progress': {'current': 0, 'total': 100000}
        }

        with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                start_time = time.time()
                
                result = runner.invoke(cli, [
                    'process', 'file', str(large_file),
                    '--format', 'json',
                    '--batch-size', '5000'
                ])
                
                end_time = time.time()
                processing_time = end_time - start_time

        assert result.exit_code == 0
        assert processing_time < 10.0  # Should process within 10 seconds
        assert 'large-file-job-123' in result.output
        
        print(f"Large file processing time: {processing_time:.2f} seconds")

    def test_concurrent_command_execution(self, runner, auth_context, mock_client):
        """Test performance of concurrent CLI command execution."""
        mock_client.data.get_job_status.return_value = {
            'job_id': 'concurrent-job',
            'status': 'completed',
            'progress': {'current': 100, 'total': 100}
        }

        def execute_status_command(job_id):
            with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
                with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                    return runner.invoke(cli, ['process', 'status', f'job-{job_id}'])

        start_time = time.time()
        
        # Execute 20 concurrent status commands
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(execute_status_command, i) for i in range(20)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        total_time = end_time - start_time

        # All commands should succeed
        assert all(result.exit_code == 0 for result in results)
        assert total_time < 5.0  # Should complete within 5 seconds
        
        print(f"20 concurrent commands completed in: {total_time:.2f} seconds")

    def test_memory_usage_during_processing(self, runner, auth_context, temp_dir, mock_client):
        """Test memory usage during large data processing."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Create multiple large files
        large_files = []
        for i in range(5):
            file_path = temp_dir / f"memory_test_{i}.csv"
            with open(file_path, 'w') as f:
                f.write("id,data\n")
                for j in range(20000):  # ~2MB each
                    f.write(f"{j}," + "x" * 100 + "\n")
            large_files.append(str(file_path))

        mock_client.data.batch_process_files.return_value = {
            'batch_job_id': 'memory-test-batch',
            'status': 'running',
            'total_files': 5
        }

        with patch('schlep_cli.commands.batch.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.batch.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'batch', 'process',
                    '--files', ','.join(large_files),
                    '--format', 'json'
                ])

        final_memory = process.memory_info().rss / 1024 / 1024
        memory_increase = final_memory - initial_memory

        assert result.exit_code == 0
        assert memory_increase < 100  # Should not increase by more than 100MB
        
        print(f"Memory usage: Initial {initial_memory:.1f}MB, Final {final_memory:.1f}MB, Increase {memory_increase:.1f}MB")

    def test_config_loading_performance(self, runner, temp_dir):
        """Test performance of configuration loading."""
        # Create large config file
        config_file = temp_dir / "large_config.yml"
        large_config = {
            'api_key': 'sk-test-key-123',
            'base_url': 'https://api.test.com',
            'parallel_jobs': 4
        }
        
        # Add many configuration options
        for i in range(1000):
            large_config[f'option_{i}'] = f'value_{i}'

        with open(config_file, 'w') as f:
            import yaml
            yaml.dump(large_config, f)

        with patch('schlep_cli.core.config.Config.get_config_file', return_value=config_file):
            start_time = time.time()
            
            result = runner.invoke(cli, ['config', 'show'])
            
            end_time = time.time()
            config_load_time = end_time - start_time

        assert result.exit_code == 0
        assert config_load_time < 1.0  # Should load within 1 second
        
        print(f"Large config loading time: {config_load_time:.3f} seconds")

    def test_response_time_distribution(self, runner, auth_context, mock_client):
        """Test response time distribution for CLI commands."""
        response_times = []
        
        mock_client.data.list_jobs.return_value = {
            'jobs': [],
            'pagination': {'page': 1, 'total': 0, 'pages': 0}
        }

        # Measure response times for multiple identical requests
        for _ in range(50):
            with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
                with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                    start_time = time.time()
                    result = runner.invoke(cli, ['process', 'list'])
                    end_time = time.time()
                    
                    assert result.exit_code == 0
                    response_times.append((end_time - start_time) * 1000)  # Convert to ms

        # Analyze response time distribution
        avg_time = sum(response_times) / len(response_times)
        sorted_times = sorted(response_times)
        p95_time = sorted_times[int(0.95 * len(sorted_times))]
        p99_time = sorted_times[int(0.99 * len(sorted_times))]

        print(f"Response times - Avg: {avg_time:.1f}ms, P95: {p95_time:.1f}ms, P99: {p99_time:.1f}ms")

        # Performance assertions
        assert avg_time < 100  # Average under 100ms
        assert p95_time < 200  # 95th percentile under 200ms
        assert p99_time < 500  # 99th percentile under 500ms


@pytest.mark.integration
class TestCLIIntegration:
    """Integration tests for CLI functionality."""

    def test_complete_data_processing_workflow(self, runner, auth_context, temp_dir, mock_client):
        """Test complete data processing workflow."""
        # Step 1: Create sample data
        input_file = temp_dir / "integration_test.csv"
        input_file.write_text("id,name,value,category\n1,Alice,100,A\n2,Bob,200,B\n3,Charlie,300,A")

        output_dir = temp_dir / "output"
        output_dir.mkdir()

        # Mock API responses for workflow
        workflow_responses = {
            'validate_file': {
                'validation': {'is_valid': True, 'errors': [], 'warnings': []},
                'source': {'name': 'integration_test.csv', 'row_count': 3, 'column_count': 4}
            },
            'process_file': {
                'job_id': 'workflow-job-123',
                'status': 'running',
                'progress': {'current': 0, 'total': 100}
            },
            'get_job_status_running': {
                'job_id': 'workflow-job-123',
                'status': 'running',
                'progress': {'current': 50, 'total': 100}
            },
            'get_job_status_completed': {
                'job_id': 'workflow-job-123',
                'status': 'completed',
                'progress': {'current': 100, 'total': 100},
                'result': {'output_url': 'https://storage.com/result.json'}
            },
            'download_result': b'[{"id":1,"name":"Alice","value":100,"category":"A"}]'
        }

        mock_client.data.validate_file.return_value = workflow_responses['validate_file']
        mock_client.data.process_file.return_value = workflow_responses['process_file']
        mock_client.data.get_job_status.side_effect = [
            workflow_responses['get_job_status_running'],
            workflow_responses['get_job_status_completed']
        ]
        mock_client.data.download_result.return_value = workflow_responses['download_result']

        with patch('schlep_cli.commands.validate.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
                with patch('schlep_cli.commands.validate.APIClient', return_value=mock_client):
                    with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                        # Step 1: Validate file
                        validate_result = runner.invoke(cli, ['validate', 'file', str(input_file)])
                        assert validate_result.exit_code == 0
                        assert 'File is valid' in validate_result.output

                        # Step 2: Process file
                        process_result = runner.invoke(cli, [
                            'process', 'file', str(input_file),
                            '--format', 'json',
                            '--wait'
                        ])
                        assert process_result.exit_code == 0
                        assert 'workflow-job-123' in process_result.output

                        # Step 3: Download result
                        output_file = temp_dir / "result.json"
                        download_result = runner.invoke(cli, [
                            'process', 'download', 'workflow-job-123',
                            '--output', str(output_file)
                        ])
                        assert download_result.exit_code == 0
                        assert output_file.exists()

        # Verify the complete workflow
        result_data = json.loads(output_file.read_text())
        assert len(result_data) == 1
        assert result_data[0]['name'] == 'Alice'

    def test_ml_pipeline_lifecycle(self, runner, auth_context, temp_dir, mock_client):
        """Test complete ML pipeline lifecycle."""
        # Create pipeline config
        pipeline_config = temp_dir / "ml_config.yml"
        pipeline_config.write_text("""
name: integration-test-pipeline
description: Integration test ML pipeline
model_type: random_forest
features:
  - feature1
  - feature2
target: target_column
parameters:
  n_estimators: 100
  max_depth: 10
""")

        # Create training data
        training_file = temp_dir / "training.csv"
        training_file.write_text("feature1,feature2,target_column\n1,2,0\n3,4,1\n5,6,0\n7,8,1")

        # Mock ML pipeline responses
        ml_responses = {
            'create_pipeline': {
                'pipeline_id': 'ml-integration-123',
                'name': 'integration-test-pipeline',
                'status': 'created'
            },
            'train_model': {
                'job_id': 'train-job-123',
                'pipeline_id': 'ml-integration-123',
                'status': 'running',
                'progress': {'current_epoch': 0, 'total_epochs': 100}
            },
            'get_training_status': {
                'job_id': 'train-job-123',
                'status': 'completed',
                'metrics': {'accuracy': 0.92, 'precision': 0.89}
            },
            'make_prediction': {
                'predictions': [0.2, 0.8],
                'confidence': [0.85, 0.92]
            }
        }

        mock_client.ml.create_pipeline.return_value = ml_responses['create_pipeline']
        mock_client.ml.train_model.return_value = ml_responses['train_model']
        mock_client.ml.get_training_status.return_value = ml_responses['get_training_status']
        mock_client.ml.make_prediction.return_value = ml_responses['make_prediction']

        with patch('schlep_cli.commands.pipeline.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.pipeline.APIClient', return_value=mock_client):
                # Step 1: Create pipeline
                create_result = runner.invoke(cli, [
                    'pipeline', 'create',
                    '--name', 'integration-test-pipeline',
                    '--config', str(pipeline_config)
                ])
                assert create_result.exit_code == 0
                assert 'ml-integration-123' in create_result.output

                # Step 2: Train model
                train_result = runner.invoke(cli, [
                    'pipeline', 'train', 'ml-integration-123',
                    '--dataset', str(training_file),
                    '--wait'
                ])
                assert train_result.exit_code == 0
                assert 'train-job-123' in train_result.output

                # Step 3: Make prediction
                prediction_input = temp_dir / "predict_input.json"
                prediction_input.write_text('[{"feature1": 1, "feature2": 2}]')
                
                prediction_output = temp_dir / "predictions.json"
                
                predict_result = runner.invoke(cli, [
                    'pipeline', 'predict', 'ml-integration-123',
                    '--input', str(prediction_input),
                    '--output', str(prediction_output)
                ])
                assert predict_result.exit_code == 0
                assert prediction_output.exists()

        # Verify predictions
        predictions = json.loads(prediction_output.read_text())
        assert 'predictions' in predictions
        assert len(predictions['predictions']) == 2

    def test_error_recovery_workflow(self, runner, auth_context, temp_dir, mock_client):
        """Test error recovery and retry mechanisms."""
        input_file = temp_dir / "error_test.csv"
        input_file.write_text("id,name\n1,Alice\n2,Bob")

        # Simulate transient failures followed by success
        call_count = 0
        def mock_process_file(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise ConnectionError("Temporary network error")
            return {
                'job_id': 'recovery-job-123',
                'status': 'running',
                'progress': {'current': 0, 'total': 100}
            }

        mock_client.data.process_file.side_effect = mock_process_file

        with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'file', str(input_file),
                    '--format', 'json',
                    '--retry', '3'
                ])

        assert result.exit_code == 0
        assert 'recovery-job-123' in result.output
        assert call_count == 3  # Should have retried twice

    def test_configuration_migration(self, runner, temp_dir):
        """Test configuration migration between versions."""
        # Create old format config
        old_config = temp_dir / "old_config.yml"
        old_config.write_text("""
# Old format configuration
api_key: sk-old-key-123
endpoint: https://old.api.com
workers: 2
""")

        # Simulate config migration
        with patch('schlep_cli.core.config.Config.get_config_file', return_value=old_config):
            with patch('schlep_cli.commands.config.migrate_config') as mock_migrate:
                mock_migrate.return_value = {
                    'api_key': 'sk-old-key-123',
                    'base_url': 'https://old.api.com',  # Migrated field name
                    'parallel_jobs': 2  # Migrated field name
                }
                
                result = runner.invoke(cli, ['config', 'migrate'])

        assert result.exit_code == 0
        assert 'Configuration migrated' in result.output


@pytest.mark.load
class TestCLILoadTesting:
    """Load testing for CLI operations."""

    def test_sustained_command_execution(self, runner, auth_context, mock_client):
        """Test sustained CLI command execution."""
        mock_client.data.list_jobs.return_value = {
            'jobs': [],
            'pagination': {'page': 1, 'total': 0, 'pages': 0}
        }

        duration = 30  # 30 seconds
        commands_per_second = 2
        total_commands = duration * commands_per_second
        
        successful_commands = 0
        failed_commands = 0
        
        start_time = time.time()
        
        for i in range(total_commands):
            with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
                with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                    result = runner.invoke(cli, ['process', 'list'])
                    
                    if result.exit_code == 0:
                        successful_commands += 1
                    else:
                        failed_commands += 1
            
            # Pace the requests
            if i < total_commands - 1:
                time.sleep(1.0 / commands_per_second)

        end_time = time.time()
        actual_duration = end_time - start_time
        actual_rps = total_commands / actual_duration
        success_rate = successful_commands / total_commands

        print(f"Load test results: {actual_rps:.2f} RPS, {success_rate:.2%} success rate")

        assert success_rate >= 0.95  # 95% success rate
        assert actual_rps >= commands_per_second * 0.8  # Within 20% of target

    def test_memory_stability_under_load(self, runner, auth_context, mock_client, temp_dir):
        """Test memory stability under sustained load."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Create test file
        test_file = temp_dir / "load_test.csv"
        test_file.write_text("id,data\n" + "\n".join([f"{i},data{i}" for i in range(1000)]))

        mock_client.data.process_file.return_value = {
            'job_id': 'load-test-job',
            'status': 'completed'
        }

        memory_samples = []
        
        # Run commands for extended period
        for i in range(100):
            with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
                with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                    result = runner.invoke(cli, [
                        'process', 'file', str(test_file),
                        '--format', 'json'
                    ])
                    
                    assert result.exit_code == 0
            
            # Sample memory every 10 iterations
            if i % 10 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)

        final_memory = process.memory_info().rss / 1024 / 1024
        memory_increase = final_memory - initial_memory
        
        # Check for memory leaks (steady increase)
        if len(memory_samples) > 2:
            memory_trend = memory_samples[-1] - memory_samples[0]
            assert memory_trend < 50  # No more than 50MB growth trend

        print(f"Memory stability: Initial {initial_memory:.1f}MB, Final {final_memory:.1f}MB, Increase {memory_increase:.1f}MB")
        
        assert memory_increase < 100  # Total increase should be reasonable


@pytest.mark.stress
class TestCLIStressTesting:
    """Stress testing for CLI edge cases."""

    def test_extremely_large_file_processing(self, runner, auth_context, temp_dir, mock_client):
        """Test processing extremely large files."""
        # Create very large file (100MB+)
        huge_file = temp_dir / "huge_file.csv"
        
        with open(huge_file, 'w') as f:
            f.write("id,data,description\n")
            for i in range(1000000):  # 1M rows
                f.write(f"{i},{'x' * 100},{i * 2}\n")

        mock_client.data.process_file.return_value = {
            'job_id': 'huge-file-job-123',
            'status': 'running',
            'progress': {'current': 0, 'total': 1000000}
        }

        start_time = time.time()
        
        with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'file', str(huge_file),
                    '--format', 'json',
                    '--batch-size', '10000'
                ])
        
        end_time = time.time()
        processing_time = end_time - start_time

        assert result.exit_code == 0
        assert processing_time < 60.0  # Should handle within 1 minute
        
        print(f"Huge file processing: {huge_file.stat().st_size / (1024*1024):.1f}MB in {processing_time:.2f}s")

    def test_command_with_extreme_parameters(self, runner, auth_context, mock_client):
        """Test commands with extreme parameter values."""
        mock_client.data.list_jobs.return_value = {
            'jobs': [{'job_id': f'extreme-job-{i}', 'status': 'completed'} for i in range(1000)],
            'pagination': {'page': 1, 'total': 1000, 'pages': 100}
        }

        with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
            with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                result = runner.invoke(cli, [
                    'process', 'list',
                    '--limit', '1000',  # Extreme limit
                    '--page', '1'
                ])

        assert result.exit_code == 0
        # Should handle large result sets gracefully

    def test_rapid_fire_commands(self, runner, auth_context, mock_client):
        """Test rapid-fire command execution."""
        mock_client.data.get_job_status.return_value = {
            'job_id': 'rapid-fire-job',
            'status': 'completed'
        }

        start_time = time.time()
        
        # Execute 100 commands as fast as possible
        for i in range(100):
            with patch('schlep_cli.commands.process.get_auth_context', return_value=auth_context):
                with patch('schlep_cli.commands.process.APIClient', return_value=mock_client):
                    result = runner.invoke(cli, ['process', 'status', f'rapid-job-{i}'])
                    assert result.exit_code == 0
        
        end_time = time.time()
        total_time = end_time - start_time
        commands_per_second = 100 / total_time

        print(f"Rapid-fire test: {commands_per_second:.1f} commands/second")
        
        assert commands_per_second > 10  # Should achieve at least 10 commands/second


# Utility functions for integration tests
def create_test_data_file(file_path: Path, rows: int = 1000) -> Path:
    """Create a test data file with specified number of rows."""
    with open(file_path, 'w') as f:
        f.write("id,name,email,age,department\n")
        for i in range(rows):
            f.write(f"{i},User{i},user{i}@test.com,{25+i%40},Dept{i%5}\n")
    return file_path


def measure_command_performance(runner, command_args, iterations=10):
    """Measure performance of a CLI command over multiple iterations."""
    times = []
    
    for _ in range(iterations):
        start = time.time()
        result = runner.invoke(cli, command_args)
        end = time.time()
        
        if result.exit_code == 0:
            times.append(end - start)
    
    if times:
        return {
            'avg_time': sum(times) / len(times),
            'min_time': min(times),
            'max_time': max(times),
            'success_rate': len(times) / iterations
        }
    else:
        return {'success_rate': 0}