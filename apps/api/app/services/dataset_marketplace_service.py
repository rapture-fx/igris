"""
Dataset Marketplace Service
==========================

Core service for the Dataset Marketplace providing comprehensive dataset management,
discovery, sharing, and integration with MLOps workflows.

Features:
- Dataset cataloging with rich metadata and versioning
- Advanced search and discovery with filters and recommendations
- Access control and permission management
- Usage tracking and analytics
- Quality assessment integration
- Review and rating system
- Collection management
- Integration with experiment tracking
- Automated recommendations
- Data lineage tracking
"""

import os
import json
import logging
import asyncio
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
import pandas as pd
import numpy as np

# Database and ORM
try:
    from sqlalchemy.orm import Session
    from sqlalchemy import and_, or_, desc, func, text
    from app.database.connection import get_database_session
    from app.models.dataset_marketplace import (
        Dataset, DatasetVersion, DataQualityReport, DatasetUsageLog,
        DatasetReview, DatasetShare, DatasetProcessingJob, DatasetLineage,
        DatasetMetrics, DatasetRecommendation, DatasetTag, DatasetCollection,
        DatasetCollectionItem, ExperimentDatasetUsage,
        DatasetStatus, DatasetType, DataFormat, AccessLevel, UsageType,
        SharePermission, ProcessingStatus
    )
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False

# Integration services
try:
    from app.services.dataset_quality_analyzer import DatasetQualityAnalyzer
    from app.services.dataset_processor import DatasetProcessor
    from app.ml.mlops_platform import MLOpsCore
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False

logger = logging.getLogger(__name__)


# Data classes for service responses
@dataclass
class DatasetSearchFilters:
    """Filters for dataset search."""
    query: Optional[str] = None
    dataset_types: List[DatasetType] = None
    access_levels: List[AccessLevel] = None
    quality_min: Optional[float] = None
    tags: List[str] = None
    created_by: Optional[str] = None
    organization: Optional[str] = None
    min_size_mb: Optional[float] = None
    max_size_mb: Optional[float] = None
    has_splits: Optional[bool] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    is_featured: Optional[bool] = None
    
    def __post_init__(self):
        if self.dataset_types is None:
            self.dataset_types = []
        if self.access_levels is None:
            self.access_levels = []
        if self.tags is None:
            self.tags = []


@dataclass
class DatasetSearchResult:
    """Result item from dataset search."""
    dataset_id: str
    name: str
    title: str
    description: str
    dataset_type: str
    access_level: str
    quality_score: float
    quality_level: str
    size_mb: float
    row_count: int
    created_by: str
    created_at: datetime
    download_count: int
    average_rating: float
    tags: List[str]
    is_featured: bool


@dataclass
class DatasetCatalogEntry:
    """Complete dataset catalog entry."""
    dataset: Dataset
    latest_version: Optional[DatasetVersion]
    quality_report: Optional[DataQualityReport]
    usage_stats: Dict[str, Any]
    user_permissions: List[str]


@dataclass 
class RecommendationRequest:
    """Request for dataset recommendations."""
    user_id: str
    context_dataset_id: Optional[str] = None
    use_case: Optional[str] = None
    preferred_types: List[DatasetType] = None
    quality_threshold: float = 70.0
    limit: int = 10
    
    def __post_init__(self):
        if self.preferred_types is None:
            self.preferred_types = []


