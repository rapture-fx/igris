"""
Comprehensive integration tests for Igris-engine Python SDK

These tests verify integration with real API endpoints and cross-SDK compatibility.
They should only be run in integration test environments with proper API keys.
"""

import pytest
import asyncio
import os
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta

from igris import IgrisClient
from igris.models.data import JobStatus, ExportFormat
from igris.models.ml import MLJobStatus
from igris.exceptions.base import APIError, ValidationError


# Integration test markers
pytestmark = pytest.mark.integration


@pytest.fixture(scope="session")
def integration_client():
    """Create client for integration tests."""
    api_key = os.getenv("IGRIS_API_KEY")
    base_url = os.getenv("IGRIS_BASE_URL", "https://api.igris-inertial.com")
    
    if not api_key:
        pytest.skip("Integration tests require IGRIS_API_KEY environment variable")
    
    return IgrisClient(api_key=api_key, base_url=base_url)


@pytest.fixture
def sample_csv_data():
    """Sample CSV data for testing."""
    return """name,age,city,email
John Doe,30,New York,john@example.com
Jane Smith,25,Los Angeles,jane@example.com
Bob Johnson,35,Chicago,bob@example.com
Alice Brown,28,Houston,alice@example.com
Charlie Wilson,32,Phoenix,charlie@example.com"""


