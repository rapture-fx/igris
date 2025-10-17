#!/usr/bin/env python3
"""
gRPC Authentication Interceptor for Python ML Service
Validates JWT tokens from Go Gateway requests
"""

import os
import logging
from typing import Callable, Any
import grpc
from grpc import ServerInterceptor
import jwt
from jwt import PyJWTError

logger = logging.getLogger(__name__)


class AuthInterceptor(ServerInterceptor):
    """
    gRPC interceptor that validates JWT tokens for ML service requests
    """

    def __init__(self, jwt_secret: str, public_methods: list = None):
        self.jwt_secret = jwt_secret
        self.public_methods = public_methods or ['HealthCheck']

    def intercept_service(self, continuation: Callable, handler_call_details: Any):
        """
        Intercept gRPC method calls and validate authentication
        """
        method = handler_call_details.method

        # Extract method name (e.g., /MLService/Predict -> Predict)
        method_name = method.split('/')[-1] if '/' in method else method

        # Allow public methods without authentication
        if method_name in self.public_methods:
            return continuation(handler_call_details)

        # Extract metadata (headers)
        metadata = dict(handler_call_details.invocation_metadata)

        # Get authorization token
        auth_header = metadata.get('authorization', '')
        if not auth_header:
            context = grpc.ServicerContext()
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                'Missing authorization metadata'
            )

        # Validate Bearer token format
        if not auth_header.startswith('Bearer '):
            context = grpc.ServicerContext()
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                'Invalid authorization format (expected: Bearer <token>)'
            )

        token = auth_header[7:]  # Remove 'Bearer ' prefix

        # Validate JWT token
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=['HS256']
            )

            # Add user info to context (accessible in handlers)
            # Note: This would require custom context passing in gRPC
            logger.info(
                f"Authenticated request: user_id={payload.get('user_id')}, "
                f"method={method_name}"
            )

        except jwt.ExpiredSignatureError:
            context = grpc.ServicerContext()
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                'Token has expired'
            )
        except jwt.InvalidTokenError as e:
            context = grpc.ServicerContext()
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                f'Invalid token: {str(e)}'
            )

        return continuation(handler_call_details)


class APIKeyInterceptor(ServerInterceptor):
    """
    Simple API key-based authentication interceptor
    Alternative to JWT for service-to-service communication
    """

    def __init__(self, valid_api_keys: set, public_methods: list = None):
        self.valid_api_keys = valid_api_keys
        self.public_methods = public_methods or ['HealthCheck']

    def intercept_service(self, continuation: Callable, handler_call_details: Any):
        """
        Intercept gRPC method calls and validate API key
        """
        method = handler_call_details.method
        method_name = method.split('/')[-1] if '/' in method else method

        # Allow public methods
        if method_name in self.public_methods:
            return continuation(handler_call_details)

        # Extract metadata
        metadata = dict(handler_call_details.invocation_metadata)

        # Get API key
        api_key = metadata.get('x-api-key', '')
        if not api_key:
            context = grpc.ServicerContext()
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                'Missing API key'
            )

        # Validate API key
        if api_key not in self.valid_api_keys:
            context = grpc.ServicerContext()
            context.abort(
                grpc.StatusCode.UNAUTHENTICATED,
                'Invalid API key'
            )

        logger.info(f"Authenticated request with API key: method={method_name}")
        return continuation(handler_call_details)


def create_auth_interceptor(mode: str = 'jwt') -> ServerInterceptor:
    """
    Factory function to create appropriate auth interceptor based on mode

    Args:
        mode: 'jwt', 'api_key', or 'none'

    Returns:
        ServerInterceptor instance
    """
    if mode == 'jwt':
        jwt_secret = os.getenv('JWT_SECRET_KEY')
        if not jwt_secret:
            logger.warning("JWT_SECRET_KEY not set, authentication disabled")
            return None

        public_methods = os.getenv('PUBLIC_METHODS', 'HealthCheck').split(',')
        return AuthInterceptor(jwt_secret, public_methods)

    elif mode == 'api_key':
        api_keys_str = os.getenv('VALID_API_KEYS', '')
        if not api_keys_str:
            logger.warning("VALID_API_KEYS not set, authentication disabled")
            return None

        valid_api_keys = set(api_keys_str.split(','))
        public_methods = os.getenv('PUBLIC_METHODS', 'HealthCheck').split(',')
        return APIKeyInterceptor(valid_api_keys, public_methods)

    elif mode == 'none':
        logger.warning("Authentication mode set to 'none' - service is UNSECURED")
        return None

    else:
        raise ValueError(f"Invalid auth mode: {mode}. Expected: jwt, api_key, or none")
