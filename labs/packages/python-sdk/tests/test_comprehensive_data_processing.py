"""
Comprehensive data processing API tests for Igris-engine Python SDK
"""

import pytest
import asyncio
import io
from unittest.mock import AsyncMock, MagicMock, patch, mock_open
from pathlib import Path

from igris.api.data_processing import DataProcessingAPI
from igris.models.data import (
    ProcessingJob, DataSource, ProcessingConfig, ProcessingResult,
    DataFormat, ValidationResult, QualityMetrics
)
from igris.exceptions.base import APIError, ValidationError
from igris.models.common import PaginationInfo


class TestDataProcessingAPI:
    """Comprehensive tests for DataProcessingAPI."""

    @pytest.fixture
    def data_api(self, client):
        """Data processing API instance."""
        return DataProcessingAPI(client.http_client)

    @pytest.fixture
    def sample_processing_job(self):
        """Sample processing job data."""
        return ProcessingJob(
            job_id="job-123",
            status="running",
            progress={"current": 50, "total": 100},
            created_at="2024-01-01T12:00:00Z",
            estimated_completion="2024-01-01T12:30:00Z",
            config=ProcessingConfig(
                output_format=DataFormat.JSON,
                batch_size=1000,
                parallel_processing=True,
                quality_checks=True
            ),
            result=None
        )

    @pytest.fixture
    def sample_data_source(self):
        """Sample data source."""
        return DataSource(
            source_id="source-123",
            name="test-dataset.csv",
            format=DataFormat.CSV,
            size_bytes=1024000,
            row_count=10000,
            column_count=15,
            created_at="2024-01-01T10:00:00Z"
        )

    @pytest.mark.asyncio
    async def test_process_file_success(self, data_api, sample_processing_job):
        """Test successful file processing."""
        file_content = b"id,name,value\n1,Alice,100\n2,Bob,200"
        file_obj = io.BytesIO(file_content)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_processing_job.dict()
            }
            
            result = await data_api.process_file(
                file=file_obj,
                filename="test.csv",
                config=ProcessingConfig(output_format=DataFormat.JSON)
            )
            
            assert isinstance(result, ProcessingJob)
            assert result.job_id == "job-123"
            assert result.status == "running"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_file_with_progress_callback(self, data_api, sample_processing_job):
        """Test file processing with progress callback."""
        file_content = b"id,name,value\n1,Alice,100\n2,Bob,200"
        file_obj = io.BytesIO(file_content)
        
        progress_updates = []
        
        def progress_callback(progress_info):
            progress_updates.append(progress_info)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_processing_job.dict()
            }
            
            await data_api.process_file(
                file=file_obj,
                filename="test.csv",
                config=ProcessingConfig(output_format=DataFormat.JSON),
                progress_callback=progress_callback
            )
            
            # Progress callback should be stored for later use
            assert hasattr(data_api, '_progress_callbacks')

    @pytest.mark.asyncio
    async def test_process_file_invalid_format(self, data_api):
        """Test processing file with invalid format."""
        file_content = b"invalid binary content"
        file_obj = io.BytesIO(file_content)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Unsupported file format", status_code=400)
            
            with pytest.raises(APIError) as exc_info:
                await data_api.process_file(
                    file=file_obj,
                    filename="test.bin",
                    config=ProcessingConfig(output_format=DataFormat.JSON)
                )
            
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_process_large_file(self, data_api, sample_processing_job):
        """Test processing large file with chunked upload."""
        # Simulate large file (> 100MB)
        large_content = b"a" * (100 * 1024 * 1024 + 1)
        file_obj = io.BytesIO(large_content)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_processing_job.dict()
            }
            
            with patch.object(data_api, '_upload_large_file', new_callable=AsyncMock) as mock_upload:
                mock_upload.return_value = "upload-id-123"
                
                result = await data_api.process_file(
                    file=file_obj,
                    filename="large_file.csv",
                    config=ProcessingConfig(output_format=DataFormat.JSON)
                )
                
                mock_upload.assert_called_once()
                assert isinstance(result, ProcessingJob)

    @pytest.mark.asyncio
    async def test_get_job_status(self, data_api, sample_processing_job):
        """Test getting job status."""
        with patch.object(data_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": sample_processing_job.dict()
            }
            
            result = await data_api.get_job_status("job-123")
            
            assert isinstance(result, ProcessingJob)
            assert result.job_id == "job-123"
            mock_get.assert_called_once_with("/api/v1/data/jobs/job-123")

    @pytest.mark.asyncio
    async def test_get_job_status_not_found(self, data_api):
        """Test getting status for non-existent job."""
        with patch.object(data_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = APIError("Job not found", status_code=404)
            
            with pytest.raises(APIError) as exc_info:
                await data_api.get_job_status("nonexistent-job")
            
            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_wait_for_completion(self, data_api):
        """Test waiting for job completion."""
        job_states = [
            ProcessingJob(
                job_id="job-123",
                status="running",
                progress={"current": 25, "total": 100},
                created_at="2024-01-01T12:00:00Z"
            ),
            ProcessingJob(
                job_id="job-123",
                status="running",
                progress={"current": 75, "total": 100},
                created_at="2024-01-01T12:00:00Z"
            ),
            ProcessingJob(
                job_id="job-123",
                status="completed",
                progress={"current": 100, "total": 100},
                created_at="2024-01-01T12:00:00Z",
                result=ProcessingResult(
                    output_url="https://storage.com/result.json",
                    quality_metrics=QualityMetrics(
                        completeness=0.95,
                        accuracy=0.98,
                        consistency=0.92
                    )
                )
            )
        ]
        
        call_count = 0
        
        async def mock_get_status(*args, **kwargs):
            nonlocal call_count
            result = job_states[min(call_count, len(job_states) - 1)]
            call_count += 1
            return result
        
        with patch.object(data_api, 'get_job_status', side_effect=mock_get_status):
            result = await data_api.wait_for_completion(
                "job-123",
                timeout=10,
                poll_interval=0.1
            )
            
            assert result.status == "completed"
            assert result.result is not None
            assert call_count >= 3

    @pytest.mark.asyncio
    async def test_wait_for_completion_timeout(self, data_api):
        """Test waiting for job completion with timeout."""
        running_job = ProcessingJob(
            job_id="job-123",
            status="running",
            progress={"current": 50, "total": 100},
            created_at="2024-01-01T12:00:00Z"
        )
        
        with patch.object(data_api, 'get_job_status', return_value=running_job):
            with pytest.raises(TimeoutError):
                await data_api.wait_for_completion(
                    "job-123",
                    timeout=0.2,
                    poll_interval=0.1
                )

    @pytest.mark.asyncio
    async def test_cancel_job(self, data_api):
        """Test cancelling a processing job."""
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {"success": True, "message": "Job cancelled"}
            
            result = await data_api.cancel_job("job-123")
            
            assert result is True
            mock_post.assert_called_once_with("/api/v1/data/jobs/job-123/cancel")

    @pytest.mark.asyncio
    async def test_list_jobs(self, data_api, sample_processing_job):
        """Test listing processing jobs."""
        jobs_data = {
            "jobs": [sample_processing_job.dict()],
            "pagination": {
                "page": 1,
                "per_page": 10,
                "total": 1,
                "pages": 1
            }
        }
        
        with patch.object(data_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"success": True, "data": jobs_data}
            
            result = await data_api.list_jobs(page=1, per_page=10, status="running")
            
            assert len(result["jobs"]) == 1
            assert isinstance(result["jobs"][0], ProcessingJob)
            assert isinstance(result["pagination"], PaginationInfo)
            mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_validate_data_source(self, data_api, sample_data_source):
        """Test data source validation."""
        validation_result = ValidationResult(
            is_valid=True,
            errors=[],
            warnings=["Column 'age' has missing values"],
            suggestions=["Consider filling missing values in 'age' column"]
        )
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": {
                    "source": sample_data_source.dict(),
                    "validation": validation_result.dict()
                }
            }
            
            file_content = b"id,name,age\n1,Alice,25\n2,Bob,\n"
            file_obj = io.BytesIO(file_content)
            
            result = await data_api.validate_data_source(
                file=file_obj,
                filename="test.csv"
            )
            
            assert result["validation"].is_valid is True
            assert len(result["validation"].warnings) == 1
            assert isinstance(result["source"], DataSource)

    @pytest.mark.asyncio
    async def test_get_processing_templates(self, data_api):
        """Test getting processing templates."""
        templates = [
            {
                "id": "template-1",
                "name": "Data Cleaning",
                "description": "Basic data cleaning pipeline",
                "config": ProcessingConfig(
                    output_format=DataFormat.JSON,
                    quality_checks=True
                ).dict()
            }
        ]
        
        with patch.object(data_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"success": True, "data": templates}
            
            result = await data_api.get_processing_templates()
            
            assert len(result) == 1
            assert result[0]["name"] == "Data Cleaning"

    @pytest.mark.asyncio
    async def test_download_result(self, data_api):
        """Test downloading processing result."""
        result_content = b'{"data": [{"id": 1, "name": "Alice"}]}'
        
        with patch.object(data_api.http_client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = result_content
            
            content = await data_api.download_result("job-123")
            
            assert content == result_content
            mock_get.assert_called_once_with("/api/v1/data/jobs/job-123/result")

    @pytest.mark.asyncio
    async def test_batch_process_files(self, data_api, sample_processing_job):
        """Test batch processing multiple files."""
        files = [
            io.BytesIO(b"id,name\n1,Alice"),
            io.BytesIO(b"id,name\n2,Bob"),
            io.BytesIO(b"id,name\n3,Charlie")
        ]
        filenames = ["file1.csv", "file2.csv", "file3.csv"]
        
        batch_job = ProcessingJob(
            job_id="batch-job-123",
            status="running",
            progress={"current": 0, "total": 3},
            created_at="2024-01-01T12:00:00Z",
            config=ProcessingConfig(
                output_format=DataFormat.JSON,
                batch_size=1000
            )
        )
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": batch_job.dict()
            }
            
            result = await data_api.batch_process_files(
                files=files,
                filenames=filenames,
                config=ProcessingConfig(output_format=DataFormat.JSON)
            )
            
            assert isinstance(result, ProcessingJob)
            assert result.job_id == "batch-job-123"


