"""
Machine Learning Pipeline API for Schlep-engine SDK
"""

from typing import Any, Dict, List, Optional, Union
from pathlib import Path

from .base import BaseAPI
from ..models.ml import (
    MLPipelineConfig, MLPipelineResult, TrainingJob, PredictionRequest,
    PredictionResult, ModelInfo, ModelMetrics, MLTaskType, ModelType
)
from ..models.common import APIResponse


class MLPipelineAPI(BaseAPI):
    """
    Machine Learning Pipeline API client.
    
    Provides methods for creating, training, and managing ML models and pipelines.
    """
    
    def __init__(self, client):
        """Initialize ML pipeline API."""
        super().__init__(client)
        self.base_path = "/ml"
    
    async def create_pipeline(self, config: MLPipelineConfig) -> Dict[str, Any]:
        """
        Create a new ML pipeline.
        
        Args:
            config: Pipeline configuration
            
        Returns:
            Created pipeline information
        """
        response = await self._post("/pipelines", json=config.to_dict())
        return response.get("data", response)
    
    async def get_pipeline(self, pipeline_id: str) -> MLPipelineConfig:
        """
        Get pipeline configuration.
        
        Args:
            pipeline_id: Pipeline ID
            
        Returns:
            Pipeline configuration
        """
        response = await self._get(f"/pipelines/{pipeline_id}")
        pipeline_data = response.get("data", response)
        
        return MLPipelineConfig(
            name=pipeline_data["name"],
            task_type=MLTaskType(pipeline_data["task_type"]),
            model_type=ModelType(pipeline_data["model_type"]),
            target_column=pipeline_data["target_column"],
            **{k: v for k, v in pipeline_data.items() 
               if k not in ["name", "task_type", "model_type", "target_column"]}
        )
    
    async def update_pipeline(
        self,
        pipeline_id: str,
        config: MLPipelineConfig
    ) -> Dict[str, Any]:
        """
        Update pipeline configuration.
        
        Args:
            pipeline_id: Pipeline ID
            config: Updated configuration
            
        Returns:
            Updated pipeline information
        """
        return await self._put(f"/pipelines/{pipeline_id}", json=config.to_dict())
    
    async def delete_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Delete a pipeline.
        
        Args:
            pipeline_id: Pipeline ID
            
        Returns:
            Deletion confirmation
        """
        return await self._delete(f"/pipelines/{pipeline_id}")
    
    async def list_pipelines(
        self,
        page: int = 1,
        page_size: int = 20,
        task_type: Optional[MLTaskType] = None,
        model_type: Optional[ModelType] = None
    ) -> APIResponse[List[Dict[str, Any]]]:
        """
        List ML pipelines.
        
        Args:
            page: Page number
            page_size: Items per page
            task_type: Filter by task type
            model_type: Filter by model type
            
        Returns:
            Paginated list of pipelines
        """
        params = self._build_query_params(
            page=page,
            page_size=page_size,
            task_type=task_type.value if task_type else None,
            model_type=model_type.value if model_type else None
        )
        
        return await self._paginated_request("/pipelines", params)
    
    async def train_pipeline(
        self,
        pipeline_id: str,
        training_data_path: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None
    ) -> TrainingJob:
        """
        Start training a pipeline.
        
        Args:
            pipeline_id: Pipeline ID
            training_data_path: Path to training data (overrides pipeline config)
            parameters: Additional training parameters
            
        Returns:
            Training job information
        """
        data = {
            "pipeline_id": pipeline_id,
            "training_data_path": training_data_path,
            "parameters": parameters or {}
        }
        
        response = await self._post("/train", json=data)
        training_data = response.get("data", response)
        
        return TrainingJob(
            job_id=training_data["job_id"],
            pipeline_id=training_data["pipeline_id"],
            status=training_data["status"],
            **{k: v for k, v in training_data.items() 
               if k not in ["job_id", "pipeline_id", "status"]}
        )
    
    async def get_training_job(self, job_id: str) -> TrainingJob:
        """
        Get training job status and details.
        
        Args:
            job_id: Training job ID
            
        Returns:
            Training job information
        """
        response = await self._get(f"/training/{job_id}")
        job_data = response.get("data", response)
        
        # Parse metrics if present
        metrics = None
        if job_data.get("metrics"):
            metrics = ModelMetrics(**job_data["metrics"])
        
        return TrainingJob(
            job_id=job_data["job_id"],
            pipeline_id=job_data["pipeline_id"],
            status=job_data["status"],
            metrics=metrics,
            **{k: v for k, v in job_data.items() 
               if k not in ["job_id", "pipeline_id", "status", "metrics"]}
        )
    
    async def cancel_training(self, job_id: str) -> Dict[str, Any]:
        """
        Cancel a training job.
        
        Args:
            job_id: Training job ID
            
        Returns:
            Cancellation confirmation
        """
        return await self._post(f"/training/{job_id}/cancel")
    
    async def get_training_logs(
        self,
        job_id: str,
        lines: Optional[int] = None
    ) -> List[str]:
        """
        Get training logs.
        
        Args:
            job_id: Training job ID
            lines: Number of recent lines to fetch
            
        Returns:
            List of log lines
        """
        params = self._build_query_params(lines=lines)
        response = await self._get(f"/training/{job_id}/logs", params=params)
        return response.get("data", response).get("logs", [])
    
    async def list_training_jobs(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        pipeline_id: Optional[str] = None
    ) -> APIResponse[List[TrainingJob]]:
        """
        List training jobs.
        
        Args:
            page: Page number
            page_size: Items per page
            status: Filter by job status
            pipeline_id: Filter by pipeline ID
            
        Returns:
            Paginated list of training jobs
        """
        params = self._build_query_params(
            page=page,
            page_size=page_size,
            status=status,
            pipeline_id=pipeline_id
        )
        
        return await self._paginated_request("/training", params, TrainingJob)
    
    async def predict(
        self,
        model_id: str,
        input_data: Union[Dict[str, Any], List[Dict[str, Any]]],
        return_probabilities: bool = False,
        explain_predictions: bool = False
    ) -> PredictionResult:
        """
        Make predictions with a trained model.
        
        Args:
            model_id: Model ID
            input_data: Input data for prediction
            return_probabilities: Whether to return prediction probabilities
            explain_predictions: Whether to include prediction explanations
            
        Returns:
            Prediction results
        """
        request = PredictionRequest(
            model_id=model_id,
            input_data=input_data,
            return_probabilities=return_probabilities,
            explain_predictions=explain_predictions
        )
        
        response = await self._post("/predict", json=request.to_dict())
        result_data = response.get("data", response)
        
        return PredictionResult(**result_data)
    
    async def batch_predict(
        self,
        model_id: str,
        data_path: str,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run batch predictions on a dataset.
        
        Args:
            model_id: Model ID
            data_path: Path to input data file
            output_path: Path for output predictions
            
        Returns:
            Batch prediction job information
        """
        data = {
            "model_id": model_id,
            "data_path": data_path,
            "output_path": output_path
        }
        
        return await self._post("/predict/batch", json=data)
    
    async def get_model(self, model_id: str) -> ModelInfo:
        """
        Get model information.
        
        Args:
            model_id: Model ID
            
        Returns:
            Model information
        """
        response = await self._get(f"/models/{model_id}")
        model_data = response.get("data", response)
        
        # Parse metrics if present
        metrics = None
        if model_data.get("metrics"):
            metrics = ModelMetrics(**model_data["metrics"])
        
        return ModelInfo(
            model_id=model_data["model_id"],
            name=model_data["name"],
            model_type=ModelType(model_data["model_type"]),
            task_type=MLTaskType(model_data["task_type"]),
            version=model_data["version"],
            status=model_data["status"],
            metrics=metrics,
            **{k: v for k, v in model_data.items() 
               if k not in ["model_id", "name", "model_type", "task_type", "version", "status", "metrics"]}
        )
    
    async def list_models(
        self,
        page: int = 1,
        page_size: int = 20,
        task_type: Optional[MLTaskType] = None,
        model_type: Optional[ModelType] = None
    ) -> APIResponse[List[ModelInfo]]:
        """
        List trained models.
        
        Args:
            page: Page number
            page_size: Items per page
            task_type: Filter by task type
            model_type: Filter by model type
            
        Returns:
            Paginated list of models
        """
        params = self._build_query_params(
            page=page,
            page_size=page_size,
            task_type=task_type.value if task_type else None,
            model_type=model_type.value if model_type else None
        )
        
        return await self._paginated_request("/models", params, ModelInfo)
    
    async def delete_model(self, model_id: str) -> Dict[str, Any]:
        """
        Delete a model.
        
        Args:
            model_id: Model ID
            
        Returns:
            Deletion confirmation
        """
        return await self._delete(f"/models/{model_id}")
    
    async def download_model(self, model_id: str, output_path: str) -> str:
        """
        Download a trained model.
        
        Args:
            model_id: Model ID
            output_path: Local path to save the model
            
        Returns:
            Downloaded file path
        """
        # This would need to be implemented based on the actual API
        # For now, return the API endpoint for model download
        download_url = f"{self.client.base_url}/api/v1/ml/models/{model_id}/download"
        
        # In a real implementation, you'd download the file here
        # For now, we'll just return the URL
        return download_url
    
    async def get_model_metrics(self, model_id: str) -> ModelMetrics:
        """
        Get detailed model metrics.
        
        Args:
            model_id: Model ID
            
        Returns:
            Model metrics
        """
        response = await self._get(f"/models/{model_id}/metrics")
        metrics_data = response.get("data", response)
        
        return ModelMetrics(**metrics_data)