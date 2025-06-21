"""
STREAMING DATA PROCESSING API - POLLARBASE
==========================================

Advanced streaming data processing system for handling large datasets efficiently.
Supports real-time processing, progressive results, and memory-optimized operations.

Key Features:
- Streaming file upload and processing
- Real-time progress updates via WebSocket
- Memory-optimized chunk processing
- Progressive result delivery
- Support for multiple file formats (CSV, JSON, Excel, Parquet)
- Automatic schema detection and quality analysis
- Background task processing with Celery
"""

import asyncio
import io
import json
import uuid
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from redis import Redis
import logging

from app.database.connection import get_db
from app.database.models import User, DataInvestigation, ProcessingJob, JobStatus
from app.core.api_config import settings
from app.services.ai_data_detective import AIDataDetective
from app.api.v1.auth_unified import get_current_user

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
router = APIRouter()
redis_client = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True)

# ==================== STREAMING MODELS ====================

class StreamingRequest(BaseModel):
    """Streaming processing request"""
    filename: str
    file_size: int
    chunk_size: int = 10000  # rows per chunk
    options: Dict[str, Any] = Field(default_factory=dict)
    
class StreamingStatus(BaseModel):
    """Streaming processing status"""
    job_id: str
    status: str
    progress: float
    processed_rows: int
    total_rows: Optional[int] = None
    current_chunk: int
    insights_found: int
    quality_score: Optional[float] = None
    estimated_completion: Optional[datetime] = None
    
class ChunkResult(BaseModel):
    """Individual chunk processing result"""
    chunk_id: int
    rows_processed: int
    insights: List[Dict[str, Any]]
    quality_metrics: Dict[str, float]
    schema_updates: Dict[str, Any]
    anomalies: List[Dict[str, Any]]

class StreamingResponse(BaseModel):
    """Final streaming processing response"""
    job_id: str
    status: str
    total_rows: int
    total_chunks: int
    processing_time: float
    final_quality_score: float
    consolidated_insights: List[Dict[str, Any]]
    final_schema: Dict[str, Any]
    recommendations: List[str]

# ==================== STREAMING PROCESSOR ====================

