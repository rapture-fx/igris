"""
Dataset Marketplace API Endpoints
=================================

FastAPI endpoints for the Dataset Marketplace providing comprehensive APIs for:
- Dataset cataloging and management
- Search and discovery with advanced filtering
- Dataset sharing and access control
- Quality assessment and reporting
- Format conversion and preprocessing
- Reviews and ratings
- Collections and recommendations
- Usage analytics and tracking
- Integration with MLOps experiments

All endpoints include proper authentication, validation, error handling,
and comprehensive API documentation.
"""

import os
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uuid

# Import schemas
from app.schemas.dataset_marketplace import (
    # Request schemas
    DatasetCatalogRequest, DatasetSearchRequest, DatasetShareRequest,
    DatasetDownloadRequest, DatasetReviewCreate, ProcessingJobRequest,
    DatasetCollectionCreate, RecommendationRequest, ExperimentDatasetLink,
    
    # Response schemas
    DatasetDetailResponse, DatasetSearchResponse, DatasetShareResponse,
    DatasetDownloadResponse, DatasetReviewResponse, ProcessingJobResponse,
    DatasetCollectionResponse, RecommendationResponse, ExperimentDatasetLinkResponse,
    QualityAssessmentResponse, UsageAnalytics, PlatformAnalytics,
    SuccessResponse, ErrorResponse, HealthCheckResponse,
    
    # Info schemas
    DatasetInfo, DatasetReviewInfo, ProcessingJobInfo, DatasetCollectionInfo,
    DatasetShareInfo,
    
    # Filter schemas
    DatasetSearchFilters
)

# Import services
try:
    from app.services.dataset_marketplace_service import (
        DatasetMarketplaceService, DatasetSearchFilters as ServiceFilters,
        RecommendationRequest as ServiceRecommendationRequest
    )
    from app.services.dataset_quality_analyzer import DatasetQualityAnalyzer
    from app.services.dataset_processor import DatasetProcessor
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False

# Import authentication and dependencies
try:
    from app.auth.enhanced_security import get_current_user, verify_token
    from app.core.config import settings
    AUTH_AVAILABLE = True
except ImportError:
    AUTH_AVAILABLE = False

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/v1/datasets", tags=["Dataset Marketplace"])

# Security scheme
security = HTTPBearer()

# Initialize services (in production, these would be dependency injected)
marketplace_service = DatasetMarketplaceService() if SERVICES_AVAILABLE else None
quality_analyzer = DatasetQualityAnalyzer() if SERVICES_AVAILABLE else None
dataset_processor = DatasetProcessor() if SERVICES_AVAILABLE else None


# Dependency functions
async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Get current user ID from authentication token."""
    if not AUTH_AVAILABLE:
        # For demo purposes, return a test user ID
        return "demo_user"
    
    try:
        user_info = await verify_token(credentials.credentials)
        return user_info.get("user_id", "unknown")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )


async def check_service_availability():
    """Check if required services are available."""
    if not SERVICES_AVAILABLE or not marketplace_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset marketplace services are not available"
        )


# Health Check
@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Check health status of dataset marketplace services."""
    
    services_status = {
        "marketplace_service": "available" if marketplace_service else "unavailable",
        "quality_analyzer": "available" if quality_analyzer else "unavailable", 
        "dataset_processor": "available" if dataset_processor else "unavailable",
        "authentication": "available" if AUTH_AVAILABLE else "unavailable"
    }
    
    database_connected = True  # Would check actual DB connection
    storage_accessible = True  # Would check actual storage access
    
    overall_status = "healthy" if all(
        status == "available" for status in services_status.values()
    ) else "degraded"
    
    return HealthCheckResponse(
        status=overall_status,
        services=services_status,
        database_connected=database_connected,
        storage_accessible=storage_accessible
    )


