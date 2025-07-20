"""
Rate Limiting Middleware for Schlep-engine API
Provides configurable rate limiting with different strategies
"""

import time
import asyncio
from typing import Dict, Optional, Tuple, Callable
from collections import defaultdict, deque
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import hashlib
import logging

logger = logging.getLogger(__name__)

class RateLimitStore:
    """In-memory store for rate limiting data"""
    
    def __init__(self):
        self.requests: Dict[str, deque] = defaultdict(deque)
        self.blocked_ips: Dict[str, float] = {}
        self.cleanup_interval = 300  # 5 minutes
        self.last_cleanup = time.time()
    
    def get_client_id(self, request: Request) -> str:
        """Get unique client identifier"""
        # Try to get real IP from headers (for proxy/load balancer setups)
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
            request.headers.get("X-Real-IP", "") or
            request.client.host if request.client else "unknown"
        )
        
        # Include user agent for better identification
        user_agent = request.headers.get("user-agent", "")
        client_hash = hashlib.md5(f"{client_ip}:{user_agent}".encode()).hexdigest()[:16]
        
        return f"{client_ip}:{client_hash}"
    
    def is_rate_limited(self, client_id: str, limit: int, window: int) -> Tuple[bool, int]:
        """Check if client is rate limited"""
        now = time.time()
        
        # Check if client is temporarily blocked
        if client_id in self.blocked_ips:
            if now < self.blocked_ips[client_id]:
                remaining_time = int(self.blocked_ips[client_id] - now)
                return True, remaining_time
            else:
                del self.blocked_ips[client_id]
        
        # Clean old requests
        client_requests = self.requests[client_id]
        cutoff_time = now - window
        
        while client_requests and client_requests[0] < cutoff_time:
            client_requests.popleft()
        
        # Check rate limit
        if len(client_requests) >= limit:
            # Block client for escalating time based on violations
            block_duration = min(3600, 60 * (len(client_requests) - limit + 1))  # Max 1 hour
            self.blocked_ips[client_id] = now + block_duration
            return True, block_duration
        
        # Add current request
        client_requests.append(now)
        
        # Cleanup old data periodically
        if now - self.last_cleanup > self.cleanup_interval:
            self.cleanup_old_data()
            self.last_cleanup = now
        
        return False, 0
    
    def cleanup_old_data(self):
        """Clean up old rate limiting data"""
        now = time.time()
        
        # Remove old request records
        for client_id in list(self.requests.keys()):
            client_requests = self.requests[client_id]
            if not client_requests or now - client_requests[-1] > 3600:  # 1 hour
                del self.requests[client_id]
        
        # Remove expired blocks
        for client_id in list(self.blocked_ips.keys()):
            if now >= self.blocked_ips[client_id]:
                del self.blocked_ips[client_id]

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with configurable rules"""
    
    def __init__(self, app, default_limit: int = 100, default_window: int = 60):
        super().__init__(app)
        self.store = RateLimitStore()
        self.default_limit = default_limit
        self.default_window = default_window
        
        # Define different rate limits for different endpoints
        self.endpoint_limits = {
            "/api/v1/upload": (10, 60),    # 10 uploads per minute
            "/api/v1/auth/login": (5, 300),  # 5 login attempts per 5 minutes
            "/api/v1/auth/register": (3, 3600),  # 3 registrations per hour
            "/api/v1/demo": (50, 60),      # 50 demo requests per minute
            "/api/v1/public": (200, 60),   # 200 public API calls per minute
            "/health": (1000, 60),         # Health checks are less restricted
        }
        
        # Whitelist certain paths from rate limiting
        self.whitelist_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/static",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting"""
        
        # Skip rate limiting for whitelisted paths
        if any(request.url.path.startswith(path) for path in self.whitelist_paths):
            return await call_next(request)
        
        # Get client identifier
        client_id = self.store.get_client_id(request)
        
        # Determine rate limit for this endpoint
        limit, window = self.get_rate_limit(request.url.path)
        
        # Check rate limit
        is_limited, remaining_time = self.store.is_rate_limited(client_id, limit, window)
        
        if is_limited:
            logger.warning(f"Rate limit exceeded for {client_id} on {request.url.path}")
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "message": "Rate limit exceeded",
                        "code": "RATE_LIMIT_EXCEEDED",
                        "retry_after": remaining_time,
                        "limit": limit,
                        "window": window
                    }
                },
                headers={
                    "Retry-After": str(remaining_time),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Window": str(window),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        current_requests = len(self.store.requests[client_id])
        remaining_requests = max(0, limit - current_requests)
        
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Window"] = str(window)
        response.headers["X-RateLimit-Remaining"] = str(remaining_requests)
        
        return response
    
    def get_rate_limit(self, path: str) -> Tuple[int, int]:
        """Get rate limit for specific endpoint"""
        for endpoint, (limit, window) in self.endpoint_limits.items():
            if path.startswith(endpoint):
                return limit, window
        
        return self.default_limit, self.default_window

# Factory function for different environments
def create_rate_limiter(environment: str = "development") -> RateLimitMiddleware:
    """Create rate limiter based on environment"""
    
    if environment == "development":
        return RateLimitMiddleware(
            app=None,  # Will be set by FastAPI
            default_limit=1000,  # Very high for development
            default_window=60
        )
    elif environment == "staging":
        return RateLimitMiddleware(
            app=None,
            default_limit=200,   # Moderate for staging
            default_window=60
        )
    else:  # production
        return RateLimitMiddleware(
            app=None,
            default_limit=100,   # Strict for production
            default_window=60
        ) 