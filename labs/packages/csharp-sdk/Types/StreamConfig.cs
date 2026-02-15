using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Configuration for streaming events.
/// </summary>
public class StreamConfig
{
    /// <summary>
    /// Gets or sets the types of events to subscribe to.
    /// </summary>
    [JsonPropertyName("event_types")]
    public List<string> EventTypes { get; set; } = new();

    /// <summary>
    /// Gets or sets the optional filters for events.
    /// </summary>
    [JsonPropertyName("filters")]
    public Dictionary<string, object> Filters { get; set; } = new();
}