class StreamingDataProcessor:
    """Advanced streaming data processor with memory optimization"""
    
    def __init__(self):
        self.chunk_size = 10000
        self.max_memory_usage = 2 * 1024 * 1024 * 1024  # 2GB
        self.ai_detective = AIDataDetective()
        
    async def process_file_stream(
        self, 
        file: UploadFile, 
        job_id: str,
        user_id: str,
        options: Dict[str, Any]
    ) -> AsyncGenerator[ChunkResult, None]:
        """Process file in streaming chunks"""
        
        try:
            # Initialize processing state
            chunk_id = 0
            total_insights = []
            consolidated_schema = {}
            
            # Update job status
            await self._update_job_status(job_id, "processing", 0.0)
            
            # Determine file type and create reader
            file_extension = file.filename.split('.')[-1].lower()
            
            if file_extension == 'csv':
                async for chunk_result in self._process_csv_stream(file, job_id, options):
                    yield chunk_result
                    
            elif file_extension == 'json':
                async for chunk_result in self._process_json_stream(file, job_id, options):
                    yield chunk_result
                    
            elif file_extension in ['xlsx', 'xls']:
                async for chunk_result in self._process_excel_stream(file, job_id, options):
                    yield chunk_result
                    
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file format: {file_extension}"
                )
                
        except Exception as e:
            logger.error(f"Streaming processing error: {e}")
            await self._update_job_status(job_id, "failed", 0.0, str(e))
            raise
    
    async def _process_csv_stream(
        self, 
        file: UploadFile, 
        job_id: str, 
        options: Dict[str, Any]
    ) -> AsyncGenerator[ChunkResult, None]:
        """Process CSV file in streaming chunks"""
        
        chunk_id = 0
        total_processed = 0
        
        # Read file content
        content = await file.read()
        file_stream = io.StringIO(content.decode('utf-8'))
        
        # Process in chunks
        for chunk_df in pd.read_csv(file_stream, chunksize=self.chunk_size):
            
            # Process chunk with AI detective
            chunk_analysis = await self.ai_detective.analyze_chunk(
                chunk_df, 
                chunk_id=chunk_id,
                options=options
            )
            
            # Create chunk result
            chunk_result = ChunkResult(
                chunk_id=chunk_id,
                rows_processed=len(chunk_df),
                insights=chunk_analysis.get('insights', []),
                quality_metrics=chunk_analysis.get('quality_metrics', {}),
                schema_updates=chunk_analysis.get('schema_info', {}),
                anomalies=chunk_analysis.get('anomalies', [])
            )
            
            total_processed += len(chunk_df)
            progress = min(total_processed / 100000, 1.0)  # Estimate progress
            
            # Update job progress
            await self._update_job_status(job_id, "processing", progress * 100)
            
            # Update Redis with chunk result for real-time access
            await self._cache_chunk_result(job_id, chunk_id, chunk_result)
            
            chunk_id += 1
            yield chunk_result
            
            # Cleanup memory
            del chunk_df
    
    async def _process_json_stream(
        self, 
        file: UploadFile, 
        job_id: str, 
        options: Dict[str, Any]
    ) -> AsyncGenerator[ChunkResult, None]:
        """Process JSON file in streaming chunks"""
        
        content = await file.read()
        
        try:
            # Try to parse as JSON array
            data = json.loads(content.decode('utf-8'))
            
            if isinstance(data, list):
                # Process array in chunks
                chunk_id = 0
                for i in range(0, len(data), self.chunk_size):
                    chunk_data = data[i:i + self.chunk_size]
                    chunk_df = pd.DataFrame(chunk_data)
                    
                    # Process chunk
                    chunk_analysis = await self.ai_detective.analyze_chunk(
                        chunk_df, 
                        chunk_id=chunk_id,
                        options=options
                    )
                    
                    chunk_result = ChunkResult(
                        chunk_id=chunk_id,
                        rows_processed=len(chunk_df),
                        insights=chunk_analysis.get('insights', []),
                        quality_metrics=chunk_analysis.get('quality_metrics', {}),
                        schema_updates=chunk_analysis.get('schema_info', {}),
                        anomalies=chunk_analysis.get('anomalies', [])
                    )
                    
                    # Update progress
                    progress = min((i + len(chunk_data)) / len(data) * 100, 100)
                    await self._update_job_status(job_id, "processing", progress)
                    
                    chunk_id += 1
                    yield chunk_result
                    
                    # Cleanup
                    del chunk_df
            else:
                # Single object - convert to DataFrame
                chunk_df = pd.json_normalize(data)
                chunk_analysis = await self.ai_detective.analyze_chunk(
                    chunk_df, 
                    chunk_id=0,
                    options=options
                )
                
                yield ChunkResult(
                    chunk_id=0,
                    rows_processed=len(chunk_df),
                    insights=chunk_analysis.get('insights', []),
                    quality_metrics=chunk_analysis.get('quality_metrics', {}),
                    schema_updates=chunk_analysis.get('schema_info', {}),
                    anomalies=chunk_analysis.get('anomalies', [])
                )
                
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON format: {str(e)}"
            )
    
    async def _process_excel_stream(
        self, 
        file: UploadFile, 
        job_id: str, 
        options: Dict[str, Any]
    ) -> AsyncGenerator[ChunkResult, None]:
        """Process Excel file in streaming chunks"""
        
        content = await file.read()
        
        try:
            # Read Excel file
            excel_file = pd.ExcelFile(io.BytesIO(content))
            
            # Process each sheet
            for sheet_name in excel_file.sheet_names:
                chunk_id = 0
                
                # Read sheet in chunks
                for chunk_df in pd.read_excel(
                    excel_file, 
                    sheet_name=sheet_name, 
                    chunksize=self.chunk_size
                ):
                    # Process chunk
                    chunk_analysis = await self.ai_detective.analyze_chunk(
                        chunk_df, 
                        chunk_id=chunk_id,
                        options={**options, 'sheet_name': sheet_name}
                    )
                    
                    chunk_result = ChunkResult(
                        chunk_id=chunk_id,
                        rows_processed=len(chunk_df),
                        insights=chunk_analysis.get('insights', []),
                        quality_metrics=chunk_analysis.get('quality_metrics', {}),
                        schema_updates=chunk_analysis.get('schema_info', {}),
                        anomalies=chunk_analysis.get('anomalies', [])
                    )
                    
                    # Update progress (estimate based on chunk)
                    progress = min(chunk_id * 10, 90)  # Rough estimate
                    await self._update_job_status(job_id, "processing", progress)
                    
                    chunk_id += 1
                    yield chunk_result
                    
                    # Cleanup
                    del chunk_df
                    
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error processing Excel file: {str(e)}"
            )
    
    async def _update_job_status(
        self, 
        job_id: str, 
        status: str, 
        progress: float, 
        error: Optional[str] = None
    ):
        """Update job status in Redis"""
        
        job_data = {
            'status': status,
            'progress': progress,
            'updated_at': datetime.utcnow().isoformat(),
            'error': error or ''
        }
        
        redis_client.hset(f"streaming_job:{job_id}", mapping=job_data)
        redis_client.expire(f"streaming_job:{job_id}", 3600)  # 1 hour TTL
    
    async def _cache_chunk_result(self, job_id: str, chunk_id: int, result: ChunkResult):
        """Cache chunk result for real-time access"""
        
        redis_client.setex(
            f"chunk_result:{job_id}:{chunk_id}",
            1800,  # 30 minutes TTL
            result.json()
        )

