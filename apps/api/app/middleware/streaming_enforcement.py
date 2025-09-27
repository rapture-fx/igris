"""
Streaming Plan Enforcement Middleware
Enforces connection limits, throughput limits, and feature access based on subscription plans.
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass
from enum import Enum
import redis.asyncio as redis
from fastapi import HTTPException
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger(__name__)

Base = declarative_base()

class StreamingPlan(str, Enum):
    """Streaming subscription plans"""
    DEVELOPER = "developer"
    GROWTH = "growth"
    SCALE = "scale"

class StreamConnectionStatus(str, Enum):
    """Stream connection status"""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    THROTTLED = "throttled"
    TERMINATED = "terminated"

class StreamConnection(Base):
    """Track active streaming connections per customer"""
    __tablename__ = "stream_connections"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    stream_name = Column(String, nullable=False)
    stream_type = Column(String, nullable=False)  # kafka, redis, websocket
    plan_tier = Column(String, nullable=False)
    status = Column(String, default=StreamConnectionStatus.ACTIVE.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    bytes_processed = Column(Integer, default=0)
    messages_processed = Column(Integer, default=0)
    webhooks_sent = Column(Integer, default=0)
    metadata = Column(JSON)

class StreamingUsage(Base):
    """Track streaming usage metrics"""
    __tablename__ = "streaming_usage"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    plan_tier = Column(String, nullable=False)
    total_connections = Column(Integer, default=0)
    peak_connections = Column(Integer, default=0)
    bytes_processed = Column(Integer, default=0)
    messages_processed = Column(Integer, default=0)
    webhooks_sent = Column(Integer, default=0)
    throttle_events = Column(Integer, default=0)
    connection_rejections = Column(Integer, default=0)

@dataclass
class StreamingLimits:
    """Streaming limits per plan"""
    max_connections: int
    max_throughput_mbps: float
    max_webhooks_per_minute: int
    max_batch_size: int
    max_message_size_kb: int
    webhook_retry_attempts: int
    connection_timeout_minutes: int
    allowed_protocols: Set[str]

class StreamingEnforcement:
    """
    Streaming Plan Enforcement System

    Features:
    - Connection count limits per plan
    - Throughput throttling
    - Webhook rate limiting
    - Protocol restrictions
    - Usage tracking and alerting
    """

    def __init__(self, database_url: str, redis_url: str):
        self.db_engine = create_engine(database_url)
        Base.metadata.create_all(self.db_engine)
        self.SessionLocal = sessionmaker(bind=self.db_engine)

        # Redis for real-time rate limiting and metrics
        self.redis = redis.from_url(redis_url)

        # Plan-based streaming limits
        self.plan_limits = {
            StreamingPlan.DEVELOPER: StreamingLimits(
                max_connections=2,
                max_throughput_mbps=1.0,
                max_webhooks_per_minute=10,
                max_batch_size=1,
                max_message_size_kb=100,
                webhook_retry_attempts=1,
                connection_timeout_minutes=60,
                allowed_protocols={'websocket'}
            ),
            StreamingPlan.GROWTH: StreamingLimits(
                max_connections=10,
                max_throughput_mbps=10.0,
                max_webhooks_per_minute=60,
                max_batch_size=10,
                max_message_size_kb=500,
                webhook_retry_attempts=3,
                connection_timeout_minutes=240,
                allowed_protocols={'websocket', 'kafka', 'redis'}
            ),
            StreamingPlan.SCALE: StreamingLimits(
                max_connections=100,
                max_throughput_mbps=100.0,
                max_webhooks_per_minute=300,
                max_batch_size=50,
                max_message_size_kb=1000,
                webhook_retry_attempts=5,
                connection_timeout_minutes=1440,  # 24 hours
                allowed_protocols={'websocket', 'kafka', 'redis', 'mqtt'}
            )
        }

        # Active connections cache
        self.active_connections: Dict[str, Dict] = {}

    async def check_connection_limit(self, customer_id: str, plan_tier: str, stream_type: str) -> bool:
        """Check if customer can create a new streaming connection"""
        plan = StreamingPlan(plan_tier)
        limits = self.plan_limits[plan]

        # Check protocol allowance
        if stream_type not in limits.allowed_protocols:
            logger.warning(f"Protocol {stream_type} not allowed for plan {plan_tier}")
            return False

        # Count active connections
        with self.SessionLocal() as session:
            active_count = session.query(StreamConnection).filter(
                StreamConnection.customer_id == customer_id,
                StreamConnection.status == StreamConnectionStatus.ACTIVE.value
            ).count()

            if active_count >= limits.max_connections:
                logger.warning(f"Connection limit exceeded for customer {customer_id}: {active_count}/{limits.max_connections}")
                return False

        return True

    async def register_connection(
        self,
        connection_id: str,
        customer_id: str,
        stream_name: str,
        stream_type: str,
        plan_tier: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Register a new streaming connection"""

        if not await self.check_connection_limit(customer_id, plan_tier, stream_type):
            return False

        connection = StreamConnection(
            id=connection_id,
            customer_id=customer_id,
            stream_name=stream_name,
            stream_type=stream_type,
            plan_tier=plan_tier,
            metadata=metadata or {}
        )

        with self.SessionLocal() as session:
            session.add(connection)
            session.commit()

        # Cache connection info
        self.active_connections[connection_id] = {
            'customer_id': customer_id,
            'plan_tier': plan_tier,
            'stream_type': stream_type,
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow()
        }

        # Update daily metrics
        await self._update_connection_metrics(customer_id, plan_tier, 1)

        logger.info(f"Registered streaming connection {connection_id} for customer {customer_id}")
        return True

    async def unregister_connection(self, connection_id: str) -> bool:
        """Unregister a streaming connection"""
        if connection_id not in self.active_connections:
            return False

        customer_id = self.active_connections[connection_id]['customer_id']
        plan_tier = self.active_connections[connection_id]['plan_tier']

        # Update database
        with self.SessionLocal() as session:
            connection = session.query(StreamConnection).filter(
                StreamConnection.id == connection_id
            ).first()

            if connection:
                connection.status = StreamConnectionStatus.TERMINATED.value
                session.commit()

        # Remove from cache
        del self.active_connections[connection_id]

        # Update metrics
        await self._update_connection_metrics(customer_id, plan_tier, -1)

        logger.info(f"Unregistered streaming connection {connection_id}")
        return True

    async def check_throughput_limit(
        self,
        connection_id: str,
        bytes_per_second: float
    ) -> bool:
        """Check if throughput is within plan limits"""
        if connection_id not in self.active_connections:
            return False

        conn_info = self.active_connections[connection_id]
        plan_tier = conn_info['plan_tier']
        plan = StreamingPlan(plan_tier)
        limits = self.plan_limits[plan]

        # Convert bytes/sec to Mbps
        mbps = (bytes_per_second * 8) / (1024 * 1024)

        if mbps > limits.max_throughput_mbps:
            logger.warning(f"Throughput limit exceeded for {connection_id}: {mbps:.2f}/{limits.max_throughput_mbps} Mbps")
            await self._throttle_connection(connection_id)
            return False

        return True

    async def check_webhook_rate_limit(self, customer_id: str, plan_tier: str) -> bool:
        """Check webhook rate limiting"""
        plan = StreamingPlan(plan_tier)
        limits = self.plan_limits[plan]

        # Check Redis rate limiter
        key = f"webhook_rate:{customer_id}"
        current = await self.redis.get(key)
        current_count = int(current) if current else 0

        if current_count >= limits.max_webhooks_per_minute:
            logger.warning(f"Webhook rate limit exceeded for customer {customer_id}")
            return False

        # Increment counter
        await self.redis.incr(key)
        await self.redis.expire(key, 60)

        return True

    async def validate_message_size(self, connection_id: str, message_size_bytes: int) -> bool:
        """Validate message size against plan limits"""
        if connection_id not in self.active_connections:
            return False

        conn_info = self.active_connections[connection_id]
        plan_tier = conn_info['plan_tier']
        plan = StreamingPlan(plan_tier)
        limits = self.plan_limits[plan]

        message_size_kb = message_size_bytes / 1024

        if message_size_kb > limits.max_message_size_kb:
            logger.warning(f"Message size limit exceeded for {connection_id}: {message_size_kb:.1f}/{limits.max_message_size_kb} KB")
            return False

        return True

    async def validate_batch_size(self, connection_id: str, batch_size: int) -> bool:
        """Validate batch size against plan limits"""
        if connection_id not in self.active_connections:
            return False

        conn_info = self.active_connections[connection_id]
        plan_tier = conn_info['plan_tier']
        plan = StreamingPlan(plan_tier)
        limits = self.plan_limits[plan]

        if batch_size > limits.max_batch_size:
            logger.warning(f"Batch size limit exceeded for {connection_id}: {batch_size}/{limits.max_batch_size}")
            return False

        return True

    async def record_streaming_activity(
        self,
        connection_id: str,
        bytes_processed: int,
        messages_processed: int,
        webhooks_sent: int = 0
    ):
        """Record streaming activity for billing and monitoring"""
        if connection_id not in self.active_connections:
            return

        conn_info = self.active_connections[connection_id]
        customer_id = conn_info['customer_id']

        # Update connection activity
        conn_info['last_activity'] = datetime.utcnow()

        # Update database
        with self.SessionLocal() as session:
            connection = session.query(StreamConnection).filter(
                StreamConnection.id == connection_id
            ).first()

            if connection:
                connection.last_activity = datetime.utcnow()
                connection.bytes_processed += bytes_processed
                connection.messages_processed += messages_processed
                connection.webhooks_sent += webhooks_sent
                session.commit()

        # Update usage metrics
        await self._update_usage_metrics(
            customer_id,
            conn_info['plan_tier'],
            bytes_processed,
            messages_processed,
            webhooks_sent
        )

    async def _throttle_connection(self, connection_id: str):
        """Throttle a connection that exceeded limits"""
        if connection_id not in self.active_connections:
            return

        conn_info = self.active_connections[connection_id]
        customer_id = conn_info['customer_id']

        # Update connection status
        with self.SessionLocal() as session:
            connection = session.query(StreamConnection).filter(
                StreamConnection.id == connection_id
            ).first()

            if connection:
                connection.status = StreamConnectionStatus.THROTTLED.value
                session.commit()

        # Record throttle event
        await self._record_throttle_event(customer_id, conn_info['plan_tier'])

        logger.warning(f"Throttled connection {connection_id} due to limit violation")

    async def _update_connection_metrics(self, customer_id: str, plan_tier: str, delta: int):
        """Update real-time connection count metrics"""
        key = f"connections:{customer_id}"

        # Update current count
        current = await self.redis.incr(key) if delta > 0 else await self.redis.decr(key)
        current = max(0, current)  # Ensure non-negative

        # Update peak count
        peak_key = f"peak_connections:{customer_id}:{datetime.utcnow().strftime('%Y-%m-%d')}"
        peak = await self.redis.get(peak_key)
        peak = int(peak) if peak else 0

        if current > peak:
            await self.redis.set(peak_key, current)
            await self.redis.expire(peak_key, 86400)  # 24 hours

    async def _update_usage_metrics(
        self,
        customer_id: str,
        plan_tier: str,
        bytes_processed: int,
        messages_processed: int,
        webhooks_sent: int
    ):
        """Update daily usage metrics"""
        today = datetime.utcnow().date()

        with self.SessionLocal() as session:
            usage = session.query(StreamingUsage).filter(
                StreamingUsage.customer_id == customer_id,
                StreamingUsage.date >= today,
                StreamingUsage.date < today + timedelta(days=1)
            ).first()

            if not usage:
                usage = StreamingUsage(
                    id=f"{customer_id}_{today.isoformat()}",
                    customer_id=customer_id,
                    date=datetime.combine(today, datetime.min.time()),
                    plan_tier=plan_tier
                )
                session.add(usage)

            usage.bytes_processed += bytes_processed
            usage.messages_processed += messages_processed
            usage.webhooks_sent += webhooks_sent
            session.commit()

    async def _record_throttle_event(self, customer_id: str, plan_tier: str):
        """Record a throttle event in usage metrics"""
        today = datetime.utcnow().date()

        with self.SessionLocal() as session:
            usage = session.query(StreamingUsage).filter(
                StreamingUsage.customer_id == customer_id,
                StreamingUsage.date >= today,
                StreamingUsage.date < today + timedelta(days=1)
            ).first()

            if usage:
                usage.throttle_events += 1
                session.commit()

    async def get_customer_streaming_status(self, customer_id: str) -> Dict[str, Any]:
        """Get comprehensive streaming status for a customer"""
        with self.SessionLocal() as session:
            # Active connections
            active_connections = session.query(StreamConnection).filter(
                StreamConnection.customer_id == customer_id,
                StreamConnection.status == StreamConnectionStatus.ACTIVE.value
            ).all()

            # Today's usage
            today = datetime.utcnow().date()
            usage = session.query(StreamingUsage).filter(
                StreamingUsage.customer_id == customer_id,
                StreamingUsage.date >= today
            ).first()

            # Plan limits (assuming all connections use same plan)
            plan_tier = active_connections[0].plan_tier if active_connections else "developer"
            limits = self.plan_limits[StreamingPlan(plan_tier)]

            return {
                'customer_id': customer_id,
                'plan_tier': plan_tier,
                'active_connections': len(active_connections),
                'max_connections': limits.max_connections,
                'connections': [
                    {
                        'id': conn.id,
                        'stream_name': conn.stream_name,
                        'stream_type': conn.stream_type,
                        'status': conn.status,
                        'created_at': conn.created_at.isoformat(),
                        'bytes_processed': conn.bytes_processed,
                        'messages_processed': conn.messages_processed
                    }
                    for conn in active_connections
                ],
                'daily_usage': {
                    'bytes_processed': usage.bytes_processed if usage else 0,
                    'messages_processed': usage.messages_processed if usage else 0,
                    'webhooks_sent': usage.webhooks_sent if usage else 0,
                    'throttle_events': usage.throttle_events if usage else 0
                } if usage else None,
                'limits': {
                    'max_connections': limits.max_connections,
                    'max_throughput_mbps': limits.max_throughput_mbps,
                    'max_webhooks_per_minute': limits.max_webhooks_per_minute,
                    'max_batch_size': limits.max_batch_size,
                    'max_message_size_kb': limits.max_message_size_kb,
                    'allowed_protocols': list(limits.allowed_protocols)
                }
            }

    async def cleanup_expired_connections(self):
        """Cleanup expired connections (run as background task)"""
        while True:
            try:
                cutoff_time = datetime.utcnow() - timedelta(hours=1)

                with self.SessionLocal() as session:
                    expired = session.query(StreamConnection).filter(
                        StreamConnection.status == StreamConnectionStatus.ACTIVE.value,
                        StreamConnection.last_activity < cutoff_time
                    ).all()

                for connection in expired:
                    await self.unregister_connection(connection.id)
                    logger.info(f"Cleaned up expired connection {connection.id}")

                # Sleep for 5 minutes
                await asyncio.sleep(300)

            except Exception as e:
                logger.error(f"Error cleaning up connections: {e}")
                await asyncio.sleep(60)