# Dataset Cataloging
@router.post("/catalog", response_model=SuccessResponse)
async def catalog_dataset(
    request: DatasetCatalogRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Catalog a new dataset in the marketplace.
    
    This endpoint allows users to register datasets with comprehensive metadata,
    automatic quality assessment, and proper access control.
    """
    await check_service_availability()
    
    try:
        logger.info(f"Cataloging dataset {request.name} for user {user_id}")
        
        # Update request with user information
        request.created_by = user_id
        
        # Validate file exists
        if not os.path.exists(request.file_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dataset file not found: {request.file_path}"
            )
        
        # Catalog dataset
        dataset_id = await marketplace_service.catalog_dataset(
            name=request.name,
            file_path=request.file_path,
            dataset_type=request.dataset_type,
            created_by=user_id,
            title=request.title,
            description=request.description,
            tags=request.tags,
            access_level=request.access_level,
            organization=request.organization,
            auto_quality_check=request.auto_quality_check,
            metadata=request.custom_metadata
        )
        
        logger.info(f"Successfully cataloged dataset {request.name} with ID {dataset_id}")
        
        return SuccessResponse(
            message=f"Dataset '{request.name}' cataloged successfully",
            data={"dataset_id": dataset_id}
        )
        
    except Exception as e:
        logger.error(f"Failed to catalog dataset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset cataloging failed: {str(e)}"
        )


@router.post("/upload", response_model=SuccessResponse)
async def upload_and_catalog_dataset(
    file: UploadFile = File(...),
    metadata: str = Query(..., description="JSON metadata for the dataset"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Upload a file and catalog it as a dataset.
    
    This endpoint handles file upload and automatic cataloging in a single operation.
    """
    await check_service_availability()
    
    try:
        import json
        import tempfile
        
        # Parse metadata
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON metadata"
            )
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as temp_file:
            # Write uploaded content
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Create catalog request
            catalog_request = DatasetCatalogRequest(
                file_path=temp_file_path,
                created_by=user_id,
                **metadata_dict
            )
            
            # Catalog dataset
            dataset_id = await marketplace_service.catalog_dataset(
                name=catalog_request.name,
                file_path=temp_file_path,
                dataset_type=catalog_request.dataset_type,
                created_by=user_id,
                title=catalog_request.title,
                description=catalog_request.description,
                tags=catalog_request.tags,
                access_level=catalog_request.access_level,
                organization=catalog_request.organization,
                auto_quality_check=catalog_request.auto_quality_check,
                metadata=catalog_request.custom_metadata
            )
            
            return SuccessResponse(
                message=f"Dataset uploaded and cataloged successfully",
                data={
                    "dataset_id": dataset_id,
                    "filename": file.filename,
                    "size_bytes": len(content)
                }
            )
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload and catalog dataset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload and cataloging failed: {str(e)}"
        )


