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
 * Data Quality API client.
 *
 * <p>Provides methods for assessing and monitoring data quality.</p>
 *
 * <h3>Quality Checks</h3>
 * <ul>
 *   <li>Completeness - Check for missing values</li>
 *   <li>Validity - Validate data against schemas</li>
 *   <li>Consistency - Check data consistency</li>
 *   <li>Accuracy - Validate data accuracy</li>
 *   <li>Uniqueness - Check for duplicates</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * QualityClient qualityClient = client.quality();
 *
 * // Assess data quality
 * List<String> checks = Arrays.asList("completeness", "validity", "uniqueness");
 * Map<String, Object> report = qualityClient.assessQuality("s3://bucket/data.csv", checks);
 *
 * // Get quality report
 * String reportId = (String) report.get("report_id");
 * Map<String, Object> detailedReport = qualityClient.getReport(reportId);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class QualityClient extends BaseClient {

    /**
     * Create a new data quality client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public QualityClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/quality");
    }

    /**
     * Assess data quality.
     *
     * @param dataPath Path to data file
     * @param checks Specific quality checks to run (optional)
     * @return Data quality report
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> assessQuality(String dataPath, List<String> checks)
            throws ApiException, IOException {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("data_path", dataPath);
        if (checks != null && !checks.isEmpty()) {
            requestBody.put("checks", checks);
        }

        JsonNode response = post("/assess", requestBody);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Assess data quality with default checks.
     *
     * @param dataPath Path to data file
     * @return Data quality report
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> assessQuality(String dataPath) throws ApiException, IOException {
        return assessQuality(dataPath, null);
    }

    /**
     * Get quality assessment report.
     *
     * @param reportId Report ID
     * @return Data quality report
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getReport(String reportId) throws ApiException, IOException {
        JsonNode response = get("/reports/" + reportId);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }
}