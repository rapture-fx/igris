"""
Main Schlep-engine SDK Client

Official Python client for the Schlep-engine API platform.
"""

import asyncio
from typing import Optional, Dict, Any, Union
from urllib.parse import urljoin

from ..auth.manager import AuthManager
from ..utils.http_client import HTTPClient
from ..utils.retry import RetryConfig
from ..utils.logging import LoggerMixin, setup_logging
from ..exceptions.base import ConfigurationError, SchlepEngineError
from ..api.data_processing import DataProcessingAPI
from ..api.ml_pipeline import MLPipelineAPI
from ..api.analytics import AnalyticsAPI
from ..api.document_extraction import DocumentExtractionAPI
from ..api.data_quality import DataQualityAPI
from ..api.storage import StorageAPI
from ..api.auth import AuthAPI
from ..api.monitoring import MonitoringAPI
from ..api.users import UsersAPI
from ..api.admin import AdminAPI
from ..api.model_registry import ModelRegistryAPI
from ..api.cache import CacheAPI
from ..api.observability import ObservabilityAPI


class SchlepEngineClient(LoggerMixin):
    """
    Main client class for the Schlep-engine Python SDK.
    
    This client provides access to all Schlep-engine API endpoints with
    built-in authentication, retry logic, and error handling.
    
    Example usage:
        # With API key
        client = SchlepEngineClient(api_key="your-api-key")
        
        # Process data
        result = await client.data.process_file("data.csv")
        
        # Run ML pipeline
        pipeline = await client.ml.create_pipeline(config)
        
        # With user authentication
        client = SchlepEngineClient()
        await client.auth.login("user@example.com", "password")
        
        # Use context manager for automatic cleanup
        async with SchlepEngineClient(api_key="your-key") as client:
            result = await client.data.process_file("data.csv")
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        retry_config: Optional[RetryConfig] = None,
        user_agent: Optional[str] = None,
        debug: bool = False
    ):
        """
        Initialize Schlep-engine client.
        
        Args:
            api_key: API key for authentication
            base_url: Base URL for the API (defaults to production)
            timeout: Request timeout in seconds
            retry_config: Retry configuration for failed requests
            user_agent: Custom user agent string
            debug: Enable debug logging
        """
        # Set up logging if debug is enabled
        if debug:
            setup_logging(level="DEBUG")
        
        # Configuration
        self.base_url = base_url or "https://api.schlep-engine.com"
        self.timeout = timeout
        self.debug = debug
        
        # Initialize HTTP client
        self.http_client = HTTPClient(
            base_url=self.base_url,
            timeout=timeout,
            retry_config=retry_config,
            user_agent=user_agent
        )
        
        # Initialize authentication manager
        self.auth_manager = AuthManager(
            api_key=api_key,
            base_url=self.base_url
        )
        self.auth_manager.set_http_client(self.http_client)
        
        # Initialize API endpoints
        self._init_api_endpoints()
        
        self.logger.info(f"Schlep-engine client initialized with base URL: {self.base_url}")
    
    def _init_api_endpoints(self):
        """Initialize all API endpoint classes."""
        # Core APIs
        self.auth = AuthAPI(self)
        self.data = DataProcessingAPI(self)
        self.ml = MLPipelineAPI(self)
        self.analytics = AnalyticsAPI(self)
        self.extract = DocumentExtractionAPI(self)
        self.quality = DataQualityAPI(self)
        self.storage = StorageAPI(self)

        # Management APIs
        self.monitoring = MonitoringAPI(self)
        self.users = UsersAPI(self)
        self.admin = AdminAPI(self)

        # Phase 2-4 APIs (Enterprise Maturity)
        self.model_registry = ModelRegistryAPI(self)  # Phase 2: Model lifecycle
        self.cache = CacheAPI(self)  # Phase 3: Advanced caching
        self.observability = ObservabilityAPI(self)  # Phase 4: Observability 2.0
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.http_client.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.http_client.__aexit__(exc_type, exc_val, exc_tb)
    
    async def close(self):
        """Close the client and cleanup resources."""
        await self.http_client.close()
        self.logger.info("Schlep-engine client closed")
    
    @property
    def is_authenticated(self) -> bool:
        """Check if client is authenticated."""
        return self.auth_manager.is_authenticated
    
    @property
    def auth_method(self) -> str:
        """Get current authentication method."""
        return self.auth_manager.auth_method
    
    def set_api_key(self, api_key: str):
        """
        Set API key for authentication.
        
        Args:
            api_key: API key to use for requests
        """
        self.auth_manager.set_api_key(api_key)
        self.logger.info("API key updated")
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to the API.
        
        Returns:
            API status and version information
        """
        try:
            response = await self.request("GET", "/health")
            self.logger.info("Connection test successful")
            return response
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            raise
    
    async def request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make authenticated API request.
        
        Args:
            method: HTTP method
            path: API path
            **kwargs: Additional request parameters
            
        Returns:
            API response data
        """
        # Add authentication headers
        headers = kwargs.get('headers', {})
        auth_headers = self.auth_manager.get_auth_headers()
        headers.update(auth_headers)
        kwargs['headers'] = headers
        
        # Ensure path starts with /api/v1 if not already prefixed
        if not path.startswith(('/health', '/api/', 'http')):
            path = f"/api/v1{path}" if not path.startswith('/') else f"/api/v1{path}"
        
        # Make request
        method_func = getattr(self.http_client, method.lower())
        return await method_func(path, **kwargs)
    
    # Convenience methods for common HTTP verbs
    
    async def get(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make GET request."""
        return await self.request("GET", path, **kwargs)
    
    async def post(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make POST request."""
        return await self.request("POST", path, **kwargs)
    
    async def put(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make PUT request."""
        return await self.request("PUT", path, **kwargs)
    
    async def patch(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make PATCH request."""
        return await self.request("PATCH", path, **kwargs)
    
    async def delete(self, path: str, **kwargs) -> Dict[str, Any]:
        """Make DELETE request."""
        return await self.request("DELETE", path, **kwargs)
    
    # Utility methods
    
    def get_sdk_info(self) -> Dict[str, Any]:
        """
        Get SDK information.
        
        Returns:
            Dictionary containing SDK version and configuration info
        """
        from .. import get_sdk_info
        info = get_sdk_info()
        info.update({
            "base_url": self.base_url,
            "timeout": self.timeout,
            "auth_method": self.auth_method,
            "is_authenticated": self.is_authenticated,
            "debug": self.debug
        })
        return info


# Synchronous wrapper for backwards compatibility
class SchlepEngineClientSync:
    """
    Synchronous wrapper for SchlepEngineClient.
    
    This provides a synchronous interface to the async client for
    backwards compatibility and simpler usage in non-async contexts.
    """
    
    def __init__(self, **kwargs):
        """Initialize sync client with same parameters as async client."""
        self._async_client = SchlepEngineClient(**kwargs)
        self._loop = None
    
    def _get_loop(self):
        """Get or create event loop."""
        if self._loop is None:
            try:
                self._loop = asyncio.get_event_loop()
            except RuntimeError:
                self._loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._loop)
        return self._loop
    
    def _run_async(self, coro):
        """Run async coroutine in event loop."""
        loop = self._get_loop()
        return loop.run_until_complete(coro)
    
    def __getattr__(self, name):
        """Proxy attribute access to async client."""
        attr = getattr(self._async_client, name)
        
        # If it's a coroutine function, wrap it
        if asyncio.iscoroutinefunction(attr):
            def sync_wrapper(*args, **kwargs):
                coro = attr(*args, **kwargs)
                return self._run_async(coro)
            return sync_wrapper
        
        # If it's an API endpoint, wrap its methods
        if hasattr(attr, '__dict__'):
            # This handles API endpoint objects
            class SyncAPIWrapper:
                def __init__(self, async_api):
                    self._async_api = async_api
                
                def __getattr__(self, method_name):
                    method = getattr(self._async_api, method_name)
                    if asyncio.iscoroutinefunction(method):
                        def sync_method(*args, **kwargs):
                            coro = method(*args, **kwargs)
                            return self._run_async(coro)
                        return sync_method
                    return method
            
            return SyncAPIWrapper(attr)
        
        return attr
    
    def close(self):
        """Close the client."""
        self._run_async(self._async_client.close())
        if self._loop and not self._loop.is_closed():
            self._loop.close()