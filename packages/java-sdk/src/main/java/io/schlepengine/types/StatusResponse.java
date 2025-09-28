package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Response from the status endpoint.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class StatusResponse {
    @JsonProperty("job_id")
    private String jobId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("progress")
    private Float progress;

    @JsonProperty("result")
    private JsonNode result;

    @JsonProperty("error")
    private String error;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    /**
     * Default constructor.
     */
    public StatusResponse() {}

    /**
     * Get the job identifier.
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
    public StatusResponse setJobId(String jobId) {
        this.jobId = jobId;
        return this;
    }

    /**
     * Get the current status of the job.
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
    public StatusResponse setStatus(String status) {
        this.status = status;
        return this;
    }

    /**
     * Get the progress percentage (0-100).
     *
     * @return The progress, or null if not available
     */
    public Float getProgress() {
        return progress;
    }

    /**
     * Set the progress.
     *
     * @param progress The progress percentage
     * @return This response object for method chaining
     */
    public StatusResponse setProgress(Float progress) {
        this.progress = progress;
        return this;
    }

    /**
     * Get the result data if job completed.
     *
     * @return The result data, or null if not available
     */
    public JsonNode getResult() {
        return result;
    }

    /**
     * Set the result data.
     *
     * @param result The result data
     * @return This response object for method chaining
     */
    public StatusResponse setResult(JsonNode result) {
        this.result = result;
        return this;
    }

    /**
     * Get the error message if job failed.
     *
     * @return The error message, or null if no error
     */
    public String getError() {
        return error;
    }

    /**
     * Set the error message.
     *
     * @param error The error message
     * @return This response object for method chaining
     */
    public StatusResponse setError(String error) {
        this.error = error;
        return this;
    }

    /**
     * Get the timestamp when the job was created.
     *
     * @return The creation timestamp, or null if not available
     */
    public String getCreatedAt() {
        return createdAt;
    }

    /**
     * Set the creation timestamp.
     *
     * @param createdAt The creation timestamp
     * @return This response object for method chaining
     */
    public StatusResponse setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    /**
     * Get the timestamp when the job was last updated.
     *
     * @return The update timestamp, or null if not available
     */
    public String getUpdatedAt() {
        return updatedAt;
    }

    /**
     * Set the update timestamp.
     *
     * @param updatedAt The update timestamp
     * @return This response object for method chaining
     */
    public StatusResponse setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
        return this;
    }

    @Override
    public String toString() {
        return "StatusResponse{" +
                "jobId='" + jobId + '\'' +
                ", status='" + status + '\'' +
                ", progress=" + progress +
                ", result=" + result +
                ", error='" + error + '\'' +
                ", createdAt='" + createdAt + '\'' +
                ", updatedAt='" + updatedAt + '\'' +
                '}';
    }
}