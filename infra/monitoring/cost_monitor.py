"""
Comprehensive Cost Monitoring System for Schlep Engine
Monitors and tracks costs across all infrastructure services for the $145/month plan.

Services Monitored:
- Supabase Pro: $25/mo (database usage, connections, storage)
- Railway Backend: $50/mo (CPU, memory, network usage)
- Vercel Admin: $20/mo (builds, bandwidth, serverless functions)
- AWS S3 + CloudFront: $25/mo (storage, requests, data transfer)
- Railway Redis: $12/mo (memory usage, connections)
- Railway Metrics: $13/mo (monitoring overhead)
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from decimal import Decimal
import json
import aiohttp
import os
from enum import Enum
import boto3
import psutil
import redis
from prometheus_client import Gauge, Counter, Histogram

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics for cost monitoring
cost_current = Gauge('cost_current_month_dollars', 'Current month cost in dollars', ['service'])
cost_daily = Gauge('cost_daily_dollars', 'Daily cost in dollars', ['service'])
cost_budget_utilization = Gauge('cost_budget_utilization_percent', 'Budget utilization percentage', ['service'])
cost_forecast = Gauge('cost_forecast_month_dollars', 'Forecasted monthly cost in dollars', ['service'])
cost_alerts_triggered = Counter('cost_alerts_triggered_total', 'Total cost alerts triggered', ['service', 'severity'])

# Service cost limits and budgets
MONTHLY_BUDGET = Decimal('145.00')
DAILY_BUDGET = MONTHLY_BUDGET / 30

SERVICE_BUDGETS = {
    'supabase': Decimal('25.00'),
    'railway_backend': Decimal('50.00'),
    'vercel_admin': Decimal('20.00'),
    'aws_s3_cloudfront': Decimal('25.00'),
    'railway_redis': Decimal('12.00'),
    'railway_metrics': Decimal('13.00')
}

# Usage limits for monitoring
USAGE_LIMITS = {
    'api_requests_monthly': 50000,
    'storage_gb': 100,
    'database_connections': 100,
    'redis_memory_mb': 512,
    'bandwidth_gb': 1000,
    'function_invocations': 100000
}

class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

@dataclass
class ServiceMetrics:
    """Metrics for a specific service"""
    service_name: str
    current_cost: Decimal = Decimal('0.00')
    daily_cost: Decimal = Decimal('0.00')
    usage_metrics: Dict[str, Any] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.utcnow)
    
@dataclass
class CostAlert:
    """Cost alert definition"""
    service: str
    severity: AlertSeverity
    message: str
    threshold: Decimal
    current_value: Decimal
    timestamp: datetime = field(default_factory=datetime.utcnow)

class SupabaseCostMonitor:
    """Monitor Supabase Pro costs and usage"""
    
    def __init__(self, api_key: str = None, project_id: str = None):
        self.api_key = api_key or os.getenv('SUPABASE_API_KEY')
        self.project_id = project_id or os.getenv('SUPABASE_PROJECT_ID')
        self.base_url = f"https://{self.project_id}.supabase.co"
        
    async def get_metrics(self) -> ServiceMetrics:
        """Get Supabase usage and cost metrics"""
        try:
            usage_data = await self._fetch_usage_data()
            
            # Calculate cost based on usage
            database_cost = self._calculate_database_cost(usage_data.get('database', {}))
            storage_cost = self._calculate_storage_cost(usage_data.get('storage', {}))
            bandwidth_cost = self._calculate_bandwidth_cost(usage_data.get('bandwidth', {}))
            
            total_cost = database_cost + storage_cost + bandwidth_cost
            
            return ServiceMetrics(
                service_name='supabase',
                current_cost=total_cost,
                daily_cost=total_cost / 30,  # Estimate daily cost
                usage_metrics={
                    'database_size_gb': usage_data.get('database', {}).get('size_gb', 0),
                    'active_connections': usage_data.get('database', {}).get('connections', 0),
                    'storage_used_gb': usage_data.get('storage', {}).get('used_gb', 0),
                    'bandwidth_gb': usage_data.get('bandwidth', {}).get('total_gb', 0),
                    'api_requests': usage_data.get('api', {}).get('requests', 0)
                }
            )
        except Exception as e:
            logger.error(f"Failed to get Supabase metrics: {e}")
            return ServiceMetrics(service_name='supabase')
            
    async def _fetch_usage_data(self) -> Dict[str, Any]:
        """Fetch usage data from Supabase API"""
        # This is a mock implementation - actual Supabase API calls would go here
        return {
            'database': {'size_gb': 2.5, 'connections': 15},
            'storage': {'used_gb': 5.2},
            'bandwidth': {'total_gb': 50.3},
            'api': {'requests': 12000}
        }
    
    def _calculate_database_cost(self, db_data: Dict) -> Decimal:
        """Calculate database-related costs"""
        base_cost = Decimal('25.00')  # Pro plan base
        # Add overages if any
        return base_cost
    
    def _calculate_storage_cost(self, storage_data: Dict) -> Decimal:
        """Calculate storage costs"""
        used_gb = storage_data.get('used_gb', 0)
        free_tier = 8  # GB
        if used_gb > free_tier:
            overage_cost = (used_gb - free_tier) * Decimal('0.021')  # $0.021 per GB
            return overage_cost
        return Decimal('0.00')
    
    def _calculate_bandwidth_cost(self, bandwidth_data: Dict) -> Decimal:
        """Calculate bandwidth costs"""
        used_gb = bandwidth_data.get('total_gb', 0)
        free_tier = 250  # GB for Pro plan
        if used_gb > free_tier:
            overage_cost = (used_gb - free_tier) * Decimal('0.09')  # $0.09 per GB
            return overage_cost
        return Decimal('0.00')

class RailwayCostMonitor:
    """Monitor Railway costs for backend and Redis"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('RAILWAY_API_KEY')
        self.base_url = "https://backboard.railway.app/graphql"
        
    async def get_backend_metrics(self) -> ServiceMetrics:
        """Get Railway backend service metrics"""
        try:
            usage_data = await self._fetch_service_usage('backend')
            
            # Calculate cost based on resource usage
            cpu_cost = self._calculate_cpu_cost(usage_data.get('cpu', {}))
            memory_cost = self._calculate_memory_cost(usage_data.get('memory', {}))
            network_cost = self._calculate_network_cost(usage_data.get('network', {}))
            
            total_cost = cpu_cost + memory_cost + network_cost
            
            return ServiceMetrics(
                service_name='railway_backend',
                current_cost=total_cost,
                daily_cost=total_cost / 30,
                usage_metrics={
                    'cpu_hours': usage_data.get('cpu', {}).get('hours', 0),
                    'memory_gb_hours': usage_data.get('memory', {}).get('gb_hours', 0),
                    'network_gb': usage_data.get('network', {}).get('gb', 0),
                    'builds': usage_data.get('builds', {}).get('count', 0)
                }
            )
        except Exception as e:
            logger.error(f"Failed to get Railway backend metrics: {e}")
            return ServiceMetrics(service_name='railway_backend')
    
    async def get_redis_metrics(self) -> ServiceMetrics:
        """Get Railway Redis service metrics"""
        try:
            usage_data = await self._fetch_service_usage('redis')
            
            # Redis costs are typically memory-based
            memory_cost = self._calculate_redis_memory_cost(usage_data.get('memory', {}))
            
            return ServiceMetrics(
                service_name='railway_redis',
                current_cost=memory_cost,
                daily_cost=memory_cost / 30,
                usage_metrics={
                    'memory_mb': usage_data.get('memory', {}).get('mb', 0),
                    'connections': usage_data.get('connections', {}).get('active', 0),
                    'operations_per_second': usage_data.get('ops', {}).get('per_second', 0)
                }
            )
        except Exception as e:
            logger.error(f"Failed to get Railway Redis metrics: {e}")
            return ServiceMetrics(service_name='railway_redis')
    
    async def _fetch_service_usage(self, service_type: str) -> Dict[str, Any]:
        """Fetch usage data from Railway API"""
        # Mock implementation - actual Railway API calls would go here
        if service_type == 'backend':
            return {
                'cpu': {'hours': 720},  # ~1 vCPU month
                'memory': {'gb_hours': 1440},  # ~2GB month
                'network': {'gb': 25.5},
                'builds': {'count': 45}
            }
        elif service_type == 'redis':
            return {
                'memory': {'mb': 256},
                'connections': {'active': 12},
                'ops': {'per_second': 150}
            }
        return {}
    
    def _calculate_cpu_cost(self, cpu_data: Dict) -> Decimal:
        """Calculate CPU costs"""
        hours = cpu_data.get('hours', 0)
        cost_per_hour = Decimal('0.000463')  # Railway pricing
        return Decimal(str(hours)) * cost_per_hour
    
    def _calculate_memory_cost(self, memory_data: Dict) -> Decimal:
        """Calculate memory costs"""
        gb_hours = memory_data.get('gb_hours', 0)
        cost_per_gb_hour = Decimal('0.000231')  # Railway pricing
        return Decimal(str(gb_hours)) * cost_per_gb_hour
    
    def _calculate_network_cost(self, network_data: Dict) -> Decimal:
        """Calculate network costs"""
        gb = network_data.get('gb', 0)
        cost_per_gb = Decimal('0.10')  # Railway pricing
        return Decimal(str(gb)) * cost_per_gb
    
    def _calculate_redis_memory_cost(self, memory_data: Dict) -> Decimal:
        """Calculate Redis memory costs"""
        mb = memory_data.get('mb', 0)
        # Railway Redis pricing is typically memory-based
        cost_per_mb = Decimal('0.0234')  # Estimated pricing
        return Decimal(str(mb)) * cost_per_mb

