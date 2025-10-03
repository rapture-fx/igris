"""
Unified API layer for dual-mode ingestion
Automatically routes between batch and streaming based on request characteristics
"""

from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel

from app.core.logging_config import get_logger
from app.ingestion.batch_rest import router as batch_router
from app.ingestion.stream_gateway import stream_gateway
from app.hybrid_kernels.rust_bridge import rust_bridge
from app.hybrid_kernels.ml_adapters import UnifiedMLAdapter
from app.core.metrics import metrics_collector

logger = get_logger(__name__)

router = APIRouter()


class IngestionMode(str, Enum):
    """Ingestion mode selection"""
    AUTO = "auto"
    BATCH = "batch"
    STREAM = "stream"


class UnifiedIngestionRequest(BaseModel):
    """Unified ingestion request that works for both batch and streaming"""
    mode: IngestionMode = IngestionMode.AUTO
    dataset_name: str
    format: Optional[str] = "csv"
    target_framework: Optional[str] = None  # sklearn, tensorflow, pytorch, huggingface
    preprocessing_options: Optional[Dict[str, Any]] = None


class UnifiedAPIGateway:
    """
    Intelligent gateway that routes requests to batch or streaming
    based on data characteristics and user preferences
    """

    @staticmethod
    def detect_optimal_mode(
        content_length: Optional[int],
        is_realtime: bool = False,
        user_preference: IngestionMode = IngestionMode.AUTO
    ) -> str:
        """
        Detect optimal ingestion mode based on request characteristics

        Args:
            content_length: Request content length in bytes
            is_realtime: Whether real-time processing is required
            user_preference: User's mode preference

        Returns:
            "batch" or "stream"
        """
        # Respect explicit user preference
        if user_preference != IngestionMode.AUTO:
            return user_preference.value

        # Auto-detection logic
        if is_realtime:
            return "stream"

        # Threshold: >10MB → batch, ≤10MB → stream for low latency
        if content_length and content_length > 10 * 1024 * 1024:
            return "batch"

        return "stream"

    @staticmethod
    async def process_unified(
        request: UnifiedIngestionRequest,
        file_data: Optional[bytes] = None,
        stream_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process data through unified pipeline

        Args:
            request: Unified ingestion request
            file_data: File bytes for batch mode
            stream_data: Stream message for streaming mode

        Returns:
            Processing result with framework-specific data if requested
        """
        mode = request.mode.value if request.mode != IngestionMode.AUTO else "batch"

        if mode == "batch" and file_data:
            # Batch processing
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{request.format}") as tmp:
                tmp.write(file_data)
                tmp_path = tmp.name

            # Process via Rust bridge
            result = await rust_bridge.load_dataset(tmp_path, request.format or "csv")

            # Convert to target ML framework if specified
            if request.target_framework:
                framework_data = UnifiedMLAdapter.from_arrow(
                    result,
                    framework=request.target_framework
                )
                return {
                    "mode": "batch",
                    "dataset_name": request.dataset_name,
                    "rows": result.num_rows,
                    "columns": result.num_columns,
                    "framework": request.target_framework,
                    "data": str(type(framework_data))  # Don't serialize large data
                }

            return {
                "mode": "batch",
                "dataset_name": request.dataset_name,
                "rows": result.num_rows,
                "columns": result.num_columns
            }

        elif mode == "stream" and stream_data:
            # Streaming processing
            await stream_gateway.publish_to_stream(
                stream_name=request.dataset_name,
                data=stream_data
            )

            return {
                "mode": "stream",
                "dataset_name": request.dataset_name,
                "status": "published"
            }

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode or missing data: mode={mode}"
            )


@router.post("/unified/ingest")
async def unified_ingestion(request: Request, ingestion_req: UnifiedIngestionRequest):
    """
    Unified ingestion endpoint - automatically routes to batch or streaming

    This endpoint intelligently selects between batch and streaming based on:
    - User preference (mode parameter)
    - Data size (auto-detection)
    - Real-time requirements
    """
    try:
        # Get request metadata
        content_length = request.headers.get("content-length")
        is_realtime = request.headers.get("x-realtime", "false").lower() == "true"

        # Detect optimal mode
        mode = UnifiedAPIGateway.detect_optimal_mode(
            content_length=int(content_length) if content_length else None,
            is_realtime=is_realtime,
            user_preference=ingestion_req.mode
        )

        logger.info(
            f"Unified ingestion: mode={mode}, dataset={ingestion_req.dataset_name}, "
            f"size={content_length}, realtime={is_realtime}"
        )

        # Record mode selection metrics
        metrics_collector.record_business_event(
            "unified_ingestion_mode_selected",
            metadata={
                "mode": mode,
                "dataset_name": ingestion_req.dataset_name,
                "auto_detected": ingestion_req.mode == IngestionMode.AUTO
            }
        )

        # Route to appropriate handler
        if mode == "batch":
            # Read request body for batch processing
            body = await request.body()
            result = await UnifiedAPIGateway.process_unified(
                request=ingestion_req,
                file_data=body
            )
        else:
            # For streaming, expect JSON message in body
            stream_msg = await request.json()
            result = await UnifiedAPIGateway.process_unified(
                request=ingestion_req,
                stream_data=stream_msg
            )

        return {
            "success": True,
            "selected_mode": mode,
            "result": result
        }

    except Exception as e:
        logger.error(f"Unified ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unified/status")
async def unified_status():
    """Get status of unified ingestion system"""
    try:
        # Check Rust kernels availability
        rust_available = rust_bridge.rust_kernels is not None

        # Check streaming availability
        streaming_available = stream_gateway.nats_client is not None or stream_gateway.zmq_context is not None

        return {
            "status": "operational",
            "components": {
                "rust_kernels": "available" if rust_available else "fallback",
                "batch_ingestion": "available",
                "streaming": "available" if streaming_available else "unavailable",
                "ml_frameworks": UnifiedMLAdapter.list_supported_frameworks()
            },
            "memory_optimization_target": "70-80% reduction vs pandas",
            "supported_formats": ["csv", "parquet", "json", "avro", "excel"]
        }

    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
