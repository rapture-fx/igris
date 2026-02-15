using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Response for system health check operations.
/// </summary>
public class HealthResponse
{
    /// <summary>
    /// Overall system status (healthy, degraded, unhealthy).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Individual component health statuses.
    /// </summary>
    [JsonPropertyName("components")]
    public Dictionary<string, ComponentHealth>? Components { get; set; }

    /// <summary>
    /// Health check timestamp.
    /// </summary>
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    /// <summary>
    /// System version.
    /// </summary>
    [JsonPropertyName("version")]
    public string? Version { get; set; }
}

/// <summary>
/// Component health information.
/// </summary>
public class ComponentHealth
{
    /// <summary>
    /// Component status (healthy, degraded, unhealthy).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Status message or description.
    /// </summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    /// <summary>
    /// Response time in milliseconds.
    /// </summary>
    [JsonPropertyName("response_time_ms")]
    public double? ResponseTimeMs { get; set; }
}

/// <summary>
/// Response for system metrics operations.
/// </summary>
public class MetricsResponse
{
    /// <summary>
    /// Metric values by name.
    /// </summary>
    [JsonPropertyName("metrics")]
    public Dictionary<string, MetricData> Metrics { get; set; } = new();

    /// <summary>
    /// Time range for metrics.
    /// </summary>
    [JsonPropertyName("time_range")]
    public TimeRange? TimeRange { get; set; }

    /// <summary>
    /// Metrics timestamp.
    /// </summary>
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }
}

/// <summary>
/// Metric data with values over time.
/// </summary>
public class MetricData
{
    /// <summary>
    /// Metric name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Current metric value.
    /// </summary>
    [JsonPropertyName("value")]
    public double Value { get; set; }

    /// <summary>
    /// Metric unit.
    /// </summary>
    [JsonPropertyName("unit")]
    public string? Unit { get; set; }

    /// <summary>
    /// Historical data points.
    /// </summary>
    [JsonPropertyName("data_points")]
    public List<DataPoint>? DataPoints { get; set; }
}

/// <summary>
/// Individual data point for a metric.
/// </summary>
public class DataPoint
{
    /// <summary>
    /// Data point timestamp.
    /// </summary>
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;

    /// <summary>
    /// Data point value.
    /// </summary>
    [JsonPropertyName("value")]
    public double Value { get; set; }
}

/// <summary>
/// Response for alert operations.
/// </summary>
public class AlertResponse
{
    /// <summary>
    /// Unique alert identifier.
    /// </summary>
    [JsonPropertyName("alert_id")]
    public string AlertId { get; set; } = string.Empty;

    /// <summary>
    /// Alert name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Alert severity (critical, high, medium, low).
    /// </summary>
    [JsonPropertyName("severity")]
    public string Severity { get; set; } = string.Empty;

    /// <summary>
    /// Alert status (active, resolved, acknowledged).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Alert message.
    /// </summary>
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Alert configuration.
    /// </summary>
    [JsonPropertyName("config")]
    public object? Config { get; set; }

    /// <summary>
    /// Alert creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }

    /// <summary>
    /// Alert trigger timestamp.
    /// </summary>
    [JsonPropertyName("triggered_at")]
    public string? TriggeredAt { get; set; }

    /// <summary>
    /// Alert resolution timestamp.
    /// </summary>
    [JsonPropertyName("resolved_at")]
    public string? ResolvedAt { get; set; }
}