class VercelCostMonitor:
    """Monitor Vercel Pro costs"""
    
    def __init__(self, api_key: str = None, team_id: str = None):
        self.api_key = api_key or os.getenv('VERCEL_API_KEY')
        self.team_id = team_id or os.getenv('VERCEL_TEAM_ID')
        self.base_url = "https://api.vercel.com"
        
    async def get_metrics(self) -> ServiceMetrics:
        """Get Vercel usage and cost metrics"""
        try:
            usage_data = await self._fetch_usage_data()
            
            # Calculate costs
            function_cost = self._calculate_function_cost(usage_data.get('functions', {}))
            bandwidth_cost = self._calculate_bandwidth_cost(usage_data.get('bandwidth', {}))
            build_cost = self._calculate_build_cost(usage_data.get('builds', {}))
            
            total_cost = function_cost + bandwidth_cost + build_cost
            
            return ServiceMetrics(
                service_name='vercel_admin',
                current_cost=total_cost,
                daily_cost=total_cost / 30,
                usage_metrics={
                    'function_invocations': usage_data.get('functions', {}).get('invocations', 0),
                    'function_gb_hours': usage_data.get('functions', {}).get('gb_hours', 0),
                    'bandwidth_gb': usage_data.get('bandwidth', {}).get('gb', 0),
                    'build_minutes': usage_data.get('builds', {}).get('minutes', 0)
                }
            )
        except Exception as e:
            logger.error(f"Failed to get Vercel metrics: {e}")
            return ServiceMetrics(service_name='vercel_admin')
    
    async def _fetch_usage_data(self) -> Dict[str, Any]:
        """Fetch usage data from Vercel API"""
        # Mock implementation - actual Vercel API calls would go here
        return {
            'functions': {'invocations': 25000, 'gb_hours': 50},
            'bandwidth': {'gb': 75.5},
            'builds': {'minutes': 120}
        }
    
    def _calculate_function_cost(self, function_data: Dict) -> Decimal:
        """Calculate serverless function costs"""
        invocations = function_data.get('invocations', 0)
        gb_hours = function_data.get('gb_hours', 0)
        
        # Vercel Pro includes some free usage
        free_invocations = 1000000  # 1M invocations
        free_gb_hours = 1000
        
        invocation_cost = Decimal('0.00')
        if invocations > free_invocations:
            overage = invocations - free_invocations
            invocation_cost = Decimal(str(overage)) * Decimal('0.0000004')  # $0.40 per 1M
        
        compute_cost = Decimal('0.00')
        if gb_hours > free_gb_hours:
            overage = gb_hours - free_gb_hours
            compute_cost = Decimal(str(overage)) * Decimal('0.0000185')  # $18.50 per 1K GB-hours
        
        return invocation_cost + compute_cost
    
    def _calculate_bandwidth_cost(self, bandwidth_data: Dict) -> Decimal:
        """Calculate bandwidth costs"""
        gb = bandwidth_data.get('gb', 0)
        free_tier = 1000  # 1TB for Pro
        
        if gb > free_tier:
            overage = gb - free_tier
            return Decimal(str(overage)) * Decimal('0.40')  # $0.40 per GB
        return Decimal('0.00')
    
    def _calculate_build_cost(self, build_data: Dict) -> Decimal:
        """Calculate build costs"""
        minutes = build_data.get('minutes', 0)
        free_minutes = 6000  # Pro plan includes 6K minutes
        
        if minutes > free_minutes:
            overage = minutes - free_minutes
            return Decimal(str(overage)) * Decimal('0.008')  # $0.008 per minute
        return Decimal('0.00')

