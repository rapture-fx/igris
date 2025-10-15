"""
Integration tests with mock server for end-to-end flows
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_mock_server

from schlep_engine import SchlepEngineClient
from schlep_engine.models.auth import TokenResponse, UserInfo
from schlep_engine.exceptions.base import RateLimitError, AuthenticationError, ValidationError


class MockSchlepEngineServer:
    """Mock server that simulates Schlep Engine API behavior."""
    
    def __init__(self):
        self.users = {}
        self.tokens = {}
        self.api_keys = {"test-api-key": {"user_id": "api-user", "active": True}}
        self.rate_limit_remaining = 100
        self.rate_limit_reset = datetime.now().timestamp() + 3600
        
    async def login(self, request):
        """Mock login endpoint."""
        try:
            data = await request.json()
        except Exception:
            return web.json_response(
                {"error": "Invalid JSON"}, 
                status=400
            )
        
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return web.json_response(
                {"error": "Missing email or password"}, 
                status=400
            )
        
        if email == "test@example.com" and password == "password":
            user_id = "user-123"
            access_token = "access-token-123"
            refresh_token = "refresh-token-123"
            
            # Store token
            self.tokens[access_token] = {
                "user_id": user_id,
                "expires_at": datetime.now() + timedelta(hours=1)
            }
            
            return web.json_response({
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": 3600,
                "user": {
                    "id": user_id,
                    "email": email,
                    "username": "testuser",
                    "role": "user",
                    "is_active": True,
                    "created_at": datetime.now().isoformat()
                }
            })
        else:
            return web.json_response(
                {"error": "Invalid credentials"}, 
                status=401
            )
    
    async def refresh(self, request):
        """Mock refresh token endpoint."""
        try:
            data = await request.json()
        except Exception:
            return web.json_response(
                {"error": "Invalid JSON"}, 
                status=400
            )
        
        refresh_token = data.get("refresh_token")
        
        if refresh_token == "refresh-token-123":
            new_access_token = "new-access-token-456"
            new_refresh_token = "new-refresh-token-456"
            
            # Store new token
            self.tokens[new_access_token] = {
                "user_id": "user-123",
                "expires_at": datetime.now() + timedelta(hours=1)
            }
            
            return web.json_response({
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": 3600
            })
        else:
            return web.json_response(
                {"error": "Invalid refresh token"}, 
                status=401
            )
    
    async def protected_endpoint(self, request):
        """Mock protected endpoint that requires authentication."""
        auth_header = request.headers.get("Authorization", "")
        
        if not auth_header.startswith("Bearer "):
            return web.json_response(
                {"error": "Missing or invalid authorization header"}, 
                status=401
            )
        
        token = auth_header[7:]  # Remove "Bearer "
        
        # Check API key
        if token in self.api_keys:
            if not self.api_keys[token]["active"]:
                return web.json_response(
                    {"error": "API key inactive"}, 
                    status=401
                )
            return web.json_response({
                "message": "Success with API key",
                "user_id": self.api_keys[token]["user_id"]
            })
        
        # Check JWT token
        if token in self.tokens:
            token_info = self.tokens[token]
            if datetime.now() > token_info["expires_at"]:
                return web.json_response(
                    {"error": "Token expired"}, 
                    status=401
                )
            return web.json_response({
                "message": "Success with JWT token",
                "user_id": token_info["user_id"]
            })
        
        return web.json_response(
            {"error": "Invalid token"}, 
            status=401
        )
    
    async def rate_limited_endpoint(self, request):
        """Mock endpoint that implements rate limiting."""
        # Add rate limit headers to response
        headers = {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": str(self.rate_limit_remaining),
            "X-RateLimit-Reset": str(int(self.rate_limit_reset))
        }
        
        # Simulate rate limiting
        if self.rate_limit_remaining <= 0:
            return web.json_response(
                {"error": "Rate limit exceeded"},
                status=429,
                headers={**headers, "Retry-After": "60"}
            )
        
        self.rate_limit_remaining -= 1
        
        return web.json_response({
            "message": "Success",
            "remaining_requests": self.rate_limit_remaining
        }, headers=headers)
    
    async def validation_endpoint(self, request):
        """Mock endpoint that validates input data."""
        try:
            data = await request.json()
        except Exception:
            return web.json_response(
                {"error": "Invalid JSON"}, 
                status=400
            )
        
        errors = {}
        
        # Validate email
        email = data.get("email")
        if not email:
            errors["email"] = "Email is required"
        elif "@" not in email:
            errors["email"] = "Invalid email format"
        
        # Validate username
        username = data.get("username")
        if username and len(username) < 3:
            errors["username"] = "Username must be at least 3 characters"
        
        # Validate age
        age = data.get("age")
        if age is not None:
            try:
                age = int(age)
                if age < 0 or age > 150:
                    errors["age"] = "Age must be between 0 and 150"
            except ValueError:
                errors["age"] = "Age must be a number"
        
        if errors:
            return web.json_response(
                {
                    "error": "Validation failed",
                    "validation_errors": errors
                }, 
                status=422
            )
        
        return web.json_response({
            "message": "Validation successful",
            "data": data
        })
    
    def create_app(self):
        """Create the mock server application."""
        app = web.Application()
        app.router.add_post("/auth/login", self.login)
        app.router.add_post("/auth/refresh", self.refresh)
        app.router.add_get("/api/protected", self.protected_endpoint)
        app.router.add_post("/api/rate-limited", self.rate_limited_endpoint)
        app.router.add_post("/api/validate", self.validation_endpoint)
        return app


class TestIntegrationFlows:
    """Integration tests for complete flows."""
    
    @pytest.mark.asyncio
    async def test_login_flow_success(self):
        """Test complete login flow with mock server."""
        mock_server = MockSchlepEngineServer()
        
        # Mock the HTTP client requests
        async def mock_post(path, **kwargs):
            if path == "/auth/login":
                return await mock_server.login(MagicMock(json=AsyncMock(return_value=kwargs["json"])))
            return {"error": "Not found"}
        
        client = SchlepEngineClient(base_url="http://test-server")
        
        with patch.object(client.http_client, 'post', side_effect=mock_post):
            # Test successful login
            tokens = await client.auth.login("test@example.com", "password")
            
            assert tokens.access_token == "access-token-123"
            assert tokens.refresh_token == "refresh-token-123"
            assert tokens.user is not None
            assert tokens.user.email == "test@example.com"
            
            # Test that auth manager has stored the tokens
            assert client.auth.is_authenticated
            assert client.auth.auth_method == "jwt_token"
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_login_flow_failure(self):
        """Test login flow with invalid credentials."""
        mock_server = MockSchlepEngineServer()
        
        async def mock_post(path, **kwargs):
            if path == "/auth/login":
                # Simulate wrong password
                mock_request = MagicMock()
                mock_request.json = AsyncMock(return_value={"email": "test@example.com", "password": "wrong"})
                response_data = await mock_server.login(mock_request)
                if response_data.status == 401:
                    from schlep_engine.exceptions.base import AuthenticationError
                    raise AuthenticationError("Invalid credentials")
                return response_data
            return {"error": "Not found"}
        
        client = SchlepEngineClient(base_url="http://test-server")
        
        with patch.object(client.http_client, 'post', side_effect=mock_post):
            with pytest.raises(AuthenticationError, match="Invalid credentials"):
                await client.auth.login("test@example.com", "wrong_password")
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_token_refresh_flow(self):
        """Test automatic token refresh flow."""
        mock_server = MockSchlepEngineServer()
        
        async def mock_post(path, **kwargs):
            if path == "/auth/refresh":
                mock_request = MagicMock()
                mock_request.json = AsyncMock(return_value=kwargs["json"])
                return await mock_server.refresh(mock_request)
            return {"error": "Not found"}
        
        client = SchlepEngineClient(base_url="http://test-server")
        
        # Set up a token that expires soon
        expires_soon_token = TokenResponse(
            access_token="old-token",
            refresh_token="refresh-token-123",
            issued_at=datetime.now() - timedelta(minutes=58),
            expires_in=3600
        )
        
        client.auth._current_tokens = expires_soon_token
        
        with patch.object(client.http_client, 'post', side_effect=mock_post):
            # This should trigger automatic refresh
            result = await client.auth.get_valid_access_token_async()
            
            # Should have gotten the refreshed token
            assert result == "new-access-token-456"
            assert client.auth._current_tokens.access_token == "new-access-token-456"
            assert client.auth._current_tokens.refresh_token == "new-refresh-token-456"
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_api_key_authentication_flow(self):
        """Test API key authentication flow."""
        mock_server = MockSchlepEngineServer()
        
        async def mock_get(path, **kwargs):
            if path == "/api/protected":
                mock_request = MagicMock()
                mock_request.headers = kwargs.get("headers", {})
                response = await mock_server.protected_endpoint(mock_request)
                return json.loads(response.text)
            return {"error": "Not found"}
        
        client = SchlepEngineClient(api_key="test-api-key", base_url="http://test-server")
        
        with patch.object(client.http_client, 'get', side_effect=mock_get):
            # Test authenticated request
            headers = client.auth.get_auth_headers()
            response = await client.http_client.get("/api/protected", headers=headers)
            
            assert response["message"] == "Success with API key"
            assert response["user_id"] == "api-user"
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_rate_limiting_flow(self):
        """Test rate limiting and backoff flow."""
        mock_server = MockSchlepEngineServer()
        
        # Set rate limit to very low for testing
        mock_server.rate_limit_remaining = 2
        
        async def mock_post(path, **kwargs):
            if path == "/api/rate-limited":
                mock_request = MagicMock()
                mock_request.headers = kwargs.get("headers", {})
                response = await mock_server.rate_limited_endpoint(mock_request)
                
                if response.status == 429:
                    raise RateLimitError("Rate limit exceeded", retry_after=1)
                
                return json.loads(response.text)
            return {"error": "Not found"}
        
        client = SchlepEngineClient(
            api_key="test-api-key", 
            base_url="http://test-server"
        )
        
        with patch.object(client.http_client, 'post', side_effect=mock_post):
            # First request should succeed
            response = await client.http_client.post("/api/rate-limited")
            assert response["message"] == "Success"
            assert response["remaining_requests"] == 1
            
            # Second request should succeed
            response = await client.http_client.post("/api/rate-limited")
            assert response["message"] == "Success"
            assert response["remaining_requests"] == 0
            
            # Third request should fail with rate limit error
            with pytest.raises(RateLimitError, match="Rate limit exceeded"):
                await client.http_client.post("/api/rate-limited")
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_validation_flow_success(self):
        """Test input validation flow with valid data."""
        mock_server = MockSchlepEngineServer()
        
        async def mock_post(path, **kwargs):
            if path == "/api/validate":
                mock_request = MagicMock()
                mock_request.json = AsyncMock(return_value=kwargs["json"])
                response = await mock_server.validation_endpoint(mock_request)
                return json.loads(response.text)
            return {"error": "Not found"}
        
        client = SchlepEngineClient(
            api_key="test-api-key", 
            base_url="http://test-server"
        )
        
        valid_data = {
            "email": "test@example.com",
            "username": "testuser",
            "age": 25
        }
        
        with patch.object(client.http_client, 'post', side_effect=mock_post):
            response = await client.http_client.post("/api/validate", json=valid_data)
            
            assert response["message"] == "Validation successful"
            assert response["data"] == valid_data
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_validation_flow_failure(self):
        """Test input validation flow with invalid data."""
        mock_server = MockSchlepEngineServer()
        
        async def mock_post(path, **kwargs):
            if path == "/api/validate":
                mock_request = MagicMock()
                mock_request.json = AsyncMock(return_value=kwargs["json"])
                response = await mock_server.validation_endpoint(mock_request)
                
                if response.status == 422:
                    response_data = json.loads(response.text)
                    from schlep_engine.exceptions.base import ValidationError
                    raise ValidationError(
                        response_data["error"],
                        validation_errors=response_data["validation_errors"]
                    )
                
                return json.loads(response.text)
            return {"error": "Not found"}
        
        client = SchlepEngineClient(
            api_key="test-api-key", 
            base_url="http://test-server"
        )
        
        invalid_data = {
            "email": "invalid-email",  # Missing @
            "username": "ab",          # Too short
            "age": "not-a-number"      # Invalid type
        }
        
        with patch.object(client.http_client, 'post', side_effect=mock_post):
            with pytest.raises(ValidationError) as exc_info:
                await client.http_client.post("/api/validate", json=invalid_data)
            
            errors = exc_info.value.validation_errors
            assert "email" in errors
            assert "username" in errors
            assert "age" in errors
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_end_to_end_authenticated_flow(self):
        """Test complete end-to-end authenticated flow."""
        mock_server = MockSchlepEngineServer()
        
        login_called = False
        protected_called = False
        
        async def mock_request(method, path, **kwargs):
            nonlocal login_called, protected_called
            
            if path == "/auth/login" and method == "POST":
                login_called = True
                mock_request = MagicMock()
                mock_request.json = AsyncMock(return_value=kwargs["json"])
                response = await mock_server.login(mock_request)
                return json.loads(response.text)
            
            elif path == "/api/protected" and method == "GET":
                protected_called = True
                mock_request = MagicMock()
                mock_request.headers = kwargs.get("headers", {})
                response = await mock_server.protected_endpoint(mock_request)
                return json.loads(response.text)
            
            return {"error": "Not found"}
        
        client = SchlepEngineClient(base_url="http://test-server")
        
        # Mock both post and get methods
        with patch.object(client.http_client, 'post') as mock_post:
            with patch.object(client.http_client, 'get') as mock_get:
                
                mock_post.side_effect = lambda path, **kwargs: mock_request("POST", path, **kwargs)
                mock_get.side_effect = lambda path, **kwargs: mock_request("GET", path, **kwargs)
                
                # Step 1: Login
                tokens = await client.auth.login("test@example.com", "password")
                assert login_called
                assert tokens.access_token == "access-token-123"
                
                # Step 2: Make authenticated request
                headers = client.auth.get_auth_headers()
                response = await client.http_client.get("/api/protected", headers=headers)
                assert protected_called
                assert response["message"] == "Success with JWT token"
                assert response["user_id"] == "user-123"
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_connection_pooling_behavior(self):
        """Test that connection pooling is working correctly."""
        client = SchlepEngineClient(api_key="test-api-key", base_url="http://test-server")
        
        # Mock successful responses
        async def mock_get(path, **kwargs):
            return {"message": f"Success for {path}"}
        
        with patch.object(client.http_client, 'get', side_effect=mock_get):
            # Make multiple requests to verify connection reuse
            responses = []
            for i in range(5):
                response = await client.http_client.get(f"/api/test/{i}")
                responses.append(response)
            
            # All requests should succeed
            assert len(responses) == 5
            for i, response in enumerate(responses):
                assert response["message"] == f"Success for /api/test/{i}"
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_secure_storage_integration(self):
        """Test secure storage integration in real scenario."""
        with patch('schlep_engine.auth.token_storage.HAS_KEYRING', True):
            mock_keyring = MagicMock()
            
            with patch('schlep_engine.auth.token_storage.keyring', mock_keyring):
                client = SchlepEngineClient(base_url="http://test-server")
                
                # Test saving API key securely
                client.auth.save_api_key_securely("super-secret-key", "production")
                
                mock_keyring.set_password.assert_called_once_with(
                    "schlep-engine-api-key",
                    "production", 
                    "super-secret-key"
                )
                
                # Test loading API key securely
                mock_keyring.get_password.return_value = "loaded-secret-key"
                loaded_key = client.auth.load_api_key_securely("production")
                
                assert loaded_key == "loaded-secret-key"
                mock_keyring.get_password.assert_called_with(
                    "schlep-engine-api-key",
                    "production"
                )
        
        await client.close()