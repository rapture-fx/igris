using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Response from the upload endpoint.
/// </summary>
public class UploadResponse
{
    /// <summary>
    /// Gets or sets the unique job identifier for the upload.
    /// </summary>
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the current status of the upload.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets any additional message about the upload.
    /// </summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }
}