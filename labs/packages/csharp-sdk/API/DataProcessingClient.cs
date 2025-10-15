using System.Text.Json;
using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for data processing operations.
/// </summary>
/// <remarks>
/// Provides methods for file processing, data transformation, schema validation,
/// and managing data processing pipelines.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var fileData = await File.ReadAllBytesAsync("data.csv");
/// var result = await client.Data.ProcessFileAsync(fileData, "csv");
/// Console.WriteLine($"Job ID: {result.JobId}");
/// </code>
/// </example>
public class DataProcessingClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the DataProcessingClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal DataProcessingClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Process a data file.
    /// </summary>
    /// <param name="fileData">The file data as a byte array.</param>
    /// <param name="format">The data format (csv, json, xlsx, etc.).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Processing job response with job ID and status.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ProcessingJobResponse> ProcessFileAsync(
        byte[] fileData,
        string format,
        CancellationToken cancellationToken = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileData), "file", $"data.{format}");
        form.Add(new StringContent(format), "format");

        return await _client.PostMultipartAsync<ProcessingJobResponse>("/data/process", form, cancellationToken);
    }

    /// <summary>
    /// Transform data with specified transformations.
    /// </summary>
    /// <param name="jobId">The processing job ID.</param>
    /// <param name="transformations">Transformation rules to apply.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Transformation response with results.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<TransformationResponse> TransformDataAsync(
        string jobId,
        object transformations,
        CancellationToken cancellationToken = default)
    {
        var body = new { job_id = jobId, transformations };
        return await _client.PostAsync<TransformationResponse>("/data/transform", body, cancellationToken);
    }

    /// <summary>
    /// Validate data against a schema.
    /// </summary>
    /// <param name="jobId">The processing job ID.</param>
    /// <param name="schema">Schema definition for validation.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Validation response with validation results.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ValidationResponse> ValidateSchemaAsync(
        string jobId,
        object schema,
        CancellationToken cancellationToken = default)
    {
        var body = new { job_id = jobId, schema };
        return await _client.PostAsync<ValidationResponse>("/data/validate", body, cancellationToken);
    }

    /// <summary>
    /// Get processing job status and details.
    /// </summary>
    /// <param name="jobId">The processing job ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Processing job response with current status.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ProcessingJobResponse> GetJobAsync(
        string jobId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<ProcessingJobResponse>($"/data/jobs/{jobId}", cancellationToken);
    }

    /// <summary>
    /// List all processing jobs.
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of processing jobs.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<ProcessingJobResponse>> ListJobsAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/data/jobs{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<ProcessingJobResponse>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Cancel a processing job.
    /// </summary>
    /// <param name="jobId">The processing job ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Cancellation confirmation.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<object> CancelJobAsync(
        string jobId,
        CancellationToken cancellationToken = default)
    {
        return await _client.PostAsync<object>($"/data/jobs/{jobId}/cancel", new { }, cancellationToken);
    }
}
