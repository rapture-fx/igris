"""
HTTP client for Igris-engine SDK
"""

import asyncio
import time
from typing import Any, Dict, Optional, Union, List
from urllib.parse import urljoin
import json

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

from ..exceptions.base import (
    NetworkError, TimeoutError, APIError, parse_api_error,
    RateLimitError, AuthenticationError, ServerError
)
from ..utils.retry import RetryHandler, RetryConfig
from ..utils.logging import LoggerMixin, log_api_request, log_api_response
from ..utils.validation import InputValidator
from ..utils.rate_limiter import AdaptiveRateLimiter


class HTTPClient(LoggerMixin):
    """
    HTTP client for making API requests to Igris-engine.
    Supports both httpx and aiohttp as backends.
    """
    
    def __init__(
        self,
        base_url: str,
        timeout: float = 30.0,
        retry_config: Optional[RetryConfig] = None,
        user_agent: Optional[str] = None,
        backend: Optional[str] = None,
        enable_rate_limiting: bool = True,
        initial_rps: float = 10.0
    ):
        """
        Initialize HTTP client.
        
        Args:
            base_url: Base URL for API requests
            timeout: Request timeout in seconds
            retry_config: Retry configuration
            user_agent: Custom user agent string
            backend: HTTP backend to use ('httpx' or 'aiohttp')
            enable_rate_limiting: Whether to enable adaptive rate limiting
            initial_rps: Initial requests per second limit
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.retry_handler = RetryHandler(retry_config or RetryConfig())
        
        # Rate limiting
        self.enable_rate_limiting = enable_rate_limiting
        self.rate_limiter = AdaptiveRateLimiter(initial_rps=initial_rps) if enable_rate_limiting else None
        
        # Determine backend
        if backend:
            self.backend = backend
        elif HAS_HTTPX:
            self.backend = 'httpx'
        elif HAS_AIOHTTP:
            self.backend = 'aiohttp'
        else:
            raise RuntimeError("No supported HTTP client library found. Install 'httpx' or 'aiohttp'.")
        
        # Set user agent
        if user_agent is None:
            from .. import __version__
            user_agent = f"Igris-engine-Python-SDK/{__version__}"
        self.user_agent = user_agent
        
        self._client = None
        self._session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._ensure_client()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def _ensure_client(self):
        """Ensure HTTP client is initialized."""
        if self._client is None:
            if self.backend == 'httpx':
                # Enhanced client with connection pooling and limits
                self._client = httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout),
                    headers={"User-Agent": self.user_agent},
                    limits=httpx.Limits(
                        max_keepalive_connections=10,  # Keep-alive connections pool
                        max_connections=100,           # Total connection pool size
                        keepalive_expiry=30.0          # Keep-alive timeout
                    ),
                    http2=True,  # Enable HTTP/2 support for better performance
                    follow_redirects=True  # Handle redirects automatically
                )
            elif self.backend == 'aiohttp':
                timeout = aiohttp.ClientTimeout(total=self.timeout)
                # Enhanced connector with connection pooling
                connector = aiohttp.TCPConnector(
                    limit=100,              # Total connection pool size
                    limit_per_host=30,      # Max connections per host
                    keepalive_timeout=30,   # Keep-alive timeout
                    enable_cleanup_closed=True,  # Clean up closed connections
                    ttl_dns_cache=300,      # DNS cache TTL
                )
                self._session = aiohttp.ClientSession(
                    timeout=timeout,
                    headers={"User-Agent": self.user_agent},
                    connector=connector
                )
    
    async def close(self):
        """Close HTTP client and cleanup resources."""
        if self.rate_limiter:
            await self.rate_limiter.close()
        
        if self._client:
            await self._client.aclose()
            self._client = None
        if self._session:
            await self._session.close()
            self._session = None
    
    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        if path.startswith('http'):
            return path
        return urljoin(self.base_url + '/', path.lstrip('/'))
    
    async def _make_request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Any] = None,
        data: Optional[Any] = None,
        files: Optional[Dict[str, Any]] = None,
        skip_validation: bool = False
    ) -> Dict[str, Any]:
        """
        Make HTTP request with retry logic and input validation.
        
        Args:
            method: HTTP method
            url: Request URL
            headers: Request headers
            params: URL parameters
            json_data: JSON data
            data: Form data
            files: File uploads
            skip_validation: Skip input validation (use with caution)
            
        Returns:
            Response data
        """
        await self._ensure_client()
        
        # Validate inputs unless explicitly skipped
        if not skip_validation:
            # Validate URL
            url = InputValidator.validate_url(url)
            
            # Validate headers
            if headers:
                headers = InputValidator.validate_dict_params(headers)
            
            # Validate URL parameters
            if params:
                params = InputValidator.validate_dict_params(params)
            
            # Validate JSON data
            if json_data is not None:
                json_data = InputValidator.validate_json_data(json_data)
            
            # Validate form data
            if data is not None:
                if isinstance(data, dict):
                    data = InputValidator.validate_dict_params(data)
                else:
                    # For non-dict data, convert to string and validate
                    data = InputValidator.sanitize_string(str(data))
        
        # Prepare headers
        request_headers = {"Accept": "application/json"}
        if headers:
            request_headers.update(headers)
        
        # Log request (returns request ID for correlation)
        request_id = log_api_request(method, url, request_headers, json_data or data)
        
        async def _execute_request():
            start_time = time.time()
            
            try:
                if self.backend == 'httpx':
                    response = await self._client.request(
                        method=method,
                        url=url,
                        headers=request_headers,
                        params=params,
                        json=json_data,
                        data=data,
                        files=files
                    )
                    status_code = response.status_code
                    response_text = response.text
                    
                else:  # aiohttp
                    kwargs = {
                        'headers': request_headers,
                        'params': params
                    }
                    
                    if json_data is not None:
                        kwargs['json'] = json_data
                    elif data is not None:
                        kwargs['data'] = data
                    
                    if files:
                        # Convert files to aiohttp format
                        form_data = aiohttp.FormData()
                        for name, file_info in files.items():
                            if isinstance(file_info, tuple):
                                filename, file_obj, content_type = file_info
                                form_data.add_field(name, file_obj, filename=filename, content_type=content_type)
                            else:
                                form_data.add_field(name, file_info)
                        kwargs['data'] = form_data
                    
                    async with self._session.request(method, url, **kwargs) as response:
                        status_code = response.status
                        response_text = await response.text()
                
                duration = time.time() - start_time
                
                # Parse response
                try:
                    response_data = json.loads(response_text) if response_text else {}
                except json.JSONDecodeError:
                    response_data = {"message": response_text}
                
                # Log response with correlation
                error_type = None
                if status_code >= 400:
                    error_type = response_data.get("error", "api_error")
                
                log_api_response(
                    status_code, 
                    response_data, 
                    duration, 
                    request_id=request_id,
                    error_type=error_type
                )
                
                # Update rate limiter with response headers
                if self.rate_limiter:
                    if self.backend == 'httpx':
                        self.rate_limiter.update_rate_limits(dict(response.headers))
                    else:  # aiohttp
                        self.rate_limiter.update_rate_limits(dict(response.headers))
                
                # Handle rate limiting with specific logic
                if status_code == 429:
                    # Extract retry-after header if available
                    retry_after = None
                    if self.backend == 'httpx':
                        retry_after = response.headers.get('Retry-After')
                    else:  # aiohttp
                        retry_after = response.headers.get('Retry-After')
                    
                    if retry_after:
                        try:
                            retry_after = int(retry_after)
                        except ValueError:
                            retry_after = None
                    
                    # Create rate limit error with retry_after info
                    from ..exceptions.base import RateLimitError
                    raise RateLimitError(
                        message=response_data.get("message", "Rate limit exceeded"),
                        retry_after=retry_after,
                        response_data=response_data
                    )
                
                # Handle other errors
                if status_code >= 400:
                    raise parse_api_error(response_data, status_code)
                
                return response_data
                
            except asyncio.TimeoutError:
                raise TimeoutError(f"Request to {url} timed out after {self.timeout}s")
            except (httpx.RequestError, aiohttp.ClientError) as e:
                raise NetworkError(f"Network error: {str(e)}", original_error=e)
            except json.JSONDecodeError as e:
                raise APIError(f"Invalid JSON response: {str(e)}")
        
        # Execute with rate limiting and retry
        if self.rate_limiter:
            return await self.rate_limiter.execute_request(_execute_request)
        else:
            return await self.retry_handler.execute_with_retry(_execute_request)
    
    async def get(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make GET request.
        
        Args:
            path: Request path
            headers: Request headers
            params: URL parameters
            
        Returns:
            Response data
        """
        url = self._build_url(path)
        return await self._make_request("GET", url, headers=headers, params=params)
    
    async def post(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        files: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make POST request.
        
        Args:
            path: Request path
            headers: Request headers
            json: JSON data
            data: Form data
            files: File uploads
            
        Returns:
            Response data
        """
        url = self._build_url(path)
        return await self._make_request("POST", url, headers=headers, json_data=json, data=data, files=files)
    
    async def put(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Make PUT request.
        
        Args:
            path: Request path
            headers: Request headers
            json: JSON data
            data: Form data
            
        Returns:
            Response data
        """
        url = self._build_url(path)
        return await self._make_request("PUT", url, headers=headers, json_data=json, data=data)
    
    async def patch(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Make PATCH request.
        
        Args:
            path: Request path
            headers: Request headers
            json: JSON data
            data: Form data
            
        Returns:
            Response data
        """
        url = self._build_url(path)
        return await self._make_request("PATCH", url, headers=headers, json_data=json, data=data)
    
    async def delete(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make DELETE request.
        
        Args:
            path: Request path
            headers: Request headers
            params: URL parameters
            
        Returns:
            Response data
        """
        url = self._build_url(path)
        return await self._make_request("DELETE", url, headers=headers, params=params)