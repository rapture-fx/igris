package io.schlepengine.examples;

import io.schlepengine.SchlepClient;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.exceptions.ConfigurationException;
import io.schlepengine.types.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Arrays;

/**
 * Basic usage example for the Schlep-engine Java SDK.
 *
 * <p>This example demonstrates the complete workflow from uploading data
 * to training a model and deploying it to production.</p>
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class BasicUsageExample {
    private static final Logger logger = LoggerFactory.getLogger(BasicUsageExample.class);

    public static void main(String[] args) {
        try {
            runExample();
        } catch (Exception e) {
            logger.error("Example failed: {}", e.getMessage(), e);
            System.exit(1);
        }
    }

    /**
     * Run the complete example workflow.
     */
    public static void runExample() throws ConfigurationException, ApiException, IOException, InterruptedException {
        logger.info("🚀 Schlep-engine Java SDK Example");
        logger.info("==================================");

        // Initialize the client with API key from environment variable
        // Make sure to set SCHLEP_API_KEY before running this example
        SchlepClient client;
        try {
            client = SchlepClient.fromEnv();
        } catch (ConfigurationException e) {
            logger.warn("SCHLEP_API_KEY environment variable not set. Using placeholder.");
            logger.info("Set your API key: export SCHLEP_API_KEY=your-api-key-here");
            return;
        }

        try {
            // Step 1: Upload data
            logger.info("\n1. Uploading data...");
            String sampleData = """
                {
                    "records": [
                        {"name": "Alice", "age": 30, "city": "New York"},
                        {"name": "Bob", "age": 25, "city": "San Francisco"},
                        {"name": "Charlie", "age": 35, "city": "Chicago"}
                    ]
                }
                """;

            UploadResponse uploadResult = client.upload(sampleData);
            logger.info("   ✓ Upload job ID: {}", uploadResult.getJobId());
            logger.info("   ✓ Status: {}", uploadResult.getStatus());

            // Step 2: Wait for upload to complete and check status
            logger.info("\n2. Checking upload status...");
            StatusResponse status = client.status(uploadResult.getJobId());
            logger.info("   Status: {}", status.getStatus());

            if (status.getProgress() != null) {
                logger.info("   Progress: {}%", status.getProgress());
            }

            // In a real scenario, you might want to poll until completion
            // For this example, we'll assume it completes quickly
            if (!"completed".equals(status.getStatus())) {
                logger.info("   Waiting for upload to complete...");
                Thread.sleep(2000);
                status = client.status(uploadResult.getJobId());
                logger.info("   Updated status: {}", status.getStatus());
            }

            // Step 3: Train a model
            logger.info("\n3. Training a model...");
            TrainConfig trainConfig = new TrainConfig()
                .setModelType("classification")
                .setDatasetId(uploadResult.getJobId())
                .addParameter("algorithm", "random_forest")
                .addParameter("target_column", "city")
                .addParameter("test_size", 0.2);

            TrainResponse trainResult = client.train(trainConfig);
            logger.info("   ✓ Training job ID: {}", trainResult.getJobId());
            logger.info("   ✓ Status: {}", trainResult.getStatus());

            if (trainResult.getModelId() != null) {
                logger.info("   ✓ Model ID: {}", trainResult.getModelId());

                // Step 4: Deploy the model
                logger.info("\n4. Deploying model...");
                DeployResponse deployResult = client.deploy(trainResult.getModelId());
                logger.info("   ✓ Deployment ID: {}", deployResult.getDeploymentId());
                logger.info("   ✓ Endpoint URL: {}", deployResult.getEndpointUrl());
                logger.info("   ✓ Status: {}", deployResult.getStatus());

                // Step 5: Check deployment status
                logger.info("\n5. Checking deployment status...");
                StatusResponse deployStatus = client.status(deployResult.getDeploymentId());
                logger.info("   Status: {}", deployStatus.getStatus());

                if ("deployed".equals(deployStatus.getStatus())) {
                    logger.info("   🎉 Model successfully deployed!");
                    logger.info("   You can now make predictions at: {}", deployResult.getEndpointUrl());
                }
            }

            // Step 6: Set up streaming (optional)
            logger.info("\n6. Setting up event streaming...");
            StreamConfig streamConfig = new StreamConfig()
                .setEventTypes(Arrays.asList("training", "deployment"))
                .addFilter("user_id", "example_user");

            client.stream(streamConfig);
            logger.info("   ✓ Streaming configuration set up");

            logger.info("\n✅ Example completed successfully!");

        } finally {
            // Always close the client to release resources
            client.close();
        }
    }

    /**
     * Example showing error handling patterns.
     */
    public static void exampleWithErrorHandling() {
        try {
            SchlepClient client = new SchlepClient("your-api-key");

            try {
                UploadResponse result = client.upload("test data");
                logger.info("Upload successful: {}", result.getJobId());
            } catch (ApiException e) {
                logger.error("API error {}: {}", e.getStatusCode(), e.getMessage());

                // Handle specific error codes
                switch (e.getStatusCode()) {
                    case 401:
                        logger.error("Authentication failed - check your API key");
                        break;
                    case 429:
                        logger.error("Rate limit exceeded - please retry later");
                        break;
                    case 500:
                        logger.error("Server error - please contact support");
                        break;
                    default:
                        logger.error("Unexpected error occurred");
                }
            } catch (IOException e) {
                logger.error("Network error: {}", e.getMessage());
            } finally {
                client.close();
            }

        } catch (ConfigurationException e) {
            logger.error("Configuration error: {}", e.getMessage());
        }
    }

    /**
     * Example showing different ways to configure training.
     */
    public static void advancedTrainingExample() throws Exception {
        SchlepClient client = SchlepClient.fromEnv();

        try {
            // Method 1: Using TrainConfig object
            TrainConfig config = new TrainConfig()
                .setModelType("regression")
                .setDatasetId("dataset_123")
                .addParameter("algorithm", "linear_regression")
                .addParameter("regularization", "l2")
                .addParameter("alpha", 0.01);

            TrainResponse response1 = client.train(config);
            logger.info("Training with config object: {}", response1.getJobId());

            // Method 2: Using JSON string
            String jsonConfig = """
                {
                    "model_type": "classification",
                    "dataset_id": "dataset_456",
                    "parameters": {
                        "algorithm": "gradient_boosting",
                        "n_estimators": 100,
                        "learning_rate": 0.1
                    }
                }
                """;

            TrainResponse response2 = client.train(jsonConfig);
            logger.info("Training with JSON config: {}", response2.getJobId());

        } finally {
            client.close();
        }
    }
}