
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import json
import uuid
from pathlib import Path

from app.services.unified_data_processor import unified_processor, ProcessingMode
from app.services.ml_preparation_engine import ml_preparation_engine, PreparationConfig
from app.services.ml_framework_integration import ml_framework_integration, MLFrameworkType, ExportConfiguration, TaskType, DataFormat
from app.services.data_connectors import DatabaseConnector, CloudStorageConnector, APIConnector
from app.services.system_monitoring import system_monitor
from app.services.webhook_service import webhook_service, WebhookEventType
from app.database.connection import get_db_session
from app.database.ml_preparation_models import DataPreparationPipeline, PreparationStage
from app.tasks.ai_processing_tasks import comprehensive_ai_analysis_task
from app.tasks.data_processing_tasks import process_large_file_task

logger = logging.getLogger(__name__)


class DataSourceType(Enum):
    """Types of data sources supported by the pipeline"""
    FILE_UPLOAD = "file_upload"
    DATABASE = "database"
    API_ENDPOINT = "api_endpoint"
    CLOUD_STORAGE = "cloud_storage"
    STREAMING = "streaming"
    URL = "url"


class PipelineStage(Enum):
    """Pipeline processing stages"""
    INITIALIZATION = "initialization"
    DATA_INGESTION = "data_ingestion"
    AI_ANALYSIS = "ai_analysis"
    DATA_CLEANING = "data_cleaning"
    TRANSFORMATION = "transformation"
    ML_PREPARATION = "ml_preparation"
    FRAMEWORK_EXPORT = "framework_export"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PipelineConfig:
    """Comprehensive pipeline configuration"""
    # Data source configuration
    source_type: DataSourceType
    source_config: Dict[str, Any]
    
    # Processing configuration
    processing_mode: Optional[ProcessingMode] = None
    enable_ai_analysis: bool = True
    enable_auto_cleaning: bool = True
    enable_ml_preparation: bool = True
    
    # ML preparation configuration
    target_frameworks: List[str] = None
    quality_threshold: float = 0.8
    auto_labeling: bool = True
    feature_engineering: bool = True
    
    # Output configuration
    export_formats: List[str] = None
    output_destination: Optional[str] = None
    
    # Performance configuration
    parallel_processing: bool = True
    memory_limit_gb: float = 4.0
    timeout_minutes: int = 60
    
    # Notification configuration
    enable_webhooks: bool = True
    notify_on_completion: bool = True
    notify_on_error: bool = True

    def __post_init__(self):
        if self.target_frameworks is None:
            self.target_frameworks = ["scikit_learn"]
        if self.export_formats is None:
            self.export_formats = ["pandas"]


@dataclass
class PipelineResult:
    """Comprehensive pipeline result"""
    pipeline_id: str
    status: PipelineStage
    success: bool
    processing_time_seconds: float
    
    # Data metrics
    input_records: int
    output_records: int
    data_quality_score: float
    
    # Processing results
    ai_analysis: Optional[Dict[str, Any]] = None
    cleaning_results: Optional[Dict[str, Any]] = None
    ml_preparation_results: Optional[Dict[str, Any]] = None
    framework_exports: Optional[Dict[str, str]] = None
    
    # Metadata
    created_at: str = None
    completed_at: str = None
    error_message: Optional[str] = None
    recommendations: List[str] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.recommendations is None:
            self.recommendations = []


