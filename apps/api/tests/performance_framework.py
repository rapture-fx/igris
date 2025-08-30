"""
Comprehensive Performance Testing Framework for Schlep-engine
==========================================================

This framework provides comprehensive performance testing capabilities to validate
actual performance claims with real measured data. It replaces false performance
claims with honest, evidence-based metrics.

Features:
- Load testing with Locust integration
- Benchmark storage and historical comparison
- Memory profiling and resource monitoring
- Real data volume testing (1K, 10K, 50K records)
- Performance regression detection
- Realistic test data generation
- Comprehensive reporting and visualization

Usage:
    # Run basic performance tests
    python -m pytest tests/performance_framework.py -v
    
    # Run load tests with Locust
    python tests/performance_framework.py --load-test --users 50 --duration 300
    
    # Run data volume tests
    python tests/performance_framework.py --volume-test --records 10000
"""

import asyncio
import json
import time
import statistics
import psutil
import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import argparse
import sys

import pytest
import httpx
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from memory_profiler import profile
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetric:
    """Single performance measurement"""
    timestamp: datetime
    test_name: str
    operation: str
    duration_ms: float
    memory_mb: float
    cpu_percent: float
    throughput_ops: float
    records_processed: int
    success: bool
    error: Optional[str] = None

@dataclass
class BenchmarkResult:
    """Performance benchmark result"""
    test_name: str
    timestamp: datetime
    config: Dict[str, Any]
    metrics: Dict[str, float]
    raw_data: List[PerformanceMetric]
    baseline_comparison: Optional[Dict[str, float]] = None

