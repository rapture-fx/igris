"""
HIGH-PERFORMANCE DATA PREPARATION API
====================================

Optimized endpoints using the unified data processor for maximum performance.
Features automatic mode selection, caching, and streaming for large files.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional, List
import tempfile
import os
import asyncio
import logging
from pathlib import Path
from datetime import datetime

from app.services.unified_data_processor import (
    unified_processor, 
    process_data_high_performance,
    ProcessingMode
)

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/prepare", 
    summary="🚀 High-Performance Data Preparation",
    description="Upload and prepare data with automatic optimization for maximum performance")
async def prepare_data_endpoint(
    file: UploadFile = File(...),
    target_framework: str = Query("pandas", description="Target AI framework"),
    processing_mode: Optional[str] = Query(None, description="Processing mode: fast, standard, streaming, ai_enhanced"),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> Dict[str, Any]:
    """
    High-performance data preparation endpoint.
    
    Features:
    - Automatic mode selection for optimal performance
    - Result caching for repeated requests
    - Memory-efficient streaming for large files
    - Real-time performance monitoring
    """
    
    start_time = datetime.utcnow()
    temp_file_path = None
    
    try:
        logger.info(f"🚀 Starting high-performance preparation for: {file.filename}")
        
        # Validate file format
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        file_extension = Path(file.filename).suffix.lower().lstrip('.')
        if file_extension not in unified_processor.supported_formats:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported format: {file_extension}. Supported: {unified_processor.supported_formats}"
            )
        
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            temp_file_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        # Convert processing mode string to enum
        mode = None
        if processing_mode:
            try:
                mode = ProcessingMode(processing_mode.lower())
            except ValueError:
                logger.warning(f"Invalid processing mode: {processing_mode}, using auto-selection")
        
        # Process with high-performance engine
        result = await process_data_high_performance(
            file_path=temp_file_path,
            target_framework=target_framework,
            mode=mode,
            options={"original_filename": file.filename}
        )
        
        # Add API metadata
        result.update({
            "api_version": "v1",
            "endpoint": "/prepare",
            "original_filename": file.filename,
            "request_timestamp": start_time.isoformat(),
            "response_timestamp": datetime.utcnow().isoformat()
        })
        
        # Schedule cleanup in background
        background_tasks.add_task(cleanup_temp_file, temp_file_path)
        
        # Log performance metrics
        if result.get('performance'):
            perf = result['performance']
            logger.info(
                f"✅ Preparation completed: {file.filename} | "
                f"Mode: {perf.get('mode_used')} | "
                f"Time: {perf.get('processing_time_seconds')}s | "
                f"Memory: {perf.get('memory_usage_mb')}MB"
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Preparation failed for {file.filename}: {e}")
        
        # Cleanup on error
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Data preparation failed",
                "message": str(e),
                "filename": file.filename,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@router.post("/analyze",
    summary="⚡ Quick Data Analysis", 
    description="Fast analysis without full preparation - optimized for speed")
async def analyze_data_endpoint(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> Dict[str, Any]:
    """
    Quick data analysis endpoint using FAST mode for immediate insights.
    
    Perfect for:
    - Data quality checks
    - Quick file validation
    - Preliminary analysis
    """
    
    temp_file_path = None
    
    try:
        logger.info(f"⚡ Starting quick analysis for: {file.filename}")
        
        # Validate and save file
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        file_extension = Path(file.filename).suffix.lower().lstrip('.')
        if file_extension not in unified_processor.supported_formats:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported format: {file_extension}"
            )
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            temp_file_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        # Force FAST mode for quick analysis
        result = await process_data_high_performance(
            file_path=temp_file_path,
            target_framework="pandas",
            mode=ProcessingMode.FAST,
            options={"original_filename": file.filename}
        )
        
        # Add analysis-specific metadata
        result.update({
            "analysis_type": "quick",
            "endpoint": "/analyze",
            "original_filename": file.filename,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Schedule cleanup
        background_tasks.add_task(cleanup_temp_file, temp_file_path)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Analysis failed for {file.filename}: {e}")
        
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Data analysis failed",
                "message": str(e),
                "filename": file.filename
            }
        )

@router.get("/frameworks",
    summary="📋 Supported AI Frameworks",
    description="List all supported AI frameworks and their capabilities")
async def get_supported_frameworks() -> Dict[str, Any]:
    """Get list of supported AI frameworks with their capabilities."""
    
    frameworks = {
        "pandas": {
            "name": "Pandas",
            "description": "Python data analysis library",
            "capabilities": ["data_cleaning", "analysis", "transformation"],
            "output_format": "DataFrame",
            "best_for": "General data analysis and cleaning"
        },
        "scikit-learn": {
            "name": "Scikit-Learn",
            "description": "Machine learning library for Python",
            "capabilities": ["preprocessing", "feature_engineering", "ml_ready"],
            "output_format": "NumPy arrays",
            "best_for": "Traditional machine learning"
        },
        "pytorch": {
            "name": "PyTorch",
            "description": "Deep learning framework",
            "capabilities": ["tensor_conversion", "deep_learning", "gpu_support"],
            "output_format": "PyTorch tensors",
            "best_for": "Deep learning and neural networks"
        },
        "tensorflow": {
            "name": "TensorFlow",
            "description": "End-to-end machine learning platform",
            "capabilities": ["tensor_conversion", "deep_learning", "production_ready"],
            "output_format": "TensorFlow tensors",
            "best_for": "Production ML and deep learning"
        }
    }
    
    return {
        "supported_frameworks": frameworks,
        "total_count": len(frameworks),
        "default_framework": "pandas",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/performance",
    summary="📊 Performance Statistics",
    description="Get real-time performance metrics and system status")
async def get_performance_stats() -> Dict[str, Any]:
    """Get current performance statistics from the unified processor."""
    
    try:
        stats = unified_processor.get_performance_stats()
        
        return {
            "status": "active",
            "performance_metrics": stats,
            "system_info": {
                "supported_formats": unified_processor.supported_formats,
                "cache_enabled": True,
                "streaming_enabled": True,
                "ai_enhanced_available": True
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting performance stats: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.post("/benchmark",
    summary="🏃‍♂️ Performance Benchmark",
    description="Run performance benchmark with test data")
async def run_benchmark(
    mode: str = Query("all", description="Benchmark mode: fast, standard, streaming, ai_enhanced, or all")
) -> Dict[str, Any]:
    """
    Run performance benchmark to test system capabilities.
    
    Useful for:
    - System performance validation
    - Optimal mode selection testing
    - Performance regression testing
    """
    
    try:
        logger.info(f"🏃‍♂️ Starting performance benchmark: {mode}")
        
        # Create test data
        import pandas as pd
        import numpy as np
        
        # Generate test dataset
        np.random.seed(42)
        test_data = pd.DataFrame({
            'id': range(1000),
            'numeric_col': np.random.randn(1000),
            'category_col': np.random.choice(['A', 'B', 'C'], 1000),
            'text_col': [f"text_{i}" for i in range(1000)],
            'email_col': [f"user{i}@example.com" for i in range(1000)]
        })
        
        # Add some missing values
        test_data.loc[np.random.choice(1000, 50), 'numeric_col'] = np.nan
        test_data.loc[np.random.choice(1000, 30), 'email_col'] = None
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as temp_file:
            test_file_path = temp_file.name
            test_data.to_csv(temp_file.name, index=False)
        
        benchmark_results = {}
        
        # Test different modes
        modes_to_test = []
        if mode == "all":
            modes_to_test = [ProcessingMode.FAST, ProcessingMode.STANDARD, ProcessingMode.STREAMING, ProcessingMode.AI_ENHANCED]
        else:
            try:
                modes_to_test = [ProcessingMode(mode.lower())]
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid benchmark mode: {mode}")
        
        for test_mode in modes_to_test:
            start_time = datetime.utcnow()
            
            result = await process_data_high_performance(
                file_path=test_file_path,
                target_framework="pandas",
                mode=test_mode,
                options={"benchmark": True}
            )
            
            end_time = datetime.utcnow()
            
            benchmark_results[test_mode.value] = {
                "status": result.get("status"),
                "processing_time": result.get("performance", {}).get("processing_time_seconds"),
                "memory_usage": result.get("performance", {}).get("memory_usage_mb"),
                "data_quality_score": result.get("data_quality_score"),
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        
        # Cleanup
        try:
            os.unlink(test_file_path)
        except:
            pass
        
        return {
            "benchmark_results": benchmark_results,
            "test_data_info": {
                "rows": len(test_data),
                "columns": len(test_data.columns),
                "size_mb": round(test_data.memory_usage(deep=True).sum() / (1024 * 1024), 2)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Benchmark failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Benchmark failed",
                "message": str(e)
            }
        )

async def cleanup_temp_file(file_path: str):
    """Background task to cleanup temporary files."""
    try:
        if os.path.exists(file_path):
            os.unlink(file_path)
            logger.debug(f"🗑️ Cleaned up temporary file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file {file_path}: {e}")

# Health check for the preparation service
@router.get("/health",
    summary="💚 Service Health Check",
    description="Check if the data preparation service is healthy")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for the data preparation service."""
    
    try:
        # Quick system check
        stats = unified_processor.get_performance_stats()
        
        return {
            "status": "healthy",
            "service": "data_preparation",
            "version": "2.0.0-high-performance",
            "uptime_files_processed": stats.get("total_files_processed", 0),
            "average_processing_time": stats.get("average_processing_time", 0),
            "cache_hit_rate": stats.get("cache_hit_rate", 0),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
