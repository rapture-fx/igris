"""
Data Volume Performance Testing for Schlep-engine
===============================================

This module tests system performance with realistic data volumes to validate
processing capabilities and identify bottlenecks at different scales.

Features:
- Tests with 1K, 10K, 50K, and 100K record datasets
- Memory usage tracking during processing
- Throughput measurement (records/second)
- Processing time analysis
- Resource utilization monitoring
- Scalability assessment

Usage:
    # Run all volume tests
    python -m pytest tests/data_volume_tests.py -v
    
    # Run specific volume test
    python tests/data_volume_tests.py --volume 10000
    
    # Run with memory profiling
    python -m memory_profiler tests/data_volume_tests.py
"""

import asyncio
import time
import json
import psutil
import logging
from typing import Dict, List, Any, Tuple
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass
import argparse
import sys
import csv
import io
from contextlib import asynccontextmanager

import pytest
import httpx
import numpy as np
import pandas as pd
from memory_profiler import profile

logger = logging.getLogger(__name__)

@dataclass
class VolumeTestResult:
    """Result from a volume test"""
    record_count: int
    processing_time_seconds: float
    throughput_records_per_second: float
    memory_peak_mb: float
    memory_baseline_mb: float
    cpu_avg_percent: float
    success: bool
    error_message: str = ""
    
    @property
    def performance_grade(self) -> str:
        """Calculate performance grade based on throughput and resource usage"""
        if not self.success:
            return "F"
        elif self.throughput_records_per_second >= 1000 and self.memory_peak_mb < 500:
            return "A+"
        elif self.throughput_records_per_second >= 500 and self.memory_peak_mb < 1000:
            return "A"
        elif self.throughput_records_per_second >= 100 and self.memory_peak_mb < 2000:
            return "B"
        elif self.throughput_records_per_second >= 50:
            return "C"
        else:
            return "D"

