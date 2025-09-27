"""
Advanced Integration Patterns
Implements GraphQL, MQTT, and other advanced integration patterns for Scale tier customers.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import ssl

# GraphQL dependencies
import strawberry
from strawberry.fastapi import GraphQLRouter
from strawberry.types import Info

# MQTT dependencies
import paho.mqtt.client as mqtt
import asyncio_mqtt

# WebSocket dependencies
import websockets
from websockets.exceptions import ConnectionClosed

# gRPC dependencies (optional)
try:
    import grpc
    import grpc.aio
    GRPC_AVAILABLE = True
except ImportError:
    GRPC_AVAILABLE = False

from app.middleware.streaming_enforcement import StreamingEnforcement
from app.middleware.ml_framework_enforcement import MLFrameworkEnforcement

logger = logging.getLogger(__name__)

class IntegrationProtocol(str, Enum):
    """Supported advanced integration protocols"""
    GRAPHQL = "graphql"
    MQTT = "mqtt"
    WEBSOCKET = "websocket"
    GRPC = "grpc"
    SERVER_SENT_EVENTS = "sse"

@dataclass
class IntegrationConfig:
    """Configuration for advanced integrations"""
    protocol: IntegrationProtocol
    customer_id: str
    plan_tier: str
    endpoint_url: str
    auth_config: Optional[Dict[str, Any]] = None
    rate_limits: Optional[Dict[str, int]] = None
    custom_headers: Optional[Dict[str, str]] = None
    ssl_config: Optional[Dict[str, Any]] = None

# GraphQL Schema and Resolvers
@strawberry.type
class DataPoint:
    """GraphQL data point type"""
    id: str
    timestamp: datetime
    value: float
    metadata: Optional[str] = None

@strawberry.type
class ProcessingJob:
    """GraphQL processing job type"""
    id: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    progress: float
    result_url: Optional[str] = None

@strawberry.type
class MLModel:
    """GraphQL ML model type"""
    id: str
    name: str
    framework: str
    version: str
    accuracy: Optional[float] = None
    created_at: datetime

@strawberry.input
class DataProcessingInput:
    """GraphQL input for data processing"""
    data_url: str
    processing_type: str
    parameters: Optional[str] = None

@strawberry.input
class MLTrainingInput:
    """GraphQL input for ML training"""
    data_url: str
    model_type: str
    algorithm: str
    parameters: Optional[str] = None

@strawberry.type
class Query:
    """GraphQL query resolvers"""

    @strawberry.field
    async def data_points(self, info: Info, limit: int = 100) -> List[DataPoint]:
        """Get recent data points"""
        # Extract customer info from context
        customer_id = info.context.get("customer_id", "unknown")

        # Mock data for now - would integrate with actual data service
        data_points = []
        for i in range(min(limit, 100)):
            data_points.append(DataPoint(
                id=f"dp_{i}",
                timestamp=datetime.utcnow() - timedelta(minutes=i),
                value=float(i * 10),
                metadata=json.dumps({"source": "api", "customer_id": customer_id})
            ))

        return data_points

    @strawberry.field
    async def processing_jobs(self, info: Info, status: Optional[str] = None) -> List[ProcessingJob]:
        """Get processing jobs"""
        customer_id = info.context.get("customer_id", "unknown")

        # Mock data - would integrate with job service
        jobs = [
            ProcessingJob(
                id="job_1",
                status="running",
                created_at=datetime.utcnow() - timedelta(hours=1),
                progress=75.5
            ),
            ProcessingJob(
                id="job_2",
                status="completed",
                created_at=datetime.utcnow() - timedelta(hours=2),
                updated_at=datetime.utcnow() - timedelta(minutes=30),
                progress=100.0,
                result_url="https://storage.example.com/results/job_2.csv"
            )
        ]

        if status:
            jobs = [job for job in jobs if job.status == status]

        return jobs

    @strawberry.field
    async def ml_models(self, info: Info, framework: Optional[str] = None) -> List[MLModel]:
        """Get ML models"""
        customer_id = info.context.get("customer_id", "unknown")

        # Mock data - would integrate with ML service
        models = [
            MLModel(
                id="model_1",
                name="Customer Churn Predictor",
                framework="sklearn",
                version="1.0.0",
                accuracy=0.89,
                created_at=datetime.utcnow() - timedelta(days=7)
            ),
            MLModel(
                id="model_2",
                name="Demand Forecaster",
                framework="tensorflow",
                version="2.1.0",
                accuracy=0.92,
                created_at=datetime.utcnow() - timedelta(days=3)
            )
        ]

        if framework:
            models = [model for model in models if model.framework == framework]

        return models

@strawberry.type
class Mutation:
    """GraphQL mutation resolvers"""

    @strawberry.mutation
    async def start_data_processing(self, info: Info, input: DataProcessingInput) -> ProcessingJob:
        """Start a data processing job"""
        customer_id = info.context.get("customer_id", "unknown")

        # Validate plan tier permissions
        plan_tier = info.context.get("plan_tier", "developer")
        if plan_tier == "developer" and input.processing_type in ["advanced_ml", "distributed"]:
            raise ValueError("Advanced processing not available in developer tier")

        # Create new job
        job = ProcessingJob(
            id=f"job_{int(datetime.utcnow().timestamp())}",
            status="queued",
            created_at=datetime.utcnow(),
            progress=0.0
        )

        logger.info(f"Started processing job {job.id} for customer {customer_id}")
        return job

    @strawberry.mutation
    async def start_ml_training(self, info: Info, input: MLTrainingInput) -> ProcessingJob:
        """Start ML model training"""
        customer_id = info.context.get("customer_id", "unknown")
        plan_tier = info.context.get("plan_tier", "developer")

        # Validate ML framework access
        if plan_tier == "developer" and input.algorithm not in ["linear_regression", "decision_tree"]:
            raise ValueError("Advanced algorithms not available in developer tier")

        # Create training job
        job = ProcessingJob(
            id=f"ml_job_{int(datetime.utcnow().timestamp())}",
            status="training",
            created_at=datetime.utcnow(),
            progress=0.0
        )

        logger.info(f"Started ML training job {job.id} for customer {customer_id}")
        return job

@strawberry.type
class Subscription:
    """GraphQL subscription resolvers"""

    @strawberry.subscription
    async def job_updates(self, info: Info, job_id: str) -> ProcessingJob:
        """Subscribe to job status updates"""
        customer_id = info.context.get("customer_id", "unknown")

        # Simulate job progress updates
        for progress in range(0, 101, 10):
            await asyncio.sleep(1)  # Simulate work

            status = "running" if progress < 100 else "completed"

            yield ProcessingJob(
                id=job_id,
                status=status,
                created_at=datetime.utcnow() - timedelta(minutes=5),
                updated_at=datetime.utcnow(),
                progress=float(progress)
            )

# Create GraphQL schema
schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)

class MQTTIntegration:
    """MQTT integration for real-time messaging"""

    def __init__(self, broker_host: str = "localhost", broker_port: int = 1883):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.client = None
        self.subscriptions: Dict[str, Callable] = {}
        self.streaming_enforcement = None

    async def initialize(self, streaming_enforcement: StreamingEnforcement):
        """Initialize MQTT client"""
        self.streaming_enforcement = streaming_enforcement

        # Create MQTT client
        self.client = mqtt.Client()
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        try:
            await asyncio.get_event_loop().run_in_executor(
                None, self.client.connect, self.broker_host, self.broker_port, 60
            )

            # Start the client loop in background
            self.client.loop_start()

            logger.info(f"MQTT client connected to {self.broker_host}:{self.broker_port}")

        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            raise

    def _on_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            logger.info("MQTT client connected successfully")
        else:
            logger.error(f"MQTT connection failed with code {rc}")

    def _on_message(self, client, userdata, msg):
        """MQTT message callback"""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())

            # Find subscription handler
            if topic in self.subscriptions:
                asyncio.create_task(self.subscriptions[topic](topic, payload))

        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def _on_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback"""
        logger.warning(f"MQTT client disconnected with code {rc}")

    async def subscribe_topic(
        self,
        customer_id: str,
        plan_tier: str,
        topic: str,
        callback: Callable[[str, Dict], None]
    ) -> bool:
        """Subscribe to MQTT topic with plan enforcement"""
        try:
            # Check if customer can create MQTT connections
            connection_id = f"mqtt_{customer_id}_{topic}"

            if self.streaming_enforcement:
                can_connect = await self.streaming_enforcement.check_connection_limit(
                    customer_id, plan_tier, "mqtt"
                )

                if not can_connect:
                    logger.warning(f"MQTT subscription denied for {customer_id}: connection limit exceeded")
                    return False

                # Register the connection
                await self.streaming_enforcement.register_connection(
                    connection_id=connection_id,
                    customer_id=customer_id,
                    stream_name=topic,
                    stream_type="mqtt",
                    plan_tier=plan_tier
                )

            # Subscribe to topic
            self.subscriptions[topic] = callback
            result = self.client.subscribe(topic)

            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Subscribed to MQTT topic: {topic}")
                return True
            else:
                logger.error(f"Failed to subscribe to MQTT topic: {topic}")
                return False

        except Exception as e:
            logger.error(f"MQTT subscription error: {e}")
            return False

    async def publish_message(
        self,
        customer_id: str,
        plan_tier: str,
        topic: str,
        message: Dict[str, Any]
    ) -> bool:
        """Publish message to MQTT topic"""
        try:
            # Check throughput limits
            if self.streaming_enforcement:
                message_size = len(json.dumps(message).encode())

                if not await self.streaming_enforcement.validate_message_size(
                    f"mqtt_{customer_id}_{topic}", message_size
                ):
                    return False

            # Publish message
            payload = json.dumps(message)
            result = self.client.publish(topic, payload)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                # Record activity
                if self.streaming_enforcement:
                    await self.streaming_enforcement.record_streaming_activity(
                        f"mqtt_{customer_id}_{topic}",
                        bytes_processed=len(payload),
                        messages_processed=1
                    )

                logger.debug(f"Published MQTT message to {topic}")
                return True
            else:
                logger.error(f"Failed to publish MQTT message to {topic}")
                return False

        except Exception as e:
            logger.error(f"MQTT publish error: {e}")
            return False

    async def cleanup(self):
        """Cleanup MQTT resources"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()

class WebSocketManager:
    """Enhanced WebSocket manager with plan enforcement"""

    def __init__(self):
        self.connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.streaming_enforcement = None

    async def initialize(self, streaming_enforcement: StreamingEnforcement):
        """Initialize WebSocket manager"""
        self.streaming_enforcement = streaming_enforcement

    async def handle_connection(
        self,
        websocket: websockets.WebSocketServerProtocol,
        customer_id: str,
        plan_tier: str,
        stream_name: str
    ):
        """Handle new WebSocket connection with enforcement"""
        connection_id = f"ws_{customer_id}_{stream_name}"

        try:
            # Check connection limits
            if self.streaming_enforcement:
                can_connect = await self.streaming_enforcement.check_connection_limit(
                    customer_id, plan_tier, "websocket"
                )

                if not can_connect:
                    await websocket.close(code=1008, reason="Connection limit exceeded")
                    return

                # Register connection
                await self.streaming_enforcement.register_connection(
                    connection_id=connection_id,
                    customer_id=customer_id,
                    stream_name=stream_name,
                    stream_type="websocket",
                    plan_tier=plan_tier
                )

            # Store connection
            self.connections[connection_id] = websocket

            logger.info(f"WebSocket connection established: {connection_id}")

            # Handle messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._process_websocket_message(connection_id, customer_id, plan_tier, data)

                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "error": "Invalid JSON message"
                    }))
                except Exception as e:
                    logger.error(f"WebSocket message processing error: {e}")

        except ConnectionClosed:
            logger.info(f"WebSocket connection closed: {connection_id}")
        finally:
            # Cleanup
            if connection_id in self.connections:
                del self.connections[connection_id]

            if self.streaming_enforcement:
                await self.streaming_enforcement.unregister_connection(connection_id)

    async def _process_websocket_message(
        self,
        connection_id: str,
        customer_id: str,
        plan_tier: str,
        data: Dict[str, Any]
    ):
        """Process incoming WebSocket message"""
        message_type = data.get("type", "unknown")

        # Validate message size
        message_size = len(json.dumps(data).encode())
        if self.streaming_enforcement:
            if not await self.streaming_enforcement.validate_message_size(connection_id, message_size):
                await self.send_to_connection(connection_id, {
                    "error": "Message size exceeds limit"
                })
                return

        # Handle different message types
        if message_type == "ping":
            await self.send_to_connection(connection_id, {"type": "pong"})

        elif message_type == "subscribe":
            topic = data.get("topic")
            if topic:
                # Handle subscription logic
                await self.send_to_connection(connection_id, {
                    "type": "subscribed",
                    "topic": topic
                })

        elif message_type == "data":
            # Process data message
            await self._handle_data_message(connection_id, customer_id, data)

        # Record activity
        if self.streaming_enforcement:
            await self.streaming_enforcement.record_streaming_activity(
                connection_id,
                bytes_processed=message_size,
                messages_processed=1
            )

    async def _handle_data_message(self, connection_id: str, customer_id: str, data: Dict[str, Any]):
        """Handle data message from client"""
        # Echo back the data for now
        response = {
            "type": "data_received",
            "timestamp": datetime.utcnow().isoformat(),
            "data": data.get("payload")
        }

        await self.send_to_connection(connection_id, response)

    async def send_to_connection(self, connection_id: str, message: Dict[str, Any]):
        """Send message to specific WebSocket connection"""
        if connection_id in self.connections:
            try:
                websocket = self.connections[connection_id]
                await websocket.send(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send WebSocket message: {e}")

    async def broadcast_to_topic(self, topic: str, message: Dict[str, Any]):
        """Broadcast message to all connections subscribed to a topic"""
        # For simplicity, broadcast to all connections
        # In a real implementation, you'd track topic subscriptions
        disconnected = []

        for connection_id, websocket in self.connections.items():
            try:
                await websocket.send(json.dumps(message))
            except ConnectionClosed:
                disconnected.append(connection_id)
            except Exception as e:
                logger.error(f"Broadcast error to {connection_id}: {e}")

        # Remove disconnected connections
        for connection_id in disconnected:
            if connection_id in self.connections:
                del self.connections[connection_id]

class ServerSentEventsManager:
    """Server-Sent Events implementation"""

    def __init__(self):
        self.clients: Dict[str, asyncio.Queue] = {}

    async def add_client(self, customer_id: str, plan_tier: str) -> str:
        """Add SSE client"""
        client_id = f"sse_{customer_id}_{int(datetime.utcnow().timestamp())}"
        self.clients[client_id] = asyncio.Queue()

        logger.info(f"SSE client added: {client_id}")
        return client_id

    async def remove_client(self, client_id: str):
        """Remove SSE client"""
        if client_id in self.clients:
            del self.clients[client_id]
            logger.info(f"SSE client removed: {client_id}")

    async def send_event(self, client_id: str, event_type: str, data: Dict[str, Any]):
        """Send event to specific client"""
        if client_id in self.clients:
            event = {
                "type": event_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat()
            }

            await self.clients[client_id].put(event)

    async def broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast event to all clients"""
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        for client_queue in self.clients.values():
            try:
                await client_queue.put(event)
            except Exception as e:
                logger.error(f"Failed to send SSE event: {e}")

    async def get_events(self, client_id: str) -> AsyncGenerator[str, None]:
        """Get event stream for client"""
        if client_id not in self.clients:
            return

        queue = self.clients[client_id]

        try:
            while True:
                event = await queue.get()

                # Format as SSE
                sse_data = f"event: {event['type']}\n"
                sse_data += f"data: {json.dumps(event['data'])}\n\n"

                yield sse_data

        except asyncio.CancelledError:
            pass

