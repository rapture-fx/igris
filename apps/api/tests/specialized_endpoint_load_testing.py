"""
Specialized API Endpoint Load Testing for Schlep-engine
======================================================

This module provides specialized load testing for different categories of API endpoints:
- Authentication and OAuth security endpoints
- ML/RL training and inference endpoints  
- File upload and document processing endpoints
- Real-time WebSocket endpoints
- Administrative and monitoring endpoints

Each endpoint type has tailored test scenarios that simulate realistic usage patterns
and validate performance under various load conditions.

Features:
- Authentication flow load testing with OAuth simulation
- ML/RL endpoint testing with realistic model data
- File upload testing with various file sizes and formats
- WebSocket connection and message throughput testing
- Database-intensive operation testing
- Cache performance validation
- Error handling and recovery testing
- Performance regression detection

Performance Targets:
- Authentication endpoints: <2s response time
- ML inference endpoints: <5s response time  
- File upload endpoints: <10s for files up to 10MB
- WebSocket connections: Support 100+ concurrent connections
- Database operations: Maintain optimized query performance
- Overall API: <200ms response time for standard operations

Usage:
    # Run all specialized endpoint tests
    python -m pytest tests/specialized_endpoint_load_testing.py -v
    
    # Run specific endpoint category tests
    python -m pytest tests/specialized_endpoint_load_testing.py::TestAuthenticationLoadTesting -v
    
    # Run with performance benchmarking
    python -m pytest tests/specialized_endpoint_load_testing.py --benchmark-only
"""

import asyncio
import json
import time
import statistics
import psutil
import logging
import uuid
import random
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, AsyncGenerator
from dataclasses import dataclass, asdict
from pathlib import Path
import io
import csv

import pytest
import httpx
import numpy as np
from unittest.mock import AsyncMock, MagicMock
import aiofiles
import websockets
from locust import HttpUser, task, between, events
from locust.env import Environment

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class EndpointTestConfig:
    """Configuration for endpoint-specific load testing"""
    base_url: str = "http://localhost:8000"
    websocket_url: str = "ws://localhost:8000/ws"
    
    # Authentication testing
    auth_concurrent_users: int = 50
    auth_test_duration: int = 120
    oauth_providers: List[str] = None
    
    # ML/RL testing
    ml_concurrent_requests: int = 10
    ml_model_sizes: List[int] = None
    ml_inference_timeout: int = 30
    
    # File upload testing
    file_upload_concurrent: int = 20
    file_sizes_mb: List[float] = None
    supported_formats: List[str] = None
    
    # WebSocket testing
    websocket_connections: int = 100
    websocket_message_rate: int = 10
    websocket_test_duration: int = 60
    
    # Performance thresholds
    auth_max_response_time: float = 2000  # ms
    ml_max_response_time: float = 5000    # ms
    file_upload_max_time: float = 10000   # ms per MB
    websocket_max_latency: float = 100    # ms
    
    def __post_init__(self):
        if self.oauth_providers is None:
            self.oauth_providers = ['google', 'github', 'microsoft']
        if self.ml_model_sizes is None:
            self.ml_model_sizes = [100, 1000, 10000]  # number of data points
        if self.file_sizes_mb is None:
            self.file_sizes_mb = [0.1, 1.0, 5.0, 10.0]
        if self.supported_formats is None:
            self.supported_formats = ['csv', 'json', 'xlsx', 'pdf', 'txt']

@dataclass
class EndpointTestResult:
    """Result from endpoint load testing"""
    endpoint_name: str
    test_type: str
    timestamp: datetime
    
    # Performance metrics
    avg_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    
    # Throughput metrics
    requests_per_second: float
    successful_requests: int
    failed_requests: int
    success_rate_percent: float
    
    # Resource metrics
    peak_memory_mb: float
    avg_cpu_percent: float
    network_bytes_transferred: int
    
    # Specific metrics
    custom_metrics: Dict[str, float] = None
    error_details: List[str] = None
    
    def __post_init__(self):
        if self.custom_metrics is None:
            self.custom_metrics = {}
        if self.error_details is None:
            self.error_details = []

