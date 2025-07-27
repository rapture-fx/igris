"""
Enhanced Rate Limiting Middleware

This middleware enhances existing rate limiting functionality with decorator-based
implementation and integration with the security middleware stack.

Features:
- Integration with existing rate limiting infrastructure
- Decorator-based rate limiting for specific endpoints
- User-based and IP-based rate limiting
- Different rate limits for different security levels
- Sliding window and token bucket algorithms
- Rate limit bypass for admin users
- Integration with audit logging

Usage:
    @rate_limit(requests_per_minute=60)
    @router.get("/api/data")
    async def get_data():
        return {"data": "value"}
        
    @rate_limit_by_user(requests_per_hour=1000)
    @router.post("/api/upload")
    async def upload_data():
        return {"status": "uploaded"}
"""

import time
import asyncio
from typing import Optional, Dict, List, Any, Callable, Set, Union
from functools import wraps
from dataclasses import dataclass
from enum import Enum
import logging
import redis.asyncio as redis
import json
import hashlib

from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth.enhanced_security import enhanced_security, SecurityLevel
from app.middleware.audit_middleware import audit_logger, AuditEventType, AuditSeverity

logger = logging.getLogger(__name__)

class RateLimitType(Enum):
    """Types of rate limiting"""
    IP_BASED = "ip_based"
    USER_BASED = "user_based"
    ENDPOINT_BASED = "endpoint_based"
    GLOBAL = "global"

class RateLimitAlgorithm(Enum):
    """Rate limiting algorithms"""
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    FIXED_WINDOW = "fixed_window"

@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""
    requests_per_minute: Optional[int] = None
    requests_per_hour: Optional[int] = None
    requests_per_day: Optional[int] = None
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.SLIDING_WINDOW
    rate_limit_type: RateLimitType = RateLimitType.IP_BASED
    bypass_for_admin: bool = True
    burst_multiplier: float = 1.5
    include_headers: bool = True
    error_message: str = "Rate limit exceeded"
    retry_after_calculation: str = "dynamic"  # dynamic, fixed
    
    # Security-based rate limiting
    security_level_multipliers: Dict[SecurityLevel, float] = None
    
    # Custom rate limit keys
    custom_key_func: Optional[Callable] = None
    
    # Redis configuration
    redis_prefix: str = "rate_limit"
    redis_ttl: int = 3600  # 1 hour

