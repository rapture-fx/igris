"""
gRPC Authentication Interceptor for Schlep-Engine ML Service
Provides JWT-based authentication for gRPC calls
"""

import grpc
import logging
import jwt
import time
from typing import Callable, Any
from grpc import aio

logger = logging.getLogger(__name__)


class AuthInterceptor(grpc.aio.ServerInterceptor):
    """
    gRPC Server Interceptor for authentication
    Validates JWT tokens from metadata
    """

    def __init__(self, jwt_secret: str, public_paths: list = None):
        self.jwt_secret = jwt_secret
        self.public_paths = public_paths or [
            "/ml.MLService/HealthCheck"  # Health check is public
        ]
        
    async def intercept_service(
        self, 
        continuation: Callable[[Any], Any], 
        handler_call_details: grpc.HandlerCallDetails
    ) -> Any:
        """
        Intercept outgoing gRPC calls for authentication
        """
        method = handler_call_details.method
        
        # Skip authentication for public endpoints
        if method in self.public_paths:
            logger.debug(f"Skipping auth for public method: {method}")
            return await continuation(handler_call_details)
        
        # Extract token from metadata
        metadata = dict(handler_call_details.invocation_metadata)
        token = self.extract_token_from_metadata(metadata)
        
        if not token:
            logger.warning(f"No token provided for protected method: {method}")
            if hasattr(grpc, 'StatusCode'):
                raise grpc.RpcError(
                    code=grpc.StatusCode.UNAUTHENTICATED,
                    details="Missing authentication token"
                )
            return None
        
        # Validate token
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])
            
            # Add user context to handler call details
            handler_call_details.auth_user = payload.get('user_id')
            handler_call_details.auth_email = payload.get('email')
            handler_call_details.auth_roles = payload.get('roles', [])
            
            logger.debug(f"Authentication successful for user: {payload.get('email')}")
            
        except jwt.ExpiredSignatureError:
            logger.warning(f"Token expired for method: {method}")
            if hasattr(grpc, 'StatusCode'):
                raise grpc.RpcError(
                    code=grpc.StatusCode.UNAUTHENTICATED,
                    details="Token has expired"
                )
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token for method {method}: {e}")
            if hasattr(grpc, 'StatusCode'):
                raise grpc.RpcError(
                    code=grpc.StatusCode.UNAUTHENTICATED,
                    details="Invalid token"
                )
            return None
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            if hasattr(grpc, 'StatusCode'):
                raise grpc.RpcError(
                    code=grpc.StatusCode.INTERNAL,
                    details="Authentication service error"
                )
            return None
        
        # Continue with the actual RPC call
        return await continuation(handler_call_details)
    
    def extract_token_from_metadata(self, metadata: dict) -> str:
        """
        Extract JWT token from various metadata formats
        """
        # Try Authorization header (Bearer token)
        auth_header = metadata.get('authorization')
        if auth_header:
            parts = auth_header.split(' ')
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                return parts[1]
        
        # Try token field directly
        return metadata.get('token', '')


class APIKeyInterceptor(grpc.aio.ServerInterceptor):
    """
    Alternative interceptor using API key authentication
    """
    
    def __init__(self, valid_api_keys: dict):
        self.valid_api_keys = valid_api_keys  # key -> description
        self.public_paths = ["/ml.MLService/HealthCheck"]
    
    async def intercept_service(
        self, 
        continuation: Callable[[Any], Any], 
        handler_call_details: grpc.HandlerCallDetails
    ) -> Any:
        method = handler_call_details.method
        
        # Skip authentication for public endpoints
        if method in self.public_paths:
            return await continuation(handler_call_details)
        
        metadata = dict(handler_call_details.invocation_metadata)
        api_key = metadata.get('x-api-key', '')
        
        if not api_key:
            logger.warning("No API key provided")
            if hasattr(grpc, 'StatusCode'):
                raise grpc.RpcError(
                    code=grpc.StatusCode.UNAUTHENTICATED,
                    details="API key required"
                )
            return None
        
        if api_key not in self.valid_api_keys:
            logger.warning(f"Invalid API key: {api_key[:8]}...")
            if hasattr(grpc, 'StatusCode'):
                raise grpc.RpcError(
                    code=grpc.StatusCode.UNAUTHENTICATED,
                    details="Invalid API key"
                )
            return None
        
        logger.debug(f"API key authenticated: {self.valid_api_keys[api_key]}")
        return await continuation(handler_call_details)


def create_auth_server(
    servicer,
    jwt_secret: str,
    enable_auth: bool = True,
    auth_type: str = "jwt",
    api_keys: dict = None
):
    """
    Create gRPC server with authentication
    """
    server = grpc.aio.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),
            ('grpc.keepalive_time_ms', 30000),
            ('grpc.keepalive_timeout_ms', 10000),
            ('grpc.http2.max_pings_without_data', 0),
            ('grpc.keepalive_permit_without_calls', 1),
        ]
    )
    
    # Add auth interceptor if enabled
    if enable_auth:
        if auth_type == "jwt":
            auth_interceptor = AuthInterceptor(jwt_secret)
            server = grpc.aio.server(
                interceptors=[auth_interceptor],
                options=[
                    ('grpc.max_send_message_length', 50 * 1024 * 1024),
                    ('grpc.max_receive_message_length', 50 * 1024 * 1024),
                    ('grpc.keepalive_time_ms', 30000),
                    ('grpc.keepalive_timeout_ms', 10000),
                    ('grpc.http2.max_pings_without_data', 0),
                    ('grpc.keepalive_permit_without_calls', 1),
                ]
            )
        elif auth_type == "api_key" and api_keys:
            api_interceptor = APIKeyInterceptor(api_keys)
            server = grpc.aio.server(
                interceptors=[api_interceptor],
                options=[
                    ('grpc.max_send_message_length', 50 * 1024 * 1024),
                    ('grpc.max_receive_message_length', 50 * 1024 * 1024),
                    ('grpc.keepalive_time_ms', 30000),
                    ('grpc.keepalive_timeout_ms', 10000),
                    ('grpc.http2.max_pings_without_data', 0),
                    ('grpc.keepalive_permit_without_calls', 1),
                ]
            )
    
    # Add service
    ml_pb2_grpc.add_MLServiceServicer_to_server(servicer, server)
    
    return server
