"""
Memory Profiling and Resource Monitoring Tests for Schlep-engine
==============================================================

This module provides comprehensive memory profiling and resource monitoring
to identify memory leaks, optimize resource usage, and ensure efficient
system operation under various load conditions.

Features:
- Line-by-line memory profiling
- Memory leak detection
- Resource usage tracking over time
- Memory growth pattern analysis
- Peak memory usage identification
- Resource efficiency scoring

Usage:
    # Run memory profiling tests
    python -m pytest tests/memory_profiling_tests.py -v -s
    
    # Profile specific functions
    python -m memory_profiler tests/memory_profiling_tests.py
    
    # Generate memory usage report
    python tests/memory_profiling_tests.py --profile-report
"""

import asyncio
import time
import gc
import psutil
import logging
import tracemalloc
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass
import argparse
import sys
import json
from contextlib import contextmanager

import pytest
import httpx
import numpy as np
from memory_profiler import profile, LineProfiler
import matplotlib.pyplot as plt

logger = logging.getLogger(__name__)

@dataclass
class MemorySnapshot:
    """Memory usage snapshot at a specific time"""
    timestamp: datetime
    rss_mb: float  # Resident Set Size
    vms_mb: float  # Virtual Memory Size
    shared_mb: float
    text_mb: float
    lib_mb: float
    data_mb: float
    dirty_mb: float
    available_mb: float
    percent_used: float

@dataclass
class MemoryProfileResult:
    """Result from memory profiling"""
    test_name: str
    start_time: datetime
    end_time: datetime
    baseline_memory_mb: float
    peak_memory_mb: float
    final_memory_mb: float
    max_memory_increase_mb: float
    avg_memory_mb: float
    memory_leak_detected: bool
    snapshots: List[MemorySnapshot]
    memory_efficiency_score: float
    
    @property
    def duration_seconds(self) -> float:
        return (self.end_time - self.start_time).total_seconds()
    
    @property
    def memory_growth_rate_mb_per_sec(self) -> float:
        if self.duration_seconds > 0:
            return (self.final_memory_mb - self.baseline_memory_mb) / self.duration_seconds
        return 0.0

