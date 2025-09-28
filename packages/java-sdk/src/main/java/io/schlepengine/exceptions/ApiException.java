package io.schlepengine.exceptions;

/**
 * Exception thrown when the Schlep-engine API returns an error response.
 *
 * <p>This exception includes both the HTTP status code and the error message
 * returned by the API.</p>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class ApiException extends Exception {
    private final int statusCode;
    private final String message;

    /**
     * Create a new ApiException with the given status code and message.
     *
     * @param statusCode The HTTP status code returned by the API
     * @param message The error message returned by the API
     */
    public ApiException(int statusCode, String message) {
        super(String.format("API error %d: %s", statusCode, message));
        this.statusCode = statusCode;
        this.message = message;
    }

    /**
     * Get the HTTP status code returned by the API.
     *
     * @return The HTTP status code
     */
    public int getStatusCode() {
        return statusCode;
    }

    /**
     * Get the error message returned by the API.
     *
     * @return The error message
     */
    @Override
    public String getMessage() {
        return message;
    }
}