class TestDataProcessingConfiguration:
    """Test processing configuration and validation."""

    def test_processing_config_validation(self):
        """Test processing configuration validation."""
        # Valid configuration
        config = ProcessingConfig(
            output_format=DataFormat.JSON,
            batch_size=1000,
            parallel_processing=True,
            quality_checks=True
        )
        assert config.batch_size == 1000
        assert config.parallel_processing is True

    def test_processing_config_invalid_batch_size(self):
        """Test processing configuration with invalid batch size."""
        with pytest.raises(ValidationError):
            ProcessingConfig(
                output_format=DataFormat.JSON,
                batch_size=-1  # Invalid
            )

    def test_processing_config_defaults(self):
        """Test processing configuration default values."""
        config = ProcessingConfig(output_format=DataFormat.JSON)
        
        assert config.batch_size > 0
        assert config.parallel_processing in [True, False]
        assert config.quality_checks in [True, False]


class TestErrorHandling:
    """Test error handling in data processing."""

    @pytest.mark.asyncio
    async def test_network_error_retry(self, data_api, sample_processing_job):
        """Test retry mechanism for network errors."""
        file_content = b"id,name\n1,Alice"
        file_obj = io.BytesIO(file_content)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            # First two calls fail, third succeeds
            mock_post.side_effect = [
                APIError("Network error", status_code=500),
                APIError("Network error", status_code=500),
                {"success": True, "data": sample_processing_job.dict()}
            ]
            
            result = await data_api.process_file(
                file=file_obj,
                filename="test.csv",
                config=ProcessingConfig(output_format=DataFormat.JSON)
            )
            
            assert isinstance(result, ProcessingJob)
            assert mock_post.call_count == 3

    @pytest.mark.asyncio
    async def test_rate_limit_handling(self, data_api):
        """Test rate limit handling."""
        file_content = b"id,name\n1,Alice"
        file_obj = io.BytesIO(file_content)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = APIError("Rate limit exceeded", status_code=429)
            
            with pytest.raises(APIError) as exc_info:
                await data_api.process_file(
                    file=file_obj,
                    filename="test.csv",
                    config=ProcessingConfig(output_format=DataFormat.JSON)
                )
            
            assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_malformed_response_handling(self, data_api):
        """Test handling of malformed API responses."""
        file_content = b"id,name\n1,Alice"
        file_obj = io.BytesIO(file_content)
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            # Return malformed response
            mock_post.return_value = {"success": True}  # Missing 'data' field
            
            with pytest.raises((KeyError, ValidationError)):
                await data_api.process_file(
                    file=file_obj,
                    filename="test.csv",
                    config=ProcessingConfig(output_format=DataFormat.JSON)
                )