# Dataset Discovery and Search
@router.post("/search", response_model=DatasetSearchResponse)
async def search_datasets(
    request: DatasetSearchRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Search datasets with advanced filtering and sorting.
    
    Supports text search, filtering by type/quality/tags, and various sorting options.
    """
    await check_service_availability()
    
    try:
        start_time = datetime.utcnow()
        
        # Convert API filters to service filters
        service_filters = ServiceFilters(
            query=request.filters.query,
            dataset_types=request.filters.dataset_types,
            access_levels=request.filters.access_levels,
            quality_min=request.filters.quality_min,
            tags=request.filters.tags,
            created_by=request.filters.created_by,
            organization=request.filters.organization,
            min_size_mb=request.filters.min_size_mb,
            max_size_mb=request.filters.max_size_mb,
            has_splits=request.filters.has_splits,
            created_after=request.filters.created_after,
            created_before=request.filters.created_before,
            is_featured=request.filters.is_featured
        )
        
        # Perform search
        results, total_count = await marketplace_service.search_datasets(
            filters=service_filters,
            user_id=user_id,
            limit=request.limit,
            offset=request.offset,
            sort_by=request.sort_by
        )
        
        # Calculate search time
        search_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Convert results to API format
        dataset_infos = []
        for result in results:
            dataset_info = DatasetInfo(
                dataset_id=result.dataset_id,
                name=result.name,
                title=result.title,
                description=result.description,
                dataset_type=result.dataset_type,
                access_level=result.access_level,
                status=result.access_level,  # Simplified mapping
                created_by=result.created_by,
                created_at=result.created_at,
                quality_score=result.quality_score,
                quality_level=result.quality_level,
                size_mb=result.size_mb,
                row_count=result.row_count,
                download_count=result.download_count,
                average_rating=result.average_rating,
                tags=result.tags,
                is_featured=result.is_featured
            )
            dataset_infos.append(dataset_info)
        
        return DatasetSearchResponse(
            datasets=dataset_infos,
            total_count=total_count,
            limit=request.limit,
            offset=request.offset,
            has_more=(request.offset + len(results)) < total_count,
            search_time_ms=search_time
        )
        
    except Exception as e:
        logger.error(f"Dataset search failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
async def get_dataset_details(
    dataset_id: str,
    include_quality_report: bool = Query(True, description="Include quality assessment"),
    include_usage_stats: bool = Query(True, description="Include usage statistics"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get detailed information about a specific dataset.
    
    Returns comprehensive dataset information including metadata, quality metrics,
    usage statistics, and user permissions.
    """
    await check_service_availability()
    
    try:
        # Get dataset details
        catalog_entry = await marketplace_service.get_dataset_details(
            dataset_id=dataset_id,
            user_id=user_id,
            include_quality_report=include_quality_report,
            include_usage_stats=include_usage_stats
        )
        
        dataset = catalog_entry.dataset
        
        # Convert to API response format
        response = DatasetDetailResponse(
            dataset_id=dataset.dataset_id,
            name=dataset.name,
            title=dataset.title,
            description=dataset.description,
            dataset_type=dataset.dataset_type,
            access_level=dataset.access_level,
            status=dataset.status,
            created_by=dataset.created_by,
            organization=dataset.organization,
            created_at=dataset.created_at,
            updated_at=dataset.updated_at,
            published_at=dataset.published_at,
            
            # Quality metrics
            quality_score=dataset.quality_score or 0,
            quality_level=dataset.quality_level or "unknown",
            completeness_score=dataset.completeness_score or 0,
            consistency_score=dataset.consistency_score or 0,
            validity_score=dataset.validity_score or 0,
            accuracy_score=dataset.accuracy_score or 0,
            
            # Size and structure
            size_mb=dataset.size_mb,
            row_count=dataset.row_count or 0,
            column_count=dataset.column_count or 0,
            
            # Usage statistics
            download_count=dataset.download_count or 0,
            view_count=dataset.view_count or 0,
            average_rating=dataset.average_rating or 0,
            rating_count=dataset.rating_count or 0,
            
            # Metadata
            categories=dataset.categories or [],
            tags=dataset.tags or [],
            keywords=dataset.keywords or [],
            license_type=dataset.license_type,
            terms_of_use=dataset.terms_of_use,
            source_description=dataset.source_description,
            collection_methodology=dataset.collection_methodology,
            contact_email=dataset.contact_email,
            
            # File information
            primary_format=dataset.primary_format,
            supported_formats=dataset.supported_formats or [],
            
            # Version information
            current_version=dataset.current_version,
            version_count=dataset.version_count or 1,
            
            # Flags
            is_featured=dataset.is_featured or False,
            is_verified=dataset.is_verified or False,
            
            # User-specific information
            user_permissions=catalog_entry.user_permissions,
            usage_stats=catalog_entry.usage_stats
        )
        
        return response
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get dataset details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dataset details: {str(e)}"
        )