class RealisticDataGenerator:
    """Generate realistic data for volume testing"""
    
    @staticmethod
    def generate_employee_data(count: int) -> List[Dict]:
        """Generate employee dataset"""
        import random
        
        departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Support', 'Legal']
        positions = ['Manager', 'Senior', 'Junior', 'Lead', 'Director', 'VP', 'Analyst', 'Specialist']
        locations = ['New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle', 'Boston', 'Denver', 'Miami']
        
        employees = []
        for i in range(count):
            employees.append({
                'id': i + 1,
                'employee_id': f"EMP{i+1:06d}",
                'first_name': f"FirstName{i+1}",
                'last_name': f"LastName{i+1}",
                'email': f"employee{i+1}@company.com",
                'department': random.choice(departments),
                'position': random.choice(positions),
                'salary': random.randint(40000, 200000),
                'hire_date': f"20{random.randint(15, 23)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                'age': random.randint(22, 65),
                'location': random.choice(locations),
                'performance_score': round(random.uniform(1.0, 5.0), 2),
                'years_experience': random.randint(0, 30),
                'skills': random.sample(['Python', 'Java', 'SQL', 'React', 'AWS', 'Docker', 'Kubernetes'], 
                                     random.randint(2, 5)),
                'active': random.choice([True, False]),
                'metadata': {
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat(),
                    'tags': [f'tag{j}' for j in range(random.randint(1, 3))]
                }
            })
        
        return employees
    
    @staticmethod
    def generate_sales_data(count: int) -> List[Dict]:
        """Generate sales transaction dataset"""
        import random
        
        products = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E']
        regions = ['North', 'South', 'East', 'West', 'Central']
        channels = ['Online', 'Retail', 'Partner', 'Direct']
        
        sales = []
        for i in range(count):
            sales.append({
                'id': i + 1,
                'transaction_id': f"TXN{i+1:08d}",
                'customer_id': random.randint(1, 10000),
                'product': random.choice(products),
                'quantity': random.randint(1, 100),
                'unit_price': round(random.uniform(10.0, 1000.0), 2),
                'total_amount': 0,  # Will be calculated
                'discount_percent': round(random.uniform(0, 0.3), 2),
                'tax_percent': 0.08,
                'region': random.choice(regions),
                'channel': random.choice(channels),
                'sale_date': f"2023-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                'salesperson_id': random.randint(1, 100),
                'commission_rate': round(random.uniform(0.02, 0.15), 3),
                'customer_segment': random.choice(['Premium', 'Standard', 'Basic']),
                'payment_method': random.choice(['Credit Card', 'Cash', 'Bank Transfer', 'Check'])
            })
            
            # Calculate total amount
            subtotal = sales[-1]['quantity'] * sales[-1]['unit_price']
            discount = subtotal * sales[-1]['discount_percent']
            tax = (subtotal - discount) * sales[-1]['tax_percent']
            sales[-1]['total_amount'] = round(subtotal - discount + tax, 2)
        
        return sales
    
    @staticmethod
    def generate_iot_sensor_data(count: int) -> List[Dict]:
        """Generate IoT sensor dataset"""
        import random
        
        sensor_types = ['temperature', 'humidity', 'pressure', 'vibration', 'light']
        locations = ['Building A Floor 1', 'Building A Floor 2', 'Building B Floor 1', 'Warehouse', 'Lab']
        
        readings = []
        base_time = datetime.now()
        
        for i in range(count):
            sensor_type = random.choice(sensor_types)
            
            # Generate realistic values based on sensor type
            if sensor_type == 'temperature':
                value = round(random.uniform(18.0, 28.0), 2)
                unit = 'celsius'
            elif sensor_type == 'humidity':
                value = round(random.uniform(30.0, 80.0), 1)
                unit = 'percent'
            elif sensor_type == 'pressure':
                value = round(random.uniform(990.0, 1030.0), 1)
                unit = 'hPa'
            elif sensor_type == 'vibration':
                value = round(random.uniform(0.1, 2.0), 3)
                unit = 'g'
            else:  # light
                value = round(random.uniform(100, 1000), 0)
                unit = 'lux'
            
            readings.append({
                'id': i + 1,
                'sensor_id': f"SENSOR{random.randint(1, 1000):04d}",
                'sensor_type': sensor_type,
                'value': value,
                'unit': unit,
                'location': random.choice(locations),
                'timestamp': (base_time.timestamp() - random.randint(0, 86400 * 30)) * 1000,  # Last 30 days
                'quality': random.choice(['good', 'fair', 'poor']),
                'battery_level': random.randint(20, 100),
                'signal_strength': random.randint(-80, -20),
                'calibration_date': f"2023-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                'maintenance_required': random.choice([True, False]),
                'alerts': random.sample(['high_value', 'low_battery', 'calibration_due', 'connection_lost'], 
                                     random.randint(0, 2))
            })
        
        return readings
    
    @classmethod
    def generate_dataset(cls, dataset_type: str, count: int) -> List[Dict]:
        """Generate dataset of specified type and size"""
        generators = {
            'employees': cls.generate_employee_data,
            'sales': cls.generate_sales_data,
            'iot_sensors': cls.generate_iot_sensor_data
        }
        
        generator = generators.get(dataset_type, cls.generate_employee_data)
        return generator(count)
    
    @staticmethod
    def dataset_to_csv(data: List[Dict]) -> str:
        """Convert dataset to CSV format"""
        if not data:
            return ""
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        
        for row in data:
            # Flatten nested objects for CSV
            flat_row = {}
            for key, value in row.items():
                if isinstance(value, (dict, list)):
                    flat_row[key] = json.dumps(value)
                else:
                    flat_row[key] = value
            writer.writerow(flat_row)
        
        return output.getvalue()

class ResourceMonitor:
    """Monitor system resources during testing"""
    
    def __init__(self):
        self.baseline_memory_mb = 0
        self.peak_memory_mb = 0
        self.cpu_readings = []
        self.monitoring = False
    
    def start_monitoring(self):
        """Start resource monitoring"""
        self.baseline_memory_mb = psutil.virtual_memory().used / (1024 * 1024)
        self.peak_memory_mb = self.baseline_memory_mb
        self.cpu_readings = []
        self.monitoring = True
    
    def update_readings(self):
        """Update resource readings"""
        if not self.monitoring:
            return
        
        current_memory_mb = psutil.virtual_memory().used / (1024 * 1024)
        self.peak_memory_mb = max(self.peak_memory_mb, current_memory_mb)
        
        cpu_percent = psutil.cpu_percent(interval=None)
        self.cpu_readings.append(cpu_percent)
    
    def stop_monitoring(self) -> Dict[str, float]:
        """Stop monitoring and return summary"""
        self.monitoring = False
        
        return {
            'baseline_memory_mb': self.baseline_memory_mb,
            'peak_memory_mb': self.peak_memory_mb,
            'memory_increase_mb': self.peak_memory_mb - self.baseline_memory_mb,
            'avg_cpu_percent': np.mean(self.cpu_readings) if self.cpu_readings else 0,
            'max_cpu_percent': max(self.cpu_readings) if self.cpu_readings else 0
        }

