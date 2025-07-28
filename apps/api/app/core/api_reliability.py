"""
API Reliability & Performance System
===================================

Comprehensive reliability features for API-as-a-Service:
- Circuit breakers for external dependencies
- Intelligent retry logic with exponential backoff
- Request timeout management
- Performance optimization and caching
- Graceful degradation
- Health-based load balancing
"""

import asyncio
import time
import logging
import json
from typing import Dict, Any, Optional, Callable, List, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime, timedelta
import functools
import random

from fastapi import HTTPException, status
from prometheus_client import Counter, Histogram, Gauge
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from circuit_breaker import CircuitBreaker as ExternalCircuitBreaker
from hystrix.decorators import circuit_breaker as hystrix_breaker

from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered

@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: int = 60  # seconds
    expected_exception: type = Exception
    monitor_interval: int = 10  # seconds
    redis_key_prefix: str = "circuit_breaker"
    persistence_enabled: bool = True

@dataclass
class RetryConfig:
    max_attempts: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 60.0  # seconds
    exponential_base: float = 2.0
    jitter: bool = True

@dataclass
class TimeoutConfig:
    default_timeout: float = 30.0  # seconds
    short_timeout: float = 5.0     # seconds
    long_timeout: float = 120.0    # seconds
    per_endpoint_timeouts: Dict[str, float] = field(default_factory=dict)

