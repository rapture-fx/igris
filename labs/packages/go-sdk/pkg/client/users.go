package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// UsersClient handles user management operations
type UsersClient struct {
	client *Client
}

// NewUsersClient creates a new users client
func NewUsersClient(client *Client) *UsersClient {
	return &UsersClient{
		client: client,
	}
}

// UserInfo represents user information
type UserInfo struct {
	ID          string                 `json:"id"`
	Email       string                 `json:"email"`
	Username    string                 `json:"username,omitempty"`
	FirstName   string                 `json:"first_name,omitempty"`
	LastName    string                 `json:"last_name,omitempty"`
	DisplayName string                 `json:"display_name,omitempty"`
	Avatar      string                 `json:"avatar,omitempty"`
	Role        string                 `json:"role"`
	Status      string                 `json:"status"`       // active, inactive, suspended
	EmailVerified bool                 `json:"email_verified"`
	PhoneNumber string                 `json:"phone_number,omitempty"`
	Organization string                `json:"organization,omitempty"`
	Department  string                 `json:"department,omitempty"`
	Title       string                 `json:"title,omitempty"`
	Timezone    string                 `json:"timezone,omitempty"`
	Language    string                 `json:"language,omitempty"`
	Preferences map[string]interface{} `json:"preferences,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
	LastLoginAt string                 `json:"last_login_at,omitempty"`
}

// UserUpdateRequest represents user profile update request
type UserUpdateRequest struct {
	FirstName   *string                 `json:"first_name,omitempty"`
	LastName    *string                 `json:"last_name,omitempty"`
	DisplayName *string                 `json:"display_name,omitempty"`
	Avatar      *string                 `json:"avatar,omitempty"`
	PhoneNumber *string                 `json:"phone_number,omitempty"`
	Department  *string                 `json:"department,omitempty"`
	Title       *string                 `json:"title,omitempty"`
	Timezone    *string                 `json:"timezone,omitempty"`
	Language    *string                 `json:"language,omitempty"`
	Preferences map[string]interface{}  `json:"preferences,omitempty"`
	Metadata    map[string]interface{}  `json:"metadata,omitempty"`
}

// GetProfile retrieves the current user's profile
func (u *UsersClient) GetProfile(ctx context.Context) (*UserInfo, error) {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "get_user_profile")
	defer span.End()

	u.client.logger.WithContext(ctx).Info("Fetching user profile")

	// Make API request
	resp, err := u.client.Get(ctx, "/users/me")
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get profile: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse user info
	userBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %w", err)
	}

	var userInfo UserInfo
	if err := json.Unmarshal(userBytes, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	span.SetAttributes(
		attribute.String("user.id", userInfo.ID),
		attribute.String("user.email", userInfo.Email),
		attribute.String("user.role", userInfo.Role),
	)

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userInfo.ID,
		"email":   userInfo.Email,
		"role":    userInfo.Role,
	}).Info("Retrieved user profile")

	return &userInfo, nil
}

// UpdateProfile updates the current user's profile
func (u *UsersClient) UpdateProfile(ctx context.Context, updates *UserUpdateRequest) (*UserInfo, error) {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "update_user_profile")
	defer span.End()

	u.client.logger.WithContext(ctx).Info("Updating user profile")

	// Make API request
	resp, err := u.client.Patch(ctx, "/users/me", updates)
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse updated user info
	userBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %w", err)
	}

	var userInfo UserInfo
	if err := json.Unmarshal(userBytes, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userInfo.ID,
	}).Info("User profile updated")

	return &userInfo, nil
}

// GetUser retrieves a user by ID (requires appropriate permissions)
func (u *UsersClient) GetUser(ctx context.Context, userID string) (*UserInfo, error) {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "get_user")
	defer span.End()

	span.SetAttributes(attribute.String("user.id", userID))

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userID,
	}).Debug("Fetching user")

	// Make API request
	path := fmt.Sprintf("/users/%s", userID)
	resp, err := u.client.Get(ctx, path)
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse user info
	userBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user data: %w", err)
	}

	var userInfo UserInfo
	if err := json.Unmarshal(userBytes, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"user_id": userInfo.ID,
		"email":   userInfo.Email,
	}).Debug("Retrieved user")

	return &userInfo, nil
}

// APIKey represents an API key
type APIKey struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Key         string                 `json:"key,omitempty"`      // Only returned on creation
	KeyPrefix   string                 `json:"key_prefix"`         // First few characters for identification
	Scopes      []string               `json:"scopes,omitempty"`
	ExpiresAt   string                 `json:"expires_at,omitempty"`
	LastUsedAt  string                 `json:"last_used_at,omitempty"`
	Status      string                 `json:"status"`             // active, revoked, expired
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
}

// CreateAPIKeyRequest represents API key creation request
type CreateAPIKeyRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes,omitempty"`
	ExpiresAt string   `json:"expires_at,omitempty"`
}

