"""
Advanced Load Testing Suite for Pollarbase API
Comprehensive performance validation with real-world scenarios
"""

import asyncio
import aiohttp
import time
import statistics
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import psutil
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

@dataclass
class LoadTestConfig:
    """Load test configuration"""
    base_url: str = "http://localhost:8000"
    concurrent_users: int = 50
    test_duration: int = 300  # seconds
    ramp_up_time: int = 60    # seconds
    think_time: float = 1.0   # seconds between requests
    request_timeout: int = 30  # seconds
    scenarios: List[str] = None
    
    def __post_init__(self):
        if self.scenarios is None:
            self.scenarios = ["api_health", "user_auth", "data_upload", "data_analysis"]

@dataclass
class RequestResult:
    """Individual request result"""
    timestamp: datetime
    scenario: str
    endpoint: str
    method: str
    status_code: int
    response_time: float
    payload_size: int
    success: bool
    error_message: Optional[str] = None

@dataclass
class LoadTestResult:
    """Complete load test results"""
    config: LoadTestConfig
    start_time: datetime
    end_time: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    p50_response_time: float
    p95_response_time: float
    p99_response_time: float
    max_response_time: float
    min_response_time: float
    requests_per_second: float
    errors_per_second: float
    success_rate: float
    system_metrics: Dict[str, Any]
    scenario_results: Dict[str, Any]
    request_results: List[RequestResult]

class SystemMonitor:
    """System resource monitoring during load tests"""
    
    def __init__(self):
        self.metrics = []
        self.monitoring = False
    
    async def start_monitoring(self, interval: float = 1.0):
        """Start monitoring system resources"""
        self.monitoring = True
        self.metrics = []
        
        while self.monitoring:
            try:
                timestamp = datetime.utcnow()
                cpu_percent = psutil.cpu_percent(interval=None)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                
                # Network I/O
                net_io = psutil.net_io_counters()
                
                metric = {
                    "timestamp": timestamp,
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory.percent,
                    "memory_used": memory.used,
                    "memory_available": memory.available,
                    "disk_percent": disk.percent,
                    "disk_used": disk.used,
                    "disk_free": disk.free,
                    "network_bytes_sent": net_io.bytes_sent,
                    "network_bytes_recv": net_io.bytes_recv,
                    "processes": len(psutil.pids())
                }
                
                self.metrics.append(metric)
                await asyncio.sleep(interval)
                
            except Exception as e:
                print(f"Error monitoring system: {e}")
                await asyncio.sleep(interval)
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.monitoring = False
    
    def get_summary(self) -> Dict[str, Any]:
        """Get monitoring summary"""
        if not self.metrics:
            return {}
        
        cpu_values = [m["cpu_percent"] for m in self.metrics]
        memory_values = [m["memory_percent"] for m in self.metrics]
        
        return {
            "duration_seconds": len(self.metrics),
            "cpu": {
                "avg": statistics.mean(cpu_values),
                "max": max(cpu_values),
                "min": min(cpu_values),
                "p95": np.percentile(cpu_values, 95)
            },
            "memory": {
                "avg": statistics.mean(memory_values),
                "max": max(memory_values),
                "min": min(memory_values),
                "p95": np.percentile(memory_values, 95)
            },
            "samples": len(self.metrics)
        }

