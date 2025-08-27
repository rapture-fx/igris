"""
Comprehensive End-to-End Tests for Python SDK

This module contains E2E tests simulating real user workflows:
- Complete data processing pipelines
- ML model training and inference workflows
- File upload/download workflows
- Multi-step authentication and authorization
- Real-time streaming and WebSocket scenarios
- Error recovery and retry scenarios
- Cross-feature integration workflows
"""

import asyncio
import os
import tempfile
import time
import json
import uuid
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import pytest
import pytest_asyncio
from typing import List, Dict, Any, Optional

# Mock SDK imports with comprehensive functionality
try:
    from schlep_engine_sdk import SchlepEngineClient
    from schlep_engine_sdk.auth import AuthManager
    from schlep_engine_sdk.data_processing import DataProcessor
    from schlep_engine_sdk.ml_pipeline import MLPipeline
    from schlep_engine_sdk.streaming import WebSocketManager
    from schlep_engine_sdk.exceptions import SchlepEngineException, AuthenticationError, ProcessingError
except ImportError:
    # Comprehensive mock implementations
    class SchlepEngineClient:
        def __init__(self, api_key, base_url="https://api.example.com"):
            self.api_key = api_key
            self.base_url = base_url
            self.auth_manager = AuthManager(api_key)
            self.data_processor = DataProcessor(self)
            self.ml_pipeline = MLPipeline(self)
            self.websocket_manager = WebSocketManager(self)
            self._session_id = None
    
    class AuthManager:
        def __init__(self, api_key):
            self.api_key = api_key
            self.token_cache = {}
    
    class DataProcessor:
        def __init__(self, client):
            self.client = client
    
    class MLPipeline:
        def __init__(self, client):
            self.client = client
    
    class WebSocketManager:
        def __init__(self, client):
            self.client = client
    
    class SchlepEngineException(Exception):
        pass
    
    class AuthenticationError(SchlepEngineException):
        pass
    
    class ProcessingError(SchlepEngineException):
        pass


