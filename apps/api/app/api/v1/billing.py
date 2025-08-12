from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta
import aiohttp
import asyncio
from enum import Enum
from app.core.config import settings

router = APIRouter()

# LemonSqueezy API configuration
LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1"
LEMONSQUEEZY_API_KEY = getattr(settings, 'LEMONSQUEEZY_API_KEY', None)
LEMONSQUEEZY_WEBHOOK_SECRET = getattr(settings, 'LEMONSQUEEZY_WEBHOOK_SECRET', None)

# Enums for LemonSqueezy integration
class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    ON_TRIAL = "on_trial"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    PAUSED = "paused"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"

class UsageRecordType(str, Enum):
    API_REQUESTS = "api_requests"
    DATA_PROCESSED = "data_processed"
    STORAGE_USED = "storage_used"
    ML_OPERATIONS = "ml_operations"

# Pydantic models for LemonSqueezy integration
class Usage(BaseModel):
    total_requests: int = Field(..., description="Total API requests made")
    data_processed: int = Field(..., description="Total data processed in bytes")
    storage_used: int = Field(0, description="Storage used in bytes")
    ml_operations: int = Field(0, description="ML operations performed")
    cost: float = Field(..., description="Total cost for the period")
    period: str = Field(..., description="Time period for usage")
    currency: str = Field("USD", description="Currency code")

class SubscriptionInfo(BaseModel):
    id: str = Field(..., description="LemonSqueezy subscription ID")
    status: SubscriptionStatus = Field(..., description="Current subscription status")
    variant_id: str = Field(..., description="Product variant ID")
    variant_name: str = Field(..., description="Product variant name")
    customer_id: str = Field(..., description="Customer ID")
    renews_at: Optional[datetime] = Field(None, description="Next renewal date")
    ends_at: Optional[datetime] = Field(None, description="Subscription end date")
    trial_ends_at: Optional[datetime] = Field(None, description="Trial end date")
    price: float = Field(..., description="Subscription price")
    currency: str = Field("USD", description="Currency code")
    created_at: datetime = Field(..., description="Subscription creation date")
    updated_at: datetime = Field(..., description="Last update date")

class PaymentInfo(BaseModel):
    id: str = Field(..., description="Payment ID")
    amount: float = Field(..., description="Payment amount")
    currency: str = Field("USD", description="Currency code")
    status: PaymentStatus = Field(..., description="Payment status")
    created_at: datetime = Field(..., description="Payment creation date")
    subscription_id: Optional[str] = Field(None, description="Associated subscription ID")