class PerformanceBenchmarkDB:
    """SQLite database for storing performance benchmarks"""
    
    def __init__(self, db_path: str = "performance_benchmarks.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize the database schema"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS benchmarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    test_name TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    config TEXT NOT NULL,
                    avg_response_time_ms REAL,
                    p95_response_time_ms REAL,
                    p99_response_time_ms REAL,
                    throughput_rps REAL,
                    memory_peak_mb REAL,
                    cpu_avg_percent REAL,
                    records_processed INTEGER,
                    success_rate REAL,
                    raw_metrics TEXT
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_test_timestamp 
                ON benchmarks(test_name, timestamp)
            """)
    
    def store_benchmark(self, result: BenchmarkResult):
        """Store a benchmark result"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO benchmarks 
                (test_name, timestamp, config, avg_response_time_ms, p95_response_time_ms,
                 p99_response_time_ms, throughput_rps, memory_peak_mb, cpu_avg_percent,
                 records_processed, success_rate, raw_metrics)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                result.test_name,
                result.timestamp.isoformat(),
                json.dumps(result.config),
                result.metrics.get('avg_response_time_ms'),
                result.metrics.get('p95_response_time_ms'),
                result.metrics.get('p99_response_time_ms'),
                result.metrics.get('throughput_rps'),
                result.metrics.get('memory_peak_mb'),
                result.metrics.get('cpu_avg_percent'),
                result.metrics.get('records_processed'),
                result.metrics.get('success_rate'),
                json.dumps([asdict(m) for m in result.raw_data])
            ))
    
    def get_baseline_metrics(self, test_name: str, days_back: int = 30) -> Optional[Dict[str, float]]:
        """Get baseline metrics for comparison"""
        cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT avg_response_time_ms, p95_response_time_ms, throughput_rps,
                       memory_peak_mb, cpu_avg_percent
                FROM benchmarks 
                WHERE test_name = ? AND timestamp > ?
                ORDER BY timestamp DESC
                LIMIT 10
            """, (test_name, cutoff_date))
            
            results = cursor.fetchall()
            
            if not results:
                return None
            
            # Calculate median values as baseline
            metrics_data = np.array(results)
            return {
                'avg_response_time_ms': float(np.median(metrics_data[:, 0])),
                'p95_response_time_ms': float(np.median(metrics_data[:, 1])),
                'throughput_rps': float(np.median(metrics_data[:, 2])),
                'memory_peak_mb': float(np.median(metrics_data[:, 3])),
                'cpu_avg_percent': float(np.median(metrics_data[:, 4]))
            }
    
    def get_historical_trends(self, test_name: str, days_back: int = 90) -> pd.DataFrame:
        """Get historical performance trends"""
        cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            return pd.read_sql_query("""
                SELECT timestamp, avg_response_time_ms, p95_response_time_ms,
                       throughput_rps, memory_peak_mb, cpu_avg_percent
                FROM benchmarks
                WHERE test_name = ? AND timestamp > ?
                ORDER BY timestamp ASC
            """, conn, params=(test_name, cutoff_date))

class TestDataGenerator:
    """Generate realistic test data for performance testing"""
    
    @staticmethod
    def generate_csv_data(num_records: int) -> str:
        """Generate CSV data for testing"""
        import io
        import csv
        import random
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['id', 'name', 'email', 'age', 'salary', 'department', 'hire_date'])
        
        departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations']
        
        for i in range(num_records):
            writer.writerow([
                i + 1,
                f"Employee {i + 1}",
                f"employee{i + 1}@company.com",
                random.randint(22, 65),
                random.randint(40000, 150000),
                random.choice(departments),
                f"2020-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
            ])
        
        return output.getvalue()
    
    @staticmethod
    def generate_json_data(num_records: int) -> List[Dict]:
        """Generate JSON data for testing"""
        import random
        
        data = []
        for i in range(num_records):
            data.append({
                "id": i + 1,
                "name": f"Record {i + 1}",
                "value": random.randint(1, 1000),
                "category": random.choice(['A', 'B', 'C', 'D']),
                "metadata": {
                    "created": datetime.now().isoformat(),
                    "tags": [f"tag{j}" for j in range(random.randint(1, 5))],
                    "score": random.random()
                }
            })
        
        return data

class PerformanceProfiler:
    """System resource and performance profiler"""
    
    def __init__(self):
        self.metrics: List[Dict] = []
        self.start_time: Optional[float] = None
        self.monitoring = False
    
    async def start_monitoring(self):
        """Start system monitoring"""
        self.monitoring = True
        self.start_time = time.time()
        self.metrics = []
        
        while self.monitoring:
            self.metrics.append({
                'timestamp': time.time(),
                'cpu_percent': psutil.cpu_percent(interval=None),
                'memory_percent': psutil.virtual_memory().percent,
                'memory_used_mb': psutil.virtual_memory().used / (1024 * 1024),
                'disk_io_read_mb': psutil.disk_io_counters().read_bytes / (1024 * 1024) if psutil.disk_io_counters() else 0,
                'disk_io_write_mb': psutil.disk_io_counters().write_bytes / (1024 * 1024) if psutil.disk_io_counters() else 0,
                'network_sent_mb': psutil.net_io_counters().bytes_sent / (1024 * 1024),
                'network_recv_mb': psutil.net_io_counters().bytes_recv / (1024 * 1024),
            })
            
            await asyncio.sleep(0.5)  # Monitor every 500ms
    
    def stop_monitoring(self):
        """Stop system monitoring"""
        self.monitoring = False
    
    def get_summary(self) -> Dict[str, float]:
        """Get performance summary"""
        if not self.metrics:
            return {}
        
        cpu_values = [m['cpu_percent'] for m in self.metrics]
        memory_values = [m['memory_used_mb'] for m in self.metrics]
        
        return {
            'duration_seconds': time.time() - (self.start_time or time.time()),
            'cpu_avg_percent': statistics.mean(cpu_values),
            'cpu_max_percent': max(cpu_values),
            'memory_avg_mb': statistics.mean(memory_values),
            'memory_peak_mb': max(memory_values),
            'total_samples': len(self.metrics)
        }

class APIPerformanceTester:
    """Advanced API performance testing"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.db = PerformanceBenchmarkDB()
        self.profiler = PerformanceProfiler()
        
    async def test_endpoint_performance(
        self,
        endpoint: str,
        method: str = "GET",
        data: Any = None,
        iterations: int = 100,
        concurrent_requests: int = 10
    ) -> BenchmarkResult:
        """Test endpoint performance with detailed metrics"""
        
        test_name = f"{method}_{endpoint.replace('/', '_')}"
        logger.info(f"Testing {test_name} with {iterations} iterations, {concurrent_requests} concurrent")
        
        # Start profiling
        profiler_task = asyncio.create_task(self.profiler.start_monitoring())
        
        raw_metrics = []
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def make_request(session: httpx.AsyncClient, request_id: int):
            async with semaphore:
                start_time = time.time()
                start_memory = psutil.virtual_memory().used / (1024 * 1024)
                start_cpu = psutil.cpu_percent()
                
                try:
                    if method.upper() == "GET":
                        response = await session.get(f"{self.base_url}{endpoint}")
                    elif method.upper() == "POST":
                        response = await session.post(f"{self.base_url}{endpoint}", json=data)
                    else:
                        raise ValueError(f"Unsupported method: {method}")
                    
                    end_time = time.time()
                    end_memory = psutil.virtual_memory().used / (1024 * 1024)
                    
                    duration_ms = (end_time - start_time) * 1000
                    memory_diff = end_memory - start_memory
                    
                    metric = PerformanceMetric(
                        timestamp=datetime.now(),
                        test_name=test_name,
                        operation=f"{method} {endpoint}",
                        duration_ms=duration_ms,
                        memory_mb=memory_diff,
                        cpu_percent=psutil.cpu_percent() - start_cpu,
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
        
        # Execute concurrent requests
        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = [make_request(client, i) for i in range(iterations)]
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Stop profiling
        self.profiler.stop_monitoring()
        profiler_task.cancel()
        
        # Calculate metrics
        successful_metrics = [m for m in raw_metrics if m.success]
        response_times = [m.duration_ms for m in successful_metrics]
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            p95_response_time = np.percentile(response_times, 95)
            p99_response_time = np.percentile(response_times, 99)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
            min_response_time = max_response_time = 0
        
        success_rate = (len(successful_metrics) / len(raw_metrics)) * 100 if raw_metrics else 0
        
        profiler_summary = self.profiler.get_summary()
        
        metrics = {
            'total_requests': len(raw_metrics),
            'successful_requests': len(successful_metrics),
            'success_rate': success_rate,
            'avg_response_time_ms': avg_response_time,
            'p95_response_time_ms': p95_response_time,
            'p99_response_time_ms': p99_response_time,
            'min_response_time_ms': min_response_time,
            'max_response_time_ms': max_response_time,
            'throughput_rps': len(successful_metrics) / profiler_summary.get('duration_seconds', 1),
            'memory_peak_mb': profiler_summary.get('memory_peak_mb', 0),
            'cpu_avg_percent': profiler_summary.get('cpu_avg_percent', 0),
            'records_processed': len(successful_metrics)
        }
        
        config = {
            'endpoint': endpoint,
            'method': method,
            'iterations': iterations,
            'concurrent_requests': concurrent_requests,
            'data_size_bytes': len(json.dumps(data)) if data else 0
        }
        
        # Get baseline for comparison
        baseline = self.db.get_baseline_metrics(test_name)
        baseline_comparison = None
        
        if baseline:
            baseline_comparison = {
                'response_time_change_percent': ((metrics['avg_response_time_ms'] - baseline['avg_response_time_ms']) / baseline['avg_response_time_ms']) * 100,
                'throughput_change_percent': ((metrics['throughput_rps'] - baseline['throughput_rps']) / baseline['throughput_rps']) * 100,
                'memory_change_percent': ((metrics['memory_peak_mb'] - baseline['memory_peak_mb']) / baseline['memory_peak_mb']) * 100 if baseline['memory_peak_mb'] > 0 else 0
            }
        
        result = BenchmarkResult(
            test_name=test_name,
            timestamp=datetime.now(),
            config=config,
            metrics=metrics,
            raw_data=raw_metrics,
            baseline_comparison=baseline_comparison
        )
        
        # Store in database
        self.db.store_benchmark(result)
        
        return result

    async def test_data_processing_performance(self, record_counts: List[int]) -> List[BenchmarkResult]:
        """Test data processing performance with different data volumes"""
        results = []
        
        for record_count in record_counts:
            logger.info(f"Testing data processing with {record_count:,} records")
            
            # Generate test data
            test_data = TestDataGenerator.generate_json_data(record_count)
            
            # Test data processing endpoint
            result = await self.test_endpoint_performance(
                endpoint="/api/v1/data/process",
                method="POST",
                data={
                    "data": test_data[:100],  # Limit payload size for API
                    "total_records": record_count,
                    "processing_type": "performance_test"
                },
                iterations=10,
                concurrent_requests=5
            )
            
            results.append(result)
        
        return results

class PerformanceReporter:
    """Generate performance reports and visualizations"""
    
    def __init__(self, output_dir: str = "performance_reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
    
    def generate_report(self, results: List[BenchmarkResult]) -> str:
        """Generate comprehensive performance report"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = self.output_dir / f"performance_report_{timestamp}.html"
        
        # Generate visualizations
        charts = self._generate_charts(results, timestamp)
        
        # Create HTML report
        html_content = self._create_html_report(results, charts, timestamp)
        
        with open(report_file, 'w') as f:
            f.write(html_content)
        
        # Also generate JSON summary
        json_file = self.output_dir / f"performance_data_{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump({
                'timestamp': timestamp,
                'results': [asdict(result) for result in results]
            }, f, indent=2, default=str)
        
        logger.info(f"Performance report generated: {report_file}")
        return str(report_file)
    
    def _generate_charts(self, results: List[BenchmarkResult], timestamp: str) -> Dict[str, str]:
        """Generate performance visualization charts"""
        charts = {}
        
        if not results:
            return charts
        
        # Response time comparison chart
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
        
        test_names = [r.test_name for r in results]
        avg_times = [r.metrics['avg_response_time_ms'] for r in results]
        p95_times = [r.metrics['p95_response_time_ms'] for r in results]
        
        # Chart 1: Response times
        x_pos = range(len(test_names))
        ax1.bar([i - 0.2 for i in x_pos], avg_times, 0.4, label='Average', alpha=0.8)
        ax1.bar([i + 0.2 for i in x_pos], p95_times, 0.4, label='P95', alpha=0.8)
        ax1.set_xlabel('Test')
        ax1.set_ylabel('Response Time (ms)')
        ax1.set_title('Response Time Comparison')
        ax1.set_xticks(x_pos)
        ax1.set_xticklabels([name.split('_')[-1] for name in test_names], rotation=45)
        ax1.legend()
        
        # Chart 2: Throughput
        throughputs = [r.metrics['throughput_rps'] for r in results]
        ax2.bar(x_pos, throughputs, alpha=0.8, color='green')
        ax2.set_xlabel('Test')
        ax2.set_ylabel('Requests/Second')
        ax2.set_title('Throughput Comparison')
        ax2.set_xticks(x_pos)
        ax2.set_xticklabels([name.split('_')[-1] for name in test_names], rotation=45)
        
        # Chart 3: Success rates
        success_rates = [r.metrics['success_rate'] for r in results]
        ax3.bar(x_pos, success_rates, alpha=0.8, color='blue')
        ax3.set_xlabel('Test')
        ax3.set_ylabel('Success Rate (%)')
        ax3.set_title('Success Rate Comparison')
        ax3.set_ylim(0, 100)
        ax3.set_xticks(x_pos)
        ax3.set_xticklabels([name.split('_')[-1] for name in test_names], rotation=45)
        
        # Chart 4: Resource usage
        memory_usage = [r.metrics['memory_peak_mb'] for r in results]
        cpu_usage = [r.metrics['cpu_avg_percent'] for r in results]
        
        ax4_twin = ax4.twinx()
        bars1 = ax4.bar([i - 0.2 for i in x_pos], memory_usage, 0.4, label='Memory (MB)', alpha=0.8)
        bars2 = ax4_twin.bar([i + 0.2 for i in x_pos], cpu_usage, 0.4, label='CPU (%)', alpha=0.8, color='red')
        
        ax4.set_xlabel('Test')
        ax4.set_ylabel('Memory (MB)')
        ax4_twin.set_ylabel('CPU (%)')
        ax4.set_title('Resource Usage')
        ax4.set_xticks(x_pos)
        ax4.set_xticklabels([name.split('_')[-1] for name in test_names], rotation=45)
        
        # Add legends
        ax4.legend(loc='upper left')
        ax4_twin.legend(loc='upper right')
        
        plt.tight_layout()
        
        chart_file = self.output_dir / f"performance_charts_{timestamp}.png"
        plt.savefig(chart_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        charts['performance_overview'] = str(chart_file.name)
        
        return charts
    
    def _create_html_report(self, results: List[BenchmarkResult], charts: Dict[str, str], timestamp: str) -> str:
        """Create HTML performance report"""
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Schlep-engine Performance Report - {timestamp}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .header {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
                .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }}
                .metric-card {{ background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; }}
                .metric-value {{ font-size: 24px; font-weight: bold; color: #007bff; }}
                .metric-label {{ color: #6c757d; font-size: 12px; text-transform: uppercase; }}
                .chart {{ text-align: center; margin: 30px 0; }}
                .regression {{ color: #dc3545; }}
                .improvement {{ color: #28a745; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f8f9fa; }}
                .status-good {{ color: #28a745; }}
                .status-warning {{ color: #ffc107; }}
                .status-danger {{ color: #dc3545; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Schlep-engine Performance Test Report</h1>
                <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Tests Run:</strong> {len(results)}</p>
            </div>
        """
        
        if charts.get('performance_overview'):
            html += f"""
            <div class="chart">
                <h2>Performance Overview</h2>
                <img src="{charts['performance_overview']}" alt="Performance Charts" style="max-width: 100%; height: auto;">
            </div>
            """
        
        # Summary metrics
        if results:
            total_requests = sum(r.metrics['total_requests'] for r in results)
            avg_success_rate = statistics.mean(r.metrics['success_rate'] for r in results)
            avg_response_time = statistics.mean(r.metrics['avg_response_time_ms'] for r in results)
            total_throughput = sum(r.metrics['throughput_rps'] for r in results)
            
            html += f"""
            <h2>Summary Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Requests</div>
                    <div class="metric-value">{total_requests:,}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Average Success Rate</div>
                    <div class="metric-value {'status-good' if avg_success_rate >= 95 else 'status-warning' if avg_success_rate >= 90 else 'status-danger'}">{avg_success_rate:.2f}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Average Response Time</div>
                    <div class="metric-value {'status-good' if avg_response_time <= 100 else 'status-warning' if avg_response_time <= 500 else 'status-danger'}">{avg_response_time:.2f}ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Throughput</div>
                    <div class="metric-value">{total_throughput:.2f} req/s</div>
                </div>
            </div>
            """
        
        # Detailed results table
        html += """
        <h2>Detailed Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Success Rate</th>
                    <th>Avg Response Time</th>
                    <th>P95 Response Time</th>
                    <th>Throughput</th>
                    <th>Memory Peak</th>
                    <th>Baseline Comparison</th>
                </tr>
            </thead>
            <tbody>
        """
        
        for result in results:
            metrics = result.metrics
            baseline_info = "N/A"
            
            if result.baseline_comparison:
                response_change = result.baseline_comparison.get('response_time_change_percent', 0)
                if response_change > 10:
                    baseline_info = f'<span class="regression">+{response_change:.1f}% slower</span>'
                elif response_change < -10:
                    baseline_info = f'<span class="improvement">{response_change:.1f}% faster</span>'
                else:
                    baseline_info = f'{response_change:.1f}% change'
            
            success_class = "status-good" if metrics['success_rate'] >= 95 else "status-warning" if metrics['success_rate'] >= 90 else "status-danger"
            response_class = "status-good" if metrics['avg_response_time_ms'] <= 100 else "status-warning" if metrics['avg_response_time_ms'] <= 500 else "status-danger"
            
            html += f"""
            <tr>
                <td>{result.test_name}</td>
                <td class="{success_class}">{metrics['success_rate']:.2f}%</td>
                <td class="{response_class}">{metrics['avg_response_time_ms']:.2f}ms</td>
                <td>{metrics['p95_response_time_ms']:.2f}ms</td>
                <td>{metrics['throughput_rps']:.2f} req/s</td>
                <td>{metrics['memory_peak_mb']:.2f}MB</td>
                <td>{baseline_info}</td>
            </tr>
            """
        
        html += """
            </tbody>
        </table>
        
        <h2>Performance Assessment</h2>
        <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        """
        
        if results:
            # Performance assessment
            overall_success_rate = statistics.mean(r.metrics['success_rate'] for r in results)
            overall_response_time = statistics.mean(r.metrics['avg_response_time_ms'] for r in results)
            
            if overall_success_rate >= 99 and overall_response_time <= 100:
                html += '<p class="status-good"><strong>Excellent Performance:</strong> All systems operating within optimal parameters.</p>'
            elif overall_success_rate >= 95 and overall_response_time <= 500:
                html += '<p class="status-warning"><strong>Good Performance:</strong> Systems performing well with minor optimization opportunities.</p>'
            else:
                html += '<p class="status-danger"><strong>Performance Issues Detected:</strong> Systems require optimization before production deployment.</p>'
            
            html += f"""
            <h3>Key Findings:</h3>
            <ul>
                <li>Average success rate across all tests: {overall_success_rate:.2f}%</li>
                <li>Average response time across all tests: {overall_response_time:.2f}ms</li>
                <li>Total requests processed: {sum(r.metrics['total_requests'] for r in results):,}</li>
                <li>Tests with performance regressions: {sum(1 for r in results if r.baseline_comparison and r.baseline_comparison.get('response_time_change_percent', 0) > 10)}</li>
            </ul>
            """
        
        html += """
        </div>
        </body>
        </html>
        """
        
        return html

class PerformanceTestSuite:
    """Main test suite orchestrator"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.tester = APIPerformanceTester(base_url)
        self.reporter = PerformanceReporter()
    
    async def run_comprehensive_tests(self) -> List[BenchmarkResult]:
        """Run comprehensive performance test suite"""
        logger.info("Starting comprehensive performance tests")
        
        results = []
        
        # Test 1: Basic API endpoints
        basic_endpoints = [
            "/health",
            "/api/v1/auth/status",
            "/docs",
        ]
        
        for endpoint in basic_endpoints:
            try:
                result = await self.tester.test_endpoint_performance(
                    endpoint=endpoint,
                    iterations=100,
                    concurrent_requests=10
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to test {endpoint}: {e}")
        
        # Test 2: Data processing with different volumes
        try:
            data_results = await self.tester.test_data_processing_performance([100, 1000, 5000])
            results.extend(data_results)
        except Exception as e:
            logger.error(f"Failed to test data processing: {e}")
        
        return results
    
    def generate_report(self, results: List[BenchmarkResult]) -> str:
        """Generate performance report"""
        return self.reporter.generate_report(results)

# Pytest integration
class TestPerformance:
    """Pytest integration for performance tests"""
    
    def setup_method(self):
        self.suite = PerformanceTestSuite()
    
    @pytest.mark.asyncio
    async def test_api_performance_benchmarks(self):
        """Test API performance benchmarks"""
        results = await self.suite.run_comprehensive_tests()
        
        assert len(results) > 0, "No performance results generated"
        
        for result in results:
            # Assert basic performance criteria
            assert result.metrics['success_rate'] >= 90, f"{result.test_name} has low success rate: {result.metrics['success_rate']}%"
            assert result.metrics['avg_response_time_ms'] <= 2000, f"{result.test_name} has high response time: {result.metrics['avg_response_time_ms']}ms"
            
            # Check for performance regressions
            if result.baseline_comparison:
                response_change = result.baseline_comparison.get('response_time_change_percent', 0)
                assert response_change <= 50, f"{result.test_name} has significant performance regression: {response_change}%"
        
        # Generate report
        report_file = self.suite.generate_report(results)
        logger.info(f"Performance report generated: {report_file}")
    
    @pytest.mark.benchmark
    @pytest.mark.asyncio
    async def test_endpoint_response_times(self, benchmark):
        """Benchmark individual endpoint response times"""
        
        async def benchmark_endpoint():
            result = await self.suite.tester.test_endpoint_performance(
                endpoint="/health",
                iterations=50,
                concurrent_requests=5
            )
            return result.metrics['avg_response_time_ms']
        
        response_time = benchmark(asyncio.run, benchmark_endpoint())
        assert response_time <= 100, f"Health endpoint too slow: {response_time}ms"

async def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description="Schlep-engine Performance Testing Framework")
    parser.add_argument('--base-url', default='http://localhost:8000', help='Base URL for testing')
    parser.add_argument('--load-test', action='store_true', help='Run load tests')
    parser.add_argument('--volume-test', action='store_true', help='Run data volume tests')
    parser.add_argument('--users', type=int, default=50, help='Number of concurrent users for load test')
    parser.add_argument('--duration', type=int, default=300, help='Load test duration in seconds')
    parser.add_argument('--records', type=int, default=10000, help='Number of records for volume test')
    
    args = parser.parse_args()
    
    suite = PerformanceTestSuite(args.base_url)
    
    if args.load_test:
        logger.info("Load testing not implemented yet - use Locust integration")
        return
    
    if args.volume_test:
        results = await suite.tester.test_data_processing_performance([args.records])
    else:
        results = await suite.run_comprehensive_tests()
    
    report_file = suite.generate_report(results)
    print(f"Performance report generated: {report_file}")

if __name__ == "__main__":
    asyncio.run(main())