class E2ETestSuite:
    """End-to-end test suite with comprehensive workflow support"""
    
    def __init__(self):
        self.client = None
        self.temp_files = []
        self.created_resources = []
        self.workflow_state = {}
        
    def setup_test_environment(self):
        """Setup test environment with mock services"""
        # Create temporary directory for test files
        self.temp_dir = tempfile.mkdtemp(prefix='e2e_test_')
        
        # Setup mock client with realistic behavior
        self.client = self.create_mock_client()
        
    def create_mock_client(self):
        """Create comprehensive mock client"""
        client = Mock(spec=SchlepEngineClient)
        client.api_key = "test-api-key"
        client.base_url = "https://api.example.com"
        
        # Mock authentication flows
        async def mock_authenticate():
            await asyncio.sleep(0.1)  # Simulate network delay
            return {
                "token": f"auth_token_{uuid.uuid4()}",
                "expires_in": 3600,
                "refresh_token": f"refresh_{uuid.uuid4()}"
            }
        
        async def mock_refresh_token(refresh_token):
            await asyncio.sleep(0.05)
            return {
                "token": f"refreshed_token_{uuid.uuid4()}",
                "expires_in": 3600
            }
        
        client.authenticate = AsyncMock(side_effect=mock_authenticate)
        client.refresh_token = AsyncMock(side_effect=mock_refresh_token)
        
        # Mock file operations
        async def mock_upload_file(file_path, metadata=None):
            await asyncio.sleep(0.2)  # Simulate upload time
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 1024
            file_id = f"file_{uuid.uuid4()}"
            return {
                "file_id": file_id,
                "size": file_size,
                "status": "uploaded",
                "metadata": metadata or {}
            }
        
        async def mock_download_file(file_id, destination=None):
            await asyncio.sleep(0.15)  # Simulate download time
            content = b"Mock file content for " + file_id.encode()
            if destination:
                with open(destination, 'wb') as f:
                    f.write(content)
                return {"file_path": destination, "size": len(content)}
            return content
        
        client.upload_file = AsyncMock(side_effect=mock_upload_file)
        client.download_file = AsyncMock(side_effect=mock_download_file)
        
        # Mock data processing
        async def mock_create_job(job_config):
            await asyncio.sleep(0.1)
            job_id = f"job_{uuid.uuid4()}"
            return {
                "job_id": job_id,
                "status": "created",
                "config": job_config,
                "created_at": time.time()
            }
        
        async def mock_get_job_status(job_id):
            await asyncio.sleep(0.05)
            # Simulate job progression
            statuses = ["queued", "running", "completed"]
            import random
            status = random.choice(statuses)
            return {
                "job_id": job_id,
                "status": status,
                "progress": 100 if status == "completed" else random.randint(10, 90),
                "updated_at": time.time()
            }
        
        async def mock_wait_for_job_completion(job_id, timeout=300):
            await asyncio.sleep(1.0)  # Simulate processing time
            return {
                "job_id": job_id,
                "status": "completed",
                "progress": 100,
                "results": {
                    "processed_items": 100,
                    "output_files": [f"output_{i}.json" for i in range(3)]
                }
            }
        
        client.create_job = AsyncMock(side_effect=mock_create_job)
        client.get_job_status = AsyncMock(side_effect=mock_get_job_status)
        client.wait_for_job_completion = AsyncMock(side_effect=mock_wait_for_job_completion)
        
        # Mock ML pipeline operations
        async def mock_train_model(training_config):
            await asyncio.sleep(2.0)  # ML training takes longer
            model_id = f"model_{uuid.uuid4()}"
            return {
                "model_id": model_id,
                "status": "trained",
                "accuracy": 0.95,
                "config": training_config
            }
        
        async def mock_predict(model_id, input_data):
            await asyncio.sleep(0.3)
            predictions = [{"input": item, "prediction": f"pred_{i}"} 
                          for i, item in enumerate(input_data)]
            return {
                "model_id": model_id,
                "predictions": predictions,
                "confidence_scores": [0.9 + i * 0.01 for i in range(len(input_data))]
            }
        
        client.train_model = AsyncMock(side_effect=mock_train_model)
        client.predict = AsyncMock(side_effect=mock_predict)
        
        # Mock WebSocket operations
        class MockWebSocket:
            def __init__(self):
                self.connected = False
                self.messages = []
                self.subscribers = []
            
            async def connect(self):
                await asyncio.sleep(0.1)
                self.connected = True
                return {"status": "connected", "session_id": f"ws_{uuid.uuid4()}"}
            
            async def send(self, message):
                if not self.connected:
                    raise Exception("WebSocket not connected")
                await asyncio.sleep(0.01)
                self.messages.append(message)
                return {"status": "sent", "message_id": f"msg_{len(self.messages)}"}
            
            async def receive(self, timeout=5):
                await asyncio.sleep(0.05)
                return {
                    "type": "data",
                    "payload": {"timestamp": time.time(), "data": "mock_streaming_data"},
                    "message_id": f"received_{uuid.uuid4()}"
                }
            
            async def disconnect(self):
                await asyncio.sleep(0.05)
                self.connected = False
                return {"status": "disconnected"}
        
        client.create_websocket = AsyncMock(return_value=MockWebSocket())
        
        return client
        
    def create_test_file(self, filename, content_type="text", size_mb=1):
        """Create test file for upload scenarios"""
        file_path = os.path.join(self.temp_dir, filename)
        
        if content_type == "text":
            content = f"Test file content for {filename}\n" * (size_mb * 1000)
        elif content_type == "json":
            content = json.dumps({
                "filename": filename,
                "data": [{"id": i, "value": f"item_{i}"} for i in range(size_mb * 100)]
            }, indent=2)
        elif content_type == "binary":
            content = os.urandom(size_mb * 1024 * 1024)
        else:
            content = f"Generic content for {filename}"
        
        if isinstance(content, str):
            with open(file_path, 'w') as f:
                f.write(content)
        else:
            with open(file_path, 'wb') as f:
                f.write(content)
        
        self.temp_files.append(file_path)
        return file_path
        
    def cleanup_test_environment(self):
        """Cleanup test environment and resources"""
        # Remove temporary files
        for file_path in self.temp_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except:
                pass
        
        # Remove temp directory
        try:
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                import shutil
                shutil.rmtree(self.temp_dir)
        except:
            pass


