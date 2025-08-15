"""
ERROR HANDLING TESTS
===================

Test suite for standardized error handling system.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime

from app.services.core.error_handling import (
    UnifiedErrorHandler,
    ErrorDetails,
    ErrorResponse,
    standardized_error_handling,
    handle_startup_errors,
    handle_validation_error,
    handle_database_error,
    handle_processing_error,
    error_handler
)

class TestUnifiedErrorHandler:
    """Test unified error handler functionality"""
    
    @pytest.fixture
    def error_handler_instance(self):
        """Fresh error handler for each test"""
        return UnifiedErrorHandler()
    
    @pytest.mark.asyncio
    async def test_basic_error_handling(self, error_handler_instance):
        """Test basic error handling functionality"""
        test_error = ValueError("Test error message")
        
        error_details = await error_handler_instance.handle_error(
            error=test_error,
            component="test_component"
        )
        
        assert isinstance(error_details, ErrorDetails)
        assert error_details.error_type == "ValueError"
        assert error_details.message == "Test error message"
        assert error_details.component == "test_component"
        assert error_details.user_message == "Invalid input provided. Please check your data."
        assert len(error_details.error_id) == 8  # Short UUID
        assert error_details.stack_trace is not None
    
    @pytest.mark.asyncio
    async def test_error_handling_with_request(self, error_handler_instance):
        """Test error handling with FastAPI request object"""
        test_error = FileNotFoundError("File not found")
        
        # Mock request object
        mock_request = Mock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.method = "POST"
        
        error_details = await error_handler_instance.handle_error(
            error=test_error,
            request=mock_request,
            component="file_service",
            user_id="user123"
        )
        
        assert error_details.request_path == "/api/test"
        assert error_details.request_method == "POST"
        assert error_details.user_id == "user123"
        assert error_details.component == "file_service"
        assert error_details.user_message == "The requested file could not be found."
    
    def test_user_friendly_messages(self, error_handler_instance):
        """Test user-friendly error message mapping"""
        test_cases = [
            (ValueError("Bad value"), "Invalid input provided. Please check your data."),
            (FileNotFoundError("File missing"), "The requested file could not be found."),
            (PermissionError("Access denied"), "You do not have permission to access this resource."),
            (ConnectionError("Network error"), "Connection failed. Please check your network and try again."),
            (KeyError("Missing key"), "Required field is missing from the request."),
            (RuntimeError("Unknown error"), "An unexpected error occurred. Please try again.")
        ]
        
        for error, expected_message in test_cases:
            user_message = error_handler_instance.user_friendly_messages.get(
                type(error).__name__,
                "An unexpected error occurred. Please try again."
            )
            assert user_message == expected_message
    
    def test_http_status_code_mapping(self, error_handler_instance):
        """Test HTTP status code mapping for different error types"""
        test_cases = [
            ("ValidationError", 422),
            ("ValueError", 400),
            ("FileNotFoundError", 404),
            ("PermissionError", 403),
            ("AuthenticationError", 401),
            ("RateLimitError", 429),
            ("ConnectionError", 503),
            ("TimeoutError", 504),
            ("UnknownError", 500)
        ]
        
        for error_type, expected_status in test_cases:
            status_code = error_handler_instance._get_http_status_code(error_type)
            assert status_code == expected_status
    
    def test_error_statistics(self, error_handler_instance):
        """Test error statistics collection"""
        # Initially no errors
        stats = error_handler_instance.get_error_statistics()
        assert stats['total_errors'] == 0
        assert stats['error_breakdown'] == {}
        
        # Update error stats
        error_handler_instance._update_error_stats("ValueError", "data_processor")
        error_handler_instance._update_error_stats("ValueError", "data_processor")
        error_handler_instance._update_error_stats("FileNotFoundError", "file_service")
        
        stats = error_handler_instance.get_error_statistics()
        assert stats['total_errors'] == 3
        assert stats['error_breakdown']['data_processor:ValueError'] == 2
        assert stats['error_breakdown']['file_service:FileNotFoundError'] == 1
        assert len(stats['most_common_errors']) > 0
    
    def test_create_http_response(self, error_handler_instance):
        """Test HTTP response creation"""
        error_details = ErrorDetails(
            error_id="test123",
            timestamp=datetime.utcnow(),
            error_type="ValueError",
            message="Test error",
            user_message="User friendly message",
            component="test_component"
        )
        
        response = error_handler_instance.create_http_response(error_details)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 400  # ValueError maps to 400
        
        # Check response content
        content = response.body.decode('utf-8')
        assert "test123" in content
        assert "User friendly message" in content
        assert "error" in content

class TestStandardizedErrorDecorator:
    """Test standardized error handling decorator"""
    
    @pytest.mark.asyncio
    async def test_async_function_success(self):
        """Test decorator with successful async function"""
        @standardized_error_handling("test_component")
        async def successful_async_function():
            return {"status": "success", "data": "test"}
        
        result = await successful_async_function()
        assert result["status"] == "success"
        assert result["data"] == "test"
    
    @pytest.mark.asyncio
    async def test_async_function_error(self):
        """Test decorator with failing async function"""
        @standardized_error_handling("test_component")
        async def failing_async_function():
            raise ValueError("Test error")
        
        result = await failing_async_function()
        
        # Should return JSONResponse for async functions
        assert isinstance(result, JSONResponse)
        assert result.status_code == 400  # ValueError
    
    @pytest.mark.asyncio
    async def test_async_function_with_http_exception(self):
        """Test decorator with HTTP exception (should re-raise)"""
        @standardized_error_handling("test_component")
        async def function_with_http_exception():
            raise HTTPException(status_code=404, detail="Not found")
        
        with pytest.raises(HTTPException):
            await function_with_http_exception()
    
    def test_sync_function_success(self):
        """Test decorator with successful sync function"""
        @standardized_error_handling("test_component")
        def successful_sync_function():
            return {"status": "success", "data": "test"}
        
        result = successful_sync_function()
        assert result["status"] == "success"
        assert result["data"] == "test"
    
    def test_sync_function_error(self):
        """Test decorator with failing sync function"""
        @standardized_error_handling("test_component")
        def failing_sync_function():
            raise ValueError("Test error")
        
        result = failing_sync_function()
        
        # Should return error dict for sync functions
        assert result["status"] == "error"
        assert "error_id" in result
        assert "Invalid input provided" in result["message"]
    
    @pytest.mark.asyncio
    async def test_decorator_with_request_extraction(self):
        """Test decorator extracting request from function arguments"""
        mock_request = Mock(spec=Request)
        mock_request.url.path = "/test"
        mock_request.method = "GET"
        mock_request.state.user_id = "user123"
        
        @standardized_error_handling("test_component")
        async def function_with_request(request: Request, data: dict):
            raise ValueError("Test error")
        
        result = await function_with_request(mock_request, {"test": "data"})
        
        # Should be a JSONResponse with request context
        assert isinstance(result, JSONResponse)

class TestSpecializedErrorHandlers:
    """Test specialized error handling functions"""
    
    @pytest.mark.asyncio
    async def test_handle_validation_error(self):
        """Test validation error handling"""
        test_error = ValueError("Invalid field value")
        
        response = await handle_validation_error(test_error, field_name="email")
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 422  # Validation error
        
        # Check that field name is included in message
        content = response.body.decode('utf-8')
        assert "email" in content
    
    @pytest.mark.asyncio
    async def test_handle_database_error(self):
        """Test database error handling"""
        test_error = ConnectionError("Database connection failed")
        
        response = await handle_database_error(test_error, operation="user_creation")
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 503  # Service unavailable
        
        content = response.body.decode('utf-8')
        assert "database error" in content.lower()
    
    @pytest.mark.asyncio
    async def test_handle_processing_error(self):
        """Test data processing error handling"""
        test_error = ValueError("Invalid data format")
        
        response = await handle_processing_error(test_error, file_name="test.csv")
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 400  # Bad request
        
        content = response.body.decode('utf-8')
        assert "processing failed" in content.lower()

class TestStartupErrorDecorator:
    """Test startup error handling decorator"""
    
    def test_startup_decorator_success(self):
        """Test startup decorator with successful function"""
        @handle_startup_errors
        def successful_initialization():
            return "Initialized successfully"
        
        result = successful_initialization()
        assert result == "Initialized successfully"
    
    def test_startup_decorator_failure(self):
        """Test startup decorator with failing function"""
        @handle_startup_errors
        def failing_initialization():
            raise ConnectionError("Database connection failed")
        
        with pytest.raises(RuntimeError) as exc_info:
            failing_initialization()
        
        assert "Failed to initialize" in str(exc_info.value)
        assert "Database connection failed" in str(exc_info.value)

class TestErrorHandlerIntegration:
    """Test error handler integration with other components"""
    
    @pytest.mark.asyncio
    async def test_integration_with_logging(self):
        """Test error handler integration with logging system"""
        with patch('app.services.core.error_handling.logger') as mock_logger:
            test_error = ValueError("Test error")
            
            await error_handler.handle_error(
                error=test_error,
                component="test_component"
            )
            
            # Should have logged the error
            mock_logger.warning.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_global_error_handler_access(self):
        """Test global error handler access"""
        test_error = RuntimeError("Test error")
        
        error_details = await error_handler.handle_error(
            error=test_error,
            component="global_test"
        )
        
        assert isinstance(error_details, ErrorDetails)
        assert error_details.component == "global_test"
    
    def test_error_handler_thread_safety(self):
        """Test error handler thread safety"""
        import threading
        import time
        
        results = []
        
        def worker():
            for i in range(10):
                error_handler._update_error_stats(f"Error{i}", "component")
                time.sleep(0.001)  # Small delay to encourage race conditions
            results.append("done")
        
        # Start multiple threads
        threads = [threading.Thread(target=worker) for _ in range(5)]
        for thread in threads:
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All threads should complete
        assert len(results) == 5
        
        # Error stats should be consistent
        stats = error_handler.get_error_statistics()
        assert stats['total_errors'] >= 50  # 5 threads * 10 errors each

class TestErrorHandlerPerformance:
    """Test error handler performance"""
    
    @pytest.mark.asyncio
    async def test_error_handling_performance(self):
        """Test error handling performance under load"""
        import time
        
        start_time = time.time()
        
        # Handle many errors quickly
        for i in range(100):
            test_error = ValueError(f"Test error {i}")
            await error_handler.handle_error(
                error=test_error,
                component=f"component_{i % 10}"
            )
        
        handling_time = time.time() - start_time
        
        # Should handle 100 errors quickly
        assert handling_time < 2.0
    
    def test_memory_usage_under_load(self):
        """Test memory usage under error load"""
        import gc
        
        gc.collect()
        initial_objects = len(gc.get_objects())
        
        # Generate many error statistics
        for i in range(1000):
            error_handler._update_error_stats(
                f"ErrorType{i % 50}", 
                f"Component{i % 20}"
            )
        
        gc.collect()
        final_objects = len(gc.get_objects())
        
        # Should not create excessive objects
        object_increase = final_objects - initial_objects
        assert object_increase < 5000  # Reasonable increase for 1000 operations

if __name__ == "__main__":
    pytest.main([__file__, "-v"])