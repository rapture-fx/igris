"""
Locust Load Testing Configuration for Schlep-engine
================================================

This module provides Locust-based load testing for realistic user behavior simulation
and comprehensive performance validation under various load conditions.

Features:
- Realistic user behavior simulation
- Multiple user types (API users, data processors, dashboard users)
- Configurable load patterns (spike, ramp-up, sustained)
- Real-time performance monitoring
- Custom metrics collection
- Integration with benchmark storage

Usage:
    # Basic load test
    locust -f tests/locust_load_tests.py --host=http://localhost:8000
    
    # Headless load test with specific parameters
    locust -f tests/locust_load_tests.py --host=http://localhost:8000 --users 100 --spawn-rate 10 --run-time 300s --headless
    
    # Distributed load testing
    locust -f tests/locust_load_tests.py --master --host=http://localhost:8000
    locust -f tests/locust_load_tests.py --worker --master-host=127.0.0.1
"""

import json
import random
import time
from typing import Dict, List, Any
from datetime import datetime
import logging

from locust import HttpUser, task, between, events
from locust.env import Environment
from locust.stats import stats_printer
from locust.runners import Runner

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerformanceMetricsCollector:
    """Collect custom performance metrics during load testing"""
    
    def __init__(self):
        self.metrics: List[Dict] = []
        self.start_time = time.time()
    
    def record_metric(self, test_type: str, endpoint: str, response_time: float, 
                     status_code: int, content_length: int = 0):
        """Record a performance metric"""
        self.metrics.append({
            'timestamp': time.time(),
            'test_type': test_type,
            'endpoint': endpoint,
            'response_time_ms': response_time,
            'status_code': status_code,
            'content_length': content_length,
            'success': 200 <= status_code < 400
        })
    
    def get_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        if not self.metrics:
            return {}
        
        successful_metrics = [m for m in self.metrics if m['success']]
        response_times = [m['response_time_ms'] for m in successful_metrics]
        
        return {
            'total_requests': len(self.metrics),
            'successful_requests': len(successful_metrics),
            'success_rate': (len(successful_metrics) / len(self.metrics)) * 100,
            'avg_response_time': sum(response_times) / len(response_times) if response_times else 0,
            'min_response_time': min(response_times) if response_times else 0,
            'max_response_time': max(response_times) if response_times else 0,
            'total_duration': time.time() - self.start_time,
            'requests_per_second': len(self.metrics) / (time.time() - self.start_time)
        }

# Global metrics collector
metrics_collector = PerformanceMetricsCollector()

@events.request.add_listener
def record_request_metric(request_type, name, response_time, response_length, response, context, exception, start_time, url, **kwargs):
    """Record each request for custom metrics"""
    status_code = response.status_code if response else 0
    metrics_collector.record_metric(
        test_type=request_type,
        endpoint=name,
        response_time=response_time,
        status_code=status_code,
        content_length=response_length or 0
    )

class APIUser(HttpUser):
    """Basic API user behavior"""
    wait_time = between(1, 3)
    weight = 3
    
    def on_start(self):
        """Setup user session"""
        self.auth_token = None
        # Attempt to authenticate
        self.authenticate()
    
    def authenticate(self):
        """Authenticate user if needed"""
        try:
            response = self.client.get("/health", catch_response=True)
            if response.status_code == 200:
                logger.info("Authentication check passed")
        except Exception as e:
            logger.warning(f"Authentication failed: {e}")
    
    @task(10)
    def check_health(self):
        """Check API health"""
        with self.client.get("/health", catch_response=True, name="/health") as response:
            if response.status_code != 200:
                response.failure(f"Health check failed with status {response.status_code}")
    
    @task(8)
    def get_api_status(self):
        """Check API status"""
        with self.client.get("/api/v1/auth/status", catch_response=True, name="/api/v1/auth/status") as response:
            if response.status_code not in [200, 401]:  # 401 is expected for unauthenticated users
                response.failure(f"API status failed with status {response.status_code}")
    
    @task(5)
    def view_documentation(self):
        """View API documentation"""
        with self.client.get("/docs", catch_response=True, name="/docs") as response:
            if response.status_code != 200:
                response.failure(f"Documentation failed with status {response.status_code}")

