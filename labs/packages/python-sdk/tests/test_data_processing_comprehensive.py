"""
Comprehensive data processing tests for Schlep-engine Python SDK

This test suite covers all data processing API endpoints, file handling,
validation, error scenarios, and edge cases.
"""

import pytest
import asyncio
import io
import json
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch, mock_open
from datetime import datetime, timedelta
from pathlib import Path

from schlep_engine.api.data_processing import DataProcessingAPI
from schlep_engine.models.data import (
    ProcessingJob, 
    JobStatus, 
    DataFile, 
    ProcessingConfig,
    ValidationResult,
    DataQualityReport,
    ExportFormat
)
from schlep_engine.models.common import APIResponse, PaginationParams
from schlep_engine.exceptions.base import (
    APIError, 
    ValidationError, 
    FileUploadError, 
    ProcessingError,
    RateLimitError
)


class TestDataProcessingAPI:
    """Comprehensive tests for DataProcessingAPI."""

    @pytest.fixture
    def api_client(self):
        """Create a mock API client."""
        from schlep_engine.utils.http_client import HTTPClient
        http_client = AsyncMock(spec=HTTPClient)
        return DataProcessingAPI(http_client)

    @pytest.fixture
    def sample_processing_job(self):
        """Sample processing job for testing."""
        return ProcessingJob(
            job_id="job_12345",
            status=JobStatus.RUNNING,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            file_count=5,
            processed_records=1000,
            total_records=2000,
            config=ProcessingConfig(
                format="csv",
                delimiter=",",
                headers=True,
                validation_rules=["required_fields", "data_types"]
            ),
            metadata={
                "source": "api_upload",
                "user_id": "user123",
                "project": "data_pipeline_v1"
            }
        )

    @pytest.fixture
    def sample_data_file(self):
        """Sample data file for testing."""
        return DataFile(
            file_id="file_67890",
            filename="test_data.csv",
            size=1024000,
            content_type="text/csv",
            status="processed",
            upload_url="https://storage.example.com/upload/file_67890",
            download_url="https://storage.example.com/download/file_67890",
            metadata={
                "rows": 10000,
                "columns": 25,
                "encoding": "utf-8"
            }
        )

    @pytest.mark.asyncio
    async def test_create_processing_job_success(self, api_client, sample_processing_job):
        """Test successful processing job creation."""
        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=sample_processing_job.dict(),
            message="Job created successfully"
        )

        config = ProcessingConfig(
            format="csv",
            delimiter=",",
            headers=True
        )
        
        result = await api_client.create_processing_job(
            files=["file1.csv", "file2.csv"],
            config=config
        )

        assert isinstance(result, ProcessingJob)
        assert result.job_id == sample_processing_job.job_id
        assert result.status == JobStatus.RUNNING
        api_client.http_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_processing_job_validation_error(self, api_client):
        """Test job creation with validation errors."""
        api_client.http_client.post.side_effect = APIError(
            "Invalid file format", 
            status_code=400,
            error_code="VALIDATION_ERROR"
        )

        config = ProcessingConfig(format="invalid_format")
        
        with pytest.raises(ValidationError):
            await api_client.create_processing_job(
                files=["file1.txt"],
                config=config
            )

    @pytest.mark.asyncio
    async def test_get_job_status_success(self, api_client, sample_processing_job):
        """Test successful job status retrieval."""
        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=sample_processing_job.dict()
        )

        result = await api_client.get_job_status("job_12345")

        assert isinstance(result, ProcessingJob)
        assert result.job_id == "job_12345"
        assert result.status == JobStatus.RUNNING
        api_client.http_client.get.assert_called_once_with("/data-processing/jobs/job_12345")

    @pytest.mark.asyncio
    async def test_get_job_status_not_found(self, api_client):
        """Test job status retrieval for non-existent job."""
        api_client.http_client.get.side_effect = APIError(
            "Job not found",
            status_code=404,
            error_code="JOB_NOT_FOUND"
        )

        with pytest.raises(APIError) as exc_info:
            await api_client.get_job_status("nonexistent_job")

        assert exc_info.value.status_code == 404
        assert exc_info.value.error_code == "JOB_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_list_jobs_with_pagination(self, api_client, sample_processing_job):
        """Test listing jobs with pagination."""
        jobs_data = {
            "jobs": [sample_processing_job.dict()],
            "total": 1,
            "page": 1,
            "per_page": 10,
            "has_next": False
        }

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=jobs_data
        )

        pagination = PaginationParams(page=1, per_page=10)
        result = await api_client.list_jobs(
            pagination=pagination,
            status=JobStatus.RUNNING
        )

        assert len(result.jobs) == 1
        assert result.total == 1
        assert result.page == 1
        assert not result.has_next

    @pytest.mark.asyncio
    async def test_cancel_job_success(self, api_client):
        """Test successful job cancellation."""
        api_client.http_client.post.return_value = APIResponse(
            success=True,
            message="Job cancelled successfully"
        )

        result = await api_client.cancel_job("job_12345")

        assert result is True
        api_client.http_client.post.assert_called_once_with(
            "/data-processing/jobs/job_12345/cancel"
        )

    @pytest.mark.asyncio
    async def test_cancel_job_already_completed(self, api_client):
        """Test cancelling already completed job."""
        api_client.http_client.post.side_effect = APIError(
            "Cannot cancel completed job",
            status_code=400,
            error_code="INVALID_JOB_STATE"
        )

        with pytest.raises(ProcessingError):
            await api_client.cancel_job("job_12345")

    @pytest.mark.asyncio
    async def test_upload_file_success(self, api_client, sample_data_file):
        """Test successful file upload."""
        # Mock the upload process
        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=sample_data_file.dict()
        )

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
            tmp_file.write("header1,header2,header3\nvalue1,value2,value3\n")
            tmp_file.flush()

            result = await api_client.upload_file(tmp_file.name)

        assert isinstance(result, DataFile)
        assert result.filename == "test_data.csv"
        assert result.status == "processed"

    @pytest.mark.asyncio
    async def test_upload_file_too_large(self, api_client):
        """Test file upload with size limit exceeded."""
        api_client.http_client.post.side_effect = APIError(
            "File too large",
            status_code=413,
            error_code="FILE_TOO_LARGE"
        )

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv') as tmp_file:
            tmp_file.write("data" * 10000000)  # Large file
            tmp_file.flush()

            with pytest.raises(FileUploadError):
                await api_client.upload_file(tmp_file.name)

    @pytest.mark.asyncio
    async def test_upload_file_invalid_format(self, api_client):
        """Test file upload with invalid format."""
        api_client.http_client.post.side_effect = APIError(
            "Unsupported file format",
            status_code=400,
            error_code="INVALID_FILE_FORMAT"
        )

        with tempfile.NamedTemporaryFile(mode='w', suffix='.exe') as tmp_file:
            tmp_file.write("invalid content")
            tmp_file.flush()

            with pytest.raises(ValidationError):
                await api_client.upload_file(tmp_file.name)

    @pytest.mark.asyncio
    async def test_download_results_success(self, api_client):
        """Test successful results download."""
        mock_content = b"processed,data,content\nrow1,data1,value1\n"
        
        api_client.http_client.get.return_value = mock_content

        result = await api_client.download_results("job_12345", format=ExportFormat.CSV)

        assert result == mock_content
        api_client.http_client.get.assert_called_once_with(
            "/data-processing/jobs/job_12345/results",
            params={"format": "csv"}
        )

    @pytest.mark.asyncio
    async def test_download_results_job_not_completed(self, api_client):
        """Test downloading results from incomplete job."""
        api_client.http_client.get.side_effect = APIError(
            "Job not completed",
            status_code=400,
            error_code="JOB_NOT_COMPLETED"
        )

        with pytest.raises(ProcessingError):
            await api_client.download_results("job_12345")

    @pytest.mark.asyncio
    async def test_validate_data_success(self, api_client):
        """Test successful data validation."""
        validation_result = ValidationResult(
            is_valid=True,
            errors=[],
            warnings=["Minor formatting inconsistency in row 5"],
            summary={
                "total_rows": 1000,
                "valid_rows": 1000,
                "invalid_rows": 0,
                "data_quality_score": 95.5
            }
        )

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=validation_result.dict()
        )

        result = await api_client.validate_data("file_67890")

        assert isinstance(result, ValidationResult)
        assert result.is_valid is True
        assert len(result.warnings) == 1
        assert result.summary["data_quality_score"] == 95.5

    @pytest.mark.asyncio
    async def test_validate_data_with_errors(self, api_client):
        """Test data validation with validation errors."""
        validation_result = ValidationResult(
            is_valid=False,
            errors=[
                "Missing required field 'email' in row 10",
                "Invalid date format in row 25"
            ],
            warnings=["Inconsistent casing in 'Name' field"],
            summary={
                "total_rows": 100,
                "valid_rows": 98,
                "invalid_rows": 2,
                "data_quality_score": 85.0
            }
        )

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data=validation_result.dict()
        )

        result = await api_client.validate_data("file_67890")

        assert result.is_valid is False
        assert len(result.errors) == 2
        assert "Missing required field" in result.errors[0]

    @pytest.mark.asyncio
    async def test_get_data_quality_report(self, api_client):
        """Test data quality report generation."""
        quality_report = DataQualityReport(
            file_id="file_67890",
            overall_score=88.5,
            completeness_score=95.0,
            accuracy_score=85.0,
            consistency_score=90.0,
            validity_score=84.5,
            issues=[
                {
                    "type": "missing_values",
                    "field": "phone_number",
                    "count": 15,
                    "severity": "medium"
                },
                {
                    "type": "format_inconsistency", 
                    "field": "date_created",
                    "count": 8,
                    "severity": "low"
                }
            ],
            recommendations=[
                "Consider making phone_number field optional or implement validation",
                "Standardize date format across all records"
            ],
            generated_at=datetime.now()
        )

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=quality_report.dict()
        )

        result = await api_client.get_data_quality_report("file_67890")

        assert isinstance(result, DataQualityReport)
        assert result.overall_score == 88.5
        assert len(result.issues) == 2
        assert len(result.recommendations) == 2

    @pytest.mark.asyncio
    async def test_rate_limiting_handling(self, api_client):
        """Test rate limiting error handling."""
        api_client.http_client.post.side_effect = APIError(
            "Rate limit exceeded",
            status_code=429,
            error_code="RATE_LIMIT_EXCEEDED",
            headers={"Retry-After": "60"}
        )

        with pytest.raises(RateLimitError) as exc_info:
            await api_client.create_processing_job(files=["test.csv"])

        assert exc_info.value.retry_after == 60

    @pytest.mark.asyncio
    async def test_concurrent_job_operations(self, api_client, sample_processing_job):
        """Test concurrent job operations."""
        # Mock successful responses for all concurrent operations
        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=sample_processing_job.dict()
        )

        # Create multiple concurrent requests
        job_ids = ["job_1", "job_2", "job_3", "job_4", "job_5"]
        tasks = [api_client.get_job_status(job_id) for job_id in job_ids]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should succeed
        for result in results:
            assert isinstance(result, ProcessingJob)
            assert result.status == JobStatus.RUNNING

    @pytest.mark.asyncio
    async def test_job_polling_until_completion(self, api_client):
        """Test polling job status until completion."""
        # Mock progressive job states
        job_states = [
            ProcessingJob(
                job_id="job_12345",
                status=JobStatus.PENDING,
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            ProcessingJob(
                job_id="job_12345", 
                status=JobStatus.RUNNING,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                processed_records=500,
                total_records=1000
            ),
            ProcessingJob(
                job_id="job_12345",
                status=JobStatus.COMPLETED,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                processed_records=1000,
                total_records=1000
            )
        ]

        # Set up mock to return different states on subsequent calls
        api_client.http_client.get.side_effect = [
            APIResponse(success=True, data=state.dict()) for state in job_states
        ]

        final_job = await api_client.wait_for_completion(
            "job_12345",
            poll_interval=0.1,  # Fast polling for test
            timeout=10
        )

        assert final_job.status == JobStatus.COMPLETED
        assert final_job.processed_records == 1000
        assert api_client.http_client.get.call_count == 3

    @pytest.mark.asyncio
    async def test_job_polling_timeout(self, api_client):
        """Test job polling timeout."""
        running_job = ProcessingJob(
            job_id="job_12345",
            status=JobStatus.RUNNING,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=running_job.dict()
        )

        with pytest.raises(ProcessingError) as exc_info:
            await api_client.wait_for_completion(
                "job_12345",
                poll_interval=0.1,
                timeout=0.5  # Short timeout for test
            )

        assert "timeout" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_batch_file_upload(self, api_client):
        """Test batch file upload functionality."""
        # Create multiple temporary files
        temp_files = []
        for i in range(3):
            tmp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
            tmp_file.write(f"header1,header2\nvalue{i},data{i}\n")
            tmp_file.flush()
            temp_files.append(tmp_file.name)

        # Mock successful uploads
        api_client.http_client.post.side_effect = [
            APIResponse(success=True, data={"file_id": f"file_{i}", "filename": f"test_{i}.csv"})
            for i in range(3)
        ]

        results = await api_client.upload_files_batch(temp_files)

        assert len(results) == 3
        for i, result in enumerate(results):
            assert result["file_id"] == f"file_{i}"

        # Cleanup
        for file_path in temp_files:
            Path(file_path).unlink()

    @pytest.mark.asyncio
    async def test_file_upload_progress_callback(self, api_client):
        """Test file upload with progress callback."""
        progress_calls = []
        
        def progress_callback(bytes_uploaded, total_bytes):
            progress_calls.append((bytes_uploaded, total_bytes))

        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data={"file_id": "file_123", "filename": "test.csv"}
        )

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv') as tmp_file:
            tmp_file.write("data" * 1000)
            tmp_file.flush()

            await api_client.upload_file(
                tmp_file.name, 
                progress_callback=progress_callback
            )

        # Verify progress callbacks were made
        assert len(progress_calls) > 0


