using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for machine learning pipeline operations.
/// </summary>
/// <remarks>
/// Provides methods for creating ML pipelines, training models, deploying models,
/// and making predictions.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var config = new { name = "My Pipeline", model_type = "classification" };
/// var pipeline = await client.ML.CreatePipelineAsync(config);
/// var trainingJob = await client.ML.TrainPipelineAsync(pipeline.PipelineId, config);
/// </code>
/// </example>
public class MLPipelineClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the MLPipelineClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal MLPipelineClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Create a new ML pipeline.
    /// </summary>
    /// <param name="config">Pipeline configuration.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Created pipeline information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<PipelineResponse> CreatePipelineAsync(
        object config,
        CancellationToken cancellationToken = default)
    {
        return await _client.PostAsync<PipelineResponse>("/ml/pipelines", config, cancellationToken);
    }

    /// <summary>
    /// Get pipeline configuration and details.
    /// </summary>
    /// <param name="pipelineId">The pipeline ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Pipeline configuration.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<PipelineResponse> GetPipelineAsync(
        string pipelineId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<PipelineResponse>($"/ml/pipelines/{pipelineId}", cancellationToken);
    }

    /// <summary>
    /// List all ML pipelines.
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of pipelines.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<PipelineResponse>> ListPipelinesAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/ml/pipelines{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<PipelineResponse>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Train a pipeline with the specified configuration.
    /// </summary>
    /// <param name="pipelineId">The pipeline ID.</param>
    /// <param name="config">Training configuration.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Training job information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<TrainingJobResponse> TrainPipelineAsync(
        string pipelineId,
        object config,
        CancellationToken cancellationToken = default)
    {
        var body = new { pipeline_id = pipelineId, config };
        return await _client.PostAsync<TrainingJobResponse>("/ml/train", body, cancellationToken);
    }

    /// <summary>
    /// Get training job status and details.
    /// </summary>
    /// <param name="jobId">The training job ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Training job information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<TrainingJobResponse> GetTrainingJobAsync(
        string jobId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<TrainingJobResponse>($"/ml/training/{jobId}", cancellationToken);
    }

    /// <summary>
    /// Deploy a trained model to a production endpoint.
    /// </summary>
    /// <param name="modelId">The model ID to deploy.</param>
    /// <param name="config">Optional deployment configuration.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Deployment information with endpoint URL.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<DeploymentResponse> DeployModelAsync(
        string modelId,
        object? config = null,
        CancellationToken cancellationToken = default)
    {
        var body = new { model_id = modelId, config = config ?? new { } };
        return await _client.PostAsync<DeploymentResponse>("/ml/deploy", body, cancellationToken);
    }

    /// <summary>
    /// Make predictions using a deployed model.
    /// </summary>
    /// <param name="endpoint">The prediction endpoint or model ID.</param>
    /// <param name="data">Input data for prediction.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Prediction results.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<PredictionResponse> PredictAsync(
        string endpoint,
        object data,
        CancellationToken cancellationToken = default)
    {
        var body = new { data };
        return await _client.PostAsync<PredictionResponse>($"/ml/predict/{endpoint}", body, cancellationToken);
    }

    /// <summary>
    /// Get model information and metrics.
    /// </summary>
    /// <param name="modelId">The model ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Model information.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ModelInfoResponse> GetModelAsync(
        string modelId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<ModelInfoResponse>($"/ml/models/{modelId}", cancellationToken);
    }

    /// <summary>
    /// List all trained models.
    /// </summary>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of models.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<ModelInfoResponse>> ListModelsAsync(
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryString = parameters?.ToQueryString() ?? "";
        var path = $"/ml/models{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<ModelInfoResponse>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Delete a model.
    /// </summary>
    /// <param name="modelId">The model ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Deletion confirmation.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<object> DeleteModelAsync(
        string modelId,
        CancellationToken cancellationToken = default)
    {
        return await _client.DeleteAsync<object>($"/ml/models/{modelId}", cancellationToken);
    }
}
