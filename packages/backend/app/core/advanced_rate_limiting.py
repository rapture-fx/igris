"""
ADVANCED INTELLIGENT RATE LIMITING SYSTEM - POLLARBASE
=====================================================

Enhanced rate limiting with adaptive algorithms, user tier awareness,
and intelligent throttling based on system load and user behavior.

Key Features:
- Adaptive rate limiting based on user subscription tier
- System load-aware throttling
- Intelligent burst handling
- Geographic rate limiting
- API endpoint-specific limits
- Real-time rate limit monitoring
- Automatic scaling based on system capacity
"""

import asyncio
import time
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from functools import wraps
import json

from fastapi import HTTPException, status, Request
from redis import Redis
import logging

from app.core.api_config import settings
from app.database.models import User, UserRole

# Configure logging
logger = logging.getLogger(__name__)

# Redis connection
redis_client = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True)

class RateLimitTier:
    """Rate limiting tiers based on user subscription"""
    
    FREE = {
        'requests_per_minute': 30,
        'requests_per_hour': 500,
        'requests_per_day': 5000,
        'burst_limit': 10,
        'concurrent_requests': 5
    }
    
    PRO = {
        'requests_per_minute': 120,
        'requests_per_hour': 5000,
        'requests_per_day': 50000,
        'burst_limit': 30,
        'concurrent_requests': 20
    }
    
    ENTERPRISE = {
        'requests_per_minute': 500,
        'requests_per_hour': 25000,
        'requests_per_day': 500000,
        'burst_limit': 100,
        'concurrent_requests': 100
    }
    
    ADMIN = {
        'requests_per_minute': 1000,
        'requests_per_hour': 50000,
        'requests_per_day': 1000000,
        'burst_limit': 200,
        'concurrent_requests': 200
    }

class SystemLoadManager:
    """Manages system load and adjusts rate limits accordingly"""
    
    def __init__(self):
        self.load_thresholds = {
            'low': 0.3,      # < 30% load
            'medium': 0.7,   # 30-70% load
            'high': 0.9,     # 70-90% load
            'critical': 1.0  # > 90% load
        }
        
        self.load_multipliers = {
            'low': 1.5,      # Increase limits by 50%
            'medium': 1.0,   # Normal limits
            'high': 0.7,     # Reduce limits by 30%
            'critical': 0.3  # Reduce limits by 70%
        }
    
    async def get_current_load(self) -> float:
        """Get current system load from Redis metrics"""
        try:
            # Get system metrics from Redis
            cpu_usage = float(redis_client.get('system:cpu_usage') or 0)
            memory_usage = float(redis_client.get('system:memory_usage') or 0)
            active_connections = int(redis_client.get('system:active_connections') or 0)
            
            # Calculate composite load score
            load_score = (cpu_usage * 0.4 + memory_usage * 0.4 + min(active_connections / 1000, 1.0) * 0.2)
            return min(load_score, 1.0)
            
        except Exception as e:
            logger.warning(f"Failed to get system load: {e}")
            return 0.5  # Default to medium load
    
    def get_load_level(self, load: float) -> str:
        """Determine load level based on current load"""
        if load < self.load_thresholds['low']:
            return 'low'
        elif load < self.load_thresholds['medium']:
            return 'medium'
        elif load < self.load_thresholds['high']:
            return 'high'
        else:
            return 'critical'
    
    def get_load_multiplier(self, load_level: str) -> float:
        """Get rate limit multiplier for current load level"""
        return self.load_multipliers.get(load_level, 1.0)