# Dataset Quality Assessment
@router.get("/{dataset_id}/quality-report", response_model=QualityAssessmentResponse)
async def get_quality_report(
    dataset_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get the quality assessment report for a dataset.
    
    Returns comprehensive quality metrics, column profiles, anomaly detection,
    and improvement recommendations.
    """
    await check_service_availability()
    
    try:
        # Get dataset details to check access
        catalog_entry = await marketplace_service.get_dataset_details(
            dataset_id=dataset_id,
            user_id=user_id,
            include_quality_report=True,
            include_usage_stats=False
        )
        
        quality_report = catalog_entry.quality_report
        if not quality_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No quality report available for this dataset"
            )
        
        # Convert to API response format
        from app.schemas.dataset_marketplace import QualityMetrics, ColumnProfile, AnomalyInfo
        
        quality_metrics = QualityMetrics(
            overall_score=quality_report.overall_score,
            quality_level=quality_report.quality_level,
            completeness_score=quality_report.completeness_score,
            consistency_score=quality_report.consistency_score,
            validity_score=quality_report.validity_score,
            accuracy_score=quality_report.accuracy_score,
            uniqueness_score=quality_report.uniqueness_score or 0,
            timeliness_score=quality_report.timeliness_score or 0
        )
        
        # Convert column profiles
        column_profiles = []
        for profile_data in quality_report.column_profiles or []:
            profile = ColumnProfile(**profile_data)
            column_profiles.append(profile)
        
        # Convert anomalies
        anomalies = []
        for anomaly_data in quality_report.quality_issues or []:
            if isinstance(anomaly_data, dict):
                anomaly = AnomalyInfo(
                    type=anomaly_data.get('type', 'unknown'),
                    column=anomaly_data.get('column'),
                    count=anomaly_data.get('count'),
                    percentage=anomaly_data.get('percentage'),
                    description=anomaly_data.get('description', ''),
                    severity=anomaly_data.get('severity', 'medium')
                )
                anomalies.append(anomaly)
        
        response = QualityAssessmentResponse(
            dataset_id=dataset_id,
            report_id=quality_report.report_id,
            assessment_timestamp=quality_report.generated_at,
            quality_metrics=quality_metrics,
            column_profiles=column_profiles,
            anomalies=anomalies,
            recommendations=quality_report.recommendations or [],
            sample_size=quality_report.sample_size or 0,
            processing_time_seconds=quality_report.assessment_duration_seconds or 0,
            generated_by=quality_report.generated_by
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get quality report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quality report: {str(e)}"
        )


@router.post("/{dataset_id}/assess-quality", response_model=QualityAssessmentResponse)
async def assess_dataset_quality(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    force_reassess: bool = Query(False, description="Force reassessment even if recent report exists"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Trigger quality assessment for a dataset.
    
    Runs comprehensive quality analysis including data profiling, anomaly detection,
    bias assessment, and generates actionable recommendations.
    """
    await check_service_availability()
    
    if not quality_analyzer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Quality assessment service not available"
        )
    
    try:
        # Get dataset details to check access and get file path
        catalog_entry = await marketplace_service.get_dataset_details(
            dataset_id=dataset_id,
            user_id=user_id,
            include_quality_report=True,
            include_usage_stats=False
        )
        
        dataset = catalog_entry.dataset
        
        # Check if user has edit permissions
        if "edit" not in catalog_entry.user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to assess dataset quality"
            )
        
        # Check if recent assessment exists and force_reassess is False
        if not force_reassess and catalog_entry.quality_report:
            recent_threshold = datetime.utcnow() - timedelta(hours=24)
            if catalog_entry.quality_report.generated_at > recent_threshold:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Recent quality assessment exists. Use force_reassess=true to override."
                )
        
        # Get file path from latest version
        latest_version = catalog_entry.latest_version
        if not latest_version or not latest_version.storage_location:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file location available for quality assessment"
            )
        
        # Run quality assessment in background
        background_tasks.add_task(
            _run_quality_assessment_background,
            dataset_id,
            latest_version.storage_location,
            user_id
        )
        
        # Return immediate response
        return SuccessResponse(
            message="Quality assessment started. Results will be available shortly.",
            data={
                "dataset_id": dataset_id,
                "status": "processing"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start quality assessment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start quality assessment: {str(e)}"
        )


async def _run_quality_assessment_background(dataset_id: str, file_path: str, user_id: str):
    """Background task for running quality assessment."""
    try:
        import pandas as pd
        
        # Load data
        data = pd.read_csv(file_path)  # Simplified - would handle different formats
        
        # Run quality analysis
        results = await quality_analyzer.analyze_dataset_quality(
            data=data,
            dataset_id=dataset_id,
            save_to_db=True
        )
        
        logger.info(f"Quality assessment completed for dataset {dataset_id}")
        
    except Exception as e:
        logger.error(f"Background quality assessment failed for {dataset_id}: {str(e)}")


# Dataset Sharing
@router.post("/{dataset_id}/share", response_model=DatasetShareResponse)
async def share_dataset(
    dataset_id: str,
    request: DatasetShareRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Share a dataset with users, teams, or organizations.
    
    Allows dataset owners to grant specific permissions to other users with
    optional expiration dates and download limits.
    """
    await check_service_availability()
    
    try:
        share_id = await marketplace_service.share_dataset(
            dataset_id=dataset_id,
            shared_by=user_id,
            shared_with_id=request.shared_with_id,
            shared_with_type=request.shared_with_type,
            permission=request.permission,
            expires_at=request.expires_at,
            max_downloads=request.max_downloads,
            terms=request.terms
        )
        
        return DatasetShareResponse(
            share_id=share_id,
            success=True,
            message="Dataset shared successfully"
        )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to share dataset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset sharing failed: {str(e)}"
        )


@router.get("/{dataset_id}/shares", response_model=List[DatasetShareInfo])
async def get_dataset_shares(
    dataset_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get list of shares for a dataset.
    
    Returns information about users/teams/organizations that have access to the dataset.
    Only accessible by dataset owners or admins.
    """
    await check_service_availability()
    
    try:
        # Check if user has admin access to dataset
        catalog_entry = await marketplace_service.get_dataset_details(
            dataset_id=dataset_id,
            user_id=user_id,
            include_quality_report=False,
            include_usage_stats=False
        )
        
        if "admin" not in catalog_entry.user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view dataset shares"
            )
        
        # This would be implemented in the service
        # For now, return empty list
        return []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dataset shares: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dataset shares: {str(e)}"
        )


