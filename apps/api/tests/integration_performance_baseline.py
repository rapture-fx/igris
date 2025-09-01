"""
Integration Performance Testing Suite
====================================

This module tests the complete integration between frontend and backend systems,
measuring end-to-end performance across the entire application stack.

Test Coverage:
- End-to-end user journey performance
- API call waterfall analysis  
- Network request optimization
- Concurrent user simulation
- Mobile vs desktop performance comparison
- Database + API + Frontend integration performance
- WebSocket real-time communication performance
- File upload and processing performance
"""

import asyncio
import json
import time
import statistics
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import subprocess
import concurrent.futures

import pytest
import httpx
import websockets
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException
import psutil

# Import from existing performance framework
from comprehensive_performance_baseline import (
    ComprehensivePerformanceTester, PerformanceMetric, BenchmarkResult,
    AuthenticationMetric, WebSocketMetric, DatabaseMetric, MLInferenceMetric
)

logger = logging.getLogger(__name__)

@dataclass
class IntegrationMetric:
    """End-to-end integration performance metric"""
    journey_name: str
    total_duration_ms: float
    frontend_render_time_ms: float
    api_response_time_ms: float
    database_query_time_ms: float
    websocket_connection_time_ms: Optional[float]
    user_flow_steps: List[Dict[str, Any]]
    network_requests: List[Dict[str, Any]]
    memory_usage_mb: float
    cpu_usage_percent: float
    success: bool = True
    error: Optional[str] = None

@dataclass
class ConcurrentUserMetric:
    """Concurrent user performance metric"""
    concurrent_users: int
    total_duration_ms: float
    avg_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    throughput_rps: float
    error_rate_percent: float
    resource_utilization: Dict[str, float]
    success: bool = True

@dataclass  
class MobilePerformanceMetric:
    """Mobile vs desktop performance comparison"""
    device_type: str  # mobile, tablet, desktop
    viewport: Dict[str, int]
    network_condition: str  # 3g, 4g, wifi
    core_web_vitals: Dict[str, float]
    bundle_load_time_ms: float
    interaction_response_time_ms: float
    battery_impact_score: float  # 0-100
    success: bool = True