class TestDataProcessingEdgeCases:
    """Test edge cases and error scenarios."""

    @pytest.fixture
    def api_client(self):
        """Create a mock API client."""
        from schlep_engine.utils.http_client import HTTPClient
        http_client = AsyncMock(spec=HTTPClient)
        return DataProcessingAPI(http_client)

    @pytest.mark.asyncio
    async def test_malformed_response_handling(self, api_client):
        """Test handling of malformed API responses."""
        # Mock malformed JSON response
        api_client.http_client.get.return_value = "invalid json response"

        with pytest.raises(APIError):
            await api_client.get_job_status("job_12345")

    @pytest.mark.asyncio
    async def test_empty_file_upload(self, api_client):
        """Test uploading empty file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv') as tmp_file:
            # File is empty
            tmp_file.flush()

            api_client.http_client.post.side_effect = APIError(
                "File is empty",
                status_code=400,
                error_code="EMPTY_FILE"
            )

            with pytest.raises(ValidationError):
                await api_client.upload_file(tmp_file.name)

    @pytest.mark.asyncio
    async def test_network_interruption_retry(self, api_client):
        """Test retry mechanism on network interruption."""
        # First call fails with network error, second succeeds
        api_client.http_client.get.side_effect = [
            ConnectionError("Network interruption"),
            APIResponse(success=True, data={"job_id": "job_12345", "status": "running"})
        ]

        with patch('asyncio.sleep'):  # Mock sleep to speed up test
            result = await api_client.get_job_status("job_12345")
            
        assert result.job_id == "job_12345"
        assert api_client.http_client.get.call_count == 2

    @pytest.mark.asyncio
    async def test_unicode_file_handling(self, api_client):
        """Test handling files with unicode characters."""
        unicode_content = "名前,年齢,職業\n田中太郎,30,エンジニア\n"
        
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.csv') as tmp_file:
            tmp_file.write(unicode_content)
            tmp_file.flush()

            api_client.http_client.post.return_value = APIResponse(
                success=True,
                data={"file_id": "file_unicode", "filename": "unicode_test.csv"}
            )

            result = await api_client.upload_file(tmp_file.name)
            assert result["file_id"] == "file_unicode"

    @pytest.mark.asyncio
    async def test_large_dataset_processing(self, api_client):
        """Test processing of large datasets."""
        large_job = ProcessingJob(
            job_id="job_large",
            status=JobStatus.RUNNING,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            file_count=100,
            processed_records=50000000,  # 50 million records
            total_records=100000000,     # 100 million records
            estimated_completion=datetime.now() + timedelta(hours=2)
        )

        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data=large_job.dict()
        )

        result = await api_client.get_job_status("job_large")
        
        assert result.processed_records == 50000000
        assert result.total_records == 100000000
        assert result.file_count == 100

    @pytest.mark.asyncio
    async def test_invalid_job_id_formats(self, api_client):
        """Test handling of invalid job ID formats."""
        invalid_job_ids = ["", None, "job with spaces", "job/with/slashes", "job@special"]

        for invalid_id in invalid_job_ids:
            with pytest.raises((ValidationError, ValueError)):
                await api_client.get_job_status(invalid_id)

    @pytest.mark.asyncio
    async def test_concurrent_file_uploads(self, api_client):
        """Test concurrent file upload handling."""
        # Create multiple files
        temp_files = []
        for i in range(5):
            tmp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
            tmp_file.write(f"data_{i}")
            tmp_file.flush()
            temp_files.append(tmp_file.name)

        # Mock responses
        api_client.http_client.post.side_effect = [
            APIResponse(success=True, data={"file_id": f"concurrent_file_{i}"})
            for i in range(5)
        ]

        # Upload concurrently
        tasks = [api_client.upload_file(file_path) for file_path in temp_files]
        results = await asyncio.gather(*tasks)

        assert len(results) == 5
        for i, result in enumerate(results):
            assert result["file_id"] == f"concurrent_file_{i}"

        # Cleanup
        for file_path in temp_files:
            Path(file_path).unlink()


@pytest.mark.integration
class TestDataProcessingIntegration:
    """Integration tests for data processing (requires test API)."""

    @pytest.mark.asyncio
    async def test_end_to_end_processing_workflow(self):
        """Test complete end-to-end processing workflow."""
        # This test should be run only in integration test environments
        pytest.skip("Integration test - requires real API endpoint")

    @pytest.mark.asyncio
    async def test_real_file_upload_processing(self):
        """Test real file upload and processing."""
        pytest.skip("Integration test - requires real API endpoint")

    @pytest.mark.asyncio
    async def test_webhook_notifications(self):
        """Test webhook notifications for job completion."""
        pytest.skip("Integration test - requires webhook endpoint")


# Performance test markers
@pytest.mark.performance
class TestDataProcessingPerformance:
    """Performance tests for data processing operations."""

    @pytest.mark.asyncio
    async def test_high_volume_job_status_requests(self, api_client):
        """Test performance with high volume of job status requests."""
        # Mock successful responses
        api_client.http_client.get.return_value = APIResponse(
            success=True,
            data={"job_id": "perf_job", "status": "running"}
        )

        # Make 1000 concurrent requests
        tasks = [api_client.get_job_status("perf_job") for _ in range(1000)]
        
        start_time = datetime.now()
        results = await asyncio.gather(*tasks)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        
        assert len(results) == 1000
        assert duration < 10  # Should complete within 10 seconds

    @pytest.mark.asyncio 
    async def test_memory_usage_large_file_lists(self, api_client):
        """Test memory usage when handling large file lists."""
        # Create a large list of file references
        large_file_list = [f"file_{i}.csv" for i in range(10000)]
        
        api_client.http_client.post.return_value = APIResponse(
            success=True,
            data={"job_id": "memory_test", "file_count": len(large_file_list)}
        )

        # This should not cause memory issues
        result = await api_client.create_processing_job(files=large_file_list)
        
        assert result["file_count"] == 10000