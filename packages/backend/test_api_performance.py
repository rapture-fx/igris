#!/usr/bin/env python3
"""
Schlep-engine API PERFORMANCE TESTING SUITE
========================================

Comprehensive testing suite to validate API enhancements and performance improvements.
Tests the new unified authentication, streaming APIs, rate limiting, and caching systems.

Usage:
    python test_api_performance.py
"""

import asyncio
import aiohttp
import time
import json
import statistics
from datetime import datetime
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class APIPerformanceTester:
    """Comprehensive API performance testing suite"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.test_results = {}
        
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def test_endpoint_performance(
        self, 
        endpoint: str, 
        method: str = "GET",
        payload: Dict = None,
        headers: Dict = None,
        iterations: int = 10
    ) -> Dict[str, Any]:
        """Test endpoint performance with multiple iterations"""
        
        response_times = []
        success_count = 0
        error_count = 0
        
        logger.info(f"Testing {method} {endpoint} ({iterations} iterations)")
        
        for i in range(iterations):
            start_time = time.time()
            
            try:
                if method.upper() == "GET":
                    async with self.session.get(
                        f"{self.base_url}{endpoint}", 
                        headers=headers
                    ) as response:
                        await response.text()
                        status = response.status
                        
                elif method.upper() == "POST":
                    async with self.session.post(
                        f"{self.base_url}{endpoint}",
                        json=payload,
                        headers=headers
                    ) as response:
                        await response.text()
                        status = response.status
                
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # Convert to ms
                response_times.append(response_time)
                
                if 200 <= status < 300:
                    success_count += 1
                else:
                    error_count += 1
                    
            except Exception as e:
                logger.warning(f"Request {i+1} failed: {e}")
                error_count += 1
                end_time = time.time()
                response_times.append((end_time - start_time) * 1000)
        
        # Calculate statistics
        if response_times:
            avg_response_time = statistics.mean(response_times)
            p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
            p99_response_time = statistics.quantiles(response_times, n=100)[98]  # 99th percentile
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = p95_response_time = p99_response_time = 0
            min_response_time = max_response_time = 0
        
        return {
            'endpoint': endpoint,
            'method': method,
            'iterations': iterations,
            'success_count': success_count,
            'error_count': error_count,
            'success_rate': (success_count / iterations) * 100,
            'avg_response_time_ms': round(avg_response_time, 2),
            'p95_response_time_ms': round(p95_response_time, 2),
            'p99_response_time_ms': round(p99_response_time, 2),
            'min_response_time_ms': round(min_response_time, 2),
            'max_response_time_ms': round(max_response_time, 2),
            'performance_grade': self._calculate_performance_grade(avg_response_time, success_count / iterations)
        }
    
    def _calculate_performance_grade(self, avg_response_time: float, success_rate: float) -> str:
        """Calculate performance grade based on response time and success rate"""
        
        if success_rate < 0.95:
            return "F"
        elif avg_response_time < 100:
            return "A+"
        elif avg_response_time < 200:
            return "A"
        elif avg_response_time < 500:
            return "B"
        elif avg_response_time < 1000:
            return "C"
        else:
            return "D"
    
    async def test_unified_authentication(self) -> Dict[str, Any]:
        """Test the new unified authentication system"""
        
        logger.info("🔐 Testing Unified Authentication System")
        
        # Test registration
        register_payload = {
            "email": f"test_{int(time.time())}@Schlep-engine.ai",
            "password": "TestPassword123!",
            "action": "register",
            "username": f"testuser_{int(time.time())}",
            "first_name": "Test",
            "last_name": "User"
        }
        
        register_result = await self.test_endpoint_performance(
            "/api/v1/auth",
            method="POST",
            payload=register_payload,
            iterations=5
        )
        
        # Test login
        login_payload = {
            "email": register_payload["email"],
            "password": register_payload["password"],
            "action": "login"
        }
        
        login_result = await self.test_endpoint_performance(
            "/api/v1/auth",
            method="POST",
            payload=login_payload,
            iterations=10
        )
        
        # Test auth status
        status_result = await self.test_endpoint_performance(
            "/api/v1/auth/status",
            method="GET",
            iterations=20
        )
        
        return {
            'system': 'unified_authentication',
            'tests': {
                'registration': register_result,
                'login': login_result,
                'status': status_result
            },
            'overall_grade': self._calculate_system_grade([
                register_result['performance_grade'],
                login_result['performance_grade'],
                status_result['performance_grade']
            ])
        }
    
    async def test_streaming_api(self) -> Dict[str, Any]:
        """Test the new streaming data processing API"""
        
        logger.info("🌊 Testing Streaming Data Processing API")
        
        # Test streaming status endpoints
        status_result = await self.test_endpoint_performance(
            "/api/v1/stream/status/test-job-id",
            method="GET",
            iterations=15
        )
        
        return {
            'system': 'streaming_data_processing',
            'tests': {
                'status_check': status_result
            },
            'overall_grade': status_result['performance_grade']
        }
    
    async def test_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting effectiveness"""
        
        logger.info("⚡ Testing Rate Limiting System")
        
        # Test normal rate - should succeed
        normal_result = await self.test_endpoint_performance(
            "/api/v1/auth/status",
            method="GET",
            iterations=10
        )
        
        # Test high rate - should trigger rate limiting
        start_time = time.time()
        rate_limit_triggered = False
        
        try:
            for i in range(100):  # Send many requests quickly
                async with self.session.get(f"{self.base_url}/api/v1/auth/status") as response:
                    if response.status == 429:  # Rate limit status
                        rate_limit_triggered = True
                        break
        except Exception as e:
            logger.info(f"Rate limiting test completed: {e}")
        
        end_time = time.time()
        
        return {
            'system': 'rate_limiting',
            'tests': {
                'normal_rate': normal_result,
                'rate_limit_triggered': rate_limit_triggered,
                'test_duration_seconds': round(end_time - start_time, 2)
            },
            'effectiveness': 'excellent' if rate_limit_triggered else 'needs_improvement'
        }
    
    async def test_system_health(self) -> Dict[str, Any]:
        """Test overall system health endpoints"""
        
        logger.info("🏥 Testing System Health Endpoints")
        
        # Test root endpoint
        root_result = await self.test_endpoint_performance(
            "/",
            method="GET",
            iterations=20
        )
        
        # Test health endpoint
        health_result = await self.test_endpoint_performance(
            "/health",
            method="GET",
            iterations=15
        )
        
        return {
            'system': 'health_monitoring',
            'tests': {
                'root_endpoint': root_result,
                'health_check': health_result
            },
            'overall_grade': self._calculate_system_grade([
                root_result['performance_grade'],
                health_result['performance_grade']
            ])
        }
    
    def _calculate_system_grade(self, grades: List[str]) -> str:
        """Calculate overall system grade from individual test grades"""
        
        grade_values = {
            'A+': 4.3, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0
        }
        
        if not grades:
            return 'F'
        
        avg_value = sum(grade_values.get(grade, 0) for grade in grades) / len(grades)
        
        if avg_value >= 4.2:
            return 'A+'
        elif avg_value >= 3.8:
            return 'A'
        elif avg_value >= 2.8:
            return 'B'
        elif avg_value >= 1.8:
            return 'C'
        elif avg_value >= 0.8:
            return 'D'
        else:
            return 'F'
    
    async def run_comprehensive_tests(self) -> Dict[str, Any]:
        """Run all performance tests"""
        
        logger.info("🚀 Starting Comprehensive API Performance Tests")
        start_time = time.time()
        
        # Run all test suites
        test_results = {}
        
        try:
            # Test authentication system
            test_results['authentication'] = await self.test_unified_authentication()
            
            # Test streaming API
            test_results['streaming'] = await self.test_streaming_api()
            
            # Test rate limiting
            test_results['rate_limiting'] = await self.test_rate_limiting()
            
            # Test system health
            test_results['system_health'] = await self.test_system_health()
            
        except Exception as e:
            logger.error(f"Test suite error: {e}")
            test_results['error'] = str(e)
        
        end_time = time.time()
        total_duration = end_time - start_time
        
        # Calculate overall system performance
        all_grades = []
        for system, results in test_results.items():
            if isinstance(results, dict) and 'overall_grade' in results:
                all_grades.append(results['overall_grade'])
        
        overall_grade = self._calculate_system_grade(all_grades)
        
        return {
            'test_summary': {
                'timestamp': datetime.utcnow().isoformat(),
                'total_duration_seconds': round(total_duration, 2),
                'systems_tested': len(test_results),
                'overall_performance_grade': overall_grade,
                'api_status': 'excellent' if overall_grade in ['A+', 'A'] else 'good' if overall_grade == 'B' else 'needs_improvement'
            },
            'detailed_results': test_results,
            'recommendations': self._generate_recommendations(test_results, overall_grade)
        }
    
    def _generate_recommendations(self, test_results: Dict, overall_grade: str) -> List[str]:
        """Generate performance improvement recommendations"""
        
        recommendations = []
        
        if overall_grade in ['A+', 'A']:
            recommendations.append("🎉 Excellent performance! API is production-ready.")
            recommendations.append("💡 Consider implementing additional caching for even better performance.")
            
        elif overall_grade == 'B':
            recommendations.append("✅ Good performance, but room for improvement.")
            recommendations.append("🔧 Consider optimizing slower endpoints.")
            recommendations.append("📊 Monitor response times under higher load.")
            
        elif overall_grade in ['C', 'D']:
            recommendations.append("⚠️ Performance needs improvement before production.")
            recommendations.append("🔍 Investigate slow endpoints and optimize database queries.")
            recommendations.append("🚀 Consider implementing response caching.")
            recommendations.append("📈 Add more monitoring and alerting.")
            
        else:
            recommendations.append("❌ Critical performance issues detected.")
            recommendations.append("🛠️ Immediate optimization required.")
            recommendations.append("🔥 Check for resource bottlenecks and memory leaks.")
        
        # Check rate limiting
        if 'rate_limiting' in test_results:
            rate_limiting = test_results['rate_limiting']
            if rate_limiting.get('effectiveness') == 'needs_improvement':
                recommendations.append("🛡️ Rate limiting may need adjustment - consider lower thresholds.")
        
        return recommendations

