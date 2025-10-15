"""
Data Processing API for Schlep-engine SDK
"""

from typing import Any, Dict, List, Optional, Union
import io
from pathlib import Path

from .base import BaseAPI
from ..models.data import (
    DataProcessingRequest, DataProcessingResult, DataQualityReport,
    TransformationRule, DataPipeline, DataFormat, ProcessingMode
)
from ..models.common import JobInfo, FileUpload, APIResponse


class DataProcessingAPI(BaseAPI):
    """
    Data Processing API client.
    
    Provides methods for processing, transforming, and managing data through
    the Schlep-engine platform.
    """
    
    def __init__(self, client):
        """Initialize data processing API."""
        super().__init__(client)
        self.base_path = "/data"
    
    async def process_file(
        self,
        file_path: Union[str, Path],
        data_format: Optional[DataFormat] = None,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        transformations: Optional[List[Dict[str, Any]]] = None,
        output_format: DataFormat = DataFormat.JSON,
        **options
    ) -> DataProcessingResult:
        """
        Process a data file.
        
        Args:
            file_path: Path to the data file
            data_format: Input data format (auto-detected if not specified)
            processing_mode: Processing mode (batch, streaming, real_time)
            transformations: List of transformation rules
            output_format: Desired output format
            **options: Additional processing options
            
        Returns:
            Data processing result
        """
        # Upload file first
        file_upload = await self.upload_file(file_path)
        
        # Create processing request
        request_data = DataProcessingRequest(
            source_path=file_upload.url,
            data_format=data_format or self._detect_format(file_path),
            processing_mode=processing_mode,
            transformations=transformations or [],
            output_format=output_format,
            options=options
        )
        
        # Submit processing job
        response = await self._post("/process", json=request_data.to_dict())
        result_data = response.get("data", response)
        
        return DataProcessingResult(
            job_id=result_data["job_id"],
            status=result_data["status"],
            **{k: v for k, v in result_data.items() if k not in ["job_id", "status"]}
        )
    
    async def process_url(
        self,
        url: str,
        data_format: DataFormat,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        transformations: Optional[List[Dict[str, Any]]] = None,
        output_format: DataFormat = DataFormat.JSON,
        **options
    ) -> DataProcessingResult:
        """
        Process data from a URL.
        
        Args:
            url: URL to the data source
            data_format: Input data format
            processing_mode: Processing mode
            transformations: List of transformation rules
            output_format: Desired output format
            **options: Additional processing options
            
        Returns:
            Data processing result
        """
        request_data = DataProcessingRequest(
            source_url=url,
            data_format=data_format,
            processing_mode=processing_mode,
            transformations=transformations or [],
            output_format=output_format,
            options=options
        )
        
        response = await self._post("/process", json=request_data.to_dict())
        result_data = response.get("data", response)
        
        return DataProcessingResult(
            job_id=result_data["job_id"],
            status=result_data["status"],
            **{k: v for k, v in result_data.items() if k not in ["job_id", "status"]}
        )
    
    async def upload_file(
        self,
        file_path: Union[str, Path, io.IOBase],
        filename: Optional[str] = None
    ) -> FileUpload:
        """
        Upload a file for processing.
        
        Args:
            file_path: Path to file or file-like object
            filename: Custom filename (used for file-like objects)
            
        Returns:
            File upload information
        """
        if isinstance(file_path, (str, Path)):
            path = Path(file_path)
            with open(path, 'rb') as f:
                files = {
                    'file': (path.name, f, 'application/octet-stream')
                }
                response = await self._post("/upload", files=files)
        else:
            # File-like object
            files = {
                'file': (filename or 'data', file_path, 'application/octet-stream')
            }
            response = await self._post("/upload", files=files)
        
        upload_data = response.get("data", response)
        return FileUpload(**upload_data)
    
    async def get_job_status(self, job_id: str) -> JobInfo:
        """
        Get processing job status.
        
        Args:
            job_id: Processing job ID
            
        Returns:
            Job information
        """
        response = await self._get(f"/jobs/{job_id}")
        job_data = response.get("data", response)
        return JobInfo(**job_data)
    
    async def get_job_result(self, job_id: str) -> DataProcessingResult:
        """
        Get processing job result.
        
        Args:
            job_id: Processing job ID
            
        Returns:
            Processing result
        """
        response = await self._get(f"/jobs/{job_id}/result")
        result_data = response.get("data", response)
        
        return DataProcessingResult(
            job_id=result_data["job_id"],
            status=result_data["status"],
            **{k: v for k, v in result_data.items() if k not in ["job_id", "status"]}
        )
    
    async def cancel_job(self, job_id: str) -> Dict[str, Any]:
        """
        Cancel a processing job.
        
        Args:
            job_id: Processing job ID
            
        Returns:
            Cancellation response
        """
        return await self._post(f"/jobs/{job_id}/cancel")
    
    async def list_jobs(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None
    ) -> APIResponse[List[JobInfo]]:
        """
        List processing jobs.
        
        Args:
            page: Page number
            page_size: Items per page
            status: Filter by job status
            
        Returns:
            Paginated list of jobs
        """
        params = self._build_query_params(
            page=page,
            page_size=page_size,
            status=status
        )
        
        return await self._paginated_request("/jobs", params, JobInfo)
    
    async def create_pipeline(self, pipeline: DataPipeline) -> Dict[str, Any]:
        """
        Create a data processing pipeline.
        
        Args:
            pipeline: Pipeline configuration
            
        Returns:
            Created pipeline information
        """
        return await self._post("/pipelines", json=pipeline.to_dict())
    
    async def get_pipeline(self, pipeline_id: str) -> DataPipeline:
        """
        Get pipeline configuration.
        
        Args:
            pipeline_id: Pipeline ID
            
        Returns:
            Pipeline configuration
        """
        response = await self._get(f"/pipelines/{pipeline_id}")
        pipeline_data = response.get("data", response)
        
        # Parse transformations
        transformations = [
            TransformationRule(**t) for t in pipeline_data.get("transformations", [])
        ]
        pipeline_data["transformations"] = transformations
        
        return DataPipeline(**pipeline_data)
    
    async def update_pipeline(
        self,
        pipeline_id: str,
        pipeline: DataPipeline
    ) -> Dict[str, Any]:
        """
        Update pipeline configuration.
        
        Args:
            pipeline_id: Pipeline ID
            pipeline: Updated pipeline configuration
            
        Returns:
            Updated pipeline information
        """
        return await self._put(f"/pipelines/{pipeline_id}", json=pipeline.to_dict())
    
    async def delete_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Delete a pipeline.
        
        Args:
            pipeline_id: Pipeline ID
            
        Returns:
            Deletion confirmation
        """
        return await self._delete(f"/pipelines/{pipeline_id}")
    
    async def run_pipeline(
        self,
        pipeline_id: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> DataProcessingResult:
        """
        Execute a pipeline.
        
        Args:
            pipeline_id: Pipeline ID
            parameters: Runtime parameters
            
        Returns:
            Pipeline execution result
        """
        data = {"parameters": parameters or {}}
        response = await self._post(f"/pipelines/{pipeline_id}/run", json=data)
        result_data = response.get("data", response)
        
        return DataProcessingResult(
            job_id=result_data["job_id"],
            status=result_data["status"],
            **{k: v for k, v in result_data.items() if k not in ["job_id", "status"]}
        )
    
    async def list_pipelines(
        self,
        page: int = 1,
        page_size: int = 20,
        active_only: bool = False
    ) -> APIResponse[List[DataPipeline]]:
        """
        List data processing pipelines.
        
        Args:
            page: Page number
            page_size: Items per page
            active_only: Show only active pipelines
            
        Returns:
            Paginated list of pipelines
        """
        params = self._build_query_params(
            page=page,
            page_size=page_size,
            active_only=active_only
        )
        
        return await self._paginated_request("/pipelines", params)
    
    def _detect_format(self, file_path: Union[str, Path]) -> DataFormat:
        """
        Auto-detect data format from file extension.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Detected data format
        """
        path = Path(file_path)
        extension = path.suffix.lower().lstrip('.')
        
        format_mapping = {
            'csv': DataFormat.CSV,
            'json': DataFormat.JSON,
            'xlsx': DataFormat.XLSX,
            'xls': DataFormat.XLSX,
            'parquet': DataFormat.PARQUET,
            'avro': DataFormat.AVRO,
            'orc': DataFormat.ORC
        }
        
        return format_mapping.get(extension, DataFormat.CSV)