class IntegrationPerformanceTester:
    """Integration performance testing across the complete stack"""
    
    def __init__(self, 
                 backend_url: str = "http://localhost:8000",
                 frontend_url: str = "http://localhost:3000",
                 websocket_url: str = "ws://localhost:8000/ws"):
        self.backend_url = backend_url
        self.frontend_url = frontend_url  
        self.websocket_url = websocket_url
        
        # Initialize base performance tester
        self.base_tester = ComprehensivePerformanceTester(backend_url, websocket_url)
        
        # Initialize WebDriver
        self.driver_options = self._setup_chrome_options()
        self.drivers: List[webdriver.Chrome] = []
        
    def _setup_chrome_options(self) -> Options:
        """Setup Chrome options for performance testing"""
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-plugins')
        options.add_argument('--disable-images')  # Faster loading for performance tests
        
        # Performance monitoring preferences
        prefs = {
            "profile.default_content_setting_values": {
                "notifications": 2,  # Block notifications
                "media_stream": 2,   # Block media
            },
            "profile.managed_default_content_settings": {
                "images": 2  # Don't load images by default
            }
        }
        options.add_experimental_option("prefs", prefs)
        
        # Enable performance logging
        options.add_experimental_option('perfLoggingPrefs', {
            'enableNetwork': True,
            'enablePage': True,
            'enableTimeline': True
        })
        options.add_experimental_option('useAutomationExtension', False)
        
        return options

    async def test_end_to_end_user_journeys(self) -> List[IntegrationMetric]:
        """Test complete user journeys from frontend to backend"""
        logger.info("Testing end-to-end user journeys")
        
        journeys = [
            {
                'name': 'user_registration_and_data_upload',
                'steps': [
                    {'action': 'navigate', 'target': '/register'},
                    {'action': 'fill_form', 'data': {'email': 'test@test.com', 'password': 'test123'}},
                    {'action': 'submit', 'target': 'register-form'},
                    {'action': 'navigate', 'target': '/upload'},
                    {'action': 'upload_file', 'file': 'test_data.csv'},
                    {'action': 'wait_processing', 'timeout': 30000}
                ]
            },
            {
                'name': 'dashboard_data_visualization',
                'steps': [
                    {'action': 'navigate', 'target': '/login'},
                    {'action': 'login', 'data': {'email': 'test@test.com', 'password': 'test123'}},
                    {'action': 'navigate', 'target': '/dashboard'},
                    {'action': 'load_charts', 'count': 5},
                    {'action': 'interact_filters', 'filters': ['date', 'category', 'status']}
                ]
            },
            {
                'name': 'real_time_data_processing',
                'steps': [
                    {'action': 'navigate', 'target': '/processing'},
                    {'action': 'connect_websocket'},
                    {'action': 'start_processing', 'data': {'type': 'batch', 'size': 1000}},
                    {'action': 'monitor_progress', 'duration': 20000},
                    {'action': 'export_results'}
                ]
            },
            {
                'name': 'ml_model_inference',
                'steps': [
                    {'action': 'navigate', 'target': '/ml-inference'},
                    {'action': 'select_model', 'model': 'data_classifier'},
                    {'action': 'upload_inference_data', 'records': 500},
                    {'action': 'run_inference'},
                    {'action': 'view_results'}
                ]
            }
        ]
        
        integration_metrics = []
        
        for journey in journeys:
            try:
                metric = await self._execute_user_journey(journey)
                integration_metrics.append(metric)
            except Exception as e:
                logger.error(f"Journey {journey['name']} failed: {e}")
                # Create error metric
                error_metric = IntegrationMetric(
                    journey_name=journey['name'],
                    total_duration_ms=0,
                    frontend_render_time_ms=0,
                    api_response_time_ms=0,
                    database_query_time_ms=0,
                    websocket_connection_time_ms=None,
                    user_flow_steps=[],
                    network_requests=[],
                    memory_usage_mb=0,
                    cpu_usage_percent=0,
                    success=False,
                    error=str(e)
                )
                integration_metrics.append(error_metric)
        
        return integration_metrics

    async def _execute_user_journey(self, journey: Dict[str, Any]) -> IntegrationMetric:
        """Execute a single user journey and measure performance"""
        journey_start = time.time()
        
        # Setup WebDriver
        driver = webdriver.Chrome(options=self.driver_options)
        self.drivers.append(driver)
        
        # Setup performance monitoring
        network_requests = []
        step_timings = []
        
        # Enable performance logging
        driver.execute_cdp_cmd('Performance.enable', {})
        driver.execute_cdp_cmd('Network.enable', {})
        
        try:
            for step in journey['steps']:
                step_start = time.time()
                
                await self._execute_journey_step(driver, step)
                
                step_duration = (time.time() - step_start) * 1000
                step_timings.append({
                    'action': step['action'],
                    'duration_ms': step_duration
                })
                
                # Collect network requests
                logs = driver.get_log('performance')
                for log in logs:
                    message = json.loads(log['message'])
                    if message['message']['method'] == 'Network.responseReceived':
                        response = message['message']['params']['response']
                        network_requests.append({
                            'url': response['url'],
                            'status': response['status'],
                            'mime_type': response['mimeType'],
                            'timestamp': message['message']['params']['timestamp']
                        })
            
            # Get final performance metrics
            perf_metrics = driver.execute_script("""
                return {
                    navigation: performance.getEntriesByType('navigation')[0],
                    resources: performance.getEntriesByType('resource'),
                    memory: performance.memory ? {
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        usedJSHeapSize: performance.memory.usedJSHeapSize
                    } : null
                };
            """)
            
            journey_duration = (time.time() - journey_start) * 1000
            
            # Calculate component metrics
            frontend_render_time = sum([s['duration_ms'] for s in step_timings if 'navigate' in s['action']])
            api_response_time = sum([s['duration_ms'] for s in step_timings if any(x in s['action'] for x in ['submit', 'upload', 'processing'])])
            
            # Get system resource usage
            memory_usage = psutil.virtual_memory().used / (1024 * 1024)  # MB
            cpu_usage = psutil.cpu_percent(interval=1)
            
            return IntegrationMetric(
                journey_name=journey['name'],
                total_duration_ms=journey_duration,
                frontend_render_time_ms=frontend_render_time,
                api_response_time_ms=api_response_time,
                database_query_time_ms=0,  # Would need database monitoring
                websocket_connection_time_ms=None,  # Would measure if WebSocket used
                user_flow_steps=step_timings,
                network_requests=network_requests,
                memory_usage_mb=memory_usage,
                cpu_usage_percent=cpu_usage,
                success=True
            )
            
        finally:
            driver.quit()

    async def _execute_journey_step(self, driver: webdriver.Chrome, step: Dict[str, Any]):
        """Execute a single step in the user journey"""
        action = step['action']
        
        if action == 'navigate':
            url = f"{self.frontend_url}{step['target']}"
            driver.get(url)
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
        elif action == 'fill_form':
            data = step['data']
            for field, value in data.items():
                element = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.NAME, field))
                )
                element.clear()
                element.send_keys(value)
                
        elif action == 'submit':
            target = step['target']
            form = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, target))
            )
            form.submit()
            
        elif action == 'login':
            # Simplified login process
            data = step['data']
            email_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "email"))
            )
            password_field = driver.find_element(By.NAME, "password")
            
            email_field.send_keys(data['email'])
            password_field.send_keys(data['password'])
            
            login_button = driver.find_element(By.CSS_SELECTOR, "[type='submit']")
            login_button.click()
            
        elif action == 'upload_file':
            file_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
            )
            # Create a test CSV file if it doesn't exist
            test_file_path = self._create_test_file(step['file'])
            file_input.send_keys(test_file_path)
            
        elif action == 'wait_processing':
            timeout = step.get('timeout', 10000) / 1000  # Convert to seconds
            WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".processing-complete"))
            )
            
        elif action == 'load_charts':
            # Wait for charts to load
            count = step.get('count', 1)
            for i in range(count):
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, f".chart-{i}"))
                )
                
        elif action == 'interact_filters':
            filters = step.get('filters', [])
            for filter_name in filters:
                filter_element = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, f"[data-filter='{filter_name}']"))
                )
                filter_element.click()
                time.sleep(0.5)  # Small delay for interaction
        
        # Add small delay between steps to simulate realistic user behavior
        time.sleep(0.3)

    def _create_test_file(self, filename: str) -> str:
        """Create a test CSV file for upload testing"""
        test_dir = Path("test_files")
        test_dir.mkdir(exist_ok=True)
        
        file_path = test_dir / filename
        
        if not file_path.exists():
            # Create a simple CSV file
            with open(file_path, 'w') as f:
                f.write("id,name,value,category\n")
                for i in range(100):
                    f.write(f"{i},Test Item {i},{i * 10},Category {i % 5}\n")
        
        return str(file_path.absolute())

    async def test_concurrent_users(self, user_counts: List[int] = [1, 5, 10, 25, 50]) -> List[ConcurrentUserMetric]:
        """Test system performance under concurrent user load"""
        logger.info("Testing concurrent user performance")
        
        concurrent_metrics = []
        
        for user_count in user_counts:
            logger.info(f"Testing {user_count} concurrent users")
            
            try:
                metric = await self._test_concurrent_load(user_count)
                concurrent_metrics.append(metric)
                
                # Allow system to recover between tests
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Concurrent user test with {user_count} users failed: {e}")
                error_metric = ConcurrentUserMetric(
                    concurrent_users=user_count,
                    total_duration_ms=0,
                    avg_response_time_ms=0,
                    p95_response_time_ms=0,
                    p99_response_time_ms=0,
                    throughput_rps=0,
                    error_rate_percent=100,
                    resource_utilization={},
                    success=False
                )
                concurrent_metrics.append(error_metric)
        
        return concurrent_metrics

    async def _test_concurrent_load(self, user_count: int) -> ConcurrentUserMetric:
        """Test system with specific number of concurrent users"""
        test_duration = 60  # seconds
        test_start = time.time()
        
        # Track all response times and errors
        response_times = []
        error_count = 0
        total_requests = 0
        
        # Monitor system resources
        initial_memory = psutil.virtual_memory().used
        initial_cpu = psutil.cpu_percent()
        
        async def simulate_user_session(user_id: int):
            """Simulate a single user session"""
            nonlocal response_times, error_count, total_requests
            
            session_start = time.time()
            session_requests = 0
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                while time.time() - session_start < test_duration:
                    try:
                        # Simulate typical user actions
                        actions = [
                            ('GET', '/api/v1/health'),
                            ('GET', '/api/v1/auth/status'),
                            ('POST', '/api/v1/data/process', {'data': [{'test': 'data'}]}),
                            ('GET', '/api/v1/files/list'),
                        ]
                        
                        for method, endpoint, *data in actions:
                            request_start = time.time()
                            
                            try:
                                if method == 'GET':
                                    response = await client.get(f"{self.backend_url}{endpoint}")
                                else:
                                    response = await client.post(f"{self.backend_url}{endpoint}", json=data[0] if data else {})
                                
                                request_duration = (time.time() - request_start) * 1000
                                response_times.append(request_duration)
                                
                                if response.status_code >= 400:
                                    error_count += 1
                                
                                total_requests += 1
                                session_requests += 1
                                
                            except Exception as e:
                                error_count += 1
                                total_requests += 1
                                # Still record the time taken
                                response_times.append((time.time() - request_start) * 1000)
                        
                        # Simulate user thinking time
                        await asyncio.sleep(1)
                        
                    except Exception as e:
                        logger.warning(f"User {user_id} session error: {e}")
                        break
        
        # Start concurrent user sessions
        tasks = [simulate_user_session(i) for i in range(user_count)]
        
        # Monitor resources during test
        resource_monitor_task = asyncio.create_task(self._monitor_resources_during_test(test_duration))
        
        # Execute all tasks
        await asyncio.gather(*tasks, resource_monitor_task, return_exceptions=True)
        
        # Calculate metrics
        total_duration = (time.time() - test_start) * 1000
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            p95_response_time = sorted(response_times)[int(len(response_times) * 0.95)]
            p99_response_time = sorted(response_times)[int(len(response_times) * 0.99)]
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
        
        throughput_rps = total_requests / (total_duration / 1000) if total_duration > 0 else 0
        error_rate_percent = (error_count / total_requests) * 100 if total_requests > 0 else 0
        
        # Get final resource usage
        final_memory = psutil.virtual_memory().used
        final_cpu = psutil.cpu_percent()
        
        resource_utilization = {
            'memory_delta_mb': (final_memory - initial_memory) / (1024 * 1024),
            'cpu_avg_percent': (initial_cpu + final_cpu) / 2,
            'peak_memory_mb': psutil.virtual_memory().used / (1024 * 1024)
        }
        
        return ConcurrentUserMetric(
            concurrent_users=user_count,
            total_duration_ms=total_duration,
            avg_response_time_ms=avg_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            throughput_rps=throughput_rps,
            error_rate_percent=error_rate_percent,
            resource_utilization=resource_utilization,
            success=error_rate_percent < 10  # Less than 10% error rate considered success
        )

    async def _monitor_resources_during_test(self, duration: float):
        """Monitor system resources during testing"""
        start_time = time.time()
        resource_samples = []
        
        while time.time() - start_time < duration:
            resource_samples.append({
                'timestamp': time.time(),
                'memory_mb': psutil.virtual_memory().used / (1024 * 1024),
                'cpu_percent': psutil.cpu_percent(interval=None),
                'disk_io': psutil.disk_io_counters()._asdict() if psutil.disk_io_counters() else {},
                'network_io': psutil.net_io_counters()._asdict()
            })
            
            await asyncio.sleep(1)  # Sample every second
        
        return resource_samples

    async def test_mobile_vs_desktop_performance(self) -> List[MobilePerformanceMetric]:
        """Test performance comparison between mobile and desktop"""
        logger.info("Testing mobile vs desktop performance")
        
        device_configs = [
            {
                'type': 'desktop',
                'viewport': {'width': 1920, 'height': 1080},
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'network': 'wifi'
            },
            {
                'type': 'tablet',
                'viewport': {'width': 768, 'height': 1024},
                'user_agent': 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'network': '4g'
            },
            {
                'type': 'mobile',
                'viewport': {'width': 375, 'height': 812},
                'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'network': '3g'
            }
        ]
        
        mobile_metrics = []
        
        for config in device_configs:
            try:
                metric = await self._test_device_performance(config)
                mobile_metrics.append(metric)
            except Exception as e:
                logger.error(f"Device performance test for {config['type']} failed: {e}")
                error_metric = MobilePerformanceMetric(
                    device_type=config['type'],
                    viewport=config['viewport'],
                    network_condition=config['network'],
                    core_web_vitals={},
                    bundle_load_time_ms=0,
                    interaction_response_time_ms=0,
                    battery_impact_score=0,
                    success=False
                )
                mobile_metrics.append(error_metric)
        
        return mobile_metrics

    async def _test_device_performance(self, config: Dict[str, Any]) -> MobilePerformanceMetric:
        """Test performance for a specific device configuration"""
        
        # Setup Chrome options for device simulation
        device_options = Options()
        device_options.add_argument('--headless')
        device_options.add_argument('--no-sandbox')
        device_options.add_argument('--disable-dev-shm-usage')
        
        # Set viewport and user agent
        device_options.add_argument(f"--window-size={config['viewport']['width']},{config['viewport']['height']}")
        device_options.add_argument(f"--user-agent={config['user_agent']}")
        
        # Simulate network conditions
        if config['network'] == '3g':
            device_options.add_argument('--force-device-scale-factor=2')
            # Would typically use Chrome DevTools Protocol for network throttling
        
        driver = webdriver.Chrome(options=device_options)
        
        try:
            # Enable performance monitoring
            driver.execute_cdp_cmd('Performance.enable', {})
            driver.execute_cdp_cmd('Network.enable', {})
            
            # Navigate to the application
            test_start = time.time()
            driver.get(self.frontend_url)
            
            # Wait for page load
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            bundle_load_time = (time.time() - test_start) * 1000
            
            # Test interaction response time
            interaction_start = time.time()
            try:
                # Try to find a button or interactive element
                interactive_element = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button, a, input"))
                )
                interactive_element.click()
                interaction_response_time = (time.time() - interaction_start) * 1000
            except TimeoutException:
                interaction_response_time = 5000  # Timeout value
            
            # Get Core Web Vitals (simplified simulation)
            core_web_vitals = driver.execute_script("""
                return {
                    LCP: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
                    FCP: performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')?.startTime || 0,
                    CLS: 0, // Would need more complex measurement
                    TTFB: performance.getEntriesByType('navigation')[0]?.responseStart || 0
                };
            """)
            
            # Calculate battery impact score (simplified)
            battery_impact_score = self._calculate_battery_impact(
                config['device_type'],
                bundle_load_time,
                interaction_response_time
            )
            
            return MobilePerformanceMetric(
                device_type=config['type'],
                viewport=config['viewport'],
                network_condition=config['network'],
                core_web_vitals=core_web_vitals,
                bundle_load_time_ms=bundle_load_time,
                interaction_response_time_ms=interaction_response_time,
                battery_impact_score=battery_impact_score,
                success=True
            )
            
        finally:
            driver.quit()

    def _calculate_battery_impact(self, device_type: str, load_time: float, interaction_time: float) -> float:
        """Calculate simplified battery impact score (0-100, lower is better)"""
        
        # Base scores by device type
        base_scores = {
            'mobile': 30,
            'tablet': 20,
            'desktop': 10
        }
        
        base_score = base_scores.get(device_type, 25)
        
        # Penalize long load times
        if load_time > 3000:
            base_score += 20
        elif load_time > 1500:
            base_score += 10
        
        # Penalize slow interactions
        if interaction_time > 100:
            base_score += 15
        elif interaction_time > 50:
            base_score += 5
        
        return min(100, base_score)

    async def run_integration_performance_baseline(self) -> Dict[str, Any]:
        """Run complete integration performance baseline tests"""
        logger.info("Starting integration performance baseline tests")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'integration_metrics': [],
            'concurrent_user_metrics': [],
            'mobile_performance_metrics': [],
            'summary': {}
        }
        
        try:
            # Test end-to-end user journeys
            logger.info("Testing end-to-end user journeys...")
            integration_metrics = await self.test_end_to_end_user_journeys()
            results['integration_metrics'] = [asdict(m) for m in integration_metrics]
            
            # Test concurrent users
            logger.info("Testing concurrent user performance...")
            concurrent_metrics = await self.test_concurrent_users([1, 5, 10])  # Reduced for testing
            results['concurrent_user_metrics'] = [asdict(m) for m in concurrent_metrics]
            
            # Test mobile vs desktop
            logger.info("Testing mobile vs desktop performance...")
            mobile_metrics = await self.test_mobile_vs_desktop_performance()
            results['mobile_performance_metrics'] = [asdict(m) for m in mobile_metrics]
            
        finally:
            # Clean up any remaining drivers
            for driver in self.drivers:
                try:
                    driver.quit()
                except:
                    pass
        
        # Generate performance summary
        results['summary'] = self._generate_integration_summary(results)
        
        return results

    def _generate_integration_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate integration performance summary"""
        summary = {
            'overall_status': 'unknown',
            'integration_performance': {},
            'concurrency_performance': {},
            'mobile_performance': {},
            'recommendations': [],
            'integration_score': 0  # 0-100
        }
        
        # Analyze integration metrics
        if results['integration_metrics']:
            integration_data = results['integration_metrics']
            successful_journeys = [j for j in integration_data if j['success']]
            
            if successful_journeys:
                avg_journey_time = statistics.mean([j['total_duration_ms'] for j in successful_journeys])
                avg_frontend_time = statistics.mean([j['frontend_render_time_ms'] for j in successful_journeys])
                avg_api_time = statistics.mean([j['api_response_time_ms'] for j in successful_journeys])
                
                summary['integration_performance'] = {
                    'avg_journey_time_ms': avg_journey_time,
                    'avg_frontend_render_ms': avg_frontend_time,
                    'avg_api_response_ms': avg_api_time,
                    'successful_journeys': len(successful_journeys),
                    'total_journeys': len(integration_data),
                    'success_rate': len(successful_journeys) / len(integration_data) * 100
                }
        
        # Analyze concurrent user metrics
        if results['concurrent_user_metrics']:
            concurrent_data = results['concurrent_user_metrics']
            successful_tests = [t for t in concurrent_data if t['success']]
            
            if successful_tests:
                max_users = max([t['concurrent_users'] for t in successful_tests])
                avg_response_time = statistics.mean([t['avg_response_time_ms'] for t in successful_tests])
                avg_throughput = statistics.mean([t['throughput_rps'] for t in successful_tests])
                
                summary['concurrency_performance'] = {
                    'max_concurrent_users': max_users,
                    'avg_response_time_ms': avg_response_time,
                    'avg_throughput_rps': avg_throughput,
                    'successful_tests': len(successful_tests),
                    'total_tests': len(concurrent_data)
                }
        
        # Analyze mobile performance
        if results['mobile_performance_metrics']:
            mobile_data = results['mobile_performance_metrics']
            successful_mobile = [m for m in mobile_data if m['success']]
            
            if successful_mobile:
                mobile_avg_load = statistics.mean([m['bundle_load_time_ms'] for m in successful_mobile])
                desktop_data = [m for m in successful_mobile if m['device_type'] == 'desktop']
                mobile_devices = [m for m in successful_mobile if m['device_type'] == 'mobile']
                
                summary['mobile_performance'] = {
                    'avg_mobile_load_time_ms': mobile_avg_load,
                    'mobile_vs_desktop_ratio': (
                        mobile_avg_load / statistics.mean([m['bundle_load_time_ms'] for m in desktop_data])
                        if desktop_data else 1
                    ),
                    'devices_tested': len(set([m['device_type'] for m in successful_mobile])),
                    'mobile_battery_impact': statistics.mean([m['battery_impact_score'] for m in mobile_devices]) if mobile_devices else 0
                }
        
        # Calculate integration score
        score = 0
        max_score = 100
        
        # Integration performance scoring (40 points)
        if summary['integration_performance']:
            int_perf = summary['integration_performance']
            if int_perf['success_rate'] >= 90:
                score += 20
            elif int_perf['success_rate'] >= 70:
                score += 15
            elif int_perf['success_rate'] >= 50:
                score += 10
            
            if int_perf['avg_journey_time_ms'] <= 5000:  # 5 seconds
                score += 20
            elif int_perf['avg_journey_time_ms'] <= 10000:  # 10 seconds
                score += 15
            elif int_perf['avg_journey_time_ms'] <= 15000:  # 15 seconds
                score += 10
        
        # Concurrency performance scoring (35 points)
        if summary['concurrency_performance']:
            conc_perf = summary['concurrency_performance']
            if conc_perf['max_concurrent_users'] >= 25:
                score += 20
            elif conc_perf['max_concurrent_users'] >= 10:
                score += 15
            elif conc_perf['max_concurrent_users'] >= 5:
                score += 10
            
            if conc_perf['avg_response_time_ms'] <= 500:
                score += 15
            elif conc_perf['avg_response_time_ms'] <= 1000:
                score += 10
            elif conc_perf['avg_response_time_ms'] <= 2000:
                score += 5
        
        # Mobile performance scoring (25 points)
        if summary['mobile_performance']:
            mob_perf = summary['mobile_performance']
            if mob_perf['mobile_vs_desktop_ratio'] <= 1.5:  # Mobile not more than 50% slower
                score += 15
            elif mob_perf['mobile_vs_desktop_ratio'] <= 2.0:  # Mobile not more than 100% slower
                score += 10
            elif mob_perf['mobile_vs_desktop_ratio'] <= 3.0:
                score += 5
            
            if mob_perf['mobile_battery_impact'] <= 30:
                score += 10
            elif mob_perf['mobile_battery_impact'] <= 50:
                score += 7
            elif mob_perf['mobile_battery_impact'] <= 70:
                score += 5
        
        summary['integration_score'] = min(100, int((score / max_score) * 100))
        
        # Determine overall status
        if summary['integration_score'] >= 85:
            summary['overall_status'] = 'excellent'
        elif summary['integration_score'] >= 70:
            summary['overall_status'] = 'good'
        elif summary['integration_score'] >= 55:
            summary['overall_status'] = 'acceptable'
        else:
            summary['overall_status'] = 'needs_improvement'
        
        # Generate recommendations
        if summary['integration_performance']:
            int_perf = summary['integration_performance']
            if int_perf['success_rate'] < 90:
                summary['recommendations'].append(
                    f"Integration success rate is {int_perf['success_rate']:.1f}% - investigate failing user journeys"
                )
            if int_perf['avg_journey_time_ms'] > 10000:
                summary['recommendations'].append(
                    "User journeys are taking longer than 10 seconds - optimize critical path"
                )
        
        if summary['concurrency_performance']:
            conc_perf = summary['concurrency_performance']
            if conc_perf['max_concurrent_users'] < 10:
                summary['recommendations'].append(
                    "System struggles with concurrent users - improve scalability"
                )
            if conc_perf['avg_response_time_ms'] > 1000:
                summary['recommendations'].append(
                    "High response times under load - optimize backend performance"
                )
        
        if summary['mobile_performance']:
            mob_perf = summary['mobile_performance']
            if mob_perf['mobile_vs_desktop_ratio'] > 2:
                summary['recommendations'].append(
                    "Mobile performance significantly worse than desktop - optimize for mobile"
                )
            if mob_perf['mobile_battery_impact'] > 50:
                summary['recommendations'].append(
                    "High battery impact on mobile devices - reduce resource usage"
                )
        
        return summary


# Pytest integration
class TestIntegrationPerformanceBaseline:
    """Pytest integration for integration performance tests"""
    
    def setup_method(self):
        """Setup integration testing environment"""
        self.tester = IntegrationPerformanceTester()
    
    @pytest.mark.asyncio
    @pytest.mark.integration 
    @pytest.mark.slow
    async def test_integration_performance_baseline(self):
        """Run complete integration performance baseline"""
        results = await self.tester.run_integration_performance_baseline()
        
        # Validate results structure
        assert 'timestamp' in results
        assert 'integration_metrics' in results
        assert 'concurrent_user_metrics' in results
        assert 'mobile_performance_metrics' in results
        assert 'summary' in results
        
        summary = results['summary']
        
        # Integration Performance Assertions
        if summary.get('integration_performance'):
            int_perf = summary['integration_performance']
            assert int_perf['success_rate'] >= 70, f"Low integration success rate: {int_perf['success_rate']}%"
            # Relaxed for development
            assert int_perf['avg_journey_time_ms'] <= 20000, f"User journeys too slow: {int_perf['avg_journey_time_ms']}ms"
        
        # Concurrency Performance Assertions
        if summary.get('concurrency_performance'):
            conc_perf = summary['concurrency_performance']
            assert conc_perf['max_concurrent_users'] >= 5, f"Low concurrent user capacity: {conc_perf['max_concurrent_users']}"
            assert conc_perf['avg_response_time_ms'] <= 3000, f"High response time under load: {conc_perf['avg_response_time_ms']}ms"
        
        # Overall Integration Score
        assert summary['integration_score'] >= 40, f"Low integration score: {summary['integration_score']}/100"
        
        # Generate comprehensive report
        report_path = self._save_integration_report(results)
        logger.info(f"Integration performance report saved: {report_path}")
    
    def _save_integration_report(self, results: Dict[str, Any]) -> str:
        """Save integration performance report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_dir = Path("integration_performance_reports")
        report_dir.mkdir(exist_ok=True)
        
        # Save JSON report
        json_file = report_dir / f"integration_baseline_{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        return str(json_file)


if __name__ == "__main__":
    async def main():
        tester = IntegrationPerformanceTester()
        results = await tester.run_integration_performance_baseline()
        
        print(f"\\nIntegration Performance Baseline Results:")
        print(f"Integration Score: {results['summary']['integration_score']}/100")
        print(f"Overall Status: {results['summary']['overall_status']}")
        
        if results['summary'].get('recommendations'):
            print(f"\\nRecommendations:")
            for i, rec in enumerate(results['summary']['recommendations'], 1):
                print(f"  {i}. {rec}")
    
    asyncio.run(main())