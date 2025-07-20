"""
Retry Configuration for Schlep-engine

This module provides comprehensive retry mechanisms with exponential backoff,
jitter, and different retry strategies for different types of failures.
"""

import random
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable, Type, Union
from enum import Enum
from functools import wraps

logger = logging.getLogger(__name__)


class RetryStrategy(Enum):
    """Different retry strategies for different types of failures"""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    CONSTANT_DELAY = "constant_delay"
    FIBONACCI_BACKOFF = "fibonacci_backoff"


class FailureType(Enum):
    """Types of failures that can occur"""
    NETWORK_ERROR = "network_error"
    DATABASE_ERROR = "database_error"
    TIMEOUT_ERROR = "timeout_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    VALIDATION_ERROR = "validation_error"
    SYSTEM_ERROR = "system_error"
    TRANSIENT_ERROR = "transient_error"


class RetryConfig:
    """Configuration for retry mechanisms"""
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 3600.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        jitter_factor: float = 0.1,
        strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_exceptions: Optional[List[Type[Exception]]] = None,
        retry_on_failure_types: Optional[List[FailureType]] = None,
        backoff_factor: float = 1.0
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.jitter_factor = jitter_factor
        self.strategy = strategy
        self.retry_on_exceptions = retry_on_exceptions or []
        self.retry_on_failure_types = retry_on_failure_types or []
        self.backoff_factor = backoff_factor
    
    def calculate_delay(self, retry_count: int) -> float:
        """
        Calculate delay for the given retry count based on strategy.
        
        Args:
            retry_count: Current retry attempt number (0-based)
        
        Returns:
            Delay in seconds
        """
        if retry_count == 0:
            return 0
        
        if self.strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = self.base_delay * (self.exponential_base ** (retry_count - 1))
        elif self.strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = self.base_delay * retry_count
        elif self.strategy == RetryStrategy.CONSTANT_DELAY:
            delay = self.base_delay
        elif self.strategy == RetryStrategy.FIBONACCI_BACKOFF:
            delay = self.base_delay * self._fibonacci(retry_count)
        else:
            delay = self.base_delay
        
        # Apply backoff factor
        delay *= self.backoff_factor
        
        # Apply jitter if enabled
        if self.jitter:
            jitter_amount = delay * self.jitter_factor
            delay += random.uniform(-jitter_amount, jitter_amount)
        
        # Ensure delay is within bounds
        delay = max(0, min(delay, self.max_delay))
        
        return delay
    
    def _fibonacci(self, n: int) -> int:
        """Calculate Fibonacci number for Fibonacci backoff"""
        if n <= 1:
            return n
        a, b = 0, 1
        for _ in range(2, n + 1):
            a, b = b, a + b
        return b
    
    def should_retry(self, exception: Exception, retry_count: int) -> bool:
        """
        Determine if the exception should trigger a retry.
        
        Args:
            exception: The exception that occurred
            retry_count: Current retry attempt number
        
        Returns:
            True if should retry, False otherwise
        """
        # Check if we've exceeded max retries
        if retry_count >= self.max_retries:
            return False
        
        # Check if exception type is in retry list
        if self.retry_on_exceptions:
            for retry_exception in self.retry_on_exceptions:
                if isinstance(exception, retry_exception):
                    return True
        
        # Check if failure type is in retry list
        failure_type = self._classify_failure(exception)
        if failure_type in self.retry_on_failure_types:
            return True
        
        # Default: retry on transient errors
        return self._is_transient_error(exception)
    
    def _classify_failure(self, exception: Exception) -> FailureType:
        """Classify the type of failure based on the exception"""
        exception_name = type(exception).__name__.lower()
        exception_message = str(exception).lower()
        
        # Network errors
        if any(keyword in exception_name or keyword in exception_message 
               for keyword in ['connection', 'timeout', 'network', 'socket']):
            return FailureType.NETWORK_ERROR
        
        # Database errors
        if any(keyword in exception_name or keyword in exception_message 
               for keyword in ['database', 'sql', 'db', 'connection']):
            return FailureType.DATABASE_ERROR
        
        # Timeout errors
        if any(keyword in exception_name or keyword in exception_message 
               for keyword in ['timeout', 'timed', 'expired']):
            return FailureType.TIMEOUT_ERROR
        
        # Rate limit errors
        if any(keyword in exception_name or keyword in exception_message 
               for keyword in ['rate', 'limit', 'throttle', 'quota']):
            return FailureType.RATE_LIMIT_ERROR
        
        # Validation errors
        if any(keyword in exception_name or keyword in exception_message 
               for keyword in ['validation', 'invalid', 'format']):
            return FailureType.VALIDATION_ERROR
        
        # System errors
        if any(keyword in exception_name or keyword in exception_message 
               for keyword in ['system', 'internal', 'server']):
            return FailureType.SYSTEM_ERROR
        
        return FailureType.TRANSIENT_ERROR
    
    def _is_transient_error(self, exception: Exception) -> bool:
        """Check if the error is likely transient"""
        # Default retry on most exceptions except validation errors
        failure_type = self._classify_failure(exception)
        return failure_type != FailureType.VALIDATION_ERROR


