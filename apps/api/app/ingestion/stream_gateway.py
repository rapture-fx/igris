"""
Lightweight streaming gateway for real-time ML pipelines
Supports NATS JetStream (primary) and ZeroMQ (fallback)
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from typing import Optional, Dict, Any, AsyncGenerator
from pydantic import BaseModel, Field
from enum import Enum
import asyncio
import json
from datetime import datetime

from app.core.logging_config import get_logger
from app.core.metrics import metrics_collector

logger = get_logger(__name__)

router = APIRouter()


class StreamProtocol(str, Enum):
    """Supported streaming protocols"""
    NATS = "nats"
    ZEROMQ = "zeromq"
    WEBSOCKET = "websocket"


class StreamConfig(BaseModel):
    """Stream configuration"""
    stream_name: str = Field(..., description="Unique stream identifier")
    protocol: StreamProtocol = Field(StreamProtocol.NATS, description="Streaming protocol")
    batch_size: int = Field(1000, description="Micro-batch size for processing")
    max_buffer_mb: int = Field(100, description="Max buffer size in MB")
    enable_backpressure: bool = Field(True, description="Enable backpressure handling")
    apply_preprocessing: bool = Field(True, description="Apply Rust kernels in real-time")


class StreamMessage(BaseModel):
    """Stream message schema"""
    stream_name: str
    sequence_id: int
    timestamp: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class StreamGateway:
    """Unified streaming gateway supporting NATS and ZeroMQ"""

    def __init__(self):
        self.nats_client = None
        self.zmq_context = None
        self.active_streams: Dict[str, Any] = {}

    async def initialize_nats(self, url: str = "nats://localhost:4222"):
        """Initialize NATS JetStream client"""
        try:
            # Import NATS async client
            import nats
            from nats.js import JetStreamContext

            self.nats_client = await nats.connect(url)
            self.js = self.nats_client.jetstream()

            logger.info(f"NATS JetStream connected: {url}")
            return True

        except Exception as e:
            logger.warning(f"Failed to initialize NATS: {e}. Will use ZeroMQ fallback.")
            return False

    async def initialize_zeromq(self):
        """Initialize ZeroMQ as fallback"""
        try:
            import zmq
            import zmq.asyncio

            self.zmq_context = zmq.asyncio.Context()
            logger.info("ZeroMQ initialized as fallback")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize ZeroMQ: {e}")
            return False

    async def publish_to_stream(
        self,
        stream_name: str,
        data: Dict[str, Any],
        protocol: StreamProtocol = StreamProtocol.NATS
    ):
        """Publish message to stream"""

        message = StreamMessage(
            stream_name=stream_name,
            sequence_id=0,  # TODO: Implement sequence tracking
            timestamp=datetime.utcnow().isoformat(),
            data=data
        )

        if protocol == StreamProtocol.NATS and self.nats_client:
            try:
                # Publish to NATS JetStream
                ack = await self.js.publish(
                    f"schlep.{stream_name}",
                    json.dumps(message.dict()).encode()
                )
                logger.debug(f"Published to NATS stream {stream_name}: {ack.seq}")
                return {"status": "published", "sequence": ack.seq}

            except Exception as e:
                logger.error(f"NATS publish failed: {e}")
                # Fallback to ZeroMQ
                return await self._publish_zmq(stream_name, message)

        elif protocol == StreamProtocol.ZEROMQ or not self.nats_client:
            return await self._publish_zmq(stream_name, message)

    async def _publish_zmq(self, stream_name: str, message: StreamMessage):
        """Publish to ZeroMQ (fallback)"""
        try:
            import zmq

            if not self.zmq_context:
                await self.initialize_zeromq()

            socket = self.zmq_context.socket(zmq.PUB)
            socket.bind(f"tcp://*:5555")  # TODO: Make configurable

            await socket.send_multipart([
                stream_name.encode(),
                json.dumps(message.dict()).encode()
            ])

            logger.debug(f"Published to ZeroMQ stream {stream_name}")
            return {"status": "published", "protocol": "zeromq"}

        except Exception as e:
            logger.error(f"ZeroMQ publish failed: {e}")
            raise

    async def subscribe_to_stream(
        self,
        stream_name: str,
        protocol: StreamProtocol = StreamProtocol.NATS
    ) -> AsyncGenerator[StreamMessage, None]:
        """Subscribe to stream and yield messages"""

        if protocol == StreamProtocol.NATS and self.nats_client:
            try:
                # Subscribe to NATS JetStream
                psub = await self.js.pull_subscribe(
                    f"schlep.{stream_name}",
                    durable=f"consumer-{stream_name}"
                )

                while True:
                    try:
                        messages = await psub.fetch(batch=10, timeout=1.0)
                        for msg in messages:
                            data = json.loads(msg.data.decode())
                            yield StreamMessage(**data)
                            await msg.ack()

                    except asyncio.TimeoutError:
                        await asyncio.sleep(0.1)
                        continue

            except Exception as e:
                logger.error(f"NATS subscription failed: {e}")
                # Fallback to ZeroMQ
                async for msg in self._subscribe_zmq(stream_name):
                    yield msg

        else:
            async for msg in self._subscribe_zmq(stream_name):
                yield msg

    async def _subscribe_zmq(self, stream_name: str) -> AsyncGenerator[StreamMessage, None]:
        """Subscribe to ZeroMQ (fallback)"""
        try:
            import zmq

            if not self.zmq_context:
                await self.initialize_zeromq()

            socket = self.zmq_context.socket(zmq.SUB)
            socket.connect("tcp://localhost:5555")
            socket.setsockopt_string(zmq.SUBSCRIBE, stream_name)

            while True:
                topic, message_data = await socket.recv_multipart()
                data = json.loads(message_data.decode())
                yield StreamMessage(**data)

        except Exception as e:
            logger.error(f"ZeroMQ subscription failed: {e}")
            raise

    async def cleanup(self):
        """Cleanup resources"""
        if self.nats_client:
            await self.nats_client.close()

        if self.zmq_context:
            self.zmq_context.term()


# Global gateway instance
stream_gateway = StreamGateway()


@router.on_event("startup")
async def startup_streaming():
    """Initialize streaming on startup"""
    # Try NATS first, fallback to ZeroMQ
    nats_ok = await stream_gateway.initialize_nats()
    if not nats_ok:
        await stream_gateway.initialize_zeromq()


@router.on_event("shutdown")
async def shutdown_streaming():
    """Cleanup streaming on shutdown"""
    await stream_gateway.cleanup()


@router.post("/stream/publish")
async def publish_stream_message(
    stream_name: str,
    data: Dict[str, Any],
    protocol: StreamProtocol = StreamProtocol.NATS
):
    """
    Publish a message to a stream

    Supports NATS JetStream (primary) and ZeroMQ (fallback)
    """
    try:
        result = await stream_gateway.publish_to_stream(
            stream_name=stream_name,
            data=data,
            protocol=protocol
        )

        # Record metrics
        metrics_collector.record_business_event(
            "stream_message_published",
            metadata={
                "stream_name": stream_name,
                "protocol": protocol.value
            }
        )

        return result

    except Exception as e:
        logger.error(f"Stream publish failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stream publish failed: {str(e)}")


@router.websocket("/stream/subscribe/{stream_name}")
async def subscribe_stream_websocket(websocket: WebSocket, stream_name: str):
    """
    Subscribe to a stream via WebSocket
    Real-time message delivery to clients
    """
    await websocket.accept()

    try:
        async for message in stream_gateway.subscribe_to_stream(stream_name):
            await websocket.send_json(message.dict())

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for stream {stream_name}")

    except Exception as e:
        logger.error(f"Stream subscription error: {str(e)}")
        await websocket.close(code=1011, reason=str(e))


@router.post("/stream/batch-publish")
async def batch_publish_stream_messages(
    stream_name: str,
    messages: list[Dict[str, Any]],
    protocol: StreamProtocol = StreamProtocol.NATS
):
    """
    Batch publish multiple messages to a stream
    Optimized for high-throughput scenarios
    """
    results = []

    for msg_data in messages:
        try:
            result = await stream_gateway.publish_to_stream(
                stream_name=stream_name,
                data=msg_data,
                protocol=protocol
            )
            results.append({"status": "success", "result": result})

        except Exception as e:
            results.append({"status": "error", "error": str(e)})

    # Record batch metrics
    success_count = sum(1 for r in results if r["status"] == "success")
    metrics_collector.record_business_event(
        "stream_batch_published",
        metadata={
            "stream_name": stream_name,
            "protocol": protocol.value,
            "total": len(messages),
            "success": success_count
        }
    )

    return {
        "stream_name": stream_name,
        "total_messages": len(messages),
        "successful": success_count,
        "failed": len(messages) - success_count,
        "results": results
    }
