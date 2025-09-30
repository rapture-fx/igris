package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.types.*;
import okhttp3.OkHttpClient;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Data Processing API client.
 *
 * <p>Provides methods for processing, transforming, and managing data through
 * the Schlep-engine platform.</p>
 *
 * <h3>Features</h3>
 * <ul>
 *   <li>Process files in various formats (CSV, JSON, Parquet, etc.)</li>
 *   <li>Apply transformations and data quality checks</li>
 *   <li>Create and manage data processing pipelines</li>
 *   <li>Track job status and retrieve results</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * DataProcessingClient dataClient = client.data();
 *
 * // Process a file
 * File dataFile = new File("data.csv");
 * DataProcessingResult result = dataClient.processFile(
 *     dataFile,
 *     DataFormat.CSV,
 *     DataFormat.JSON
 * );
 *
 * // Check job status
 * JobInfo status = dataClient.getJobStatus(result.getJobId());
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class DataProcessingClient extends BaseClient {

    /**
     * Create a new data processing client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public DataProcessingClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/data");
    }

    /**
     * Process a data file.
     *
     * @param file File to process
     * @param inputFormat Input data format
     * @param outputFormat Output data format
     * @return Data processing result
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DataProcessingResult processFile(File file, DataFormat inputFormat, DataFormat outputFormat)
            throws ApiException, IOException {
        // Upload file first
        FileUpload fileUpload = uploadFile(file);

        // Create processing request
        DataProcessingRequest request = new DataProcessingRequest()
            .setSourcePath(fileUpload.getUrl())
            .setDataFormat(inputFormat)
            .setProcessingMode("batch")
            .setOutputFormat(outputFormat);

        return processData(request);
    }

    /**
     * Process a data file with transformations.
     *
     * @param file File to process
     * @param inputFormat Input data format
     * @param outputFormat Output data format
     * @param transformations List of transformation rules
     * @return Data processing result
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DataProcessingResult processFile(
        File file,
        DataFormat inputFormat,
        DataFormat outputFormat,
        List<Map<String, Object>> transformations
    ) throws ApiException, IOException {
        FileUpload fileUpload = uploadFile(file);

        DataProcessingRequest request = new DataProcessingRequest()
            .setSourcePath(fileUpload.getUrl())
            .setDataFormat(inputFormat)
            .setProcessingMode("batch")
            .setOutputFormat(outputFormat)
            .setTransformations(transformations);

        return processData(request);
    }

    /**
     * Process data from a URL.
     *
     * @param url URL to the data source
     * @param inputFormat Input data format
     * @param outputFormat Output data format
     * @return Data processing result
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DataProcessingResult processUrl(String url, DataFormat inputFormat, DataFormat outputFormat)
            throws ApiException, IOException {
        DataProcessingRequest request = new DataProcessingRequest()
            .setSourceUrl(url)
            .setDataFormat(inputFormat)
            .setProcessingMode("batch")
            .setOutputFormat(outputFormat);

        return processData(request);
    }

    /**
     * Process data with a custom request.
     *
     * @param request Data processing request
     * @return Data processing result
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DataProcessingResult processData(DataProcessingRequest request)
            throws ApiException, IOException {
        JsonNode response = post("/process", request);
        return parseData(response, DataProcessingResult.class);
    }

    /**
     * Process data asynchronously.
     *
     * @param request Data processing request
     * @return CompletableFuture with processing result
     */
    public CompletableFuture<DataProcessingResult> processDataAsync(DataProcessingRequest request) {
        return executeAsync("/process", "POST", request)
            .thenApply(response -> {
                try {
                    return parseData(response, DataProcessingResult.class);
                } catch (IOException e) {
                    throw new RuntimeException("Failed to parse response", e);
                }
            });
    }

    /**
     * Upload a file for processing.
     *
     * @param file File to upload
     * @return File upload information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public FileUpload uploadFile(File file) throws ApiException, IOException {
        JsonNode response = postMultipart("/upload", file, null);
        return parseData(response, FileUpload.class);
    }

    /**
     * Get processing job status.
     *
     * @param jobId Job ID
     * @return Job information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public JobInfo getJobStatus(String jobId) throws ApiException, IOException {
        JsonNode response = get("/jobs/" + jobId);
        return parseData(response, JobInfo.class);
    }

    /**
     * Get processing job result.
     *
     * @param jobId Job ID
     * @return Processing result
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DataProcessingResult getJobResult(String jobId) throws ApiException, IOException {
        JsonNode response = get("/jobs/" + jobId + "/result");
        return parseData(response, DataProcessingResult.class);
    }

    /**
     * Cancel a processing job.
     *
     * @param jobId Job ID
     * @return Cancellation response
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> cancelJob(String jobId) throws ApiException, IOException {
        JsonNode response = post("/jobs/" + jobId + "/cancel", new HashMap<>());
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * List processing jobs.
     *
     * @param page Page number (starting from 1)
     * @param pageSize Items per page
     * @return List of jobs
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<JobInfo> listJobs(int page, int pageSize) throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));

        JsonNode response = get("/jobs", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<JobInfo>>() {});
    }

    /**
     * List processing jobs with status filter.
     *
     * @param page Page number
     * @param pageSize Items per page
     * @param status Filter by job status
     * @return List of jobs
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<JobInfo> listJobs(int page, int pageSize, String status) throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));
        if (status != null) {
            params.put("status", status);
        }

        JsonNode response = get("/jobs", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<JobInfo>>() {});
    }

    /**
     * Create a data processing pipeline.
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
     * @param pipelineConfig Updated pipeline configuration
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
     * Run a pipeline.
     *
     * @param pipelineId Pipeline ID
     * @param parameters Runtime parameters
     * @return Pipeline execution result
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public DataProcessingResult runPipeline(String pipelineId, Map<String, Object> parameters)
            throws ApiException, IOException {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("parameters", parameters != null ? parameters : new HashMap<>());

        JsonNode response = post("/pipelines/" + pipelineId + "/run", requestBody);
        return parseData(response, DataProcessingResult.class);
    }

    /**
     * List data processing pipelines.
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
}