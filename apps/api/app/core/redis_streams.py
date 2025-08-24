"""
Redis Streams Client for Real-Time Data Processing
==================================================

Comprehensive Redis Streams implementation for handling:
- IoT sensor data streams
- Financial transaction streams  
- E-commerce event streams
- Real-time data pipeline orchestration
- Event sourcing and replay capabilities
- Stream processing coordination

Features:
- High-performance stream producers and consumers
- Automatic error handling and recovery
- Consumer group management
- Stream monitoring and metrics
- Event replay and recovery mechanisms
- Circuit breaker pattern for reliability
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, AsyncGenerator, Callable, Union
from enum import Enum
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager

import redis.asyncio as redis
from app.core.unified_config import settings

logger = logging.getLogger(__name__)

class StreamType(Enum):
    """Types of data streams"""
    IOT_SENSORS = "iot_sensors"
    FINANCIAL_TRANSACTIONS = "financial_transactions"
    ECOMMERCE_EVENTS = "ecommerce_events"
    SYSTEM_EVENTS = "system_events"
    USER_ACTIVITY = "user_activity"
    ML_PIPELINE = "ml_pipeline"

class EventType(Enum):
    """Types of events within streams"""
    # IoT Events
    SENSOR_READING = "sensor_reading"
    DEVICE_STATUS = "device_status"
    ALERT = "alert"
    
    # Financial Events
    TRANSACTION = "transaction"
    FRAUD_DETECTED = "fraud_detected"
    RISK_SCORE_UPDATED = "risk_score_updated"
    
    # E-commerce Events
    USER_VIEW = "user_view"
    ADD_TO_CART = "add_to_cart"
    PURCHASE = "purchase"
    RECOMMENDATION = "recommendation"
    
    # System Events
    PIPELINE_STARTED = "pipeline_started"
    PIPELINE_COMPLETED = "pipeline_completed"
    PIPELINE_FAILED = "pipeline_failed"
    HEALTH_CHECK = "health_check"

@dataclass
class StreamMessage:
    """Structure for stream messages"""
    id: str
    stream_type: StreamType
    event_type: EventType
    data: Dict[str, Any]
    timestamp: str
    source: str
    correlation_id: Optional[str] = None
    metadata: Dict[str, Any] = None

@dataclass
class ConsumerConfig:
    """Configuration for stream consumers"""
    consumer_group: str
    consumer_name: str
    stream_name: str
    batch_size: int = 10
    block_time: int = 1000  # milliseconds
    max_retries: int = 3
    retry_delay: int = 5  # seconds
    dead_letter_enabled: bool = True

class StreamMetrics:
    """Metrics tracking for streams"""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.messages_produced = 0
        self.messages_consumed = 0
        self.messages_failed = 0
        self.messages_retried = 0
        self.consumer_lag = 0
        self.processing_time_avg = 0.0
        self.error_rate = 0.0
        self.throughput = 0.0
        self.last_reset = time.time()
    
    def record_produced(self):
        self.messages_produced += 1
    
    def record_consumed(self, processing_time: float):
        self.messages_consumed += 1
        # Update rolling average
        self.processing_time_avg = (
            self.processing_time_avg * (self.messages_consumed - 1) + processing_time
        ) / self.messages_consumed
    
    def record_failed(self):
        self.messages_failed += 1
    
    def record_retried(self):
        self.messages_retried += 1
    
    def calculate_rates(self):
        """Calculate error rate and throughput"""
        total_processed = self.messages_consumed + self.messages_failed
        if total_processed > 0:
            self.error_rate = self.messages_failed / total_processed
        
        time_elapsed = time.time() - self.last_reset
        if time_elapsed > 0:
            self.throughput = self.messages_consumed / time_elapsed
    
    def get_summary(self) -> Dict[str, Any]:
        self.calculate_rates()
        return {
            "messages_produced": self.messages_produced,
            "messages_consumed": self.messages_consumed,
            "messages_failed": self.messages_failed,
            "messages_retried": self.messages_retried,
            "consumer_lag": self.consumer_lag,
            "processing_time_avg": self.processing_time_avg,
            "error_rate": self.error_rate,
            "throughput": self.throughput,
        }

class RedisStreamsClient:
    """High-performance Redis Streams client with comprehensive features"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.redis_client: Optional[redis.Redis] = None
        self.metrics = StreamMetrics()
        self.consumer_tasks: Dict[str, asyncio.Task] = {}
        self.message_handlers: Dict[str, Callable] = {}
        self.circuit_breaker_state = {"closed": True, "failure_count": 0, "last_failure": 0}
        self.max_failures = 5
        self.circuit_breaker_timeout = 60  # seconds
        
    async def connect(self):
        """Initialize Redis connection with optimized settings"""
        try:
            # Create connection pool first
            pool = redis.ConnectionPool.from_url(
                self.redis_url,
                max_connections=100,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            
            self.redis_client = redis.Redis(
                connection_pool=pool,
                encoding="utf-8",
                decode_responses=True,
                health_check_interval=30
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis Streams client connected successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self):
        """Gracefully disconnect and cleanup"""
        # Stop all consumer tasks
        for task in self.consumer_tasks.values():
            task.cancel()
        
        # Wait for tasks to complete
        if self.consumer_tasks:
            await asyncio.gather(*self.consumer_tasks.values(), return_exceptions=True)
        
        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()
            
        logger.info("Redis Streams client disconnected")

    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker allows operation"""
        now = time.time()
        
        # If circuit is open, check if enough time has passed to try again
        if not self.circuit_breaker_state["closed"]:
            if now - self.circuit_breaker_state["last_failure"] > self.circuit_breaker_timeout:
                self.circuit_breaker_state["closed"] = True
                self.circuit_breaker_state["failure_count"] = 0
                logger.info("Circuit breaker reset to closed state")
        
        return self.circuit_breaker_state["closed"]

    def _record_failure(self):
        """Record a failure for circuit breaker"""
        self.circuit_breaker_state["failure_count"] += 1
        self.circuit_breaker_state["last_failure"] = time.time()
        
        if self.circuit_breaker_state["failure_count"] >= self.max_failures:
            self.circuit_breaker_state["closed"] = False
            logger.warning(f"Circuit breaker opened due to {self.max_failures} failures")

    async def produce_message(
        self,
        stream_name: str,
        event_type: EventType,
        data: Dict[str, Any],
        source: str = "system",
        correlation_id: str = None
    ) -> str:
        """
        Produce a message to a stream with automatic error handling
        
        Args:
            stream_name: Name of the stream
            event_type: Type of event
            data: Event data payload
            source: Source system/service identifier
            correlation_id: Optional correlation ID for tracing
            
        Returns:
            Message ID from Redis
        """
        
        if not self._check_circuit_breaker():
            raise Exception("Circuit breaker is open - stream unavailable")
        
        try:
            message = StreamMessage(
                id=str(uuid.uuid4()),
                stream_type=StreamType(stream_name) if stream_name in [s.value for s in StreamType] else StreamType.SYSTEM_EVENTS,
                event_type=event_type,
                data=data,
                timestamp=datetime.utcnow().isoformat(),
                source=source,
                correlation_id=correlation_id,
                metadata={"producer": "redis_streams_client", "version": "1.0"}
            )
            
            # Serialize message for Redis
            message_data = {
                "event_type": event_type.value,
                "data": json.dumps(data),
                "timestamp": message.timestamp,
                "source": source,
                "correlation_id": correlation_id or "",
                "metadata": json.dumps(message.metadata or {})
            }
            
            # Add to stream with automatic ID generation
            stream_id = await self.redis_client.xadd(stream_name, message_data)
            
            # Update metrics
            self.metrics.record_produced()
            
            logger.debug(f"Produced message {stream_id} to stream {stream_name}")
            return stream_id
            
        except Exception as e:
            self._record_failure()
            self.metrics.record_failed()
            logger.error(f"Failed to produce message to stream {stream_name}: {e}")
            raise

    async def consume_messages(
        self,
        config: ConsumerConfig,
        handler: Callable[[StreamMessage], Any]
    ) -> None:
        """
        Start consuming messages from a stream with a handler function
        
        Args:
            config: Consumer configuration
            handler: Async function to process messages
        """
        
        consumer_id = f"{config.consumer_group}:{config.consumer_name}"
        
        try:
            # Create consumer group if it doesn't exist
            try:
                await self.redis_client.xgroup_create(
                    config.stream_name,
                    config.consumer_group,
                    id="0",
                    mkstream=True
                )
                logger.info(f"Created consumer group {config.consumer_group} for stream {config.stream_name}")
            except redis.exceptions.ResponseError as e:
                if "BUSYGROUP" not in str(e):
                    raise
                # Group already exists, continue
            
            # Start consuming task
            task = asyncio.create_task(
                self._consume_loop(config, handler)
            )
            
            self.consumer_tasks[consumer_id] = task
            logger.info(f"Started consumer {consumer_id} for stream {config.stream_name}")
            
        except Exception as e:
            logger.error(f"Failed to start consumer {consumer_id}: {e}")
            raise

    async def _consume_loop(
        self,
        config: ConsumerConfig,
        handler: Callable[[StreamMessage], Any]
    ) -> None:
        """Main consumer loop with error handling and retry logic"""
        
        retry_count = 0
        
        while True:
            try:
                if not self._check_circuit_breaker():
                    logger.warning(f"Circuit breaker open for consumer {config.consumer_name}")
                    await asyncio.sleep(self.circuit_breaker_timeout)
                    continue
                
                # Read messages from stream
                messages = await self.redis_client.xreadgroup(
                    config.consumer_group,
                    config.consumer_name,
                    {config.stream_name: ">"},
                    count=config.batch_size,
                    block=config.block_time
                )
                
                # Process messages
                for stream_name, stream_messages in messages:
                    for message_id, fields in stream_messages:
                        start_time = time.time()
                        
                        try:
                            # Parse message
                            stream_message = self._parse_message(message_id, fields)
                            
                            # Call handler
                            await handler(stream_message)
                            
                            # Acknowledge message
                            await self.redis_client.xack(
                                config.stream_name,
                                config.consumer_group,
                                message_id
                            )
                            
                            # Update metrics
                            processing_time = time.time() - start_time
                            self.metrics.record_consumed(processing_time)
                            
                            # Reset retry count on successful processing
                            retry_count = 0
                            
                        except Exception as e:
                            logger.error(f"Error processing message {message_id}: {e}")
                            self.metrics.record_failed()
                            
                            # Handle retries
                            if retry_count < config.max_retries:
                                retry_count += 1
                                self.metrics.record_retried()
                                logger.info(f"Retrying message {message_id} (attempt {retry_count})")
                                await asyncio.sleep(config.retry_delay)
                            else:
                                # Send to dead letter queue if enabled
                                if config.dead_letter_enabled:
                                    await self._send_to_dead_letter(
                                        config.stream_name,
                                        message_id,
                                        fields,
                                        str(e)
                                    )
                                
                                # Acknowledge to prevent reprocessing
                                await self.redis_client.xack(
                                    config.stream_name,
                                    config.consumer_group,
                                    message_id
                                )
                                
                                retry_count = 0

            except asyncio.CancelledError:
                logger.info(f"Consumer {config.consumer_name} cancelled")
                break
                
            except Exception as e:
                self._record_failure()
                logger.error(f"Consumer loop error for {config.consumer_name}: {e}")
                await asyncio.sleep(5)  # Brief pause before retrying

    def _parse_message(self, message_id: str, fields: Dict[str, str]) -> StreamMessage:
        """Parse Redis stream message into StreamMessage object"""
        
        try:
            return StreamMessage(
                id=message_id,
                stream_type=StreamType.SYSTEM_EVENTS,  # Default, can be enhanced
                event_type=EventType(fields.get("event_type", "health_check")),
                data=json.loads(fields.get("data", "{}")),
                timestamp=fields.get("timestamp", ""),
                source=fields.get("source", "unknown"),
                correlation_id=fields.get("correlation_id") or None,
                metadata=json.loads(fields.get("metadata", "{}"))
            )
        except Exception as e:
            logger.warning(f"Failed to parse message {message_id}: {e}")
            # Return basic message structure
            return StreamMessage(
                id=message_id,
                stream_type=StreamType.SYSTEM_EVENTS,
                event_type=EventType.HEALTH_CHECK,
                data=fields,
                timestamp=datetime.utcnow().isoformat(),
                source="unknown"
            )

    async def _send_to_dead_letter(
        self,
        original_stream: str,
        message_id: str,
        fields: Dict[str, str],
        error: str
    ):
        """Send failed message to dead letter queue"""
        
        dead_letter_stream = f"{original_stream}:dead_letter"
        
        try:
            dead_letter_data = {
                **fields,
                "original_stream": original_stream,
                "original_message_id": message_id,
                "error": error,
                "failed_at": datetime.utcnow().isoformat()
            }
            
            await self.redis_client.xadd(dead_letter_stream, dead_letter_data)
            logger.info(f"Sent message {message_id} to dead letter queue: {dead_letter_stream}")
            
        except Exception as e:
            logger.error(f"Failed to send message to dead letter queue: {e}")

    async def get_stream_info(self, stream_name: str) -> Dict[str, Any]:
        """Get comprehensive stream information"""
        
        try:
            info = await self.redis_client.xinfo_stream(stream_name)
            groups = await self.redis_client.xinfo_groups(stream_name)
            
            return {
                "stream_name": stream_name,
                "length": info.get("length", 0),
                "first_entry": info.get("first-entry"),
                "last_entry": info.get("last-entry"),
                "consumer_groups": [
                    {
                        "name": group.get("name"),
                        "consumers": group.get("consumers"),
                        "pending": group.get("pending"),
                        "last_delivered": group.get("last-delivered-id")
                    }
                    for group in groups
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get stream info for {stream_name}: {e}")
            return {"error": str(e)}

    async def replay_messages(
        self,
        stream_name: str,
        start_id: str = "0",
        end_id: str = "+",
        count: int = 100
    ) -> AsyncGenerator[StreamMessage, None]:
        """
        Replay messages from a stream for recovery or analysis
        
        Args:
            stream_name: Name of the stream
            start_id: Starting message ID (default: beginning)
            end_id: Ending message ID (default: current end)
            count: Maximum number of messages to read at once
        """
        
        try:
            current_id = start_id
            
            while True:
                # Read messages from current position
                messages = await self.redis_client.xrange(
                    stream_name,
                    min=current_id,
                    max=end_id,
                    count=count
                )
                
                if not messages:
                    break
                
                for message_id, fields in messages:
                    yield self._parse_message(message_id, fields)
                    current_id = message_id
                
                # If we got fewer messages than requested, we've reached the end
                if len(messages) < count:
                    break
                    
        except Exception as e:
            logger.error(f"Error during message replay for stream {stream_name}: {e}")
            raise

    async def trim_stream(self, stream_name: str, max_len: int = 10000):
        """Trim stream to maintain manageable size"""
        
        try:
            trimmed = await self.redis_client.xtrim(
                stream_name,
                maxlen=max_len,
                approximate=True
            )
            logger.info(f"Trimmed {trimmed} messages from stream {stream_name}")
            return trimmed
            
        except Exception as e:
            logger.error(f"Failed to trim stream {stream_name}: {e}")
            return 0

    def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive metrics for the streams client"""
        
        return {
            "stream_metrics": self.metrics.get_summary(),
            "circuit_breaker": self.circuit_breaker_state,
            "active_consumers": len(self.consumer_tasks),
            "connected": self.redis_client is not None
        }

    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        
        try:
            # Test Redis connection
            await self.redis_client.ping()
            
            # Get Redis info
            info = await self.redis_client.info()
            
            return {
                "status": "healthy",
                "redis_connected": True,
                "redis_memory": info.get("used_memory_human"),
                "redis_clients": info.get("connected_clients"),
                "circuit_breaker_open": not self.circuit_breaker_state["closed"],
                "active_consumers": len(self.consumer_tasks),
                "metrics": self.get_metrics()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "redis_connected": False
            }

# Global streams client instance
streams_client: Optional[RedisStreamsClient] = None

async def get_streams_client() -> RedisStreamsClient:
    """Get or create the global streams client"""
    global streams_client
    
    if streams_client is None:
        streams_client = RedisStreamsClient()
        await streams_client.connect()
    
    return streams_client

@asynccontextmanager
async def streams_client_context():
    """Context manager for streams client lifecycle"""
    client = await get_streams_client()
    try:
        yield client
    finally:
        # Client cleanup is handled by the application shutdown
        pass