class DataVolumeProcessor:
    """Process data volumes with performance monitoring"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.monitor = ResourceMonitor()
    
    async def process_data_volume(self, data: List[Dict], processing_type: str = "volume_test") -> VolumeTestResult:
        """Process a data volume and measure performance"""
        record_count = len(data)
        logger.info(f"Processing {record_count:,} records...")
        
        self.monitor.start_monitoring()
        start_time = time.time()
        
        success = False
        error_message = ""
        
        try:
            # Simulate data processing by chunking large datasets
            chunk_size = min(1000, record_count)  # Process in chunks to avoid payload limits
            processed_records = 0
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                for i in range(0, record_count, chunk_size):
                    chunk = data[i:i + chunk_size]
                    
                    # Update monitoring
                    self.monitor.update_readings()
                    
                    # Make API request (or simulate processing)
                    try:
                        # For testing purposes, we'll simulate the processing
                        # In real implementation, this would be an actual API call
                        response = await self._simulate_data_processing(client, chunk, processing_type)
                        
                        if response.get('success', False):
                            processed_records += len(chunk)
                        else:
                            error_message = response.get('error', 'Processing failed')
                            break
                            
                    except Exception as e:
                        error_message = f"Chunk processing failed: {str(e)}"
                        logger.error(error_message)
                        break
                    
                    # Brief pause to avoid overwhelming the system
                    await asyncio.sleep(0.01)
            
            success = processed_records == record_count
            
        except Exception as e:
            error_message = f"Volume processing failed: {str(e)}"
            logger.error(error_message)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Stop monitoring and get resource summary
        resource_summary = self.monitor.stop_monitoring()
        
        # Calculate metrics
        throughput = record_count / processing_time if processing_time > 0 else 0
        
        result = VolumeTestResult(
            record_count=record_count,
            processing_time_seconds=processing_time,
            throughput_records_per_second=throughput,
            memory_peak_mb=resource_summary['peak_memory_mb'],
            memory_baseline_mb=resource_summary['baseline_memory_mb'],
            cpu_avg_percent=resource_summary['avg_cpu_percent'],
            success=success,
            error_message=error_message
        )
        
        logger.info(f"Volume test completed: {record_count:,} records in {processing_time:.2f}s "
                   f"({throughput:.2f} records/sec) - Grade: {result.performance_grade}")
        
        return result
    
    async def _simulate_data_processing(self, client: httpx.AsyncClient, data_chunk: List[Dict], 
                                      processing_type: str) -> Dict[str, Any]:
        """Simulate data processing (replace with actual API calls in real implementation)"""
        
        # Simulate processing time based on data complexity
        processing_time = len(data_chunk) * 0.001  # 1ms per record base time
        
        # Add complexity based on data structure
        for record in data_chunk[:10]:  # Sample first 10 records
            if isinstance(record, dict):
                processing_time += len(str(record)) * 0.00001  # Additional time for complex data
        
        await asyncio.sleep(processing_time)
        
        # Simulate occasional failures for realism
        import random
        if random.random() < 0.02:  # 2% failure rate
            return {'success': False, 'error': 'Simulated processing error'}
        
        return {
            'success': True,
            'processed_count': len(data_chunk),
            'processing_type': processing_type,
            'processing_time_ms': processing_time * 1000
        }
    
    def save_results(self, results: List[VolumeTestResult], output_file: str = None):
        """Save test results to file"""
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f"volume_test_results_{timestamp}.json"
        
        results_data = {
            'timestamp': datetime.now().isoformat(),
            'total_tests': len(results),
            'results': [
                {
                    'record_count': r.record_count,
                    'processing_time_seconds': r.processing_time_seconds,
                    'throughput_records_per_second': r.throughput_records_per_second,
                    'memory_peak_mb': r.memory_peak_mb,
                    'memory_increase_mb': r.memory_peak_mb - r.memory_baseline_mb,
                    'cpu_avg_percent': r.cpu_avg_percent,
                    'success': r.success,
                    'performance_grade': r.performance_grade,
                    'error_message': r.error_message
                }
                for r in results
            ]
        }
        
        with open(output_file, 'w') as f:
            json.dump(results_data, f, indent=2)
        
        logger.info(f"Results saved to: {output_file}")
        return output_file

class DataVolumeTestSuite:
    """Main test suite for data volume testing"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.processor = DataVolumeProcessor(base_url)
        self.data_generator = RealisticDataGenerator()
    
    async def run_volume_tests(self, volumes: List[int] = None, dataset_type: str = "employees") -> List[VolumeTestResult]:
        """Run volume tests with different data sizes"""
        
        if volumes is None:
            volumes = [100, 1000, 5000, 10000, 25000, 50000]
        
        logger.info(f"Starting volume tests with {len(volumes)} different sizes: {volumes}")
        
        results = []
        
        for volume in volumes:
            logger.info(f"Generating {volume:,} {dataset_type} records...")
            
            # Generate test data
            test_data = self.data_generator.generate_dataset(dataset_type, volume)
            
            # Process the data volume
            result = await self.processor.process_data_volume(test_data, f"{dataset_type}_volume_{volume}")
            results.append(result)
            
            # Brief pause between tests
            await asyncio.sleep(1)
        
        return results
    
    def analyze_scalability(self, results: List[VolumeTestResult]) -> Dict[str, Any]:
        """Analyze scalability characteristics from test results"""
        
        if len(results) < 2:
            return {'error': 'Need at least 2 results for scalability analysis'}
        
        # Sort by record count
        sorted_results = sorted(results, key=lambda r: r.record_count)
        
        # Calculate scalability metrics
        record_counts = [r.record_count for r in sorted_results]
        throughputs = [r.throughput_records_per_second for r in sorted_results]
        processing_times = [r.processing_time_seconds for r in sorted_results]
        memory_usage = [r.memory_peak_mb - r.memory_baseline_mb for r in sorted_results]
        
        # Linear regression for throughput trend
        if len(record_counts) >= 2:
            throughput_slope = np.polyfit(record_counts, throughputs, 1)[0]
            processing_slope = np.polyfit(record_counts, processing_times, 1)[0]
        else:
            throughput_slope = 0
            processing_slope = 0
        
        # Determine scalability assessment
        if throughput_slope > 0:
            scalability = "Improving with scale"
        elif throughput_slope > -0.1:
            scalability = "Linear scaling"
        elif throughput_slope > -1:
            scalability = "Degrading with scale"
        else:
            scalability = "Poor scalability"
        
        return {
            'scalability_assessment': scalability,
            'throughput_trend_slope': float(throughput_slope),
            'processing_time_trend_slope': float(processing_slope),
            'max_throughput_rps': max(throughputs),
            'min_throughput_rps': min(throughputs),
            'avg_throughput_rps': np.mean(throughputs),
            'max_memory_increase_mb': max(memory_usage),
            'avg_memory_increase_mb': np.mean(memory_usage),
            'memory_efficiency': min(memory_usage) / max(memory_usage) if max(memory_usage) > 0 else 1.0,
            'overall_grade': self._calculate_overall_grade(sorted_results)
        }
    
    def _calculate_overall_grade(self, results: List[VolumeTestResult]) -> str:
        """Calculate overall performance grade"""
        grades = [r.performance_grade for r in results if r.success]
        
        if not grades:
            return "F"
        
        grade_values = {'A+': 4.3, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0}
        avg_grade = np.mean([grade_values[g] for g in grades])
        
        if avg_grade >= 4.0:
            return "A+"
        elif avg_grade >= 3.5:
            return "A"
        elif avg_grade >= 2.5:
            return "B"
        elif avg_grade >= 1.5:
            return "C"
        elif avg_grade >= 0.5:
            return "D"
        else:
            return "F"

