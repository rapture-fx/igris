"""
RL Optimization Service - Secure & Decoupled
Core service for managing reinforcement learning optimization sessions.
Enforces user ownership of resources and uses dependency injection.
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, Depends

from app.database.connection import get_async_session
from app.models.rl_models import RLOptimizationSession, SessionStatus
from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
from app.core.rl_config import get_rl_settings
from app.services.rl.monitoring.rl_monitor import RLPerformanceMonitor
from app.tasks.rl_optimization_tasks import (
    optimize_hyperparameters_task,
    optimize_resource_allocation_task,
    optimize_data_quality_task
)

logger = logging.getLogger(__name__)

class RLOptimizationService:
    """
    Core service for RL optimization operations.
    """

    def __init__(self, crud: RLOptimizationCRUD):
        self.crud = crud
        self.settings = get_rl_settings()
        self.monitor = RLPerformanceMonitor(enable_prometheus=True)
        self.active_sessions = {}

    async def start_optimization(self, user_id: str, **kwargs) -> RLOptimizationSession:
        # Ownership is implicitly handled by associating the session with the user_id
        return await self.crud.create_session(user_id=user_id, **kwargs)

    async def get_session_status(self, session_id: str, user_id: str) -> Dict[str, Any]:
        session = await self.crud.get_session(session_id, user_id=user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Optimization session not found")

        # Lazy cleanup of finished sessions
        if session.status in [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.STOPPED] and session_id in self.active_sessions:
            del self.active_sessions[session_id]

        # ... (rest of the logic remains the same)
        return {"session_id": session_id, "status": session.status}

    async def stop_optimization(self, session_id: str, user_id: str) -> bool:
        session = await self.crud.get_session(session_id, user_id=user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Optimization session not found")
        if session.status not in [SessionStatus.PENDING, SessionStatus.RUNNING]:
            raise HTTPException(status_code=400, detail="Session is not running or already stopped")

        if session_id in self.active_sessions:
            task_id = self.active_sessions[session_id]['task_id']
            from app.core.celery_app import celery_app
            celery_app.control.revoke(task_id, terminate=True)
            del self.active_sessions[session_id]

        await self.crud.update_session(session_id, status=SessionStatus.STOPPED)
        return True

    async def get_optimization_result(self, session_id: str, user_id: str) -> Dict[str, Any]:
        session = await self.crud.get_session(session_id, user_id=user_id)
        if not session or session.status != SessionStatus.COMPLETED:
            raise HTTPException(status_code=404, detail="Completed optimization session not found")

        # ... logic to fetch and return results ...
        return {"session_id": session_id, "best_performance": session.best_performance}

# Dependency Providers
def get_rl_crud(db: AsyncSession = Depends(get_async_session)) -> RLOptimizationCRUD:
    return RLOptimizationCRUD(db)

def get_rl_optimization_service(crud: RLOptimizationCRUD = Depends(get_rl_crud)) -> RLOptimizationService:
    return RLOptimizationService(crud=crud)