class UsageRecord(BaseModel):
    id: str = Field(..., description="Usage record ID")
    subscription_id: str = Field(..., description="Associated subscription ID")
    type: UsageRecordType = Field(..., description="Type of usage")
    quantity: int = Field(..., description="Usage quantity")
    timestamp: datetime = Field(..., description="Usage timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class BillingOverview(BaseModel):
    subscription: Optional[SubscriptionInfo] = Field(None, description="Current subscription")
    usage: Usage = Field(..., description="Current usage statistics")
    recent_payments: List[PaymentInfo] = Field([], description="Recent payments")
    usage_records: List[UsageRecord] = Field([], description="Recent usage records")
    next_invoice_date: Optional[datetime] = Field(None, description="Next invoice date")
    billing_alerts: List[str] = Field([], description="Billing alerts and notifications")

# LemonSqueezy API client
class LemonSqueezyClient:
    """Client for interacting with LemonSqueezy API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = LEMONSQUEEZY_API_BASE
        self.headers = {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key}"
        }
    
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict:
        """Make authenticated request to LemonSqueezy API"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    json=data,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 429:
                        # Handle rate limiting
                        retry_after = response.headers.get('Retry-After', '60')
                        raise HTTPException(
                            status_code=429,
                            detail=f"LemonSqueezy API rate limit exceeded. Retry after {retry_after} seconds."
                        )
                    
                    if response.status >= 400:
                        error_detail = response_data.get('errors', [{}])[0].get('detail', 'Unknown error')
                        raise HTTPException(
                            status_code=response.status,
                            detail=f"LemonSqueezy API error: {error_detail}"
                        )
                    
                    return response_data
        
        except aiohttp.ClientError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to connect to LemonSqueezy API: {str(e)}"
            )
    
    async def get_subscription(self, subscription_id: str) -> Dict:
        """Get subscription details"""
        return await self._make_request("GET", f"subscriptions/{subscription_id}")
    
    async def get_customer_subscriptions(self, customer_id: str) -> Dict:
        """Get all subscriptions for a customer"""
        params = {"filter[customer_id]": customer_id}
        return await self._make_request("GET", "subscriptions", params=params)
    
    async def create_usage_record(self, subscription_id: str, usage_data: Dict) -> Dict:
        """Create a usage record"""
        data = {
            "data": {
                "type": "subscription-usage-records",
                "attributes": usage_data,
                "relationships": {
                    "subscription": {
                        "data": {
                            "type": "subscriptions",
                            "id": subscription_id
                        }
                    }
                }
            }
        }
        return await self._make_request("POST", "subscription-usage-records", data=data)
    
    async def get_usage_records(self, subscription_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict:
        """Get usage records for a subscription"""
        params = {"filter[subscription_id]": subscription_id}
        if start_date:
            params["filter[created_at_gte]"] = start_date
        if end_date:
            params["filter[created_at_lte]"] = end_date
        
        return await self._make_request("GET", "subscription-usage-records", params=params)
    
    async def get_payments(self, customer_id: str, limit: int = 10) -> Dict:
        """Get recent payments for a customer"""
        params = {
            "filter[customer_id]": customer_id,
            "page[size]": str(limit),
            "sort": "-created_at"
        }
        return await self._make_request("GET", "orders", params=params)

# Initialize LemonSqueezy client
def get_lemonsqueezy_client() -> LemonSqueezyClient:
    """Get initialized LemonSqueezy client"""
    if not LEMONSQUEEZY_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="LemonSqueezy API key not configured"
        )
    return LemonSqueezyClient(LEMONSQUEEZY_API_KEY)

# Helper functions
def parse_lemonsqueezy_subscription(data: Dict) -> SubscriptionInfo:
    """Parse LemonSqueezy subscription data into our model"""
    attributes = data.get("attributes", {})
    
    return SubscriptionInfo(
        id=data["id"],
        status=SubscriptionStatus(attributes.get("status", "active")),
        variant_id=str(attributes.get("variant_id", "")),
        variant_name=attributes.get("variant_name", ""),
        customer_id=str(attributes.get("customer_id", "")),
        renews_at=datetime.fromisoformat(attributes["renews_at"].replace("Z", "+00:00")) if attributes.get("renews_at") else None,
        ends_at=datetime.fromisoformat(attributes["ends_at"].replace("Z", "+00:00")) if attributes.get("ends_at") else None,
        trial_ends_at=datetime.fromisoformat(attributes["trial_ends_at"].replace("Z", "+00:00")) if attributes.get("trial_ends_at") else None,
        price=float(attributes.get("unit_price", 0)) / 100,  # Convert from cents
        currency=attributes.get("currency", "USD").upper(),
        created_at=datetime.fromisoformat(attributes["created_at"].replace("Z", "+00:00")),
        updated_at=datetime.fromisoformat(attributes["updated_at"].replace("Z", "+00:00"))
    )

def parse_lemonsqueezy_payment(data: Dict) -> PaymentInfo:
    """Parse LemonSqueezy payment data into our model"""
    attributes = data.get("attributes", {})
    
    return PaymentInfo(
        id=data["id"],
        amount=float(attributes.get("total", 0)) / 100,  # Convert from cents
        currency=attributes.get("currency", "USD").upper(),
        status=PaymentStatus(attributes.get("status", "pending")),
        created_at=datetime.fromisoformat(attributes["created_at"].replace("Z", "+00:00")),
        subscription_id=str(attributes.get("subscription_id")) if attributes.get("subscription_id") else None
    )

