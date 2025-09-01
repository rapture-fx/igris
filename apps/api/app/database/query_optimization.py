"""
Database query optimization utilities to prevent N+1 problems and improve performance.

This module provides utilities for:
- Eager loading relationships
- Query optimization hints
- Bulk operations
- Query result caching
"""

from typing import List, Optional, Type, TypeVar, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from sqlalchemy import select, and_, or_, text
from sqlalchemy.orm.strategy_options import Load
from app.database.models import (
    User, Organization, Workspace, DataInvestigation, 
    ProcessingJob, ApiKey, UserSession, AuditLog,
    UserFeedback, UserLearningProfile, ABTest, ABTestResult
)
import logging
from functools import wraps
import asyncio
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

ModelType = TypeVar("ModelType")

class QueryOptimizer:
    """Utility class for optimized database queries with eager loading"""
    
    @staticmethod
    def get_user_with_relations(include_org: bool = True, include_sessions: bool = False, 
                               include_investigations: bool = False) -> Load:
        """Get optimized user query with selective eager loading"""
        options = []
        
        if include_org:
            options.append(selectinload(User.organization))
        
        if include_sessions:
            # Load only active sessions from last 24 hours
            options.append(
                selectinload(User.user_sessions).where(
                    and_(
                        UserSession.status == "active",
                        UserSession.last_accessed > datetime.utcnow() - timedelta(hours=24)
                    )
                )
            )
        
        if include_investigations:
            # Load recent investigations with workspace info
            options.append(
                selectinload(User.data_investigations)
                .selectinload(DataInvestigation.workspace)
            )
        
        return options
    
    @staticmethod
    def get_organization_with_relations(include_users: bool = True, include_workspaces: bool = True,
                                      active_only: bool = True) -> Load:
        """Get optimized organization query with selective eager loading"""
        options = []
        
        if include_users:
            if active_only:
                options.append(
                    selectinload(Organization.users).where(User.is_active == True)
                )
            else:
                options.append(selectinload(Organization.users))
        
        if include_workspaces:
            options.append(selectinload(Organization.workspaces))
        
        return options
    
    @staticmethod
    def get_investigation_with_relations(include_jobs: bool = True, include_user: bool = True,
                                       include_workspace: bool = True, jobs_limit: int = 10) -> Load:
        """Get optimized data investigation query with selective eager loading"""
        options = []
        
        if include_user:
            options.append(selectinload(DataInvestigation.created_by))
        
        if include_workspace:
            options.append(selectinload(DataInvestigation.workspace))
        
        if include_jobs:
            # Load recent processing jobs, ordered by creation date
            options.append(
                selectinload(DataInvestigation.processing_jobs)
                .limit(jobs_limit)
                .options(selectinload(ProcessingJob.investigation))
            )
        
        return options

    @staticmethod
    async def get_users_bulk(session: AsyncSession, user_ids: List[str], 
                           include_relations: bool = True) -> List[User]:
        """Bulk fetch users with optimized queries to prevent N+1"""
        
        query = select(User).where(User.id.in_(user_ids))
        
        if include_relations:
            query = query.options(*QueryOptimizer.get_user_with_relations())
        
        result = await session.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def get_investigations_by_workspace_bulk(session: AsyncSession, workspace_ids: List[str],
                                                 limit: Optional[int] = None,
                                                 status_filter: Optional[str] = None) -> List[DataInvestigation]:
        """Bulk fetch investigations by workspace with optimized queries"""
        
        query = select(DataInvestigation).where(DataInvestigation.workspace_id.in_(workspace_ids))
        
        if status_filter:
            query = query.where(DataInvestigation.status == status_filter)
        
        if limit:
            query = query.limit(limit)
        
        # Add eager loading
        query = query.options(*QueryOptimizer.get_investigation_with_relations())
        query = query.order_by(DataInvestigation.updated_at.desc())
        
        result = await session.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def get_user_activity_summary(session: AsyncSession, user_id: str, 
                                       days: int = 30) -> Dict[str, Any]:
        """Get comprehensive user activity summary with optimized queries"""
        
        since_date = datetime.utcnow() - timedelta(days=days)
        
        # Single query for all user activity metrics
        activity_query = text("""
            SELECT 
                COUNT(DISTINCT di.id) as investigations_count,
                COUNT(DISTINCT pj.id) as processing_jobs_count,
                COUNT(DISTINCT al.id) as audit_logs_count,
                COUNT(DISTINCT uf.id) as feedback_count,
                AVG(CASE WHEN uf.rating IS NOT NULL THEN uf.rating END) as avg_rating
            FROM users u
            LEFT JOIN data_investigations di ON u.id = di.created_by_id 
                AND di.created_at >= :since_date
            LEFT JOIN processing_jobs pj ON di.id = pj.investigation_id 
                AND pj.created_at >= :since_date
            LEFT JOIN audit_logs al ON u.id = al.user_id 
                AND al.created_at >= :since_date
            LEFT JOIN user_feedback uf ON u.id = uf.user_id 
                AND uf.created_at >= :since_date
            WHERE u.id = :user_id
            GROUP BY u.id
        """)
        
        result = await session.execute(activity_query, {
            "user_id": user_id,
            "since_date": since_date
        })
        
        row = result.fetchone()
        
        if row:
            return {
                "investigations_count": row.investigations_count or 0,
                "processing_jobs_count": row.processing_jobs_count or 0,
                "audit_logs_count": row.audit_logs_count or 0,
                "feedback_count": row.feedback_count or 0,
                "average_rating": float(row.avg_rating) if row.avg_rating else 0.0,
                "period_days": days
            }
        
        return {
            "investigations_count": 0,
            "processing_jobs_count": 0,
            "audit_logs_count": 0,
            "feedback_count": 0,
            "average_rating": 0.0,
            "period_days": days
        }

