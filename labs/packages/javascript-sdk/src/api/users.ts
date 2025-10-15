/**
 * Users API for Schlep-engine JavaScript SDK
 * Provides user management and profile operations
 */

import { BaseAPI } from './base';
import { APIResponse } from '../types/common';
import { UserInfo, UserProfile, UserPreferences, APIKey } from '../types/auth';

/**
 * User activity log entry
 */
export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * User session information
 */
export interface UserSession {
  session_id: string;
  user_id: string;
  device: string;
  ip_address: string;
  location?: string;
  created_at: string;
  last_active: string;
  is_current: boolean;
}

/**
 * User notification settings
 */
export interface NotificationSettings {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  notification_types: Record<string, boolean>;
  frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly';
  quiet_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

/**
 * Users API client
 *
 * Provides comprehensive user management capabilities including profile management,
 * activity tracking, session management, and preference configuration.
 *
 * @example
 * ```typescript
 * // Get current user profile
 * const profile = await client.users.getProfile();
 *
 * // Update profile
 * await client.users.updateProfile({
 *   first_name: 'John',
 *   last_name: 'Doe',
 *   phone: '+1234567890'
 * });
 *
 * // Get user activity
 * const activity = await client.users.getActivity();
 * ```
 */
export class UsersAPI extends BaseAPI {
  protected override basePath = '/users';

  /**
   * Get current user profile
   *
   * Retrieves the authenticated user's profile information.
   *
   * @returns User profile
   *
   * @example
   * ```typescript
   * const profile = await client.users.getProfile();
   * console.log(`Welcome, ${profile.data.first_name}!`);
   * console.log(`Email: ${profile.data.email}`);
   * console.log(`Role: ${profile.data.role}`);
   * ```
   */
  async getProfile(): Promise<APIResponse<UserInfo>> {
    return this.get<UserInfo>('/me');
  }

  /**
   * Update user profile
   *
   * Updates the authenticated user's profile information.
   *
   * @param updates - Profile fields to update
   * @returns Updated user profile
   *
   * @example
   * ```typescript
   * const updated = await client.users.updateProfile({
   *   first_name: 'Jane',
   *   last_name: 'Smith',
   *   phone: '+1987654321',
   *   company: 'Acme Corp',
   *   job_title: 'Data Engineer'
   * });
   * ```
   */
  async updateProfile(
    updates: Partial<UserProfile>
  ): Promise<APIResponse<UserInfo>> {
    return this.patch<UserInfo>('/me', {
      params: updates as any
    });
  }

  /**
   * Change user password
   *
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Success confirmation
   *
   * @example
   * ```typescript
   * await client.users.changePassword('oldpass123', 'newpass456');
   * ```
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>('/me/password', {
      params: {
        current_password: currentPassword,
        new_password: newPassword
      } as any
    });
  }

  /**
   * Get user preferences
   *
   * Retrieves user-specific preferences and settings.
   *
   * @returns User preferences
   *
   * @example
   * ```typescript
   * const prefs = await client.users.getPreferences();
   * console.log('Theme:', prefs.data.theme);
   * console.log('Language:', prefs.data.language);
   * ```
   */
  async getPreferences(): Promise<APIResponse<UserPreferences>> {
    return this.get<UserPreferences>('/me/preferences');
  }

  /**
   * Update user preferences
   *
   * @param preferences - Preferences to update
   * @returns Updated preferences
   *
   * @example
   * ```typescript
   * await client.users.updatePreferences({
   *   theme: 'dark',
   *   language: 'en',
   *   timezone: 'America/New_York',
   *   date_format: 'MM/DD/YYYY',
   *   notifications_enabled: true
   * });
   * ```
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<APIResponse<UserPreferences>> {
    return this.patch<UserPreferences>('/me/preferences', {
      params: preferences as any
    });
  }

  /**
   * Get notification settings
   *
   * @returns Notification settings
   */
  async getNotificationSettings(): Promise<APIResponse<NotificationSettings>> {
    return this.get<NotificationSettings>('/me/notifications');
  }

  /**
   * Update notification settings
   *
   * @param settings - Notification settings to update
   * @returns Updated settings
   *
   * @example
   * ```typescript
   * await client.users.updateNotificationSettings({
   *   email_enabled: true,
   *   push_enabled: false,
   *   notification_types: {
   *     'job_completed': true,
   *     'job_failed': true,
   *     'quality_alert': true,
   *     'system_updates': false
   *   },
   *   frequency: 'daily'
   * });
   * ```
   */
  async updateNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<APIResponse<NotificationSettings>> {
    return this.patch<NotificationSettings>('/me/notifications', {
      params: settings as any
    });
  }

  /**
   * Get user activity log
   *
   * Retrieves the authenticated user's activity history.
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @param actionType - Optional filter by action type
   * @returns Paginated activity log
   *
   * @example
   * ```typescript
   * const activity = await client.users.getActivity(1, 50);
   *
   * activity.data.forEach(entry => {
   *   console.log(`[${entry.timestamp}] ${entry.action}`);
   *   if (entry.resource_type) {
   *     console.log(`  Resource: ${entry.resource_type}/${entry.resource_id}`);
   *   }
   * });
   * ```
   */
  async getActivity(
    page: number = 1,
    pageSize: number = 20,
    actionType?: string
  ): Promise<APIResponse<UserActivity[]>> {
    const params = this.buildQueryParams({
      page,
      page_size: pageSize,
      action_type: actionType
    });

    return this.paginatedRequest<UserActivity>('/me/activity', params);
  }