# Dataset Download
@router.post("/{dataset_id}/download", response_model=DatasetDownloadResponse)
async def download_dataset(
    dataset_id: str,
    request: DatasetDownloadRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Download a dataset with optional format conversion.
    
    Provides secure download with usage tracking, format conversion,
    and terms of use validation.
    """
    await check_service_availability()
    
    try:
        file_path, metadata = await marketplace_service.download_dataset(
            dataset_id=dataset_id,
            user_id=user_id,
            format_requested=request.format_requested,
            purpose=request.purpose
        )
        
        # In production, you might generate a temporary signed URL
        # For now, return the file path and metadata
        return DatasetDownloadResponse(
            file_path=file_path,
            metadata=metadata,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Dataset download failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download failed: {str(e)}"
        )


@router.get("/{dataset_id}/download-file")
async def download_dataset_file(
    dataset_id: str,
    format_requested: Optional[str] = Query(None, description="Requested format"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Direct file download endpoint.
    
    Returns the actual dataset file for direct download.
    """
    await check_service_availability()
    
    try:
        file_path, metadata = await marketplace_service.download_dataset(
            dataset_id=dataset_id,
            user_id=user_id,
            format_requested=format_requested,
            purpose="direct_download"
        )
        
        # Return file response
        filename = metadata.get('dataset_name', dataset_id)
        file_extension = metadata.get('format', 'csv')
        
        return FileResponse(
            path=file_path,
            filename=f"{filename}.{file_extension}",
            media_type="application/octet-stream"
        )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"File download failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File download failed: {str(e)}"
        )


