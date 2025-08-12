"""
Billing and Subscription Middleware for LemonSqueezy Integration
================================================================

This middleware provides subscription-aware rate limiting and usage tracking
integrated with LemonSqueezy billing system.

Features:
- Subscription tier-based rate limiting
- Real-time usage tracking
- Billing alerts and notifications
- Payment status enforcement
- Trial period handling
- Usage-based billing integration

Usage:
    app.add_middleware(BillingMiddleware)
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, Tuple
from enum import Enum
from datetime import datetime, timedelta

from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.api.v1.billing import LemonSqueezyClient, get_lemonsqueezy_client, SubscriptionStatus, calculate_usage_cost
from app.middleware.rate_limiting_middleware import RateLimitConfig, RateLimitType, rate_limiter

logger = logging.getLogger(__name__)

class SubscriptionTier(str, Enum):
    """Subscription tiers with different limits"""
    FREE = "free"
    STARTER = "starter" 
    PRO = "pro"
    ENTERPRISE = "enterprise"

class BillingEventType(str, Enum):
    """Types of billing events to track"""
    API_REQUEST = "api_request"
    DATA_PROCESSING = "data_processing"
    ML_OPERATION = "ml_operation"
    STORAGE_USAGE = "storage_usage"

# Subscription tier configurations
SUBSCRIPTION_LIMITS = {
    SubscriptionTier.FREE: {
        "requests_per_minute": 10,
        "requests_per_hour": 100,
        "requests_per_day": 1000,
        "data_processing_mb_per_day": 100,
        "ml_operations_per_day": 5,
        "storage_gb": 1,
        "concurrent_jobs": 1
    },
    SubscriptionTier.STARTER: {
        "requests_per_minute": 60,
        "requests_per_hour": 1000,
        "requests_per_day": 10000,
        "data_processing_mb_per_day": 1000,
        "ml_operations_per_day": 50,
        "storage_gb": 10,
        "concurrent_jobs": 3
    },
    SubscriptionTier.PRO: {
        "requests_per_minute": 300,
        "requests_per_hour": 10000,
        "requests_per_day": 100000,
        "data_processing_mb_per_day": 10000,
        "ml_operations_per_day": 500,
        "storage_gb": 100,
        "concurrent_jobs": 10
    },
    SubscriptionTier.ENTERPRISE: {
        "requests_per_minute": 1000,
        "requests_per_hour": 50000,
        "requests_per_day": 1000000,
        "data_processing_mb_per_day": 100000,
        "ml_operations_per_day": 5000,
        "storage_gb": 1000,
        "concurrent_jobs": 50
    }
}

class BillingContext:
    """Context for billing and subscription information"""
    
    def __init__(self):
        self.customer_id: Optional[str] = None
        self.subscription_id: Optional[str] = None
        self.subscription_status: Optional[SubscriptionStatus] = None
        self.subscription_tier: SubscriptionTier = SubscriptionTier.FREE
        self.trial_ends_at: Optional[datetime] = None
        self.subscription_limits: Dict[str, Any] = SUBSCRIPTION_LIMITS[SubscriptionTier.FREE]
        self.usage_today: Dict[str, int] = {}
        self.is_payment_overdue: bool = False
        self.billing_alerts: list = []

class UsageTracker:
    """Track and persist usage data for billing"""
    
    def __init__(self):
        self._usage_cache = {}
        self._cache_ttl = 300  # 5 minutes
    
    async def record_usage(
        self,
        customer_id: str,
        event_type: BillingEventType,
        quantity: int = 1,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Record usage event"""
        try:
            # Cache usage locally to reduce API calls
            cache_key = f"{customer_id}:{event_type.value}:{datetime.now().strftime('%Y-%m-%d')}"
            current_time = time.time()
            
            if cache_key in self._usage_cache:
                cache_entry = self._usage_cache[cache_key]
                if current_time - cache_entry["timestamp"] < self._cache_ttl:
                    cache_entry["quantity"] += quantity
                    cache_entry["events"].append({
                        "timestamp": current_time,
                        "quantity": quantity,
                        "metadata": metadata
                    })
                    return
            
            # Initialize or reset cache entry
            self._usage_cache[cache_key] = {
                "quantity": quantity,
                "timestamp": current_time,
                "events": [{
                    "timestamp": current_time,
                    "quantity": quantity,
                    "metadata": metadata
                }]
            }
            
            # Periodically flush to LemonSqueezy (every 100 requests or 5 minutes)
            if len(self._usage_cache[cache_key]["events"]) >= 100 or \
               current_time - self._usage_cache[cache_key]["timestamp"] >= self._cache_ttl:
                await self._flush_usage_to_lemonsqueezy(customer_id, event_type, cache_key)
                
        except Exception as e:
            logger.error(f"Error recording usage: {e}")
    
    async def _flush_usage_to_lemonsqueezy(self, customer_id: str, event_type: BillingEventType, cache_key: str):
        """Flush cached usage to LemonSqueezy"""
        try:
            if not getattr(settings, 'LEMONSQUEEZY_API_KEY', None):
                return
                
            cache_entry = self._usage_cache.get(cache_key)
            if not cache_entry:
                return
            
            client = get_lemonsqueezy_client()
            
            # In a real implementation, you would get the subscription ID from the customer
            # For now, we'll log the usage locally
            logger.info(f"Would flush usage to LemonSqueezy: {customer_id}, {event_type.value}, {cache_entry['quantity']} units")
            
            # Clear cache after successful flush
            del self._usage_cache[cache_key]
            
        except Exception as e:
            logger.error(f"Error flushing usage to LemonSqueezy: {e}")
    
    async def get_daily_usage(self, customer_id: str, date: datetime = None) -> Dict[str, int]:
        """Get usage for a specific day"""
        if not date:
            date = datetime.now()
        
        date_str = date.strftime('%Y-%m-%d')
        usage = {}
        
        for event_type in BillingEventType:
            cache_key = f"{customer_id}:{event_type.value}:{date_str}"
            if cache_key in self._usage_cache:
                usage[event_type.value] = self._usage_cache[cache_key]["quantity"]
            else:
                usage[event_type.value] = 0
        
        return usage

class BillingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for subscription-aware billing and rate limiting
    """
    
    def __init__(
        self,
        app,
        enabled: bool = True,
        track_usage: bool = True,
        enforce_limits: bool = True,
        send_billing_alerts: bool = True
    ):
        super().__init__(app)
        self.enabled = enabled
        self.track_usage = track_usage
        self.enforce_limits = enforce_limits
        self.send_billing_alerts = send_billing_alerts
        self.usage_tracker = UsageTracker()
        self._billing_cache = {}
        self._cache_ttl = 300  # 5 minutes
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        
        # Skip billing middleware for health checks and static assets
        skip_paths = {'/health', '/metrics', '/docs', '/openapi.json', '/static'}
        if any(request.url.path.startswith(path) for path in skip_paths):
            return await call_next(request)
        
        try:
            # Extract billing context
            billing_context = await self._get_billing_context(request)
            
            # Add billing context to request state
            request.state.billing_context = billing_context
            
            # Check subscription and payment status
            if self.enforce_limits:
                enforcement_result = await self._enforce_subscription_limits(request, billing_context)
                if enforcement_result:
                    return enforcement_result
            
            # Track usage before processing request
            if self.track_usage and billing_context.customer_id:
                await self.usage_tracker.record_usage(
                    billing_context.customer_id,
                    BillingEventType.API_REQUEST,
                    1,
                    {
                        "path": request.url.path,
                        "method": request.method,
                        "user_agent": request.headers.get("user-agent", "unknown")
                    }
                )
            
            # Process the request
            response = await call_next(request)
            
            # Add billing headers to response
            await self._add_billing_headers(response, billing_context)
            
            # Send billing alerts if needed
            if self.send_billing_alerts and billing_context.billing_alerts:
                await self._send_billing_alerts(billing_context)
            
            return response
            
        except Exception as e:
            logger.error(f"Billing middleware error: {e}")
            # Continue processing if billing middleware fails
            return await call_next(request)
    
    async def _get_billing_context(self, request: Request) -> BillingContext:
        """Extract billing context from request"""
        context = BillingContext()
        
        try:
            # Extract customer/user information from various sources
            customer_id = None
            api_key = request.headers.get("X-API-Key")
            auth_header = request.headers.get("Authorization")
            
            # Try to get customer ID from API key or auth header
            # In a real implementation, you would look this up in your user database
            if api_key:
                # Mock: derive customer ID from API key
                import hashlib
                customer_id = f"cust_{hashlib.md5(api_key.encode()).hexdigest()[:8]}"
            elif auth_header and auth_header.startswith("Bearer "):
                # Extract from JWT token
                # In a real implementation, decode the JWT and get customer ID
                customer_id = "cust_from_jwt"
            
            if not customer_id:
                return context  # Return default free tier context
            
            context.customer_id = customer_id
            
            # Check cache first
            cache_key = f"billing_context:{customer_id}"
            current_time = time.time()
            
            if cache_key in self._billing_cache:
                cached_entry = self._billing_cache[cache_key]
                if current_time - cached_entry["timestamp"] < self._cache_ttl:
                    return cached_entry["context"]
            
            # Fetch subscription information from LemonSqueezy
            try:
                if getattr(settings, 'LEMONSQUEEZY_API_KEY', None):
                    client = get_lemonsqueezy_client()
                    subscriptions_response = await client.get_customer_subscriptions(customer_id)
                    subscriptions = subscriptions_response.get("data", [])
                    
                    if subscriptions:
                        # Use the first active subscription
                        active_subs = [s for s in subscriptions if s.get("attributes", {}).get("status") == "active"]
                        subscription_data = active_subs[0] if active_subs else subscriptions[0]
                        
                        context.subscription_id = subscription_data["id"]
                        context.subscription_status = SubscriptionStatus(
                            subscription_data.get("attributes", {}).get("status", "active")
                        )
                        
                        # Determine tier based on variant or plan
                        variant_name = subscription_data.get("attributes", {}).get("variant_name", "").lower()
                        if "enterprise" in variant_name:
                            context.subscription_tier = SubscriptionTier.ENTERPRISE
                        elif "pro" in variant_name:
                            context.subscription_tier = SubscriptionTier.PRO
                        elif "starter" in variant_name:
                            context.subscription_tier = SubscriptionTier.STARTER
                        else:
                            context.subscription_tier = SubscriptionTier.FREE
                        
                        # Set trial information
                        trial_ends_at = subscription_data.get("attributes", {}).get("trial_ends_at")
                        if trial_ends_at:
                            context.trial_ends_at = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
                        
                        # Check payment status
                        context.is_payment_overdue = context.subscription_status in [
                            SubscriptionStatus.PAST_DUE, SubscriptionStatus.UNPAID
                        ]
            
            except Exception as e:
                logger.warning(f"Could not fetch subscription info for {customer_id}: {e}")
                # Continue with free tier defaults
            
            # Set subscription limits
            context.subscription_limits = SUBSCRIPTION_LIMITS[context.subscription_tier]
            
            # Get today's usage
            context.usage_today = await self.usage_tracker.get_daily_usage(customer_id)
            
            # Generate billing alerts
            context.billing_alerts = await self._generate_billing_alerts(context)
            
            # Cache the context
            self._billing_cache[cache_key] = {
                "context": context,
                "timestamp": current_time
            }
            
            return context
            
        except Exception as e:
            logger.error(f"Error getting billing context: {e}")
            return context  # Return default context
    
    async def _enforce_subscription_limits(self, request: Request, context: BillingContext) -> Optional[Response]:
        """Enforce subscription-based limits"""
        
        # Check payment status
        if context.is_payment_overdue:
            return Response(
                content="Payment overdue. Please update your payment method.",
                status_code=402,  # Payment Required
                headers={"Content-Type": "text/plain"}
            )
        
        # Check if trial has expired
        if context.trial_ends_at and context.trial_ends_at < datetime.now() and \
           context.subscription_status != SubscriptionStatus.ACTIVE:
            return Response(
                content="Trial period has expired. Please subscribe to continue using the service.",
                status_code=402,
                headers={"Content-Type": "text/plain"}
            )
        
        # Check daily limits
        limits = context.subscription_limits
        usage = context.usage_today
        
        # API request limits
        if usage.get("api_request", 0) >= limits.get("requests_per_day", 0):
            return Response(
                content=f"Daily API request limit ({limits['requests_per_day']}) exceeded. Upgrade your plan for higher limits.",
                status_code=429,
                headers={
                    "Content-Type": "text/plain",
                    "X-Daily-Limit": str(limits['requests_per_day']),
                    "X-Daily-Usage": str(usage.get("api_request", 0))
                }
            )
        
        # Apply subscription-aware rate limiting
        rate_config = RateLimitConfig(
            requests_per_minute=limits.get("requests_per_minute"),
            requests_per_hour=limits.get("requests_per_hour"),
            requests_per_day=limits.get("requests_per_day"),
            rate_limit_type=RateLimitType.USER_BASED,
            error_message=f"Rate limit exceeded for {context.subscription_tier.value} plan"
        )
        
        allowed, results = await rate_limiter.check_rate_limit(
            request, rate_config, context.customer_id
        )
        
        if not allowed:
            retry_after = max(
                result.get("retry_after", 0) 
                for result in results.values() 
                if isinstance(result, dict)
            )
            
            return Response(
                content=f"Rate limit exceeded for {context.subscription_tier.value} plan. Upgrade for higher limits.",
                status_code=429,
                headers={
                    "Retry-After": str(retry_after),
                    "X-Subscription-Tier": context.subscription_tier.value,
                    "Content-Type": "text/plain"
                }
            )
        
        return None  # Allow request to proceed
    
    async def _add_billing_headers(self, response: Response, context: BillingContext):
        """Add billing-related headers to response"""
        try:
            limits = context.subscription_limits
            usage = context.usage_today
            
            # Add subscription information headers
            response.headers["X-Subscription-Tier"] = context.subscription_tier.value
            response.headers["X-Subscription-Status"] = context.subscription_status.value if context.subscription_status else "unknown"
            
            # Add usage headers
            response.headers["X-Daily-Requests-Remaining"] = str(
                max(0, limits.get("requests_per_day", 0) - usage.get("api_request", 0))
            )
            response.headers["X-Daily-Requests-Limit"] = str(limits.get("requests_per_day", 0))
            
            # Add trial information if applicable
            if context.trial_ends_at:
                days_remaining = (context.trial_ends_at - datetime.now()).days
                response.headers["X-Trial-Days-Remaining"] = str(max(0, days_remaining))
            
            # Add billing alerts count
            if context.billing_alerts:
                response.headers["X-Billing-Alerts"] = str(len(context.billing_alerts))
                
        except Exception as e:
            logger.error(f"Error adding billing headers: {e}")
    
    async def _generate_billing_alerts(self, context: BillingContext) -> list:
        """Generate billing alerts based on usage and subscription status"""
        alerts = []
        
        try:
            limits = context.subscription_limits
            usage = context.usage_today
            
            # Check usage thresholds
            api_usage_percent = (usage.get("api_request", 0) / limits.get("requests_per_day", 1)) * 100
            
            if api_usage_percent >= 90:
                alerts.append("You've used 90% of your daily API requests")
            elif api_usage_percent >= 75:
                alerts.append("You've used 75% of your daily API requests")
            
            # Check trial expiration
            if context.trial_ends_at:
                days_remaining = (context.trial_ends_at - datetime.now()).days
                if days_remaining <= 3:
                    alerts.append(f"Your trial expires in {days_remaining} days")
            
            # Check payment status
            if context.is_payment_overdue:
                alerts.append("Payment is overdue. Please update your payment method")
            
            # Check subscription status
            if context.subscription_status == SubscriptionStatus.CANCELLED:
                alerts.append("Your subscription has been cancelled")
            
        except Exception as e:
            logger.error(f"Error generating billing alerts: {e}")
        
        return alerts
    
    async def _send_billing_alerts(self, context: BillingContext):
        """Send billing alerts (placeholder for notification system)"""
        try:
            for alert in context.billing_alerts[:3]:  # Limit to 3 alerts to avoid spam
                logger.info(f"Billing alert for {context.customer_id}: {alert}")
                # In a real implementation, you would:
                # - Send email notifications
                # - Push to notification system
                # - Update dashboard alerts
                # - Send webhooks
                
        except Exception as e:
            logger.error(f"Error sending billing alerts: {e}")

# Helper functions for tracking specific usage types
async def track_data_processing_usage(customer_id: str, bytes_processed: int):
    """Track data processing usage"""
    middleware = BillingMiddleware(None)  # Create instance for usage tracker access
    await middleware.usage_tracker.record_usage(
        customer_id,
        BillingEventType.DATA_PROCESSING,
        bytes_processed // (1024 * 1024),  # Convert to MB
        {"bytes_processed": bytes_processed}
    )

async def track_ml_operation_usage(customer_id: str, operation_type: str, duration_seconds: float):
    """Track ML operation usage"""
    middleware = BillingMiddleware(None)
    await middleware.usage_tracker.record_usage(
        customer_id,
        BillingEventType.ML_OPERATION,
        1,
        {"operation_type": operation_type, "duration_seconds": duration_seconds}
    )

async def track_storage_usage(customer_id: str, bytes_stored: int):
    """Track storage usage"""
    middleware = BillingMiddleware(None)
    await middleware.usage_tracker.record_usage(
        customer_id,
        BillingEventType.STORAGE_USAGE,
        bytes_stored // (1024 * 1024 * 1024),  # Convert to GB
        {"bytes_stored": bytes_stored}
    )

# Export components
__all__ = [
    'BillingMiddleware',
    'BillingContext',
    'SubscriptionTier',
    'BillingEventType',
    'track_data_processing_usage',
    'track_ml_operation_usage',
    'track_storage_usage'
]