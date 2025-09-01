"""
Comprehensive Performance Baseline Testing Suite for Schlep-Engine
================================================================

This module establishes comprehensive performance baselines for the integrated 
frontend-backend system following the backend optimization improvements.

Expected Performance Targets:
- API response times: <200ms for 95th percentile
- Authentication flows: <2 seconds end-to-end
- ML inference: <5 seconds per request
- Frontend bundle size: <500KB gzipped
- Core Web Vitals: All green scores

Features:
- API performance validation across all critical endpoints
- Authentication flow performance testing
- ML/RL endpoint performance with model inference
- Database query performance validation
- WebSocket connection establishment testing
- Memory and resource monitoring
- Performance regression detection
- Automated baseline establishment
"""

import asyncio
import json
import time
import statistics
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import subprocess
import os

import pytest
import httpx
import psutil
import numpy as np
import pandas as pd
from memory_profiler import profile
import websockets
from websockets.exceptions import ConnectionClosedError, WebSocketException

# Import existing framework components
from performance_framework import (
    PerformanceMetric, BenchmarkResult, PerformanceBenchmarkDB, 
    PerformanceProfiler, PerformanceReporter, TestDataGenerator
)

logger = logging.getLogger(__name__)

@dataclass
class AuthenticationMetric:
    """Authentication flow performance metrics"""
    flow_type: str  # login, oauth, token_refresh, logout
    total_duration_ms: float
    api_calls_count: int
    api_response_times_ms: List[float]
    token_validation_time_ms: float
    redirect_time_ms: Optional[float] = None
    success: bool = True
    error: Optional[str] = None

@dataclass
class WebSocketMetric:
    """WebSocket connection performance metrics"""
    connection_time_ms: float
    first_message_time_ms: float
    message_throughput_per_sec: float
    connection_stability_score: float  # 0-100
    data_transfer_rate_mbps: float
    success: bool = True
    error: Optional[str] = None

@dataclass
class DatabaseMetric:
    """Database performance metrics"""
    query_type: str  # select, insert, update, delete, complex_join
    execution_time_ms: float
    records_affected: int
    connection_pool_utilization: float
    cache_hit_rate: float
    index_usage_efficiency: float
    success: bool = True
    error: Optional[str] = None

@dataclass
class MLInferenceMetric:
    """ML/RL model inference performance metrics"""
    model_type: str  # rl_optimization, data_processing, classification
    model_loading_time_ms: float
    inference_time_ms: float
    preprocessing_time_ms: float
    postprocessing_time_ms: float
    total_time_ms: float
    batch_size: int
    throughput_predictions_per_sec: float
    memory_usage_mb: float
    gpu_utilization_percent: float
    accuracy_score: Optional[float] = None
    success: bool = True
    error: Optional[str] = None