class AWSCostMonitor:
    """Monitor AWS S3 and CloudFront costs"""
    
    def __init__(self, access_key: str = None, secret_key: str = None, region: str = 'us-east-1'):
        self.access_key = access_key or os.getenv('AWS_ACCESS_KEY_ID')
        self.secret_key = secret_key or os.getenv('AWS_SECRET_ACCESS_KEY')
        self.region = region
        
        # Initialize AWS clients
        self.cloudwatch = boto3.client(
            'cloudwatch',
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region
        )
        
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region
        )
    
    async def get_metrics(self) -> ServiceMetrics:
        """Get AWS S3 and CloudFront usage and cost metrics"""
        try:
            s3_usage = await self._get_s3_usage()
            cloudfront_usage = await self._get_cloudfront_usage()
            
            # Calculate costs
            s3_cost = self._calculate_s3_cost(s3_usage)
            cloudfront_cost = self._calculate_cloudfront_cost(cloudfront_usage)
            
            total_cost = s3_cost + cloudfront_cost
            
            return ServiceMetrics(
                service_name='aws_s3_cloudfront',
                current_cost=total_cost,
                daily_cost=total_cost / 30,
                usage_metrics={
                    's3_storage_gb': s3_usage.get('storage_gb', 0),
                    's3_requests': s3_usage.get('requests', 0),
                    'cloudfront_requests': cloudfront_usage.get('requests', 0),
                    'cloudfront_data_transfer_gb': cloudfront_usage.get('data_transfer_gb', 0)
                }
            )
        except Exception as e:
            logger.error(f"Failed to get AWS metrics: {e}")
            return ServiceMetrics(service_name='aws_s3_cloudfront')
    
    async def _get_s3_usage(self) -> Dict[str, Any]:
        """Get S3 usage metrics"""
        # Mock implementation - actual CloudWatch API calls would go here
        return {
            'storage_gb': 25.8,
            'requests': 15000
        }
    
    async def _get_cloudfront_usage(self) -> Dict[str, Any]:
        """Get CloudFront usage metrics"""
        # Mock implementation - actual CloudWatch API calls would go here
        return {
            'requests': 50000,
            'data_transfer_gb': 125.5
        }
    
    def _calculate_s3_cost(self, s3_usage: Dict) -> Decimal:
        """Calculate S3 costs"""
        storage_gb = s3_usage.get('storage_gb', 0)
        requests = s3_usage.get('requests', 0)
        
        # S3 Standard pricing
        storage_cost = Decimal(str(storage_gb)) * Decimal('0.023')  # $0.023 per GB
        request_cost = Decimal(str(requests)) * Decimal('0.0004') / 1000  # $0.40 per 1K requests
        
        return storage_cost + request_cost
    
    def _calculate_cloudfront_cost(self, cf_usage: Dict) -> Decimal:
        """Calculate CloudFront costs"""
        requests = cf_usage.get('requests', 0)
        data_transfer_gb = cf_usage.get('data_transfer_gb', 0)
        
        # CloudFront pricing (first 10TB tier)
        request_cost = Decimal(str(requests)) * Decimal('0.0075') / 10000  # $0.75 per 10K requests
        transfer_cost = Decimal(str(data_transfer_gb)) * Decimal('0.085')  # $0.085 per GB
        
        return request_cost + transfer_cost

