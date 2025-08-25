/**
 * Monitoring API for Schlep-engine JavaScript SDK
 */

import { BaseAPI } from './base';
import { APIResponse, HealthCheckResponse } from '../types/common';

/**
 * System metrics interface
 */
export interface SystemMetrics {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  requests_per_minute: number;
  error_rate: number;
  average_response_time: number;
}

/**
 * Alert configuration interface
 */
export interface AlertConfig {
  alert_id?: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration_minutes: number;
  notification_channels: string[];
  is_active: boolean;
  description?: string;
}

/**
 * Alert instance interface
 */
export interface Alert {
  alert_id: string;
  config: AlertConfig;
  status: 'triggered' | 'resolved' | 'acknowledged';
  triggered_at?: string;
  resolved_at?: string;
  acknowledged_at?: string;
  current_value: number;
  message: string;
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
  trace_id?: string;
  span_id?: string;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  status_code: number;
  response_time: number;
  timestamp: string;
  user_id?: string;
  request_id?: string;
}

/**
 * Usage statistics interface
 */
export interface UsageStats {
  period: string;
  total_requests: number;
  unique_users: number;
  data_processed_gb: number;
  models_trained: number;
  predictions_made: number;
  storage_used_gb: number;
  compute_hours: number;
  cost_estimate: number;
}

/**
 * Monitoring API client
 * Provides methods for system monitoring, alerting, and logging
 */