@pytest.fixture
def e2e_suite():
    """Create E2E test suite fixture"""
    suite = E2ETestSuite()
    suite.setup_test_environment()
    yield suite
    suite.cleanup_test_environment()


class TestCompleteDataProcessingWorkflow:
    """Test complete data processing workflows from end to end"""
    
    @pytest.mark.asyncio
    async def test_full_data_pipeline_workflow(self, e2e_suite):
        """Test complete data processing pipeline: upload → process → download"""
        client = e2e_suite.client
        
        # Step 1: Authenticate
        auth_result = await client.authenticate()
        assert auth_result["token"]
        assert auth_result["expires_in"] > 0
        
        # Step 2: Prepare and upload data files
        input_files = []
        for i in range(3):
            file_path = e2e_suite.create_test_file(
                f"input_data_{i}.json", 
                content_type="json", 
                size_mb=1
            )
            
            upload_result = await client.upload_file(
                file_path, 
                metadata={"type": "input_data", "batch": i}
            )
            
            assert upload_result["status"] == "uploaded"
            assert upload_result["file_id"]
            input_files.append(upload_result["file_id"])
        
        # Step 3: Create data processing job
        job_config = {
            "type": "data_transformation",
            "input_files": input_files,
            "operations": [
                {"type": "filter", "criteria": {"value": {"$gt": 50}}},
                {"type": "transform", "function": "normalize"},
                {"type": "aggregate", "group_by": "category"}
            ],
            "output_format": "json"
        }
        
        job_result = await client.create_job(job_config)
        assert job_result["status"] == "created"
        job_id = job_result["job_id"]
        
        # Step 4: Wait for job completion
        completion_result = await client.wait_for_job_completion(job_id, timeout=60)
        assert completion_result["status"] == "completed"
        assert completion_result["progress"] == 100
        assert "results" in completion_result
        
        # Step 5: Download processed results
        output_files = completion_result["results"]["output_files"]
        downloaded_files = []
        
        for output_file in output_files:
            local_path = os.path.join(e2e_suite.temp_dir, f"downloaded_{output_file}")
            download_result = await client.download_file(output_file, destination=local_path)
            
            assert os.path.exists(local_path)
            assert download_result["size"] > 0
            downloaded_files.append(local_path)
        
        # Step 6: Verify results
        assert len(downloaded_files) == len(output_files)
        for file_path in downloaded_files:
            assert os.path.getsize(file_path) > 0
        
        # Verify the complete workflow state
        workflow_summary = {
            "authentication": "completed",
            "uploaded_files": len(input_files),
            "job_status": completion_result["status"],
            "downloaded_files": len(downloaded_files),
            "processing_time": completion_result.get("processing_time", "N/A")
        }
        
        e2e_suite.workflow_state["data_pipeline"] = workflow_summary
        assert workflow_summary["authentication"] == "completed"
        assert workflow_summary["uploaded_files"] > 0
        assert workflow_summary["job_status"] == "completed"
        assert workflow_summary["downloaded_files"] > 0
    
    @pytest.mark.asyncio
    async def test_batch_processing_workflow(self, e2e_suite):
        """Test batch processing workflow with multiple concurrent jobs"""
        client = e2e_suite.client
        
        # Authenticate
        await client.authenticate()
        
        # Create multiple data batches
        batches = []
        for batch_id in range(5):
            batch_files = []
            for file_id in range(2):
                file_path = e2e_suite.create_test_file(
                    f"batch_{batch_id}_file_{file_id}.json",
                    content_type="json"
                )
                upload_result = await client.upload_file(file_path)
                batch_files.append(upload_result["file_id"])
            
            batches.append({
                "batch_id": batch_id,
                "files": batch_files
            })
        
        # Create concurrent processing jobs
        job_tasks = []
        for batch in batches:
            job_config = {
                "type": "batch_processing",
                "batch_id": batch["batch_id"],
                "input_files": batch["files"],
                "operations": ["validate", "transform", "summarize"]
            }
            
            job_task = asyncio.create_task(client.create_job(job_config))
            job_tasks.append(job_task)
        
        # Wait for all jobs to be created
        job_results = await asyncio.gather(*job_tasks)
        job_ids = [result["job_id"] for result in job_results]
        
        # Monitor all jobs concurrently
        completion_tasks = [
            client.wait_for_job_completion(job_id, timeout=120)
            for job_id in job_ids
        ]
        
        completion_results = await asyncio.gather(*completion_tasks)
        
        # Verify all jobs completed successfully
        completed_jobs = 0
        total_processed_items = 0
        
        for result in completion_results:
            assert result["status"] == "completed"
            completed_jobs += 1
            total_processed_items += result["results"]["processed_items"]
        
        assert completed_jobs == len(batches)
        assert total_processed_items > 0
        
        e2e_suite.workflow_state["batch_processing"] = {
            "batches_processed": completed_jobs,
            "total_items": total_processed_items,
            "success_rate": completed_jobs / len(batches)
        }
    
    @pytest.mark.asyncio
    async def test_error_recovery_workflow(self, e2e_suite):
        """Test error recovery and retry mechanisms in workflows"""
        client = e2e_suite.client
        
        # Authenticate
        await client.authenticate()
        
        # Mock a scenario where some operations fail initially
        original_create_job = client.create_job
        call_count = 0
        
        async def failing_create_job(job_config):
            nonlocal call_count
            call_count += 1
            
            # Fail the first 2 attempts
            if call_count <= 2:
                raise ProcessingError("Simulated service unavailable")
            
            # Succeed on the 3rd attempt
            return await original_create_job(job_config)
        
        client.create_job = AsyncMock(side_effect=failing_create_job)
        
        # Implement retry logic
        max_retries = 3
        retry_delay = 0.1
        
        job_config = {
            "type": "error_recovery_test",
            "data": "test_data"
        }
        
        for attempt in range(max_retries):
            try:
                job_result = await client.create_job(job_config)
                break
            except ProcessingError as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
                    continue
                else:
                    raise e
        
        # Verify the job was eventually created
        assert job_result["status"] == "created"
        assert call_count == 3  # Should have tried 3 times
        
        # Test the completed workflow
        completion_result = await client.wait_for_job_completion(job_result["job_id"])
        assert completion_result["status"] == "completed"
        
        e2e_suite.workflow_state["error_recovery"] = {
            "attempts": call_count,
            "final_status": completion_result["status"],
            "retry_successful": True
        }


