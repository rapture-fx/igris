"""
Load Testing & Benchmarks Framework
Validates scale promises and performance characteristics across all tiers.
"""

import asyncio
import aiohttp
import time
import json
import statistics
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable, AsyncGenerator
from dataclasses import dataclass, asdict
from enum import Enum
import random
import string
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

logger = logging.getLogger(__name__)

class TestType(str, Enum):
    """Types of load tests"""
    BASELINE = "baseline"
    STRESS = "stress"
    SPIKE = "spike"
    ENDURANCE = "endurance"
    VOLUME = "volume"

class TestPhase(str, Enum):
    """Test execution phases"""
    RAMP_UP = "ramp_up"
    SUSTAINED = "sustained"
    RAMP_DOWN = "ramp_down"

@dataclass
class LoadTestConfig:
    """Load test configuration"""
    test_name: str
    test_type: TestType
    target_url: str
    max_concurrent_users: int
    test_duration_seconds: int
    ramp_up_duration_seconds: int
    ramp_down_duration_seconds: int
    requests_per_user: Optional[int] = None  # None = unlimited
    think_time_seconds: float = 0.1
    timeout_seconds: int = 30
    custom_headers: Optional[Dict[str, str]] = None
    payload_generator: Optional[Callable] = None
    validation_function: Optional[Callable] = None

@dataclass
class RequestResult:
    """Individual request result"""
    timestamp: float
    user_id: int
    request_id: str
    response_time_ms: float
    status_code: int
    success: bool
    error_message: Optional[str] = None
    response_size_bytes: int = 0
    phase: TestPhase = TestPhase.SUSTAINED

@dataclass
class LoadTestResults:
    """Aggregated load test results"""
    test_name: str
    config: LoadTestConfig
    start_time: datetime
    end_time: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time_ms: float
    p50_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    max_response_time_ms: float
    min_response_time_ms: float
    requests_per_second: float
    error_rate: float
    throughput_bytes_per_second: float
    concurrent_users_achieved: int
    detailed_results: List[RequestResult]