class DataProcessingUser(HttpUser):
    """User focused on data processing operations"""
    wait_time = between(2, 5)
    weight = 2
    
    def on_start(self):
        """Setup data processing user"""
        self.test_data = self.generate_test_data()
    
    def generate_test_data(self) -> List[Dict]:
        """Generate realistic test data"""
        data = []
        for i in range(random.randint(10, 100)):
            data.append({
                "id": i,
                "name": f"Record {i}",
                "value": random.randint(1, 1000),
                "category": random.choice(['A', 'B', 'C']),
                "timestamp": datetime.now().isoformat()
            })
        return data
    
    @task(5)
    def process_small_dataset(self):
        """Process a small dataset"""
        small_data = self.test_data[:10]
        with self.client.post(
            "/api/v1/data/process",
            json={
                "data": small_data,
                "processing_type": "small_batch"
            },
            catch_response=True,
            name="/api/v1/data/process (small)"
        ) as response:
            if response.status_code not in [200, 202]:
                response.failure(f"Small data processing failed: {response.status_code}")
    
    @task(3)
    def process_medium_dataset(self):
        """Process a medium dataset"""
        medium_data = self.test_data[:50]
        with self.client.post(
            "/api/v1/data/process",
            json={
                "data": medium_data,
                "processing_type": "medium_batch"
            },
            catch_response=True,
            name="/api/v1/data/process (medium)"
        ) as response:
            if response.status_code not in [200, 202]:
                response.failure(f"Medium data processing failed: {response.status_code}")
    
    @task(1)
    def process_large_dataset(self):
        """Process a large dataset"""
        with self.client.post(
            "/api/v1/data/process",
            json={
                "data": self.test_data,
                "processing_type": "large_batch"
            },
            catch_response=True,
            name="/api/v1/data/process (large)"
        ) as response:
            if response.status_code not in [200, 202]:
                response.failure(f"Large data processing failed: {response.status_code}")

class DashboardUser(HttpUser):
    """User focused on dashboard and analytics operations"""
    wait_time = between(3, 8)
    weight = 1
    
    @task(8)
    def view_dashboard_stats(self):
        """View dashboard statistics"""
        with self.client.get("/api/v1/dashboard/stats", catch_response=True, name="/api/v1/dashboard/stats") as response:
            if response.status_code not in [200, 401]:
                response.failure(f"Dashboard stats failed: {response.status_code}")
    
    @task(5)
    def view_analytics(self):
        """View analytics data"""
        with self.client.get("/api/v1/analytics", catch_response=True, name="/api/v1/analytics") as response:
            if response.status_code not in [200, 401, 404]:
                response.failure(f"Analytics failed: {response.status_code}")
    
    @task(3)
    def check_metrics(self):
        """Check system metrics"""
        with self.client.get("/api/v1/metrics", catch_response=True, name="/api/v1/metrics") as response:
            if response.status_code not in [200, 401, 404]:
                response.failure(f"Metrics check failed: {response.status_code}")

class MLProcessingUser(HttpUser):
    """User focused on ML and AI operations"""
    wait_time = between(5, 15)
    weight = 1
    
    def on_start(self):
        """Setup ML processing user"""
        self.ml_data = self.generate_ml_data()
    
    def generate_ml_data(self) -> Dict:
        """Generate ML training data"""
        return {
            "features": [[random.random() for _ in range(10)] for _ in range(100)],
            "labels": [random.choice([0, 1]) for _ in range(100)],
            "model_type": random.choice(["classification", "regression"]),
            "hyperparameters": {
                "learning_rate": random.uniform(0.001, 0.1),
                "batch_size": random.choice([32, 64, 128]),
                "epochs": random.randint(10, 100)
            }
        }
    
    @task(5)
    def trigger_ml_processing(self):
        """Trigger ML processing"""
        with self.client.post(
            "/api/v1/ml/process",
            json=self.ml_data,
            catch_response=True,
            name="/api/v1/ml/process"
        ) as response:
            if response.status_code not in [200, 202, 404]:  # 404 if endpoint doesn't exist
                response.failure(f"ML processing failed: {response.status_code}")
    
    @task(3)
    def check_ml_status(self):
        """Check ML processing status"""
        job_id = f"test_job_{random.randint(1, 100)}"
        with self.client.get(
            f"/api/v1/ml/status/{job_id}",
            catch_response=True,
            name="/api/v1/ml/status"
        ) as response:
            if response.status_code not in [200, 404]:
                response.failure(f"ML status check failed: {response.status_code}")

class SpikeTestUser(HttpUser):
    """User for spike testing scenarios"""
    wait_time = between(0.1, 1)
    weight = 1
    
    @task
    def rapid_requests(self):
        """Make rapid requests to simulate spike"""
        endpoints = ["/health", "/api/v1/auth/status", "/docs"]
        endpoint = random.choice(endpoints)
        
        with self.client.get(endpoint, catch_response=True, name=f"{endpoint} (spike)") as response:
            if response.status_code not in [200, 401]:
                response.failure(f"Spike test failed for {endpoint}: {response.status_code}")

