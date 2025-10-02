"""
ML Data Preparation Engine
=========================

Core data infrastructure engine for automated data preparation and cleaning workflows.
This service orchestrates the complete pipeline from raw data to ML-ready formats.

Key Features:
- Intelligent pattern recognition and data profiling
- Automated preprocessing workflows
- Quality-driven cleaning strategies
- Framework-specific output generation
- Real-time progress tracking
"""

import asyncio
import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path
from enum import Enum
import json
from dataclasses import dataclass, asdict

from app.database.ml_preparation_models import (
    DataPreparationPipeline, PreparationStep, DataQualityAssessment,
    FrameworkOutput, AutoLabelingResult, PreparationStage, DataQualityLevel,
    MLFrameworkType
)
from app.services.ai_data_intelligence_processor import AIDataIntelligenceProcessor
from app.services.ai_framework_integration import AIFrameworkIntegrator
from app.database.connection import get_db_session

logger = logging.getLogger(__name__)


@dataclass
class PreparationConfig:
    """Configuration for data preparation pipeline"""
    target_frameworks: List[str]
    quality_threshold: float = 0.8
    enable_auto_labeling: bool = True
    enable_anomaly_detection: bool = True
    enable_feature_engineering: bool = True
    train_test_split_ratio: float = 0.8
    validation_split_ratio: float = 0.1
    remove_duplicates: bool = True
    handle_missing_values: bool = True
    normalize_data: bool = True
    detect_outliers: bool = True
    auto_approve_high_confidence: bool = True
    confidence_threshold: float = 0.9


@dataclass
class PreparationResult:
    """Result of data preparation pipeline"""
    pipeline_id: str
    quality_score: float
    quality_level: DataQualityLevel
    is_ml_ready: bool
    processing_time_seconds: float
    records_processed: int
    frameworks_exported: List[str]
    issues_resolved: List[str]
    recommendations: List[str]
    output_paths: Dict[str, str]


