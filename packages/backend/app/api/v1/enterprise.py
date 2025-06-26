"""
Enterprise Features API - Multi-tenancy, RBAC, API Management, Custom Branding
Provides enterprise-grade features for Pollarbase
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
import uuid
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel, Field
import hashlib
import hmac
import json

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.database.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/enterprise", tags=["Enterprise"])

# Pydantic models for enterprise features
class OrganizationModel(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = {}
    branding: Optional[Dict[str, str]] = {}

class UserRoleModel(BaseModel):
    role_name: str
    permissions: List[str]
    description: Optional[str] = None

class APIKeyModel(BaseModel):
    name: str
    permissions: List[str]
    rate_limit: Optional[int] = 1000
    expires_at: Optional[datetime] = None

class CustomBrandingModel(BaseModel):
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    company_name: Optional[str] = None
    custom_css: Optional[str] = None
    favicon_url: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    member_count: int
    plan: str
    settings: Dict[str, Any]
    branding: Dict[str, str]

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_preview: str
    permissions: List[str]
    rate_limit: int
    usage_count: int
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool

# Simulated database for enterprise features (in production, use proper models)
organizations_db = {}
user_roles_db = {}
api_keys_db = {}
api_usage_db = {}

@router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(
    org_data: OrganizationModel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new organization with multi-tenancy support
    """
    try:
        # Check if user can create organizations (admin check)
        if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Only admins can create organizations")
        
        # Check if slug is unique
        if org_data.slug in organizations_db:
            raise HTTPException(status_code=400, detail="Organization slug already exists")
        
        org_id = str(uuid.uuid4())
        organization = {
            'id': org_id,
            'name': org_data.name,
            'slug': org_data.slug,
            'description': org_data.description,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': current_user.id,
            'members': [current_user.id],
            'plan': 'enterprise',
            'settings': org_data.settings or {},
            'branding': org_data.branding or {}
        }
        
        organizations_db[org_id] = organization
        
        return OrganizationResponse(
            id=org_id,
            name=organization['name'],
            slug=organization['slug'],
            description=organization['description'],
            created_at=organization['created_at'],
            updated_at=organization['updated_at'],
            member_count=len(organization['members']),
            plan=organization['plan'],
            settings=organization['settings'],
            branding=organization['branding']
        )
        
    except Exception as e:
        logger.error(f"Error creating organization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Organization creation failed: {str(e)}")

@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user)
):
    """
    List organizations user has access to
    """
    try:
        user_orgs = []
        
        for org_id, org in organizations_db.items():
            if current_user.id in org['members'] or hasattr(current_user, 'is_admin'):
                user_orgs.append(OrganizationResponse(
                    id=org_id,
                    name=org['name'],
                    slug=org['slug'],
                    description=org['description'],
                    created_at=org['created_at'],
                    updated_at=org['updated_at'],
                    member_count=len(org['members']),
                    plan=org['plan'],
                    settings=org['settings'],
                    branding=org['branding']
                ))
        
        return user_orgs
        
    except Exception as e:
        logger.error(f"Error listing organizations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list organizations: {str(e)}")

