using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SchlepEngine.Exceptions;
using SchlepEngine.Types;

namespace SchlepEngine;

/// <summary>
/// Main client for interacting with the Schlep-engine API.
/// </summary>
/// <remarks>
/// The client provides methods for uploading data, training models, deploying models,
/// checking job status, and streaming real-time events.
///
/// <para><strong>Authentication</strong></para>
/// <para>The client requires an API key for authentication. You can provide it either:</para>
/// <list type="bullet">
/// <item>As a parameter when creating the client: <c>new SchlepClient("your-api-key")</c></item>
/// <item>Via the <c>SCHLEP_API_KEY</c> environment variable</item>
/// </list>
///
/// <para><strong>Example Usage</strong></para>
/// <code>
/// var client = new SchlepClient("your-api-key");
///
/// // Upload data
/// var uploadResult = await client.UploadAsync("Hello, world!");
/// Console.WriteLine($"Upload job ID: {uploadResult.JobId}");
///
/// // Train a model
/// var config = new TrainConfig
/// {
///     ModelType = "classification",
///     DatasetId = uploadResult.JobId
/// };
/// var trainResult = await client.TrainAsync(config);
///
/// // Deploy model
/// if (trainResult.ModelId != null)
/// {
///     var deployResult = await client.DeployAsync(trainResult.ModelId);
///     Console.WriteLine($"Model deployed at: {deployResult.EndpointUrl}");
/// }
/// </code>
/// </remarks>
public class SchlepClient : IDisposable
{
    private const string DefaultBaseUrl = "https://api.schlep-engine.com/v1";

    private readonly HttpClient _httpClient;
    private readonly ILogger<SchlepClient>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly string _baseUrl;
    private readonly string _apiKey;
    private bool _disposed;

    /// <summary>
    /// Initializes a new instance of the <see cref="SchlepClient"/> class with the provided API key.
    /// </summary>
    /// <param name="apiKey">Your Schlep-engine API key.</param>
    /// <param name="httpClient">Optional HTTP client instance. If not provided, a new one will be created.</param>
    /// <param name="logger">Optional logger instance.</param>
    /// <exception cref="ConfigurationException">Thrown if the API key is null or empty.</exception>
    public SchlepClient(string apiKey, HttpClient? httpClient = null, ILogger<SchlepClient>? logger = null)
        : this(apiKey, DefaultBaseUrl, httpClient, logger)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="SchlepClient"/> class with a custom base URL.
    /// </summary>
    /// <param name="apiKey">Your Schlep-engine API key.</param>
    /// <param name="baseUrl">Custom base URL for the API.</param>
    /// <param name="httpClient">Optional HTTP client instance. If not provided, a new one will be created.</param>
    /// <param name="logger">Optional logger instance.</param>
    /// <exception cref="ConfigurationException">Thrown if the API key is null or empty.</exception>
    public SchlepClient(string apiKey, string baseUrl, HttpClient? httpClient = null, ILogger<SchlepClient>? logger = null)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new ConfigurationException("API key cannot be null or empty");

        _apiKey = apiKey;
        _baseUrl = baseUrl;
        _logger = logger;