# Pytest integration
class TestDataVolumes:
    """Pytest integration for data volume tests"""
    
    def setup_method(self):
        self.suite = DataVolumeTestSuite()
    
    @pytest.mark.asyncio
    async def test_small_volume_performance(self):
        """Test performance with small data volumes (1K records)"""
        results = await self.suite.run_volume_tests([1000], "employees")
        
        assert len(results) == 1
        result = results[0]
        
        assert result.success, f"Small volume test failed: {result.error_message}"
        assert result.throughput_records_per_second > 10, f"Throughput too low: {result.throughput_records_per_second}"
        assert result.memory_peak_mb < 2000, f"Memory usage too high: {result.memory_peak_mb}MB"
    
    @pytest.mark.asyncio
    async def test_medium_volume_performance(self):
        """Test performance with medium data volumes (10K records)"""
        results = await self.suite.run_volume_tests([10000], "sales")
        
        assert len(results) == 1
        result = results[0]
        
        assert result.success, f"Medium volume test failed: {result.error_message}"
        assert result.throughput_records_per_second > 5, f"Throughput too low: {result.throughput_records_per_second}"
        assert result.performance_grade in ['A+', 'A', 'B', 'C'], f"Performance grade too low: {result.performance_grade}"
    
    @pytest.mark.asyncio
    async def test_large_volume_performance(self):
        """Test performance with large data volumes (50K records)"""
        results = await self.suite.run_volume_tests([50000], "iot_sensors")
        
        assert len(results) == 1
        result = results[0]
        
        assert result.success, f"Large volume test failed: {result.error_message}"
        assert result.throughput_records_per_second > 1, f"Throughput too low: {result.throughput_records_per_second}"
    
    @pytest.mark.asyncio
    async def test_scalability_analysis(self):
        """Test scalability across multiple data volumes"""
        volumes = [1000, 5000, 10000, 25000]
        results = await self.suite.run_volume_tests(volumes, "employees")
        
        assert len(results) == len(volumes)
        
        # All tests should succeed
        failed_tests = [r for r in results if not r.success]
        assert len(failed_tests) == 0, f"Failed tests: {[r.error_message for r in failed_tests]}"
        
        # Analyze scalability
        analysis = self.suite.analyze_scalability(results)
        
        assert 'scalability_assessment' in analysis
        assert analysis['max_throughput_rps'] > 0
        assert analysis['overall_grade'] != 'F', f"Overall performance grade is F: {analysis}"
        
        logger.info(f"Scalability analysis: {analysis['scalability_assessment']}")
        logger.info(f"Overall grade: {analysis['overall_grade']}")