class CostMonitoringService:
    """Main cost monitoring service coordinator"""
    
    def __init__(self):
        self.monitors = {
            'supabase': SupabaseCostMonitor(),
            'railway_backend': RailwayCostMonitor(),
            'railway_redis': RailwayCostMonitor(),
            'vercel_admin': VercelCostMonitor(),
            'aws_s3_cloudfront': AWSCostMonitor()
        }
        
        self.alerts: List[CostAlert] = []
        self.metrics_history: List[Dict[str, ServiceMetrics]] = []
        
    async def collect_all_metrics(self) -> Dict[str, ServiceMetrics]:
        """Collect metrics from all services"""
        metrics = {}
        
        try:
            # Collect Supabase metrics
            metrics['supabase'] = await self.monitors['supabase'].get_metrics()
            
            # Collect Railway metrics
            railway_monitor = self.monitors['railway_backend']
            metrics['railway_backend'] = await railway_monitor.get_backend_metrics()
            metrics['railway_redis'] = await railway_monitor.get_redis_metrics()
            
            # Collect Vercel metrics
            metrics['vercel_admin'] = await self.monitors['vercel_admin'].get_metrics()
            
            # Collect AWS metrics
            metrics['aws_s3_cloudfront'] = await self.monitors['aws_s3_cloudfront'].get_metrics()
            
            # Update Prometheus metrics
            self._update_prometheus_metrics(metrics)
            
            # Check for alerts
            self._check_cost_alerts(metrics)
            
            # Store in history
            self.metrics_history.append(metrics)
            if len(self.metrics_history) > 1000:  # Keep last 1000 entries
                self.metrics_history.pop(0)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect metrics: {e}")
            return {}
    
    def _update_prometheus_metrics(self, metrics: Dict[str, ServiceMetrics]):
        """Update Prometheus metrics"""
        for service_name, service_metrics in metrics.items():
            cost_current.labels(service=service_name).set(float(service_metrics.current_cost))
            cost_daily.labels(service=service_name).set(float(service_metrics.daily_cost))
            
            # Calculate budget utilization
            budget = SERVICE_BUDGETS.get(service_name, Decimal('0.00'))
            if budget > 0:
                utilization = (service_metrics.current_cost / budget) * 100
                cost_budget_utilization.labels(service=service_name).set(float(utilization))
    
    def _check_cost_alerts(self, metrics: Dict[str, ServiceMetrics]):
        """Check for cost-based alerts"""
        total_cost = sum(m.current_cost for m in metrics.values())
        
        # Check overall budget alert (80% threshold)
        budget_utilization = (total_cost / MONTHLY_BUDGET) * 100
        if budget_utilization >= 80:
            alert = CostAlert(
                service='overall',
                severity=AlertSeverity.WARNING if budget_utilization < 95 else AlertSeverity.CRITICAL,
                message=f"Monthly budget utilization at {budget_utilization:.1f}%",
                threshold=MONTHLY_BUDGET * Decimal('0.8'),
                current_value=total_cost
            )
            self.alerts.append(alert)
            cost_alerts_triggered.labels(service='overall', severity=alert.severity.value).inc()
        
        # Check individual service alerts
        for service_name, service_metrics in metrics.items():
            budget = SERVICE_BUDGETS.get(service_name, Decimal('0.00'))
            if budget > 0:
                service_utilization = (service_metrics.current_cost / budget) * 100
                if service_utilization >= 80:
                    alert = CostAlert(
                        service=service_name,
                        severity=AlertSeverity.WARNING if service_utilization < 95 else AlertSeverity.CRITICAL,
                        message=f"{service_name} budget utilization at {service_utilization:.1f}%",
                        threshold=budget * Decimal('0.8'),
                        current_value=service_metrics.current_cost
                    )
                    self.alerts.append(alert)
                    cost_alerts_triggered.labels(service=service_name, severity=alert.severity.value).inc()
    
    def get_cost_forecast(self, metrics: Dict[str, ServiceMetrics]) -> Dict[str, Decimal]:
        """Generate cost forecasts based on current usage trends"""
        forecasts = {}
        
        for service_name, service_metrics in metrics.items():
            # Simple linear projection based on current daily rate
            days_in_month = 30
            current_day = datetime.utcnow().day
            
            if current_day > 0:
                projected_monthly_cost = (service_metrics.current_cost / current_day) * days_in_month
                forecasts[service_name] = projected_monthly_cost
                
                # Update Prometheus forecast metric
                cost_forecast.labels(service=service_name).set(float(projected_monthly_cost))
        
        return forecasts
    
    def get_active_alerts(self, max_age_hours: int = 24) -> List[CostAlert]:
        """Get active cost alerts within the specified time window"""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        return [alert for alert in self.alerts if alert.timestamp >= cutoff_time]
    
    def get_cost_summary(self, metrics: Dict[str, ServiceMetrics]) -> Dict[str, Any]:
        """Generate comprehensive cost summary"""
        total_cost = sum(m.current_cost for m in metrics.values())
        total_daily = sum(m.daily_cost for m in metrics.values())
        
        forecasts = self.get_cost_forecast(metrics)
        total_forecast = sum(forecasts.values())
        
        return {
            'current_month_total': float(total_cost),
            'daily_average': float(total_daily),
            'monthly_budget': float(MONTHLY_BUDGET),
            'budget_utilization_percent': float((total_cost / MONTHLY_BUDGET) * 100),
            'forecasted_month_total': float(total_forecast),
            'forecast_vs_budget_percent': float((total_forecast / MONTHLY_BUDGET) * 100),
            'days_remaining_in_month': 30 - datetime.utcnow().day,
            'services': {
                service_name: {
                    'current_cost': float(metrics.current_cost),
                    'daily_cost': float(metrics.daily_cost),
                    'budget': float(SERVICE_BUDGETS.get(service_name, Decimal('0.00'))),
                    'forecast': float(forecasts.get(service_name, Decimal('0.00'))),
                    'usage_metrics': metrics.usage_metrics
                }
                for service_name, metrics in metrics.items()
            },
            'active_alerts': [
                {
                    'service': alert.service,
                    'severity': alert.severity.value,
                    'message': alert.message,
                    'timestamp': alert.timestamp.isoformat()
                }
                for alert in self.get_active_alerts()
            ]
        }

