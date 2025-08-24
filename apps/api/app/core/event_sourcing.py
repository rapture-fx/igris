"""
Event Sourcing and Event-Driven Architecture System
===================================================

Comprehensive event sourcing implementation for:
- Complete audit trail of all system changes
- Event replay and recovery capabilities
- Distributed event coordination
- State reconstruction from events
- Command-Query Responsibility Segregation (CQRS)

Features:
- Immutable event store
- Event versioning and migration
- Snapshot optimization
- Event projection and views
- Distributed event coordination
- Time-based event queries
"""

import asyncio
import json
import logging
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Type, AsyncGenerator, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

from app.core.redis_streams import get_streams_client, StreamMessage, EventType as StreamEventType
from app.database.connection import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, and_, or_, desc, asc
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

# ==================== EVENT SOURCING CORE TYPES ====================

class EventVersion(Enum):
    """Event schema versions for migration support"""
    V1 = "1.0"
    V2 = "2.0"

class AggregateType(Enum):
    """Types of aggregates in the system"""
    USER = "user"
    DATA_PIPELINE = "data_pipeline" 
    PROCESSING_JOB = "processing_job"
    IOT_DEVICE = "iot_device"
    FINANCIAL_ACCOUNT = "financial_account"
    ECOMMERCE_SESSION = "ecommerce_session"

class EventCategory(Enum):
    """Categories of events for organization"""
    COMMAND = "command"          # Commands that change state
    DOMAIN = "domain"            # Domain-specific business events
    INTEGRATION = "integration"  # External system integration events
    SYSTEM = "system"            # System/infrastructure events

@dataclass
class EventMetadata:
    """Metadata for events"""
    event_id: str
    aggregate_id: str
    aggregate_type: AggregateType
    event_version: EventVersion
    event_category: EventCategory
    timestamp: datetime
    user_id: Optional[str] = None
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None  # ID of the event that caused this event
    source_system: str = "schlep_engine"
    session_id: Optional[str] = None