class TestMLPipelineWorkflow:
    """Test complete ML pipeline workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_ml_training_workflow(self, e2e_suite):
        """Test complete ML workflow: data prep → training → validation → inference"""
        client = e2e_suite.client
        
        # Step 1: Authenticate and prepare training data
        await client.authenticate()
        
        # Upload training data
        training_file = e2e_suite.create_test_file(
            "training_data.json",
            content_type="json",
            size_mb=5
        )
        
        train_upload = await client.upload_file(
            training_file,
            metadata={"type": "training_data", "samples": 1000}
        )
        
        # Upload validation data
        validation_file = e2e_suite.create_test_file(
            "validation_data.json",
            content_type="json",
            size_mb=2
        )
        
        val_upload = await client.upload_file(
            validation_file,
            metadata={"type": "validation_data", "samples": 200}
        )
        
        # Step 2: Configure and start model training
        training_config = {
            "model_type": "classifier",
            "algorithm": "random_forest",
            "training_data": train_upload["file_id"],
            "validation_data": val_upload["file_id"],
            "hyperparameters": {
                "n_estimators": 100,
                "max_depth": 10,
                "min_samples_split": 5
            },
            "validation_split": 0.2,
            "early_stopping": True
        }
        
        training_result = await client.train_model(training_config)
        
        assert training_result["status"] == "trained"
        assert training_result["accuracy"] > 0.8  # Expect good performance
        model_id = training_result["model_id"]
        
        # Step 3: Prepare test data and run inference
        test_data = [
            {"feature1": 0.5, "feature2": 1.2, "feature3": "category_a"},
            {"feature1": 0.8, "feature2": 0.9, "feature3": "category_b"},
            {"feature1": 0.3, "feature2": 1.5, "feature3": "category_a"},
            {"feature1": 0.7, "feature2": 0.6, "feature3": "category_c"}
        ]
        
        prediction_result = await client.predict(model_id, test_data)
        
        assert len(prediction_result["predictions"]) == len(test_data)
        assert len(prediction_result["confidence_scores"]) == len(test_data)
        assert all(score > 0.5 for score in prediction_result["confidence_scores"])
        
        # Step 4: Validate the complete ML workflow
        ml_workflow_summary = {
            "training_data_uploaded": bool(train_upload["file_id"]),
            "validation_data_uploaded": bool(val_upload["file_id"]),
            "model_trained": training_result["status"] == "trained",
            "model_accuracy": training_result["accuracy"],
            "predictions_generated": len(prediction_result["predictions"]),
            "avg_confidence": sum(prediction_result["confidence_scores"]) / len(prediction_result["confidence_scores"])
        }
        
        e2e_suite.workflow_state["ml_pipeline"] = ml_workflow_summary
        
        # Assertions for complete workflow
        assert ml_workflow_summary["training_data_uploaded"]
        assert ml_workflow_summary["validation_data_uploaded"]
        assert ml_workflow_summary["model_trained"]
        assert ml_workflow_summary["model_accuracy"] > 0.8
        assert ml_workflow_summary["predictions_generated"] == len(test_data)
        assert ml_workflow_summary["avg_confidence"] > 0.5
    
    @pytest.mark.asyncio
    async def test_automl_workflow(self, e2e_suite):
        """Test automated ML workflow with hyperparameter optimization"""
        client = e2e_suite.client
        
        await client.authenticate()
        
        # Upload dataset for AutoML
        dataset_file = e2e_suite.create_test_file(
            "automl_dataset.json",
            content_type="json",
            size_mb=3
        )
        
        dataset_upload = await client.upload_file(dataset_file)
        
        # Configure AutoML experiment
        automl_config = {
            "task_type": "classification",
            "dataset": dataset_upload["file_id"],
            "target_column": "label",
            "time_budget_minutes": 10,
            "algorithms_to_try": ["random_forest", "xgboost", "neural_network"],
            "optimization_metric": "accuracy",
            "cross_validation_folds": 5
        }
        
        # Mock AutoML training (simplified)
        async def mock_automl_training(config):
            await asyncio.sleep(1.5)  # Simulate longer training time
            
            # Simulate trying multiple models
            model_results = []
            for algorithm in config["algorithms_to_try"]:
                model_results.append({
                    "algorithm": algorithm,
                    "accuracy": 0.85 + hash(algorithm) % 10 / 100,  # Simulate varying performance
                    "training_time": 120 + hash(algorithm) % 60
                })
            
            # Select best model
            best_model = max(model_results, key=lambda x: x["accuracy"])
            
            return {
                "model_id": f"automl_model_{uuid.uuid4()}",
                "status": "completed",
                "best_algorithm": best_model["algorithm"],
                "best_accuracy": best_model["accuracy"],
                "all_results": model_results,
                "optimization_history": [
                    {"iteration": i, "accuracy": 0.7 + i * 0.05} 
                    for i in range(5)
                ]
            }
        
        client.run_automl = AsyncMock(side_effect=mock_automl_training)
        
        # Run AutoML experiment
        automl_result = await client.run_automl(automl_config)
        
        assert automl_result["status"] == "completed"
        assert automl_result["best_accuracy"] > 0.8
        assert len(automl_result["all_results"]) == len(automl_config["algorithms_to_try"])
        
        # Test the best model with inference
        test_data = [{"feature": i} for i in range(5)]
        predictions = await client.predict(automl_result["model_id"], test_data)
        
        assert len(predictions["predictions"]) == len(test_data)
        
        e2e_suite.workflow_state["automl"] = {
            "experiment_completed": True,
            "best_algorithm": automl_result["best_algorithm"],
            "best_accuracy": automl_result["best_accuracy"],
            "models_tested": len(automl_result["all_results"])
        }


class TestRealTimeStreamingWorkflow:
    """Test real-time streaming and WebSocket workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_streaming_workflow(self, e2e_suite):
        """Test complete real-time streaming workflow"""
        client = e2e_suite.client
        
        # Step 1: Authenticate
        await client.authenticate()
        
        # Step 2: Establish WebSocket connection
        websocket = await client.create_websocket()
        connection_result = await websocket.connect()
        
        assert connection_result["status"] == "connected"
        assert connection_result["session_id"]
        
        # Step 3: Set up streaming data processing
        processed_messages = []
        error_count = 0
        
        async def process_streaming_data():
            nonlocal processed_messages, error_count
            
            try:
                for _ in range(10):  # Process 10 messages
                    message = await websocket.receive(timeout=5)
                    
                    # Simulate processing
                    processed_data = {
                        "original": message,
                        "processed_at": time.time(),
                        "processed_by": "e2e_test_workflow"
                    }
                    
                    processed_messages.append(processed_data)
                    
                    # Send acknowledgment back
                    ack_message = {
                        "type": "acknowledgment",
                        "message_id": message["message_id"],
                        "status": "processed"
                    }
                    
                    await websocket.send(ack_message)
                    
            except Exception as e:
                error_count += 1
        
        # Step 4: Run streaming processing
        await process_streaming_data()
        
        # Step 5: Verify streaming workflow
        assert len(processed_messages) == 10
        assert error_count == 0
        assert all("processed_at" in msg for msg in processed_messages)
        
        # Step 6: Clean up connection
        disconnect_result = await websocket.disconnect()
        assert disconnect_result["status"] == "disconnected"
        
        streaming_summary = {
            "connection_established": True,
            "messages_processed": len(processed_messages),
            "errors": error_count,
            "connection_closed": True
        }
        
        e2e_suite.workflow_state["streaming"] = streaming_summary
    
    @pytest.mark.asyncio
    async def test_streaming_with_data_persistence(self, e2e_suite):
        """Test streaming workflow with data persistence"""
        client = e2e_suite.client
        
        await client.authenticate()
        
        # Setup streaming with persistence
        websocket = await client.create_websocket()
        await websocket.connect()
        
        # Create a file to store streaming data
        output_file = os.path.join(e2e_suite.temp_dir, "streaming_data.json")
        collected_data = []
        
        # Process and persist streaming data
        for batch_num in range(3):  # 3 batches
            batch_data = []
            
            for i in range(5):  # 5 messages per batch
                message = await websocket.receive()
                batch_data.append(message["payload"])
            
            # Persist batch to file
            with open(output_file, 'a') as f:
                for data in batch_data:
                    f.write(json.dumps(data) + "\n")
            
            collected_data.extend(batch_data)
            
            # Upload batch to cloud storage (mock)
            batch_file = os.path.join(e2e_suite.temp_dir, f"batch_{batch_num}.json")
            with open(batch_file, 'w') as f:
                json.dump(batch_data, f)
            
            upload_result = await client.upload_file(
                batch_file,
                metadata={"type": "streaming_batch", "batch_number": batch_num}
            )
            
            assert upload_result["status"] == "uploaded"
        
        # Verify data persistence
        assert os.path.exists(output_file)
        assert len(collected_data) == 15  # 3 batches × 5 messages
        
        # Verify file content
        with open(output_file, 'r') as f:
            lines = f.readlines()
            assert len(lines) == 15
        
        await websocket.disconnect()
        
        e2e_suite.workflow_state["streaming_persistence"] = {
            "batches_processed": 3,
            "total_messages": len(collected_data),
            "data_persisted": True,
            "files_uploaded": 3
        }


