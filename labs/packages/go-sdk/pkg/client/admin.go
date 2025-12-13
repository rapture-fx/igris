package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// AdminClient handles administrative operations
type AdminClient struct {
	client *Client
}

// NewAdminClient creates a new admin client
func NewAdminClient(client *Client) *AdminClient {
	return &AdminClient{
		client: client,
	}
}

// SystemStats represents system statistics
type SystemStats struct {
	TotalUsers      int                    `json:"total_users"`
	ActiveUsers     int                    `json:"active_users"`
	TotalJobs       int                    `json:"total_jobs"`
	RunningJobs     int                    `json:"running_jobs"`
	CompletedJobs   int                    `json:"completed_jobs"`
	FailedJobs      int                    `json:"failed_jobs"`
	TotalDataSize   int64                  `json:"total_data_size_bytes"`
	TotalModels     int                    `json:"total_models"`
	ActiveModels    int                    `json:"active_models"`
	APICallsToday   int                    `json:"api_calls_today"`
	ErrorRateToday  float64                `json:"error_rate_today"`
	AvgResponseTime float64                `json:"avg_response_time_ms"`
	SystemHealth    string                 `json:"system_health"`      // healthy, degraded, unhealthy
	Timestamp       string                 `json:"timestamp"`
	Details         map[string]interface{} `json:"details,omitempty"`
}

// GetSystemStats retrieves system statistics
func (a *AdminClient) GetSystemStats(ctx context.Context) (*SystemStats, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_system_stats")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Fetching system statistics")

	// Make API request
	resp, err := a.client.Get(ctx, "/admin/stats")
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get system stats: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse stats
	statsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal stats data: %w", err)
	}

	var stats SystemStats
	if err := json.Unmarshal(statsBytes, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse system stats: %w", err)
	}

	span.SetAttributes(
		attribute.Int("stats.total_users", stats.TotalUsers),
		attribute.Int("stats.active_users", stats.ActiveUsers),
		attribute.Int("stats.running_jobs", stats.RunningJobs),
		attribute.String("stats.system_health", stats.SystemHealth),
	)

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"total_users":   stats.TotalUsers,
		"active_users":  stats.ActiveUsers,
		"running_jobs":  stats.RunningJobs,
		"system_health": stats.SystemHealth,
	}).Info("Retrieved system statistics")

	return &stats, nil
}

