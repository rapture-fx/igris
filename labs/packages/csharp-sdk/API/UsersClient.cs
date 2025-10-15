using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for user operations.
/// </summary>
/// <remarks>
/// Provides methods for user profile management and API key operations.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var profile = await client.Users.GetProfileAsync();
/// Console.WriteLine($"User: {profile.Email}");
/// </code>
/// </example>
public class UsersClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the UsersClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal UsersClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Get current user profile.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>User profile information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<UserProfile> GetProfileAsync(
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<UserProfile>("/users/me", cancellationToken);
    }

    /// <summary>
    /// Update user profile.
    /// </summary>
    /// <param name="updates">Fields to update.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Updated user profile.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<UserProfile> UpdateProfileAsync(
        object updates,
        CancellationToken cancellationToken = default)
    {
        return await _client.PatchAsync<UserProfile>("/users/me", updates, cancellationToken);
    }

    /// <summary>
    /// List API keys for the current user.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of API keys.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<ApiKeyInfo>> ListApiKeysAsync(
        CancellationToken cancellationToken = default)
    {
        var response = await _client.GetAsync<ApiKeysWrapper>("/users/me/api-keys", cancellationToken);
        return response.ApiKeys;
    }

    /// <summary>
    /// Create a new API key.
    /// </summary>
    /// <param name="name">API key name.</param>
    /// <param name="permissions">Optional permissions for the API key.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Created API key information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ApiKeyInfo> CreateApiKeyAsync(
        string name,
        string[]? permissions = null,
        CancellationToken cancellationToken = default)
    {
        var body = new { name, permissions = permissions ?? Array.Empty<string>() };
        return await _client.PostAsync<ApiKeyInfo>("/users/me/api-keys", body, cancellationToken);
    }

    /// <summary>
    /// Revoke an API key.
    /// </summary>
    /// <param name="keyId">API key ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Revocation confirmation.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<object> RevokeApiKeyAsync(
        string keyId,
        CancellationToken cancellationToken = default)
    {
        return await _client.DeleteAsync<object>($"/users/me/api-keys/{keyId}", cancellationToken);
    }
}