class MemoryProfiler:
    """Advanced memory profiler with leak detection"""
    
    def __init__(self, sample_interval: float = 0.1):
        self.sample_interval = sample_interval
        self.snapshots: List[MemorySnapshot] = []
        self.process = psutil.Process()
        self.monitoring = False
        self.baseline_memory = 0.0
        
    def start_profiling(self):
        """Start memory profiling"""
        gc.collect()  # Clean up before starting
        tracemalloc.start()
        
        self.snapshots = []
        self.monitoring = True
        self.baseline_memory = self._get_memory_usage()
        
        logger.info(f"Memory profiling started, baseline: {self.baseline_memory:.2f}MB")
    
    def stop_profiling(self) -> Dict[str, Any]:
        """Stop profiling and return summary"""
        self.monitoring = False
        
        # Get tracemalloc statistics
        snapshot = tracemalloc.take_snapshot()
        top_stats = snapshot.statistics('lineno')
        
        tracemalloc.stop()
        gc.collect()  # Clean up after profiling
        
        if not self.snapshots:
            return {'error': 'No memory snapshots collected'}
        
        # Calculate statistics
        memory_values = [s.rss_mb for s in self.snapshots]
        peak_memory = max(memory_values)
        final_memory = memory_values[-1]
        avg_memory = np.mean(memory_values)
        
        # Detect memory leaks (sustained growth over time)
        leak_detected = self._detect_memory_leak()
        
        # Calculate efficiency score (lower memory usage = higher score)
        efficiency_score = self._calculate_efficiency_score(memory_values)
        
        return {
            'baseline_memory_mb': self.baseline_memory,
            'peak_memory_mb': peak_memory,
            'final_memory_mb': final_memory,
            'avg_memory_mb': avg_memory,
            'max_increase_mb': peak_memory - self.baseline_memory,
            'memory_leak_detected': leak_detected,
            'memory_efficiency_score': efficiency_score,
            'top_memory_consumers': [
                {
                    'filename': stat.traceback.format()[-1],
                    'size_mb': stat.size / (1024 * 1024),
                    'count': stat.count
                }
                for stat in top_stats[:10]
            ],
            'total_snapshots': len(self.snapshots)
        }
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            memory_info = self.process.memory_info()
            return memory_info.rss / (1024 * 1024)
        except (psutil.NoSuchProcess, psutil.ZombieProcess):
            return 0.0
    
    def _take_snapshot(self):
        """Take a memory snapshot"""
        if not self.monitoring:
            return
        
        try:
            memory_info = self.process.memory_info()
            memory_percent = self.process.memory_percent()
            
            # Get extended memory information
            try:
                extended_memory = self.process.memory_full_info()
                vms_mb = extended_memory.vms / (1024 * 1024)
                shared_mb = getattr(extended_memory, 'shared', 0) / (1024 * 1024)
                text_mb = getattr(extended_memory, 'text', 0) / (1024 * 1024)
                lib_mb = getattr(extended_memory, 'lib', 0) / (1024 * 1024)
                data_mb = getattr(extended_memory, 'data', 0) / (1024 * 1024)
                dirty_mb = getattr(extended_memory, 'dirty', 0) / (1024 * 1024)
            except (AttributeError, psutil.AccessDenied):
                # Fallback for systems that don't support extended memory info
                vms_mb = memory_info.vms / (1024 * 1024)
                shared_mb = text_mb = lib_mb = data_mb = dirty_mb = 0.0
            
            available_memory = psutil.virtual_memory().available / (1024 * 1024)
            
            snapshot = MemorySnapshot(
                timestamp=datetime.now(),
                rss_mb=memory_info.rss / (1024 * 1024),
                vms_mb=vms_mb,
                shared_mb=shared_mb,
                text_mb=text_mb,
                lib_mb=lib_mb,
                data_mb=data_mb,
                dirty_mb=dirty_mb,
                available_mb=available_memory,
                percent_used=memory_percent
            )
            
            self.snapshots.append(snapshot)
            
        except Exception as e:
            logger.warning(f"Failed to take memory snapshot: {e}")
    
    async def monitor_continuously(self):
        """Continuously monitor memory usage"""
        while self.monitoring:
            self._take_snapshot()
            await asyncio.sleep(self.sample_interval)
    
    def _detect_memory_leak(self) -> bool:
        """Detect potential memory leaks"""
        if len(self.snapshots) < 10:
            return False
        
        # Look for sustained growth trend
        memory_values = [s.rss_mb for s in self.snapshots]
        
        # Split into segments and check for consistent growth
        segment_size = len(memory_values) // 4
        if segment_size < 3:
            return False
        
        segments = [
            memory_values[i:i+segment_size] 
            for i in range(0, len(memory_values), segment_size)
        ]
        
        segment_averages = [np.mean(segment) for segment in segments if segment]
        
        # Check if each segment has higher average than the previous
        growth_segments = 0
        for i in range(1, len(segment_averages)):
            if segment_averages[i] > segment_averages[i-1] * 1.05:  # 5% growth threshold
                growth_segments += 1
        
        # Consider it a leak if 75% of segments show growth
        return growth_segments >= len(segment_averages) * 0.75
    
    def _calculate_efficiency_score(self, memory_values: List[float]) -> float:
        """Calculate memory efficiency score (0-100)"""
        if not memory_values:
            return 0.0
        
        max_memory = max(memory_values)
        min_memory = min(memory_values)
        avg_memory = np.mean(memory_values)
        
        # Score based on memory usage stability and efficiency
        stability_score = 100 - (((max_memory - min_memory) / avg_memory) * 100)
        stability_score = max(0, min(100, stability_score))
        
        # Efficiency based on total memory usage (lower is better)
        # Assume 1GB as baseline good usage, scale from there
        efficiency_score = max(0, 100 - (avg_memory / 10))  # 10MB per point
        efficiency_score = max(0, min(100, efficiency_score))
        
        # Combine scores
        return (stability_score + efficiency_score) / 2

