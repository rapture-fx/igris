from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

router = APIRouter()

# Pydantic models
class Usage(BaseModel):
    total_requests: int
    data_processed: int
    cost: float
    period: str

# Mock data for demonstration
def generate_mock_usage(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Generate mock usage data"""
    return {
        "total_requests": random.randint(100, 10000),
        "data_processed": random.randint(1000, 100000),
        "cost": round(random.uniform(10.0, 500.0), 2),
        "period": f"{start_date or '2024-01-01'} to {end_date or '2024-01-31'}"
    }

@router.get("/usage", response_model=Usage)
async def get_usage(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get usage statistics and billing information"""
    return generate_mock_usage(start_date, end_date) 