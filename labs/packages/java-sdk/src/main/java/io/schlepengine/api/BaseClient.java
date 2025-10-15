package io.schlepengine.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Base client for all API endpoint implementations.
 *
 * <p>Provides common functionality for making API requests, handling responses,
 * and managing pagination.</p>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public abstract class BaseClient {
    private static final Logger logger = LoggerFactory.getLogger(BaseClient.class);

    protected final OkHttpClient httpClient;
    protected final ObjectMapper objectMapper;
    protected final String baseUrl;
    protected final String apiKey;
    protected final String basePath;

    /**
     * Create a new base client.
     *
     * @param httpClient HTTP client instance
     * @param objectMapper JSON mapper instance
     * @param baseUrl API base URL
     * @param apiKey API authentication key
     * @param basePath Base path for this API (e.g., "/data", "/ml")
     */
    protected BaseClient(
        OkHttpClient httpClient,
        ObjectMapper objectMapper,
        String baseUrl,
        String apiKey,
        String basePath
    ) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.basePath = basePath;
    }

    /**
     * Build a full URL path by combining base path with relative path.
     *
     * @param path Relative path
     * @return Full URL
     */
    protected String buildUrl(String path) {
        if (path.startsWith("/")) {
            return baseUrl + basePath + path;
        } else {
            return baseUrl + basePath + "/" + path;
        }
    }

    /**
     * Execute a synchronous GET request.
     *
     * @param path API path
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode get(String path) throws ApiException, IOException {
        return get(path, null);
    }

    /**
     * Execute a synchronous GET request with query parameters.
     *
     * @param path API path
     * @param queryParams Query parameters
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode get(String path, Map<String, String> queryParams) throws ApiException, IOException {
        HttpUrl.Builder urlBuilder = HttpUrl.parse(buildUrl(path)).newBuilder();

        if (queryParams != null) {
            for (Map.Entry<String, String> entry : queryParams.entrySet()) {
                if (entry.getValue() != null) {
                    urlBuilder.addQueryParameter(entry.getKey(), entry.getValue());
                }
            }
        }

        Request request = new Request.Builder()
            .url(urlBuilder.build())
            .get()
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(request);
    }

    /**
     * Execute a synchronous POST request.
     *
     * @param path API path
     * @param body Request body object
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode post(String path, Object body) throws ApiException, IOException {
        RequestBody requestBody = RequestBody.create(
            objectMapper.writeValueAsString(body),
            MediaType.get("application/json")
        );

        Request request = new Request.Builder()
            .url(buildUrl(path))
            .post(requestBody)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(request);
    }

    /**
     * Execute a synchronous POST request with multipart file upload.
     *
     * @param path API path
     * @param file File to upload
     * @param additionalFields Additional form fields
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode postMultipart(String path, File file, Map<String, String> additionalFields)
            throws ApiException, IOException {
        MultipartBody.Builder bodyBuilder = new MultipartBody.Builder()
            .setType(MultipartBody.FORM);

        bodyBuilder.addFormDataPart("file", file.getName(),
            RequestBody.create(file, MediaType.parse("application/octet-stream")));

        if (additionalFields != null) {
            for (Map.Entry<String, String> entry : additionalFields.entrySet()) {
                bodyBuilder.addFormDataPart(entry.getKey(), entry.getValue());
            }
        }

        Request request = new Request.Builder()
            .url(buildUrl(path))
            .post(bodyBuilder.build())
            .addHeader("Authorization", "Bearer " + apiKey)
            .build();

        return executeRequest(request);
    }

    /**
     * Execute a synchronous PUT request.
     *
     * @param path API path
     * @param body Request body object
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode put(String path, Object body) throws ApiException, IOException {
        RequestBody requestBody = RequestBody.create(
            objectMapper.writeValueAsString(body),
            MediaType.get("application/json")
        );

        Request request = new Request.Builder()
            .url(buildUrl(path))
            .put(requestBody)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(request);
    }

    /**
     * Execute a synchronous PATCH request.
     *
     * @param path API path
     * @param body Request body object
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode patch(String path, Object body) throws ApiException, IOException {
        RequestBody requestBody = RequestBody.create(
            objectMapper.writeValueAsString(body),
            MediaType.get("application/json")
        );

        Request request = new Request.Builder()
            .url(buildUrl(path))
            .patch(requestBody)
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(request);
    }

    /**
     * Execute a synchronous DELETE request.
     *
     * @param path API path
     * @return Response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode delete(String path) throws ApiException, IOException {
        Request request = new Request.Builder()
            .url(buildUrl(path))
            .delete()
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Content-Type", "application/json")
            .build();

        return executeRequest(request);
    }

    /**
     * Execute a request asynchronously.
     *
     * @param path API path
     * @param method HTTP method
     * @param body Request body (can be null for GET/DELETE)
     * @return CompletableFuture with response as JsonNode
     */
    protected CompletableFuture<JsonNode> executeAsync(String path, String method, Object body) {
        CompletableFuture<JsonNode> future = new CompletableFuture<>();

        try {
            Request.Builder requestBuilder = new Request.Builder()
                .url(buildUrl(path))
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json");

            switch (method.toUpperCase()) {
                case "GET":
                    requestBuilder.get();
                    break;
                case "POST":
                    RequestBody postBody = body != null
                        ? RequestBody.create(objectMapper.writeValueAsString(body), MediaType.get("application/json"))
                        : RequestBody.create("", MediaType.get("application/json"));
                    requestBuilder.post(postBody);
                    break;
                case "PUT":
                    RequestBody putBody = RequestBody.create(
                        objectMapper.writeValueAsString(body),
                        MediaType.get("application/json")
                    );
                    requestBuilder.put(putBody);
                    break;
                case "DELETE":
                    requestBuilder.delete();
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported HTTP method: " + method);
            }

            httpClient.newCall(requestBuilder.build()).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    future.completeExceptionally(e);
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    try (ResponseBody responseBody = response.body()) {
                        String bodyString = responseBody != null ? responseBody.string() : "";

                        if (response.isSuccessful()) {
                            future.complete(objectMapper.readTree(bodyString));
                        } else {
                            try {
                                JsonNode errorJson = objectMapper.readTree(bodyString);
                                String message = errorJson.has("message")
                                    ? errorJson.get("message").asText()
                                    : "Unknown API error";
                                future.completeExceptionally(new ApiException(response.code(), message));
                            } catch (Exception e) {
                                future.completeExceptionally(new ApiException(response.code(), bodyString));
                            }
                        }
                    }
                }
            });
        } catch (Exception e) {
            future.completeExceptionally(e);
        }

        return future;
    }

    /**
     * Execute an HTTP request and parse the response.
     *
     * @param request The HTTP request to execute
     * @return The parsed response as JsonNode
     * @throws ApiException if the API returns an error
     * @throws IOException if there's a network or I/O error
     */
    protected JsonNode executeRequest(Request request) throws ApiException, IOException {
        logger.debug("Executing {} request to {}", request.method(), request.url());

        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";

            if (response.isSuccessful()) {
                return objectMapper.readTree(responseBody);
            } else {
                // Try to parse error response
                try {
                    JsonNode errorJson = objectMapper.readTree(responseBody);
                    String message = errorJson.has("message")
                        ? errorJson.get("message").asText()
                        : "Unknown API error";
                    throw new ApiException(response.code(), message);
                } catch (Exception e) {
                    throw new ApiException(response.code(), responseBody);
                }
            }
        }
    }

    /**
     * Parse JsonNode data field to a specific type.
     *
     * @param node JSON node containing the response
     * @param clazz Target class type
     * @param <T> Target type
     * @return Parsed object
     * @throws IOException if parsing fails
     */
    protected <T> T parseData(JsonNode node, Class<T> clazz) throws IOException {
        JsonNode dataNode = node.has("data") ? node.get("data") : node;
        return objectMapper.treeToValue(dataNode, clazz);
    }

    /**
     * Parse JsonNode data field to a specific type using TypeReference.
     *
     * @param node JSON node containing the response
     * @param typeRef Type reference for complex types (e.g., List, Map)
     * @param <T> Target type
     * @return Parsed object
     * @throws IOException if parsing fails
     */
    protected <T> T parseData(JsonNode node, TypeReference<T> typeRef) throws IOException {
        JsonNode dataNode = node.has("data") ? node.get("data") : node;
        return objectMapper.convertValue(dataNode, typeRef);
    }
}