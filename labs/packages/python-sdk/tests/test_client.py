"""
Tests for the main IgrisClient class
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from igris import IgrisClient
from igris.client.main import IgrisClientSync
from igris.exceptions.base import ConfigurationError, AuthenticationError


class TestIgrisClient:
    """Test cases for the main async client."""

    def test_client_initialization(self, test_api_key, test_base_url):
        """Test client initialization with various parameters."""
        # Test with API key
        client = IgrisClient(api_key=test_api_key)
        assert client.auth_manager.api_key == test_api_key
        assert client.is_authenticated is True
        
        # Test with custom base URL
        client = IgrisClient(base_url=test_base_url)
        assert client.base_url == test_base_url
        
        # Test with all parameters
        client = IgrisClient(
            api_key=test_api_key,
            base_url=test_base_url,
            timeout=10.0,
            debug=True
        )
        assert client.timeout == 10.0
        assert client.debug is True

    def test_client_properties(self, test_api_key):
        """Test client property methods."""
        client = IgrisClient(api_key=test_api_key)
        
        assert client.is_authenticated is True
        assert client.auth_method == "api_key"
        
        # Test without API key
        client_no_auth = IgrisClient()
        assert client_no_auth.is_authenticated is False
        assert client_no_auth.auth_method == "none"

    def test_sdk_info(self, test_api_key, test_base_url):
        """Test SDK info retrieval."""
        client = IgrisClient(
            api_key=test_api_key,
            base_url=test_base_url
        )
        
        info = client.get_sdk_info()
        
        assert "name" in info
        assert "version" in info
        assert "base_url" in info
        assert info["base_url"] == test_base_url
        assert info["is_authenticated"] is True
        assert info["auth_method"] == "api_key"

    def test_api_endpoints_initialized(self, test_api_key):
        """Test that all API endpoints are properly initialized."""
        client = IgrisClient(api_key=test_api_key)
        
        # Check that all expected endpoints exist
        expected_endpoints = [
            'auth', 'data', 'ml', 'analytics', 'extract', 
            'quality', 'storage', 'monitoring', 'users', 'admin'
        ]
        
        for endpoint in expected_endpoints:
            assert hasattr(client, endpoint)
            assert getattr(client, endpoint) is not None

    async def test_context_manager(self, test_api_key):
        """Test client as async context manager."""
        async with IgrisClient(api_key=test_api_key) as client:
            assert client.is_authenticated is True
            # Client should be usable within context

    async def test_connection_test(self, client, mock_http_client):
        """Test connection testing functionality."""
        with patch.object(client, 'http_client', mock_http_client):
            mock_http_client.get.return_value = {
                "status": "healthy",
                "version": "1.0.0"
            }
            
            result = await client.test_connection()
            assert result["status"] == "healthy"
            mock_http_client.get.assert_called_once()

    async def test_request_methods(self, client, mock_http_client):
        """Test HTTP request methods."""
        with patch.object(client, 'http_client', mock_http_client):
            # Test GET
            await client.get("/test")
            mock_http_client.get.assert_called()
            
            # Test POST
            await client.post("/test", json={"key": "value"})
            mock_http_client.post.assert_called()
            
            # Test PUT
            await client.put("/test", json={"key": "value"})
            mock_http_client.put.assert_called()
            
            # Test PATCH
            await client.patch("/test", json={"key": "value"})
            mock_http_client.patch.assert_called()
            
            # Test DELETE
            await client.delete("/test")
            mock_http_client.delete.assert_called()

    async def test_auth_headers_injection(self, client, mock_http_client):
        """Test that authentication headers are properly injected."""
        with patch.object(client, 'http_client', mock_http_client):
            await client.get("/test")
            
            # Check that the call included auth headers
            args, kwargs = mock_http_client.get.call_args
            headers = kwargs.get('headers', {})
            assert 'Authorization' in headers

    def test_api_key_update(self, client):
        """Test updating API key."""
        new_key = "new-api-key-123"
        client.set_api_key(new_key)
        
        assert client.auth_manager.api_key == new_key
        assert client.is_authenticated is True

    async def test_close_cleanup(self, test_api_key):
        """Test client cleanup on close."""
        client = IgrisClient(api_key=test_api_key)
        
        with patch.object(client.http_client, 'close', new_callable=AsyncMock) as mock_close:
            await client.close()
            mock_close.assert_called_once()


class TestIgrisClientSync:
    """Test cases for the synchronous client wrapper."""

    def test_sync_client_initialization(self, test_api_key, test_base_url):
        """Test sync client initialization."""
        client = IgrisClientSync(
            api_key=test_api_key,
            base_url=test_base_url
        )
        
        assert client._async_client.auth_manager.api_key == test_api_key
        assert client._async_client.base_url == test_base_url

    def test_sync_client_attribute_proxy(self, sync_client):
        """Test that sync client properly proxies attributes."""
        # Test property access
        assert sync_client.is_authenticated is not None
        assert sync_client.auth_method is not None
        
        # Test method access
        assert callable(getattr(sync_client, 'get_sdk_info', None))

    def test_sync_client_api_endpoints(self, sync_client):
        """Test that API endpoints are available in sync client."""
        expected_endpoints = [
            'auth', 'data', 'ml', 'analytics', 'extract',
            'quality', 'storage', 'monitoring', 'users', 'admin'
        ]
        
        for endpoint in expected_endpoints:
            assert hasattr(sync_client, endpoint)
            endpoint_obj = getattr(sync_client, endpoint)
            assert endpoint_obj is not None

    def test_sync_client_close(self, sync_client):
        """Test sync client cleanup."""
        # Should not raise exception
        sync_client.close()


class TestClientErrorHandling:
    """Test error handling in client classes."""

    def test_invalid_base_url(self):
        """Test handling of invalid base URLs."""
        # Should not raise during initialization
        client = IgrisClient(base_url="invalid-url")
        assert client.base_url == "invalid-url"

    async def test_request_error_handling(self, client):
        """Test error handling in requests."""
        from igris.exceptions.base import NetworkError
        
        with patch.object(client.http_client, 'get', side_effect=NetworkError("Network error")):
            with pytest.raises(NetworkError):
                await client.get("/test")

    async def test_authentication_error_handling(self, client):
        """Test authentication error handling."""
        from igris.exceptions.base import AuthenticationError
        
        with patch.object(client.http_client, 'get', side_effect=AuthenticationError("Auth failed")):
            with pytest.raises(AuthenticationError):
                await client.get("/test")


class TestClientConfiguration:
    """Test client configuration and customization."""

    def test_custom_user_agent(self, test_api_key):
        """Test custom user agent configuration."""
        custom_ua = "MyApp/1.0"
        client = IgrisClient(
            api_key=test_api_key,
            user_agent=custom_ua
        )
        
        # HTTP client should be initialized with custom user agent
        assert client.http_client.user_agent == custom_ua

    def test_custom_timeout(self, test_api_key):
        """Test custom timeout configuration."""
        timeout = 60.0
        client = IgrisClient(
            api_key=test_api_key,
            timeout=timeout
        )
        
        assert client.timeout == timeout
        assert client.http_client.timeout == timeout

    def test_debug_mode(self, test_api_key):
        """Test debug mode configuration."""
        client = IgrisClient(
            api_key=test_api_key,
            debug=True
        )
        
        assert client.debug is True

    def test_retry_configuration(self, test_api_key, retry_config):
        """Test retry configuration."""
        client = IgrisClient(
            api_key=test_api_key,
            retry_config=retry_config
        )
        
        assert client.http_client.retry_handler.config.max_retries == 2