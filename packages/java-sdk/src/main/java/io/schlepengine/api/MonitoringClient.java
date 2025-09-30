package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import okhttp3.OkHttpClient;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Monitoring API client.
 *
 * <p>Provides methods for system monitoring and health checks.</p>
 *
 * <h3>Features</h3>
 * <ul>
 *   <li>System health monitoring</li>
 *   <li>Performance metrics tracking</li>
 *   <li>Resource usage monitoring</li>
 *   <li>Alert management</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * MonitoringClient monitoringClient = client.monitoring();
 *
 * // Get system health
 * Map<String, Object> health = monitoringClient.getSystemHealth();
 *
 * // Get specific metrics
 * List<String> metrics = Arrays.asList("cpu_usage", "memory_usage", "request_rate");
 * Map<String, Object> metricsData = monitoringClient.getMetrics(metrics, null);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class MonitoringClient extends BaseClient {

    /**
     * Create a new monitoring client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public MonitoringClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/monitoring");
    }

    /**
     * Get system health status.
     *
     * @return System health information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getSystemHealth() throws ApiException, IOException {
        JsonNode response = get("/health");
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get system metrics.
     *
     * @param metricNames Specific metrics to retrieve (optional)
     * @param timeRange Time range for metrics (optional)
     * @return System metrics
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getMetrics(List<String> metricNames, Map<String, String> timeRange)
            throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();

        if (metricNames != null && !metricNames.isEmpty()) {
            params.put("metrics", String.join(",", metricNames));
        }

        if (timeRange != null) {
            params.putAll(timeRange);
        }

        JsonNode response = get("/metrics", params);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Get all available metrics.
     *
     * @return System metrics
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getMetrics() throws ApiException, IOException {
        return getMetrics(null, null);
    }
}