@pytest.fixture
def test_data_file(sample_csv_data):
    """Create temporary test data file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(sample_csv_data)
        temp_file = f.name
    
    yield temp_file
    
    # Cleanup
    try:
        os.unlink(temp_file)
    except OSError:
        pass


class TestDataProcessingIntegration:
    """Integration tests for data processing operations."""

    @pytest.mark.asyncio
    async def test_complete_data_processing_workflow(self, integration_client, test_data_file):
        """Test complete data processing workflow from upload to download."""
        # Step 1: Upload file
        uploaded_file = await integration_client.data.upload_file(test_data_file)
        assert uploaded_file.file_id is not None
        assert uploaded_file.status in ['uploaded', 'processed']
        
        # Step 2: Create processing job
        processing_config = {
            'format': 'csv',
            'delimiter': ',',
            'headers': True,
            'validation_rules': ['required_fields']
        }
        
        job = await integration_client.data.create_processing_job(
            files=[uploaded_file.file_id],
            config=processing_config
        )
        assert job.job_id is not None
        assert job.status in [JobStatus.PENDING, JobStatus.RUNNING]
        
        # Step 3: Wait for completion
        final_job = await integration_client.data.wait_for_completion(
            job.job_id, 
            poll_interval=2.0, 
            timeout=300  # 5 minutes
        )
        assert final_job.status == JobStatus.COMPLETED
        assert final_job.processed_records > 0
        
        # Step 4: Download results
        results = await integration_client.data.download_results(
            job.job_id,
            format=ExportFormat.CSV
        )
        assert len(results) > 0
        
        # Verify results contain expected data
        result_text = results.decode('utf-8')
        assert 'name' in result_text  # Header should be present
        assert 'John Doe' in result_text  # Sample data should be present

    @pytest.mark.asyncio
    async def test_data_validation_integration(self, integration_client, test_data_file):
        """Test data validation with real API."""
        # Upload file first
        uploaded_file = await integration_client.data.upload_file(test_data_file)
        
        # Validate the uploaded file
        validation_result = await integration_client.data.validate_data(uploaded_file.file_id)
        
        assert validation_result.is_valid is not None
        assert isinstance(validation_result.errors, list)
        assert isinstance(validation_result.warnings, list)
        assert 'total_rows' in validation_result.summary
        assert validation_result.summary['total_rows'] == 5  # Our test data has 5 rows

    @pytest.mark.asyncio
    async def test_data_quality_report_integration(self, integration_client, test_data_file):
        """Test data quality report generation."""
        # Upload and process file
        uploaded_file = await integration_client.data.upload_file(test_data_file)
        
        # Get data quality report
        quality_report = await integration_client.data.get_data_quality_report(uploaded_file.file_id)
        
        assert quality_report.file_id == uploaded_file.file_id
        assert 0 <= quality_report.overall_score <= 100
        assert 0 <= quality_report.completeness_score <= 100
        assert 0 <= quality_report.accuracy_score <= 100
        assert isinstance(quality_report.issues, list)
        assert isinstance(quality_report.recommendations, list)

    @pytest.mark.asyncio
    async def test_concurrent_job_processing(self, integration_client, test_data_file):
        """Test processing multiple jobs concurrently."""
        # Upload multiple files
        upload_tasks = []
        for i in range(3):
            upload_tasks.append(integration_client.data.upload_file(test_data_file))
        
        uploaded_files = await asyncio.gather(*upload_tasks)
        
        # Create multiple processing jobs
        job_tasks = []
        for uploaded_file in uploaded_files:
            config = {'format': 'csv', 'headers': True}
            job_tasks.append(
                integration_client.data.create_processing_job([uploaded_file.file_id], config)
            )
        
        jobs = await asyncio.gather(*job_tasks)
        
        # Wait for all jobs to complete
        completion_tasks = []
        for job in jobs:
            completion_tasks.append(
                integration_client.data.wait_for_completion(job.job_id, timeout=300)
            )
        
        completed_jobs = await asyncio.gather(*completion_tasks)
        
        # Verify all jobs completed successfully
        for completed_job in completed_jobs:
            assert completed_job.status == JobStatus.COMPLETED
            assert completed_job.processed_records > 0


class TestMLIntegration:
    """Integration tests for ML pipeline operations."""

    @pytest.mark.asyncio
    async def test_ml_training_workflow(self, integration_client, test_data_file):
        """Test complete ML training workflow."""
        # First, process data for ML training
        uploaded_file = await integration_client.data.upload_file(test_data_file)
        
        processing_config = {
            'format': 'csv',
            'headers': True,
            'validation_rules': ['required_fields']
        }
        
        processing_job = await integration_client.data.create_processing_job(
            [uploaded_file.file_id], 
            processing_config
        )
        
        await integration_client.data.wait_for_completion(
            processing_job.job_id, 
            timeout=300
        )
        
        # Create ML training job
        training_config = {
            'algorithm': 'random_forest',
            'target_column': 'age',  # Using age as target for regression
            'hyperparameters': {
                'n_estimators': 10,  # Small number for faster testing
                'max_depth': 5
            },
            'test_size': 0.3
        }
        
        ml_job = await integration_client.ml.create_training_job(
            dataset_id=processing_job.job_id,
            target_column='age',
            config=training_config
        )
        
        assert ml_job.job_id is not None
        assert ml_job.status in [MLJobStatus.PENDING, MLJobStatus.TRAINING]
        
        # Wait for training to complete (with extended timeout for ML)
        final_ml_job = await integration_client.ml.wait_for_training_completion(
            ml_job.job_id,
            poll_interval=5.0,
            timeout=1800  # 30 minutes for ML training
        )
        
        assert final_ml_job.status == MLJobStatus.COMPLETED
        
        # Get model metrics
        if hasattr(final_ml_job, 'model_id') and final_ml_job.model_id:
            metrics = await integration_client.ml.get_model_metrics(final_ml_job.model_id)
            assert metrics is not None
            # Verify metrics contain expected fields
            expected_metrics = ['accuracy', 'precision', 'recall', 'f1_score']
            for metric in expected_metrics:
                if hasattr(metrics, metric):
                    assert 0 <= getattr(metrics, metric) <= 1

    @pytest.mark.asyncio
    async def test_model_inference_integration(self, integration_client):
        """Test model inference with real model (requires existing trained model)."""
        # This test assumes there's a trained model available
        # In a real integration environment, you might have test models pre-deployed
        
        try:
            # Try to get list of available models
            models_response = await integration_client.ml.list_models()
            
            if not models_response or len(models_response.get('models', [])) == 0:
                pytest.skip("No trained models available for inference testing")
            
            # Use the first available model
            model = models_response['models'][0]
            model_id = model.get('model_id')
            
            if not model_id:
                pytest.skip("No valid model ID found")
            
            # Test single prediction
            test_input = {
                'age': 30,
                'city': 'New York'
            }
            
            prediction = await integration_client.ml.predict_single(
                model_id=model_id,
                input_data=test_input
            )
            
            assert 'prediction' in prediction
            assert 'probability' in prediction or 'confidence' in prediction
            
        except APIError as e:
            if e.status_code == 404:
                pytest.skip("No models available for testing")
            else:
                raise


class TestWebSocketIntegration:
    """Integration tests for WebSocket functionality."""

    @pytest.mark.asyncio
    async def test_websocket_connection_and_messaging(self, integration_client):
        """Test WebSocket connection and real-time messaging."""
        # This test requires WebSocket endpoint to be available
        try:
            from igris.websocket.streaming_client import StreamingClient
            
            config = {
                'url': f"wss://{integration_client.base_url.replace('https://', '').replace('http://', '')}/stream",
                'auth_token': integration_client.auth_manager.get_auth_headers().get('Authorization', '').replace('Bearer ', ''),
                'reconnect_interval': 1.0,
                'max_reconnect_attempts': 3
            }
            
            streaming_client = StreamingClient(config)
            
            messages_received = []
            
            def message_handler(message):
                messages_received.append(message)
            
            streaming_client.on_message(message_handler)
            
            # Connect to WebSocket
            await streaming_client.connect()
            assert streaming_client.is_connected()
            
            # Subscribe to a channel
            await streaming_client.subscribe('test_channel')
            assert streaming_client.is_subscribed('test_channel')
            
            # Send a test message
            test_message = {
                'type': 'test',
                'payload': {'timestamp': datetime.now().isoformat()}
            }
            
            await streaming_client.send_message(test_message)
            
            # Wait for potential response
            await asyncio.sleep(2)
            
            # Disconnect
            await streaming_client.disconnect()
            assert not streaming_client.is_connected()
            
        except ImportError:
            pytest.skip("WebSocket client not available")
        except Exception as e:
            if "connection refused" in str(e).lower() or "404" in str(e):
                pytest.skip("WebSocket endpoint not available")
            else:
                raise


class TestCrossSDKCompatibility:
    """Test compatibility between different SDK implementations."""

    @pytest.mark.asyncio
    async def test_api_response_consistency(self, integration_client, test_data_file):
        """Test that API responses are consistent for cross-SDK compatibility."""
        # Upload file and verify response format
        uploaded_file = await integration_client.data.upload_file(test_data_file)
        
        # Verify response contains expected fields that should be consistent across SDKs
        expected_fields = ['file_id', 'filename', 'size', 'content_type', 'status']
        for field in expected_fields:
            assert hasattr(uploaded_file, field), f"Missing field: {field}"
        
        # Create job and verify response format
        job = await integration_client.data.create_processing_job(
            [uploaded_file.file_id],
            {'format': 'csv', 'headers': True}
        )
        
        job_expected_fields = ['job_id', 'status', 'created_at', 'updated_at']
        for field in job_expected_fields:
            assert hasattr(job, field), f"Missing job field: {field}"
        
        # Verify status values are consistent
        valid_statuses = [JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED]
        assert job.status in valid_statuses

    @pytest.mark.asyncio
    async def test_error_response_format(self, integration_client):
        """Test that error responses follow consistent format across SDKs."""
        # Try to access non-existent resource
        with pytest.raises(APIError) as exc_info:
            await integration_client.data.get_job_status("nonexistent_job_12345")
        
        error = exc_info.value
        
        # Verify error has expected attributes
        assert hasattr(error, 'message')
        assert hasattr(error, 'status_code')
        assert error.status_code == 404
        
        # Try invalid operation
        with pytest.raises(ValidationError) as exc_info:
            await integration_client.data.create_processing_job([], {})  # Empty files list
        
        validation_error = exc_info.value
        assert hasattr(validation_error, 'message')

    @pytest.mark.asyncio
    async def test_pagination_consistency(self, integration_client):
        """Test that pagination works consistently across endpoints."""
        # Test job listing with pagination
        page1 = await integration_client.data.list_jobs(
            pagination={'page': 1, 'per_page': 5}
        )
        
        # Verify pagination response format
        expected_pagination_fields = ['jobs', 'total', 'page', 'per_page', 'has_next']
        for field in expected_pagination_fields:
            assert hasattr(page1, field) or field in page1, f"Missing pagination field: {field}"
        
        # If there are more jobs, test next page
        if getattr(page1, 'has_next', False) or (isinstance(page1, dict) and page1.get('has_next')):
            page2 = await integration_client.data.list_jobs(
                pagination={'page': 2, 'per_page': 5}
            )
            
            # Verify page numbers are different
            page1_jobs = getattr(page1, 'jobs', page1.get('jobs', []))
            page2_jobs = getattr(page2, 'jobs', page2.get('jobs', []))
            
            # Jobs should be different (assuming we have enough jobs)
            if len(page2_jobs) > 0:
                page1_ids = [job.job_id if hasattr(job, 'job_id') else job.get('job_id') for job in page1_jobs]
                page2_ids = [job.job_id if hasattr(job, 'job_id') else job.get('job_id') for job in page2_jobs]
                assert set(page1_ids).isdisjoint(set(page2_ids))


class TestPerformanceIntegration:
    """Integration tests for performance characteristics."""

    @pytest.mark.asyncio
    async def test_large_file_processing(self, integration_client):
        """Test processing larger files to verify performance."""
        # Create a larger CSV file
        large_data = "name,age,city,email,score\n"
        for i in range(1000):  # 1000 rows
            large_data += f"User{i},{20 + i % 60},City{i % 10},user{i}@example.com,{i % 100}\n"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(large_data)
            large_file = f.name
        
        try:
            start_time = datetime.now()
            
            # Upload large file
            uploaded_file = await integration_client.data.upload_file(large_file)
            assert uploaded_file.file_id is not None
            
            # Process the file
            processing_config = {
                'format': 'csv',
                'headers': True,
                'validation_rules': ['required_fields']
            }
            
            job = await integration_client.data.create_processing_job(
                [uploaded_file.file_id],
                processing_config
            )
            
            # Wait for completion with extended timeout
            final_job = await integration_client.data.wait_for_completion(
                job.job_id,
                poll_interval=3.0,
                timeout=600  # 10 minutes for large file
            )
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds()
            
            assert final_job.status == JobStatus.COMPLETED
            assert final_job.processed_records == 1000
            
            # Verify reasonable processing time (should process 1000 rows in under 10 minutes)
            assert processing_time < 600
            
        finally:
            os.unlink(large_file)

    @pytest.mark.asyncio
    async def test_concurrent_api_requests(self, integration_client):
        """Test handling of concurrent API requests."""
        # Make multiple concurrent requests
        tasks = []
        for i in range(10):
            task = integration_client.data.list_jobs(
                pagination={'page': 1, 'per_page': 10}
            )
            tasks.append(task)
        
        start_time = datetime.now()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = datetime.now()
        
        # Verify all requests succeeded
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                pytest.fail(f"Request {i} failed: {result}")
        
        # Verify reasonable response time
        total_time = (end_time - start_time).total_seconds()
        avg_time_per_request = total_time / len(tasks)
        assert avg_time_per_request < 5.0  # Should average less than 5 seconds per request


class TestErrorScenarios:
    """Test various error scenarios in integration environment."""

    @pytest.mark.asyncio
    async def test_api_rate_limiting(self, integration_client):
        """Test API rate limiting behavior."""
        # Make rapid requests to trigger rate limiting
        tasks = []
        for i in range(100):  # Large number of concurrent requests
            task = integration_client.data.list_jobs(pagination={'page': 1, 'per_page': 1})
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful vs rate-limited requests
        successful = sum(1 for r in results if not isinstance(r, Exception))
        rate_limited = sum(1 for r in results if isinstance(r, APIError) and getattr(r, 'status_code', 0) == 429)
        
        # Should have some successful requests and potentially some rate-limited ones
        assert successful > 0
        
        # If rate limiting occurred, verify it was handled properly
        if rate_limited > 0:
            for result in results:
                if isinstance(result, APIError) and result.status_code == 429:
                    assert hasattr(result, 'retry_after') or 'retry' in result.message.lower()

    @pytest.mark.asyncio
    async def test_invalid_authentication(self, integration_client):
        """Test behavior with invalid authentication."""
        # Create client with invalid API key
        invalid_client = IgrisClient(
            api_key="invalid_api_key_12345",
            base_url=integration_client.base_url
        )
        
        # Should raise authentication error
        with pytest.raises(APIError) as exc_info:
            await invalid_client.data.list_jobs()
        
        assert exc_info.value.status_code in [401, 403]
        assert 'auth' in exc_info.value.message.lower() or 'unauthorized' in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_network_timeout_handling(self, integration_client):
        """Test network timeout handling."""
        # Create client with very short timeout
        timeout_client = IgrisClient(
            api_key=integration_client.auth_manager.get_auth_headers()['Authorization'].replace('Bearer ', ''),
            base_url=integration_client.base_url,
            timeout=0.001  # Very short timeout
        )
        
        # Should handle timeout gracefully
        with pytest.raises(Exception) as exc_info:
            await timeout_client.data.list_jobs()
        
        # Should be a timeout-related error
        assert 'timeout' in str(exc_info.value).lower() or 'time' in str(exc_info.value).lower()


# Utility functions for integration tests
def requires_api_key():
    """Decorator to skip tests if API key is not available."""
    return pytest.mark.skipif(
        not os.getenv("IGRIS_API_KEY"),
        reason="Integration tests require IGRIS_API_KEY environment variable"
    )


def requires_websocket():
    """Decorator to skip tests if WebSocket is not available."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                import websockets
                return func(*args, **kwargs)
            except ImportError:
                pytest.skip("WebSocket tests require websockets library")
        return wrapper
    return decorator