@contextmanager
def memory_profile_context(test_name: str, sample_interval: float = 0.1):
    """Context manager for memory profiling"""
    profiler = MemoryProfiler(sample_interval)
    profiler.start_profiling()
    
    # Start monitoring task
    monitor_task = None
    
    try:
        # Start continuous monitoring
        loop = asyncio.get_event_loop()
        monitor_task = loop.create_task(profiler.monitor_continuously())
        
        start_time = datetime.now()
        yield profiler
        end_time = datetime.now()
        
    finally:
        if monitor_task:
            monitor_task.cancel()
        
        # Get profiling results
        summary = profiler.stop_profiling()
        
        if 'error' not in summary:
            result = MemoryProfileResult(
                test_name=test_name,
                start_time=start_time,
                end_time=end_time,
                baseline_memory_mb=summary['baseline_memory_mb'],
                peak_memory_mb=summary['peak_memory_mb'],
                final_memory_mb=summary['final_memory_mb'],
                max_memory_increase_mb=summary['max_increase_mb'],
                avg_memory_mb=summary['avg_memory_mb'],
                memory_leak_detected=summary['memory_leak_detected'],
                snapshots=profiler.snapshots,
                memory_efficiency_score=summary['memory_efficiency_score']
            )
            
            logger.info(f"Memory profiling completed for {test_name}:")
            logger.info(f"  Peak memory: {result.peak_memory_mb:.2f}MB")
            logger.info(f"  Memory increase: {result.max_memory_increase_mb:.2f}MB")
            logger.info(f"  Leak detected: {result.memory_leak_detected}")
            logger.info(f"  Efficiency score: {result.memory_efficiency_score:.1f}/100")

