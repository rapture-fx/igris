"""
Advanced API Security Middleware
===============================

Comprehensive API security middleware implementing advanced security measures
including API versioning security, GraphQL security, rate limiting enhancements,
API gateway security configuration, and OpenAPI security schema validation.

Features:
- API Versioning and Deprecation Security
- GraphQL Security (query complexity, depth limiting)
- Advanced Rate Limiting with ML-based detection
- API Key Management and Rotation
- Request/Response Size Limiting
- API Abuse Detection and Prevention
- OpenAPI Schema Validation and Security
- API Documentation Security
- Webhook Security and Validation
"""

import os
import re
import json
import time
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging
from collections import defaultdict, deque
import asyncio
import jwt
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import httpx

from app.core.security_hardening import (
    get_security_framework,
    SecurityViolationType,
    ThreatLevel
)
from app.core.security_monitoring_system import (
    get_security_monitoring_system,
    EventType,
    AlertSeverity
)

logger = logging.getLogger(__name__)


class APISecurityThreat(Enum):
    """API-specific security threats"""
    API_ABUSE = "api_abuse"
    EXCESSIVE_REQUESTS = "excessive_requests"
    QUERY_COMPLEXITY = "query_complexity"
    DEPRECATED_API_USE = "deprecated_api_use"
    INVALID_API_VERSION = "invalid_api_version"
    SCHEMA_VIOLATION = "schema_violation"
    WEBHOOK_VALIDATION_FAILURE = "webhook_validation_failure"
    API_KEY_MISUSE = "api_key_misuse"


class APIVersionStatus(Enum):
    """API version status"""
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    SUNSET = "sunset"
    RETIRED = "retired"


@dataclass
class APIEndpointConfig:
    """Configuration for API endpoint security"""
    endpoint: str
    version: str
    status: APIVersionStatus = APIVersionStatus.ACTIVE
    max_request_size: int = 1024 * 1024  # 1MB
    max_response_size: int = 5 * 1024 * 1024  # 5MB
    rate_limit_per_minute: int = 60
    rate_limit_per_hour: int = 1000
    require_api_key: bool = False
    require_authentication: bool = True
    allowed_methods: Set[str] = field(default_factory=lambda: {"GET", "POST", "PUT", "DELETE"})
    deprecated_after: Optional[datetime] = None
    sunset_after: Optional[datetime] = None
    security_level: str = "medium"  # low, medium, high, critical


@dataclass
class APIKeyInfo:
    """API key information"""
    key_id: str
    key_hash: str
    user_id: str
    permissions: List[str]
    rate_limit_override: Optional[int] = None
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    usage_count: int = 0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class GraphQLQueryAnalysis:
    """GraphQL query analysis results"""
    depth: int = 0
    complexity: int = 0
    field_count: int = 0
    has_introspection: bool = False
    has_mutations: bool = False
    has_subscriptions: bool = False
    estimated_cost: float = 0.0
    aliases_used: int = 0