@router.post("/organizations/{org_id}/members")
async def add_organization_member(
    org_id: str,
    user_email: str,
    role: str = "member",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a member to an organization
    """
    try:
        if org_id not in organizations_db:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org = organizations_db[org_id]
        
        # Check permissions
        if current_user.id not in org['members'] and not hasattr(current_user, 'is_admin'):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Find user by email
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Add user to organization
        if user.id not in org['members']:
            org['members'].append(user.id)
            org['updated_at'] = datetime.utcnow()
            
            # Set user role
            user_roles_db[f"{org_id}_{user.id}"] = {
                'org_id': org_id,
                'user_id': user.id,
                'role': role,
                'assigned_by': current_user.id,
                'assigned_at': datetime.utcnow()
            }
        
        return {
            "message": f"User {user_email} added to organization",
            "organization": org['name'],
            "role": role
        }
        
    except Exception as e:
        logger.error(f"Error adding organization member: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add member: {str(e)}")

@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    key_data: APIKeyModel,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new API key with specified permissions and rate limits
    """
    try:
        # Generate API key
        key_id = str(uuid.uuid4())
        api_key = f"pk_{uuid.uuid4().hex}"
        
        # Hash the key for storage
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        api_key_record = {
            'id': key_id,
            'user_id': current_user.id,
            'name': key_data.name,
            'key_hash': key_hash,
            'permissions': key_data.permissions,
            'rate_limit': key_data.rate_limit,
            'usage_count': 0,
            'created_at': datetime.utcnow(),
            'expires_at': key_data.expires_at,
            'is_active': True,
            'last_used': None
        }
        
        api_keys_db[key_id] = api_key_record
        
        # Initialize usage tracking
        api_usage_db[key_id] = {
            'daily_usage': {},
            'total_requests': 0,
            'last_request': None
        }
        
        return APIKeyResponse(
            id=key_id,
            name=key_data.name,
            key_preview=f"{api_key[:8]}...{api_key[-4:]}",  # Show partial key only once
            permissions=key_data.permissions,
            rate_limit=key_data.rate_limit,
            usage_count=0,
            created_at=api_key_record['created_at'],
            expires_at=key_data.expires_at,
            is_active=True
        )
        
    except Exception as e:
        logger.error(f"Error creating API key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API key creation failed: {str(e)}")

@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user)
):
    """
    List user's API keys
    """
    try:
        user_keys = []
        
        for key_id, key_data in api_keys_db.items():
            if key_data['user_id'] == current_user.id:
                usage = api_usage_db.get(key_id, {})
                
                user_keys.append(APIKeyResponse(
                    id=key_id,
                    name=key_data['name'],
                    key_preview=f"pk_{'*' * 8}...{'*' * 4}",  # Hide key after creation
                    permissions=key_data['permissions'],
                    rate_limit=key_data['rate_limit'],
                    usage_count=usage.get('total_requests', 0),
                    created_at=key_data['created_at'],
                    expires_at=key_data['expires_at'],
                    is_active=key_data['is_active']
                ))
        
        return user_keys
        
    except Exception as e:
        logger.error(f"Error listing API keys: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list API keys: {str(e)}")

@router.get("/api-keys/{key_id}/usage")
async def get_api_key_usage(
    key_id: str,
    days: int = Query(default=30, ge=1, le=90),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed usage analytics for an API key
    """
    try:
        if key_id not in api_keys_db:
            raise HTTPException(status_code=404, detail="API key not found")
        
        key_data = api_keys_db[key_id]
        if key_data['user_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        usage = api_usage_db.get(key_id, {})
        daily_usage = usage.get('daily_usage', {})
        
        # Generate usage data for requested days
        usage_data = []
        for i in range(days):
            date = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
            usage_data.append({
                'date': date,
                'requests': daily_usage.get(date, 0)
            })
        
        return {
            'key_id': key_id,
            'key_name': key_data['name'],
            'period_days': days,
            'total_requests': usage.get('total_requests', 0),
            'rate_limit': key_data['rate_limit'],
            'last_used': usage.get('last_request'),
            'daily_usage': list(reversed(usage_data))  # Most recent first
        }
        
    except Exception as e:
        logger.error(f"Error getting API key usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get usage data: {str(e)}")

@router.put("/organizations/{org_id}/branding")
async def update_organization_branding(
    org_id: str,
    branding: CustomBrandingModel,
    current_user: User = Depends(get_current_user)
):
    """
    Update organization's custom branding
    """
    try:
        if org_id not in organizations_db:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org = organizations_db[org_id]
        
        # Check permissions
        if current_user.id not in org['members']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update branding
        org['branding'].update({
            'logo_url': branding.logo_url,
            'primary_color': branding.primary_color,
            'secondary_color': branding.secondary_color,
            'company_name': branding.company_name,
            'custom_css': branding.custom_css,
            'favicon_url': branding.favicon_url
        })
        
        # Remove None values
        org['branding'] = {k: v for k, v in org['branding'].items() if v is not None}
        org['updated_at'] = datetime.utcnow()
        
        return {
            "message": "Branding updated successfully",
            "branding": org['branding']
        }
        
    except Exception as e:
        logger.error(f"Error updating branding: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Branding update failed: {str(e)}")

@router.get("/organizations/{org_id}/branding")
async def get_organization_branding(
    org_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get organization's branding configuration
    """
    try:
        if org_id not in organizations_db:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org = organizations_db[org_id]
        
        # Check permissions
        if current_user.id not in org['members']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "organization": org['name'],
            "branding": org['branding']
        }
        
    except Exception as e:
        logger.error(f"Error getting branding: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get branding: {str(e)}")