// ListAPIKeys lists the current user's API keys
func (u *UsersClient) ListAPIKeys(ctx context.Context) ([]APIKey, error) {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "list_api_keys")
	defer span.End()

	u.client.logger.WithContext(ctx).Info("Listing API keys")

	// Make API request
	resp, err := u.client.Get(ctx, "/users/me/api-keys")
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse API keys
	keysBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal keys data: %w", err)
	}

	var keys []APIKey
	if err := json.Unmarshal(keysBytes, &keys); err != nil {
		return nil, fmt.Errorf("failed to parse API keys: %w", err)
	}

	span.SetAttributes(attribute.Int("api_keys.count", len(keys)))

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_count": len(keys),
	}).Info("Listed API keys")

	return keys, nil
}

// CreateAPIKey creates a new API key
func (u *UsersClient) CreateAPIKey(ctx context.Context, request *CreateAPIKeyRequest) (*APIKey, error) {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "create_api_key")
	defer span.End()

	span.SetAttributes(attribute.String("api_key.name", request.Name))

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_name": request.Name,
		"scopes":   request.Scopes,
	}).Info("Creating API key")

	// Make API request
	resp, err := u.client.Post(ctx, "/users/me/api-keys", request)
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse API key
	keyBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal key data: %w", err)
	}

	var apiKey APIKey
	if err := json.Unmarshal(keyBytes, &apiKey); err != nil {
		return nil, fmt.Errorf("failed to parse API key: %w", err)
	}

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id":   apiKey.ID,
		"key_name": apiKey.Name,
	}).Info("API key created")

	return &apiKey, nil
}

// RevokeAPIKey revokes an API key
func (u *UsersClient) RevokeAPIKey(ctx context.Context, keyID string) error {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "revoke_api_key")
	defer span.End()

	span.SetAttributes(attribute.String("api_key.id", keyID))

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id": keyID,
	}).Info("Revoking API key")

	// Make API request
	path := fmt.Sprintf("/users/me/api-keys/%s/revoke", keyID)
	resp, err := u.client.Post(ctx, path, nil)
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to revoke API key: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id": keyID,
	}).Info("API key revoked")

	return nil
}

// DeleteAPIKey deletes an API key
func (u *UsersClient) DeleteAPIKey(ctx context.Context, keyID string) error {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "delete_api_key")
	defer span.End()

	span.SetAttributes(attribute.String("api_key.id", keyID))

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id": keyID,
	}).Info("Deleting API key")

	// Make API request
	path := fmt.Sprintf("/users/me/api-keys/%s", keyID)
	resp, err := u.client.Delete(ctx, path)
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete API key: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"key_id": keyID,
	}).Info("API key deleted")

	return nil
}

// UserActivity represents user activity log entry
type UserActivity struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource,omitempty"`
	ResourceID string                `json:"resource_id,omitempty"`
	IPAddress string                 `json:"ip_address,omitempty"`
	UserAgent string                 `json:"user_agent,omitempty"`
	Status    string                 `json:"status"`       // success, failure
	Details   map[string]interface{} `json:"details,omitempty"`
	Timestamp string                 `json:"timestamp"`
}

// GetActivity retrieves user activity log
func (u *UsersClient) GetActivity(ctx context.Context, opts *models.ListOptions) ([]UserActivity, error) {
	// Start tracing
	ctx, span := u.client.tracer.StartSpan(ctx, "get_user_activity")
	defer span.End()

	u.client.logger.WithContext(ctx).Info("Fetching user activity")

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		params = opts.ToQuery()
	}

	// Build path with query parameters
	path := "/users/me/activity"
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
	resp, err := u.client.Get(ctx, path)
	if err != nil {
		u.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get activity: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		u.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		u.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse activity
	activityBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal activity data: %w", err)
	}

	var activities []UserActivity
	if err := json.Unmarshal(activityBytes, &activities); err != nil {
		return nil, fmt.Errorf("failed to parse activities: %w", err)
	}

	span.SetAttributes(attribute.Int("activities.count", len(activities)))

	u.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"activity_count": len(activities),
	}).Info("Retrieved user activity")

	return activities, nil
}