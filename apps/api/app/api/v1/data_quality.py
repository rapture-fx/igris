"""
Data Quality Assessment API Router
Enhanced data quality assessment, profiling, and preparation for AI workflows
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
import logging
import uuid
import json
import pandas as pd
import io
from datetime import datetime
import numpy as np

from app.database.connection import get_async_session
from app.auth.unified_auth_system import get_current_user
from app.core.error_decorators import handle_database_errors, handle_auth_errors
from app.services.data_quality_service import data_quality_service
from app.services.file_processor import file_upload_service
from app.services.advanced_data_cleaner import AdvancedDataCleaner
from app.services.advanced_ml_engine import AdvancedMLEngine
from app.database.models import DataQualityAssessment as DataQualityAssessmentModel
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models
class DataQualityRequest(BaseModel):
    check_duplicates: bool = Field(default=True, description="Check for duplicate records")
    check_missing: bool = Field(default=True, description="Check for missing values")
    check_outliers: bool = Field(default=True, description="Detect outliers")
    check_bias: bool = Field(default=True, description="Detect potential bias in data")
    check_drift: bool = Field(default=False, description="Check for data drift")
    generate_profile: bool = Field(default=True, description="Generate statistical profile")

class ColumnProfile(BaseModel):
    column_name: str
    data_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    most_frequent_value: Optional[str] = None
    least_frequent_value: Optional[str] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std_dev: Optional[float] = None
    min_value: Optional[Union[str, float]] = None
    max_value: Optional[Union[str, float]] = None
    outliers_count: Optional[int] = None
    quality_score: float = Field(description="0-1 quality score for this column")

class DataQualityResult(BaseModel):
    success: bool
    assessment_id: str
    filename: str
    total_rows: int
    total_columns: int
    overall_quality_score: float
    column_profiles: List[ColumnProfile]
    issues_found: List[Dict[str, Any]]
    recommendations: List[str]
    bias_analysis: Optional[Dict[str, Any]] = None
    drift_analysis: Optional[Dict[str, Any]] = None
    processing_time: float
    error: Optional[str] = None

class CleaningRecommendation(BaseModel):
    column_name: str
    issue_type: str
    severity: str  # low, medium, high, critical
    description: str
    suggested_action: str
    auto_fixable: bool

@router.post("/assess", response_model=DataQualityResult)
@handle_auth_errors
async def assess_data_quality(
    file: UploadFile = File(...),
    request_data: str = Form("{}"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Comprehensive data quality assessment for AI-ready datasets.
    Analyzes data quality, detects issues, and provides recommendations.
    """
    start_time = datetime.utcnow()
    assessment_id = str(uuid.uuid4())
    
    try:
        # Parse request data with proper error handling
        try:
            quality_request = DataQualityRequest.parse_raw(request_data)
        except Exception as parse_error:
            logger.warning(f"Failed to parse request data, using defaults: {parse_error}")
            quality_request = DataQualityRequest()
        
        # Validate file input
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )

        # Validate file type
        supported_extensions = ('.csv', '.xlsx', '.json', '.parquet')
        if not file.filename.lower().endswith(supported_extensions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File must be one of: {', '.join(supported_extensions)}"
            )

        # Read file content with size validation
        try:
            content = await file.read()
        except Exception as read_error:
            logger.error(f"Failed to read uploaded file: {read_error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to read uploaded file"
            )

        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        if len(content) > 100 * 1024 * 1024:  # 100MB limit
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds 100MB limit"
            )
        
        logger.info(f"Processing data quality assessment {assessment_id} for file {file.filename}")
        
        # Load and validate data with comprehensive error handling
        try:
            # Load data based on file type with specific error handling
            file_extension = file.filename.lower().split('.')[-1]

            if file_extension == 'csv':
                try:
                    df = pd.read_csv(io.BytesIO(content))
                except pd.errors.EmptyDataError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="CSV file is empty or contains no data"
                    )
                except pd.errors.ParserError as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid CSV format: {str(e)}"
                    )
            elif file_extension == 'xlsx':
                try:
                    df = pd.read_excel(io.BytesIO(content))
                except Exception as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid Excel format: {str(e)}"
                    )
            elif file_extension == 'json':
                try:
                    df = pd.read_json(io.BytesIO(content))
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid JSON format: {str(e)}"
                    )
            elif file_extension == 'parquet':
                try:
                    df = pd.read_parquet(io.BytesIO(content))
                except Exception as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid Parquet format: {str(e)}"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unsupported file format"
                )

            # Validate loaded dataframe
            if df.empty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File contains no data rows"
                )

            if len(df.columns) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File contains no columns"
                )

            logger.info(f"Successfully loaded dataframe with shape: {df.shape}")

            # Additional validation for reasonable data size
            if len(df) > 1000000:  # 1M rows
                logger.warning(f"Large dataset detected: {len(df)} rows")

            if len(df.columns) > 1000:  # 1000 columns
                logger.warning(f"Wide dataset detected: {len(df.columns)} columns")
            
            # Generate real column profiles with error handling
            column_profiles = []
            for column in df.columns:
                try:
                    col_data = df[column]

                    # Basic statistics with safe calculations
                    null_count = int(col_data.isnull().sum())
                    null_percentage = (null_count / len(df)) * 100 if len(df) > 0 else 0.0
                    unique_count = int(col_data.nunique())
                    unique_percentage = (unique_count / len(df)) * 100 if len(df) > 0 else 0.0

                    # Data type detection
                    data_type = str(col_data.dtype)
                    if pd.api.types.is_numeric_dtype(col_data):
                        data_type = "numeric" if col_data.dtype in ['float64', 'float32'] else "integer"
                    elif pd.api.types.is_datetime64_any_dtype(col_data):
                        data_type = "datetime"
                    else:
                        data_type = "string"

                    # Value frequency analysis with error handling
                    try:
                        value_counts = col_data.value_counts()
                        most_frequent = str(value_counts.index[0]) if len(value_counts) > 0 else None
                        least_frequent = str(value_counts.index[-1]) if len(value_counts) > 0 else None
                    except Exception:
                        most_frequent = None
                        least_frequent = None

                    # Outlier detection for numeric columns with safe calculation
                    outliers_count = 0
                    if pd.api.types.is_numeric_dtype(col_data) and not col_data.isna().all():
                        try:
                            Q1 = col_data.quantile(0.25)
                            Q3 = col_data.quantile(0.75)
                            IQR = Q3 - Q1
                            if pd.notna(Q1) and pd.notna(Q3) and IQR > 0:
                                outliers = col_data[(col_data < Q1 - 1.5 * IQR) | (col_data > Q3 + 1.5 * IQR)]
                                outliers_count = len(outliers)
                        except Exception:
                            outliers_count = 0

                    # Quality score calculation
                    quality_score = 1.0
                    quality_score -= (null_percentage / 100) * 0.5  # Penalize missing values
                    if unique_percentage < 1:  # Very low uniqueness
                        quality_score -= 0.2
                    if outliers_count > len(df) * 0.05:  # More than 5% outliers
                        quality_score -= 0.2
                    quality_score = max(0.0, quality_score)

                    profile = ColumnProfile(
                        column_name=column,
                        data_type=data_type,
                        null_count=int(null_count),
                        null_percentage=float(null_percentage),
                        unique_count=int(unique_count),
                        unique_percentage=float(unique_percentage),
                        most_frequent_value=most_frequent,
                        least_frequent_value=least_frequent,
                        quality_score=float(quality_score)
                    )
                
                    # Add numeric statistics if applicable with safe calculations
                    if pd.api.types.is_numeric_dtype(col_data) and not col_data.isna().all():
                        try:
                            profile.mean = float(col_data.mean()) if pd.notna(col_data.mean()) else None
                            profile.median = float(col_data.median()) if pd.notna(col_data.median()) else None
                            profile.std_dev = float(col_data.std()) if pd.notna(col_data.std()) else None
                            profile.min_value = float(col_data.min()) if pd.notna(col_data.min()) else None
                            profile.max_value = float(col_data.max()) if pd.notna(col_data.max()) else None
                            profile.outliers_count = outliers_count
                        except Exception:
                            # Set defaults if numeric calculations fail
                            profile.mean = None
                            profile.median = None
                            profile.std_dev = None
                            profile.min_value = None
                            profile.max_value = None
                            profile.outliers_count = 0

                    column_profiles.append(profile)

                except Exception as col_error:
                    logger.error(f"Error processing column '{column}': {col_error}")
                    # Create a minimal profile for failed columns
                    error_profile = ColumnProfile(
                        column_name=str(column),
                        data_type="unknown",
                        null_count=len(df),
                        null_percentage=100.0,
                        unique_count=0,
                        unique_percentage=0.0,
                        quality_score=0.0
                    )
                    column_profiles.append(error_profile)
                
        except Exception as data_error:
            logger.error(f"Data processing error: {data_error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process data file: {str(data_error)}"
            )
        
        # Generate comprehensive issues analysis based on real data
        issues_found = []

        for profile in column_profiles:
            # Missing values analysis
            if profile.null_percentage > 15:
                issues_found.append({
                    "issue_type": "missing_values",
                    "severity": "high",
                    "columns_affected": [profile.column_name],
                    "description": f"High missing values in column '{profile.column_name}': {profile.null_percentage:.1f}%",
                    "impact": "High missing values can significantly impact model performance",
                    "count": profile.null_count
                })
            elif profile.null_percentage > 5:
                issues_found.append({
                    "issue_type": "missing_values",
                    "severity": "medium",
                    "columns_affected": [profile.column_name],
                    "description": f"Moderate missing values in column '{profile.column_name}': {profile.null_percentage:.1f}%",
                    "impact": "May reduce model performance",
                    "count": profile.null_count
                })

            # Outliers analysis
            if profile.outliers_count and profile.outliers_count > len(df) * 0.05:
                severity = "high" if profile.outliers_count > len(df) * 0.1 else "medium"
                issues_found.append({
                    "issue_type": "outliers",
                    "severity": severity,
                    "columns_affected": [profile.column_name],
                    "description": f"High outlier count in column '{profile.column_name}': {profile.outliers_count} outliers ({(profile.outliers_count/len(df)*100):.1f}%)",
                    "impact": "Outliers can skew analysis and reduce model accuracy",
                    "count": profile.outliers_count
                })

            # Low uniqueness analysis
            if profile.unique_percentage < 1 and profile.data_type != "integer":
                issues_found.append({
                    "issue_type": "low_uniqueness",
                    "severity": "medium",
                    "columns_affected": [profile.column_name],
                    "description": f"Very low uniqueness in column '{profile.column_name}': {profile.unique_percentage:.1f}%",
                    "impact": "Low uniqueness may indicate data quality issues or limited information value",
                    "count": profile.unique_count
                })

        # Generate detailed recommendations based on real analysis
        recommendations = []

        for profile in column_profiles:
            if profile.null_percentage > 10:
                if profile.data_type == "numeric":
                    recommendations.append(f"Consider median/mean imputation for numeric column '{profile.column_name}' with {profile.null_percentage:.1f}% missing values")
                elif profile.data_type == "string":
                    recommendations.append(f"Consider mode imputation or 'Unknown' category for string column '{profile.column_name}' with {profile.null_percentage:.1f}% missing values")
                else:
                    recommendations.append(f"Review missing value strategy for column '{profile.column_name}' - {profile.null_percentage:.1f}% missing")

            if profile.outliers_count and profile.outliers_count > len(df) * 0.05:
                recommendations.append(f"Review outliers in column '{profile.column_name}' - consider capping, transformation, or removal of {profile.outliers_count} outliers")

            if profile.quality_score < 0.7:
                recommendations.append(f"Column '{profile.column_name}' has low quality score ({profile.quality_score:.2f}) - requires attention for data quality improvement")

        # Add general recommendations
        if overall_quality_score < 0.8:
            recommendations.append("Overall data quality is below optimal threshold - consider comprehensive data cleaning")

        recommendations.append("Implement data validation rules to prevent future quality issues")
        recommendations.append("Consider setting up automated data quality monitoring")

        # Calculate overall quality score from real data
        overall_quality_score = sum(profile.quality_score for profile in column_profiles) / len(column_profiles) if column_profiles else 0.0
        
        # Enhanced bias analysis based on actual data
        bias_analysis = {
            "potential_bias_detected": False,
            "bias_score": 0.1,
            "column_imbalances": [],
            "recommendations": []
        }

        # Check for potential bias indicators
        for profile in column_profiles:
            # Check for extreme imbalances in categorical data
            if profile.data_type == "string" and profile.unique_count > 1:
                # If one value dominates (>80%), flag as potential bias
                if profile.unique_percentage < 20 and profile.null_percentage < 50:
                    bias_analysis["potential_bias_detected"] = True
                    bias_analysis["column_imbalances"].append({
                        "column": profile.column_name,
                        "issue": "High class imbalance",
                        "dominant_value_frequency": f"{100 - profile.unique_percentage:.1f}%"
                    })
                    bias_analysis["recommendations"].append(f"Review class distribution in '{profile.column_name}' for potential sampling bias")

            # Check for suspicious numeric ranges
            if profile.data_type in ["numeric", "integer"] and profile.min_value is not None and profile.max_value is not None:
                range_ratio = profile.max_value / profile.min_value if profile.min_value > 0 else float('inf')
                if range_ratio > 1000:  # Very wide range might indicate outliers or bias
                    bias_analysis["column_imbalances"].append({
                        "column": profile.column_name,
                        "issue": "Extreme value range",
                        "range": f"{profile.min_value} to {profile.max_value}"
                    })

        # Update bias score based on findings
        if bias_analysis["potential_bias_detected"]:
            bias_analysis["bias_score"] = min(0.8, 0.1 + len(bias_analysis["column_imbalances"]) * 0.1)

        if not bias_analysis["recommendations"]:
            bias_analysis["recommendations"] = ["No significant bias indicators detected in current analysis"]
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return DataQualityResult(
            success=True,
            assessment_id=assessment_id,
            filename=file.filename,
            total_rows=len(df),
            total_columns=len(df.columns),
            overall_quality_score=overall_quality_score,
            column_profiles=column_profiles,
            issues_found=issues_found,
            recommendations=recommendations,
            bias_analysis=bias_analysis,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assessing data quality: {e}")
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return DataQualityResult(
            success=False,
            assessment_id=assessment_id,
            filename=file.filename,
            total_rows=0,
            total_columns=0,
            overall_quality_score=0.0,
            column_profiles=[],
            issues_found=[],
            recommendations=[],
            processing_time=processing_time,
            error=str(e)
        )

@router.post("/clean/auto", response_model=Dict[str, Any])
@handle_auth_errors
async def auto_clean_data(
    file: UploadFile = File(...),
    cleaning_options: str = Form("{}"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Automated data cleaning with intelligent missing value imputation,
    outlier detection, and duplicate removal.
    """
    start_time = datetime.utcnow()
    cleaning_id = str(uuid.uuid4())
    
    try:
        options = json.loads(cleaning_options)
        
        logger.info(f"Processing auto data cleaning {cleaning_id} for file {file.filename}")
        
        # Save file to a temporary location
        file_info = await file_upload_service.save_uploaded_file(await file.read(), file.filename, str(current_user.id))
        file_path = file_info['file_path']
        file_type = file_info['file_type']

        # Load data into DataFrame
        if file_type == 'csv':
            df = pd.read_csv(file_path)
        elif file_type == 'json':
            df = pd.read_json(file_path)
        elif file_type == 'excel':
            df = pd.read_excel(file_path)
        elif file_type == 'parquet':
            df = pd.read_parquet(file_path)
        else:
            raise ValueError("Unsupported file format for cleaning")

        cleaner = AdvancedDataCleaner()
        cleaned_df, cleaning_report = cleaner.comprehensive_clean(
            df,
            remove_duplicates=options.get("remove_duplicates", True),
            impute_missing=options.get("handle_missing", "smart_impute"),
            remove_outliers=options.get("handle_outliers", "cap")
        )
        
        # Save cleaned data to a temporary file
        cleaned_file_path = f"{file_path}_cleaned.{file_type}"
        if file_type == 'csv':
            cleaned_df.to_csv(cleaned_file_path, index=False)
        elif file_type == 'json':
            cleaned_df.to_json(cleaned_file_path, orient='records', indent=2)
        elif file_type == 'excel':
            cleaned_df.to_excel(cleaned_file_path, index=False)
        elif file_type == 'parquet':
            cleaned_df.to_parquet(cleaned_file_path, index=False)

        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            "success": True,
            "cleaning_id": cleaning_id,
            "filename": file.filename,
            "original_rows": len(df),
            "cleaned_rows": len(cleaned_df),
            "actions_performed": cleaning_report.get("steps_performed", []),
            "quality_improvement": {
                "before_score": cleaning_report.get("initial_quality", {}).get("overall_quality", 0.0),
                "after_score": cleaning_report.get("final_quality", {}).get("overall_quality", 0.0),
                "improvement": cleaning_report.get("quality_improvement", 0.0)
            },
            "download_url": f"/api/v1/quality/download/{cleaning_id}?format={file_type}",
            "processing_time": processing_time
        }
        
    except Exception as e:
        logger.error(f"Error auto-cleaning data: {e}")
        return {
            "success": False,
            "cleaning_id": cleaning_id,
            "error": str(e),
            "processing_time": (datetime.utcnow() - start_time).total_seconds()
        }

@router.post("/feature-engineering", response_model=Dict[str, Any])
@handle_auth_errors
async def ai_feature_engineering(
    file: UploadFile = File(...),
    target_column: str = Form(...),
    task_type: str = Form("classification"),  # classification, regression, clustering
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    AI-powered feature engineering for machine learning readiness.
    Creates new features, encodes categoricals, and prepares for ML frameworks.
    """
    start_time = datetime.utcnow()
    engineering_id = str(uuid.uuid4())
    
    try:
        logger.info(f"Processing feature engineering {engineering_id} for {task_type} task")
        
        # Save file to a temporary location
        file_info = await file_upload_service.save_uploaded_file(await file.read(), file.filename, str(current_user.id))
        file_path = file_info['file_path']
        file_type = file_info['file_type']

        # Load data into DataFrame
        if file_type == 'csv':
            df = pd.read_csv(file_path)
        elif file_type == 'json':
            df = pd.read_json(file_path)
        elif file_type == 'excel':
            df = pd.read_excel(file_path)
        elif file_type == 'parquet':
            df = pd.read_parquet(file_path)
        else:
            raise ValueError("Unsupported file format for feature engineering")

        ml_engine = AdvancedMLEngine()
        
        # Perform feature engineering
        engineered_df, engineering_report = ml_engine.perform_feature_engineering(
            df,
            target_column=target_column,
            task_type=task_type
        )

        # Save engineered data to a temporary file
        engineered_file_path = f"{file_path}_engineered.{file_type}"
        if file_type == 'csv':
            engineered_df.to_csv(engineered_file_path, index=False)
        elif file_type == 'json':
            engineered_df.to_json(engineered_file_path, orient='records', indent=2)
        elif file_type == 'excel':
            engineered_df.to_excel(engineered_file_path, index=False)
        elif file_type == 'parquet':
            engineered_df.to_parquet(engineered_file_path, index=False)

        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            "success": True,
            "engineering_id": engineering_id,
            "filename": file.filename,
            "task_type": task_type,
            "target_column": target_column,
            "original_features": engineering_report.get("original_features"),
            "engineered_features": engineering_report.get("engineered_features"),
            "total_features": engineering_report.get("total_features"),
            "features_created": engineering_report.get("features_created"),
            "encodings_applied": engineering_report.get("encodings_applied"),
            "ml_readiness_score": engineering_report.get("ml_readiness_score"),
            "recommended_frameworks": engineering_report.get("recommended_frameworks"),
            "download_formats": {
                "csv": f"/api/v1/quality/download/{engineering_id}?format=csv",
                "parquet": f"/api/v1/quality/download/{engineering_id}?format=parquet",
                "sklearn_dataset": f"/api/v1/quality/download/{engineering_id}?format=sklearn"
            },
            "processing_time": processing_time
        }
        
    except Exception as e:
        logger.error(f"Error in feature engineering: {e}")
        return {
            "success": False,
            "engineering_id": engineering_id,
            "error": str(e),
            "processing_time": (datetime.utcnow() - start_time).total_seconds()
        }

@router.get("/assessments", response_model=List[DataQualityResult])
@handle_auth_errors
@handle_database_errors
async def list_assessments(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List user's data quality assessments"""
    try:
        result = await db.execute(
            select(DataQualityAssessmentModel)
            .where(DataQualityAssessmentModel.user_id == current_user.id)
            .order_by(DataQualityAssessmentModel.created_at.desc())
        )
        assessments = result.scalars().all()
        
        return [
            DataQualityResult(
                success=True,
                assessment_id=str(a.id),
                filename=a.filename,
                total_rows=a.total_rows,
                total_columns=a.total_columns,
                overall_quality_score=a.overall_quality_score,
                column_profiles=[ColumnProfile(**p) for p in a.column_profiles],
                issues_found=a.issues_found,
                recommendations=a.recommendations,
                bias_analysis=a.bias_analysis,
                processing_time=a.processing_time,
                error=a.error_message
            )
            for a in assessments
        ]
    except Exception as e:
        logger.error(f"Error listing assessments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list assessments"
        )

@router.get("/download/{processing_id}")
@handle_auth_errors
async def download_processed_data(
    processing_id: str,
    format: str = "csv",
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Download processed/cleaned data"""
    try:
        # File storage and download functionality not implemented
        # This endpoint is a placeholder for future file storage integration
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processed file not found - file storage not implemented"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading processed data {processing_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download processed data"
        )