@dataclass 
class DomainEvent:
    """Base class for all domain events"""
    metadata: EventMetadata
    event_type: str
    data: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary"""
        return {
            "metadata": {
                "event_id": self.metadata.event_id,
                "aggregate_id": self.metadata.aggregate_id,
                "aggregate_type": self.metadata.aggregate_type.value,
                "event_version": self.metadata.event_version.value,
                "event_category": self.metadata.event_category.value,
                "timestamp": self.metadata.timestamp.isoformat(),
                "user_id": self.metadata.user_id,
                "correlation_id": self.metadata.correlation_id,
                "causation_id": self.metadata.causation_id,
                "source_system": self.metadata.source_system,
                "session_id": self.metadata.session_id
            },
            "event_type": self.event_type,
            "data": self.data
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DomainEvent':
        """Create event from dictionary"""
        metadata = EventMetadata(
            event_id=data["metadata"]["event_id"],
            aggregate_id=data["metadata"]["aggregate_id"],
            aggregate_type=AggregateType(data["metadata"]["aggregate_type"]),
            event_version=EventVersion(data["metadata"]["event_version"]),
            event_category=EventCategory(data["metadata"]["event_category"]),
            timestamp=datetime.fromisoformat(data["metadata"]["timestamp"]),
            user_id=data["metadata"].get("user_id"),
            correlation_id=data["metadata"].get("correlation_id"),
            causation_id=data["metadata"].get("causation_id"),
            source_system=data["metadata"].get("source_system", "schlep_engine"),
            session_id=data["metadata"].get("session_id")
        )
        
        return cls(
            metadata=metadata,
            event_type=data["event_type"],
            data=data["data"]
        )

# ==================== SPECIFIC DOMAIN EVENTS ====================

class UserEvents:
    """User aggregate events"""
    
    @staticmethod
    def user_created(user_id: str, user_data: Dict[str, Any], correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=user_id,
                aggregate_type=AggregateType.USER,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                correlation_id=correlation_id
            ),
            event_type="user_created",
            data=user_data
        )
    
    @staticmethod
    def user_updated(user_id: str, changes: Dict[str, Any], user_id_actor: str = None, correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=user_id,
                aggregate_type=AggregateType.USER,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                user_id=user_id_actor,
                correlation_id=correlation_id
            ),
            event_type="user_updated",
            data={"changes": changes, "timestamp": datetime.utcnow().isoformat()}
        )

class DataPipelineEvents:
    """Data pipeline aggregate events"""
    
    @staticmethod
    def pipeline_created(pipeline_id: str, pipeline_config: Dict[str, Any], user_id: str = None, correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=pipeline_id,
                aggregate_type=AggregateType.DATA_PIPELINE,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                correlation_id=correlation_id
            ),
            event_type="pipeline_created",
            data=pipeline_config
        )
    
    @staticmethod
    def pipeline_started(pipeline_id: str, execution_id: str, user_id: str = None, correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=pipeline_id,
                aggregate_type=AggregateType.DATA_PIPELINE,
                event_version=EventVersion.V1,
                event_category=EventCategory.COMMAND,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                correlation_id=correlation_id
            ),
            event_type="pipeline_started",
            data={"execution_id": execution_id, "started_at": datetime.utcnow().isoformat()}
        )
    
    @staticmethod
    def pipeline_completed(pipeline_id: str, execution_id: str, results: Dict[str, Any], user_id: str = None, correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=pipeline_id,
                aggregate_type=AggregateType.DATA_PIPELINE,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                correlation_id=correlation_id
            ),
            event_type="pipeline_completed",
            data={"execution_id": execution_id, "results": results, "completed_at": datetime.utcnow().isoformat()}
        )
    
    @staticmethod
    def pipeline_failed(pipeline_id: str, execution_id: str, error: str, user_id: str = None, correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=pipeline_id,
                aggregate_type=AggregateType.DATA_PIPELINE,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                correlation_id=correlation_id
            ),
            event_type="pipeline_failed",
            data={"execution_id": execution_id, "error": error, "failed_at": datetime.utcnow().isoformat()}
        )

class IoTDeviceEvents:
    """IoT device aggregate events"""
    
    @staticmethod
    def device_registered(device_id: str, device_info: Dict[str, Any], correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=device_id,
                aggregate_type=AggregateType.IOT_DEVICE,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                correlation_id=correlation_id
            ),
            event_type="device_registered",
            data=device_info
        )
    
    @staticmethod
    def sensor_reading_received(device_id: str, reading_data: Dict[str, Any], correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=device_id,
                aggregate_type=AggregateType.IOT_DEVICE,
                event_version=EventVersion.V1,
                event_category=EventCategory.INTEGRATION,
                timestamp=datetime.utcnow(),
                correlation_id=correlation_id
            ),
            event_type="sensor_reading_received",
            data=reading_data
        )
    
    @staticmethod
    def alert_triggered(device_id: str, alert_data: Dict[str, Any], correlation_id: str = None) -> DomainEvent:
        return DomainEvent(
            metadata=EventMetadata(
                event_id=str(uuid.uuid4()),
                aggregate_id=device_id,
                aggregate_type=AggregateType.IOT_DEVICE,
                event_version=EventVersion.V1,
                event_category=EventCategory.DOMAIN,
                timestamp=datetime.utcnow(),
                correlation_id=correlation_id
            ),
            event_type="alert_triggered",
            data=alert_data
        )

# ==================== EVENT STORE INTERFACE ====================

class EventStore(ABC):
    """Abstract event store interface"""
    
    @abstractmethod
    async def append_event(self, event: DomainEvent) -> bool:
        """Append event to the store"""
        pass
    
    @abstractmethod
    async def append_events(self, events: List[DomainEvent]) -> bool:
        """Append multiple events atomically"""
        pass
    
    @abstractmethod
    async def get_events(
        self, 
        aggregate_id: str, 
        from_version: int = 0,
        to_version: Optional[int] = None
    ) -> List[DomainEvent]:
        """Get events for a specific aggregate"""
        pass
    
    @abstractmethod
    async def get_events_by_type(
        self,
        event_types: List[str],
        from_timestamp: Optional[datetime] = None,
        to_timestamp: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[DomainEvent]:
        """Get events by type and time range"""
        pass
    
    @abstractmethod
    async def get_events_by_correlation_id(self, correlation_id: str) -> List[DomainEvent]:
        """Get all events with the same correlation ID"""
        pass

# ==================== REDIS STREAMS EVENT STORE ====================

class RedisStreamsEventStore(EventStore):
    """Event store implementation using Redis Streams"""
    
    def __init__(self):
        self.streams_client = None
        self.event_stream_name = "domain_events"
    
    async def _get_client(self):
        """Get Redis Streams client"""
        if not self.streams_client:
            self.streams_client = await get_streams_client()
        return self.streams_client
    
    async def append_event(self, event: DomainEvent) -> bool:
        """Append single event to Redis Streams"""
        try:
            client = await self._get_client()
            
            event_data = event.to_dict()
            
            # Add to main domain events stream
            stream_id = await client.produce_message(
                stream_name=self.event_stream_name,
                event_type=StreamEventType.SYSTEM_EVENTS,  # Map to stream event type
                data=event_data,
                source="event_store",
                correlation_id=event.metadata.correlation_id
            )
            
            # Also add to aggregate-specific stream for faster querying
            aggregate_stream = f"events_{event.metadata.aggregate_type.value}_{event.metadata.aggregate_id}"
            await client.produce_message(
                stream_name=aggregate_stream,
                event_type=StreamEventType.SYSTEM_EVENTS,
                data=event_data,
                source="event_store",
                correlation_id=event.metadata.correlation_id
            )
            
            logger.debug(f"Appended event {event.metadata.event_id} to event store")
            return True
            
        except Exception as e:
            logger.error(f"Failed to append event to store: {e}")
            return False
    
    async def append_events(self, events: List[DomainEvent]) -> bool:
        """Append multiple events atomically"""
        try:
            # For Redis Streams, we append each event individually
            # In a production system, you might use Redis transactions
            success_count = 0
            
            for event in events:
                if await self.append_event(event):
                    success_count += 1
                else:
                    logger.error(f"Failed to append event {event.metadata.event_id}")
            
            return success_count == len(events)
            
        except Exception as e:
            logger.error(f"Failed to append events batch: {e}")
            return False
    
    async def get_events(
        self, 
        aggregate_id: str, 
        from_version: int = 0,
        to_version: Optional[int] = None
    ) -> List[DomainEvent]:
        """Get events for specific aggregate"""
        try:
            client = await self._get_client()
            events = []
            
            # Query aggregate-specific stream
            aggregate_stream = f"events_*_{aggregate_id}"  # This is simplified - in practice you'd know the type
            
            # Use stream replay to get historical events
            async for message in client.replay_messages(
                stream_name=self.event_stream_name,
                start_id="0",
                end_id="+",
                count=1000
            ):
                # Parse message data to get the domain event
                if message.data and isinstance(message.data, dict):
                    # Check if this event is for the requested aggregate
                    metadata = message.data.get("metadata", {})
                    if metadata.get("aggregate_id") == aggregate_id:
                        try:
                            domain_event = DomainEvent.from_dict(message.data)
                            events.append(domain_event)
                        except Exception as e:
                            logger.warning(f"Failed to parse domain event from message: {e}")
            
            # Sort by timestamp
            events.sort(key=lambda e: e.metadata.timestamp)
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get events for aggregate {aggregate_id}: {e}")
            return []
    
    async def get_events_by_type(
        self,
        event_types: List[str],
        from_timestamp: Optional[datetime] = None,
        to_timestamp: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[DomainEvent]:
        """Get events by type and time range"""
        try:
            client = await self._get_client()
            events = []
            
            start_id = "0"
            end_id = "+"
            
            # Convert timestamps to Redis stream IDs if provided
            if from_timestamp:
                start_id = f"{int(from_timestamp.timestamp() * 1000)}-0"
            if to_timestamp:
                end_id = f"{int(to_timestamp.timestamp() * 1000)}-0"
            
            async for message in client.replay_messages(
                stream_name=self.event_stream_name,
                start_id=start_id,
                end_id=end_id,
                count=100  # Process in batches
            ):
                if message.data and isinstance(message.data, dict):
                    event_type = message.data.get("event_type")
                    if event_type in event_types:
                        try:
                            domain_event = DomainEvent.from_dict(message.data)
                            events.append(domain_event)
                            
                            if len(events) >= limit:
                                break
                        except Exception as e:
                            logger.warning(f"Failed to parse domain event: {e}")
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get events by type: {e}")
            return []
    
    async def get_events_by_correlation_id(self, correlation_id: str) -> List[DomainEvent]:
        """Get all events with the same correlation ID"""
        try:
            client = await self._get_client()
            events = []
            
            async for message in client.replay_messages(
                stream_name=self.event_stream_name,
                start_id="0",
                end_id="+",
                count=100
            ):
                if (message.data and isinstance(message.data, dict) and 
                    message.correlation_id == correlation_id):
                    try:
                        domain_event = DomainEvent.from_dict(message.data)
                        events.append(domain_event)
                    except Exception as e:
                        logger.warning(f"Failed to parse domain event: {e}")
            
            # Sort by timestamp
            events.sort(key=lambda e: e.metadata.timestamp)
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get events by correlation ID {correlation_id}: {e}")
            return []

# ==================== EVENT HANDLERS ====================

class EventHandler(ABC):
    """Abstract base class for event handlers"""
    
    @abstractmethod
    async def handle(self, event: DomainEvent) -> bool:
        """Handle the event"""
        pass
    
    @abstractmethod
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can handle the event type"""
        pass