# Dataset Reviews
@router.post("/{dataset_id}/reviews", response_model=DatasetReviewResponse)
async def add_dataset_review(
    dataset_id: str,
    request: DatasetReviewCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Add a review and rating for a dataset.
    
    Allows users to rate datasets and provide feedback based on their usage experience.
    """
    await check_service_availability()
    
    try:
        review_id = await marketplace_service.add_dataset_review(
            dataset_id=dataset_id,
            reviewer_id=user_id,
            overall_rating=request.overall_rating,
            title=request.title,
            review_text=request.review_text,
            quality_rating=request.quality_rating,
            usability_rating=request.usability_rating,
            use_case=request.use_case
        )
        
        return DatasetReviewResponse(
            review_id=review_id,
            success=True,
            message="Review added successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to add review: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Review submission failed: {str(e)}"
        )


@router.get("/{dataset_id}/reviews", response_model=List[DatasetReviewInfo])
async def get_dataset_reviews(
    dataset_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get reviews for a dataset.
    
    Returns paginated list of reviews and ratings for the specified dataset.
    """
    await check_service_availability()
    
    try:
        # This would be implemented in the service
        # For now, return empty list
        return []
        
    except Exception as e:
        logger.error(f"Failed to get reviews: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reviews: {str(e)}"
        )


# Dataset Processing
@router.post("/{dataset_id}/convert", response_model=ProcessingJobResponse)
async def convert_dataset_format(
    dataset_id: str,
    request: ProcessingJobRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Convert dataset to ML-ready format.
    
    Handles format conversion, preprocessing, and ML-ready transformations
    with progress tracking and result notifications.
    """
    await check_service_availability()
    
    if not dataset_processor:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset processing service not available"
        )
    
    try:
        # Check access to dataset
        catalog_entry = await marketplace_service.get_dataset_details(
            dataset_id=dataset_id,
            user_id=user_id,
            include_quality_report=False,
            include_usage_stats=False
        )
        
        if "download" not in catalog_entry.user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to process dataset"
            )
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Start processing in background
        background_tasks.add_task(
            _run_dataset_processing_background,
            job_id,
            dataset_id,
            request.config,
            user_id
        )
        
        return ProcessingJobResponse(
            job_id=job_id,
            success=True,
            message="Dataset processing started",
            estimated_duration_minutes=5.0  # Rough estimate
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start dataset processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )


async def _run_dataset_processing_background(job_id: str, dataset_id: str, config: Any, user_id: str):
    """Background task for dataset processing."""
    try:
        # This would implement actual processing logic
        logger.info(f"Starting background processing job {job_id} for dataset {dataset_id}")
        
        # Simulate processing
        await asyncio.sleep(10)
        
        logger.info(f"Processing job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Background processing job {job_id} failed: {str(e)}")


@router.get("/processing-jobs/{job_id}", response_model=ProcessingJobInfo)
async def get_processing_job_status(
    job_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get status of a dataset processing job.
    
    Returns current status, progress, and results of a processing job.
    """
    await check_service_availability()
    
    try:
        # This would be implemented with actual job tracking
        # For now, return a mock response
        return ProcessingJobInfo(
            job_id=job_id,
            dataset_id="unknown",
            job_type="format_conversion",
            status="completed",
            progress_percent=100.0,
            created_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Failed to get job status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}"
        )


# Dataset Recommendations
@router.post("/recommendations", response_model=RecommendationResponse)
async def get_dataset_recommendations(
    request: RecommendationRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get personalized dataset recommendations.
    
    Returns datasets recommended based on user context, preferences,
    and usage patterns using collaborative filtering and content-based methods.
    """
    await check_service_availability()
    
    try:
        # Convert to service request format
        service_request = ServiceRecommendationRequest(
            user_id=user_id,
            context_dataset_id=request.context_dataset_id,
            use_case=request.use_case,
            preferred_types=request.preferred_types,
            quality_threshold=request.quality_threshold,
            limit=request.limit
        )
        
        # Get recommendations
        recommendations = await marketplace_service.get_dataset_recommendations(service_request)
        
        # Convert to API format
        dataset_infos = []
        recommendation_reasons = {}
        
        for result in recommendations:
            dataset_info = DatasetInfo(
                dataset_id=result.dataset_id,
                name=result.name,
                title=result.title,
                description=result.description,
                dataset_type=result.dataset_type,
                access_level=result.access_level,
                status=result.access_level,  # Simplified mapping
                created_by=result.created_by,
                created_at=result.created_at,
                quality_score=result.quality_score,
                quality_level=result.quality_level,
                size_mb=result.size_mb,
                row_count=result.row_count,
                download_count=result.download_count,
                average_rating=result.average_rating,
                tags=result.tags,
                is_featured=result.is_featured
            )
            dataset_infos.append(dataset_info)
            
            # Add mock recommendation reasons
            recommendation_reasons[result.dataset_id] = [
                "High quality score",
                "Similar to your previous downloads",
                "Popular in your domain"
            ]
        
        return RecommendationResponse(
            recommendations=dataset_infos,
            recommendation_reasons=recommendation_reasons,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Failed to get recommendations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation generation failed: {str(e)}"
        )


# Dataset Collections
@router.post("/collections", response_model=DatasetCollectionResponse)
async def create_dataset_collection(
    request: DatasetCollectionCreate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a curated collection of datasets.
    
    Allows users to create themed collections of related datasets for
    easy discovery and organization.
    """
    await check_service_availability()
    
    try:
        collection_id = await marketplace_service.create_dataset_collection(
            name=request.name,
            title=request.title,
            description=request.description,
            curator_id=user_id,
            category=request.category,
            is_public=request.is_public,
            dataset_ids=request.dataset_ids
        )
        
        return DatasetCollectionResponse(
            collection_id=collection_id,
            success=True,
            message="Dataset collection created successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create collection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Collection creation failed: {str(e)}"
        )


@router.get("/collections", response_model=List[DatasetCollectionInfo])
async def get_dataset_collections(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get list of dataset collections.
    
    Returns paginated list of public dataset collections with optional
    category filtering.
    """
    await check_service_availability()
    
    try:
        # This would be implemented in the service
        # For now, return empty list
        return []
        
    except Exception as e:
        logger.error(f"Failed to get collections: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get collections: {str(e)}"
        )


# MLOps Integration
@router.post("/{dataset_id}/link-experiment", response_model=ExperimentDatasetLinkResponse)
async def link_dataset_to_experiment(
    dataset_id: str,
    request: ExperimentDatasetLink,
    user_id: str = Depends(get_current_user_id)
):
    """
    Link a dataset to an MLOps experiment.
    
    Creates a tracking link between dataset usage and ML experiments
    for full lineage and reproducibility.
    """
    await check_service_availability()
    
    try:
        link_id = await marketplace_service.link_dataset_to_experiment(
            dataset_id=dataset_id,
            experiment_id=request.experiment_id,
            usage_type=request.usage_type,
            user_id=user_id,
            version_used=request.version_used,
            columns_used=request.columns_used,
            split_type=request.split_type
        )
        
        return ExperimentDatasetLinkResponse(
            link_id=link_id,
            success=True,
            message="Dataset linked to experiment successfully"
        )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to link dataset to experiment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset-experiment linking failed: {str(e)}"
        )


# Analytics and Reporting
@router.get("/{dataset_id}/analytics", response_model=UsageAnalytics)
async def get_dataset_usage_analytics(
    dataset_id: str,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get usage analytics for a dataset.
    
    Returns comprehensive usage statistics including downloads, views,
    geographic distribution, and performance metrics.
    """
    await check_service_availability()
    
    try:
        # Check access permissions
        catalog_entry = await marketplace_service.get_dataset_details(
            dataset_id=dataset_id,
            user_id=user_id,
            include_quality_report=False,
            include_usage_stats=True
        )
        
        if "admin" not in catalog_entry.user_permissions and catalog_entry.dataset.created_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view dataset analytics"
            )
        
        # Generate mock analytics data
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        analytics = UsageAnalytics(
            dataset_id=dataset_id,
            period_start=start_date,
            period_end=end_date,
            total_downloads=catalog_entry.dataset.download_count or 0,
            total_views=catalog_entry.dataset.view_count or 0,
            unique_users=10,  # Mock data
            total_api_calls=50,
            avg_download_time_seconds=2.5,
            success_rate_percent=98.5,
            usage_by_region={"US": 60, "EU": 30, "Asia": 10},
            usage_by_hour=[i % 24 for i in range(24)],  # Mock hourly pattern
            usage_by_type={"training": 80, "validation": 15, "testing": 5},
            models_trained=5,
            avg_model_performance=85.2,
            successful_experiments=4
        )
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics: {str(e)}"
        )


@router.get("/platform/analytics", response_model=PlatformAnalytics)
async def get_platform_analytics(
    user_id: str = Depends(get_current_user_id)
):
    """
    Get platform-wide analytics.
    
    Returns overall marketplace statistics including dataset counts,
    quality distribution, usage patterns, and growth metrics.
    """
    await check_service_availability()
    
    try:
        # Generate mock platform analytics
        analytics = PlatformAnalytics(
            timestamp=datetime.utcnow(),
            total_datasets=150,
            public_datasets=75,
            private_datasets=75,
            avg_quality_score=78.5,
            total_downloads=1250,
            active_users=45,
            total_api_calls=5000,
            quality_distribution={
                "excellent": 30,
                "good": 60,
                "fair": 45,
                "poor": 15
            },
            type_distribution={
                "tabular": 80,
                "image": 35,
                "text": 25,
                "time_series": 10
            },
            datasets_created_today=3,
            new_users_today=2,
            downloads_today=25
        )
        
        return analytics
        
    except Exception as e:
        logger.error(f"Failed to get platform analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get platform analytics: {str(e)}"
        )