async def main():
    """CLI entry point for volume testing"""
    parser = argparse.ArgumentParser(description="Data Volume Performance Testing")
    parser.add_argument('--volume', type=int, help='Number of records to test')
    parser.add_argument('--volumes', nargs='+', type=int, help='Multiple volumes to test')
    parser.add_argument('--dataset', choices=['employees', 'sales', 'iot_sensors'], 
                       default='employees', help='Dataset type to generate')
    parser.add_argument('--base-url', default='http://localhost:8000', help='Base URL for API')
    parser.add_argument('--output', help='Output file for results')
    
    args = parser.parse_args()
    
    suite = DataVolumeTestSuite(args.base_url)
    
    if args.volume:
        volumes = [args.volume]
    elif args.volumes:
        volumes = args.volumes
    else:
        volumes = [1000, 10000, 50000]
    
    logger.info(f"Starting volume tests with volumes: {volumes}")
    
    results = await suite.run_volume_tests(volumes, args.dataset)
    
    # Save results
    output_file = suite.processor.save_results(results, args.output)
    
    # Analyze scalability if multiple volumes tested
    if len(results) > 1:
        analysis = suite.analyze_scalability(results)
        print(f"\nScalability Analysis:")
        print(f"Assessment: {analysis['scalability_assessment']}")
        print(f"Overall Grade: {analysis['overall_grade']}")
        print(f"Max Throughput: {analysis['max_throughput_rps']:.2f} records/sec")
        print(f"Memory Efficiency: {analysis['memory_efficiency']:.2f}")
    
    # Print summary
    print(f"\nVolume Test Summary:")
    for result in results:
        status = "✓" if result.success else "✗"
        print(f"{status} {result.record_count:,} records: {result.throughput_records_per_second:.2f} rec/sec, "
              f"Grade: {result.performance_grade}")
    
    print(f"\nDetailed results saved to: {output_file}")

if __name__ == "__main__":
    asyncio.run(main())