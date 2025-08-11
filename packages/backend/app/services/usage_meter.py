from sqlalchemy.orm import Session
from app.models.api_usage import APIUsage
from app.core.database import get_db
from datetime import datetime
import asyncio
from app.core.api_config import settings
import stripe

stripe.api_key = settings.STRIPE_API_KEY

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
    
    # Create usage record
    usage = APIUsage(
        api_key=api_key,
        operation=operation,
        units=units,
        timestamp=datetime.utcnow()
    )
    
    db.add(usage)
    db.commit()
    
    # Update billing in background
    asyncio.create_task(update_billing(api_key, operation, units))

async def update_billing(
    api_key: str,
    operation: str,
    units: int
) -> None:
    """
    Update billing information in Stripe based on API usage.
    """
    try:
        # Get subscription for API key
        db = next(get_db())
        subscription = db.query(APIKey).filter(
            APIKey.key == api_key
        ).first().subscription
        
        if not subscription or not subscription.stripe_subscription_id:
            return
        
        # Get usage-based price ID from subscription
        price_id = subscription.usage_price_id
        
        # Report usage to Stripe
        stripe.SubscriptionItem.create_usage_record(
            subscription.stripe_subscription_item_id,
            quantity=units,
            timestamp=int(datetime.utcnow().timestamp()),
            action='increment'
        )
        
    except Exception as e:
        # Log error but don't fail the request
        print(f"Error updating billing: {str(e)}")

def get_usage_summary(
    api_key: str,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> dict:
    """
    Get usage summary for an API key within a date range.
    """
    usage = db.query(APIUsage).filter(
        APIUsage.api_key == api_key,
        APIUsage.timestamp >= start_date,
        APIUsage.timestamp <= end_date
    ).all()
    
    summary = {
        "total_operations": len(usage),
        "total_units": sum(u.units for u in usage),
        "operations": {}
    }
    
    # Group by operation type
    for u in usage:
        if u.operation not in summary["operations"]:
            summary["operations"][u.operation] = {
                "count": 0,
                "units": 0
            }
        summary["operations"][u.operation]["count"] += 1
        summary["operations"][u.operation]["units"] += u.units
    
    return summary 