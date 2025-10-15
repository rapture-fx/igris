package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from the train endpoint.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class TrainResponse {
    @JsonProperty("job_id")
    private String jobId;

    @JsonProperty("model_id")
    private String modelId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("message")
    private String message;

    /**
     * Default constructor.
     */
    public TrainResponse() {}

    /**
     * Get the unique job identifier for the training.
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
    public TrainResponse setJobId(String jobId) {
        this.jobId = jobId;
        return this;
    }

    /**
     * Get the model identifier if training completed.
     *
     * @return The model ID, or null if training not complete
     */
    public String getModelId() {
        return modelId;
    }

    /**
     * Set the model ID.
     *
     * @param modelId The model ID
     * @return This response object for method chaining
     */
    public TrainResponse setModelId(String modelId) {
        this.modelId = modelId;
        return this;
    }

    /**
     * Get the current status of the training.
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
    public TrainResponse setStatus(String status) {
        this.status = status;
        return this;
    }

    /**
     * Get any additional message about the training.
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
    public TrainResponse setMessage(String message) {
        this.message = message;
        return this;
    }

    @Override
    public String toString() {
        return "TrainResponse{" +
                "jobId='" + jobId + '\'' +
                ", modelId='" + modelId + '\'' +
                ", status='" + status + '\'' +
                ", message='" + message + '\'' +
                '}';
    }
}