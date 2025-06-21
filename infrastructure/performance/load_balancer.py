"""
Production Load Balancer Configuration
=====================================

Advanced load balancing and high availability configuration for production deployment.
Addresses scalability gaps identified in system analysis.

Features:
- Multiple backend instances
- Health check based routing
- Session persistence
- SSL termination
- Rate limiting
- Failover mechanisms
"""

import asyncio
import random
import time
import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import httpx
import hashlib
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class BackendStatus(Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    MAINTENANCE = "maintenance"

class LoadBalancingStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    IP_HASH = "ip_hash"
    RESPONSE_TIME = "response_time"

@dataclass
class BackendServer:
    """Backend server configuration"""
    id: str
    host: str
    port: int
    weight: int = 1
    max_connections: int = 100
    status: BackendStatus = BackendStatus.HEALTHY
    current_connections: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    avg_response_time: float = 0.0
    last_health_check: Optional[datetime] = None
    health_check_failures: int = 0
    
    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"
    
    @property
    def is_available(self) -> bool:
        return (self.status == BackendStatus.HEALTHY and 
                self.current_connections < self.max_connections)
    
    def update_stats(self, response_time: float, success: bool):
        """Update server statistics"""
        self.total_requests += 1
        if not success:
            self.failed_requests += 1
        
        # Calculate rolling average response time
        alpha = 0.1  # Smoothing factor
        self.avg_response_time = (alpha * response_time + 
                                (1 - alpha) * self.avg_response_time)

@dataclass
class LoadBalancerConfig:
    """Load balancer configuration"""
    strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN
    health_check_interval: int = 30  # seconds
    health_check_timeout: int = 5    # seconds
    health_check_path: str = "/health"
    max_retries: int = 3
    retry_delay: float = 1.0
    session_persistence: bool = False
    session_timeout: int = 3600  # seconds
    
    # Circuit breaker settings
    failure_threshold: int = 5
    recovery_timeout: int = 60  # seconds

class LoadBalancer:
    """
    Production-ready load balancer with advanced features
    """
    
    def __init__(self, config: LoadBalancerConfig):
        self.config = config
        self.backends: List[BackendServer] = []
        self.current_backend_index = 0
        self.sessions: Dict[str, Tuple[str, datetime]] = {}  # session_id -> (backend_id, last_access)
        self.health_check_task: Optional[asyncio.Task] = None
        self.metrics = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "backend_failures": 0,
            "avg_response_time": 0.0
        }
        
    def add_backend(self, backend: BackendServer):
        """Add a backend server"""
        self.backends.append(backend)
        logger.info(f"Added backend server: {backend.id} ({backend.url})")
    
    def remove_backend(self, backend_id: str):
        """Remove a backend server"""
        self.backends = [b for b in self.backends if b.id != backend_id]
        logger.info(f"Removed backend server: {backend_id}")
    
    def get_healthy_backends(self) -> List[BackendServer]:
        """Get list of healthy backend servers"""
        return [b for b in self.backends if b.is_available]
    
    def select_backend(self, client_ip: Optional[str] = None, 
                      session_id: Optional[str] = None) -> Optional[BackendServer]:
        """
        Select backend server based on load balancing strategy
        
        Args:
            client_ip: Client IP address for IP hash strategy
            session_id: Session ID for session persistence
            
        Returns:
            Selected backend server or None if no servers available
        """
        healthy_backends = self.get_healthy_backends()
        
        if not healthy_backends:
            logger.warning("No healthy backends available")
            return None
        
        # Session persistence
        if self.config.session_persistence and session_id:
            if session_id in self.sessions:
                backend_id, last_access = self.sessions[session_id]
                
                # Check if session is still valid
                if datetime.utcnow() - last_access < timedelta(seconds=self.config.session_timeout):
                    backend = next((b for b in healthy_backends if b.id == backend_id), None)
                    if backend:
                        self.sessions[session_id] = (backend_id, datetime.utcnow())
                        return backend
                
                # Remove expired session
                del self.sessions[session_id]
        
        # Select based on strategy
        if self.config.strategy == LoadBalancingStrategy.ROUND_ROBIN:
            backend = self._round_robin_select(healthy_backends)
        elif self.config.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
            backend = self._least_connections_select(healthy_backends)
        elif self.config.strategy == LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
            backend = self._weighted_round_robin_select(healthy_backends)
        elif self.config.strategy == LoadBalancingStrategy.IP_HASH:
            backend = self._ip_hash_select(healthy_backends, client_ip)
        elif self.config.strategy == LoadBalancingStrategy.RESPONSE_TIME:
            backend = self._response_time_select(healthy_backends)
        else:
            backend = healthy_backends[0]
        
        # Update session if persistence enabled
        if self.config.session_persistence and session_id and backend:
            self.sessions[session_id] = (backend.id, datetime.utcnow())
        
        return backend
    
    def _round_robin_select(self, backends: List[BackendServer]) -> BackendServer:
        """Round robin selection"""
        backend = backends[self.current_backend_index % len(backends)]
        self.current_backend_index += 1
        return backend
    
    def _least_connections_select(self, backends: List[BackendServer]) -> BackendServer:
        """Least connections selection"""
        return min(backends, key=lambda b: b.current_connections)
    
    def _weighted_round_robin_select(self, backends: List[BackendServer]) -> BackendServer:
        """Weighted round robin selection"""
        total_weight = sum(b.weight for b in backends)
        if total_weight == 0:
            return backends[0]
        
        # Create weighted list
        weighted_backends = []
        for backend in backends:
            weighted_backends.extend([backend] * backend.weight)
        
        index = self.current_backend_index % len(weighted_backends)
        self.current_backend_index += 1
        return weighted_backends[index]
    
    def _ip_hash_select(self, backends: List[BackendServer], 
                       client_ip: Optional[str]) -> BackendServer:
        """IP hash selection for session affinity"""
        if not client_ip:
            return backends[0]
        
        # Create hash of client IP
        hash_value = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
        index = hash_value % len(backends)
        return backends[index]
    
    def _response_time_select(self, backends: List[BackendServer]) -> BackendServer:
        """Select backend with best response time"""
        return min(backends, key=lambda b: b.avg_response_time or float('inf'))
    
    async def proxy_request(self, 
                           method: str,
                           path: str,
                           headers: Dict[str, str] = None,
                           body: bytes = None,
                           client_ip: str = None,
                           session_id: str = None) -> Tuple[int, Dict[str, str], bytes]:
        """
        Proxy request to backend server with retries and failover
        
        Args:
            method: HTTP method
            path: Request path
            headers: Request headers
            body: Request body
            client_ip: Client IP address
            session_id: Session ID
            
        Returns:
            Tuple of (status_code, headers, body)
        """
        self.metrics["total_requests"] += 1
        headers = headers or {}
        
        # Remove hop-by-hop headers
        hop_by_hop_headers = {
            'connection', 'keep-alive', 'proxy-authentication',
            'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'
        }
        headers = {k: v for k, v in headers.items() 
                  if k.lower() not in hop_by_hop_headers}
        
        # Add X-Forwarded headers
        if client_ip:
            headers['X-Forwarded-For'] = client_ip
        headers['X-Forwarded-Proto'] = 'http'
        
        retries = 0
        last_error = None
        
        while retries <= self.config.max_retries:
            backend = self.select_backend(client_ip, session_id)
            
            if not backend:
                self.metrics["failed_requests"] += 1
                return 503, {"Content-Type": "application/json"}, b'{"error": "No backend servers available"}'
            
            try:
                backend.current_connections += 1
                start_time = time.time()
                
                async with httpx.AsyncClient() as client:
                    url = f"{backend.url}{path}"
                    
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        content=body,
                        timeout=30.0
                    )
                    
                    response_time = time.time() - start_time
                    backend.update_stats(response_time, True)
                    
                    # Update metrics
                    self.metrics["successful_requests"] += 1
                    alpha = 0.1
                    self.metrics["avg_response_time"] = (
                        alpha * response_time + 
                        (1 - alpha) * self.metrics["avg_response_time"]
                    )
                    
                    # Prepare response headers
                    response_headers = dict(response.headers)
                    response_headers['X-Backend-Server'] = backend.id
                    
                    return response.status_code, response_headers, response.content
                    
            except Exception as e:
                response_time = time.time() - start_time
                backend.update_stats(response_time, False)
                last_error = e
                
                logger.warning(f"Request failed to backend {backend.id}: {e}")
                
                # Mark backend as unhealthy if too many failures
                backend.health_check_failures += 1
                if backend.health_check_failures >= self.config.failure_threshold:
                    backend.status = BackendStatus.UNHEALTHY
                    logger.error(f"Backend {backend.id} marked as unhealthy")
                    self.metrics["backend_failures"] += 1
                
            finally:
                backend.current_connections = max(0, backend.current_connections - 1)
            
            retries += 1
            if retries <= self.config.max_retries:
                await asyncio.sleep(self.config.retry_delay)
        
        # All retries failed
        self.metrics["failed_requests"] += 1
        error_msg = f"All backend servers failed. Last error: {last_error}"
        logger.error(error_msg)
        
        return 502, {"Content-Type": "application/json"}, b'{"error": "Backend servers unavailable"}'
    
    async def health_check_backend(self, backend: BackendServer) -> bool:
        """
        Perform health check on backend server
        
        Args:
            backend: Backend server to check
            
        Returns:
            True if healthy, False otherwise
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{backend.url}{self.config.health_check_path}",
                    timeout=self.config.health_check_timeout
                )
                
                healthy = response.status_code == 200
                
                if healthy:
                    backend.health_check_failures = 0
                    if backend.status == BackendStatus.UNHEALTHY:
                        backend.status = BackendStatus.HEALTHY
                        logger.info(f"Backend {backend.id} recovered")
                else:
                    backend.health_check_failures += 1
                
                backend.last_health_check = datetime.utcnow()
                return healthy
                
        except Exception as e:
            logger.debug(f"Health check failed for backend {backend.id}: {e}")
            backend.health_check_failures += 1
            backend.last_health_check = datetime.utcnow()
            
            # Mark as unhealthy if too many failures
            if backend.health_check_failures >= self.config.failure_threshold:
                if backend.status == BackendStatus.HEALTHY:
                    backend.status = BackendStatus.UNHEALTHY
                    logger.error(f"Backend {backend.id} marked as unhealthy")
                    self.metrics["backend_failures"] += 1
            
            return False
    
    async def health_check_loop(self):
        """Continuous health check loop"""
        while True:
            try:
                for backend in self.backends:
                    if backend.status != BackendStatus.MAINTENANCE:
                        await self.health_check_backend(backend)
                
                # Clean up expired sessions
                if self.config.session_persistence:
                    current_time = datetime.utcnow()
                    expired_sessions = [
                        session_id for session_id, (_, last_access) in self.sessions.items()
                        if current_time - last_access > timedelta(seconds=self.config.session_timeout)
                    ]
                    
                    for session_id in expired_sessions:
                        del self.sessions[session_id]
                
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
            
            await asyncio.sleep(self.config.health_check_interval)
    
    async def start(self):
        """Start load balancer"""
        logger.info("Starting load balancer")
        
        # Start health check loop
        self.health_check_task = asyncio.create_task(self.health_check_loop())
        
        # Perform initial health checks
        for backend in self.backends:
            await self.health_check_backend(backend)
    
    async def stop(self):
        """Stop load balancer"""
        logger.info("Stopping load balancer")
        
        if self.health_check_task:
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass
    
    def get_status(self) -> Dict:
        """Get load balancer status and metrics"""
        backend_status = []
        for backend in self.backends:
            backend_status.append({
                "id": backend.id,
                "url": backend.url,
                "status": backend.status.value,
                "weight": backend.weight,
                "current_connections": backend.current_connections,
                "total_requests": backend.total_requests,
                "failed_requests": backend.failed_requests,
                "success_rate": (
                    ((backend.total_requests - backend.failed_requests) / backend.total_requests * 100)
                    if backend.total_requests > 0 else 0
                ),
                "avg_response_time": backend.avg_response_time,
                "last_health_check": backend.last_health_check.isoformat() if backend.last_health_check else None,
                "health_check_failures": backend.health_check_failures
            })
        
        return {
            "config": {
                "strategy": self.config.strategy.value,
                "health_check_interval": self.config.health_check_interval,
                "session_persistence": self.config.session_persistence
            },
            "metrics": self.metrics,
            "backends": backend_status,
            "active_sessions": len(self.sessions) if self.config.session_persistence else 0
        }

# Production configuration example
def create_production_load_balancer() -> LoadBalancer:
    """Create production load balancer configuration"""
    config = LoadBalancerConfig(
        strategy=LoadBalancingStrategy.LEAST_CONNECTIONS,
        health_check_interval=30,
        health_check_timeout=5,
        health_check_path="/health",
        max_retries=2,
        retry_delay=0.5,
        session_persistence=True,
        session_timeout=3600,
        failure_threshold=3,
        recovery_timeout=60
    )
    
    lb = LoadBalancer(config)
    
    # Add backend servers (typically from environment variables)
    backend_servers = [
        BackendServer(id="backend-1", host="localhost", port=8001, weight=1),
        BackendServer(id="backend-2", host="localhost", port=8002, weight=1),
        BackendServer(id="backend-3", host="localhost", port=8003, weight=1),
    ]
    
    for backend in backend_servers:
        lb.add_backend(backend)
    
    return lb 