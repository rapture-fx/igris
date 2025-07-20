"""
API for retrieving audit trail data.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database.connection import get_db
from app.database.security_models import AuditTrail, AuditAction
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from app.auth.dependencies import get_current_user
from app.database.models import User

router = APIRouter()

class AuditLogEntry(BaseModel):
    id: int
    user_id: uuid.UUID | None
    user_email: str | None = Field(None, description="Email of the user who performed the action")
    action: AuditAction
    target_table: str
    target_id: str
    timestamp: datetime
    changes: dict | None
    ip_address: str | None
    user_agent: str | None

    class Config:
        orm_mode = True

class PaginatedAuditLogResponse(BaseModel):
    total: int
    page: int
    size: int
    logs: List[AuditLogEntry]

@router.get("/audit-logs", response_model=PaginatedAuditLogResponse)
async def get_audit_logs(
    skip: int = 0, 
    limit: int = 20, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # Ensures only authenticated users can access
):
    """
    Retrieve a paginated list of audit trail records.
    """
    from sqlalchemy import select, func

    # Get total count
    count_query = select(func.count()).select_from(AuditTrail)
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get paginated audit logs with user email
    query = (
        select(AuditTrail, User.email)
        .outerjoin(User, AuditTrail.user_id == User.id)
        .order_by(AuditTrail.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    logs_with_user = result.all()

    # Format the response
    formatted_logs = []
    for audit_log, user_email in logs_with_user:
        log_entry = AuditLogEntry(
            id=audit_log.id,
            user_id=audit_log.user_id,
            user_email=user_email,
            action=audit_log.action,
            target_table=audit_log.target_table,
            target_id=audit_log.target_id,
            timestamp=audit_log.timestamp,
            changes=audit_log.changes,
            ip_address=audit_log.ip_address,
            user_agent=audit_log.user_agent
        )
        formatted_logs.append(log_entry)

    return PaginatedAuditLogResponse(
        total=total,
        page=(skip // limit) + 1,
        size=len(formatted_logs),
        logs=formatted_logs
    ) 