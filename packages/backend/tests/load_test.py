"""
Load Testing Framework for Pollarbase Performance Validation
===========================================================

This module implements comprehensive load testing to validate the performance
improvements implemented in Phase 1 of the optimization project.

Features:
- API endpoint load testing
- Database performance testing
- Memory usage monitoring during load
- Concurrent user simulation
- Response time analysis
- Bottleneck identification

Usage:
    python tests/load_test.py --concurrent-users 50 --duration 300
"""

import asyncio
import aiohttp
import time
import statistics
import json
import psutil
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import argparse
import sys
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LoadTestConfig:
    """Configuration for load testing"""
    base_url: str = "http://localhost:8000"
    concurrent_users: int = 10
    duration_seconds: int = 60
    ramp_up_seconds: int = 10
    test_endpoints: List[str] = None
    auth_token: Optional[str] = None
    output_dir: str = "load_test_results"

@dataclass
class RequestResult:
    """Individual request result"""
    endpoint: str
    method: str
    status_code: int
    response_time: float
    timestamp: datetime
    success: bool
    error: Optional[str] = None

@dataclass
class SystemMetrics:
    """System resource metrics"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_available_gb: float
    active_connections: int

class LoadTester:
    """Main load testing orchestrator"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[RequestResult] = []
        self.system_metrics: List[SystemMetrics] = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        
        # Default test endpoints
        if not config.test_endpoints:
            self.config.test_endpoints = [
                "/health",
                "/api/v1/auth/unified/status",
                "/api/v1/demo/features",
                "/api/v1/dashboard/stats",
                "/docs"
            ]
    
    async def run_load_test(self) -> Dict[str, Any]:
        """Run the complete load test suite"""
        logger.info(f"Starting load test with {self.config.concurrent_users} users for {self.config.duration_seconds}s")
        
        self.start_time = datetime.utcnow()
        
        # Create output directory
        Path(self.config.output_dir).mkdir(exist_ok=True)
        
        # Start system monitoring
        monitor_task = asyncio.create_task(self._monitor_system())
        
        # Run load test
        load_task = asyncio.create_task(self._run_concurrent_load())
        
        # Wait for load test to complete
        await load_task
        
        # Stop monitoring
        monitor_task.cancel()
        
        self.end_time = datetime.utcnow()
        
        # Analyze results
        analysis = self._analyze_results()
        
        # Generate reports
        await self._generate_reports(analysis)
        
        logger.info("Load test completed successfully")
        return analysis
    
    async def _run_concurrent_load(self):
        """Run concurrent load with gradual ramp-up"""
        tasks = []
        
        # Calculate ramp-up delay
        ramp_delay = self.config.ramp_up_seconds / self.config.concurrent_users
        
        # Start users gradually
        for user_id in range(self.config.concurrent_users):
            if user_id > 0:
                await asyncio.sleep(ramp_delay)
            
            task = asyncio.create_task(self._simulate_user(user_id))
            tasks.append(task)
        
        # Wait for all users to complete
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _simulate_user(self, user_id: int):
        """Simulate a single user's behavior"""
        user_start = time.time()
        user_requests = 0
        
        async with aiohttp.ClientSession() as session:
            while (time.time() - user_start) < self.config.duration_seconds:
                # Select random endpoint
                endpoint = self.config.test_endpoints[user_requests % len(self.config.test_endpoints)]
                
                # Make request
                await self._make_request(session, endpoint, user_id)
                user_requests += 1
                
                # Small delay between requests
                await asyncio.sleep(0.1)
        
        logger.info(f"User {user_id} completed {user_requests} requests")
    
    async def _make_request(self, session: aiohttp.ClientSession, endpoint: str, user_id: int):
        """Make a single HTTP request and record metrics"""
        url = f"{self.config.base_url}{endpoint}"
        start_time = time.time()
        timestamp = datetime.utcnow()
        
        headers = {}
        if self.config.auth_token:
            headers['Authorization'] = f"Bearer {self.config.auth_token}"
        
        try:
            async with session.get(url, headers=headers, timeout=30) as response:
                response_time = time.time() - start_time
                
                result = RequestResult(
                    endpoint=endpoint,
                    method="GET",
                    status_code=response.status,
                    response_time=response_time,
                    timestamp=timestamp,
                    success=200 <= response.status < 400
                )
                
                self.results.append(result)
                
        except Exception as e:
            response_time = time.time() - start_time
            
            result = RequestResult(
                endpoint=endpoint,
                method="GET",
                status_code=0,
                response_time=response_time,
                timestamp=timestamp,
                success=False,
                error=str(e)
            )
            
            self.results.append(result)
    
    async def _monitor_system(self):
        """Monitor system resources during load test"""
        try:
            while True:
                metrics = SystemMetrics(
                    timestamp=datetime.utcnow(),
                    cpu_percent=psutil.cpu_percent(interval=None),
                    memory_percent=psutil.virtual_memory().percent,
                    memory_available_gb=psutil.virtual_memory().available / (1024**3),
                    active_connections=len(psutil.net_connections())
                )
                
                self.system_metrics.append(metrics)
                await asyncio.sleep(1)  # Monitor every second
                
        except asyncio.CancelledError:
            logger.info("System monitoring stopped")
    
    def _analyze_results(self) -> Dict[str, Any]:
        """Analyze load test results and generate statistics"""
        if not self.results:
            return {"error": "No results to analyze"}
        
        # Basic statistics
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r.success)
        failed_requests = total_requests - successful_requests
        success_rate = (successful_requests / total_requests) * 100
        
        # Response time statistics
        response_times = [r.response_time for r in self.results if r.success]
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            p95_response_time = self._percentile(response_times, 95)
            p99_response_time = self._percentile(response_times, 99)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = median_response_time = p95_response_time = p99_response_time = 0
            min_response_time = max_response_time = 0
        
        # Throughput calculation
        duration = (self.end_time - self.start_time).total_seconds()
        throughput = total_requests / duration if duration > 0 else 0
        
        # Error analysis
        error_breakdown = {}
        for result in self.results:
            if not result.success:
                error_key = f"{result.status_code}: {result.error}" if result.error else str(result.status_code)
                error_breakdown[error_key] = error_breakdown.get(error_key, 0) + 1
        
        # Endpoint performance breakdown
        endpoint_stats = {}
        for endpoint in self.config.test_endpoints:
            endpoint_results = [r for r in self.results if r.endpoint == endpoint]
            if endpoint_results:
                endpoint_response_times = [r.response_time for r in endpoint_results if r.success]
                endpoint_stats[endpoint] = {
                    "total_requests": len(endpoint_results),
                    "successful_requests": sum(1 for r in endpoint_results if r.success),
                    "avg_response_time": statistics.mean(endpoint_response_times) if endpoint_response_times else 0,
                    "p95_response_time": self._percentile(endpoint_response_times, 95) if endpoint_response_times else 0
                }
        
        # System resource analysis
        if self.system_metrics:
            max_cpu = max(m.cpu_percent for m in self.system_metrics)
            avg_cpu = statistics.mean(m.cpu_percent for m in self.system_metrics)
            max_memory = max(m.memory_percent for m in self.system_metrics)
            avg_memory = statistics.mean(m.memory_percent for m in self.system_metrics)
            min_memory_available = min(m.memory_available_gb for m in self.system_metrics)
        else:
            max_cpu = avg_cpu = max_memory = avg_memory = min_memory_available = 0
        
        analysis = {
            "test_config": {
                "concurrent_users": self.config.concurrent_users,
                "duration_seconds": self.config.duration_seconds,
                "total_endpoints": len(self.config.test_endpoints)
            },
            "performance_metrics": {
                "total_requests": total_requests,
                "successful_requests": successful_requests,
                "failed_requests": failed_requests,
                "success_rate_percent": round(success_rate, 2),
                "throughput_rps": round(throughput, 2),
                "avg_response_time_ms": round(avg_response_time * 1000, 2),
                "median_response_time_ms": round(median_response_time * 1000, 2),
                "p95_response_time_ms": round(p95_response_time * 1000, 2),
                "p99_response_time_ms": round(p99_response_time * 1000, 2),
                "min_response_time_ms": round(min_response_time * 1000, 2),
                "max_response_time_ms": round(max_response_time * 1000, 2)
            },
            "system_resources": {
                "max_cpu_percent": round(max_cpu, 2),
                "avg_cpu_percent": round(avg_cpu, 2),
                "max_memory_percent": round(max_memory, 2),
                "avg_memory_percent": round(avg_memory, 2),
                "min_memory_available_gb": round(min_memory_available, 2)
            },
            "endpoint_breakdown": endpoint_stats,
            "errors": error_breakdown,
            "test_duration_seconds": duration,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return analysis
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile value"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        lower_index = int(index)
        upper_index = min(lower_index + 1, len(sorted_data) - 1)
        weight = index - lower_index
        return sorted_data[lower_index] * (1 - weight) + sorted_data[upper_index] * weight
    
    async def _generate_reports(self, analysis: Dict[str, Any]):
        """Generate comprehensive test reports"""
        
        # JSON report
        json_file = Path(self.config.output_dir) / f"load_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(json_file, 'w') as f:
            json.dump(analysis, f, indent=2)
        
        # CSV report for raw data
        csv_file = Path(self.config.output_dir) / f"load_test_raw_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        self._export_raw_data_csv(csv_file)
        
        # Generate visualizations
        self._generate_charts(analysis)
        
        # Console summary
        self._print_summary(analysis)
    
    def _export_raw_data_csv(self, filename: Path):
        """Export raw test data to CSV"""
        data = []
        for result in self.results:
            data.append({
                'timestamp': result.timestamp.isoformat(),
                'endpoint': result.endpoint,
                'method': result.method,
                'status_code': result.status_code,
                'response_time_ms': result.response_time * 1000,
                'success': result.success,
                'error': result.error or ''
            })
        
        df = pd.DataFrame(data)
        df.to_csv(filename, index=False)
        logger.info(f"Raw data exported to {filename}")
    
    def _generate_charts(self, analysis: Dict[str, Any]):
        """Generate performance visualization charts"""
        try:
            import matplotlib.pyplot as plt
            
            # Response time over time chart
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
            
            # Chart 1: Response times over time
            timestamps = [r.timestamp for r in self.results if r.success]
            response_times = [r.response_time * 1000 for r in self.results if r.success]
            
            if timestamps and response_times:
                ax1.scatter(timestamps, response_times, alpha=0.6, s=1)
                ax1.set_title('Response Times Over Time')
                ax1.set_xlabel('Time')
                ax1.set_ylabel('Response Time (ms)')
                ax1.tick_params(axis='x', rotation=45)
            
            # Chart 2: Throughput over time
            if self.system_metrics:
                metric_times = [m.timestamp for m in self.system_metrics]
                cpu_usage = [m.cpu_percent for m in self.system_metrics]
                
                ax2.plot(metric_times, cpu_usage, 'r-', linewidth=1)
                ax2.set_title('CPU Usage During Test')
                ax2.set_xlabel('Time')
                ax2.set_ylabel('CPU Usage (%)')
                ax2.tick_params(axis='x', rotation=45)
            
            # Chart 3: Response time distribution
            if response_times:
                ax3.hist(response_times, bins=50, alpha=0.7, edgecolor='black')
                ax3.set_title('Response Time Distribution')
                ax3.set_xlabel('Response Time (ms)')
                ax3.set_ylabel('Frequency')
            
            # Chart 4: Success rate by endpoint
            endpoints = list(analysis['endpoint_breakdown'].keys())
            success_rates = [
                (stats['successful_requests'] / stats['total_requests']) * 100
                for stats in analysis['endpoint_breakdown'].values()
            ]
            
            if endpoints and success_rates:
                ax4.bar(range(len(endpoints)), success_rates)
                ax4.set_title('Success Rate by Endpoint')
                ax4.set_xlabel('Endpoint')
                ax4.set_ylabel('Success Rate (%)')
                ax4.set_xticks(range(len(endpoints)))
                ax4.set_xticklabels([ep.split('/')[-1] for ep in endpoints], rotation=45)
            
            plt.tight_layout()
            chart_file = Path(self.config.output_dir) / f"load_test_charts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            plt.savefig(chart_file, dpi=300, bbox_inches='tight')
            plt.close()
            
            logger.info(f"Charts saved to {chart_file}")
            
        except ImportError:
            logger.warning("Matplotlib not available, skipping chart generation")
        except Exception as e:
            logger.error(f"Failed to generate charts: {e}")
    
    def _print_summary(self, analysis: Dict[str, Any]):
        """Print test summary to console"""
        print("\n" + "="*60)
        print(" POLLARBASE LOAD TEST SUMMARY")
        print("="*60)
        
        config = analysis['test_config']
        metrics = analysis['performance_metrics']
        resources = analysis['system_resources']
        
        print(f"\n Test Configuration:")
        print(f"   • Concurrent Users: {config['concurrent_users']}")
        print(f"   • Duration: {config['duration_seconds']}s")
        print(f"   • Endpoints Tested: {config['total_endpoints']}")
        
        print(f"\n Performance Results:")
        print(f"   • Total Requests: {metrics['total_requests']:,}")
        print(f"   • Success Rate: {metrics['success_rate_percent']}%")
        print(f"   • Throughput: {metrics['throughput_rps']:.2f} req/sec")
        print(f"   • Avg Response Time: {metrics['avg_response_time_ms']:.2f}ms")
        print(f"   • P95 Response Time: {metrics['p95_response_time_ms']:.2f}ms")
        print(f"   • P99 Response Time: {metrics['p99_response_time_ms']:.2f}ms")
        
        print(f"\n System Resources:")
        print(f"   • Max CPU Usage: {resources['max_cpu_percent']}%")
        print(f"   • Avg CPU Usage: {resources['avg_cpu_percent']}%")
        print(f"   • Max Memory Usage: {resources['max_memory_percent']}%")
        print(f"   • Min Available Memory: {resources['min_memory_available_gb']:.2f}GB")
        
        # Performance assessment
        print(f"\n Performance Assessment:")
        
        if metrics['success_rate_percent'] >= 99:
            print("    Excellent reliability (>99% success rate)")
        elif metrics['success_rate_percent'] >= 95:
            print("     Good reliability (95-99% success rate)")
        else:
            print("    Poor reliability (<95% success rate)")
        
        if metrics['p95_response_time_ms'] <= 100:
            print("    Excellent response times (P95 < 100ms)")
        elif metrics['p95_response_time_ms'] <= 500:
            print("     Good response times (P95 < 500ms)")
        else:
            print("    Slow response times (P95 > 500ms)")
        
        if resources['max_cpu_percent'] <= 70:
            print("    Healthy CPU usage (< 70%)")
        elif resources['max_cpu_percent'] <= 90:
            print("     High CPU usage (70-90%)")
        else:
            print("    Critical CPU usage (> 90%)")
        
        if resources['max_memory_percent'] <= 80:
            print("    Healthy memory usage (< 80%)")
        elif resources['max_memory_percent'] <= 95:
            print("     High memory usage (80-95%)")
        else:
            print("    Critical memory usage (> 95%)")
        
        print(f"\n📁 Reports saved to: {self.config.output_dir}/")
        print("="*60)

async def main():
    """Main entry point for load testing"""
    parser = argparse.ArgumentParser(description="Pollarbase Load Testing Framework")
    parser.add_argument('--concurrent-users', type=int, default=10, help='Number of concurrent users')
    parser.add_argument('--duration', type=int, default=60, help='Test duration in seconds')
    parser.add_argument('--ramp-up', type=int, default=10, help='Ramp-up time in seconds')
    parser.add_argument('--base-url', default='http://localhost:8000', help='Base URL for testing')
    parser.add_argument('--auth-token', help='Authentication token (optional)')
    parser.add_argument('--output-dir', default='load_test_results', help='Output directory for results')
    
    args = parser.parse_args()
    
    config = LoadTestConfig(
        base_url=args.base_url,
        concurrent_users=args.concurrent_users,
        duration_seconds=args.duration,
        ramp_up_seconds=args.ramp_up,
        auth_token=args.auth_token,
        output_dir=args.output_dir
    )
    
    tester = LoadTester(config)
    
    try:
        await tester.run_load_test()
    except KeyboardInterrupt:
        logger.info("Load test interrupted by user")
    except Exception as e:
        logger.error(f"Load test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 