class DatasetMarketplaceService:
    """
    Core service for dataset marketplace operations including cataloging,
    search, sharing, and integration with MLOps workflows.
    """
    
    def __init__(self, 
                 storage_path: str = "./marketplace_storage",
                 quality_analyzer: DatasetQualityAnalyzer = None,
                 dataset_processor: DatasetProcessor = None):
        
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        
        # Initialize component services
        self.quality_analyzer = quality_analyzer or (DatasetQualityAnalyzer() if SERVICES_AVAILABLE else None)
        self.dataset_processor = dataset_processor or (DatasetProcessor() if SERVICES_AVAILABLE else None)
        
        # Search and recommendation configuration
        self.search_config = {
            'max_results': 100,
            'default_limit': 20,
            'relevance_threshold': 0.1,
            'recommendation_cache_hours': 24
        }
        
        # Cache for expensive operations
        self._recommendation_cache = {}
        self._search_cache = {}
        
        logger.info("Dataset Marketplace Service initialized")
    
    async def catalog_dataset(self,
                            name: str,
                            file_path: str,
                            dataset_type: DatasetType,
                            created_by: str,
                            title: str = None,
                            description: str = None,
                            tags: List[str] = None,
                            access_level: AccessLevel = AccessLevel.PRIVATE,
                            organization: str = None,
                            auto_quality_check: bool = True,
                            metadata: Dict[str, Any] = None) -> str:
        """
        Catalog a new dataset in the marketplace.
        
        Args:
            name: Dataset name (unique identifier)
            file_path: Path to the dataset file
            dataset_type: Type of dataset
            created_by: User who is cataloging the dataset
            title: Human-readable title
            description: Dataset description
            tags: List of tags for categorization
            access_level: Access level for the dataset
            organization: Organization name
            auto_quality_check: Whether to run automatic quality assessment
            metadata: Additional metadata
            
        Returns:
            Dataset ID of the cataloged dataset
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available for cataloging")
        
        logger.info(f"Cataloging dataset: {name}")
        
        try:
            # Generate dataset ID
            dataset_id = str(uuid.uuid4())
            
            # Analyze file to get basic information
            file_info = await self._analyze_file(file_path)
            
            # Determine format
            file_format = self._detect_file_format(file_path)
            
            async with get_database_session() as session:
                # Create dataset record
                dataset = Dataset(
                    dataset_id=dataset_id,
                    name=name,
                    title=title or name,
                    description=description or "",
                    dataset_type=dataset_type,
                    categories=metadata.get('categories', []) if metadata else [],
                    tags=tags or [],
                    created_by=created_by,
                    organization=organization,
                    access_level=access_level,
                    primary_format=file_format,
                    supported_formats=[file_format],
                    total_size_bytes=file_info['size_bytes'],
                    row_count=file_info.get('row_count', 0),
                    column_count=file_info.get('column_count', 0),
                    storage_backend="local",
                    primary_location=file_path,
                    status=DatasetStatus.DRAFT
                )
                
                session.add(dataset)
                await session.flush()
                
                # Create initial version
                version = DatasetVersion(
                    dataset_id=dataset_id,
                    version="1.0",
                    version_name="Initial version",
                    description="Initial dataset version",
                    is_current=True,
                    size_bytes=file_info['size_bytes'],
                    row_count=file_info.get('row_count', 0),
                    column_count=file_info.get('column_count', 0),
                    storage_location=file_path,
                    created_by=created_by
                )
                
                session.add(version)
                await session.flush()
                
                # Run quality assessment if requested
                if auto_quality_check and self.quality_analyzer:
                    try:
                        quality_results = await self._run_quality_assessment(
                            file_path, dataset_id, version.version_id, session
                        )
                        
                        # Update dataset with quality scores
                        dataset.quality_score = quality_results.get('overall_quality_score', 0)
                        dataset.quality_level = quality_results.get('quality_level', 'unknown')
                        dataset.completeness_score = quality_results.get('completeness_score', 0)
                        dataset.consistency_score = quality_results.get('consistency_score', 0)
                        dataset.validity_score = quality_results.get('validity_score', 0)
                        dataset.accuracy_score = quality_results.get('accuracy_score', 0)
                        
                    except Exception as e:
                        logger.warning(f"Quality assessment failed: {str(e)}")
                
                # Set status to published if quality is good enough
                if dataset.quality_score >= 70:
                    dataset.status = DatasetStatus.PUBLISHED
                
                await session.commit()
                
                # Log the cataloging event
                await self._log_usage(
                    dataset_id, created_by, UsageType.EXPLORATION, 
                    session, success=True, purpose="Dataset cataloging"
                )
                
                logger.info(f"Successfully cataloged dataset {name} with ID {dataset_id}")
                return dataset_id
                
        except Exception as e:
            logger.error(f"Failed to catalog dataset {name}: {str(e)}")
            raise Exception(f"Dataset cataloging failed: {str(e)}")
    
    async def search_datasets(self,
                            filters: DatasetSearchFilters,
                            user_id: str,
                            limit: int = None,
                            offset: int = 0,
                            sort_by: str = "relevance") -> Tuple[List[DatasetSearchResult], int]:
        """
        Search datasets with advanced filtering and ranking.
        
        Args:
            filters: Search filters and criteria
            user_id: User performing the search
            limit: Maximum number of results
            offset: Result offset for pagination
            sort_by: Sort criteria (relevance, created_at, quality_score, rating)
            
        Returns:
            Tuple of (search results, total count)
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available for search")
        
        limit = limit or self.search_config['default_limit']
        
        logger.info(f"Searching datasets for user {user_id}")
        logger.debug(f"Filters: {filters}")
        
        try:
            async with get_database_session() as session:
                # Build base query
                query = session.query(Dataset).filter(
                    Dataset.status.in_([DatasetStatus.PUBLISHED, DatasetStatus.PRIVATE])
                )
                
                # Apply access control filters
                accessible_datasets = await self._get_accessible_datasets(user_id, session)
                if accessible_datasets is not None:
                    query = query.filter(Dataset.dataset_id.in_(accessible_datasets))
                
                # Apply search filters
                query = await self._apply_search_filters(query, filters)
                
                # Get total count before applying pagination
                total_count = query.count()
                
                # Apply sorting
                query = await self._apply_sorting(query, sort_by, filters.query)
                
                # Apply pagination
                datasets = query.offset(offset).limit(limit).all()
                
                # Convert to search results
                results = []
                for dataset in datasets:
                    result = DatasetSearchResult(
                        dataset_id=dataset.dataset_id,
                        name=dataset.name,
                        title=dataset.title or dataset.name,
                        description=dataset.description or "",
                        dataset_type=dataset.dataset_type.value,
                        access_level=dataset.access_level.value,
                        quality_score=dataset.quality_score or 0,
                        quality_level=dataset.quality_level.value if dataset.quality_level else 'unknown',
                        size_mb=dataset.size_mb,
                        row_count=dataset.row_count or 0,
                        created_by=dataset.created_by,
                        created_at=dataset.created_at,
                        download_count=dataset.download_count,
                        average_rating=dataset.average_rating or 0,
                        tags=dataset.tags or [],
                        is_featured=dataset.is_featured or False
                    )
                    results.append(result)
                
                logger.info(f"Found {total_count} datasets, returning {len(results)} results")
                return results, total_count
                
        except Exception as e:
            logger.error(f"Dataset search failed: {str(e)}")
            raise Exception(f"Search failed: {str(e)}")
    
    async def get_dataset_details(self,
                                dataset_id: str,
                                user_id: str,
                                include_quality_report: bool = True,
                                include_usage_stats: bool = True) -> DatasetCatalogEntry:
        """
        Get detailed information about a dataset.
        
        Args:
            dataset_id: Dataset identifier
            user_id: User requesting the information
            include_quality_report: Whether to include quality assessment
            include_usage_stats: Whether to include usage statistics
            
        Returns:
            Complete dataset catalog entry with all details
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        logger.info(f"Getting dataset details for {dataset_id}")
        
        try:
            async with get_database_session() as session:
                # Get dataset
                dataset = session.query(Dataset).filter(
                    Dataset.dataset_id == dataset_id
                ).first()
                
                if not dataset:
                    raise ValueError(f"Dataset {dataset_id} not found")
                
                # Check access permissions
                has_access = await self._check_dataset_access(dataset_id, user_id, session)
                if not has_access:
                    raise PermissionError(f"Access denied to dataset {dataset_id}")
                
                # Get latest version
                latest_version = session.query(DatasetVersion).filter(
                    DatasetVersion.dataset_id == dataset_id,
                    DatasetVersion.is_current == True
                ).first()
                
                # Get quality report if requested
                quality_report = None
                if include_quality_report:
                    quality_report = session.query(DataQualityReport).filter(
                        DataQualityReport.dataset_id == dataset_id
                    ).order_by(desc(DataQualityReport.generated_at)).first()
                
                # Get usage statistics if requested
                usage_stats = {}
                if include_usage_stats:
                    usage_stats = await self._get_usage_statistics(dataset_id, session)
                
                # Get user permissions
                user_permissions = await self._get_user_permissions(dataset_id, user_id, session)
                
                # Log access
                await self._log_usage(
                    dataset_id, user_id, UsageType.EXPLORATION,
                    session, success=True, purpose="Dataset details view"
                )
                
                # Update view count
                dataset.view_count = (dataset.view_count or 0) + 1
                await session.commit()
                
                return DatasetCatalogEntry(
                    dataset=dataset,
                    latest_version=latest_version,
                    quality_report=quality_report,
                    usage_stats=usage_stats,
                    user_permissions=user_permissions
                )
                
        except Exception as e:
            logger.error(f"Failed to get dataset details for {dataset_id}: {str(e)}")
            raise
    
    async def share_dataset(self,
                          dataset_id: str,
                          shared_by: str,
                          shared_with_id: str,
                          shared_with_type: str,
                          permission: SharePermission,
                          expires_at: datetime = None,
                          max_downloads: int = None,
                          terms: str = None) -> str:
        """
        Share a dataset with users, teams, or organizations.
        
        Args:
            dataset_id: Dataset to share
            shared_by: User sharing the dataset
            shared_with_id: ID of user/team/organization receiving access
            shared_with_type: Type of recipient (user, team, organization)
            permission: Permission level to grant
            expires_at: Optional expiration date
            max_downloads: Optional download limit
            terms: Optional terms of use
            
        Returns:
            Share ID for tracking
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        logger.info(f"Sharing dataset {dataset_id} with {shared_with_type} {shared_with_id}")
        
        try:
            async with get_database_session() as session:
                # Verify dataset exists and user has admin access
                dataset = session.query(Dataset).filter(
                    Dataset.dataset_id == dataset_id
                ).first()
                
                if not dataset:
                    raise ValueError(f"Dataset {dataset_id} not found")
                
                has_admin = await self._check_dataset_access(
                    dataset_id, shared_by, session, required_permission="admin"
                )
                if not has_admin:
                    raise PermissionError("Insufficient permissions to share dataset")
                
                # Create share record
                share = DatasetShare(
                    dataset_id=dataset_id,
                    shared_with_type=shared_with_type,
                    shared_with_id=shared_with_id,
                    permission=permission,
                    shared_by=shared_by,
                    expires_at=expires_at,
                    max_downloads=max_downloads,
                    share_reason=terms
                )
                
                session.add(share)
                await session.commit()
                
                logger.info(f"Dataset {dataset_id} shared successfully, share ID: {share.share_id}")
                return share.share_id
                
        except Exception as e:
            logger.error(f"Failed to share dataset {dataset_id}: {str(e)}")
            raise Exception(f"Dataset sharing failed: {str(e)}")
    
    async def download_dataset(self,
                             dataset_id: str,
                             user_id: str,
                             format_requested: DataFormat = None,
                             purpose: str = None) -> Tuple[str, Dict[str, Any]]:
        """
        Download a dataset with usage tracking.
        
        Args:
            dataset_id: Dataset to download
            user_id: User downloading the dataset
            format_requested: Requested format (if conversion needed)
            purpose: Purpose of download for tracking
            
        Returns:
            Tuple of (file_path, download_metadata)
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        logger.info(f"Processing download request for dataset {dataset_id} by user {user_id}")
        
        try:
            async with get_database_session() as session:
                # Check access permissions
                has_access = await self._check_dataset_access(
                    dataset_id, user_id, session, required_permission="download"
                )
                if not has_access:
                    raise PermissionError(f"Download access denied for dataset {dataset_id}")
                
                # Get dataset
                dataset = session.query(Dataset).filter(
                    Dataset.dataset_id == dataset_id
                ).first()
                
                if not dataset:
                    raise ValueError(f"Dataset {dataset_id} not found")
                
                # Get current version
                version = session.query(DatasetVersion).filter(
                    DatasetVersion.dataset_id == dataset_id,
                    DatasetVersion.is_current == True
                ).first()
                
                if not version:
                    raise ValueError(f"No current version found for dataset {dataset_id}")
                
                file_path = version.storage_location
                
                # Handle format conversion if needed
                if format_requested and format_requested != dataset.primary_format:
                    if self.dataset_processor:
                        file_path = await self._convert_format(
                            version.storage_location, format_requested, dataset_id
                        )
                    else:
                        logger.warning(f"Format conversion requested but processor not available")
                
                # Log download
                await self._log_usage(
                    dataset_id, user_id, UsageType.TRAINING,
                    session, success=True, purpose=purpose or "Dataset download",
                    bytes_transferred=version.size_bytes,
                    format_used=format_requested or dataset.primary_format
                )
                
                # Update download count
                dataset.download_count = (dataset.download_count or 0) + 1
                await session.commit()
                
                # Prepare download metadata
                metadata = {
                    'dataset_id': dataset_id,
                    'dataset_name': dataset.name,
                    'version': version.version,
                    'format': format_requested or dataset.primary_format,
                    'size_bytes': version.size_bytes,
                    'quality_score': dataset.quality_score,
                    'download_timestamp': datetime.utcnow().isoformat(),
                    'citation': dataset.citation
                }
                
                logger.info(f"Dataset {dataset_id} download prepared for user {user_id}")
                return file_path, metadata
                
        except Exception as e:
            # Log failed download attempt
            if DATABASE_AVAILABLE:
                try:
                    async with get_database_session() as session:
                        await self._log_usage(
                            dataset_id, user_id, UsageType.TRAINING,
                            session, success=False, purpose=purpose or "Dataset download",
                            error_message=str(e)
                        )
                        await session.commit()
                except:
                    pass
            
            logger.error(f"Dataset download failed for {dataset_id}: {str(e)}")
            raise
    
    async def add_dataset_review(self,
                               dataset_id: str,
                               reviewer_id: str,
                               overall_rating: int,
                               title: str = None,
                               review_text: str = None,
                               quality_rating: int = None,
                               usability_rating: int = None,
                               use_case: str = None) -> str:
        """
        Add a review and rating for a dataset.
        
        Args:
            dataset_id: Dataset being reviewed
            reviewer_id: User submitting the review
            overall_rating: Overall rating (1-5)
            title: Review title
            review_text: Review content
            quality_rating: Quality rating (1-5)
            usability_rating: Usability rating (1-5)
            use_case: How the dataset was used
            
        Returns:
            Review ID
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        if not 1 <= overall_rating <= 5:
            raise ValueError("Overall rating must be between 1 and 5")
        
        logger.info(f"Adding review for dataset {dataset_id} by user {reviewer_id}")
        
        try:
            async with get_database_session() as session:
                # Verify dataset exists and user has used it
                dataset = session.query(Dataset).filter(
                    Dataset.dataset_id == dataset_id
                ).first()
                
                if not dataset:
                    raise ValueError(f"Dataset {dataset_id} not found")
                
                # Check if user has downloaded/used the dataset
                has_used = session.query(DatasetUsageLog).filter(
                    DatasetUsageLog.dataset_id == dataset_id,
                    DatasetUsageLog.user_id == reviewer_id,
                    DatasetUsageLog.success == True
                ).first() is not None
                
                if not has_used:
                    logger.warning(f"User {reviewer_id} hasn't used dataset {dataset_id}")
                
                # Create review
                review = DatasetReview(
                    dataset_id=dataset_id,
                    reviewer_id=reviewer_id,
                    title=title,
                    review_text=review_text,
                    overall_rating=overall_rating,
                    quality_rating=quality_rating,
                    usability_rating=usability_rating,
                    use_case=use_case,
                    is_verified_user=has_used
                )
                
                session.add(review)
                await session.flush()
                
                # Update dataset rating statistics
                await self._update_dataset_ratings(dataset_id, session)
                
                await session.commit()
                
                logger.info(f"Review added for dataset {dataset_id}, review ID: {review.review_id}")
                return review.review_id
                
        except Exception as e:
            logger.error(f"Failed to add review for dataset {dataset_id}: {str(e)}")
            raise Exception(f"Review submission failed: {str(e)}")
    
    async def get_dataset_recommendations(self,
                                        request: RecommendationRequest) -> List[DatasetSearchResult]:
        """
        Get personalized dataset recommendations for a user.
        
        Args:
            request: Recommendation request with user context
            
        Returns:
            List of recommended datasets
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        logger.info(f"Getting recommendations for user {request.user_id}")
        
        # Check cache first
        cache_key = f"rec_{request.user_id}_{request.context_dataset_id}_{request.use_case}"
        if cache_key in self._recommendation_cache:
            cached_result, timestamp = self._recommendation_cache[cache_key]
            if datetime.utcnow() - timestamp < timedelta(hours=self.search_config['recommendation_cache_hours']):
                logger.info("Returning cached recommendations")
                return cached_result
        
        try:
            async with get_database_session() as session:
                # Get user's usage history
                user_history = await self._get_user_dataset_history(request.user_id, session)
                
                # Get base candidates (high quality, accessible datasets)
                candidates_query = session.query(Dataset).filter(
                    Dataset.status == DatasetStatus.PUBLISHED,
                    Dataset.quality_score >= request.quality_threshold
                )
                
                # Apply type filters if specified
                if request.preferred_types:
                    candidates_query = candidates_query.filter(
                        Dataset.dataset_type.in_(request.preferred_types)
                    )
                
                # Exclude datasets user has already downloaded
                if user_history:
                    candidates_query = candidates_query.filter(
                        ~Dataset.dataset_id.in_(user_history)
                    )
                
                candidates = candidates_query.all()
                
                # Score candidates based on various factors
                scored_candidates = []
                for dataset in candidates:
                    score = await self._calculate_recommendation_score(
                        dataset, request, user_history, session
                    )
                    if score > self.search_config['relevance_threshold']:
                        scored_candidates.append((dataset, score))
                
                # Sort by score and limit results
                scored_candidates.sort(key=lambda x: x[1], reverse=True)
                top_candidates = scored_candidates[:request.limit]
                
                # Convert to search results
                recommendations = []
                for dataset, score in top_candidates:
                    result = DatasetSearchResult(
                        dataset_id=dataset.dataset_id,
                        name=dataset.name,
                        title=dataset.title or dataset.name,
                        description=dataset.description or "",
                        dataset_type=dataset.dataset_type.value,
                        access_level=dataset.access_level.value,
                        quality_score=dataset.quality_score or 0,
                        quality_level=dataset.quality_level.value if dataset.quality_level else 'unknown',
                        size_mb=dataset.size_mb,
                        row_count=dataset.row_count or 0,
                        created_by=dataset.created_by,
                        created_at=dataset.created_at,
                        download_count=dataset.download_count,
                        average_rating=dataset.average_rating or 0,
                        tags=dataset.tags or [],
                        is_featured=dataset.is_featured or False
                    )
                    recommendations.append(result)
                
                # Cache results
                self._recommendation_cache[cache_key] = (recommendations, datetime.utcnow())
                
                logger.info(f"Generated {len(recommendations)} recommendations for user {request.user_id}")
                return recommendations
                
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {str(e)}")
            raise Exception(f"Recommendation generation failed: {str(e)}")
    
    async def create_dataset_collection(self,
                                      name: str,
                                      title: str,
                                      description: str,
                                      curator_id: str,
                                      category: str = None,
                                      is_public: bool = True,
                                      dataset_ids: List[str] = None) -> str:
        """
        Create a curated collection of datasets.
        
        Args:
            name: Collection name
            title: Collection title
            description: Collection description
            curator_id: User creating the collection
            category: Collection category
            is_public: Whether collection is publicly visible
            dataset_ids: Initial datasets to include
            
        Returns:
            Collection ID
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        logger.info(f"Creating dataset collection: {name}")
        
        try:
            async with get_database_session() as session:
                # Create collection
                collection = DatasetCollection(
                    name=name,
                    title=title,
                    description=description,
                    curator_id=curator_id,
                    category=category,
                    is_public=is_public
                )
                
                session.add(collection)
                await session.flush()
                
                # Add initial datasets if provided
                if dataset_ids:
                    for i, dataset_id in enumerate(dataset_ids):
                        # Verify dataset exists and is accessible
                        dataset = session.query(Dataset).filter(
                            Dataset.dataset_id == dataset_id
                        ).first()
                        
                        if dataset:
                            item = DatasetCollectionItem(
                                collection_id=collection.collection_id,
                                dataset_id=dataset_id,
                                added_by=curator_id,
                                order_index=i
                            )
                            session.add(item)
                
                await session.commit()
                
                logger.info(f"Collection created: {collection.collection_id}")
                return collection.collection_id
                
        except Exception as e:
            logger.error(f"Failed to create collection: {str(e)}")
            raise Exception(f"Collection creation failed: {str(e)}")
    
    # Integration with MLOps platform
    async def link_dataset_to_experiment(self,
                                       dataset_id: str,
                                       experiment_id: str,
                                       usage_type: UsageType,
                                       user_id: str,
                                       version_used: str = None,
                                       columns_used: List[str] = None,
                                       split_type: str = None) -> str:
        """
        Link a dataset to an MLOps experiment for tracking.
        
        Args:
            dataset_id: Dataset being used
            experiment_id: MLOps experiment ID
            usage_type: How the dataset is being used
            user_id: User running the experiment
            version_used: Specific version used
            columns_used: Specific columns used
            split_type: train/validation/test split
            
        Returns:
            Usage link ID
        """
        
        if not DATABASE_AVAILABLE:
            raise Exception("Database not available")
        
        logger.info(f"Linking dataset {dataset_id} to experiment {experiment_id}")
        
        try:
            async with get_database_session() as session:
                # Verify dataset access
                has_access = await self._check_dataset_access(dataset_id, user_id, session)
                if not has_access:
                    raise PermissionError(f"Access denied to dataset {dataset_id}")
                
                # Create experiment usage link
                usage_link = ExperimentDatasetUsage(
                    experiment_id=experiment_id,
                    dataset_id=dataset_id,
                    usage_type=usage_type,
                    version_used=version_used,
                    columns_used=columns_used,
                    split_type=split_type
                )
                
                session.add(usage_link)
                
                # Log the usage
                await self._log_usage(
                    dataset_id, user_id, usage_type, session,
                    success=True, purpose="MLOps experiment",
                    project_id=experiment_id
                )
                
                await session.commit()
                
                logger.info(f"Dataset {dataset_id} linked to experiment {experiment_id}")
                return str(usage_link.id)
                
        except Exception as e:
            logger.error(f"Failed to link dataset to experiment: {str(e)}")
            raise Exception(f"Dataset-experiment linking failed: {str(e)}")
    
    # Private helper methods
    async def _analyze_file(self, file_path: str) -> Dict[str, Any]:
        """Analyze file to extract basic information."""
        
        file_info = {
            'size_bytes': os.path.getsize(file_path),
            'row_count': None,
            'column_count': None
        }
        
        try:
            # Try to load as pandas DataFrame to get dimensions
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path, nrows=1)  # Just get header
                file_info['column_count'] = len(df.columns)
                
                # Get row count efficiently
                with open(file_path, 'r') as f:
                    file_info['row_count'] = sum(1 for line in f) - 1  # Subtract header
            
            elif file_path.endswith('.json'):
                df = pd.read_json(file_path, nrows=1)
                file_info['column_count'] = len(df.columns)
                
                # For JSON, load full file to count records
                df_full = pd.read_json(file_path)
                file_info['row_count'] = len(df_full)
        
        except Exception as e:
            logger.warning(f"Could not analyze file structure: {str(e)}")
        
        return file_info
    
    def _detect_file_format(self, file_path: str) -> DataFormat:
        """Detect file format from extension."""
        
        extension = os.path.splitext(file_path)[1].lower()
        
        format_mapping = {
            '.csv': DataFormat.CSV,
            '.json': DataFormat.JSON,
            '.jsonl': DataFormat.JSONL,
            '.parquet': DataFormat.PARQUET,
            '.xlsx': DataFormat.XLSX,
            '.txt': DataFormat.TXT,
            '.h5': DataFormat.HDF5,
            '.hdf5': DataFormat.HDF5,
        }
        
        return format_mapping.get(extension, DataFormat.CSV)
    
    async def _run_quality_assessment(self,
                                    file_path: str,
                                    dataset_id: str,
                                    version_id: str,
                                    session: Session) -> Dict[str, Any]:
        """Run quality assessment on a dataset file."""
        
        if not self.quality_analyzer:
            raise Exception("Quality analyzer not available")
        
        try:
            # Load data for analysis
            data = pd.read_csv(file_path)  # Simplified - would handle different formats
            
            # Run quality analysis
            results = await self.quality_analyzer.analyze_dataset_quality(
                data, dataset_id, version_id, save_to_db=False
            )
            
            # Create quality report record
            quality_report = DataQualityReport(
                dataset_id=dataset_id,
                version_id=version_id,
                overall_score=results.get('overall_quality_score', 0),
                quality_level=results.get('quality_level', 'unknown'),
                completeness_score=results.get('completeness_score', 0),
                consistency_score=results.get('consistency_score', 0),
                validity_score=results.get('validity_score', 0),
                accuracy_score=results.get('accuracy_score', 0),
                uniqueness_score=results.get('uniqueness_score', 0),
                timeliness_score=results.get('timeliness_score', 0),
                column_profiles=results.get('column_profiles', []),
                anomalies_detected=results.get('anomalies_detected', 0),
                quality_issues=results.get('quality_issues', []),
                recommendations=results.get('recommendations', []),
                generated_by="automated",
                assessment_duration_seconds=results.get('processing_time_seconds', 0)
            )
            
            session.add(quality_report)
            
            return results
            
        except Exception as e:
            logger.error(f"Quality assessment failed: {str(e)}")
            raise
    
    async def _get_accessible_datasets(self, user_id: str, session: Session) -> Optional[List[str]]:
        """Get list of dataset IDs accessible to user."""
        
        # Get publicly accessible datasets
        public_datasets = session.query(Dataset.dataset_id).filter(
            Dataset.access_level == AccessLevel.PUBLIC,
            Dataset.status == DatasetStatus.PUBLISHED
        ).all()
        
        # Get datasets owned by user
        owned_datasets = session.query(Dataset.dataset_id).filter(
            Dataset.created_by == user_id
        ).all()
        
        # Get datasets shared with user
        shared_datasets = session.query(DatasetShare.dataset_id).filter(
            DatasetShare.shared_with_id == user_id,
            DatasetShare.shared_with_type == "user",
            DatasetShare.is_active == True
        ).all()
        
        # Combine all accessible datasets
        accessible = set()
        accessible.update([d[0] for d in public_datasets])
        accessible.update([d[0] for d in owned_datasets])
        accessible.update([d[0] for d in shared_datasets])
        
        return list(accessible) if accessible else None
    
    async def _apply_search_filters(self, query, filters: DatasetSearchFilters):
        """Apply search filters to query."""
        
        # Text search
        if filters.query:
            search_term = f"%{filters.query}%"
            query = query.filter(
                or_(
                    Dataset.name.ilike(search_term),
                    Dataset.title.ilike(search_term),
                    Dataset.description.ilike(search_term),
                    Dataset.tags.contains([filters.query])
                )
            )
        
        # Dataset types
        if filters.dataset_types:
            query = query.filter(Dataset.dataset_type.in_(filters.dataset_types))
        
        # Access levels
        if filters.access_levels:
            query = query.filter(Dataset.access_level.in_(filters.access_levels))
        
        # Quality score
        if filters.quality_min:
            query = query.filter(Dataset.quality_score >= filters.quality_min)
        
        # Tags
        if filters.tags:
            for tag in filters.tags:
                query = query.filter(Dataset.tags.contains([tag]))
        
        # Creator
        if filters.created_by:
            query = query.filter(Dataset.created_by == filters.created_by)
        
        # Organization
        if filters.organization:
            query = query.filter(Dataset.organization == filters.organization)
        
        # Size filters
        if filters.min_size_mb:
            min_bytes = filters.min_size_mb * 1024 * 1024
            query = query.filter(Dataset.total_size_bytes >= min_bytes)
        
        if filters.max_size_mb:
            max_bytes = filters.max_size_mb * 1024 * 1024
            query = query.filter(Dataset.total_size_bytes <= max_bytes)
        
        # Date filters
        if filters.created_after:
            query = query.filter(Dataset.created_at >= filters.created_after)
        
        if filters.created_before:
            query = query.filter(Dataset.created_at <= filters.created_before)
        
        # Featured datasets
        if filters.is_featured:
            query = query.filter(Dataset.is_featured == True)
        
        return query
    
    async def _apply_sorting(self, query, sort_by: str, search_query: str = None):
        """Apply sorting to query."""
        
        if sort_by == "relevance" and search_query:
            # For text search, sort by relevance (simplified)
            query = query.order_by(desc(Dataset.average_rating), desc(Dataset.download_count))
        elif sort_by == "created_at":
            query = query.order_by(desc(Dataset.created_at))
        elif sort_by == "quality_score":
            query = query.order_by(desc(Dataset.quality_score))
        elif sort_by == "rating":
            query = query.order_by(desc(Dataset.average_rating))
        elif sort_by == "downloads":
            query = query.order_by(desc(Dataset.download_count))
        elif sort_by == "size":
            query = query.order_by(desc(Dataset.total_size_bytes))
        else:
            # Default sorting
            query = query.order_by(desc(Dataset.is_featured), desc(Dataset.created_at))
        
        return query
    
    async def _check_dataset_access(self,
                                  dataset_id: str,
                                  user_id: str,
                                  session: Session,
                                  required_permission: str = "view") -> bool:
        """Check if user has access to dataset with specified permission."""
        
        # Get dataset
        dataset = session.query(Dataset).filter(
            Dataset.dataset_id == dataset_id
        ).first()
        
        if not dataset:
            return False
        
        # Owner always has access
        if dataset.created_by == user_id:
            return True
        
        # Public datasets are viewable by everyone
        if dataset.access_level == AccessLevel.PUBLIC and required_permission in ["view", "download"]:
            return True
        
        # Check explicit shares
        share = session.query(DatasetShare).filter(
            DatasetShare.dataset_id == dataset_id,
            DatasetShare.shared_with_id == user_id,
            DatasetShare.shared_with_type == "user",
            DatasetShare.is_active == True
        ).first()
        
        if share and not share.is_expired:
            permission_hierarchy = {
                "view": 1,
                "download": 2,
                "edit": 3,
                "admin": 4
            }
            
            user_level = permission_hierarchy.get(share.permission.value, 0)
            required_level = permission_hierarchy.get(required_permission, 1)
            
            return user_level >= required_level
        
        return False
    
    async def _log_usage(self,
                       dataset_id: str,
                       user_id: str,
                       usage_type: UsageType,
                       session: Session,
                       success: bool = True,
                       purpose: str = None,
                       bytes_transferred: int = None,
                       format_used: DataFormat = None,
                       project_id: str = None,
                       error_message: str = None):
        """Log dataset usage for analytics."""
        
        usage_log = DatasetUsageLog(
            dataset_id=dataset_id,
            user_id=user_id,
            usage_type=usage_type,
            access_method="api",
            purpose=purpose,
            project_id=project_id,
            bytes_transferred=bytes_transferred,
            format_used=format_used,
            success=success,
            error_message=error_message
        )
        
        session.add(usage_log)
    
    async def _get_usage_statistics(self, dataset_id: str, session: Session) -> Dict[str, Any]:
        """Get usage statistics for a dataset."""
        
        # Get total usage counts
        total_usage = session.query(func.count(DatasetUsageLog.id)).filter(
            DatasetUsageLog.dataset_id == dataset_id
        ).scalar()
        
        # Get unique users
        unique_users = session.query(func.count(func.distinct(DatasetUsageLog.user_id))).filter(
            DatasetUsageLog.dataset_id == dataset_id
        ).scalar()
        
        # Get usage by type
        usage_by_type = {}
        usage_types = session.query(
            DatasetUsageLog.usage_type,
            func.count(DatasetUsageLog.id)
        ).filter(
            DatasetUsageLog.dataset_id == dataset_id
        ).group_by(DatasetUsageLog.usage_type).all()
        
        for usage_type, count in usage_types:
            usage_by_type[usage_type.value] = count
        
        return {
            'total_usage': total_usage,
            'unique_users': unique_users,
            'usage_by_type': usage_by_type
        }
    
    async def _get_user_permissions(self, dataset_id: str, user_id: str, session: Session) -> List[str]:
        """Get list of permissions user has for dataset."""
        
        permissions = []
        
        # Check ownership
        dataset = session.query(Dataset).filter(
            Dataset.dataset_id == dataset_id
        ).first()
        
        if dataset and dataset.created_by == user_id:
            permissions = ["view", "download", "edit", "admin", "share"]
        else:
            # Check shares
            share = session.query(DatasetShare).filter(
                DatasetShare.dataset_id == dataset_id,
                DatasetShare.shared_with_id == user_id,
                DatasetShare.is_active == True
            ).first()
            
            if share and not share.is_expired:
                permission = share.permission.value
                if permission == "view":
                    permissions = ["view"]
                elif permission == "download":
                    permissions = ["view", "download"]
                elif permission == "edit":
                    permissions = ["view", "download", "edit"]
                elif permission == "admin":
                    permissions = ["view", "download", "edit", "admin", "share"]
            
            # Check public access
            elif dataset and dataset.access_level == AccessLevel.PUBLIC:
                permissions = ["view", "download"]
        
        return permissions
    
    async def _update_dataset_ratings(self, dataset_id: str, session: Session):
        """Update dataset rating statistics after new review."""
        
        # Calculate new averages
        reviews = session.query(DatasetReview).filter(
            DatasetReview.dataset_id == dataset_id
        ).all()
        
        if reviews:
            total_rating = sum(r.overall_rating for r in reviews)
            count = len(reviews)
            average_rating = total_rating / count
            
            # Update dataset
            dataset = session.query(Dataset).filter(
                Dataset.dataset_id == dataset_id
            ).first()
            
            if dataset:
                dataset.average_rating = average_rating
                dataset.rating_count = count
    
    async def _get_user_dataset_history(self, user_id: str, session: Session) -> List[str]:
        """Get list of datasets user has previously accessed."""
        
        usage_logs = session.query(DatasetUsageLog.dataset_id).filter(
            DatasetUsageLog.user_id == user_id,
            DatasetUsageLog.success == True
        ).distinct().all()
        
        return [log[0] for log in usage_logs]
    
    async def _calculate_recommendation_score(self,
                                            dataset: Dataset,
                                            request: RecommendationRequest,
                                            user_history: List[str],
                                            session: Session) -> float:
        """Calculate recommendation score for a dataset."""
        
        score = 0.0
        
        # Base quality score (0-1)
        quality_factor = (dataset.quality_score or 0) / 100.0
        score += quality_factor * 0.3
        
        # Popularity factor (download count and ratings)
        popularity_factor = min(1.0, (dataset.download_count or 0) / 1000.0)
        rating_factor = (dataset.average_rating or 0) / 5.0
        score += (popularity_factor * 0.1) + (rating_factor * 0.2)
        
        # Type preference matching
        if request.preferred_types and dataset.dataset_type in request.preferred_types:
            score += 0.2
        
        # Recency factor
        days_old = (datetime.utcnow() - dataset.created_at).days
        recency_factor = max(0, 1 - (days_old / 365))  # Decay over a year
        score += recency_factor * 0.1
        
        # Context-based scoring
        if request.context_dataset_id:
            # Find similar datasets based on tags, type, etc.
            context_dataset = session.query(Dataset).filter(
                Dataset.dataset_id == request.context_dataset_id
            ).first()
            
            if context_dataset:
                # Type similarity
                if dataset.dataset_type == context_dataset.dataset_type:
                    score += 0.1
                
                # Tag similarity
                if dataset.tags and context_dataset.tags:
                    common_tags = set(dataset.tags) & set(context_dataset.tags)
                    tag_similarity = len(common_tags) / max(len(dataset.tags), len(context_dataset.tags))
                    score += tag_similarity * 0.1
        
        return min(1.0, score)
    
    async def _convert_format(self,
                            source_path: str,
                            target_format: DataFormat,
                            dataset_id: str) -> str:
        """Convert dataset to requested format."""
        
        if not self.dataset_processor:
            raise Exception("Dataset processor not available for format conversion")
        
        # Generate output path
        output_dir = os.path.join(self.storage_path, "conversions", dataset_id)
        os.makedirs(output_dir, exist_ok=True)
        
        base_name = os.path.splitext(os.path.basename(source_path))[0]
        output_path = os.path.join(output_dir, f"{base_name}.{target_format.value}")
        
        # Detect source format
        source_format = self._detect_file_format(source_path)
        
        # Convert
        result = await self.dataset_processor.convert_format(
            input_path=source_path,
            output_path=output_path,
            source_format=source_format,
            target_format=target_format
        )
        
        if result.success:
            return result.output_path
        else:
            raise Exception(f"Format conversion failed: {result.error_message}")


# Factory function
def create_dataset_marketplace_service(storage_path: str = "./marketplace_storage") -> DatasetMarketplaceService:
    """Factory function to create dataset marketplace service."""
    
    quality_analyzer = DatasetQualityAnalyzer() if SERVICES_AVAILABLE else None
    dataset_processor = DatasetProcessor() if SERVICES_AVAILABLE else None
    
    return DatasetMarketplaceService(
        storage_path=storage_path,
        quality_analyzer=quality_analyzer,
        dataset_processor=dataset_processor
    )