package io.schlepengine.examples;

import io.schlepengine.SchlepClient;
import io.schlepengine.api.*;
import io.schlepengine.exceptions.ApiException;
import io.schlepengine.exceptions.ConfigurationException;
import io.schlepengine.types.*;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Comprehensive example demonstrating all Schlep-engine SDK API clients.
 *
 * This example shows how to use:
 * - Data Processing API
 * - ML Pipeline API
 * - Analytics API
 * - Document Extraction API
 * - Data Quality API
 * - Storage API
 * - Monitoring API
 * - Users API
 * - Admin API
 */
public class ComprehensiveExample {

    public static void main(String[] args) {
        try {
            // Initialize the client
            SchlepClient client = new SchlepClient("your-api-key-here");

            System.out.println("=== Schlep-engine Java SDK - Comprehensive Example ===\n");

            // 1. Data Processing API
            demonstrateDataProcessing(client);

            // 2. ML Pipeline API
            demonstrateMLPipeline(client);

            // 3. Analytics API
            demonstrateAnalytics(client);

            // 4. Document Extraction API
            demonstrateDocumentExtraction(client);

            // 5. Data Quality API
            demonstrateDataQuality(client);

            // 6. Storage API
            demonstrateStorage(client);

            // 7. Monitoring API
            demonstrateMonitoring(client);

            // 8. Users API
            demonstrateUsers(client);

            // 9. Admin API (requires admin privileges)
            demonstrateAdmin(client);

            // Clean up
            client.close();
            System.out.println("\n=== All examples completed successfully ===");

        } catch (ConfigurationException e) {
            System.err.println("Configuration error: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void demonstrateDataProcessing(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Data Processing API ---");

        DataProcessingClient dataClient = client.data();

        // Process a file
        File dataFile = new File("sample-data.csv");
        if (dataFile.exists()) {
            DataProcessingResult result = dataClient.processFile(
                dataFile,
                DataFormat.CSV,
                DataFormat.JSON
            );
            System.out.println("Processing job started: " + result.getJobId());

            // Check job status
            JobInfo jobStatus = dataClient.getJobStatus(result.getJobId());
            System.out.println("Job status: " + jobStatus.getStatus());
        }

        // List processing jobs
        List<JobInfo> jobs = dataClient.listJobs(1, 10);
        System.out.println("Total jobs found: " + jobs.size());

        System.out.println();
    }

    private static void demonstrateMLPipeline(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- ML Pipeline API ---");

        MLPipelineClient mlClient = client.ml();

        // Create a pipeline
        Map<String, Object> pipelineConfig = new HashMap<>();
        pipelineConfig.put("name", "Customer Classification Pipeline");
        pipelineConfig.put("task_type", MLTaskType.CLASSIFICATION.getValue());
        pipelineConfig.put("model_type", "random_forest");
        pipelineConfig.put("target_column", "customer_type");

        Map<String, Object> pipeline = mlClient.createPipeline(pipelineConfig);
        System.out.println("Pipeline created: " + pipeline.get("pipeline_id"));

        // List pipelines
        List<Map<String, Object>> pipelines = mlClient.listPipelines(1, 10);
        System.out.println("Total pipelines: " + pipelines.size());

        // Train a pipeline (if you have a pipeline ID)
        // String pipelineId = (String) pipeline.get("pipeline_id");
        // TrainingJob job = mlClient.trainPipeline(pipelineId, null, null);
        // System.out.println("Training job started: " + job.getJobId());

        // List models
        List<ModelInfo> models = mlClient.listModels(1, 10);
        System.out.println("Total models: " + models.size());

        System.out.println();
    }

    private static void demonstrateAnalytics(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Analytics API ---");

        AnalyticsClient analyticsClient = client.analytics();

        // Get available datasets
        List<Map<String, Object>> datasets = analyticsClient.getDatasets();
        System.out.println("Available datasets: " + datasets.size());

        // Run analytics query
        Map<String, Object> query = new HashMap<>();
        query.put("dataset", "sales_data");
        query.put("metrics", Arrays.asList("sum", "average", "count"));
        query.put("dimensions", Arrays.asList("region", "product_category"));
        query.put("filters", new HashMap<String, Object>() {{
            put("date_range", "last_30_days");
        }});

        // Map<String, Object> results = analyticsClient.query(query);
        // System.out.println("Query results: " + results);

        System.out.println();
    }

    private static void demonstrateDocumentExtraction(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Document Extraction API ---");

        DocumentClient docClient = client.document();

        // Extract text from PDF
        File pdfFile = new File("sample-document.pdf");
        if (pdfFile.exists()) {
            Map<String, Object> textResult = docClient.extractText(pdfFile, true, false);
            System.out.println("Text extraction completed");

            // Extract tables
            Map<String, Object> tablesResult = docClient.extractTables(pdfFile);
            System.out.println("Table extraction completed");
        } else {
            System.out.println("Sample document not found, skipping extraction");
        }

        System.out.println();
    }

    private static void demonstrateDataQuality(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Data Quality API ---");

        QualityClient qualityClient = client.quality();

        // Assess data quality
        List<String> checks = Arrays.asList("completeness", "validity", "uniqueness");
        // Map<String, Object> qualityReport = qualityClient.assessQuality(
        //     "s3://my-bucket/data.csv",
        //     checks
        // );
        // System.out.println("Quality report: " + qualityReport.get("report_id"));

        System.out.println();
    }

    private static void demonstrateStorage(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Storage API ---");

        StorageClient storageClient = client.storage();

        // Upload a file
        File file = new File("data.csv");
        if (file.exists()) {
            FileUpload upload = storageClient.uploadFile(file, "datasets");
            System.out.println("File uploaded: " + upload.getFileId());
        }

        // List files
        List<FileUpload> files = storageClient.listFiles(1, 20);
        System.out.println("Total files in storage: " + files.size());

        System.out.println();
    }

    private static void demonstrateMonitoring(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Monitoring API ---");

        MonitoringClient monitoringClient = client.monitoring();

        // Get system health
        Map<String, Object> health = monitoringClient.getSystemHealth();
        System.out.println("System status: " + health.get("status"));

        // Get metrics
        List<String> metricNames = Arrays.asList("cpu_usage", "memory_usage", "request_rate");
        Map<String, Object> metrics = monitoringClient.getMetrics(metricNames, null);
        System.out.println("Metrics retrieved: " + metrics.keySet().size());

        System.out.println();
    }

    private static void demonstrateUsers(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Users API ---");

        UsersClient usersClient = client.users();

        // Get user profile
        Map<String, Object> profile = usersClient.getProfile();
        System.out.println("User ID: " + profile.get("user_id"));
        System.out.println("User email: " + profile.get("email"));

        // Update profile
        Map<String, Object> updates = new HashMap<>();
        updates.put("name", "Updated Name");
        // Map<String, Object> updatedProfile = usersClient.updateProfile(updates);

        System.out.println();
    }

    private static void demonstrateAdmin(SchlepClient client)
            throws ApiException, IOException {
        System.out.println("--- Admin API (requires admin privileges) ---");

        AdminClient adminClient = client.admin();

        try {
            // Get system statistics
            Map<String, Object> stats = adminClient.getSystemStats();
            System.out.println("Total users: " + stats.get("total_users"));
            System.out.println("Total jobs: " + stats.get("total_jobs"));

            // List users
            List<Map<String, Object>> users = adminClient.listUsers(1, 10);
            System.out.println("User count: " + users.size());
        } catch (ApiException e) {
            if (e.getStatusCode() == 403) {
                System.out.println("Admin access required (403 Forbidden)");
            } else {
                throw e;
            }
        }

        System.out.println();
    }
}