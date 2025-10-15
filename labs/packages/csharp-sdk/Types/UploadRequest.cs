using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Request object for uploading data to Schlep-engine.
/// </summary>
public class UploadRequest
{
    /// <summary>
    /// Gets or sets the data to be uploaded.
    /// </summary>
    [JsonPropertyName("data")]
    public string Data { get; set; } = string.Empty;
}