        _httpClient = httpClient ?? new HttpClient();
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        _httpClient.DefaultRequestHeaders.Accept.Clear();
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = false
        };

        _logger?.LogDebug("SchlepClient initialized with base URL: {BaseUrl}", _baseUrl);
    }

    /// <summary>
    /// Creates a new client using the API key from the SCHLEP_API_KEY environment variable.
    /// </summary>
    /// <param name="httpClient">Optional HTTP client instance.</param>
    /// <param name="logger">Optional logger instance.</param>
    /// <returns>A new SchlepClient instance.</returns>
    /// <exception cref="ConfigurationException">Thrown if the environment variable is not set or empty.</exception>
    public static SchlepClient FromEnvironment(HttpClient? httpClient = null, ILogger<SchlepClient>? logger = null)
    {
        var apiKey = Environment.GetEnvironmentVariable("SCHLEP_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new ConfigurationException("SCHLEP_API_KEY environment variable not set or empty");

        return new SchlepClient(apiKey, httpClient, logger);
    }

    /// <summary>
    /// Uploads data to Schlep-engine for processing.
    /// </summary>
    /// <param name="data">The data to upload (can be text, JSON, etc.).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>UploadResponse containing the job ID and status.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    /// <exception cref="HttpRequestException">Thrown if there's a network error.</exception>
    public async Task<UploadResponse> UploadAsync(string data, CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug("Uploading data");

        var request = new UploadRequest { Data = data };
        var url = $"{_baseUrl}/upload";

        return await PostAsync<UploadRequest, UploadResponse>(url, request, cancellationToken);
    }

    /// <summary>
    /// Trains a machine learning model with the provided configuration.
    /// </summary>
    /// <param name="config">Training configuration (model type, dataset, parameters).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>TrainResponse containing the job ID and status.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    /// <exception cref="HttpRequestException">Thrown if there's a network error.</exception>
    public async Task<TrainResponse> TrainAsync(TrainConfig config, CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug("Training model with config: {@Config}", config);

        var url = $"{_baseUrl}/train";
        return await PostAsync<TrainConfig, TrainResponse>(url, config, cancellationToken);
    }

    /// <summary>
    /// Trains a machine learning model with JSON configuration.
    /// </summary>
    /// <param name="configJson">JSON configuration as a string.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>TrainResponse containing the job ID and status.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    /// <exception cref="HttpRequestException">Thrown if there's a network error.</exception>
    public async Task<TrainResponse> TrainAsync(string configJson, CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug("Training model with JSON config");

        var url = $"{_baseUrl}/train";
        var content = new StringContent(configJson, Encoding.UTF8, "application/json");

        using var response = await _httpClient.PostAsync(url, content, cancellationToken);
        return await HandleResponseAsync<TrainResponse>(response);
    }

    /// <summary>
    /// Deploys a trained model to a production endpoint.
    /// </summary>
    /// <param name="modelId">ID of the trained model to deploy.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>DeployResponse containing the deployment details.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    /// <exception cref="HttpRequestException">Thrown if there's a network error.</exception>
    public async Task<DeployResponse> DeployAsync(string modelId, CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug("Deploying model: {ModelId}", modelId);

        var request = new DeployRequest { ModelId = modelId };
        var url = $"{_baseUrl}/deploy";

        return await PostAsync<DeployRequest, DeployResponse>(url, request, cancellationToken);
    }

    /// <summary>
    /// Checks the status of a job (upload, training, deployment, etc.).
    /// </summary>
    /// <param name="jobId">ID of the job to check.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>StatusResponse containing the current job status and progress.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    /// <exception cref="HttpRequestException">Thrown if there's a network error.</exception>
    public async Task<StatusResponse> StatusAsync(string jobId, CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug("Checking status for job: {JobId}", jobId);

        var url = $"{_baseUrl}/status/{jobId}";

        using var response = await _httpClient.GetAsync(url, cancellationToken);
        return await HandleResponseAsync<StatusResponse>(response);
    }

    /// <summary>
    /// Streams real-time events from Schlep-engine.
    /// </summary>
    /// <param name="config">Configuration for the types of events to stream.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <remarks>
    /// This is a basic WebSocket streaming implementation. For production use,
    /// you may want to implement more sophisticated event handling and reconnection logic.
    /// </remarks>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    /// <exception cref="HttpRequestException">Thrown if there's a network error.</exception>
    public async Task StreamAsync(StreamConfig config, CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug("Starting stream with config: {@Config}", config);

        // This is a simplified implementation for demonstration
        // In practice, you'd implement proper WebSocket handling here
        var wsUrl = _baseUrl.Replace("https://", "wss://").Replace("http://", "ws://") + "/stream";

        _logger?.LogInformation("WebSocket connection would be established at: {WsUrl}", wsUrl);
        _logger?.LogInformation("Stream configuration: {@Config}", config);

        // TODO: Implement actual WebSocket streaming
        // For now, this is a placeholder implementation
        await Task.CompletedTask;
    }

    /// <summary>
    /// Gets the base URL for this client.
    /// </summary>
    public string BaseUrl => _baseUrl;

    /// <summary>
    /// Performs a POST request with JSON payload.
    /// </summary>
    private async Task<TResponse> PostAsync<TRequest, TResponse>(string url, TRequest request, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(request, _jsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _httpClient.PostAsync(url, content, cancellationToken);
        return await HandleResponseAsync<TResponse>(response);
    }

    /// <summary>
    /// Handles HTTP response and parses JSON or throws appropriate exception.
    /// </summary>
    private async Task<T> HandleResponseAsync<T>(HttpResponseMessage response)
    {
        var responseBody = await response.Content.ReadAsStringAsync();

        if (response.IsSuccessStatusCode)
        {
            try
            {
                return JsonSerializer.Deserialize<T>(responseBody, _jsonOptions)
                    ?? throw new ApiException((int)response.StatusCode, "Failed to deserialize response");
            }
            catch (JsonException ex)
            {
                throw new ApiException((int)response.StatusCode, $"Failed to parse response: {ex.Message}");
            }
        }
        else
        {
            // Try to parse error response
            try
            {
                using var doc = JsonDocument.Parse(responseBody);
                var message = doc.RootElement.TryGetProperty("message", out var msgElement)
                    ? msgElement.GetString() ?? "Unknown API error"
                    : "Unknown API error";
                throw new ApiException((int)response.StatusCode, message);
            }
            catch (JsonException)
            {
                throw new ApiException((int)response.StatusCode, responseBody);
            }
        }
    }

    /// <summary>
    /// Releases all resources used by the <see cref="SchlepClient"/>.
    /// </summary>
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Releases the unmanaged resources and optionally releases the managed resources.
    /// </summary>
    /// <param name="disposing">true to release both managed and unmanaged resources; false to release only unmanaged resources.</param>
    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed && disposing)
        {
            _httpClient?.Dispose();
            _logger?.LogDebug("SchlepClient disposed");
            _disposed = true;
        }
    }
}