  /**
   * Get active sessions
   *
   * Retrieves all active sessions for the authenticated user.
   *
   * @returns List of active sessions
   *
   * @example
   * ```typescript
   * const sessions = await client.users.getSessions();
   *
   * sessions.data.forEach(session => {
   *   console.log(`Device: ${session.device}`);
   *   console.log(`Location: ${session.location}`);
   *   console.log(`Last active: ${session.last_active}`);
   *   console.log(`Current: ${session.is_current ? 'Yes' : 'No'}`);
   * });
   * ```
   */
  async getSessions(): Promise<APIResponse<UserSession[]>> {
    return this.get<UserSession[]>('/me/sessions');
  }

  /**
   * Revoke a session
   *
   * Terminates a specific user session.
   *
   * @param sessionId - Session ID to revoke
   * @returns Confirmation
   *
   * @example
   * ```typescript
   * await client.users.revokeSession('sess_abc123');
   * ```
   */
  async revokeSession(sessionId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/me/sessions/${sessionId}`);
  }

  /**
   * Revoke all sessions except current
   *
   * Terminates all sessions except the current one.
   *
   * @returns Confirmation
   */
  async revokeAllSessions(): Promise<APIResponse<{ revoked_count: number }>> {
    return this.post<{ revoked_count: number }>('/me/sessions/revoke-all');
  }

  /**
   * Create API key
   *
   * Generates a new API key for programmatic access.
   *
   * @param name - Key name/description
   * @param permissions - Optional permission scopes
   * @param expiresIn - Optional expiration in days
   * @returns Created API key
   *
   * @example
   * ```typescript
   * const apiKey = await client.users.createAPIKey(
   *   'Production API Key',
   *   ['data:read', 'data:write', 'ml:read'],
   *   90 // expires in 90 days
   * );
   *
   * console.log('API Key:', apiKey.data.key);
   * console.log('Keep this key secure!');
   * ```
   */
  async createAPIKey(
    name: string,
    permissions?: string[],
    expiresIn?: number
  ): Promise<APIResponse<APIKey>> {
    return this.post<APIKey>('/me/api-keys', {
      params: {
        name,
        permissions,
        expires_in: expiresIn
      } as any
    });
  }

  /**
   * List API keys
   *
   * Retrieves all API keys for the authenticated user.
   *
   * @returns List of API keys
   */
  async listAPIKeys(): Promise<APIResponse<APIKey[]>> {
    return this.get<APIKey[]>('/me/api-keys');
  }

  /**
   * Revoke API key
   *
   * Permanently revokes an API key.
   *
   * @param keyId - API key ID
   * @returns Confirmation
   */
  async revokeAPIKey(keyId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/me/api-keys/${keyId}`);
  }

  /**
   * Get usage statistics
   *
   * Retrieves usage statistics for the authenticated user.
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Usage statistics
   *
   * @example
   * ```typescript
   * const stats = await client.users.getUsageStats(
   *   '2025-09-01',
   *   '2025-09-30'
   * );
   *
   * console.log('API Calls:', stats.data.api_calls);
   * console.log('Data Processed:', stats.data.data_processed_gb, 'GB');
   * console.log('ML Pipeline Runs:', stats.data.ml_pipeline_runs);
   * ```
   */
  async getUsageStats(
    startDate: string,
    endDate: string
  ): Promise<APIResponse<{
    api_calls: number;
    data_processed_gb: number;
    ml_pipeline_runs: number;
    storage_used_gb: number;
    period: { start: string; end: string };
  }>> {
    return this.get<{
      api_calls: number;
      data_processed_gb: number;
      ml_pipeline_runs: number;
      storage_used_gb: number;
      period: { start: string; end: string };
    }>('/me/usage', {
      params: {
        start_date: startDate,
        end_date: endDate
      } as any
    });
  }

  /**
   * Upload profile picture
   *
   * @param file - Image file
   * @returns Updated profile with picture URL
   *
   * @example
   * ```typescript
   * const profile = await client.users.uploadProfilePicture(imageFile);
   * console.log('Profile picture URL:', profile.data.profile_picture_url);
   * ```
   */
  async uploadProfilePicture(
    file: File | Blob
  ): Promise<APIResponse<UserInfo>> {
    return this.uploadFile<UserInfo>('/me/picture', file);
  }

  /**
   * Delete account
   *
   * Permanently deletes the user account. This action cannot be undone.
   *
   * @param password - User password for confirmation
   * @returns Deletion confirmation
   */
  async deleteAccount(
    password: string
  ): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>('/me/delete', {
      params: { password } as any
    });
  }

  /**
   * Export user data
   *
   * Requests an export of all user data (GDPR compliance).
   *
   * @param format - Export format (json or csv)
   * @returns Export job information
   *
   * @example
   * ```typescript
   * const exportJob = await client.users.exportData('json');
   * console.log('Export job ID:', exportJob.data.job_id);
   * console.log('Download URL will be emailed when ready');
   * ```
   */
  async exportData(
    format: 'json' | 'csv' = 'json'
  ): Promise<APIResponse<{ job_id: string; estimated_completion: string }>> {
    return this.post<{ job_id: string; estimated_completion: string }>(
      '/me/export',
      { params: { format } as any }
    );
  }
}

export default UsersAPI;