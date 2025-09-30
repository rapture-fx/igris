/**
 * Admin API for Schlep-engine JavaScript SDK
 * Provides administrative functions for system management (admin only)
 */

import { BaseAPI } from './base';
import { APIResponse } from '../types/common';
import { UserInfo } from '../types/auth';

/**
 * System statistics
 */
export interface SystemStats {
  users: {
    total: number;
    active: number;
    new_last_30_days: number;
  };
  api_usage: {
    total_requests: number;
    requests_last_24h: number;
    avg_response_time_ms: number;
  };
  data_processing: {
    total_jobs: number;
    jobs_running: number;
    jobs_completed_last_24h: number;
    total_data_processed_gb: number;
  };
  storage: {
    total_used_gb: number;
    total_files: number;
  };
  ml_pipelines: {
    total_pipelines: number;
    active_pipelines: number;
    training_jobs_last_24h: number;
  };
  system_health: {
    status: 'healthy' | 'degraded' | 'down';
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
  };
  timestamp: string;
}

/**
 * User management information
 */
export interface AdminUserInfo extends UserInfo {
  created_at: string;
  last_login?: string;
  login_count: number;
  is_active: boolean;
  is_verified: boolean;
  api_key_count: number;
  storage_used_gb: number;
}

/**
 * System configuration
 */
export interface SystemConfig {
  maintenance_mode: boolean;
  api_rate_limits: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
  storage_limits: {
    per_user_gb: number;
    total_gb: number;
  };
  data_retention: {
    logs_days: number;
    jobs_days: number;
    inactive_data_days: number;
  };
  features: {
    ml_pipelines_enabled: boolean;
    document_extraction_enabled: boolean;
    analytics_enabled: boolean;
    websocket_enabled: boolean;
  };
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error_message?: string;
  timestamp: string;
}

/**
 * System alert
 */
export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
  resolved_at?: string;
}

/**
 * Admin API client
 *
 * Provides administrative functions for system management, user administration,
 * monitoring, and configuration. Requires admin privileges.
 *
 * @example
 * ```typescript
 * // Get system statistics
 * const stats = await client.admin.getSystemStats();
 * console.log('Total users:', stats.data.users.total);
 * console.log('API requests (24h):', stats.data.api_usage.requests_last_24h);
 *
 * // List all users
 * const users = await client.admin.listUsers(1, 50);
 *
 * // Update system configuration
 * await client.admin.updateConfig({
 *   maintenance_mode: false,
 *   api_rate_limits: {
 *     requests_per_minute: 1000,
 *     requests_per_hour: 50000
 *   }
 * });
 * ```
 */
export class AdminAPI extends BaseAPI {
  protected override basePath = '/admin';

  /**
   * Get system statistics
   *
   * Retrieves comprehensive system statistics including users, API usage,
   * data processing, and resource utilization.
   *
   * @returns System statistics
   *
   * @example
   * ```typescript
   * const stats = await client.admin.getSystemStats();
   *
   * console.log('System Health:', stats.data.system_health.status);
   * console.log('CPU Usage:', stats.data.system_health.cpu_usage, '%');
   * console.log('Memory Usage:', stats.data.system_health.memory_usage, '%');
   * console.log('Active Users:', stats.data.users.active);
   * console.log('API Requests (24h):', stats.data.api_usage.requests_last_24h);
   * ```
   */
  async getSystemStats(): Promise<APIResponse<SystemStats>> {
    return this.get<SystemStats>('/stats');
  }

