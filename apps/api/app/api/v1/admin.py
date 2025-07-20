from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

router = APIRouter()

@router.get("/health")
async def admin_health_check():
    """Admin health check endpoint"""
    return {
        "status": "healthy",
        "admin_panel": "operational",
        "features": [
            "User management",
            "System monitoring",
            "Configuration management"
        ]
    } 