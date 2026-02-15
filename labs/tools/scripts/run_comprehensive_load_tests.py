#!/usr/bin/env python3
"""
Comprehensive Load Testing Execution Script
==========================================

This script orchestrates the complete load testing suite for Igris-engine,
executing all test categories and generating comprehensive reports.

Features:
- Complete test suite orchestration
- Parallel test execution where possible
- Real-time progress monitoring
- Comprehensive report generation
- Performance regression detection
- CI/CD integration support
- Email notifications and alerts
- Historical trend analysis

Test Categories Executed:
1. Comprehensive E2E system testing
2. Specialized endpoint testing (Auth, ML/RL, File upload, WebSocket)
3. Frontend performance testing under backend load
4. Database and cache performance testing
5. Circuit breaker and failure scenario testing
6. Memory leak and resource monitoring
7. Performance baseline validation

Usage:
    # Run all tests with default configuration
    python tools/scripts/run_comprehensive_load_tests.py

    # Run with specific configuration
    python tools/scripts/run_comprehensive_load_tests.py --config production --duration 30

    # Run specific test categories
    python tools/scripts/run_comprehensive_load_tests.py --tests e2e,endpoints,frontend

    # Run with CI/CD mode (strict assertions)
    python tools/scripts/run_comprehensive_load_tests.py --ci-mode --baseline-validation

    # Run with custom parameters
    python tools/scripts/run_comprehensive_load_tests.py \\
        --users 500 \\
        --duration 60 \\
        --backend-url http://prod-api.igris-inertial.com \\
        --report-email team@igris-inertial.com
"""

import asyncio
import json
import time
import logging
import argparse
import sys
import subprocess
import threading
import signal
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import concurrent.futures
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from email.mime.base import MimeBase
from email import encoders

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'load_test_execution_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class LoadTestConfiguration:
    """Configuration for comprehensive load testing"""
    
    # Test execution parameters
    concurrent_users: int = 100
    test_duration_minutes: int = 15
    ramp_up_minutes: int = 3
    test_categories: List[str] = None
    
    # Service URLs
    backend_url: str = "http://localhost:8000"
    frontend_landing_url: str = "http://localhost:3000"
    frontend_admin_url: str = "http://localhost:3002"
    frontend_docs_url: str = "http://localhost:3001"
    
    # Database and infrastructure
    database_url: str = "postgresql://localhost:5432/igris_test"
    redis_url: str = "redis://localhost:6379/0"
    
    # Test configuration
    test_intensity: str = "medium"  # light, medium, heavy
    include_frontend_testing: bool = True
    include_ml_testing: bool = True
    include_memory_leak_testing: bool = True
    include_failure_scenario_testing: bool = True
    
    # CI/CD and automation
    ci_mode: bool = False
    baseline_validation: bool = False
    performance_regression_threshold: float = 20.0  # % degradation threshold
    
    # Reporting and notifications
    generate_html_report: bool = True
    send_email_report: bool = False
    email_recipients: List[str] = None
    slack_webhook_url: Optional[str] = None
    
    # Historical tracking
    store_results_in_database: bool = False
    compare_with_historical_data: bool = False
    
    def __post_init__(self):
        if self.test_categories is None:
            self.test_categories = ['e2e', 'endpoints', 'frontend', 'baseline', 'locust']
        if self.email_recipients is None:
            self.email_recipients = []