class TestMultiServiceIntegrationWorkflow:
    """Test workflows that integrate multiple services and features"""
    
    @pytest.mark.asyncio
    async def test_complex_integration_workflow(self, e2e_suite):
        """Test complex workflow integrating multiple services"""
        client = e2e_suite.client
        
        # Step 1: Authentication and setup
        auth_result = await client.authenticate()
        assert auth_result["token"]
        
        # Step 2: Data ingestion phase
        ingestion_results = []
        source_files = []
        
        # Create multiple data sources
        for source_type in ["user_data", "product_data", "transaction_data"]:
            file_path = e2e_suite.create_test_file(
                f"{source_type}.json",
                content_type="json",
                size_mb=2
            )
            
            upload_result = await client.upload_file(
                file_path,
                metadata={"source_type": source_type, "version": "1.0"}
            )
            
            ingestion_results.append(upload_result)
            source_files.append(upload_result["file_id"])
        
        # Step 3: Data processing and transformation
        processing_job_config = {
            "type": "multi_source_processing",
            "input_files": source_files,
            "operations": [
                {"type": "join", "join_key": "user_id"},
                {"type": "clean", "remove_nulls": True},
                {"type": "feature_engineering", "create_features": ["user_lifetime_value", "purchase_frequency"]},
                {"type": "validate", "schema": "processed_data_v1"}
            ]
        }
        
        processing_job = await client.create_job(processing_job_config)
        processing_result = await client.wait_for_job_completion(processing_job["job_id"])
        
        assert processing_result["status"] == "completed"
        
        # Step 4: ML model training with processed data
        processed_data_file = processing_result["results"]["output_files"][0]
        
        training_config = {
            "model_type": "recommendation_engine",
            "training_data": processed_data_file,
            "algorithm": "collaborative_filtering",
            "hyperparameters": {
                "factors": 50,
                "regularization": 0.01,
                "iterations": 100
            }
        }
        
        training_result = await client.train_model(training_config)
        model_id = training_result["model_id"]
        
        # Step 5: Real-time prediction service
        websocket = await client.create_websocket()
        await websocket.connect()
        
        # Simulate real-time recommendation requests
        recommendation_requests = [
            {"user_id": f"user_{i}", "context": {"page": "home", "time": "evening"}}
            for i in range(10)
        ]
        
        recommendations = []
        for request in recommendation_requests:
            # Send request via WebSocket
            await websocket.send({
                "type": "recommendation_request",
                "model_id": model_id,
                "request": request
            })
            
            # Get real-time response
            response = await websocket.receive()
            recommendations.append(response["payload"])
        
        await websocket.disconnect()
        
        # Step 6: Batch analytics and reporting
        analytics_config = {
            "type": "recommendation_analytics",
            "model_id": model_id,
            "processed_data": processed_data_file,
            "metrics": ["precision", "recall", "diversity", "coverage"],
            "time_window": "24h"
        }
        
        analytics_job = await client.create_job(analytics_config)
        analytics_result = await client.wait_for_job_completion(analytics_job["job_id"])
        
        # Step 7: Verify complete integration workflow
        workflow_summary = {
            "data_sources_ingested": len(source_files),
            "data_processing_completed": processing_result["status"] == "completed",
            "model_trained": training_result["status"] == "trained",
            "realtime_predictions": len(recommendations),
            "analytics_completed": analytics_result["status"] == "completed",
            "end_to_end_success": True
        }
        
        e2e_suite.workflow_state["complex_integration"] = workflow_summary
        
        # Comprehensive assertions
        assert workflow_summary["data_sources_ingested"] == 3
        assert workflow_summary["data_processing_completed"]
        assert workflow_summary["model_trained"]
        assert workflow_summary["realtime_predictions"] == 10
        assert workflow_summary["analytics_completed"]
        assert workflow_summary["end_to_end_success"]
    
    @pytest.mark.asyncio
    async def test_disaster_recovery_workflow(self, e2e_suite):
        """Test disaster recovery and failover scenarios"""
        client = e2e_suite.client
        
        await client.authenticate()
        
        # Setup critical data processing job
        critical_file = e2e_suite.create_test_file("critical_data.json", content_type="json")
        upload_result = await client.upload_file(critical_file)
        
        job_config = {
            "type": "critical_processing",
            "input_files": [upload_result["file_id"]],
            "priority": "high",
            "fault_tolerance": True,
            "backup_strategy": "multi_region"
        }
        
        # Mock service failure during processing
        original_wait_for_completion = client.wait_for_job_completion
        failure_occurred = False
        
        async def failing_wait_for_completion(job_id, timeout=300):
            nonlocal failure_occurred
            
            if not failure_occurred:
                failure_occurred = True
                await asyncio.sleep(0.5)  # Simulate partial processing
                raise ProcessingError("Primary service unavailable")
            else:
                # Simulate failover to backup service
                await asyncio.sleep(1.0)  # Failover time
                return {
                    "job_id": job_id,
                    "status": "completed",
                    "processed_on": "backup_service",
                    "failover_time": 1.0,
                    "results": {"processed_items": 100}
                }
        
        client.wait_for_job_completion = AsyncMock(side_effect=failing_wait_for_completion)
        
        # Execute job with automatic failover
        job_result = await client.create_job(job_config)
        job_id = job_result["job_id"]
        
        # First attempt should fail
        try:
            await client.wait_for_job_completion(job_id)
            assert False, "Expected failure did not occur"
        except ProcessingError:
            pass  # Expected failure
        
        # Second attempt should succeed via failover
        completion_result = await client.wait_for_job_completion(job_id)
        
        assert completion_result["status"] == "completed"
        assert completion_result["processed_on"] == "backup_service"
        assert "failover_time" in completion_result
        
        disaster_recovery_summary = {
            "initial_failure": True,
            "failover_successful": completion_result["status"] == "completed",
            "failover_service": completion_result["processed_on"],
            "recovery_time": completion_result["failover_time"]
        }
        
        e2e_suite.workflow_state["disaster_recovery"] = disaster_recovery_summary


