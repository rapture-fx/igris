package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from the deploy endpoint.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class DeployResponse {
    @JsonProperty("deployment_id")
    private String deploymentId;

    @JsonProperty("endpoint_url")
    private String endpointUrl;

    @JsonProperty("status")
    private String status;

    @JsonProperty("message")
    private String message;

    /**
     * Default constructor.
     */
    public DeployResponse() {}

    /**
     * Get the unique identifier for the deployment.
     *
     * @return The deployment ID
     */
    public String getDeploymentId() {
        return deploymentId;
    }

    /**
     * Set the deployment ID.
     *
     * @param deploymentId The deployment ID
     * @return This response object for method chaining
     */
    public DeployResponse setDeploymentId(String deploymentId) {
        this.deploymentId = deploymentId;
        return this;
    }

    /**
     * Get the URL endpoint for the deployed model.
     *
     * @return The endpoint URL
     */
    public String getEndpointUrl() {
        return endpointUrl;
    }

    /**
     * Set the endpoint URL.
     *
     * @param endpointUrl The endpoint URL
     * @return This response object for method chaining
     */
    public DeployResponse setEndpointUrl(String endpointUrl) {
        this.endpointUrl = endpointUrl;
        return this;
    }

    /**
     * Get the current status of the deployment.
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
    public DeployResponse setStatus(String status) {
        this.status = status;
        return this;
    }

    /**
     * Get any additional message about the deployment.
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
    public DeployResponse setMessage(String message) {
        this.message = message;
        return this;
    }

    @Override
    public String toString() {
        return "DeployResponse{" +
                "deploymentId='" + deploymentId + '\'' +
                ", endpointUrl='" + endpointUrl + '\'' +
                ", status='" + status + '\'' +
                ", message='" + message + '\'' +
                '}';
    }
}