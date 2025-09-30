package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.types.*;
import okhttp3.OkHttpClient;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Machine Learning Pipeline API client.
 *
 * <p>Provides methods for creating, training, and managing ML models and pipelines.</p>
 *
 * <h3>Features</h3>
 * <ul>
 *   <li>Create and manage ML pipelines</li>
 *   <li>Train models with custom configurations</li>
 *   <li>Make predictions with trained models</li>
 *   <li>Monitor training jobs and model metrics</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * MLPipelineClient mlClient = client.ml();
 *
 * // Create a pipeline
 * Map<String, Object> pipelineConfig = new HashMap<>();
 * pipelineConfig.put("name", "My Classification Pipeline");
 * pipelineConfig.put("task_type", MLTaskType.CLASSIFICATION.getValue());
 * Map<String, Object> pipeline = mlClient.createPipeline(pipelineConfig);
 *
 * // Train the pipeline
 * String pipelineId = (String) pipeline.get("pipeline_id");
 * TrainingJob job = mlClient.trainPipeline(pipelineId, null, null);
 *
 * // Make predictions
 * Map<String, Object> inputData = new HashMap<>();
 * inputData.put("feature1", 1.5);
 * inputData.put("feature2", "value");
 * Map<String, Object> prediction = mlClient.predict(job.getModelId(), inputData);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class MLPipelineClient extends BaseClient {

    /**
     * Create a new ML pipeline client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public MLPipelineClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/ml");
    }

    /**
     * Create a new ML pipeline.
     *
     * @param pipelineConfig Pipeline configuration
     * @return Created pipeline information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> createPipeline(Map<String, Object> pipelineConfig)
            throws ApiException, IOException {
        JsonNode response = post("/pipelines", pipelineConfig);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get pipeline configuration.
     *
     * @param pipelineId Pipeline ID
     * @return Pipeline configuration
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getPipeline(String pipelineId) throws ApiException, IOException {
        JsonNode response = get("/pipelines/" + pipelineId);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Update pipeline configuration.
     *
     * @param pipelineId Pipeline ID
     * @param pipelineConfig Updated configuration
     * @return Updated pipeline information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> updatePipeline(String pipelineId, Map<String, Object> pipelineConfig)
            throws ApiException, IOException {
        JsonNode response = put("/pipelines/" + pipelineId, pipelineConfig);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Delete a pipeline.
     *
     * @param pipelineId Pipeline ID
     * @return Deletion confirmation
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> deletePipeline(String pipelineId) throws ApiException, IOException {
        JsonNode response = delete("/pipelines/" + pipelineId);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * List ML pipelines.
     *
     * @param page Page number
     * @param pageSize Items per page
     * @return List of pipelines
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<Map<String, Object>> listPipelines(int page, int pageSize)
            throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));

        JsonNode response = get("/pipelines", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<Map<String, Object>>>() {});
    }

    /**
     * Start training a pipeline.
     *
     * @param pipelineId Pipeline ID
     * @param trainingDataPath Path to training data (optional, overrides pipeline config)
     * @param parameters Additional training parameters
     * @return Training job information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public TrainingJob trainPipeline(String pipelineId, String trainingDataPath, Map<String, Object> parameters)
            throws ApiException, IOException {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("pipeline_id", pipelineId);
        if (trainingDataPath != null) {
            requestBody.put("training_data_path", trainingDataPath);
        }
        requestBody.put("parameters", parameters != null ? parameters : new HashMap<>());

        JsonNode response = post("/train", requestBody);
        return parseData(response, TrainingJob.class);
    }

    /**
     * Train a pipeline asynchronously.
     *
     * @param pipelineId Pipeline ID
     * @param trainingDataPath Path to training data
     * @param parameters Training parameters
     * @return CompletableFuture with training job
     */
    public CompletableFuture<TrainingJob> trainPipelineAsync(
        String pipelineId,
        String trainingDataPath,
        Map<String, Object> parameters
    ) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("pipeline_id", pipelineId);
        if (trainingDataPath != null) {
            requestBody.put("training_data_path", trainingDataPath);
        }
        requestBody.put("parameters", parameters != null ? parameters : new HashMap<>());

        return executeAsync("/train", "POST", requestBody)
            .thenApply(response -> {
                try {
                    return parseData(response, TrainingJob.class);
                } catch (IOException e) {
                    throw new RuntimeException("Failed to parse response", e);
                }
            });
    }

    /**
     * Get training job status and details.
     *
     * @param jobId Training job ID
     * @return Training job information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public TrainingJob getTrainingJob(String jobId) throws ApiException, IOException {
        JsonNode response = get("/training/" + jobId);
        return parseData(response, TrainingJob.class);
    }

    /**
     * Cancel a training job.
     *
     * @param jobId Training job ID
     * @return Cancellation confirmation
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> cancelTraining(String jobId) throws ApiException, IOException {
        JsonNode response = post("/training/" + jobId + "/cancel", new HashMap<>());
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get training logs.
     *
     * @param jobId Training job ID
     * @param lines Number of recent lines to fetch (optional)
     * @return List of log lines
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<String> getTrainingLogs(String jobId, Integer lines) throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        if (lines != null) {
            params.put("lines", String.valueOf(lines));
        }

        JsonNode response = get("/training/" + jobId + "/logs", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;
        JsonNode logsNode = dataNode.has("logs") ? dataNode.get("logs") : dataNode;

        return objectMapper.convertValue(logsNode, new TypeReference<List<String>>() {});
    }

    /**
     * List training jobs.
     *
     * @param page Page number
     * @param pageSize Items per page
     * @param status Filter by job status (optional)
     * @param pipelineId Filter by pipeline ID (optional)
     * @return List of training jobs
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<TrainingJob> listTrainingJobs(int page, int pageSize, String status, String pipelineId)
            throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));
        if (status != null) {
            params.put("status", status);
        }
        if (pipelineId != null) {
            params.put("pipeline_id", pipelineId);
        }

        JsonNode response = get("/training", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<TrainingJob>>() {});
    }

    /**
     * Make predictions with a trained model.
     *
     * @param modelId Model ID
     * @param inputData Input data for prediction
     * @return Prediction results
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> predict(String modelId, Object inputData)
            throws ApiException, IOException {
        return predict(modelId, inputData, false, false);
    }

    /**
     * Make predictions with a trained model.
     *
     * @param modelId Model ID
     * @param inputData Input data for prediction
     * @param returnProbabilities Whether to return prediction probabilities
     * @param explainPredictions Whether to include prediction explanations
     * @return Prediction results
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> predict(
        String modelId,
        Object inputData,
        boolean returnProbabilities,
        boolean explainPredictions
    ) throws ApiException, IOException {
        PredictionRequest request = new PredictionRequest()
            .setModelId(modelId)
            .setInputData(inputData)
            .setReturnProbabilities(returnProbabilities)
            .setExplainPredictions(explainPredictions);

        JsonNode response = post("/predict", request);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Run batch predictions on a dataset.
     *
     * @param modelId Model ID
     * @param dataPath Path to input data file
     * @param outputPath Path for output predictions (optional)
     * @return Batch prediction job information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> batchPredict(String modelId, String dataPath, String outputPath)
            throws ApiException, IOException {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model_id", modelId);
        requestBody.put("data_path", dataPath);
        if (outputPath != null) {
            requestBody.put("output_path", outputPath);
        }

        JsonNode response = post("/predict/batch", requestBody);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get model information.
     *
     * @param modelId Model ID
     * @return Model information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public ModelInfo getModel(String modelId) throws ApiException, IOException {
        JsonNode response = get("/models/" + modelId);
        return parseData(response, ModelInfo.class);
    }

    /**
     * List trained models.
     *
     * @param page Page number
     * @param pageSize Items per page
     * @return List of models
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<ModelInfo> listModels(int page, int pageSize) throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));

        JsonNode response = get("/models", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<ModelInfo>>() {});
    }

    /**
     * Delete a model.
     *
     * @param modelId Model ID
     * @return Deletion confirmation
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> deleteModel(String modelId) throws ApiException, IOException {
        JsonNode response = delete("/models/" + modelId);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get detailed model metrics.
     *
     * @param modelId Model ID
     * @return Model metrics
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getModelMetrics(String modelId) throws ApiException, IOException {
        JsonNode response = get("/models/" + modelId + "/metrics");
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Download a trained model.
     *
     * @param modelId Model ID
     * @return Download URL
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public String getModelDownloadUrl(String modelId) throws ApiException, IOException {
        return buildUrl("/models/" + modelId + "/download");
    }
}