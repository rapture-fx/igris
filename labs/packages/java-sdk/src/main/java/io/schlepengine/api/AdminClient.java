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
 * Admin API client.
 *
 * <p>Provides methods for administrative functions. Requires admin privileges.</p>
 *
 * <h3>Features</h3>
 * <ul>
 *   <li>System statistics and monitoring</li>
 *   <li>User management (admin only)</li>
 *   <li>System configuration</li>
 *   <li>Resource allocation</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * AdminClient adminClient = client.admin();
 *
 * // Get system statistics
 * Map<String, Object> stats = adminClient.getSystemStats();
 *
 * // List all users (admin only)
 * List<Map<String, Object>> users = adminClient.listUsers(1, 50);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class AdminClient extends BaseClient {

    /**
     * Create a new admin client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public AdminClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/admin");
    }

    /**
     * Get system statistics.
     *
     * @return System statistics
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getSystemStats() throws ApiException, IOException {
        JsonNode response = get("/stats");
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * List all users (admin only).
     *
     * @param page Page number
     * @param pageSize Items per page
     * @return List of users
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<Map<String, Object>> listUsers(int page, int pageSize)
            throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));

        JsonNode response = get("/users", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<Map<String, Object>>>() {});
    }
}