"""
Basic usage examples for Igris-engine Python SDK

This file demonstrates common usage patterns for the SDK.
"""

import asyncio
from igris import IgrisClient
from igris.models.data import DataFormat, ProcessingMode
from igris.models.ml import MLPipelineConfig, MLTaskType, ModelType


async def basic_data_processing():
    """Example: Basic data processing"""
    
    # Initialize client with API key
    client = IgrisClient(api_key="your-api-key-here")
    
    try:
        # Process a CSV file
        result = await client.data.process_file(
            file_path="sample_data.csv",
            data_format=DataFormat.CSV,
            processing_mode=ProcessingMode.BATCH,
            transformations=[
                {"type": "filter", "condition": "age >= 18"},
                {"type": "aggregate", "group_by": ["region"], "metrics": {"revenue": "sum"}}
            ],
            output_format=DataFormat.JSON
        )
        
        print(f"Processing started. Job ID: {result.job_id}")
        print(f"Status: {result.status}")
        
        # Monitor job status
        while not result.status.is_completed:
            result = await client.data.get_job_result(result.job_id)
            print(f"Progress: {result.progress_percentage}%")
            await asyncio.sleep(5)
        
        print(f"Processing complete! Processed {result.output_records} records")
        
    finally:
        await client.close()


async def machine_learning_example():
    """Example: Machine learning pipeline"""
    
    async with IgrisClient(api_key="your-api-key") as client:
        
        # Create ML pipeline configuration
        config = MLPipelineConfig(
            name="Customer Churn Prediction",
            task_type=MLTaskType.CLASSIFICATION,
            model_type=ModelType.RANDOM_FOREST,
            target_column="churn",
            feature_columns=["age", "tenure", "monthly_charges", "total_charges"],
            auto_feature_selection=True,
            auto_hyperparameter_tuning=True
        )
        
        # Create the pipeline
        pipeline_info = await client.ml.create_pipeline(config)
        print(f"Pipeline created: {pipeline_info['pipeline_id']}")
        
        # Start training
        training_job = await client.ml.train_pipeline(
            pipeline_info["pipeline_id"],
            training_data_path="customer_data.csv"
        )
        
        print(f"Training started. Job ID: {training_job.job_id}")
        
        # Monitor training progress
        while training_job.is_running:
            training_job = await client.ml.get_training_job(training_job.job_id)
            print(f"Training progress: {training_job.progress_percentage}%")
            if training_job.current_epoch:
                print(f"Epoch {training_job.current_epoch}/{training_job.total_epochs}")
            await asyncio.sleep(10)
        
        if training_job.status == "completed":
            print("Training completed successfully!")
            if training_job.metrics:
                print(f"Model accuracy: {training_job.metrics.accuracy:.2%}")
            
            # Make predictions
            predictions = await client.ml.predict(
                model_id=training_job.model_id,
                input_data=[
                    {"age": 35, "tenure": 24, "monthly_charges": 65.0, "total_charges": 1560.0},
                    {"age": 28, "tenure": 12, "monthly_charges": 89.5, "total_charges": 1074.0}
                ],
                return_probabilities=True
            )
            
            print("Predictions:", predictions.predictions)
            print("Probabilities:", predictions.probabilities)
        else:
            print(f"Training failed: {training_job.error_message}")


async def user_authentication_example():
    """Example: User authentication workflow"""
    
    client = IgrisClient()
    
    try:
        # Login with username and password
        tokens = await client.auth.login(
            email="user@example.com",
            password="secure_password",
            remember_me=True
        )
        
        print(f"Logged in successfully!")
        print(f"User: {tokens.user.display_name}")
        print(f"Role: {tokens.user.role}")
        
        # Get current user profile
        profile = await client.auth.get_current_user()
        print(f"Profile: {profile.email}")
        
        # Update profile
        updated_profile = await client.auth.update_profile(
            first_name="Updated",
            last_name="Name"
        )
        
        print(f"Updated profile: {updated_profile.full_name}")
        
        # List user's processing jobs
        jobs = await client.data.list_jobs(page_size=5)
        print(f"Found {len(jobs.data)} recent jobs")
        
        # Logout
        await client.auth.logout()
        print("Logged out successfully")
        
    except Exception as e:
        print(f"Error: {e}")
    
    finally:
        await client.close()


async def document_extraction_example():
    """Example: Document extraction"""
    
    async with IgrisClient(api_key="your-api-key") as client:
        
        # Extract text from a PDF document
        result = await client.extract.extract_text(
            file_path="document.pdf",
            extract_tables=True,
            extract_images=False
        )
        
        print("Extracted Text Preview:")
        print(result["text"][:500] + "..." if len(result["text"]) > 500 else result["text"])
        
        print(f"\nFound {len(result['tables'])} tables")
        for i, table in enumerate(result["tables"]):
            print(f"Table {i + 1}: {len(table['rows'])} rows, {len(table['columns'])} columns")
        
        # Extract structured data from tables
        tables = await client.extract.extract_tables("invoice.pdf")
        print(f"\nExtracted {len(tables['tables'])} structured tables")


def synchronous_example():
    """Example: Using synchronous client"""
    
    from igris import IgrisClientSync
    
    # Synchronous client for non-async environments
    client = IgrisClientSync(api_key="your-api-key")
    
    try:
        # Test connection
        health = client.test_connection()
        print(f"API Status: {health['status']}")
        
        # Process file synchronously
        result = client.data.process_file(
            file_path="data.csv",
            transformations=[{"type": "clean", "remove_nulls": True}]
        )
        print(f"Job started: {result.job_id}")
        
        # List models synchronously
        models = client.ml.list_models(page_size=5)
        print(f"Found {len(models.data)} models")
        
    finally:
        client.close()


if __name__ == "__main__":
    # Run async examples
    print("=== Basic Data Processing ===")
    asyncio.run(basic_data_processing())
    
    print("\n=== Machine Learning ===")
    asyncio.run(machine_learning_example())
    
    print("\n=== User Authentication ===")
    asyncio.run(user_authentication_example())
    
    print("\n=== Document Extraction ===")
    asyncio.run(document_extraction_example())
    
    print("\n=== Synchronous Usage ===")
    synchronous_example()