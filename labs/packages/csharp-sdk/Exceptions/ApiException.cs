namespace Igris.Exceptions;

/// <summary>
/// Exception thrown when the Igris-engine API returns an error response.
/// </summary>
/// <remarks>
/// This exception includes both the HTTP status code and the error message
/// returned by the API.
/// </remarks>
public class ApiException : Exception
{
    /// <summary>
    /// Gets the HTTP status code returned by the API.
    /// </summary>
    public int StatusCode { get; }

    /// <summary>
    /// Initializes a new instance of the <see cref="ApiException"/> class with the given status code and message.
    /// </summary>
    /// <param name="statusCode">The HTTP status code returned by the API.</param>
    /// <param name="message">The error message returned by the API.</param>
    public ApiException(int statusCode, string message) : base($"API error {statusCode}: {message}")
    {
        StatusCode = statusCode;
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ApiException"/> class with the given status code, message, and inner exception.
    /// </summary>
    /// <param name="statusCode">The HTTP status code returned by the API.</param>
    /// <param name="message">The error message returned by the API.</param>
    /// <param name="innerException">The exception that is the cause of the current exception.</param>
    public ApiException(int statusCode, string message, Exception innerException) : base($"API error {statusCode}: {message}", innerException)
    {
        StatusCode = statusCode;
    }
}