def calculate_usage_cost(usage_data: Usage, subscription: Optional[SubscriptionInfo] = None) -> float:
    """Calculate cost based on usage data and subscription"""
    # Basic usage-based pricing logic
    base_cost = 0.0
    
    # API requests pricing (example: $0.001 per request after 1000 free)
    if usage_data.total_requests > 1000:
        base_cost += (usage_data.total_requests - 1000) * 0.001
    
    # Data processing pricing (example: $0.1 per GB)
    data_gb = usage_data.data_processed / (1024 ** 3)
    if data_gb > 1.0:  # 1GB free
        base_cost += (data_gb - 1.0) * 0.1
    
    # Storage pricing (example: $0.023 per GB per month)
    storage_gb = usage_data.storage_used / (1024 ** 3)
    if storage_gb > 5.0:  # 5GB free
        base_cost += (storage_gb - 5.0) * 0.023
    
    # ML operations pricing (example: $0.01 per operation)
    if usage_data.ml_operations > 100:
        base_cost += (usage_data.ml_operations - 100) * 0.01
    
    return round(base_cost, 2)

@router.get("/usage", response_model=Usage)
async def get_usage(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    customer_id: Optional[str] = Query(None, description="Customer ID for filtering"),
    client: LemonSqueezyClient = Depends(get_lemonsqueezy_client)
):
    """Get usage statistics and billing information from LemonSqueezy"""
    try:
        # Set default date range if not provided
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        # For now, return calculated usage based on internal metrics
        # In a real implementation, you would fetch this from your usage tracking system
        
        # Mock internal usage data - replace with real data from your system
        total_requests = 5420
        data_processed = 85_000_000  # bytes
        storage_used = 2_500_000_000  # bytes
        ml_operations = 245
        
        usage_data = Usage(
            total_requests=total_requests,
            data_processed=data_processed,
            storage_used=storage_used,
            ml_operations=ml_operations,
            cost=0.0,  # Will be calculated
            period=f"{start_date} to {end_date}",
            currency="USD"
        )
        
        # Calculate cost based on usage
        usage_data.cost = calculate_usage_cost(usage_data)
        
        # If customer_id is provided, try to get subscription info for better pricing
        if customer_id:
            try:
                subscriptions_response = await client.get_customer_subscriptions(customer_id)
                subscriptions = subscriptions_response.get("data", [])
                
                if subscriptions:
                    # Use the first active subscription for pricing calculations
                    subscription_data = subscriptions[0]
                    subscription = parse_lemonsqueezy_subscription(subscription_data)
                    usage_data.cost = calculate_usage_cost(usage_data, subscription)
            except HTTPException:
                # Continue with basic pricing if subscription fetch fails
                pass
        
        return usage_data
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve usage data: {str(e)}"
        )

@router.get("/subscription/{subscription_id}", response_model=SubscriptionInfo)
async def get_subscription(
    subscription_id: str,
    client: LemonSqueezyClient = Depends(get_lemonsqueezy_client)
):
    """Get subscription details from LemonSqueezy"""
    try:
        response = await client.get_subscription(subscription_id)
        subscription_data = response.get("data")
        
        if not subscription_data:
            raise HTTPException(
                status_code=404,
                detail="Subscription not found"
            )
        
        return parse_lemonsqueezy_subscription(subscription_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve subscription: {str(e)}"
        )

@router.get("/customer/{customer_id}/subscriptions", response_model=List[SubscriptionInfo])
async def get_customer_subscriptions(
    customer_id: str,
    client: LemonSqueezyClient = Depends(get_lemonsqueezy_client)
):
    """Get all subscriptions for a customer"""
    try:
        response = await client.get_customer_subscriptions(customer_id)
        subscriptions_data = response.get("data", [])
        
        return [parse_lemonsqueezy_subscription(sub) for sub in subscriptions_data]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve customer subscriptions: {str(e)}"
        )

