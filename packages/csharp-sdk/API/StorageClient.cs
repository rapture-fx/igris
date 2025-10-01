using SchlepEngine.Types;

namespace SchlepEngine.API;

/// <summary>
/// Client for storage operations.
/// </summary>
/// <remarks>
/// Provides methods for uploading, downloading, and managing files in storage.
/// </remarks>
/// <example>
/// <code>
/// var client = new SchlepClient("your-api-key");
/// var fileData = await File.ReadAllBytesAsync("data.csv");
/// var upload = await client.Storage.UploadFileAsync(fileData, "data.csv");
/// Console.WriteLine($"File uploaded: {upload.Url}");
/// </code>
/// </example>
public class StorageClient
{
    private readonly SchlepClient _client;

    /// <summary>
    /// Initializes a new instance of the StorageClient class.
    /// </summary>
    /// <param name="client">The parent SchlepClient instance.</param>
    internal StorageClient(SchlepClient client)
    {
        _client = client;
    }

    /// <summary>
    /// Upload a file to storage.
    /// </summary>
    /// <param name="fileData">File data as byte array.</param>
    /// <param name="filename">File name.</param>
    /// <param name="folder">Optional folder path.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>File upload information with URL and metadata.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<FileUploadResponse> UploadFileAsync(
        byte[] fileData,
        string filename,
        string? folder = null,
        CancellationToken cancellationToken = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileData), "file", filename);
        if (folder != null)
        {
            form.Add(new StringContent(folder), "folder");
        }

        return await _client.PostMultipartAsync<FileUploadResponse>("/storage/upload", form, cancellationToken);
    }

    /// <summary>
    /// Get file metadata.
    /// </summary>
    /// <param name="fileId">File ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>File metadata.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<FileMetadata> GetFileAsync(
        string fileId,
        CancellationToken cancellationToken = default)
    {
        return await _client.GetAsync<FileMetadata>($"/storage/files/{fileId}", cancellationToken);
    }

    /// <summary>
    /// List all stored files.
    /// </summary>
    /// <param name="folder">Optional folder filter.</param>
    /// <param name="parameters">Optional list parameters for pagination and filtering.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of files.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<List<FileMetadata>> ListFilesAsync(
        string? folder = null,
        ListParams? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var queryParams = parameters ?? new ListParams();
        var queryString = queryParams.ToQueryString();
        if (folder != null)
        {
            queryString = string.IsNullOrEmpty(queryString)
                ? $"?folder={Uri.EscapeDataString(folder)}"
                : $"{queryString}&folder={Uri.EscapeDataString(folder)}";
        }

        var path = $"/storage/files{queryString}";
        var response = await _client.GetAsync<PaginatedResponse<FileMetadata>>(path, cancellationToken);
        return response.Items;
    }

    /// <summary>
    /// Download a file from storage.
    /// </summary>
    /// <param name="fileId">File ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>File data as byte array.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<byte[]> DownloadFileAsync(
        string fileId,
        CancellationToken cancellationToken = default)
    {
        return await _client.DownloadAsync($"/storage/files/{fileId}/download", cancellationToken);
    }

    /// <summary>
    /// Delete a file from storage.
    /// </summary>
    /// <param name="fileId">File ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Deletion confirmation.</returns>
    /// <exception cref="ApiException">Thrown if the API returns an error.</exception>
    public async Task<object> DeleteFileAsync(
        string fileId,
        CancellationToken cancellationToken = default)
    {
        return await _client.DeleteAsync<object>($"/storage/files/{fileId}", cancellationToken);
    }
}
