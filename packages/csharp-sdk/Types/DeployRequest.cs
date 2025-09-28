using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Request object for deploying a model.
/// </summary>
public class DeployRequest
{
    /// <summary>
    /// Gets or sets the model ID to deploy.
    /// </summary>
    [JsonPropertyName("model_id")]
    public string ModelId { get; set; } = string.Empty;
}