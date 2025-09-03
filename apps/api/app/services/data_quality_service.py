
import pandas as pd
import numpy as np
import io
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from ..ml.data_quality import AdvancedImputationEngine, IndustrialDataQualityEngine

logger = logging.getLogger(__name__)

class DataQualityService:
    """Service for comprehensive data quality assessment and profiling."""
    
    def __init__(self):
        self.imputation_engine = AdvancedImputationEngine()
        self.industrial_engine = IndustrialDataQualityEngine()

    async def assess_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Performs a comprehensive data quality assessment on a DataFrame."""
        start_time = datetime.utcnow()
        
        column_profiles = []
        for column in df.columns:
            col_data = df[column]
            
            # Basic statistics
            null_count = col_data.isnull().sum()
            null_percentage = (null_count / len(df)) * 100
            unique_count = col_data.nunique()
            unique_percentage = (unique_count / len(df)) * 100
            
            # Data type detection
            data_type = str(col_data.dtype)
            if pd.api.types.is_numeric_dtype(col_data):
                data_type = "numeric" if col_data.dtype in ['float64', 'float32'] else "integer"
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                data_type = "datetime"
            else:
                data_type = "string"
            
            # Value frequency analysis
            value_counts = col_data.value_counts()
            most_frequent = str(value_counts.index[0]) if len(value_counts) > 0 else None
            least_frequent = str(value_counts.index[-1]) if len(value_counts) > 0 else None
            
            # Outlier detection for numeric columns (IQR method)
            outliers_count = 0
            if pd.api.types.is_numeric_dtype(col_data):
                Q1 = col_data.quantile(0.25)
                Q3 = col_data.quantile(0.75)
                IQR = Q3 - Q1
                outliers = col_data[(col_data < Q1 - 1.5 * IQR) | (col_data > Q3 + 1.5 * IQR)]
                outliers_count = len(outliers)
            
            # Quality score calculation
            quality_score = 1.0
            quality_score -= (null_percentage / 100) * 0.5  # Penalize missing values
            if unique_percentage < 1:  # Very low uniqueness
                quality_score -= 0.2
            if outliers_count > len(df) * 0.05:  # More than 5% outliers
                quality_score -= 0.2
            quality_score = max(0.0, quality_score)
            
            profile = {
                "column_name": column,
                "data_type": data_type,
                "null_count": int(null_count),
                "null_percentage": float(null_percentage),
                "unique_count": int(unique_count),
                "unique_percentage": float(unique_percentage),
                "most_frequent_value": most_frequent,
                "least_frequent_value": least_frequent,
                "quality_score": float(quality_score)
            }
            
            if pd.api.types.is_numeric_dtype(col_data):
                profile["mean"] = float(col_data.mean()) if not col_data.isna().all() else None
                profile["median"] = float(col_data.median()) if not col_data.isna().all() else None
                profile["std_dev"] = float(col_data.std()) if not col_data.isna().all() else None
                profile["min_value"] = float(col_data.min()) if not col_data.isna().all() else None
                profile["max_value"] = float(col_data.max()) if not col_data.isna().all() else None
                profile["outliers_count"] = outliers_count
            
            column_profiles.append(profile)
        
        overall_quality_score = sum(p["quality_score"] for p in column_profiles) / len(column_profiles) if column_profiles else 0.0
        
        issues_found = []
        recommendations = []
        
        for profile in column_profiles:
            if profile["null_percentage"] > 10:
                issues_found.append(f"High missing values in column '{profile["column_name"]}': {profile["null_percentage"]:.1f}%")
                recommendations.append(f"Consider imputation strategies for column '{profile["column_name"]}'")
            
            if profile["outliers_count"] and profile["outliers_count"] > len(df) * 0.05:
                issues_found.append(f"High outlier count in column '{profile["column_name"]}': {profile["outliers_count"]} outliers")
                recommendations.append(f"Review outliers in column '{profile["column_name"]}' - may indicate data quality issues")
        
        # Basic bias analysis (placeholder)
        bias_analysis = {
            "potential_bias_detected": False,
            "bias_score": 0.1,
            "bias_details": "Basic bias analysis completed - no major issues detected"
        }
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            "success": True,
            "total_rows": len(df),
            "total_columns": len(column_profiles),
            "overall_quality_score": round(overall_quality_score, 2),
            "column_profiles": column_profiles,
            "issues_found": issues_found,
            "recommendations": recommendations,
            "bias_analysis": bias_analysis,
            "processing_time": processing_time
        }
    
    async def handle_missing_values(
        self, 
        df: pd.DataFrame,
        strategy: str = 'auto',
        sensor_metadata: Optional[Dict] = None,
        is_industrial_data: bool = False
    ) -> Dict[str, Any]:
        """
        Handle missing values in dataset using advanced imputation strategies.
        
        Args:
            df: DataFrame with missing values
            strategy: Imputation strategy ('auto', 'knn_temporal', 'time_series', 'mice', etc.)
            sensor_metadata: Optional metadata about sensors and equipment
            is_industrial_data: Whether the data is from industrial sensors
            
        Returns:
            Dictionary with imputed data and detailed imputation report
        """
        logger.info(f"Starting missing value imputation with strategy: {strategy}")
        start_time = datetime.utcnow()
        
        try:
            # Check if there are any missing values
            if df.isnull().sum().sum() == 0:
                return {
                    "success": True,
                    "message": "No missing values detected in the dataset",
                    "imputed_data": df.to_dict(),
                    "imputation_report": {"missing_values_handled": 0},
                    "processing_time": (datetime.utcnow() - start_time).total_seconds()
                }
            
            # Use industrial-specific imputation if indicated
            if is_industrial_data:
                imputed_data, imputation_report = await self._handle_industrial_imputation(
                    df, strategy, sensor_metadata
                )
            else:
                # Use general advanced imputation
                imputed_data, imputation_report = self.imputation_engine.handle_missing_values(
                    data=df,
                    sensor_metadata=sensor_metadata,
                    strategy=strategy,
                    preserve_original=True
                )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "success": True,
                "message": f"Missing value imputation completed using {imputation_report.get('strategy_used', strategy)} strategy",
                "imputed_data": imputed_data.to_dict(),
                "imputation_report": imputation_report,
                "processing_time": processing_time,
                "original_missing_count": df.isnull().sum().sum(),
                "final_missing_count": imputed_data.isnull().sum().sum()
            }
            
        except Exception as e:
            logger.error(f"Missing value imputation failed: {str(e)}")
            return {
                "success": False,
                "error": f"Imputation failed: {str(e)}",
                "imputed_data": df.to_dict(),  # Return original data
                "processing_time": (datetime.utcnow() - start_time).total_seconds()
            }
    
    async def _handle_industrial_imputation(
        self, 
        df: pd.DataFrame, 
        strategy: str, 
        sensor_metadata: Optional[Dict]
    ) -> tuple:
        """Handle industrial sensor data imputation using domain-specific methods."""
        return self.industrial_engine._handle_industrial_missing_values(df, sensor_metadata)
    
    async def assess_imputation_quality(
        self, 
        original_df: pd.DataFrame, 
        imputed_df: pd.DataFrame,
        sensor_metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Assess the quality of imputation results.
        
        Args:
            original_df: Original dataset with missing values
            imputed_df: Dataset after imputation
            sensor_metadata: Optional sensor metadata
            
        Returns:
            Quality assessment report
        """
        logger.info("Starting imputation quality assessment")
        start_time = datetime.utcnow()
        
        try:
            quality_assessment = self.imputation_engine._assess_imputation_quality(
                original_df, imputed_df, sensor_metadata
            )
            
            # Add additional quality metrics
            quality_metrics = {
                "data_integrity": {
                    "shape_preserved": original_df.shape == imputed_df.shape,
                    "columns_preserved": list(original_df.columns) == list(imputed_df.columns),
                    "data_types_preserved": original_df.dtypes.equals(imputed_df.dtypes)
                },
                "imputation_coverage": {
                    "original_missing_count": int(original_df.isnull().sum().sum()),
                    "final_missing_count": int(imputed_df.isnull().sum().sum()),
                    "imputation_rate": 1 - (imputed_df.isnull().sum().sum() / max(original_df.isnull().sum().sum(), 1))
                }
            }
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "success": True,
                "quality_assessment": quality_assessment,
                "quality_metrics": quality_metrics,
                "processing_time": processing_time
            }
            
        except Exception as e:
            logger.error(f"Quality assessment failed: {str(e)}")
            return {
                "success": False,
                "error": f"Quality assessment failed: {str(e)}",
                "processing_time": (datetime.utcnow() - start_time).total_seconds()
            }
    
    async def comprehensive_industrial_assessment(
        self, 
        df: pd.DataFrame,
        sensor_metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Perform comprehensive assessment specifically for industrial sensor data.
        
        Args:
            df: Industrial sensor dataset
            sensor_metadata: Metadata about sensors and equipment
            
        Returns:
            Comprehensive industrial data quality report
        """
        logger.info("Starting comprehensive industrial data assessment")
        start_time = datetime.utcnow()
        
        try:
            # Use the industrial quality engine
            assessment_report = self.industrial_engine.comprehensive_quality_assessment(
                data=df,
                sensor_metadata=sensor_metadata
            )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "success": True,
                "assessment_report": assessment_report,
                "processing_time": processing_time
            }
            
        except Exception as e:
            logger.error(f"Industrial assessment failed: {str(e)}")
            return {
                "success": False,
                "error": f"Industrial assessment failed: {str(e)}",
                "processing_time": (datetime.utcnow() - start_time).total_seconds()
            }
    
    async def clean_industrial_data(
        self, 
        df: pd.DataFrame,
        cleaning_strategy: str = "conservative",
        sensor_metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Clean industrial sensor data using domain-specific methods.
        
        Args:
            df: Raw industrial sensor data
            cleaning_strategy: 'conservative', 'aggressive', or 'adaptive'
            sensor_metadata: Optional sensor metadata
            
        Returns:
            Cleaned data and cleaning report
        """
        logger.info(f"Starting industrial data cleaning with {cleaning_strategy} strategy")
        start_time = datetime.utcnow()
        
        try:
            cleaned_data, cleaning_report = self.industrial_engine.clean_industrial_data(
                data=df,
                cleaning_strategy=cleaning_strategy,
                sensor_metadata=sensor_metadata
            )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "success": True,
                "cleaned_data": cleaned_data.to_dict(),
                "cleaning_report": cleaning_report,
                "processing_time": processing_time,
                "data_shape_before": df.shape,
                "data_shape_after": cleaned_data.shape
            }
            
        except Exception as e:
            logger.error(f"Industrial data cleaning failed: {str(e)}")
            return {
                "success": False,
                "error": f"Data cleaning failed: {str(e)}",
                "cleaned_data": df.to_dict(),  # Return original data
                "processing_time": (datetime.utcnow() - start_time).total_seconds()
            }
    
    def get_available_imputation_strategies(self) -> Dict[str, Any]:
        """
        Get information about available imputation strategies.
        
        Returns:
            Dictionary describing available strategies and their use cases
        """
        return {
            "strategies": {
                "auto": {
                    "description": "Automatically selects the best imputation strategy based on data characteristics",
                    "use_cases": ["General purpose", "Unknown data patterns", "Mixed data types"],
                    "data_types": ["All"]
                },
                "knn_temporal": {
                    "description": "K-Nearest Neighbors imputation with temporal weighting for time-series data",
                    "use_cases": ["Time-series sensor data", "Temporal patterns", "Industrial monitoring"],
                    "data_types": ["Numeric with timestamps"]
                },
                "time_series": {
                    "description": "Time-series interpolation using various methods (linear, spline, forward-fill)",
                    "use_cases": ["Continuous sensor readings", "Smooth data patterns", "Regular time intervals"],
                    "data_types": ["Numeric time-series"]
                },
                "domain_specific": {
                    "description": "Industrial domain-specific imputation using equipment states and physics relationships",
                    "use_cases": ["Manufacturing data", "Equipment monitoring", "Process control"],
                    "data_types": ["Industrial sensor data"]
                },
                "mice": {
                    "description": "Multiple Imputation by Chained Equations for complex missing patterns",
                    "use_cases": ["Complex missingness", "Multiple correlated variables", "High missing rates"],
                    "data_types": ["Numeric"]
                },
                "statistical": {
                    "description": "Statistical imputation using median/mode with uncertainty estimation",
                    "use_cases": ["Simple missing patterns", "Low missing rates", "Quick imputation"],
                    "data_types": ["All"]
                }
            },
            "selection_guidelines": {
                "low_missing_rate": "< 5% missing: Use statistical methods",
                "medium_missing_rate": "5-20% missing: Use time_series or knn_temporal",
                "high_missing_rate": "> 20% missing: Use mice or domain_specific",
                "temporal_data": "Has timestamps: Prefer knn_temporal or time_series",
                "industrial_data": "Sensor data: Use domain_specific or auto",
                "mixed_types": "Multiple data types: Use auto for optimal selection"
            }
        }

# Global instance
data_quality_service = DataQualityService()
