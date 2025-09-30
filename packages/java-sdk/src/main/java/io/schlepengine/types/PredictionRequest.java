package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Prediction request.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class PredictionRequest {
    @JsonProperty("model_id")
    private String modelId;

    @JsonProperty("input_data")
    private Object inputData;

    @JsonProperty("return_probabilities")
    private Boolean returnProbabilities;

    @JsonProperty("explain_predictions")
    private Boolean explainPredictions;

    public PredictionRequest() {
    }

    public String getModelId() {
        return modelId;
    }

    public PredictionRequest setModelId(String modelId) {
        this.modelId = modelId;
        return this;
    }

    public Object getInputData() {
        return inputData;
    }

    public PredictionRequest setInputData(Object inputData) {
        this.inputData = inputData;
        return this;
    }

    public Boolean getReturnProbabilities() {
        return returnProbabilities;
    }

    public PredictionRequest setReturnProbabilities(Boolean returnProbabilities) {
        this.returnProbabilities = returnProbabilities;
        return this;
    }

    public Boolean getExplainPredictions() {
        return explainPredictions;
    }

    public PredictionRequest setExplainPredictions(Boolean explainPredictions) {
        this.explainPredictions = explainPredictions;
        return this;
    }
}