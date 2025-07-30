"""
Optimized Database Query Patterns for Schlep-engine
===================================================

This module provides optimized query patterns and utilities for common database
operations. These optimizations focus on reducing query complexity, improving
index usage, and minimizing data transfer.

Performance improvements:
- Pagination: Uses cursor-based pagination for large datasets
- Bulk operations: Reduces N+1 query problems
- Query optimization: Uses proper joins and subqueries
- Caching integration: Redis-backed query result caching
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from sqlalchemy import select, func, and_, or_, text, case, exists
from sqlalchemy.sql import Selectable
import json
import hashlib
from dataclasses import dataclass

from app.database.models import (
    User, Organization, ApiKey, DataInvestigation, ProcessingJob, 
    AuditLog, UsageMetric, Workspace, WebhookEndpoint
)
from app.core.redis_client import get_redis_client


@dataclass
class QueryOptions:
    """Query optimization options"""
    use_cache: bool = True
    cache_ttl: int = 300  # 5 minutes
    page_size: int = 50
    include_relations: bool = False
    force_index: Optional[str] = None


class OptimizedQueries:
    """Collection of optimized database queries"""
    
    @staticmethod
    def _generate_cache_key(query_name: str, params: Dict[str, Any]) -> str:
        """Generate cache key from query name and parameters"""
        param_str = json.dumps(params, sort_keys=True, default=str)
        return f"query:{query_name}:{hashlib.md5(param_str.encode()).hexdigest()}"
    
    @staticmethod
    async def _get_cached_result(cache_key: str) -> Optional[Any]:
        """Get cached query result"""
        redis_client = await get_redis_client()
        if redis_client:
            try:
                cached = await redis_client.get(cache_key)
                return json.loads(cached) if cached else None
            except Exception:
                return None
        return None
    
    @staticmethod
    async def _cache_result(cache_key: str, result: Any, ttl: int = 300):
        """Cache query result"""
        redis_client = await get_redis_client()
        if redis_client:
            try:
                await redis_client.setex(
                    cache_key, 
                    ttl, 
                    json.dumps(result, default=str)
                )
            except Exception:
                pass  # Fail silently if caching fails
    
    @staticmethod
    async def get_user_with_org_efficiently(
        db: AsyncSession, 
        user_id: str,
        options: QueryOptions = QueryOptions()
    ) -> Optional[User]:
        """
        Optimized user query with organization data.
        Uses covering index and single query with join.
        """
        cache_key = OptimizedQueries._generate_cache_key(
            "user_with_org", {"user_id": user_id}
        )
        
        if options.use_cache:
            cached = await OptimizedQueries._get_cached_result(cache_key)
            if cached:
                return cached
        
        # Use joinedload for organization to avoid N+1 query
        query = (
            select(User)
            .options(joinedload(User.organization))
            .where(User.id == user_id, User.is_active == True)
        )
        
        result = await db.execute(query)
        user = result.unique().scalar_one_or_none()
        
        if options.use_cache and user:
            await OptimizedQueries._cache_result(cache_key, user, options.cache_ttl)
        
        return user
    
    @staticmethod
    async def get_api_key_with_user_efficiently(
        db: AsyncSession,
        key_hash: str,
        options: QueryOptions = QueryOptions()
    ) -> Optional[ApiKey]:
        """
        Optimized API key validation query.
        Uses covering index to avoid table lookup.
        """
        cache_key = OptimizedQueries._generate_cache_key(
            "api_key_validation", {"key_hash": key_hash}
        )
        
        if options.use_cache:
            cached = await OptimizedQueries._get_cached_result(cache_key)
            if cached:
                return cached
        
        # Query uses covering index idx_api_keys_validation_covering
        query = (
            select(ApiKey, User.email, User.role, User.organization_id)
            .join(User, ApiKey.user_id == User.id)
            .where(
                ApiKey.key_hash == key_hash,
                ApiKey.is_active == True,
                User.is_active == True,
                or_(
                    ApiKey.expires_at.is_(None),
                    ApiKey.expires_at > func.now()
                )
            )
        )
        
        result = await db.execute(query)
        row = result.first()
        
        if options.use_cache and row:
            await OptimizedQueries._cache_result(cache_key, row, options.cache_ttl)
        
        return row
    
    @staticmethod
    async def get_user_investigations_paginated(
        db: AsyncSession,
        user_id: str,
        workspace_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        cursor: Optional[str] = None,
        options: QueryOptions = QueryOptions()
    ) -> Tuple[List[DataInvestigation], Optional[str]]:
        """
        Optimized pagination for user investigations.
        Uses cursor-based pagination for better performance on large datasets.
        """
        query = (
            select(DataInvestigation)
            .where(DataInvestigation.created_by_id == user_id)
            .order_by(DataInvestigation.created_at.desc(), DataInvestigation.id)
        )
        
        # Apply filters using optimized indexes
        if workspace_id:
            query = query.where(DataInvestigation.workspace_id == workspace_id)
        
        if status_filter:
            query = query.where(DataInvestigation.status == status_filter)
        
        # Cursor-based pagination
        if cursor:
            # Decode cursor (timestamp:id format)
            try:
                cursor_time, cursor_id = cursor.split(':')
                cursor_time = datetime.fromisoformat(cursor_time)
                query = query.where(
                    or_(
                        DataInvestigation.created_at < cursor_time,
                        and_(
                            DataInvestigation.created_at == cursor_time,
                            DataInvestigation.id < cursor_id
                        )
                    )
                )
            except (ValueError, TypeError):
                pass  # Invalid cursor, ignore
        
        # Fetch one extra to determine if there are more results
        query = query.limit(options.page_size + 1)
        
        result = await db.execute(query)
        investigations = result.scalars().all()
        
        # Determine next cursor
        next_cursor = None
        if len(investigations) > options.page_size:
            investigations = investigations[:-1]  # Remove extra item
            last_item = investigations[-1]
            next_cursor = f"{last_item.created_at.isoformat()}:{last_item.id}"
        
        return investigations, next_cursor
    
    @staticmethod
    async def get_organization_usage_summary(
        db: AsyncSession,
        organization_id: str,
        start_date: datetime,
        end_date: datetime,
        options: QueryOptions = QueryOptions()
    ) -> Dict[str, Any]:
        """
        Optimized organization usage aggregation.
        Uses covering indexes and efficient aggregation.
        """
        cache_key = OptimizedQueries._generate_cache_key(
            "org_usage_summary", 
            {
                "organization_id": organization_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        if options.use_cache:
            cached = await OptimizedQueries._get_cached_result(cache_key)
            if cached:
                return cached
        
        # Efficient aggregation query using index idx_usage_metrics_period_range
        query = (
            select(
                UsageMetric.metric_type,
                func.sum(UsageMetric.metric_value).label('total_value'),
                func.avg(UsageMetric.metric_value).label('avg_value'),
                func.count(UsageMetric.id).label('record_count')
            )
            .where(
                UsageMetric.organization_id == organization_id,
                UsageMetric.period_start >= start_date,
                UsageMetric.period_end <= end_date
            )
            .group_by(UsageMetric.metric_type)
        )
        
        result = await db.execute(query)
        usage_data = {
            row.metric_type: {
                'total': float(row.total_value),
                'average': float(row.avg_value),
                'count': row.record_count
            }
            for row in result
        }
        
        if options.use_cache:
            await OptimizedQueries._cache_result(cache_key, usage_data, options.cache_ttl)
        
        return usage_data
    
    @staticmethod
    async def get_active_jobs_dashboard(
        db: AsyncSession,
        organization_id: Optional[str] = None,
        options: QueryOptions = QueryOptions()
    ) -> Dict[str, Any]:
        """
        Optimized active jobs dashboard query.
        Uses partial indexes for active jobs.
        """
        cache_key = OptimizedQueries._generate_cache_key(
            "active_jobs_dashboard", {"organization_id": organization_id}
        )
        
        if options.use_cache:
            cached = await OptimizedQueries._get_cached_result(cache_key)
            if cached:
                return cached
        
        # Base query for active jobs using partial index
        base_query = (
            select(
                ProcessingJob.status,
                ProcessingJob.job_type,
                func.count(ProcessingJob.id).label('count'),
                func.avg(ProcessingJob.progress_percentage).label('avg_progress')
            )
            .join(DataInvestigation, ProcessingJob.investigation_id == DataInvestigation.id)
        )
        
        if organization_id:
            base_query = base_query.join(
                Workspace, DataInvestigation.workspace_id == Workspace.id
            ).where(Workspace.organization_id == organization_id)
        
        # Active jobs summary
        active_query = base_query.where(
            ProcessingJob.status.in_(['PENDING', 'RUNNING'])
        ).group_by(ProcessingJob.status, ProcessingJob.job_type)
        
        # Recent completions (last 24 hours)
        recent_completions_query = (
            select(func.count(ProcessingJob.id).label('recent_completions'))
            .where(
                ProcessingJob.status == 'COMPLETED',
                ProcessingJob.completed_at >= func.now() - text("INTERVAL '24 hours'")
            )
        )
        
        # Execute queries concurrently
        active_result = await db.execute(active_query)
        recent_result = await db.execute(recent_completions_query)
        
        dashboard_data = {
            'active_jobs': [
                {
                    'status': row.status,
                    'job_type': row.job_type,
                    'count': row.count,
                    'avg_progress': float(row.avg_progress or 0)
                }
                for row in active_result
            ],
            'recent_completions': recent_result.scalar() or 0,
            'timestamp': datetime.now().isoformat()
        }
        
        if options.use_cache:
            await OptimizedQueries._cache_result(
                cache_key, dashboard_data, options.cache_ttl
            )
        
        return dashboard_data
    
    @staticmethod
    async def bulk_update_api_key_usage(
        db: AsyncSession,
        usage_updates: List[Dict[str, Any]]
    ) -> int:
        """
        Bulk update API key usage efficiently.
        Uses bulk operations to avoid N+1 queries.
        """
        if not usage_updates:
            return 0
        
        # Create bulk update using VALUES clause
        update_values = []
        for update in usage_updates:
            update_values.append(
                f"('{update['key_hash']}', {update['usage_count']}, "
                f"'{update['last_used'].isoformat()}')"
            )
        
        # Efficient bulk update using PostgreSQL-specific syntax
        bulk_update_query = text(f"""
            UPDATE api_keys 
            SET 
                usage_count = usage_count + updates.new_usage::integer,
                last_used = GREATEST(last_used, updates.new_last_used::timestamp)
            FROM (VALUES {','.join(update_values)}) AS updates(key_hash, new_usage, new_last_used)
            WHERE api_keys.key_hash = updates.key_hash
            AND api_keys.is_active = true
        """)
        
        result = await db.execute(bulk_update_query)
        await db.commit()
        
        return result.rowcount
    
    @staticmethod
    async def search_investigations_fulltext(
        db: AsyncSession,
        search_query: str,
        user_id: Optional[str] = None,
        limit: int = 20,
        options: QueryOptions = QueryOptions()
    ) -> List[DataInvestigation]:
        """
        Full-text search for investigations.
        Uses GIN index for fast text search.
        """
        cache_key = OptimizedQueries._generate_cache_key(
            "search_investigations", 
            {"query": search_query, "user_id": user_id, "limit": limit}
        )
        
        if options.use_cache:
            cached = await OptimizedQueries._get_cached_result(cache_key)
            if cached:
                return cached
        
        # Use full-text search with ranking
        query = (
            select(
                DataInvestigation,
                func.ts_rank(
                    func.to_tsvector('english', 
                        func.coalesce(DataInvestigation.name, '') + ' ' + 
                        func.coalesce(DataInvestigation.description, '')
                    ),
                    func.plainto_tsquery('english', search_query)
                ).label('rank')
            )
            .where(
                func.to_tsvector('english', 
                    func.coalesce(DataInvestigation.name, '') + ' ' + 
                    func.coalesce(DataInvestigation.description, '')
                ).op('@@')(func.plainto_tsquery('english', search_query))
            )
        )
        
        if user_id:
            query = query.where(DataInvestigation.created_by_id == user_id)
        
        query = query.order_by(text('rank DESC')).limit(limit)
        
        result = await db.execute(query)
        investigations = [row.DataInvestigation for row in result]
        
        if options.use_cache:
            await OptimizedQueries._cache_result(
                cache_key, investigations, options.cache_ttl
            )
        
        return investigations


class QueryAnalyzer:
    """Query performance analysis utilities"""
    
    @staticmethod
    async def explain_query(db: AsyncSession, query: Selectable) -> Dict[str, Any]:
        """Get query execution plan"""
        explain_query = text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {str(query)}")
        result = await db.execute(explain_query)
        return result.scalar()
    
    @staticmethod
    async def get_slow_queries(db: AsyncSession, limit: int = 10) -> List[Dict[str, Any]]:
        """Get slow queries from pg_stat_statements"""
        query = text("""
            SELECT 
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                max_exec_time,
                stddev_exec_time,
                rows,
                100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
            FROM pg_stat_statements 
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY total_exec_time DESC 
            LIMIT :limit
        """)
        
        result = await db.execute(query, {"limit": limit})
        return [dict(row) for row in result]
    
    @staticmethod
    async def get_index_usage_stats(db: AsyncSession) -> List[Dict[str, Any]]:
        """Get index usage statistics"""
        query = text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_tup_read,
                idx_tup_fetch,
                idx_scan,
                CASE WHEN idx_scan = 0 THEN 'Unused'
                     WHEN idx_scan < 10 THEN 'Low usage'
                     ELSE 'Active'
                END as usage_status
            FROM pg_stat_user_indexes 
            ORDER BY idx_scan DESC
        """)
        
        result = await db.execute(query)
        return [dict(row) for row in result]