class MLDataPreparationEngine:
    """
    Core engine for ML data preparation workflows
    Orchestrates the complete pipeline from raw data to ML-ready format
    """
    
    def __init__(self):
        self.ai_processor = AIDataIntelligenceProcessor()
        self.framework_integrator = AIFrameworkIntegrator()
        self.quality_thresholds = {
            DataQualityLevel.EXCELLENT: 0.95,
            DataQualityLevel.GOOD: 0.80,
            DataQualityLevel.FAIR: 0.60,
            DataQualityLevel.POOR: 0.0
        }
    
    async def create_preparation_pipeline(
        self,
        source_data_path: str,
        config: PreparationConfig,
        workspace_id: str,
        user_id: str,
        name: Optional[str] = None
    ) -> DataPreparationPipeline:
        """
        Create a new data preparation pipeline
        """
        if not name:
            name = f"ML Preparation - {Path(source_data_path).name}"
        
        async with get_db_session() as db:
            pipeline = DataPreparationPipeline(
                name=name,
                description=f"Automated ML preparation for {Path(source_data_path).name}",
                workspace_id=workspace_id,
                created_by_id=user_id,
                source_data_path=source_data_path,
                target_frameworks=config.target_frameworks,
                pipeline_config=asdict(config)
            )
            
            db.add(pipeline)
            await db.commit()
            await db.refresh(pipeline)
            
            logger.info(f"Created preparation pipeline {pipeline.id} for {source_data_path}")
            return pipeline
    
    async def execute_preparation_pipeline(
        self,
        pipeline_id: str,
        progress_callback: Optional[callable] = None
    ) -> PreparationResult:
        """
        Execute the complete data preparation pipeline
        """
        start_time = datetime.utcnow()
        
        async with get_db_session() as db:
            # Get pipeline
            pipeline = await db.get(DataPreparationPipeline, pipeline_id)
            if not pipeline:
                raise ValueError(f"Pipeline {pipeline_id} not found")
            
            # Load configuration
            config = PreparationConfig(**pipeline.pipeline_config)
            
            # Load data
            df = await self._load_data(pipeline.source_data_path)
            original_shape = df.shape
            
            try:
                # Execute pipeline stages
                df = await self._execute_stage_ingestion(pipeline, df, progress_callback)
                df = await self._execute_stage_profiling(pipeline, df, progress_callback)
                df = await self._execute_stage_cleaning(pipeline, df, config, progress_callback)
                df = await self._execute_stage_transformation(pipeline, df, config, progress_callback)
                df = await self._execute_stage_labeling(pipeline, df, config, progress_callback)
                df = await self._execute_stage_validation(pipeline, df, config, progress_callback)
                outputs = await self._execute_stage_export(pipeline, df, config, progress_callback)
                
                # Calculate final metrics
                processing_time = (datetime.utcnow() - start_time).total_seconds()
                
                # Update pipeline status
                pipeline.current_stage = PreparationStage.COMPLETED
                pipeline.progress_percentage = 100.0
                pipeline.is_ml_ready = True
                pipeline.processing_time_seconds = processing_time
                pipeline.completed_at = datetime.utcnow()
                
                await db.commit()
                
                # Return results
                return PreparationResult(
                    pipeline_id=str(pipeline.id),
                    quality_score=pipeline.quality_score,
                    quality_level=pipeline.quality_level,
                    is_ml_ready=True,
                    processing_time_seconds=processing_time,
                    records_processed=original_shape[0],
                    frameworks_exported=list(outputs.keys()),
                    issues_resolved=pipeline.recommendations or [],
                    recommendations=pipeline.recommendations or [],
                    output_paths=outputs
                )
                
            except Exception as e:
                logger.error(f"Pipeline {pipeline_id} failed: {str(e)}")
                pipeline.current_stage = PreparationStage.INGESTION
                pipeline.progress_percentage = 0.0
                await db.commit()
                raise
    
    async def _load_data(self, file_path: str) -> pd.DataFrame:
        """Load data from various file formats"""
        path = Path(file_path)
        
        if path.suffix.lower() == '.csv':
            return pd.read_csv(file_path)
        elif path.suffix.lower() == '.json':
            return pd.read_json(file_path)
        elif path.suffix.lower() in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        elif path.suffix.lower() == '.parquet':
            return pd.read_parquet(file_path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")
    
    async def _execute_stage_ingestion(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        progress_callback: Optional[callable] = None
    ) -> pd.DataFrame:
        """Stage 1: Data Ingestion and Initial Validation"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.INGESTION, 10.0)
        if progress_callback:
            progress_callback(10.0, "Ingesting data...")
        
        # Record basic metrics
        pipeline.total_records = len(df)
        pipeline.total_columns = len(df.columns)
        pipeline.data_size_mb = df.memory_usage(deep=True).sum() / 1024 / 1024
        
        # Create preparation step
        await self._create_preparation_step(
            pipeline,
            "Data Ingestion",
            PreparationStage.INGESTION,
            0,
            f"Loaded {len(df)} records with {len(df.columns)} columns"
        )
        
        return df
    
    async def _execute_stage_profiling(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        progress_callback: Optional[callable] = None
    ) -> pd.DataFrame:
        """Stage 2: Intelligent Data Profiling"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.PROFILING, 20.0)
        if progress_callback:
            progress_callback(20.0, "Profiling data structure...")
        
        # Run comprehensive analysis
        analysis_result = await self.ai_processor.comprehensive_analysis(df, {
            "include_correlations": True,
            "detect_data_types": True,
            "analyze_distributions": True
        })
        
        # Create quality assessment
        await self._create_quality_assessment(
            pipeline,
            PreparationStage.PROFILING,
            analysis_result.get("quality_score", 0.0),
            analysis_result
        )
        
        # Store patterns and insights
        pipeline.patterns_detected = analysis_result.get("patterns", [])
        pipeline.anomalies_found = analysis_result.get("anomalies", [])
        
        await self._create_preparation_step(
            pipeline,
            "Data Profiling",
            PreparationStage.PROFILING,
            1,
            f"Profiled {len(df.columns)} columns, detected {len(analysis_result.get('patterns', []))} patterns"
        )
        
        return df
    
    async def _execute_stage_cleaning(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        config: PreparationConfig,
        progress_callback: Optional[callable] = None
    ) -> pd.DataFrame:
        """Stage 3: Automated Data Cleaning"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.CLEANING, 40.0)
        if progress_callback:
            progress_callback(40.0, "Cleaning data...")
        
        original_shape = df.shape
        issues_resolved = []
        
        # Remove duplicates
        if config.remove_duplicates:
            duplicates_before = df.duplicated().sum()
            df = df.drop_duplicates()
            if duplicates_before > 0:
                issues_resolved.append(f"Removed {duplicates_before} duplicate records")
        
        # Handle missing values
        if config.handle_missing_values:
            missing_before = df.isnull().sum().sum()
            df = await self._handle_missing_values(df)
            missing_after = df.isnull().sum().sum()
            if missing_before > missing_after:
                issues_resolved.append(f"Resolved {missing_before - missing_after} missing values")
        
        # Detect and handle outliers
        if config.detect_outliers:
            outliers_handled = await self._handle_outliers(df)
            if outliers_handled > 0:
                issues_resolved.append(f"Handled {outliers_handled} outliers")
        
        # Normalize data formats
        df = await self._normalize_data_formats(df)
        
        await self._create_preparation_step(
            pipeline,
            "Data Cleaning",
            PreparationStage.CLEANING,
            2,
            f"Cleaned data: {original_shape[0]} -> {df.shape[0]} records. " + "; ".join(issues_resolved)
        )
        
        return df
    
    async def _execute_stage_transformation(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        config: PreparationConfig,
        progress_callback: Optional[callable] = None
    ) -> pd.DataFrame:
        """Stage 4: Data Transformation and Feature Engineering"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.TRANSFORMATION, 60.0)
        if progress_callback:
            progress_callback(60.0, "Transforming data...")
        
        transformations_applied = []
        
        # Normalize numerical data
        if config.normalize_data:
            numerical_columns = df.select_dtypes(include=[np.number]).columns
            if len(numerical_columns) > 0:
                df[numerical_columns] = (df[numerical_columns] - df[numerical_columns].mean()) / df[numerical_columns].std()
                transformations_applied.append(f"Normalized {len(numerical_columns)} numerical columns")
        
        # Feature engineering
        if config.enable_feature_engineering:
            df = await self._apply_feature_engineering(df)
            transformations_applied.append("Applied automated feature engineering")
        
        await self._create_preparation_step(
            pipeline,
            "Data Transformation",
            PreparationStage.TRANSFORMATION,
            3,
            "; ".join(transformations_applied)
        )
        
        return df
    
    async def _execute_stage_labeling(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        config: PreparationConfig,
        progress_callback: Optional[callable] = None
    ) -> pd.DataFrame:
        """Stage 5: Automated Labeling and Classification"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.LABELING, 75.0)
        if progress_callback:
            progress_callback(75.0, "Applying automated labeling...")
        
        if config.enable_auto_labeling:
            # Apply unsupervised learning for auto-labeling
            labeling_result = await self._apply_auto_labeling(df, config.confidence_threshold)
            
            # Store labeling results
            await self._create_auto_labeling_result(pipeline, labeling_result)
            
            # Apply labels to dataframe if confidence is high
            if labeling_result.get("average_confidence", 0) >= config.confidence_threshold:
                df = await self._apply_labels_to_dataframe(df, labeling_result)
                pipeline.auto_labels_applied = labeling_result.get("labels_applied", [])
        
        await self._create_preparation_step(
            pipeline,
            "Auto Labeling",
            PreparationStage.LABELING,
            4,
            f"Applied automated labeling with {len(pipeline.auto_labels_applied or [])} labels"
        )
        
        return df
    
    async def _execute_stage_validation(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        config: PreparationConfig,
        progress_callback: Optional[callable] = None
    ) -> pd.DataFrame:
        """Stage 6: Final Validation and Quality Assessment"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.VALIDATION, 85.0)
        if progress_callback:
            progress_callback(85.0, "Validating data quality...")
        
        # Final quality assessment
        final_analysis = await self.ai_processor.comprehensive_analysis(df, {
            "final_validation": True,
            "ml_readiness_check": True
        })
        
        quality_score = final_analysis.get("quality_score", 0.0)
        quality_level = self._calculate_quality_level(quality_score)
        
        # Update pipeline quality metrics
        pipeline.quality_score = quality_score
        pipeline.quality_level = quality_level
        pipeline.recommendations = final_analysis.get("recommendations", [])
        
        # Create final quality assessment
        await self._create_quality_assessment(
            pipeline,
            PreparationStage.VALIDATION,
            quality_score,
            final_analysis
        )
        
        await self._create_preparation_step(
            pipeline,
            "Final Validation",
            PreparationStage.VALIDATION,
            5,
            f"Achieved {quality_level.value} quality level ({quality_score:.2%})"
        )
        
        return df
    
    async def _execute_stage_export(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        config: PreparationConfig,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, str]:
        """Stage 7: Export to ML Frameworks"""
        
        await self._update_pipeline_stage(pipeline, PreparationStage.EXPORT, 95.0)
        if progress_callback:
            progress_callback(95.0, "Exporting to ML frameworks...")
        
        output_paths = {}
        
        # Export to each target framework
        for framework in config.target_frameworks:
            try:
                framework_type = MLFrameworkType(framework.lower())
                
                # Create export configuration
                export_config = {
                    "train_test_split": config.train_test_split_ratio,
                    "validation_split": config.validation_split_ratio,
                    "target_column": None,  # Will be detected automatically
                    "feature_columns": df.columns.tolist()
                }
                
                # Export to framework
                export_result = await self._export_to_framework(
                    pipeline,
                    df,
                    framework_type,
                    export_config
                )
                
                output_paths[framework] = export_result["output_path"]
                
            except Exception as e:
                logger.error(f"Failed to export to {framework}: {str(e)}")
                continue
        
        await self._create_preparation_step(
            pipeline,
            "Framework Export",
            PreparationStage.EXPORT,
            6,
            f"Exported to {len(output_paths)} frameworks: {', '.join(output_paths.keys())}"
        )
        
        return output_paths
    
    async def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Intelligent missing value handling"""
        
        for column in df.columns:
            if df[column].isnull().sum() > 0:
                if df[column].dtype in ['int64', 'float64']:
                    # Use median for numerical columns
                    df[column].fillna(df[column].median(), inplace=True)
                else:
                    # Use mode for categorical columns
                    mode_value = df[column].mode()
                    if len(mode_value) > 0:
                        df[column].fillna(mode_value[0], inplace=True)
        
        return df
    
    async def _handle_outliers(self, df: pd.DataFrame) -> int:
        """Detect and handle outliers using IQR method"""
        outliers_handled = 0
        
        numerical_columns = df.select_dtypes(include=[np.number]).columns
        
        for column in numerical_columns:
            Q1 = df[column].quantile(0.25)
            Q3 = df[column].quantile(0.75)
            IQR = Q3 - Q1
            
            # Define outlier bounds
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            # Cap outliers
            outliers = df[(df[column] < lower_bound) | (df[column] > upper_bound)].shape[0]
            df[column] = df[column].clip(lower=lower_bound, upper=upper_bound)
            
            outliers_handled += outliers
        
        return outliers_handled
    
    async def _normalize_data_formats(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize data formats for consistency"""
        
        # Normalize string columns
        string_columns = df.select_dtypes(include=['object']).columns
        for column in string_columns:
            df[column] = df[column].astype(str).str.strip().str.lower()
        
        # Convert datetime columns
        for column in df.columns:
            if df[column].dtype == 'object':
                try:
                    df[column] = pd.to_datetime(df[column], errors='ignore')
                except:
                    pass
        
        return df
    
    async def _apply_feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply automated feature engineering"""
        
        # Create interaction features for numerical columns
        numerical_columns = df.select_dtypes(include=[np.number]).columns
        
        if len(numerical_columns) >= 2:
            # Create polynomial features for first two numerical columns
            df[f'{numerical_columns[0]}_x_{numerical_columns[1]}'] = df[numerical_columns[0]] * df[numerical_columns[1]]
        
        # Create binned features for continuous variables
        for column in numerical_columns:
            if df[column].nunique() > 10:  # Only bin if many unique values
                df[f'{column}_binned'] = pd.cut(df[column], bins=5, labels=['low', 'low_med', 'medium', 'med_high', 'high'])
        
        return df
    
    async def _apply_auto_labeling(self, df: pd.DataFrame, confidence_threshold: float) -> Dict[str, Any]:
        """Apply unsupervised learning for auto-labeling"""
        
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler
        
        # Select numerical columns for clustering
        numerical_data = df.select_dtypes(include=[np.number])
        
        if len(numerical_data.columns) == 0:
            return {"labels_applied": [], "average_confidence": 0.0}
        
        # Scale data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numerical_data)
        
        # Apply K-means clustering
        n_clusters = min(5, len(df) // 10)  # Reasonable number of clusters
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(scaled_data)
        
        # Calculate confidence based on cluster distances
        distances = kmeans.transform(scaled_data)
        min_distances = np.min(distances, axis=1)
        confidence_scores = 1 / (1 + min_distances)  # Convert distance to confidence
        
        return {
            "labels_applied": cluster_labels.tolist(),
            "confidence_scores": confidence_scores.tolist(),
            "average_confidence": np.mean(confidence_scores),
            "cluster_centers": kmeans.cluster_centers_.tolist()
        }
    
    async def _apply_labels_to_dataframe(self, df: pd.DataFrame, labeling_result: Dict[str, Any]) -> pd.DataFrame:
        """Apply auto-generated labels to dataframe"""
        
        df['auto_cluster_label'] = labeling_result["labels_applied"]
        df['label_confidence'] = labeling_result["confidence_scores"]
        
        return df
    
    async def _export_to_framework(
        self,
        pipeline: DataPreparationPipeline,
        df: pd.DataFrame,
        framework_type: MLFrameworkType,
        export_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Export data to specific ML framework"""
        
        # Create framework output record
        framework_output = FrameworkOutput(
            pipeline_id=pipeline.id,
            framework_type=framework_type,
            export_config=export_config,
            records_exported=len(df)
        )
        
        # Use existing framework integrator
        output_result = self.framework_integrator.export_for_framework(
            df,
            framework_type.value,
            export_config
        )
        
        # Update framework output record
        framework_output.output_path = output_result.get("output_path", "")
        framework_output.output_size_mb = output_result.get("size_mb", 0)
        framework_output.validation_passed = output_result.get("validation_passed", False)
        framework_output.status = "completed"
        
        async with get_db_session() as db:
            db.add(framework_output)
            await db.commit()
        
        return output_result
    
    async def _update_pipeline_stage(self, pipeline: DataPreparationPipeline, stage: PreparationStage, progress: float):
        """Update pipeline stage and progress"""
        pipeline.current_stage = stage
        pipeline.progress_percentage = progress
        
        async with get_db_session() as db:
            await db.merge(pipeline)
            await db.commit()
    
    async def _create_preparation_step(
        self,
        pipeline: DataPreparationPipeline,
        step_name: str,
        step_type: PreparationStage,
        step_order: int,
        description: str
    ):
        """Create a preparation step record"""
        
        step = PreparationStep(
            pipeline_id=pipeline.id,
            step_name=step_name,
            step_type=step_type,
            step_order=step_order,
            transformation_applied=description,
            status="completed"
        )
        
        async with get_db_session() as db:
            db.add(step)
            await db.commit()
    
    async def _create_quality_assessment(
        self,
        pipeline: DataPreparationPipeline,
        stage: PreparationStage,
        quality_score: float,
        analysis_result: Dict[str, Any]
    ):
        """Create a quality assessment record"""
        
        assessment = DataQualityAssessment(
            pipeline_id=pipeline.id,
            assessment_stage=stage,
            overall_quality_score=quality_score,
            quality_level=self._calculate_quality_level(quality_score),
            quality_metrics=analysis_result.get("quality_metrics", {}),
            issues_detected=analysis_result.get("issues", []),
            recommendations=analysis_result.get("recommendations", [])
        )
        
        async with get_db_session() as db:
            db.add(assessment)
            await db.commit()
    
    async def _create_auto_labeling_result(self, pipeline: DataPreparationPipeline, labeling_result: Dict[str, Any]):
        """Create auto-labeling result record"""
        
        auto_labeling = AutoLabelingResult(
            pipeline_id=pipeline.id,
            labeling_algorithm="kmeans_clustering",
            confidence_threshold=0.8,
            labels_generated=labeling_result.get("labels_applied", []),
            confidence_scores=labeling_result.get("confidence_scores", {}),
            accuracy_estimate=labeling_result.get("average_confidence", 0.0),
            coverage_percentage=100.0  # Assuming full coverage
        )
        
        async with get_db_session() as db:
            db.add(auto_labeling)
            await db.commit()
    
    def _calculate_quality_level(self, quality_score: float) -> DataQualityLevel:
        """Calculate quality level based on score"""
        
        if quality_score >= 0.95:
            return DataQualityLevel.EXCELLENT
        elif quality_score >= 0.80:
            return DataQualityLevel.GOOD
        elif quality_score >= 0.60:
            return DataQualityLevel.FAIR
        else:
            return DataQualityLevel.POOR


# Global instance
ml_preparation_engine = MLDataPreparationEngine() 