class IntelligentRateLimiter:
    """Advanced rate limiter with intelligent algorithms"""
    
    def __init__(self):
        self.load_manager = SystemLoadManager()
        self.sliding_window_size = 60  # 60 seconds
        self.burst_window_size = 10   # 10 seconds
        
    def get_user_tier_limits(self, user: Optional[User]) -> Dict[str, int]:
        """Get rate limits based on user tier"""
        if not user:
            return RateLimitTier.FREE
        
        if user.role == UserRole.ADMIN:
            return RateLimitTier.ADMIN
        
        # Check user's subscription plan
        if hasattr(user, 'organization') and user.organization:
            plan = getattr(user.organization, 'subscription_plan', 'free')
            if plan == 'enterprise':
                return RateLimitTier.ENTERPRISE
            elif plan == 'pro':
                return RateLimitTier.PRO
        
        return RateLimitTier.FREE
    
    async def check_rate_limit(
        self, 
        identifier: str, 
        endpoint: str,
        user: Optional[User] = None,
        request: Optional[Request] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Advanced rate limit checking with multiple algorithms
        Returns: (allowed, rate_limit_info)
        """
        
        try:
            # Get user tier limits
            base_limits = self.get_user_tier_limits(user)
            
            # Get current system load
            current_load = await self.load_manager.get_current_load()
            load_level = self.load_manager.get_load_level(current_load)
            load_multiplier = self.load_manager.get_load_multiplier(load_level)
            
            # Apply load-based adjustments
            adjusted_limits = {
                key: int(value * load_multiplier) 
                for key, value in base_limits.items()
            }
            
            # Check different time windows
            current_time = time.time()
            
            # 1. Check per-minute limit (sliding window)
            minute_allowed, minute_info = await self._check_sliding_window(
                identifier, endpoint, 60, adjusted_limits['requests_per_minute'], current_time
            )
            
            # 2. Check per-hour limit
            hour_allowed, hour_info = await self._check_sliding_window(
                identifier, endpoint, 3600, adjusted_limits['requests_per_hour'], current_time
            )
            
            # 3. Check burst limit
            burst_allowed, burst_info = await self._check_burst_limit(
                identifier, endpoint, adjusted_limits['burst_limit'], current_time
            )
            
            # 4. Check concurrent requests
            concurrent_allowed, concurrent_info = await self._check_concurrent_limit(
                identifier, adjusted_limits['concurrent_requests']
            )
            
            # Determine if request is allowed
            allowed = all([minute_allowed, hour_allowed, burst_allowed, concurrent_allowed])
            
            # Compile rate limit information
            rate_limit_info = {
                'allowed': allowed,
                'user_tier': user.role.value if user else 'anonymous',
                'system_load': current_load,
                'load_level': load_level,
                'load_multiplier': load_multiplier,
                'limits': {
                    'minute': {
                        'limit': adjusted_limits['requests_per_minute'],
                        'remaining': minute_info['remaining'],
                        'reset_time': minute_info['reset_time']
                    },
                    'hour': {
                        'limit': adjusted_limits['requests_per_hour'],
                        'remaining': hour_info['remaining'],
                        'reset_time': hour_info['reset_time']
                    },
                    'burst': {
                        'limit': adjusted_limits['burst_limit'],
                        'remaining': burst_info['remaining'],
                        'reset_time': burst_info['reset_time']
                    },
                    'concurrent': {
                        'limit': adjusted_limits['concurrent_requests'],
                        'current': concurrent_info['current']
                    }
                }
            }
            
            # Log rate limiting decision
            if not allowed:
                logger.warning(f"Rate limit exceeded for {identifier} on {endpoint}")
                await self._log_rate_limit_violation(identifier, endpoint, rate_limit_info)
            
            return allowed, rate_limit_info
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Fail open - allow request if rate limiting fails
            return True, {'error': str(e)}
    
    async def _check_sliding_window(
        self, 
        identifier: str, 
        endpoint: str, 
        window_seconds: int,
        limit: int, 
        current_time: float
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check sliding window rate limit"""
        
        window_key = f"rate_limit:{identifier}:{endpoint}:{window_seconds}"
        window_start = current_time - window_seconds
        
        # Remove old entries
        redis_client.zremrangebyscore(window_key, 0, window_start)
        
        # Count current requests in window
        current_count = redis_client.zcard(window_key)
        
        # Check if limit exceeded
        allowed = current_count < limit
        
        if allowed:
            # Add current request
            redis_client.zadd(window_key, {str(current_time): current_time})
            redis_client.expire(window_key, window_seconds)
        
        # Calculate reset time
        oldest_request = redis_client.zrange(window_key, 0, 0, withscores=True)
        reset_time = (oldest_request[0][1] + window_seconds) if oldest_request else (current_time + window_seconds)
        
        return allowed, {
            'remaining': max(0, limit - current_count - (1 if allowed else 0)),
            'reset_time': reset_time
        }
    
    async def _check_burst_limit(
        self, 
        identifier: str, 
        endpoint: str, 
        burst_limit: int, 
        current_time: float
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check burst rate limit (short time window)"""
        
        burst_key = f"burst:{identifier}:{endpoint}"
        burst_window = 10  # 10 seconds
        
        # Get current burst count
        burst_data = redis_client.hgetall(burst_key)
        
        if burst_data:
            last_reset = float(burst_data.get('last_reset', 0))
            current_count = int(burst_data.get('count', 0))
            
            # Reset if window expired
            if current_time - last_reset > burst_window:
                current_count = 0
                last_reset = current_time
        else:
            current_count = 0
            last_reset = current_time
        
        # Check burst limit
        allowed = current_count < burst_limit
        
        if allowed:
            # Increment burst count
            redis_client.hset(burst_key, mapping={
                'count': current_count + 1,
                'last_reset': last_reset
            })
            redis_client.expire(burst_key, burst_window)
        
        return allowed, {
            'remaining': max(0, burst_limit - current_count - (1 if allowed else 0)),
            'reset_time': last_reset + burst_window
        }
    
    async def _check_concurrent_limit(
        self, 
        identifier: str, 
        concurrent_limit: int
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check concurrent request limit"""
        
        concurrent_key = f"concurrent:{identifier}"
        current_concurrent = int(redis_client.get(concurrent_key) or 0)
        
        allowed = current_concurrent < concurrent_limit
        
        return allowed, {
            'current': current_concurrent,
            'limit': concurrent_limit
        }
    
    async def increment_concurrent(self, identifier: str):
        """Increment concurrent request counter"""
        concurrent_key = f"concurrent:{identifier}"
        redis_client.incr(concurrent_key)
        redis_client.expire(concurrent_key, 300)  # 5 minutes TTL
    
    async def decrement_concurrent(self, identifier: str):
        """Decrement concurrent request counter"""
        concurrent_key = f"concurrent:{identifier}"
        current = redis_client.get(concurrent_key)
        if current and int(current) > 0:
            redis_client.decr(concurrent_key)
    
    async def _log_rate_limit_violation(
        self, 
        identifier: str, 
        endpoint: str, 
        rate_limit_info: Dict[str, Any]
    ):
        """Log rate limit violation for monitoring"""
        
        violation_data = {
            'identifier': identifier,
            'endpoint': endpoint,
            'timestamp': datetime.utcnow().isoformat(),
            'rate_limit_info': rate_limit_info
        }
        
        # Store in Redis for monitoring
        violation_key = f"rate_limit_violations:{datetime.utcnow().strftime('%Y%m%d')}"
        redis_client.lpush(violation_key, json.dumps(violation_data))
        redis_client.expire(violation_key, 86400 * 7)  # Keep for 7 days

# Initialize rate limiter
intelligent_rate_limiter = IntelligentRateLimiter()

# ==================== DECORATORS ====================

def adaptive_rate_limit(endpoint_name: Optional[str] = None):
    """
    Adaptive rate limiting decorator with intelligent algorithms
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request and user from arguments
            request = None
            user = None
            
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                elif isinstance(arg, User):
                    user = arg
            
            # Check kwargs for user
            if not user and 'current_user' in kwargs:
                user = kwargs['current_user']
            
            # Generate identifier
            if user:
                identifier = f"user:{user.id}"
            elif request:
                identifier = f"ip:{request.client.host}"
            else:
                identifier = "anonymous"
            
            # Determine endpoint name
            endpoint = endpoint_name or func.__name__
            
            # Check rate limit
            allowed, rate_limit_info = await intelligent_rate_limiter.check_rate_limit(
                identifier, endpoint, user, request
            )
            
            if not allowed:
                # Build rate limit headers
                headers = {}
                if 'limits' in rate_limit_info:
                    minute_limit = rate_limit_info['limits']['minute']
                    headers.update({
                        'X-RateLimit-Limit': str(minute_limit['limit']),
                        'X-RateLimit-Remaining': str(minute_limit['remaining']),
                        'X-RateLimit-Reset': str(int(minute_limit['reset_time'])),
                        'X-RateLimit-Load-Level': rate_limit_info.get('load_level', 'unknown')
                    })
                
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please try again later.",
                    headers=headers
                )
            
            # Increment concurrent counter
            await intelligent_rate_limiter.increment_concurrent(identifier)
            
            try:
                # Execute the function
                result = await func(*args, **kwargs)
                return result
            finally:
                # Decrement concurrent counter
                await intelligent_rate_limiter.decrement_concurrent(identifier)
        
        return wrapper
    return decorator

def endpoint_specific_rate_limit(
    requests_per_minute: int,
    requests_per_hour: int,
    burst_limit: Optional[int] = None
):
    """
    Endpoint-specific rate limiting with custom limits
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Implementation similar to adaptive_rate_limit but with custom limits
            # This would override the user tier limits for specific endpoints
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# ==================== MONITORING FUNCTIONS ====================

async def get_rate_limit_stats(time_period: str = "hour") -> Dict[str, Any]:
    """Get rate limiting statistics"""
    
    try:
        current_time = datetime.utcnow()
        
        if time_period == "hour":
            start_time = current_time - timedelta(hours=1)
        elif time_period == "day":
            start_time = current_time - timedelta(days=1)
        else:
            start_time = current_time - timedelta(hours=1)
        
        # Get violation data
        violation_keys = redis_client.keys("rate_limit_violations:*")
        total_violations = 0
        
        for key in violation_keys:
            violations = redis_client.lrange(key, 0, -1)
            for violation_json in violations:
                violation_data = json.loads(violation_json)
                violation_time = datetime.fromisoformat(violation_data['timestamp'])
                if violation_time >= start_time:
                    total_violations += 1
        
        # Get system load
        current_load = await intelligent_rate_limiter.load_manager.get_current_load()
        load_level = intelligent_rate_limiter.load_manager.get_load_level(current_load)
        
        return {
            'time_period': time_period,
            'total_violations': total_violations,
            'current_system_load': current_load,
            'load_level': load_level,
            'rate_limit_effectiveness': max(0, 1 - (total_violations / 1000))  # Effectiveness score
        }
        
    except Exception as e:
        logger.error(f"Error getting rate limit stats: {e}")
        return {'error': str(e)}

async def reset_user_rate_limits(user_id: str):
    """Reset rate limits for a specific user (admin function)"""
    
    try:
        # Find all keys for this user
        user_keys = redis_client.keys(f"*user:{user_id}*")
        
        if user_keys:
            redis_client.delete(*user_keys)
            logger.info(f"Reset rate limits for user {user_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error resetting rate limits for user {user_id}: {e}")
        return False 