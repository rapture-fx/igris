"""
Retry configuration and strategies for Schlep-engine SDK
"""

import time
import random
import logging
from dataclasses import dataclass
from typing import Callable, Optional, Type, Tuple, Union, List
from enum import Enum

from ..exceptions.base import SchlepEngineError, RateLimitError, ServerError, NetworkError, TimeoutError


logger = logging.getLogger(__name__)


class RetryStrategy(str, Enum):
    """Available retry strategies."""
    
    FIXED = "fixed"
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    JITTER = "jitter"


@dataclass
class RetryConfig:
    """Configuration for retry logic."""
    
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    backoff_factor: float = 2.0
    jitter: bool = True
    retryable_exceptions: Tuple[Type[Exception], ...] = (
        RateLimitError,
        ServerError,
        NetworkError,
        TimeoutError
    )
    retryable_status_codes: Tuple[int, ...] = (408, 429, 500, 502, 503, 504)
    
    def should_retry(self, exception: Exception, attempt: int) -> bool:
        """
        Determine if an exception should trigger a retry.
        
        Args:
            exception: The exception that occurred
            attempt: Current attempt number (1-based)
            
        Returns:
            True if should retry, False otherwise
        """
        if attempt >= self.max_retries:
            return False
        
        # Check if it's a retryable exception type
        if isinstance(exception, self.retryable_exceptions):
            return True
        
        # For API errors, check status codes
        if hasattr(exception, 'status_code') and exception.status_code in self.retryable_status_codes:
            return True
        
        return False
    
    def get_delay(self, attempt: int) -> float:
        """
        Calculate delay for given attempt.
        
        Args:
            attempt: Attempt number (1-based)
            
        Returns:
            Delay in seconds
        """
        if self.strategy == RetryStrategy.FIXED:
            delay = self.base_delay
        elif self.strategy == RetryStrategy.LINEAR:
            delay = self.base_delay * attempt
        elif self.strategy == RetryStrategy.EXPONENTIAL:
            delay = self.base_delay * (self.backoff_factor ** (attempt - 1))
        elif self.strategy == RetryStrategy.JITTER:
            base_delay = self.base_delay * (self.backoff_factor ** (attempt - 1))
            delay = base_delay * (0.5 + random.random() * 0.5)
        else:
            delay = self.base_delay
        
        # Apply jitter if enabled
        if self.jitter and self.strategy != RetryStrategy.JITTER:
            jitter_factor = 0.1  # 10% jitter
            jitter = delay * jitter_factor * (random.random() - 0.5)
            delay += jitter
        
        # Cap at max delay
        return min(delay, self.max_delay)


class RetryHandler:
    """Handles retry logic for API calls."""
    
    def __init__(self, config: Optional[RetryConfig] = None):
        """
        Initialize retry handler.
        
        Args:
            config: Retry configuration
        """
        self.config = config or RetryConfig()
    
    async def execute_with_retry(self, func: Callable, *args, **kwargs):
        """
        Execute a function with retry logic.
        
        Args:
            func: Function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function
            
        Returns:
            Function result
            
        Raises:
            Last exception if all retries are exhausted
        """
        last_exception = None
        
        for attempt in range(1, self.config.max_retries + 1):
            try:
                # Execute the function
                result = await func(*args, **kwargs)
                
                # If we get here, the call succeeded
                if attempt > 1:
                    logger.info(f"Function succeeded on attempt {attempt}")
                
                return result
                
            except Exception as e:
                last_exception = e
                
                # Check if we should retry
                if not self.config.should_retry(e, attempt):
                    logger.debug(f"Not retrying exception: {e}")
                    break
                
                # Special handling for rate limit errors
                if isinstance(e, RateLimitError) and e.retry_after:
                    delay = e.retry_after
                    logger.info(f"Rate limited, waiting {delay}s before retry {attempt}")
                else:
                    delay = self.config.get_delay(attempt)
                    logger.info(f"Attempt {attempt} failed: {e}. Retrying in {delay:.2f}s")
                
                # Wait before retry
                await self._sleep(delay)
        
        # All retries exhausted
        logger.error(f"All {self.config.max_retries} retry attempts failed")
        raise last_exception
    
    async def _sleep(self, delay: float) -> None:
        """
        Sleep for specified delay.
        
        Args:
            delay: Delay in seconds
        """
        import asyncio
        await asyncio.sleep(delay)


def retry_on_exception(config: Optional[RetryConfig] = None):
    """
    Decorator for adding retry logic to functions.
    
    Args:
        config: Retry configuration
        
    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        retry_handler = RetryHandler(config)
        
        async def wrapper(*args, **kwargs):
            return await retry_handler.execute_with_retry(func, *args, **kwargs)
        
        return wrapper
    return decorator