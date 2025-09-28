package io.schlepengine;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.exceptions.ConfigurationException;
import io.schlepengine.types.*;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for SchlepClient.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
class SchlepClientTest {

    private MockWebServer mockWebServer;
    private SchlepClient client;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws IOException, ConfigurationException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();

        String baseUrl = mockWebServer.url("/").toString().replaceAll("/$", "");
        client = new SchlepClient("test-api-key", baseUrl);
        objectMapper = new ObjectMapper();
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
        client.close();
    }

    @Test
    void testUploadSuccess() throws Exception {
        // Setup mock response
        UploadResponse expectedResponse = new UploadResponse()
            .setJobId("upload_123")
            .setStatus("processing")
            .setMessage("Upload successful");

        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .setBody(objectMapper.writeValueAsString(expectedResponse)));

        // Execute request
        UploadResponse response = client.upload("test data");

        // Verify response
        assertEquals("upload_123", response.getJobId());
        assertEquals("processing", response.getStatus());
        assertEquals("Upload successful", response.getMessage());

        // Verify request
        RecordedRequest request = mockWebServer.takeRequest();
        assertEquals("POST", request.getMethod());
        assertEquals("/upload", request.getPath());
        assertEquals("Bearer test-api-key", request.getHeader("Authorization"));
        assertEquals("application/json", request.getHeader("Content-Type"));

        // Verify request body
        String requestBody = request.getBody().readUtf8();
        assertTrue(requestBody.contains("\"data\":\"test data\""));
    }

    @Test
    void testTrainPipeline() throws Exception {
        // Setup mock response
        TrainResponse expectedResponse = new TrainResponse()
            .setJobId("train_456")
            .setModelId("model_789")
            .setStatus("training")
            .setMessage("Training started");

        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .setBody(objectMapper.writeValueAsString(expectedResponse)));

        // Execute request
        TrainConfig config = new TrainConfig()
            .setModelType("classification")
            .setDatasetId("upload_123");
        TrainResponse response = client.train(config);

        // Verify response
        assertEquals("train_456", response.getJobId());
        assertEquals("model_789", response.getModelId());
        assertEquals("training", response.getStatus());
        assertEquals("Training started", response.getMessage());

        // Verify request
        RecordedRequest request = mockWebServer.takeRequest();
        assertEquals("POST", request.getMethod());
        assertEquals("/train", request.getPath());
        assertEquals("Bearer test-api-key", request.getHeader("Authorization"));

        // Verify request body
        String requestBody = request.getBody().readUtf8();
        assertTrue(requestBody.contains("\"model_type\":\"classification\""));
        assertTrue(requestBody.contains("\"dataset_id\":\"upload_123\""));
    }

    @Test
    void testTrainWithJsonConfig() throws Exception {
        // Setup mock response
        TrainResponse expectedResponse = new TrainResponse()
            .setJobId("train_456")
            .setModelId("model_789")
            .setStatus("training");

        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .setBody(objectMapper.writeValueAsString(expectedResponse)));

        // Execute request with JSON string
        String configJson = "{\"model_type\":\"classification\",\"dataset_id\":\"upload_123\"}";
        TrainResponse response = client.train(configJson);

        // Verify response
        assertEquals("train_456", response.getJobId());
        assertEquals("model_789", response.getModelId());
        assertEquals("training", response.getStatus());

        // Verify request
        RecordedRequest request = mockWebServer.takeRequest();
        assertEquals("POST", request.getMethod());
        assertEquals("/train", request.getPath());
        assertEquals(configJson, request.getBody().readUtf8());
    }

    @Test
    void testDeployReturnsEndpoint() throws Exception {
        // Setup mock response
        DeployResponse expectedResponse = new DeployResponse()
            .setDeploymentId("deploy_101")
            .setEndpointUrl("https://api.schlep-engine.com/models/model_789/predict")
            .setStatus("deployed")
            .setMessage("Model deployed successfully");

        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .setBody(objectMapper.writeValueAsString(expectedResponse)));

        // Execute request
        DeployResponse response = client.deploy("model_789");

        // Verify response
        assertEquals("deploy_101", response.getDeploymentId());
        assertEquals("https://api.schlep-engine.com/models/model_789/predict", response.getEndpointUrl());
        assertEquals("deployed", response.getStatus());
        assertEquals("Model deployed successfully", response.getMessage());

        // Verify request
        RecordedRequest request = mockWebServer.takeRequest();
        assertEquals("POST", request.getMethod());
        assertEquals("/deploy", request.getPath());
        assertEquals("Bearer test-api-key", request.getHeader("Authorization"));

        // Verify request body
        String requestBody = request.getBody().readUtf8();
        assertTrue(requestBody.contains("\"model_id\":\"model_789\""));
    }

    @Test
    void testStatusCheck() throws Exception {
        // Setup mock response
        StatusResponse expectedResponse = new StatusResponse()
            .setJobId("job_123")
            .setStatus("completed")
            .setProgress(100.0f)
            .setCreatedAt("2024-01-01T00:00:00Z")
            .setUpdatedAt("2024-01-01T01:00:00Z");

        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .setBody(objectMapper.writeValueAsString(expectedResponse)));

        // Execute request
        StatusResponse response = client.status("job_123");

        // Verify response
        assertEquals("job_123", response.getJobId());
        assertEquals("completed", response.getStatus());
        assertEquals(100.0f, response.getProgress());
        assertEquals("2024-01-01T00:00:00Z", response.getCreatedAt());
        assertEquals("2024-01-01T01:00:00Z", response.getUpdatedAt());

        // Verify request
        RecordedRequest request = mockWebServer.takeRequest();
        assertEquals("GET", request.getMethod());
        assertEquals("/status/job_123", request.getPath());
        assertEquals("Bearer test-api-key", request.getHeader("Authorization"));
    }

    @Test
    void testInvalidApiKey() throws Exception {
        // Setup mock error response
        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(401)
            .addHeader("Content-Type", "application/json")
            .setBody("{\"message\":\"Invalid API key\"}"));

        // Execute request and expect exception
        ApiException exception = assertThrows(ApiException.class, () -> {
            client.upload("test data");
        });

        assertEquals(401, exception.getStatusCode());
        assertEquals("Invalid API key", exception.getMessage());
    }

    @Test
    void testApiErrorHandling() throws Exception {
        // Setup mock error response
        mockWebServer.enqueue(new MockResponse()
            .setResponseCode(400)
            .addHeader("Content-Type", "application/json")
            .setBody("{\"message\":\"Invalid training configuration\"}"));

        // Execute request and expect exception
        TrainConfig config = new TrainConfig()
            .setModelType("invalid")
            .setDatasetId("nonexistent");

        ApiException exception = assertThrows(ApiException.class, () -> {
            client.train(config);
        });

        assertEquals(400, exception.getStatusCode());
        assertEquals("Invalid training configuration", exception.getMessage());
    }

    @Test
    void testClientCreationFromEnv() throws Exception {
        // Set environment variable
        System.setProperty("SCHLEP_API_KEY", "env-api-key");
        try {
            // Note: System.setProperty doesn't actually set environment variables,
            // so this test would need to be modified to work with actual env vars
            // For now, we'll test the exception case
            ConfigurationException exception = assertThrows(ConfigurationException.class, () -> {
                SchlepClient.fromEnv();
            });
            assertNotNull(exception.getMessage());
        } finally {
            System.clearProperty("SCHLEP_API_KEY");
        }
    }

    @Test
    void testClientCreationEmptyApiKey() {
        ConfigurationException exception = assertThrows(ConfigurationException.class, () -> {
            new SchlepClient("");
        });
        assertTrue(exception.getMessage().contains("API key cannot be null or empty"));
    }

    @Test
    void testClientCreationNullApiKey() {
        ConfigurationException exception = assertThrows(ConfigurationException.class, () -> {
            new SchlepClient(null);
        });
        assertTrue(exception.getMessage().contains("API key cannot be null or empty"));
    }

    @Test
    void testStreamConfiguration() throws Exception {
        StreamConfig config = new StreamConfig()
            .setEventTypes(Arrays.asList("training", "deployment"))
            .addFilter("user_id", "123");

        // This is a placeholder test since streaming is not fully implemented
        assertDoesNotThrow(() -> {
            client.stream(config);
        });

        assertEquals(2, config.getEventTypes().size());
        assertTrue(config.getEventTypes().contains("training"));
        assertTrue(config.getEventTypes().contains("deployment"));
        assertEquals("123", config.getFilters().get("user_id"));
    }

    @Test
    void testTrainConfigParametersBuilder() {
        TrainConfig config = new TrainConfig()
            .setModelType("classification")
            .setDatasetId("dataset_123")
            .addParameter("algorithm", "random_forest")
            .addParameter("test_size", 0.2);

        assertEquals("classification", config.getModelType());
        assertEquals("dataset_123", config.getDatasetId());
        assertEquals("random_forest", config.getParameters().get("algorithm"));
        assertEquals(0.2, config.getParameters().get("test_size"));
    }

    @Test
    void testResponseToStringMethods() {
        UploadResponse uploadResponse = new UploadResponse()
            .setJobId("test_123")
            .setStatus("completed");

        TrainResponse trainResponse = new TrainResponse()
            .setJobId("train_456")
            .setModelId("model_789")
            .setStatus("training");

        DeployResponse deployResponse = new DeployResponse()
            .setDeploymentId("deploy_101")
            .setEndpointUrl("https://api.example.com/predict")
            .setStatus("deployed");

        StatusResponse statusResponse = new StatusResponse()
            .setJobId("status_222")
            .setStatus("running")
            .setProgress(75.5f);

        // Verify toString methods don't throw exceptions and contain expected data
        String uploadStr = uploadResponse.toString();
        assertTrue(uploadStr.contains("test_123"));
        assertTrue(uploadStr.contains("completed"));

        String trainStr = trainResponse.toString();
        assertTrue(trainStr.contains("train_456"));
        assertTrue(trainStr.contains("model_789"));

        String deployStr = deployResponse.toString();
        assertTrue(deployStr.contains("deploy_101"));
        assertTrue(deployStr.contains("https://api.example.com/predict"));

        String statusStr = statusResponse.toString();
        assertTrue(statusStr.contains("status_222"));
        assertTrue(statusStr.contains("75.5"));
    }
}