@pytest.mark.integration
class TestDataProcessingIntegration:
    """Integration tests for data processing (requires test API)."""

    @pytest.mark.asyncio
    async def test_end_to_end_processing(self):
        """Test complete data processing workflow."""
        pytest.skip("Integration test - requires real API endpoint")

    @pytest.mark.asyncio
    async def test_real_file_processing(self):
        """Test processing real files against API."""
        pytest.skip("Integration test - requires real API endpoint and test files")


class TestPerformance:
    """Performance tests for data processing operations."""

    @pytest.mark.asyncio
    async def test_concurrent_file_processing(self, data_api, sample_processing_job):
        """Test concurrent file processing requests."""
        files = [io.BytesIO(b"id,name\n1,Alice") for _ in range(10)]
        filenames = [f"test_{i}.csv" for i in range(10)]
        
        with patch.object(data_api.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {
                "success": True,
                "data": sample_processing_job.dict()
            }
            
            tasks = [
                data_api.process_file(
                    file=file,
                    filename=filename,
                    config=ProcessingConfig(output_format=DataFormat.JSON)
                )
                for file, filename in zip(files, filenames)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # All should succeed
            for result in results:
                if isinstance(result, Exception):
                    pytest.fail(f"Concurrent request failed: {result}")
                assert isinstance(result, ProcessingJob)

    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_large_file_processing_performance(self, data_api):
        """Test performance with large files."""
        # This test is marked as slow
        pytest.skip("Slow performance test - run with -m slow")