using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Response from the deploy endpoint.
/// </summary>
public class DeployResponse
{
    /// <summary>
    /// Gets or sets the unique identifier for the deployment.
    /// </summary>
    [JsonPropertyName("deployment_id")]
    public string DeploymentId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the URL endpoint for the deployed model.
    /// </summary>
    [JsonPropertyName("endpoint_url")]
    public string EndpointUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the current status of the deployment.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets any additional message about the deployment.
    /// </summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }
}