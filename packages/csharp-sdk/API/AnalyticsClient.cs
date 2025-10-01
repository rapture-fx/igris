using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for analytics operations.
/// </summary>
/// <remarks>
/// Provides methods for running analytics queries, generating reports,
/// and retrieving dataset information.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var query = new { dataset = "sales", metrics = new[] { "revenue", "count" } };
/// var result = await client.Analytics.QueryAsync(query);
/// Console.WriteLine($"Results: {result.Data.Count} rows");
/// </code>
/// </example>
public class AnalyticsClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the AnalyticsClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal AnalyticsClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Execute an analytics query.
    /// </summary>
    /// <param name="query">Query configuration with dataset, metrics, and filters.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Query results with data and metadata.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<QueryResponse> QueryAsync(
        object query,
        CancellationToken cancellationToken = default)
    {
        return await _client.PostAsync<QueryResponse>("/analytics/query", query, cancellationToken);
    }

    /// <summary>
    /// Generate a report based on specified configuration.
    /// </summary>
    /// <param name="reportConfig">Report configuration.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Generated report information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ReportResponse> GenerateReportAsync(
        object reportConfig,
        CancellationToken cancellationToken = default)
    {
        return await _client.PostAsync<ReportResponse>("/analytics/reports", reportConfig, cancellationToken);
    }

    /// <summary>
    /// Get a specific report.
    /// </summary>
    /// <param name="reportId">The report ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Report details and data.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ReportResponse> GetReportAsync(
        string reportId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<ReportResponse>($"/analytics/reports/{reportId}", cancellationToken);
    }

    /// <summary>
    /// List all available datasets.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of available datasets.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<DatasetResponse>> GetDatasetsAsync(
        CancellationToken cancellationToken = default)
    {
        var response = await _client.GetAsync<DatasetsWrapper>("/analytics/datasets", cancellationToken);
        return response.Datasets;
    }

    /// <summary>
    /// Get schema information for a specific dataset.
    /// </summary>
    /// <param name="dataset">Dataset name.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dataset schema information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<DatasetSchemaResponse> GetSchemaAsync(
        string dataset,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<DatasetSchemaResponse>($"/analytics/datasets/{dataset}/schema", cancellationToken);
    }

    /// <summary>
    /// List reports with optional filtering.
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of reports.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<ReportResponse>> ListReportsAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/analytics/reports{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<ReportResponse>>(path, cancellationToken);
        return response.Items;
    }
}
