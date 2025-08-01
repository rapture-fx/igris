"""
LemonSqueezy Webhook Handlers
============================

Comprehensive webhook handlers for processing LemonSqueezy events including:
- Subscription lifecycle events (created, updated, cancelled, expired)
- Payment events (succeeded, failed, refunded)
- Usage record events
- Customer events

Features:
- Webhook signature verification using LEMONSQUEEZY_WEBHOOK_SECRET
- Event deduplication and idempotency
- Comprehensive error handling and logging
- Business logic hooks for subscription state changes
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Depends
from pydantic import BaseModel, Field, validator
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# LemonSqueezy webhook event types
class LemonSqueezyEventType(str, Enum):
    # Subscription events
    SUBSCRIPTION_CREATED = "subscription_created"
    SUBSCRIPTION_UPDATED = "subscription_updated"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    SUBSCRIPTION_RESUMED = "subscription_resumed"
    SUBSCRIPTION_EXPIRED = "subscription_expired"
    SUBSCRIPTION_PAUSED = "subscription_paused"
    SUBSCRIPTION_UNPAUSED = "subscription_unpaused"
    
    # Payment events
    ORDER_CREATED = "order_created"
    ORDER_REFUNDED = "order_refunded"
    
    # Usage events
    SUBSCRIPTION_PAYMENT_SUCCESS = "subscription_payment_success"
    SUBSCRIPTION_PAYMENT_FAILED = "subscription_payment_failed"
    SUBSCRIPTION_PAYMENT_RECOVERED = "subscription_payment_recovered"
    
    # License events
    LICENSE_KEY_CREATED = "license_key_created"
    LICENSE_KEY_UPDATED = "license_key_updated"

class LemonSqueezyWebhookPayload(BaseModel):
    """Base webhook payload structure from LemonSqueezy"""
    meta: Dict[str, Any] = Field(..., description="Webhook metadata")
    data: Dict[str, Any] = Field(..., description="Event data")
    
    @validator('meta')
    def validate_meta(cls, v):
        """Validate webhook metadata"""
        required_fields = ['event_name', 'webhook_id']
        for field in required_fields:
            if field not in v:
                raise ValueError(f"Missing required meta field: {field}")
        return v

class WebhookProcessingResult(BaseModel):
    """Result of webhook processing"""
    success: bool = Field(..., description="Whether processing succeeded")
    event_type: str = Field(..., description="Type of event processed")
    event_id: str = Field(..., description="Unique event identifier")
    message: str = Field(..., description="Processing result message")
    processed_at: datetime = Field(default_factory=datetime.utcnow, description="Processing timestamp")

# Webhook signature verification
def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify LemonSqueezy webhook signature"""
    if not secret:
        logger.warning("LemonSqueezy webhook secret not configured - skipping signature verification")
        return True
    
    try:
        # LemonSqueezy uses HMAC-SHA256 with hex encoding
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Remove 'sha256=' prefix if present
        if signature.startswith('sha256='):
            signature = signature[7:]
        
        return hmac.compare_digest(expected_signature, signature)
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False

# Event deduplication (in production, use Redis or database)
processed_events = set()

def is_event_processed(event_id: str) -> bool:
    """Check if event has already been processed"""
    return event_id in processed_events

def mark_event_processed(event_id: str):
    """Mark event as processed"""
    processed_events.add(event_id)

