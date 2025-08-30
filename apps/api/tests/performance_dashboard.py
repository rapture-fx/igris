"""
Performance Dashboard and Reporting System for Schlep-engine
==========================================================

This module provides a comprehensive dashboard and reporting system for
performance test results, historical trends, and regression analysis.

Features:
- Web-based performance dashboard
- Historical trend analysis
- Performance regression detection
- Interactive charts and visualizations  
- Real-time performance monitoring
- Automated report generation
- Performance alerts and notifications

Usage:
    # Start the performance dashboard
    python tests/performance_dashboard.py --port 8080
    
    # Generate static reports
    python tests/performance_dashboard.py --generate-report --output reports/
"""

import asyncio
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse
import logging
from dataclasses import dataclass, asdict

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.dates import DateFormatter
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
from jinja2 import Template
from aiohttp import web, web_response
import aiohttp_cors

logger = logging.getLogger(__name__)

@dataclass
class PerformanceTrend:
    """Performance trend data point"""
    timestamp: datetime
    test_name: str
    metric_name: str
    value: float
    baseline_value: Optional[float] = None
    change_percent: Optional[float] = None
    status: str = "normal"  # normal, warning, critical

class PerformanceDatabase:
    """Enhanced database for performance metrics and trends"""
    
    def __init__(self, db_path: str = "performance_dashboard.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database with enhanced schema"""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS performance_tests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    test_name TEXT NOT NULL,
                    test_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    duration_seconds REAL,
                    success_rate REAL,
                    avg_response_time_ms REAL,
                    p95_response_time_ms REAL,
                    p99_response_time_ms REAL,
                    throughput_rps REAL,
                    memory_peak_mb REAL,
                    cpu_avg_percent REAL,
                    records_processed INTEGER,
                    config TEXT,
                    raw_data TEXT,
                    commit_hash TEXT,
                    branch TEXT
                );
                
                CREATE TABLE IF NOT EXISTS performance_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    test_name TEXT NOT NULL,
                    alert_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    message TEXT NOT NULL,
                    metric_value REAL,
                    threshold_value REAL,
                    resolved INTEGER DEFAULT 0
                );
                
                CREATE TABLE IF NOT EXISTS performance_baselines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    test_name TEXT NOT NULL UNIQUE,
                    baseline_response_time_ms REAL,
                    baseline_throughput_rps REAL,
                    baseline_memory_mb REAL,
                    baseline_success_rate REAL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                
                CREATE INDEX IF NOT EXISTS idx_test_timestamp ON performance_tests(test_name, timestamp);
                CREATE INDEX IF NOT EXISTS idx_test_type ON performance_tests(test_type);
                CREATE INDEX IF NOT EXISTS idx_alerts_severity ON performance_alerts(severity, resolved);
            """)
    
    def store_test_result(self, test_data: Dict[str, Any], commit_hash: str = "", branch: str = ""):
        """Store test result with enhanced metadata"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO performance_tests 
                (test_name, test_type, timestamp, duration_seconds, success_rate,
                 avg_response_time_ms, p95_response_time_ms, p99_response_time_ms,
                 throughput_rps, memory_peak_mb, cpu_avg_percent, records_processed,
                 config, raw_data, commit_hash, branch)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                test_data.get('test_name'),
                test_data.get('test_type', 'api'),
                test_data.get('timestamp', datetime.now().isoformat()),
                test_data.get('duration_seconds'),
                test_data.get('success_rate'),
                test_data.get('avg_response_time_ms'),
                test_data.get('p95_response_time_ms'),
                test_data.get('p99_response_time_ms'),
                test_data.get('throughput_rps'),
                test_data.get('memory_peak_mb'),
                test_data.get('cpu_avg_percent'),
                test_data.get('records_processed'),
                json.dumps(test_data.get('config', {})),
                json.dumps(test_data.get('raw_data', {})),
                commit_hash,
                branch
            ))
    
    def get_performance_trends(self, test_name: str = None, days_back: int = 30) -> pd.DataFrame:
        """Get performance trends over time"""
        cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        
        query = """
            SELECT timestamp, test_name, test_type, avg_response_time_ms,
                   throughput_rps, memory_peak_mb, success_rate, p95_response_time_ms
            FROM performance_tests 
            WHERE timestamp > ?
        """
        params = [cutoff_date]
        
        if test_name:
            query += " AND test_name = ?"
            params.append(test_name)
        
        query += " ORDER BY timestamp ASC"
        
        with sqlite3.connect(self.db_path) as conn:
            return pd.read_sql_query(query, conn, params=params)
    
    def detect_performance_regressions(self, sensitivity: float = 0.2) -> List[Dict]:
        """Detect performance regressions using statistical analysis"""
        regressions = []
        
        # Get recent test data (last 7 days vs previous 30 days)
        recent_date = (datetime.now() - timedelta(days=7)).isoformat()
        baseline_date = (datetime.now() - timedelta(days=30)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            # Get test names
            test_names = pd.read_sql_query(
                "SELECT DISTINCT test_name FROM performance_tests WHERE timestamp > ?",
                conn, params=[baseline_date]
            )['test_name'].tolist()
            
            for test_name in test_names:
                # Get baseline (older data)
                baseline_data = pd.read_sql_query("""
                    SELECT avg_response_time_ms, throughput_rps, success_rate
                    FROM performance_tests 
                    WHERE test_name = ? AND timestamp BETWEEN ? AND ?
                """, conn, params=[test_name, baseline_date, recent_date])
                
                # Get recent data  
                recent_data = pd.read_sql_query("""
                    SELECT avg_response_time_ms, throughput_rps, success_rate
                    FROM performance_tests 
                    WHERE test_name = ? AND timestamp > ?
                """, conn, params=[test_name, recent_date])
                
                if len(baseline_data) >= 3 and len(recent_data) >= 3:
                    # Check for regressions in each metric
                    metrics = ['avg_response_time_ms', 'throughput_rps', 'success_rate']
                    
                    for metric in metrics:
                        baseline_mean = baseline_data[metric].mean()
                        recent_mean = recent_data[metric].mean()
                        
                        if baseline_mean > 0:
                            change_percent = (recent_mean - baseline_mean) / baseline_mean
                            
                            # Response time increasing is bad
                            if metric == 'avg_response_time_ms' and change_percent > sensitivity:
                                regressions.append({
                                    'test_name': test_name,
                                    'metric': metric,
                                    'baseline_value': baseline_mean,
                                    'recent_value': recent_mean,
                                    'change_percent': change_percent * 100,
                                    'severity': 'critical' if change_percent > 0.5 else 'warning'
                                })
                            
                            # Throughput/success rate decreasing is bad
                            elif metric in ['throughput_rps', 'success_rate'] and change_percent < -sensitivity:
                                regressions.append({
                                    'test_name': test_name,
                                    'metric': metric,
                                    'baseline_value': baseline_mean,
                                    'recent_value': recent_mean,
                                    'change_percent': change_percent * 100,
                                    'severity': 'critical' if change_percent < -0.5 else 'warning'
                                })
        
        return regressions
    
    def store_performance_alert(self, test_name: str, alert_type: str, severity: str, 
                              message: str, metric_value: float = None, threshold_value: float = None):
        """Store performance alert"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO performance_alerts 
                (timestamp, test_name, alert_type, severity, message, metric_value, threshold_value)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                datetime.now().isoformat(),
                test_name,
                alert_type,
                severity,
                message,
                metric_value,
                threshold_value
            ))
    
    def get_active_alerts(self) -> List[Dict]:
        """Get active performance alerts"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, test_name, alert_type, severity, message,
                       metric_value, threshold_value
                FROM performance_alerts 
                WHERE resolved = 0
                ORDER BY timestamp DESC
                LIMIT 50
            """)
            
            alerts = []
            for row in cursor.fetchall():
                alerts.append({
                    'id': row[0],
                    'timestamp': row[1],
                    'test_name': row[2],
                    'alert_type': row[3],
                    'severity': row[4],
                    'message': row[5],
                    'metric_value': row[6],
                    'threshold_value': row[7]
                })
            
            return alerts

class PerformanceVisualization:
    """Generate performance visualizations and charts"""
    
    def __init__(self, database: PerformanceDatabase):
        self.db = database
        
    def create_trend_chart(self, test_name: str = None, days_back: int = 30) -> str:
        """Create performance trend chart using Plotly"""
        df = self.db.get_performance_trends(test_name, days_back)
        
        if df.empty:
            return "<div>No data available for trend chart</div>"
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Create subplot figure
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Response Time Trends', 'Throughput Trends', 
                          'Memory Usage Trends', 'Success Rate Trends'),
            specs=[[{"secondary_y": False}, {"secondary_y": False}],
                   [{"secondary_y": False}, {"secondary_y": False}]]
        )
        
        # Group by test name for multiple lines
        test_names = df['test_name'].unique()
        colors = px.colors.qualitative.Set1
        
        for i, test in enumerate(test_names):
            test_data = df[df['test_name'] == test]
            color = colors[i % len(colors)]
            
            # Response time chart
            fig.add_trace(
                go.Scatter(
                    x=test_data['timestamp'],
                    y=test_data['avg_response_time_ms'],
                    mode='lines+markers',
                    name=f'{test} - Response Time',
                    line=dict(color=color),
                    showlegend=True
                ),
                row=1, col=1
            )
            
            # Throughput chart
            fig.add_trace(
                go.Scatter(
                    x=test_data['timestamp'],
                    y=test_data['throughput_rps'],
                    mode='lines+markers',
                    name=f'{test} - Throughput',
                    line=dict(color=color, dash='dash'),
                    showlegend=False
                ),
                row=1, col=2
            )
            
            # Memory chart
            fig.add_trace(
                go.Scatter(
                    x=test_data['timestamp'],
                    y=test_data['memory_peak_mb'],
                    mode='lines+markers',
                    name=f'{test} - Memory',
                    line=dict(color=color, dash='dot'),
                    showlegend=False
                ),
                row=2, col=1
            )
            
            # Success rate chart
            fig.add_trace(
                go.Scatter(
                    x=test_data['timestamp'],
                    y=test_data['success_rate'],
                    mode='lines+markers',
                    name=f'{test} - Success Rate',
                    line=dict(color=color, dash='dashdot'),
                    showlegend=False
                ),
                row=2, col=2
            )
        
        # Update layout
        fig.update_xaxes(title_text="Time")
        fig.update_yaxes(title_text="Response Time (ms)", row=1, col=1)
        fig.update_yaxes(title_text="Requests/Second", row=1, col=2)
        fig.update_yaxes(title_text="Memory (MB)", row=2, col=1)
        fig.update_yaxes(title_text="Success Rate (%)", row=2, col=2)
        
        fig.update_layout(
            height=600,
            title_text="Performance Trends Over Time",
            title_x=0.5,
            showlegend=True
        )
        
        return fig.to_html(include_plotlyjs='inline')
    
    def create_comparison_chart(self, test_names: List[str]) -> str:
        """Create performance comparison chart"""
        if not test_names:
            return "<div>No tests selected for comparison</div>"
        
        # Get recent data for each test
        recent_date = (datetime.now() - timedelta(days=7)).isoformat()
        
        comparison_data = []
        for test_name in test_names:
            df = self.db.get_performance_trends(test_name, days_back=7)
            if not df.empty:
                latest = df.iloc[-1]
                comparison_data.append({
                    'test_name': test_name,
                    'avg_response_time_ms': latest['avg_response_time_ms'],
                    'throughput_rps': latest['throughput_rps'],
                    'memory_peak_mb': latest['memory_peak_mb'],
                    'success_rate': latest['success_rate']
                })
        
        if not comparison_data:
            return "<div>No recent data available for comparison</div>"
        
        df_comparison = pd.DataFrame(comparison_data)
        
        # Create comparison chart
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Response Time Comparison', 'Throughput Comparison',
                          'Memory Usage Comparison', 'Success Rate Comparison'),
            specs=[[{"type": "bar"}, {"type": "bar"}],
                   [{"type": "bar"}, {"type": "bar"}]]
        )
        
        # Response time bars
        fig.add_trace(
            go.Bar(
                x=df_comparison['test_name'],
                y=df_comparison['avg_response_time_ms'],
                name='Response Time',
                marker_color='lightblue'
            ),
            row=1, col=1
        )
        
        # Throughput bars
        fig.add_trace(
            go.Bar(
                x=df_comparison['test_name'],
                y=df_comparison['throughput_rps'],
                name='Throughput',
                marker_color='lightgreen'
            ),
            row=1, col=2
        )
        
        # Memory bars
        fig.add_trace(
            go.Bar(
                x=df_comparison['test_name'],
                y=df_comparison['memory_peak_mb'],
                name='Memory',
                marker_color='lightyellow'
            ),
            row=2, col=1
        )
        
        # Success rate bars
        fig.add_trace(
            go.Bar(
                x=df_comparison['test_name'],
                y=df_comparison['success_rate'],
                name='Success Rate',
                marker_color='lightcoral'
            ),
            row=2, col=2
        )
        
        fig.update_xaxes(tickangle=45)
        fig.update_yaxes(title_text="Response Time (ms)", row=1, col=1)
        fig.update_yaxes(title_text="Requests/Second", row=1, col=2)
        fig.update_yaxes(title_text="Memory (MB)", row=2, col=1)
        fig.update_yaxes(title_text="Success Rate (%)", row=2, col=2)
        
        fig.update_layout(
            height=600,
            title_text="Performance Comparison (Latest Results)",
            title_x=0.5,
            showlegend=False
        )
        
        return fig.to_html(include_plotlyjs='inline')
    
    def create_regression_alert_chart(self) -> str:
        """Create regression alert summary chart"""
        regressions = self.db.detect_performance_regressions()
        
        if not regressions:
            return "<div class='alert alert-success'>No performance regressions detected</div>"
        
        # Group by severity
        severity_counts = {}
        for reg in regressions:
            severity = reg['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Create pie chart
        fig = go.Figure(data=[go.Pie(
            labels=list(severity_counts.keys()),
            values=list(severity_counts.values()),
            hole=.3,
            marker_colors=['red' if s == 'critical' else 'orange' for s in severity_counts.keys()]
        )])
        
        fig.update_layout(
            title_text="Performance Regressions by Severity",
            annotations=[dict(text='Regressions', x=0.5, y=0.5, font_size=20, showarrow=False)]
        )
        
        return fig.to_html(include_plotlyjs='inline')

class PerformanceDashboard:
    """Web-based performance dashboard"""
    
    def __init__(self, database: PerformanceDatabase):
        self.db = database
        self.viz = PerformanceVisualization(database)
        self.app = web.Application()
        self._setup_routes()
        
    def _setup_routes(self):
        """Setup web routes"""
        self.app.router.add_get('/', self.dashboard_handler)
        self.app.router.add_get('/api/trends', self.trends_api_handler)
        self.app.router.add_get('/api/regressions', self.regressions_api_handler)
        self.app.router.add_get('/api/alerts', self.alerts_api_handler)
        self.app.router.add_static('/static', path='static', name='static')
        
        # Enable CORS
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        for route in list(self.app.router.routes()):
            cors.add(route)
    
    async def dashboard_handler(self, request):
        """Main dashboard page"""
        # Get performance trends
        trends_chart = self.viz.create_trend_chart(days_back=30)
        
        # Get recent test results
        recent_tests = self.db.get_performance_trends(days_back=7)
        test_summary = self._generate_test_summary(recent_tests)
        
        # Get active alerts
        alerts = self.db.get_active_alerts()
        
        # Get regressions
        regressions = self.db.detect_performance_regressions()
        regression_chart = self.viz.create_regression_alert_chart()
        
        # Generate HTML dashboard
        dashboard_html = self._generate_dashboard_html(
            trends_chart, test_summary, alerts, regressions, regression_chart
        )
        
        return web.Response(text=dashboard_html, content_type='text/html')
    
    async def trends_api_handler(self, request):
        """API endpoint for trends data"""
        test_name = request.query.get('test_name')
        days_back = int(request.query.get('days_back', 30))
        
        df = self.db.get_performance_trends(test_name, days_back)
        return web.json_response(df.to_dict('records'))
    
    async def regressions_api_handler(self, request):
        """API endpoint for regression data"""
        regressions = self.db.detect_performance_regressions()
        return web.json_response(regressions)
    
    async def alerts_api_handler(self, request):
        """API endpoint for alerts data"""
        alerts = self.db.get_active_alerts()
        return web.json_response(alerts)
    
    def _generate_test_summary(self, df: pd.DataFrame) -> Dict:
        """Generate test summary statistics"""
        if df.empty:
            return {'total_tests': 0, 'avg_response_time': 0, 'avg_throughput': 0}
        
        return {
            'total_tests': len(df),
            'unique_tests': df['test_name'].nunique(),
            'avg_response_time': df['avg_response_time_ms'].mean(),
            'avg_throughput': df['throughput_rps'].mean(),
            'avg_success_rate': df['success_rate'].mean(),
            'latest_timestamp': df['timestamp'].max()
        }
    
    def _generate_dashboard_html(self, trends_chart: str, test_summary: Dict,
                                alerts: List[Dict], regressions: List[Dict],
                                regression_chart: str) -> str:
        """Generate dashboard HTML"""
        
        html_template = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Schlep-engine Performance Dashboard</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                .metric-card { border-left: 4px solid #007bff; }
                .alert-critical { border-left-color: #dc3545; }
                .alert-warning { border-left-color: #ffc107; }
                .chart-container { height: 600px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-dark bg-dark">
                <div class="container">
                    <span class="navbar-brand">Schlep-engine Performance Dashboard</span>
                    <span class="navbar-text">Last Updated: {{ last_updated }}</span>
                </div>
            </nav>
            
            <div class="container mt-4">
                <!-- Summary Cards -->
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="card metric-card">
                            <div class="card-body">
                                <h5 class="card-title">Total Tests</h5>
                                <h3 class="text-primary">{{ summary.total_tests }}</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card metric-card">
                            <div class="card-body">
                                <h5 class="card-title">Avg Response Time</h5>
                                <h3 class="text-info">{{ "%.1f"|format(summary.avg_response_time) }}ms</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card metric-card">
                            <div class="card-body">
                                <h5 class="card-title">Avg Throughput</h5>
                                <h3 class="text-success">{{ "%.1f"|format(summary.avg_throughput) }} req/s</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card metric-card">
                            <div class="card-body">
                                <h5 class="card-title">Success Rate</h5>
                                <h3 class="text-warning">{{ "%.1f"|format(summary.avg_success_rate) }}%</h3>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Alerts Section -->
                {% if alerts %}
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h5>Active Performance Alerts</h5>
                            </div>
                            <div class="card-body">
                                {% for alert in alerts %}
                                <div class="alert alert-{{ 'danger' if alert.severity == 'critical' else 'warning' }} mb-2">
                                    <strong>{{ alert.test_name }}</strong> - {{ alert.message }}
                                    <small class="text-muted">({{ alert.timestamp }})</small>
                                </div>
                                {% endfor %}
                            </div>
                        </div>
                    </div>
                </div>
                {% endif %}
                
                <!-- Performance Trends -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h5>Performance Trends</h5>
                            </div>
                            <div class="card-body">
                                <div class="chart-container">
                                    {{ trends_chart | safe }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Regressions -->
                <div class="row mb-4">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h5>Performance Regressions</h5>
                            </div>
                            <div class="card-body">
                                {% if regressions %}
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Test</th>
                                                <th>Metric</th>
                                                <th>Change</th>
                                                <th>Severity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {% for reg in regressions %}
                                            <tr class="{{ 'table-danger' if reg.severity == 'critical' else 'table-warning' }}">
                                                <td>{{ reg.test_name }}</td>
                                                <td>{{ reg.metric }}</td>
                                                <td>{{ "%.1f"|format(reg.change_percent) }}%</td>
                                                <td>{{ reg.severity }}</td>
                                            </tr>
                                            {% endfor %}
                                        </tbody>
                                    </table>
                                </div>
                                {% else %}
                                <div class="alert alert-success">No performance regressions detected</div>
                                {% endif %}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5>Regression Summary</h5>
                            </div>
                            <div class="card-body">
                                {{ regression_chart | safe }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // Auto-refresh every 5 minutes
                setTimeout(() => location.reload(), 300000);
            </script>
        </body>
        </html>
        """
        
        from jinja2 import Template
        template = Template(html_template)
        
        return template.render(
            trends_chart=trends_chart,
            summary=test_summary,
            alerts=alerts,
            regressions=regressions,
            regression_chart=regression_chart,
            last_updated=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        )
    
    def run(self, host: str = '0.0.0.0', port: int = 8080):
        """Run the dashboard server"""
        web.run_app(self.app, host=host, port=port)

class PerformanceReportGenerator:
    """Generate comprehensive performance reports"""
    
    def __init__(self, database: PerformanceDatabase):
        self.db = database
        self.viz = PerformanceVisualization(database)
    
    def generate_comprehensive_report(self, output_dir: str = "performance_reports") -> str:
        """Generate comprehensive performance report"""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate trend analysis
        trends_chart = self.viz.create_trend_chart(days_back=90)
        
        # Get performance summary
        recent_tests = self.db.get_performance_trends(days_back=30)
        
        # Detect regressions
        regressions = self.db.detect_performance_regressions()
        
        # Generate HTML report
        report_html = self._generate_comprehensive_html(
            trends_chart, recent_tests, regressions, timestamp
        )
        
        report_file = output_path / f"performance_report_{timestamp}.html"
        with open(report_file, 'w') as f:
            f.write(report_html)
        
        # Generate JSON summary
        summary_data = {
            'timestamp': timestamp,
            'total_tests': len(recent_tests),
            'regressions_count': len(regressions),
            'average_metrics': {
                'response_time_ms': recent_tests['avg_response_time_ms'].mean() if not recent_tests.empty else 0,
                'throughput_rps': recent_tests['throughput_rps'].mean() if not recent_tests.empty else 0,
                'success_rate': recent_tests['success_rate'].mean() if not recent_tests.empty else 0
            },
            'regressions': regressions
        }
        
        json_file = output_path / f"performance_summary_{timestamp}.json"
        with open(json_file, 'w') as f:
            json.dump(summary_data, f, indent=2)
        
        logger.info(f"Performance report generated: {report_file}")
        return str(report_file)
    
    def _generate_comprehensive_html(self, trends_chart: str, recent_tests: pd.DataFrame,
                                   regressions: List[Dict], timestamp: str) -> str:
        """Generate comprehensive HTML report"""
        
        html_template = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Schlep-engine Performance Report - {{ timestamp }}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @media print {
                    .no-print { display: none; }
                }
                .metric-highlight { font-size: 1.5em; font-weight: bold; color: #007bff; }
            </style>
        </head>
        <body>
            <div class="container mt-4">
                <div class="row">
                    <div class="col-12">
                        <h1 class="text-center">Schlep-engine Performance Report</h1>
                        <p class="text-center text-muted">Generated: {{ timestamp }}</p>
                        <hr>
                    </div>
                </div>
                
                <!-- Executive Summary -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Executive Summary</h2>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h5>Total Tests</h5>
                                        <div class="metric-highlight">{{ total_tests }}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h5>Regressions Found</h5>
                                        <div class="metric-highlight {{ 'text-danger' if regressions|length > 0 else 'text-success' }}">
                                            {{ regressions|length }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card text-center">
                                    <div class="card-body">
                                        <h5>Overall Status</h5>
                                        <div class="metric-highlight {{ 'text-danger' if regressions|length > 0 else 'text-success' }}">
                                            {{ 'Issues Found' if regressions|length > 0 else 'Healthy' }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Performance Trends -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Performance Trends (Last 90 Days)</h2>
                        <div class="card">
                            <div class="card-body">
                                {{ trends_chart | safe }}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Regression Analysis -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Performance Regression Analysis</h2>
                        {% if regressions %}
                        <div class="alert alert-warning">
                            <strong>{{ regressions|length }} performance regression(s) detected.</strong>
                            Immediate investigation recommended.
                        </div>
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Test Name</th>
                                        <th>Metric</th>
                                        <th>Baseline Value</th>
                                        <th>Recent Value</th>
                                        <th>Change (%)</th>
                                        <th>Severity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {% for reg in regressions %}
                                    <tr class="{{ 'table-danger' if reg.severity == 'critical' else 'table-warning' }}">
                                        <td>{{ reg.test_name }}</td>
                                        <td>{{ reg.metric }}</td>
                                        <td>{{ "%.2f"|format(reg.baseline_value) }}</td>
                                        <td>{{ "%.2f"|format(reg.recent_value) }}</td>
                                        <td>{{ "%.1f"|format(reg.change_percent) }}%</td>
                                        <td>
                                            <span class="badge {{ 'bg-danger' if reg.severity == 'critical' else 'bg-warning' }}">
                                                {{ reg.severity }}
                                            </span>
                                        </td>
                                    </tr>
                                    {% endfor %}
                                </tbody>
                            </table>
                        </div>
                        {% else %}
                        <div class="alert alert-success">
                            <strong>No performance regressions detected.</strong>
                            All systems operating within normal parameters.
                        </div>
                        {% endif %}
                    </div>
                </div>
                
                <!-- Recommendations -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Recommendations</h2>
                        <div class="card">
                            <div class="card-body">
                                {% if regressions %}
                                <h5>Immediate Actions Required:</h5>
                                <ul>
                                    {% for reg in regressions %}
                                    {% if reg.severity == 'critical' %}
                                    <li class="text-danger">
                                        <strong>Critical:</strong> Investigate {{ reg.test_name }} - {{ reg.metric }} 
                                        has degraded by {{ "%.1f"|format(reg.change_percent) }}%
                                    </li>
                                    {% endif %}
                                    {% endfor %}
                                    {% for reg in regressions %}
                                    {% if reg.severity == 'warning' %}
                                    <li class="text-warning">
                                        <strong>Warning:</strong> Monitor {{ reg.test_name }} - {{ reg.metric }} 
                                        has changed by {{ "%.1f"|format(reg.change_percent) }}%
                                    </li>
                                    {% endif %}
                                    {% endfor %}
                                </ul>
                                {% else %}
                                <h5>Maintenance Recommendations:</h5>
                                <ul>
                                    <li>Continue regular performance monitoring</li>
                                    <li>Maintain current optimization practices</li>
                                    <li>Consider expanding test coverage for better insights</li>
                                </ul>
                                {% endif %}
                            </div>
                        </div>
                    </div>
                </div>
                
                <footer class="text-center text-muted mt-5">
                    <small>Generated by Schlep-engine Performance Testing Framework</small>
                </footer>
            </div>
        </body>
        </html>
        """
        
        from jinja2 import Template
        template = Template(html_template)
        
        return template.render(
            timestamp=timestamp,
            total_tests=len(recent_tests),
            trends_chart=trends_chart,
            regressions=regressions
        )

async def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description="Performance Dashboard and Reporting")
    parser.add_argument('--port', type=int, default=8080, help='Dashboard port')
    parser.add_argument('--host', default='0.0.0.0', help='Dashboard host')
    parser.add_argument('--generate-report', action='store_true', help='Generate static report')
    parser.add_argument('--output', default='performance_reports', help='Report output directory')
    parser.add_argument('--import-data', help='Import test data from JSON file')
    
    args = parser.parse_args()
    
    # Initialize database
    db = PerformanceDatabase()
    
    # Import data if specified
    if args.import_data:
        with open(args.import_data, 'r') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            for test_result in data:
                db.store_test_result(test_result)
        else:
            db.store_test_result(data)
        
        print(f"Data imported from {args.import_data}")
    
    # Generate report if requested
    if args.generate_report:
        reporter = PerformanceReportGenerator(db)
        report_file = reporter.generate_comprehensive_report(args.output)
        print(f"Performance report generated: {report_file}")
        return
    
    # Start dashboard server
    dashboard = PerformanceDashboard(db)
    print(f"Starting performance dashboard at http://{args.host}:{args.port}")
    dashboard.run(host=args.host, port=args.port)

if __name__ == "__main__":
    asyncio.run(main())