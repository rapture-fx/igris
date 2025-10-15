"""
Observability API client (Phase 4 integration).
"""
from typing import Dict, Any, List, Optional
from .base import BaseAPI

class ObservabilityAPI(BaseAPI):
    """Observability operations - Prometheus metrics, Jaeger traces, alerts."""

    async def get_metrics(
        self,
        metric: Optional[str] = None,
        format: str = 'json'  # 'json' or 'prometheus'
    ) -> Dict[str, Any]:
        """
        Query Prometheus metrics.

        Args:
            metric: Specific metric to query (if None, returns all)
            format: Output format

        Returns:
            Metrics data

        Example:
            >>> metrics = await client.observability.get_metrics()
            >>> for m in metrics['metrics']:
            ...     print(f"{m['name']}: {m['value']}")
        """
        response = await self._client.get("/api/observability/metrics", params={
            "metric": metric,
            "format": format
        })
        return response

    async def query_prometheus(
        self,
        query: str,
        start: Optional[str] = None,
        end: Optional[str] = None,
        step: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute Prometheus PromQL query.

        Args:
            query: PromQL query string
            start: Start time (RFC3339 or Unix timestamp)
            end: End time
            step: Query resolution step

        Returns:
            Query result

        Example:
            >>> result = await client.observability.query_prometheus(
            ...     'rate(ml_inference_total[5m])'
            ... )
            >>> print(result['data'])
        """
        response = await self._client.post("/api/observability/prometheus/query", json={
            "query": query,
            "start": start,
            "end": end,
            "step": step
        })
        return response

    async def get_traces(
        self,
        trace_id: Optional[str] = None,
        service: Optional[str] = None,
        operation: Optional[str] = None,
        min_duration: Optional[int] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Query distributed traces (Jaeger integration).

        Args:
            trace_id: Specific trace ID to retrieve
            service: Filter by service name
            operation: Filter by operation name
            min_duration: Minimum duration in milliseconds
            limit: Number of traces to return

        Returns:
            Traces data with spans

        Example:
            >>> traces = await client.observability.get_traces(
            ...     service='ml-service',
            ...     min_duration=100
            ... )
            >>> for trace in traces['traces']:
            ...     print(f"{trace['trace_id']}: {trace['duration_ms']}ms")
        """
        response = await self._client.get("/api/observability/traces", params={
            "trace_id": trace_id,
            "service": service,
            "operation": operation,
            "min_duration": min_duration,
            "limit": limit
        })
        return response

    async def get_trace_details(self, trace_id: str) -> Dict[str, Any]:
        """
        Get detailed trace with all spans.

        Args:
            trace_id: Trace identifier

        Returns:
            Detailed trace information

        Example:
            >>> trace = await client.observability.get_trace_details('abc123')
            >>> for span in trace['spans']:
            ...     print(f"  {span['operation_name']}: {span['duration_ms']}ms")
        """
        response = await self._client.get(f"/api/observability/traces/{trace_id}")
        return response

    async def get_alerts(
        self,
        severity: Optional[str] = None,  # 'critical', 'warning', 'info'
        status: str = 'active',  # 'active', 'resolved', 'acknowledged'
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Get active alerts.

        Args:
            severity: Filter by severity
            status: Alert status
            limit: Maximum alerts to return

        Returns:
            List of alerts

        Example:
            >>> alerts = await client.observability.get_alerts(severity='critical')
            >>> for alert in alerts['alerts']:
            ...     print(f"{alert['name']}: {alert['message']}")
        """
        response = await self._client.get("/api/observability/alerts", params={
            "severity": severity,
            "status": status,
            "limit": limit
        })
        return response

    async def acknowledge_alert(self, alert_id: str, comment: Optional[str] = None) -> Dict[str, Any]:
        """
        Acknowledge an alert.

        Args:
            alert_id: Alert identifier
            comment: Optional acknowledgment comment

        Returns:
            Acknowledgment confirmation

        Example:
            >>> await client.observability.acknowledge_alert(
            ...     'alert-123',
            ...     comment='Investigating'
            ... )
        """
        response = await self._client.post(f"/api/observability/alerts/{alert_id}/acknowledge", json={
            "comment": comment
        })
        return response

    async def get_dashboard(self, dashboard: str) -> Dict[str, Any]:
        """
        Get Grafana dashboard information.

        Args:
            dashboard: Dashboard name ('inference', 'cache', 'etl')

        Returns:
            Dashboard metadata and summary metrics

        Example:
            >>> dashboard = await client.observability.get_dashboard('inference')
            >>> print(f"Grafana URL: {dashboard['grafana_url']}")
            >>> print(f"Metrics: {dashboard['summary']}")
        """
        response = await self._client.get(f"/api/observability/dashboards/{dashboard}")
        return response

    async def get_service_health(self, service: Optional[str] = None) -> Dict[str, Any]:
        """
        Get service health status.

        Args:
            service: Specific service name (if None, returns all services)

        Returns:
            Health status for service(s)

        Example:
            >>> health = await client.observability.get_service_health('ml-service')
            >>> print(f"Status: {health['status']}")
            >>> print(f"Uptime: {health['uptime_seconds']}s")
        """
        params = {"service": service} if service else {}
        response = await self._client.get("/api/observability/health", params=params)
        return response

    async def export_metrics(
        self,
        format: str = 'prometheus',  # 'prometheus' or 'json'
        metrics: Optional[List[str]] = None
    ) -> str:
        """
        Export metrics in specified format.

        Args:
            format: Export format
            metrics: Specific metrics to export (if None, exports all)

        Returns:
            Metrics export string

        Example:
            >>> export = await client.observability.export_metrics(format='prometheus')
            >>> with open('metrics.txt', 'w') as f:
            ...     f.write(export)
        """
        response = await self._client.get("/api/observability/export", params={
            "format": format,
            "metrics": metrics
        }, raw=True)
        return response.decode('utf-8')