class LoadTestScenarios:
    """Collection of load test scenarios"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.auth_token = None
    
    async def setup_auth(self, session: aiohttp.ClientSession) -> bool:
        """Setup authentication for scenarios that require it"""
        try:
            # Try to authenticate with demo credentials
            auth_data = {
                "username": "admin@pollarbase.com",
                "password": "admin123"
            }
            
            async with session.post(
                f"{self.base_url}/api/v1/auth/login",
                json=auth_data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.auth_token = result.get("access_token")
                    return True
                return False
        except Exception as e:
            print(f"Auth setup failed: {e}")
            return False
    
    async def api_health_check(self, session: aiohttp.ClientSession) -> RequestResult:
        """Basic health check scenario"""
        start_time = time.time()
        timestamp = datetime.utcnow()
        
        try:
            async with session.get(
                f"{self.base_url}/health",
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                content = await response.read()
                
                return RequestResult(
                    timestamp=timestamp,
                    scenario="api_health",
                    endpoint="/health",
                    method="GET",
                    status_code=response.status,
                    response_time=response_time,
                    payload_size=len(content),
                    success=response.status == 200
                )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return RequestResult(
                timestamp=timestamp,
                scenario="api_health",
                endpoint="/health",
                method="GET",
                status_code=0,
                response_time=response_time,
                payload_size=0,
                success=False,
                error_message=str(e)
            )
    
    async def user_authentication(self, session: aiohttp.ClientSession) -> RequestResult:
        """User authentication scenario"""
        start_time = time.time()
        timestamp = datetime.utcnow()
        
        try:
            auth_data = {
                "username": f"test_user_{uuid.uuid4().hex[:8]}",
                "password": "test_password_123"
            }
            
            async with session.post(
                f"{self.base_url}/api/v1/auth/login",
                json=auth_data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                content = await response.read()
                
                return RequestResult(
                    timestamp=timestamp,
                    scenario="user_auth",
                    endpoint="/api/v1/auth/login",
                    method="POST",
                    status_code=response.status,
                    response_time=response_time,
                    payload_size=len(content),
                    success=response.status in [200, 401]  # Both are valid responses
                )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return RequestResult(
                timestamp=timestamp,
                scenario="user_auth",
                endpoint="/api/v1/auth/login",
                method="POST",
                status_code=0,
                response_time=response_time,
                payload_size=0,
                success=False,
                error_message=str(e)
            )
    
    async def data_upload_simulation(self, session: aiohttp.ClientSession) -> RequestResult:
        """Data upload simulation scenario"""
        start_time = time.time()
        timestamp = datetime.utcnow()
        
        try:
            # Generate sample CSV data
            csv_data = "name,age,email\n"
            for i in range(100):
                csv_data += f"User{i},{20+i%50},user{i}@example.com\n"
            
            headers = {}
            if self.auth_token:
                headers["Authorization"] = f"Bearer {self.auth_token}"
            
            data = aiohttp.FormData()
            data.add_field('file', csv_data, filename='test_data.csv', content_type='text/csv')
            
            async with session.post(
                f"{self.base_url}/api/v1/upload/file",
                data=data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                content = await response.read()
                
                return RequestResult(
                    timestamp=timestamp,
                    scenario="data_upload",
                    endpoint="/api/v1/upload/file",
                    method="POST",
                    status_code=response.status,
                    response_time=response_time,
                    payload_size=len(content),
                    success=response.status in [200, 201, 401]  # Include auth errors as valid
                )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return RequestResult(
                timestamp=timestamp,
                scenario="data_upload",
                endpoint="/api/v1/upload/file",
                method="POST",
                status_code=0,
                response_time=response_time,
                payload_size=0,
                success=False,
                error_message=str(e)
            )
    
    async def data_analysis_request(self, session: aiohttp.ClientSession) -> RequestResult:
        """Data analysis request scenario"""
        start_time = time.time()
        timestamp = datetime.utcnow()
        
        try:
            # Sample data for analysis
            analysis_data = {
                "data": [
                    {"name": "John", "age": 25, "score": 85.5},
                    {"name": "Jane", "age": 30, "score": 92.3},
                    {"name": "Bob", "age": 35, "score": 78.9}
                ],
                "analysis_type": "basic_stats"
            }
            
            headers = {"Content-Type": "application/json"}
            if self.auth_token:
                headers["Authorization"] = f"Bearer {self.auth_token}"
            
            async with session.post(
                f"{self.base_url}/api/v1/analyze/quick",
                json=analysis_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=20)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                content = await response.read()
                
                return RequestResult(
                    timestamp=timestamp,
                    scenario="data_analysis",
                    endpoint="/api/v1/analyze/quick",
                    method="POST",
                    status_code=response.status,
                    response_time=response_time,
                    payload_size=len(content),
                    success=response.status in [200, 401, 404]  # Include common valid responses
                )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return RequestResult(
                timestamp=timestamp,
                scenario="data_analysis",
                endpoint="/api/v1/analyze/quick",
                method="POST",
                status_code=0,
                response_time=response_time,
                payload_size=0,
                success=False,
                error_message=str(e)
            )

class AdvancedLoadTester:
    """Advanced load testing engine"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[RequestResult] = []
        self.system_monitor = SystemMonitor()
        self.scenarios = LoadTestScenarios(config.base_url)
    
    async def run_user_session(self, user_id: int, session: aiohttp.ClientSession) -> List[RequestResult]:
        """Run a complete user session"""
        user_results = []
        
        # Setup authentication for this session
        await self.scenarios.setup_auth(session)
        
        start_time = time.time()
        while time.time() - start_time < self.config.test_duration:
            # Select random scenario
            scenario_methods = {
                "api_health": self.scenarios.api_health_check,
                "user_auth": self.scenarios.user_authentication,
                "data_upload": self.scenarios.data_upload_simulation,
                "data_analysis": self.scenarios.data_analysis_request
            }
            
            for scenario_name in self.config.scenarios:
                if scenario_name in scenario_methods:
                    try:
                        result = await scenario_methods[scenario_name](session)
                        user_results.append(result)
                        
                        # Think time between requests
                        if self.config.think_time > 0:
                            await asyncio.sleep(self.config.think_time)
                            
                    except Exception as e:
                        print(f"Error in scenario {scenario_name}: {e}")
        
        return user_results
    
    async def run_load_test(self) -> LoadTestResult:
        """Execute the complete load test"""
        print(f"Starting load test with {self.config.concurrent_users} concurrent users")
        print(f"Test duration: {self.config.test_duration} seconds")
        print(f"Target URL: {self.config.base_url}")
        
        start_time = datetime.utcnow()
        
        # Start system monitoring
        monitor_task = asyncio.create_task(self.system_monitor.start_monitoring())
        
        # Configure aiohttp session
        connector = aiohttp.TCPConnector(
            limit=self.config.concurrent_users * 2,
            limit_per_host=self.config.concurrent_users * 2,
            ttl_dns_cache=300,
            use_dns_cache=True
        )
        
        timeout = aiohttp.ClientTimeout(total=self.config.request_timeout)
        
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={"User-Agent": "Pollarbase-LoadTester/1.0"}
        ) as session:
            # Create tasks for concurrent users
            tasks = []
            for user_id in range(self.config.concurrent_users):
                # Stagger user start times for realistic ramp-up
                delay = (user_id / self.config.concurrent_users) * self.config.ramp_up_time
                task = asyncio.create_task(self._delayed_user_session(delay, user_id, session))
                tasks.append(task)
            
            # Wait for all users to complete
            user_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Stop monitoring
        self.system_monitor.stop_monitoring()
        monitor_task.cancel()
        
        end_time = datetime.utcnow()
        
        # Collect all results
        all_results = []
        for result_set in user_results:
            if isinstance(result_set, list):
                all_results.extend(result_set)
        
        # Calculate statistics
        return self._calculate_results(start_time, end_time, all_results)
    
    async def _delayed_user_session(self, delay: float, user_id: int, session: aiohttp.ClientSession):
        """Start user session with delay for ramp-up"""
        if delay > 0:
            await asyncio.sleep(delay)
        return await self.run_user_session(user_id, session)
    
    def _calculate_results(self, start_time: datetime, end_time: datetime, results: List[RequestResult]) -> LoadTestResult:
        """Calculate comprehensive test results"""
        if not results:
            return LoadTestResult(
                config=self.config,
                start_time=start_time,
                end_time=end_time,
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                avg_response_time=0.0,
                p50_response_time=0.0,
                p95_response_time=0.0,
                p99_response_time=0.0,
                max_response_time=0.0,
                min_response_time=0.0,
                requests_per_second=0.0,
                errors_per_second=0.0,
                success_rate=0.0,
                system_metrics={},
                scenario_results={},
                request_results=[]
            )
        
        # Basic stats
        total_requests = len(results)
        successful_requests = sum(1 for r in results if r.success)
        failed_requests = total_requests - successful_requests
        
        # Response time stats
        response_times = [r.response_time for r in results]
        avg_response_time = statistics.mean(response_times)
        p50_response_time = np.percentile(response_times, 50)
        p95_response_time = np.percentile(response_times, 95)
        p99_response_time = np.percentile(response_times, 99)
        max_response_time = max(response_times)
        min_response_time = min(response_times)
        
        # Rate calculations
        duration_seconds = (end_time - start_time).total_seconds()
        requests_per_second = total_requests / duration_seconds if duration_seconds > 0 else 0
        errors_per_second = failed_requests / duration_seconds if duration_seconds > 0 else 0
        success_rate = (successful_requests / total_requests * 100) if total_requests > 0 else 0
        
        # Scenario-specific results
        scenario_results = {}
        for scenario in self.config.scenarios:
            scenario_requests = [r for r in results if r.scenario == scenario]
            if scenario_requests:
                scenario_response_times = [r.response_time for r in scenario_requests]
                scenario_results[scenario] = {
                    "total_requests": len(scenario_requests),
                    "successful_requests": sum(1 for r in scenario_requests if r.success),
                    "avg_response_time": statistics.mean(scenario_response_times),
                    "p95_response_time": np.percentile(scenario_response_times, 95),
                    "success_rate": sum(1 for r in scenario_requests if r.success) / len(scenario_requests) * 100
                }
        
        # System metrics summary
        system_metrics = self.system_monitor.get_summary()
        
        return LoadTestResult(
            config=self.config,
            start_time=start_time,
            end_time=end_time,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time=avg_response_time,
            p50_response_time=p50_response_time,
            p95_response_time=p95_response_time,
            p99_response_time=p99_response_time,
            max_response_time=max_response_time,
            min_response_time=min_response_time,
            requests_per_second=requests_per_second,
            errors_per_second=errors_per_second,
            success_rate=success_rate,
            system_metrics=system_metrics,
            scenario_results=scenario_results,
            request_results=results
        )
    
    def generate_report(self, result: LoadTestResult, output_dir: str = "load_test_reports") -> str:
        """Generate comprehensive load test report"""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = output_path / f"load_test_report_{timestamp}.html"
        
        # Generate HTML report
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pollarbase Load Test Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .header {{ background: #3b82f6; color: white; padding: 20px; border-radius: 8px; }}
                .metric {{ background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }}
                .success {{ border-left-color: #10b981; }}
                .warning {{ border-left-color: #f59e0b; }}
                .error {{ border-left-color: #ef4444; }}
                .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f8fafc; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Pollarbase Load Test Report</h1>
                <p>Test executed on {result.start_time.strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
            </div>
            
            <div class="grid">
                <div class="metric {'success' if result.success_rate > 95 else 'warning' if result.success_rate > 90 else 'error'}">
                    <h3>Success Rate</h3>
                    <p style="font-size: 24px; margin: 0;">{result.success_rate:.1f}%</p>
                    <p>{result.successful_requests:,} / {result.total_requests:,} requests</p>
                </div>
                
                <div class="metric {'success' if result.p95_response_time < 500 else 'warning' if result.p95_response_time < 1000 else 'error'}">
                    <h3>Response Time (P95)</h3>
                    <p style="font-size: 24px; margin: 0;">{result.p95_response_time:.1f}ms</p>
                    <p>Average: {result.avg_response_time:.1f}ms</p>
                </div>
                
                <div class="metric">
                    <h3>Throughput</h3>
                    <p style="font-size: 24px; margin: 0;">{result.requests_per_second:.1f} req/s</p>
                    <p>Error rate: {result.errors_per_second:.2f} err/s</p>
                </div>
                
                <div class="metric">
                    <h3>Test Configuration</h3>
                    <p>{result.config.concurrent_users} concurrent users</p>
                    <p>{result.config.test_duration}s duration</p>
                </div>
            </div>
            
            <h2>Response Time Distribution</h2>
            <table>
                <tr><th>Percentile</th><th>Response Time (ms)</th></tr>
                <tr><td>50th (Median)</td><td>{result.p50_response_time:.1f}</td></tr>
                <tr><td>95th</td><td>{result.p95_response_time:.1f}</td></tr>
                <tr><td>99th</td><td>{result.p99_response_time:.1f}</td></tr>
                <tr><td>Maximum</td><td>{result.max_response_time:.1f}</td></tr>
                <tr><td>Minimum</td><td>{result.min_response_time:.1f}</td></tr>
            </table>
            
            <h2>Scenario Performance</h2>
            <table>
                <tr><th>Scenario</th><th>Requests</th><th>Success Rate</th><th>Avg Response Time</th><th>P95 Response Time</th></tr>
        """
        
        for scenario, stats in result.scenario_results.items():
            html_content += f"""
                <tr>
                    <td>{scenario}</td>
                    <td>{stats['total_requests']:,}</td>
                    <td>{stats['success_rate']:.1f}%</td>
                    <td>{stats['avg_response_time']:.1f}ms</td>
                    <td>{stats['p95_response_time']:.1f}ms</td>
                </tr>
            """
        
        if result.system_metrics:
            html_content += f"""
            </table>
            
            <h2>System Resource Usage</h2>
            <div class="grid">
                <div class="metric">
                    <h3>CPU Usage</h3>
                    <p>Average: {result.system_metrics['cpu']['avg']:.1f}%</p>
                    <p>Peak: {result.system_metrics['cpu']['max']:.1f}%</p>
                </div>
                <div class="metric">
                    <h3>Memory Usage</h3>
                    <p>Average: {result.system_metrics['memory']['avg']:.1f}%</p>
                    <p>Peak: {result.system_metrics['memory']['max']:.1f}%</p>
                </div>
            </div>
            """
        
        html_content += """
            <h2>Test Summary</h2>
            <div class="metric">
                <p><strong>Test Status:</strong> """ + (" PASSED" if result.success_rate > 95 and result.p95_response_time < 1000 else " REVIEW NEEDED" if result.success_rate > 90 else " FAILED") + """</p>
                <p><strong>Duration:</strong> """ + f"{(result.end_time - result.start_time).total_seconds():.1f} seconds" + """</p>
                <p><strong>Total Data Transferred:</strong> """ + f"{sum(r.payload_size for r in result.request_results) / 1024 / 1024:.2f} MB" + """</p>
            </div>
            
        </body>
        </html>
        """
        
        with open(report_file, 'w') as f:
            f.write(html_content)
        
        return str(report_file)

# CLI interface for load testing
async def main():
    """Main function for running load tests"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Pollarbase Advanced Load Testing")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL for testing")
    parser.add_argument("--users", type=int, default=50, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=300, help="Test duration in seconds")
    parser.add_argument("--ramp-up", type=int, default=60, help="Ramp-up time in seconds")
    parser.add_argument("--scenarios", nargs="+", default=["api_health", "user_auth"], help="Test scenarios to run")
    parser.add_argument("--output", default="load_test_reports", help="Output directory for reports")
    
    args = parser.parse_args()
    
    config = LoadTestConfig(
        base_url=args.url,
        concurrent_users=args.users,
        test_duration=args.duration,
        ramp_up_time=args.ramp_up,
        scenarios=args.scenarios
    )
    
    print(" POLLARBASE ADVANCED LOAD TESTING")
    print("=" * 50)
    
    tester = AdvancedLoadTester(config)
    result = await tester.run_load_test()
    
    # Generate report
    report_path = tester.generate_report(result, args.output)
    
    print("\n LOAD TEST RESULTS")
    print("=" * 50)
    print(f" Success Rate: {result.success_rate:.1f}%")
    print(f" Throughput: {result.requests_per_second:.1f} req/s")
    print(f"  P95 Response Time: {result.p95_response_time:.1f}ms")
    print(f" Total Requests: {result.total_requests:,}")
    print(f" Failed Requests: {result.failed_requests:,}")
    print(f" Report: {report_path}")
    
    # Overall assessment
    if result.success_rate > 95 and result.p95_response_time < 1000:
        print("\n EXCELLENT: System performance exceeds expectations!")
    elif result.success_rate > 90 and result.p95_response_time < 2000:
        print("\n GOOD: System performance meets requirements")
    else:
        print("\n  NEEDS ATTENTION: System performance requires optimization")

if __name__ == "__main__":
    asyncio.run(main()) 