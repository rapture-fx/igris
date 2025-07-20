from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import uuid

router = APIRouter()

# Pydantic models
class MarketplaceIntegration(BaseModel):
    id: str
    name: str
    description: str
    category: str
    provider: str
    rating: float
    price: float
    revenue_share: float
    is_certified: bool
    documentation_url: str
    api_endpoints: List[str]

# Mock data for demonstration
mock_integrations = [
    {
        "id": "1",
        "name": "Advanced Data Validator",
        "description": "Machine learning-powered data validation service",
        "category": "validation",
        "provider": "DataCorp Inc",
        "rating": 4.8,
        "price": 29.99,
        "revenue_share": 15.0,
        "is_certified": True,
        "documentation_url": "https://docs.datacorp.com/validator",
        "api_endpoints": [
            "POST /api/v1/validate/advanced",
            "GET /api/v1/validate/status/{job_id}"
        ]
    },
    {
        "id": "2",
        "name": "Smart Data Cleaner",
        "description": "AI-powered data cleaning and normalization",
        "category": "data_cleaning",
        "provider": "CleanTech Solutions",
        "rating": 4.6,
        "price": 39.99,
        "revenue_share": 20.0,
        "is_certified": True,
        "documentation_url": "https://docs.cleantech.com/cleaner",
        "api_endpoints": [
            "POST /api/v1/clean/smart",
            "POST /api/v1/clean/normalize"
        ]
    },
    {
        "id": "3",
        "name": "Data Transformer Pro",
        "description": "Advanced data transformation pipelines",
        "category": "transformation",
        "provider": "TransformIO",
        "rating": 4.5,
        "price": 49.99,
        "revenue_share": 25.0,
        "is_certified": False,
        "documentation_url": "https://docs.transformio.com/pro",
        "api_endpoints": [
            "POST /api/v1/transform/pipeline",
            "GET /api/v1/transform/templates"
        ]
    }
]

@router.get("/integrations", response_model=List[MarketplaceIntegration])
async def get_marketplace_integrations():
    """Get all marketplace integrations"""
    return mock_integrations

@router.post("/integrations/{integration_id}/subscribe")
async def subscribe_to_integration(integration_id: str):
    """Subscribe to a marketplace integration"""
    integration = next((i for i in mock_integrations if i["id"] == integration_id), None)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {
        "message": f"Successfully subscribed to {integration['name']}",
        "integration_id": integration_id,
        "billing_info": {
            "monthly_cost": integration["price"],
            "revenue_share": integration["revenue_share"]
        }
    } 