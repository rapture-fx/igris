using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for document extraction operations.
/// </summary>
/// <remarks>
/// Provides methods for extracting text, tables, images, and metadata from documents
/// using OCR and advanced extraction techniques.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var fileData = await File.ReadAllBytesAsync("document.pdf");
/// var result = await client.Document.ExtractTextAsync(fileData, "document.pdf");
/// Console.WriteLine($"Extracted text: {result.Text}");
/// </code>
/// </example>
public class DocumentClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the DocumentClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal DocumentClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Extract text from a document.
    /// </summary>
    /// <param name="fileData">Document file data.</param>
    /// <param name="filename">Document filename.</param>
    /// <param name="extractTables">Whether to extract tables (default: true).</param>
    /// <param name="extractImages">Whether to extract images (default: false).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Extraction results with text and metadata.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ExtractionResponse> ExtractTextAsync(
        byte[] fileData,
        string filename,
        bool extractTables = true,
        bool extractImages = false,
        CancellationToken cancellationToken = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileData), "file", filename);
        form.Add(new StringContent(extractTables.ToString().ToLower()), "extract_tables");
        form.Add(new StringContent(extractImages.ToString().ToLower()), "extract_images");

        return await _client.PostMultipartAsync<ExtractionResponse>("/extract/text", form, cancellationToken);
    }

    /// <summary>
    /// Extract tables from a document.
    /// </summary>
    /// <param name="fileData">Document file data.</param>
    /// <param name="filename">Document filename.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Extracted tables with structured data.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<TableExtractionResponse> ExtractTablesAsync(
        byte[] fileData,
        string filename,
        CancellationToken cancellationToken = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileData), "file", filename);

        return await _client.PostMultipartAsync<TableExtractionResponse>("/extract/tables", form, cancellationToken);
    }

    /// <summary>
    /// Extract images from a document.
    /// </summary>
    /// <param name="fileData">Document file data.</param>
    /// <param name="filename">Document filename.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Extracted images with metadata.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<ImageExtractionResponse> ExtractImagesAsync(
        byte[] fileData,
        string filename,
        CancellationToken cancellationToken = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileData), "file", filename);

        return await _client.PostMultipartAsync<ImageExtractionResponse>("/extract/images", form, cancellationToken);
    }

    /// <summary>
    /// Perform OCR on an image or document.
    /// </summary>
    /// <param name="fileData">Image or document file data.</param>
    /// <param name="filename">File name.</param>
    /// <param name="language">OCR language (default: "en").</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>OCR results with recognized text.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<OCRResponse> PerformOCRAsync(
        byte[] fileData,
        string filename,
        string language = "en",
        CancellationToken cancellationToken = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileData), "file", filename);
        form.Add(new StringContent(language), "language");

        return await _client.PostMultipartAsync<OCRResponse>("/extract/ocr", form, cancellationToken);
    }
}
