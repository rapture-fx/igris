"""
Comprehensive error handling and edge case tests for Igris-engine Python SDK

This test suite covers all error scenarios, edge cases, input validation,
network failures, timeout handling, and recovery mechanisms.
"""

import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import patch, MagicMock, AsyncMock, side_effect
from datetime import datetime, timedelta
import aiohttp
import httpx

from igris import IgrisClient
from igris.exceptions.base import (
    APIError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    NetworkError,
    TimeoutError,
    FileUploadError,
    ProcessingError,
    MLError,
    ModelError,
    InferenceError,
    TrainingError
)
from igris.models.data import JobStatus
from igris.models.ml import MLJobStatus


class TestAPIErrorHandling:
    """Test comprehensive API error handling scenarios."""

    @pytest.fixture
    def client(self):
        """Mock client for error testing."""
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_http_status_code_errors(self, client):
        """Test handling of various HTTP status codes."""
        status_code_scenarios = [
            (400, ValidationError, "Bad Request"),
            (401, AuthenticationError, "Unauthorized"),
            (403, AuthenticationError, "Forbidden"),
            (404, APIError, "Not Found"),
            (409, APIError, "Conflict"),
            (422, ValidationError, "Unprocessable Entity"),
            (429, RateLimitError, "Too Many Requests"),
            (500, APIError, "Internal Server Error"),
            (502, APIError, "Bad Gateway"),
            (503, APIError, "Service Unavailable"),
            (504, TimeoutError, "Gateway Timeout")
        ]

        for status_code, expected_exception, message in status_code_scenarios:
            with patch.object(client.http_client, 'get') as mock_get:
                # Mock HTTP response with specific status code
                mock_response = MagicMock()
                mock_response.status_code = status_code
                mock_response.json.return_value = {
                    "success": False,
                    "error": {
                        "code": f"HTTP_{status_code}",
                        "message": message
                    }
                }
                mock_get.side_effect = httpx.HTTPStatusError(
                    message, 
                    request=MagicMock(), 
                    response=mock_response
                )

                with pytest.raises(expected_exception) as exc_info:
                    await client.data.get_job_status("test_job")

                assert status_code in str(exc_info.value) or message in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_malformed_json_response(self, client):
        """Test handling of malformed JSON responses."""
        with patch.object(client.http_client, 'get') as mock_get:
            # Mock response with invalid JSON
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.text = "invalid json content"
            mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "doc", 0)
            mock_get.return_value = mock_response

            with pytest.raises(APIError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "json" in str(exc_info.value).lower() or "parse" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_missing_required_response_fields(self, client):
        """Test handling of responses missing required fields."""
        with patch.object(client.http_client, 'get') as mock_get:
            # Mock response missing required fields
            mock_get.return_value = {
                "success": True,
                # Missing 'data' field
            }

            with pytest.raises(APIError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "missing" in str(exc_info.value).lower() or "required" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_unexpected_response_structure(self, client):
        """Test handling of unexpected response structures."""
        with patch.object(client.http_client, 'get') as mock_get:
            # Mock response with unexpected structure
            mock_get.return_value = {
                "unexpected_field": "value",
                "nested": {
                    "data": "wrong_structure"
                }
            }

            with pytest.raises(APIError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "unexpected" in str(exc_info.value).lower() or "format" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_rate_limiting_with_retry_after(self, client):
        """Test rate limiting with Retry-After header."""
        with patch.object(client.http_client, 'get') as mock_get:
            # First call: rate limited with Retry-After header
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.headers = {"Retry-After": "60"}
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Rate limit exceeded"
                }
            }
            
            mock_get.side_effect = httpx.HTTPStatusError(
                "Too Many Requests",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(RateLimitError) as exc_info:
                await client.data.get_job_status("test_job")

            error = exc_info.value
            assert hasattr(error, 'retry_after')
            assert error.retry_after == 60

    @pytest.mark.asyncio
    async def test_authentication_token_expired(self, client):
        """Test handling of expired authentication tokens."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "TOKEN_EXPIRED",
                    "message": "Authentication token has expired"
                }
            }
            
            mock_get.side_effect = httpx.HTTPStatusError(
                "Unauthorized",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(AuthenticationError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "token" in str(exc_info.value).lower()
            assert "expired" in str(exc_info.value).lower()


class TestNetworkErrorHandling:
    """Test network-related error scenarios."""

    @pytest.fixture
    def client(self):
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_connection_timeout(self, client):
        """Test connection timeout handling."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.side_effect = asyncio.TimeoutError("Connection timed out")

            with pytest.raises(TimeoutError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "timeout" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_connection_refused(self, client):
        """Test connection refused error."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.side_effect = aiohttp.ClientConnectorError(
                connection_key=MagicMock(),
                os_error=ConnectionRefusedError("Connection refused")
            )

            with pytest.raises(NetworkError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "connection" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_dns_resolution_failure(self, client):
        """Test DNS resolution failure."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.side_effect = aiohttp.ClientConnectorError(
                connection_key=MagicMock(),
                os_error=OSError("Name or service not known")
            )

            with pytest.raises(NetworkError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "network" in str(exc_info.value).lower() or "connection" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_ssl_certificate_error(self, client):
        """Test SSL certificate errors."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.side_effect = aiohttp.ClientSSLError(
                connection_key=MagicMock(),
                os_error=Exception("SSL certificate verification failed")
            )

            with pytest.raises(NetworkError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "ssl" in str(exc_info.value).lower() or "certificate" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_intermittent_network_failure_with_retry(self, client):
        """Test retry mechanism on intermittent network failures."""
        with patch.object(client.http_client, 'get') as mock_get:
            # First two calls fail, third succeeds
            mock_get.side_effect = [
                aiohttp.ClientConnectorError(
                    connection_key=MagicMock(),
                    os_error=ConnectionRefusedError("Temporary failure")
                ),
                aiohttp.ClientConnectorError(
                    connection_key=MagicMock(),
                    os_error=ConnectionRefusedError("Temporary failure")
                ),
                {
                    "success": True,
                    "data": {
                        "job_id": "test_job",
                        "status": "completed"
                    }
                }
            ]

            # Should succeed after retries
            result = await client.data.get_job_status("test_job")
            assert result.job_id == "test_job"
            assert mock_get.call_count == 3

    @pytest.mark.asyncio
    async def test_partial_response_timeout(self, client):
        """Test handling of partial response timeouts."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.side_effect = asyncio.TimeoutError("Read timeout")

            with pytest.raises(TimeoutError) as exc_info:
                await client.data.get_job_status("test_job")

            assert "timeout" in str(exc_info.value).lower()


class TestInputValidationErrors:
    """Test comprehensive input validation error handling."""

    @pytest.fixture
    def client(self):
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_empty_job_id_validation(self, client):
        """Test validation of empty job IDs."""
        invalid_job_ids = ["", "   ", None, "\t\n"]

        for invalid_id in invalid_job_ids:
            with pytest.raises(ValidationError) as exc_info:
                await client.data.get_job_status(invalid_id)

            assert "job id" in str(exc_info.value).lower() or "invalid" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_invalid_job_id_format(self, client):
        """Test validation of invalid job ID formats."""
        invalid_job_ids = [
            "job with spaces",
            "job/with/slashes",
            "job@with@symbols",
            "job\nwith\nnewlines",
            "job\twith\ttabs",
            "job#with#hash",
            "job?with?question",
            "job=with=equals"
        ]

        for invalid_id in invalid_job_ids:
            with pytest.raises(ValidationError) as exc_info:
                await client.data.get_job_status(invalid_id)

            assert "format" in str(exc_info.value).lower() or "invalid" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_empty_file_list_validation(self, client):
        """Test validation of empty file lists."""
        with pytest.raises(ValidationError) as exc_info:
            await client.data.create_processing_job(files=[], config={})

        assert "files" in str(exc_info.value).lower() or "empty" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_invalid_processing_config(self, client):
        """Test validation of invalid processing configurations."""
        invalid_configs = [
            None,
            {},
            {"format": "invalid_format"},
            {"format": "csv", "delimiter": ""},
            {"format": "csv", "headers": "not_boolean"},
            {"validation_rules": "not_list"},
            {"validation_rules": ["invalid_rule"]},
        ]

        for invalid_config in invalid_configs:
            with pytest.raises(ValidationError) as exc_info:
                await client.data.create_processing_job(
                    files=["test_file"],
                    config=invalid_config
                )

            assert "config" in str(exc_info.value).lower() or "validation" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_negative_pagination_values(self, client):
        """Test validation of negative pagination values."""
        invalid_pagination_params = [
            {"page": -1, "per_page": 10},
            {"page": 1, "per_page": -1},
            {"page": 0, "per_page": 10},
            {"page": 1, "per_page": 0},
            {"page": 1, "per_page": 1001},  # Too large
        ]

        for invalid_params in invalid_pagination_params:
            with pytest.raises(ValidationError) as exc_info:
                await client.data.list_jobs(pagination=invalid_params)

            assert "pagination" in str(exc_info.value).lower() or "invalid" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_invalid_date_formats(self, client):
        """Test handling of invalid date format filters."""
        invalid_dates = [
            "not_a_date",
            "2024-13-01",  # Invalid month
            "2024-02-30",  # Invalid day
            "24-01-01",    # Wrong format
            "2024/01/01",  # Wrong separator
        ]

        for invalid_date in invalid_dates:
            with pytest.raises(ValidationError) as exc_info:
                await client.data.list_jobs(
                    filters={"created_after": invalid_date}
                )

            assert "date" in str(exc_info.value).lower() or "format" in str(exc_info.value).lower()


class TestFileHandlingErrors:
    """Test file upload/download error scenarios."""

    @pytest.fixture
    def client(self):
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_upload_nonexistent_file(self, client):
        """Test uploading non-existent file."""
        nonexistent_file = "/path/to/nonexistent/file.csv"

        with pytest.raises(FileUploadError) as exc_info:
            await client.data.upload_file(nonexistent_file)

        assert "file not found" in str(exc_info.value).lower() or "no such file" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_upload_empty_file(self, client):
        """Test uploading empty file."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
            # Create empty file
            temp_file_path = temp_file.name

        try:
            with patch.object(client.http_client, 'post') as mock_post:
                mock_response = MagicMock()
                mock_response.status_code = 400
                mock_response.json.return_value = {
                    "success": False,
                    "error": {
                        "code": "EMPTY_FILE",
                        "message": "File is empty"
                    }
                }
                mock_post.side_effect = httpx.HTTPStatusError(
                    "Bad Request",
                    request=MagicMock(),
                    response=mock_response
                )

                with pytest.raises(FileUploadError) as exc_info:
                    await client.data.upload_file(temp_file_path)

                assert "empty" in str(exc_info.value).lower()
        finally:
            os.unlink(temp_file_path)

    @pytest.mark.asyncio
    async def test_upload_file_too_large(self, client):
        """Test uploading file that exceeds size limit."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
            # Create large file content
            temp_file.write("x" * 1000000)  # 1MB of data
            temp_file_path = temp_file.name

        try:
            with patch.object(client.http_client, 'post') as mock_post:
                mock_response = MagicMock()
                mock_response.status_code = 413
                mock_response.json.return_value = {
                    "success": False,
                    "error": {
                        "code": "FILE_TOO_LARGE",
                        "message": "File size exceeds maximum limit"
                    }
                }
                mock_post.side_effect = httpx.HTTPStatusError(
                    "Payload Too Large",
                    request=MagicMock(),
                    response=mock_response
                )

                with pytest.raises(FileUploadError) as exc_info:
                    await client.data.upload_file(temp_file_path)

                assert "too large" in str(exc_info.value).lower() or "size" in str(exc_info.value).lower()
        finally:
            os.unlink(temp_file_path)

    @pytest.mark.asyncio
    async def test_upload_unsupported_file_format(self, client):
        """Test uploading unsupported file format."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.exe', delete=False) as temp_file:
            temp_file.write("fake executable content")
            temp_file_path = temp_file.name

        try:
            with patch.object(client.http_client, 'post') as mock_post:
                mock_response = MagicMock()
                mock_response.status_code = 400
                mock_response.json.return_value = {
                    "success": False,
                    "error": {
                        "code": "UNSUPPORTED_FORMAT",
                        "message": "File format not supported"
                    }
                }
                mock_post.side_effect = httpx.HTTPStatusError(
                    "Bad Request",
                    request=MagicMock(),
                    response=mock_response
                )

                with pytest.raises(ValidationError) as exc_info:
                    await client.data.upload_file(temp_file_path)

                assert "format" in str(exc_info.value).lower() or "supported" in str(exc_info.value).lower()
        finally:
            os.unlink(temp_file_path)

    @pytest.mark.asyncio
    async def test_download_corrupted_results(self, client):
        """Test downloading corrupted results."""
        with patch.object(client.http_client, 'get') as mock_get:
            # Mock corrupted download response
            mock_get.side_effect = Exception("Data corruption detected")

            with pytest.raises(APIError) as exc_info:
                await client.data.download_results("job_123")

            assert "corruption" in str(exc_info.value).lower() or "data" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_download_insufficient_storage(self, client):
        """Test download failure due to insufficient storage."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.side_effect = OSError("No space left on device")

            with pytest.raises(APIError) as exc_info:
                await client.data.download_results("job_123")

            assert "space" in str(exc_info.value).lower() or "storage" in str(exc_info.value).lower()


class TestMLErrorHandling:
    """Test ML-specific error handling."""

    @pytest.fixture
    def client(self):
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_insufficient_training_data(self, client):
        """Test ML training with insufficient data."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "INSUFFICIENT_DATA",
                    "message": "Not enough data for training (minimum 100 samples required)"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Bad Request",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(TrainingError) as exc_info:
                await client.ml.create_training_job(
                    dataset_id="small_dataset",
                    target_column="target"
                )

            assert "insufficient" in str(exc_info.value).lower() or "not enough" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_invalid_target_column(self, client):
        """Test ML training with invalid target column."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "INVALID_TARGET_COLUMN",
                    "message": "Target column 'nonexistent' not found in dataset"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Bad Request",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(ValidationError) as exc_info:
                await client.ml.create_training_job(
                    dataset_id="dataset_123",
                    target_column="nonexistent"
                )

            assert "target column" in str(exc_info.value).lower() or "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_training_convergence_failure(self, client):
        """Test handling of training convergence failures."""
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": {
                    "job_id": "ml_job_123",
                    "status": "failed",
                    "error": "Training failed to converge - loss became NaN",
                    "error_code": "CONVERGENCE_FAILURE"
                }
            }

            result = await client.ml.get_training_job_status("ml_job_123")
            assert result.status == MLJobStatus.FAILED
            assert "converge" in result.error.lower()

    @pytest.mark.asyncio
    async def test_model_inference_schema_mismatch(self, client):
        """Test model inference with schema mismatch."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "SCHEMA_MISMATCH",
                    "message": "Input schema mismatch - expected features: [a, b], got: [x, y]"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Bad Request",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(InferenceError) as exc_info:
                await client.ml.predict_single(
                    model_id="model_123",
                    input_data={"x": 1, "y": 2}
                )

            assert "schema" in str(exc_info.value).lower() or "mismatch" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_corrupted_model_artifact(self, client):
        """Test inference with corrupted model."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 422
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "CORRUPTED_MODEL",
                    "message": "Model artifact is corrupted and cannot be loaded"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Unprocessable Entity",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(ModelError) as exc_info:
                await client.ml.predict_single(
                    model_id="corrupted_model",
                    input_data={"feature1": 1.0}
                )

            assert "corrupted" in str(exc_info.value).lower() or "model" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_model_memory_exceeded(self, client):
        """Test model operations exceeding memory limits."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 507
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "MEMORY_EXCEEDED",
                    "message": "Model operation exceeded available memory"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Insufficient Storage",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(MLError) as exc_info:
                await client.ml.predict_batch(
                    model_id="large_model",
                    input_data=[{"feature": i} for i in range(100000)]
                )

            assert "memory" in str(exc_info.value).lower() or "exceeded" in str(exc_info.value).lower()


class TestConcurrencyErrors:
    """Test concurrency-related error scenarios."""

    @pytest.fixture
    def client(self):
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_concurrent_job_limit_exceeded(self, client):
        """Test exceeding concurrent job limits."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "CONCURRENT_LIMIT_EXCEEDED",
                    "message": "Maximum concurrent jobs exceeded (limit: 5)"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Too Many Requests",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(RateLimitError) as exc_info:
                await client.data.create_processing_job(
                    files=["test_file"],
                    config={"format": "csv"}
                )

            assert "concurrent" in str(exc_info.value).lower() or "limit" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_resource_lock_timeout(self, client):
        """Test resource lock timeout in concurrent scenarios."""
        with patch.object(client.http_client, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 409
            mock_response.json.return_value = {
                "success": False,
                "error": {
                    "code": "RESOURCE_LOCKED",
                    "message": "Resource is locked by another operation"
                }
            }
            mock_post.side_effect = httpx.HTTPStatusError(
                "Conflict",
                request=MagicMock(),
                response=mock_response
            )

            with pytest.raises(APIError) as exc_info:
                await client.data.create_processing_job(
                    files=["locked_resource"],
                    config={"format": "csv"}
                )

            assert "locked" in str(exc_info.value).lower() or "resource" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_race_condition_handling(self, client):
        """Test handling of race conditions."""
        call_count = 0

        def side_effect_func(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call: conflict due to race condition
                mock_response = MagicMock()
                mock_response.status_code = 409
                mock_response.json.return_value = {
                    "success": False,
                    "error": {
                        "code": "RACE_CONDITION",
                        "message": "Operation conflicted with concurrent request"
                    }
                }
                raise httpx.HTTPStatusError(
                    "Conflict",
                    request=MagicMock(),
                    response=mock_response
                )
            else:
                # Subsequent calls: success
                return {
                    "success": True,
                    "data": {
                        "job_id": "job_123",
                        "status": "created"
                    }
                }

        with patch.object(client.http_client, 'post', side_effect=side_effect_func):
            # Should succeed after retry
            result = await client.data.create_processing_job(
                files=["test_file"],
                config={"format": "csv"}
            )
            
            assert result.job_id == "job_123"
            assert call_count >= 2  # Should have retried


class TestEdgeCasesAndBoundaryConditions:
    """Test edge cases and boundary conditions."""

    @pytest.fixture
    def client(self):
        return IgrisClient(api_key="test-key", base_url="https://api.test.com")

    @pytest.mark.asyncio
    async def test_extremely_long_job_id(self, client):
        """Test handling of extremely long job IDs."""
        long_job_id = "job_" + "x" * 1000  # Very long ID

        with pytest.raises(ValidationError) as exc_info:
            await client.data.get_job_status(long_job_id)

        assert "length" in str(exc_info.value).lower() or "too long" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_unicode_characters_in_parameters(self, client):
        """Test handling of Unicode characters in parameters."""
        unicode_job_id = "job_测试_🚀_データ"

        # Should handle Unicode gracefully
        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": {
                    "job_id": unicode_job_id,
                    "status": "completed"
                }
            }

            result = await client.data.get_job_status(unicode_job_id)
            assert result.job_id == unicode_job_id

    @pytest.mark.asyncio
    async def test_boundary_pagination_values(self, client):
        """Test boundary values for pagination."""
        boundary_cases = [
            {"page": 1, "per_page": 1},      # Minimum valid values
            {"page": 1, "per_page": 1000},   # Maximum per_page
            {"page": 999999, "per_page": 1}, # Very high page number
        ]

        for params in boundary_cases:
            with patch.object(client.http_client, 'get') as mock_get:
                mock_get.return_value = {
                    "success": True,
                    "data": {
                        "jobs": [],
                        "total": 0,
                        "page": params["page"],
                        "per_page": params["per_page"],
                        "has_next": False
                    }
                }

                # Should not raise validation errors for boundary values
                result = await client.data.list_jobs(pagination=params)
                assert result.page == params["page"]

    @pytest.mark.asyncio
    async def test_very_large_response_handling(self, client):
        """Test handling of very large API responses."""
        # Create a large mock response
        large_jobs = [
            {
                "job_id": f"job_{i}",
                "status": "completed",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "metadata": {"data": "x" * 1000}  # Large metadata
            }
            for i in range(1000)  # Large number of jobs
        ]

        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": {
                    "jobs": large_jobs,
                    "total": len(large_jobs),
                    "page": 1,
                    "per_page": 1000,
                    "has_next": False
                }
            }

            # Should handle large responses without memory issues
            result = await client.data.list_jobs(pagination={"per_page": 1000})
            assert len(result.jobs) == 1000

    @pytest.mark.asyncio
    async def test_null_and_empty_values_in_response(self, client):
        """Test handling of null and empty values in API responses."""
        response_with_nulls = {
            "success": True,
            "data": {
                "job_id": "job_123",
                "status": "completed",
                "error": None,
                "results": {
                    "output_files": [],
                    "summary": {
                        "total_rows": 0,
                        "processed_rows": None,
                        "errors": []
                    }
                },
                "metadata": {}
            }
        }

        with patch.object(client.http_client, 'get') as mock_get:
            mock_get.return_value = response_with_nulls

            # Should handle null/empty values gracefully
            result = await client.data.get_job_status("job_123")
            assert result.job_id == "job_123"
            assert result.status == JobStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_malicious_input_sanitization(self, client):
        """Test sanitization of potentially malicious input."""
        malicious_inputs = [
            "<script>alert('xss')</script>",
            "'; DROP TABLE jobs; --",
            "../../../etc/passwd",
            "\x00\x01\x02",  # Null bytes and control characters
            "eval('malicious code')"
        ]

        for malicious_input in malicious_inputs:
            # Should validate and reject malicious input
            with pytest.raises(ValidationError) as exc_info:
                await client.data.get_job_status(malicious_input)

            assert "invalid" in str(exc_info.value).lower() or "validation" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_extreme_timeout_values(self, client):
        """Test handling of extreme timeout values."""
        # Test with very short timeout
        client_short_timeout = IgrisClient(
            api_key="test-key", 
            base_url="https://api.test.com",
            timeout=0.001  # 1ms timeout
        )

        with patch.object(client_short_timeout.http_client, 'get') as mock_get:
            mock_get.side_effect = asyncio.TimeoutError("Request timed out")

            with pytest.raises(TimeoutError):
                await client_short_timeout.data.get_job_status("job_123")

        # Test with very long timeout (should not cause issues)
        client_long_timeout = IgrisClient(
            api_key="test-key",
            base_url="https://api.test.com", 
            timeout=3600  # 1 hour timeout
        )

        with patch.object(client_long_timeout.http_client, 'get') as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": {"job_id": "job_123", "status": "completed"}
            }

            result = await client_long_timeout.data.get_job_status("job_123")
            assert result.job_id == "job_123"