package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from the upload endpoint.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class UploadResponse {
    @JsonProperty("job_id")
    private String jobId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("message")
    private String message;

    /**
     * Default constructor.
     */
    public UploadResponse() {}

    /**
     * Get the unique job identifier for the upload.
     *
     * @return The job ID
     */
    public String getJobId() {
        return jobId;
    }

    /**
     * Set the job ID.
     *
     * @param jobId The job ID
     * @return This response object for method chaining
     */
    public UploadResponse setJobId(String jobId) {
        this.jobId = jobId;
        return this;
    }

    /**
     * Get the current status of the upload.
     *
     * @return The status
     */
    public String getStatus() {
        return status;
    }

    /**
     * Set the status.
     *
     * @param status The status
     * @return This response object for method chaining
     */
    public UploadResponse setStatus(String status) {
        this.status = status;
        return this;
    }

    /**
     * Get any additional message about the upload.
     *
     * @return The message, or null if none
     */
    public String getMessage() {
        return message;
    }

    /**
     * Set the message.
     *
     * @param message The message
     * @return This response object for method chaining
     */
    public UploadResponse setMessage(String message) {
        this.message = message;
        return this;
    }

    @Override
    public String toString() {
        return "UploadResponse{" +
                "jobId='" + jobId + '\'' +
                ", status='" + status + '\'' +
                ", message='" + message + '\'' +
                '}';
    }
}