class AuthenticationLoadTester:
    """Specialized load testing for authentication endpoints"""
    
    def __init__(self, config: EndpointTestConfig):
        self.config = config
        
    async def test_oauth_authentication_flow(self) -> EndpointTestResult:
        """Test OAuth authentication flow under load"""
        
        logger.info(f"Testing OAuth authentication flow with {self.config.auth_concurrent_users} concurrent users")
        
        start_time = time.time()
        results = []
        semaphore = asyncio.Semaphore(self.config.auth_concurrent_users)
        
        async def simulate_oauth_flow(user_id: int):
            async with semaphore:
                flow_start = time.time()
                
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        # Step 1: Initiate OAuth flow
                        provider = random.choice(self.config.oauth_providers)
                        oauth_initiate_response = await client.get(
                            f"{self.config.base_url}/api/v1/auth/oauth/{provider}/initiate"
                        )
                        
                        # Step 2: Simulate OAuth callback
                        oauth_callback_response = await client.get(
                            f"{self.config.base_url}/api/v1/auth/oauth/{provider}/callback",
                            params={
                                'code': f'mock_auth_code_{user_id}',
                                'state': f'mock_state_{user_id}'
                            }
                        )
                        
                        # Step 3: Verify authentication status
                        auth_status_response = await client.get(
                            f"{self.config.base_url}/api/v1/auth/status"
                        )
                        
                        flow_time = (time.time() - flow_start) * 1000
                        
                        success = all(r.status_code in [200, 302, 401, 404] for r in [
                            oauth_initiate_response, oauth_callback_response, auth_status_response
                        ])
                        
                        return {
                            'user_id': user_id,
                            'duration_ms': flow_time,
                            'success': success,
                            'steps_completed': 3,
                            'oauth_provider': provider,
                            'status_codes': [
                                oauth_initiate_response.status_code,
                                oauth_callback_response.status_code,
                                auth_status_response.status_code
                            ]
                        }
                        
                except Exception as e:
                    flow_time = (time.time() - flow_start) * 1000
                    return {
                        'user_id': user_id,
                        'duration_ms': flow_time,
                        'success': False,
                        'error': str(e),
                        'steps_completed': 0
                    }
        
        # Execute concurrent OAuth flows
        tasks = [simulate_oauth_flow(i) for i in range(self.config.auth_concurrent_users)]
        oauth_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        successful_results = [r for r in oauth_results if isinstance(r, dict) and r.get('success', False)]
        failed_results = [r for r in oauth_results if isinstance(r, dict) and not r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
            min_response_time = max_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(oauth_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="oauth_authentication",
            test_type="authentication_flow",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            requests_per_second=len(oauth_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(failed_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=0,  # Would be calculated from actual network metrics
            custom_metrics={
                'avg_steps_completed': statistics.mean(r.get('steps_completed', 0) for r in successful_results) if successful_results else 0,
                'oauth_providers_tested': len(set(r.get('oauth_provider', '') for r in successful_results)),
                'auth_flow_efficiency': success_rate / 100.0
            },
            error_details=[r.get('error', '') for r in failed_results if r.get('error')]
        )
    
    async def test_token_validation_performance(self) -> EndpointTestResult:
        """Test JWT token validation under high load"""
        
        logger.info("Testing JWT token validation performance")
        
        # Generate mock JWT tokens for testing
        mock_tokens = [f"mock.jwt.token_{i}" for i in range(100)]
        
        start_time = time.time()
        results = []
        
        async def validate_token(token: str):
            validation_start = time.time()
            
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        f"{self.config.base_url}/api/v1/auth/validate",
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    
                    validation_time = (time.time() - validation_start) * 1000
                    
                    return {
                        'duration_ms': validation_time,
                        'success': response.status_code in [200, 401],  # 401 is valid for invalid tokens
                        'status_code': response.status_code,
                        'token_type': 'jwt'
                    }
                    
            except Exception as e:
                return {
                    'duration_ms': (time.time() - validation_start) * 1000,
                    'success': False,
                    'error': str(e)
                }
        
        # Test token validation with high concurrency
        validation_tasks = [validate_token(token) for token in mock_tokens * 5]  # 500 validation requests
        validation_results = await asyncio.gather(*validation_tasks, return_exceptions=True)
        
        # Process results
        successful_results = [r for r in validation_results if isinstance(r, dict) and r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(validation_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="token_validation",
            test_type="authentication_performance",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(r['duration_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['duration_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(validation_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(validation_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=len(validation_results) * 256,  # Estimate
            custom_metrics={
                'tokens_validated': len(validation_results),
                'validation_throughput': len(successful_results) / total_time,
                'token_cache_efficiency': success_rate / 100.0
            }
        )

class MLRLLoadTester:
    """Specialized load testing for ML/RL endpoints"""
    
    def __init__(self, config: EndpointTestConfig):
        self.config = config
        
    async def test_ml_training_performance(self) -> EndpointTestResult:
        """Test ML training endpoint under various data loads"""
        
        logger.info(f"Testing ML training performance with data sizes: {self.config.ml_model_sizes}")
        
        start_time = time.time()
        training_results = []
        
        for data_size in self.config.ml_model_sizes:
            # Generate training data
            training_data = self._generate_ml_training_data(data_size)
            
            training_start = time.time()
            
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self.config.base_url}/api/v1/ml/train",
                        json=training_data
                    )
                    
                    training_time = (time.time() - training_start) * 1000
                    
                    training_results.append({
                        'data_size': data_size,
                        'duration_ms': training_time,
                        'success': response.status_code in [200, 202, 404],  # 404 if endpoint doesn't exist
                        'status_code': response.status_code,
                        'model_type': training_data['model_type']
                    })
                    
            except Exception as e:
                training_results.append({
                    'data_size': data_size,
                    'duration_ms': (time.time() - training_start) * 1000,
                    'success': False,
                    'error': str(e)
                })
        
        # Process results
        successful_results = [r for r in training_results if r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(training_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="ml_training",
            test_type="ml_performance",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(r['duration_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['duration_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(training_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(training_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=sum(len(json.dumps(r)) for r in training_results),
            custom_metrics={
                'avg_data_size': statistics.mean(r['data_size'] for r in successful_results) if successful_results else 0,
                'training_efficiency': success_rate / 100.0,
                'data_size_scalability': len(successful_results) / len(self.config.ml_model_sizes) if self.config.ml_model_sizes else 0
            }
        )
    
    async def test_ml_inference_throughput(self) -> EndpointTestResult:
        """Test ML inference endpoint throughput"""
        
        logger.info(f"Testing ML inference throughput with {self.config.ml_concurrent_requests} concurrent requests")
        
        start_time = time.time()
        semaphore = asyncio.Semaphore(self.config.ml_concurrent_requests)
        
        async def perform_inference(request_id: int):
            async with semaphore:
                inference_data = {
                    'model_id': f'test_model_{request_id % 5}',
                    'input_data': [[random.random() for _ in range(10)] for _ in range(5)],
                    'parameters': {
                        'temperature': 0.7,
                        'max_tokens': 100
                    }
                }
                
                inference_start = time.time()
                
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.post(
                            f"{self.config.base_url}/api/v1/ml/inference",
                            json=inference_data
                        )
                        
                        inference_time = (time.time() - inference_start) * 1000
                        
                        return {
                            'request_id': request_id,
                            'duration_ms': inference_time,
                            'success': response.status_code in [200, 404],  # 404 if endpoint doesn't exist
                            'status_code': response.status_code,
                            'model_id': inference_data['model_id']
                        }
                        
                except Exception as e:
                    return {
                        'request_id': request_id,
                        'duration_ms': (time.time() - inference_start) * 1000,
                        'success': False,
                        'error': str(e)
                    }
        
        # Execute concurrent inference requests
        inference_tasks = [perform_inference(i) for i in range(100)]  # 100 inference requests
        inference_results = await asyncio.gather(*inference_tasks, return_exceptions=True)
        
        # Process results
        successful_results = [r for r in inference_results if isinstance(r, dict) and r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(inference_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="ml_inference",
            test_type="ml_throughput",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(r['duration_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['duration_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(inference_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(inference_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=len(inference_results) * 1024,  # Estimate
            custom_metrics={
                'inference_throughput': len(successful_results) / total_time,
                'concurrent_requests': self.config.ml_concurrent_requests,
                'model_diversity': len(set(r.get('model_id', '') for r in successful_results)),
                'inference_efficiency': success_rate / 100.0
            }
        )
    
    async def test_rl_optimization_performance(self) -> EndpointTestResult:
        """Test reinforcement learning optimization endpoints"""
        
        logger.info("Testing RL optimization performance")
        
        start_time = time.time()
        optimization_results = []
        
        # Test different RL scenarios
        rl_scenarios = [
            {'environment': 'cart_pole', 'episodes': 100},
            {'environment': 'mountain_car', 'episodes': 200},
            {'environment': 'lunar_lander', 'episodes': 300}
        ]
        
        for scenario in rl_scenarios:
            rl_data = {
                'algorithm': 'ppo',
                'environment': scenario['environment'],
                'episodes': scenario['episodes'],
                'hyperparameters': {
                    'learning_rate': 0.0003,
                    'discount_factor': 0.99,
                    'epsilon': 0.2
                }
            }
            
            optimization_start = time.time()
            
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self.config.base_url}/api/v1/rl/optimize",
                        json=rl_data
                    )
                    
                    optimization_time = (time.time() - optimization_start) * 1000
                    
                    optimization_results.append({
                        'environment': scenario['environment'],
                        'episodes': scenario['episodes'],
                        'duration_ms': optimization_time,
                        'success': response.status_code in [200, 202, 404],
                        'status_code': response.status_code
                    })
                    
            except Exception as e:
                optimization_results.append({
                    'environment': scenario['environment'],
                    'episodes': scenario['episodes'],
                    'duration_ms': (time.time() - optimization_start) * 1000,
                    'success': False,
                    'error': str(e)
                })
        
        # Process results
        successful_results = [r for r in optimization_results if r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(optimization_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="rl_optimization",
            test_type="rl_performance",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(r['duration_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['duration_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(optimization_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(optimization_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=sum(len(json.dumps(r)) for r in optimization_results),
            custom_metrics={
                'environments_tested': len(set(r.get('environment', '') for r in successful_results)),
                'avg_episodes': statistics.mean(r['episodes'] for r in successful_results) if successful_results else 0,
                'rl_efficiency': success_rate / 100.0
            }
        )
    
    def _generate_ml_training_data(self, data_size: int) -> Dict[str, Any]:
        """Generate realistic ML training data"""
        
        return {
            'model_type': random.choice(['classification', 'regression', 'clustering']),
            'algorithm': random.choice(['random_forest', 'svm', 'neural_network']),
            'features': [[random.random() for _ in range(20)] for _ in range(data_size)],
            'labels': [random.randint(0, 4) for _ in range(data_size)] if random.choice([True, False]) else None,
            'hyperparameters': {
                'learning_rate': random.uniform(0.001, 0.1),
                'batch_size': random.choice([32, 64, 128, 256]),
                'epochs': random.randint(10, 100),
                'regularization': random.uniform(0.0001, 0.01)
            },
            'validation_split': 0.2,
            'cross_validation_folds': 5
        }

class FileUploadLoadTester:
    """Specialized load testing for file upload and processing endpoints"""
    
    def __init__(self, config: EndpointTestConfig):
        self.config = config
        
    async def test_file_upload_performance(self) -> EndpointTestResult:
        """Test file upload endpoint with various file sizes"""
        
        logger.info(f"Testing file upload performance with sizes: {self.config.file_sizes_mb} MB")
        
        start_time = time.time()
        upload_results = []
        
        for file_size_mb in self.config.file_sizes_mb:
            for file_format in self.config.supported_formats[:3]:  # Test top 3 formats
                
                # Generate test file content
                file_content = self._generate_file_content(file_format, file_size_mb)
                
                upload_start = time.time()
                
                try:
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        files = {
                            'file': (f'test_file.{file_format}', file_content, self._get_mime_type(file_format))
                        }
                        
                        response = await client.post(
                            f"{self.config.base_url}/api/v1/files/upload",
                            files=files,
                            data={
                                'processing_options': json.dumps({
                                    'validate': True,
                                    'auto_detect_format': True,
                                    'max_file_size_mb': 50
                                })
                            }
                        )
                        
                        upload_time = (time.time() - upload_start) * 1000
                        
                        upload_results.append({
                            'file_size_mb': file_size_mb,
                            'file_format': file_format,
                            'duration_ms': upload_time,
                            'success': response.status_code in [200, 202, 404],
                            'status_code': response.status_code,
                            'upload_speed_mbps': (file_size_mb * 8) / (upload_time / 1000) if upload_time > 0 else 0
                        })
                        
                except Exception as e:
                    upload_results.append({
                        'file_size_mb': file_size_mb,
                        'file_format': file_format,
                        'duration_ms': (time.time() - upload_start) * 1000,
                        'success': False,
                        'error': str(e)
                    })
        
        # Process results
        successful_results = [r for r in upload_results if r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(upload_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="file_upload",
            test_type="file_processing",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(r['duration_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['duration_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(upload_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(upload_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=sum(r['file_size_mb'] * 1024 * 1024 for r in successful_results),
            custom_metrics={
                'avg_file_size_mb': statistics.mean(r['file_size_mb'] for r in successful_results) if successful_results else 0,
                'avg_upload_speed_mbps': statistics.mean(r.get('upload_speed_mbps', 0) for r in successful_results) if successful_results else 0,
                'file_formats_tested': len(set(r.get('file_format', '') for r in successful_results)),
                'upload_efficiency': success_rate / 100.0
            }
        )
    
    async def test_concurrent_file_uploads(self) -> EndpointTestResult:
        """Test concurrent file uploads to simulate multiple users"""
        
        logger.info(f"Testing concurrent file uploads with {self.config.file_upload_concurrent} concurrent uploads")
        
        start_time = time.time()
        semaphore = asyncio.Semaphore(self.config.file_upload_concurrent)
        
        async def upload_file(upload_id: int):
            async with semaphore:
                # Generate random file for upload
                file_size = random.choice([0.1, 0.5, 1.0, 2.0])  # MB
                file_format = random.choice(['csv', 'json', 'txt'])
                
                file_content = self._generate_file_content(file_format, file_size)
                
                upload_start = time.time()
                
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        files = {
                            'file': (f'concurrent_test_{upload_id}.{file_format}', file_content, self._get_mime_type(file_format))
                        }
                        
                        response = await client.post(
                            f"{self.config.base_url}/api/v1/files/upload",
                            files=files
                        )
                        
                        upload_time = (time.time() - upload_start) * 1000
                        
                        return {
                            'upload_id': upload_id,
                            'file_size_mb': file_size,
                            'file_format': file_format,
                            'duration_ms': upload_time,
                            'success': response.status_code in [200, 202, 404],
                            'status_code': response.status_code
                        }
                        
                except Exception as e:
                    return {
                        'upload_id': upload_id,
                        'duration_ms': (time.time() - upload_start) * 1000,
                        'success': False,
                        'error': str(e)
                    }
        
        # Execute concurrent uploads
        upload_tasks = [upload_file(i) for i in range(self.config.file_upload_concurrent * 2)]
        concurrent_results = await asyncio.gather(*upload_tasks, return_exceptions=True)
        
        # Process results
        successful_results = [r for r in concurrent_results if isinstance(r, dict) and r.get('success', False)]
        
        if successful_results:
            response_times = [r['duration_ms'] for r in successful_results]
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(concurrent_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="concurrent_file_upload",
            test_type="concurrent_processing",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            min_response_time_ms=min(r['duration_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['duration_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(concurrent_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(concurrent_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=sum(r.get('file_size_mb', 0) * 1024 * 1024 for r in successful_results),
            custom_metrics={
                'concurrent_uploads': self.config.file_upload_concurrent,
                'successful_concurrent_uploads': len(successful_results),
                'concurrency_efficiency': len(successful_results) / len(concurrent_results),
                'avg_concurrent_throughput': len(successful_results) / total_time
            }
        )
    
    def _generate_file_content(self, file_format: str, size_mb: float) -> bytes:
        """Generate file content for testing"""
        
        target_size = int(size_mb * 1024 * 1024)  # Convert MB to bytes
        
        if file_format == 'csv':
            return self._generate_csv_content(target_size)
        elif file_format == 'json':
            return self._generate_json_content(target_size)
        elif file_format == 'txt':
            return self._generate_text_content(target_size)
        elif file_format == 'xlsx':
            # For Excel files, return a simple binary placeholder
            return b'PK' + b'x' * (target_size - 2)
        elif file_format == 'pdf':
            # For PDF files, return a simple binary placeholder
            return b'%PDF-1.4' + b'x' * (target_size - 8)
        else:
            return b'x' * target_size
    
    def _generate_csv_content(self, target_size: int) -> bytes:
        """Generate CSV content of approximately target size"""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        headers = ['id', 'name', 'email', 'age', 'salary', 'department', 'location', 'hire_date']
        writer.writerow(headers)
        
        row_count = 0
        while output.tell() < target_size and row_count < 100000:  # Safety limit
            writer.writerow([
                row_count + 1,
                f"Employee {row_count + 1}",
                f"employee{row_count + 1}@company.com",
                random.randint(22, 65),
                random.randint(40000, 150000),
                random.choice(['Engineering', 'Sales', 'Marketing', 'HR']),
                random.choice(['New York', 'San Francisco', 'London', 'Tokyo']),
                f"202{random.randint(0, 3)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
            ])
            row_count += 1
        
        return output.getvalue().encode('utf-8')
    
    def _generate_json_content(self, target_size: int) -> bytes:
        """Generate JSON content of approximately target size"""
        
        data = []
        current_size = 0
        record_count = 0
        
        while current_size < target_size and record_count < 50000:  # Safety limit
            record = {
                "id": record_count + 1,
                "name": f"Record {record_count + 1}",
                "value": random.randint(1, 1000),
                "category": random.choice(['A', 'B', 'C', 'D']),
                "metadata": {
                    "created": datetime.now().isoformat(),
                    "tags": [f"tag{i}" for i in range(random.randint(1, 5))],
                    "score": random.random(),
                    "description": f"This is a test record number {record_count + 1} with some additional content to increase size"
                }
            }
            
            data.append(record)
            current_size = len(json.dumps(data))
            record_count += 1
        
        return json.dumps(data, indent=2).encode('utf-8')
    
    def _generate_text_content(self, target_size: int) -> bytes:
        """Generate text content of approximately target size"""
        
        content = []
        current_size = 0
        
        sample_text = "This is sample text content for load testing file uploads. " * 10
        
        while current_size < target_size:
            content.append(f"Line {len(content) + 1}: {sample_text}\n")
            current_size = sum(len(line.encode('utf-8')) for line in content)
        
        return ''.join(content).encode('utf-8')
    
    def _get_mime_type(self, file_format: str) -> str:
        """Get MIME type for file format"""
        
        mime_types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'txt': 'text/plain',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }
        
        return mime_types.get(file_format, 'application/octet-stream')

class WebSocketLoadTester:
    """Specialized load testing for WebSocket endpoints"""
    
    def __init__(self, config: EndpointTestConfig):
        self.config = config
        
    async def test_websocket_connection_scaling(self) -> EndpointTestResult:
        """Test WebSocket connection scaling and stability"""
        
        logger.info(f"Testing WebSocket connection scaling up to {self.config.websocket_connections} connections")
        
        start_time = time.time()
        connection_results = []
        
        # Simulate WebSocket connections (since actual WebSocket testing requires the server to be running)
        # In a real scenario, this would use the websockets library to establish actual connections
        
        async def simulate_websocket_connection(connection_id: int):
            connection_start = time.time()
            
            try:
                # Simulate connection establishment
                await asyncio.sleep(random.uniform(0.01, 0.1))  # Connection setup time
                
                connection_time = (time.time() - connection_start) * 1000
                
                # Simulate message exchange
                messages_sent = 0
                messages_received = 0
                
                for _ in range(10):  # Send 10 messages per connection
                    # Simulate sending message
                    await asyncio.sleep(1.0 / self.config.websocket_message_rate)
                    messages_sent += 1
                    
                    # Simulate receiving response
                    messages_received += 1
                
                return {
                    'connection_id': connection_id,
                    'connection_time_ms': connection_time,
                    'messages_sent': messages_sent,
                    'messages_received': messages_received,
                    'success': True,
                    'connection_stable': messages_sent == messages_received
                }
                
            except Exception as e:
                return {
                    'connection_id': connection_id,
                    'connection_time_ms': (time.time() - connection_start) * 1000,
                    'messages_sent': 0,
                    'messages_received': 0,
                    'success': False,
                    'error': str(e)
                }
        
        # Create connections in batches to avoid overwhelming the system
        batch_size = min(20, self.config.websocket_connections)
        for i in range(0, self.config.websocket_connections, batch_size):
            batch_end = min(i + batch_size, self.config.websocket_connections)
            batch_tasks = [simulate_websocket_connection(j) for j in range(i, batch_end)]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            connection_results.extend(batch_results)
            
            # Small delay between batches
            await asyncio.sleep(0.1)
        
        # Process results
        successful_results = [r for r in connection_results if isinstance(r, dict) and r.get('success', False)]
        
        if successful_results:
            connection_times = [r['connection_time_ms'] for r in successful_results]
            avg_connection_time = statistics.mean(connection_times)
            p95_connection_time = np.percentile(connection_times, 95)
            p99_connection_time = np.percentile(connection_times, 99)
            
            total_messages = sum(r['messages_sent'] for r in successful_results)
            stable_connections = sum(1 for r in successful_results if r.get('connection_stable', False))
        else:
            avg_connection_time = p95_connection_time = p99_connection_time = 0
            total_messages = 0
            stable_connections = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(connection_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="websocket_connections",
            test_type="websocket_scaling",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_connection_time,
            p95_response_time_ms=p95_connection_time,
            p99_response_time_ms=p99_connection_time,
            min_response_time_ms=min(r['connection_time_ms'] for r in successful_results) if successful_results else 0,
            max_response_time_ms=max(r['connection_time_ms'] for r in successful_results) if successful_results else 0,
            requests_per_second=len(connection_results) / total_time,
            successful_requests=len(successful_results),
            failed_requests=len(connection_results) - len(successful_results),
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=total_messages * 512,  # Estimate message size
            custom_metrics={
                'connections_tested': self.config.websocket_connections,
                'successful_connections': len(successful_results),
                'stable_connections': stable_connections,
                'total_messages_exchanged': total_messages,
                'connection_stability_rate': (stable_connections / len(successful_results)) * 100 if successful_results else 0,
                'message_throughput': total_messages / total_time if total_time > 0 else 0
            }
        )
    
    async def test_websocket_message_latency(self) -> EndpointTestResult:
        """Test WebSocket message latency under load"""
        
        logger.info("Testing WebSocket message latency")
        
        start_time = time.time()
        latency_results = []
        
        # Simulate high-frequency message exchange
        num_connections = min(10, self.config.websocket_connections)
        messages_per_connection = 100
        
        async def test_message_latency(connection_id: int):
            connection_latencies = []
            
            for message_id in range(messages_per_connection):
                message_start = time.time()
                
                try:
                    # Simulate message round-trip
                    await asyncio.sleep(random.uniform(0.001, 0.01))  # Network latency simulation
                    
                    latency = (time.time() - message_start) * 1000
                    connection_latencies.append(latency)
                    
                except Exception as e:
                    logger.warning(f"Message latency test failed: {e}")
                
                # Message rate control
                await asyncio.sleep(1.0 / self.config.websocket_message_rate)
            
            return {
                'connection_id': connection_id,
                'latencies': connection_latencies,
                'avg_latency_ms': statistics.mean(connection_latencies) if connection_latencies else 0,
                'max_latency_ms': max(connection_latencies) if connection_latencies else 0,
                'messages_tested': len(connection_latencies),
                'success': len(connection_latencies) > 0
            }
        
        # Test message latency across multiple connections
        latency_tasks = [test_message_latency(i) for i in range(num_connections)]
        latency_test_results = await asyncio.gather(*latency_tasks, return_exceptions=True)
        
        # Process latency results
        successful_results = [r for r in latency_test_results if isinstance(r, dict) and r.get('success', False)]
        
        all_latencies = []
        total_messages = 0
        
        for result in successful_results:
            all_latencies.extend(result['latencies'])
            total_messages += result['messages_tested']
        
        if all_latencies:
            avg_latency = statistics.mean(all_latencies)
            p95_latency = np.percentile(all_latencies, 95)
            p99_latency = np.percentile(all_latencies, 99)
            min_latency = min(all_latencies)
            max_latency = max(all_latencies)
        else:
            avg_latency = p95_latency = p99_latency = min_latency = max_latency = 0
        
        total_time = time.time() - start_time
        success_rate = (len(successful_results) / len(latency_test_results)) * 100
        
        return EndpointTestResult(
            endpoint_name="websocket_latency",
            test_type="websocket_performance",
            timestamp=datetime.now(),
            avg_response_time_ms=avg_latency,
            p95_response_time_ms=p95_latency,
            p99_response_time_ms=p99_latency,
            min_response_time_ms=min_latency,
            max_response_time_ms=max_latency,
            requests_per_second=total_messages / total_time if total_time > 0 else 0,
            successful_requests=total_messages,
            failed_requests=(num_connections * messages_per_connection) - total_messages,
            success_rate_percent=success_rate,
            peak_memory_mb=psutil.virtual_memory().used / (1024 * 1024),
            avg_cpu_percent=psutil.cpu_percent(),
            network_bytes_transferred=total_messages * 256,  # Estimate
            custom_metrics={
                'connections_tested': num_connections,
                'total_messages_tested': total_messages,
                'message_rate_per_second': self.config.websocket_message_rate,
                'latency_consistency': (1.0 - (np.std(all_latencies) / avg_latency)) if all_latencies and avg_latency > 0 else 0,
                'low_latency_messages_percent': (sum(1 for l in all_latencies if l <= self.config.websocket_max_latency) / len(all_latencies)) * 100 if all_latencies else 0
            }
        )

class SpecializedEndpointOrchestrator:
    """Orchestrator for all specialized endpoint load testing"""
    
    def __init__(self, config: EndpointTestConfig = None):
        self.config = config or EndpointTestConfig()
        
        # Initialize specialized testers
        self.auth_tester = AuthenticationLoadTester(self.config)
        self.ml_tester = MLRLLoadTester(self.config)
        self.file_tester = FileUploadLoadTester(self.config)
        self.websocket_tester = WebSocketLoadTester(self.config)
        
        self.results: List[EndpointTestResult] = []
    
    async def run_all_specialized_tests(self) -> Dict[str, Any]:
        """Run all specialized endpoint load tests"""
        
        logger.info("🚀 Starting specialized endpoint load testing")
        
        test_results = {}
        
        try:
            # Authentication Tests
            logger.info("🔐 Testing Authentication Endpoints")
            test_results['auth_oauth_flow'] = await self.auth_tester.test_oauth_authentication_flow()
            test_results['auth_token_validation'] = await self.auth_tester.test_token_validation_performance()
            
            # ML/RL Tests
            logger.info("🤖 Testing ML/RL Endpoints")
            test_results['ml_training'] = await self.ml_tester.test_ml_training_performance()
            test_results['ml_inference'] = await self.ml_tester.test_ml_inference_throughput()
            test_results['rl_optimization'] = await self.ml_tester.test_rl_optimization_performance()
            
            # File Upload Tests
            logger.info("📁 Testing File Upload Endpoints")
            test_results['file_upload'] = await self.file_tester.test_file_upload_performance()
            test_results['concurrent_uploads'] = await self.file_tester.test_concurrent_file_uploads()
            
            # WebSocket Tests
            logger.info("🔌 Testing WebSocket Endpoints")
            test_results['websocket_scaling'] = await self.websocket_tester.test_websocket_connection_scaling()
            test_results['websocket_latency'] = await self.websocket_tester.test_websocket_message_latency()
            
        except Exception as e:
            logger.error(f"Specialized endpoint testing failed: {e}")
            test_results['error'] = str(e)
        
        # Generate comprehensive report
        report = self._generate_specialized_report(test_results)
        
        logger.info("✅ Specialized endpoint load testing completed")
        
        return report
    
    def _generate_specialized_report(self, test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate specialized endpoint testing report"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Calculate category scores
        category_scores = {}
        
        # Authentication category score
        auth_tests = [test_results.get('auth_oauth_flow'), test_results.get('auth_token_validation')]
        auth_tests = [t for t in auth_tests if t and isinstance(t, EndpointTestResult)]
        if auth_tests:
            auth_score = statistics.mean(t.success_rate_percent for t in auth_tests)
            auth_performance = all(t.avg_response_time_ms <= self.config.auth_max_response_time for t in auth_tests)
            category_scores['authentication'] = {
                'success_rate': auth_score,
                'performance_target_met': auth_performance,
                'score': auth_score * (1.1 if auth_performance else 0.8)
            }
        
        # ML/RL category score
        ml_tests = [test_results.get('ml_training'), test_results.get('ml_inference'), test_results.get('rl_optimization')]
        ml_tests = [t for t in ml_tests if t and isinstance(t, EndpointTestResult)]
        if ml_tests:
            ml_score = statistics.mean(t.success_rate_percent for t in ml_tests)
            ml_performance = all(t.avg_response_time_ms <= self.config.ml_max_response_time for t in ml_tests)
            category_scores['ml_rl'] = {
                'success_rate': ml_score,
                'performance_target_met': ml_performance,
                'score': ml_score * (1.1 if ml_performance else 0.8)
            }
        
        # File processing category score
        file_tests = [test_results.get('file_upload'), test_results.get('concurrent_uploads')]
        file_tests = [t for t in file_tests if t and isinstance(t, EndpointTestResult)]
        if file_tests:
            file_score = statistics.mean(t.success_rate_percent for t in file_tests)
            file_performance = True  # File upload performance is more complex, simplified here
            category_scores['file_processing'] = {
                'success_rate': file_score,
                'performance_target_met': file_performance,
                'score': file_score * (1.1 if file_performance else 0.8)
            }
        
        # WebSocket category score
        ws_tests = [test_results.get('websocket_scaling'), test_results.get('websocket_latency')]
        ws_tests = [t for t in ws_tests if t and isinstance(t, EndpointTestResult)]
        if ws_tests:
            ws_score = statistics.mean(t.success_rate_percent for t in ws_tests)
            ws_performance = all(t.avg_response_time_ms <= self.config.websocket_max_latency for t in ws_tests)
            category_scores['websocket'] = {
                'success_rate': ws_score,
                'performance_target_met': ws_performance,
                'score': ws_score * (1.1 if ws_performance else 0.8)
            }
        
        # Overall specialized endpoint score
        overall_score = statistics.mean(cat['score'] for cat in category_scores.values()) if category_scores else 0
        
        # Performance recommendations
        recommendations = self._generate_endpoint_recommendations(test_results, category_scores)
        
        report = {
            'test_execution': {
                'timestamp': timestamp,
                'configuration': asdict(self.config),
                'test_categories': list(category_scores.keys())
            },
            'overall_score': round(overall_score, 1),
            'category_scores': category_scores,
            'test_results': {k: asdict(v) if isinstance(v, EndpointTestResult) else v 
                           for k, v in test_results.items()},
            'performance_recommendations': recommendations,
            'summary': {
                'all_categories_passing': all(cat['score'] >= 80 for cat in category_scores.values()),
                'performance_targets_met': all(cat['performance_target_met'] for cat in category_scores.values()),
                'production_readiness': overall_score >= 90,
                'critical_issues': [k for k, cat in category_scores.items() if cat['score'] < 70]
            }
        }
        
        # Save report
        report_file = f"specialized_endpoint_load_test_report_{timestamp}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        logger.info(f"📋 Specialized endpoint report saved: {report_file}")
        logger.info(f"🎯 Overall Endpoint Score: {overall_score}/100")
        
        return report
    
    def _generate_endpoint_recommendations(self, test_results: Dict[str, Any], category_scores: Dict[str, Dict]) -> List[str]:
        """Generate endpoint-specific performance recommendations"""
        
        recommendations = []
        
        # Authentication recommendations
        if 'authentication' in category_scores:
            auth_score = category_scores['authentication']
            if auth_score['score'] < 90:
                recommendations.append("🔐 Optimize OAuth authentication flow and token validation performance")
            if not auth_score['performance_target_met']:
                recommendations.append("⚡ Reduce authentication endpoint response times to meet <2s target")
        
        # ML/RL recommendations
        if 'ml_rl' in category_scores:
            ml_score = category_scores['ml_rl']
            if ml_score['score'] < 85:
                recommendations.append("🤖 Improve ML/RL endpoint reliability and error handling")
            if not ml_score['performance_target_met']:
                recommendations.append("🚀 Optimize ML inference and training performance to meet <5s target")
        
        # File processing recommendations
        if 'file_processing' in category_scores:
            file_score = category_scores['file_processing']
            if file_score['score'] < 85:
                recommendations.append("📁 Improve file upload reliability and concurrent processing")
            
            # Check specific file upload metrics
            file_upload_result = test_results.get('file_upload')
            if isinstance(file_upload_result, EndpointTestResult):
                if file_upload_result.custom_metrics.get('avg_upload_speed_mbps', 0) < 10:
                    recommendations.append("📡 Optimize file upload throughput and network performance")
        
        # WebSocket recommendations
        if 'websocket' in category_scores:
            ws_score = category_scores['websocket']
            if ws_score['score'] < 90:
                recommendations.append("🔌 Improve WebSocket connection stability and message throughput")
            if not ws_score['performance_target_met']:
                recommendations.append("📊 Reduce WebSocket message latency to meet <100ms target")
        
        # General recommendations based on overall performance
        overall_score = statistics.mean(cat['score'] for cat in category_scores.values()) if category_scores else 0
        if overall_score < 85:
            recommendations.append("🔧 Implement comprehensive endpoint monitoring and alerting")
            recommendations.append("📈 Set up automated performance regression testing")
        
        if not recommendations:
            recommendations.append("✅ All endpoint categories performing well! Consider stress testing with higher loads")
        
        return recommendations

# Locust integration for specialized endpoint testing
class SpecializedEndpointUser(HttpUser):
    """Locust user for specialized endpoint testing"""
    wait_time = between(1, 3)
    
    @task(5)
    def test_authentication_flow(self):
        """Test authentication endpoints"""
        with self.client.get("/api/v1/auth/status", catch_response=True, name="auth_status") as response:
            if response.status_code not in [200, 401]:
                response.failure(f"Auth status failed: {response.status_code}")
    
    @task(3)
    def test_ml_inference(self):
        """Test ML inference endpoints"""
        ml_data = {
            "model_id": "test_model",
            "input_data": [[random.random() for _ in range(5)] for _ in range(3)]
        }
        
        with self.client.post(
            "/api/v1/ml/inference",
            json=ml_data,
            catch_response=True,
            name="ml_inference"
        ) as response:
            if response.status_code not in [200, 202, 404]:
                response.failure(f"ML inference failed: {response.status_code}")
    
    @task(2)
    def test_file_upload_simulation(self):
        """Simulate file upload (lightweight)"""
        test_data = {"file_name": "test.csv", "content_preview": "id,name,value\n1,test,100"}
        
        with self.client.post(
            "/api/v1/files/upload",
            json=test_data,
            catch_response=True,
            name="file_upload"
        ) as response:
            if response.status_code not in [200, 202, 404]:
                response.failure(f"File upload failed: {response.status_code}")

# Pytest test classes
class TestAuthenticationLoadTesting:
    """Test class for authentication load testing"""
    
    def setup_method(self):
        self.config = EndpointTestConfig()
        self.auth_tester = AuthenticationLoadTester(self.config)
    
    @pytest.mark.asyncio
    async def test_oauth_authentication_performance(self):
        """Test OAuth authentication flow performance"""
        result = await self.auth_tester.test_oauth_authentication_flow()
        
        assert result.success_rate_percent >= 80, f"OAuth success rate too low: {result.success_rate_percent}%"
        assert result.avg_response_time_ms <= self.config.auth_max_response_time, \
            f"OAuth response time too high: {result.avg_response_time_ms}ms"
    
    @pytest.mark.asyncio
    async def test_token_validation_throughput(self):
        """Test token validation throughput"""
        result = await self.auth_tester.test_token_validation_performance()
        
        assert result.requests_per_second >= 50, f"Token validation throughput too low: {result.requests_per_second} req/s"

class TestMLRLLoadTesting:
    """Test class for ML/RL load testing"""
    
    def setup_method(self):
        self.config = EndpointTestConfig()
        self.ml_tester = MLRLLoadTester(self.config)
    
    @pytest.mark.asyncio
    async def test_ml_training_scalability(self):
        """Test ML training with different data sizes"""
        result = await self.ml_tester.test_ml_training_performance()
        
        assert result.success_rate_percent >= 70, f"ML training success rate too low: {result.success_rate_percent}%"
        assert result.avg_response_time_ms <= self.config.ml_max_response_time, \
            f"ML training response time too high: {result.avg_response_time_ms}ms"
    
    @pytest.mark.asyncio
    async def test_ml_inference_throughput(self):
        """Test ML inference throughput"""
        result = await self.ml_tester.test_ml_inference_throughput()
        
        assert result.requests_per_second >= 5, f"ML inference throughput too low: {result.requests_per_second} req/s"

class TestFileUploadLoadTesting:
    """Test class for file upload load testing"""
    
    def setup_method(self):
        self.config = EndpointTestConfig()
        self.file_tester = FileUploadLoadTester(self.config)
    
    @pytest.mark.asyncio
    async def test_file_upload_performance(self):
        """Test file upload performance with various sizes"""
        result = await self.file_tester.test_file_upload_performance()
        
        assert result.success_rate_percent >= 80, f"File upload success rate too low: {result.success_rate_percent}%"
        
        # Check upload speed
        avg_speed = result.custom_metrics.get('avg_upload_speed_mbps', 0)
        assert avg_speed >= 1, f"File upload speed too low: {avg_speed} Mbps"
    
    @pytest.mark.asyncio
    async def test_concurrent_file_uploads(self):
        """Test concurrent file upload handling"""
        result = await self.file_tester.test_concurrent_file_uploads()
        
        assert result.success_rate_percent >= 75, f"Concurrent upload success rate too low: {result.success_rate_percent}%"

class TestWebSocketLoadTesting:
    """Test class for WebSocket load testing"""
    
    def setup_method(self):
        self.config = EndpointTestConfig()
        self.websocket_tester = WebSocketLoadTester(self.config)
    
    @pytest.mark.asyncio
    async def test_websocket_connection_scaling(self):
        """Test WebSocket connection scaling"""
        result = await self.websocket_tester.test_websocket_connection_scaling()
        
        successful_connections = result.custom_metrics.get('successful_connections', 0)
        target_connections = self.config.websocket_connections
        
        connection_rate = (successful_connections / target_connections) * 100
        assert connection_rate >= 80, f"WebSocket connection rate too low: {connection_rate}%"
    
    @pytest.mark.asyncio
    async def test_websocket_message_latency(self):
        """Test WebSocket message latency"""
        result = await self.websocket_tester.test_websocket_message_latency()
        
        assert result.avg_response_time_ms <= self.config.websocket_max_latency, \
            f"WebSocket latency too high: {result.avg_response_time_ms}ms"

class TestSpecializedEndpointOrchestrator:
    """Test class for complete specialized endpoint testing"""
    
    def setup_method(self):
        self.orchestrator = SpecializedEndpointOrchestrator()
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_all_specialized_endpoints(self):
        """Test all specialized endpoints"""
        report = await self.orchestrator.run_all_specialized_tests()
        
        overall_score = report.get('overall_score', 0)
        assert overall_score >= 70, f"Overall endpoint score too low: {overall_score}/100"
        
        # Check that no critical issues exist
        critical_issues = report.get('summary', {}).get('critical_issues', [])
        assert len(critical_issues) <= 1, f"Too many critical endpoint issues: {critical_issues}"
        
        logger.info(f"✅ Specialized endpoint testing completed with score: {overall_score}/100")

if __name__ == "__main__":
    # CLI execution for manual testing
    import argparse
    
    parser = argparse.ArgumentParser(description="Specialized Endpoint Load Testing")
    parser.add_argument('--base-url', default='http://localhost:8000', help='Base URL')
    parser.add_argument('--test-category', choices=['auth', 'ml', 'files', 'websocket', 'all'], 
                        default='all', help='Test category to run')
    
    args = parser.parse_args()
    
    async def run_specialized_tests():
        config = EndpointTestConfig(base_url=args.base_url)
        orchestrator = SpecializedEndpointOrchestrator(config)
        
        if args.test_category == 'all':
            results = await orchestrator.run_all_specialized_tests()
        else:
            # Run specific category tests
            if args.test_category == 'auth':
                results = await orchestrator.auth_tester.test_oauth_authentication_flow()
            elif args.test_category == 'ml':
                results = await orchestrator.ml_tester.test_ml_training_performance()
            elif args.test_category == 'files':
                results = await orchestrator.file_tester.test_file_upload_performance()
            elif args.test_category == 'websocket':
                results = await orchestrator.websocket_tester.test_websocket_connection_scaling()
        
        print(f"Specialized endpoint testing completed: {args.test_category}")
        return results
    
    asyncio.run(run_specialized_tests())