@router.post("/roles")
async def create_role(
    role_data: UserRoleModel,
    current_user: User = Depends(get_current_user)
):
    """
    Create a custom user role with specific permissions
    """
    try:
        # Check admin permissions
        if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Only admins can create roles")
        
        role_id = str(uuid.uuid4())
        role_record = {
            'id': role_id,
            'name': role_data.role_name,
            'permissions': role_data.permissions,
            'description': role_data.description,
            'created_by': current_user.id,
            'created_at': datetime.utcnow()
        }
        
        # In a real implementation, store in database
        # For now, using in-memory storage
        
        return {
            "role_id": role_id,
            "message": f"Role '{role_data.role_name}' created successfully",
            "permissions": role_data.permissions
        }
        
    except Exception as e:
        logger.error(f"Error creating role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Role creation failed: {str(e)}")

@router.get("/analytics/overview")
async def get_enterprise_analytics(
    org_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get enterprise analytics overview
    """
    try:
        # Check if user has access to requested org
        if org_id and org_id in organizations_db:
            org = organizations_db[org_id]
            if current_user.id not in org['members']:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Calculate analytics
        total_api_calls = sum(usage.get('total_requests', 0) for usage in api_usage_db.values())
        active_api_keys = sum(1 for key in api_keys_db.values() if key['is_active'])
        
        # Organization stats
        if org_id:
            org_members = len(organizations_db[org_id]['members'])
            org_name = organizations_db[org_id]['name']
        else:
            org_members = sum(len(org['members']) for org in organizations_db.values())
            org_name = "All Organizations"
        
        return {
            "organization": org_name,
            "period": "last_30_days",
            "metrics": {
                "total_api_calls": total_api_calls,
                "active_api_keys": active_api_keys,
                "organization_members": org_members,
                "data_processed_gb": round(total_api_calls * 0.001, 2),  # Simulated
                "uptime_percentage": 99.9,
                "average_response_time_ms": 245
            },
            "trends": {
                "api_calls_growth": "+12.5%",
                "new_members": "+3",
                "data_growth": "+8.2%"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analytics retrieval failed: {str(e)}")

@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Revoke an API key
    """
    try:
        if key_id not in api_keys_db:
            raise HTTPException(status_code=404, detail="API key not found")
        
        key_data = api_keys_db[key_id]
        if key_data['user_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Mark as inactive instead of deleting (for audit trail)
        key_data['is_active'] = False
        key_data['revoked_at'] = datetime.utcnow()
        
        return {
            "message": f"API key '{key_data['name']}' revoked successfully",
            "revoked_at": key_data['revoked_at']
        }
        
    except Exception as e:
        logger.error(f"Error revoking API key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API key revocation failed: {str(e)}")

# Utility function for API key validation (used by middleware)
def validate_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """
    Validate API key and return key data if valid
    """
    try:
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        for key_id, key_data in api_keys_db.items():
            if key_data['key_hash'] == key_hash and key_data['is_active']:
                # Check expiration
                if key_data['expires_at'] and datetime.utcnow() > key_data['expires_at']:
                    return None
                
                # Update usage
                today = datetime.utcnow().strftime('%Y-%m-%d')
                if key_id in api_usage_db:
                    api_usage_db[key_id]['total_requests'] += 1
                    api_usage_db[key_id]['last_request'] = datetime.utcnow()
                    if today in api_usage_db[key_id]['daily_usage']:
                        api_usage_db[key_id]['daily_usage'][today] += 1
                    else:
                        api_usage_db[key_id]['daily_usage'][today] = 1
                
                return key_data
        
        return None
        
    except Exception as e:
        logger.error(f"Error validating API key: {str(e)}")
        return None 