# Initialize processor
streaming_processor = StreamingDataProcessor()

# ==================== STREAMING ENDPOINTS ====================

@router.post("/stream/upload", response_model=Dict[str, str])
async def initiate_streaming_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    options: str = "{}",  # JSON string of options
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🚀 INITIATE STREAMING FILE PROCESSING
    
    Starts streaming processing of uploaded file with real-time progress updates.
    """
    
    try:
        # Parse options
        processing_options = json.loads(options) if options else {}
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file size (max 10GB for streaming)
        max_size = 10 * 1024 * 1024 * 1024  # 10GB
        if file.size and file.size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File too large. Maximum size is 10GB."
            )
        
        # Create job record
        job_id = str(uuid.uuid4())
        
        # Create data investigation record
        investigation = DataInvestigation(
            id=job_id,
            name=f"Streaming Analysis: {file.filename}",
            description=f"Streaming analysis of {file.filename}",
            created_by_id=current_user.id,
            data_source_type="stream",
            status=JobStatus.PENDING,
            original_file_path=file.filename,
            created_at=datetime.utcnow()
        )
        
        db.add(investigation)
        await db.commit()
        
        # Initialize job status in Redis
        await streaming_processor._update_job_status(job_id, "initialized", 0.0)
        
        # Start background streaming processing
        background_tasks.add_task(
            process_stream_background,
            file=file,
            job_id=job_id,
            user_id=str(current_user.id),
            options=processing_options,
            db=db
        )
        
        return {
            "job_id": job_id,
            "status": "initialized",
            "message": "Streaming processing initiated",
            "websocket_url": f"/stream/progress/{job_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Streaming upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate streaming processing"
        )

@router.websocket("/stream/progress/{job_id}")
async def stream_progress_websocket(
    websocket: WebSocket,
    job_id: str
):
    """
    📡 REAL-TIME PROGRESS UPDATES
    
    WebSocket endpoint for real-time streaming progress updates.
    """
    
    await websocket.accept()
    
    try:
        while True:
            # Get current job status
            job_data = redis_client.hgetall(f"streaming_job:{job_id}")
            
            if job_data:
                status_update = {
                    "job_id": job_id,
                    "status": job_data.get("status", "unknown"),
                    "progress": float(job_data.get("progress", 0)),
                    "updated_at": job_data.get("updated_at"),
                    "error": job_data.get("error", "")
                }
                
                await websocket.send_json(status_update)
                
                # Check if job is complete
                if job_data.get("status") in ["completed", "failed"]:
                    break
            
            # Wait before next update
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for job {job_id}")
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}")
        await websocket.close()

@router.get("/stream/status/{job_id}", response_model=StreamingStatus)
async def get_streaming_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current streaming processing status"""
    
    # Get job data from Redis
    job_data = redis_client.hgetall(f"streaming_job:{job_id}")
    
    if not job_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Streaming job not found"
        )
    
    # Get chunk count
    chunk_keys = redis_client.keys(f"chunk_result:{job_id}:*")
    
    return StreamingStatus(
        job_id=job_id,
        status=job_data.get("status", "unknown"),
        progress=float(job_data.get("progress", 0)),
        processed_rows=int(job_data.get("processed_rows", 0)),
        total_rows=int(job_data.get("total_rows", 0)) if job_data.get("total_rows") else None,
        current_chunk=len(chunk_keys),
        insights_found=int(job_data.get("insights_found", 0)),
        quality_score=float(job_data.get("quality_score", 0)) if job_data.get("quality_score") else None
    )

