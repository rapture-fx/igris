using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for monitoring operations.
/// </summary>
/// <remarks>
/// Provides methods for system health checks, metrics monitoring, and alerts.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var health = await client.Monitoring.GetSystemHealthAsync();
/// Console.WriteLine($"System status: {health.Status}");
/// </code>
/// </example>
public class MonitoringClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the MonitoringClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal MonitoringClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Get system health status.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>System health information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<HealthResponse> GetSystemHealthAsync(
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<HealthResponse>("/monitoring/health", cancellationToken);
    }

    /// <summary>
    /// Get system metrics.
    /// </summary>
    /// <param name="metricNames">Specific metrics to retrieve (optional).</param>
    /// <param name="timeRange">Time range for metrics (optional).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>System metrics data.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<MetricsResponse> GetMetricsAsync(
        string[]? metricNames = null,
        TimeRange? timeRange = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = "";
        if (metricNames != null && metricNames.Length > 0)
        {
            queryString = $"?metrics={string.Join(",", metricNames)}";
        }
        if (timeRange != null)
        {
            var separator = string.IsNullOrEmpty(queryString) ? "?" : "&";
            queryString += $"{separator}start={timeRange.Start}&end={timeRange.End}";
        }

        return await _client.GetAsync<MetricsResponse>($"/monitoring/metrics{queryString}", cancellationToken);
    }

    /// <summary>
    /// Get alerts.
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of alerts.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<AlertResponse>> GetAlertsAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/monitoring/alerts{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<AlertResponse>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Create an alert rule.
    /// </summary>
    /// <param name="alertConfig">Alert configuration.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Created alert information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<AlertResponse> CreateAlertAsync(
        object alertConfig,
        CancellationToken cancellationToken = default)
    {
        return await _client.PostAsync<AlertResponse>("/monitoring/alerts", alertConfig, cancellationToken);
    }

    /// <summary>
    /// Delete an alert rule.
    /// </summary>
    /// <param name="alertId">Alert ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Deletion confirmation.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<object> DeleteAlertAsync(
        string alertId,
        CancellationToken cancellationToken = default)
    {
        return await _client.DeleteAsync<object>($"/monitoring/alerts/{alertId}", cancellationToken);
    }
}
