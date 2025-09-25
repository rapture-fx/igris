#!/usr/bin/env python3
"""
Schlep Engine Production Load Testing
Comprehensive load testing for 500-1000 concurrent users
Tests core endpoints with realistic data patterns
"""

import asyncio
import aiohttp
import time
import json
import pandas as pd
import numpy as np
import tempfile
import os
import psutil
import logging
from datetime import datetime
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import csv
from io import StringIO
import multiprocessing as mp
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LoadTestConfig:
    """Configuration for load testing"""
    base_url: str = "http://localhost:8000"
    concurrent_users: int = 500
    test_duration_seconds: int = 300  # 5 minutes
    ramp_up_seconds: int = 60
    endpoints_to_test: List[str] = None
    csv_file_sizes_mb: List[int] = None

    def __post_init__(self):
        if self.endpoints_to_test is None:
            self.endpoints_to_test = ['/health', '/upload_csv', '/process_data', '/train_model']
        if self.csv_file_sizes_mb is None:
            self.csv_file_sizes_mb = [1, 5, 10, 25]

@dataclass
class TestResult:
    """Individual test result"""
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    payload_size_bytes: int
    timestamp: str
    error_message: str = None
    user_id: int = None

@dataclass
class PerformanceMetrics:
    """Performance metrics summary"""
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    requests_per_second: float
    errors_per_second: float
    total_bytes_transferred: int
    concurrent_users_peak: int

class LoadTestDataGenerator:
    """Generate realistic test data for load testing"""

    @staticmethod
    def generate_csv_data(size_mb: int) -> str:
        """Generate CSV data of specified size"""
        # Calculate approximate rows needed for target size
        # Assuming ~100 bytes per row on average
        target_bytes = size_mb * 1024 * 1024
        estimated_rows = target_bytes // 100

        # Generate synthetic data
        data = {
            'id': range(1, estimated_rows + 1),
            'timestamp': [f"2024-12-{(i%28)+1:02d}T{i%24:02d}:{i%60:02d}:{i%60:02d}"
                         for i in range(estimated_rows)],
            'category': [f"category_{i%20}" for i in range(estimated_rows)],
            'value': np.random.uniform(0, 1000, estimated_rows),
            'status': np.random.choice(['active', 'inactive', 'pending', 'processing'], estimated_rows),
            'score': np.random.normal(50, 15, estimated_rows),
            'region': np.random.choice(['north', 'south', 'east', 'west', 'central'], estimated_rows),
            'description': [f"Data entry {i} with additional information for size padding"
                           for i in range(estimated_rows)]
        }

        # Convert to CSV string
        df = pd.DataFrame(data)
        return df.to_csv(index=False)

    @staticmethod
    def generate_training_data() -> Dict[str, Any]:
        """Generate data for model training endpoint"""
        return {
            "features": np.random.rand(1000, 10).tolist(),
            "target": np.random.randint(0, 2, 1000).tolist(),
            "model_type": "classification",
            "hyperparameters": {
                "n_estimators": 100,
                "max_depth": 5,
                "random_state": 42
            }
        }

