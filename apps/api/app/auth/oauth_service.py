"""
OAuth Service for Schlep Engine
Provides OAuth 2.0 authentication with Google and GitHub
"""

import asyncio
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, Tuple
from urllib.parse import urlencode, urlparse, parse_qs

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.database.models import User, OAuthAccount, OAuthProvider, UserRole
from app.auth.unified_auth_system import AuthResult, AuthStatus
from typing import List
from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

class OAuthProviderConfig:
    """Configuration for OAuth providers"""
    
    GOOGLE = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "server_metadata_url": "https://accounts.google.com/.well-known/openid_configuration",
        "client_kwargs": {
            "scope": "openid email profile"
        },
        "userinfo_endpoint": "https://www.googleapis.com/oauth2/v2/userinfo",
        "authorize_url": "https://accounts.google.com/o/oauth2/auth",
        "token_url": "https://oauth2.googleapis.com/token"
    }
    
    GITHUB = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_endpoint": "https://api.github.com/user",
        "scope": "user:email"
    }

class OAuthService:
    """OAuth authentication service"""
    
    def __init__(self):
        self.providers = OAuthProviderConfig()
        self.state_expire_minutes = 10
        
    async def get_authorization_url(self, provider: str, redirect_uri: str) -> Tuple[str, str]:
        """
        Generate OAuth authorization URL and state
        
        Args:
            provider: OAuth provider (google, github)
            redirect_uri: Callback URL
            
        Returns:
            Tuple of (authorization_url, state)
        """
        if provider not in ["google", "github"]:
            raise HTTPException(status_code=400, detail="Unsupported OAuth provider")
        
        # Generate secure state parameter
        state = secrets.token_urlsafe(32)
        
        # Store state in Redis with expiration
        await self._store_oauth_state(state, provider, redirect_uri)
        
        if provider == "google":
            config = self.providers.GOOGLE
            client = AsyncOAuth2Client(
                client_id=config["client_id"],
                client_secret=config["client_secret"]
            )
            
            authorization_url, _ = client.create_authorization_url(
                config["authorize_url"],
                redirect_uri=redirect_uri,
                scope=config["client_kwargs"]["scope"],
                state=state
            )
            
        elif provider == "github":
            config = self.providers.GITHUB
            params = {
                'client_id': config["client_id"],
                'redirect_uri': redirect_uri,
                'scope': config["scope"],
                'state': state,
                'response_type': 'code'
            }
            authorization_url = f"{config['authorize_url']}?{urlencode(params)}"
        
        return authorization_url, state
    
    async def handle_oauth_callback(self, 
                                  provider: str, 
                                  code: str, 
                                  state: str, 
                                  redirect_uri: str,
                                  db: AsyncSession) -> AuthResult:
        """
        Handle OAuth callback and create/login user
        
        Args:
            provider: OAuth provider
            code: Authorization code
            state: State parameter
            redirect_uri: Callback URL
            db: Database session
            
        Returns:
            AuthResult with user and tokens
        """
        try:
            # Rate limiting check for OAuth attempts
            await self._check_oauth_rate_limit(provider)
            
            # Verify state parameter
            stored_data = await self._verify_oauth_state(state)
            if not stored_data or stored_data["provider"] != provider:
                await self._record_oauth_failure(provider, "invalid_state")
                return AuthResult(
                    success=False,
                    status=AuthStatus.TOKEN_INVALID,
                    error_message="Invalid or expired OAuth state"
                )
            
            # Exchange code for token
            token_data = await self._exchange_code_for_token(provider, code, redirect_uri)
            if not token_data:
                await self._record_oauth_failure(provider, "token_exchange_failed")
                return AuthResult(
                    success=False,
                    status=AuthStatus.TOKEN_INVALID,
                    error_message="Failed to exchange code for token"
                )
            
            # Validate token security
            if not await self._validate_oauth_token_security(token_data):
                await self._record_oauth_failure(provider, "invalid_token")
                return AuthResult(
                    success=False,
                    status=AuthStatus.TOKEN_INVALID,
                    error_message="Invalid or suspicious OAuth token"
                )
            
            # Get user info from provider
            user_info = await self._get_user_info(provider, token_data["access_token"])
            if not user_info:
                await self._record_oauth_failure(provider, "user_info_failed")
                return AuthResult(
                    success=False,
                    status=AuthStatus.TOKEN_INVALID,
                    error_message="Failed to get user information from provider"
                )
            
            # Sanitize user info
            user_info = await self._sanitize_user_info(user_info)
            
            # Find or create user
            user = await self._find_or_create_oauth_user(db, provider, user_info, token_data)
            
            if not user.is_active:
                return AuthResult(
                    success=False,
                    status=AuthStatus.ACCOUNT_DISABLED,
                    error_message="Account is disabled"
                )
            
            # Generate JWT tokens using the unified auth system
            from app.auth.unified_auth_system import unified_auth_service
            access_token = unified_auth_service.create_access_token(user, remember_me=False)
            refresh_token = unified_auth_service.create_refresh_token(user)
            
            # Update last login
            user.last_login = datetime.utcnow()
            await db.commit()
            
            logger.info(f"OAuth login successful for user {user.email} via {provider}")
            
            return AuthResult(
                success=True,
                status=AuthStatus.SUCCESS,
                user=user,
                access_token=access_token,
                refresh_token=refresh_token,
                metadata={
                    "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    "oauth_provider": provider,
                    "remember_me": False
                }
            )
            
        except Exception as e:
            logger.error(f"OAuth callback error for {provider}: {str(e)}")
            return AuthResult(
                success=False,
                status=AuthStatus.TOKEN_INVALID,
                error_message=f"OAuth authentication failed: {str(e)}"
            )
    
    async def _store_oauth_state(self, state: str, provider: str, redirect_uri: str):
        """Store OAuth state in Redis"""
        redis = await get_redis_client()
        if redis:
            state_data = {
                "provider": provider,
                "redirect_uri": redirect_uri,
                "created_at": datetime.utcnow().isoformat()
            }
            await redis.setex(
                f"oauth:state:{state}",
                self.state_expire_minutes * 60,
                json.dumps(state_data)
            )
    
    async def _verify_oauth_state(self, state: str) -> Optional[Dict[str, Any]]:
        """Verify and retrieve OAuth state from Redis"""
        redis = await get_redis_client()
        if not redis:
            return None
        
        state_data = await redis.get(f"oauth:state:{state}")
        if state_data:
            await redis.delete(f"oauth:state:{state}")  # Use once
            return json.loads(state_data)
        return None
    
    async def _exchange_code_for_token(self, provider: str, code: str, redirect_uri: str) -> Optional[Dict[str,Any]]:
        """Exchange authorization code for access token"""
        try:
            if provider == "google":
                config = self.providers.GOOGLE
                client = AsyncOAuth2Client(
                    client_id=config["client_id"],
                    client_secret=config["client_secret"]
                )
                
                token = await client.fetch_token(
                    config["token_url"],
                    authorization_response=f"{redirect_uri}?code={code}",
                    redirect_uri=redirect_uri
                )
                return token
                
            elif provider == "github":
                config = self.providers.GITHUB
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        config["token_url"],
                        data={
                            'client_id': config["client_id"],
                            'client_secret': config["client_secret"],
                            'code': code,
                            'redirect_uri': redirect_uri
                        },
                        headers={'Accept': 'application/json'}
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                        
        except Exception as e:
            logger.error(f"Token exchange error for {provider}: {str(e)}")
            
        return None
    
    async def _get_user_info(self, provider: str, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user information from OAuth provider"""
        try:
            if provider == "google":
                config = self.providers.GOOGLE
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        config["userinfo_endpoint"],
                        headers={'Authorization': f'Bearer {access_token}'}
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                        
            elif provider == "github":
                config = self.providers.GITHUB
                async with httpx.AsyncClient() as client:
                    # Get user info
                    user_response = await client.get(
                        config["userinfo_endpoint"],
                        headers={'Authorization': f'token {access_token}'}
                    )
                    
                    if user_response.status_code == 200:
                        user_data = user_response.json()
                        
                        # Get user email (GitHub might not return email in user endpoint)
                        email_response = await client.get(
                            "https://api.github.com/user/emails",
                            headers={'Authorization': f'token {access_token}'}
                        )
                        
                        if email_response.status_code == 200:
                            emails = email_response.json()
                            primary_email = next((e["email"] for e in emails if e["primary"]), None)
                            if primary_email:
                                user_data["email"] = primary_email
                        
                        return user_data
                        
        except Exception as e:
            logger.error(f"User info error for {provider}: {str(e)}")
            
        return None
    
    async def _find_or_create_oauth_user(self, 
                                       db: AsyncSession, 
                                       provider: str, 
                                       user_info: Dict[str, Any],
                                       token_data: Dict[str, Any]) -> User:
        """Find existing user or create new OAuth user"""
        
        provider_enum = OAuthProvider(provider)
        provider_user_id = str(user_info.get("id"))
        email = user_info.get("email")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by OAuth provider")
        
        # First, check if OAuth account already exists
        result = await db.execute(
            select(OAuthAccount)
            .where(OAuthAccount.provider == provider_enum)
            .where(OAuthAccount.provider_user_id == provider_user_id)
            .options(selectinload(OAuthAccount.user))
        )
        oauth_account = result.scalar_one_or_none()
        
        if oauth_account:
            # Update OAuth account with new token data
            oauth_account.access_token = token_data.get("access_token")
            oauth_account.refresh_token = token_data.get("refresh_token")
            
            # Set token expiry if provided
            if "expires_in" in token_data:
                oauth_account.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
            
            oauth_account.profile_data = user_info
            oauth_account.last_used_at = datetime.utcnow()
            await db.commit()
            
            return oauth_account.user
        
        # Check if user exists with this email
        result = await db.execute(
            select(User).where(User.email == email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # Link OAuth account to existing user
            oauth_account = OAuthAccount(
                id=uuid.uuid4(),
                user_id=existing_user.id,
                provider=provider_enum,
                provider_user_id=provider_user_id,
                provider_username=user_info.get("login") or user_info.get("username"),
                access_token=token_data.get("access_token"),
                refresh_token=token_data.get("refresh_token"),
                profile_data=user_info,
                last_used_at=datetime.utcnow()
            )
            
            if "expires_in" in token_data:
                oauth_account.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
            
            db.add(oauth_account)
            await db.commit()
            
            return existing_user
        
        # Create new user
        username = self._generate_unique_username(user_info, provider)
        
        new_user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            hashed_password=None,  # OAuth users don't have passwords
            first_name=user_info.get("given_name") or user_info.get("name", "").split(" ")[0] if user_info.get("name") else "",
            last_name=user_info.get("family_name") or " ".join(user_info.get("name", "").split(" ")[1:]) if user_info.get("name") else "",
            role=UserRole.ANALYST,
            is_active=True,
            is_verified=True,  # OAuth users are considered verified
            avatar_url=user_info.get("avatar_url") or user_info.get("picture"),
            oauth_provider=provider_enum,
            oauth_provider_id=provider_user_id,
            oauth_profile_data=user_info,
            created_at=datetime.utcnow()
        )
        
        db.add(new_user)
        await db.flush()  # Get the user ID
        
        # Create OAuth account record
        oauth_account = OAuthAccount(
            id=uuid.uuid4(),
            user_id=new_user.id,
            provider=provider_enum,
            provider_user_id=provider_user_id,
            provider_username=user_info.get("login") or user_info.get("username"),
            access_token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            profile_data=user_info,
            last_used_at=datetime.utcnow()
        )
        
        if "expires_in" in token_data:
            oauth_account.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
        
        db.add(oauth_account)
        await db.commit()
        await db.refresh(new_user)
        
        logger.info(f"Created new OAuth user: {email} via {provider}")
        
        return new_user
    
    def _generate_unique_username(self, user_info: Dict[str, Any], provider: str) -> str:
        """Generate a unique username from OAuth user info"""
        
        # Try to get username from provider
        username = user_info.get("login") or user_info.get("username")
        
        if not username:
            # Fallback to email prefix
            email = user_info.get("email", "")
            username = email.split("@")[0] if email else "user"
        
        # Add provider suffix to avoid conflicts
        username = f"{username}_{provider}"
        
        # Add random suffix if needed (this could be improved with DB check)
        username = f"{username}_{secrets.token_hex(4)}"
        
        return username[:50]  # Ensure it fits in the database field
    
    # Security Methods
    async def _check_oauth_rate_limit(self, provider: str):
        """Check OAuth rate limiting per provider"""
        redis = await get_redis_client()
        if not redis:
            return
        
        rate_limit_key = f"oauth:rate_limit:{provider}"
        current_attempts = await redis.get(rate_limit_key)
        
        max_attempts = 10  # Max 10 OAuth attempts per provider per minute
        if current_attempts and int(current_attempts) >= max_attempts:
            raise HTTPException(
                status_code=429, 
                detail=f"Too many OAuth attempts for {provider}. Please try again later."
            )
    
    async def _record_oauth_failure(self, provider: str, reason: str):
        """Record OAuth failure for rate limiting"""
        redis = await get_redis_client()
        if not redis:
            return
        
        rate_limit_key = f"oauth:rate_limit:{provider}"
        failure_key = f"oauth:failures:{provider}:{reason}"
        
        # Increment rate limit counter
        await redis.incr(rate_limit_key)
        await redis.expire(rate_limit_key, 60)  # 1 minute window
        
        # Record specific failure
        await redis.incr(failure_key)
        await redis.expire(failure_key, 3600)  # 1 hour window for analysis
    
    async def _validate_oauth_token_security(self, token_data: Dict[str, Any]) -> bool:
        """Validate OAuth token for security issues"""
        
        # Check for required fields
        if not token_data.get("access_token"):
            return False
        
        # Check token length (basic sanity check)
        access_token = token_data["access_token"]
        if len(access_token) < 10:  # Suspiciously short token
            return False
        
        # Check for suspicious patterns
        if access_token.startswith("test_") or access_token == "fake_token":
            return False
        
        return True
    
    async def _sanitize_user_info(self, user_info: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize user info from OAuth provider"""
        sanitized = {}
        
        # Allowed fields with sanitization
        allowed_fields = {
            "id": str,
            "email": str,
            "name": str,
            "login": str,
            "username": str,
            "given_name": str,
            "family_name": str,
            "avatar_url": str,
            "picture": str
        }
        
        for field, field_type in allowed_fields.items():
            if field in user_info and user_info[field]:
                try:
                    sanitized[field] = field_type(user_info[field])
                    # Basic sanitization for strings
                    if field_type == str:
                        sanitized[field] = sanitized[field][:255]  # Limit length
                except (ValueError, TypeError):
                    continue
        
        return sanitized
    
    async def unlink_oauth_account(self, db: AsyncSession, user_id: uuid.UUID, provider: str) -> bool:
        """Unlink an OAuth account from a user"""
        try:
            provider_enum = OAuthProvider(provider)
            
            result = await db.execute(
                select(OAuthAccount)
                .where(OAuthAccount.user_id == user_id)
                .where(OAuthAccount.provider == provider_enum)
            )
            oauth_account = result.scalar_one_or_none()
            
            if oauth_account:
                await db.delete(oauth_account)
                await db.commit()
                logger.info(f"Unlinked {provider} OAuth account for user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error unlinking OAuth account: {str(e)}")
            
        return False
    
    async def get_user_oauth_accounts(self, db: AsyncSession, user_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Get all OAuth accounts for a user"""
        try:
            result = await db.execute(
                select(OAuthAccount)
                .where(OAuthAccount.user_id == user_id)
            )
            oauth_accounts = result.scalars().all()
            
            return [
                {
                    "provider": account.provider.value,
                    "provider_user_id": account.provider_user_id,
                    "provider_username": account.provider_username,
                    "created_at": account.created_at.isoformat() if account.created_at else None,
                    "last_used_at": account.last_used_at.isoformat() if account.last_used_at else None
                }
                for account in oauth_accounts
            ]
            
        except Exception as e:
            logger.error(f"Error getting OAuth accounts: {str(e)}")
            return []

# Global instance
oauth_service = OAuthService()