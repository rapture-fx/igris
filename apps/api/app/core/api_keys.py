from fastapi import HTTPException, Depends, Header
from sqlalchemy.orm import Session
from app.models.api_keys import APIKey
from app.core.database import get_db
import jwt
from datetime import datetime, timedelta
from app.core.api_config import settings

async def get_api_key(
    x_api_key: str = Header(None),
    db: Session = Depends(get_db)
) -> str:
    """
    Validate and return the API key from the request header.
    Raises HTTPException if the key is invalid or expired.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="API key is required"
        )
    
    # Check if API key exists and is active
    api_key = db.query(APIKey).filter(
        APIKey.key == x_api_key,
        APIKey.is_active == True
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    
    # Check if key is expired
    if api_key.expires_at and api_key.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=401,
            detail="API key has expired"
        )
    
    return x_api_key

def create_api_key(
    user_id: int,
    name: str,
    expires_at: datetime = None,
    db: Session = None
) -> APIKey:
    """
    Create a new API key for a user.
    """
    # Generate a secure random key
    key = jwt.encode(
        {
            "user_id": user_id,
            "name": name,
            "created_at": datetime.utcnow().isoformat()
        },
        settings.SECRET_KEY,
        algorithm="HS256"
    )
    
    # Create API key record
    api_key = APIKey(
        user_id=user_id,
        name=name,
        key=key,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
        is_active=True
    )
    
    if db:
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
    
    return api_key

def revoke_api_key(
    key: str,
    db: Session
) -> bool:
    """
    Revoke an API key by marking it as inactive.
    """
    api_key = db.query(APIKey).filter(APIKey.key == key).first()
    if not api_key:
        return False
    
    api_key.is_active = False
    api_key.revoked_at = datetime.utcnow()
    db.commit()
    
    return True 