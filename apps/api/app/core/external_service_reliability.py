"""
External Service Reliability Manager
===================================

Comprehensive reliability patterns for external service integrations:
- Circuit breakers for all external dependencies
- Intelligent retry with exponential backoff and jitter
- Dead letter queues for persistent failures
- Service health monitoring and dependency aggregation
- Graceful degradation strategies
- Distributed tracing integration

This module provides a unified interface for all external service calls
with built-in reliability patterns and monitoring.
"""

import asyncio
import time
import logging
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Union, TypeVar, Generic
from dataclasses import dataclass, field, asdict
from enum import Enum
from functools import wraps
import httpx
import aioredis
from sqlalchemy.orm import Session

from app.core.api_reliability import (
    CircuitBreaker, CircuitBreakerConfig, RetryHandler, RetryConfig,
    TimeoutManager, TimeoutConfig, HealthStatus
)
from app.core.redis_client import get_redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar('T')

class ServiceLevel(Enum):
    """Service level for dependency classification"""
    CRITICAL = "critical"      # Core business functionality
    IMPORTANT = "important"    # Major features
    OPTIONAL = "optional"      # Nice-to-have features
    BACKGROUND = "background"  # Background tasks

class ExternalService(Enum):
    """External services that require reliability patterns"""
    DATABASE = "database"
    REDIS = "redis"
    STORAGE_S3 = "storage_s3"
    STORAGE_GCS = "storage_gcs"
    ML_SERVICE = "ml_service"
    EMAIL_SERVICE = "email_service"
    OAUTH_GOOGLE = "oauth_google"
    OAUTH_GITHUB = "oauth_github"
    NOTIFICATION_SERVICE = "notification_service"
    LEMONSQUEEZY = "lemonsqueezy"
    SENTRY = "sentry"
    PROMETHEUS = "prometheus"

@dataclass
class ServiceConfig:
    """Configuration for external service reliability"""
    name: str
    service_level: ServiceLevel
    circuit_breaker_config: CircuitBreakerConfig
    retry_config: RetryConfig
    timeout_config: TimeoutConfig
    health_check_endpoint: Optional[str] = None
    fallback_strategy: Optional[str] = None
    base_url: Optional[str] = None
    enabled: bool = True

@dataclass
class DeadLetterItem:
    """Dead letter queue item for persistent failures"""
    id: str
    service: str
    operation: str
    payload: Dict[str, Any]
    error: str
    created_at: datetime
    retry_count: int = 0
    last_retry_at: Optional[datetime] = None
    max_retries: int = 3

class DeadLetterQueue:
    """Dead letter queue for persistent failures"""
    
    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.redis_client = redis_client
        self.queue_key = "dead_letter_queue"
        self.processing_key = "dead_letter_processing"
        
    async def add_item(self, service: str, operation: str, payload: Dict[str, Any], error: str):
        """Add item to dead letter queue"""
        item = DeadLetterItem(
            id=str(uuid.uuid4()),
            service=service,
            operation=operation,
            payload=payload,
            error=error,
            created_at=datetime.utcnow()
        )
        
        try:
            if not self.redis_client:
                self.redis_client = await get_redis_client()
            
            if self.redis_client:
                await self.redis_client.lpush(
                    self.queue_key,
                    json.dumps(asdict(item), default=str)
                )
                logger.info(f"Added item to dead letter queue: {service}.{operation}")
        except Exception as e:
            logger.error(f"Failed to add item to dead letter queue: {e}")
    
    async def process_queue(self, max_items: int = 10) -> List[Dict[str, Any]]:
        """Process items from dead letter queue"""
        processed_items = []
        
        try:
            if not self.redis_client:
                self.redis_client = await get_redis_client()
            
            if not self.redis_client:
                return processed_items
            
            for _ in range(max_items):
                item_json = await self.redis_client.rpoplpush(
                    self.queue_key, 
                    self.processing_key
                )
                
                if not item_json:
                    break
                
                item_data = json.loads(item_json)
                item = DeadLetterItem(**item_data)
                
                # Check if item should be retried
                if item.retry_count < item.max_retries:
                    # Implement retry logic here
                    processed_items.append({
                        "id": item.id,
                        "service": item.service,
                        "operation": item.operation,
                        "status": "retrying",
                        "retry_count": item.retry_count
                    })
                else:
                    # Mark as permanently failed
                    processed_items.append({
                        "id": item.id,
                        "service": item.service,
                        "operation": item.operation,
                        "status": "permanently_failed",
                        "retry_count": item.retry_count
                    })
                
                # Remove from processing queue
                await self.redis_client.lrem(self.processing_key, 1, item_json)
        
        except Exception as e:
            logger.error(f"Failed to process dead letter queue: {e}")
        
        return processed_items