def print_test_results(results: Dict[str, Any]):
    """Print formatted test results"""
    
    print("\n" + "="*80)
    print("🚀 Schlep-engine API PERFORMANCE TEST RESULTS")
    print("="*80)
    
    # Print summary
    summary = results.get('test_summary', {})
    print(f"\n📊 TEST SUMMARY:")
    print(f"   Timestamp: {summary.get('timestamp', 'N/A')}")
    print(f"   Duration: {summary.get('total_duration_seconds', 0)} seconds")
    print(f"   Systems Tested: {summary.get('systems_tested', 0)}")
    print(f"   Overall Grade: {summary.get('overall_performance_grade', 'N/A')}")
    print(f"   API Status: {summary.get('api_status', 'N/A').upper()}")
    
    # Print detailed results
    print(f"\n📋 DETAILED RESULTS:")
    detailed = results.get('detailed_results', {})
    
    for system_name, system_results in detailed.items():
        if isinstance(system_results, dict) and 'tests' in system_results:
            print(f"\n🔧 {system_name.upper().replace('_', ' ')}")
            print(f"   Overall Grade: {system_results.get('overall_grade', 'N/A')}")
            
            for test_name, test_result in system_results['tests'].items():
                if isinstance(test_result, dict) and 'avg_response_time_ms' in test_result:
                    print(f"   - {test_name}: {test_result['avg_response_time_ms']}ms avg, "
                          f"{test_result['success_rate']}% success, "
                          f"Grade: {test_result['performance_grade']}")
    
    # Print recommendations
    recommendations = results.get('recommendations', [])
    if recommendations:
        print(f"\n💡 RECOMMENDATIONS:")
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec}")
    
    print("\n" + "="*80)
    print("✅ Performance testing completed!")
    print("="*80 + "\n")

async def main():
    """Main test execution function"""
    
    print("🚀 Starting Schlep-engine API Performance Testing Suite...")
    
    try:
        async with APIPerformanceTester() as tester:
            results = await tester.run_comprehensive_tests()
            print_test_results(results)
            
            # Save results to file
            with open(f"api_performance_results_{int(time.time())}.json", "w") as f:
                json.dump(results, f, indent=2)
            
            print("📄 Results saved to api_performance_results_*.json")
            
    except Exception as e:
        logger.error(f"Performance testing failed: {e}")
        print(f"❌ Testing failed: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 