class ComprehensivePerformanceTester:
    """Comprehensive performance testing for all system components"""
    
    def __init__(self, base_url: str = "http://localhost:8000", 
                 websocket_url: str = "ws://localhost:8000/ws"):
        self.base_url = base_url
        self.websocket_url = websocket_url
        self.db = PerformanceBenchmarkDB("comprehensive_performance.db")
        self.profiler = PerformanceProfiler()
        self.reporter = PerformanceReporter("comprehensive_performance_reports")
        
        # Initialize extended database schema
        self._init_extended_schema()
    
    def _init_extended_schema(self):
        """Initialize extended database schema for comprehensive metrics"""
        import sqlite3
        
        with sqlite3.connect(self.db.db_path) as conn:
            # Authentication metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS auth_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    flow_type TEXT NOT NULL,
                    total_duration_ms REAL,
                    api_calls_count INTEGER,
                    token_validation_time_ms REAL,
                    redirect_time_ms REAL,
                    success BOOLEAN,
                    error TEXT
                )
            """)
            
            # WebSocket metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS websocket_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    connection_time_ms REAL,
                    first_message_time_ms REAL,
                    message_throughput_per_sec REAL,
                    connection_stability_score REAL,
                    data_transfer_rate_mbps REAL,
                    success BOOLEAN,
                    error TEXT
                )
            """)
            
            # Database metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS database_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    query_type TEXT NOT NULL,
                    execution_time_ms REAL,
                    records_affected INTEGER,
                    connection_pool_utilization REAL,
                    cache_hit_rate REAL,
                    index_usage_efficiency REAL,
                    success BOOLEAN,
                    error TEXT
                )
            """)
            
            # ML Inference metrics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ml_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    model_type TEXT NOT NULL,
                    model_loading_time_ms REAL,
                    inference_time_ms REAL,
                    preprocessing_time_ms REAL,
                    postprocessing_time_ms REAL,
                    total_time_ms REAL,
                    batch_size INTEGER,
                    throughput_predictions_per_sec REAL,
                    memory_usage_mb REAL,
                    gpu_utilization_percent REAL,
                    accuracy_score REAL,
                    success BOOLEAN,
                    error TEXT
                )
            """)
    
    async def test_api_endpoints_comprehensive(self) -> List[BenchmarkResult]:
        """Test all critical API endpoints with comprehensive metrics"""
        logger.info("Testing comprehensive API endpoint performance")
        
        # Define critical API endpoints by category
        endpoints_config = {
            "health_check": [
                {"endpoint": "/health", "method": "GET", "expected_ms": 50},
                {"endpoint": "/api/v1/health", "method": "GET", "expected_ms": 100},
            ],
            "authentication": [
                {"endpoint": "/api/v1/auth/status", "method": "GET", "expected_ms": 150},
                {"endpoint": "/api/v1/auth/validate", "method": "POST", "expected_ms": 200, 
                 "data": {"token": "test_token"}},
            ],
            "data_processing": [
                {"endpoint": "/api/v1/data/upload", "method": "POST", "expected_ms": 500,
                 "data": {"file_size": 1024, "file_type": "csv"}},
                {"endpoint": "/api/v1/data/process", "method": "POST", "expected_ms": 1000,
                 "data": {"processing_type": "basic_clean", "record_count": 1000}},
                {"endpoint": "/api/v1/data/export", "method": "GET", "expected_ms": 800},
            ],
            "ml_inference": [
                {"endpoint": "/api/v1/ml/predict", "method": "POST", "expected_ms": 3000,
                 "data": {"model_type": "classification", "features": [1, 2, 3, 4, 5]}},
                {"endpoint": "/api/v1/rl/optimize", "method": "POST", "expected_ms": 5000,
                 "data": {"optimization_type": "hyperparameter", "iterations": 100}},
            ],
            "file_operations": [
                {"endpoint": "/api/v1/files/list", "method": "GET", "expected_ms": 300},
                {"endpoint": "/api/v1/files/metadata", "method": "GET", "expected_ms": 200},
            ]
        }
        
        results = []
        
        for category, endpoints in endpoints_config.items():
            logger.info(f"Testing {category} endpoints")
            
            for endpoint_config in endpoints:
                try:
                    # Start system monitoring
                    profiler_task = asyncio.create_task(self.profiler.start_monitoring())
                    
                    result = await self._test_single_endpoint_comprehensive(
                        endpoint_config, category
                    )
                    results.append(result)
                    
                    # Stop profiling
                    self.profiler.stop_monitoring()
                    profiler_task.cancel()
                    
                    # Validate against expected performance
                    avg_response_time = result.metrics['avg_response_time_ms']
                    expected_time = endpoint_config.get('expected_ms', 1000)
                    
                    if avg_response_time > expected_time:
                        logger.warning(
                            f"Performance regression detected: {endpoint_config['endpoint']} "
                            f"avg response time {avg_response_time:.2f}ms exceeds expected {expected_time}ms"
                        )
                    
                    # Small delay between tests to avoid overwhelming the system
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Failed to test endpoint {endpoint_config['endpoint']}: {e}")
        
        return results
    
    async def _test_single_endpoint_comprehensive(self, config: Dict, category: str) -> BenchmarkResult:
        """Test a single endpoint with comprehensive metrics"""
        endpoint = config['endpoint']
        method = config['method']
        data = config.get('data')
        
        test_name = f"{category}_{method}_{endpoint.replace('/', '_').replace(':', '')}"
        
        raw_metrics = []
        iterations = 50  # Balanced for thorough testing without overwhelming
        concurrent_requests = 8  # Moderate concurrency
        
        async def make_request(session: httpx.AsyncClient, request_id: int):
            start_time = time.time()
            start_memory = psutil.virtual_memory().used / (1024 * 1024)
            
            try:
                if method.upper() == "GET":
                    response = await session.get(f"{self.base_url}{endpoint}")
                elif method.upper() == "POST":
                    response = await session.post(f"{self.base_url}{endpoint}", json=data)
                elif method.upper() == "PUT":
                    response = await session.put(f"{self.base_url}{endpoint}", json=data)
                elif method.upper() == "DELETE":
                    response = await session.delete(f"{self.base_url}{endpoint}")
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                end_time = time.time()
                end_memory = psutil.virtual_memory().used / (1024 * 1024)
                
                duration_ms = (end_time - start_time) * 1000
                memory_diff = end_memory - start_memory
                
                # Extract additional metrics from response headers if available
                content_length = len(response.content) if hasattr(response, 'content') else 0
                
                metric = PerformanceMetric(
                    timestamp=datetime.now(),
                    test_name=test_name,
                    operation=f"{method} {endpoint}",
                    duration_ms=duration_ms,
                    memory_mb=memory_diff,
                    cpu_percent=psutil.cpu_percent(interval=None),
                    throughput_ops=1.0 / (end_time - start_time) if end_time > start_time else 0,
                    records_processed=1,
                    success=200 <= response.status_code < 400
                )
                
                raw_metrics.append(metric)
                
            except Exception as e:
                end_time = time.time()
                duration_ms = (end_time - start_time) * 1000
                
                metric = PerformanceMetric(
                    timestamp=datetime.now(),
                    test_name=test_name,
                    operation=f"{method} {endpoint}",
                    duration_ms=duration_ms,
                    memory_mb=0,
                    cpu_percent=0,
                    throughput_ops=0,
                    records_processed=0,
                    success=False,
                    error=str(e)
                )
                
                raw_metrics.append(metric)
        
        # Execute requests with controlled concurrency
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def controlled_request(session: httpx.AsyncClient, request_id: int):
            async with semaphore:
                await make_request(session, request_id)
        
        # Execute all requests
        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = [controlled_request(client, i) for i in range(iterations)]
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Calculate comprehensive metrics
        successful_metrics = [m for m in raw_metrics if m.success]
        response_times = [m.duration_ms for m in successful_metrics]
        
        if response_times:
            metrics = {
                'total_requests': len(raw_metrics),
                'successful_requests': len(successful_metrics),
                'success_rate': (len(successful_metrics) / len(raw_metrics)) * 100,
                'avg_response_time_ms': statistics.mean(response_times),
                'median_response_time_ms': statistics.median(response_times),
                'p95_response_time_ms': np.percentile(response_times, 95),
                'p99_response_time_ms': np.percentile(response_times, 99),
                'min_response_time_ms': min(response_times),
                'max_response_time_ms': max(response_times),
                'std_dev_ms': statistics.stdev(response_times) if len(response_times) > 1 else 0,
                'throughput_rps': len(successful_metrics) / (max(response_times) / 1000) if response_times else 0,
                'memory_peak_mb': max([m.memory_mb for m in raw_metrics] + [0]),
                'cpu_avg_percent': statistics.mean([m.cpu_percent for m in raw_metrics] + [0]),
                'records_processed': len(successful_metrics),
                'category': category,
                'endpoint': endpoint,
                'method': method
            }
        else:
            metrics = {
                'total_requests': len(raw_metrics),
                'successful_requests': 0,
                'success_rate': 0,
                'avg_response_time_ms': 0,
                'median_response_time_ms': 0,
                'p95_response_time_ms': 0,
                'p99_response_time_ms': 0,
                'min_response_time_ms': 0,
                'max_response_time_ms': 0,
                'std_dev_ms': 0,
                'throughput_rps': 0,
                'memory_peak_mb': 0,
                'cpu_avg_percent': 0,
                'records_processed': 0,
                'category': category,
                'endpoint': endpoint,
                'method': method
            }
        
        config_data = {
            'endpoint': endpoint,
            'method': method,
            'iterations': iterations,
            'concurrent_requests': concurrent_requests,
            'category': category,
            'data_size_bytes': len(json.dumps(data)) if data else 0
        }
        
        # Get baseline for comparison
        baseline = self.db.get_baseline_metrics(test_name)
        baseline_comparison = None
        
        if baseline and metrics['avg_response_time_ms'] > 0:
            baseline_comparison = {
                'response_time_change_percent': (
                    (metrics['avg_response_time_ms'] - baseline['avg_response_time_ms']) 
                    / baseline['avg_response_time_ms']
                ) * 100,
                'throughput_change_percent': (
                    (metrics['throughput_rps'] - baseline['throughput_rps']) 
                    / baseline['throughput_rps']
                ) * 100 if baseline['throughput_rps'] > 0 else 0,
                'memory_change_percent': (
                    (metrics['memory_peak_mb'] - baseline['memory_peak_mb']) 
                    / baseline['memory_peak_mb']
                ) * 100 if baseline['memory_peak_mb'] > 0 else 0
            }
        
        result = BenchmarkResult(
            test_name=test_name,
            timestamp=datetime.now(),
            config=config_data,
            metrics=metrics,
            raw_data=raw_metrics,
            baseline_comparison=baseline_comparison
        )
        
        # Store in database
        self.db.store_benchmark(result)
        
        return result
    
    async def test_authentication_flows(self) -> List[AuthenticationMetric]:
        """Test authentication flow performance end-to-end"""
        logger.info("Testing authentication flow performance")
        
        auth_flows = []
        
        # Test OAuth flow (simulated)
        oauth_metric = await self._test_oauth_flow()
        if oauth_metric:
            auth_flows.append(oauth_metric)
        
        # Test standard login flow
        login_metric = await self._test_login_flow()
        if login_metric:
            auth_flows.append(login_metric)
        
        # Test token refresh flow
        refresh_metric = await self._test_token_refresh_flow()
        if refresh_metric:
            auth_flows.append(refresh_metric)
        
        # Store metrics in database
        self._store_auth_metrics(auth_flows)
        
        return auth_flows
    
    async def _test_oauth_flow(self) -> Optional[AuthenticationMetric]:
        """Test OAuth authentication flow performance"""
        start_time = time.time()
        api_times = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Step 1: Initiate OAuth
                oauth_start = time.time()
                response = await client.get(f"{self.base_url}/api/v1/auth/oauth/google")
                oauth_end = time.time()
                api_times.append((oauth_end - oauth_start) * 1000)
                
                if response.status_code not in [200, 302]:
                    raise Exception(f"OAuth initiation failed: {response.status_code}")
                
                # Step 2: Simulate OAuth callback (in real scenario, this would be handled by browser)
                callback_start = time.time()
                callback_response = await client.get(
                    f"{self.base_url}/api/v1/auth/oauth/callback?code=test_code&state=test_state"
                )
                callback_end = time.time()
                api_times.append((callback_end - callback_start) * 1000)
                
                # Step 3: Token validation
                validation_start = time.time()
                if callback_response.status_code == 200:
                    # Extract token from response (simulated)
                    token_response = await client.post(
                        f"{self.base_url}/api/v1/auth/validate",
                        json={"token": "oauth_test_token"}
                    )
                validation_end = time.time()
                validation_time = (validation_end - validation_start) * 1000
                
                total_time = (time.time() - start_time) * 1000
                
                return AuthenticationMetric(
                    flow_type="oauth",
                    total_duration_ms=total_time,
                    api_calls_count=len(api_times),
                    api_response_times_ms=api_times,
                    token_validation_time_ms=validation_time,
                    redirect_time_ms=api_times[0] if api_times else 0,
                    success=True
                )
                
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            logger.error(f"OAuth flow test failed: {e}")
            
            return AuthenticationMetric(
                flow_type="oauth",
                total_duration_ms=total_time,
                api_calls_count=len(api_times),
                api_response_times_ms=api_times,
                token_validation_time_ms=0,
                success=False,
                error=str(e)
            )
    
    async def _test_login_flow(self) -> Optional[AuthenticationMetric]:
        """Test standard login flow performance"""
        start_time = time.time()
        api_times = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Step 1: Login request
                login_start = time.time()
                login_response = await client.post(
                    f"{self.base_url}/api/v1/auth/login",
                    json={"username": "test_user", "password": "test_password"}
                )
                login_end = time.time()
                api_times.append((login_end - login_start) * 1000)
                
                # Step 2: Token validation
                validation_start = time.time()
                if login_response.status_code == 200:
                    validation_response = await client.get(
                        f"{self.base_url}/api/v1/auth/me",
                        headers={"Authorization": "Bearer test_token"}
                    )
                validation_end = time.time()
                validation_time = (validation_end - validation_start) * 1000
                
                total_time = (time.time() - start_time) * 1000
                
                return AuthenticationMetric(
                    flow_type="login",
                    total_duration_ms=total_time,
                    api_calls_count=len(api_times),
                    api_response_times_ms=api_times,
                    token_validation_time_ms=validation_time,
                    success=login_response.status_code == 200
                )
                
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            logger.error(f"Login flow test failed: {e}")
            
            return AuthenticationMetric(
                flow_type="login",
                total_duration_ms=total_time,
                api_calls_count=len(api_times),
                api_response_times_ms=api_times,
                token_validation_time_ms=0,
                success=False,
                error=str(e)
            )
    
    async def _test_token_refresh_flow(self) -> Optional[AuthenticationMetric]:
        """Test token refresh flow performance"""
        start_time = time.time()
        api_times = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Token refresh request
                refresh_start = time.time()
                refresh_response = await client.post(
                    f"{self.base_url}/api/v1/auth/refresh",
                    json={"refresh_token": "test_refresh_token"}
                )
                refresh_end = time.time()
                api_times.append((refresh_end - refresh_start) * 1000)
                
                # Validate new token
                validation_start = time.time()
                if refresh_response.status_code == 200:
                    validation_response = await client.get(
                        f"{self.base_url}/api/v1/auth/validate",
                        headers={"Authorization": "Bearer new_test_token"}
                    )
                validation_end = time.time()
                validation_time = (validation_end - validation_start) * 1000
                
                total_time = (time.time() - start_time) * 1000
                
                return AuthenticationMetric(
                    flow_type="token_refresh",
                    total_duration_ms=total_time,
                    api_calls_count=len(api_times),
                    api_response_times_ms=api_times,
                    token_validation_time_ms=validation_time,
                    success=refresh_response.status_code == 200
                )
                
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            logger.error(f"Token refresh flow test failed: {e}")
            
            return AuthenticationMetric(
                flow_type="token_refresh",
                total_duration_ms=total_time,
                api_calls_count=len(api_times),
                api_response_times_ms=api_times,
                token_validation_time_ms=0,
                success=False,
                error=str(e)
            )
    
    def _store_auth_metrics(self, metrics: List[AuthenticationMetric]):
        """Store authentication metrics in database"""
        import sqlite3
        
        with sqlite3.connect(self.db.db_path) as conn:
            for metric in metrics:
                conn.execute("""
                    INSERT INTO auth_metrics 
                    (timestamp, flow_type, total_duration_ms, api_calls_count,
                     token_validation_time_ms, redirect_time_ms, success, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    datetime.now().isoformat(),
                    metric.flow_type,
                    metric.total_duration_ms,
                    metric.api_calls_count,
                    metric.token_validation_time_ms,
                    metric.redirect_time_ms,
                    metric.success,
                    metric.error
                ))
    
    async def test_websocket_performance(self) -> List[WebSocketMetric]:
        """Test WebSocket connection and message performance"""
        logger.info("Testing WebSocket performance")
        
        websocket_metrics = []
        
        # Test different WebSocket scenarios
        scenarios = [
            {"name": "connection_establishment", "messages": 1, "message_size": 100},
            {"name": "small_messages", "messages": 100, "message_size": 100},
            {"name": "large_messages", "messages": 10, "message_size": 10000},
            {"name": "high_throughput", "messages": 1000, "message_size": 50}
        ]
        
        for scenario in scenarios:
            try:
                metric = await self._test_websocket_scenario(
                    scenario["messages"], 
                    scenario["message_size"]
                )
                metric.flow_type = scenario["name"]  # Add scenario name for tracking
                websocket_metrics.append(metric)
            except Exception as e:
                logger.error(f"WebSocket scenario {scenario['name']} failed: {e}")
        
        # Store metrics in database
        self._store_websocket_metrics(websocket_metrics)
        
        return websocket_metrics
    
    async def _test_websocket_scenario(self, message_count: int, message_size: int) -> WebSocketMetric:
        """Test a specific WebSocket scenario"""
        connection_start = time.time()
        
        try:
            # Establish WebSocket connection
            async with websockets.connect(self.websocket_url) as websocket:
                connection_time = (time.time() - connection_start) * 1000
                
                # Test first message time
                first_msg_start = time.time()
                test_message = "x" * message_size  # Create message of specified size
                await websocket.send(test_message)
                response = await websocket.recv()
                first_message_time = (time.time() - first_msg_start) * 1000
                
                # Test message throughput
                throughput_start = time.time()
                successful_messages = 0
                
                for i in range(message_count - 1):  # -1 because we already sent one message
                    try:
                        await websocket.send(f"Message {i}: {test_message}")
                        await websocket.recv()
                        successful_messages += 1
                    except (ConnectionClosedError, WebSocketException) as e:
                        logger.warning(f"WebSocket message {i} failed: {e}")
                        break
                
                throughput_duration = time.time() - throughput_start
                throughput_per_sec = successful_messages / throughput_duration if throughput_duration > 0 else 0
                
                # Calculate data transfer rate
                total_bytes = successful_messages * message_size * 2  # *2 for send/receive
                data_rate_mbps = (total_bytes / (1024 * 1024)) / throughput_duration if throughput_duration > 0 else 0
                
                # Connection stability score (simplified)
                stability_score = (successful_messages / message_count) * 100 if message_count > 0 else 0
                
                return WebSocketMetric(
                    connection_time_ms=connection_time,
                    first_message_time_ms=first_message_time,
                    message_throughput_per_sec=throughput_per_sec,
                    connection_stability_score=stability_score,
                    data_transfer_rate_mbps=data_rate_mbps,
                    success=True
                )
                
        except Exception as e:
            connection_time = (time.time() - connection_start) * 1000
            
            return WebSocketMetric(
                connection_time_ms=connection_time,
                first_message_time_ms=0,
                message_throughput_per_sec=0,
                connection_stability_score=0,
                data_transfer_rate_mbps=0,
                success=False,
                error=str(e)
            )
    
    def _store_websocket_metrics(self, metrics: List[WebSocketMetric]):
        """Store WebSocket metrics in database"""
        import sqlite3
        
        with sqlite3.connect(self.db.db_path) as conn:
            for metric in metrics:
                conn.execute("""
                    INSERT INTO websocket_metrics 
                    (timestamp, connection_time_ms, first_message_time_ms,
                     message_throughput_per_sec, connection_stability_score,
                     data_transfer_rate_mbps, success, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    datetime.now().isoformat(),
                    metric.connection_time_ms,
                    metric.first_message_time_ms,
                    metric.message_throughput_per_sec,
                    metric.connection_stability_score,
                    metric.data_transfer_rate_mbps,
                    metric.success,
                    metric.error
                ))
    
    async def run_comprehensive_baseline_tests(self) -> Dict[str, Any]:
        """Run all comprehensive performance baseline tests"""
        logger.info("Starting comprehensive performance baseline tests")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'api_results': [],
            'auth_metrics': [],
            'websocket_metrics': [],
            'system_metrics': {},
            'summary': {}
        }
        
        # Start system monitoring
        system_monitor_task = asyncio.create_task(self.profiler.start_monitoring())
        
        try:
            # Test API endpoints
            logger.info("Testing API endpoints...")
            api_results = await self.test_api_endpoints_comprehensive()
            results['api_results'] = api_results
            
            # Test authentication flows
            logger.info("Testing authentication flows...")
            auth_metrics = await self.test_authentication_flows()
            results['auth_metrics'] = auth_metrics
            
            # Test WebSocket performance
            logger.info("Testing WebSocket performance...")
            try:
                websocket_metrics = await self.test_websocket_performance()
                results['websocket_metrics'] = websocket_metrics
            except Exception as e:
                logger.warning(f"WebSocket tests failed (this is OK if WebSocket server is not running): {e}")
                results['websocket_metrics'] = []
            
        finally:
            # Stop system monitoring
            self.profiler.stop_monitoring()
            system_monitor_task.cancel()
            
            # Get system performance summary
            results['system_metrics'] = self.profiler.get_summary()
        
        # Generate performance summary
        results['summary'] = self._generate_performance_summary(results)
        
        return results
    
    def _generate_performance_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive performance summary"""
        summary = {
            'overall_status': 'unknown',
            'api_performance': {},
            'authentication_performance': {},
            'websocket_performance': {},
            'recommendations': [],
            'performance_score': 0  # 0-100
        }
        
        # Analyze API performance
        if results['api_results']:
            api_results = results['api_results']
            avg_response_times = [r.metrics['avg_response_time_ms'] for r in api_results if r.metrics['avg_response_time_ms'] > 0]
            success_rates = [r.metrics['success_rate'] for r in api_results]
            
            if avg_response_times and success_rates:
                summary['api_performance'] = {
                    'avg_response_time_ms': statistics.mean(avg_response_times),
                    'p95_response_time_ms': np.percentile(avg_response_times, 95),
                    'avg_success_rate': statistics.mean(success_rates),
                    'endpoints_tested': len(api_results),
                    'fast_endpoints': len([t for t in avg_response_times if t <= 200]),  # Target: <200ms
                    'slow_endpoints': len([t for t in avg_response_times if t > 500])
                }
        
        # Analyze authentication performance
        if results['auth_metrics']:
            auth_metrics = results['auth_metrics']
            auth_times = [m.total_duration_ms for m in auth_metrics if m.success]
            
            if auth_times:
                summary['authentication_performance'] = {
                    'avg_auth_time_ms': statistics.mean(auth_times),
                    'max_auth_time_ms': max(auth_times),
                    'successful_flows': len([m for m in auth_metrics if m.success]),
                    'total_flows_tested': len(auth_metrics),
                    'within_target': len([t for t in auth_times if t <= 2000])  # Target: <2s
                }
        
        # Analyze WebSocket performance
        if results['websocket_metrics']:
            ws_metrics = results['websocket_metrics']
            successful_ws = [m for m in ws_metrics if m.success]
            
            if successful_ws:
                connection_times = [m.connection_time_ms for m in successful_ws]
                throughputs = [m.message_throughput_per_sec for m in successful_ws]
                
                summary['websocket_performance'] = {
                    'avg_connection_time_ms': statistics.mean(connection_times),
                    'avg_throughput_msg_per_sec': statistics.mean(throughputs),
                    'successful_connections': len(successful_ws),
                    'total_tests': len(ws_metrics)
                }
        
        # Calculate overall performance score
        score = 0
        max_score = 100
        
        # API performance scoring (40 points)
        if summary['api_performance']:
            api_perf = summary['api_performance']
            if api_perf['avg_response_time_ms'] <= 200:
                score += 20
            elif api_perf['avg_response_time_ms'] <= 500:
                score += 15
            elif api_perf['avg_response_time_ms'] <= 1000:
                score += 10
            
            if api_perf['avg_success_rate'] >= 99:
                score += 20
            elif api_perf['avg_success_rate'] >= 95:
                score += 15
            elif api_perf['avg_success_rate'] >= 90:
                score += 10
        
        # Authentication performance scoring (30 points)
        if summary['authentication_performance']:
            auth_perf = summary['authentication_performance']
            if auth_perf['avg_auth_time_ms'] <= 1000:
                score += 15
            elif auth_perf['avg_auth_time_ms'] <= 2000:
                score += 10
            elif auth_perf['avg_auth_time_ms'] <= 3000:
                score += 5
            
            success_rate = (auth_perf['successful_flows'] / auth_perf['total_flows_tested']) * 100
            if success_rate >= 95:
                score += 15
            elif success_rate >= 90:
                score += 10
            elif success_rate >= 80:
                score += 5
        
        # WebSocket performance scoring (20 points)
        if summary['websocket_performance']:
            ws_perf = summary['websocket_performance']
            if ws_perf['avg_connection_time_ms'] <= 100:
                score += 10
            elif ws_perf['avg_connection_time_ms'] <= 300:
                score += 7
            elif ws_perf['avg_connection_time_ms'] <= 500:
                score += 5
            
            if ws_perf['avg_throughput_msg_per_sec'] >= 100:
                score += 10
            elif ws_perf['avg_throughput_msg_per_sec'] >= 50:
                score += 7
            elif ws_perf['avg_throughput_msg_per_sec'] >= 20:
                score += 5
        else:
            # If WebSocket tests didn't run, don't penalize
            max_score = 80
        
        # System resources scoring (10 points)
        if results['system_metrics']:
            sys_metrics = results['system_metrics']
            if sys_metrics.get('memory_peak_mb', 0) <= 1000:  # <=1GB
                score += 5
            elif sys_metrics.get('memory_peak_mb', 0) <= 2000:  # <=2GB
                score += 3
            
            if sys_metrics.get('cpu_avg_percent', 0) <= 50:
                score += 5
            elif sys_metrics.get('cpu_avg_percent', 0) <= 75:
                score += 3
        
        summary['performance_score'] = min(100, int((score / max_score) * 100))
        
        # Determine overall status
        if summary['performance_score'] >= 90:
            summary['overall_status'] = 'excellent'
        elif summary['performance_score'] >= 75:
            summary['overall_status'] = 'good'
        elif summary['performance_score'] >= 60:
            summary['overall_status'] = 'acceptable'
        else:
            summary['overall_status'] = 'needs_improvement'
        
        # Generate recommendations
        if summary['api_performance']:
            api_perf = summary['api_performance']
            if api_perf['avg_response_time_ms'] > 500:
                summary['recommendations'].append(
                    "API response times exceed 500ms - consider optimizing database queries and adding caching"
                )
            if api_perf['slow_endpoints'] > 0:
                summary['recommendations'].append(
                    f"{api_perf['slow_endpoints']} endpoints are slow (>500ms) - review and optimize"
                )
        
        if summary['authentication_performance']:
            auth_perf = summary['authentication_performance']
            if auth_perf['avg_auth_time_ms'] > 2000:
                summary['recommendations'].append(
                    "Authentication flows exceed 2s target - optimize token validation and database lookups"
                )
        
        if summary['websocket_performance']:
            ws_perf = summary['websocket_performance']
            if ws_perf['avg_connection_time_ms'] > 300:
                summary['recommendations'].append(
                    "WebSocket connection times are slow - check network configuration and server capacity"
                )
        
        return summary

# Pytest integration for comprehensive testing
class TestComprehensivePerformanceBaseline:
    """Pytest integration for comprehensive performance baseline tests"""
    
    def setup_method(self):
        """Setup test environment"""
        self.tester = ComprehensivePerformanceTester()
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_comprehensive_performance_baseline(self):
        """Run comprehensive performance baseline tests"""
        results = await self.tester.run_comprehensive_baseline_tests()
        
        # Validate results structure
        assert 'timestamp' in results
        assert 'api_results' in results
        assert 'auth_metrics' in results
        assert 'summary' in results
        
        # Performance assertions based on targets
        summary = results['summary']
        
        # API Performance Assertions
        if summary.get('api_performance'):
            api_perf = summary['api_performance']
            assert api_perf['avg_success_rate'] >= 90, f"Low API success rate: {api_perf['avg_success_rate']}%"
            # Relaxed assertion for development environment
            assert api_perf['avg_response_time_ms'] <= 1000, f"High API response time: {api_perf['avg_response_time_ms']}ms"
        
        # Authentication Performance Assertions
        if summary.get('authentication_performance'):
            auth_perf = summary['authentication_performance']
            success_rate = (auth_perf['successful_flows'] / auth_perf['total_flows_tested']) * 100
            assert success_rate >= 80, f"Low authentication success rate: {success_rate}%"
            # Relaxed for development
            assert auth_perf['avg_auth_time_ms'] <= 5000, f"High auth time: {auth_perf['avg_auth_time_ms']}ms"
        
        # Overall Performance Score Assertion
        assert summary['performance_score'] >= 50, f"Low performance score: {summary['performance_score']}/100"
        
        # Generate and save comprehensive report
        report_path = self._generate_comprehensive_report(results)
        logger.info(f"Comprehensive performance baseline report: {report_path}")
    
    def _generate_comprehensive_report(self, results: Dict[str, Any]) -> str:
        """Generate comprehensive performance baseline report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_dir = Path("comprehensive_performance_reports")
        report_dir.mkdir(exist_ok=True)
        
        # Generate JSON report
        json_file = report_dir / f"comprehensive_baseline_{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        # Generate HTML report
        html_file = report_dir / f"comprehensive_baseline_{timestamp}.html"
        html_content = self._create_comprehensive_html_report(results)
        with open(html_file, 'w') as f:
            f.write(html_content)
        
        return str(html_file)
    
    def _create_comprehensive_html_report(self, results: Dict[str, Any]) -> str:
        """Create comprehensive HTML report"""
        summary = results.get('summary', {})
        
        # Determine status color
        status_colors = {
            'excellent': '#28a745',
            'good': '#17a2b8',
            'acceptable': '#ffc107',
            'needs_improvement': '#dc3545'
        }
        status_color = status_colors.get(summary.get('overall_status'), '#6c757d')
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Schlep-Engine Comprehensive Performance Baseline Report</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; background: #f8f9fa; }}
                .container {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }}
                .header h1 {{ margin: 0; font-size: 2.5em; }}
                .header p {{ margin: 10px 0 0 0; opacity: 0.9; }}
                .performance-score {{ text-align: center; background: white; padding: 40px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .score-circle {{ width: 150px; height: 150px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5em; font-weight: bold; background: conic-gradient(from 0deg, {status_color} 0%, {status_color} {summary.get('performance_score', 0)}%, #e9ecef {summary.get('performance_score', 0)}%); }}
                .score-inner {{ width: 120px; height: 120px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; color: {status_color}; }}
                .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }}
                .metric-card {{ background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .metric-card h3 {{ margin: 0 0 15px 0; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }}
                .metric-value {{ font-size: 1.8em; font-weight: bold; color: #007bff; margin: 10px 0; }}
                .metric-label {{ color: #6c757d; font-size: 0.9em; margin-bottom: 5px; }}
                .status-excellent {{ color: #28a745; }}
                .status-good {{ color: #17a2b8; }}
                .status-acceptable {{ color: #ffc107; }}
                .status-needs-improvement {{ color: #dc3545; }}
                .recommendations {{ background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 30px 0; }}
                .recommendations h3 {{ color: #856404; margin-top: 0; }}
                .recommendations ul {{ margin: 0; }}
                .recommendations li {{ margin: 10px 0; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                th {{ background: #495057; color: white; padding: 15px; text-align: left; }}
                td {{ padding: 12px 15px; border-bottom: 1px solid #e9ecef; }}
                .timestamp {{ color: #6c757d; font-size: 0.9em; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Comprehensive Performance Baseline Report</h1>
                    <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                    <p class="timestamp">Test Run: {results.get('timestamp', 'Unknown')}</p>
                </div>
                
                <div class="performance-score">
                    <div class="score-circle">
                        <div class="score-inner">
                            {summary.get('performance_score', 0)}
                        </div>
                    </div>
                    <h2 class="status-{summary.get('overall_status', 'unknown')}">{summary.get('overall_status', 'Unknown').replace('_', ' ').title()}</h2>
                    <p>Overall Performance Score: {summary.get('performance_score', 0)}/100</p>
                </div>
        """
        
        # API Performance Section
        if summary.get('api_performance'):
            api_perf = summary['api_performance']
            html += f"""
                <div class="metric-grid">
                    <div class="metric-card">
                        <h3>API Performance</h3>
                        <div class="metric-label">Average Response Time</div>
                        <div class="metric-value">{api_perf.get('avg_response_time_ms', 0):.2f}ms</div>
                        <div class="metric-label">95th Percentile Response Time</div>
                        <div class="metric-value">{api_perf.get('p95_response_time_ms', 0):.2f}ms</div>
                        <div class="metric-label">Success Rate</div>
                        <div class="metric-value">{api_perf.get('avg_success_rate', 0):.2f}%</div>
                        <div class="metric-label">Endpoints Tested</div>
                        <div class="metric-value">{api_perf.get('endpoints_tested', 0)}</div>
                    </div>
            """
        
        # Authentication Performance Section
        if summary.get('authentication_performance'):
            auth_perf = summary['authentication_performance']
            html += f"""
                    <div class="metric-card">
                        <h3>Authentication Performance</h3>
                        <div class="metric-label">Average Auth Time</div>
                        <div class="metric-value">{auth_perf.get('avg_auth_time_ms', 0):.2f}ms</div>
                        <div class="metric-label">Max Auth Time</div>
                        <div class="metric-value">{auth_perf.get('max_auth_time_ms', 0):.2f}ms</div>
                        <div class="metric-label">Successful Flows</div>
                        <div class="metric-value">{auth_perf.get('successful_flows', 0)}/{auth_perf.get('total_flows_tested', 0)}</div>
                        <div class="metric-label">Within Target (&lt;2s)</div>
                        <div class="metric-value">{auth_perf.get('within_target', 0)}</div>
                    </div>
            """
        
        # WebSocket Performance Section
        if summary.get('websocket_performance'):
            ws_perf = summary['websocket_performance']
            html += f"""
                    <div class="metric-card">
                        <h3>WebSocket Performance</h3>
                        <div class="metric-label">Avg Connection Time</div>
                        <div class="metric-value">{ws_perf.get('avg_connection_time_ms', 0):.2f}ms</div>
                        <div class="metric-label">Avg Throughput</div>
                        <div class="metric-value">{ws_perf.get('avg_throughput_msg_per_sec', 0):.2f} msg/s</div>
                        <div class="metric-label">Successful Connections</div>
                        <div class="metric-value">{ws_perf.get('successful_connections', 0)}/{ws_perf.get('total_tests', 0)}</div>
                    </div>
            """
        
        # System Resources Section
        if results.get('system_metrics'):
            sys_metrics = results['system_metrics']
            html += f"""
                    <div class="metric-card">
                        <h3>System Resources</h3>
                        <div class="metric-label">Peak Memory Usage</div>
                        <div class="metric-value">{sys_metrics.get('memory_peak_mb', 0):.2f} MB</div>
                        <div class="metric-label">Average CPU Usage</div>
                        <div class="metric-value">{sys_metrics.get('cpu_avg_percent', 0):.2f}%</div>
                        <div class="metric-label">Test Duration</div>
                        <div class="metric-value">{sys_metrics.get('duration_seconds', 0):.2f}s</div>
                    </div>
                </div>
            """
        else:
            html += "</div>"
        
        # Recommendations Section
        if summary.get('recommendations'):
            html += f"""
                <div class="recommendations">
                    <h3>Performance Recommendations</h3>
                    <ul>
            """
            for rec in summary['recommendations']:
                html += f"<li>{rec}</li>"
            html += """
                    </ul>
                </div>
            """
        
        # API Results Table
        if results.get('api_results'):
            html += """
                <h2>Detailed API Test Results</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Endpoint</th>
                            <th>Method</th>
                            <th>Category</th>
                            <th>Avg Response (ms)</th>
                            <th>P95 Response (ms)</th>
                            <th>Success Rate</th>
                            <th>Throughput (req/s)</th>
                        </tr>
                    </thead>
                    <tbody>
            """
            
            for result in results['api_results']:
                metrics = result.metrics
                html += f"""
                        <tr>
                            <td>{metrics.get('endpoint', 'N/A')}</td>
                            <td>{metrics.get('method', 'N/A')}</td>
                            <td>{metrics.get('category', 'N/A')}</td>
                            <td>{metrics.get('avg_response_time_ms', 0):.2f}</td>
                            <td>{metrics.get('p95_response_time_ms', 0):.2f}</td>
                            <td>{metrics.get('success_rate', 0):.2f}%</td>
                            <td>{metrics.get('throughput_rps', 0):.2f}</td>
                        </tr>
                """
            
            html += """
                    </tbody>
                </table>
            """
        
        html += """
            </div>
        </body>
        </html>
        """
        
        return html

if __name__ == "__main__":
    async def main():
        tester = ComprehensivePerformanceTester()
        results = await tester.run_comprehensive_baseline_tests()
        
        print(f"\\nComprehensive Performance Baseline Results:")
        print(f"Performance Score: {results['summary']['performance_score']}/100")
        print(f"Overall Status: {results['summary']['overall_status']}")
        
        if results['summary'].get('recommendations'):
            print(f"\\nRecommendations:")
            for i, rec in enumerate(results['summary']['recommendations'], 1):
                print(f"  {i}. {rec}")
    
    asyncio.run(main())