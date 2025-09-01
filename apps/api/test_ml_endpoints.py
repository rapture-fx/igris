#!/usr/bin/env python3
"""
ML/RL Endpoints Integration Test

Tests the ML/RL API endpoints to ensure they're functional and properly integrated.
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import Dict, Any
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MLEndpointsTest:
    """Test ML/RL API endpoints."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.auth_token = None
        self.test_results = {}
    
    async def run_endpoint_tests(self) -> Dict[str, Any]:
        """Run all endpoint tests."""
        logger.info("Starting ML/RL endpoints integration test")
        start_time = datetime.now()
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            
            try:
                # Test basic health endpoints
                await self._test_health_endpoints()
                
                # Test authentication if available
                await self._test_authentication()
                
                # Test ML endpoints
                await self._test_ml_endpoints()
                
                # Test RL endpoints
                await self._test_rl_endpoints()
                
                # Test data processing endpoints
                await self._test_data_endpoints()
                
            except Exception as e:
                logger.error(f"Endpoint testing failed: {str(e)}")
                self.test_results["critical_error"] = str(e)
        
        test_time = (datetime.now() - start_time).total_seconds()
        
        return self._generate_test_report(test_time)
    
    async def _test_health_endpoints(self):
        """Test health check endpoints."""
        logger.info("Testing health endpoints")
        
        endpoints = [
            "/health",
            "/api/v1/health",
            "/api/v1/health/simple",
            "/api/v1/system/status"
        ]
        
        health_results = {}
        
        for endpoint in endpoints:
            try:
                async with self.session.get(f"{self.base_url}{endpoint}") as response:
                    status_code = response.status
                    content = await response.text()
                    
                    health_results[endpoint] = {
                        "status_code": status_code,
                        "accessible": status_code < 500,
                        "response_size": len(content)
                    }
                    
                    if status_code == 200:
                        logger.info(f"✓ {endpoint} - OK")
                    else:
                        logger.warning(f"⚠ {endpoint} - Status {status_code}")
                        
            except Exception as e:
                health_results[endpoint] = {
                    "status_code": None,
                    "accessible": False,
                    "error": str(e)
                }
                logger.error(f"✗ {endpoint} - {str(e)}")
        
        self.test_results["health_endpoints"] = health_results
    
    async def _test_authentication(self):
        """Test authentication endpoints."""
        logger.info("Testing authentication")
        
        auth_results = {}
        
        # Test auth status endpoint
        try:
            async with self.session.get(f"{self.base_url}/api/v1/auth/status") as response:
                auth_results["auth_status"] = {
                    "status_code": response.status,
                    "accessible": response.status < 500
                }
        except Exception as e:
            auth_results["auth_status"] = {"error": str(e)}
        
        # Try to get a test token (this may fail if auth is required)
        try:
            test_credentials = {
                "username": "test_user",
                "password": "test_password"
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/auth/token",
                json=test_credentials
            ) as response:
                if response.status == 200:
                    token_data = await response.json()
                    self.auth_token = token_data.get("access_token")
                    auth_results["token_generation"] = {"success": True}
                else:
                    auth_results["token_generation"] = {
                        "success": False,
                        "status_code": response.status
                    }
        except Exception as e:
            auth_results["token_generation"] = {"error": str(e)}
        
        self.test_results["authentication"] = auth_results
    
    async def _test_ml_endpoints(self):
        """Test ML-related endpoints."""
        logger.info("Testing ML endpoints")
        
        ml_results = {}
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        # Test ML model endpoints
        ml_endpoints = [
            "/api/v1/ml/models",
            "/api/v1/ml/models/training",
            "/api/v1/ml/pipelines",
            "/api/v1/ml/predictions"
        ]
        
        for endpoint in ml_endpoints:
            try:
                async with self.session.get(
                    f"{self.base_url}{endpoint}",
                    headers=headers
                ) as response:
                    ml_results[endpoint] = {
                        "status_code": response.status,
                        "accessible": response.status < 500,
                        "requires_auth": response.status == 401
                    }
                    
                    if response.status == 200:
                        logger.info(f"✓ {endpoint} - OK")
                    elif response.status == 401:
                        logger.info(f"🔒 {endpoint} - Requires authentication")
                    else:
                        logger.warning(f"⚠ {endpoint} - Status {response.status}")
                        
            except Exception as e:
                ml_results[endpoint] = {"error": str(e)}
                logger.error(f"✗ {endpoint} - {str(e)}")
        
        self.test_results["ml_endpoints"] = ml_results
    
    async def _test_rl_endpoints(self):
        """Test RL optimization endpoints."""
        logger.info("Testing RL endpoints")
        
        rl_results = {}
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        # Test RL optimization endpoints
        rl_endpoints = [
            "/api/v1/rl/optimization",
            "/api/v1/rl/optimization/sessions",
            "/api/v1/rl/models",
            "/api/v1/rl/hyperparameter-optimization"
        ]
        
        for endpoint in rl_endpoints:
            try:
                async with self.session.get(
                    f"{self.base_url}{endpoint}",
                    headers=headers
                ) as response:
                    rl_results[endpoint] = {
                        "status_code": response.status,
                        "accessible": response.status < 500,
                        "requires_auth": response.status == 401
                    }
                    
                    if response.status == 200:
                        logger.info(f"✓ {endpoint} - OK")
                    elif response.status == 401:
                        logger.info(f"🔒 {endpoint} - Requires authentication")
                    else:
                        logger.warning(f"⚠ {endpoint} - Status {response.status}")
                        
            except Exception as e:
                rl_results[endpoint] = {"error": str(e)}
                logger.error(f"✗ {endpoint} - {str(e)}")
        
        # Test RL optimization workflow if endpoints are accessible
        await self._test_rl_optimization_workflow(headers)
        
        self.test_results["rl_endpoints"] = rl_results
    
    async def _test_rl_optimization_workflow(self, headers: Dict[str, str]):
        """Test complete RL optimization workflow."""
        logger.info("Testing RL optimization workflow")
        
        workflow_results = {}
        
        try:
            # Test starting an optimization session
            optimization_data = {
                "pipeline_id": "test_pipeline",
                "optimization_type": "ppo",
                "config": {
                    "max_episodes": 5,
                    "early_stopping_patience": 2
                }
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/rl/optimization/start",
                json=optimization_data,
                headers=headers
            ) as response:
                if response.status in [200, 201]:
                    session_data = await response.json()
                    session_id = session_data.get("session_id")
                    
                    workflow_results["start_optimization"] = {
                        "success": True,
                        "session_id": session_id
                    }
                    
                    # Test getting session status
                    if session_id:
                        async with self.session.get(
                            f"{self.base_url}/api/v1/rl/optimization/sessions/{session_id}",
                            headers=headers
                        ) as status_response:
                            workflow_results["get_status"] = {
                                "success": status_response.status == 200,
                                "status_code": status_response.status
                            }
                    
                else:
                    workflow_results["start_optimization"] = {
                        "success": False,
                        "status_code": response.status,
                        "error": await response.text()
                    }
                    
        except Exception as e:
            workflow_results["workflow_error"] = str(e)
        
        self.test_results["rl_workflow"] = workflow_results
    
    async def _test_data_endpoints(self):
        """Test data processing endpoints."""
        logger.info("Testing data processing endpoints")
        
        data_results = {}
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        # Test data processing endpoints
        data_endpoints = [
            "/api/v1/data/upload",
            "/api/v1/data/process",
            "/api/v1/data/quality",
            "/api/v1/data/features"
        ]
        
        for endpoint in data_endpoints:
            try:
                async with self.session.get(
                    f"{self.base_url}{endpoint}",
                    headers=headers
                ) as response:
                    data_results[endpoint] = {
                        "status_code": response.status,
                        "accessible": response.status < 500,
                        "requires_auth": response.status == 401
                    }
                    
                    if response.status == 200:
                        logger.info(f"✓ {endpoint} - OK")
                    elif response.status == 401:
                        logger.info(f"🔒 {endpoint} - Requires authentication")
                    else:
                        logger.warning(f"⚠ {endpoint} - Status {response.status}")
                        
            except Exception as e:
                data_results[endpoint] = {"error": str(e)}
                logger.error(f"✗ {endpoint} - {str(e)}")
        
        self.test_results["data_endpoints"] = data_results
    
    def _generate_test_report(self, test_time: float) -> Dict[str, Any]:
        """Generate comprehensive test report."""
        # Calculate statistics
        total_endpoints = 0
        accessible_endpoints = 0
        successful_endpoints = 0
        
        for category, results in self.test_results.items():
            if isinstance(results, dict) and "error" not in category:
                for endpoint, result in results.items():
                    if isinstance(result, dict) and "status_code" in result:
                        total_endpoints += 1
                        if result.get("accessible", False):
                            accessible_endpoints += 1
                        if result.get("status_code") == 200:
                            successful_endpoints += 1
        
        accessibility_rate = accessible_endpoints / total_endpoints if total_endpoints > 0 else 0
        success_rate = successful_endpoints / total_endpoints if total_endpoints > 0 else 0
        
        # Determine overall status
        if success_rate > 0.8:
            overall_status = "EXCELLENT"
        elif success_rate > 0.6:
            overall_status = "GOOD"
        elif accessibility_rate > 0.8:
            overall_status = "ACCESSIBLE"
        else:
            overall_status = "NEEDS_ATTENTION"
        
        report = {
            "test_summary": {
                "timestamp": datetime.now().isoformat(),
                "test_time_seconds": test_time,
                "base_url": self.base_url,
                "total_endpoints": total_endpoints,
                "accessible_endpoints": accessible_endpoints,
                "successful_endpoints": successful_endpoints,
                "accessibility_rate": accessibility_rate,
                "success_rate": success_rate,
                "overall_status": overall_status
            },
            "detailed_results": self.test_results,
            "recommendations": self._generate_endpoint_recommendations()
        }
        
        return report
    
    def _generate_endpoint_recommendations(self) -> list:
        """Generate recommendations based on test results."""
        recommendations = []
        
        # Check if server is running
        health_results = self.test_results.get("health_endpoints", {})
        if not any(result.get("accessible", False) for result in health_results.values()):
            recommendations.append("Server may not be running - no health endpoints accessible")
            return recommendations
        
        # Check authentication
        auth_results = self.test_results.get("authentication", {})
        if auth_results.get("token_generation", {}).get("success"):
            recommendations.append("Authentication working properly")
        elif any(result.get("requires_auth") for category in self.test_results.values() 
                if isinstance(category, dict) for result in category.values() 
                if isinstance(result, dict)):
            recommendations.append("Some endpoints require authentication - ensure proper auth flow")
        
        # Check ML endpoints
        ml_results = self.test_results.get("ml_endpoints", {})
        ml_accessible = sum(1 for result in ml_results.values() 
                          if isinstance(result, dict) and result.get("accessible", False))
        if ml_accessible == 0 and ml_results:
            recommendations.append("ML endpoints not accessible - check ML service integration")
        
        # Check RL endpoints
        rl_results = self.test_results.get("rl_endpoints", {})
        rl_accessible = sum(1 for result in rl_results.values() 
                          if isinstance(result, dict) and result.get("accessible", False))
        if rl_accessible == 0 and rl_results:
            recommendations.append("RL endpoints not accessible - check RL service integration")
        
        # Check workflow
        workflow_results = self.test_results.get("rl_workflow", {})
        if workflow_results.get("start_optimization", {}).get("success"):
            recommendations.append("RL optimization workflow functional")
        elif "workflow_error" not in workflow_results:
            recommendations.append("RL optimization workflow may need authentication or configuration")
        
        if not recommendations:
            recommendations.append("All tested endpoints show expected behavior")
        
        return recommendations


