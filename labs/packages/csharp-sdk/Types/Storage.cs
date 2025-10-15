using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Response for file upload operations.
/// </summary>
public class FileUploadResponse
{
    /// <summary>
    /// Unique file identifier.
    /// </summary>
    [JsonPropertyName("file_id")]
    public string FileId { get; set; } = string.Empty;

    /// <summary>
    /// File name.
    /// </summary>
    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;

    /// <summary>
    /// File URL.
    /// </summary>
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// File size in bytes.
    /// </summary>
    [JsonPropertyName("size")]
    public long Size { get; set; }

    /// <summary>
    /// File content type.
    /// </summary>
    [JsonPropertyName("content_type")]
    public string? ContentType { get; set; }

    /// <summary>
    /// Upload timestamp.
    /// </summary>
    [JsonPropertyName("uploaded_at")]
    public string? UploadedAt { get; set; }
}

/// <summary>
/// File metadata information.
/// </summary>
public class FileMetadata
{
    /// <summary>
    /// Unique file identifier.
    /// </summary>
    [JsonPropertyName("file_id")]
    public string FileId { get; set; } = string.Empty;

    /// <summary>
    /// File name.
    /// </summary>
    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;

    /// <summary>
    /// File URL.
    /// </summary>
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// File size in bytes.
    /// </summary>
    [JsonPropertyName("size")]
    public long Size { get; set; }

    /// <summary>
    /// File content type.
    /// </summary>
    [JsonPropertyName("content_type")]
    public string? ContentType { get; set; }

    /// <summary>
    /// Folder path.
    /// </summary>
    [JsonPropertyName("folder")]
    public string? Folder { get; set; }

    /// <summary>
    /// File hash (MD5, SHA256, etc.).
    /// </summary>
    [JsonPropertyName("hash")]
    public string? Hash { get; set; }

    /// <summary>
    /// Upload timestamp.
    /// </summary>
    [JsonPropertyName("uploaded_at")]
    public string? UploadedAt { get; set; }

    /// <summary>
    /// Last modified timestamp.
    /// </summary>
    [JsonPropertyName("modified_at")]
    public string? ModifiedAt { get; set; }

    /// <summary>
    /// Additional metadata properties.
    /// </summary>
    [JsonPropertyName("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}
