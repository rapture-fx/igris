package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request object for deploying a model.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class DeployRequest {
    @JsonProperty("model_id")
    private String modelId;

    /**
     * Default constructor.
     */
    public DeployRequest() {}

    /**
     * Get the model ID to deploy.
     *
     * @return The model ID
     */
    public String getModelId() {
        return modelId;
    }

    /**
     * Set the model ID to deploy.
     *
     * @param modelId The model ID
     * @return This request object for method chaining
     */
    public DeployRequest setModelId(String modelId) {
        this.modelId = modelId;
        return this;
    }

    @Override
    public String toString() {
        return "DeployRequest{" +
                "modelId='" + modelId + '\'' +
                '}';
    }
}