//! Basic usage example for the Schlep-engine Rust SDK.

use schlep_engine::{SchlepClient, Result};
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the client with API key from environment variable
    // Make sure to set SCHLEP_API_KEY before running this example
    let client = match SchlepClient::from_env() {
        Ok(client) => client,
        Err(_) => {
            println!("SCHLEP_API_KEY environment variable not set. Using placeholder.");
            println!("Set your API key: export SCHLEP_API_KEY=your-api-key-here");
            return Ok(());
        }
    };

    println!("🚀 Schlep-engine Rust SDK Example");
    println!("==================================");

    // Step 1: Upload data
    println!("\n1. Uploading data...");
    let sample_data = json!({
        "records": [
            {"name": "Alice", "age": 30, "city": "New York"},
            {"name": "Bob", "age": 25, "city": "San Francisco"},
            {"name": "Charlie", "age": 35, "city": "Chicago"}
        ]
    }).to_string();

    let upload_result = client.upload(sample_data).await?;
    println!("   ✓ Upload job ID: {}", upload_result.job_id);
    println!("   ✓ Status: {}", upload_result.status);

    // Step 2: Wait for upload to complete and check status
    println!("\n2. Checking upload status...");
    let mut status = client.status(&upload_result.job_id).await?;
    println!("   Status: {}", status.status);

    if let Some(progress) = status.progress {
        println!("   Progress: {}%", progress);
    }

    // In a real scenario, you might want to poll until completion
    // For this example, we'll assume it completes quickly
    if status.status != "completed" {
        println!("   Waiting for upload to complete...");
        sleep(Duration::from_secs(2)).await;
        status = client.status(&upload_result.job_id).await?;
        println!("   Updated status: {}", status.status);
    }

    // Step 3: Train a model
    println!("\n3. Training a model...");
    let train_config = json!({
        "model_type": "classification",
        "dataset_id": upload_result.job_id,
        "parameters": {
            "algorithm": "random_forest",
            "target_column": "city",
            "test_size": 0.2
        }
    });

    let train_result = client.train(train_config).await?;
    println!("   ✓ Training job ID: {}", train_result.job_id);
    println!("   ✓ Status: {}", train_result.status);

    if let Some(model_id) = &train_result.model_id {
        println!("   ✓ Model ID: {}", model_id);

        // Step 4: Deploy the model
        println!("\n4. Deploying model...");
        let deploy_result = client.deploy(model_id).await?;
        println!("   ✓ Deployment ID: {}", deploy_result.deployment_id);
        println!("   ✓ Endpoint URL: {}", deploy_result.endpoint_url);
        println!("   ✓ Status: {}", deploy_result.status);

        // Step 5: Check deployment status
        println!("\n5. Checking deployment status...");
        let deploy_status = client.status(&deploy_result.deployment_id).await?;
        println!("   Status: {}", deploy_status.status);

        if deploy_status.status == "deployed" {
            println!("   🎉 Model successfully deployed!");
            println!("   You can now make predictions at: {}", deploy_result.endpoint_url);
        }
    }

    println!("\n✅ Example completed successfully!");
    Ok(())
}

// Additional example showing error handling
#[allow(dead_code)]
async fn example_with_error_handling() -> Result<()> {
    let client = SchlepClient::new("your-api-key")?;

    match client.upload("test data").await {
        Ok(result) => {
            println!("Upload successful: {}", result.job_id);
        }
        Err(e) => {
            eprintln!("Upload failed: {}", e);
            match e {
                schlep_engine::Error::Api { code, message } => {
                    eprintln!("API error {}: {}", code, message);
                }
                schlep_engine::Error::Http(http_err) => {
                    eprintln!("Network error: {}", http_err);
                }
                schlep_engine::Error::Config(config_err) => {
                    eprintln!("Configuration error: {}", config_err);
                }
                _ => {
                    eprintln!("Other error: {}", e);
                }
            }
        }
    }

    Ok(())
}