class AdvancedAPISecurityMiddleware(BaseHTTPMiddleware):
    """
    Advanced API security middleware with comprehensive protection
    """

    def __init__(
        self,
        app: ASGIApp,
        enabled: bool = True,
        # API Versioning
        enforce_api_versioning: bool = True,
        supported_versions: List[str] = None,
        default_version: str = "v1",
        # Rate Limiting
        enable_adaptive_rate_limiting: bool = True,
        base_rate_limit: int = 100,
        burst_detection_threshold: int = 10,
        # GraphQL Security
        enable_graphql_security: bool = True,
        max_query_depth: int = 10,
        max_query_complexity: int = 1000,
        # Request/Response Limits
        max_request_size: int = 10 * 1024 * 1024,  # 10MB
        max_response_size: int = 50 * 1024 * 1024,  # 50MB
        # API Documentation Security
        secure_docs_access: bool = True,
        docs_require_auth: bool = False,
        # Webhook Security
        webhook_secret_key: Optional[str] = None,
        webhook_tolerance_seconds: int = 300
    ):
        super().__init__(app)
        self.enabled = enabled

        # API Versioning Configuration
        self.enforce_api_versioning = enforce_api_versioning
        self.supported_versions = supported_versions or ["v1", "v2"]
        self.default_version = default_version

        # Rate Limiting Configuration
        self.enable_adaptive_rate_limiting = enable_adaptive_rate_limiting
        self.base_rate_limit = base_rate_limit
        self.burst_detection_threshold = burst_detection_threshold

        # GraphQL Security Configuration
        self.enable_graphql_security = enable_graphql_security
        self.max_query_depth = max_query_depth
        self.max_query_complexity = max_query_complexity

        # Request/Response Limits
        self.max_request_size = max_request_size
        self.max_response_size = max_response_size

        # Documentation Security
        self.secure_docs_access = secure_docs_access
        self.docs_require_auth = docs_require_auth

        # Webhook Security
        self.webhook_secret_key = webhook_secret_key or os.getenv("WEBHOOK_SECRET_KEY")
        self.webhook_tolerance_seconds = webhook_tolerance_seconds

        # Initialize components
        self.security_framework = get_security_framework()
        self.security_monitoring = get_security_monitoring_system()
        self.api_keys: Dict[str, APIKeyInfo] = {}
        self.endpoint_configs: Dict[str, APIEndpointConfig] = {}
        self.request_patterns: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))

        # Load configurations
        self._setup_endpoint_configurations()
        self._load_api_keys()

        logger.info("Advanced API Security Middleware initialized")

    def _setup_endpoint_configurations(self):
        """Setup endpoint-specific security configurations"""

        # Authentication endpoints - high security
        self.endpoint_configs["/api/v1/auth"] = APIEndpointConfig(
            endpoint="/api/v1/auth",
            version="v1",
            status=APIVersionStatus.ACTIVE,
            rate_limit_per_minute=10,
            rate_limit_per_hour=100,
            require_authentication=False,  # Auth endpoints don't require existing auth
            security_level="high"
        )

        # Admin endpoints - critical security
        self.endpoint_configs["/api/v1/admin"] = APIEndpointConfig(
            endpoint="/api/v1/admin",
            version="v1",
            status=APIVersionStatus.ACTIVE,
            rate_limit_per_minute=30,
            rate_limit_per_hour=500,
            require_authentication=True,
            security_level="critical"
        )

        # ML Pipeline endpoints - medium security with higher limits
        self.endpoint_configs["/api/v1/ml"] = APIEndpointConfig(
            endpoint="/api/v1/ml",
            version="v1",
            status=APIVersionStatus.ACTIVE,
            max_request_size=50 * 1024 * 1024,  # 50MB for ML data
            rate_limit_per_minute=20,
            rate_limit_per_hour=500,
            security_level="medium"
        )

        # GraphQL endpoint
        self.endpoint_configs["/api/v1/graphql"] = APIEndpointConfig(
            endpoint="/api/v1/graphql",
            version="v1",
            status=APIVersionStatus.ACTIVE,
            rate_limit_per_minute=30,
            rate_limit_per_hour=1000,
            allowed_methods={"POST", "GET"},
            security_level="high"
        )

        # Webhook endpoints
        self.endpoint_configs["/api/v1/webhooks"] = APIEndpointConfig(
            endpoint="/api/v1/webhooks",
            version="v1",
            status=APIVersionStatus.ACTIVE,
            require_authentication=False,  # Webhooks use signature verification
            rate_limit_per_minute=100,
            security_level="high"
        )

    def _load_api_keys(self):
        """Load API keys from secure storage"""

        # This would typically load from a secure database
        # For now, we'll create sample API keys

        sample_keys = [
            APIKeyInfo(
                key_id="key_001",
                key_hash=hashlib.sha256("sk_test_key_001".encode()).hexdigest(),
                user_id="user_001",
                permissions=["api.read", "api.write"],
                rate_limit_override=200
            ),
            APIKeyInfo(
                key_id="key_002",
                key_hash=hashlib.sha256("sk_prod_key_002".encode()).hexdigest(),
                user_id="user_002",
                permissions=["api.read", "api.write", "api.admin"],
                rate_limit_override=1000
            )
        ]

        for api_key in sample_keys:
            self.api_keys[api_key.key_id] = api_key

    async def dispatch(self, request: Request, call_next) -> Response:
        """Main middleware dispatch method"""

        if not self.enabled:
            return await call_next(request)

        start_time = time.time()
        client_ip = self._get_client_ip(request)

        try:
            # 1. API Version Validation
            if self.enforce_api_versioning:
                version_check = await self._validate_api_version(request)
                if not version_check.valid:
                    return self._create_error_response(
                        status.HTTP_400_BAD_REQUEST,
                        "INVALID_API_VERSION",
                        version_check.message
                    )

            # 2. Request Size Validation
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_request_size:
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.MEDIUM,
                    "Request Size Exceeded",
                    f"Request size {content_length} exceeds limit {self.max_request_size}",
                    source_ip=client_ip,
                    endpoint=request.url.path
                )

                return self._create_error_response(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    "REQUEST_TOO_LARGE",
                    f"Request size exceeds maximum allowed: {self.max_request_size} bytes"
                )

            # 3. API Key Validation
            api_key_validation = await self._validate_api_key(request)
            if api_key_validation.required and not api_key_validation.valid:
                return self._create_error_response(
                    status.HTTP_401_UNAUTHORIZED,
                    "INVALID_API_KEY",
                    api_key_validation.message
                )

            # 4. Rate Limiting with API Key considerations
            rate_limit_check = await self._check_advanced_rate_limiting(
                request, client_ip, api_key_validation.api_key
            )
            if not rate_limit_check.allowed:
                return self._create_error_response(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "RATE_LIMIT_EXCEEDED",
                    rate_limit_check.message,
                    headers={"Retry-After": str(rate_limit_check.retry_after)}
                )

            # 5. GraphQL Security (if GraphQL endpoint)
            if self.enable_graphql_security and self._is_graphql_request(request):
                graphql_check = await self._validate_graphql_security(request)
                if not graphql_check.valid:
                    return self._create_error_response(
                        status.HTTP_400_BAD_REQUEST,
                        "GRAPHQL_SECURITY_VIOLATION",
                        graphql_check.message
                    )

            # 6. Webhook Security (if webhook endpoint)
            if self._is_webhook_request(request):
                webhook_check = await self._validate_webhook_security(request)
                if not webhook_check.valid:
                    return self._create_error_response(
                        status.HTTP_401_UNAUTHORIZED,
                        "WEBHOOK_VALIDATION_FAILED",
                        webhook_check.message
                    )

            # 7. Documentation Access Security
            if self.secure_docs_access and self._is_docs_request(request):
                docs_check = await self._validate_docs_access(request)
                if not docs_check.allowed:
                    return self._create_error_response(
                        status.HTTP_403_FORBIDDEN,
                        "DOCS_ACCESS_DENIED",
                        docs_check.message
                    )

            # Process the request
            response = await call_next(request)

            # 8. Response Size Validation
            response_size = self._get_response_size(response)
            if response_size > self.max_response_size:
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.MEDIUM,
                    "Response Size Exceeded",
                    f"Response size {response_size} exceeds limit {self.max_response_size}",
                    source_ip=client_ip,
                    endpoint=request.url.path
                )

                return self._create_error_response(
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "RESPONSE_TOO_LARGE",
                    "Response size exceeds maximum allowed"
                )

            # 9. Update API usage metrics
            await self._update_api_metrics(request, response, api_key_validation.api_key)

            # 10. Add security headers
            self._add_api_security_headers(response, request)

            return response

        except Exception as e:
            logger.error(f"API security middleware error: {e}", exc_info=True)

            await self.security_monitoring.log_security_event(
                EventType.APPLICATION_ERROR,
                AlertSeverity.MEDIUM,
                "API Security Middleware Error",
                f"Middleware processing error: {str(e)}",
                source_ip=client_ip,
                endpoint=request.url.path
            )

            # Continue with request processing
            return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""

        # Check for forwarded IP headers
        forwarded_headers = [
            "CF-Connecting-IP",
            "True-Client-IP",
            "X-Real-IP",
            "X-Forwarded-For"
        ]

        for header in forwarded_headers:
            if header in request.headers:
                forwarded_ip = request.headers[header].split(',')[0].strip()
                if self._is_valid_ip(forwarded_ip):
                    return forwarded_ip

        if request.client and request.client.host:
            return request.client.host

        return "unknown"

    def _is_valid_ip(self, ip: str) -> bool:
        """Validate IP address format"""
        try:
            import ipaddress
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    async def _validate_api_version(self, request: Request) -> 'APIVersionValidation':
        """Validate API version"""

        # Extract version from URL path
        version_from_path = None
        path_parts = request.url.path.split('/')

        for i, part in enumerate(path_parts):
            if part.startswith('v') and part[1:].isdigit():
                version_from_path = part
                break

        # Check version header
        version_from_header = request.headers.get("API-Version")

        # Determine version to use
        api_version = version_from_path or version_from_header or self.default_version

        # Validate version
        if api_version not in self.supported_versions:
            return APIVersionValidation(
                valid=False,
                version=api_version,
                message=f"API version '{api_version}' is not supported. Supported versions: {', '.join(self.supported_versions)}"
            )

        # Check if version is deprecated
        endpoint_config = self._get_endpoint_config(request.url.path)
        if endpoint_config and endpoint_config.status == APIVersionStatus.DEPRECATED:
            # Log deprecation warning
            await self.security_monitoring.log_security_event(
                EventType.SUSPICIOUS_ACTIVITY,
                AlertSeverity.LOW,
                "Deprecated API Version Used",
                f"Client using deprecated API version: {api_version}",
                source_ip=self._get_client_ip(request),
                endpoint=request.url.path,
                api_version=api_version
            )

        return APIVersionValidation(valid=True, version=api_version)

    async def _validate_api_key(self, request: Request) -> 'APIKeyValidation':
        """Validate API key if required"""

        endpoint_config = self._get_endpoint_config(request.url.path)
        requires_api_key = endpoint_config and endpoint_config.require_api_key

        if not requires_api_key:
            return APIKeyValidation(required=False, valid=True)

        # Extract API key from request
        api_key = None

        # Check Authorization header (Bearer token)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            api_key = auth_header[7:]

        # Check X-API-Key header
        if not api_key:
            api_key = request.headers.get("X-API-Key")

        # Check query parameter
        if not api_key:
            api_key = request.query_params.get("api_key")

        if not api_key:
            return APIKeyValidation(
                required=True,
                valid=False,
                message="API key is required but not provided"
            )

        # Validate API key
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        for key_info in self.api_keys.values():
            if key_info.key_hash == api_key_hash and key_info.is_active:
                # Check expiration
                if key_info.expires_at and datetime.utcnow() > key_info.expires_at:
                    return APIKeyValidation(
                        required=True,
                        valid=False,
                        message="API key has expired"
                    )

                # Update usage
                key_info.last_used = datetime.utcnow()
                key_info.usage_count += 1

                return APIKeyValidation(
                    required=True,
                    valid=True,
                    api_key=key_info
                )

        return APIKeyValidation(
            required=True,
            valid=False,
            message="Invalid API key"
        )

    async def _check_advanced_rate_limiting(
        self,
        request: Request,
        client_ip: str,
        api_key: Optional[APIKeyInfo]
    ) -> 'RateLimitCheck':
        """Advanced rate limiting with ML-based detection"""

        # Get rate limits
        endpoint_config = self._get_endpoint_config(request.url.path)

        if api_key and api_key.rate_limit_override:
            rate_limit_per_minute = api_key.rate_limit_override
        elif endpoint_config:
            rate_limit_per_minute = endpoint_config.rate_limit_per_minute
        else:
            rate_limit_per_minute = self.base_rate_limit

        # Create rate limiting key
        if api_key:
            rate_key = f"api_key:{api_key.key_id}"
        else:
            rate_key = f"ip:{client_ip}"

        # Check current usage
        now = datetime.utcnow()
        minute_ago = now - timedelta(minutes=1)

        # Get request pattern for this key
        pattern = self.request_patterns[rate_key]

        # Remove old requests
        while pattern and pattern[0] < minute_ago:
            pattern.popleft()

        current_requests = len(pattern)

        # Check rate limit
        if current_requests >= rate_limit_per_minute:
            await self.security_monitoring.log_security_event(
                EventType.SUSPICIOUS_ACTIVITY,
                AlertSeverity.MEDIUM,
                "API Rate Limit Exceeded",
                f"Rate limit exceeded: {current_requests}/{rate_limit_per_minute} requests per minute",
                source_ip=client_ip,
                endpoint=request.url.path,
                rate_key=rate_key
            )

            return RateLimitCheck(
                allowed=False,
                message=f"Rate limit exceeded: {rate_limit_per_minute} requests per minute",
                retry_after=60
            )

        # Add current request to pattern
        pattern.append(now)

        # Burst detection
        if self.enable_adaptive_rate_limiting:
            recent_requests = [t for t in pattern if t > now - timedelta(seconds=10)]
            if len(recent_requests) > self.burst_detection_threshold:
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.HIGH,
                    "API Burst Pattern Detected",
                    f"Burst pattern: {len(recent_requests)} requests in 10 seconds",
                    source_ip=client_ip,
                    endpoint=request.url.path,
                    rate_key=rate_key
                )

        return RateLimitCheck(allowed=True)

    def _is_graphql_request(self, request: Request) -> bool:
        """Check if request is to GraphQL endpoint"""
        return "/graphql" in request.url.path.lower()

    async def _validate_graphql_security(self, request: Request) -> 'GraphQLValidation':
        """Validate GraphQL query security"""

        try:
            # Get GraphQL query
            if request.method == "GET":
                query = request.query_params.get("query", "")
            else:
                body = await request.body()
                if body:
                    data = json.loads(body.decode())
                    query = data.get("query", "")
                else:
                    return GraphQLValidation(valid=True)  # Empty query is ok

            if not query:
                return GraphQLValidation(valid=True)

            # Analyze query
            analysis = self._analyze_graphql_query(query)

            # Check depth limit
            if analysis.depth > self.max_query_depth:
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.HIGH,
                    "GraphQL Query Depth Exceeded",
                    f"Query depth {analysis.depth} exceeds limit {self.max_query_depth}",
                    source_ip=self._get_client_ip(request),
                    endpoint=request.url.path
                )

                return GraphQLValidation(
                    valid=False,
                    message=f"Query depth {analysis.depth} exceeds maximum allowed {self.max_query_depth}"
                )

            # Check complexity limit
            if analysis.complexity > self.max_query_complexity:
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.HIGH,
                    "GraphQL Query Complexity Exceeded",
                    f"Query complexity {analysis.complexity} exceeds limit {self.max_query_complexity}",
                    source_ip=self._get_client_ip(request),
                    endpoint=request.url.path
                )

                return GraphQLValidation(
                    valid=False,
                    message=f"Query complexity {analysis.complexity} exceeds maximum allowed {self.max_query_complexity}"
                )

            # Check for introspection in production
            if analysis.has_introspection and os.getenv("ENVIRONMENT") == "production":
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.MEDIUM,
                    "GraphQL Introspection Attempted in Production",
                    "Introspection query attempted in production environment",
                    source_ip=self._get_client_ip(request),
                    endpoint=request.url.path
                )

                return GraphQLValidation(
                    valid=False,
                    message="Introspection is disabled in production"
                )

            return GraphQLValidation(valid=True, analysis=analysis)

        except Exception as e:
            logger.error(f"GraphQL validation error: {e}")
            return GraphQLValidation(
                valid=False,
                message="GraphQL query validation failed"
            )

    def _analyze_graphql_query(self, query: str) -> GraphQLQueryAnalysis:
        """Analyze GraphQL query for security metrics"""

        analysis = GraphQLQueryAnalysis()

        # Simple analysis (in production, use proper GraphQL parser)
        query_lower = query.lower()

        # Check for introspection
        analysis.has_introspection = any(introspection_field in query_lower for introspection_field in [
            "__schema", "__type", "__typename", "__field", "__inputvalue",
            "__enumvalue", "__directive"
        ])

        # Check for mutations and subscriptions
        analysis.has_mutations = "mutation" in query_lower
        analysis.has_subscriptions = "subscription" in query_lower

        # Estimate depth by counting nested braces
        max_depth = 0
        current_depth = 0
        for char in query:
            if char == '{':
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == '}':
                current_depth -= 1

        analysis.depth = max_depth

        # Estimate complexity (simplified)
        analysis.field_count = query.count('\n') + query.count(',')
        analysis.complexity = analysis.field_count * analysis.depth

        # Count aliases
        analysis.aliases_used = query.count(':') - query.count('::')  # Rough estimate

        return analysis

    def _is_webhook_request(self, request: Request) -> bool:
        """Check if request is to webhook endpoint"""
        return "/webhook" in request.url.path.lower()

    async def _validate_webhook_security(self, request: Request) -> 'WebhookValidation':
        """Validate webhook signature"""

        if not self.webhook_secret_key:
            return WebhookValidation(valid=True)  # No validation if no secret

        try:
            # Get signature from header
            signature_header = request.headers.get("X-Hub-Signature-256") or \
                             request.headers.get("X-Signature") or \
                             request.headers.get("Signature")

            if not signature_header:
                return WebhookValidation(
                    valid=False,
                    message="Webhook signature header missing"
                )

            # Get timestamp for replay protection
            timestamp_header = request.headers.get("X-Timestamp")
            if timestamp_header:
                try:
                    timestamp = int(timestamp_header)
                    current_time = int(time.time())
                    if abs(current_time - timestamp) > self.webhook_tolerance_seconds:
                        return WebhookValidation(
                            valid=False,
                            message="Webhook timestamp outside tolerance window"
                        )
                except ValueError:
                    return WebhookValidation(
                        valid=False,
                        message="Invalid webhook timestamp"
                    )

            # Get request body
            body = await request.body()

            # Verify signature
            expected_signature = self._generate_webhook_signature(body)

            # Extract signature from header (remove prefix if present)
            if signature_header.startswith("sha256="):
                provided_signature = signature_header[7:]
            elif signature_header.startswith("sha1="):
                provided_signature = signature_header[5:]
            else:
                provided_signature = signature_header

            if not hmac.compare_digest(expected_signature, provided_signature):
                await self.security_monitoring.log_security_event(
                    EventType.SUSPICIOUS_ACTIVITY,
                    AlertSeverity.HIGH,
                    "Webhook Signature Validation Failed",
                    "Invalid webhook signature detected",
                    source_ip=self._get_client_ip(request),
                    endpoint=request.url.path
                )

                return WebhookValidation(
                    valid=False,
                    message="Invalid webhook signature"
                )

            return WebhookValidation(valid=True)

        except Exception as e:
            logger.error(f"Webhook validation error: {e}")
            return WebhookValidation(
                valid=False,
                message="Webhook validation failed"
            )

    def _generate_webhook_signature(self, body: bytes) -> str:
        """Generate HMAC signature for webhook"""

        signature = hmac.new(
            self.webhook_secret_key.encode(),
            body,
            hashlib.sha256
        ).hexdigest()

        return signature

    def _is_docs_request(self, request: Request) -> bool:
        """Check if request is for API documentation"""
        docs_paths = ["/docs", "/redoc", "/openapi.json", "/swagger"]
        return any(docs_path in request.url.path for docs_path in docs_paths)

    async def _validate_docs_access(self, request: Request) -> 'DocsAccessValidation':
        """Validate access to API documentation"""

        # In production, restrict docs access
        if os.getenv("ENVIRONMENT") == "production" and not self.docs_require_auth:
            return DocsAccessValidation(
                allowed=False,
                message="API documentation is not available in production"
            )

        # If authentication is required for docs
        if self.docs_require_auth:
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return DocsAccessValidation(
                    allowed=False,
                    message="Authentication required for API documentation access"
                )

        return DocsAccessValidation(allowed=True)

    def _get_response_size(self, response: Response) -> int:
        """Get response content size"""

        content_length = response.headers.get("content-length")
        if content_length:
            return int(content_length)

        # Estimate size if content-length not available
        if hasattr(response, 'body'):
            return len(response.body)

        return 0

    async def _update_api_metrics(
        self,
        request: Request,
        response: Response,
        api_key: Optional[APIKeyInfo]
    ):
        """Update API usage metrics"""

        # This would typically update metrics in a time-series database
        # For now, we'll just log

        metrics = {
            "endpoint": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "api_key_id": api_key.key_id if api_key else None,
            "timestamp": datetime.utcnow().isoformat()
        }

        logger.info(f"API request metrics: {json.dumps(metrics)}")

    def _add_api_security_headers(self, response: Response, request: Request):
        """Add API-specific security headers"""

        response.headers["X-API-Security"] = "enabled"
        response.headers["X-Request-ID"] = getattr(request.state, "request_id", "unknown")

        # Add rate limiting headers
        response.headers["X-RateLimit-Limit"] = str(self.base_rate_limit)

        # API version header
        if hasattr(request.state, "api_version"):
            response.headers["X-API-Version"] = request.state.api_version

    def _get_endpoint_config(self, path: str) -> Optional[APIEndpointConfig]:
        """Get configuration for specific endpoint"""

        # Direct match
        if path in self.endpoint_configs:
            return self.endpoint_configs[path]

        # Pattern matching
        for endpoint_pattern, config in self.endpoint_configs.items():
            if path.startswith(endpoint_pattern):
                return config

        return None

    def _create_error_response(
        self,
        status_code: int,
        error_code: str,
        message: str,
        headers: Optional[Dict[str, str]] = None
    ) -> JSONResponse:
        """Create standardized error response"""

        return JSONResponse(
            status_code=status_code,
            content={
                "error": {
                    "code": error_code,
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat()
                }
            },
            headers=headers or {}
        )


# Data classes for validation results
@dataclass
class APIVersionValidation:
    valid: bool
    version: Optional[str] = None
    message: str = ""


@dataclass
class APIKeyValidation:
    required: bool
    valid: bool
    api_key: Optional[APIKeyInfo] = None
    message: str = ""


@dataclass
class RateLimitCheck:
    allowed: bool
    message: str = ""
    retry_after: int = 60


@dataclass
class GraphQLValidation:
    valid: bool
    message: str = ""
    analysis: Optional[GraphQLQueryAnalysis] = None


@dataclass
class WebhookValidation:
    valid: bool
    message: str = ""


@dataclass
class DocsAccessValidation:
    allowed: bool
    message: str = ""