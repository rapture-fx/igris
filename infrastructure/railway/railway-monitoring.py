"""
Railway-integrated monitoring solution
Cost-effective alternative to self-hosted monitoring
"""

import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
import httpx
import json

logger = logging.getLogger(__name__)

class RailwayMonitoring:
    """
    Lightweight monitoring using Railway's built-in metrics
    and external free services
    """
    
    def __init__(self):
        self.railway_api_token = os.getenv("RAILWAY_TOKEN")
        self.project_id = os.getenv("RAILWAY_PROJECT_ID")
        self.service_id = os.getenv("RAILWAY_SERVICE_ID")
        self.webhook_url = os.getenv("DISCORD_WEBHOOK_URL")  # Free Discord alerts
        
    async def get_railway_metrics(self) -> Dict[str, Any]:
        """Get metrics from Railway API"""
        if not self.railway_api_token:
            return {}
            
        headers = {"Authorization": f"Bearer {self.railway_api_token}"}
        
        try:
            async with httpx.AsyncClient() as client:
                # Get deployment metrics
                response = await client.get(
                    f"https://backboard.railway.app/graphql/v2",
                    headers=headers,
                    json={
                        "query": """
                        query GetServiceMetrics($projectId: String!, $serviceId: String!) {
                            project(id: $projectId) {
                                service(id: $serviceId) {
                                    deployments {
                                        edges {
                                            node {
                                                id
                                                status
                                                createdAt
                                                meta
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        """,
                        "variables": {
                            "projectId": self.project_id,
                            "serviceId": self.service_id
                        }
                    }
                )
                
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to get Railway metrics: {e}")
            return {}
    
    async def send_alert(self, message: str, level: str = "warning"):
        """Send alert via Discord webhook (free)"""
        if not self.webhook_url:
            return
            
        color_map = {
            "info": 0x00ff00,
            "warning": 0xffff00,
            "error": 0xff0000,
            "critical": 0x8b0000
        }
        
        embed = {
            "title": f"Schlep-engine Alert - {level.upper()}",
            "description": message,
            "color": color_map.get(level, 0x808080),
            "timestamp": datetime.utcnow().isoformat(),
            "footer": {"text": "Railway Monitoring"}
        }
        
        payload = {"embeds": [embed]}
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(self.webhook_url, json=payload)
                logger.info(f"Alert sent: {level} - {message}")
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")
    
    async def health_check(self) -> Dict[str, str]:
        """Perform basic health checks"""
        health = {
            "api": "unknown",
            "database": "unknown",
            "overall": "unknown"
        }
        
        try:
            # Check API endpoint
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{os.getenv('RAILWAY_PUBLIC_DOMAIN', 'http://localhost:8000')}/api/v1/health/simple",
                    timeout=10
                )
                health["api"] = "healthy" if response.status_code == 200 else "error"
        except Exception:
            health["api"] = "error"
        
        # Check database (basic connection test)
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            try:
                import asyncpg
                conn = await asyncpg.connect(database_url)
                await conn.fetchval("SELECT 1")
                await conn.close()
                health["database"] = "healthy"
            except Exception:
                health["database"] = "error"
        
        # Determine overall health
        if health["api"] == "healthy" and health["database"] == "healthy":
            health["overall"] = "healthy"
        elif "error" in [health["api"], health["database"]]:
            health["overall"] = "error"
        else:
            health["overall"] = "warning"
        
        return health
    
    async def monitor_loop(self, interval: int = 300):  # 5 minutes
        """Main monitoring loop"""
        logger.info("Starting Railway monitoring loop")
        
        while True:
            try:
                health = await self.health_check()
                
                if health["overall"] != "healthy":
                    await self.send_alert(
                        f"System health degraded: {health}",
                        "error" if health["overall"] == "error" else "warning"
                    )
                
                # Get Railway metrics if available
                metrics = await self.get_railway_metrics()
                if metrics:
                    logger.info(f"Railway metrics: {json.dumps(metrics, indent=2)}")
                
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await self.send_alert(f"Monitoring system error: {e}", "error")
            
            await asyncio.sleep(interval)

# Factory function for Railway deployment
def create_railway_monitor() -> RailwayMonitoring:
    """Create Railway monitoring instance"""
    return RailwayMonitoring()

# Health endpoint for Railway
async def railway_health_endpoint():
    """Health endpoint optimized for Railway"""
    monitor = create_railway_monitor()
    return await monitor.health_check()