class CircuitBreaker:
    """Circuit breaker pattern implementation with Redis persistence"""
    
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.success_count = 0
        self.redis_key = f"{config.redis_key_prefix}:{name}"
        
        # Metrics
        self.failure_counter = Counter(
            f'circuit_breaker_failures_total',
            'Total circuit breaker failures',
            ['circuit_name']
        )
        self.state_gauge = Gauge(
            f'circuit_breaker_state',
            'Circuit breaker state',
            ['circuit_name']
        )
        
        # Initialize from Redis if persistence is enabled
        if config.persistence_enabled:
            asyncio.create_task(self._load_state_from_redis())
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        # Load current state from Redis if persistence is enabled
        if self.config.persistence_enabled:
            await self._load_state_from_redis()
        
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                logger.info(f"Circuit {self.name} attempting reset")
                await self._save_state_to_redis()
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Service {self.name} is temporarily unavailable"
                )
        
        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
            
        except Exception as e:
            await self._on_failure()
            raise
    
    async def _on_success(self):
        """Handle successful execution"""
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            logger.info(f"Circuit {self.name} reset to closed")
        self.success_count += 1
        self.state_gauge.labels(circuit_name=self.name).set(0)  # Closed state
        
        # Save state to Redis
        if self.config.persistence_enabled:
            await self._save_state_to_redis()
    
    async def _on_failure(self):
        """Handle failed execution"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        self.failure_counter.labels(circuit_name=self.name).inc()
        
        if self.failure_count >= self.config.failure_threshold:
            self.state = CircuitState.OPEN
            self.state_gauge.labels(circuit_name=self.name).set(2)  # Open state
            logger.warning(f"Circuit {self.name} opened after {self.failure_count} failures")
        
        # Save state to Redis
        if self.config.persistence_enabled:
            await self._save_state_to_redis()
    
    def _should_attempt_reset(self) -> bool:
        """Check if circuit should attempt reset"""
        if not self.last_failure_time:
            return True
        
        return (datetime.utcnow() - self.last_failure_time).total_seconds() >= self.config.recovery_timeout
    
    async def _save_state_to_redis(self):
        """Save circuit breaker state to Redis"""
        try:
            redis_client = await get_redis_client()
            if redis_client:
                state_data = {
                    'state': self.state.value,
                    'failure_count': self.failure_count,
                    'success_count': self.success_count,
                    'last_failure_time': self.last_failure_time.isoformat() if self.last_failure_time else None,
                    'config': asdict(self.config)
                }
                await redis_client.setex(
                    self.redis_key, 
                    self.config.recovery_timeout * 2,  # TTL = 2x recovery timeout
                    json.dumps(state_data, default=str)
                )
        except Exception as e:
            logger.warning(f"Failed to save circuit breaker state to Redis: {e}")
    
    async def _load_state_from_redis(self):
        """Load circuit breaker state from Redis"""
        try:
            redis_client = await get_redis_client()
            if redis_client:
                state_json = await redis_client.get(self.redis_key)
                if state_json:
                    state_data = json.loads(state_json)
                    self.state = CircuitState(state_data['state'])
                    self.failure_count = state_data['failure_count']
                    self.success_count = state_data['success_count']
                    if state_data['last_failure_time']:
                        self.last_failure_time = datetime.fromisoformat(state_data['last_failure_time'])
                    logger.debug(f"Loaded circuit breaker state from Redis for {self.name}")
        except Exception as e:
            logger.warning(f"Failed to load circuit breaker state from Redis: {e}")

class RetryHandler:
    """Intelligent retry logic with exponential backoff using tenacity"""
    
    def __init__(self, config: RetryConfig):
        self.config = config
        
        # Metrics
        self.retry_counter = Counter(
            'retry_attempts_total',
            'Total retry attempts',
            ['operation', 'status']
        )
        self.retry_duration = Histogram(
            'retry_duration_seconds',
            'Retry operation duration',
            ['operation']
        )
    
    async def execute_with_retry(
        self, 
        func: Callable, 
        operation_name: str = "unknown",
        *args, 
        **kwargs
    ) -> Any:
        """Execute function with retry logic using tenacity"""
        start_time = time.time()
        
        @retry(
            stop=stop_after_attempt(self.config.max_attempts),
            wait=wait_exponential(
                multiplier=self.config.base_delay,
                max=self.config.max_delay,
                exp_base=self.config.exponential_base
            ),
            retry=retry_if_exception_type(Exception),
            reraise=True
        )
        async def _execute_with_tenacity():
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                self.retry_counter.labels(
                    operation=operation_name, 
                    status="failure"
                ).inc()
                logger.warning(f"Retry attempt failed for {operation_name}: {str(e)}")
                raise
        
        try:
            result = await _execute_with_tenacity()
            
            # Record success metrics
            duration = time.time() - start_time
            self.retry_duration.labels(operation=operation_name).observe(duration)
            self.retry_counter.labels(
                operation=operation_name, 
                status="success"
            ).inc()
            
            return result
            
        except Exception as e:
            # All retries failed
            duration = time.time() - start_time
            self.retry_duration.labels(operation=operation_name).observe(duration)
            raise e
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and optional jitter (legacy method)"""
        delay = min(
            self.config.base_delay * (self.config.exponential_base ** attempt),
            self.config.max_delay
        )
        
        if self.config.jitter:
            delay *= (0.5 + random.random() * 0.5)  # Add 50% jitter
        
        return delay

class TimeoutManager:
    """Request timeout management"""
    
    def __init__(self, config: TimeoutConfig):
        self.config = config
        
        # Metrics
        self.timeout_counter = Counter(
            'request_timeouts_total',
            'Total request timeouts',
            ['endpoint', 'timeout_type']
        )
    
    async def with_timeout(
        self, 
        func: Callable, 
        timeout: Optional[float] = None,
        endpoint: str = "unknown",
        *args, 
        **kwargs
    ) -> Any:
        """Execute function with timeout"""
        if timeout is None:
            timeout = self.config.per_endpoint_timeouts.get(
                endpoint, 
                self.config.default_timeout
            )
        
        try:
            return await asyncio.wait_for(func(*args, **kwargs), timeout=timeout)
            
        except asyncio.TimeoutError:
            self.timeout_counter.labels(
                endpoint=endpoint,
                timeout_type="request"
            ).inc()
            
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"Request timed out after {timeout} seconds"
            )