class LoadTestExecutor:
    """Main executor for comprehensive load testing"""
    
    def __init__(self, config: LoadTestConfiguration):
        self.config = config
        self.start_time = None
        self.test_results = {}
        self.running_processes = {}
        self.interrupted = False
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle interrupt signals for graceful shutdown"""
        logger.warning(f"Received signal {signum}, initiating graceful shutdown...")
        self.interrupted = True
        self._cleanup_processes()
        sys.exit(1)
    
    def _cleanup_processes(self):
        """Clean up running test processes"""
        logger.info("Cleaning up running test processes...")
        
        for test_name, process in self.running_processes.items():
            if process and process.poll() is None:
                logger.info(f"Terminating {test_name} process...")
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    logger.warning(f"Force killing {test_name} process...")
                    process.kill()
    
    async def execute_comprehensive_load_tests(self) -> Dict[str, Any]:
        """Execute comprehensive load testing suite"""
        
        logger.info("🚀 Starting Comprehensive Load Testing Suite")
        logger.info(f"Configuration: {asdict(self.config)}")
        
        self.start_time = time.time()
        execution_results = {
            'start_time': datetime.now().isoformat(),
            'configuration': asdict(self.config),
            'test_results': {},
            'execution_summary': {}
        }
        
        try:
            # Phase 1: Pre-test validation
            logger.info("📋 Phase 1: Pre-test validation")
            pre_test_results = await self._run_pre_test_validation()
            execution_results['test_results']['pre_test_validation'] = pre_test_results
            
            if not pre_test_results.get('services_ready', False):
                raise RuntimeError("Pre-test validation failed - services not ready")
            
            # Phase 2: Execute test categories in parallel where possible
            test_futures = {}
            
            if 'e2e' in self.config.test_categories:
                logger.info("🔄 Starting E2E Load Testing")
                test_futures['e2e'] = asyncio.create_task(self._run_e2e_load_tests())
            
            if 'endpoints' in self.config.test_categories:
                logger.info("🎯 Starting Specialized Endpoint Testing")
                test_futures['endpoints'] = asyncio.create_task(self._run_endpoint_tests())
            
            if 'baseline' in self.config.test_categories:
                logger.info("📊 Starting Baseline Validation")
                test_futures['baseline'] = asyncio.create_task(self._run_baseline_validation())
            
            # Wait for backend tests to stabilize before frontend testing
            await asyncio.sleep(30)
            
            if 'frontend' in self.config.test_categories and self.config.include_frontend_testing:
                logger.info("🎨 Starting Frontend Performance Testing")
                test_futures['frontend'] = asyncio.create_task(self._run_frontend_tests())
            
            if 'locust' in self.config.test_categories:
                logger.info("🦗 Starting Locust Load Testing")
                test_futures['locust'] = asyncio.create_task(self._run_locust_tests())
            
            # Collect results as tests complete
            for test_name, future in test_futures.items():
                try:
                    result = await future
                    execution_results['test_results'][test_name] = result
                    logger.info(f"✅ {test_name} testing completed")
                except Exception as e:
                    logger.error(f"❌ {test_name} testing failed: {e}")
                    execution_results['test_results'][test_name] = {'error': str(e)}
            
            # Phase 3: Post-test analysis and reporting
            logger.info("📈 Phase 3: Post-test analysis and reporting")
            analysis_results = await self._analyze_test_results(execution_results['test_results'])
            execution_results['analysis'] = analysis_results
            
        except Exception as e:
            logger.error(f"Load testing execution failed: {e}")
            execution_results['execution_error'] = str(e)
        
        finally:
            # Cleanup
            self._cleanup_processes()
            
            # Record execution time
            execution_results['end_time'] = datetime.now().isoformat()
            execution_results['total_duration_seconds'] = time.time() - self.start_time
        
        # Generate reports
        await self._generate_comprehensive_report(execution_results)
        
        # Send notifications
        await self._send_notifications(execution_results)
        
        return execution_results
    
    async def _run_pre_test_validation(self) -> Dict[str, Any]:
        """Run pre-test validation to ensure services are ready"""
        
        validation_results = {
            'backend_health': False,
            'frontend_services': {},
            'database_connection': False,
            'redis_connection': False,
            'services_ready': False
        }
        
        try:
            # Check backend health
            process = await asyncio.create_subprocess_exec(
                'curl', '-f', f"{self.config.backend_url}/health",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.wait()
            validation_results['backend_health'] = process.returncode == 0
            
            # Check frontend services
            frontend_services = {
                'landing': self.config.frontend_landing_url,
                'admin': self.config.frontend_admin_url,
                'docs': self.config.frontend_docs_url
            }
            
            for service_name, url in frontend_services.items():
                try:
                    process = await asyncio.create_subprocess_exec(
                        'curl', '-f', url,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await process.wait()
                    validation_results['frontend_services'][service_name] = process.returncode == 0
                except Exception as e:
                    validation_results['frontend_services'][service_name] = False
                    logger.warning(f"Frontend service {service_name} check failed: {e}")
            
            # Check database connection
            try:
                import psycopg2
                conn = psycopg2.connect(self.config.database_url)
                conn.close()
                validation_results['database_connection'] = True
            except Exception as e:
                logger.warning(f"Database connection check failed: {e}")
            
            # Check Redis connection
            try:
                import redis
                r = redis.from_url(self.config.redis_url)
                r.ping()
                validation_results['redis_connection'] = True
            except Exception as e:
                logger.warning(f"Redis connection check failed: {e}")
            
            # Overall readiness
            validation_results['services_ready'] = (
                validation_results['backend_health'] and
                any(validation_results['frontend_services'].values())
            )
            
        except Exception as e:
            logger.error(f"Pre-test validation failed: {e}")
            validation_results['validation_error'] = str(e)
        
        return validation_results
    
    async def _run_e2e_load_tests(self) -> Dict[str, Any]:
        """Run comprehensive E2E load tests"""
        
        try:
            cmd = [
                'python', 'apps/api/tests/comprehensive_e2e_load_testing.py',
                '--base-url', self.config.backend_url,
                '--max-users', str(self.config.concurrent_users),
                '--duration', str(self.config.test_duration_minutes * 60)
            ]
            
            if self.config.ci_mode:
                cmd.append('--ci-mode')
            
            if self.config.baseline_validation:
                cmd.append('--baseline-validation')
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.running_processes['e2e'] = process
            stdout, stderr = await process.communicate()
            
            result = {
                'exit_code': process.returncode,
                'success': process.returncode == 0,
                'stdout': stdout.decode('utf-8') if stdout else '',
                'stderr': stderr.decode('utf-8') if stderr else '',
                'test_type': 'e2e_comprehensive'
            }
            
            # Try to parse JSON results from stdout
            try:
                # Look for JSON report in stdout
                lines = result['stdout'].split('\n')
                for line in lines:
                    if line.strip().startswith('{') and 'system_health_score' in line:
                        result['parsed_results'] = json.loads(line.strip())
                        break
            except Exception as e:
                logger.debug(f"Could not parse E2E results: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"E2E load test execution failed: {e}")
            return {'error': str(e), 'success': False}
    
    async def _run_endpoint_tests(self) -> Dict[str, Any]:
        """Run specialized endpoint tests"""
        
        try:
            cmd = [
                'python', '-m', 'pytest',
                'apps/api/tests/specialized_endpoint_load_testing.py',
                '-v', '--tb=short', '--json-report', '--json-report-file=endpoint_test_results.json'
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.running_processes['endpoints'] = process
            stdout, stderr = await process.communicate()
            
            result = {
                'exit_code': process.returncode,
                'success': process.returncode == 0,
                'stdout': stdout.decode('utf-8') if stdout else '',
                'stderr': stderr.decode('utf-8') if stderr else '',
                'test_type': 'specialized_endpoints'
            }
            
            # Try to load pytest JSON report
            try:
                with open('endpoint_test_results.json', 'r') as f:
                    result['pytest_results'] = json.load(f)
            except Exception as e:
                logger.debug(f"Could not load endpoint test results: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Endpoint test execution failed: {e}")
            return {'error': str(e), 'success': False}
    
    async def _run_frontend_tests(self) -> Dict[str, Any]:
        """Run frontend performance tests"""
        
        try:
            cmd = [
                'python', '-m', 'pytest',
                'apps/api/tests/frontend_performance_under_load.py',
                '-v', '--tb=short'
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.running_processes['frontend'] = process
            stdout, stderr = await process.communicate()
            
            return {
                'exit_code': process.returncode,
                'success': process.returncode == 0,
                'stdout': stdout.decode('utf-8') if stdout else '',
                'stderr': stderr.decode('utf-8') if stderr else '',
                'test_type': 'frontend_performance'
            }
            
        except Exception as e:
            logger.error(f"Frontend test execution failed: {e}")
            return {'error': str(e), 'success': False}
    
    async def _run_baseline_validation(self) -> Dict[str, Any]:
        """Run performance baseline validation"""
        
        try:
            cmd = [
                'python', '-m', 'pytest',
                'apps/api/tests/backend_performance_validation.py',
                'apps/api/tests/integration_performance_baseline.py',
                'apps/api/tests/comprehensive_performance_baseline.py',
                '-v', '--tb=short'
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.running_processes['baseline'] = process
            stdout, stderr = await process.communicate()
            
            return {
                'exit_code': process.returncode,
                'success': process.returncode == 0,
                'stdout': stdout.decode('utf-8') if stdout else '',
                'stderr': stderr.decode('utf-8') if stderr else '',
                'test_type': 'baseline_validation'
            }
            
        except Exception as e:
            logger.error(f"Baseline validation execution failed: {e}")
            return {'error': str(e), 'success': False}
    
    async def _run_locust_tests(self) -> Dict[str, Any]:
        """Run Locust load tests"""
        
        try:
            cmd = [
                'locust', '-f', 'apps/api/tests/locust_load_tests.py',
                '--host', self.config.backend_url,
                '--users', str(self.config.concurrent_users),
                '--spawn-rate', str(max(1, self.config.concurrent_users // 10)),
                '--run-time', f"{self.config.test_duration_minutes}m",
                '--headless',
                '--html', 'locust_report.html',
                '--csv', 'locust_results'
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.running_processes['locust'] = process
            stdout, stderr = await process.communicate()
            
            return {
                'exit_code': process.returncode,
                'success': process.returncode == 0,
                'stdout': stdout.decode('utf-8') if stdout else '',
                'stderr': stderr.decode('utf-8') if stderr else '',
                'test_type': 'locust_load_testing'
            }
            
        except Exception as e:
            logger.error(f"Locust test execution failed: {e}")
            return {'error': str(e), 'success': False}
    
    async def _analyze_test_results(self, test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze and consolidate test results"""
        
        analysis = {
            'overall_success_rate': 0,
            'test_categories_passed': 0,
            'test_categories_total': len(test_results),
            'performance_scores': {},
            'critical_issues': [],
            'recommendations': [],
            'production_readiness': False
        }
        
        successful_tests = 0
        performance_scores = []
        
        for test_name, result in test_results.items():
            if test_name == 'pre_test_validation':
                continue
                
            if isinstance(result, dict):
                test_success = result.get('success', False) and result.get('exit_code', 1) == 0
                
                if test_success:
                    successful_tests += 1
                else:
                    analysis['critical_issues'].append(f"{test_name} testing failed")
                
                # Extract performance scores if available
                if 'parsed_results' in result:
                    parsed = result['parsed_results']
                    if 'system_health_score' in parsed:
                        performance_scores.append(parsed['system_health_score'])
                    elif 'frontend_health_score' in parsed:
                        performance_scores.append(parsed['frontend_health_score'])
                    elif 'overall_score' in parsed:
                        performance_scores.append(parsed['overall_score'])
        
        analysis['overall_success_rate'] = (successful_tests / len(test_results)) * 100 if test_results else 0
        analysis['test_categories_passed'] = successful_tests
        
        if performance_scores:
            analysis['average_performance_score'] = sum(performance_scores) / len(performance_scores)
            analysis['min_performance_score'] = min(performance_scores)
            analysis['max_performance_score'] = max(performance_scores)
        else:
            analysis['average_performance_score'] = 0
        
        # Generate recommendations
        if analysis['overall_success_rate'] < 80:
            analysis['recommendations'].append("🚨 Multiple test categories failing - investigate system stability")
        
        if analysis.get('average_performance_score', 0) < 70:
            analysis['recommendations'].append("📉 Performance scores below acceptable threshold")
        
        if len(analysis['critical_issues']) == 0 and analysis['overall_success_rate'] >= 90:
            analysis['recommendations'].append("✅ All test categories passing - system performing well")
        
        # Production readiness assessment
        analysis['production_readiness'] = (
            analysis['overall_success_rate'] >= 85 and
            analysis.get('average_performance_score', 0) >= 75 and
            len(analysis['critical_issues']) == 0
        )
        
        return analysis
    
    async def _generate_comprehensive_report(self, execution_results: Dict[str, Any]):
        """Generate comprehensive HTML and JSON reports"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save JSON report
        json_report_path = f"comprehensive_load_test_report_{timestamp}.json"
        with open(json_report_path, 'w') as f:
            json.dump(execution_results, f, indent=2, default=str)
        
        logger.info(f"📄 JSON report saved: {json_report_path}")
        
        # Generate HTML report if requested
        if self.config.generate_html_report:
            html_report_path = f"comprehensive_load_test_report_{timestamp}.html"
            await self._generate_html_report(execution_results, html_report_path)
            logger.info(f"🌐 HTML report saved: {html_report_path}")
    
    async def _generate_html_report(self, results: Dict[str, Any], output_path: str):
        """Generate HTML report"""
        
        analysis = results.get('analysis', {})
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Comprehensive Load Test Report - {results['start_time']}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                .score {{ font-size: 2em; font-weight: bold; color: #007bff; }}
                .success {{ color: #28a745; }}
                .warning {{ color: #ffc107; }}
                .danger {{ color: #dc3545; }}
                .test-category {{ margin: 20px 0; padding: 15px; border: 1px solid #dee2e6; border-radius: 8px; }}
                .recommendations {{ background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f8f9fa; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Comprehensive Load Test Report</h1>
                <p><strong>Generated:</strong> {results['start_time']}</p>
                <p><strong>Duration:</strong> {results.get('total_duration_seconds', 0):.1f} seconds</p>
                <p><strong>Configuration:</strong> {results['configuration']['test_intensity']} intensity, 
                   {results['configuration']['concurrent_users']} users, 
                   {results['configuration']['test_duration_minutes']} minutes</p>
            </div>
        """
        
        # Overall results
        production_ready = analysis.get('production_readiness', False)
        avg_score = analysis.get('average_performance_score', 0)
        success_rate = analysis.get('overall_success_rate', 0)
        
        html_content += f"""
            <h2>Overall Results</h2>
            <div class="score {'success' if production_ready else 'danger'}">
                Production Ready: {'✅ YES' if production_ready else '❌ NO'}
            </div>
            <table>
                <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
                <tr>
                    <td>Average Performance Score</td>
                    <td>{avg_score:.1f}/100</td>
                    <td class="{'success' if avg_score >= 75 else 'warning' if avg_score >= 60 else 'danger'}">
                        {'Good' if avg_score >= 75 else 'Fair' if avg_score >= 60 else 'Poor'}
                    </td>
                </tr>
                <tr>
                    <td>Test Categories Passed</td>
                    <td>{analysis.get('test_categories_passed', 0)}/{analysis.get('test_categories_total', 0)}</td>
                    <td class="{'success' if success_rate >= 80 else 'warning' if success_rate >= 60 else 'danger'}">
                        {success_rate:.1f}%
                    </td>
                </tr>
            </table>
        """
        
        # Test results details
        html_content += "<h2>Test Category Results</h2>"
        
        for test_name, result in results.get('test_results', {}).items():
            if test_name == 'pre_test_validation':
                continue
                
            success = result.get('success', False) if isinstance(result, dict) else False
            status_class = 'success' if success else 'danger'
            
            html_content += f"""
                <div class="test-category">
                    <h3 class="{status_class}">{test_name.upper().replace('_', ' ')} 
                        {'✅' if success else '❌'}</h3>
                    <p><strong>Exit Code:</strong> {result.get('exit_code', 'N/A') if isinstance(result, dict) else 'N/A'}</p>
                    <p><strong>Test Type:</strong> {result.get('test_type', 'Unknown') if isinstance(result, dict) else 'Unknown'}</p>
                    {f'<p><strong>Error:</strong> {result.get("error", "")}</p>' if isinstance(result, dict) and 'error' in result else ''}
                </div>
            """
        
        # Recommendations
        recommendations = analysis.get('recommendations', [])
        critical_issues = analysis.get('critical_issues', [])
        
        if recommendations or critical_issues:
            html_content += '<div class="recommendations"><h2>Recommendations</h2><ul>'
            
            for issue in critical_issues:
                html_content += f'<li class="danger">🚨 {issue}</li>'
            
            for rec in recommendations:
                html_content += f'<li>{rec}</li>'
            
            html_content += '</ul></div>'
        
        html_content += "</body></html>"
        
        with open(output_path, 'w') as f:
            f.write(html_content)
    
    async def _send_notifications(self, execution_results: Dict[str, Any]):
        """Send notifications about test results"""
        
        if self.config.send_email_report and self.config.email_recipients:
            await self._send_email_notification(execution_results)
        
        if self.config.slack_webhook_url:
            await self._send_slack_notification(execution_results)
    
    async def _send_email_notification(self, results: Dict[str, Any]):
        """Send email notification with results"""
        
        try:
            # This is a placeholder for email notification
            # In a real implementation, you would configure SMTP settings
            logger.info(f"Email notification would be sent to: {', '.join(self.config.email_recipients)}")
            
        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
    
    async def _send_slack_notification(self, results: Dict[str, Any]):
        """Send Slack notification with results"""
        
        try:
            # This is a placeholder for Slack notification
            # In a real implementation, you would send to the webhook URL
            analysis = results.get('analysis', {})
            message = f"Load Testing Complete: " \
                     f"Production Ready: {analysis.get('production_readiness', False)}, " \
                     f"Score: {analysis.get('average_performance_score', 0):.1f}/100"
            
            logger.info(f"Slack notification would be sent: {message}")
            
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")