// AdminUser represents user information with admin privileges
type AdminUser struct {
	ID              string                 `json:"id"`
	Email           string                 `json:"email"`
	Username        string                 `json:"username,omitempty"`
	FirstName       string                 `json:"first_name,omitempty"`
	LastName        string                 `json:"last_name,omitempty"`
	DisplayName     string                 `json:"display_name,omitempty"`
	Role            string                 `json:"role"`
	Status          string                 `json:"status"`
	EmailVerified   bool                   `json:"email_verified"`
	Organization    string                 `json:"organization,omitempty"`
	LastLoginAt     string                 `json:"last_login_at,omitempty"`
	LoginCount      int                    `json:"login_count"`
	APIKeyCount     int                    `json:"api_key_count"`
	ActiveJobCount  int                    `json:"active_job_count"`
	TotalJobCount   int                    `json:"total_job_count"`
	StorageUsed     int64                  `json:"storage_used_bytes"`
	QuotaLimit      int64                  `json:"quota_limit_bytes,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt       string                 `json:"created_at"`
	UpdatedAt       string                 `json:"updated_at"`
}

// ListUsers lists all users (admin only)
func (a *AdminClient) ListUsers(ctx context.Context, opts *models.ListOptions) ([]AdminUser, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "list_users_admin")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Listing users (admin)")

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		params = opts.ToQuery()
	}

	// Build path with query parameters
	path := "/admin/users"
	if len(params) > 0 {
		path += "?"
		first := true
		for key, value := range params {
			if !first {
				path += "&"
			}
			path += fmt.Sprintf("%s=%s", key, value)
			first = false
		}
	}

	// Make API request
	resp, err := a.client.Get(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse users
	usersBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal users data: %w", err)
	}

	var users []AdminUser
	if err := json.Unmarshal(usersBytes, &users); err != nil {
		return nil, fmt.Errorf("failed to parse users: %w", err)
	}

	span.SetAttributes(attribute.Int("users.count", len(users)))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_count": len(users),
	}).Info("Listed users")

	return users, nil
}

// GetUser retrieves a specific user by ID (admin only)
func (a *AdminClient) GetUser(ctx context.Context, userID string) (*AdminUser, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_user_admin")
	defer span.End()

	span.SetAttributes(attribute.String("user.id", userID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("Fetching user (admin)")

	// Make API request
	path := fmt.Sprintf("/admin/users/%s", userID)
	resp, err := a.client.Get(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse user
	userBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %w", err)
	}

	var user AdminUser
	if err := json.Unmarshal(userBytes, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user: %w", err)
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"status":  user.Status,
	}).Info("Retrieved user")

	return &user, nil
}

// UserUpdateAdmin represents admin user update request
type UserUpdateAdmin struct {
	Role          *string                 `json:"role,omitempty"`
	Status        *string                 `json:"status,omitempty"`
	EmailVerified *bool                   `json:"email_verified,omitempty"`
	QuotaLimit    *int64                  `json:"quota_limit_bytes,omitempty"`
	Metadata      map[string]interface{}  `json:"metadata,omitempty"`
}

// UpdateUser updates a user (admin only)
func (a *AdminClient) UpdateUser(ctx context.Context, userID string, updates *UserUpdateAdmin) (*AdminUser, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "update_user_admin")
	defer span.End()

	span.SetAttributes(attribute.String("user.id", userID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("Updating user (admin)")

	// Make API request
	path := fmt.Sprintf("/admin/users/%s", userID)
	resp, err := a.client.Patch(ctx, path, updates)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse updated user
	userBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %w", err)
	}

	var user AdminUser
	if err := json.Unmarshal(userBytes, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user: %w", err)
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": user.ID,
	}).Info("User updated")

	return &user, nil
}

// DeleteUser deletes a user (admin only)
func (a *AdminClient) DeleteUser(ctx context.Context, userID string) error {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "delete_user_admin")
	defer span.End()

	span.SetAttributes(attribute.String("user.id", userID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("Deleting user (admin)")

	// Make API request
	path := fmt.Sprintf("/admin/users/%s", userID)
	resp, err := a.client.Delete(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("User deleted")

	return nil
}

// SuspendUser suspends a user (admin only)
func (a *AdminClient) SuspendUser(ctx context.Context, userID string, reason string) error {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "suspend_user")
	defer span.End()

	span.SetAttributes(attribute.String("user.id", userID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
		"reason":  reason,
	}).Info("Suspending user")

	// Prepare request
	request := map[string]string{
		"reason": reason,
	}

	// Make API request
	path := fmt.Sprintf("/admin/users/%s/suspend", userID)
	resp, err := a.client.Post(ctx, path, request)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to suspend user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("User suspended")

	return nil
}

// UnsuspendUser unsuspends a user (admin only)
func (a *AdminClient) UnsuspendUser(ctx context.Context, userID string) error {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "unsuspend_user")
	defer span.End()

	span.SetAttributes(attribute.String("user.id", userID))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("Unsuspending user")

	// Make API request
	path := fmt.Sprintf("/admin/users/%s/unsuspend", userID)
	resp, err := a.client.Post(ctx, path, nil)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to unsuspend user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Info("User unsuspended")

	return nil
}

// AuditLog represents an audit log entry
type AuditLog struct {
	ID         string                 `json:"id"`
	Timestamp  string                 `json:"timestamp"`
	UserID     string                 `json:"user_id"`
	UserEmail  string                 `json:"user_email,omitempty"`
	Action     string                 `json:"action"`
	Resource   string                 `json:"resource"`
	ResourceID string                 `json:"resource_id,omitempty"`
	Status     string                 `json:"status"`       // success, failure
	IPAddress  string                 `json:"ip_address,omitempty"`
	UserAgent  string                 `json:"user_agent,omitempty"`
	Changes    map[string]interface{} `json:"changes,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

// GetAuditLogs retrieves audit logs (admin only)
func (a *AdminClient) GetAuditLogs(ctx context.Context, opts *models.ListOptions) ([]AuditLog, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_audit_logs")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Fetching audit logs")

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		params = opts.ToQuery()
	}

	// Build path with query parameters
	path := "/admin/audit-logs"
	if len(params) > 0 {
		path += "?"
		first := true
		for key, value := range params {
			if !first {
				path += "&"
			}
			path += fmt.Sprintf("%s=%s", key, value)
			first = false
		}
	}

	// Make API request
	resp, err := a.client.Get(ctx, path)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get audit logs: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse audit logs
	logsBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal logs data: %w", err)
	}

	var logs []AuditLog
	if err := json.Unmarshal(logsBytes, &logs); err != nil {
		return nil, fmt.Errorf("failed to parse audit logs: %w", err)
	}

	span.SetAttributes(attribute.Int("audit_logs.count", len(logs)))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"log_count": len(logs),
	}).Info("Retrieved audit logs")

	return logs, nil
}

// SystemConfig represents system configuration
type SystemConfig struct {
	Key         string                 `json:"key"`
	Value       interface{}            `json:"value"`
	Type        string                 `json:"type"`        // string, number, boolean, json
	Category    string                 `json:"category,omitempty"`
	Description string                 `json:"description,omitempty"`
	Sensitive   bool                   `json:"sensitive"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	UpdatedAt   string                 `json:"updated_at"`
	UpdatedBy   string                 `json:"updated_by,omitempty"`
}

// GetSystemConfig retrieves system configuration (admin only)
func (a *AdminClient) GetSystemConfig(ctx context.Context) ([]SystemConfig, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "get_system_config")
	defer span.End()

	a.client.logger.WithContext(ctx).Info("Fetching system configuration")

	// Make API request
	resp, err := a.client.Get(ctx, "/admin/config")
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get system config: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse config
	configBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config data: %w", err)
	}

	var configs []SystemConfig
	if err := json.Unmarshal(configBytes, &configs); err != nil {
		return nil, fmt.Errorf("failed to parse system config: %w", err)
	}

	span.SetAttributes(attribute.Int("config.count", len(configs)))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"config_count": len(configs),
	}).Info("Retrieved system configuration")

	return configs, nil
}

// UpdateSystemConfig updates system configuration (admin only)
func (a *AdminClient) UpdateSystemConfig(ctx context.Context, key string, value interface{}) (*SystemConfig, error) {
	// Start tracing
	ctx, span := a.client.tracer.StartSpan(ctx, "update_system_config")
	defer span.End()

	span.SetAttributes(attribute.String("config.key", key))

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"config_key": key,
	}).Info("Updating system configuration")

	// Prepare request
	request := map[string]interface{}{
		"value": value,
	}

	// Make API request
	path := fmt.Sprintf("/admin/config/%s", key)
	resp, err := a.client.Put(ctx, path, request)
	if err != nil {
		a.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		a.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		a.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse updated config
	configBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config data: %w", err)
	}

	var config SystemConfig
	if err := json.Unmarshal(configBytes, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	a.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"config_key": config.Key,
	}).Info("System configuration updated")

	return &config, nil
}