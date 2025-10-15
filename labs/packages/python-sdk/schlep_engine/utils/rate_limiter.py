"""
Advanced rate limiting and request queuing for Schlep-engine SDK
"""

import asyncio
import time
import logging
from typing import Optional, Dict, Any, Callable, Awaitable
from dataclasses import dataclass, field
from collections import deque
from contextlib import asynccontextmanager

from ..exceptions.base import RateLimitError


logger = logging.getLogger(__name__)


@dataclass
class RateLimitInfo:
    """Information about current rate limiting status."""
    
    requests_per_second: float = 10.0
    requests_per_minute: int = 600
    requests_per_hour: int = 3600
    current_usage: int = 0
    reset_time: Optional[float] = None
    retry_after: Optional[int] = None


@dataclass 
class QueuedRequest:
    """A queued request waiting for rate limit clearance."""
    
    func: Callable[[], Awaitable[Any]]
    future: asyncio.Future
    priority: int = 0
    created_at: float = field(default_factory=time.time)


class AdaptiveRateLimiter:
    """
    Adaptive rate limiter that queues requests and respects server rate limits.
    """
    
    def __init__(
        self,
        initial_rps: float = 10.0,
        max_queue_size: int = 1000,
        auto_adjust: bool = True
    ):
        """
        Initialize the rate limiter.
        
        Args:
            initial_rps: Initial requests per second limit
            max_queue_size: Maximum size of request queue
            auto_adjust: Whether to automatically adjust limits based on server responses
        """
        self.rate_limit_info = RateLimitInfo(requests_per_second=initial_rps)
        self.max_queue_size = max_queue_size
        self.auto_adjust = auto_adjust
        
        # Request tracking
        self.request_times: deque = deque(maxlen=1000)
        self.request_queue: deque = deque()
        self.is_rate_limited = False
        self.rate_limit_until = 0.0
        
        # Processing control
        self._queue_processor_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        
        logger.info(f"Initialized rate limiter with {initial_rps} RPS limit")
    
    async def execute_request(
        self,
        request_func: Callable[[], Awaitable[Any]],
        priority: int = 0
    ) -> Any:
        """
        Execute a request through the rate limiter.
        
        Args:
            request_func: Async function that makes the request
            priority: Request priority (higher = more important)
            
        Returns:
            Result from the request function
            
        Raises:
            RateLimitError: If queue is full or other rate limit issues
        """
        # Check if we can execute immediately
        if await self._can_execute_now():
            try:
                result = await self._execute_and_track(request_func)
                return result
            except RateLimitError as e:
                # If we get rate limited, update our info and queue the request
                await self._handle_rate_limit_response(e)
                # Fall through to queuing logic
        
        # Queue the request
        if len(self.request_queue) >= self.max_queue_size:
            raise RateLimitError("Request queue is full")
        
        future = asyncio.Future()
        queued_request = QueuedRequest(
            func=request_func,
            future=future,
            priority=priority
        )
        
        async with self._lock:
            # Insert based on priority
            inserted = False
            for i, existing_request in enumerate(self.request_queue):
                if priority > existing_request.priority:
                    self.request_queue.insert(i, queued_request)
                    inserted = True
                    break
            
            if not inserted:
                self.request_queue.append(queued_request)
        
        # Start queue processor if not running
        if not self._queue_processor_task or self._queue_processor_task.done():
            self._queue_processor_task = asyncio.create_task(self._process_queue())
        
        logger.debug(f"Queued request (priority: {priority}, queue size: {len(self.request_queue)})")
        
        # Wait for the request to be processed
        return await future
    
    async def _can_execute_now(self) -> bool:
        """Check if we can execute a request immediately."""
        current_time = time.time()
        
        # Check if we're currently rate limited
        if self.is_rate_limited and current_time < self.rate_limit_until:
            return False
        elif self.is_rate_limited and current_time >= self.rate_limit_until:
            # Rate limit period has ended
            self.is_rate_limited = False
            self.rate_limit_until = 0.0
            logger.info("Rate limit period has ended")
        
        # Check current request rate
        return self._check_current_rate()
    
    def _check_current_rate(self) -> bool:
        """Check if current request rate is within limits."""
        current_time = time.time()
        
        # Clean old request times
        while self.request_times and current_time - self.request_times[0] > 60:
            self.request_times.popleft()
        
        # Check requests per second
        recent_requests = sum(
            1 for req_time in self.request_times
            if current_time - req_time <= 1.0
        )
        
        if recent_requests >= self.rate_limit_info.requests_per_second:
            return False
        
        # Check requests per minute
        if len(self.request_times) >= self.rate_limit_info.requests_per_minute:
            return False
        
        return True
    
    async def _execute_and_track(self, request_func: Callable[[], Awaitable[Any]]) -> Any:
        """Execute request and track timing."""
        start_time = time.time()
        
        try:
            result = await request_func()
            
            # Track successful request
            self.request_times.append(start_time)
            
            return result
            
        except RateLimitError:
            # Don't track rate-limited requests
            raise
        except Exception:
            # Track failed requests too (they still count against rate limit)
            self.request_times.append(start_time)
            raise
    
    async def _handle_rate_limit_response(self, rate_limit_error: RateLimitError) -> None:
        """Handle rate limit response and update limits."""
        current_time = time.time()
        
        if rate_limit_error.retry_after:
            self.rate_limit_until = current_time + rate_limit_error.retry_after
            self.is_rate_limited = True
            logger.warning(f"Rate limited until {self.rate_limit_until} ({rate_limit_error.retry_after}s)")
        else:
            # Default backoff if no retry-after header
            self.rate_limit_until = current_time + 60  # 1 minute default
            self.is_rate_limited = True
            logger.warning("Rate limited with no retry-after, backing off for 60s")
        
        # Adjust rate limits if auto-adjustment is enabled
        if self.auto_adjust:
            old_rps = self.rate_limit_info.requests_per_second
            self.rate_limit_info.requests_per_second *= 0.5  # Reduce by half
            self.rate_limit_info.requests_per_second = max(0.1, self.rate_limit_info.requests_per_second)
            logger.info(f"Adjusted rate limit from {old_rps} to {self.rate_limit_info.requests_per_second} RPS")
    
    async def _process_queue(self) -> None:
        """Process queued requests when rate limits allow."""
        logger.debug("Started queue processor")
        
        while self.request_queue or self.is_rate_limited:
            try:
                # Wait if we're rate limited
                if self.is_rate_limited:
                    wait_time = self.rate_limit_until - time.time()
                    if wait_time > 0:
                        await asyncio.sleep(min(wait_time, 1.0))
                        continue
                    else:
                        self.is_rate_limited = False
                        self.rate_limit_until = 0.0
                
                # Check if we can process requests
                if not await self._can_execute_now():
                    await asyncio.sleep(0.1)
                    continue
                
                # Get next request from queue
                async with self._lock:
                    if not self.request_queue:
                        break
                    queued_request = self.request_queue.popleft()
                
                # Execute the request
                try:
                    result = await self._execute_and_track(queued_request.func)
                    queued_request.future.set_result(result)
                    
                except RateLimitError as e:
                    # Handle rate limit and re-queue
                    await self._handle_rate_limit_response(e)
                    async with self._lock:
                        self.request_queue.appendleft(queued_request)
                    
                except Exception as e:
                    # Other exceptions
                    queued_request.future.set_exception(e)
                
                # Small delay between requests
                await asyncio.sleep(1.0 / self.rate_limit_info.requests_per_second)
                
            except asyncio.CancelledError:
                logger.debug("Queue processor cancelled")
                break
            except Exception as e:
                logger.error(f"Error in queue processor: {e}")
                await asyncio.sleep(1.0)
        
        logger.debug("Queue processor finished")
    
    def update_rate_limits(self, headers: Dict[str, str]) -> None:
        """
        Update rate limit information from API response headers.
        
        Args:
            headers: Response headers from API
        """
        # Common rate limit headers
        limit_headers = [
            'X-RateLimit-Limit',
            'X-Rate-Limit-Limit', 
            'RateLimit-Limit',
            'Rate-Limit-Limit'
        ]
        
        remaining_headers = [
            'X-RateLimit-Remaining',
            'X-Rate-Limit-Remaining',
            'RateLimit-Remaining', 
            'Rate-Limit-Remaining'
        ]
        
        reset_headers = [
            'X-RateLimit-Reset',
            'X-Rate-Limit-Reset',
            'RateLimit-Reset',
            'Rate-Limit-Reset'
        ]
        
        # Extract rate limit information
        for header in limit_headers:
            if header in headers:
                try:
                    limit = int(headers[header])
                    self.rate_limit_info.requests_per_minute = limit
                    break
                except ValueError:
                    pass
        
        for header in remaining_headers:
            if header in headers:
                try:
                    remaining = int(headers[header])
                    self.rate_limit_info.current_usage = (
                        self.rate_limit_info.requests_per_minute - remaining
                    )
                    break
                except ValueError:
                    pass
        
        for header in reset_headers:
            if header in headers:
                try:
                    reset_time = float(headers[header])
                    self.rate_limit_info.reset_time = reset_time
                    break
                except ValueError:
                    pass
    
    async def close(self) -> None:
        """Clean up resources."""
        if self._queue_processor_task and not self._queue_processor_task.done():
            self._queue_processor_task.cancel()
            try:
                await self._queue_processor_task
            except asyncio.CancelledError:
                pass
        
        # Cancel any pending requests
        async with self._lock:
            while self.request_queue:
                queued_request = self.request_queue.popleft()
                if not queued_request.future.done():
                    queued_request.future.cancel()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current rate limiter statistics."""
        current_time = time.time()
        
        # Count recent requests
        recent_1s = sum(
            1 for req_time in self.request_times
            if current_time - req_time <= 1.0
        )
        recent_1m = len(self.request_times)
        
        return {
            "rate_limit": self.rate_limit_info,
            "queue_size": len(self.request_queue),
            "is_rate_limited": self.is_rate_limited,
            "rate_limit_until": self.rate_limit_until,
            "recent_requests_1s": recent_1s,
            "recent_requests_1m": recent_1m,
            "current_rps": self.rate_limit_info.requests_per_second
        }


@asynccontextmanager
async def rate_limited_session(limiter: AdaptiveRateLimiter):
    """
    Async context manager for rate limited sessions.
    
    Args:
        limiter: Rate limiter instance
    """
    try:
        yield limiter
    finally:
        await limiter.close()