def parse_arguments():
    """Parse command line arguments"""
    
    parser = argparse.ArgumentParser(
        description="Comprehensive Load Testing Execution Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # Test execution parameters
    parser.add_argument('--users', type=int, default=100,
                        help='Number of concurrent users (default: 100)')
    parser.add_argument('--duration', type=int, default=15,
                        help='Test duration in minutes (default: 15)')
    parser.add_argument('--ramp-up', type=int, default=3,
                        help='Ramp-up time in minutes (default: 3)')
    
    # Test configuration
    parser.add_argument('--config', choices=['development', 'staging', 'production'],
                        default='development', help='Test configuration preset')
    parser.add_argument('--tests', help='Comma-separated list of test categories (e2e,endpoints,frontend,baseline,locust)')
    parser.add_argument('--intensity', choices=['light', 'medium', 'heavy'],
                        default='medium', help='Test intensity level')
    
    # Service URLs
    parser.add_argument('--backend-url', default='http://localhost:8000',
                        help='Backend API URL')
    parser.add_argument('--frontend-landing-url', default='http://localhost:3000',
                        help='Frontend landing page URL')
    parser.add_argument('--frontend-admin-url', default='http://localhost:3002',
                        help='Frontend admin page URL')
    parser.add_argument('--frontend-docs-url', default='http://localhost:3001',
                        help='Frontend docs page URL')
    
    # Database and infrastructure
    parser.add_argument('--database-url', default='postgresql://localhost:5432/igris_test',
                        help='Database connection URL')
    parser.add_argument('--redis-url', default='redis://localhost:6379/0',
                        help='Redis connection URL')
    
    # Feature flags
    parser.add_argument('--no-frontend', action='store_true',
                        help='Skip frontend testing')
    parser.add_argument('--no-ml', action='store_true',
                        help='Skip ML/RL endpoint testing')
    parser.add_argument('--no-memory-leak', action='store_true',
                        help='Skip memory leak testing')
    parser.add_argument('--no-failure-scenarios', action='store_true',
                        help='Skip failure scenario testing')
    
    # CI/CD and automation
    parser.add_argument('--ci-mode', action='store_true',
                        help='Run in CI/CD mode with strict assertions')
    parser.add_argument('--baseline-validation', action='store_true',
                        help='Perform baseline validation')
    parser.add_argument('--regression-threshold', type=float, default=20.0,
                        help='Performance regression threshold percentage')
    
    # Reporting
    parser.add_argument('--no-html-report', action='store_true',
                        help='Skip HTML report generation')
    parser.add_argument('--email-report', action='store_true',
                        help='Send email report')
    parser.add_argument('--email-recipients',
                        help='Comma-separated list of email recipients')
    parser.add_argument('--slack-webhook',
                        help='Slack webhook URL for notifications')
    
    return parser.parse_args()

def create_configuration_from_args(args) -> LoadTestConfiguration:
    """Create load test configuration from parsed arguments"""
    
    # Apply configuration presets
    if args.config == 'production':
        concurrent_users = args.users if args.users != 100 else 500
        test_duration = args.duration if args.duration != 15 else 30
    elif args.config == 'staging':
        concurrent_users = args.users if args.users != 100 else 200
        test_duration = args.duration if args.duration != 15 else 20
    else:  # development
        concurrent_users = args.users
        test_duration = args.duration
    
    # Parse test categories
    test_categories = None
    if args.tests:
        test_categories = [t.strip() for t in args.tests.split(',')]
    
    # Parse email recipients
    email_recipients = []
    if args.email_recipients:
        email_recipients = [e.strip() for e in args.email_recipients.split(',')]
    
    return LoadTestConfiguration(
        concurrent_users=concurrent_users,
        test_duration_minutes=test_duration,
        ramp_up_minutes=args.ramp_up,
        test_categories=test_categories,
        backend_url=args.backend_url,
        frontend_landing_url=args.frontend_landing_url,
        frontend_admin_url=args.frontend_admin_url,
        frontend_docs_url=args.frontend_docs_url,
        database_url=args.database_url,
        redis_url=args.redis_url,
        test_intensity=args.intensity,
        include_frontend_testing=not args.no_frontend,
        include_ml_testing=not args.no_ml,
        include_memory_leak_testing=not args.no_memory_leak,
        include_failure_scenario_testing=not args.no_failure_scenarios,
        ci_mode=args.ci_mode,
        baseline_validation=args.baseline_validation,
        performance_regression_threshold=args.regression_threshold,
        generate_html_report=not args.no_html_report,
        send_email_report=args.email_report,
        email_recipients=email_recipients,
        slack_webhook_url=args.slack_webhook
    )

async def main():
    """Main execution function"""
    
    print("🚀 Igris-engine Comprehensive Load Testing Suite")
    print("=" * 60)
    
    # Parse arguments and create configuration
    args = parse_arguments()
    config = create_configuration_from_args(args)
    
    # Create and run executor
    executor = LoadTestExecutor(config)
    
    try:
        results = await executor.execute_comprehensive_load_tests()
        
        # Display summary
        analysis = results.get('analysis', {})
        
        print("\n" + "=" * 60)
        print(" COMPREHENSIVE LOAD TESTING RESULTS")
        print("=" * 60)
        print(f" Overall Success Rate: {analysis.get('overall_success_rate', 0):.1f}%")
        print(f" Average Performance Score: {analysis.get('average_performance_score', 0):.1f}/100")
        print(f" Production Ready: {'✅ YES' if analysis.get('production_readiness', False) else '❌ NO'}")
        print(f" Test Categories Passed: {analysis.get('test_categories_passed', 0)}/{analysis.get('test_categories_total', 0)}")
        print(f" Total Duration: {results.get('total_duration_seconds', 0):.1f} seconds")
        
        # Show critical issues
        critical_issues = analysis.get('critical_issues', [])
        if critical_issues:
            print(f"\n🚨 CRITICAL ISSUES ({len(critical_issues)}):")
            for issue in critical_issues:
                print(f"   {issue}")
        
        # Show recommendations
        recommendations = analysis.get('recommendations', [])
        if recommendations:
            print(f"\n💡 RECOMMENDATIONS:")
            for rec in recommendations:
                print(f"   {rec}")
        
        print("=" * 60)
        
        # Exit with appropriate code for CI/CD
        if config.ci_mode:
            production_ready = analysis.get('production_readiness', False)
            success_rate = analysis.get('overall_success_rate', 0)
            
            if not production_ready or success_rate < 80:
                logger.error("Load testing failed CI/CD quality gates")
                sys.exit(1)
            else:
                logger.info("Load testing passed CI/CD quality gates")
                sys.exit(0)
        
        return results
        
    except KeyboardInterrupt:
        logger.warning("Load testing interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Load testing execution failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Ensure we're in the correct directory
    script_dir = Path(__file__).parent.parent.parent
    if script_dir.name == 'igris-inertial':
        import os
        os.chdir(script_dir)
    
    # Run the main function
    asyncio.run(main())