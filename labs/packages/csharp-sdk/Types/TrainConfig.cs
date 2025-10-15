using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Configuration for training a machine learning model.
/// </summary>
public class TrainConfig
{
    /// <summary>
    /// Gets or sets the type of model to train.
    /// </summary>
    [JsonPropertyName("model_type")]
    public string ModelType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the dataset identifier to use for training.
    /// </summary>
    [JsonPropertyName("dataset_id")]
    public string DatasetId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the training parameters.
    /// </summary>
    [JsonPropertyName("parameters")]
    public Dictionary<string, object> Parameters { get; set; } = new();
}