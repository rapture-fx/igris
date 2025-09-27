"""
Self-Service API
Provides customer self-service capabilities to reduce support overhead.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import secrets
import hashlib
import json
import io
from pathlib import Path

from app.middleware.billing_middleware import get_current_user
from app.services.email_service import send_invitation_email, send_support_notification
from app.database.models import APIKey, TeamMember, SupportTicket, Customer

router = APIRouter(prefix="/api/v1/self-service", tags=["self-service"])

# Mock data storage (would be replaced with actual database)
mock_api_keys = {}
mock_team_members = {}
mock_support_tickets = {}
mock_billing_info = {}

@router.get("/api-keys/{customer_id}")
async def get_api_keys(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all API keys for a customer"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock API keys
    api_keys = [
        {
            "id": "key_1",
            "name": "Production API Key",
            "key": "sk_test_" + secrets.token_urlsafe(32),
            "permissions": ["read", "write"],
            "created_at": (datetime.utcnow() - timedelta(days=30)).isoformat(),
            "last_used": datetime.utcnow().isoformat(),
            "is_active": True
        },
        {
            "id": "key_2",
            "name": "Development API Key",
            "key": "sk_test_" + secrets.token_urlsafe(32),
            "permissions": ["read"],
            "created_at": (datetime.utcnow() - timedelta(days=7)).isoformat(),
            "last_used": None,
            "is_active": True
        }
    ]

    return {
        "customer_id": customer_id,
        "api_keys": api_keys
    }

@router.post("/api-keys/{customer_id}")
async def create_api_key(
    customer_id: str,
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a new API key"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    name = request.get("name")
    permissions = request.get("permissions", ["read"])

    if not name:
        raise HTTPException(status_code=400, detail="API key name is required")

    # Generate new API key
    new_key = {
        "id": f"key_{secrets.token_urlsafe(8)}",
        "name": name,
        "key": f"sk_live_{secrets.token_urlsafe(32)}",
        "permissions": permissions,
        "created_at": datetime.utcnow().isoformat(),
        "last_used": None,
        "is_active": True
    }

    return new_key

@router.delete("/api-keys/{customer_id}/{key_id}")
async def revoke_api_key(
    customer_id: str,
    key_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Revoke an API key"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # In a real implementation, you would mark the key as inactive in the database
    return {"status": "revoked", "key_id": key_id}

@router.get("/team/{customer_id}")
async def get_team_members(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get team members for a customer"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock team members
    team_members = [
        {
            "id": "member_1",
            "email": "admin@example.com",
            "role": "admin",
            "status": "active",
            "invited_at": (datetime.utcnow() - timedelta(days=60)).isoformat(),
            "last_login": datetime.utcnow().isoformat()
        },
        {
            "id": "member_2",
            "email": "developer@example.com",
            "role": "member",
            "status": "active",
            "invited_at": (datetime.utcnow() - timedelta(days=30)).isoformat(),
            "last_login": (datetime.utcnow() - timedelta(days=2)).isoformat()
        },
        {
            "id": "member_3",
            "email": "pending@example.com",
            "role": "member",
            "status": "pending",
            "invited_at": (datetime.utcnow() - timedelta(days=3)).isoformat(),
            "last_login": None
        }
    ]

    return {
        "customer_id": customer_id,
        "team_members": team_members
    }

@router.post("/team/{customer_id}/invite")
async def invite_team_member(
    customer_id: str,
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Invite a new team member"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    email = request.get("email")
    role = request.get("role", "member")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Validate role
    if role not in ["member", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    # Create invitation
    invitation = {
        "id": f"member_{secrets.token_urlsafe(8)}",
        "email": email,
        "role": role,
        "status": "pending",
        "invited_at": datetime.utcnow().isoformat(),
        "last_login": None
    }

    # In a real implementation, you would send an invitation email
    # await send_invitation_email(email, customer_id, role)

    return invitation

@router.get("/support/{customer_id}")
async def get_support_tickets(
    customer_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get support tickets for a customer"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock support tickets
    tickets = [
        {
            "id": "ticket_1",
            "subject": "API rate limiting issue",
            "status": "open",
            "priority": "high",
            "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat(),
            "updated_at": (datetime.utcnow() - timedelta(hours=6)).isoformat(),
            "messages_count": 3
        },
        {
            "id": "ticket_2",
            "subject": "How to implement webhooks?",
            "status": "resolved",
            "priority": "medium",
            "created_at": (datetime.utcnow() - timedelta(days=7)).isoformat(),
            "updated_at": (datetime.utcnow() - timedelta(days=5)).isoformat(),
            "messages_count": 5
        },
        {
            "id": "ticket_3",
            "subject": "Documentation clarification",
            "status": "in_progress",
            "priority": "low",
            "created_at": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "updated_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
            "messages_count": 2
        }
    ]

    if status:
        tickets = [t for t in tickets if t["status"] == status]

    return {
        "customer_id": customer_id,
        "tickets": tickets
    }

@router.post("/support/{customer_id}/tickets")
async def create_support_ticket(
    customer_id: str,
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a new support ticket"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    subject = request.get("subject")
    message = request.get("message")
    priority = request.get("priority", "medium")

    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required")

    if priority not in ["low", "medium", "high", "critical"]:
        raise HTTPException(status_code=400, detail="Invalid priority")

    # Create ticket
    ticket = {
        "id": f"ticket_{secrets.token_urlsafe(8)}",
        "subject": subject,
        "status": "open",
        "priority": priority,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "messages_count": 1
    }

    # In a real implementation, you would:
    # 1. Save to database
    # 2. Send notification to support team
    # 3. Send confirmation email to customer

    return ticket

@router.get("/support/{customer_id}/tickets/{ticket_id}")
async def get_support_ticket(
    customer_id: str,
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific support ticket with messages"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock ticket with messages
    ticket = {
        "id": ticket_id,
        "subject": "API rate limiting issue",
        "status": "open",
        "priority": "high",
        "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(hours=6)).isoformat(),
        "messages": [
            {
                "id": "msg_1",
                "sender": "customer",
                "message": "I'm experiencing rate limiting issues with the API...",
                "timestamp": (datetime.utcnow() - timedelta(days=2)).isoformat()
            },
            {
                "id": "msg_2",
                "sender": "support",
                "message": "Hi! I can help you with this. Can you share your API key prefix?",
                "timestamp": (datetime.utcnow() - timedelta(days=1, hours=20)).isoformat()
            },
            {
                "id": "msg_3",
                "sender": "customer",
                "message": "Sure, it's sk_live_abc123...",
                "timestamp": (datetime.utcnow() - timedelta(hours=6)).isoformat()
            }
        ]
    }

    return ticket

@router.post("/support/{customer_id}/tickets/{ticket_id}/messages")
async def add_ticket_message(
    customer_id: str,
    ticket_id: str,
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Add a message to a support ticket"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    message = request.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    new_message = {
        "id": f"msg_{secrets.token_urlsafe(8)}",
        "sender": "customer",
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

    return new_message

@router.get("/billing/{customer_id}")
async def get_billing_info(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get billing information for a customer"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock billing info
    billing_info = {
        "customer_id": customer_id,
        "plan_tier": current_user.get("plan_tier", "growth"),
        "billing_cycle": "monthly",
        "current_usage": {
            "api_calls": 45230,
            "data_processed_gb": 123.5,
            "ml_jobs": 28
        },
        "limits": {
            "api_calls": 100000,
            "data_processed_gb": 200,
            "ml_jobs": 50
        },
        "next_billing_date": (datetime.utcnow() + timedelta(days=15)).isoformat(),
        "current_cost": 99.00
    }

    return billing_info

@router.get("/billing/{customer_id}/invoices")
async def get_invoices(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get billing invoices for a customer"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock invoices
    invoices = [
        {
            "id": "inv_1",
            "amount": 99.00,
            "status": "paid",
            "date": (datetime.utcnow() - timedelta(days=30)).isoformat(),
            "download_url": f"/api/v1/self-service/billing/{customer_id}/invoices/inv_1/download"
        },
        {
            "id": "inv_2",
            "amount": 89.00,
            "status": "paid",
            "date": (datetime.utcnow() - timedelta(days=60)).isoformat(),
            "download_url": f"/api/v1/self-service/billing/{customer_id}/invoices/inv_2/download"
        }
    ]

    return {
        "customer_id": customer_id,
        "invoices": invoices
    }

@router.get("/billing/{customer_id}/invoices/{invoice_id}/download")
async def download_invoice(
    customer_id: str,
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download an invoice PDF"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Generate mock PDF content
    pdf_content = f"""
    INVOICE {invoice_id}

    Customer: {customer_id}
    Date: {datetime.utcnow().strftime('%Y-%m-%d')}

    This is a mock invoice for demonstration purposes.
    """

    # Create in-memory file
    buffer = io.BytesIO()
    buffer.write(pdf_content.encode())
    buffer.seek(0)

    return StreamingResponse(
        io.BytesIO(buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice_{invoice_id}.pdf"}
    )

@router.get("/docs/{customer_id}/download")
async def download_api_docs(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download API documentation PDF"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Generate mock documentation content
    doc_content = f"""
    SCHLEP-ENGINE API DOCUMENTATION

    Customer: {customer_id}
    Plan: {current_user.get('plan_tier', 'growth')}
    Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}

    This is a personalized API documentation for your account.

    Your API endpoints:
    - GET /api/v1/data
    - POST /api/v1/data-processing
    - GET /api/v1/ml/models

    Authentication:
    Use your API key in the Authorization header:
    Authorization: Bearer YOUR_API_KEY

    Rate Limits:
    Your current plan allows up to 1000 requests per hour.
    """

    # Create in-memory file
    buffer = io.BytesIO()
    buffer.write(doc_content.encode())
    buffer.seek(0)

    return StreamingResponse(
        io.BytesIO(buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=schlep-engine-api-docs-{customer_id}.pdf"}
    )

@router.get("/account/{customer_id}/settings")
async def get_account_settings(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get account settings"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    settings = {
        "customer_id": customer_id,
        "company_name": "Example Corp",
        "contact_email": "admin@example.com",
        "timezone": "UTC",
        "webhook_url": "https://api.example.com/webhooks/schlep",
        "notifications": {
            "email_alerts": True,
            "usage_warnings": True,
            "billing_notifications": True,
            "security_alerts": True
        },
        "api_settings": {
            "rate_limit_notifications": True,
            "error_notifications": True,
            "maintenance_notifications": True
        }
    }

    return settings

@router.put("/account/{customer_id}/settings")
async def update_account_settings(
    customer_id: str,
    settings: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update account settings"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # In a real implementation, you would validate and save the settings
    # For now, just return the updated settings
    return {
        "status": "updated",
        "settings": settings
    }

@router.get("/account/{customer_id}/activity")
async def get_account_activity(
    customer_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get account activity log"""
    if current_user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Mock activity log
    activities = [
        {
            "id": "activity_1",
            "type": "api_key_created",
            "description": "New API key 'Production API Key' created",
            "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0..."
        },
        {
            "id": "activity_2",
            "type": "team_member_invited",
            "description": "Team member invited: developer@example.com",
            "timestamp": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0..."
        },
        {
            "id": "activity_3",
            "type": "login",
            "description": "User logged in",
            "timestamp": (datetime.utcnow() - timedelta(days=2)).isoformat(),
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0..."
        }
    ]

    return {
        "customer_id": customer_id,
        "activities": activities[:limit]
    }

@router.get("/status")
async def get_service_status():
    """Get current service status (public endpoint)"""
    status_info = {
        "overall_status": "operational",
        "services": {
            "api": {
                "status": "operational",
                "uptime": 99.98,
                "response_time": 245
            },
            "data_processing": {
                "status": "operational",
                "uptime": 99.95,
                "response_time": 1200
            },
            "ml_services": {
                "status": "operational",
                "uptime": 99.92,
                "response_time": 3400
            },
            "webhooks": {
                "status": "operational",
                "uptime": 99.99,
                "response_time": 156
            }
        },
        "incidents": [],
        "last_updated": datetime.utcnow().isoformat()
    }

    return status_info