package io.schlepengine.exceptions;

/**
 * Exception thrown when there's a configuration error with the Schlep-engine client.
 *
 * <p>This typically occurs when:</p>
 * <ul>
 *   <li>The API key is missing or invalid</li>
 *   <li>The base URL is malformed</li>
 *   <li>Required environment variables are not set</li>
 * </ul>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class ConfigurationException extends Exception {

    /**
     * Create a new ConfigurationException with the given message.
     *
     * @param message The error message describing the configuration issue
     */
    public ConfigurationException(String message) {
        super(message);
    }

    /**
     * Create a new ConfigurationException with the given message and cause.
     *
     * @param message The error message describing the configuration issue
     * @param cause The underlying cause of the configuration error
     */
    public ConfigurationException(String message, Throwable cause) {
        super(message, cause);
    }
}