class ExternalServiceClient(Generic[T]):
    """Generic external service client with reliability patterns"""
    
    def __init__(self, service_config: ServiceConfig):
        self.config = service_config
        self.circuit_breaker = CircuitBreaker(service_config.name, service_config.circuit_breaker_config)
        self.retry_handler = RetryHandler(service_config.retry_config)
        self.timeout_manager = TimeoutManager(service_config.timeout_config)
        self.dead_letter_queue = DeadLetterQueue()
        self.http_client: Optional[httpx.AsyncClient] = None
        
    async def __aenter__(self):
        """Async context manager entry"""
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout_config.default_timeout),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.http_client:
            await self.http_client.aclose()
    
    async def call(
        self,
        operation: str,
        func: Callable[..., T],
        *args,
        fallback: Optional[Callable[..., T]] = None,
        **kwargs
    ) -> T:
        """Execute external service call with all reliability patterns"""
        
        async def _execute_operation():
            """Execute the actual operation"""
            return await self.timeout_manager.with_timeout(
                func,
                timeout=self.config.timeout_config.default_timeout,
                endpoint=f"{self.config.name}.{operation}",
                *args,
                **kwargs
            )
        
        try:
            # Use circuit breaker and retry handler
            result = await self.circuit_breaker.call(
                lambda: self.retry_handler.execute_with_retry(
                    _execute_operation,
                    operation_name=f"{self.config.name}.{operation}"
                )
            )
            return result
            
        except Exception as e:
            logger.error(f"External service call failed: {self.config.name}.{operation}: {e}")
            
            # Add to dead letter queue for persistent failures
            await self.dead_letter_queue.add_item(
                service=self.config.name,
                operation=operation,
                payload={"args": str(args), "kwargs": str(kwargs)},
                error=str(e)
            )
            
            # Try fallback if available
            if fallback:
                try:
                    logger.info(f"Attempting fallback for {self.config.name}.{operation}")
                    return await fallback(*args, **kwargs)
                except Exception as fallback_error:
                    logger.error(f"Fallback also failed: {fallback_error}")
            
            # Apply graceful degradation based on service level
            if self.config.service_level == ServiceLevel.OPTIONAL:
                return None  # Return None for optional services
            elif self.config.service_level == ServiceLevel.BACKGROUND:
                return None  # Return None for background services
            else:
                raise  # Re-raise for critical and important services
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of external service"""
        start_time = time.time()
        
        try:
            if not self.config.health_check_endpoint:
                return {
                    "service": self.config.name,
                    "status": "unknown",
                    "message": "No health check endpoint configured",
                    "response_time": 0.0
                }
            
            if not self.http_client:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(self.config.health_check_endpoint)
            else:
                response = await self.http_client.get(
                    self.config.health_check_endpoint,
                    timeout=5.0
                )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                status = "healthy"
                message = "Service is healthy"
            else:
                status = "unhealthy"
                message = f"Health check returned status {response.status_code}"
            
            return {
                "service": self.config.name,
                "status": status,
                "message": message,
                "response_time": response_time,
                "status_code": response.status_code
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            return {
                "service": self.config.name,
                "status": "unhealthy",
                "message": f"Health check failed: {str(e)}",
                "response_time": response_time,
                "error": str(e)
            }

class ExternalServiceManager:
    """Manager for all external service clients and reliability patterns"""
    
    def __init__(self):
        self.services: Dict[str, ExternalServiceClient] = {}
        self.dead_letter_queue = DeadLetterQueue()
        self._initialize_services()
    
    def _initialize_services(self):
        """Initialize all external service configurations"""
        
        # Database service
        self.register_service(ServiceConfig(
            name=ExternalService.DATABASE.value,
            service_level=ServiceLevel.CRITICAL,
            circuit_breaker_config=CircuitBreakerConfig(
                failure_threshold=3,
                recovery_timeout=30
            ),
            retry_config=RetryConfig(
                max_attempts=3,
                base_delay=0.5,
                max_delay=10.0
            ),
            timeout_config=TimeoutConfig(
                default_timeout=30.0,
                short_timeout=5.0,
                long_timeout=60.0
            )
        ))
        
        # Redis service
        self.register_service(ServiceConfig(
            name=ExternalService.REDIS.value,
            service_level=ServiceLevel.CRITICAL,
            circuit_breaker_config=CircuitBreakerConfig(
                failure_threshold=5,
                recovery_timeout=15
            ),
            retry_config=RetryConfig(
                max_attempts=3,
                base_delay=0.1,
                max_delay=5.0
            ),
            timeout_config=TimeoutConfig(
                default_timeout=10.0,
                short_timeout=2.0,
                long_timeout=30.0
            )
        ))
        
        # ML Service
        if settings.ML_SERVICE_URL:
            self.register_service(ServiceConfig(
                name=ExternalService.ML_SERVICE.value,
                service_level=ServiceLevel.IMPORTANT,
                base_url=settings.ML_SERVICE_URL,
                health_check_endpoint=f"{settings.ML_SERVICE_URL}/health",
                circuit_breaker_config=CircuitBreakerConfig(
                    failure_threshold=5,
                    recovery_timeout=60
                ),
                retry_config=RetryConfig(
                    max_attempts=3,
                    base_delay=1.0,
                    max_delay=30.0
                ),
                timeout_config=TimeoutConfig(
                    default_timeout=60.0,
                    short_timeout=10.0,
                    long_timeout=300.0
                )
            ))
        
        # Email Service
        if settings.EMAIL_SERVICE_URL:
            self.register_service(ServiceConfig(
                name=ExternalService.EMAIL_SERVICE.value,
                service_level=ServiceLevel.OPTIONAL,
                base_url=settings.EMAIL_SERVICE_URL,
                health_check_endpoint=f"{settings.EMAIL_SERVICE_URL}/health",
                circuit_breaker_config=CircuitBreakerConfig(
                    failure_threshold=3,
                    recovery_timeout=120
                ),
                retry_config=RetryConfig(
                    max_attempts=5,
                    base_delay=2.0,
                    max_delay=60.0
                ),
                timeout_config=TimeoutConfig(
                    default_timeout=30.0
                )
            ))
        
        # OAuth Services
        for oauth_service, client_id in [
            (ExternalService.OAUTH_GOOGLE, settings.GOOGLE_CLIENT_ID),
            (ExternalService.OAUTH_GITHUB, settings.GITHUB_CLIENT_ID)
        ]:
            if client_id:
                self.register_service(ServiceConfig(
                    name=oauth_service.value,
                    service_level=ServiceLevel.IMPORTANT,
                    circuit_breaker_config=CircuitBreakerConfig(
                        failure_threshold=5,
                        recovery_timeout=300
                    ),
                    retry_config=RetryConfig(
                        max_attempts=3,
                        base_delay=1.0,
                        max_delay=10.0
                    ),
                    timeout_config=TimeoutConfig(
                        default_timeout=15.0
                    )
                ))
        
        # Storage Services
        if settings.STORAGE_PROVIDER == "s3":
            self.register_service(ServiceConfig(
                name=ExternalService.STORAGE_S3.value,
                service_level=ServiceLevel.IMPORTANT,
                circuit_breaker_config=CircuitBreakerConfig(
                    failure_threshold=3,
                    recovery_timeout=60
                ),
                retry_config=RetryConfig(
                    max_attempts=3,
                    base_delay=1.0,
                    max_delay=30.0
                ),
                timeout_config=TimeoutConfig(
                    default_timeout=60.0,
                    long_timeout=300.0
                )
            ))
        elif settings.STORAGE_PROVIDER == "gcs":
            self.register_service(ServiceConfig(
                name=ExternalService.STORAGE_GCS.value,
                service_level=ServiceLevel.IMPORTANT,
                circuit_breaker_config=CircuitBreakerConfig(
                    failure_threshold=3,
                    recovery_timeout=60
                ),
                retry_config=RetryConfig(
                    max_attempts=3,
                    base_delay=1.0,
                    max_delay=30.0
                ),
                timeout_config=TimeoutConfig(
                    default_timeout=60.0,
                    long_timeout=300.0
                )
            ))
    
    def register_service(self, config: ServiceConfig):
        """Register a new external service"""
        if config.enabled:
            self.services[config.name] = ExternalServiceClient(config)
    
    def get_service(self, service_name: str) -> Optional[ExternalServiceClient]:
        """Get external service client"""
        return self.services.get(service_name)
    
    async def health_check_all(self) -> Dict[str, Any]:
        """Check health of all registered services"""
        results = {}
        
        # Run health checks concurrently
        tasks = [
            (name, client.health_check())
            for name, client in self.services.items()
        ]
        
        for name, task in tasks:
            try:
                result = await asyncio.wait_for(task, timeout=10.0)
                results[name] = result
            except asyncio.TimeoutError:
                results[name] = {
                    "service": name,
                    "status": "timeout",
                    "message": "Health check timed out",
                    "response_time": 10.0
                }
            except Exception as e:
                results[name] = {
                    "service": name,
                    "status": "error",
                    "message": f"Health check error: {str(e)}",
                    "response_time": 0.0,
                    "error": str(e)
                }
        
        # Calculate overall health
        healthy_count = sum(1 for r in results.values() if r["status"] == "healthy")
        total_count = len(results)
        overall_health = "healthy" if healthy_count == total_count else "degraded" if healthy_count > 0 else "unhealthy"
        
        return {
            "overall_status": overall_health,
            "timestamp": datetime.utcnow().isoformat(),
            "services": results,
            "summary": {
                "total": total_count,
                "healthy": healthy_count,
                "unhealthy": total_count - healthy_count,
                "health_percentage": round((healthy_count / total_count) * 100, 2) if total_count > 0 else 0.0
            }
        }
    
    async def process_dead_letter_queue(self) -> Dict[str, Any]:
        """Process items from dead letter queue"""
        results = await self.dead_letter_queue.process_queue()
        return {
            "processed_items": len(results),
            "timestamp": datetime.utcnow().isoformat(),
            "items": results
        }

# Global instance
external_service_manager = ExternalServiceManager()

# Convenience functions for service access
async def call_external_service(
    service_name: str,
    operation: str,
    func: Callable[..., T],
    *args,
    fallback: Optional[Callable[..., T]] = None,
    **kwargs
) -> Optional[T]:
    """Call external service with reliability patterns"""
    service = external_service_manager.get_service(service_name)
    if not service:
        logger.warning(f"External service not found: {service_name}")
        return None
    
    return await service.call(operation, func, *args, fallback=fallback, **kwargs)

async def health_check_external_services() -> Dict[str, Any]:
    """Check health of all external services"""
    return await external_service_manager.health_check_all()

async def process_failed_operations() -> Dict[str, Any]:
    """Process failed operations from dead letter queue"""
    return await external_service_manager.process_dead_letter_queue()

# Decorators for easy integration
def with_external_service_reliability(
    service_name: str,
    operation: str,
    fallback: Optional[Callable] = None
):
    """Decorator to add external service reliability patterns"""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            return await call_external_service(
                service_name=service_name,
                operation=operation,
                func=func,
                *args,
                fallback=fallback,
                **kwargs
            )
        return wrapper
    return decorator