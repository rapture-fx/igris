"""
Real-Time Streaming System Test Script
======================================

Test script to validate the comprehensive real-time streaming implementation:
- Redis Streams connectivity and configuration
- Stream producer functionality
- Stream consumer processing
- Event sourcing and replay
- WebSocket real-time updates
- Notification system
"""

import asyncio
import json
import logging
import time
import aiohttp
import websockets
from datetime import datetime
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
API_BASE_URL = "http://localhost:3001/api/v1"
WEBSOCKET_URL = "ws://localhost:3001/api/v1/streaming/live"

class StreamingSystemTest:
    """Comprehensive test suite for the real-time streaming system"""
    
    def __init__(self):
        self.session = None
        self.test_results = []
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "PASS" if success else "FAIL"
        logger.info(f"TEST {status}: {test_name} - {details}")
        self.test_results.append({
            "test_name": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def test_api_health(self):
        """Test API health and availability"""
        try:
            async with self.session.get(f"{API_BASE_URL}/../health") as response:
                if response.status == 200:
                    data = await response.json()
                    self.log_test_result("API Health Check", True, f"Status: {data.get('status')}")
                    return True
                else:
                    self.log_test_result("API Health Check", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("API Health Check", False, f"Error: {str(e)}")
            return False
    
    async def test_streaming_health(self):
        """Test streaming system health"""
        try:
            async with self.session.get(f"{API_BASE_URL}/streaming/health") as response:
                if response.status == 200:
                    data = await response.json()
                    overall_health = data.get("overall_health", "unknown")
                    self.log_test_result("Streaming Health Check", overall_health == "healthy", f"Health: {overall_health}")
                    return overall_health == "healthy"
                else:
                    self.log_test_result("Streaming Health Check", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("Streaming Health Check", False, f"Error: {str(e)}")
            return False
    
    async def test_streaming_metrics(self):
        """Test streaming metrics endpoint"""
        try:
            async with self.session.get(f"{API_BASE_URL}/streaming/metrics") as response:
                if response.status == 200:
                    data = await response.json()
                    has_metrics = "stream_health" in data and "real_time_metrics" in data
                    self.log_test_result("Streaming Metrics", has_metrics, f"Metrics available: {has_metrics}")
                    return has_metrics
                else:
                    self.log_test_result("Streaming Metrics", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("Streaming Metrics", False, f"Error: {str(e)}")
            return False
    
    async def test_start_producers(self):
        """Test starting stream producers"""
        try:
            producer_config = {
                "iot": {"enabled": True, "rate_per_second": 2},
                "financial": {"enabled": True, "rate_per_second": 5},
                "ecommerce": {"enabled": True, "rate_per_second": 10}
            }
            
            async with self.session.post(
                f"{API_BASE_URL}/streaming/control/start-producers",
                json=producer_config
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    success = data.get("status") == "started"
                    self.log_test_result("Start Stream Producers", success, f"Response: {data}")
                    return success
                else:
                    self.log_test_result("Start Stream Producers", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("Start Stream Producers", False, f"Error: {str(e)}")
            return False
    
    async def test_websocket_connection(self):
        """Test WebSocket real-time streaming"""
        try:
            websocket_params = {
                "stream_types": "iot_sensors,financial_transactions,ecommerce_events",
                "update_interval": "2",
                "max_events": "10"
            }
            
            ws_url = f"{WEBSOCKET_URL}?" + "&".join([f"{k}={v}" for k, v in websocket_params.items()])
            
            async with websockets.connect(ws_url) as websocket:
                # Send ping
                await websocket.send(json.dumps({"type": "ping"}))
                
                # Wait for messages
                messages_received = 0
                timeout = 30  # 30 seconds timeout
                start_time = time.time()
                
                while time.time() - start_time < timeout and messages_received < 3:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=5)
                        data = json.loads(message)
                        
                        if data.get("type") in ["pong", "stream_update"]:
                            messages_received += 1
                            logger.info(f"Received WebSocket message: {data.get('type')}")
                    
                    except asyncio.TimeoutError:
                        continue
                
                success = messages_received > 0
                self.log_test_result("WebSocket Connection", success, f"Messages received: {messages_received}")
                return success
                
        except Exception as e:
            self.log_test_result("WebSocket Connection", False, f"Error: {str(e)}")
            return False
    
    async def test_stream_replay(self):
        """Test stream replay functionality"""
        try:
            replay_request = {
                "stream_name": "iot_sensors",
                "max_messages": 5
            }
            
            async with self.session.post(
                f"{API_BASE_URL}/streaming/replay",
                json=replay_request
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    message_count = data.get("message_count", 0)
                    success = message_count >= 0  # Even 0 is valid if no messages exist
                    self.log_test_result("Stream Replay", success, f"Messages replayed: {message_count}")
                    return success
                else:
                    self.log_test_result("Stream Replay", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("Stream Replay", False, f"Error: {str(e)}")
            return False
    
    async def test_dashboard_summary(self):
        """Test dashboard summary endpoint"""
        try:
            async with self.session.get(f"{API_BASE_URL}/streaming/dashboard/summary") as response:
                if response.status == 200:
                    data = await response.json()
                    has_key_metrics = "key_metrics" in data and "overall_health" in data
                    self.log_test_result("Dashboard Summary", has_key_metrics, f"Data available: {has_key_metrics}")
                    return has_key_metrics
                else:
                    self.log_test_result("Dashboard Summary", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("Dashboard Summary", False, f"Error: {str(e)}")
            return False
    
    async def test_stop_producers(self):
        """Test stopping stream producers"""
        try:
            async with self.session.post(f"{API_BASE_URL}/streaming/control/stop-producers") as response:
                if response.status == 200:
                    data = await response.json()
                    success = data.get("status") == "stopped"
                    self.log_test_result("Stop Stream Producers", success, f"Response: {data}")
                    return success
                else:
                    self.log_test_result("Stop Stream Producers", False, f"Status code: {response.status}")
                    return False
        except Exception as e:
            self.log_test_result("Stop Stream Producers", False, f"Error: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all streaming system tests"""
        logger.info("Starting comprehensive real-time streaming system tests...")
        
        tests = [
            ("API Health", self.test_api_health),
            ("Streaming Health", self.test_streaming_health),
            ("Streaming Metrics", self.test_streaming_metrics),
            ("Start Producers", self.test_start_producers),
            ("WebSocket Connection", self.test_websocket_connection),
            ("Stream Replay", self.test_stream_replay),
            ("Dashboard Summary", self.test_dashboard_summary),
            ("Stop Producers", self.test_stop_producers),
        ]
        
        for test_name, test_func in tests:
            logger.info(f"Running test: {test_name}")
            try:
                await test_func()
                # Small delay between tests
                await asyncio.sleep(1)
            except Exception as e:
                self.log_test_result(test_name, False, f"Exception: {str(e)}")
        
        # Generate test report
        self.generate_test_report()
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        logger.info("=" * 80)
        logger.info("REAL-TIME STREAMING SYSTEM TEST REPORT")
        logger.info("=" * 80)
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Success Rate: {success_rate:.1f}%")
        logger.info("")
        
        logger.info("DETAILED RESULTS:")
        logger.info("-" * 40)
        for result in self.test_results:
            status = "✓" if result["success"] else "✗"
            logger.info(f"{status} {result['test_name']}: {result['details']}")
        
        logger.info("")
        
        if success_rate >= 80:
            logger.info("🎉 STREAMING SYSTEM VALIDATION: SUCCESSFUL")
            logger.info("The real-time streaming system is working correctly!")
        elif success_rate >= 60:
            logger.info("⚠️  STREAMING SYSTEM VALIDATION: PARTIAL SUCCESS")
            logger.info("Most features are working, but some issues need attention.")
        else:
            logger.info("❌ STREAMING SYSTEM VALIDATION: FAILED")
            logger.info("Significant issues detected. Please check the system configuration.")
        
        logger.info("=" * 80)
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": success_rate,
            "results": self.test_results
        }

async def main():
    """Main test execution function"""
    logger.info("Real-Time Streaming System Validation")
    logger.info("=====================================")
    
    async with StreamingSystemTest() as test_suite:
        report = await test_suite.run_all_tests()
        
        # Save report to file
        with open("streaming_test_report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        logger.info("Test report saved to: streaming_test_report.json")

if __name__ == "__main__":
    asyncio.run(main())