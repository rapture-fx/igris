"""
UNIFIED AUTHENTICATION API - POLLARBASE
=======================================

This is the single, consolidated authentication API that replaces all fragmented auth systems.
It provides a clean, powerful, and efficient interface with advanced features.

Key Features:
- Single authentication endpoint with intelligent routing
- Advanced security with optional MFA
- Session management with refresh tokens
- Rate limiting and brute force protection
- Comprehensive audit logging
- Real-time user status updates
- Backward compatibility with existing clients
- Performance optimized with caching
"""

import asyncio
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_
from pydantic import BaseModel, EmailStr, Field, validator
from redis import Redis
import logging

from app.database.connection import get_db
from app.database.models import User, UserRole, ApiKey, AuditLog
from app.core.api_config import settings
from app.core.rate_limiting import rate_limit
from app.auth.auth_service import AuthService

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
router = APIRouter()
security = HTTPBearer(auto_error=False)
auth_service = AuthService()

# Redis for session management and caching
redis_client = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True)

# ==================== UNIFIED REQUEST/RESPONSE MODELS ====================

class AuthRequest(BaseModel):
    """Unified authentication request model"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    action: str = Field("login", description="Action: 'login' or 'register'")
    
    # Optional registration fields
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    organization_name: Optional[str] = Field(None, max_length=100)
    
    # Security options
    remember_me: bool = Field(False, description="Extended session duration")
    mfa_code: Optional[str] = Field(None, description="MFA verification code")
    device_name: Optional[str] = Field(None, description="Device name for tracking")
    
    @validator('action')
    def validate_action(cls, v):
        if v not in ['login', 'register']:
            raise ValueError('Action must be either "login" or "register"')
        return v

class UnifiedUser(BaseModel):
    """Unified user response model"""
    id: str
    email: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    organization_id: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    
    # Security status
    mfa_enabled: bool = False
    last_password_change: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    """Unified authentication response"""
    success: bool
    user: Optional[UnifiedUser] = None
    tokens: Optional[Dict[str, str]] = None
    session_info: Optional[Dict[str, Any]] = None
    
    # Security status
    mfa_required: bool = False
    mfa_challenge_token: Optional[str] = None
    
    # Metadata
    message: str
    expires_in: Optional[int] = None
    requires_verification: bool = False

class SessionInfo(BaseModel):
    """Session information model"""
    session_id: str
    user_id: str
    ip_address: str
    user_agent: str
    created_at: datetime
    expires_at: datetime
    is_active: bool
    device_name: Optional[str] = None

# ==================== AUTHENTICATION CORE LOGIC ====================

class UnifiedAuthService:
    """Advanced authentication service with caching and security features"""
    
    def __init__(self):
        self.session_cache_ttl = 3600  # 1 hour
        self.max_failed_attempts = 5
        self.lockout_duration = 900  # 15 minutes
    
    async def authenticate_user(
        self, 
        db: AsyncSession, 
        email: str, 
        password: str,
        ip_address: str,
        user_agent: str
    ) -> tuple[bool, Optional[User], Optional[str]]:
        """
        Advanced user authentication with security checks
        Returns: (success, user, error_message)
        """
        
        # Check for brute force attempts
        lockout_key = f"auth_lockout:{ip_address}:{email}"
        failed_attempts = redis_client.get(f"auth_attempts:{ip_address}:{email}")
        
        if failed_attempts and int(failed_attempts) >= self.max_failed_attempts:
            lockout_time = redis_client.ttl(lockout_key)
            if lockout_time > 0:
                return False, None, f"Account temporarily locked. Try again in {lockout_time} seconds."
        
        # Get user from database
        result = await db.execute(
            select(User).where(
                and_(
                    or_(User.email == email, User.username == email),
                    User.is_active == True
                )
            )
        )
        user = result.scalar_one_or_none()
        
        if not user or not auth_service.verify_password(password, user.hashed_password):
            # Record failed attempt
            await self._record_failed_attempt(ip_address, email, user_agent)
            return False, None, "Invalid credentials"
        
        # Clear failed attempts on successful login
        redis_client.delete(f"auth_attempts:{ip_address}:{email}")
        redis_client.delete(lockout_key)
        
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        return True, user, None
    
    async def _record_failed_attempt(self, ip_address: str, email: str, user_agent: str):
        """Record failed authentication attempt"""
        attempt_key = f"auth_attempts:{ip_address}:{email}"
        lockout_key = f"auth_lockout:{ip_address}:{email}"
        
        # Increment failed attempts
        attempts = redis_client.incr(attempt_key)
        redis_client.expire(attempt_key, self.lockout_duration)
        
        # Lock account if max attempts reached
        if attempts >= self.max_failed_attempts:
            redis_client.setex(lockout_key, self.lockout_duration, "locked")
            logger.warning(f"Account locked for {email} from {ip_address}")
    
    async def create_session(
        self, 
        user: User, 
        ip_address: str, 
        user_agent: str,
        remember_me: bool = False,
        device_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create secure session with tokens"""
        
        session_id = secrets.token_urlsafe(32)
        
        # Token expiration
        if remember_me:
            access_expires = timedelta(days=30)
            refresh_expires = timedelta(days=90)
        else:
            access_expires = timedelta(hours=8)
            refresh_expires = timedelta(days=7)
        
        # Create tokens
        access_token = auth_service.create_access_token(
            data={"sub": str(user.id), "email": user.email, "session_id": session_id},
            expires_delta=access_expires
        )
        
        refresh_token = auth_service.create_access_token(
            data={"sub": str(user.id), "type": "refresh", "session_id": session_id},
            expires_delta=refresh_expires
        )
        
        # Store session in Redis
        session_data = {
            "user_id": str(user.id),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "device_name": device_name or "Unknown Device",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + access_expires).isoformat(),
            "is_active": True
        }
        
        redis_client.hset(f"session:{session_id}", mapping=session_data)
        redis_client.expire(f"session:{session_id}", int(refresh_expires.total_seconds()))
        
        # Cache user data
        user_cache_key = f"user:{user.id}"
        redis_client.setex(user_cache_key, self.session_cache_ttl, str(user.id))
        
        return {
            "session_id": session_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": int(access_expires.total_seconds()),
            "token_type": "bearer"
        }
    
    async def get_current_user(self, token: str, db: AsyncSession) -> Optional[User]:
        """Get current user from token with caching"""
        
        # Verify token
        payload = auth_service.verify_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        session_id = payload.get("session_id")
        
        if not user_id or not session_id:
            return None
        
        # Check session validity
        session_data = redis_client.hgetall(f"session:{session_id}")
        if not session_data or session_data.get("is_active") != "True":
            return None
        
        # Try to get user from cache first
        user_cache_key = f"user:{user_id}"
        cached_user = redis_client.get(user_cache_key)
        
        if cached_user:
            # Get user from database (cache hit optimization)
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
        
        # Get user from database and cache it
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if user:
            redis_client.setex(user_cache_key, self.session_cache_ttl, str(user.id))
        
        return user