def query_performance_monitor(func):
    """Decorator to monitor query performance and log slow operations"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = asyncio.get_event_loop().time()
        
        try:
            result = await func(*args, **kwargs)
            
            execution_time = asyncio.get_event_loop().time() - start_time
            
            if execution_time > 2.0:  # Log operations taking more than 2 seconds
                logger.warning(f"Slow database operation: {func.__name__} took {execution_time:.3f}s")
            elif execution_time > 5.0:  # Error for very slow operations
                logger.error(f"Very slow database operation: {func.__name__} took {execution_time:.3f}s")
            
            return result
            
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            logger.error(f"Database operation failed: {func.__name__} after {execution_time:.3f}s - {str(e)}")
            raise
    
    return wrapper


class BulkOperationManager:
    """Utility class for efficient bulk database operations"""
    
    @staticmethod
    @query_performance_monitor
    async def bulk_create_audit_logs(session: AsyncSession, audit_data: List[Dict[str, Any]]) -> None:
        """Efficiently create multiple audit log entries"""
        
        if not audit_data:
            return
        
        # Use bulk insert for better performance
        await session.execute(
            AuditLog.__table__.insert(),
            audit_data
        )
        
        logger.info(f"Bulk created {len(audit_data)} audit log entries")
    
    @staticmethod
    @query_performance_monitor
    async def bulk_update_investigation_status(session: AsyncSession, 
                                             investigation_ids: List[str], 
                                             status: str) -> int:
        """Bulk update investigation statuses"""
        
        if not investigation_ids:
            return 0
        
        result = await session.execute(
            select(DataInvestigation)
            .where(DataInvestigation.id.in_(investigation_ids))
            .execution_options(synchronize_session=False)
        )
        
        updated_count = 0
        for investigation in result.scalars():
            investigation.status = status
            investigation.updated_at = datetime.utcnow()
            updated_count += 1
        
        logger.info(f"Bulk updated {updated_count} investigations to status: {status}")
        return updated_count


class QueryCache:
    """Simple in-memory query result cache for frequently accessed data"""
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self.cache = {}
        self.default_ttl = default_ttl
    
    def _generate_key(self, query_name: str, **kwargs) -> str:
        """Generate cache key from query name and parameters"""
        params_str = json.dumps(kwargs, sort_keys=True, default=str)
        return f"{query_name}:{hash(params_str)}"
    
    def get(self, query_name: str, **kwargs) -> Optional[Any]:
        """Get cached result if available and not expired"""
        key = self._generate_key(query_name, **kwargs)
        
        if key in self.cache:
            result, expiry = self.cache[key]
            if datetime.utcnow() < expiry:
                logger.debug(f"Cache hit for: {query_name}")
                return result
            else:
                del self.cache[key]  # Remove expired entry
        
        logger.debug(f"Cache miss for: {query_name}")
        return None
    
    def set(self, query_name: str, result: Any, ttl: Optional[int] = None, **kwargs) -> None:
        """Cache query result with expiry"""
        key = self._generate_key(query_name, **kwargs)
        expiry = datetime.utcnow() + timedelta(seconds=ttl or self.default_ttl)
        
        self.cache[key] = (result, expiry)
        logger.debug(f"Cached result for: {query_name}")
    
    def invalidate(self, query_name: str, **kwargs) -> None:
        """Invalidate specific cached result"""
        key = self._generate_key(query_name, **kwargs)
        if key in self.cache:
            del self.cache[key]
            logger.debug(f"Invalidated cache for: {query_name}")
    
    def clear(self) -> None:
        """Clear all cached results"""
        self.cache.clear()
        logger.info("Cleared all query cache entries")
    
    def cleanup_expired(self) -> int:
        """Remove expired cache entries"""
        now = datetime.utcnow()
        expired_keys = [
            key for key, (_, expiry) in self.cache.items()
            if now >= expiry
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
        return len(expired_keys)


# Global query cache instance
query_cache = QueryCache()


def cached_query(query_name: str, ttl: Optional[int] = None):
    """Decorator for caching query results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Try to get from cache first
            cached_result = query_cache.get(query_name, **kwargs)
            if cached_result is not None:
                return cached_result
            
            # Execute query and cache result
            result = await func(*args, **kwargs)
            query_cache.set(query_name, result, ttl, **kwargs)
            
            return result
        return wrapper
    return decorator