"""
Thin Client for Schlep-Engine API

A lightweight, pure HTTP client that delegates all business logic 
to the backend. This replaces the heavy business-logic SDK 
with a simple, maintainable client interface.

Key Principles:
- HTTP client only (no business logic)
- Simple request/response handling  
- Server-side validation and processing
- Minimal dependencies
- High reliability and performance
"""

import asyncio
import json
import os
from typing import Optional, Dict, Any, List, Union, BinaryIO
from urllib.parse import urljoin, urlparse
from datetime import datetime, timedelta

import aiohttp
import aiofiles
from pydantic import BaseModel, Field, validator

# Minimal exceptions
class SchlepEngineError(Exception):
    """Base exception for Schlep-Engine thin client"""
    pass

class AuthenticationError(SchlepEngineError):
    """Authentication failed"""
    pass

class APIError(SchlepEngineError):
    """API request failed"""
    
    def __init__(self, message: str, status_code: int = None, response: Dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response

class ValidationError(SchlepEngineError):
    """Remote validation failed"""
    pass

# Configuration model
class ClientConfig(BaseModel):
    """Thin client configuration"""
    base_url: str = Field(..., description="API base URL")
    api_key: Optional[str] = Field(None, description="API authentication key")
    timeout: int = Field(30, description="Request timeout in seconds")
    max_retries: int = Field(3, description="Maximum retry attempts")
    retry_delay: float = Field(1.0, description="Delay between retries (seconds)")
    verify_ssl: bool = Field(True, description="Verify SSL certificates")
    user_agent: str = Field("schlep-thin-client/1.0.0", description="User agent string")
    
    @validator('base_url')
    def validate_base_url(cls, v):
        if not v:
            raise ValueError("base_url is required")
        parsed = urlparse(v)
        if parsed.scheme not in ('http', 'https'):
            raise ValueError("base_url must use http or https")
        return v.rstrip('/')

class HTTPClient:
    """Minimal HTTP client for API requests"""
    
    def __init__(self, config: ClientConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        await self._ensure_session()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def _ensure_session(self):
        """Create aiohttp session if not exists"""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            connector = aiohttp.TCPConnector(
                verify_ssl=self.config.verify_ssl,
                limit=100,  # Connection pool size
            )
            
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers=self._get_headers()
            )
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {
            'User-Agent': self.config.user_agent,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
            
        return headers
    
    async def _make_request(
        self, 
        method: str, 
        url: str, 
        data: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        files: Optional[Dict[str, BinaryIO]] = None,
        params: Optional[Dict] = None
    ) -> Dict:
        """Make HTTP request with retry logic"""
        await self._ensure_session()
        
        full_url = urljoin(self.config.base_url, url)
        last_error = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                if files:
                    # File upload
                    data = aiohttp.FormData()
                    for key, file_obj in files.items():
                        if hasattr(file_obj, 'read'):
                            data.add_field(key, file_obj, filename=key)
                        else:
                            data.add_field(key, str(file_obj))
                    
                    async with self.session.request(
                        method, full_url, 
                        data=data, 
                        params=params,
                        headers=self._get_headers()
                    ) as response:
                        return await self._handle_response(response)
                
                else:
                    # JSON request
                    async with self.session.request(
                        method, full_url,
                        json=json_data or data,
                        params=params,
                        headers=self._get_headers()
                    ) as response:
                        return await self._handle_response(response)
                        
            except aiohttp.ClientError as e:
                last_error = e
                if attempt < self.config.max_retries:
                    await asyncio.sleep(self.config.retry_delay * (attempt + 1))
                    continue
                break
            except Exception as e:
                last_error = e
                break
                
        raise APIError(
            f"Request failed after {self.config.max_retries + 1} attempts: {last_error}"
        )
    
    async def _handle_response(self, response: aiohttp.ClientResponse) -> Dict:
        """Handle HTTP response"""
        text = await response.text()
        
        # Try to parse JSON
        try:
            data = json.loads(text) if text else {}
        except json.JSONDecodeError:
            data = {'error': text}
        
        if response.status >= 400:
            if response.status == 401:
                raise AuthenticationError("Authentication failed")
            elif response.status == 422:
                raise ValidationError(data.get('error', 'Validation failed'))
            
            error_msg = data.get('error', data.get('message', 'API request failed'))
            raise APIError(error_msg, response.status, data)
        
        return data
    
    async def get(self, url: str, params: Optional[Dict] = None) -> Dict:
        """GET request"""
        return await self._make_request('GET', url, params=params)
    
    async def post(self, url: str, data: Optional[Dict] = None, json_data: Optional[Dict] = None) -> Dict:
        """POST request"""
        return await self._make_request('POST', url, data=data, json_data=json_data)
    
    async def put(self, url: str, data: Optional[Dict] = None, json_data: Optional[Dict] = None) -> Dict:
        """PUT request"""
        return await self._make_request('PUT', url, data=data, json_data=json_data)
    
    async def delete(self, url: str) -> Dict:
        """DELETE request"""
        return await self._make_request('DELETE', url)
    
    async def upload_file(self, url: str, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """Upload file"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            return await self._make_request('POST', url, files=files, data=metadata)

    
    async def upload_files(self, url: str, files_dict: Dict[str, str], metadata: Optional[Dict] = None) -> Dict:
        """Upload multiple files"""
        files = {}
        for name, path in files_dict.items():
            files[name] = open(path, 'rb')
        
        try:
            return await self._make_request('POST', url, files=files, data=metadata)
        finally:
            for f in files.values():
                f.close()

class SchlepEngineThinClient:
    """
    Thin client for Schlep-Engine API.
    
    This client provides minimal interface to API endpoints,
    delegating all business logic to the backend.
    
    Example usage:
        async with SchlepEngineThinClient(
            base_url="https://api.schlep-engine.com",
            api_key="your-api-key"
        ) as client:
            
            # Simple prediction
            result = await client.predict("iris-v2", [5.1, 3.5, 1.4, 0.2])
            print(f"Prediction: {result['prediction']}")
            
            # Upload and process file
            upload_result = await client.upload_file("data.csv")
            processed = await client.process_data(
                upload_result["id"], 
                operations=["clean", "normalize"]
            )
    """
    
    def __init__(self, base_url: str, api_key: Optional[str] = None, **config_overrides):
        """
        Initialize thin client
        
        Args:
            base_url: API base URL
            api_key: Optional API key for authentication
            **config_overrides: Additional configuration options
        """
        config_dict = {
            "base_url": base_url,
            "api_key": api_key or os.getenv("SCHLEP_API_KEY"),
        }
        config_dict.update(config_overrides)
        
        self.config = ClientConfig(**config_dict)
        self.http_client = HTTPClient(self.config)
        self._session_active = False
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.http_client._ensure_session()
        self._session_active = True
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.http_client.session and not self.http_client.session.closed:
            await self.http_client.session.close()
        self._session_active = False
    
    async def _ensure_session(self):
        """Ensure aiohttp session is active"""
        if not self._session_active:
            await self.http_client._ensure_session()
    
    # ============================================================================
    # Health and Status
    # ============================================================================
    
    async def health_check(self) -> Dict:
        """Check API health status"""
        await self._ensure_session()
        return await self.http_client.get("/health")
    
    async def status(self) -> Dict:
        """Get API status and capabilities"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/status")
    
    # ============================================================================
    # Authentication
    # ============================================================================
    
    async def login(self, email: str, password: str) -> Dict:
        """Authenticate with email/password"""
        await self._ensure_session()
        return await self.http_client.post("/auth/login", {
            "email": email,
            "password": password
        })
    
    async def logout(self) -> Dict:
        """Logout current session"""
        await self._ensure_session()
        return await self.http_client.post("/auth/logout")
    
    async def register(self, email: str, password: str, name: str) -> Dict:
        """Register new user account"""
        await self._ensure_session()
        return await self.http_client.post("/auth/register", {
            "email": email,
            "password": password,
            "name": name
        })
    
    # ============================================================================
    # ML Model Operations
    # ============================================================================
    
    async def predict(self, model_id: str, features: List[float], **kwargs) -> Dict:
        """
        Make prediction with ML model
        
        Args:
            model_id: Model identifier
            features: List of feature values
            **kwargs: Additional prediction options
        
        Returns:
            Dictionary containing prediction results
        """
        await self._ensure_session()
        return await self.http_client.post(f"/api/v1/ml/models/{model_id}/predict", {
            "features": features,
            "options": kwargs
        })
    
    async def batch_predict(self, requests: List[Dict]) -> Dict:
        """
        Batch prediction for multiple requests
        
        Args:
            requests: List of prediction requests
        
        Returns:
            Dictionary containing batch results
        """
        await self._ensure_session()
        return await self.http_client.post("/api/v1/ml/predict/batch", {
            "requests": requests
        })
    
    async def list_models(self) -> Dict:
        """List available ML models"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/ml/models")
    
    async def get_model_info(self, model_id: str) -> Dict:
        """Get detailed information about a model"""
        await self._ensure_session()
        return await self.http_client.get(f"/api/v1/ml/models/{model_id}")
    
    async def train_model(self, config: Dict) -> Dict:
        """Train a new ML model"""
        await self._ensure_session()
        return await self.http_client.post("/api/v1/ml/models/train", config)
    
    async def get_training_status(self, job_id: str) -> Dict:
        """Check training job status"""
        await self._ensure_session()
        return await self.http_client.get(f"/api/v1/ml/training/{job_id}")
    
    # ============================================================================
    # Data Processing
    # ============================================================================
    
    async def upload_file(self, file_path: str, metadata: Optional[Dict] = None) -> Dict:
        """
        Upload file to backend for processing
        
        Args:
            file_path: Path to file to upload
            metadata: Optional metadata about the file
        
        Returns:
            Dictionary with upload result and file ID
        """
        await self._ensure_session()
        return await self.http_client.upload_file("/api/v1/data/upload", file_path, metadata)
    
    async def upload_files(self, files_dict: Dict[str, str], metadata: Optional[Dict] = None) -> Dict:
        """
        Upload multiple files
        
        Args:
            files_dict: Dictionary mapping field names to file paths
            metadata: Optional metadata
        
        Returns:
            Dictionary with upload results
        """
        await self._ensure_session()
        return await self.http_client.upload_files("/api/v1/data/upload/batch", files_dict, metadata)
    
    async def process_data(self, data_id: str, operations: List[str], config: Optional[Dict] = None) -> Dict:
        """
        Process uploaded data with specified operations
        
        Args:
            data_id: ID of uploaded data file
            operations: List of processing operations
            config: Optional configuration for operations
        
        Returns:
            Dictionary with processing results
        """
        await self._ensure_session()
        return await self.http_client.post(f"/api/v1/data/{data_id}/process", {
            "operations": operations,
            "config": config or {}
        })
    
    async def get_data_info(self, data_id: str) -> Dict:
        """Get information about processed data"""
        await self._ensure_session()
        return await self.http_client.get(f"/api/v1/data/{data_id}")
    
    async def download_data(self, data_id: str, file_path: str) -> bool:
        """
        Download processed data to file
        
        Args:
            data_id: ID of data to download
            file_path: Path to save downloaded file
        
        Returns:
            True if download successful
        """
        await self._ensure_session()
        
        full_url = urljoin(self.config.base_url, f"/api/v1/data/{data_id}/download")
        
        async with self.http_client.session.get(full_url) as response:
            if response.status == 200:
                async with aiofiles.open(file_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        await f.write(chunk)
                return True
            else:
                raise APIError(f"Download failed: {response.status}")
    
    # ============================================================================
    # Storage Operations
    # ============================================================================
    
    async def create_bucket(self, name: str, config: Optional[Dict] = None) -> Dict:
        """Create storage bucket"""
        await self._ensure_session()
        return await self.http_client.post("/api/v1/storage/buckets", {
            "name": name,
            "config": config or {}
        })
    
    async def list_buckets(self) -> Dict:
        """List storage buckets"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/storage/buckets")
    
    async def delete_bucket(self, bucket_name: str) -> Dict:
        """Delete storage bucket"""
        await self._ensure_session()
        return await self.http_client.delete(f"/api/v1/storage/buckets/{bucket_name}")
    
    # ============================================================================
    # Monitoring and Analytics
    # ============================================================================
    
    async def get_metrics(self, time_range: Optional[str] = None) -> Dict:
        """Get system metrics"""
        await self._ensure_session()
        params = {"time_range": time_range} if time_range else {}
        return await self.http_client.get("/api/v1/monitoring/metrics", params)
    
    async def get_usage_stats(self, start_date: str, end_date: str) -> Dict:
        """Get usage statistics for date range"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/monitoring/usage", {
            "start_date": start_date,
            "end_date": end_date
        })
    
    async def get_logs(self, limit: int = 100, level: Optional[str] = None) -> Dict:
        """Get system logs"""
        await self._ensure_session()
        params = {"limit": limit}
        if level:
            params["level"] = level
        return await self.http_client.get("/api/v1/monitoring/logs", params)
    
    # ============================================================================
    # Admin Operations
    # ============================================================================
    
    async def get_system_info(self) -> Dict:
        """Get system information (admin only)"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/admin/system")
    
    async def get_user_list(self, limit: int = 100) -> Dict:
        """Get user list (admin only)"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/admin/users", {"limit": limit})
    
    async def get_system_health(self) -> Dict:
        """Get detailed system health (admin only)"""
        await self._ensure_session()
        return await self.http_client.get("/api/v1/admin/health")

# Convenience instances
def create_client(base_url: str, api_key: Optional[str] = None, **kwargs) -> SchlepEngineThinClient:
    """Create thin client instance"""
    return SchlepEngineThinClient(base_url, api_key, **kwargs)

# Default client for environment variables
def default_client() -> SchlepEngineThinClient:
    """Create client using environment variables"""
    return SchlepEngineThinClient(
        base_url=os.getenv("SCHLEP_API_URL", "https://api.schlep-engine.com"),
        api_key=os.getenv("SCHLEP_API_KEY"),
        timeout=int(os.getenv("SCHLEP_TIMEOUT", "30"))
    )
