"""
Stream-to-Webhook Bridge Service
Transforms streaming results into webhook payloads with plan enforcement and delivery guarantees.
"""

import asyncio
import json
import time
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
import logging
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis

logger = logging.getLogger(__name__)

Base = declarative_base()

class WebhookDeliveryStatus(Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"
    EXHAUSTED = "exhausted"

class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    stream_name = Column(String, nullable=False)
    webhook_url = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    signature = Column(String, nullable=False)
    status = Column(String, default=WebhookDeliveryStatus.PENDING.value)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_attempt_at = Column(DateTime)
    next_retry_at = Column(DateTime)
    delivered_at = Column(DateTime)
    error_message = Column(Text)

@dataclass
class WebhookConfig:
    """Webhook configuration per customer/stream"""
    customer_id: str
    stream_name: str
    webhook_url: str
    secret_key: str
    plan_tier: str
    max_retries: int = 3
    timeout_seconds: int = 30
    batch_size: int = 1
    rate_limit_per_minute: int = 60

@dataclass
class StreamEvent:
    """Standardized stream event format"""
    stream_name: str
    customer_id: str
    event_type: str
    timestamp: datetime
    data: Dict[str, Any]
    source: str  # kafka, redis, websocket
    metadata: Dict[str, Any] = None

class WebhookBridge:
    """
    Stream-to-Webhook Bridge with plan enforcement and delivery guarantees

    Features:
    - Plan-based rate limiting and batching
    - Signature validation (HMAC-SHA256)
    - Retry mechanism with exponential backoff
    - Dead letter queue for failed deliveries
    - Delivery status tracking
    """

    def __init__(self, database_url: str, redis_url: str):
        self.db_engine = create_engine(database_url)
        Base.metadata.create_all(self.db_engine)
        self.SessionLocal = sessionmaker(bind=self.db_engine)

        # Redis for rate limiting and caching
        self.redis = redis.from_url(redis_url)

        # Webhook configurations cache
        self.webhook_configs: Dict[str, WebhookConfig] = {}

        # HTTP client for webhook delivery
        self.http_session: Optional[aiohttp.ClientSession] = None

        # Plan-based limits
        self.plan_limits = {
            'developer': {
                'max_webhooks_per_minute': 10,
                'max_batch_size': 1,
                'max_retries': 1
            },
            'growth': {
                'max_webhooks_per_minute': 60,
                'max_batch_size': 10,
                'max_retries': 3
            },
            'scale': {
                'max_webhooks_per_minute': 300,
                'max_batch_size': 50,
                'max_retries': 5
            }
        }

    async def start(self):
        """Initialize the webhook bridge service"""
        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        logger.info("Webhook Bridge service started")

    async def stop(self):
        """Cleanup resources"""
        if self.http_session:
            await self.http_session.close()
        await self.redis.close()
        logger.info("Webhook Bridge service stopped")

    def register_webhook(self, config: WebhookConfig) -> bool:
        """Register a webhook configuration for a customer/stream"""
        key = f"{config.customer_id}:{config.stream_name}"

        # Apply plan limits
        plan_limits = self.plan_limits.get(config.plan_tier, self.plan_limits['developer'])
        config.max_retries = min(config.max_retries, plan_limits['max_retries'])
        config.rate_limit_per_minute = min(config.rate_limit_per_minute, plan_limits['max_webhooks_per_minute'])
        config.batch_size = min(config.batch_size, plan_limits['max_batch_size'])

        self.webhook_configs[key] = config
        logger.info(f"Registered webhook for {key} with plan {config.plan_tier}")
        return True

    async def process_stream_event(self, event: StreamEvent) -> bool:
        """Process a single stream event and trigger webhook delivery"""
        key = f"{event.customer_id}:{event.stream_name}"

        if key not in self.webhook_configs:
            logger.warning(f"No webhook configured for {key}")
            return False

        config = self.webhook_configs[key]

        # Check rate limiting
        if not await self._check_rate_limit(config):
            logger.warning(f"Rate limit exceeded for {key}")
            return False

        # Transform event to webhook payload
        payload = self._transform_event_to_payload(event)

        # Generate signature
        signature = self._generate_signature(payload, config.secret_key)

        # Create delivery record
        delivery_id = self._generate_delivery_id(event)
        delivery = WebhookDelivery(
            id=delivery_id,
            customer_id=event.customer_id,
            stream_name=event.stream_name,
            webhook_url=config.webhook_url,
            payload=payload,
            signature=signature,
            max_attempts=config.max_retries + 1
        )

        # Save to database
        with self.SessionLocal() as session:
            session.add(delivery)
            session.commit()

        # Attempt immediate delivery
        success = await self._attempt_delivery(delivery, config)

        if not success:
            # Schedule retry
            await self._schedule_retry(delivery)

        return success

    async def process_batch_events(self, events: List[StreamEvent]) -> int:
        """Process multiple events in batch for efficiency"""
        if not events:
            return 0

        # Group events by customer and stream
        grouped_events = {}
        for event in events:
            key = f"{event.customer_id}:{event.stream_name}"
            if key not in grouped_events:
                grouped_events[key] = []
            grouped_events[key].append(event)

        total_processed = 0

        for key, event_group in grouped_events.items():
            if key not in self.webhook_configs:
                continue

            config = self.webhook_configs[key]

            # Apply batch size limits
            batch_size = min(len(event_group), config.batch_size)

            for i in range(0, len(event_group), batch_size):
                batch = event_group[i:i + batch_size]

                if await self._process_event_batch(batch, config):
                    total_processed += len(batch)

        return total_processed

    async def _process_event_batch(self, events: List[StreamEvent], config: WebhookConfig) -> bool:
        """Process a batch of events for a single webhook"""
        if not await self._check_rate_limit(config):
            return False

        # Transform batch to payload
        payload = {
            'events': [self._transform_event_to_payload(event) for event in events],
            'batch_size': len(events),
            'timestamp': datetime.utcnow().isoformat()
        }

        signature = self._generate_signature(payload, config.secret_key)

        # Create delivery record
        delivery_id = f"batch_{int(time.time() * 1000)}_{config.customer_id}"
        delivery = WebhookDelivery(
            id=delivery_id,
            customer_id=config.customer_id,
            stream_name=config.stream_name,
            webhook_url=config.webhook_url,
            payload=payload,
            signature=signature,
            max_attempts=config.max_retries + 1
        )

        with self.SessionLocal() as session:
            session.add(delivery)
            session.commit()

        return await self._attempt_delivery(delivery, config)

    def _transform_event_to_payload(self, event: StreamEvent) -> Dict[str, Any]:
        """Transform StreamEvent to webhook payload format"""
        return {
            'id': self._generate_delivery_id(event),
            'stream_name': event.stream_name,
            'event_type': event.event_type,
            'timestamp': event.timestamp.isoformat(),
            'data': event.data,
            'source': event.source,
            'metadata': event.metadata or {}
        }

    def _generate_signature(self, payload: Dict[str, Any], secret: str) -> str:
        """Generate HMAC-SHA256 signature for webhook payload"""
        payload_bytes = json.dumps(payload, sort_keys=True).encode('utf-8')
        signature = hmac.new(
            secret.encode('utf-8'),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"

    def _generate_delivery_id(self, event: StreamEvent) -> str:
        """Generate unique delivery ID"""
        content = f"{event.customer_id}:{event.stream_name}:{event.timestamp.isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()

    async def _check_rate_limit(self, config: WebhookConfig) -> bool:
        """Check if webhook delivery is within rate limits"""
        key = f"webhook_rate:{config.customer_id}:{config.stream_name}"

        # Get current count
        current = await self.redis.get(key)
        current_count = int(current) if current else 0

        if current_count >= config.rate_limit_per_minute:
            return False

        # Increment counter with 60-second expiry
        await self.redis.incr(key)
        await self.redis.expire(key, 60)

        return True

    async def _attempt_delivery(self, delivery: WebhookDelivery, config: WebhookConfig) -> bool:
        """Attempt to deliver webhook payload"""
        try:
            headers = {
                'Content-Type': 'application/json',
                'X-Schlep-Signature': delivery.signature,
                'X-Schlep-Delivery': delivery.id,
                'X-Schlep-Timestamp': str(int(time.time())),
                'User-Agent': 'Schlep-Engine-Webhook/1.0'
            }

            async with self.http_session.post(
                delivery.webhook_url,
                json=delivery.payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=config.timeout_seconds)
            ) as response:
                delivery.attempts += 1
                delivery.last_attempt_at = datetime.utcnow()

                if 200 <= response.status < 300:
                    delivery.status = WebhookDeliveryStatus.DELIVERED.value
                    delivery.delivered_at = datetime.utcnow()

                    with self.SessionLocal() as session:
                        session.merge(delivery)
                        session.commit()

                    logger.info(f"Webhook delivered successfully: {delivery.id}")
                    return True
                else:
                    error_text = await response.text()
                    delivery.error_message = f"HTTP {response.status}: {error_text}"
                    delivery.status = WebhookDeliveryStatus.FAILED.value

                    with self.SessionLocal() as session:
                        session.merge(delivery)
                        session.commit()

                    logger.warning(f"Webhook delivery failed: {delivery.id} - {delivery.error_message}")
                    return False

        except asyncio.TimeoutError:
            delivery.attempts += 1
            delivery.last_attempt_at = datetime.utcnow()
            delivery.error_message = "Request timeout"
            delivery.status = WebhookDeliveryStatus.FAILED.value

        except Exception as e:
            delivery.attempts += 1
            delivery.last_attempt_at = datetime.utcnow()
            delivery.error_message = str(e)
            delivery.status = WebhookDeliveryStatus.FAILED.value

        with self.SessionLocal() as session:
            session.merge(delivery)
            session.commit()

        return False

    async def _schedule_retry(self, delivery: WebhookDelivery):
        """Schedule webhook retry with exponential backoff"""
        if delivery.attempts >= delivery.max_attempts:
            delivery.status = WebhookDeliveryStatus.EXHAUSTED.value
            with self.SessionLocal() as session:
                session.merge(delivery)
                session.commit()
            logger.error(f"Webhook delivery exhausted: {delivery.id}")
            return

        # Exponential backoff: 2^attempt minutes
        backoff_minutes = 2 ** delivery.attempts
        delivery.next_retry_at = datetime.utcnow() + timedelta(minutes=backoff_minutes)
        delivery.status = WebhookDeliveryStatus.RETRYING.value

        with self.SessionLocal() as session:
            session.merge(delivery)
            session.commit()

        logger.info(f"Scheduled retry for {delivery.id} in {backoff_minutes} minutes")

    async def process_retries(self):
        """Process pending webhook retries (run in background task)"""
        while True:
            try:
                with self.SessionLocal() as session:
                    pending_retries = session.query(WebhookDelivery).filter(
                        WebhookDelivery.status == WebhookDeliveryStatus.RETRYING.value,
                        WebhookDelivery.next_retry_at <= datetime.utcnow()
                    ).limit(100).all()

                for delivery in pending_retries:
                    key = f"{delivery.customer_id}:{delivery.stream_name}"
                    if key in self.webhook_configs:
                        config = self.webhook_configs[key]
                        success = await self._attempt_delivery(delivery, config)

                        if not success and delivery.attempts < delivery.max_attempts:
                            await self._schedule_retry(delivery)

                # Sleep for 30 seconds before next retry batch
                await asyncio.sleep(30)

            except Exception as e:
                logger.error(f"Error processing retries: {e}")
                await asyncio.sleep(60)

# Integration helper for stream processors
class StreamWebhookProcessor:
    """Helper class to integrate webhook bridge with existing stream processors"""

    def __init__(self, webhook_bridge: WebhookBridge):
        self.webhook_bridge = webhook_bridge

    def create_kafka_processor(self, customer_id: str, stream_name: str) -> Callable:
        """Create a Kafka message processor that forwards to webhooks"""
        async def processor(messages: List[Dict]):
            events = []
            for msg in messages:
                event = StreamEvent(
                    stream_name=stream_name,
                    customer_id=customer_id,
                    event_type=msg.get('event_type', 'data'),
                    timestamp=datetime.utcnow(),
                    data=msg,
                    source='kafka'
                )
                events.append(event)

            return await self.webhook_bridge.process_batch_events(events)

        return processor

    def create_redis_processor(self, customer_id: str, stream_name: str) -> Callable:
        """Create a Redis stream processor that forwards to webhooks"""
        async def processor(messages: List[Dict]):
            events = []
            for msg in messages:
                event = StreamEvent(
                    stream_name=stream_name,
                    customer_id=customer_id,
                    event_type=msg.get('event_type', 'data'),
                    timestamp=datetime.utcnow(),
                    data=msg,
                    source='redis'
                )
                events.append(event)

            return await self.webhook_bridge.process_batch_events(events)

        return processor

    def create_websocket_processor(self, customer_id: str, stream_name: str) -> Callable:
        """Create a WebSocket message processor that forwards to webhooks"""
        async def processor(message: Dict):
            event = StreamEvent(
                stream_name=stream_name,
                customer_id=customer_id,
                event_type=message.get('event_type', 'data'),
                timestamp=datetime.utcnow(),
                data=message,
                source='websocket'
            )

            return await self.webhook_bridge.process_stream_event(event)

        return processor