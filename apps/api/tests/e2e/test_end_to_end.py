import pytest
import asyncio
import tempfile
import os
import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import subprocess
import requests
import json

from app.main import app
from app.database.connection import get_db
from app.models.base import Base
from app.auth.models import User
from app.core.security import get_password_hash

# Test configuration
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def db_session():
    """Create database session for testing"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def test_user(db_session):
    """Create test user"""
    user = User(
        email="e2e@example.com",
        hashed_password=get_password_hash("e2epassword123"),
        full_name="E2E Test User",
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def auth_headers(client, test_user):
    """Get authentication headers"""
    login_data = {
        "email": "e2e@example.com",
        "password": "e2epassword123"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

class TestCompleteUserWorkflow:
    """End-to-end tests for complete user workflows"""
    
    def test_complete_data_processing_workflow(self, client, auth_headers):
        """Test complete data processing workflow from upload to results"""
        # Step 1: Upload data file
        csv_content = """name,age,city,salary
John Doe,25,New York,50000
Jane Smith,30,Los Angeles,60000
Bob Johnson,35,Chicago,55000
Alice Brown,28,Boston,52000
Charlie Wilson,32,Seattle,58000"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            f.flush()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("employees.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 200
        upload_data = response.json()
        file_id = upload_data["file_id"]
        
        # Step 2: Create data processing job
        job_data = {
            "job_type": "data_cleaning",
            "parameters": {
                "file_id": file_id,
                "cleaning_rules": [
                    "remove_duplicates",
                    "fill_missing_values",
                    "validate_data_types"
                ],
                "output_format": "csv"
            }
        }
        
        response = client.post(
            "/api/v1/jobs/create",
            json=job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        job_data = response.json()
        job_id = job_data["job_id"]
        
        # Step 3: Monitor job progress
        max_attempts = 30
        for attempt in range(max_attempts):
            response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
            assert response.status_code == 200
            
            status_data = response.json()
            if status_data["status"] in ["completed", "failed"]:
                break
            
            time.sleep(2)
        
        assert status_data["status"] == "completed"
        
        # Step 4: Get processed results
        response = client.get(f"/api/v1/data/results/{file_id}", headers=auth_headers)
        assert response.status_code == 200
        
        results_data = response.json()
        assert "processed_file_url" in results_data
        assert "statistics" in results_data
        
        # Step 5: Download processed file
        response = client.get(
            f"/api/v1/data/download/{file_id}",
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_ml_pipeline_workflow(self, client, auth_headers):
        """Test complete ML pipeline workflow"""
        # Step 1: Upload training data
        training_data = """feature1,feature2,feature3,target
1.2,3.4,5.6,1
2.3,4.5,6.7,0
3.4,5.6,7.8,1
4.5,6.7,8.9,0
5.6,7.8,9.0,1"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(training_data)
            f.flush()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("training_data.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 200
        upload_data = response.json()
        training_file_id = upload_data["file_id"]
        
        # Step 2: Create ML training job
        ml_job_data = {
            "job_type": "ml_training",
            "parameters": {
                "training_file_id": training_file_id,
                "model_type": "random_forest",
                "target_column": "target",
                "feature_columns": ["feature1", "feature2", "feature3"],
                "test_size": 0.2,
                "random_state": 42
            }
        }
        
        response = client.post(
            "/api/v1/jobs/create",
            json=ml_job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        ml_job_data = response.json()
        ml_job_id = ml_job_data["job_id"]
        
        # Step 3: Monitor ML training progress
        max_attempts = 60  # ML training takes longer
        for attempt in range(max_attempts):
            response = client.get(f"/api/v1/jobs/{ml_job_id}", headers=auth_headers)
            assert response.status_code == 200
            
            status_data = response.json()
            if status_data["status"] in ["completed", "failed"]:
                break
            
            time.sleep(5)
        
        assert status_data["status"] == "completed"
        
        # Step 4: Get model metrics
        response = client.get(f"/api/v1/ml/models/{ml_job_id}/metrics", headers=auth_headers)
        assert response.status_code == 200
        
        metrics_data = response.json()
        assert "accuracy" in metrics_data
        assert "precision" in metrics_data
        assert "recall" in metrics_data

    def test_anomaly_detection_workflow(self, client, auth_headers):
        """Test anomaly detection workflow"""
        # Step 1: Upload data with anomalies
        anomaly_data = """timestamp,value,is_anomaly
2023-01-01 00:00:00,100,0
2023-01-01 01:00:00,105,0
2023-01-01 02:00:00,110,0
2023-01-01 03:00:00,200,1
2023-01-01 04:00:00,108,0
2023-01-01 05:00:00,112,0"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(anomaly_data)
            f.flush()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("anomaly_data.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 200
        upload_data = response.json()
        file_id = upload_data["file_id"]
        
        # Step 2: Run anomaly detection
        anomaly_job_data = {
            "job_type": "anomaly_detection",
            "parameters": {
                "file_id": file_id,
                "algorithm": "isolation_forest",
                "contamination": 0.1,
                "features": ["value"]
            }
        }
        
        response = client.post(
            "/api/v1/jobs/create",
            json=anomaly_job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        job_data = response.json()
        job_id = job_data["job_id"]
        
        # Step 3: Wait for completion
        max_attempts = 30
        for attempt in range(max_attempts):
            response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
            assert response.status_code == 200
            
            status_data = response.json()
            if status_data["status"] in ["completed", "failed"]:
                break
            
            time.sleep(2)
        
        assert status_data["status"] == "completed"
        
        # Step 4: Get anomaly results
        response = client.get(f"/api/v1/anomalies/{job_id}", headers=auth_headers)
        assert response.status_code == 200
        
        anomalies_data = response.json()
        assert "anomalies" in anomalies_data
        assert "total_anomalies" in anomalies_data

class TestSystemIntegration:
    """End-to-end system integration tests"""
    
    def test_full_stack_health_check(self, client):
        """Test complete system health"""
        # Test API health
        response = client.get("/health")
        assert response.status_code == 200
        
        health_data = response.json()
        assert health_data["status"] == "healthy"
        assert "database" in health_data
        assert "redis" in health_data
        assert "storage" in health_data
        
        # Test metrics endpoint
        response = client.get("/metrics")
        assert response.status_code == 200
        assert "http_requests_total" in response.text

    def test_error_recovery_workflow(self, client, auth_headers):
        """Test system recovery from errors"""
        # Step 1: Create a job that might fail
        job_data = {
            "job_type": "data_cleaning",
            "parameters": {
                "file_id": "nonexistent_file",
                "cleaning_rules": ["remove_duplicates"]
            }
        }
        
        response = client.post(
            "/api/v1/jobs/create",
            json=job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        job_data = response.json()
        job_id = job_data["job_id"]
        
        # Step 2: Wait for job to fail
        max_attempts = 30
        for attempt in range(max_attempts):
            response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
            assert response.status_code == 200
            
            status_data = response.json()
            if status_data["status"] in ["failed", "completed"]:
                break
            
            time.sleep(2)
        
        # Step 3: Check error details
        if status_data["status"] == "failed":
            assert "error_message" in status_data
            assert "retry_count" in status_data
        
        # Step 4: Test retry mechanism
        response = client.post(f"/api/v1/jobs/{job_id}/retry", headers=auth_headers)
        # Should either succeed or fail appropriately
        assert response.status_code in [200, 400, 404]

    def test_concurrent_user_workflows(self, client):
        """Test multiple users working concurrently"""
        # Create multiple users
        users = []
        for i in range(3):
            user_data = {
                "email": f"user{i}@example.com",
                "password": "password123",
                "full_name": f"User {i}"
            }
            
            response = client.post("/api/v1/auth/register", json=user_data)
            assert response.status_code == 201
            
            # Login to get token
            login_data = {
                "email": f"user{i}@example.com",
                "password": "password123"
            }
            response = client.post("/api/v1/auth/login", json=login_data)
            assert response.status_code == 200
            
            token = response.json()["access_token"]
            users.append({"token": token, "user_id": i})
        
        # Simulate concurrent file uploads
        import threading
        
        results = []
        
        def upload_file(user_info):
            csv_content = f"user,data\n{user_info['user_id']},test_data"
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                f.write(csv_content)
                f.flush()
                
                headers = {"Authorization": f"Bearer {user_info['token']}"}
                
                with open(f.name, 'rb') as file:
                    response = client.post(
                        "/api/v1/data/upload",
                        files={"file": (f"user_{user_info['user_id']}.csv", file, "text/csv")},
                        headers=headers
                    )
                
                os.unlink(f.name)
                results.append(response.status_code)
        
        # Start concurrent uploads
        threads = []
        for user_info in users:
            thread = threading.Thread(target=upload_file, args=(user_info,))
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # All uploads should succeed
        assert all(status == 200 for status in results)

class TestPerformanceE2E:
    """End-to-end performance tests"""
    
    def test_large_file_processing(self, client, auth_headers):
        """Test processing of large files"""
        # Create large CSV file (10,000 rows)
        large_csv_content = "id,name,value,date\n"
        for i in range(10000):
            large_csv_content += f"{i},User{i},{i * 1.5},2023-01-01\n"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(large_csv_content)
            f.flush()
            
            start_time = time.time()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("large_file.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            upload_time = time.time() - start_time
            os.unlink(f.name)
        
        assert response.status_code == 200
        assert upload_time < 30  # Should complete within 30 seconds
        
        # Process the large file
        upload_data = response.json()
        file_id = upload_data["file_id"]
        
        job_data = {
            "job_type": "data_cleaning",
            "parameters": {
                "file_id": file_id,
                "cleaning_rules": ["remove_duplicates"]
            }
        }
        
        start_time = time.time()
        response = client.post(
            "/api/v1/jobs/create",
            json=job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        job_data = response.json()
        job_id = job_data["job_id"]
        
        # Wait for completion with timeout
        max_attempts = 120  # 10 minutes timeout
        for attempt in range(max_attempts):
            response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
            assert response.status_code == 200
            
            status_data = response.json()
            if status_data["status"] in ["completed", "failed"]:
                break
            
            time.sleep(5)
        
        processing_time = time.time() - start_time
        assert status_data["status"] == "completed"
        assert processing_time < 600  # Should complete within 10 minutes

    def test_api_response_times(self, client, auth_headers):
        """Test API response times under load"""
        import threading
        import statistics
        
        response_times = []
        
        def make_request():
            start_time = time.time()
            response = client.get("/api/v1/auth/me", headers=auth_headers)
            end_time = time.time()
            
            if response.status_code == 200:
                response_times.append(end_time - start_time)
        
        # Make 50 concurrent requests
        threads = []
        for _ in range(50):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # Calculate statistics
        if response_times:
            avg_response_time = statistics.mean(response_times)
            max_response_time = max(response_times)
            
            assert avg_response_time < 1.0  # Average response time < 1 second
            assert max_response_time < 5.0  # Max response time < 5 seconds

class TestSecurityE2E:
    """End-to-end security tests"""
    
    def test_authentication_flow_security(self, client):
        """Test security of authentication flow"""
        # Test password strength requirements
        weak_password_data = {
            "email": "test@example.com",
            "password": "123",
            "full_name": "Test User"
        }
        
        response = client.post("/api/v1/auth/register", json=weak_password_data)
        assert response.status_code == 422  # Should fail validation
        
        # Test SQL injection attempt
        sql_injection_data = {
            "email": "test@example.com'; DROP TABLE users; --",
            "password": "password123",
            "full_name": "Test User"
        }
        
        response = client.post("/api/v1/auth/register", json=sql_injection_data)
        # Should either fail validation or be handled safely
        assert response.status_code in [422, 201]
        
        # Test XSS attempt
        xss_data = {
            "email": "test@example.com",
            "password": "password123",
            "full_name": "<script>alert('xss')</script>"
        }
        
        response = client.post("/api/v1/auth/register", json=xss_data)
        # Should be sanitized or rejected
        assert response.status_code in [422, 201]

    def test_session_management_security(self, client, auth_headers):
        """Test session management security"""
        # Test session timeout
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with expired token (would need to create expired token)
        expired_headers = {"Authorization": "Bearer expired_token"}
        response = client.get("/api/v1/auth/me", headers=expired_headers)
        assert response.status_code == 401
        
        # Test logout functionality
        response = client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code in [200, 403]  # 403 if CSRF protection is enabled

class TestDataIntegrityE2E:
    """End-to-end data integrity tests"""
    
    def test_data_consistency_through_workflow(self, client, auth_headers):
        """Test data consistency through complete workflow"""
        # Create test data
        original_data = """id,name,value
1,Alice,100
2,Bob,200
3,Charlie,300"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(original_data)
            f.flush()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("test_data.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 200
        upload_data = response.json()
        file_id = upload_data["file_id"]
        
        # Process data
        job_data = {
            "job_type": "data_cleaning",
            "parameters": {
                "file_id": file_id,
                "cleaning_rules": ["validate_data_types"]
            }
        }
        
        response = client.post(
            "/api/v1/jobs/create",
            json=job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        job_data = response.json()
        job_id = job_data["job_id"]
        
        # Wait for completion
        max_attempts = 30
        for attempt in range(max_attempts):
            response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
            assert response.status_code == 200
            
            status_data = response.json()
            if status_data["status"] in ["completed", "failed"]:
                break
            
            time.sleep(2)
        
        assert status_data["status"] == "completed"
        
        # Verify data integrity
        response = client.get(f"/api/v1/data/results/{file_id}", headers=auth_headers)
        assert response.status_code == 200
        
        results_data = response.json()
        assert "row_count" in results_data
        assert results_data["row_count"] == 3  # Should have 3 rows
        
        # Download and verify processed file
        response = client.get(f"/api/v1/data/download/{file_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify the downloaded content contains the original data
        downloaded_content = response.content.decode('utf-8')
        assert "Alice" in downloaded_content
        assert "Bob" in downloaded_content
        assert "Charlie" in downloaded_content 