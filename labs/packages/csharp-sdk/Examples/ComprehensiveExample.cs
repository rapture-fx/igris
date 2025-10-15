using SchlepEngine;
using SchlepEngine.Types;

namespace SchlepEngine.Examples;

/// <summary>
/// Comprehensive example demonstrating all Schlep-engine SDK API modules.
/// </summary>
/// <remarks>
/// This example showcases the complete API surface of the C# SDK including:
/// - Data Processing
/// - ML Pipeline
/// - Analytics
/// - Document Extraction
/// - Data Quality
/// - Storage
/// - Monitoring
/// - Users
/// - Admin
/// </remarks>
public class ComprehensiveExample
{
    public static async Task Main(string[] args)
    {
        // Initialize the client with your API key
        var client = new SchlepClient("your-api-key");

        try
        {
            // =============================================================
            // 1. DATA PROCESSING API
            // =============================================================
            Console.WriteLine("=== Data Processing API ===");

            // Process a file
            var fileData = await File.ReadAllBytesAsync("data.csv");
            var processingJob = await client.Data.ProcessFileAsync(fileData, "csv");
            Console.WriteLine($"Processing job created: {processingJob.JobId}");

            // Check job status
            var jobStatus = await client.Data.GetJobAsync(processingJob.JobId);
            Console.WriteLine($"Job status: {jobStatus.Status}");

            // List all processing jobs
            var jobs = await client.Data.ListJobsAsync(new ListParams
            {
                Page = 1,
                PageSize = 10,
                Status = "completed"
            });
            Console.WriteLine($"Found {jobs.Count} jobs");

            // Transform data
            var transformations = new
            {
                operations = new[]
                {
                    new { type = "filter", column = "age", condition = "> 18" },
                    new { type = "rename", from = "old_name", to = "new_name" }
                }
            };
            var transformResult = await client.Data.TransformDataAsync(processingJob.JobId, transformations);
            Console.WriteLine($"Transformation status: {transformResult.Status}");

            // Validate schema
            var schema = new
            {
                fields = new[]
                {
                    new { name = "id", type = "integer", required = true },
                    new { name = "name", type = "string", required = true }
                }
            };
            var validationResult = await client.Data.ValidateSchemaAsync(processingJob.JobId, schema);
            Console.WriteLine($"Validation result: {(validationResult.Valid ? "Valid" : "Invalid")}");

            // =============================================================
            // 2. ML PIPELINE API
            // =============================================================
            Console.WriteLine("\n=== ML Pipeline API ===");

            // Create a pipeline
            var pipelineConfig = new
            {
                name = "Customer Churn Prediction",
                model_type = "classification",
                task_type = "supervised",
                target_column = "churned",
                features = new[] { "age", "tenure", "monthly_charges" }
            };
            var pipeline = await client.ML.CreatePipelineAsync(pipelineConfig);
            Console.WriteLine($"Pipeline created: {pipeline.PipelineId}");

            // Train the pipeline
            var trainingConfig = new
            {
                test_size = 0.2,
                random_state = 42,
                hyperparameters = new
                {
                    max_depth = 10,
                    n_estimators = 100
                }
            };
            var trainingJob = await client.ML.TrainPipelineAsync(pipeline.PipelineId, trainingConfig);
            Console.WriteLine($"Training job started: {trainingJob.JobId}");

            // Check training status
            var trainingStatus = await client.ML.GetTrainingJobAsync(trainingJob.JobId);
            Console.WriteLine($"Training status: {trainingStatus.Status}");
            if (trainingStatus.Metrics != null)
            {
                Console.WriteLine($"Metrics: {string.Join(", ", trainingStatus.Metrics.Select(m => $"{m.Key}={m.Value}"))}");
            }

            // List all pipelines
            var pipelines = await client.ML.ListPipelinesAsync(new ListParams { Page = 1, PageSize = 10 });
            Console.WriteLine($"Found {pipelines.Count} pipelines");

            // Deploy model (if training completed)
            if (trainingStatus.ModelId != null)
            {
                var deployment = await client.ML.DeployModelAsync(trainingStatus.ModelId);
                Console.WriteLine($"Model deployed at: {deployment.EndpointUrl}");

                // Make predictions
                var predictionData = new
                {
                    age = 35,
                    tenure = 24,
                    monthly_charges = 79.99
                };
                var prediction = await client.ML.PredictAsync(deployment.EndpointUrl, predictionData);
                Console.WriteLine($"Predictions: {prediction.Predictions.Count}");

                // Get model information
                var modelInfo = await client.ML.GetModelAsync(trainingStatus.ModelId);
                Console.WriteLine($"Model: {modelInfo.Name} v{modelInfo.Version}");

                // List all models
                var models = await client.ML.ListModelsAsync(new ListParams { Page = 1, PageSize = 10 });
                Console.WriteLine($"Found {models.Count} models");
            }

            // =============================================================
            // 3. ANALYTICS API
            // =============================================================
            Console.WriteLine("\n=== Analytics API ===");

            // Execute analytics query
            var analyticsQuery = new
            {
                dataset = "sales",
                metrics = new[] { "revenue", "count" },
                dimensions = new[] { "region", "product" },
                filters = new[]
                {
                    new { field = "date", operator = ">=", value = "2024-01-01" }
                },
                aggregations = new[]
                {
                    new { field = "revenue", function = "sum" }
                }
            };
            var queryResult = await client.Analytics.QueryAsync(analyticsQuery);
            Console.WriteLine($"Query returned {queryResult.RowCount} rows in {queryResult.ExecutionTimeMs}ms");

            // Generate a report
            var reportConfig = new
            {
                name = "Monthly Sales Report",
                dataset = "sales",
                template = "monthly_summary",
                format = "pdf"
            };
            var report = await client.Analytics.GenerateReportAsync(reportConfig);
            Console.WriteLine($"Report generated: {report.ReportId}");

            // Get available datasets
            var datasets = await client.Analytics.GetDatasetsAsync();
            Console.WriteLine($"Available datasets: {datasets.Count}");

            // Get dataset schema
            if (datasets.Count > 0)
            {
                var schemaInfo = await client.Analytics.GetSchemaAsync(datasets[0].Name);
                Console.WriteLine($"Schema for {schemaInfo.Dataset}: {schemaInfo.Fields.Count} fields");
            }

            // =============================================================
            // 4. DOCUMENT EXTRACTION API
            // =============================================================
            Console.WriteLine("\n=== Document Extraction API ===");

            // Extract text from document
            var documentData = await File.ReadAllBytesAsync("document.pdf");
            var extraction = await client.Document.ExtractTextAsync(
                documentData,
                "document.pdf",
                extractTables: true,
                extractImages: false
            );
            Console.WriteLine($"Extracted text: {extraction.Text.Length} characters");
            Console.WriteLine($"Pages processed: {extraction.PageCount}");

            // Extract tables
            var tableExtraction = await client.Document.ExtractTablesAsync(documentData, "document.pdf");
            Console.WriteLine($"Extracted {tableExtraction.TableCount} tables");

            // Extract images
            var imageExtraction = await client.Document.ExtractImagesAsync(documentData, "document.pdf");
            Console.WriteLine($"Extracted {imageExtraction.ImageCount} images");

            // Perform OCR
            var imageData = await File.ReadAllBytesAsync("scanned.jpg");
            var ocrResult = await client.Document.PerformOCRAsync(imageData, "scanned.jpg", "en");
            Console.WriteLine($"OCR text: {ocrResult.Text.Length} characters");
            Console.WriteLine($"Confidence: {ocrResult.Confidence:P2}");

            // =============================================================
            // 5. DATA QUALITY API
            // =============================================================
            Console.WriteLine("\n=== Data Quality API ===");

            // Assess data quality
            var qualityAssessment = await client.Quality.AssessQualityAsync(
                "dataset-path",
                new[] { "completeness", "accuracy", "consistency" }
            );
            Console.WriteLine($"Quality score: {qualityAssessment.OverallScore}/100");
            Console.WriteLine($"Issues found: {qualityAssessment.Issues.Count}");

            // Create quality rule
            var qualityRule = new
            {
                name = "Email Validation",
                type = "pattern",
                config = new
                {
                    field = "email",
                    pattern = @"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                }
            };
            var rule = await client.Quality.CreateRuleAsync(qualityRule);
            Console.WriteLine($"Quality rule created: {rule.RuleId}");

            // List quality rules
            var rules = await client.Quality.ListRulesAsync(new ListParams { Page = 1, PageSize = 10 });
            Console.WriteLine($"Found {rules.Count} quality rules");

            // Validate data against rules
            var validationResult2 = await client.Quality.ValidateAsync(
                "dataset-path",
                new[] { rule.RuleId }
            );
            Console.WriteLine($"Validation: {(validationResult2.Passed ? "Passed" : "Failed")}");
            Console.WriteLine($"Rules evaluated: {validationResult2.RulesEvaluated}");

            // =============================================================
            // 6. STORAGE API
            // =============================================================
            Console.WriteLine("\n=== Storage API ===");

            // Upload file
            var uploadData = await File.ReadAllBytesAsync("data.csv");
            var uploadResult = await client.Storage.UploadFileAsync(
                uploadData,
                "data.csv",
                folder: "datasets"
            );
            Console.WriteLine($"File uploaded: {uploadResult.FileId}");
            Console.WriteLine($"URL: {uploadResult.Url}");

            // List files
            var files = await client.Storage.ListFilesAsync(
                folder: "datasets",
                parameters: new ListParams { Page = 1, PageSize = 10 }
            );
            Console.WriteLine($"Found {files.Count} files");

            // Get file metadata
            var fileMetadata = await client.Storage.GetFileAsync(uploadResult.FileId);
            Console.WriteLine($"File: {fileMetadata.Filename} ({fileMetadata.Size} bytes)");

            // Download file
            var downloadedData = await client.Storage.DownloadFileAsync(uploadResult.FileId);
            Console.WriteLine($"Downloaded {downloadedData.Length} bytes");

            // =============================================================
            // 7. MONITORING API
            // =============================================================
            Console.WriteLine("\n=== Monitoring API ===");

            // Check system health
            var health = await client.Monitoring.GetSystemHealthAsync();
            Console.WriteLine($"System status: {health.Status}");
            if (health.Components != null)
            {
                foreach (var component in health.Components)
                {
                    Console.WriteLine($"  {component.Key}: {component.Value.Status}");
                }
            }

            // Get metrics
            var metrics = await client.Monitoring.GetMetricsAsync(
                metricNames: new[] { "cpu_usage", "memory_usage", "request_rate" },
                timeRange: new TimeRange
                {
                    Start = DateTime.UtcNow.AddHours(-1).ToString("o"),
                    End = DateTime.UtcNow.ToString("o")
                }
            );
            Console.WriteLine($"Retrieved {metrics.Metrics.Count} metrics");

            // Create alert
            var alertConfig = new
            {
                name = "High CPU Usage",
                severity = "high",
                condition = new
                {
                    metric = "cpu_usage",
                    threshold = 80,
                    operator = ">"
                }
            };
            var alert = await client.Monitoring.CreateAlertAsync(alertConfig);
            Console.WriteLine($"Alert created: {alert.AlertId}");

            // Get alerts
            var alerts = await client.Monitoring.GetAlertsAsync(new ListParams { Page = 1, PageSize = 10 });
            Console.WriteLine($"Found {alerts.Count} alerts");

            // =============================================================
            // 8. USERS API
            // =============================================================
            Console.WriteLine("\n=== Users API ===");

            // Get user profile
            var profile = await client.Users.GetProfileAsync();
            Console.WriteLine($"User: {profile.Email}");
            Console.WriteLine($"Role: {profile.Role}");
            Console.WriteLine($"Status: {profile.Status}");

            // Update profile
            var updates = new { name = "John Doe", organization = "Acme Corp" };
            var updatedProfile = await client.Users.UpdateProfileAsync(updates);
            Console.WriteLine($"Profile updated: {updatedProfile.Name}");

            // List API keys
            var apiKeys = await client.Users.ListApiKeysAsync();
            Console.WriteLine($"API keys: {apiKeys.Count}");

            // Create new API key
            var newKey = await client.Users.CreateApiKeyAsync(
                "Production Key",
                permissions: new[] { "read", "write" }
            );
            Console.WriteLine($"New API key created: {newKey.KeyId}");

            // =============================================================
            // 9. ADMIN API (requires admin privileges)
            // =============================================================
            Console.WriteLine("\n=== Admin API ===");

            // Get system statistics
            var stats = await client.Admin.GetSystemStatsAsync();
            Console.WriteLine($"Total users: {stats.TotalUsers}");
            Console.WriteLine($"Active users: {stats.ActiveUsers}");
            Console.WriteLine($"Total jobs: {stats.TotalJobs}");
            Console.WriteLine($"Storage used: {stats.StorageUsed / (1024 * 1024 * 1024)}GB");

            // List all users (admin only)
            var allUsers = await client.Admin.ListUsersAsync(new ListParams { Page = 1, PageSize = 20 });
            Console.WriteLine($"Total users in system: {allUsers.Count}");

            // Get specific user
            if (allUsers.Count > 0)
            {
                var user = await client.Admin.GetUserAsync(allUsers[0].UserId);
                Console.WriteLine($"User details: {user.Email} - {user.Status}");
            }

            Console.WriteLine("\n=== All API modules demonstrated successfully! ===");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
            }
        }
        finally
        {
            // Clean up
            client.Dispose();
        }
    }
}