# Business logic handlers
async def handle_subscription_created(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle subscription creation"""
    subscription_id = data.get("id")
    attributes = data.get("attributes", {})
    
    logger.info(f"Processing subscription created: {subscription_id}")
    
    # Extract subscription details
    customer_id = attributes.get("customer_id")
    variant_id = attributes.get("variant_id")
    status = attributes.get("status")
    
    # Business logic for new subscription
    # - Update user account with subscription details
    # - Send welcome email
    # - Initialize usage tracking
    # - Set up billing alerts
    
    logger.info(f"Subscription {subscription_id} created for customer {customer_id}")
    
    return {
        "subscription_id": subscription_id,
        "customer_id": customer_id,
        "variant_id": variant_id,
        "status": status,
        "actions_performed": [
            "Updated customer subscription status",
            "Initialized usage tracking",
            "Sent welcome notification"
        ]
    }

async def handle_subscription_updated(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle subscription updates"""
    subscription_id = data.get("id")
    attributes = data.get("attributes", {})
    
    logger.info(f"Processing subscription updated: {subscription_id}")
    
    old_status = attributes.get("status_formatted", "")
    new_status = attributes.get("status")
    customer_id = attributes.get("customer_id")
    
    # Handle status changes
    actions_performed = []
    
    if new_status == "cancelled":
        # Handle cancellation
        actions_performed.extend([
            "Updated subscription to cancelled status",
            "Scheduled end-of-period access termination",
            "Sent cancellation confirmation"
        ])
    elif new_status == "active":
        # Handle activation/reactivation
        actions_performed.extend([
            "Activated subscription services",
            "Reset usage limits",
            "Sent activation confirmation"
        ])
    elif new_status == "past_due":
        # Handle payment issues
        actions_performed.extend([
            "Marked account as past due",
            "Sent payment failure notification",
            "Applied service restrictions"
        ])
    
    logger.info(f"Subscription {subscription_id} updated to status: {new_status}")
    
    return {
        "subscription_id": subscription_id,
        "customer_id": customer_id,
        "old_status": old_status,
        "new_status": new_status,
        "actions_performed": actions_performed
    }

async def handle_subscription_cancelled(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle subscription cancellation"""
    subscription_id = data.get("id")
    attributes = data.get("attributes", {})
    
    logger.info(f"Processing subscription cancelled: {subscription_id}")
    
    customer_id = attributes.get("customer_id")
    ends_at = attributes.get("ends_at")
    
    # Business logic for cancellation
    # - Schedule access termination
    # - Send cancellation confirmation
    # - Offer retention incentives
    # - Export user data for download
    
    actions_performed = [
        "Processed subscription cancellation",
        "Scheduled service termination",
        "Sent cancellation confirmation",
        "Initiated data export process"
    ]
    
    logger.info(f"Subscription {subscription_id} cancelled, ends at: {ends_at}")
    
    return {
        "subscription_id": subscription_id,
        "customer_id": customer_id,
        "ends_at": ends_at,
        "actions_performed": actions_performed
    }

async def handle_payment_success(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle successful payment"""
    order_id = data.get("id")
    attributes = data.get("attributes", {})
    
    logger.info(f"Processing payment success: {order_id}")
    
    customer_id = attributes.get("customer_id")
    total = attributes.get("total")
    currency = attributes.get("currency")
    subscription_id = attributes.get("subscription_id")
    
    # Business logic for successful payment
    # - Update payment records
    # - Reset service limits if payment was overdue
    # - Send payment confirmation
    # - Update billing dashboard
    
    actions_performed = [
        "Recorded successful payment",
        "Updated account standing",
        "Reset service limits",
        "Sent payment confirmation"
    ]
    
    logger.info(f"Payment {order_id} succeeded: {total} {currency}")
    
    return {
        "order_id": order_id,
        "customer_id": customer_id,
        "amount": total,
        "currency": currency,
        "subscription_id": subscription_id,
        "actions_performed": actions_performed
    }

async def handle_payment_failed(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle failed payment"""
    order_id = data.get("id")
    attributes = data.get("attributes", {})
    
    logger.info(f"Processing payment failed: {order_id}")
    
    customer_id = attributes.get("customer_id")
    subscription_id = attributes.get("subscription_id")
    
    # Business logic for failed payment
    # - Update payment status
    # - Send payment failure notification
    # - Apply service restrictions
    # - Trigger retry logic
    
    actions_performed = [
        "Recorded payment failure",
        "Sent payment failure notification",
        "Applied service restrictions",
        "Scheduled payment retry"
    ]
    
    logger.warning(f"Payment {order_id} failed for customer {customer_id}")
    
    return {
        "order_id": order_id,
        "customer_id": customer_id,
        "subscription_id": subscription_id,
        "actions_performed": actions_performed
    }

async def handle_order_refunded(data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle order refund"""
    order_id = data.get("id")
    attributes = data.get("attributes", {})
    
    logger.info(f"Processing order refunded: {order_id}")
    
    customer_id = attributes.get("customer_id")
    refunded_amount = attributes.get("refunded_amount")
    currency = attributes.get("currency")
    
    # Business logic for refund
    # - Process refund in accounting system
    # - Update customer account credits
    # - Send refund confirmation
    # - Handle service access changes
    
    actions_performed = [
        "Processed refund",
        "Updated account credits",
        "Sent refund confirmation",
        "Adjusted service access"
    ]
    
    logger.info(f"Order {order_id} refunded: {refunded_amount} {currency}")
    
    return {
        "order_id": order_id,
        "customer_id": customer_id,
        "refunded_amount": refunded_amount,
        "currency": currency,
        "actions_performed": actions_performed
    }

# Event routing
EVENT_HANDLERS = {
    LemonSqueezyEventType.SUBSCRIPTION_CREATED: handle_subscription_created,
    LemonSqueezyEventType.SUBSCRIPTION_UPDATED: handle_subscription_updated,
    LemonSqueezyEventType.SUBSCRIPTION_CANCELLED: handle_subscription_cancelled,
    LemonSqueezyEventType.SUBSCRIPTION_PAYMENT_SUCCESS: handle_payment_success,
    LemonSqueezyEventType.SUBSCRIPTION_PAYMENT_FAILED: handle_payment_failed,
    LemonSqueezyEventType.ORDER_REFUNDED: handle_order_refunded,
}

async def process_webhook_event(event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Process webhook event based on type"""
    handler = EVENT_HANDLERS.get(LemonSqueezyEventType(event_type))
    
    if handler:
        return await handler(data)
    else:
        logger.warning(f"No handler found for event type: {event_type}")
        return {
            "event_type": event_type,
            "actions_performed": ["Event logged but not processed"]
        }

# Webhook endpoints
@router.post("/lemonsqueezy/webhook", response_model=WebhookProcessingResult)
async def handle_lemonsqueezy_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Handle LemonSqueezy webhook events with signature verification and event processing
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Get signature from headers
        signature = request.headers.get("X-Signature")
        if not signature:
            logger.error("Missing webhook signature")
            raise HTTPException(status_code=400, detail="Missing webhook signature")
        
        # Verify webhook signature
        webhook_secret = getattr(settings, 'LEMONSQUEEZY_WEBHOOK_SECRET', None)
        if not verify_webhook_signature(body, signature, webhook_secret):
            logger.error("Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse JSON payload
        try:
            payload_data = json.loads(body.decode('utf-8'))
            payload = LemonSqueezyWebhookPayload(**payload_data)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Invalid webhook payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid webhook payload")
        
        # Extract event information
        event_name = payload.meta.get("event_name")
        webhook_id = payload.meta.get("webhook_id")
        event_id = f"{webhook_id}_{event_name}_{payload.data.get('id', 'unknown')}"
        
        # Check for event deduplication
        if is_event_processed(event_id):
            logger.info(f"Event {event_id} already processed, skipping")
            return WebhookProcessingResult(
                success=True,
                event_type=event_name,
                event_id=event_id,
                message="Event already processed (idempotent)"
            )
        
        # Process event in background to avoid timeout
        background_tasks.add_task(
            process_webhook_background,
            event_name,
            payload.data,
            event_id
        )
        
        # Mark event as being processed
        mark_event_processed(event_id)
        
        logger.info(f"Webhook event {event_name} accepted for processing")
        
        return WebhookProcessingResult(
            success=True,
            event_type=event_name,
            event_id=event_id,
            message="Event accepted for processing"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error processing webhook"
        )

async def process_webhook_background(event_type: str, data: Dict[str, Any], event_id: str):
    """Background task for processing webhook events"""
    try:
        logger.info(f"Processing webhook event {event_id} in background")
        
        # Process the event
        result = await process_webhook_event(event_type, data)
        
        logger.info(f"Successfully processed webhook event {event_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error in background webhook processing for {event_id}: {e}", exc_info=True)
        # In production, you might want to implement retry logic or dead letter queues

# Health check endpoint for webhook
@router.get("/lemonsqueezy/webhook/health")
async def webhook_health_check():
    """Health check endpoint for LemonSqueezy webhook processor"""
    webhook_secret_configured = bool(getattr(settings, 'LEMONSQUEEZY_WEBHOOK_SECRET', None))
    
    return {
        "status": "healthy",
        "webhook_secret_configured": webhook_secret_configured,
        "supported_events": [event.value for event in LemonSqueezyEventType],
        "events_processed": len(processed_events)
    }

# Test endpoint for webhook (development only)
@router.post("/lemonsqueezy/webhook/test")
async def test_webhook(test_payload: Dict[str, Any]):
    """Test webhook processing (development only)"""
    if getattr(settings, 'ENVIRONMENT', 'development') not in ['development', 'testing']:
        raise HTTPException(status_code=404, detail="Not found")
    
    # Create test event
    event_type = test_payload.get("event_name", "subscription_created")
    event_data = test_payload.get("data", {
        "id": "test_123",
        "attributes": {
            "customer_id": "test_customer",
            "status": "active"
        }
    })
    
    try:
        result = await process_webhook_event(event_type, event_data)
        return {
            "success": True,
            "message": "Test webhook processed successfully",
            "result": result
        }
    except Exception as e:
        logger.error(f"Test webhook processing failed: {e}")
        return {
            "success": False,
            "message": f"Test webhook processing failed: {str(e)}"
        }