  /**
   * List all users
   *
   * Retrieves a paginated list of all users in the system.
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @param filters - Optional filters (email, role, is_active, etc.)
   * @returns Paginated list of users
   *
   * @example
   * ```typescript
   * const users = await client.admin.listUsers(1, 50, {
   *   is_active: true,
   *   role: 'user'
   * });
   *
   * users.data.forEach(user => {
   *   console.log(`${user.email} - ${user.role} - Last login: ${user.last_login}`);
   * });
   * ```
   */
  async listUsers(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      email?: string;
      role?: string;
      is_active?: boolean;
      is_verified?: boolean;
    }
  ): Promise<APIResponse<AdminUserInfo[]>> {
    const params = this.buildQueryParams({
      page,
      page_size: pageSize,
      ...filters
    });

    return this.paginatedRequest<AdminUserInfo>('/users', params);
  }

  /**
   * Get user by ID
   *
   * Retrieves detailed information about a specific user.
   *
   * @param userId - User ID
   * @returns User information
   */
  async getUser(userId: string): Promise<APIResponse<AdminUserInfo>> {
    return this.get<AdminUserInfo>(`/users/${userId}`);
  }

  /**
   * Update user
   *
   * Updates user information (admin can modify any user).
   *
   * @param userId - User ID
   * @param updates - User fields to update
   * @returns Updated user information
   *
   * @example
   * ```typescript
   * await client.admin.updateUser('user_123', {
   *   role: 'premium',
   *   is_active: true,
   *   storage_limit_gb: 100
   * });
   * ```
   */
  async updateUser(
    userId: string,
    updates: Partial<AdminUserInfo>
  ): Promise<APIResponse<AdminUserInfo>> {
    return this.patch<AdminUserInfo>(`/users/${userId}`, {
      params: updates as any
    });
  }

  /**
   * Delete user
   *
   * Permanently deletes a user account and all associated data.
   *
   * @param userId - User ID
   * @param hardDelete - If true, permanently deletes. If false, soft deletes.
   * @returns Deletion confirmation
   */
  async deleteUser(
    userId: string,
    hardDelete: boolean = false
  ): Promise<APIResponse<{ message: string }>> {
    return this.delete<{ message: string }>(`/users/${userId}`, {
      params: { hard_delete: hardDelete } as any
    });
  }

  /**
   * Suspend user
   *
   * Temporarily suspends a user account.
   *
   * @param userId - User ID
   * @param reason - Suspension reason
   * @returns Confirmation
   */
  async suspendUser(
    userId: string,
    reason: string
  ): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>(`/users/${userId}/suspend`, {
      params: { reason } as any
    });
  }

  /**
   * Reactivate user
   *
   * Reactivates a suspended user account.
   *
   * @param userId - User ID
   * @returns Confirmation
   */
  async reactivateUser(
    userId: string
  ): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>(`/users/${userId}/reactivate`);
  }

  /**
   * Get system configuration
   *
   * Retrieves current system configuration.
   *
   * @returns System configuration
   */
  async getConfig(): Promise<APIResponse<SystemConfig>> {
    return this.get<SystemConfig>('/config');
  }

  /**
   * Update system configuration
   *
   * Updates system-wide configuration settings.
   *
   * @param config - Configuration updates
   * @returns Updated configuration
   *
   * @example
   * ```typescript
   * await client.admin.updateConfig({
   *   maintenance_mode: false,
   *   api_rate_limits: {
   *     requests_per_minute: 1000,
   *     requests_per_hour: 50000
   *   },
   *   features: {
   *     ml_pipelines_enabled: true,
   *     document_extraction_enabled: true,
   *     analytics_enabled: true,
   *     websocket_enabled: true
   *   }
   * });
   * ```
   */
  async updateConfig(
    config: Partial<SystemConfig>
  ): Promise<APIResponse<SystemConfig>> {
    return this.patch<SystemConfig>('/config', {
      params: config as any
    });
  }

  /**
   * Get audit logs
   *
   * Retrieves system audit logs for tracking all administrative actions.
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @param filters - Optional filters
   * @returns Paginated audit logs
   *
   * @example
   * ```typescript
   * const logs = await client.admin.getAuditLogs(1, 100, {
   *   user_id: 'user_123',
   *   action: 'user.update',
   *   start_date: '2025-09-01',
   *   end_date: '2025-09-30'
   * });
   *
   * logs.data.forEach(log => {
   *   console.log(`[${log.timestamp}] ${log.user_email}: ${log.action}`);
   *   if (log.changes) {
   *     console.log('Changes:', log.changes);
   *   }
   * });
   * ```
   */
  async getAuditLogs(
    page: number = 1,
    pageSize: number = 50,
    filters?: {
      user_id?: string;
      action?: string;
      resource_type?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<APIResponse<AuditLog[]>> {
    const params = this.buildQueryParams({
      page,
      page_size: pageSize,
      ...filters
    });

    return this.paginatedRequest<AuditLog>('/audit-logs', params);
  }

  /**
   * Get system alerts
   *
   * Retrieves active system alerts and warnings.
   *
   * @param severity - Optional severity filter
   * @param includeResolved - Include resolved alerts
   * @returns List of system alerts
   *
   * @example
   * ```typescript
   * const alerts = await client.admin.getSystemAlerts('high', false);
   *
   * alerts.data.forEach(alert => {
   *   console.log(`[${alert.severity}] ${alert.title}`);
   *   console.log(alert.message);
   * });
   * ```
   */
  async getSystemAlerts(
    severity?: 'low' | 'medium' | 'high' | 'critical',
    includeResolved: boolean = false
  ): Promise<APIResponse<SystemAlert[]>> {
    return this.get<SystemAlert[]>('/alerts', {
      params: {
        severity,
        include_resolved: includeResolved
      } as any
    });
  }

  /**
   * Acknowledge alert
   *
   * Marks a system alert as acknowledged.
   *
   * @param alertId - Alert ID
   * @returns Updated alert
   */
  async acknowledgeAlert(
    alertId: string
  ): Promise<APIResponse<SystemAlert>> {
    return this.post<SystemAlert>(`/alerts/${alertId}/acknowledge`);
  }

  /**
   * Resolve alert
   *
   * Marks a system alert as resolved.
   *
   * @param alertId - Alert ID
   * @returns Updated alert
   */
  async resolveAlert(alertId: string): Promise<APIResponse<SystemAlert>> {
    return this.post<SystemAlert>(`/alerts/${alertId}/resolve`);
  }

  /**
   * Get resource usage by user
   *
   * Retrieves detailed resource usage statistics for all users.
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns User resource usage data
   */
  async getUserResourceUsage(
    startDate: string,
    endDate: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<APIResponse<Array<{
    user_id: string;
    user_email: string;
    api_calls: number;
    data_processed_gb: number;
    storage_used_gb: number;
    ml_pipeline_runs: number;
  }>>> {
    const params = this.buildQueryParams({
      start_date: startDate,
      end_date: endDate,
      page,
      page_size: pageSize
    });

    return this.paginatedRequest<{
      user_id: string;
      user_email: string;
      api_calls: number;
      data_processed_gb: number;
      storage_used_gb: number;
      ml_pipeline_runs: number;
    }>('/usage', params);
  }

  /**
   * Cleanup old data
   *
   * Triggers cleanup of old logs, jobs, and data based on retention policies.
   *
   * @param resourceTypes - Types of resources to clean up
   * @returns Cleanup results
   *
   * @example
   * ```typescript
   * const result = await client.admin.cleanupData([
   *   'logs',
   *   'completed_jobs',
   *   'temporary_files'
   * ]);
   *
   * console.log('Cleanup results:', result.data);
   * ```
   */
  async cleanupData(
    resourceTypes: string[]
  ): Promise<APIResponse<{
    cleaned: Record<string, number>;
    total_freed_gb: number;
  }>> {
    return this.post<{
      cleaned: Record<string, number>;
      total_freed_gb: number;
    }>('/cleanup', {
      params: { resource_types: resourceTypes } as any
    });
  }

  /**
   * Backup system data
   *
   * Initiates a system-wide backup operation.
   *
   * @param includeUserData - Include user data in backup
   * @returns Backup job information
   */
  async backupSystem(
    includeUserData: boolean = true
  ): Promise<APIResponse<{
    job_id: string;
    estimated_completion: string;
    backup_size_estimate_gb: number;
  }>> {
    return this.post<{
      job_id: string;
      estimated_completion: string;
      backup_size_estimate_gb: number;
    }>('/backup', {
      params: { include_user_data: includeUserData } as any
    });
  }

  /**
   * Get backup status
   *
   * @param jobId - Backup job ID
   * @returns Backup status
   */
  async getBackupStatus(
    jobId: string
  ): Promise<APIResponse<{
    job_id: string;
    status: string;
    progress_percentage: number;
    backup_size_gb?: number;
    download_url?: string;
  }>> {
    return this.get<{
      job_id: string;
      status: string;
      progress_percentage: number;
      backup_size_gb?: number;
      download_url?: string;
    }>(`/backup/${jobId}`);
  }

  /**
   * Enable maintenance mode
   *
   * Puts the system into maintenance mode, blocking all user API requests.
   *
   * @param message - Maintenance message to display to users
   * @returns Confirmation
   */
  async enableMaintenanceMode(
    message: string = 'System is under maintenance. Please try again later.'
  ): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>('/maintenance/enable', {
      params: { message } as any
    });
  }

  /**
   * Disable maintenance mode
   *
   * Takes the system out of maintenance mode, restoring normal operations.
   *
   * @returns Confirmation
   */
  async disableMaintenanceMode(): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>('/maintenance/disable');
  }

  /**
   * Get system health check
   *
   * Performs comprehensive health check on all system components.
   *
   * @returns Health check results
   */
  async healthCheck(): Promise<APIResponse<{
    status: 'healthy' | 'degraded' | 'down';
    components: Record<string, {
      status: 'up' | 'down' | 'degraded';
      message?: string;
      response_time_ms?: number;
    }>;
    timestamp: string;
  }>> {
    return this.get<{
      status: 'healthy' | 'degraded' | 'down';
      components: Record<string, {
        status: 'up' | 'down' | 'degraded';
        message?: string;
        response_time_ms?: number;
      }>;
      timestamp: string;
    }>('/health');
  }
}

export default AdminAPI;