using Igris.Types;

namespace Igris.API;

/// <summary>
/// Client for administrative operations.
/// </summary>
/// <remarks>
/// Provides methods for system administration, user management, and system statistics.
/// Requires admin privileges.
/// </remarks>
/// <example>
/// <code>
/// var client = new IgrisClient("your-admin-api-key");
/// var stats = await client.Admin.GetSystemStatsAsync();
/// Console.WriteLine($"Total users: {stats.TotalUsers}");
/// </code>
/// </example>
public class AdminClient
{
    private readonly IgrisClient _client;

    /// <summary>
    /// Initializes a new instance of the AdminClient class.
    /// </summary>
    /// <param name="client">The parent IgrisClient instance.</param>
    internal AdminClient(IgrisClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Get system statistics.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>System statistics.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<SystemStats> GetSystemStatsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<SystemStats>("/admin/stats", cancellationToken);
    }

    /// <summary>
    /// List all users (admin only).
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of users.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<UserSummary>> ListUsersAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/admin/users{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<UserSummary>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Get user details by ID (admin only).
    /// </summary>
    /// <param name="userId">User ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>User details.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<UserSummary> GetUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<UserSummary>($"/admin/users/{userId}", cancellationToken);
    }

    /// <summary>
    /// Update user status or permissions (admin only).
    /// </summary>
    /// <param name="userId">User ID.</param>
    /// <param name="updates">Updates to apply.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Updated user details.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<UserSummary> UpdateUserAsync(
        string userId,
        object updates,
        CancellationToken cancellationToken = default)
    {
        return await _client.PatchAsync<UserSummary>($"/admin/users/{userId}", updates, cancellationToken);
    }

    /// <summary>
    /// Delete a user (admin only).
    /// </summary>
    /// <param name="userId">User ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Deletion confirmation.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<object> DeleteUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _client.DeleteAsync<object>($"/admin/users/{userId}", cancellationToken);
    }
}
