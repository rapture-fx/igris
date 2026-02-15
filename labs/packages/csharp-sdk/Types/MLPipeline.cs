using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Response for ML pipeline operations.
/// </summary>
public class PipelineResponse
{
    /// <summary>
    /// Unique pipeline identifier.
    /// </summary>
    [JsonPropertyName("pipeline_id")]
    public string PipelineId { get; set; } = string.Empty;

    /// <summary>
    /// Pipeline name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Pipeline description.
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Model type (classification, regression, clustering, etc.).
    /// </summary>
    [JsonPropertyName("model_type")]
    public string ModelType { get; set; } = string.Empty;

    /// <summary>
    /// Task type (supervised, unsupervised, etc.).
    /// </summary>
    [JsonPropertyName("task_type")]
    public string? TaskType { get; set; }

    /// <summary>
    /// Pipeline configuration.
    /// </summary>
    [JsonPropertyName("config")]
    public object? Config { get; set; }

    /// <summary>
    /// Pipeline status (active, inactive, archived).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Last updated timestamp.
    /// </summary>
    [JsonPropertyName("updated_at")]
    public string? UpdatedAt { get; set; }
}

/// <summary>
/// Response for training job operations.
/// </summary>
public class TrainingJobResponse
{
    /// <summary>
    /// Unique job identifier.
    /// </summary>
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Associated pipeline ID.
    /// </summary>
    [JsonPropertyName("pipeline_id")]
    public string PipelineId { get; set; } = string.Empty;

    /// <summary>
    /// Training status (pending, training, completed, failed).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Training progress percentage (0-100).
    /// </summary>
    [JsonPropertyName("progress")]
    public double? Progress { get; set; }

    /// <summary>
    /// Model ID if training completed.
    /// </summary>
    [JsonPropertyName("model_id")]
    public string? ModelId { get; set; }

    /// <summary>
    /// Training metrics.
    /// </summary>
    [JsonPropertyName("metrics")]
    public Dictionary<string, object>? Metrics { get; set; }

    /// <summary>
    /// Error message if training failed.
    /// </summary>
    [JsonPropertyName("error")]
    public string? Error { get; set; }

    /// <summary>
    /// Training start time.
    /// </summary>
    [JsonPropertyName("started_at")]
    public string? StartedAt { get; set; }

    /// <summary>
    /// Training completion time.
    /// </summary>
    [JsonPropertyName("completed_at")]
    public string? CompletedAt { get; set; }
}

/// <summary>
/// Response for model deployment operations.
/// </summary>
public class DeploymentResponse
{
    /// <summary>
    /// Deployment identifier.
    /// </summary>
    [JsonPropertyName("deployment_id")]
    public string DeploymentId { get; set; } = string.Empty;

    /// <summary>
    /// Deployed model ID.
    /// </summary>
    [JsonPropertyName("model_id")]
    public string ModelId { get; set; } = string.Empty;

    /// <summary>
    /// Prediction endpoint URL.
    /// </summary>
    [JsonPropertyName("endpoint_url")]
    public string EndpointUrl { get; set; } = string.Empty;

    /// <summary>
    /// Deployment status (deploying, active, failed).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Deployment configuration.
    /// </summary>
    [JsonPropertyName("config")]
    public object? Config { get; set; }

    /// <summary>
    /// Deployment timestamp.
    /// </summary>
    [JsonPropertyName("deployed_at")]
    public string? DeployedAt { get; set; }
}

/// <summary>
/// Response for prediction operations.
/// </summary>
public class PredictionResponse
{
    /// <summary>
    /// Prediction results.
    /// </summary>
    [JsonPropertyName("predictions")]
    public List<object> Predictions { get; set; } = new();

    /// <summary>
    /// Prediction probabilities (if requested).
    /// </summary>
    [JsonPropertyName("probabilities")]
    public List<Dictionary<string, double>>? Probabilities { get; set; }

    /// <summary>
    /// Prediction explanations (if requested).
    /// </summary>
    [JsonPropertyName("explanations")]
    public List<object>? Explanations { get; set; }

    /// <summary>
    /// Model ID used for prediction.
    /// </summary>
    [JsonPropertyName("model_id")]
    public string? ModelId { get; set; }

    /// <summary>
    /// Prediction timestamp.
    /// </summary>
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }
}

/// <summary>
/// Response for model information operations.
/// </summary>
public class ModelInfoResponse
{
    /// <summary>
    /// Unique model identifier.
    /// </summary>
    [JsonPropertyName("model_id")]
    public string ModelId { get; set; } = string.Empty;

    /// <summary>
    /// Model name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Model version.
    /// </summary>
    [JsonPropertyName("version")]
    public string Version { get; set; } = string.Empty;

    /// <summary>
    /// Model type.
    /// </summary>
    [JsonPropertyName("model_type")]
    public string ModelType { get; set; } = string.Empty;

    /// <summary>
    /// Task type.
    /// </summary>
    [JsonPropertyName("task_type")]
    public string TaskType { get; set; } = string.Empty;

    /// <summary>
    /// Model status (training, ready, deployed, archived).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Model performance metrics.
    /// </summary>
    [JsonPropertyName("metrics")]
    public Dictionary<string, object>? Metrics { get; set; }

    /// <summary>
    /// Associated pipeline ID.
    /// </summary>
    [JsonPropertyName("pipeline_id")]
    public string? PipelineId { get; set; }

    /// <summary>
    /// Model creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }
}