class AsyncLoadTester:
    """Asynchronous load tester for high concurrency"""

    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[TestResult] = []
        self.active_users = 0
        self.max_active_users = 0
        self.test_start_time = None
        self.generated_files = {}  # Cache for generated CSV files

    async def create_session(self) -> aiohttp.ClientSession:
        """Create HTTP session with appropriate timeouts"""
        timeout = aiohttp.ClientTimeout(total=300, connect=30)
        connector = aiohttp.TCPConnector(limit=1000, limit_per_host=100)
        return aiohttp.ClientSession(timeout=timeout, connector=connector)

    async def test_health_endpoint(self, session: aiohttp.ClientSession, user_id: int) -> TestResult:
        """Test health check endpoint"""
        start_time = time.time()

        try:
            async with session.get(f"{self.config.base_url}/health") as response:
                content = await response.text()
                response_time_ms = (time.time() - start_time) * 1000

                return TestResult(
                    endpoint="/health",
                    method="GET",
                    status_code=response.status,
                    response_time_ms=response_time_ms,
                    payload_size_bytes=len(content),
                    timestamp=datetime.now().isoformat(),
                    user_id=user_id
                )

        except Exception as e:
            return TestResult(
                endpoint="/health",
                method="GET",
                status_code=0,
                response_time_ms=(time.time() - start_time) * 1000,
                payload_size_bytes=0,
                timestamp=datetime.now().isoformat(),
                error_message=str(e),
                user_id=user_id
            )

    async def test_upload_csv_endpoint(self, session: aiohttp.ClientSession, user_id: int) -> TestResult:
        """Test CSV upload endpoint"""
        start_time = time.time()

        # Select file size (cycle through available sizes)
        file_size = self.config.csv_file_sizes_mb[user_id % len(self.config.csv_file_sizes_mb)]

        # Generate or retrieve cached CSV data
        cache_key = f"csv_{file_size}mb"
        if cache_key not in self.generated_files:
            csv_data = LoadTestDataGenerator.generate_csv_data(file_size)
            self.generated_files[cache_key] = csv_data
        else:
            csv_data = self.generated_files[cache_key]

        try:
            # Create form data
            data = aiohttp.FormData()
            data.add_field('file', csv_data, filename=f'test_data_{file_size}mb.csv',
                          content_type='text/csv')

            async with session.post(f"{self.config.base_url}/upload_csv", data=data) as response:
                content = await response.text()
                response_time_ms = (time.time() - start_time) * 1000

                return TestResult(
                    endpoint="/upload_csv",
                    method="POST",
                    status_code=response.status,
                    response_time_ms=response_time_ms,
                    payload_size_bytes=len(csv_data),
                    timestamp=datetime.now().isoformat(),
                    user_id=user_id
                )

        except Exception as e:
            return TestResult(
                endpoint="/upload_csv",
                method="POST",
                status_code=0,
                response_time_ms=(time.time() - start_time) * 1000,
                payload_size_bytes=len(csv_data) if 'csv_data' in locals() else 0,
                timestamp=datetime.now().isoformat(),
                error_message=str(e),
                user_id=user_id
            )

    async def test_process_data_endpoint(self, session: aiohttp.ClientSession, user_id: int) -> TestResult:
        """Test data processing endpoint"""
        start_time = time.time()

        payload = {
            "data": {
                "values": np.random.rand(1000).tolist(),
                "categories": [f"cat_{i%10}" for i in range(1000)]
            },
            "operations": [
                {"type": "filter", "column": "values", "operator": ">", "value": 0.5},
                {"type": "groupby", "columns": ["categories"], "agg": {"values": "mean"}}
            ]
        }

        try:
            async with session.post(
                f"{self.config.base_url}/process_data",
                json=payload,
                headers={'Content-Type': 'application/json'}
            ) as response:
                content = await response.text()
                response_time_ms = (time.time() - start_time) * 1000

                return TestResult(
                    endpoint="/process_data",
                    method="POST",
                    status_code=response.status,
                    response_time_ms=response_time_ms,
                    payload_size_bytes=len(json.dumps(payload)),
                    timestamp=datetime.now().isoformat(),
                    user_id=user_id
                )

        except Exception as e:
            return TestResult(
                endpoint="/process_data",
                method="POST",
                status_code=0,
                response_time_ms=(time.time() - start_time) * 1000,
                payload_size_bytes=len(json.dumps(payload)),
                timestamp=datetime.now().isoformat(),
                error_message=str(e),
                user_id=user_id
            )

    async def test_train_model_endpoint(self, session: aiohttp.ClientSession, user_id: int) -> TestResult:
        """Test model training endpoint (scikit-learn baseline)"""
        start_time = time.time()

        payload = LoadTestDataGenerator.generate_training_data()

        try:
            async with session.post(
                f"{self.config.base_url}/train_model",
                json=payload,
                headers={'Content-Type': 'application/json'}
            ) as response:
                content = await response.text()
                response_time_ms = (time.time() - start_time) * 1000

                return TestResult(
                    endpoint="/train_model",
                    method="POST",
                    status_code=response.status,
                    response_time_ms=response_time_ms,
                    payload_size_bytes=len(json.dumps(payload, default=str)),
                    timestamp=datetime.now().isoformat(),
                    user_id=user_id
                )

        except Exception as e:
            return TestResult(
                endpoint="/train_model",
                method="POST",
                status_code=0,
                response_time_ms=(time.time() - start_time) * 1000,
                payload_size_bytes=len(json.dumps(payload, default=str)),
                timestamp=datetime.now().isoformat(),
                error_message=str(e),
                user_id=user_id
            )

    async def simulate_user(self, session: aiohttp.ClientSession, user_id: int):
        """Simulate a single user's behavior"""
        self.active_users += 1
        self.max_active_users = max(self.max_active_users, self.active_users)

        try:
            # Simulate realistic user behavior patterns
            endpoints = {
                '/health': self.test_health_endpoint,
                '/upload_csv': self.test_upload_csv_endpoint,
                '/process_data': self.test_process_data_endpoint,
                '/train_model': self.test_train_model_endpoint
            }

            # Weight endpoints by likely usage patterns
            endpoint_weights = {
                '/health': 0.4,      # High frequency health checks
                '/upload_csv': 0.3,  # Regular file uploads
                '/process_data': 0.2, # Data processing requests
                '/train_model': 0.1   # Occasional model training
            }

            test_end_time = self.test_start_time + self.config.test_duration_seconds

            while time.time() < test_end_time:
                # Select endpoint based on weights
                endpoint = np.random.choice(
                    list(endpoint_weights.keys()),
                    p=list(endpoint_weights.values())
                )

                if endpoint in self.config.endpoints_to_test:
                    result = await endpoints[endpoint](session, user_id)
                    self.results.append(result)

                # Realistic delay between requests (1-5 seconds)
                await asyncio.sleep(np.random.uniform(1, 5))

        except Exception as e:
            logger.error(f"User {user_id} simulation error: {e}")
        finally:
            self.active_users -= 1

    async def run_load_test(self) -> Dict[str, Any]:
        """Execute the full load test"""
        self.test_start_time = time.time()
        system_metrics_start = self._collect_system_metrics()

        logger.info(f"Starting load test with {self.config.concurrent_users} concurrent users")
        logger.info(f"Test duration: {self.config.test_duration_seconds} seconds")
        logger.info(f"Ramp-up period: {self.config.ramp_up_seconds} seconds")

        async with self.create_session() as session:
            # Create user tasks with ramp-up
            tasks = []
            ramp_up_delay = self.config.ramp_up_seconds / self.config.concurrent_users

            for user_id in range(self.config.concurrent_users):
                # Stagger user start times during ramp-up period
                delay = user_id * ramp_up_delay
                task = asyncio.create_task(self._delayed_user_start(session, user_id, delay))
                tasks.append(task)

            # Wait for all user simulations to complete
            await asyncio.gather(*tasks, return_exceptions=True)

        total_test_time = time.time() - self.test_start_time
        system_metrics_end = self._collect_system_metrics()

        # Calculate performance metrics
        metrics = self._calculate_performance_metrics(total_test_time)

        return {
            "test_config": asdict(self.config),
            "test_duration_actual": total_test_time,
            "performance_metrics": asdict(metrics),
            "system_metrics": {
                "start": system_metrics_start,
                "end": system_metrics_end
            },
            "detailed_results": [asdict(r) for r in self.results],
            "summary": self._generate_summary_report(metrics)
        }

    async def _delayed_user_start(self, session: aiohttp.ClientSession, user_id: int, delay: float):
        """Start user simulation after specified delay"""
        await asyncio.sleep(delay)
        await self.simulate_user(session, user_id)

    def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect current system metrics"""
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=1)

        return {
            "timestamp": datetime.now().isoformat(),
            "memory_used_gb": memory.used / (1024**3),
            "memory_available_gb": memory.available / (1024**3),
            "memory_percent": memory.percent,
            "cpu_percent": cpu_percent,
            "cpu_count": psutil.cpu_count()
        }

    def _calculate_performance_metrics(self, total_time: float) -> PerformanceMetrics:
        """Calculate comprehensive performance metrics"""
        if not self.results:
            return PerformanceMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

        successful_results = [r for r in self.results if r.error_message is None and r.status_code < 400]
        failed_results = [r for r in self.results if r.error_message is not None or r.status_code >= 400]

        response_times = [r.response_time_ms for r in successful_results]

        return PerformanceMetrics(
            total_requests=len(self.results),
            successful_requests=len(successful_results),
            failed_requests=len(failed_results),
            average_response_time_ms=np.mean(response_times) if response_times else 0,
            p95_response_time_ms=np.percentile(response_times, 95) if response_times else 0,
            p99_response_time_ms=np.percentile(response_times, 99) if response_times else 0,
            requests_per_second=len(self.results) / total_time if total_time > 0 else 0,
            errors_per_second=len(failed_results) / total_time if total_time > 0 else 0,
            total_bytes_transferred=sum(r.payload_size_bytes for r in self.results),
            concurrent_users_peak=self.max_active_users
        )

    def _generate_summary_report(self, metrics: PerformanceMetrics) -> Dict[str, Any]:
        """Generate human-readable summary report"""
        success_rate = (metrics.successful_requests / metrics.total_requests * 100) if metrics.total_requests > 0 else 0

        return {
            "overall_success_rate_percent": success_rate,
            "total_data_transferred_mb": metrics.total_bytes_transferred / (1024 * 1024),
            "average_throughput_mbps": (metrics.total_bytes_transferred / (1024 * 1024)) / (self.config.test_duration_seconds / 8),
            "performance_rating": "excellent" if success_rate > 95 and metrics.average_response_time_ms < 500
                                else "good" if success_rate > 90 and metrics.average_response_time_ms < 1000
                                else "acceptable" if success_rate > 80 and metrics.average_response_time_ms < 2000
                                else "poor"
        }

def run_concurrent_load_test(concurrent_users: int = 500):
    """Run load test with specified number of concurrent users"""
    config = LoadTestConfig(
        concurrent_users=concurrent_users,
        test_duration_seconds=300,  # 5 minutes
        ramp_up_seconds=60
    )

    tester = AsyncLoadTester(config)

    # Run the async load test
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        results = loop.run_until_complete(tester.run_load_test())
        return results
    finally:
        loop.close()

def save_results_to_json(results: Dict[str, Any], filename: str = None):
    """Save test results to JSON file"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"load_test_results_{timestamp}.json"

    with open(filename, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    logger.info(f"Load test results saved to: {filename}")
    return filename

def print_summary_report(results: Dict[str, Any]):
    """Print formatted summary report"""
    config = results['test_config']
    metrics = results['performance_metrics']
    summary = results['summary']

    print("=" * 80)
    print("SCHLEP ENGINE LOAD TEST RESULTS")
    print("=" * 80)

    print(f"\n📊 Test Configuration:")
    print(f"   Concurrent Users: {config['concurrent_users']}")
    print(f"   Test Duration: {config['test_duration_seconds']} seconds")
    print(f"   Endpoints Tested: {', '.join(config['endpoints_to_test'])}")

    print(f"\n🚀 Performance Metrics:")
    print(f"   Total Requests: {metrics['total_requests']:,}")
    print(f"   Successful: {metrics['successful_requests']:,} ({summary['overall_success_rate_percent']:.1f}%)")
    print(f"   Failed: {metrics['failed_requests']:,}")
    print(f"   Requests/Second: {metrics['requests_per_second']:.2f}")

    print(f"\n⏱️ Response Times:")
    print(f"   Average: {metrics['average_response_time_ms']:.2f}ms")
    print(f"   95th Percentile: {metrics['p95_response_time_ms']:.2f}ms")
    print(f"   99th Percentile: {metrics['p99_response_time_ms']:.2f}ms")

    print(f"\n📈 Throughput:")
    print(f"   Data Transferred: {summary['total_data_transferred_mb']:.2f} MB")
    print(f"   Peak Concurrent Users: {metrics['concurrent_users_peak']}")

    print(f"\n🎯 Overall Rating: {summary['performance_rating'].upper()}")

if __name__ == "__main__":
    print("Starting Schlep Engine Load Test...")

    # Test with 500 concurrent users
    results_500 = run_concurrent_load_test(concurrent_users=500)
    filename_500 = save_results_to_json(results_500, "load_test_500_users.json")

    print("\n" + "="*60)
    print("500 CONCURRENT USERS TEST")
    print("="*60)
    print_summary_report(results_500)

    # Test with 1000 concurrent users
    print("\n" + "="*60)
    print("STARTING 1000 CONCURRENT USERS TEST...")
    print("="*60)

    results_1000 = run_concurrent_load_test(concurrent_users=1000)
    filename_1000 = save_results_to_json(results_1000, "load_test_1000_users.json")

    print("\n" + "="*60)
    print("1000 CONCURRENT USERS TEST")
    print("="*60)
    print_summary_report(results_1000)

    print(f"\n📁 Results saved to:")
    print(f"   - {filename_500}")
    print(f"   - {filename_1000}")

    print("\n✅ Load testing completed successfully!")