class RetryManager:
    """Manager for retry operations with comprehensive logging and monitoring"""
    
    def __init__(self, config: RetryConfig):
        self.config = config
        self.retry_history: List[Dict[str, Any]] = []
    
    def execute_with_retry(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute a function with retry logic.
        
        Args:
            func: Function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments
        
        Returns:
            Function result
        
        Raises:
            Exception: Last exception if all retries fail
        """
        last_exception = None
        start_time = time.time()
        
        for retry_count in range(self.config.max_retries + 1):
            try:
                if retry_count > 0:
                    delay = self.config.calculate_delay(retry_count)
                    logger.info(f"Retry attempt {retry_count} after {delay:.2f}s delay")
                    time.sleep(delay)
                
                result = func(*args, **kwargs)
                
                # Success - log and return
                if retry_count > 0:
                    execution_time = time.time() - start_time
                    self._log_success(retry_count, execution_time)
                
                return result
                
            except Exception as e:
                last_exception = e
                execution_time = time.time() - start_time
                
                # Log the failure
                self._log_failure(retry_count, e, execution_time)
                
                # Check if we should retry
                if not self.config.should_retry(e, retry_count):
                    logger.error(f"Not retrying - exception not in retry list or max retries exceeded")
                    break
        
        # All retries failed
        total_time = time.time() - start_time
        self._log_final_failure(total_time)
        raise last_exception
    
    def _log_success(self, retry_count: int, execution_time: float):
        """Log successful retry"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'success',
            'retry_count': retry_count,
            'execution_time': execution_time
        }
        self.retry_history.append(log_entry)
        logger.info(f"Operation succeeded after {retry_count} retries in {execution_time:.2f}s")
    
    def _log_failure(self, retry_count: int, exception: Exception, execution_time: float):
        """Log retry failure"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'failure',
            'retry_count': retry_count,
            'exception_type': type(exception).__name__,
            'exception_message': str(exception),
            'execution_time': execution_time
        }
        self.retry_history.append(log_entry)
        logger.warning(f"Retry attempt {retry_count} failed: {type(exception).__name__}: {exception}")
    
    def _log_final_failure(self, total_time: float):
        """Log final failure after all retries"""
        logger.error(f"Operation failed after all retries in {total_time:.2f}s")
    
    def get_retry_statistics(self) -> Dict[str, Any]:
        """Get statistics about retry operations"""
        if not self.retry_history:
            return {'total_operations': 0}
        
        total_operations = len([entry for entry in self.retry_history if entry['retry_count'] == 0])
        successful_retries = len([entry for entry in self.retry_history if entry['status'] == 'success' and entry['retry_count'] > 0])
        failed_operations = len([entry for entry in self.retry_history if entry['status'] == 'failure' and entry['retry_count'] == self.config.max_retries])
        
        avg_execution_time = sum(entry['execution_time'] for entry in self.retry_history) / len(self.retry_history)
        
        return {
            'total_operations': total_operations,
            'successful_retries': successful_retries,
            'failed_operations': failed_operations,
            'success_rate': (total_operations - failed_operations) / total_operations if total_operations > 0 else 0,
            'average_execution_time': avg_execution_time,
            'retry_history': self.retry_history[-10:]  # Last 10 entries
        }


# Predefined retry configurations for common scenarios
RETRY_CONFIGS = {
    'network_operations': RetryConfig(
        max_retries=5,
        base_delay=1.0,
        max_delay=300.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_failure_types=[FailureType.NETWORK_ERROR, FailureType.TIMEOUT_ERROR]
    ),
    
    'database_operations': RetryConfig(
        max_retries=3,
        base_delay=0.5,
        max_delay=60.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_failure_types=[FailureType.DATABASE_ERROR, FailureType.TIMEOUT_ERROR]
    ),
    
    'api_calls': RetryConfig(
        max_retries=3,
        base_delay=2.0,
        max_delay=300.0,
        strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
        retry_on_failure_types=[FailureType.NETWORK_ERROR, FailureType.RATE_LIMIT_ERROR, FailureType.TIMEOUT_ERROR]
    ),
    
    'file_operations': RetryConfig(
        max_retries=2,
        base_delay=1.0,
        max_delay=30.0,
        strategy=RetryStrategy.LINEAR_BACKOFF,
        retry_on_failure_types=[FailureType.SYSTEM_ERROR, FailureType.TIMEOUT_ERROR]
    ),
    
    'validation_operations': RetryConfig(
        max_retries=1,
        base_delay=0.1,
        max_delay=1.0,
        strategy=RetryStrategy.CONSTANT_DELAY,
        retry_on_failure_types=[FailureType.TRANSIENT_ERROR]
    )
}


def retry_decorator(config_name: str = 'default', **config_overrides):
    """
    Decorator for adding retry functionality to functions.
    
    Args:
        config_name: Name of the retry configuration to use
        **config_overrides: Override specific config parameters
    
    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get base config
            base_config = RETRY_CONFIGS.get(config_name, RetryConfig())
            
            # Apply overrides
            config_dict = base_config.__dict__.copy()
            config_dict.update(config_overrides)
            config = RetryConfig(**config_dict)
            
            # Create retry manager and execute
            retry_manager = RetryManager(config)
            return retry_manager.execute_with_retry(func, *args, **kwargs)
        
        return wrapper
    return decorator


# Utility functions for common retry patterns
def retry_network_operation(func: Callable) -> Callable:
    """Decorator for network operations with appropriate retry logic"""
    return retry_decorator('network_operations')(func)


def retry_database_operation(func: Callable) -> Callable:
    """Decorator for database operations with appropriate retry logic"""
    return retry_decorator('database_operations')(func)


def retry_api_call(func: Callable) -> Callable:
    """Decorator for API calls with appropriate retry logic"""
    return retry_decorator('api_calls')(func)


def retry_file_operation(func: Callable) -> Callable:
    """Decorator for file operations with appropriate retry logic"""
    return retry_decorator('file_operations')(func) 