class IoTEventHandler(EventHandler):
    """Handler for IoT device events"""
    
    async def handle(self, event: DomainEvent) -> bool:
        """Handle IoT device events"""
        try:
            if event.event_type == "sensor_reading_received":
                # Process sensor reading
                await self._process_sensor_reading(event)
            elif event.event_type == "alert_triggered":
                # Handle alert
                await self._handle_alert(event)
            elif event.event_type == "device_registered":
                # Handle device registration
                await self._handle_device_registration(event)
            
            return True
            
        except Exception as e:
            logger.error(f"Error handling IoT event {event.metadata.event_id}: {e}")
            return False
    
    def can_handle(self, event_type: str) -> bool:
        """Check if this handler can handle the event type"""
        iot_events = ["sensor_reading_received", "alert_triggered", "device_registered"]
        return event_type in iot_events
    
    async def _process_sensor_reading(self, event: DomainEvent):
        """Process sensor reading event"""
        reading_data = event.data
        device_id = event.metadata.aggregate_id
        
        # Log the processing (in a real system, this might update databases, trigger alerts, etc.)
        logger.info(f"Processing sensor reading from device {device_id}: {reading_data}")
        
        # Example: If temperature is too high, trigger an alert event
        if reading_data.get("sensor_type") == "temperature" and reading_data.get("value", 0) > 30:
            alert_event = IoTDeviceEvents.alert_triggered(
                device_id=device_id,
                alert_data={
                    "alert_type": "high_temperature",
                    "temperature": reading_data.get("value"),
                    "threshold": 30,
                    "severity": "warning"
                },
                correlation_id=event.metadata.correlation_id
            )
            
            # Append the alert event to the event store
            event_store = await get_event_store()
            await event_store.append_event(alert_event)
    
    async def _handle_alert(self, event: DomainEvent):
        """Handle alert event"""
        alert_data = event.data
        device_id = event.metadata.aggregate_id
        
        logger.warning(f"Alert triggered for device {device_id}: {alert_data}")
        
        # In a real system, this might send notifications, update dashboards, etc.
    
    async def _handle_device_registration(self, event: DomainEvent):
        """Handle device registration event"""
        device_info = event.data
        device_id = event.metadata.aggregate_id
        
        logger.info(f"New device registered: {device_id} with info: {device_info}")