class RateLimitState:
    """Rate limit state tracking"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        self._in_memory_store = {}
        self._cleanup_interval = 300  # 5 minutes
        self._last_cleanup = time.time()
    
    async def get_redis_client(self) -> redis.Redis:
        """Get Redis client, create if needed"""
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url("redis://localhost:6379", decode_responses=True)
                await self.redis_client.ping()
            except Exception as e:
                logger.warning(f"Redis not available, using in-memory store: {e}")
                self.redis_client = None
        return self.redis_client
    
    async def get_rate_limit_data(self, key: str) -> Dict[str, Any]:
        """Get rate limit data for key"""
        redis_client = await self.get_redis_client()
        
        if redis_client:
            try:
                data = await redis_client.get(key)
                return json.loads(data) if data else {}
            except Exception as e:
                logger.error(f"Redis error: {e}")
        
        # Fallback to in-memory store
        self._cleanup_memory_store()
        return self._in_memory_store.get(key, {})
    
    async def set_rate_limit_data(self, key: str, data: Dict[str, Any], ttl: int = 3600):
        """Set rate limit data for key"""
        redis_client = await self.get_redis_client()
        
        if redis_client:
            try:
                await redis_client.setex(key, ttl, json.dumps(data))
                return
            except Exception as e:
                logger.error(f"Redis error: {e}")
        
        # Fallback to in-memory store
        self._in_memory_store[key] = {
            **data,
            "_expires_at": time.time() + ttl
        }
    
    def _cleanup_memory_store(self):
        """Clean up expired entries from memory store"""
        current_time = time.time()
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        expired_keys = [
            key for key, value in self._in_memory_store.items()
            if value.get("_expires_at", 0) < current_time
        ]
        
        for key in expired_keys:
            del self._in_memory_store[key]
        
        self._last_cleanup = current_time

class RateLimiter:
    """Enhanced rate limiting with multiple algorithms"""
    
    def __init__(self):
        self.state = RateLimitState()
        self.default_config = RateLimitConfig()
    
    def get_rate_limit_key(
        self, 
        request: Request, 
        config: RateLimitConfig,
        user_id: str = None
    ) -> str:
        """Generate rate limit key based on configuration"""
        
        if config.custom_key_func:
            try:
                return config.custom_key_func(request, user_id)
            except Exception as e:
                logger.error(f"Custom key function failed: {e}")
        
        key_parts = [config.redis_prefix]
        
        if config.rate_limit_type == RateLimitType.USER_BASED and user_id:
            key_parts.extend(["user", user_id])
        elif config.rate_limit_type == RateLimitType.IP_BASED:
            ip_address = request.client.host if request.client else "unknown"
            key_parts.extend(["ip", ip_address])
        elif config.rate_limit_type == RateLimitType.ENDPOINT_BASED:
            endpoint = f"{request.method}:{request.url.path}"
            key_parts.extend(["endpoint", hashlib.md5(endpoint.encode()).hexdigest()])
        else:  # GLOBAL
            key_parts.append("global")
        
        # Add endpoint to key for more granular control
        if config.rate_limit_type != RateLimitType.ENDPOINT_BASED:
            endpoint_hash = hashlib.md5(f"{request.method}:{request.url.path}".encode()).hexdigest()[:8]
            key_parts.append(endpoint_hash)
        
        return ":".join(key_parts)
    
    def calculate_rate_limits(
        self, 
        config: RateLimitConfig, 
        security_level: SecurityLevel = SecurityLevel.MEDIUM
    ) -> Dict[str, int]:
        """Calculate actual rate limits based on configuration and security level"""
        limits = {}
        
        # Base limits
        if config.requests_per_minute:
            limits["minute"] = config.requests_per_minute
        if config.requests_per_hour:
            limits["hour"] = config.requests_per_hour
        if config.requests_per_day:
            limits["day"] = config.requests_per_day
        
        # Apply security level multipliers
        if config.security_level_multipliers:
            multiplier = config.security_level_multipliers.get(security_level, 1.0)
            limits = {period: int(limit * multiplier) for period, limit in limits.items()}
        
        return limits
    
    async def sliding_window_check(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> tuple[bool, Dict[str, Any]]:
        """Sliding window rate limit check"""
        current_time = time.time()
        window_start = current_time - window_seconds
        
        # Get current data
        data = await self.state.get_rate_limit_data(key)
        
        # Filter requests within window
        requests = [
            req_time for req_time in data.get("requests", [])
            if req_time > window_start
        ]
        
        # Add current request
        requests.append(current_time)
        
        # Check if limit exceeded
        allowed = len(requests) <= limit
        
        # Update data
        updated_data = {
            "requests": requests[-limit:],  # Keep only recent requests
            "algorithm": "sliding_window",
            "limit": limit,
            "window_seconds": window_seconds,
            "last_request": current_time
        }
        
        await self.state.set_rate_limit_data(key, updated_data, window_seconds + 60)
        
        # Calculate retry after
        retry_after = 0
        if not allowed and requests:
            oldest_request = min(requests)
            retry_after = max(0, int(oldest_request + window_seconds - current_time))
        
        return allowed, {
            "requests_made": len(requests),
            "limit": limit,
            "window_seconds": window_seconds,
            "retry_after": retry_after,
            "reset_at": current_time + window_seconds
        }
    
    async def token_bucket_check(
        self, 
        key: str, 
        limit: int, 
        refill_rate: float, 
        burst_size: int = None
    ) -> tuple[bool, Dict[str, Any]]:
        """Token bucket rate limit check"""
        current_time = time.time()
        burst_size = burst_size or int(limit * 1.5)
        
        # Get current bucket state
        data = await self.state.get_rate_limit_data(key)
        
        # Initialize bucket if needed
        if not data:
            data = {
                "tokens": burst_size,
                "last_refill": current_time,
                "algorithm": "token_bucket"
            }
        
        # Calculate tokens to add based on time elapsed
        time_elapsed = current_time - data.get("last_refill", current_time)
        tokens_to_add = time_elapsed * refill_rate
        current_tokens = min(burst_size, data.get("tokens", 0) + tokens_to_add)
        
        # Check if request can be made
        allowed = current_tokens >= 1
        
        if allowed:
            current_tokens -= 1
        
        # Update bucket state
        updated_data = {
            "tokens": current_tokens,
            "last_refill": current_time,
            "algorithm": "token_bucket",
            "limit": limit,
            "refill_rate": refill_rate,
            "burst_size": burst_size
        }
        
        await self.state.set_rate_limit_data(key, updated_data, 3600)
        
        # Calculate retry after
        retry_after = 0 if allowed else max(1, int((1 - current_tokens) / refill_rate))
        
        return allowed, {
            "tokens_remaining": int(current_tokens),
            "limit": limit,
            "refill_rate": refill_rate,
            "retry_after": retry_after,
            "burst_size": burst_size
        }
    
    async def check_rate_limit(
        self, 
        request: Request, 
        config: RateLimitConfig,
        user_id: str = None,
        security_level: SecurityLevel = SecurityLevel.MEDIUM
    ) -> tuple[bool, Dict[str, Any]]:
        """Check rate limit for request"""
        
        # Generate rate limit key
        key = self.get_rate_limit_key(request, config, user_id)
        
        # Calculate actual limits
        limits = self.calculate_rate_limits(config, security_level)
        
        if not limits:
            return True, {"message": "No rate limits configured"}
        
        # Check each time period
        results = {}
        overall_allowed = True
        
        for period, limit in limits.items():
            if period == "minute":
                window_seconds = 60
            elif period == "hour":
                window_seconds = 3600
            elif period == "day":
                window_seconds = 86400
            else:
                continue
            
            period_key = f"{key}:{period}"
            
            if config.algorithm == RateLimitAlgorithm.TOKEN_BUCKET:
                refill_rate = limit / window_seconds
                allowed, result = await self.token_bucket_check(
                    period_key, limit, refill_rate, int(limit * config.burst_multiplier)
                )
            else:  # SLIDING_WINDOW or FIXED_WINDOW
                allowed, result = await self.sliding_window_check(
                    period_key, limit, window_seconds
                )
            
            results[period] = result
            if not allowed:
                overall_allowed = False
        
        return overall_allowed, results

# Global rate limiter instance
rate_limiter = RateLimiter()

def extract_user_context_for_rate_limiting(request: Request) -> Dict[str, Any]:
    """Extract user context for rate limiting"""
    context = {
        "user_id": None,
        "is_admin": False,
        "security_level": SecurityLevel.MEDIUM
    }
    
    try:
        # Extract from Authorization header
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            payload = enhanced_security.enhanced_verify_token(token)
            if payload:
                context["user_id"] = payload.get("sub")
                context["security_level"] = SecurityLevel(payload.get("security_level", 2))
                
                # Check if user is admin (simplified)
                # In production, check against user database
                session_id = payload.get("session_id")
                if session_id and session_id in enhanced_security._sessions:
                    session = enhanced_security._sessions[session_id]
                    context["is_admin"] = getattr(session, 'is_admin', False)
    except Exception as e:
        logger.debug(f"Could not extract user context for rate limiting: {e}")
    
    return context

# Decorator for endpoint-level rate limiting
def rate_limit(
    requests_per_minute: Optional[int] = None,
    requests_per_hour: Optional[int] = None,
    requests_per_day: Optional[int] = None,
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.SLIDING_WINDOW,
    rate_limit_type: RateLimitType = RateLimitType.IP_BASED,
    bypass_for_admin: bool = True,
    custom_key_func: Optional[Callable] = None,
    error_message: str = "Rate limit exceeded"
):
    """
    Decorator to apply rate limiting to specific endpoints.
    
    Args:
        requests_per_minute: Number of requests allowed per minute
        requests_per_hour: Number of requests allowed per hour
        requests_per_day: Number of requests allowed per day
        algorithm: Rate limiting algorithm to use
        rate_limit_type: Type of rate limiting (IP, user, endpoint, global)
        bypass_for_admin: Whether to bypass rate limits for admin users
        custom_key_func: Custom function to generate rate limit key
        error_message: Custom error message for rate limit exceeded
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                request = kwargs.get('request')
            
            # Skip rate limiting if no request context
            if not request:
                return await func(*args, **kwargs)
            
            # Extract user context
            user_context = extract_user_context_for_rate_limiting(request)
            
            # Bypass for admin if configured
            if bypass_for_admin and user_context.get("is_admin", False):
                return await func(*args, **kwargs)
            
            # Create rate limit configuration
            config = RateLimitConfig(
                requests_per_minute=requests_per_minute,
                requests_per_hour=requests_per_hour,
                requests_per_day=requests_per_day,
                algorithm=algorithm,
                rate_limit_type=rate_limit_type,
                bypass_for_admin=bypass_for_admin,
                custom_key_func=custom_key_func,
                error_message=error_message
            )
            
            # Check rate limit
            allowed, results = await rate_limiter.check_rate_limit(
                request,
                config,
                user_context.get("user_id"),
                user_context.get("security_level", SecurityLevel.MEDIUM)
            )
            
            if not allowed:
                # Log rate limit violation
                await audit_logger.log_event({
                    "event_type": AuditEventType.SECURITY_VIOLATION,
                    "severity": AuditSeverity.MEDIUM,
                    "user_id": user_context.get("user_id"),
                    "ip_address": request.client.host if request.client else "unknown",
                    "path": request.url.path,
                    "method": request.method,
                    "description": "Rate limit exceeded",
                    "metadata": {
                        "rate_limit_results": results,
                        "rate_limit_config": {
                            "requests_per_minute": requests_per_minute,
                            "requests_per_hour": requests_per_hour,
                            "requests_per_day": requests_per_day,
                            "algorithm": algorithm.value,
                            "type": rate_limit_type.value
                        }
                    }
                })
                
                # Calculate retry after from results
                retry_after = max(
                    result.get("retry_after", 0) 
                    for result in results.values() 
                    if isinstance(result, dict)
                )
                
                # Create rate limit response
                response = HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=error_message,
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(requests_per_minute or requests_per_hour or requests_per_day),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time() + retry_after))
                    }
                )
                raise response
            
            # Execute the function
            result = await func(*args, **kwargs)
            
            # Add rate limit headers to response if possible
            if hasattr(result, 'headers') and config.include_headers:
                for period, period_result in results.items():
                    if isinstance(period_result, dict):
                        if "requests_made" in period_result:
                            remaining = max(0, period_result["limit"] - period_result["requests_made"])
                            result.headers[f"X-RateLimit-{period.title()}-Remaining"] = str(remaining)
                        elif "tokens_remaining" in period_result:
                            result.headers[f"X-RateLimit-{period.title()}-Remaining"] = str(int(period_result["tokens_remaining"]))
            
            return result
        
        return wrapper
    return decorator

