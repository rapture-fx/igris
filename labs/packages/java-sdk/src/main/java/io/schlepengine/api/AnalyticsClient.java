package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import okhttp3.OkHttpClient;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Analytics API client.
 *
 * <p>Provides methods for running analytics queries and generating insights.</p>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * AnalyticsClient analyticsClient = client.analytics();
 *
 * // Get available datasets
 * List<Map<String, Object>> datasets = analyticsClient.getDatasets();
 *
 * // Run analytics query
 * Map<String, Object> query = new HashMap<>();
 * query.put("dataset", "sales_data");
 * query.put("metrics", Arrays.asList("sum", "average"));
 * query.put("dimensions", Arrays.asList("region", "product"));
 * Map<String, Object> results = analyticsClient.query(query);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class AnalyticsClient extends BaseClient {

    /**
     * Create a new analytics client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public AnalyticsClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/analytics");
    }

    /**
     * Execute analytics query.
     *
     * @param query Analytics query configuration
     * @return Query results
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> query(Map<String, Object> query) throws ApiException, IOException {
        JsonNode response = post("/query", query);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get available datasets for analytics.
     *
     * @return List of available datasets
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<Map<String, Object>> getDatasets() throws ApiException, IOException {
        JsonNode response = get("/datasets");
        JsonNode dataNode = response.has("data") ? response.get("data") : response;
        JsonNode datasetsNode = dataNode.has("datasets") ? dataNode.get("datasets") : dataNode;

        return objectMapper.convertValue(datasetsNode, new TypeReference<List<Map<String, Object>>>() {});
    }

    /**
     * Get dataset schema.
     *
     * @param dataset Dataset name
     * @return Dataset schema information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getSchema(String dataset) throws ApiException, IOException {
        JsonNode response = get("/datasets/" + dataset + "/schema");
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }
}