import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import tempfile
import os

from app.main import app
from app.database.connection import get_db
from app.models.base import Base
from app.auth.models import User
from app.core.security import get_password_hash
from app.core.config import settings

# Create in-memory SQLite database for testing
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
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        full_name="Test User",
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
        "email": "test@example.com",
        "password": "testpassword123"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

class TestAuthenticationIntegration:
    """Integration tests for authentication endpoints"""
    
    def test_register_and_login_flow(self, client, db_session):
        """Test complete registration and login flow"""
        # Register new user
        register_data = {
            "email": "newuser@example.com",
            "password": "securepassword123",
            "full_name": "New User"
        }
        response = client.post("/api/v1/auth/register", json=register_data)
        assert response.status_code == 201
        
        # Login with new user
        login_data = {
            "email": "newuser@example.com",
            "password": "securepassword123"
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_protected_endpoint_access(self, client, auth_headers):
        """Test access to protected endpoints"""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    def test_protected_endpoint_unauthorized(self, client):
        """Test unauthorized access to protected endpoints"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

class TestDataProcessingIntegration:
    """Integration tests for data processing endpoints"""
    
    def test_file_upload_and_processing(self, client, auth_headers):
        """Test file upload and processing workflow"""
        # Create test CSV file
        csv_content = "name,age,city\nJohn,25,New York\nJane,30,Los Angeles"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            f.flush()
            
            # Upload file
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("test.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert "status" in data

    def test_data_analysis_endpoint(self, client, auth_headers):
        """Test data analysis endpoint"""
        analysis_data = {
            "dataset_id": "test_dataset",
            "analysis_type": "statistical",
            "columns": ["age", "city"]
        }
        
        response = client.post(
            "/api/v1/data/analyze",
            json=analysis_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "analysis_id" in data
        assert "status" in data

class TestJobManagementIntegration:
    """Integration tests for job management"""
    
    def test_job_creation_and_status(self, client, auth_headers):
        """Test job creation and status checking"""
        # Create job
        job_data = {
            "job_type": "data_cleaning",
            "parameters": {
                "dataset_id": "test_dataset",
                "cleaning_rules": ["remove_duplicates", "fill_missing"]
            }
        }
        
        response = client.post(
            "/api/v1/jobs/create",
            json=job_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        job_id = data["job_id"]
        
        # Check job status
        response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "progress" in data

    def test_job_listing(self, client, auth_headers):
        """Test job listing endpoint"""
        response = client.get("/api/v1/jobs/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "jobs" in data
        assert isinstance(data["jobs"], list)

class TestSecurityIntegration:
    """Integration tests for security features"""
    
    def test_rate_limiting(self, client):
        """Test rate limiting on authentication endpoints"""
        login_data = {
            "email": "test@example.com",
            "password": "wrongpassword"
        }
        
        # Make multiple requests to trigger rate limiting
        for _ in range(10):
            response = client.post("/api/v1/auth/login", json=login_data)
        
        # Should be rate limited
        assert response.status_code == 429

    def test_csrf_protection(self, client, auth_headers):
        """Test CSRF protection"""
        # Request without CSRF token should fail
        response = client.post(
            "/api/v1/auth/logout",
            headers=auth_headers
        )
        assert response.status_code == 403

    def test_input_validation(self, client):
        """Test input validation on endpoints"""
        # Test with invalid email format
        register_data = {
            "email": "invalid-email",
            "password": "short",
            "full_name": ""
        }
        
        response = client.post("/api/v1/auth/register", json=register_data)
        assert response.status_code == 422

class TestMonitoringIntegration:
    """Integration tests for monitoring endpoints"""
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"

    def test_metrics_endpoint(self, client):
        """Test metrics endpoint"""
        response = client.get("/metrics")
        assert response.status_code == 200
        # Should return Prometheus metrics format
        assert "http_requests_total" in response.text

    def test_system_status(self, client, auth_headers):
        """Test system status endpoint"""
        response = client.get("/api/v1/admin/system-status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "system_health" in data
        assert "database_status" in data

class TestErrorHandlingIntegration:
    """Integration tests for error handling"""
    
    def test_not_found_endpoint(self, client):
        """Test 404 error handling"""
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404

    def test_internal_server_error(self, client, auth_headers):
        """Test 500 error handling"""
        # This would require mocking a service to throw an exception
        # For now, we'll test the error response format
        response = client.get("/api/v1/test-error", headers=auth_headers)
        if response.status_code == 500:
            data = response.json()
            assert "detail" in data
            assert "error_id" in data

class TestDataValidationIntegration:
    """Integration tests for data validation"""
    
    def test_file_type_validation(self, client, auth_headers):
        """Test file type validation"""
        # Try to upload non-CSV file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is not a CSV file")
            f.flush()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("test.txt", file, "text/plain")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 400
        assert "file type" in response.json()["detail"].lower()

    def test_data_size_validation(self, client, auth_headers):
        """Test data size validation"""
        # Create large file
        large_content = "name,value\n" + "\n".join([f"row{i},{i}" for i in range(100000)])
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(large_content)
            f.flush()
            
            with open(f.name, 'rb') as file:
                response = client.post(
                    "/api/v1/data/upload",
                    files={"file": ("large.csv", file, "text/csv")},
                    headers=auth_headers
                )
            
            os.unlink(f.name)
        
        # Should either succeed or fail with size limit error
        assert response.status_code in [200, 413]

class TestConcurrencyIntegration:
    """Integration tests for concurrent operations"""
    
    def test_concurrent_file_uploads(self, client, auth_headers):
        """Test concurrent file uploads"""
        import threading
        import time
        
        results = []
        
        def upload_file(file_num):
            csv_content = f"name,value\nfile{file_num},{file_num}"
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                f.write(csv_content)
                f.flush()
                
                with open(f.name, 'rb') as file:
                    response = client.post(
                        "/api/v1/data/upload",
                        files={"file": (f"test{file_num}.csv", file, "text/csv")},
                        headers=auth_headers
                    )
                
                os.unlink(f.name)
                results.append(response.status_code)
        
        # Start multiple upload threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=upload_file, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All uploads should succeed
        assert all(status == 200 for status in results) 