# Global cost monitoring service instance
cost_monitor = CostMonitoringService()

async def start_cost_monitoring(interval_minutes: int = 15):
    """Start the cost monitoring service with specified interval"""
    logger.info(f"Starting cost monitoring service with {interval_minutes} minute intervals")
    
    while True:
        try:
            metrics = await cost_monitor.collect_all_metrics()
            logger.info(f"Collected metrics for {len(metrics)} services")
            
            # Log cost summary
            summary = cost_monitor.get_cost_summary(metrics)
            logger.info(f"Current month total: ${summary['current_month_total']:.2f} / ${summary['monthly_budget']:.2f} "
                       f"({summary['budget_utilization_percent']:.1f}%)")
            
            # Log any active alerts
            active_alerts = cost_monitor.get_active_alerts()
            if active_alerts:
                logger.warning(f"Active cost alerts: {len(active_alerts)}")
                for alert in active_alerts[-5:]:  # Log last 5 alerts
                    logger.warning(f"  {alert.service}: {alert.message}")
            
        except Exception as e:
            logger.error(f"Error in cost monitoring cycle: {e}")
        
        # Wait for next cycle
        await asyncio.sleep(interval_minutes * 60)

if __name__ == "__main__":
    # Run cost monitoring service
    asyncio.run(start_cost_monitoring())