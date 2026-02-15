using System.Text.Json.Serialization;

namespace Igris.Types;

/// <summary>
/// Response for document extraction operations.
/// </summary>
public class ExtractionResponse
{
    /// <summary>
    /// Extracted text content.
    /// </summary>
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// Extracted tables (if requested).
    /// </summary>
    [JsonPropertyName("tables")]
    public List<ExtractedTable>? Tables { get; set; }

    /// <summary>
    /// Extracted images (if requested).
    /// </summary>
    [JsonPropertyName("images")]
    public List<ExtractedImage>? Images { get; set; }

    /// <summary>
    /// Document metadata.
    /// </summary>
    [JsonPropertyName("metadata")]
    public DocumentMetadata? Metadata { get; set; }

    /// <summary>
    /// Number of pages processed.
    /// </summary>
    [JsonPropertyName("page_count")]
    public int? PageCount { get; set; }
}

/// <summary>
/// Response for table extraction operations.
/// </summary>
public class TableExtractionResponse
{
    /// <summary>
    /// Extracted tables.
    /// </summary>
    [JsonPropertyName("tables")]
    public List<ExtractedTable> Tables { get; set; } = new();

    /// <summary>
    /// Number of tables extracted.
    /// </summary>
    [JsonPropertyName("table_count")]
    public int TableCount { get; set; }
}

/// <summary>
/// Response for image extraction operations.
/// </summary>
public class ImageExtractionResponse
{
    /// <summary>
    /// Extracted images.
    /// </summary>
    [JsonPropertyName("images")]
    public List<ExtractedImage> Images { get; set; } = new();

    /// <summary>
    /// Number of images extracted.
    /// </summary>
    [JsonPropertyName("image_count")]
    public int ImageCount { get; set; }
}

/// <summary>
/// Response for OCR operations.
/// </summary>
public class OCRResponse
{
    /// <summary>
    /// Recognized text.
    /// </summary>
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// OCR confidence score (0-1).
    /// </summary>
    [JsonPropertyName("confidence")]
    public double? Confidence { get; set; }

    /// <summary>
    /// Detected language.
    /// </summary>
    [JsonPropertyName("language")]
    public string? Language { get; set; }

    /// <summary>
    /// Text blocks with position information.
    /// </summary>
    [JsonPropertyName("blocks")]
    public List<TextBlock>? Blocks { get; set; }
}

/// <summary>
/// Extracted table structure.
/// </summary>
public class ExtractedTable
{
    /// <summary>
    /// Table index in document.
    /// </summary>
    [JsonPropertyName("index")]
    public int Index { get; set; }

    /// <summary>
    /// Page number where table was found.
    /// </summary>
    [JsonPropertyName("page")]
    public int? Page { get; set; }

    /// <summary>
    /// Table headers.
    /// </summary>
    [JsonPropertyName("headers")]
    public List<string> Headers { get; set; } = new();

    /// <summary>
    /// Table rows.
    /// </summary>
    [JsonPropertyName("rows")]
    public List<List<string>> Rows { get; set; } = new();

    /// <summary>
    /// Number of rows in table.
    /// </summary>
    [JsonPropertyName("row_count")]
    public int RowCount { get; set; }

    /// <summary>
    /// Number of columns in table.
    /// </summary>
    [JsonPropertyName("column_count")]
    public int ColumnCount { get; set; }
}

/// <summary>
/// Extracted image information.
/// </summary>
public class ExtractedImage
{
    /// <summary>
    /// Image index in document.
    /// </summary>
    [JsonPropertyName("index")]
    public int Index { get; set; }

    /// <summary>
    /// Page number where image was found.
    /// </summary>
    [JsonPropertyName("page")]
    public int? Page { get; set; }

    /// <summary>
    /// Image URL or base64 data.
    /// </summary>
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    /// <summary>
    /// Image width in pixels.
    /// </summary>
    [JsonPropertyName("width")]
    public int? Width { get; set; }

    /// <summary>
    /// Image height in pixels.
    /// </summary>
    [JsonPropertyName("height")]
    public int? Height { get; set; }

    /// <summary>
    /// Image format (png, jpg, etc.).
    /// </summary>
    [JsonPropertyName("format")]
    public string? Format { get; set; }
}

/// <summary>
/// Document metadata.
/// </summary>
public class DocumentMetadata
{
    /// <summary>
    /// Document title.
    /// </summary>
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    /// <summary>
    /// Document author.
    /// </summary>
    [JsonPropertyName("author")]
    public string? Author { get; set; }

    /// <summary>
    /// Document creation date.
    /// </summary>
    [JsonPropertyName("created_date")]
    public string? CreatedDate { get; set; }

    /// <summary>
    /// Document format (pdf, docx, etc.).
    /// </summary>
    [JsonPropertyName("format")]
    public string? Format { get; set; }

    /// <summary>
    /// Additional metadata properties.
    /// </summary>
    [JsonPropertyName("properties")]
    public Dictionary<string, object>? Properties { get; set; }
}

/// <summary>
/// Text block with position information.
/// </summary>
public class TextBlock
{
    /// <summary>
    /// Block text content.
    /// </summary>
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// Block confidence score.
    /// </summary>
    [JsonPropertyName("confidence")]
    public double? Confidence { get; set; }

    /// <summary>
    /// Bounding box coordinates.
    /// </summary>
    [JsonPropertyName("bbox")]
    public BoundingBox? BoundingBox { get; set; }
}

/// <summary>
/// Bounding box coordinates.
/// </summary>
public class BoundingBox
{
    /// <summary>
    /// X coordinate.
    /// </summary>
    [JsonPropertyName("x")]
    public double X { get; set; }

    /// <summary>
    /// Y coordinate.
    /// </summary>
    [JsonPropertyName("y")]
    public double Y { get; set; }

    /// <summary>
    /// Width.
    /// </summary>
    [JsonPropertyName("width")]
    public double Width { get; set; }

    /// <summary>
    /// Height.
    /// </summary>
    [JsonPropertyName("height")]
    public double Height { get; set; }
}
