from sqlalchemy.orm import Session
from app.core.database import get_db
from datetime import datetime
import asyncio
from app.core.api_config import settings
import httpx
import json
import logging
from typing import Optional

# Import models directly from database.models to avoid circular imports
from app.database.models import ApiKey as APIKey

# Configure logging
logger = logging.getLogger(__name__)

# Generic billing configuration - placeholder for future billing integration
BILLING_API_BASE = "https://api.billing-provider.com/v1"
BILLING_API_KEY = getattr(settings, 'BILLING_API_KEY', None)
RATE_LIMIT_PER_MINUTE = 300  # Standard API rate limit

async def track_api_usage(
    api_key: str,
    operation: str,
    units: int,
    db: Session = None
) -> None:
    """
    Track API usage for billing and monitoring purposes.
    """
    if not db:
        db = next(get_db())
    
    # Create usage record (using a simple tracking approach)
    # Note: You may need to create an APIUsage model if detailed tracking is needed
    try:
        # For now, we'll just update the usage count on the API key
        api_key_record = db.query(APIKey).filter(APIKey.key_hash == api_key).first()
        if api_key_record:
            api_key_record.usage_count = (api_key_record.usage_count or 0) + units
            db.commit()
    except Exception as e:
        logger.warning(f"Could not update usage count for API key: {e}")
        # Continue with billing update even if local tracking fails
    
    # Update billing in background
    asyncio.create_task(update_billing(api_key, operation, units))

async def update_billing(
    api_key: str,
    operation: str,
    units: int
) -> None:
    """
    Update billing information in LemonSqueezy based on API usage.
    """
    try:
        # Get subscription for API key
        db = next(get_db())
        api_key_record = db.query(APIKey).filter(
            APIKey.key_hash == api_key
        ).first()
        
        if not api_key_record:
            logger.warning(f"API key not found: {api_key}")
            return
        
        # Check if API key has associated LemonSqueezy subscription
        if not getattr(api_key_record, 'billing_subscription_id', None):
            # Try to get subscription from user's organization
            if api_key_record.user and api_key_record.user.organization:
                org_subscription_id = getattr(api_key_record.user.organization, 'billing_subscription_id', None)
                if org_subscription_id:
                    # Report usage using organization's subscription
                    await _report_usage_to_billing_provider(
                        org_subscription_id,
                        operation,
                        units
                    )
                    return
            
            logger.warning(f"No LemonSqueezy subscription ID found for API key: {api_key}")
            return
        
        # Report usage to LemonSqueezy using API key's subscription
        await _report_usage_to_billing_provider(
            getattr(api_key_record, 'billing_subscription_id', None),
            operation,
            units
        )
        
    except Exception as e:
        # Log error but don't fail the request
        logger.error(f"Error updating billing for API key {api_key}: {str(e)}")


async def _report_usage_to_billing_provider(
    subscription_id: str,
    operation: str,
    units: int
) -> None:
    """
    Report usage to LemonSqueezy API with rate limiting protection.
    """
    if not BILLING_API_KEY:
        logger.warning("LemonSqueezy API key not configured")
        return
    
    headers = {
        "Authorization": f"Bearer {BILLING_API_KEY}",
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json"
    }
    
    usage_data = {
        "data": {
            "type": "usage-records",
            "attributes": {
                "quantity": units,
                "action": "increment",
                "created_at": datetime.utcnow().isoformat()
            },
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
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{BILLING_API_BASE}/usage-records",
                headers=headers,
                json=usage_data
            )
            
            # Check rate limiting
            if response.status_code == 429:
                logger.warning(f"LemonSqueezy rate limit exceeded. Headers: {response.headers}")
                # Could implement retry logic here
                return
            
            if response.status_code >= 400:
                logger.error(f"LemonSqueezy API error: {response.status_code} - {response.text}")
                return
            
            logger.debug(f"Successfully reported usage to LemonSqueezy: {units} units for operation {operation}")
            
    except Exception as e:
        logger.error(f"Failed to report usage to LemonSqueezy: {str(e)}")


async def get_billing_subscription_usage(
    subscription_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> dict:
    """
    Get usage summary from LemonSqueezy for a subscription.
    """
    if not BILLING_API_KEY:
        logger.warning("LemonSqueezy API key not configured")
        return {}
    
    headers = {
        "Authorization": f"Bearer {BILLING_API_KEY}",
        "Accept": "application/vnd.api+json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Build query parameters for date filtering
            params = {}
            if start_date:
                params['filter[created_at][gte]'] = start_date.isoformat()
            if end_date:
                params['filter[created_at][lte]'] = end_date.isoformat()
            
            response = await client.get(
                f"{BILLING_API_BASE}/subscriptions/{subscription_id}/usage-records",
                headers=headers,
                params=params
            )
            
            if response.status_code == 429:
                logger.warning("LemonSqueezy rate limit exceeded when fetching usage")
                return {"error": "rate_limit_exceeded"}
            
            if response.status_code >= 400:
                logger.error(f"LemonSqueezy API error: {response.status_code} - {response.text}")
                return {"error": "api_error"}
            
            data = response.json()
            return data.get('data', [])
            
    except Exception as e:
        logger.error(f"Failed to fetch usage from LemonSqueezy: {str(e)}")
        return {"error": "request_failed"}


def get_usage_summary(
    api_key: str,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> dict:
    """
    Get usage summary for an API key within a date range.
    Note: This is a simplified version. For detailed tracking, implement an APIUsage model.
    """
    try:
        # Get API key record
        api_key_record = db.query(APIKey).filter(
            APIKey.key_hash == api_key
        ).first()
        
        if not api_key_record:
            return {
                "total_operations": 0,
                "total_units": 0,
                "operations": {},
                "error": "API key not found"
            }
        
        # Return basic summary from API key record
        # For more detailed tracking, you would query an APIUsage table
        summary = {
            "total_operations": 1,  # Placeholder
            "total_units": api_key_record.usage_count or 0,
            "operations": {
                "api_usage": {
                    "count": 1,
                    "units": api_key_record.usage_count or 0
                }
            }
        }
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting usage summary for API key {api_key}: {e}")
        return {
            "total_operations": 0,
            "total_units": 0,
            "operations": {},
            "error": str(e)
        } 