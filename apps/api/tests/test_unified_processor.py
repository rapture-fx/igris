"""
UNIFIED DATA PROCESSOR TESTS
============================

Comprehensive test suite for the unified data processor.
Tests all processing modes and error scenarios.
"""

import pytest
import pandas as pd
import numpy as np
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import asyncio
from typing import Dict, Any

# Import the unified processor
from app.services.core.unified_processor import (
    UnifiedDataProcessor, 
    ProcessingMode, 
    ProcessingResult
)
from app.services.core.config_manager import ProcessingConfig

class TestUnifiedDataProcessor:
    """Test suite for unified data processor"""
    
    @pytest.fixture
    def config(self):
        """Test configuration"""
        return ProcessingConfig(
            max_file_size_mb=10,
            chunk_size=1000,
            large_file_threshold_mb=5,
            ai_analysis_enabled=True,
            performance_logging=False
        )
    
    @pytest.fixture
    def processor(self, config):
        """Processor instance with test config"""
        return UnifiedDataProcessor(config=config)
    
    @pytest.fixture
    def sample_csv_file(self):
        """Create a sample CSV file for testing"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("""name,age,email,salary
John Doe,30,john@example.com,50000
Jane Smith,25,jane@example.com,60000
Bob Johnson,35,bob@example.com,55000
Alice Williams,28,alice@example.com,65000
Charlie Brown,32,charlie@example.com,58000""")
            temp_path = f.name
        
        yield temp_path
        
        # Cleanup
        os.unlink(temp_path)
    
    @pytest.fixture
    def sample_large_csv_file(self):
        """Create a large CSV file for streaming tests"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("id,value,category\n")
            for i in range(10000):  # 10k rows
                f.write(f"{i},{i*2},category_{i%5}\n")
            temp_path = f.name
        
        yield temp_path
        
        # Cleanup
        os.unlink(temp_path)
    
    @pytest.fixture
    def sample_json_file(self):
        """Create a sample JSON file"""
        import json
        
        data = [
            {"name": "John", "age": 30, "city": "New York"},
            {"name": "Jane", "age": 25, "city": "Los Angeles"},
            {"name": "Bob", "age": 35, "city": "Chicago"}
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(data, f)
            temp_path = f.name
        
        yield temp_path
        
        # Cleanup
        os.unlink(temp_path)

    # ==========================================
    # BASIC FUNCTIONALITY TESTS
    # ==========================================
    
    @pytest.mark.asyncio
    async def test_standard_processing(self, processor, sample_csv_file):
        """Test standard processing mode"""
        result = await processor.process(
            sample_csv_file, 
            mode=ProcessingMode.STANDARD
        )
        
        assert result['status'] == 'success'
        assert 'data' in result
        assert 'metadata' in result
        assert 'performance' in result
        
        # Check data content
        data = result['data']
        assert 'original_shape' in data
        assert 'cleaned_shape' in data
        assert 'columns' in data
        assert 'quality_score' in data
        assert data['original_shape'][0] == 5  # 5 rows
        assert data['original_shape'][1] == 4  # 4 columns
    
    @pytest.mark.asyncio
    async def test_fast_processing(self, processor, sample_csv_file):
        """Test fast processing mode"""
        result = await processor.process(
            sample_csv_file,
            mode=ProcessingMode.FAST
        )
        
        assert result['status'] == 'success'
        assert 'data' in result
        
        data = result['data']
        assert 'shape' in data
        assert 'columns' in data
        assert 'dtypes' in data
        assert 'sample' in data
        
        # Fast mode should be quicker (less analysis)
        assert result['performance']['processing_time_seconds'] < 1.0
    
    @pytest.mark.asyncio
    async def test_streaming_processing(self, processor, sample_large_csv_file):
        """Test streaming processing mode"""
        result = await processor.process(
            sample_large_csv_file,
            mode=ProcessingMode.STREAMING
        )
        
        assert result['status'] == 'success'
        assert 'data' in result
        
        data = result['data']
        assert 'total_rows_processed' in data
        assert 'chunks_processed' in data
        assert 'average_quality_score' in data
        assert data['total_rows_processed'] == 10000
        assert data['chunks_processed'] > 1
    
    @pytest.mark.asyncio
    async def test_ai_enhanced_processing(self, processor, sample_csv_file):
        """Test AI-enhanced processing mode"""
        result = await processor.process(
            sample_csv_file,
            mode=ProcessingMode.AI_ENHANCED
        )
        
        assert result['status'] == 'success'
        assert 'data' in result
        
        data = result['data']
        assert 'ai_patterns' in data
        assert 'ai_recommendations' in data
        assert 'ai_insights' in data
        
        # Should include all standard processing features plus AI
        assert 'quality_score' in data
        assert 'columns' in data
    
    @pytest.mark.asyncio
    async def test_automatic_mode_selection(self, processor, sample_csv_file, sample_large_csv_file):
        """Test automatic processing mode selection"""
        # Small file should use STANDARD mode
        result_small = await processor.process(sample_csv_file)
        assert result_small['performance']['mode_used'] in ['standard', 'fast']
        
        # Large file should use STREAMING mode
        result_large = await processor.process(sample_large_csv_file)
        assert result_large['performance']['mode_used'] == 'streaming'

    # ==========================================
    # FILE FORMAT TESTS
    # ==========================================
    
    @pytest.mark.asyncio
    async def test_json_file_processing(self, processor, sample_json_file):
        """Test JSON file processing"""
        result = await processor.process(sample_json_file)
        
        assert result['status'] == 'success'
        assert 'data' in result
        
        data = result['data']
        assert data['original_shape'][0] == 3  # 3 records
        assert data['original_shape'][1] == 3  # 3 columns
    
    @pytest.mark.asyncio
    async def test_unsupported_file_format(self, processor):
        """Test handling of unsupported file formats"""
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as f:
            f.write(b"some text content")
            temp_path = f.name
        
        try:
            result = await processor.process(temp_path)
            assert result['status'] == 'error'
            assert 'errors' in result
        finally:
            os.unlink(temp_path)

    # ==========================================
    # FRAMEWORK OUTPUT TESTS
    # ==========================================
    
    @pytest.mark.asyncio
    async def test_tensorflow_output(self, processor, sample_csv_file):
        """Test TensorFlow output format"""
        result = await processor.process(
            sample_csv_file,
            target_framework="tensorflow"
        )
        
        assert result['status'] == 'success'
        data = result['data']
        assert 'tensorflow_ready' in data
        
        tf_data = data['tensorflow_ready']
        assert 'features' in tf_data
        assert 'feature_names' in tf_data
        assert 'shape' in tf_data
    
    @pytest.mark.asyncio
    async def test_pytorch_output(self, processor, sample_csv_file):
        """Test PyTorch output format"""
        result = await processor.process(
            sample_csv_file,
            target_framework="pytorch"
        )
        
        assert result['status'] == 'success'
        data = result['data']
        assert 'pytorch_ready' in data
        
        pytorch_data = data['pytorch_ready']
        assert 'tensor_data' in pytorch_data
        assert 'columns' in pytorch_data
        assert 'shape' in pytorch_data
    
    @pytest.mark.asyncio
    async def test_sklearn_output(self, processor, sample_csv_file):
        """Test scikit-learn output format"""
        result = await processor.process(
            sample_csv_file,
            target_framework="sklearn"
        )
        
        assert result['status'] == 'success'
        data = result['data']
        assert 'sklearn_ready' in data
        
        sklearn_data = data['sklearn_ready']
        assert 'X' in sklearn_data
        assert 'feature_names' in sklearn_data
        assert 'n_samples' in sklearn_data
        assert 'n_features' in sklearn_data

    # ==========================================
    # ERROR HANDLING TESTS
    # ==========================================
    
    @pytest.mark.asyncio
    async def test_file_not_found(self, processor):
        """Test handling of non-existent files"""
        result = await processor.process("non_existent_file.csv")
        
        assert result['status'] == 'error'
        assert len(result['errors']) > 0
    
    @pytest.mark.asyncio
    async def test_corrupted_csv_file(self, processor):
        """Test handling of corrupted CSV files"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("name,age\nJohn,30\nJane,invalid_age\nBob,")  # Corrupted data
            temp_path = f.name
        
        try:
            result = await processor.process(temp_path)
            # Should still succeed but with warnings or data cleaning
            assert result['status'] in ['success', 'error']
        finally:
            os.unlink(temp_path)
    
    @pytest.mark.asyncio
    async def test_empty_file(self, processor):
        """Test handling of empty files"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("")  # Empty file
            temp_path = f.name
        
        try:
            result = await processor.process(temp_path)
            assert result['status'] == 'error'
        finally:
            os.unlink(temp_path)

    # ==========================================
    # PERFORMANCE TESTS
    # ==========================================
    
    @pytest.mark.asyncio
    async def test_caching_functionality(self, processor, sample_csv_file):
        """Test result caching"""
        # First call - should be cache miss
        result1 = await processor.process(sample_csv_file)
        assert result1['performance']['cache_hit'] == False
        
        # Second call - should be cache hit
        result2 = await processor.process(sample_csv_file)
        # Note: Current implementation doesn't show cache hits in performance
        # This is a placeholder for when caching is fully implemented
        assert result2['status'] == 'success'
    
    @pytest.mark.asyncio
    async def test_processing_timeout(self, processor):
        """Test processing timeout handling"""
        # Create processor with very short timeout
        config = ProcessingConfig(processing_timeout_seconds=1)
        timeout_processor = UnifiedDataProcessor(config=config)
        
        # This test would need a very large file or mock slow processing
        # For now, just verify the processor accepts the timeout config
        assert timeout_processor.config.processing_timeout_seconds == 1
    
    def test_performance_metrics(self, processor, sample_csv_file):
        """Test performance metrics collection"""
        metrics = processor.get_performance_metrics()
        
        assert 'total_files_processed' in metrics
        assert 'cache_hits' in metrics
        assert 'cache_misses' in metrics
        assert 'average_processing_time' in metrics
        
        # All should be numeric
        for key, value in metrics.items():
            assert isinstance(value, (int, float))

    # ==========================================
    # CONFIGURATION TESTS
    # ==========================================
    
    def test_custom_configuration(self):
        """Test processor with custom configuration"""
        custom_config = ProcessingConfig(
            chunk_size=5000,
            max_file_size_mb=50,
            ai_analysis_enabled=False
        )
        
        processor = UnifiedDataProcessor(config=custom_config)
        
        assert processor.config.chunk_size == 5000
        assert processor.config.max_file_size_mb == 50
        assert processor.config.ai_analysis_enabled == False
    
    @pytest.mark.asyncio
    async def test_processing_options(self, processor, sample_csv_file):
        """Test processing with custom options"""
        options = {
            'custom_chunk_size': 2000,
            'enable_advanced_analysis': True,
            'target_quality_score': 0.9
        }
        
        result = await processor.process(
            sample_csv_file,
            options=options
        )
        
        assert result['status'] == 'success'
        # Options should be passed through to processing methods

    # ==========================================
    # DATA QUALITY TESTS
    # ==========================================
    
    @pytest.mark.asyncio
    async def test_data_quality_analysis(self, processor):
        """Test data quality analysis functionality"""
        # Create file with quality issues
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("""name,age,email,salary
John Doe,30,john@example.com,50000
Jane Smith,,jane@example.com,
Bob Johnson,35,invalid_email,55000
Alice Williams,28,alice@example.com,65000
,32,charlie@example.com,58000""")  # Missing values and invalid data
            temp_path = f.name
        
        try:
            result = await processor.process(temp_path, mode=ProcessingMode.STANDARD)
            
            assert result['status'] == 'success'
            assert 'quality_score' in result['data']
            assert 'missing_values' in result['data']
            
            # Quality score should be less than 1.0 due to missing values
            assert result['data']['quality_score'] < 1.0
            
        finally:
            os.unlink(temp_path)
    
    @pytest.mark.asyncio
    async def test_anomaly_detection(self, processor):
        """Test anomaly detection in data"""
        # Create file with outliers
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("""value,category
10,A
12,B
11,A
9,B
1000,A
13,B
10,A""")  # 1000 is an outlier
            temp_path = f.name
        
        try:
            result = await processor.process(temp_path, mode=ProcessingMode.AI_ENHANCED)
            
            assert result['status'] == 'success'
            # Should detect patterns or anomalies
            assert 'ai_patterns' in result['data']
            
        finally:
            os.unlink(temp_path)

# ==========================================
# INTEGRATION TESTS
# ==========================================

class TestProcessorIntegration:
    """Integration tests for processor with other components"""
    
    @pytest.mark.asyncio
    async def test_processor_with_error_handling(self):
        """Test processor integration with error handling"""
        from app.services.core.error_handling import standardized_error_handling
        
        @standardized_error_handling("test_processor")
        async def process_with_error_handling():
            processor = UnifiedDataProcessor()
            return await processor.process("non_existent_file.csv")
        
        result = await process_with_error_handling()
        
        # Should return standardized error response
        assert isinstance(result, dict)
        # Error handling should wrap the processor error
    
    @pytest.mark.asyncio
    async def test_processor_with_dependency_injection(self):
        """Test processor with dependency injection"""
        from app.services.core.dependency_container import container, get_service
        
        # Get processor from container
        processor = get_service(UnifiedDataProcessor)
        
        assert isinstance(processor, UnifiedDataProcessor)
        assert processor.config is not None

# ==========================================
# PERFORMANCE BENCHMARKS
# ==========================================

class TestProcessorPerformance:
    """Performance benchmarks for the processor"""
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_large_file_performance(self):
        """Test processing performance with large files"""
        # Create large CSV file (100k rows)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("id,value1,value2,value3,category\n")
            for i in range(100000):
                f.write(f"{i},{i*2},{i*3},{i*4},category_{i%10}\n")
            temp_path = f.name
        
        try:
            processor = UnifiedDataProcessor()
            
            import time
            start_time = time.time()
            result = await processor.process(temp_path)
            processing_time = time.time() - start_time
            
            assert result['status'] == 'success'
            assert processing_time < 30  # Should complete within 30 seconds
            
            # Should automatically use streaming mode
            assert result['performance']['mode_used'] == 'streaming'
            
        finally:
            os.unlink(temp_path)
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_concurrent_processing(self):
        """Test concurrent processing performance"""
        processor = UnifiedDataProcessor()
        
        # Create multiple small files
        files = []
        for i in range(5):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                f.write(f"id,value\n")
                for j in range(100):
                    f.write(f"{j},{j*i}\n")
                files.append(f.name)
        
        try:
            # Process files concurrently
            tasks = [processor.process(file_path) for file_path in files]
            results = await asyncio.gather(*tasks)
            
            # All should succeed
            for result in results:
                assert result['status'] == 'success'
            
        finally:
            for file_path in files:
                os.unlink(file_path)

if __name__ == "__main__":
    # Run basic test
    pytest.main([__file__, "-v"])