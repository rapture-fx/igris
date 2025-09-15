"""
Data Quality API Runtime Error Validation Tests
===============================================

Comprehensive test suite for validating the data quality API runtime error fixes.
Tests the critical P0 fix for data quality API error handling and file processing.

Test Coverage:
- All supported file formats (CSV, JSON, Excel, Parquet)
- Data profiling and statistical analysis validation
- Error handling for malformed files
- Response schema compliance verification
- Large file handling and limits testing
- Runtime error scenarios and recovery
- Performance benchmarks for file processing
"""

import pytest
import asyncio
import io
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, List
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import httpx
from fastapi import status

# Import application components
import sys
sys.path.append('/Users/wira/Desktop/schlep-engine/apps/api')

from app.api.v1.data_quality import DataQualityResult, ColumnProfile


class TestSupportedFileFormats:
    """Test all supported file formats with valid and invalid data."""

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_csv_file_processing_success(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test successful CSV file processing and data quality assessment."""
        test_metrics.start_timer()

        # Create file upload
        files = {"file": ("test_data.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({"check_duplicates": True, "check_missing": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        test_metrics.end_timer()

        assert response.status_code == 200
        result = response.json()

        # Validate response structure
        assert result["success"] is True
        assert "assessment_id" in result
        assert "filename" in result
        assert result["filename"] == "test_data.csv"
        assert result["total_rows"] > 0
        assert result["total_columns"] > 0
        assert "overall_quality_score" in result
        assert "column_profiles" in result
        assert "issues_found" in result
        assert "recommendations" in result

        # Validate column profiles
        assert len(result["column_profiles"]) > 0
        for profile in result["column_profiles"]:
            assert "column_name" in profile
            assert "data_type" in profile
            assert "null_count" in profile
            assert "null_percentage" in profile
            assert "quality_score" in profile

        # Performance check
        test_metrics.assert_performance({"execution_time_ms": 5000})

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_csv_malformed_file_error_handling(self, authenticated_async_client, malformed_csv_data):
        """Test error handling for malformed CSV files."""
        files = {"file": ("malformed.csv", malformed_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should handle malformed CSV gracefully
        assert response.status_code in [200, 400]

        if response.status_code == 400:
            # Error response should be well-structured
            error_result = response.json()
            assert "detail" in error_result
            assert "CSV" in error_result["detail"] or "format" in error_result["detail"]
        else:
            # Success with error field populated
            result = response.json()
            assert result["success"] is False
            assert result["error"] is not None

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_json_file_processing_success(self, authenticated_async_client, sample_json_data):
        """Test successful JSON file processing."""
        files = {"file": ("test_data.json", sample_json_data, "application/json")}
        data = {"request_data": json.dumps({"generate_profile": True, "check_bias": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True
        assert result["filename"] == "test_data.json"
        assert result["total_rows"] > 0
        assert "column_profiles" in result
        assert "bias_analysis" in result

        # Validate bias analysis structure
        bias_analysis = result["bias_analysis"]
        assert "potential_bias_detected" in bias_analysis
        assert "bias_score" in bias_analysis
        assert "recommendations" in bias_analysis

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_json_malformed_file_error_handling(self, authenticated_async_client, malformed_json_data):
        """Test error handling for malformed JSON files."""
        files = {"file": ("malformed.json", malformed_json_data, "application/json")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 400
        error_result = response.json()
        assert "detail" in error_result
        assert "JSON" in error_result["detail"] or "format" in error_result["detail"]

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_excel_file_processing(self, authenticated_async_client, temp_dir):
        """Test Excel file processing."""
        # Create Excel file
        df = pd.DataFrame({
            'name': ['Alice', 'Bob', 'Charlie'],
            'age': [25, 30, 35],
            'score': [95.5, 87.2, 92.8]
        })

        excel_path = temp_dir / "test_data.xlsx"
        df.to_excel(excel_path, index=False)

        with open(excel_path, 'rb') as f:
            excel_data = f.read()

        files = {"file": ("test_data.xlsx", excel_data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        data = {"request_data": json.dumps({"check_outliers": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True
        assert result["filename"] == "test_data.xlsx"
        assert result["total_rows"] == 3
        assert result["total_columns"] == 3

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_parquet_file_processing(self, authenticated_async_client, temp_dir):
        """Test Parquet file processing."""
        # Create Parquet file
        df = pd.DataFrame({
            'id': range(100),
            'value': [i * 2.5 for i in range(100)],
            'category': [f'Cat_{i % 5}' for i in range(100)]
        })

        parquet_path = temp_dir / "test_data.parquet"
        df.to_parquet(parquet_path, index=False)

        with open(parquet_path, 'rb') as f:
            parquet_data = f.read()

        files = {"file": ("test_data.parquet", parquet_data, "application/octet-stream")}
        data = {"request_data": json.dumps({"check_duplicates": True, "check_missing": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True
        assert result["filename"] == "test_data.parquet"
        assert result["total_rows"] == 100
        assert result["total_columns"] == 3


class TestFileValidationAndErrorHandling:
    """Test file validation and comprehensive error handling."""

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_unsupported_file_format_rejection(self, authenticated_async_client):
        """Test rejection of unsupported file formats."""
        # Test with .txt file
        txt_data = b"This is a text file, not a supported format"
        files = {"file": ("test.txt", txt_data, "text/plain")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 400
        error_result = response.json()
        assert "detail" in error_result
        assert "must be one of" in error_result["detail"]

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_empty_file_handling(self, authenticated_async_client):
        """Test handling of empty files."""
        empty_data = b""
        files = {"file": ("empty.csv", empty_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 400
        error_result = response.json()
        assert "detail" in error_result
        assert "empty" in error_result["detail"].lower()

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_no_file_provided_error(self, authenticated_async_client):
        """Test error when no file is provided."""
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            data=data
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_large_file_size_limit(self, authenticated_async_client, large_dataset):
        """Test file size limit enforcement."""
        # The large_dataset fixture creates a 10k row JSON file
        files = {"file": ("large_data.json", large_dataset, "application/json")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should either process successfully or return size limit error
        if response.status_code == 413:
            error_result = response.json()
            assert "detail" in error_result
            assert "size" in error_result["detail"].lower()
        else:
            assert response.status_code == 200
            result = response.json()
            # For very large files, might return error in success response
            if not result["success"]:
                assert result["error"] is not None

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_csv_with_no_data_rows(self, authenticated_async_client):
        """Test CSV file with only headers and no data rows."""
        csv_headers_only = b"name,age,score\n"  # Only headers
        files = {"file": ("headers_only.csv", csv_headers_only, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 400
        error_result = response.json()
        assert "detail" in error_result
        assert "no data" in error_result["detail"].lower()

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_csv_with_no_columns(self, authenticated_async_client):
        """Test CSV file with no columns."""
        csv_no_columns = b"\n\n\n"  # Empty rows
        files = {"file": ("no_columns.csv", csv_no_columns, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 400
        error_result = response.json()
        assert "detail" in error_result


class TestDataProfilingAndStatisticalAnalysis:
    """Test data profiling and statistical analysis functionality."""

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_comprehensive_column_profiling(self, authenticated_async_client, sample_csv_data):
        """Test comprehensive column profiling with all statistics."""
        files = {"file": ("comprehensive_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({
            "check_duplicates": True,
            "check_missing": True,
            "check_outliers": True,
            "check_bias": True,
            "generate_profile": True
        })}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True

        # Validate comprehensive column profiles
        column_profiles = result["column_profiles"]
        assert len(column_profiles) > 0

        # Check for numeric column statistics
        numeric_profiles = [p for p in column_profiles if p["data_type"] in ["numeric", "integer"]]
        if numeric_profiles:
            numeric_profile = numeric_profiles[0]
            assert "mean" in numeric_profile
            assert "median" in numeric_profile
            assert "std_dev" in numeric_profile
            assert "min_value" in numeric_profile
            assert "max_value" in numeric_profile
            assert "outliers_count" in numeric_profile

        # Check for string column statistics
        string_profiles = [p for p in column_profiles if p["data_type"] == "string"]
        if string_profiles:
            string_profile = string_profiles[0]
            assert "most_frequent_value" in string_profile
            assert "least_frequent_value" in string_profile

        # Validate quality scores
        for profile in column_profiles:
            assert "quality_score" in profile
            assert 0 <= profile["quality_score"] <= 1

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_missing_values_detection(self, authenticated_async_client):
        """Test missing values detection and analysis."""
        # Create CSV with intentional missing values
        csv_with_missing = """name,age,score,category
Alice,25,95.5,A
Bob,,87.2,B
Charlie,35,,A
,30,92.8,
Eve,28,88.1,B"""

        files = {"file": ("missing_values.csv", csv_with_missing.encode(), "text/csv")}
        data = {"request_data": json.dumps({"check_missing": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True

        # Check that missing values were detected
        issues_found = result["issues_found"]
        missing_value_issues = [issue for issue in issues_found if issue["issue_type"] == "missing_values"]
        assert len(missing_value_issues) > 0

        # Validate column profiles for missing values
        for profile in result["column_profiles"]:
            if profile["null_count"] > 0:
                assert profile["null_percentage"] > 0
                assert profile["null_percentage"] <= 100

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_outlier_detection(self, authenticated_async_client):
        """Test outlier detection in numeric data."""
        # Create CSV with intentional outliers
        csv_with_outliers = """name,age,salary
Alice,25,50000
Bob,30,55000
Charlie,28,52000
Diana,29,1000000
Eve,31,51000"""

        files = {"file": ("outliers.csv", csv_with_outliers.encode(), "text/csv")}
        data = {"request_data": json.dumps({"check_outliers": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True

        # Check that outliers were detected
        issues_found = result["issues_found"]
        outlier_issues = [issue for issue in issues_found if issue["issue_type"] == "outliers"]
        assert len(outlier_issues) > 0

        # Check salary column profile for outliers
        salary_profile = next((p for p in result["column_profiles"] if p["column_name"] == "salary"), None)
        assert salary_profile is not None
        assert salary_profile["outliers_count"] > 0

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_bias_detection_analysis(self, authenticated_async_client):
        """Test bias detection and analysis."""
        # Create CSV with potential bias (class imbalance)
        csv_with_bias = """name,gender,department,salary
Alice,F,IT,50000
Bob,M,IT,60000
Charlie,M,IT,55000
Diana,F,HR,45000
Eve,M,IT,58000
Frank,M,IT,57000
Grace,M,IT,59000
Henry,M,IT,61000"""

        files = {"file": ("bias_test.csv", csv_with_bias.encode(), "text/csv")}
        data = {"request_data": json.dumps({"check_bias": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True
        assert "bias_analysis" in result

        bias_analysis = result["bias_analysis"]
        assert "potential_bias_detected" in bias_analysis
        assert "bias_score" in bias_analysis
        assert "column_imbalances" in bias_analysis
        assert "recommendations" in bias_analysis

        # Should detect gender imbalance in IT department
        if bias_analysis["potential_bias_detected"]:
            assert len(bias_analysis["column_imbalances"]) > 0


class TestResponseSchemaCompliance:
    """Test response schema compliance and data structure validation."""

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_response_schema_structure(self, authenticated_async_client, sample_csv_data):
        """Test that API response follows the defined schema structure."""
        files = {"file": ("schema_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        # Validate top-level schema
        required_fields = [
            "success", "assessment_id", "filename", "total_rows", "total_columns",
            "overall_quality_score", "column_profiles", "issues_found", "recommendations",
            "processing_time"
        ]
        for field in required_fields:
            assert field in result, f"Required field '{field}' missing from response"

        # Validate column profile schema
        if result["column_profiles"]:
            profile = result["column_profiles"][0]
            profile_required_fields = [
                "column_name", "data_type", "null_count", "null_percentage",
                "unique_count", "unique_percentage", "quality_score"
            ]
            for field in profile_required_fields:
                assert field in profile, f"Required field '{field}' missing from column profile"

        # Validate data types
        assert isinstance(result["success"], bool)
        assert isinstance(result["assessment_id"], str)
        assert isinstance(result["filename"], str)
        assert isinstance(result["total_rows"], int)
        assert isinstance(result["total_columns"], int)
        assert isinstance(result["overall_quality_score"], (int, float))
        assert isinstance(result["column_profiles"], list)
        assert isinstance(result["issues_found"], list)
        assert isinstance(result["recommendations"], list)
        assert isinstance(result["processing_time"], (int, float))

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_error_response_schema(self, authenticated_async_client, malformed_csv_data):
        """Test error response schema compliance."""
        files = {"file": ("error_test.csv", malformed_csv_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should be either HTTP error or success with error field
        if response.status_code >= 400:
            error_result = response.json()
            assert "detail" in error_result
            assert isinstance(error_result["detail"], str)
        else:
            result = response.json()
            assert "success" in result
            if not result["success"]:
                assert "error" in result
                assert result["error"] is not None

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_quality_score_validation(self, authenticated_async_client, sample_csv_data):
        """Test quality score calculation and validation."""
        files = {"file": ("quality_score_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({"generate_profile": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        assert result["success"] is True

        # Validate overall quality score
        overall_score = result["overall_quality_score"]
        assert isinstance(overall_score, (int, float))
        assert 0 <= overall_score <= 1

        # Validate individual column quality scores
        for profile in result["column_profiles"]:
            quality_score = profile["quality_score"]
            assert isinstance(quality_score, (int, float))
            assert 0 <= quality_score <= 1


class TestPerformanceAndLimits:
    """Test performance benchmarks and system limits."""

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    @pytest.mark.performance
    async def test_processing_time_benchmarks(self, authenticated_async_client, sample_csv_data, test_metrics, performance_thresholds):
        """Test processing time meets performance benchmarks."""
        test_metrics.start_timer()

        files = {"file": ("benchmark_test.csv", sample_csv_data, "text/csv")}
        data = {"request_data": json.dumps({
            "check_duplicates": True,
            "check_missing": True,
            "check_outliers": True,
            "check_bias": True,
            "generate_profile": True
        })}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        test_metrics.end_timer()

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Validate processing time
        processing_time_ms = result["processing_time"] * 1000  # Convert to ms
        thresholds = performance_thresholds["data_quality_api"]

        test_metrics.record_metric("api_processing_time_ms", processing_time_ms)
        test_metrics.assert_performance({
            "execution_time_ms": thresholds["max_response_time_ms"],
            "api_processing_time_ms": thresholds["max_response_time_ms"]
        })

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    @pytest.mark.performance
    async def test_memory_usage_with_large_files(self, authenticated_async_client, temp_dir, test_metrics):
        """Test memory usage with larger files."""
        # Create a moderately large CSV file
        large_data = []
        for i in range(5000):  # 5K rows
            large_data.append({
                "id": i,
                "name": f"User_{i}",
                "score": (i * 7) % 100,
                "category": f"Cat_{i % 10}",
                "value": i * 2.5
            })

        df = pd.DataFrame(large_data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_data = csv_buffer.getvalue().encode()

        test_metrics.start_timer()

        files = {"file": ("large_test.csv", csv_data, "text/csv")}
        data = {"request_data": json.dumps({"generate_profile": True})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        test_metrics.end_timer()

        # Should handle large files successfully
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["total_rows"] == 5000

        # Performance check for large files
        test_metrics.assert_performance({"execution_time_ms": 10000})  # 10 second limit for large files

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_concurrent_file_processing(self, authenticated_async_client, sample_csv_data, test_metrics):
        """Test concurrent file processing capability."""
        async def process_file(file_name: str):
            files = {"file": (file_name, sample_csv_data, "text/csv")}
            data = {"request_data": json.dumps({})}

            response = await authenticated_async_client.post(
                "/api/v1/quality/assess",
                files=files,
                data=data
            )
            return response

        test_metrics.start_timer()

        # Process multiple files concurrently
        tasks = [
            process_file(f"concurrent_test_{i}.csv")
            for i in range(5)
        ]

        responses = await asyncio.gather(*tasks)

        test_metrics.end_timer()

        # All requests should succeed
        for i, response in enumerate(responses):
            assert response.status_code == 200, f"Request {i} failed with status {response.status_code}"
            result = response.json()
            assert result["success"] is True

        # Performance check for concurrent processing
        test_metrics.assert_performance({"execution_time_ms": 15000})  # 15 second limit for 5 concurrent files


class TestRuntimeErrorRecovery:
    """Test runtime error scenarios and recovery mechanisms."""

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_graceful_degradation_on_analysis_errors(self, authenticated_async_client):
        """Test graceful degradation when specific analyses fail."""
        # Create data that might cause analysis errors
        problematic_csv = """name,value
Alice,inf
Bob,-inf
Charlie,nan
Diana,1e308"""

        files = {"file": ("problematic.csv", problematic_csv.encode(), "text/csv")}
        data = {"request_data": json.dumps({
            "check_outliers": True,
            "generate_profile": True
        })}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should handle problematic data gracefully
        assert response.status_code == 200
        result = response.json()

        # Either succeeds with warnings or fails gracefully
        if result["success"]:
            # Should have some basic profiling even if outlier detection fails
            assert len(result["column_profiles"]) > 0
        else:
            # Should provide meaningful error message
            assert result["error"] is not None

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_invalid_request_data_handling(self, authenticated_async_client, sample_csv_data):
        """Test handling of invalid request data JSON."""
        files = {"file": ("test.csv", sample_csv_data, "text/csv")}

        # Invalid JSON in request_data
        data = {"request_data": "invalid json {"}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should handle invalid JSON gracefully and use defaults
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True  # Should use default settings

    @pytest.mark.critical_fix
    @pytest.mark.data_quality
    async def test_encoding_error_handling(self, authenticated_async_client):
        """Test handling of files with encoding issues."""
        # Create binary data that looks like CSV but has encoding issues
        binary_data = b'\xff\xfe\x00CSV,with,encoding,issues\x00\x00'

        files = {"file": ("encoding_test.csv", binary_data, "text/csv")}
        data = {"request_data": json.dumps({})}

        response = await authenticated_async_client.post(
            "/api/v1/quality/assess",
            files=files,
            data=data
        )

        # Should handle encoding errors gracefully
        assert response.status_code in [200, 400]

        if response.status_code == 400:
            error_result = response.json()
            assert "detail" in error_result