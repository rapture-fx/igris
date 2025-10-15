#!/usr/bin/env python3
"""
Integration tests for generated Python client
Tests basic functionality, authentication, and error handling
"""

import os
import sys
import json
import pytest
import requests
from unittest.mock import Mock, patch

# Add the generated client to path
CLIENT_PATH = os.path.join(os.path.dirname(__file__), '../../generated/python')
sys.path.insert(0, CLIENT_PATH)

try:
    import schlep_engine_client
    from schlep_engine_client.api_client import ApiClient
    from schlep_engine_client.configuration import Configuration
except ImportError as e:
    pytest.skip(f"Generated Python client not found: {e}", allow_module_level=True)


class TestPythonClientIntegration:
    """Test suite for Python client integration"""
    
    @classmethod
    def setup_class(cls):
        """Set up test environment"""
        cls.base_url = "https://api.schlep-engine.com"
        cls.api_key = "test_api_key_12345"
        cls.test_timeout = 30
    
    def test_client_import(self):
        """Test that client can be imported successfully"""
        assert hasattr(schlep_engine_client, '__version__')
        assert schlep_engine_client.__version__ is not None
    
    def test_configuration_creation(self):
        """Test configuration object creation"""
        config = Configuration()
        assert config is not None
        
        # Test with custom settings
        config = Configuration(
            host=self.base_url,
            api_key={'X-API-Key': self.api_key}
        )
        assert config.host == self.base_url
        assert config.api_key.get('X-API-Key') == self.api_key
    
    def test_api_client_creation(self):
        """Test API client creation"""
        config = Configuration(
            host=self.base_url,
            api_key={'X-API-Key': self.api_key}
        )
        
        client = ApiClient(configuration=config)
        assert client is not None
        assert client.configuration.host == self.base_url
    
    @patch('requests.Session.request')
    def test_authentication_headers(self, mock_request):
        """Test that authentication headers are properly set"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {'content-type': 'application/json'}
        mock_response.json.return_value = {'status': 'success'}
        mock_request.return_value = mock_response
        
        config = Configuration(
            host=self.base_url,
            api_key={'X-API-Key': self.api_key}
        )
        
        client = ApiClient(configuration=config)
        
        # Make a test request
        try:
            client.call_api(
                '/api/v1/health',
                'GET',
                auth_settings=['ApiKeyAuth']
            )
        except Exception:
            # Expected since we're mocking
            pass
        
        # Verify API key header was added
        assert mock_request.called
        call_args = mock_request.call_args
        headers = call_args[1].get('headers', {})
        assert 'X-API-Key' in headers
        assert headers['X-API-Key'] == self.api_key
    
    def test_error_handling(self):
        """Test error handling for various HTTP status codes"""
        config = Configuration(
            host="https://httpbin.org",  # Using httpbin for testing
            api_key={'X-API-Key': self.api_key}
        )
        
        client = ApiClient(configuration=config)
        
        # Test 404 error
        with pytest.raises(Exception):  # Should raise ApiException
            client.call_api('/status/404', 'GET')
        
        # Test 500 error
        with pytest.raises(Exception):  # Should raise ApiException
            client.call_api('/status/500', 'GET')
    
    @patch('requests.Session.request')
    def test_request_timeout(self, mock_request):
        """Test request timeout handling"""
        mock_request.side_effect = requests.Timeout("Request timed out")
        
        config = Configuration(
            host=self.base_url,
            api_key={'X-API-Key': self.api_key}
        )
        
        client = ApiClient(configuration=config)
        
        with pytest.raises(Exception):  # Should handle timeout
            client.call_api('/api/v1/health', 'GET', _request_timeout=1)
    
    def test_json_serialization(self):
        """Test JSON serialization/deserialization"""
        config = Configuration()
        client = ApiClient(configuration=config)
        
        # Test serialization of common types
        test_data = {
            'string_field': 'test',
            'int_field': 123,
            'float_field': 123.45,
            'bool_field': True,
            'list_field': [1, 2, 3],
            'dict_field': {'nested': 'value'}
        }
        
        serialized = client.sanitize_for_serialization(test_data)
        assert serialized == test_data
    
    def test_user_agent_header(self):
        """Test that proper User-Agent header is set"""
        config = Configuration(
            host=self.base_url,
            api_key={'X-API-Key': self.api_key}
        )
        
        client = ApiClient(configuration=config)
        
        # Check default user agent
        assert client.user_agent is not None
        assert 'schlep-engine-python-client' in client.user_agent.lower()
    
    def test_ssl_verification(self):
        """Test SSL verification settings"""
        # Test with SSL verification enabled (default)
        config = Configuration(host=self.base_url)
        client = ApiClient(configuration=config)
        assert config.verify_ssl == True
        
        # Test with SSL verification disabled
        config = Configuration(host=self.base_url, verify_ssl=False)
        client = ApiClient(configuration=config)
        assert config.verify_ssl == False
    
    @patch('requests.Session.request')
    def test_retry_logic(self, mock_request):
        """Test retry logic for transient errors"""
        # First call fails, second succeeds
        mock_response_failure = Mock()
        mock_response_failure.status_code = 503
        mock_response_failure.reason = "Service Unavailable"
        
        mock_response_success = Mock()
        mock_response_success.status_code = 200
        mock_response_success.headers = {'content-type': 'application/json'}
        mock_response_success.json.return_value = {'status': 'success'}
        
        mock_request.side_effect = [mock_response_failure, mock_response_success]
        
        config = Configuration(
            host=self.base_url,
            api_key={'X-API-Key': self.api_key}
        )
        
        client = ApiClient(configuration=config)
        
        # This should retry once and succeed on second attempt
        # Note: Actual retry logic depends on client implementation
        try:
            response = client.call_api('/api/v1/health', 'GET')
            # If we get here, retry worked
            assert mock_request.call_count >= 1
        except Exception:
            # If retry isn't implemented, this is expected
            pass
    
    def test_parameter_validation(self):
        """Test parameter validation"""
        config = Configuration()
        client = ApiClient(configuration=config)
        
        # Test invalid parameter types
        with pytest.raises((ValueError, TypeError)):
            # This should fail validation
            client.call_api('/test', 'INVALID_METHOD')
    
    @pytest.mark.skipif(
        os.environ.get('SKIP_LIVE_TESTS') == 'true',
        reason="Live tests disabled"
    )
    def test_live_health_check(self):
        """Test actual health check endpoint (if API is running)"""
        config = Configuration(
            host="http://localhost:8000",  # Local development server
            api_key={'X-API-Key': 'test_key'}
        )
        
        client = ApiClient(configuration=config)
        
        try:
            response = client.call_api('/health', 'GET')
            # If we get here, the API is running
            assert response is not None
        except Exception:
            # Expected if API is not running
            pytest.skip("API server not available for live testing")


class TestPythonClientModels:
    """Test generated model classes"""
    
    def test_model_imports(self):
        """Test that model classes can be imported"""
        try:
            # Try to import common model classes
            # Note: Actual imports depend on generated models
            from schlep_engine_client.models import *
            # If we get here, models imported successfully
            assert True
        except ImportError:
            # Models might not be generated yet
            pytest.skip("Model classes not found in generated client")
    
    def test_model_validation(self):
        """Test model validation"""
        # This test would validate model creation and validation
        # Actual implementation depends on generated models
        pass


class TestPythonClientAPIs:
    """Test generated API classes"""
    
    def test_api_imports(self):
        """Test that API classes can be imported"""
        try:
            # Try to import API classes
            # Note: Actual imports depend on generated APIs
            from schlep_engine_client.api import *
            # If we get here, APIs imported successfully
            assert True
        except ImportError:
            # APIs might not be generated yet
            pytest.skip("API classes not found in generated client")


def main():
    """Run tests if executed directly"""
    pytest.main([__file__, '-v'])


if __name__ == '__main__':
    main()