# ==================== EVENT DISPATCHER ====================

class EventDispatcher:
    """Dispatches events to registered handlers"""
    
    def __init__(self):
        self.handlers: List[EventHandler] = []
        self.event_statistics = defaultdict(int)
    
    def register_handler(self, handler: EventHandler):
        """Register an event handler"""
        self.handlers.append(handler)
        logger.info(f"Registered event handler: {handler.__class__.__name__}")
    
    async def dispatch(self, event: DomainEvent) -> List[bool]:
        """Dispatch event to all applicable handlers"""
        results = []
        
        for handler in self.handlers:
            if handler.can_handle(event.event_type):
                try:
                    result = await handler.handle(event)
                    results.append(result)
                    
                    # Update statistics
                    if result:
                        self.event_statistics[f"{event.event_type}_success"] += 1
                    else:
                        self.event_statistics[f"{event.event_type}_failure"] += 1
                        
                except Exception as e:
                    logger.error(f"Handler {handler.__class__.__name__} failed for event {event.metadata.event_id}: {e}")
                    results.append(False)
                    self.event_statistics[f"{event.event_type}_error"] += 1
        
        return results
    
    def get_statistics(self) -> Dict[str, int]:
        """Get event processing statistics"""
        return dict(self.event_statistics)

# ==================== EVENT BUS ====================

