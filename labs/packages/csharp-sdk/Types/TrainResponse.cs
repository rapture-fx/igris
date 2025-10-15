using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Response from the train endpoint.
/// </summary>
public class TrainResponse
{
    /// <summary>
    /// Gets or sets the unique job identifier for the training.
    /// </summary>
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the model identifier if training completed.
    /// </summary>
    [JsonPropertyName("model_id")]
    public string? ModelId { get; set; }

    /// <summary>
    /// Gets or sets the current status of the training.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets any additional message about the training.
    /// </summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }
}