# Specialized rate limiting decorators
def rate_limit_by_ip(
    requests_per_minute: int = 60,
    requests_per_hour: int = 1000
):
    """IP-based rate limiting"""
    return rate_limit(
        requests_per_minute=requests_per_minute,
        requests_per_hour=requests_per_hour,
        rate_limit_type=RateLimitType.IP_BASED
    )

def rate_limit_by_user(
    requests_per_minute: int = 120,
    requests_per_hour: int = 5000,
    requests_per_day: int = 50000
):
    """User-based rate limiting"""
    return rate_limit(
        requests_per_minute=requests_per_minute,
        requests_per_hour=requests_per_hour,
        requests_per_day=requests_per_day,
        rate_limit_type=RateLimitType.USER_BASED
    )

def rate_limit_admin_endpoint(
    requests_per_minute: int = 30,
    requests_per_hour: int = 500
):
    """Rate limiting for admin endpoints"""
    return rate_limit(
        requests_per_minute=requests_per_minute,
        requests_per_hour=requests_per_hour,
        rate_limit_type=RateLimitType.USER_BASED,
        bypass_for_admin=False,  # Even admins are rate limited
        error_message="Admin endpoint rate limit exceeded"
    )

def rate_limit_api_key(
    requests_per_minute: int = 100,
    requests_per_hour: int = 10000
):
    """Rate limiting for API key endpoints"""
    def api_key_rate_limit_key(request: Request, user_id: str = None) -> str:
        api_key = request.headers.get("X-API-Key", "unknown")
        return f"rate_limit:api_key:{hashlib.md5(api_key.encode()).hexdigest()}"
    
    return rate_limit(
        requests_per_minute=requests_per_minute,
        requests_per_hour=requests_per_hour,
        rate_limit_type=RateLimitType.USER_BASED,
        custom_key_func=api_key_rate_limit_key,
        error_message="API key rate limit exceeded"
    )

