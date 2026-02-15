using Igris.Types;

namespace Igris.API;

/// <summary>
/// Client for data quality operations.
/// </summary>
/// <remarks>
/// Provides methods for assessing data quality, defining quality rules,
/// and monitoring data quality metrics.
/// </remarks>
/// <example>
/// <code>
/// var client = new IgrisClient("your-api-key");
/// var assessment = await client.Quality.AssessQualityAsync("dataset-id", new[] { "completeness", "accuracy" });
/// Console.WriteLine($"Quality score: {assessment.OverallScore}");
/// </code>
/// </example>
public class QualityClient
{
    private readonly IgrisClient _client;

    /// <summary>
    /// Initializes a new instance of the QualityClient class.
    /// </summary>
    /// <param name="client">The parent IgrisClient instance.</param>
    internal QualityClient(IgrisClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Assess data quality for a dataset.
    /// </summary>
    /// <param name="dataPath">Path to the data to assess.</param>
    /// <param name="checks">Specific quality checks to run (optional).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Quality assessment report.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<QualityAssessmentResponse> AssessQualityAsync(
        string dataPath,
        string[]? checks = null,
        CancellationToken cancellationToken = default)
    {
        var body = new { data_path = dataPath, checks = checks ?? Array.Empty<string>() };
        return await _client.PostAsync<QualityAssessmentResponse>("/quality/assess", body, cancellationToken);
    }

    /// <summary>
    /// Get a quality assessment report.
    /// </summary>
    /// <param name="reportId">Report ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Quality assessment report.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<QualityAssessmentResponse> GetReportAsync(
        string reportId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<QualityAssessmentResponse>($"/quality/reports/{reportId}", cancellationToken);
    }

    /// <summary>
    /// Create a quality rule.
    /// </summary>
    /// <param name="rule">Quality rule definition.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Created quality rule.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<QualityRuleResponse> CreateRuleAsync(
        object rule,
        CancellationToken cancellationToken = default)
    {
        return await _client.PostAsync<QualityRuleResponse>("/quality/rules", rule, cancellationToken);
    }

    /// <summary>
    /// Get a quality rule.
    /// </summary>
    /// <param name="ruleId">Rule ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Quality rule details.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<QualityRuleResponse> GetRuleAsync(
        string ruleId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<QualityRuleResponse>($"/quality/rules/{ruleId}", cancellationToken);
    }

    /// <summary>
    /// List all quality rules.
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of quality rules.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<QualityRuleResponse>> ListRulesAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/quality/rules{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<QualityRuleResponse>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Validate data against quality rules.
    /// </summary>
    /// <param name="dataPath">Path to the data to validate.</param>
    /// <param name="ruleIds">Quality rule IDs to apply.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Validation results.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ValidationResultResponse> ValidateAsync(
        string dataPath,
        string[] ruleIds,
        CancellationToken cancellationToken = default)
    {
        var body = new { data_path = dataPath, rule_ids = ruleIds };
        return await _client.PostAsync<ValidationResultResponse>("/quality/validate", body, cancellationToken);
    }
}
