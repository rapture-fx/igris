using System.Text.Json.Serialization;
using System.Web;

namespace SchlepEngine.Types;

/// <summary>
/// Parameters for list operations with pagination and filtering.
/// </summary>
public class ListParams
{
    /// <summary>
    /// Page number (1-indexed).
    /// </summary>
    [JsonPropertyName("page")]
    public int? Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    [JsonPropertyName("page_size")]
    public int? PageSize { get; set; }

    /// <summary>
    /// Filter by status.
    /// </summary>
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    /// <summary>
    /// Convert parameters to query string.
    /// </summary>
    /// <returns>Query string with parameters.</returns>
    public string ToQueryString()
    {
        var parameters = new List<string>();

        if (Page.HasValue)
            parameters.Add($"page={Page.Value}");

        if (PageSize.HasValue)
            parameters.Add($"page_size={PageSize.Value}");

        if (!string.IsNullOrEmpty(Status))
            parameters.Add($"status={Uri.EscapeDataString(Status)}");

        return parameters.Count > 0 ? "?" + string.Join("&", parameters) : "";
    }
}

/// <summary>
/// Paginated response wrapper.
/// </summary>
/// <typeparam name="T">Type of items in the response.</typeparam>
public class PaginatedResponse<T>
{
    /// <summary>
    /// List of items for the current page.
    /// </summary>
    [JsonPropertyName("items")]
    public List<T> Items { get; set; } = new();

    /// <summary>
    /// Total number of items across all pages.
    /// </summary>
    [JsonPropertyName("total")]
    public long Total { get; set; }

    /// <summary>
    /// Current page number.
    /// </summary>
    [JsonPropertyName("page")]
    public int Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    [JsonPropertyName("page_size")]
    public int PageSize { get; set; }

    /// <summary>
    /// Total number of pages.
    /// </summary>
    [JsonPropertyName("total_pages")]
    public int TotalPages { get; set; }
}

/// <summary>
/// Time range for time-based queries.
/// </summary>
public class TimeRange
{
    /// <summary>
    /// Start time (ISO 8601 format).
    /// </summary>
    [JsonPropertyName("start")]
    public string Start { get; set; } = string.Empty;

    /// <summary>
    /// End time (ISO 8601 format).
    /// </summary>
    [JsonPropertyName("end")]
    public string End { get; set; } = string.Empty;
}
