"""
Advanced Integration Patterns API
FastAPI endpoints for GraphQL, MQTT, WebSocket, and SSE integrations.
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse
from typing import Dict, List, Any, Optional
import json
import asyncio
import logging

from app.services.advanced_integrations import (
    advanced_integrations,
    IntegrationConfig,
    IntegrationProtocol
)
from app.middleware.billing_middleware import get_current_user
from app.middleware.streaming_enforcement import StreamingEnforcement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/integrations", tags=["advanced-integrations"])

# Plan tier restrictions for advanced integrations
PROTOCOL_RESTRICTIONS = {
    "developer": {IntegrationProtocol.WEBSOCKET},
    "growth": {IntegrationProtocol.WEBSOCKET, IntegrationProtocol.GRAPHQL, IntegrationProtocol.MQTT},
    "scale": {
        IntegrationProtocol.WEBSOCKET,
        IntegrationProtocol.GRAPHQL,
        IntegrationProtocol.MQTT,
        IntegrationProtocol.GRPC,
        IntegrationProtocol.SERVER_SENT_EVENTS
    }
}

@router.post("/create")
async def create_integration(
    config: IntegrationConfig,
    current_user: dict = Depends(get_current_user)
):
    """Create a new advanced integration"""
    customer_id = current_user.get("customer_id")
    plan_tier = current_user.get("plan_tier", "developer")

    # Check if protocol is allowed for plan tier
    allowed_protocols = PROTOCOL_RESTRICTIONS.get(plan_tier, set())
    if config.protocol not in allowed_protocols:
        raise HTTPException(
            status_code=403,
            detail=f"Protocol {config.protocol} not available in {plan_tier} plan"
        )

    # Override config with actual customer info
    config.customer_id = customer_id
    config.plan_tier = plan_tier

    success = await advanced_integrations.create_integration(config)

    if success:
        return {
            "status": "created",
            "integration_id": f"{config.protocol}_{customer_id}",
            "protocol": config.protocol,
            "endpoint_url": config.endpoint_url
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to create integration")

@router.get("/protocols")
async def get_available_protocols(current_user: dict = Depends(get_current_user)):
    """Get available integration protocols for current plan"""
    plan_tier = current_user.get("plan_tier", "developer")
    allowed_protocols = PROTOCOL_RESTRICTIONS.get(plan_tier, set())

    return {
        "plan_tier": plan_tier,
        "available_protocols": list(allowed_protocols),
        "protocol_details": {
            "websocket": {
                "description": "Real-time bidirectional communication",
                "use_cases": ["Live data streams", "Real-time notifications", "Chat systems"],
                "limitations": _get_protocol_limitations("websocket", plan_tier)
            },
            "graphql": {
                "description": "Flexible query language for APIs",
                "use_cases": ["Complex data queries", "Real-time subscriptions", "Efficient data fetching"],
                "limitations": _get_protocol_limitations("graphql", plan_tier)
            },
            "mqtt": {
                "description": "Lightweight messaging for IoT",
                "use_cases": ["IoT device communication", "Sensor data", "Event-driven architectures"],
                "limitations": _get_protocol_limitations("mqtt", plan_tier)
            },
            "sse": {
                "description": "Server-sent events for real-time updates",
                "use_cases": ["Live dashboards", "Progress notifications", "Real-time alerts"],
                "limitations": _get_protocol_limitations("sse", plan_tier)
            }
        }
    }

@router.websocket("/websocket/{stream_name}")
async def websocket_endpoint(
    websocket: WebSocket,
    stream_name: str,
    customer_id: Optional[str] = None,
    plan_tier: Optional[str] = None
):
    """WebSocket endpoint for real-time communication"""
    await websocket.accept()

    # Extract customer info from query params or headers
    if not customer_id:
        customer_id = websocket.query_params.get("customer_id", "unknown")
    if not plan_tier:
        plan_tier = websocket.query_params.get("plan_tier", "developer")

    # Check if WebSocket is allowed for plan
    allowed_protocols = PROTOCOL_RESTRICTIONS.get(plan_tier, set())
    if IntegrationProtocol.WEBSOCKET not in allowed_protocols:
        await websocket.close(code=1008, reason="WebSocket not available in your plan")
        return

    # Handle the connection
    await advanced_integrations.websocket_manager.handle_connection(
        websocket, customer_id, plan_tier, stream_name
    )

@router.post("/mqtt/subscribe")
async def mqtt_subscribe(
    topic: str,
    current_user: dict = Depends(get_current_user)
):
    """Subscribe to MQTT topic"""
    customer_id = current_user.get("customer_id")
    plan_tier = current_user.get("plan_tier", "developer")

    # Check MQTT availability
    allowed_protocols = PROTOCOL_RESTRICTIONS.get(plan_tier, set())
    if IntegrationProtocol.MQTT not in allowed_protocols:
        raise HTTPException(
            status_code=403,
            detail="MQTT not available in your plan"
        )

    # Create callback function
    async def message_callback(topic: str, payload: Dict):
        logger.info(f"MQTT message received on {topic}: {payload}")
        # Here you could forward to webhooks, store in database, etc.

    success = await advanced_integrations.mqtt_integration.subscribe_topic(
        customer_id, plan_tier, topic, message_callback
    )

    if success:
        return {"status": "subscribed", "topic": topic}
    else:
        raise HTTPException(status_code=500, detail="Failed to subscribe to MQTT topic")

@router.post("/mqtt/publish")
async def mqtt_publish(
    topic: str,
    message: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Publish message to MQTT topic"""
    customer_id = current_user.get("customer_id")
    plan_tier = current_user.get("plan_tier", "developer")

    # Check MQTT availability
    allowed_protocols = PROTOCOL_RESTRICTIONS.get(plan_tier, set())
    if IntegrationProtocol.MQTT not in allowed_protocols:
        raise HTTPException(
            status_code=403,
            detail="MQTT not available in your plan"
        )

    success = await advanced_integrations.mqtt_integration.publish_message(
        customer_id, plan_tier, topic, message
    )

    if success:
        return {"status": "published", "topic": topic}
    else:
        raise HTTPException(status_code=500, detail="Failed to publish MQTT message")