@router.post("/usage-record", response_model=Dict[str, Any])
async def create_usage_record(
    subscription_id: str,
    usage_type: UsageRecordType,
    quantity: int,
    metadata: Optional[Dict[str, Any]] = None,
    client: LemonSqueezyClient = Depends(get_lemonsqueezy_client)
):
    """Create a usage record in LemonSqueezy"""
    try:
        usage_data = {
            "quantity": quantity,
            "action": "increment",
            "usage_type": usage_type.value
        }
        
        if metadata:
            usage_data["metadata"] = metadata
        
        response = await client.create_usage_record(subscription_id, usage_data)
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create usage record: {str(e)}"
        )

@router.get("/customer/{customer_id}/payments", response_model=List[PaymentInfo])
async def get_customer_payments(
    customer_id: str,
    limit: int = Query(10, description="Number of payments to retrieve"),
    client: LemonSqueezyClient = Depends(get_lemonsqueezy_client)
):
    """Get recent payments for a customer"""
    try:
        response = await client.get_payments(customer_id, limit)
        payments_data = response.get("data", [])
        
        return [parse_lemonsqueezy_payment(payment) for payment in payments_data]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve customer payments: {str(e)}"
        )

@router.get("/overview/{customer_id}", response_model=BillingOverview)
async def get_billing_overview(
    customer_id: str,
    client: LemonSqueezyClient = Depends(get_lemonsqueezy_client)
):
    """Get comprehensive billing overview for a customer"""
    try:
        # Fetch subscription, usage, and payment data concurrently
        subscriptions_task = client.get_customer_subscriptions(customer_id)
        payments_task = client.get_payments(customer_id, 5)
        
        subscriptions_response, payments_response = await asyncio.gather(
            subscriptions_task,
            payments_task,
            return_exceptions=True
        )
        
        # Parse subscriptions
        current_subscription = None
        if not isinstance(subscriptions_response, Exception):
            subscriptions_data = subscriptions_response.get("data", [])
            if subscriptions_data:
                # Get the most recent active subscription
                active_subs = [sub for sub in subscriptions_data if sub.get("attributes", {}).get("status") == "active"]
                if active_subs:
                    current_subscription = parse_lemonsqueezy_subscription(active_subs[0])
                elif subscriptions_data:
                    current_subscription = parse_lemonsqueezy_subscription(subscriptions_data[0])
        
        # Parse payments
        recent_payments = []
        if not isinstance(payments_response, Exception):
            payments_data = payments_response.get("data", [])
            recent_payments = [parse_lemonsqueezy_payment(payment) for payment in payments_data]
        
        # Get current month usage
        start_date = datetime.now().replace(day=1).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Mock usage data - replace with real usage tracking
        usage_data = Usage(
            total_requests=5420,
            data_processed=85_000_000,
            storage_used=2_500_000_000,
            ml_operations=245,
            cost=calculate_usage_cost(Usage(
                total_requests=5420,
                data_processed=85_000_000,
                storage_used=2_500_000_000,
                ml_operations=245,
                cost=0.0,
                period=f"{start_date} to {end_date}"
            ), current_subscription),
            period=f"{start_date} to {end_date}"
        )
        
        # Generate billing alerts
        billing_alerts = []
        if usage_data.cost > 100:
            billing_alerts.append("High usage detected this month")
        if current_subscription and current_subscription.status == SubscriptionStatus.PAST_DUE:
            billing_alerts.append("Payment is past due")
        if current_subscription and current_subscription.trial_ends_at and current_subscription.trial_ends_at < datetime.now():
            billing_alerts.append("Trial period has ended")
        
        return BillingOverview(
            subscription=current_subscription,
            usage=usage_data,
            recent_payments=recent_payments,
            usage_records=[],  # Would be populated with real usage records
            next_invoice_date=current_subscription.renews_at if current_subscription else None,
            billing_alerts=billing_alerts
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve billing overview: {str(e)}"
        ) 