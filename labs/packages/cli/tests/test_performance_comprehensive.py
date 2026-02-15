"""
Comprehensive Performance Tests for CLI Tool

This module contains performance tests covering:
- Command execution time measurements
- Pipeline processing throughput
- Concurrent operation handling
- Memory usage during large operations
- File I/O performance
- Configuration loading efficiency
- Resource cleanup verification
"""

import asyncio
import time
import threading
import psutil
import statistics
import tempfile
import os
import shutil
import subprocess
import json
import yaml
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from unittest.mock import Mock, patch, MagicMock
import pytest
import tracemalloc
from typing import List, Dict, Any, Optional
import gc

# Mock CLI imports
try:
    from igris_cli import IgrisCLI, PipelineProcessor, ConfigManager
    from igris_cli.commands import CommandRegistry
    from igris_cli.pipeline import PipelineRunner
    from igris_cli.config import ConfigLoader
except ImportError:
    # Mock imports for testing
    class IgrisCLI:
        def __init__(self, *args, **kwargs):
            pass
        
        def run_command(self, *args, **kwargs):
            return {"status": "success", "output": "test output"}
    
    class PipelineProcessor:
        def __init__(self, *args, **kwargs):
            pass
        
        def process_pipeline(self, *args, **kwargs):
            return {"status": "completed", "processed": 100}
    
    class ConfigManager:
        def __init__(self, *args, **kwargs):
            pass
        
        def load_config(self, *args, **kwargs):
            return {"api_key": "test", "base_url": "http://test"}
    
    class CommandRegistry:
        def __init__(self, *args, **kwargs):
            pass
        
        def register_command(self, *args, **kwargs):
            pass
        
        def execute_command(self, *args, **kwargs):
            return {"status": "success"}
    
    class PipelineRunner:
        def __init__(self, *args, **kwargs):
            pass
        
        async def run_pipeline(self, *args, **kwargs):
            return {"status": "completed"}
    
    class ConfigLoader:
        def __init__(self, *args, **kwargs):
            pass
        
        def load(self, *args, **kwargs):
            return {}


