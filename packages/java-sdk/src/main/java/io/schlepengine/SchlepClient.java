package io.schlepengine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.api.*;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.exceptions.ConfigurationException;
import io.schlepengine.types.*;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Main client for interacting with the Schlep-engine API.
 *
 * <p>The client provides methods for uploading data, training models, deploying models,
 * checking job status, and streaming real-time events.</p>
 *
 * <h3>Authentication</h3>
 * <p>The client requires an API key for authentication. You can provide it either:</p>
 * <ul>
 *   <li>As a parameter when creating the client: {@code new SchlepClient("your-api-key")}</li>
 *   <li>Via the {@code SCHLEP_API_KEY} environment variable</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * SchlepClient client = new SchlepClient("your-api-key");
 *
 * // Upload data
 * UploadResponse uploadResult = client.upload("Hello, world!");
 * System.out.println("Upload job ID: " + uploadResult.getJobId());
 *
 * // Train a model
 * TrainConfig config = new TrainConfig()
 *     .setModelType("classification")
 *     .setDatasetId(uploadResult.getJobId());
 * TrainResponse trainResult = client.train(config);
 *
 * // Deploy model
 * if (trainResult.getModelId() != null) {
 *     DeployResponse deployResult = client.deploy(trainResult.getModelId());
 *     System.out.println("Model deployed at: " + deployResult.getEndpointUrl());
 * }
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class SchlepClient {
    private static final Logger logger = LoggerFactory.getLogger(SchlepClient.class);

    public static final String DEFAULT_BASE_URL = "https://api.schlep-engine.com/v1";

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;

    // API clients
    private DataProcessingClient dataProcessingClient;
    private MLPipelineClient mlPipelineClient;
    private AnalyticsClient analyticsClient;
    private DocumentClient documentClient;
    private QualityClient qualityClient;
    private StorageClient storageClient;
    private MonitoringClient monitoringClient;
    private UsersClient usersClient;
    private AdminClient adminClient;

    /**
     * Create a new Schlep-engine client with the provided API key.
     *
     * @param apiKey Your Schlep-engine API key
     * @throws ConfigurationException if the API key is null or empty
     */
    public SchlepClient(String apiKey) throws ConfigurationException {
        this(apiKey, DEFAULT_BASE_URL);
    }

    /**
     * Create a new client using the API key from the SCHLEP_API_KEY environment variable.
     *
     * @return A new SchlepClient instance
     * @throws ConfigurationException if the environment variable is not set or empty
     */
    public static SchlepClient fromEnv() throws ConfigurationException {
        String apiKey = System.getenv("SCHLEP_API_KEY");
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new ConfigurationException("SCHLEP_API_KEY environment variable not set or empty");
        }
        return new SchlepClient(apiKey);
    }

    /**
     * Create a new client with a custom base URL.
     *
     * @param apiKey Your Schlep-engine API key
     * @param baseUrl Custom base URL for the API
     * @throws ConfigurationException if the API key is null or empty
     */
    public SchlepClient(String apiKey, String baseUrl) throws ConfigurationException {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new ConfigurationException("API key cannot be null or empty");
        }

        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build();

        logger.debug("SchlepClient initialized with base URL: {}", baseUrl);
    }

    /**
     * Upload data to Schlep-engine for processing.
     *
     * @param data The data to upload (can be text, JSON, etc.)
     * @return UploadResponse containing the job ID and status
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public UploadResponse upload(String data) throws ApiException, IOException {
        logger.debug("Uploading data");

        UploadRequest request = new UploadRequest().setData(data);
        String url = baseUrl + "/upload";

        RequestBody body = RequestBody.create(
            objectMapper.writeValueAsString(request),
            MediaType.get("application/json")
        );

        Request httpRequest = new Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(httpRequest, UploadResponse.class);
    }

    /**
     * Train a machine learning model with the provided configuration.
     *
     * @param config Training configuration (model type, dataset, parameters)
     * @return TrainResponse containing the job ID and status
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public TrainResponse train(TrainConfig config) throws ApiException, IOException {
        logger.debug("Training model with config: {}", config);

        String url = baseUrl + "/train";

        RequestBody body = RequestBody.create(
            objectMapper.writeValueAsString(config),
            MediaType.get("application/json")
        );

        Request httpRequest = new Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(httpRequest, TrainResponse.class);
    }

    /**
     * Train a machine learning model with JSON configuration.
     *
     * @param configJson JSON configuration as a string
     * @return TrainResponse containing the job ID and status
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public TrainResponse train(String configJson) throws ApiException, IOException {
        logger.debug("Training model with JSON config");

        String url = baseUrl + "/train";

        RequestBody body = RequestBody.create(
            configJson,
            MediaType.get("application/json")
        );

        Request httpRequest = new Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(httpRequest, TrainResponse.class);
    }

    /**
     * Deploy a trained model to a production endpoint.
     *
     * @param modelId ID of the trained model to deploy
     * @return DeployResponse containing the deployment details
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DeployResponse deploy(String modelId) throws ApiException, IOException {
        logger.debug("Deploying model: {}", modelId);

        DeployRequest request = new DeployRequest().setModelId(modelId);
        String url = baseUrl + "/deploy";

        RequestBody body = RequestBody.create(
            objectMapper.writeValueAsString(request),
            MediaType.get("application/json")
        );

        Request httpRequest = new Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(httpRequest, DeployResponse.class);
    }

    /**
     * Check the status of a job (upload, training, deployment, etc.).
     *
     * @param jobId ID of the job to check
     * @return StatusResponse containing the current job status and progress
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public StatusResponse status(String jobId) throws ApiException, IOException {
        logger.debug("Checking status for job: {}", jobId);

        String url = baseUrl + "/status/" + jobId;

        Request httpRequest = new Request.Builder()
            .url(url)
            .get()
            .addHeader("Authorization", "Bearer " + apiKey)
            .build();

        return executeRequest(httpRequest, StatusResponse.class);
    }

    /**
     * Stream real-time events from Schlep-engine.
     *
     * <p>This is a basic WebSocket streaming implementation. For production use,
     * you may want to implement more sophisticated event handling and reconnection logic.</p>
     *
     * @param config Configuration for the types of events to stream
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public void stream(StreamConfig config) throws ApiException, IOException {
        logger.debug("Starting stream with config: {}", config);

        // This is a simplified implementation for demonstration
        // In practice, you'd implement proper WebSocket handling here
        String wsUrl = baseUrl.replace("https://", "wss://").replace("http://", "ws://") + "/stream";

        logger.info("WebSocket connection would be established at: {}", wsUrl);
        logger.info("Stream configuration: {}", objectMapper.writeValueAsString(config));

        // TODO: Implement actual WebSocket streaming
        // For now, this is a placeholder implementation
    }

    /**
     * Execute an HTTP request and parse the response.
     *
     * @param request The HTTP request to execute
     * @param responseClass The class to deserialize the response into
     * @param <T> The response type
     * @return The parsed response object
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    private <T> T executeRequest(Request request, Class<T> responseClass) throws ApiException, IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";

            if (response.isSuccessful()) {
                return objectMapper.readValue(responseBody, responseClass);
            } else {
                // Try to parse error response
                try {
                    JsonNode errorJson = objectMapper.readTree(responseBody);
                    String message = errorJson.has("message") ?
                        errorJson.get("message").asText() : "Unknown API error";
                    throw new ApiException(response.code(), message);
                } catch (Exception e) {
                    throw new ApiException(response.code(), responseBody);
                }
            }
        }
    }

    /**
     * Get the base URL for this client.
     *
     * @return The base URL
     */
    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Get the data processing API client.
     *
     * @return DataProcessingClient instance
     */
    public DataProcessingClient data() {
        if (dataProcessingClient == null) {
            dataProcessingClient = new DataProcessingClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return dataProcessingClient;
    }

    /**
     * Get the ML pipeline API client.
     *
     * @return MLPipelineClient instance
     */
    public MLPipelineClient ml() {
        if (mlPipelineClient == null) {
            mlPipelineClient = new MLPipelineClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return mlPipelineClient;
    }

    /**
     * Get the analytics API client.
     *
     * @return AnalyticsClient instance
     */
    public AnalyticsClient analytics() {
        if (analyticsClient == null) {
            analyticsClient = new AnalyticsClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return analyticsClient;
    }

    /**
     * Get the document extraction API client.
     *
     * @return DocumentClient instance
     */
    public DocumentClient document() {
        if (documentClient == null) {
            documentClient = new DocumentClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return documentClient;
    }

    /**
     * Get the data quality API client.
     *
     * @return QualityClient instance
     */
    public QualityClient quality() {
        if (qualityClient == null) {
            qualityClient = new QualityClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return qualityClient;
    }

    /**
     * Get the storage API client.
     *
     * @return StorageClient instance
     */
    public StorageClient storage() {
        if (storageClient == null) {
            storageClient = new StorageClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return storageClient;
    }

    /**
     * Get the monitoring API client.
     *
     * @return MonitoringClient instance
     */
    public MonitoringClient monitoring() {
        if (monitoringClient == null) {
            monitoringClient = new MonitoringClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return monitoringClient;
    }

    /**
     * Get the users API client.
     *
     * @return UsersClient instance
     */
    public UsersClient users() {
        if (usersClient == null) {
            usersClient = new UsersClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return usersClient;
    }

    /**
     * Get the admin API client.
     *
     * @return AdminClient instance
     */
    public AdminClient admin() {
        if (adminClient == null) {
            adminClient = new AdminClient(httpClient, objectMapper, baseUrl, apiKey);
        }
        return adminClient;
    }

    /**
     * Close the client and release resources.
     */
    public void close() {
        httpClient.dispatcher().executorService().shutdown();
        httpClient.connectionPool().evictAll();
        logger.debug("SchlepClient closed");
    }
}