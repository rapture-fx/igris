#!/usr/bin/env python3
"""
Integration Test Script for Immediate Improvements

This script tests the newly integrated systems:
1. Unified Auth System Integration
2. Centralized Error Handler
3. System Monitoring Dashboard
4. Frontend-Backend Connectivity

Run this to verify all improvements are working correctly.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, List

class IntegrationTester:
    """Comprehensive integration testing for the improved system"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.test_results = []
        self.auth_token = None
    
    def log_test(self, test_name: str, success: bool, details: str = "", response_time: float = 0):
        """Log test results"""
        status = " PASS" if success else " FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "response_time_ms": round(response_time * 1000, 2)
        }
        self.test_results.append(result)
        print(f"{status} {test_name} ({result['response_time_ms']}ms)")
        if details:
            print(f"    {details}")
    
    def test_server_health(self) -> bool:
        """Test basic server health"""
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/health", timeout=5)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    "Server Health Check",
                    True,
                    f"Server healthy: {data.get('service', 'Unknown')}",
                    duration
                )
                return True
            else:
                self.log_test(
                    "Server Health Check",
                    False,
                    f"Status: {response.status_code}",
                    duration
                )
                return False
                
        except Exception as e:
            self.log_test("Server Health Check", False, f"Error: {str(e)}")
            return False
    
    def test_unified_auth_endpoints(self) -> bool:
        """Test the newly integrated unified auth endpoints"""
        success_count = 0
        total_tests = 3
        
        # Test 1: Auth status endpoint
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/api/v1/auth/status", timeout=5)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    "Unified Auth Status",
                    True,
                    f"Status: {data.get('status', 'unknown')}",
                    duration
                )
                success_count += 1
            else:
                self.log_test(
                    "Unified Auth Status",
                    False,
                    f"Status: {response.status_code}",
                    duration
                )
        except Exception as e:
            self.log_test("Unified Auth Status", False, f"Error: {str(e)}")
        
        # Test 2: Login endpoint (should exist)
        try:
            start_time = time.time()
            response = requests.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": "test", "password": "invalid"},
                timeout=5
            )
            duration = time.time() - start_time
            
            # We expect this to fail with 401, but endpoint should exist
            if response.status_code in [401, 422]:  # 422 for validation error
                self.log_test(
                    "Unified Auth Login Endpoint",
                    True,
                    f"Endpoint accessible (expected auth failure)",
                    duration
                )
                success_count += 1
            else:
                self.log_test(
                    "Unified Auth Login Endpoint",
                    False,
                    f"Unexpected status: {response.status_code}",
                    duration
                )
        except Exception as e:
            self.log_test("Unified Auth Login Endpoint", False, f"Error: {str(e)}")
        
        # Test 3: Legacy routes should still work
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/api/v1/auth/legacy/status", timeout=5)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                self.log_test(
                    "Legacy Auth Backward Compatibility",
                    True,
                    "Legacy routes accessible",
                    duration
                )
                success_count += 1
            else:
                self.log_test(
                    "Legacy Auth Backward Compatibility",
                    False,
                    f"Status: {response.status_code}",
                    duration
                )
        except Exception as e:
            self.log_test("Legacy Auth Backward Compatibility", False, f"Error: {str(e)}")
        
        return success_count == total_tests
    
    def test_error_handling(self) -> bool:
        """Test centralized error handling"""
        try:
            start_time = time.time()
            # Trigger an error by accessing a non-existent endpoint
            response = requests.get(f"{self.base_url}/api/v1/nonexistent", timeout=5)
            duration = time.time() - start_time
            
            if response.status_code == 404:
                try:
                    data = response.json()
                    # Check if it has the new error structure
                    if "error" in data and "id" in data["error"]:
                        self.log_test(
                            "Centralized Error Handling",
                            True,
                            f"New error format detected: {data['error']['id']}",
                            duration
                        )
                        return True
                    else:
                        self.log_test(
                            "Centralized Error Handling",
                            False,
                            "Old error format still in use",
                            duration
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_test(
                        "Centralized Error Handling",
                        False,
                        "Non-JSON error response",
                        duration
                    )
                    return False
            else:
                self.log_test(
                    "Centralized Error Handling",
                    False,
                    f"Unexpected status: {response.status_code}",
                    duration
                )
                return False
                
        except Exception as e:
            self.log_test("Centralized Error Handling", False, f"Error: {str(e)}")
            return False
    
    def test_monitoring_dashboard(self) -> bool:
        """Test system monitoring endpoints"""
        # Note: These would normally require admin auth, but we'll test accessibility
        success_count = 0
        total_tests = 2
        
        # Test 1: System health endpoint
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/api/v1/admin/monitoring/system-health", timeout=5)
            duration = time.time() - start_time
            
            # We expect 401/403 (auth required) but endpoint should exist
            if response.status_code in [401, 403]:
                self.log_test(
                    "Monitoring System Health Endpoint",
                    True,
                    "Endpoint accessible (requires auth)",
                    duration
                )
                success_count += 1
            elif response.status_code == 200:
                self.log_test(
                    "Monitoring System Health Endpoint",
                    True,
                    "Endpoint accessible and working",
                    duration
                )
                success_count += 1
            else:
                self.log_test(
                    "Monitoring System Health Endpoint",
                    False,
                    f"Status: {response.status_code}",
                    duration
                )
        except Exception as e:
            self.log_test("Monitoring System Health Endpoint", False, f"Error: {str(e)}")
        
        # Test 2: Auth status endpoint
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/api/v1/admin/monitoring/auth-status", timeout=5)
            duration = time.time() - start_time
            
            if response.status_code in [401, 403, 200]:
                self.log_test(
                    "Monitoring Auth Status Endpoint",
                    True,
                    f"Endpoint accessible (status: {response.status_code})",
                    duration
                )
                success_count += 1
            else:
                self.log_test(
                    "Monitoring Auth Status Endpoint",
                    False,
                    f"Status: {response.status_code}",
                    duration
                )
        except Exception as e:
            self.log_test("Monitoring Auth Status Endpoint", False, f"Error: {str(e)}")
        
        return success_count == total_tests
    
    def test_api_documentation(self) -> bool:
        """Test that API documentation is accessible"""
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/docs", timeout=5)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                self.log_test(
                    "API Documentation",
                    True,
                    "Swagger UI accessible",
                    duration
                )
                return True
            else:
                self.log_test(
                    "API Documentation",
                    False,
                    f"Status: {response.status_code}",
                    duration
                )
                return False
                
        except Exception as e:
            self.log_test("API Documentation", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all integration tests"""
        print(" Starting Integration Tests for Immediate Improvements")
        print("=" * 60)
        
        # Run tests
        tests = [
            ("Server Connectivity", self.test_server_health),
            ("Unified Auth Integration", self.test_unified_auth_endpoints),
            ("Error Handling", self.test_error_handling),
            ("Monitoring Dashboard", self.test_monitoring_dashboard),
            ("API Documentation", self.test_api_documentation),
        ]
        
        passed = 0
        for test_category, test_func in tests:
            print(f"\n Testing {test_category}:")
            if test_func():
                passed += 1
        
        # Summary
        print("\n" + "=" * 60)
        print(" TEST SUMMARY")
        print("=" * 60)
        
        total_individual_tests = len(self.test_results)
        passed_individual = sum(1 for result in self.test_results if result["success"])
        
        print(f"Categories Passed: {passed}/{len(tests)}")
        print(f"Individual Tests: {passed_individual}/{total_individual_tests}")
        print(f"Success Rate: {(passed_individual/total_individual_tests)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print(f"\n Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print("\n All tests passed!")
        
        return {
            "total_categories": len(tests),
            "passed_categories": passed,
            "total_tests": total_individual_tests,
            "passed_tests": passed_individual,
            "success_rate": (passed_individual/total_individual_tests)*100,
            "all_passed": passed == len(tests),
            "results": self.test_results
        }

def main():
    """Main entry point"""
    print(" Integration Testing for Schlep-engine Immediate Improvements")
    print("Testing unified auth, error handling, and monitoring systems...")
    print()
    
    # Check if server URL is provided
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    
    tester = IntegrationTester(base_url)
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if results["all_passed"] else 1)

if __name__ == "__main__":
    main() 