async def main():
    """Main execution function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test ML/RL API endpoints")
    parser.add_argument("--url", default="http://localhost:8000", 
                       help="Base URL for the API (default: http://localhost:8000)")
    parser.add_argument("--output", help="Output file for detailed results (JSON)")
    
    args = parser.parse_args()
    
    tester = MLEndpointsTest(base_url=args.url)
    
    try:
        report = await tester.run_endpoint_tests()
        
        # Print summary
        print("\n" + "="*60)
        print("ML/RL ENDPOINTS TEST REPORT")
        print("="*60)
        
        summary = report["test_summary"]
        print(f"Base URL: {summary['base_url']}")
        print(f"Overall Status: {summary['overall_status']}")
        print(f"Test Time: {summary['test_time_seconds']:.2f} seconds")
        print(f"Total Endpoints: {summary['total_endpoints']}")
        print(f"Accessible: {summary['accessible_endpoints']} ({summary['accessibility_rate']:.1%})")
        print(f"Successful: {summary['successful_endpoints']} ({summary['success_rate']:.1%})")
        
        print(f"\nCategory Results:")
        for category, results in report["detailed_results"].items():
            if isinstance(results, dict) and category != "critical_error":
                accessible = sum(1 for r in results.values() 
                               if isinstance(r, dict) and r.get("accessible", False))
                total = len([r for r in results.values() if isinstance(r, dict) and "status_code" in r])
                if total > 0:
                    print(f"  {category}: {accessible}/{total} accessible")
        
        print(f"\nRecommendations:")
        for rec in report["recommendations"]:
            print(f"  - {rec}")
        
        # Save detailed report if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            print(f"\nDetailed report saved to: {args.output}")
        
        # Return exit code based on results
        if summary['overall_status'] in ['EXCELLENT', 'GOOD']:
            return 0
        elif summary['overall_status'] == 'ACCESSIBLE':
            return 1  # Accessible but not fully functional
        else:
            return 2  # Needs attention
            
    except Exception as e:
        print(f"Endpoint testing failed: {str(e)}")
        return 3


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)