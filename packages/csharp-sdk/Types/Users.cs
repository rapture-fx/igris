using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// User profile information.
/// </summary>
public class UserProfile
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
    /// User role (user, admin, etc.).
    /// </summary>
    [JsonPropertyName("role")]
    public string? Role { get; set; }

    /// <summary>
    /// User organization.
    /// </summary>
    [JsonPropertyName("organization")]
    public string? Organization { get; set; }

    /// <summary>
    /// Account status (active, inactive, suspended).
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
    /// Additional profile metadata.
    /// </summary>
    [JsonPropertyName("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}

/// <summary>
/// API key information.
/// </summary>
public class ApiKeyInfo
{
    /// <summary>
    /// Unique key identifier.
    /// </summary>
    [JsonPropertyName("key_id")]
    public string KeyId { get; set; } = string.Empty;

    /// <summary>
    /// API key name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Partial API key (masked).
    /// </summary>
    [JsonPropertyName("key")]
    public string? Key { get; set; }

    /// <summary>
    /// Key permissions.
    /// </summary>
    [JsonPropertyName("permissions")]
    public List<string> Permissions { get; set; } = new();

    /// <summary>
    /// Key status (active, revoked).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Key creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Last used timestamp.
    /// </summary>
    [JsonPropertyName("last_used")]
    public string? LastUsed { get; set; }

    /// <summary>
    /// Key expiration timestamp (if applicable).
    /// </summary>
    [JsonPropertyName("expires_at")]
    public string? ExpiresAt { get; set; }
}

/// <summary>
/// Wrapper for API keys list response.
/// </summary>
public class ApiKeysWrapper
{
    /// <summary>
    /// List of API keys.
    /// </summary>
    [JsonPropertyName("api_keys")]
    public List<ApiKeyInfo> ApiKeys { get; set; } = new();
}
