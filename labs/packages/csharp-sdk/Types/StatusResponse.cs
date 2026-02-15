using System.Text.Json;
using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Response from the status endpoint.
/// </summary>
public class StatusResponse
{
    /// <summary>
    /// Gets or sets the job identifier.
    /// </summary>
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the current status of the job.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the progress percentage (0-100).
    /// </summary>
    [JsonPropertyName("progress")]
    public float? Progress { get; set; }

    /// <summary>
    /// Gets or sets the result data if job completed.
    /// </summary>
    [JsonPropertyName("result")]
    public JsonElement? Result { get; set; }

    /// <summary>
    /// Gets or sets the error message if job failed.
    /// </summary>
    [JsonPropertyName("error")]
    public string? Error { get; set; }

    /// <summary>
    /// Gets or sets the timestamp when the job was created.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Gets or sets the timestamp when the job was last updated.
    /// </summary>
    [JsonPropertyName("updated_at")]
    public string? UpdatedAt { get; set; }
}