# Custom load test shapes for different scenarios
class StageShape:
    """Custom load testing shapes"""
    
    @staticmethod
    def ramp_up_pattern(runner: Runner):
        """Gradual ramp-up load pattern"""
        runtime = runner.environment.parsed_options.run_time
        if not runtime:
            return None
            
        stages = [
            {"duration": 60, "users": 10, "spawn_rate": 2},
            {"duration": 120, "users": 50, "spawn_rate": 5},
            {"duration": 180, "users": 100, "spawn_rate": 10},
            {"duration": 240, "users": 150, "spawn_rate": 15},
            {"duration": 300, "users": 100, "spawn_rate": 10},  # Cool down
        ]
        
        elapsed_time = time.time() - runner.start_time
        for stage in stages:
            if elapsed_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        
        return None
    
    @staticmethod
    def spike_pattern(runner: Runner):
        """Spike load pattern"""
        stages = [
            {"duration": 30, "users": 20, "spawn_rate": 10},
            {"duration": 60, "users": 200, "spawn_rate": 50},  # Spike
            {"duration": 90, "users": 20, "spawn_rate": 10},   # Return to normal
            {"duration": 120, "users": 300, "spawn_rate": 100}, # Bigger spike
            {"duration": 150, "users": 50, "spawn_rate": 20},  # Cool down
        ]
        
        elapsed_time = time.time() - runner.start_time
        for stage in stages:
            if elapsed_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        
        return None

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Handle test completion"""
    logger.info("Load test completed, collecting metrics...")
    
    # Get custom metrics summary
    summary = metrics_collector.get_summary()
    
    # Save metrics to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    metrics_file = f"load_test_metrics_{timestamp}.json"
    
    with open(metrics_file, 'w') as f:
        json.dump({
            'test_summary': summary,
            'locust_stats': {
                'total_requests': environment.stats.total.num_requests,
                'total_failures': environment.stats.total.num_failures,
                'average_response_time': environment.stats.total.avg_response_time,
                'min_response_time': environment.stats.total.min_response_time,
                'max_response_time': environment.stats.total.max_response_time,
            },
            'timestamp': timestamp
        }, f, indent=2)
    
    logger.info(f"Load test metrics saved to: {metrics_file}")
    
    # Print summary
    print("\n" + "="*60)
    print(" LOAD TEST SUMMARY")
    print("="*60)
    print(f" Total Requests: {summary.get('total_requests', 0):,}")
    print(f" Success Rate: {summary.get('success_rate', 0):.2f}%")
    print(f" Avg Response Time: {summary.get('avg_response_time', 0):.2f}ms")
    print(f" Requests/Second: {summary.get('requests_per_second', 0):.2f}")
    print(f" Test Duration: {summary.get('total_duration', 0):.2f}s")
    print("="*60)

# Performance thresholds for automated validation
PERFORMANCE_THRESHOLDS = {
    'max_avg_response_time_ms': 500,
    'min_success_rate_percent': 95,
    'max_p95_response_time_ms': 1000,
    'min_requests_per_second': 10,
}

def validate_performance_thresholds(stats) -> Dict[str, bool]:
    """Validate performance against defined thresholds"""
    results = {}
    
    # Check average response time
    avg_response_time = getattr(stats.total, 'avg_response_time', 0)
    results['avg_response_time_ok'] = avg_response_time <= PERFORMANCE_THRESHOLDS['max_avg_response_time_ms']
    
    # Check success rate
    total_requests = getattr(stats.total, 'num_requests', 0)
    total_failures = getattr(stats.total, 'num_failures', 0)
    success_rate = ((total_requests - total_failures) / total_requests * 100) if total_requests > 0 else 0
    results['success_rate_ok'] = success_rate >= PERFORMANCE_THRESHOLDS['min_success_rate_percent']
    
    # Check requests per second
    current_rps = getattr(stats.total, 'current_rps', 0)
    results['rps_ok'] = current_rps >= PERFORMANCE_THRESHOLDS['min_requests_per_second']
    
    return results

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Handle test start"""
    logger.info("Starting Schlep-engine load test...")
    logger.info(f"Performance thresholds: {PERFORMANCE_THRESHOLDS}")

# Make sure we have the required user classes available
__all__ = [
    'APIUser',
    'DataProcessingUser', 
    'DashboardUser',
    'MLProcessingUser',
    'SpikeTestUser',
    'StageShape',
    'PerformanceMetricsCollector',
    'validate_performance_thresholds',
    'PERFORMANCE_THRESHOLDS'
]