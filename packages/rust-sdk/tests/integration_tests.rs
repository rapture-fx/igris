//! Integration tests for the Schlep-engine Rust SDK.

use mockito::{Matcher, Server};
use serde_json::json;
use schlep_engine::{SchlepClient, Error};

#[tokio::test]
async fn test_upload_success() {
    let mut server = Server::new_async().await;
    let client = SchlepClient::with_base_url("test-api-key", &server.url()).unwrap();

    let _mock = server
        .mock("POST", "/upload")
        .match_header("authorization", "Bearer test-api-key")
        .match_header("content-type", "application/json")
        .match_body(Matcher::Json(json!({
            "data": "test data"
        })))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(json!({
            "job_id": "upload_123",
            "status": "processing",
            "message": "Upload successful"
        }).to_string())
        .create_async()
        .await;

    let result = client.upload("test data").await.unwrap();

    assert_eq!(result.job_id, "upload_123");
    assert_eq!(result.status, "processing");
    assert_eq!(result.message, Some("Upload successful".to_string()));
}

#[tokio::test]
async fn test_train_pipeline() {
    let mut server = Server::new_async().await;
    let client = SchlepClient::with_base_url("test-api-key", &server.url()).unwrap();

    let _mock = server
        .mock("POST", "/train")
        .match_header("authorization", "Bearer test-api-key")
        .match_header("content-type", "application/json")
        .match_body(Matcher::Json(json!({
            "model_type": "classification",
            "dataset_id": "upload_123"
        })))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(json!({
            "job_id": "train_456",
            "model_id": "model_789",
            "status": "training",
            "message": "Training started"
        }).to_string())
        .create_async()
        .await;

    let config = json!({
        "model_type": "classification",
        "dataset_id": "upload_123"
    });
    let result = client.train(config).await.unwrap();

    assert_eq!(result.job_id, "train_456");
    assert_eq!(result.model_id, Some("model_789".to_string()));
    assert_eq!(result.status, "training");
}

#[tokio::test]
async fn test_deploy_returns_endpoint() {
    let mut server = Server::new_async().await;
    let client = SchlepClient::with_base_url("test-api-key", &server.url()).unwrap();

    let _mock = server
        .mock("POST", "/deploy")
        .match_header("authorization", "Bearer test-api-key")
        .match_header("content-type", "application/json")
        .match_body(Matcher::Json(json!({
            "model_id": "model_789"
        })))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(json!({
            "deployment_id": "deploy_101",
            "endpoint_url": "https://api.schlep-engine.com/models/model_789/predict",
            "status": "deployed",
            "message": "Model deployed successfully"
        }).to_string())
        .create_async()
        .await;

    let result = client.deploy("model_789").await.unwrap();

    assert_eq!(result.deployment_id, "deploy_101");
    assert_eq!(result.endpoint_url, "https://api.schlep-engine.com/models/model_789/predict");
    assert_eq!(result.status, "deployed");
}

#[tokio::test]
async fn test_status_check() {
    let mut server = Server::new_async().await;
    let client = SchlepClient::with_base_url("test-api-key", &server.url()).unwrap();

    let _mock = server
        .mock("GET", "/status/job_123")
        .match_header("authorization", "Bearer test-api-key")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(json!({
            "job_id": "job_123",
            "status": "completed",
            "progress": 100.0,
            "result": {
                "output": "Job completed successfully"
            },
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T01:00:00Z"
        }).to_string())
        .create_async()
        .await;

    let result = client.status("job_123").await.unwrap();

    assert_eq!(result.job_id, "job_123");
    assert_eq!(result.status, "completed");
    assert_eq!(result.progress, Some(100.0));
    assert!(result.result.is_some());
}

#[tokio::test]
async fn test_invalid_api_key() {
    let mut server = Server::new_async().await;
    let client = SchlepClient::with_base_url("invalid-key", &server.url()).unwrap();

    let _mock = server
        .mock("POST", "/upload")
        .match_header("authorization", "Bearer invalid-key")
        .with_status(401)
        .with_header("content-type", "application/json")
        .with_body(json!({
            "message": "Invalid API key"
        }).to_string())
        .create_async()
        .await;

    let result = client.upload("test data").await;

    assert!(result.is_err());
    match result.unwrap_err() {
        Error::Api { code, message } => {
            assert_eq!(code, 401);
            assert_eq!(message, "Invalid API key");
        }
        _ => panic!("Expected API error"),
    }
}

#[tokio::test]
async fn test_client_creation_from_env() {
    std::env::set_var("SCHLEP_API_KEY", "env-api-key");
    let _client = SchlepClient::from_env().unwrap();
    // We can verify the client was created successfully by checking we can create it
    // (the api_key field is private, so we can't directly access it)
}

#[tokio::test]
async fn test_client_creation_empty_api_key() {
    let result = SchlepClient::new("");
    assert!(result.is_err());
    match result.unwrap_err() {
        Error::Config(msg) => assert!(msg.contains("API key cannot be empty")),
        _ => panic!("Expected configuration error"),
    }
}

#[tokio::test]
async fn test_api_error_handling() {
    let mut server = Server::new_async().await;
    let client = SchlepClient::with_base_url("test-api-key", &server.url()).unwrap();

    let _mock = server
        .mock("POST", "/train")
        .with_status(400)
        .with_header("content-type", "application/json")
        .with_body(json!({
            "message": "Invalid training configuration"
        }).to_string())
        .create_async()
        .await;

    let config = json!({
        "invalid": "config"
    });
    let result = client.train(config).await;

    assert!(result.is_err());
    match result.unwrap_err() {
        Error::Api { code, message } => {
            assert_eq!(code, 400);
            assert_eq!(message, "Invalid training configuration");
        }
        _ => panic!("Expected API error"),
    }
}