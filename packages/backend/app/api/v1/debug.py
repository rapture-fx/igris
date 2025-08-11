"""
Debug & Testing Endpoints
========================

Developer-friendly endpoints for testing and debugging:
- Error simulation for testing error handling
- Performance testing utilities
- Request/response inspection
- Circuit breaker testing
- Rate limiting simulation
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import time
import random
import asyncio
import logging

from app.database.connection import get_db
from app.core.api_reliability import get_circuit_breaker, CircuitBreakerConfig
from app.core.metrics import metrics_collector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/debug", tags=["Debug & Testing"])

@router.get("/simulate-errors")
async def simulate_errors(
    error_type: str = Query("random", description="Type of error to simulate"),
    delay: float = Query(0.0, description="Delay in seconds before response"),
    probability: float = Query(0.5, description="Probability of error (0.0-1.0)")
) -> Dict[str, Any]:
    """
    Simulate various error conditions for testing
    
    **Error Types:**
    - `timeout` - Simulate request timeout
    - `rate_limit` - Simulate rate limiting
    - `server_error` - Simulate 5xx server errors
    - `client_error` - Simulate 4xx client errors
    - `network_error` - Simulate network connectivity issues
    - `random` - Random error type
    
    **Use Cases:**
    - Test error handling in your application
    - Verify retry logic works correctly
    - Test circuit breaker behavior
    - Validate error response formats
    """
    
    # Add delay if specified
    if delay > 0:
        await asyncio.sleep(delay)
    
    # Determine if we should return an error
    if random.random() < probability:
        error_types = {
            "timeout": {
                "status_code": 504,
                "detail": "Request timeout - service took too long to respond",
                "error_code": "TIMEOUT_ERROR"
            },
            "rate_limit": {
                "status_code": 429,
                "detail": "Rate limit exceeded - too many requests",
                "error_code": "RATE_LIMIT_EXCEEDED"
            },
            "server_error": {
                "status_code": 500,
                "detail": "Internal server error - something went wrong",
                "error_code": "INTERNAL_SERVER_ERROR"
            },
            "client_error": {
                "status_code": 400,
                "detail": "Bad request - invalid parameters",
                "error_code": "BAD_REQUEST"
            },
            "network_error": {
                "status_code": 503,
                "detail": "Service unavailable - network connectivity issue",
                "error_code": "NETWORK_ERROR"
            }
        }
        
        if error_type == "random":
            error_type = random.choice(list(error_types.keys()))
        
        error_info = error_types.get(error_type, error_types["server_error"])
        
        raise HTTPException(
            status_code=error_info["status_code"],
            detail={
                "message": error_info["detail"],
                "error_code": error_info["error_code"],
                "simulated": True,
                "timestamp": datetime.utcnow().isoformat(),
                "request_id": f"debug_{int(time.time())}"
            }
        )
    
    return {
        "message": "Success - no error simulated",
        "timestamp": datetime.utcnow().isoformat(),
        "simulated": False
    }

@router.get("/performance-test")
async def performance_test(
    duration: int = Query(10, description="Test duration in seconds"),
    requests_per_second: int = Query(10, description="Requests per second to simulate")
) -> Dict[str, Any]:
    """
    Performance testing endpoint
    
    Simulates load testing to verify API performance under stress.
    Returns performance metrics and recommendations.
    """
    
    start_time = time.time()
    results = {
        "total_requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "response_times": [],
        "errors": []
    }
    
    # Simulate load
    while time.time() - start_time < duration:
        request_start = time.time()
        
        try:
            # Simulate a simple operation
            await asyncio.sleep(0.01)  # Simulate processing time
            
            response_time = (time.time() - request_start) * 1000
            results["response_times"].append(response_time)
            results["successful_requests"] += 1
            
        except Exception as e:
            results["failed_requests"] += 1
            results["errors"].append(str(e))
        
        results["total_requests"] += 1
        
        # Control request rate
        await asyncio.sleep(1.0 / requests_per_second)
    
    # Calculate metrics
    if results["response_times"]:
        results["avg_response_time_ms"] = sum(results["response_times"]) / len(results["response_times"])
        results["min_response_time_ms"] = min(results["response_times"])
        results["max_response_time_ms"] = max(results["response_times"])
        results["p95_response_time_ms"] = sorted(results["response_times"])[int(len(results["response_times"]) * 0.95)]
    else:
        results["avg_response_time_ms"] = 0
        results["min_response_time_ms"] = 0
        results["max_response_time_ms"] = 0
        results["p95_response_time_ms"] = 0
    
    results["success_rate_percent"] = (results["successful_requests"] / results["total_requests"]) * 100 if results["total_requests"] > 0 else 0
    results["actual_rps"] = results["total_requests"] / duration
    
    return {
        "test_configuration": {
            "duration_seconds": duration,
            "target_rps": requests_per_second
        },
        "results": results,
        "recommendations": _generate_performance_recommendations(results),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/circuit-breaker-test")
async def circuit_breaker_test(
    circuit_name: str = Query("test_circuit", description="Name of circuit breaker to test"),
    failure_rate: float = Query(0.8, description="Failure rate to simulate (0.0-1.0)")
) -> Dict[str, Any]:
    """
    Test circuit breaker behavior
    
    Simulates failures to test circuit breaker patterns and observe state transitions.
    """
    
    config = CircuitBreakerConfig(
        failure_threshold=3,
        recovery_timeout=30,
        expected_exception=Exception
    )
    
    circuit = get_circuit_breaker(circuit_name, config)
    
    results = {
        "circuit_name": circuit_name,
        "initial_state": circuit.state.value,
        "calls": [],
        "final_state": None
    }
    
    # Make several calls to test circuit breaker
    for i in range(10):
        call_start = time.time()
        
        try:
            if random.random() < failure_rate:
                # Simulate failure
                raise Exception(f"Simulated failure {i+1}")
            else:
                # Simulate success
                await asyncio.sleep(0.1)
                result = "success"
                
        except Exception as e:
            result = "failure"
            error = str(e)
        
        call_duration = (time.time() - call_start) * 1000
        
        results["calls"].append({
            "call_number": i + 1,
            "result": result,
            "duration_ms": round(call_duration, 2),
            "circuit_state": circuit.state.value,
            "error": error if result == "failure" else None
        })
    
    results["final_state"] = circuit.state.value
    
    return {
        "circuit_breaker_test": results,
        "analysis": _analyze_circuit_breaker_behavior(results),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/request-info")
async def get_request_info(request: Request) -> Dict[str, Any]:
    """
    Get detailed request information
    
    Returns comprehensive information about the current request for debugging purposes.
    """
    
    return {
        "request_info": {
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "headers": dict(request.headers),
            "client": {
                "host": request.client.host if request.client else None,
                "port": request.client.port if request.client else None
            },
            "timestamp": datetime.utcnow().isoformat()
        },
        "server_info": {
            "environment": getattr(settings, 'ENVIRONMENT', 'development'),
            "version": getattr(settings, 'APP_VERSION', '2.0.0'),
            "request_id": getattr(request.state, 'request_id', None)
        }
    }

@router.get("/metrics-snapshot")
async def get_metrics_snapshot() -> Dict[str, Any]:
    """
    Get current metrics snapshot
    
    Returns a snapshot of current application metrics for debugging and monitoring.
    """
    
    try:
        # Get cache metrics if available
        cache_metrics = {}
        try:
            from app.core.response_cache import enhanced_response_cache
            cache_metrics = await enhanced_response_cache.get_metrics()
        except:
            cache_metrics = {"error": "Cache metrics unavailable"}
        
        return {
            "metrics_snapshot": {
                "cache": cache_metrics,
                "circuit_breakers": {
                    name: {
                        "state": cb.state.value,
                        "failure_count": cb.failure_count,
                        "success_count": cb.success_count
                    }
                    for name, cb in circuit_breakers.items()
                },
                "system": {
                    "timestamp": datetime.utcnow().isoformat(),
                    "uptime_seconds": time.time() - getattr(settings, 'STARTUP_TIME', time.time())
                }
            }
        }
    except Exception as e:
        logger.error(f"Failed to get metrics snapshot: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrics snapshot: {str(e)}"
        )

def _generate_performance_recommendations(results: Dict[str, Any]) -> List[str]:
    """Generate performance recommendations based on test results"""
    recommendations = []
    
    if results["avg_response_time_ms"] > 200:
        recommendations.append("Consider optimizing database queries or adding caching")
    
    if results["p95_response_time_ms"] > 500:
        recommendations.append("High p95 response times detected - investigate slow endpoints")
    
    if results["success_rate_percent"] < 95:
        recommendations.append("Low success rate - investigate error patterns")
    
    if results["actual_rps"] < results.get("target_rps", 0) * 0.8:
        recommendations.append("Throughput below target - consider scaling resources")
    
    if not recommendations:
        recommendations.append("Performance looks good! No immediate optimizations needed")
    
    return recommendations

def _analyze_circuit_breaker_behavior(results: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze circuit breaker test results"""
    total_calls = len(results["calls"])
    failures = sum(1 for call in results["calls"] if call["result"] == "failure")
    state_transitions = []
    
    for i, call in enumerate(results["calls"]):
        if i > 0:
            prev_state = results["calls"][i-1]["circuit_state"]
            if call["circuit_state"] != prev_state:
                state_transitions.append({
                    "call": i + 1,
                    "from_state": prev_state,
                    "to_state": call["circuit_state"]
                })
    
    return {
        "failure_rate_percent": (failures / total_calls) * 100 if total_calls > 0 else 0,
        "state_transitions": state_transitions,
        "final_state": results["final_state"],
        "behavior": "normal" if results["final_state"] in ["open", "half_open"] else "unexpected"
    } 