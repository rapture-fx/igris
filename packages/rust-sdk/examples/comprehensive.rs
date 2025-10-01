//! Comprehensive example demonstrating all API modules in the Schlep-engine Rust SDK.
//!
//! This example showcases the full API coverage including:
//! - Data Processing
//! - ML Pipelines
//! - Analytics
//! - Document Extraction
//! - Data Quality
//! - Storage
//! - Monitoring
//! - Users
//! - Admin (requires admin privileges)

use schlep_engine::{SchlepClient, Result, ListParams};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the client
    let client = SchlepClient::new("your-api-key")?;

    println!("=== Schlep-engine Rust SDK - Comprehensive Example ===\n");

    // 1. DATA PROCESSING API
    println!("1. Data Processing API");

    // Process a file
    let sample_data = b"id,name,age\n1,Alice,30\n2,Bob,25";
    let processing_job = client.data().process_file(sample_data, "csv").await?;
    println!("   Processing job created: {}", processing_job.job_id);

    // Apply transformations
    let transformations = json!({
        "operations": [
            {"type": "filter", "column": "age", "operator": ">", "value": 18}
        ]
    });
    let transform_result = client.data()
        .transform_data(&processing_job.job_id, transformations).await?;
    println!("   Transformations applied: {}", transform_result.status);

    // Validate schema
    let schema = json!({
        "fields": [
            {"name": "id", "type": "integer"},
            {"name": "name", "type": "string"},
            {"name": "age", "type": "integer"}
        ]
    });
    let validation = client.data()
        .validate_schema(&processing_job.job_id, schema).await?;
    println!("   Schema validation: {}\n", if validation.valid { "PASSED" } else { "FAILED" });

    // 2. ML PIPELINE API
    println!("2. ML Pipeline API");

    // Create a pipeline
    let pipeline_config = json!({
        "name": "Customer Churn Prediction",
        "task_type": "classification",
        "model_type": "random_forest",
        "target_column": "churned"
    });
    let pipeline = client.ml().create_pipeline(pipeline_config).await?;
    println!("   Pipeline created: {} ({})", pipeline.name, pipeline.pipeline_id);

    // Train the pipeline
    let training_config = json!({
        "epochs": 10,
        "batch_size": 32,
        "validation_split": 0.2
    });
    let training_job = client.ml()
        .train_pipeline(&pipeline.pipeline_id, training_config).await?;
    println!("   Training job started: {}", training_job.job_id);

    // Get training status
    let training_status = client.ml().get_training_job(&training_job.job_id).await?;
    println!("   Training status: {}\n", training_status.status);

    // 3. ANALYTICS API
    println!("3. Analytics API");

    // Execute a query
    let query = json!({
        "sql": "SELECT category, COUNT(*) as count FROM products GROUP BY category",
        "dataset_id": "dataset_123"
    });
    let query_result = client.analytics().execute_query(query).await?;
    println!("   Query executed: {} rows returned", query_result.row_count);

    // Create a report
    let report_config = json!({
        "name": "Monthly Sales Report",
        "type": "aggregation",
        "metrics": ["total_sales", "average_order_value"]
    });
    let report = client.analytics().create_report(report_config).await?;
    println!("   Report created: {} ({})\n", report.name, report.report_id);

    // 4. DOCUMENT EXTRACTION API
    println!("4. Document Extraction API");

    // Extract text from a document (simulated PDF data)
    let pdf_data = b"Sample PDF content";
    let extraction = client.document().extract_text(pdf_data, "pdf").await?;
    println!("   Text extracted: {} characters", extraction.text.len());

    // Perform OCR
    let image_data = b"Sample image data";
    let ocr_result = client.document().ocr(image_data, Some("en")).await?;
    println!("   OCR completed: {} characters recognized\n", ocr_result.text.len());

    // 5. DATA QUALITY API
    println!("5. Data Quality API");

    // Assess data quality
    let quality_assessment = client.quality()
        .assess_quality(&processing_job.job_id).await?;
    println!("   Quality score: {}/100", quality_assessment.quality_score);

    // Create a quality rule
    let quality_rule = json!({
        "name": "Email Validation",
        "type": "format",
        "column": "email",
        "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    });
    let rule = client.quality().create_rule(quality_rule).await?;
    println!("   Quality rule created: {} ({})\n", rule.name, rule.rule_id);

    // 6. STORAGE API
    println!("6. Storage API");

    // Upload a file
    let file_data = b"Sample file content for storage";
    let upload = client.storage().upload_file(file_data, "sample.txt").await?;
    println!("   File uploaded: {} ({} bytes)", upload.file_id, upload.size);

    // List files
    let files = client.storage().list_files(None).await?;
    println!("   Total files in storage: {}", files.len());

    // Download a file
    let downloaded = client.storage().download_file(&upload.file_id).await?;
    println!("   File downloaded: {} bytes\n", downloaded.len());

    // 7. MONITORING API
    println!("7. Monitoring API");

    // Get system health
    let health = client.monitoring().get_health().await?;
    println!("   System status: {}", health.status);

    // Get metrics
    let metrics_params = json!({
        "from": "2024-01-01T00:00:00Z",
        "to": "2024-01-31T23:59:59Z",
        "metrics": ["cpu", "memory", "requests"]
    });
    let metrics = client.monitoring().get_metrics(metrics_params).await?;
    println!("   Metrics retrieved: {}", metrics.timestamp);

    // List alerts
    let alerts = client.monitoring().list_alerts().await?;
    println!("   Active alerts: {}\n", alerts.len());

    // 8. USERS API
    println!("8. Users API");

    // Get user profile
    let profile = client.users().get_profile().await?;
    println!("   User: {} ({})", profile.email, profile.user_id);

    // List API keys
    let api_keys = client.users().list_api_keys().await?;
    println!("   API keys: {}", api_keys.len());

    // Create a new API key
    let new_key = client.users().create_api_key("Development Key").await?;
    println!("   New API key created: {} ({})\n", new_key.name, new_key.key_id);

    // 9. ADMIN API (requires admin privileges)
    println!("9. Admin API (requires admin privileges)");

    // Get system statistics
    let stats = client.admin().get_system_stats().await?;
    println!("   Total users: {}", stats.total_users);
    println!("   Total jobs: {}", stats.total_jobs);
    println!("   Active jobs: {}", stats.active_jobs);

    // List users
    let params = ListParams {
        page: Some(1),
        page_size: Some(10),
        status: Some("active".to_string()),
    };
    let users = client.admin().list_users(Some(params)).await?;
    println!("   Active users: {}\n", users.len());

    println!("=== All API modules tested successfully! ===");

    Ok(())
}
