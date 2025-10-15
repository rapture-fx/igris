package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import okhttp3.OkHttpClient;

import java.io.IOException;
import java.util.Map;

/**
 * Users API client.
 *
 * <p>Provides methods for user management and profile operations.</p>
 *
 * <h3>Features</h3>
 * <ul>
 *   <li>Get and update user profile</li>
 *   <li>Manage user preferences</li>
 *   <li>View user activity</li>
 *   <li>Manage API keys</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * UsersClient usersClient = client.users();
 *
 * // Get current user profile
 * Map<String, Object> profile = usersClient.getProfile();
 *
 * // Update profile
 * Map<String, Object> updates = new HashMap<>();
 * updates.put("name", "New Name");
 * updates.put("email", "newemail@example.com");
 * Map<String, Object> updatedProfile = usersClient.updateProfile(updates);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class UsersClient extends BaseClient {

    /**
     * Create a new users client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public UsersClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/users");
    }

    /**
     * Get current user profile.
     *
     * @return User information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> getProfile() throws ApiException, IOException {
        JsonNode response = get("/me");
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Update user profile.
     *
     * @param updates Fields to update
     * @return Updated user information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> updateProfile(Map<String, Object> updates)
            throws ApiException, IOException {
        JsonNode response = patch("/me", updates);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }
}