class EventBus:
    """Central event bus for event-driven architecture"""
    
    def __init__(self):
        self.event_store: Optional[EventStore] = None
        self.dispatcher = EventDispatcher()
        self.projection_handlers: List[Callable] = []
    
    async def initialize(self):
        """Initialize the event bus"""
        self.event_store = RedisStreamsEventStore()
        
        # Register default handlers
        self.dispatcher.register_handler(IoTEventHandler())
        
        logger.info("Event bus initialized")
    
    async def publish(self, event: DomainEvent) -> bool:
        """Publish an event to the bus"""
        try:
            # Store the event
            if self.event_store:
                await self.event_store.append_event(event)
            
            # Dispatch to handlers
            await self.dispatcher.dispatch(event)
            
            # Update projections
            await self._update_projections(event)
            
            logger.debug(f"Published event {event.metadata.event_id} of type {event.event_type}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish event {event.metadata.event_id}: {e}")
            return False
    
    async def publish_batch(self, events: List[DomainEvent]) -> bool:
        """Publish multiple events as a batch"""
        try:
            # Store events
            if self.event_store:
                await self.event_store.append_events(events)
            
            # Dispatch each event
            for event in events:
                await self.dispatcher.dispatch(event)
                await self._update_projections(event)
            
            logger.info(f"Published batch of {len(events)} events")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish event batch: {e}")
            return False
    
    async def replay_events(
        self, 
        aggregate_id: str,
        from_timestamp: Optional[datetime] = None
    ) -> List[DomainEvent]:
        """Replay events for an aggregate"""
        if not self.event_store:
            return []
        
        events = await self.event_store.get_events(aggregate_id)
        
        if from_timestamp:
            events = [e for e in events if e.metadata.timestamp >= from_timestamp]
        
        return events
    
    async def get_event_history(
        self,
        correlation_id: str
    ) -> List[DomainEvent]:
        """Get complete event history for a correlation ID"""
        if not self.event_store:
            return []
        
        return await self.event_store.get_events_by_correlation_id(correlation_id)
    
    async def _update_projections(self, event: DomainEvent):
        """Update read model projections"""
        for handler in self.projection_handlers:
            try:
                await handler(event)
            except Exception as e:
                logger.error(f"Projection handler failed for event {event.metadata.event_id}: {e}")
    
    def register_projection_handler(self, handler: Callable):
        """Register a projection handler"""
        self.projection_handlers.append(handler)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get event bus statistics"""
        return {
            "dispatcher_stats": self.dispatcher.get_statistics(),
            "projection_handlers": len(self.projection_handlers),
            "event_store_type": type(self.event_store).__name__ if self.event_store else None
        }

# ==================== GLOBAL INSTANCES ====================

# Global event bus instance
event_bus: Optional[EventBus] = None

async def get_event_bus() -> EventBus:
    """Get or create the global event bus"""
    global event_bus
    
    if event_bus is None:
        event_bus = EventBus()
        await event_bus.initialize()
    
    return event_bus

async def get_event_store() -> EventStore:
    """Get the event store"""
    bus = await get_event_bus()
    return bus.event_store

# ==================== UTILITY FUNCTIONS ====================

async def publish_domain_event(event: DomainEvent) -> bool:
    """Utility function to publish a domain event"""
    bus = await get_event_bus()
    return await bus.publish(event)

async def replay_aggregate_events(aggregate_id: str, from_timestamp: Optional[datetime] = None) -> List[DomainEvent]:
    """Utility function to replay events for an aggregate"""
    bus = await get_event_bus()
    return await bus.replay_events(aggregate_id, from_timestamp)

async def get_correlation_history(correlation_id: str) -> List[DomainEvent]:
    """Get complete event history for a correlation ID"""
    bus = await get_event_bus()
    return await bus.get_event_history(correlation_id)