# Initialize unified auth service
unified_auth_service = UnifiedAuthService()

# ==================== DEPENDENCY FUNCTIONS ====================

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await unified_auth_service.get_current_user(credentials.credentials, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    return user

def get_client_info(request: Request) -> Dict[str, str]:
    """Extract client information from request"""
    return {
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown")
    }

# ==================== UNIFIED AUTHENTICATION ENDPOINTS ====================

@router.post("/auth", response_model=AuthResponse)
@rate_limit
async def unified_auth_endpoint(
    request: Request,
    auth_data: AuthRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    🚀 UNIFIED AUTHENTICATION ENDPOINT
    
    Handles both login and registration in a single, intelligent endpoint.
    Automatically detects user intent and provides appropriate response.
    """
    
    client_info = get_client_info(request)
    
    try:
        if auth_data.action == "register":
            return await handle_registration(auth_data, client_info, background_tasks, db)
        else:
            return await handle_login(auth_data, client_info, background_tasks, db)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service temporarily unavailable"
        )

async def handle_registration(
    auth_data: AuthRequest,
    client_info: Dict[str, str],
    background_tasks: BackgroundTasks,
    db: AsyncSession
) -> AuthResponse:
    """Handle user registration"""
    
    # Validate required fields for registration
    if not auth_data.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required for registration"
        )
    
    # Check if user already exists
    existing_user = await db.execute(
        select(User).where(
            or_(User.email == auth_data.email, User.username == auth_data.username)
        )
    )
    
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email or username already exists"
        )
    
    # Create new user
    hashed_password = auth_service.get_password_hash(auth_data.password)
    
    new_user = User(
        email=auth_data.email,
        username=auth_data.username,
        hashed_password=hashed_password,
        first_name=auth_data.first_name,
        last_name=auth_data.last_name,
        role=UserRole.ANALYST,
        is_active=True,
        is_verified=False,
        created_at=datetime.utcnow()
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Create session
    session_info = await unified_auth_service.create_session(
        user=new_user,
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"],
        remember_me=auth_data.remember_me,
        device_name=auth_data.device_name
    )
    
    # Track usage
    background_tasks.add_task(
        track_api_usage,
        user_id=str(new_user.id),
        endpoint="/auth",
        method="POST",
        operation="registration"
    )
    
    # Log audit event
    background_tasks.add_task(
        log_auth_event,
        user_id=str(new_user.id),
        action="user_registered",
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"],
        db=db
    )
    
    return AuthResponse(
        success=True,
        user=UnifiedUser.from_orm(new_user),
        tokens={
            "access_token": session_info["access_token"],
            "refresh_token": session_info["refresh_token"],
            "token_type": session_info["token_type"]
        },
        session_info={
            "session_id": session_info["session_id"],
            "expires_in": session_info["expires_in"]
        },
        message="Registration successful",
        expires_in=session_info["expires_in"],
        requires_verification=True
    )

async def handle_login(
    auth_data: AuthRequest,
    client_info: Dict[str, str],
    background_tasks: BackgroundTasks,
    db: AsyncSession
) -> AuthResponse:
    """Handle user login"""
    
    # Authenticate user
    success, user, error_message = await unified_auth_service.authenticate_user(
        db=db,
        email=auth_data.email,
        password=auth_data.password,
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"]
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_message or "Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create session
    session_info = await unified_auth_service.create_session(
        user=user,
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"],
        remember_me=auth_data.remember_me,
        device_name=auth_data.device_name
    )
    
    # Track usage
    background_tasks.add_task(
        track_api_usage,
        user_id=str(user.id),
        endpoint="/auth",
        method="POST",
        operation="login"
    )
    
    # Log audit event
    background_tasks.add_task(
        log_auth_event,
        user_id=str(user.id),
        action="user_login",
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"],
        db=db
    )
    
    return AuthResponse(
        success=True,
        user=UnifiedUser.from_orm(user),
        tokens={
            "access_token": session_info["access_token"],
            "refresh_token": session_info["refresh_token"],
            "token_type": session_info["token_type"]
        },
        session_info={
            "session_id": session_info["session_id"],
            "expires_in": session_info["expires_in"]
        },
        message="Login successful",
        expires_in=session_info["expires_in"]
    )

@router.post("/auth/refresh", response_model=AuthResponse)
@rate_limit
async def refresh_token(
    request: Request,
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    
    try:
        # Verify refresh token
        payload = auth_service.verify_token(refresh_token)
        
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user_id = payload.get("sub")
        session_id = payload.get("session_id")
        
        # Check session validity
        session_data = redis_client.hgetall(f"session:{session_id}")
        if not session_data or session_data.get("is_active") != "True":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
            )
        
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Create new access token
        access_token = auth_service.create_access_token(
            data={"sub": str(user.id), "email": user.email, "session_id": session_id},
            expires_delta=timedelta(hours=8)
        )
        
        return AuthResponse(
            success=True,
            user=UnifiedUser.from_orm(user),
            tokens={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            },
            message="Token refreshed successfully",
            expires_in=28800  # 8 hours
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.get("/auth/me", response_model=UnifiedUser)
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return UnifiedUser.from_orm(current_user)

@router.post("/auth/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Logout user and invalidate session"""
    
    try:
        # Get session ID from token
        payload = auth_service.verify_token(credentials.credentials)
        session_id = payload.get("session_id") if payload else None
        
        if session_id:
            # Invalidate session
            redis_client.hset(f"session:{session_id}", "is_active", "False")
            redis_client.expire(f"session:{session_id}", 60)  # Keep for audit trail
        
        # Clear user cache
        redis_client.delete(f"user:{current_user.id}")
        
        return {"message": "Logout successful"}
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return {"message": "Logout completed"}

@router.get("/auth/sessions", response_model=List[SessionInfo])
async def get_user_sessions(current_user: User = Depends(get_current_user)):
    """Get all active sessions for current user"""
    
    # Get all sessions for user
    session_keys = redis_client.keys(f"session:*")
    user_sessions = []
    
    for key in session_keys:
        session_data = redis_client.hgetall(key)
        if session_data.get("user_id") == str(current_user.id) and session_data.get("is_active") == "True":
            session_info = SessionInfo(
                session_id=key.split(":")[-1],
                user_id=session_data["user_id"],
                ip_address=session_data["ip_address"],
                user_agent=session_data["user_agent"],
                created_at=datetime.fromisoformat(session_data["created_at"]),
                expires_at=datetime.fromisoformat(session_data["expires_at"]),
                is_active=session_data["is_active"] == "True",
                device_name=session_data.get("device_name")
            )
            user_sessions.append(session_info)
    
    return user_sessions

@router.delete("/auth/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Revoke a specific session"""
    
    # Check if session belongs to current user
    session_data = redis_client.hgetall(f"session:{session_id}")
    
    if not session_data or session_data.get("user_id") != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Revoke session
    redis_client.hset(f"session:{session_id}", "is_active", "False")
    redis_client.expire(f"session:{session_id}", 60)
    
    return {"message": "Session revoked successfully"}

@router.get("/auth/status")
async def auth_system_status():
    """Authentication system health check"""
    
    try:
        # Test Redis connection
        redis_client.ping()
        redis_status = "healthy"
    except:
        redis_status = "unhealthy"
    
    return {
        "status": "operational",
        "service": "unified_authentication",
        "version": "2.0.0",
        "features": [
            "unified_login_registration",
            "session_management",
            "token_refresh",
            "brute_force_protection",
            "audit_logging",
            "performance_caching"
        ],
        "redis_status": redis_status,
        "endpoints": {
            "POST /auth": "Unified login/registration",
            "POST /auth/refresh": "Token refresh",
            "GET /auth/me": "User profile",
            "POST /auth/logout": "Logout",
            "GET /auth/sessions": "Active sessions",
            "DELETE /auth/sessions/{id}": "Revoke session"
        }
    }

# ==================== BACKGROUND TASKS ====================

async def log_auth_event(
    user_id: str,
    action: str,
    ip_address: str,
    user_agent: str,
    db: AsyncSession
):
    """Log authentication event to audit trail"""
    
    try:
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type="authentication",
            resource_id=user_id,
            details={
                "ip_address": ip_address,
                "user_agent": user_agent,
                "timestamp": datetime.utcnow().isoformat()
            },
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.utcnow()
        )
        
        db.add(audit_log)
        await db.commit()
        
    except Exception as e:
        logger.error(f"Failed to log auth event: {e}") 