class AdvancedIntegrationsManager:
    """Main manager for all advanced integration patterns"""

    def __init__(self):
        self.mqtt_integration = MQTTIntegration()
        self.websocket_manager = WebSocketManager()
        self.sse_manager = ServerSentEventsManager()
        self.streaming_enforcement = None
        self.ml_enforcement = None

    async def initialize(
        self,
        streaming_enforcement: StreamingEnforcement,
        ml_enforcement: MLFrameworkEnforcement
    ):
        """Initialize all integration services"""
        self.streaming_enforcement = streaming_enforcement
        self.ml_enforcement = ml_enforcement

        # Initialize individual services
        await self.mqtt_integration.initialize(streaming_enforcement)
        await self.websocket_manager.initialize(streaming_enforcement)

        logger.info("Advanced Integrations Manager initialized")

    def get_graphql_router(self) -> GraphQLRouter:
        """Get GraphQL router for FastAPI"""
        return GraphQLRouter(schema, context_getter=self._get_graphql_context)

    async def _get_graphql_context(self, request):
        """Get GraphQL context with customer information"""
        # Extract customer info from request headers or authentication
        customer_id = request.headers.get("X-Customer-ID", "unknown")
        plan_tier = request.headers.get("X-Plan-Tier", "developer")

        return {
            "customer_id": customer_id,
            "plan_tier": plan_tier,
            "request": request
        }

    async def create_integration(self, config: IntegrationConfig) -> bool:
        """Create new integration based on protocol"""
        try:
            if config.protocol == IntegrationProtocol.MQTT:
                # MQTT integration setup would go here
                return True
            elif config.protocol == IntegrationProtocol.WEBSOCKET:
                # WebSocket integration setup would go here
                return True
            elif config.protocol == IntegrationProtocol.GRAPHQL:
                # GraphQL endpoint is always available
                return True
            else:
                logger.warning(f"Unsupported integration protocol: {config.protocol}")
                return False

        except Exception as e:
            logger.error(f"Failed to create integration: {e}")
            return False

    async def cleanup(self):
        """Cleanup all integration resources"""
        await self.mqtt_integration.cleanup()

# Global instance
advanced_integrations = AdvancedIntegrationsManager()