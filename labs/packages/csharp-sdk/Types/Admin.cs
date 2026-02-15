using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// User summary information for admin operations.
/// </summary>
public class UserSummary
{
    /// <summary>
    /// Unique user identifier.
    /// </summary>
    [JsonPropertyName("user_id")]
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// User email address.
    /// </summary>
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// User full name.
    /// </summary>
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>
    /// User role.
    /// </summary>
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// User organization.
    /// </summary>
    [JsonPropertyName("organization")]
    public string? Organization { get; set; }

    /// <summary>
    /// Account status.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Account creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Last login timestamp.
    /// </summary>
    [JsonPropertyName("last_login")]
    public string? LastLogin { get; set; }

    /// <summary>
    /// Number of API keys.
    /// </summary>
    [JsonPropertyName("api_key_count")]
    public int? ApiKeyCount { get; set; }

    /// <summary>
    /// Storage usage in bytes.
    /// </summary>
    [JsonPropertyName("storage_used")]
    public long? StorageUsed { get; set; }
}

/// <summary>
/// System statistics for admin operations.
/// </summary>
public class SystemStats
{
    /// <summary>
    /// Total number of users.
    /// </summary>
    [JsonPropertyName("total_users")]
    public long TotalUsers { get; set; }

    /// <summary>
    /// Number of active users.
    /// </summary>
    [JsonPropertyName("active_users")]
    public long ActiveUsers { get; set; }

    /// <summary>
    /// Total number of jobs processed.
    /// </summary>
    [JsonPropertyName("total_jobs")]
    public long TotalJobs { get; set; }

    /// <summary>
    /// Number of jobs in progress.
    /// </summary>
    [JsonPropertyName("jobs_in_progress")]
    public long JobsInProgress { get; set; }

    /// <summary>
    /// Total storage used in bytes.
    /// </summary>
    [JsonPropertyName("storage_used")]
    public long StorageUsed { get; set; }

    /// <summary>
    /// Total storage capacity in bytes.
    /// </summary>
    [JsonPropertyName("storage_capacity")]
    public long StorageCapacity { get; set; }

    /// <summary>
    /// Number of trained models.
    /// </summary>
    [JsonPropertyName("total_models")]
    public long? TotalModels { get; set; }

    /// <summary>
    /// Number of active deployments.
    /// </summary>
    [JsonPropertyName("active_deployments")]
    public long? ActiveDeployments { get; set; }

    /// <summary>
    /// API requests in the last 24 hours.
    /// </summary>
    [JsonPropertyName("api_requests_24h")]
    public long? ApiRequests24h { get; set; }

    /// <summary>
    /// System uptime in seconds.
    /// </summary>
    [JsonPropertyName("uptime_seconds")]
    public long? UptimeSeconds { get; set; }

    /// <summary>
    /// Statistics timestamp.
    /// </summary>
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }
}
