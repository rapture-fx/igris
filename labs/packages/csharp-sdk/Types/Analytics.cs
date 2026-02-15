using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Response for analytics query operations.
/// </summary>
public class QueryResponse
{
    /// <summary>
    /// Query results data.
    /// </summary>
    [JsonPropertyName("data")]
    public List<Dictionary<string, object>> Data { get; set; } = new();

    /// <summary>
    /// Query metadata.
    /// </summary>
    [JsonPropertyName("metadata")]
    public QueryMetadata? Metadata { get; set; }

    /// <summary>
    /// Query execution time in milliseconds.
    /// </summary>
    [JsonPropertyName("execution_time_ms")]
    public double? ExecutionTimeMs { get; set; }

    /// <summary>
    /// Number of rows returned.
    /// </summary>
    [JsonPropertyName("row_count")]
    public int RowCount { get; set; }
}

/// <summary>
/// Query metadata information.
/// </summary>
public class QueryMetadata
{
    /// <summary>
    /// Dataset name.
    /// </summary>
    [JsonPropertyName("dataset")]
    public string Dataset { get; set; } = string.Empty;

    /// <summary>
    /// Columns in the result.
    /// </summary>
    [JsonPropertyName("columns")]
    public List<string> Columns { get; set; } = new();

    /// <summary>
    /// Data types for each column.
    /// </summary>
    [JsonPropertyName("types")]
    public Dictionary<string, string>? Types { get; set; }
}

/// <summary>
/// Response for report operations.
/// </summary>
public class ReportResponse
{
    /// <summary>
    /// Unique report identifier.
    /// </summary>
    [JsonPropertyName("report_id")]
    public string ReportId { get; set; } = string.Empty;

    /// <summary>
    /// Report name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Report description.
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Report data.
    /// </summary>
    [JsonPropertyName("data")]
    public object? Data { get; set; }

    /// <summary>
    /// Report status (generating, ready, failed).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Report format (json, pdf, csv, etc.).
    /// </summary>
    [JsonPropertyName("format")]
    public string? Format { get; set; }

    /// <summary>
    /// Report creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }
}

/// <summary>
/// Response for dataset information.
/// </summary>
public class DatasetResponse
{
    /// <summary>
    /// Dataset name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Dataset description.
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Number of rows in dataset.
    /// </summary>
    [JsonPropertyName("row_count")]
    public long? RowCount { get; set; }

    /// <summary>
    /// Number of columns in dataset.
    /// </summary>
    [JsonPropertyName("column_count")]
    public int? ColumnCount { get; set; }

    /// <summary>
    /// Dataset size in bytes.
    /// </summary>
    [JsonPropertyName("size_bytes")]
    public long? SizeBytes { get; set; }

    /// <summary>
    /// Last updated timestamp.
    /// </summary>
    [JsonPropertyName("updated_at")]
    public string? UpdatedAt { get; set; }
}

/// <summary>
/// Wrapper for datasets list response.
/// </summary>
public class DatasetsWrapper
{
    /// <summary>
    /// List of datasets.
    /// </summary>
    [JsonPropertyName("datasets")]
    public List<DatasetResponse> Datasets { get; set; } = new();
}

/// <summary>
/// Response for dataset schema information.
/// </summary>
public class DatasetSchemaResponse
{
    /// <summary>
    /// Dataset name.
    /// </summary>
    [JsonPropertyName("dataset")]
    public string Dataset { get; set; } = string.Empty;

    /// <summary>
    /// Schema fields.
    /// </summary>
    [JsonPropertyName("fields")]
    public List<SchemaField> Fields { get; set; } = new();
}

/// <summary>
/// Schema field definition.
/// </summary>
public class SchemaField
{
    /// <summary>
    /// Field name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Field data type.
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Whether field is nullable.
    /// </summary>
    [JsonPropertyName("nullable")]
    public bool Nullable { get; set; }

    /// <summary>
    /// Field description.
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }
}