class PipelineOrchestrator:
    
    
    def __init__(self):
        # Initialize core services
        self.data_processor = unified_processor
        self.ml_engine = ml_preparation_engine
        self.framework_integrator = AIFrameworkIntegrator()
        self.db_connector = DatabaseConnector()
        self.cloud_connector = CloudStorageConnector()
        self.api_connector = APIConnector()
        self.monitor = system_monitor
        self.webhook_service = webhook_service
        
        # Pipeline management
        self.active_pipelines: Dict[str, Dict[str, Any]] = {}
        self.pipeline_history: List[PipelineResult] = []
        
        # Performance tracking
        self.performance_metrics = {
            "total_pipelines": 0,
            "successful_pipelines": 0,
            "failed_pipelines": 0,
            "average_processing_time": 0.0,
            "total_data_processed_gb": 0.0
        }
    
    async def create_pipeline(
        self,
        config: PipelineConfig,
        user_id: str,
        workspace_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> str:
        """
        Create a new data processing pipeline
        
        Returns:
            pipeline_id: Unique identifier for the pipeline
        """
        pipeline_id = str(uuid.uuid4())
        
        try:
            # Initialize pipeline tracking
            pipeline_info = {
                "id": pipeline_id,
                "name": name or f"Pipeline {pipeline_id[:8]}",
                "description": description,
                "config": config,
                "user_id": user_id,
                "workspace_id": workspace_id,
                "status": PipelineStage.INITIALIZATION,
                "progress": 0.0,
                "created_at": datetime.utcnow(),
                "started_at": None,
                "completed_at": None,
                "error_message": None,
                "current_step": None,
                "results": {}
            }
            
            self.active_pipelines[pipeline_id] = pipeline_info
            
            # Send webhook notification
            if config.enable_webhooks:
                await self.webhook_service.send_pipeline_created_event(
                    pipeline_id=pipeline_id,
                    name=pipeline_info["name"],
                    workspace_id=workspace_id,
                    user_id=user_id,
                    additional_data={"config": asdict(config)}
                )
            
            logger.info(f"Created pipeline {pipeline_id} for user {user_id}")
            return pipeline_id
            
        except Exception as e:
            logger.error(f"Failed to create pipeline: {e}")
            raise
    
    async def execute_pipeline(
        self,
        pipeline_id: str,
        background: bool = True
    ) -> Union[PipelineResult, str]:
        """
        Execute a data processing pipeline
        
        Args:
            pipeline_id: Pipeline identifier
            background: Whether to run in background (returns job_id) or wait for completion
            
        Returns:
            PipelineResult if background=False, job_id if background=True
        """
        if pipeline_id not in self.active_pipelines:
            raise ValueError(f"Pipeline {pipeline_id} not found")
        
        pipeline_info = self.active_pipelines[pipeline_id]
        
        if background:
            # Execute in background using Celery
            from app.tasks.pipeline_tasks import execute_pipeline_task
            job = execute_pipeline_task.delay(pipeline_id)
            return job.id
        else:
            # Execute synchronously
            return await self._execute_pipeline_sync(pipeline_id)
    
    async def _execute_pipeline_sync(self, pipeline_id: str) -> PipelineResult:
        """
        Execute pipeline synchronously with comprehensive error handling
        """
        pipeline_info = self.active_pipelines[pipeline_id]
        config = pipeline_info["config"]
        start_time = datetime.utcnow()
        
        try:
            # Update pipeline status
            await self._update_pipeline_status(
                pipeline_id, 
                PipelineStage.DATA_INGESTION, 
                5.0, 
                "Starting data ingestion"
            )
            
            # Step 1: Data Ingestion
            data_path = await self._ingest_data(pipeline_id, config)
            
            # Step 2: AI Analysis (if enabled)
            ai_results = None
            if config.enable_ai_analysis:
                await self._update_pipeline_status(
                    pipeline_id, 
                    PipelineStage.AI_ANALYSIS, 
                    20.0, 
                    "Running AI analysis"
                )
                ai_results = await self._run_ai_analysis(pipeline_id, data_path, config)
            
            # Step 3: Data Cleaning (if enabled)
            cleaned_data_path = data_path
            cleaning_results = None
            if config.enable_auto_cleaning:
                await self._update_pipeline_status(
                    pipeline_id, 
                    PipelineStage.DATA_CLEANING, 
                    40.0, 
                    "Cleaning and transforming data"
                )
                cleaned_data_path, cleaning_results = await self._clean_data(
                    pipeline_id, data_path, config, ai_results
                )
            
            # Step 4: ML Preparation (if enabled)
            ml_results = None
            if config.enable_ml_preparation:
                await self._update_pipeline_status(
                    pipeline_id, 
                    PipelineStage.ML_PREPARATION, 
                    60.0, 
                    "Preparing data for ML frameworks"
                )
                ml_results = await self._prepare_for_ml(
                    pipeline_id, cleaned_data_path, config
                )
            
            # Step 5: Framework Export
            framework_exports = {}
            if config.target_frameworks:
                await self._update_pipeline_status(
                    pipeline_id, 
                    PipelineStage.FRAMEWORK_EXPORT, 
                    80.0, 
                    "Exporting to ML frameworks"
                )
                framework_exports = await self._export_to_frameworks(
                    pipeline_id, cleaned_data_path, config
                )
            
            # Step 6: Completion
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            # Create result
            result = PipelineResult(
                pipeline_id=pipeline_id,
                status=PipelineStage.COMPLETED,
                success=True,
                processing_time_seconds=processing_time,
                input_records=ai_results.get("total_records", 0) if ai_results else 0,
                output_records=cleaning_results.get("output_records", 0) if cleaning_results else 0,
                data_quality_score=ai_results.get("quality_score", 0.0) if ai_results else 0.0,
                ai_analysis=ai_results,
                cleaning_results=cleaning_results,
                ml_preparation_results=ml_results,
                framework_exports=framework_exports,
                completed_at=end_time.isoformat()
            )
            
            # Update pipeline status
            await self._update_pipeline_status(
                pipeline_id, 
                PipelineStage.COMPLETED, 
                100.0, 
                "Pipeline completed successfully"
            )
            
            # Send completion webhook
            if config.enable_webhooks and config.notify_on_completion:
                await self.webhook_service.send_pipeline_completed_event(
                    pipeline_id=pipeline_id,
                    workspace_id=pipeline_info["workspace_id"],
                    user_id=pipeline_info["user_id"],
                    processing_time_seconds=processing_time,
                    additional_data=asdict(result)
                )
            
            # Update performance metrics
            self._update_performance_metrics(result)
            
            # Store result
            pipeline_info["results"] = result
            pipeline_info["completed_at"] = end_time
            self.pipeline_history.append(result)
            
            logger.info(f"Pipeline {pipeline_id} completed successfully in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            # Handle pipeline failure
            error_msg = str(e)
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            logger.error(f"Pipeline {pipeline_id} failed: {error_msg}")
            
            # Create failure result
            result = PipelineResult(
                pipeline_id=pipeline_id,
                status=PipelineStage.FAILED,
                success=False,
                processing_time_seconds=processing_time,
                input_records=0,
                output_records=0,
                data_quality_score=0.0,
                error_message=error_msg,
                completed_at=end_time.isoformat()
            )
            
            # Update pipeline status
            await self._update_pipeline_status(
                pipeline_id, 
                PipelineStage.FAILED, 
                0.0, 
                f"Pipeline failed: {error_msg}"
            )
            
            # Send error webhook
            if config.enable_webhooks and config.notify_on_error:
                await self.webhook_service.send_pipeline_failed_event(
                    pipeline_id=pipeline_id,
                    workspace_id=pipeline_info["workspace_id"],
                    user_id=pipeline_info["user_id"],
                    error_message=error_msg,
                    additional_data={"processing_time_seconds": processing_time}
                )
            
            # Update performance metrics
            self.performance_metrics["failed_pipelines"] += 1
            
            # Store result
            pipeline_info["results"] = result
            pipeline_info["completed_at"] = end_time
            pipeline_info["error_message"] = error_msg
            self.pipeline_history.append(result)
            
            return result
    
    async def _ingest_data(self, pipeline_id: str, config: PipelineConfig) -> str:
        """
        Ingest data from various sources
        
        Returns:
            data_path: Path to the ingested data file
        """
        source_type = config.source_type
        source_config = config.source_config
        
        if source_type == DataSourceType.FILE_UPLOAD:
            # File is already uploaded, return the path
            return source_config["file_path"]
            
        elif source_type == DataSourceType.DATABASE:
            # Connect to database and export data
            connection_info = source_config["connection"]
            query = source_config.get("query")
            table_name = source_config.get("table_name")
            
            # Export to temporary file
            output_path = f"/tmp/pipeline_{pipeline_id}_data.csv"
            await self.db_connector.export_to_file(
                connection_info, output_path, query, table_name
            )
            return output_path
            
        elif source_type == DataSourceType.API_ENDPOINT:
            # Fetch data from API
            api_config = source_config["connection"]
            output_path = f"/tmp/pipeline_{pipeline_id}_data.json"
            
            await self.api_connector.fetch_to_file(api_config, output_path)
            return output_path
            
        elif source_type == DataSourceType.CLOUD_STORAGE:
            # Download from cloud storage
            storage_config = source_config["storage"]
            local_path = f"/tmp/pipeline_{pipeline_id}_data"
            
            await self.cloud_connector.download_file(storage_config, local_path)
            return local_path
            
        else:
            raise ValueError(f"Unsupported source type: {source_type}")
    
    async def _run_ai_analysis(
        self, 
        pipeline_id: str, 
        data_path: str, 
        config: PipelineConfig
    ) -> Dict[str, Any]:
        """Run comprehensive AI analysis on the data"""
        
        # Determine processing mode
        file_size_gb = Path(data_path).stat().st_size / (1024**3)
        processing_mode = config.processing_mode
        
        if processing_mode is None:
            if file_size_gb > 1.0:
                processing_mode = ProcessingMode.STREAMING
            elif file_size_gb > 0.1:
                processing_mode = ProcessingMode.STANDARD
            else:
                processing_mode = ProcessingMode.FAST
        
        # Process using unified processor
        options = {
            "enable_anomaly_detection": True,
            "enable_pattern_recognition": True,
            "enable_quality_scoring": True,
            "confidence_threshold": config.quality_threshold
        }
        
        result = await self.data_processor.process(
            data_path, 
            target_framework="pandas",
            mode=processing_mode,
            options=options
        )
        
        return result
    
    async def _clean_data(
        self, 
        pipeline_id: str, 
        data_path: str, 
        config: PipelineConfig,
        ai_results: Optional[Dict[str, Any]]
    ) -> tuple[str, Dict[str, Any]]:
        """Clean and transform data based on AI analysis"""
        
        # Use AI analysis recommendations for cleaning
        cleaning_options = {
            "remove_duplicates": True,
            "handle_missing_values": True,
            "normalize_data": True,
            "remove_outliers": config.quality_threshold > 0.8
        }
        
        # Incorporate AI recommendations
        if ai_results and "recommendations" in ai_results:
            for rec in ai_results["recommendations"]:
                if rec["type"] == "remove_duplicates":
                    cleaning_options["remove_duplicates"] = True
                elif rec["type"] == "handle_missing":
                    cleaning_options["handle_missing_values"] = True
        
        # Process with cleaning
        result = await self.data_processor.process(
            data_path,
            target_framework="pandas",
            mode=ProcessingMode.STANDARD,
            options=cleaning_options
        )
        
        # Save cleaned data
        output_path = f"/tmp/pipeline_{pipeline_id}_cleaned.csv"
        # TODO: Save the cleaned dataframe to output_path
        
        return output_path, result
    
    async def _prepare_for_ml(
        self, 
        pipeline_id: str, 
        data_path: str, 
        config: PipelineConfig
    ) -> Dict[str, Any]:
        """Prepare data for ML using the ML preparation engine"""
        
        # Create ML preparation configuration
        ml_config = PreparationConfig(
            target_frameworks=config.target_frameworks,
            quality_threshold=config.quality_threshold,
            enable_auto_labeling=config.auto_labeling,
            enable_feature_engineering=config.feature_engineering
        )
        
        # Create and execute ML preparation pipeline
        async with get_db_session() as db:
            ml_pipeline = await self.ml_engine.create_preparation_pipeline(
                source_data_path=data_path,
                config=ml_config,
                workspace_id="default",  # TODO: Use actual workspace_id
                user_id="system",       # TODO: Use actual user_id
                name=f"ML Prep for Pipeline {pipeline_id}"
            )
            
            result = await self.ml_engine.execute_preparation_pipeline(
                str(ml_pipeline.id)
            )
        
        return asdict(result)
    
    async def _export_to_frameworks(
        self, 
        pipeline_id: str, 
        data_path: str, 
        config: PipelineConfig
    ) -> Dict[str, str]:
        """Export data to specified ML frameworks"""
        
        exports = {}
        
        for framework in config.target_frameworks:
            try:
                export_path = await self.framework_integrator.export_data(
                    data_path=data_path,
                    framework=framework,
                    output_dir=f"/tmp/pipeline_{pipeline_id}_exports/",
                    export_config={}
                )
                exports[framework] = export_path
                
            except Exception as e:
                logger.error(f"Failed to export to {framework}: {e}")
                exports[framework] = f"Error: {str(e)}"
        
        return exports
    
    async def _update_pipeline_status(
        self, 
        pipeline_id: str, 
        stage: PipelineStage, 
        progress: float, 
        message: str
    ):
        """Update pipeline status and send real-time updates"""
        
        if pipeline_id not in self.active_pipelines:
            return
        
        pipeline_info = self.active_pipelines[pipeline_id]
        pipeline_info["status"] = stage
        pipeline_info["progress"] = progress
        pipeline_info["current_step"] = message
        
        # Log progress
        logger.info(f"Pipeline {pipeline_id}: {stage.value} - {progress:.1f}% - {message}")
        
        # Send real-time update via WebSocket (if available)
        # TODO: Implement WebSocket broadcasting
        
        # Send webhook for major stage changes
        if stage in [PipelineStage.COMPLETED, PipelineStage.FAILED]:
            return  # These are handled separately
        
        await self.webhook_service.send_pipeline_progress_event(
            pipeline_id=pipeline_id,
            stage=stage.value,
            progress=progress,
            message=message,
            workspace_id=pipeline_info["workspace_id"],
            user_id=pipeline_info["user_id"]
        )
    
    def _update_performance_metrics(self, result: PipelineResult):
        """Update global performance metrics"""
        
        self.performance_metrics["total_pipelines"] += 1
        
        if result.success:
            self.performance_metrics["successful_pipelines"] += 1
        
        # Update average processing time
        total_time = (
            self.performance_metrics["average_processing_time"] * 
            (self.performance_metrics["total_pipelines"] - 1) + 
            result.processing_time_seconds
        )
        self.performance_metrics["average_processing_time"] = (
            total_time / self.performance_metrics["total_pipelines"]
        )
    
    async def get_pipeline_status(self, pipeline_id: str) -> Dict[str, Any]:
        """Get current status of a pipeline"""
        
        if pipeline_id not in self.active_pipelines:
            raise ValueError(f"Pipeline {pipeline_id} not found")
        
        return self.active_pipelines[pipeline_id]
    
    async def list_pipelines(
        self, 
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        status: Optional[PipelineStage] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List pipelines with optional filtering"""
        
        pipelines = list(self.active_pipelines.values())
        
        # Apply filters
        if user_id:
            pipelines = [p for p in pipelines if p["user_id"] == user_id]
        
        if workspace_id:
            pipelines = [p for p in pipelines if p["workspace_id"] == workspace_id]
        
        if status:
            pipelines = [p for p in pipelines if p["status"] == status]
        
        # Sort by creation time (newest first)
        pipelines.sort(key=lambda p: p["created_at"], reverse=True)
        
        return pipelines[:limit]
    
    async def cancel_pipeline(self, pipeline_id: str) -> bool:
        """Cancel a running pipeline"""
        
        if pipeline_id not in self.active_pipelines:
            return False
        
        pipeline_info = self.active_pipelines[pipeline_id]
        
        # TODO: Implement actual cancellation logic
        # This would involve stopping background tasks, cleaning up resources, etc.
        
        pipeline_info["status"] = PipelineStage.FAILED
        pipeline_info["error_message"] = "Pipeline cancelled by user"
        pipeline_info["completed_at"] = datetime.utcnow()
        
        logger.info(f"Pipeline {pipeline_id} cancelled")
        return True
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get overall performance metrics"""
        return self.performance_metrics.copy()


# Global pipeline orchestrator instance
pipeline_orchestrator = PipelineOrchestrator() 