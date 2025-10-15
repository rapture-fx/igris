package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.HashMap;
import java.util.Map;

/**
 * Configuration for training a machine learning model.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class TrainConfig {
    @JsonProperty("model_type")
    private String modelType;

    @JsonProperty("dataset_id")
    private String datasetId;

    @JsonProperty("parameters")
    private Map<String, Object> parameters = new HashMap<>();

    /**
     * Default constructor.
     */
    public TrainConfig() {}

    /**
     * Get the type of model to train.
     *
     * @return The model type
     */
    public String getModelType() {
        return modelType;
    }

    /**
     * Set the type of model to train.
     *
     * @param modelType The model type
     * @return This config object for method chaining
     */
    public TrainConfig setModelType(String modelType) {
        this.modelType = modelType;
        return this;
    }

    /**
     * Get the dataset identifier to use for training.
     *
     * @return The dataset ID
     */
    public String getDatasetId() {
        return datasetId;
    }

    /**
     * Set the dataset identifier to use for training.
     *
     * @param datasetId The dataset ID
     * @return This config object for method chaining
     */
    public TrainConfig setDatasetId(String datasetId) {
        this.datasetId = datasetId;
        return this;
    }

    /**
     * Get the training parameters.
     *
     * @return The parameters map
     */
    public Map<String, Object> getParameters() {
        return parameters;
    }

    /**
     * Set the training parameters.
     *
     * @param parameters The parameters map
     * @return This config object for method chaining
     */
    public TrainConfig setParameters(Map<String, Object> parameters) {
        this.parameters = parameters != null ? parameters : new HashMap<>();
        return this;
    }

    /**
     * Add a training parameter.
     *
     * @param key The parameter key
     * @param value The parameter value
     * @return This config object for method chaining
     */
    public TrainConfig addParameter(String key, Object value) {
        this.parameters.put(key, value);
        return this;
    }

    @Override
    public String toString() {
        return "TrainConfig{" +
                "modelType='" + modelType + '\'' +
                ", datasetId='" + datasetId + '\'' +
                ", parameters=" + parameters +
                '}';
    }
}