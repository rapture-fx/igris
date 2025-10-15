using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Response for data processing job operations.
/// </summary>
public class ProcessingJobResponse
{
    /// <summary>
    /// Unique job identifier.
    /// </summary>
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Current job status (pending, processing, completed, failed).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Job progress percentage (0-100).
    /// </summary>
    [JsonPropertyName("progress")]
    public double? Progress { get; set; }

    /// <summary>
    /// Result data if job is completed.
    /// </summary>
    [JsonPropertyName("result")]
    public object? Result { get; set; }

    /// <summary>
    /// Error message if job failed.
    /// </summary>
    [JsonPropertyName("error")]
    public string? Error { get; set; }

    /// <summary>
    /// Job creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Job completion timestamp.
    /// </summary>
    [JsonPropertyName("completed_at")]
    public string? CompletedAt { get; set; }
}

/// <summary>
/// Response for data transformation operations.
/// </summary>
public class TransformationResponse
{
    /// <summary>
    /// Job identifier for the transformation.
    /// </summary>
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Transformation status.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Transformed data.
    /// </summary>
    [JsonPropertyName("data")]
    public object? Data { get; set; }

    /// <summary>
    /// Number of records transformed.
    /// </summary>
    [JsonPropertyName("records_transformed")]
    public int? RecordsTransformed { get; set; }

    /// <summary>
    /// Transformation warnings.
    /// </summary>
    [JsonPropertyName("warnings")]
    public List<string>? Warnings { get; set; }
}

/// <summary>
/// Response for schema validation operations.
/// </summary>
public class ValidationResponse
{
    /// <summary>
    /// Validation result (valid or invalid).
    /// </summary>
    [JsonPropertyName("valid")]
    public bool Valid { get; set; }

    /// <summary>
    /// Validation errors if any.
    /// </summary>
    [JsonPropertyName("errors")]
    public List<ValidationError>? Errors { get; set; }

    /// <summary>
    /// Validation warnings if any.
    /// </summary>
    [JsonPropertyName("warnings")]
    public List<string>? Warnings { get; set; }

    /// <summary>
    /// Number of records validated.
    /// </summary>
    [JsonPropertyName("records_validated")]
    public int? RecordsValidated { get; set; }
}

/// <summary>
/// Validation error details.
/// </summary>
public class ValidationError
{
    /// <summary>
    /// Field name with error.
    /// </summary>
    [JsonPropertyName("field")]
    public string Field { get; set; } = string.Empty;

    /// <summary>
    /// Error message.
    /// </summary>
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Row number (if applicable).
    /// </summary>
    [JsonPropertyName("row")]
    public int? Row { get; set; }
}