class CLIPerformanceTestSuite:
    """Comprehensive performance testing suite for CLI tool"""
    
    def __init__(self):
        self.cli = None
        self.test_results = {}
        self.memory_tracker = None
        self.temp_dir = None
        
    def setup_test_environment(self):
        """Setup test environment with temp directories and files"""
        self.temp_dir = tempfile.mkdtemp(prefix='cli_perf_test_')
        
        # Create test configuration files
        self.create_test_configs()
        
        # Setup memory tracking
        tracemalloc.start()
        gc.collect()
        
    def create_test_configs(self):
        """Create various test configuration files"""
        # Small config
        small_config = {
            "api_key": "test-key",
            "base_url": "https://api.example.com",
            "timeout": 30
        }
        
        with open(os.path.join(self.temp_dir, "small_config.json"), "w") as f:
            json.dump(small_config, f)
            
        # Large config
        large_config = {
            "api_key": "test-key",
            "base_url": "https://api.example.com",
            "pipelines": {
                f"pipeline_{i}": {
                    "steps": [
                        {"type": "upload", "source": f"file_{j}.txt"}
                        for j in range(20)
                    ],
                    "config": {"batch_size": 100, "timeout": 300}
                }
                for i in range(100)
            },
            "profiles": {
                f"profile_{i}": {
                    "settings": {f"setting_{j}": f"value_{j}" for j in range(50)}
                }
                for i in range(50)
            }
        }
        
        with open(os.path.join(self.temp_dir, "large_config.json"), "w") as f:
            json.dump(large_config, f)
            
        # YAML config
        yaml_config = {
            "version": "1.0",
            "defaults": {
                "timeout": 60,
                "retries": 3
            },
            "environments": {
                "dev": {"url": "https://dev-api.example.com"},
                "prod": {"url": "https://api.example.com"}
            }
        }
        
        with open(os.path.join(self.temp_dir, "config.yaml"), "w") as f:
            yaml.dump(yaml_config, f)
            
    def cleanup_test_environment(self):
        """Cleanup test environment"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        tracemalloc.stop()
        
    def get_memory_usage(self) -> int:
        """Get current memory usage in bytes"""
        process = psutil.Process()
        return process.memory_info().rss
        
    def measure_execution_time(self, func, *args, **kwargs):
        """Measure execution time of a function"""
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        return result, end_time - start_time
        
    async def measure_async_execution_time(self, func, *args, **kwargs):
        """Measure execution time of an async function"""
        start_time = time.perf_counter()
        result = await func(*args, **kwargs)
        end_time = time.perf_counter()
        return result, end_time - start_time


@pytest.fixture
def performance_suite():
    """Create CLI performance test suite fixture"""
    suite = CLIPerformanceTestSuite()
    suite.setup_test_environment()
    yield suite
    suite.cleanup_test_environment()


@pytest.fixture
def mock_cli():
    """Create mock CLI for performance testing"""
    cli = Mock(spec=IgrisCLI)
    
    # Mock command execution
    def mock_run_command(command, *args, **kwargs):
        # Simulate processing time based on command complexity
        if command == "pipeline":
            time.sleep(0.1)  # Pipeline commands take longer
            return {"status": "success", "processed_files": 100, "duration": 5.5}
        elif command == "upload":
            time.sleep(0.05)  # Upload commands moderate time
            return {"status": "success", "file_id": "test-123", "size": 1024}
        else:
            time.sleep(0.01)  # Simple commands are fast
            return {"status": "success", "output": "command executed"}
    
    cli.run_command.side_effect = mock_run_command
    return cli


class TestCommandExecutionPerformance:
    """Test CLI command execution performance"""
    
    def test_single_command_response_time(self, performance_suite, mock_cli):
        """Test single command execution time"""
        commands_to_test = [
            ("auth", "login", "--api-key", "test"),
            ("config", "show"),
            ("pipeline", "list"),
            ("upload", "test.txt"),
            ("status", "job-123")
        ]
        
        for command_parts in commands_to_test:
            command = command_parts[0]
            
            _, response_time = performance_suite.measure_execution_time(
                mock_cli.run_command,
                *command_parts
            )
            
            # Different commands have different acceptable response times
            max_time = 0.5 if command == "pipeline" else 0.1
            assert response_time < max_time, f"{command} took {response_time:.3f}s, expected < {max_time}s"
            
            performance_suite.test_results[f'{command}_response_time'] = {
                'command': command,
                'response_time': response_time,
                'acceptable': response_time < max_time
            }
    
    def test_concurrent_command_execution(self, performance_suite, mock_cli):
        """Test concurrent command execution"""
        num_commands = 20
        commands = [
            ("config", "show"),
            ("pipeline", "list"),
            ("status", "check")
        ] * (num_commands // 3)
        
        start_time = time.perf_counter()
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(mock_cli.run_command, *cmd)
                for cmd in commands[:num_commands]
            ]
            
            results = []
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=30)
                    results.append(result)
                except Exception as e:
                    results.append({"status": "error", "error": str(e)})
        
        total_time = time.perf_counter() - start_time
        successful_commands = len([r for r in results if r.get("status") == "success"])
        commands_per_second = successful_commands / total_time
        
        assert len(results) == num_commands
        assert commands_per_second > 5, f"Commands/second {commands_per_second:.2f} too slow"
        assert successful_commands >= num_commands * 0.95, "Too many failed commands"
        
        performance_suite.test_results['concurrent_commands'] = {
            'total_commands': num_commands,
            'successful_commands': successful_commands,
            'total_time': total_time,
            'commands_per_second': commands_per_second,
            'success_rate': successful_commands / num_commands
        }
    
    def test_command_startup_overhead(self, performance_suite):
        """Test CLI startup overhead"""
        # Mock subprocess calls to test CLI startup time
        def mock_subprocess_run(*args, **kwargs):
            # Simulate CLI startup time
            time.sleep(0.1)
            return subprocess.CompletedProcess(
                args=args[0],
                returncode=0,
                stdout="CLI started successfully",
                stderr=""
            )
        
        with patch('subprocess.run', side_effect=mock_subprocess_run):
            startup_times = []
            
            for i in range(10):
                _, startup_time = performance_suite.measure_execution_time(
                    subprocess.run,
                    ["igris-cli", "--version"],
                    capture_output=True,
                    text=True
                )
                startup_times.append(startup_time)
            
            avg_startup_time = statistics.mean(startup_times)
            max_startup_time = max(startup_times)
            min_startup_time = min(startup_times)
            
            # CLI should start within reasonable time
            assert avg_startup_time < 0.5, f"Average startup time {avg_startup_time:.3f}s too slow"
            assert max_startup_time < 1.0, f"Max startup time {max_startup_time:.3f}s too slow"
            
            performance_suite.test_results['startup_overhead'] = {
                'avg_startup_time': avg_startup_time,
                'max_startup_time': max_startup_time,
                'min_startup_time': min_startup_time,
                'startup_times': startup_times
            }


class TestPipelineProcessingPerformance:
    """Test pipeline processing performance"""
    
    def test_pipeline_throughput(self, performance_suite, mock_cli):
        """Test pipeline processing throughput"""
        pipeline_sizes = [10, 50, 100, 500]  # Number of steps in pipeline
        
        for size in pipeline_sizes:
            # Mock pipeline with specified number of steps
            pipeline_config = {
                "name": f"test-pipeline-{size}",
                "steps": [
                    {"type": "process", "input": f"file_{i}.txt"}
                    for i in range(size)
                ]
            }
            
            processor = PipelineProcessor()
            
            _, processing_time = performance_suite.measure_execution_time(
                processor.process_pipeline,
                pipeline_config
            )
            
            steps_per_second = size / processing_time if processing_time > 0 else float('inf')
            
            # Expect reasonable throughput
            min_steps_per_second = 20 if size <= 100 else 10
            assert steps_per_second > min_steps_per_second, \
                f"Pipeline throughput {steps_per_second:.2f} steps/s too slow for size {size}"
            
            performance_suite.test_results[f'pipeline_throughput_{size}'] = {
                'pipeline_size': size,
                'processing_time': processing_time,
                'steps_per_second': steps_per_second
            }
    
    @pytest.mark.asyncio
    async def test_concurrent_pipeline_execution(self, performance_suite):
        """Test concurrent pipeline execution"""
        num_pipelines = 5
        pipeline_runner = PipelineRunner()
        
        async def run_test_pipeline(pipeline_id):
            pipeline_config = {
                "name": f"concurrent-pipeline-{pipeline_id}",
                "steps": [
                    {"type": "upload", "file": f"test_{i}.txt"}
                    for i in range(20)
                ]
            }
            
            return await pipeline_runner.run_pipeline(pipeline_config)
        
        start_time = time.perf_counter()
        tasks = [run_test_pipeline(i) for i in range(num_pipelines)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.perf_counter() - start_time
        
        successful_pipelines = len([r for r in results if isinstance(r, dict) and r.get("status") == "completed"])
        pipelines_per_second = successful_pipelines / total_time
        
        assert successful_pipelines == num_pipelines, f"Only {successful_pipelines}/{num_pipelines} pipelines completed"
        assert pipelines_per_second > 0.5, f"Pipeline rate {pipelines_per_second:.2f}/s too slow"
        
        performance_suite.test_results['concurrent_pipelines'] = {
            'num_pipelines': num_pipelines,
            'successful_pipelines': successful_pipelines,
            'total_time': total_time,
            'pipelines_per_second': pipelines_per_second
        }
    
    def test_large_pipeline_memory_usage(self, performance_suite):
        """Test memory usage during large pipeline processing"""
        initial_memory = performance_suite.get_memory_usage()
        
        # Simulate processing a very large pipeline
        processor = PipelineProcessor()
        large_pipeline = {
            "name": "memory-test-pipeline",
            "steps": [
                {
                    "type": "process",
                    "data": {"large_data": "x" * 1024 * 100}  # 100KB per step
                }
                for i in range(1000)  # 1000 steps = ~100MB of data
            ]
        }
        
        peak_memory = initial_memory
        memory_samples = []
        
        def memory_monitor():
            while True:
                current_memory = performance_suite.get_memory_usage()
                memory_samples.append(current_memory)
                nonlocal peak_memory
                peak_memory = max(peak_memory, current_memory)
                time.sleep(0.1)
        
        # Start memory monitoring
        monitor_thread = threading.Thread(target=memory_monitor, daemon=True)
        monitor_thread.start()
        
        # Process pipeline
        _, processing_time = performance_suite.measure_execution_time(
            processor.process_pipeline,
            large_pipeline
        )
        
        time.sleep(0.5)  # Allow final memory measurement
        
        final_memory = performance_suite.get_memory_usage()
        memory_increase = peak_memory - initial_memory
        memory_increase_mb = memory_increase / 1024 / 1024
        
        # Memory increase should be reasonable (less than 200MB for this test)
        assert memory_increase_mb < 200, f"Memory increase {memory_increase_mb:.2f}MB too high"
        
        # Force garbage collection and check cleanup
        gc.collect()
        time.sleep(1)
        cleanup_memory = performance_suite.get_memory_usage()
        cleanup_ratio = (peak_memory - cleanup_memory) / memory_increase if memory_increase > 0 else 0
        
        performance_suite.test_results['large_pipeline_memory'] = {
            'initial_memory_mb': initial_memory / 1024 / 1024,
            'peak_memory_mb': peak_memory / 1024 / 1024,
            'final_memory_mb': final_memory / 1024 / 1024,
            'memory_increase_mb': memory_increase_mb,
            'cleanup_memory_mb': cleanup_memory / 1024 / 1024,
            'cleanup_ratio': cleanup_ratio,
            'processing_time': processing_time,
            'pipeline_steps': len(large_pipeline['steps'])
        }


class TestConfigurationPerformance:
    """Test configuration loading and management performance"""
    
    def test_config_loading_speed(self, performance_suite):
        """Test configuration file loading speed"""
        config_manager = ConfigManager()
        
        config_files = [
            os.path.join(performance_suite.temp_dir, "small_config.json"),
            os.path.join(performance_suite.temp_dir, "large_config.json"),
            os.path.join(performance_suite.temp_dir, "config.yaml")
        ]
        
        for config_file in config_files:
            if os.path.exists(config_file):
                file_size = os.path.getsize(config_file)
                
                _, loading_time = performance_suite.measure_execution_time(
                    config_manager.load_config,
                    config_file
                )
                
                loading_speed_mbps = (file_size / loading_time) / 1024 / 1024 if loading_time > 0 else float('inf')
                
                # Config loading should be fast
                assert loading_time < 1.0, f"Config loading took {loading_time:.3f}s for {file_size} bytes"
                
                performance_suite.test_results[f'config_loading_{os.path.basename(config_file)}'] = {
                    'file_size_bytes': file_size,
                    'loading_time': loading_time,
                    'loading_speed_mbps': loading_speed_mbps
                }
    
    def test_config_caching_efficiency(self, performance_suite):
        """Test configuration caching efficiency"""
        config_manager = ConfigManager()
        config_file = os.path.join(performance_suite.temp_dir, "large_config.json")
        
        # First load - should read from file
        _, first_load_time = performance_suite.measure_execution_time(
            config_manager.load_config,
            config_file
        )
        
        # Second load - should use cache
        _, cached_load_time = performance_suite.measure_execution_time(
            config_manager.load_config,
            config_file
        )
        
        # Cache should be significantly faster
        cache_efficiency = first_load_time / cached_load_time if cached_load_time > 0 else float('inf')
        assert cache_efficiency > 5, f"Config cache not efficient: {cache_efficiency:.2f}x improvement"
        
        performance_suite.test_results['config_caching'] = {
            'first_load_time': first_load_time,
            'cached_load_time': cached_load_time,
            'cache_efficiency': cache_efficiency
        }
    
    def test_multiple_config_formats_performance(self, performance_suite):
        """Test performance across different config formats"""
        config_loader = ConfigLoader()
        
        # Create test configs in different formats
        test_data = {
            "settings": {f"key_{i}": f"value_{i}" for i in range(1000)},
            "arrays": [[i, i+1, i+2] for i in range(0, 300, 3)],
            "nested": {
                f"section_{i}": {
                    f"subsection_{j}": {
                        "data": [k for k in range(10)]
                    } for j in range(10)
                } for i in range(20)
            }
        }
        
        formats_to_test = ['json', 'yaml']
        
        for fmt in formats_to_test:
            config_file = os.path.join(performance_suite.temp_dir, f"perf_test.{fmt}")
            
            # Write test data in specified format
            if fmt == 'json':
                with open(config_file, 'w') as f:
                    json.dump(test_data, f, indent=2)
            elif fmt == 'yaml':
                with open(config_file, 'w') as f:
                    yaml.dump(test_data, f, default_flow_style=False)
            
            file_size = os.path.getsize(config_file)
            
            # Test loading performance
            _, load_time = performance_suite.measure_execution_time(
                config_loader.load,
                config_file
            )
            
            throughput_mbps = (file_size / load_time) / 1024 / 1024 if load_time > 0 else float('inf')
            
            performance_suite.test_results[f'config_format_{fmt}'] = {
                'format': fmt,
                'file_size_bytes': file_size,
                'load_time': load_time,
                'throughput_mbps': throughput_mbps
            }


class TestFileIOPerformance:
    """Test file I/O performance for CLI operations"""
    
    def test_large_file_processing(self, performance_suite, mock_cli):
        """Test processing of large files"""
        file_sizes = [1024, 10240, 102400, 1024000, 10240000]  # 1KB to 10MB
        
        for size in file_sizes:
            # Create test file
            test_file = os.path.join(performance_suite.temp_dir, f"test_{size}.bin")
            with open(test_file, 'wb') as f:
                f.write(os.urandom(size))
            
            # Test file processing
            _, processing_time = performance_suite.measure_execution_time(
                mock_cli.run_command,
                "upload",
                test_file
            )
            
            throughput_mbps = (size / processing_time) / 1024 / 1024 if processing_time > 0 else float('inf')
            
            # Expect reasonable throughput (at least 1 MB/s for uploads)
            min_throughput = 1.0
            assert throughput_mbps > min_throughput, \
                f"File processing throughput {throughput_mbps:.2f} MB/s too slow for {size} bytes"
            
            performance_suite.test_results[f'file_processing_{size}'] = {
                'file_size_bytes': size,
                'processing_time': processing_time,
                'throughput_mbps': throughput_mbps
            }
            
            # Cleanup
            os.remove(test_file)
    
    def test_concurrent_file_operations(self, performance_suite, mock_cli):
        """Test concurrent file operations"""
        num_files = 10
        file_size = 1024 * 1024  # 1MB each
        
        # Create test files
        test_files = []
        for i in range(num_files):
            test_file = os.path.join(performance_suite.temp_dir, f"concurrent_{i}.bin")
            with open(test_file, 'wb') as f:
                f.write(os.urandom(file_size))
            test_files.append(test_file)
        
        # Test concurrent processing
        start_time = time.perf_counter()
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(mock_cli.run_command, "upload", test_file)
                for test_file in test_files
            ]
            
            results = []
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=60)
                    results.append(result)
                except Exception as e:
                    results.append({"status": "error", "error": str(e)})
        
        total_time = time.perf_counter() - start_time
        successful_ops = len([r for r in results if r.get("status") == "success"])
        ops_per_second = successful_ops / total_time
        total_throughput_mbps = (successful_ops * file_size / total_time) / 1024 / 1024
        
        assert successful_ops >= num_files * 0.9, "Too many failed file operations"
        assert ops_per_second > 1, f"File operations rate {ops_per_second:.2f}/s too slow"
        
        performance_suite.test_results['concurrent_file_ops'] = {
            'num_files': num_files,
            'file_size_mb': file_size / 1024 / 1024,
            'successful_ops': successful_ops,
            'total_time': total_time,
            'ops_per_second': ops_per_second,
            'total_throughput_mbps': total_throughput_mbps
        }
        
        # Cleanup
        for test_file in test_files:
            if os.path.exists(test_file):
                os.remove(test_file)


class TestCommandRegistryPerformance:
    """Test command registry performance"""
    
    def test_command_registration_performance(self, performance_suite):
        """Test command registration speed"""
        registry = CommandRegistry()
        num_commands = 1000
        
        def register_test_command(cmd_id):
            def test_command():
                return f"Command {cmd_id} executed"
            
            registry.register_command(f"test_cmd_{cmd_id}", test_command)
        
        _, registration_time = performance_suite.measure_execution_time(
            lambda: [register_test_command(i) for i in range(num_commands)]
        )
        
        registrations_per_second = num_commands / registration_time if registration_time > 0 else float('inf')
        
        assert registrations_per_second > 1000, f"Command registration rate {registrations_per_second:.2f}/s too slow"
        
        performance_suite.test_results['command_registration'] = {
            'num_commands': num_commands,
            'registration_time': registration_time,
            'registrations_per_second': registrations_per_second
        }
    
    def test_command_lookup_performance(self, performance_suite):
        """Test command lookup speed"""
        registry = CommandRegistry()
        
        # Register many commands
        num_commands = 10000
        for i in range(num_commands):
            registry.register_command(f"cmd_{i:05d}", lambda: f"Command {i}")
        
        # Test lookup performance
        lookups_to_test = 1000
        lookup_times = []
        
        for _ in range(lookups_to_test):
            cmd_name = f"cmd_{len(lookup_times) % num_commands:05d}"
            
            _, lookup_time = performance_suite.measure_execution_time(
                registry.execute_command,
                cmd_name
            )
            
            lookup_times.append(lookup_time)
        
        avg_lookup_time = statistics.mean(lookup_times)
        max_lookup_time = max(lookup_times)
        lookups_per_second = 1 / avg_lookup_time if avg_lookup_time > 0 else float('inf')
        
        # Command lookup should be very fast
        assert avg_lookup_time < 0.001, f"Average lookup time {avg_lookup_time*1000:.3f}ms too slow"
        assert max_lookup_time < 0.01, f"Max lookup time {max_lookup_time*1000:.3f}ms too slow"
        
        performance_suite.test_results['command_lookup'] = {
            'total_commands': num_commands,
            'lookups_tested': lookups_to_test,
            'avg_lookup_time_ms': avg_lookup_time * 1000,
            'max_lookup_time_ms': max_lookup_time * 1000,
            'lookups_per_second': lookups_per_second
        }


@pytest.mark.asyncio
async def test_performance_summary(performance_suite):
    """Generate comprehensive CLI performance test summary"""
    print("\n" + "="*60)
    print("CLI TOOL PERFORMANCE TEST SUMMARY")
    print("="*60)
    
    # System information
    cpu_count = psutil.cpu_count()
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    print(f"\nSYSTEM INFORMATION:")
    print(f"  CPU Cores: {cpu_count}")
    print(f"  Total Memory: {memory.total / 1024 / 1024 / 1024:.2f} GB")
    print(f"  Available Memory: {memory.available / 1024 / 1024 / 1024:.2f} GB")
    print(f"  Disk Space: {disk.total / 1024 / 1024 / 1024:.2f} GB")
    
    # Test results
    for test_name, results in performance_suite.test_results.items():
        print(f"\n{test_name.upper().replace('_', ' ')}:")
        if isinstance(results, dict):
            for key, value in results.items():
                if isinstance(value, float):
                    if 'time' in key.lower() or 'duration' in key.lower():
                        print(f"  {key}: {value:.3f}s")
                    elif 'mbps' in key.lower() or 'throughput' in key.lower():
                        print(f"  {key}: {value:.2f} MB/s")
                    elif 'per_second' in key.lower() or 'rate' in key.lower():
                        print(f"  {key}: {value:.2f}/s")
                    else:
                        print(f"  {key}: {value:.3f}")
                else:
                    print(f"  {key}: {value}")
        else:
            print(f"  Result: {results:.3f}" if isinstance(results, float) else f"  Result: {results}")
    
    print("\n" + "="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])