class PerformanceOptimizer:
    """Performance optimization utilities"""
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes default
        
        # Metrics
        self.cache_hits = Counter('cache_hits_total', 'Total cache hits', ['cache_type'])
        self.cache_misses = Counter('cache_misses_total', 'Total cache misses', ['cache_type'])
    
    def cache_result(self, key: str, ttl: int = None):
        """Decorator to cache function results"""
        def decorator(func: Callable):
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
                
                # Check cache
                if cache_key in self.cache:
                    entry = self.cache[cache_key]
                    if time.time() - entry['timestamp'] < (ttl or self.cache_ttl):
                        self.cache_hits.labels(cache_type="function").inc()
                        return entry['result']
                
                # Cache miss
                self.cache_misses.labels(cache_type="function").inc()
                result = await func(*args, **kwargs)
                
                # Store in cache
                self.cache[cache_key] = {
                    'result': result,
                    'timestamp': time.time()
                }
                
                return result
            return wrapper
        return decorator
    
    def optimize_response(self, data: Any) -> Any:
        """Optimize response data for performance"""
        if isinstance(data, dict):
            # Remove None values to reduce payload size
            return {k: v for k, v in data.items() if v is not None}
        return data

class GracefulDegradation:
    """Graceful degradation system"""
    
    def __init__(self):
        self.degradation_levels = {
            'full': 1.0,      # Full functionality
            'reduced': 0.7,   # Reduced features
            'minimal': 0.3,   # Minimal features
            'emergency': 0.1  # Emergency mode
        }
        self.current_level = 'full'
        
        # Metrics
        self.degradation_gauge = Gauge(
            'degradation_level',
            'Current degradation level',
            ['level']
        )
    
    def set_degradation_level(self, level: str):
        """Set current degradation level"""
        if level in self.degradation_levels:
            self.current_level = level
            self.degradation_gauge.labels(level=level).set(1)
            logger.info(f"Service degradation level set to: {level}")
    
    def should_skip_feature(self, feature_name: str) -> bool:
        """Check if feature should be skipped based on degradation level"""
        # Implement feature-specific degradation logic
        critical_features = ['health', 'auth', 'core_data']
        if feature_name in critical_features:
            return False
        
        # Random skip based on degradation level
        skip_probability = 1.0 - self.degradation_levels[self.current_level]
        return random.random() < skip_probability

# Global instances
circuit_breakers: Dict[str, CircuitBreaker] = {}
retry_handler = RetryHandler(RetryConfig())
timeout_manager = TimeoutManager(TimeoutConfig())
performance_optimizer = PerformanceOptimizer()
graceful_degradation = GracefulDegradation()

def get_circuit_breaker(name: str, config: CircuitBreakerConfig = None) -> CircuitBreaker:
    """Get or create circuit breaker"""
    if name not in circuit_breakers:
        circuit_breakers[name] = CircuitBreaker(name, config or CircuitBreakerConfig())
    return circuit_breakers[name]

# Decorators for easy use
def with_circuit_breaker(circuit_name: str, config: CircuitBreakerConfig = None):
    """Decorator to add circuit breaker protection"""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            circuit = get_circuit_breaker(circuit_name, config)
            return await circuit.call(func, *args, **kwargs)
        return wrapper
    return decorator

def with_retry(config: RetryConfig = None):
    """Decorator to add retry logic"""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            retry_config = config or RetryConfig()
            retry_handler_instance = RetryHandler(retry_config)
            return await retry_handler_instance.execute_with_retry(
                func, 
                func.__name__, 
                *args, 
                **kwargs
            )
        return wrapper
    return decorator

def with_timeout(timeout: float = None, endpoint: str = None):
    """Decorator to add timeout protection"""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            return await timeout_manager.with_timeout(
                func, 
                timeout, 
                endpoint or func.__name__, 
                *args, 
                **kwargs
            )
        return wrapper
    return decorator 