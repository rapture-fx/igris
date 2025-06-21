from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import JWTError, jwt
import uuid

from app.database.models import User, UserRole
from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)

    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

    async def create_user(self, db: AsyncSession, email: str, username: str, password: str, 
                         first_name: Optional[str] = None, last_name: Optional[str] = None) -> User:
        """Create a new user"""
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            raise ValueError("User with this email already exists")
        
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            raise ValueError("User with this username already exists")

        # Create new user
        hashed_password = self.get_password_hash(password)
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            hashed_password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            role=UserRole.ANALYST,
            is_active=True,
            is_verified=True,  # Auto-verify for development
            created_at=datetime.utcnow()
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def authenticate_user(self, db: AsyncSession, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        if not self.verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
            
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        return user

    async def get_user_by_id(self, db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user by ID"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

# Global auth service instance
auth_service = AuthService() 