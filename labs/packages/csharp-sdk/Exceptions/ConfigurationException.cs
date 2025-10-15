namespace SchlepEngine.Exceptions;

/// <summary>
/// Exception thrown when there's a configuration error with the Schlep-engine client.
/// </summary>
/// <remarks>
/// This typically occurs when:
/// <list type="bullet">
/// <item>The API key is missing or invalid</item>
/// <item>The base URL is malformed</item>
/// <item>Required environment variables are not set</item>
/// </list>
/// </remarks>
public class ConfigurationException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ConfigurationException"/> class with the given message.
    /// </summary>
    /// <param name="message">The error message describing the configuration issue.</param>
    public ConfigurationException(string message) : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ConfigurationException"/> class with the given message and inner exception.
    /// </summary>
    /// <param name="message">The error message describing the configuration issue.</param>
    /// <param name="innerException">The exception that is the cause of the current exception.</param>
    public ConfigurationException(string message, Exception innerException) : base(message, innerException)
    {
    }
}