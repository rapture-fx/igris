"""
MONITORING MIDDLEWARE
====================

Enhanced monitoring middleware for production deployment.
"""

import time
import logging
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

class MonitoringMiddleware(BaseHTTPMiddleware):
    """Enhanced monitoring middleware with performance tracking"""
    
    def __init__(self, app):
        super().__init__(app)
        self.request_count = 0
        self.error_count = 0
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with monitoring"""
        start_time = time.time()
        
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())[:8]
        request.state.correlation_id = correlation_id
        
        # Increment request count
        self.request_count += 1
        
        # Log request
        logger.info(f"Request {correlation_id}: {request.method} {request.url.path}")
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log response
            logger.info(
                f"Response {correlation_id}: {response.status_code} "
                f"({duration:.3f}s)"
            )
            
            # Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            return response
            
        except Exception as e:
            # Increment error count
            self.error_count += 1
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log error
            logger.error(
                f"Error {correlation_id}: {str(e)} ({duration:.3f}s)"
            )
            
            # Return error response
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "Internal server error",
                    "correlation_id": correlation_id
                },
                headers={
                    "X-Correlation-ID": correlation_id,
                    "X-Response-Time": f"{duration:.3f}s"
                }
            )
    
    def get_stats(self):
        """Get middleware statistics"""
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "error_rate": self.error_count / max(self.request_count, 1)
        }


def create_monitoring_middleware():
    """Factory function to create monitoring middleware"""
    return MonitoringMiddleware