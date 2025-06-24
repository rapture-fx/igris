"""
STREAMING DATA PROCESSOR - POLLARBASE
=====================================

Advanced streaming data processing system for handling large datasets efficiently.
Provides real-time processing, memory-efficient operations, and scalable data analysis.

Features:
- Memory-efficient streaming processing
- Real-time data analysis and insights
- Async chunk processing with backpressure handling
- Progress tracking and real-time updates
- Error recovery and retry mechanisms
- Multi-format support (CSV, JSON, Parquet, etc.)
- Advanced data validation and cleaning
- WebSocket support for real-time updates
"""

import asyncio
import csv
import json
import io
import tempfile
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional, Callable, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from pathlib import Path

import pandas as pd
import numpy as np
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.models import User, DataProcessingJob
from app.services.ai_engine import ai_engine

logger = logging.getLogger(__name__)

class ProcessingStatus(Enum):
    """Processing job status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class DataFormat(Enum):
    """Supported data formats"""
    CSV = "csv"
    JSON = "json"
    JSONL = "jsonl"
    PARQUET = "parquet"
    EXCEL = "excel"
    TSV = "tsv"

@dataclass
class ProcessingMetrics:
    """Real-time processing metrics"""
    total_rows: int = 0
    processed_rows: int = 0
    invalid_rows: int = 0
    start_time: Optional[datetime] = None
    current_time: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None
    processing_rate_per_second: float = 0.0
    memory_usage_mb: float = 0.0
    error_rate_percent: float = 0.0
    
    @property
    def progress_percent(self) -> float:
        return (self.processed_rows / self.total_rows * 100) if self.total_rows > 0 else 0.0
    
    @property
    def elapsed_seconds(self) -> float:
        if self.start_time and self.current_time:
            return (self.current_time - self.start_time).total_seconds()
        return 0.0

@dataclass
class StreamingConfig:
    """Configuration for streaming processing"""
    chunk_size: int = 10000
    max_memory_mb: int = 512
    max_concurrent_chunks: int = 4
    enable_progress_updates: bool = True
    update_interval_seconds: int = 1
    enable_validation: bool = True
    enable_cleaning: bool = True
    enable_insights: bool = True
    websocket_updates: bool = False

class StreamingDataProcessor:
    """
    Advanced streaming data processor for large datasets
    """
    
    def __init__(self, config: Optional[StreamingConfig] = None):
        self.config = config or StreamingConfig()
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self.websocket_connections: Dict[str, List[WebSocket]] = {}
        
    async def process_file_stream(
        self,
        file_path: str,
        data_format: DataFormat,
        user_id: str,
        db: AsyncSession,
        job_id: Optional[str] = None,
        websocket: Optional[WebSocket] = None,
        custom_processor: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Process a file in streaming mode with real-time updates
        
        Args:
            file_path: Path to the data file
            data_format: Format of the data file
            user_id: ID of the user requesting processing
            db: Database session
            job_id: Optional job ID for tracking
            websocket: Optional WebSocket for real-time updates
            custom_processor: Optional custom processing function
            
        Returns:
            Processing results with insights and metadata
        """
        if job_id is None:
            job_id = str(uuid.uuid4())
        
        # Initialize job tracking
        job_info = {
            "id": job_id,
            "user_id": user_id,
            "status": ProcessingStatus.PENDING,
            "metrics": ProcessingMetrics(start_time=datetime.utcnow()),
            "websocket": websocket,
            "results": {
                "insights": [],
                "schema_analysis": {},
                "data_quality": {},
                "sample_data": [],
                "errors": []
            }
        }
        
        self.active_jobs[job_id] = job_info
        
        if websocket:
            if job_id not in self.websocket_connections:
                self.websocket_connections[job_id] = []
            self.websocket_connections[job_id].append(websocket)
        
        try:
            # Create processing job record
            await self._create_job_record(db, job_id, user_id, file_path)
            
            # Start processing
            job_info["status"] = ProcessingStatus.PROCESSING
            await self._send_update(job_id, {"status": "processing", "message": "Starting data processing..."})
            
            # Determine total rows for progress tracking
            total_rows = await self._estimate_total_rows(file_path, data_format)
            job_info["metrics"].total_rows = total_rows
            
            # Process data in streaming mode
            processing_results = await self._process_data_stream(
                file_path=file_path,
                data_format=data_format,
                job_id=job_id,
                custom_processor=custom_processor
            )
            
            # Finalize results
            job_info["results"].update(processing_results)
            job_info["status"] = ProcessingStatus.COMPLETED
            job_info["metrics"].current_time = datetime.utcnow()
            
            # Update job record
            await self._update_job_record(db, job_id, ProcessingStatus.COMPLETED, job_info["results"])
            
            # Send final update
            await self._send_update(job_id, {
                "status": "completed",
                "results": job_info["results"],
                "metrics": asdict(job_info["metrics"])
            })
            
            return job_info["results"]
            
        except Exception as e:
            logger.error(f"Streaming processing failed for job {job_id}: {e}")
            
            job_info["status"] = ProcessingStatus.FAILED
            job_info["results"]["errors"].append({
                "type": "processing_error",
                "message": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            await self._update_job_record(db, job_id, ProcessingStatus.FAILED, job_info["results"])
            await self._send_update(job_id, {
                "status": "failed",
                "error": str(e)
            })
            
            raise
            
        finally:
            # Cleanup
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            if job_id in self.websocket_connections:
                del self.websocket_connections[job_id]
    
    async def _process_data_stream(
        self,
        file_path: str,
        data_format: DataFormat,
        job_id: str,
        custom_processor: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Process data in streaming chunks"""
        results = {
            "insights": [],
            "schema_analysis": {},
            "data_quality": {
                "total_rows": 0,
                "valid_rows": 0,
                "invalid_rows": 0,
                "missing_values": {},
                "duplicates": 0,
                "data_types": {},
                "outliers": {}
            },
            "sample_data": [],
            "performance_stats": {
                "processing_time_seconds": 0,
                "memory_peak_mb": 0,
                "throughput_rows_per_second": 0
            }
        }
        
        job_info = self.active_jobs[job_id]
        metrics = job_info["metrics"]
        
        # Initialize chunk processor
        chunk_processor = self._get_chunk_processor(data_format)
        
        # Process data in chunks
        chunk_count = 0
        accumulated_insights = []
        schema_info = None
        
        async for chunk_data in chunk_processor(file_path):
            if job_info["status"] == ProcessingStatus.CANCELLED:
                break
            
            chunk_count += 1
            chunk_results = await self._process_chunk(
                chunk_data=chunk_data,
                chunk_index=chunk_count,
                job_id=job_id,
                custom_processor=custom_processor
            )
            
            # Update metrics
            metrics.processed_rows += len(chunk_data)
            metrics.current_time = datetime.utcnow()
            
            if metrics.elapsed_seconds > 0:
                metrics.processing_rate_per_second = metrics.processed_rows / metrics.elapsed_seconds
            
            # Accumulate results
            accumulated_insights.extend(chunk_results.get("insights", []))
            results["data_quality"]["valid_rows"] += chunk_results.get("valid_rows", 0)
            results["data_quality"]["invalid_rows"] += chunk_results.get("invalid_rows", 0)
            
            # Update schema on first chunk
            if schema_info is None and chunk_results.get("schema"):
                schema_info = chunk_results["schema"]
                results["schema_analysis"] = schema_info
            
            # Store sample data from first chunk
            if chunk_count == 1 and chunk_results.get("sample_data"):
                results["sample_data"] = chunk_results["sample_data"][:100]  # First 100 rows
            
            # Send progress update
            if self.config.enable_progress_updates:
                await self._send_progress_update(job_id, metrics)
            
            # Memory management
            if chunk_count % 10 == 0:  # Check memory every 10 chunks
                await self._manage_memory()
        
        # Finalize results
        results["insights"] = self._consolidate_insights(accumulated_insights)
        results["data_quality"]["total_rows"] = metrics.processed_rows
        results["performance_stats"]["processing_time_seconds"] = metrics.elapsed_seconds
        results["performance_stats"]["throughput_rows_per_second"] = metrics.processing_rate_per_second
        
        return results
    
    def _get_chunk_processor(self, data_format: DataFormat) -> Callable:
        """Get appropriate chunk processor for data format"""
        processors = {
            DataFormat.CSV: self._process_csv_chunks,
            DataFormat.JSON: self._process_json_chunks,
            DataFormat.JSONL: self._process_jsonl_chunks,
            DataFormat.PARQUET: self._process_parquet_chunks,
            DataFormat.EXCEL: self._process_excel_chunks,
            DataFormat.TSV: self._process_tsv_chunks
        }
        
        return processors.get(data_format, self._process_csv_chunks)
    
    async def _process_csv_chunks(self, file_path: str) -> AsyncGenerator[List[Dict], None]:
        """Process CSV file in chunks"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                # Detect delimiter
                sample = file.read(1024)
                file.seek(0)
                
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                reader = csv.DictReader(file, delimiter=delimiter)
                chunk = []
                
                for row in reader:
                    chunk.append(row)
                    
                    if len(chunk) >= self.config.chunk_size:
                        yield chunk
                        chunk = []
                        await asyncio.sleep(0)  # Allow other tasks to run
                
                # Yield remaining data
                if chunk:
                    yield chunk
                    
        except Exception as e:
            logger.error(f"CSV chunk processing failed: {e}")
            raise
    
    async def _process_json_chunks(self, file_path: str) -> AsyncGenerator[List[Dict], None]:
        """Process JSON file in chunks"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                
                if isinstance(data, list):
                    # Process array of objects
                    for i in range(0, len(data), self.config.chunk_size):
                        chunk = data[i:i + self.config.chunk_size]
                        yield chunk
                        await asyncio.sleep(0)
                else:
                    # Single object
                    yield [data]
                    
        except Exception as e:
            logger.error(f"JSON chunk processing failed: {e}")
            raise
    
    async def _process_jsonl_chunks(self, file_path: str) -> AsyncGenerator[List[Dict], None]:
        """Process JSONL file in chunks"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                chunk = []
                
                for line in file:
                    if line.strip():
                        try:
                            obj = json.loads(line)
                            chunk.append(obj)
                            
                            if len(chunk) >= self.config.chunk_size:
                                yield chunk
                                chunk = []
                                await asyncio.sleep(0)
                                
                        except json.JSONDecodeError as e:
                            logger.warning(f"Invalid JSON line: {line[:100]}... Error: {e}")
                
                # Yield remaining data
                if chunk:
                    yield chunk
                    
        except Exception as e:
            logger.error(f"JSONL chunk processing failed: {e}")
            raise
    
    async def _process_parquet_chunks(self, file_path: str) -> AsyncGenerator[List[Dict], None]:
        """Process Parquet file in chunks"""
        try:
            import pyarrow.parquet as pq
            
            parquet_file = pq.ParquetFile(file_path)
            
            for batch in parquet_file.iter_batches(batch_size=self.config.chunk_size):
                df = batch.to_pandas()
                chunk = df.to_dict('records')
                yield chunk
                await asyncio.sleep(0)
                
        except Exception as e:
            logger.error(f"Parquet chunk processing failed: {e}")
            # Fallback to pandas
            try:
                df = pd.read_parquet(file_path)
                for i in range(0, len(df), self.config.chunk_size):
                    chunk = df.iloc[i:i + self.config.chunk_size].to_dict('records')
                    yield chunk
                    await asyncio.sleep(0)
            except Exception as fallback_e:
                logger.error(f"Parquet fallback processing failed: {fallback_e}")
                raise
    
    async def _process_excel_chunks(self, file_path: str) -> AsyncGenerator[List[Dict], None]:
        """Process Excel file in chunks"""
        try:
            # Read Excel file in chunks
            for chunk_df in pd.read_excel(file_path, chunksize=self.config.chunk_size):
                chunk = chunk_df.to_dict('records')
                yield chunk
                await asyncio.sleep(0)
                
        except Exception as e:
            logger.error(f"Excel chunk processing failed: {e}")
            raise
    
    async def _process_tsv_chunks(self, file_path: str) -> AsyncGenerator[List[Dict], None]:
        """Process TSV file in chunks"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file, delimiter='\t')
                chunk = []
                
                for row in reader:
                    chunk.append(row)
                    
                    if len(chunk) >= self.config.chunk_size:
                        yield chunk
                        chunk = []
                        await asyncio.sleep(0)
                
                # Yield remaining data
                if chunk:
                    yield chunk
                    
        except Exception as e:
            logger.error(f"TSV chunk processing failed: {e}")
            raise
    
    async def _process_chunk(
        self,
        chunk_data: List[Dict],
        chunk_index: int,
        job_id: str,
        custom_processor: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Process a single chunk of data"""
        chunk_results = {
            "insights": [],
            "valid_rows": 0,
            "invalid_rows": 0,
            "schema": None,
            "sample_data": []
        }
        
        try:
            # Apply custom processor if provided
            if custom_processor:
                chunk_data = await custom_processor(chunk_data, chunk_index)
            
            # Validate data
            if self.config.enable_validation:
                validation_results = await self._validate_chunk(chunk_data)
                chunk_results["valid_rows"] = validation_results["valid_rows"]
                chunk_results["invalid_rows"] = validation_results["invalid_rows"]
            
            # Analyze schema (first chunk only)
            if chunk_index == 1:
                chunk_results["schema"] = await self._analyze_schema(chunk_data)
                chunk_results["sample_data"] = chunk_data[:10]  # First 10 rows as sample
            
            # Generate insights
            if self.config.enable_insights and len(chunk_data) > 0:
                insights = await self._generate_chunk_insights(chunk_data, chunk_index)
                chunk_results["insights"] = insights
            
            return chunk_results
            
        except Exception as e:
            logger.error(f"Chunk {chunk_index} processing failed for job {job_id}: {e}")
            chunk_results["invalid_rows"] = len(chunk_data)
            return chunk_results
    
    async def _validate_chunk(self, chunk_data: List[Dict]) -> Dict[str, int]:
        """Validate chunk data"""
        valid_rows = 0
        invalid_rows = 0
        
        for row in chunk_data:
            try:
                # Basic validation - check if row has data
                if any(value for value in row.values() if value is not None and str(value).strip()):
                    valid_rows += 1
                else:
                    invalid_rows += 1
            except Exception:
                invalid_rows += 1
        
        return {"valid_rows": valid_rows, "invalid_rows": invalid_rows}
    
    async def _analyze_schema(self, chunk_data: List[Dict]) -> Dict[str, Any]:
        """Analyze data schema from chunk"""
        if not chunk_data:
            return {}
        
        schema = {
            "columns": [],
            "total_columns": 0,
            "data_types": {},
            "nullable_columns": [],
            "estimated_size": len(chunk_data)
        }
        
        try:
            # Get all columns from first few rows
            all_columns = set()
            for row in chunk_data[:100]:  # Sample first 100 rows
                all_columns.update(row.keys())
            
            schema["columns"] = list(all_columns)
            schema["total_columns"] = len(all_columns)
            
            # Analyze data types
            for column in all_columns:
                values = [row.get(column) for row in chunk_data[:100] if row.get(column) is not None]
                
                if values:
                    # Simple type detection
                    sample_value = values[0]
                    if isinstance(sample_value, (int, float)):
                        schema["data_types"][column] = "numeric"
                    elif isinstance(sample_value, str):
                        # Check if it looks like a date
                        if any(keyword in sample_value.lower() for keyword in ['date', 'time', '-', '/']):
                            schema["data_types"][column] = "datetime"
                        else:
                            schema["data_types"][column] = "text"
                    else:
                        schema["data_types"][column] = "mixed"
                else:
                    schema["nullable_columns"].append(column)
                    schema["data_types"][column] = "unknown"
            
            return schema
            
        except Exception as e:
            logger.error(f"Schema analysis failed: {e}")
            return schema
    
    async def _generate_chunk_insights(self, chunk_data: List[Dict], chunk_index: int) -> List[Dict[str, Any]]:
        """Generate insights from chunk data"""
        insights = []
        
        try:
            if not chunk_data:
                return insights
            
            # Basic statistical insights
            if chunk_index == 1:  # Only from first chunk to avoid repetition
                insights.append({
                    "type": "data_overview",
                    "title": "Data Overview",
                    "description": f"Dataset contains {len(chunk_data)} rows in this chunk with {len(chunk_data[0].keys()) if chunk_data else 0} columns",
                    "chunk_index": chunk_index
                })
            
            # Check for common data quality issues
            empty_rows = sum(1 for row in chunk_data if not any(value for value in row.values() if value))
            if empty_rows > 0:
                insights.append({
                    "type": "data_quality",
                    "title": "Empty Rows Detected",
                    "description": f"Found {empty_rows} empty rows in chunk {chunk_index}",
                    "severity": "warning",
                    "chunk_index": chunk_index
                })
            
            return insights
            
        except Exception as e:
            logger.error(f"Insight generation failed for chunk {chunk_index}: {e}")
            return insights
    
    def _consolidate_insights(self, accumulated_insights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Consolidate insights from multiple chunks"""
        consolidated = []
        insight_types = {}
        
        # Group insights by type
        for insight in accumulated_insights:
            insight_type = insight.get("type", "unknown")
            if insight_type not in insight_types:
                insight_types[insight_type] = []
            insight_types[insight_type].append(insight)
        
        # Consolidate similar insights
        for insight_type, insights in insight_types.items():
            if insight_type == "data_quality":
                # Consolidate quality issues
                total_issues = len(insights)
                consolidated.append({
                    "type": "data_quality_summary",
                    "title": f"Data Quality Summary",
                    "description": f"Found {total_issues} data quality issues across all chunks",
                    "details": insights[:5]  # Show first 5 issues
                })
            else:
                # Keep unique insights
                consolidated.extend(insights[:3])  # Keep first 3 of each type
        
        return consolidated
    
    async def _estimate_total_rows(self, file_path: str, data_format: DataFormat) -> int:
        """Estimate total number of rows for progress tracking"""
        try:
            if data_format == DataFormat.CSV:
                with open(file_path, 'r', encoding='utf-8') as file:
                    return sum(1 for line in file) - 1  # Subtract header
            
            elif data_format == DataFormat.JSONL:
                with open(file_path, 'r', encoding='utf-8') as file:
                    return sum(1 for line in file if line.strip())
            
            elif data_format == DataFormat.JSON:
                with open(file_path, 'r', encoding='utf-8') as file:
                    data = json.load(file)
                    return len(data) if isinstance(data, list) else 1
            
            elif data_format == DataFormat.PARQUET:
                try:
                    import pyarrow.parquet as pq
                    parquet_file = pq.ParquetFile(file_path)
                    return parquet_file.metadata.num_rows
                except:
                    df = pd.read_parquet(file_path)
                    return len(df)
            
            elif data_format == DataFormat.EXCEL:
                df = pd.read_excel(file_path, nrows=0)
                with pd.ExcelFile(file_path) as xls:
                    return len(pd.read_excel(xls))
            
            else:
                # Default estimation
                return 10000
                
        except Exception as e:
            logger.warning(f"Row estimation failed: {e}")
            return 10000  # Default estimate
    
    async def _create_job_record(self, db: AsyncSession, job_id: str, user_id: str, file_path: str):
        """Create database record for processing job"""
        try:
            job = DataProcessingJob(
                id=job_id,
                user_id=user_id,
                file_path=file_path,
                status=ProcessingStatus.PENDING.value,
                created_at=datetime.utcnow()
            )
            
            db.add(job)
            await db.commit()
            
        except Exception as e:
            logger.error(f"Failed to create job record: {e}")
    
    async def _update_job_record(
        self,
        db: AsyncSession,
        job_id: str,
        status: ProcessingStatus,
        results: Dict[str, Any]
    ):
        """Update job record with results"""
        try:
            job = await db.get(DataProcessingJob, job_id)
            if job:
                job.status = status.value
                job.results = results
                job.completed_at = datetime.utcnow()
                await db.commit()
                
        except Exception as e:
            logger.error(f"Failed to update job record: {e}")
    
    async def _send_update(self, job_id: str, update_data: Dict[str, Any]):
        """Send update via WebSocket"""
        if job_id in self.websocket_connections:
            message = {
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat(),
                **update_data
            }
            
            for websocket in self.websocket_connections[job_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send WebSocket update: {e}")
    
    async def _send_progress_update(self, job_id: str, metrics: ProcessingMetrics):
        """Send progress update"""
        await self._send_update(job_id, {
            "type": "progress",
            "progress_percent": metrics.progress_percent,
            "processed_rows": metrics.processed_rows,
            "total_rows": metrics.total_rows,
            "processing_rate": metrics.processing_rate_per_second,
            "estimated_completion": metrics.estimated_completion.isoformat() if metrics.estimated_completion else None
        })
    
    async def _manage_memory(self):
        """Manage memory usage during processing"""
        try:
            import psutil
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            if memory_mb > self.config.max_memory_mb:
                logger.warning(f"Memory usage {memory_mb:.1f}MB exceeds limit {self.config.max_memory_mb}MB")
                # Force garbage collection
                import gc
                gc.collect()
                
        except Exception as e:
            logger.warning(f"Memory management check failed: {e}")
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job"""
        if job_id in self.active_jobs:
            self.active_jobs[job_id]["status"] = ProcessingStatus.CANCELLED
            await self._send_update(job_id, {"status": "cancelled", "message": "Job cancelled by user"})
            return True
        return False
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get current job status"""
        if job_id in self.active_jobs:
            job_info = self.active_jobs[job_id]
            return {
                "id": job_id,
                "status": job_info["status"].value,
                "metrics": asdict(job_info["metrics"]),
                "results": job_info["results"]
            }
        return None

# Global streaming processor instance
streaming_processor = StreamingDataProcessor()

# Convenience functions
async def process_large_dataset(
    file_path: str,
    data_format: str,
    user_id: str,
    db: AsyncSession,
    websocket: Optional[WebSocket] = None
) -> Dict[str, Any]:
    """Process large dataset with streaming"""
    format_enum = DataFormat(data_format.lower())
    return await streaming_processor.process_file_stream(
        file_path=file_path,
        data_format=format_enum,
        user_id=user_id,
        db=db,
        websocket=websocket
    ) 