package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import okhttp3.OkHttpClient;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Document Extraction API client.
 *
 * <p>Provides methods for extracting text, tables, and metadata from documents.</p>
 *
 * <h3>Supported Document Types</h3>
 * <ul>
 *   <li>PDF documents</li>
 *   <li>Word documents (.doc, .docx)</li>
 *   <li>Excel spreadsheets (.xls, .xlsx)</li>
 *   <li>Images with OCR (PNG, JPEG, TIFF)</li>
 * </ul>
 *
 * <h3>Example Usage</h3>
 * <pre>{@code
 * DocumentClient docClient = client.document();
 *
 * // Extract text from document
 * File pdfFile = new File("document.pdf");
 * Map<String, Object> result = docClient.extractText(pdfFile, true, false);
 *
 * // Extract tables
 * Map<String, Object> tables = docClient.extractTables(pdfFile);
 * }</pre>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class DocumentClient extends BaseClient {

    /**
     * Create a new document extraction client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     */
    public DocumentClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey
    ) {
        super(httpClient, objectMapper, baseUrl, apiKey, "/extract");
    }

    /**
     * Extract text from document.
     *
     * @param file Document file
     * @param extractTables Whether to extract tables
     * @param extractImages Whether to extract images
     * @return Extraction results
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> extractText(File file, boolean extractTables, boolean extractImages)
            throws ApiException, IOException {
        Map<String, String> additionalFields = new HashMap<>();
        additionalFields.put("extract_tables", String.valueOf(extractTables));
        additionalFields.put("extract_images", String.valueOf(extractImages));

        JsonNode response = postMultipart("/text", file, additionalFields);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * Extract text from document with default options.
     *
     * @param file Document file
     * @return Extraction results
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> extractText(File file) throws ApiException, IOException {
        return extractText(file, true, false);
    }

    /**
     * Extract tables from document.
     *
     * @param file Document file
     * @return Extracted tables
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    public Map<String, Object> extractTables(File file) throws ApiException, IOException {
        JsonNode response = postMultipart("/tables", file, null);
        return parseData(response, new TypeReference<Map<String, Object>>() {});
    }
}