@router.get("/sse/stream")
async def sse_stream(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Server-Sent Events stream"""
    customer_id = current_user.get("customer_id")
    plan_tier = current_user.get("plan_tier", "developer")

    # Check SSE availability
    allowed_protocols = PROTOCOL_RESTRICTIONS.get(plan_tier, set())
    if IntegrationProtocol.SERVER_SENT_EVENTS not in allowed_protocols:
        raise HTTPException(
            status_code=403,
            detail="Server-Sent Events not available in your plan"
        )

    # Create SSE client
    client_id = await advanced_integrations.sse_manager.add_client(customer_id, plan_tier)

    async def event_generator():
        try:
            # Send initial connection event
            yield f"event: connected\ndata: {json.dumps({'client_id': client_id, 'timestamp': 'now'})}\n\n"

            # Get event stream
            async for event_data in advanced_integrations.sse_manager.get_events(client_id):
                yield event_data

        except asyncio.CancelledError:
            pass
        finally:
            await advanced_integrations.sse_manager.remove_client(client_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@router.post("/sse/send")
async def sse_send_event(
    event_type: str,
    data: Dict[str, Any],
    client_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Send event through SSE"""
    customer_id = current_user.get("customer_id")

    if client_id:
        # Send to specific client
        await advanced_integrations.sse_manager.send_event(client_id, event_type, data)
        return {"status": "sent", "target": "client", "client_id": client_id}
    else:
        # Broadcast to all clients
        await advanced_integrations.sse_manager.broadcast_event(event_type, data)
        return {"status": "sent", "target": "broadcast"}

@router.get("/websocket/connections")
async def get_websocket_connections(current_user: dict = Depends(get_current_user)):
    """Get active WebSocket connections for customer"""
    customer_id = current_user.get("customer_id")

    # Filter connections for this customer
    customer_connections = {
        conn_id: "active" for conn_id in advanced_integrations.websocket_manager.connections.keys()
        if conn_id.startswith(f"ws_{customer_id}_")
    }

    return {
        "customer_id": customer_id,
        "active_connections": len(customer_connections),
        "connections": customer_connections
    }

@router.post("/websocket/broadcast")
async def websocket_broadcast(
    topic: str,
    message: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Broadcast message to WebSocket topic"""
    await advanced_integrations.websocket_manager.broadcast_to_topic(topic, message)

    return {"status": "broadcasted", "topic": topic}

@router.get("/status")
async def get_integration_status(current_user: dict = Depends(get_current_user)):
    """Get overall integration status for customer"""
    customer_id = current_user.get("customer_id")
    plan_tier = current_user.get("plan_tier", "developer")

    # Get active connections and usage
    websocket_connections = len([
        conn_id for conn_id in advanced_integrations.websocket_manager.connections.keys()
        if conn_id.startswith(f"ws_{customer_id}_")
    ])

    sse_clients = len([
        client_id for client_id in advanced_integrations.sse_manager.clients.keys()
        if client_id.startswith(f"sse_{customer_id}_")
    ])

    return {
        "customer_id": customer_id,
        "plan_tier": plan_tier,
        "available_protocols": list(PROTOCOL_RESTRICTIONS.get(plan_tier, set())),
        "active_connections": {
            "websocket": websocket_connections,
            "sse": sse_clients,
            "mqtt": "connected" if advanced_integrations.mqtt_integration.client else "disconnected"
        },
        "usage_limits": _get_usage_limits(plan_tier)
    }

@router.delete("/connections/{connection_type}")
async def close_connections(
    connection_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Close all connections of a specific type for customer"""
    customer_id = current_user.get("customer_id")

    closed_count = 0

    if connection_type == "websocket":
        # Close WebSocket connections
        to_close = [
            conn_id for conn_id in advanced_integrations.websocket_manager.connections.keys()
            if conn_id.startswith(f"ws_{customer_id}_")
        ]

        for conn_id in to_close:
            if conn_id in advanced_integrations.websocket_manager.connections:
                await advanced_integrations.websocket_manager.connections[conn_id].close()
                closed_count += 1

    elif connection_type == "sse":
        # Close SSE clients
        to_close = [
            client_id for client_id in advanced_integrations.sse_manager.clients.keys()
            if client_id.startswith(f"sse_{customer_id}_")
        ]

        for client_id in to_close:
            await advanced_integrations.sse_manager.remove_client(client_id)
            closed_count += 1

    return {
        "status": "closed",
        "connection_type": connection_type,
        "closed_count": closed_count
    }

def _get_protocol_limitations(protocol: str, plan_tier: str) -> Dict[str, Any]:
    """Get protocol-specific limitations for plan tier"""
    limitations = {
        "websocket": {
            "developer": {"max_connections": 2, "max_message_size_kb": 100},
            "growth": {"max_connections": 10, "max_message_size_kb": 500},
            "scale": {"max_connections": 100, "max_message_size_kb": 1000}
        },
        "graphql": {
            "developer": {"query_complexity": 100, "query_depth": 5},
            "growth": {"query_complexity": 500, "query_depth": 10},
            "scale": {"query_complexity": 2000, "query_depth": 20}
        },
        "mqtt": {
            "developer": {"not_available": True},
            "growth": {"max_subscriptions": 10, "max_message_size_kb": 100},
            "scale": {"max_subscriptions": 100, "max_message_size_kb": 1000}
        },
        "sse": {
            "developer": {"not_available": True},
            "growth": {"not_available": True},
            "scale": {"max_clients": 50, "max_events_per_minute": 1000}
        }
    }

    return limitations.get(protocol, {}).get(plan_tier, {})

def _get_usage_limits(plan_tier: str) -> Dict[str, Any]:
    """Get usage limits for plan tier"""
    limits = {
        "developer": {
            "max_concurrent_connections": 2,
            "max_daily_messages": 1000,
            "max_message_size_kb": 100
        },
        "growth": {
            "max_concurrent_connections": 20,
            "max_daily_messages": 100000,
            "max_message_size_kb": 500
        },
        "scale": {
            "max_concurrent_connections": 200,
            "max_daily_messages": 10000000,
            "max_message_size_kb": 1000
        }
    }

    return limits.get(plan_tier, limits["developer"])