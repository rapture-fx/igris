import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt

from app.main import app
from app.auth.dependencies import get_current_user, get_current_active_user
from app.auth.models import User, UserSession, APIKey
from app.auth.schemas import UserCreate, UserLogin, PasswordResetRequest
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.config import settings

client = TestClient(app)

class TestAuthentication:
    """Test authentication functionality"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User",
            "is_active": True,
            "is_verified": True
        }
    
    @pytest.fixture
    def sample_user(self, sample_user_data):
        """Create a sample user object"""
        user = User(
            id=1,
            email=sample_user_data["email"],
            hashed_password=get_password_hash(sample_user_data["password"]),
            full_name=sample_user_data["full_name"],
            is_active=sample_user_data["is_active"],
            is_verified=sample_user_data["is_verified"],
            created_at=datetime.utcnow()
        )
        return user

    def test_user_registration_success(self, mock_db):
        """Test successful user registration"""
        user_data = {
            "email": "newuser@example.com",
            "password": "securepassword123",
            "full_name": "New User"
        }
        
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'add') as mock_add:
                with patch.object(mock_db, 'commit') as mock_commit:
                    with patch.object(mock_db, 'refresh') as mock_refresh:
                        response = client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert "id" in data
        assert "password" not in data

    def test_user_registration_duplicate_email(self, mock_db, sample_user):
        """Test user registration with duplicate email"""
        user_data = {
            "email": sample_user.email,
            "password": "securepassword123",
            "full_name": "Another User"
        }
        
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = sample_user
                response = client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 400
        assert "email already registered" in response.json()["detail"]

    def test_user_login_success(self, mock_db, sample_user):
        """Test successful user login"""
        login_data = {
            "email": sample_user.email,
            "password": "testpassword123"
        }
        
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = sample_user
                response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"

    def test_user_login_invalid_credentials(self, mock_db):
        """Test user login with invalid credentials"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = None
                response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_password_reset_request(self, mock_db, sample_user):
        """Test password reset request"""
        reset_data = {"email": sample_user.email}
        
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = sample_user
                with patch('app.auth.email.send_password_reset_email') as mock_send_email:
                    response = client.post("/api/v1/auth/password-reset-request", json=reset_data)
        
        assert response.status_code == 200
        assert "Password reset email sent" in response.json()["message"]

    def test_get_current_user_valid_token(self, mock_db, sample_user):
        """Test getting current user with valid token"""
        token = create_access_token(data={"sub": str(sample_user.id)})
        
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = sample_user
                user = get_current_user(token, mock_db)
        
        assert user.id == sample_user.id
        assert user.email == sample_user.email

    def test_get_current_user_invalid_token(self, mock_db):
        """Test getting current user with invalid token"""
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with pytest.raises(Exception):
                get_current_user("invalid_token", mock_db)

    def test_get_current_active_user(self, sample_user):
        """Test getting current active user"""
        active_user = get_current_active_user(sample_user)
        assert active_user.id == sample_user.id

    def test_get_current_active_user_inactive(self):
        """Test getting current user when user is inactive"""
        inactive_user = User(
            id=1,
            email="inactive@example.com",
            hashed_password="hashed",
            is_active=False
        )
        
        with pytest.raises(Exception):
            get_current_active_user(inactive_user)

    def test_api_key_creation(self, mock_db, sample_user):
        """Test API key creation"""
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'add') as mock_add:
                with patch.object(mock_db, 'commit') as mock_commit:
                    with patch.object(mock_db, 'refresh') as mock_refresh:
                        response = client.post(
                            "/api/v1/auth/api-keys",
                            headers={"Authorization": f"Bearer {create_access_token(data={'sub': str(sample_user.id)})}"},
                            json={"name": "Test API Key"}
                        )
        
        assert response.status_code == 201
        data = response.json()
        assert "key" in data
        assert data["name"] == "Test API Key"

    def test_two_factor_authentication_setup(self, mock_db, sample_user):
        """Test 2FA setup"""
        with patch('app.auth.dependencies.get_db', return_value=mock_db):
            with patch.object(mock_db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = sample_user
                with patch('app.auth.two_factor.generate_totp_secret') as mock_generate:
                    mock_generate.return_value = "test_secret"
                    response = client.post(
                        "/api/v1/auth/2fa/setup",
                        headers={"Authorization": f"Bearer {create_access_token(data={'sub': str(sample_user.id)})}"}
                    )
        
        assert response.status_code == 200
        data = response.json()
        assert "qr_code" in data
        assert "secret" in data

class TestSecurity:
    """Test security functionality"""
    
    def test_password_hashing(self):
        """Test password hashing and verification"""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert verify_password(password, hashed)
        assert not verify_password("wrongpassword", hashed)

    def test_access_token_creation(self, sample_user):
        """Test access token creation"""
        token = create_access_token(data={"sub": str(sample_user.id)})
        
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_expiration(self):
        """Test token expiration"""
        # Create token with short expiration
        token = create_access_token(
            data={"sub": "1"},
            expires_delta=timedelta(seconds=1)
        )
        
        # Wait for expiration
        import time
        time.sleep(2)
        
        # Token should be expired
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

class TestSessionManagement:
    """Test session management"""
    
    def test_session_creation(self, mock_db, sample_user):
        """Test session creation"""
        session_data = {
            "user_id": sample_user.id,
            "token": "test_session_token",
            "expires_at": datetime.utcnow() + timedelta(hours=24)
        }
        
        session = UserSession(**session_data)
        assert session.user_id == sample_user.id
        assert session.token == "test_session_token"

    def test_session_expiration(self):
        """Test session expiration"""
        expired_session = UserSession(
            user_id=1,
            token="expired_token",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )
        
        assert expired_session.is_expired()

class TestAPIKeyManagement:
    """Test API key management"""
    
    def test_api_key_creation(self):
        """Test API key creation"""
        api_key = APIKey(
            user_id=1,
            name="Test Key",
            key_hash="hashed_key",
            is_active=True
        )
        
        assert api_key.user_id == 1
        assert api_key.name == "Test Key"
        assert api_key.is_active

    def test_api_key_deactivation(self):
        """Test API key deactivation"""
        api_key = APIKey(
            user_id=1,
            name="Test Key",
            key_hash="hashed_key",
            is_active=True
        )
        
        api_key.is_active = False
        assert not api_key.is_active 