class LoadTestFramework:
    """
    Comprehensive Load Testing & Benchmarks Framework

    Features:
    - Multiple test types (baseline, stress, spike, endurance)
    - Configurable load patterns and user behaviors
    - Real-time metrics collection
    - Performance validation against SLA targets
    - Automated benchmark reporting
    - Integration with monitoring systems
    """

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.results_storage: List[LoadTestResults] = []

        # Default test configurations for different tiers
        self.tier_benchmarks = {
            "developer": {
                "max_concurrent_users": 10,
                "target_rps": 50,
                "response_time_p95_ms": 2000,
                "error_rate_threshold": 5.0
            },
            "growth": {
                "max_concurrent_users": 100,
                "target_rps": 500,
                "response_time_p95_ms": 1000,
                "error_rate_threshold": 2.0
            },
            "scale": {
                "max_concurrent_users": 1000,
                "target_rps": 5000,
                "response_time_p95_ms": 500,
                "error_rate_threshold": 0.5
            }
        }

    async def run_load_test(self, config: LoadTestConfig) -> LoadTestResults:
        """Execute a load test with the given configuration"""
        logger.info(f"Starting load test: {config.test_name}")

        start_time = datetime.utcnow()
        results: List[RequestResult] = []

        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(config.max_concurrent_users)

        # Calculate test phases
        total_duration = config.test_duration_seconds + config.ramp_up_duration_seconds + config.ramp_down_duration_seconds

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=config.timeout_seconds),
            headers=self._get_default_headers(config.custom_headers)
        ) as session:

            # Create user tasks
            user_tasks = []

            for user_id in range(config.max_concurrent_users):
                task = asyncio.create_task(
                    self._simulate_user(
                        session=session,
                        user_id=user_id,
                        config=config,
                        semaphore=semaphore,
                        results=results
                    )
                )
                user_tasks.append(task)

                # Ramp up delay
                if config.ramp_up_duration_seconds > 0:
                    delay = config.ramp_up_duration_seconds / config.max_concurrent_users
                    await asyncio.sleep(delay)

            # Wait for all users to complete
            await asyncio.gather(*user_tasks, return_exceptions=True)

        end_time = datetime.utcnow()

        # Calculate aggregate results
        aggregate_results = self._calculate_aggregate_results(
            config, start_time, end_time, results
        )

        # Store results
        self.results_storage.append(aggregate_results)

        logger.info(f"Load test completed: {config.test_name}")
        logger.info(f"Total requests: {aggregate_results.total_requests}")
        logger.info(f"Success rate: {(1 - aggregate_results.error_rate) * 100:.2f}%")
        logger.info(f"Average response time: {aggregate_results.avg_response_time_ms:.2f}ms")
        logger.info(f"P95 response time: {aggregate_results.p95_response_time_ms:.2f}ms")
        logger.info(f"RPS: {aggregate_results.requests_per_second:.2f}")

        return aggregate_results

    async def _simulate_user(
        self,
        session: aiohttp.ClientSession,
        user_id: int,
        config: LoadTestConfig,
        semaphore: asyncio.Semaphore,
        results: List[RequestResult]
    ):
        """Simulate a single user's behavior"""
        request_count = 0
        start_time = time.time()

        # Determine test phases
        ramp_up_end = start_time + config.ramp_up_duration_seconds
        sustained_end = ramp_up_end + config.test_duration_seconds
        total_end = sustained_end + config.ramp_down_duration_seconds

        while time.time() < total_end:
            if config.requests_per_user and request_count >= config.requests_per_user:
                break

            current_time = time.time()

            # Determine current phase
            if current_time < ramp_up_end:
                phase = TestPhase.RAMP_UP
            elif current_time < sustained_end:
                phase = TestPhase.SUSTAINED
            else:
                phase = TestPhase.RAMP_DOWN

            async with semaphore:
                result = await self._make_request(
                    session=session,
                    user_id=user_id,
                    request_id=f"{user_id}_{request_count}",
                    config=config,
                    phase=phase
                )
                results.append(result)

            request_count += 1

            # Think time between requests
            if config.think_time_seconds > 0:
                await asyncio.sleep(config.think_time_seconds)

    async def _make_request(
        self,
        session: aiohttp.ClientSession,
        user_id: int,
        request_id: str,
        config: LoadTestConfig,
        phase: TestPhase
    ) -> RequestResult:
        """Make a single HTTP request"""
        start_time = time.time()

        try:
            # Generate payload if needed
            payload = None
            if config.payload_generator:
                payload = config.payload_generator()

            # Make request
            async with session.get(
                config.target_url,
                json=payload
            ) as response:
                response_text = await response.text()
                response_time_ms = (time.time() - start_time) * 1000

                # Validate response if validation function provided
                success = response.status < 400
                error_message = None

                if config.validation_function:
                    try:
                        validation_result = config.validation_function(response, response_text)
                        success = success and validation_result
                    except Exception as e:
                        success = False
                        error_message = f"Validation error: {str(e)}"

                if not success and not error_message:
                    error_message = f"HTTP {response.status}: {response_text[:100]}"

                return RequestResult(
                    timestamp=start_time,
                    user_id=user_id,
                    request_id=request_id,
                    response_time_ms=response_time_ms,
                    status_code=response.status,
                    success=success,
                    error_message=error_message,
                    response_size_bytes=len(response_text.encode('utf-8')),
                    phase=phase
                )

        except asyncio.TimeoutError:
            response_time_ms = (time.time() - start_time) * 1000
            return RequestResult(
                timestamp=start_time,
                user_id=user_id,
                request_id=request_id,
                response_time_ms=response_time_ms,
                status_code=408,
                success=False,
                error_message="Request timeout",
                phase=phase
            )
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            return RequestResult(
                timestamp=start_time,
                user_id=user_id,
                request_id=request_id,
                response_time_ms=response_time_ms,
                status_code=0,
                success=False,
                error_message=str(e),
                phase=phase
            )

    def _get_default_headers(self, custom_headers: Optional[Dict[str, str]]) -> Dict[str, str]:
        """Get default headers for requests"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Schlep-Engine-LoadTest/1.0'
        }

        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'

        if custom_headers:
            headers.update(custom_headers)

        return headers

    def _calculate_aggregate_results(
        self,
        config: LoadTestConfig,
        start_time: datetime,
        end_time: datetime,
        results: List[RequestResult]
    ) -> LoadTestResults:
        """Calculate aggregated results from individual request results"""
        if not results:
            return LoadTestResults(
                test_name=config.test_name,
                config=config,
                start_time=start_time,
                end_time=end_time,
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                avg_response_time_ms=0,
                p50_response_time_ms=0,
                p95_response_time_ms=0,
                p99_response_time_ms=0,
                max_response_time_ms=0,
                min_response_time_ms=0,
                requests_per_second=0,
                error_rate=0,
                throughput_bytes_per_second=0,
                concurrent_users_achieved=0,
                detailed_results=[]
            )

        # Basic counts
        total_requests = len(results)
        successful_requests = len([r for r in results if r.success])
        failed_requests = total_requests - successful_requests

        # Response time statistics
        response_times = [r.response_time_ms for r in results]
        successful_response_times = [r.response_time_ms for r in results if r.success]

        avg_response_time = statistics.mean(response_times) if response_times else 0
        p50_response_time = self._percentile(response_times, 50) if response_times else 0
        p95_response_time = self._percentile(response_times, 95) if response_times else 0
        p99_response_time = self._percentile(response_times, 99) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        min_response_time = min(response_times) if response_times else 0

        # Calculate RPS
        duration_seconds = (end_time - start_time).total_seconds()
        requests_per_second = total_requests / duration_seconds if duration_seconds > 0 else 0

        # Error rate
        error_rate = failed_requests / total_requests if total_requests > 0 else 0

        # Throughput
        total_bytes = sum(r.response_size_bytes for r in results)
        throughput_bytes_per_second = total_bytes / duration_seconds if duration_seconds > 0 else 0

        # Concurrent users achieved
        unique_users = len(set(r.user_id for r in results))

        return LoadTestResults(
            test_name=config.test_name,
            config=config,
            start_time=start_time,
            end_time=end_time,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time_ms=avg_response_time,
            p50_response_time_ms=p50_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            max_response_time_ms=max_response_time,
            min_response_time_ms=min_response_time,
            requests_per_second=requests_per_second,
            error_rate=error_rate,
            throughput_bytes_per_second=throughput_bytes_per_second,
            concurrent_users_achieved=unique_users,
            detailed_results=results
        )

    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile value"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]

    async def run_tier_benchmarks(self, plan_tier: str, customer_id: Optional[str] = None) -> Dict[str, LoadTestResults]:
        """Run comprehensive benchmarks for a specific plan tier"""
        logger.info(f"Running tier benchmarks for: {plan_tier}")

        if plan_tier not in self.tier_benchmarks:
            raise ValueError(f"Unknown plan tier: {plan_tier}")

        tier_config = self.tier_benchmarks[plan_tier]
        results = {}

        # Test configurations for the tier
        test_configs = [
            # Baseline performance test
            LoadTestConfig(
                test_name=f"{plan_tier}_baseline",
                test_type=TestType.BASELINE,
                target_url=f"{self.base_url}/api/v1/data",
                max_concurrent_users=min(10, tier_config["max_concurrent_users"]),
                test_duration_seconds=300,  # 5 minutes
                ramp_up_duration_seconds=60,
                ramp_down_duration_seconds=60,
                think_time_seconds=0.1
            ),

            # Stress test - target max concurrent users
            LoadTestConfig(
                test_name=f"{plan_tier}_stress",
                test_type=TestType.STRESS,
                target_url=f"{self.base_url}/api/v1/data",
                max_concurrent_users=tier_config["max_concurrent_users"],
                test_duration_seconds=600,  # 10 minutes
                ramp_up_duration_seconds=120,
                ramp_down_duration_seconds=120,
                think_time_seconds=0.05
            ),

            # Spike test - sudden load increase
            LoadTestConfig(
                test_name=f"{plan_tier}_spike",
                test_type=TestType.SPIKE,
                target_url=f"{self.base_url}/api/v1/data",
                max_concurrent_users=tier_config["max_concurrent_users"],
                test_duration_seconds=180,  # 3 minutes
                ramp_up_duration_seconds=10,  # Very fast ramp up
                ramp_down_duration_seconds=60,
                think_time_seconds=0.01
            ),

            # Endurance test - sustained load
            LoadTestConfig(
                test_name=f"{plan_tier}_endurance",
                test_type=TestType.ENDURANCE,
                target_url=f"{self.base_url}/api/v1/data",
                max_concurrent_users=tier_config["max_concurrent_users"] // 2,
                test_duration_seconds=1800,  # 30 minutes
                ramp_up_duration_seconds=180,
                ramp_down_duration_seconds=180,
                think_time_seconds=0.5
            )
        ]

        # Run all test configurations
        for config in test_configs:
            try:
                result = await self.run_load_test(config)
                results[config.test_name] = result

                # Brief pause between tests
                await asyncio.sleep(30)

            except Exception as e:
                logger.error(f"Test {config.test_name} failed: {e}")

        # Validate results against tier expectations
        validation_results = self._validate_tier_performance(plan_tier, results)

        # Generate report
        await self._generate_benchmark_report(plan_tier, results, validation_results)

        return results

    def _validate_tier_performance(self, plan_tier: str, results: Dict[str, LoadTestResults]) -> Dict[str, Dict[str, bool]]:
        """Validate performance results against tier expectations"""
        tier_config = self.tier_benchmarks[plan_tier]
        validation_results = {}

        for test_name, result in results.items():
            validation = {
                "response_time_p95": result.p95_response_time_ms <= tier_config["response_time_p95_ms"],
                "error_rate": result.error_rate <= tier_config["error_rate_threshold"] / 100,
                "concurrent_users": result.concurrent_users_achieved >= tier_config["max_concurrent_users"] * 0.9,  # 90% tolerance
                "requests_per_second": result.requests_per_second >= tier_config["target_rps"] * 0.8  # 80% tolerance
            }

            validation_results[test_name] = validation

        return validation_results

    async def _generate_benchmark_report(
        self,
        plan_tier: str,
        results: Dict[str, LoadTestResults],
        validation_results: Dict[str, Dict[str, bool]]
    ):
        """Generate comprehensive benchmark report"""
        report_dir = Path(f"./reports/load_testing/{plan_tier}")
        report_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Generate JSON report
        json_report = {
            "plan_tier": plan_tier,
            "timestamp": timestamp,
            "results": {name: asdict(result) for name, result in results.items()},
            "validation": validation_results,
            "summary": self._generate_summary_stats(results, validation_results)
        }

        json_path = report_dir / f"benchmark_report_{timestamp}.json"
        with open(json_path, 'w') as f:
            json.dump(json_report, f, indent=2, default=str)

        # Generate performance charts
        await self._generate_performance_charts(plan_tier, results, report_dir, timestamp)

        logger.info(f"Benchmark report generated: {json_path}")

    def _generate_summary_stats(
        self,
        results: Dict[str, LoadTestResults],
        validation_results: Dict[str, Dict[str, bool]]
    ) -> Dict[str, Any]:
        """Generate summary statistics"""
        all_results = list(results.values())

        if not all_results:
            return {}

        # Overall pass/fail
        all_validations = [v for validation in validation_results.values() for v in validation.values()]
        pass_rate = sum(all_validations) / len(all_validations) if all_validations else 0

        return {
            "total_tests": len(results),
            "validation_pass_rate": pass_rate,
            "avg_response_time_ms": statistics.mean([r.avg_response_time_ms for r in all_results]),
            "avg_p95_response_time_ms": statistics.mean([r.p95_response_time_ms for r in all_results]),
            "avg_error_rate": statistics.mean([r.error_rate for r in all_results]),
            "avg_requests_per_second": statistics.mean([r.requests_per_second for r in all_results]),
            "total_requests": sum([r.total_requests for r in all_results]),
            "total_duration_hours": sum([(r.end_time - r.start_time).total_seconds() for r in all_results]) / 3600
        }

    async def _generate_performance_charts(
        self,
        plan_tier: str,
        results: Dict[str, LoadTestResults],
        report_dir: Path,
        timestamp: str
    ):
        """Generate performance visualization charts"""
        try:
            # Set up the plotting style
            plt.style.use('seaborn-v0_8')
            fig, axes = plt.subplots(2, 2, figsize=(15, 10))
            fig.suptitle(f'Load Testing Results - {plan_tier.title()} Tier', fontsize=16)

            # Extract data for plotting
            test_names = list(results.keys())
            response_times_p95 = [results[name].p95_response_time_ms for name in test_names]
            error_rates = [results[name].error_rate * 100 for name in test_names]
            rps_values = [results[name].requests_per_second for name in test_names]

            # Response time chart
            axes[0, 0].bar(test_names, response_times_p95, color='skyblue')
            axes[0, 0].set_title('P95 Response Time (ms)')
            axes[0, 0].set_ylabel('Response Time (ms)')
            axes[0, 0].tick_params(axis='x', rotation=45)

            # Error rate chart
            axes[0, 1].bar(test_names, error_rates, color='salmon')
            axes[0, 1].set_title('Error Rate (%)')
            axes[0, 1].set_ylabel('Error Rate (%)')
            axes[0, 1].tick_params(axis='x', rotation=45)

            # Requests per second chart
            axes[1, 0].bar(test_names, rps_values, color='lightgreen')
            axes[1, 0].set_title('Requests per Second')
            axes[1, 0].set_ylabel('RPS')
            axes[1, 0].tick_params(axis='x', rotation=45)

            # Response time distribution for baseline test
            if test_names:
                baseline_results = results[test_names[0]]  # Use first test
                response_times = [r.response_time_ms for r in baseline_results.detailed_results if r.success]

                if response_times:
                    axes[1, 1].hist(response_times, bins=50, alpha=0.7, color='purple')
                    axes[1, 1].set_title('Response Time Distribution (Baseline)')
                    axes[1, 1].set_xlabel('Response Time (ms)')
                    axes[1, 1].set_ylabel('Frequency')

            plt.tight_layout()
            chart_path = report_dir / f"performance_charts_{timestamp}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()

            logger.info(f"Performance charts saved: {chart_path}")

        except Exception as e:
            logger.error(f"Failed to generate performance charts: {e}")

# Utility functions for common payload generators
def generate_random_json_payload(size_bytes: int = 1024) -> Dict[str, Any]:
    """Generate random JSON payload of specified size"""
    data_size = size_bytes // 2  # Rough estimation
    random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=data_size))

    return {
        "data": random_string,
        "timestamp": datetime.utcnow().isoformat(),
        "random_number": random.randint(1, 1000000),
        "test_payload": True
    }

def generate_csv_data_payload(rows: int = 100) -> Dict[str, Any]:
    """Generate CSV-like data payload"""
    headers = ["id", "name", "email", "age", "city", "score"]
    data = []

    for i in range(rows):
        row = {
            "id": i + 1,
            "name": f"User_{i}",
            "email": f"user{i}@example.com",
            "age": random.randint(18, 80),
            "city": random.choice(["New York", "London", "Tokyo", "Paris", "Sydney"]),
            "score": round(random.uniform(0, 100), 2)
        }
        data.append(row)

    return {
        "headers": headers,
        "data": data,
        "format": "csv"
    }

# Example validation functions
def validate_json_response(response: aiohttp.ClientResponse, response_text: str) -> bool:
    """Validate JSON response structure"""
    try:
        data = json.loads(response_text)
        return isinstance(data, dict) and "status" in data
    except json.JSONDecodeError:
        return False

def validate_api_response_time(max_time_ms: float = 1000):
    """Create validation function for response time"""
    def validate(response: aiohttp.ClientResponse, response_text: str) -> bool:
        # This would be set by the load testing framework
        return True  # Response time validation is handled separately
    return validate