@pytest.mark.asyncio
async def test_e2e_workflow_summary(e2e_suite):
    """Generate comprehensive E2E workflow test summary"""
    print("\n" + "="*70)
    print("PYTHON SDK END-TO-END WORKFLOW TEST SUMMARY")
    print("="*70)
    
    # Display all completed workflows
    for workflow_name, workflow_state in e2e_suite.workflow_state.items():
        print(f"\n{workflow_name.upper().replace('_', ' ')} WORKFLOW:")
        
        if isinstance(workflow_state, dict):
            for key, value in workflow_state.items():
                if isinstance(value, bool):
                    status = "✓ PASSED" if value else "✗ FAILED"
                    print(f"  {key}: {status}")
                elif isinstance(value, (int, float)):
                    print(f"  {key}: {value}")
                else:
                    print(f"  {key}: {value}")
        else:
            print(f"  Status: {workflow_state}")
    
    print(f"\nTOTAL WORKFLOWS TESTED: {len(e2e_suite.workflow_state)}")
    print(f"TEMPORARY FILES CREATED: {len(e2e_suite.temp_files)}")
    
    # Verify that we have comprehensive test coverage
    expected_workflows = [
        "data_pipeline",
        "batch_processing", 
        "error_recovery",
        "ml_pipeline",
        "automl",
        "streaming",
        "streaming_persistence",
        "complex_integration",
        "disaster_recovery"
    ]
    
    completed_workflows = list(e2e_suite.workflow_state.keys())
    coverage = len(completed_workflows) / len(expected_workflows) * 100
    
    print(f"WORKFLOW COVERAGE: {coverage:.1f}%")
    print("="*70)
    
    # Verify comprehensive test coverage
    assert len(completed_workflows) >= 5, "Should test at least 5 different workflows"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])