class APIMemoryTester:
    """Test API endpoints for memory usage and leaks"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: List[MemoryProfileResult] = []
    
    @profile
    async def test_endpoint_memory_usage(self, endpoint: str, iterations: int = 100, 
                                       concurrent_requests: int = 10) -> MemoryProfileResult:
        """Test endpoint memory usage with profiling"""
        
        test_name = f"memory_test_{endpoint.replace('/', '_')}"
        
        with memory_profile_context(test_name) as profiler:
            semaphore = asyncio.Semaphore(concurrent_requests)
            
            async def make_request(session: httpx.AsyncClient):
                async with semaphore:
                    try:
                        response = await session.get(f"{self.base_url}{endpoint}")
                        return response.status_code
                    except Exception as e:
                        logger.warning(f"Request failed: {e}")
                        return 0
            
            # Make requests
            async with httpx.AsyncClient(timeout=30.0) as client:
                tasks = [make_request(client) for _ in range(iterations)]
                await asyncio.gather(*tasks, return_exceptions=True)
            
            # Allow time for garbage collection
            await asyncio.sleep(1)
            gc.collect()
        
        # The result is automatically handled by the context manager
        return self.results[-1] if self.results else None
    
    @profile
    async def test_data_processing_memory(self, data_size: int = 1000) -> MemoryProfileResult:
        """Test data processing memory usage"""
        
        test_name = f"data_processing_memory_{data_size}"
        
        # Generate test data
        test_data = [{'id': i, 'value': f'data_{i}', 'metadata': {'created': datetime.now().isoformat()}} 
                    for i in range(data_size)]
        
        with memory_profile_context(test_name) as profiler:
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    # Simulate data processing
                    chunks = [test_data[i:i+100] for i in range(0, len(test_data), 100)]
                    
                    for chunk in chunks:
                        # Simulate processing each chunk
                        response = await self._simulate_data_processing(client, chunk)
                        
                        # Brief pause to allow memory monitoring
                        await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Data processing memory test failed: {e}")
            
            # Allow cleanup time
            await asyncio.sleep(2)
            gc.collect()
        
        return self.results[-1] if self.results else None
    
    async def _simulate_data_processing(self, client: httpx.AsyncClient, data_chunk: List[Dict]) -> Dict:
        """Simulate data processing (replace with actual API calls)"""
        # Simulate processing complexity
        processed_data = []
        
        for item in data_chunk:
            # Simulate some processing
            processed_item = {
                **item,
                'processed': True,
                'processed_at': datetime.now().isoformat(),
                'processing_metadata': {
                    'chunk_size': len(data_chunk),
                    'processing_time': time.time()
                }
            }
            processed_data.append(processed_item)
        
        # Simulate memory intensive operations
        import json
        serialized = json.dumps(processed_data)
        deserialized = json.loads(serialized)
        
        return {'success': True, 'processed_count': len(deserialized)}

class MemoryReportGenerator:
    """Generate memory profiling reports"""
    
    def __init__(self, output_dir: str = "memory_reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
    
    def generate_report(self, results: List[MemoryProfileResult]) -> str:
        """Generate comprehensive memory report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate visualizations
        chart_files = self._generate_charts(results, timestamp)
        
        # Generate HTML report
        html_report = self._generate_html_report(results, chart_files, timestamp)
        
        report_file = self.output_dir / f"memory_report_{timestamp}.html"
        with open(report_file, 'w') as f:
            f.write(html_report)
        
        # Generate JSON data
        json_file = self.output_dir / f"memory_data_{timestamp}.json"
        self._generate_json_report(results, json_file)
        
        logger.info(f"Memory report generated: {report_file}")
        return str(report_file)
    
    def _generate_charts(self, results: List[MemoryProfileResult], timestamp: str) -> Dict[str, str]:
        """Generate memory usage charts"""
        charts = {}
        
        if not results:
            return charts
        
        # Chart 1: Memory usage over time for each test
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
        
        colors = ['blue', 'red', 'green', 'orange', 'purple']
        
        for i, result in enumerate(results[:5]):  # Limit to 5 tests for clarity
            if result.snapshots:
                times = [(s.timestamp - result.start_time).total_seconds() for s in result.snapshots]
                memory_values = [s.rss_mb for s in result.snapshots]
                
                ax1.plot(times, memory_values, label=result.test_name, 
                        color=colors[i % len(colors)], alpha=0.7)
        
        ax1.set_xlabel('Time (seconds)')
        ax1.set_ylabel('Memory Usage (MB)')
        ax1.set_title('Memory Usage Over Time')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Chart 2: Peak memory comparison
        test_names = [r.test_name for r in results]
        peak_memories = [r.peak_memory_mb for r in results]
        
        bars = ax2.bar(range(len(test_names)), peak_memories, alpha=0.8, 
                      color=[colors[i % len(colors)] for i in range(len(test_names))])
        ax2.set_xlabel('Test')
        ax2.set_ylabel('Peak Memory (MB)')
        ax2.set_title('Peak Memory Usage by Test')
        ax2.set_xticks(range(len(test_names)))
        ax2.set_xticklabels([name[:15] + '...' if len(name) > 15 else name for name in test_names], 
                           rotation=45)
        
        # Add value labels on bars
        for bar, value in zip(bars, peak_memories):
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(peak_memories)*0.01,
                    f'{value:.1f}', ha='center', va='bottom')
        
        # Chart 3: Memory efficiency scores
        efficiency_scores = [r.memory_efficiency_score for r in results]
        
        bars = ax3.bar(range(len(test_names)), efficiency_scores, alpha=0.8,
                      color=['green' if score >= 80 else 'orange' if score >= 60 else 'red' 
                            for score in efficiency_scores])
        ax3.set_xlabel('Test')
        ax3.set_ylabel('Efficiency Score')
        ax3.set_title('Memory Efficiency Scores')
        ax3.set_xticks(range(len(test_names)))
        ax3.set_xticklabels([name[:15] + '...' if len(name) > 15 else name for name in test_names],
                           rotation=45)
        ax3.set_ylim(0, 100)
        
        # Chart 4: Memory leak detection
        leak_detected = [r.memory_leak_detected for r in results]
        leak_counts = [sum(leak_detected), len(leak_detected) - sum(leak_detected)]
        
        ax4.pie(leak_counts, labels=['Memory Leaks Detected', 'No Leaks'], 
               colors=['red', 'green'], autopct='%1.1f%%', startangle=90)
        ax4.set_title('Memory Leak Detection Summary')
        
        plt.tight_layout()
        
        chart_file = self.output_dir / f"memory_charts_{timestamp}.png"
        plt.savefig(chart_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        charts['memory_overview'] = chart_file.name
        
        return charts
    
    def _generate_html_report(self, results: List[MemoryProfileResult], 
                            charts: Dict[str, str], timestamp: str) -> str:
        """Generate HTML memory report"""
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Schlep-engine Memory Profiling Report - {timestamp}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .header {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
                .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }}
                .metric-card {{ background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; }}
                .metric-value {{ font-size: 24px; font-weight: bold; color: #007bff; }}
                .metric-label {{ color: #6c757d; font-size: 12px; text-transform: uppercase; }}
                .chart {{ text-align: center; margin: 30px 0; }}
                .leak-warning {{ color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0; }}
                .efficiency-good {{ color: #28a745; }}
                .efficiency-warning {{ color: #ffc107; }}
                .efficiency-poor {{ color: #dc3545; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f8f9fa; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Schlep-engine Memory Profiling Report</h1>
                <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Tests Analyzed:</strong> {len(results)}</p>
            </div>
        """
        
        if charts.get('memory_overview'):
            html += f"""
            <div class="chart">
                <h2>Memory Usage Overview</h2>
                <img src="{charts['memory_overview']}" alt="Memory Charts" style="max-width: 100%; height: auto;">
            </div>
            """
        
        # Summary metrics
        if results:
            total_tests = len(results)
            avg_peak_memory = np.mean([r.peak_memory_mb for r in results])
            leak_count = sum(1 for r in results if r.memory_leak_detected)
            avg_efficiency = np.mean([r.memory_efficiency_score for r in results])
            
            html += f"""
            <h2>Summary Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Tests</div>
                    <div class="metric-value">{total_tests}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Average Peak Memory</div>
                    <div class="metric-value">{avg_peak_memory:.2f}MB</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Memory Leaks Detected</div>
                    <div class="metric-value {'efficiency-poor' if leak_count > 0 else 'efficiency-good'}">{leak_count}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Average Efficiency Score</div>
                    <div class="metric-value {'efficiency-good' if avg_efficiency >= 80 else 'efficiency-warning' if avg_efficiency >= 60 else 'efficiency-poor'}">{avg_efficiency:.1f}/100</div>
                </div>
            </div>
            """
            
            if leak_count > 0:
                html += f"""
                <div class="leak-warning">
                    <strong>Warning:</strong> {leak_count} memory leak(s) detected. Investigation recommended.
                </div>
                """
        
        # Detailed results table
        html += """
        <h2>Detailed Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Duration</th>
                    <th>Baseline Memory</th>
                    <th>Peak Memory</th>
                    <th>Memory Increase</th>
                    <th>Efficiency Score</th>
                    <th>Leak Detected</th>
                </tr>
            </thead>
            <tbody>
        """
        
        for result in results:
            leak_status = "⚠️ Yes" if result.memory_leak_detected else "✓ No"
            leak_class = "efficiency-poor" if result.memory_leak_detected else "efficiency-good"
            
            efficiency_class = "efficiency-good" if result.memory_efficiency_score >= 80 else \
                             "efficiency-warning" if result.memory_efficiency_score >= 60 else \
                             "efficiency-poor"
            
            html += f"""
            <tr>
                <td>{result.test_name}</td>
                <td>{result.duration_seconds:.2f}s</td>
                <td>{result.baseline_memory_mb:.2f}MB</td>
                <td>{result.peak_memory_mb:.2f}MB</td>
                <td>{result.max_memory_increase_mb:.2f}MB</td>
                <td class="{efficiency_class}">{result.memory_efficiency_score:.1f}/100</td>
                <td class="{leak_class}">{leak_status}</td>
            </tr>
            """
        
        html += """
            </tbody>
        </table>
        
        <h2>Recommendations</h2>
        <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        """
        
        if results:
            # Generate recommendations based on results
            if leak_count > 0:
                html += '<p>🔴 <strong>Critical:</strong> Memory leaks detected. Review code for unreleased resources.</p>'
            
            if avg_peak_memory > 500:
                html += '<p>🟡 <strong>Warning:</strong> High memory usage detected. Consider optimization.</p>'
            
            if avg_efficiency < 60:
                html += '<p>🟡 <strong>Performance:</strong> Low memory efficiency. Review memory allocation patterns.</p>'
            
            if leak_count == 0 and avg_efficiency >= 80:
                html += '<p>🟢 <strong>Good:</strong> No memory leaks detected and good efficiency scores.</p>'
        
        html += """
        </div>
        </body>
        </html>
        """
        
        return html
    
    def _generate_json_report(self, results: List[MemoryProfileResult], json_file: Path):
        """Generate JSON report with detailed data"""
        data = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_tests': len(results),
                'memory_leaks_detected': sum(1 for r in results if r.memory_leak_detected),
                'average_peak_memory_mb': np.mean([r.peak_memory_mb for r in results]) if results else 0,
                'average_efficiency_score': np.mean([r.memory_efficiency_score for r in results]) if results else 0
            },
            'detailed_results': []
        }
        
        for result in results:
            data['detailed_results'].append({
                'test_name': result.test_name,
                'duration_seconds': result.duration_seconds,
                'baseline_memory_mb': result.baseline_memory_mb,
                'peak_memory_mb': result.peak_memory_mb,
                'final_memory_mb': result.final_memory_mb,
                'max_memory_increase_mb': result.max_memory_increase_mb,
                'memory_growth_rate_mb_per_sec': result.memory_growth_rate_mb_per_sec,
                'memory_leak_detected': result.memory_leak_detected,
                'memory_efficiency_score': result.memory_efficiency_score,
                'snapshot_count': len(result.snapshots)
            })
        
        with open(json_file, 'w') as f:
            json.dump(data, f, indent=2)

# Pytest integration
class TestMemoryProfiling:
    """Pytest integration for memory profiling tests"""
    
    def setup_method(self):
        self.tester = APIMemoryTester()
        self.reporter = MemoryReportGenerator()
    
    @pytest.mark.asyncio
    async def test_health_endpoint_memory(self):
        """Test health endpoint memory usage"""
        result = await self.tester.test_endpoint_memory_usage("/health", iterations=50)
        
        assert result is not None, "Memory profiling result should not be None"
        assert result.peak_memory_mb > 0, "Peak memory should be recorded"
        assert not result.memory_leak_detected, f"Memory leak detected in health endpoint"
        assert result.memory_efficiency_score >= 50, f"Low memory efficiency: {result.memory_efficiency_score}"
    
    @pytest.mark.asyncio
    async def test_data_processing_memory(self):
        """Test data processing memory usage"""
        result = await self.tester.test_data_processing_memory(data_size=1000)
        
        assert result is not None, "Memory profiling result should not be None"
        assert result.max_memory_increase_mb < 500, f"Memory increase too high: {result.max_memory_increase_mb}MB"
        assert not result.memory_leak_detected, f"Memory leak detected in data processing"
    
    @pytest.mark.asyncio
    async def test_memory_leak_detection(self):
        """Test memory leak detection across multiple operations"""
        results = []
        
        # Test multiple endpoints for memory leaks
        endpoints = ["/health", "/api/v1/auth/status"]
        
        for endpoint in endpoints:
            try:
                result = await self.tester.test_endpoint_memory_usage(endpoint, iterations=30)
                if result:
                    results.append(result)
            except Exception as e:
                logger.warning(f"Failed to test {endpoint}: {e}")
        
        assert len(results) > 0, "No memory profiling results collected"
        
        # Check for memory leaks
        leaky_tests = [r for r in results if r.memory_leak_detected]
        assert len(leaky_tests) == 0, f"Memory leaks detected in {len(leaky_tests)} tests"
        
        # Generate report
        report_file = self.reporter.generate_report(results)
        logger.info(f"Memory profiling report generated: {report_file}")

async def main():
    """CLI entry point for memory profiling"""
    parser = argparse.ArgumentParser(description="Memory Profiling Tests")
    parser.add_argument('--base-url', default='http://localhost:8000', help='Base URL for API')
    parser.add_argument('--profile-report', action='store_true', help='Generate profiling report')
    parser.add_argument('--endpoint', help='Specific endpoint to profile')
    parser.add_argument('--iterations', type=int, default=50, help='Number of iterations')
    
    args = parser.parse_args()
    
    tester = APIMemoryTester(args.base_url)
    reporter = MemoryReportGenerator()
    
    results = []
    
    if args.endpoint:
        # Profile specific endpoint
        result = await tester.test_endpoint_memory_usage(args.endpoint, iterations=args.iterations)
        if result:
            results.append(result)
    else:
        # Profile common endpoints
        endpoints = ["/health", "/api/v1/auth/status"]
        
        for endpoint in endpoints:
            try:
                result = await tester.test_endpoint_memory_usage(endpoint, iterations=args.iterations)
                if result:
                    results.append(result)
            except Exception as e:
                logger.error(f"Failed to profile {endpoint}: {e}")
        
        # Test data processing
        try:
            data_result = await tester.test_data_processing_memory(1000)
            if data_result:
                results.append(data_result)
        except Exception as e:
            logger.error(f"Failed to profile data processing: {e}")
    
    if results and args.profile_report:
        report_file = reporter.generate_report(results)
        print(f"Memory profiling report generated: {report_file}")
    
    # Print summary
    if results:
        print(f"\nMemory Profiling Summary:")
        for result in results:
            leak_status = "LEAK DETECTED" if result.memory_leak_detected else "OK"
            print(f"{result.test_name}: Peak {result.peak_memory_mb:.2f}MB, "
                  f"Efficiency {result.memory_efficiency_score:.1f}/100, "
                  f"Status: {leak_status}")

if __name__ == "__main__":
    asyncio.run(main())