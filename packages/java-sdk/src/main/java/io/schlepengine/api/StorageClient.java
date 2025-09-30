package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.types.FileUpload;
import okhttp3.OkHttpClient;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Storage API client.
 *
 * <p>Provides methods for file storage and management.</p>
 *
 * <h3>Features</h3>
 * <ul>
 *   <li>Upload files to cloud storage</li>
 *   <li>List and manage stored files</li>
 *   <li>Organize files in folders</li>
 *   <li>Delete files when no longer needed</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * StorageClient storageClient = client.storage();
 *
 * // Upload a file
 * File file = new File("data.csv");
 * FileUpload upload = storageClient.uploadFile(file, "datasets");
 *
 * // List files
 * List<FileUpload> files = storageClient.listFiles("datasets", 1, 20);
 *
 * // Delete a file
 * storageClient.deleteFile(upload.getFileId());
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class StorageClient extends BaseClient {

    /**
     * Create a new storage client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public StorageClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/storage");
    }

    /**
     * Upload file to storage.
     *
     * @param file File to upload
     * @param folder Upload folder (optional)
     * @return File upload information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public FileUpload uploadFile(File file, String folder) throws ApiException, IOException {
        Map<String, String> additionalFields = new HashMap<>();
        if (folder != null) {
            additionalFields.put("folder", folder);
        }

        JsonNode response = postMultipart("/upload", file, additionalFields);
        return parseData(response, FileUpload.class);
    }

    /**
     * Upload file to storage root.
     *
     * @param file File to upload
     * @return File upload information
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public FileUpload uploadFile(File file) throws ApiException, IOException {
        return uploadFile(file, null);
    }

    /**
     * List stored files.
     *
     * @param folder Filter by folder (optional)
     * @param page Page number
     * @param pageSize Items per page
     * @return List of files
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<FileUpload> listFiles(String folder, int page, int pageSize)
            throws ApiException, IOException {
        Map<String, String> params = new HashMap<>();
        if (folder != null) {
            params.put("folder", folder);
        }
        params.put("page", String.valueOf(page));
        params.put("page_size", String.valueOf(pageSize));

        JsonNode response = get("/files", params);
        JsonNode dataNode = response.has("data") ? response.get("data") : response;

        return objectMapper.convertValue(dataNode, new TypeReference<List<FileUpload>>() {});
    }

    /**
     * List all stored files.
     *
     * @param page Page number
     * @param pageSize Items per page
     * @return List of files
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public List<FileUpload> listFiles(int page, int pageSize) throws ApiException, IOException {
        return listFiles(null, page, pageSize);
    }

    /**
     * Delete a file.
     *
     * @param fileId File ID
     * @return Deletion confirmation
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> deleteFile(String fileId) throws ApiException, IOException {
        JsonNode response = delete("/files/" + fileId);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }
}