# Middleware for automatic rate limiting
class RateLimitingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic rate limiting based on path patterns.
    
    This provides baseline rate limiting for all endpoints, while the decorator
    provides fine-grained control for specific endpoints.
    """
    
    def __init__(
        self,
        app,
        enabled: bool = True,
        default_config: RateLimitConfig = None,
        path_configs: Dict[str, RateLimitConfig] = None,
        exclude_paths: Set[str] = None
    ):
        super().__init__(app)
        self.enabled = enabled
        self.default_config = default_config or RateLimitConfig(
            requests_per_minute=100,
            requests_per_hour=1000
        )
        self.path_configs = path_configs or {}
        self.exclude_paths = exclude_paths or {'/health', '/metrics', '/docs', '/openapi.json'}
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path in self.exclude_paths:
            return await call_next(request)
        
        # Find matching path configuration
        config = self.default_config
        for path_pattern, path_config in self.path_configs.items():
            if path_pattern in request.url.path:
                config = path_config
                break
        
        # Extract user context
        user_context = extract_user_context_for_rate_limiting(request)
        
        # Bypass for admin if configured
        if config.bypass_for_admin and user_context.get("is_admin", False):
            return await call_next(request)
        
        try:
            # Check rate limit
            allowed, results = await rate_limiter.check_rate_limit(
                request,
                config,
                user_context.get("user_id"),
                user_context.get("security_level", SecurityLevel.MEDIUM)
            )
            
            if not allowed:
                # Calculate retry after
                retry_after = max(
                    result.get("retry_after", 0) 
                    for result in results.values() 
                    if isinstance(result, dict)
                )
                
                return Response(
                    content="Rate limit exceeded",
                    status_code=429,
                    headers={
                        "Retry-After": str(retry_after),
                        "Content-Type": "text/plain"
                    }
                )
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Continue processing if rate limiting fails
        
        return await call_next(request)

# Export rate limiting components
__all__ = [
    'rate_limiter',
    'rate_limit',
    'rate_limit_by_ip',
    'rate_limit_by_user',
    'rate_limit_admin_endpoint',
    'rate_limit_api_key',
    'RateLimitingMiddleware',
    'RateLimitType',
    'RateLimitAlgorithm',
    'RateLimitConfig'
] 