export class MonitoringAPI extends BaseAPI {
  constructor(client: any) {
    super(client);
    this.basePath = '/monitoring';
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<APIResponse<HealthCheckResponse>> {
    return this.get<HealthCheckResponse>('/health');
  }

  /**
   * Get detailed system status
   */
  async getSystemStatus(): Promise<APIResponse<{
    overall_status: 'healthy' | 'degraded' | 'down';
    services: Record<string, {
      status: 'up' | 'down' | 'degraded';
      response_time?: number;
      error_rate?: number;
      last_check: string;
    }>;
    infrastructure: {
      database: 'up' | 'down';
      redis: 'up' | 'down';
      storage: 'up' | 'down';
      ml_cluster: 'up' | 'down';
    };
    recent_incidents?: Array<{
      incident_id: string;
      title: string;
      status: string;
      started_at: string;
    }>;
  }>> {
    return this.get('/status');
  }

  /**
   * Get system metrics
   */
  async getMetrics(params?: {
    startTime?: string;
    endTime?: string;
    granularity?: 'minute' | 'hour' | 'day';
    metrics?: string[];
  }): Promise<APIResponse<{
    metrics: SystemMetrics[];
    summary: {
      avg_cpu: number;
      avg_memory: number;
      peak_requests: number;
      avg_response_time: number;
    };
  }>> {
    return this.get('/metrics', { params });
  }

  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics(): Promise<APIResponse<SystemMetrics>> {
    return this.get('/metrics/realtime');
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(params?: {
    startTime?: string;
    endTime?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    page?: number;
    pageSize?: number;
  }): Promise<APIResponse<{
    metrics: PerformanceMetrics[];
    summary: {
      avg_response_time: number;
      p95_response_time: number;
      error_rate: number;
      total_requests: number;
    };
  }>> {
    return this.paginatedRequest('/performance', params);
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(params?: {
    period?: 'hour' | 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
    breakdown?: 'user' | 'service' | 'endpoint';
  }): Promise<APIResponse<UsageStats[]>> {
    return this.get('/usage', { params });
  }

  /**
   * Create alert configuration
   */
  async createAlert(config: Omit<AlertConfig, 'alert_id'>): Promise<APIResponse<AlertConfig>> {
    this.validateRequired(config, ['name', 'metric', 'condition', 'threshold', 'notification_channels']);
    return this.post<AlertConfig>('/alerts', { params: config });
  }

  /**
   * Update alert configuration
   */
  async updateAlert(alertId: string, updates: Partial<AlertConfig>): Promise<APIResponse<AlertConfig>> {
    this.validateRequired({ alertId }, ['alertId']);
    return this.patch<AlertConfig>(`/alerts/${alertId}`, { params: updates });
  }

  /**
   * Delete alert configuration
   */
  async deleteAlert(alertId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ alertId }, ['alertId']);
    return this.delete<{ message: string }>(`/alerts/${alertId}`);
  }

  /**
   * List alert configurations
   */
  async listAlertConfigs(params?: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    metric?: string;
  }): Promise<APIResponse<AlertConfig[]>> {
    return this.paginatedRequest('/alerts', params);
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<APIResponse<Alert[]>> {
    return this.get('/alerts/active');
  }

  /**
   * Get alert history
   */
  async getAlertHistory(params?: {
    alertId?: string;
    startTime?: string;
    endTime?: string;
    status?: 'triggered' | 'resolved' | 'acknowledged';
    page?: number;
    pageSize?: number;
  }): Promise<APIResponse<Alert[]>> {
    return this.paginatedRequest('/alerts/history', params);
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, message?: string): Promise<APIResponse<Alert>> {
    this.validateRequired({ alertId }, ['alertId']);
    return this.post<Alert>(`/alerts/${alertId}/acknowledge`, {
      params: { message }
    });
  }

  /**
   * Resolve alert manually
   */
  async resolveAlert(alertId: string, message?: string): Promise<APIResponse<Alert>> {
    this.validateRequired({ alertId }, ['alertId']);
    return this.post<Alert>(`/alerts/${alertId}/resolve`, {
      params: { message }
    });
  }

  /**
   * Get system logs
   */
  async getLogs(params?: {
    startTime?: string;
    endTime?: string;
    level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    service?: string;
    search?: string;
    traceId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<APIResponse<{
    logs: LogEntry[];
    total_count: number;
    log_levels_breakdown: Record<string, number>;
  }>> {
    return this.paginatedRequest('/logs', params);
  }

  /**
   * Search logs
   */
  async searchLogs(
    query: string,
    params?: {
      startTime?: string;
      endTime?: string;
      level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
      service?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<APIResponse<LogEntry[]>> {
    this.validateRequired({ query }, ['query']);
    return this.paginatedRequest('/logs/search', {
      q: query,
      ...this.buildQueryParams(params || {})
    });
  }

  /**
   * Get error logs
   */
  async getErrorLogs(params?: {
    startTime?: string;
    endTime?: string;
    service?: string;
    grouped?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<APIResponse<{
    errors: Array<LogEntry & {
      count?: number;
      first_occurred?: string;
      last_occurred?: string;
    }>;
    error_rate: number;
    top_errors: Array<{
      message: string;
      count: number;
      service: string;
    }>;
  }>> {
    return this.paginatedRequest('/logs/errors', params);
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(params?: {
    userId?: string;
    action?: string;
    resource?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
  }): Promise<APIResponse<Array<{
    audit_id: string;
    user_id: string;
    user_email: string;
    action: string;
    resource: string;
    resource_id?: string;
    details: Record<string, unknown>;
    ip_address: string;
    user_agent: string;
    timestamp: string;
  }>>> {
    return this.paginatedRequest('/audit', params);
  }

  /**
   * Get uptime statistics
   */
  async getUptimeStats(params?: {
    period?: 'day' | 'week' | 'month' | 'year';
    service?: string;
  }): Promise<APIResponse<{
    overall_uptime: number;
    service_uptimes: Record<string, {
      uptime_percentage: number;
      total_downtime_minutes: number;
      incident_count: number;
    }>;
    incidents: Array<{
      incident_id: string;
      service: string;
      started_at: string;
      resolved_at?: string;
      duration_minutes: number;
      impact: 'low' | 'medium' | 'high';
    }>;
  }>> {
    return this.get('/uptime', { params });
  }

  /**
   * Set up custom dashboard
   */
  async createDashboard(dashboard: {
    name: string;
    description?: string;
    widgets: Array<{
      type: 'metric' | 'chart' | 'log' | 'alert';
      config: Record<string, unknown>;
      position: { x: number; y: number; width: number; height: number };
    }>;
    is_public?: boolean;
  }): Promise<APIResponse<{
    dashboard_id: string;
    name: string;
    created_at: string;
  }>> {
    this.validateRequired(dashboard, ['name', 'widgets']);
    return this.post('/dashboards', { params: dashboard });
  }

  /**
   * Get dashboard
   */
  async getDashboard(dashboardId: string): Promise<APIResponse<{
    dashboard_id: string;
    name: string;
    description?: string;
    widgets: Array<{
      widget_id: string;
      type: string;
      config: Record<string, unknown>;
      position: { x: number; y: number; width: number; height: number };
    }>;
    created_at: string;
    updated_at: string;
  }>> {
    this.validateRequired({ dashboardId }, ['dashboardId']);
    return this.get(`/dashboards/${dashboardId}`);
  }

  /**
   * List dashboards
   */
  async listDashboards(): Promise<APIResponse<Array<{
    dashboard_id: string;
    name: string;
    description?: string;
    is_public: boolean;
    created_at: string;
  }>>> {
    return this.get('/dashboards');
  }

  /**
   * Export metrics data
   */
  async exportMetrics(params: {
    startTime: string;
    endTime: string;
    metrics: string[];
    format: 'csv' | 'json' | 'xlsx';
  }): Promise<APIResponse<{
    export_id: string;
    download_url: string;
    expires_at: string;
  }>> {
    this.validateRequired(params, ['startTime', 'endTime', 'metrics', 'format']);
    return this.post('/metrics/export', { params });
  }

  /**
   * Get API rate limits status
   */
  async getRateLimitsStatus(): Promise<APIResponse<{
    current_usage: Record<string, {
      requests_count: number;
      limit: number;
      window_minutes: number;
      reset_at: string;
    }>;
    rate_limit_policies: Array<{
      endpoint: string;
      method: string;
      limit: number;
      window_minutes: number;
    }>;
  }>> {
    return this.get('/rate-limits');
  }

  /**
   * Test notification channels
   */
  async testNotification(channel: string, message: string): Promise<APIResponse<{
    success: boolean;
    message: string;
    delivery_time_ms: number;
  }>> {
    this.validateRequired({ channel, message }, ['channel', 'message']);
    return this.post('/notifications/test', {
      params: { channel, message }
    });
  }
}

export default MonitoringAPI;