@router.get("/stream/results/{job_id}")
async def get_streaming_results(
    job_id: str,
    chunk_id: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """
    📊 GET STREAMING RESULTS
    
    Retrieve processing results - either specific chunk or consolidated results.
    """
    
    if chunk_id is not None:
        # Get specific chunk result
        chunk_data = redis_client.get(f"chunk_result:{job_id}:{chunk_id}")
        
        if not chunk_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chunk {chunk_id} not found for job {job_id}"
            )
        
        return json.loads(chunk_data)
    
    else:
        # Get consolidated results
        job_data = redis_client.hgetall(f"streaming_job:{job_id}")
        
        if not job_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Streaming job not found"
            )
        
        # Get all chunk results
        chunk_keys = redis_client.keys(f"chunk_result:{job_id}:*")
        all_chunks = []
        
        for key in chunk_keys:
            chunk_data = redis_client.get(key)
            if chunk_data:
                all_chunks.append(json.loads(chunk_data))
        
        # Consolidate results
        consolidated_insights = []
        total_rows = 0
        
        for chunk in all_chunks:
            consolidated_insights.extend(chunk.get('insights', []))
            total_rows += chunk.get('rows_processed', 0)
        
        return {
            "job_id": job_id,
            "status": job_data.get("status"),
            "total_chunks": len(all_chunks),
            "total_rows": total_rows,
            "consolidated_insights": consolidated_insights,
            "quality_score": float(job_data.get("quality_score", 0)) if job_data.get("quality_score") else None
        }

# ==================== BACKGROUND TASKS ====================

async def process_stream_background(
    file: UploadFile,
    job_id: str,
    user_id: str,
    options: Dict[str, Any],
    db: AsyncSession
):
    """Background task for streaming processing"""
    
    try:
        # Reset file pointer
        await file.seek(0)
        
        total_insights = []
        total_rows = 0
        chunk_count = 0
        
        # Process file stream
        async for chunk_result in streaming_processor.process_file_stream(
            file, job_id, user_id, options
        ):
            total_insights.extend(chunk_result.insights)
            total_rows += chunk_result.rows_processed
            chunk_count += 1
        
        # Calculate final quality score
        final_quality_score = sum(
            insight.get('confidence', 0) for insight in total_insights
        ) / len(total_insights) if total_insights else 0.0
        
        # Update final job status
        final_job_data = {
            'status': 'completed',
            'progress': 100.0,
            'total_rows': total_rows,
            'total_chunks': chunk_count,
            'insights_found': len(total_insights),
            'quality_score': final_quality_score,
            'completed_at': datetime.utcnow().isoformat()
        }
        
        redis_client.hset(f"streaming_job:{job_id}", mapping=final_job_data)
        
        # Update database record
        investigation = await db.get(DataInvestigation, job_id)
        if investigation:
            investigation.status = JobStatus.COMPLETED
            investigation.quality_score = final_quality_score
            investigation.completed_at = datetime.utcnow()
            await db.commit()
        
        logger.info(f"Streaming job {job_id} completed: {total_rows} rows, {len(total_insights)} insights")
        
    except Exception as e:
        logger.error(f"Streaming background processing error: {e}")
        
        # Update job as failed
        redis_client.hset(f"streaming_job:{job_id}", mapping={
            'status': 'failed',
            'error': str(e),
            'failed_at': datetime.utcnow().isoformat()
        })
        
        # Update database record
        try:
            investigation = await db.get(DataInvestigation, job_id)
            if investigation:
                investigation.status = JobStatus.FAILED
                investigation.error_message = str(e)
                await db.commit()
        except:
            pass 