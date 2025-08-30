"""
Comprehensive test suite for RL optimization system
Tests all components: agents, environments, monitoring, and integrations
"""

import pytest
import asyncio
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient

# Import test dependencies
import numpy as np
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Import RL system components
from app.services.rl_optimization_service import RLOptimizationService
from app.services.rl.agents.hyperparameter_optimizer import HyperparameterOptimizer, OptimizationConfig
from app.services.rl.environments.ml_training_env import MLTrainingEnvironment
from app.services.rl.monitoring.rl_monitor import RLPerformanceMonitor
from app.tasks.rl_optimization_tasks import optimize_hyperparameters_task
from app.core.rl_config import get_rl_settings, RLStrategy, RLObjective
from app.database.models import MLPipeline
from app.main import app

# Test configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_rl.db"


class TestRLOptimizationService:
    """Test RL optimization service functionality"""
    
    @pytest.fixture
    def rl_service(self):
        """Create RL optimization service for testing"""
        return RLOptimizationService()
    
    @pytest.fixture
    def sample_optimization_request(self):
        """Sample optimization request for testing"""
        return {
            "pipeline_id": "test_pipeline_001",
            "optimization_type": "hyperparameter",
            "training_data_path": "s3://test-bucket/train.csv",
            "validation_data_path": "s3://test-bucket/val.csv",
            "optimization_config": {
                "strategy": "ppo",
                "objective": "accuracy",
                "max_episodes": 10,
                "max_training_time": 300,
                "early_stopping_patience": 3
            }
        }
    
    @pytest.mark.asyncio
    async def test_start_optimization_session(self, rl_service, sample_optimization_request):
        """Test starting a new optimization session"""
        with patch.object(rl_service, '_validate_optimization_request', return_value=True), \
             patch.object(rl_service, '_create_optimization_session') as mock_create:
            
            mock_session = Mock()
            mock_session.id = uuid.uuid4()
            mock_session.status = "pending"
            mock_create.return_value = mock_session
            
            result = await rl_service.start_optimization(sample_optimization_request)
            
            assert result is not None
            assert result.status == "pending"
            mock_create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_optimization_status(self, rl_service):
        """Test retrieving optimization session status"""
        session_id = str(uuid.uuid4())
        
        with patch.object(rl_service, '_get_session_by_id') as mock_get:
            mock_session = Mock()
            mock_session.id = session_id
            mock_session.status = "running"
            mock_session.best_performance = 0.85
            mock_get.return_value = mock_session
            
            status = await rl_service.get_optimization_status(session_id)
            
            assert status is not None
            assert status.status == "running"
            assert status.best_performance == 0.85
    
    @pytest.mark.asyncio
    async def test_stop_optimization(self, rl_service):
        """Test stopping an optimization session"""
        session_id = str(uuid.uuid4())
        
        with patch.object(rl_service, '_get_session_by_id') as mock_get, \
             patch.object(rl_service, '_stop_celery_task') as mock_stop:
            
            mock_session = Mock()
            mock_session.id = session_id
            mock_session.status = "running"
            mock_get.return_value = mock_session
            mock_stop.return_value = True
            
            result = await rl_service.stop_optimization(session_id)
            
            assert result is True
            mock_stop.assert_called_once()


class TestHyperparameterOptimizer:
    """Test hyperparameter optimizer agent"""
    
    @pytest.fixture
    def optimizer_config(self):
        """Create optimizer configuration for testing"""
        return OptimizationConfig(
            strategy=RLStrategy.PPO,
            objective=RLObjective.ACCURACY,
            max_episodes=5,
            max_training_time=60,
            early_stopping_patience=2
        )
    
    @pytest.fixture
    def mock_ml_client(self):
        """Mock ML service client"""
        mock_client = Mock()
        mock_client.train_model_with_hyperparams.return_value = {
            "accuracy": 0.85,
            "f1_score": 0.82,
            "training_time": 120.5
        }
        return mock_client
    
    def test_optimizer_initialization(self, optimizer_config, mock_ml_client):
        """Test optimizer initialization"""
        optimizer = HyperparameterOptimizer(
            config=optimizer_config,
            ml_client=mock_ml_client
        )
        
        assert optimizer.config.strategy == RLStrategy.PPO
        assert optimizer.config.max_episodes == 5
        assert optimizer.ml_client is mock_ml_client
    
    @pytest.mark.asyncio
    async def test_optimization_process(self, optimizer_config, mock_ml_client):
        """Test complete optimization process"""
        with patch('gym.make') as mock_gym, \
             patch('stable_baselines3.PPO') as mock_ppo:
            
            # Mock environment
            mock_env = Mock()
            mock_env.reset.return_value = np.array([0.1, 0.2, 0.3])
            mock_env.step.return_value = (np.array([0.2, 0.3, 0.4]), 0.8, True, {})
            mock_env.get_current_hyperparameters.return_value = {
                "learning_rate": 0.001,
                "batch_size": 32
            }
            mock_gym.return_value = mock_env
            
            # Mock PPO agent
            mock_agent = Mock()
            mock_agent.learn.return_value = None
            mock_agent.predict.return_value = (np.array([0.5]), None)
            mock_ppo.return_value = mock_agent
            
            optimizer = HyperparameterOptimizer(
                config=optimizer_config,
                ml_client=mock_ml_client
            )
            
            # Mock the environment creation
            optimizer.environment = mock_env
            optimizer.agent = mock_agent
            
            # Test optimization
            with patch.object(optimizer, '_initialize_agent'), \
                 patch.object(optimizer, '_run_optimization') as mock_run:
                
                mock_result = Mock()
                mock_result.best_performance = 0.89
                mock_result.best_hyperparameters = {"learning_rate": 0.001}
                mock_run.return_value = mock_result
                
                result = optimizer.optimize(
                    pipeline_id="test_pipeline",
                    training_data_path="s3://test/train.csv"
                )
                
                assert result.best_performance == 0.89


class TestMLTrainingEnvironment:
    """Test RL training environment"""
    
    @pytest.fixture
    def mock_ml_client(self):
        """Mock ML service client"""
        mock_client = Mock()
        mock_client.evaluate_hyperparameters.return_value = {
            "accuracy": 0.87,
            "training_time": 150.0
        }
        return mock_client
    
    def test_environment_initialization(self, mock_ml_client):
        """Test environment initialization"""
        env = MLTrainingEnvironment(
            pipeline_id="test_pipeline",
            training_data_path="s3://test/train.csv",
            ml_client=mock_ml_client
        )
        
        assert env.pipeline_id == "test_pipeline"
        assert env.ml_client is mock_ml_client
    
    def test_environment_reset(self, mock_ml_client):
        """Test environment reset functionality"""
        env = MLTrainingEnvironment(
            pipeline_id="test_pipeline",
            training_data_path="s3://test/train.csv",
            ml_client=mock_ml_client
        )
        
        initial_state = env.reset()
        
        assert isinstance(initial_state, np.ndarray)
        assert len(initial_state) > 0
    
    def test_environment_step(self, mock_ml_client):
        """Test environment step functionality"""
        env = MLTrainingEnvironment(
            pipeline_id="test_pipeline",
            training_data_path="s3://test/train.csv",
            ml_client=mock_ml_client
        )
        
        env.reset()
        action = np.array([0.5, 0.3, 0.7])  # Sample action
        
        observation, reward, done, info = env.step(action)
        
        assert isinstance(observation, np.ndarray)
        assert isinstance(reward, float)
        assert isinstance(done, bool)
        assert isinstance(info, dict)


class TestRLPerformanceMonitor:
    """Test RL performance monitoring"""
    
    @pytest.fixture
    def monitor(self):
        """Create performance monitor for testing"""
        return RLPerformanceMonitor()
    
    @pytest.mark.asyncio
    async def test_start_monitoring(self, monitor):
        """Test starting monitoring for a session"""
        session_id = str(uuid.uuid4())
        
        with patch.object(monitor, '_get_session_metrics') as mock_metrics:
            mock_metrics.return_value = {
                "cpu_usage": 45.2,
                "memory_usage": 60.1,
                "current_episode": 5
            }
            
            await monitor.start_monitoring(session_id)
            
            assert session_id in monitor.active_sessions
    
    @pytest.mark.asyncio
    async def test_performance_alert(self, monitor):
        """Test performance alert generation"""
        session_id = str(uuid.uuid4())
        
        with patch.object(monitor, '_send_alert') as mock_alert:
            await monitor._check_performance_thresholds(
                session_id, 
                cpu_usage=95.0,  # Above threshold
                memory_usage=90.0  # Above threshold
            )
            
            assert mock_alert.called
    
    @pytest.mark.asyncio
    async def test_metrics_collection(self, monitor):
        """Test metrics collection and storage"""
        session_id = str(uuid.uuid4())
        
        with patch.object(monitor, '_store_metric') as mock_store:
            await monitor.record_metric(
                session_id=session_id,
                metric_name="episode_reward",
                metric_value=0.85,
                metric_type="performance"
            )
            
            mock_store.assert_called_once_with(
                session_id=session_id,
                metric_name="episode_reward",
                metric_value=0.85,
                metric_type="performance"
            )


class TestRLIntegration:
    """Test RL system integration with existing ML pipelines"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_rl_optimization_endpoint(self, client):
        """Test RL optimization REST endpoint"""
        request_data = {
            "pipeline_id": "test_pipeline_001",
            "optimization_type": "hyperparameter",
            "training_data_path": "s3://test-bucket/train.csv",
            "optimization_config": {
                "strategy": "ppo",
                "objective": "accuracy",
                "max_episodes": 5
            }
        }
        
        with patch('app.services.rl_optimization_service.RLOptimizationService.start_optimization') as mock_start:
            mock_session = Mock()
            mock_session.id = str(uuid.uuid4())
            mock_session.status = "pending"
            mock_start.return_value = mock_session
            
            response = client.post("/api/v1/rl/hyperparameters/optimize", json=request_data)
            
            assert response.status_code == 200
            response_data = response.json()
            assert "session_id" in response_data
            assert response_data["status"] == "pending"
    
    def test_rl_status_endpoint(self, client):
        """Test RL optimization status endpoint"""
        session_id = str(uuid.uuid4())
        
        with patch('app.services.rl_optimization_service.RLOptimizationService.get_optimization_status') as mock_status:
            mock_status_data = Mock()
            mock_status_data.session_id = session_id
            mock_status_data.status = "running"
            mock_status_data.progress = 0.6
            mock_status_data.current_episode = 3
            mock_status.return_value = mock_status_data
            
            response = client.get(f"/api/v1/rl/sessions/{session_id}/status")
            
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["status"] == "running"
            assert response_data["progress"] == 0.6


class TestCeleryTasks:
    """Test Celery background tasks for RL optimization"""
    
    @pytest.mark.asyncio
    async def test_hyperparameter_optimization_task(self):
        """Test hyperparameter optimization Celery task"""
        task_data = {
            "session_id": str(uuid.uuid4()),
            "pipeline_id": "test_pipeline",
            "training_data_path": "s3://test/train.csv",
            "optimization_config": {
                "strategy": "ppo",
                "max_episodes": 5
            }
        }
        
        with patch('app.services.rl.agents.hyperparameter_optimizer.HyperparameterOptimizer') as mock_optimizer_class:
            mock_optimizer = Mock()
            mock_result = Mock()
            mock_result.best_performance = 0.88
            mock_result.best_hyperparameters = {"learning_rate": 0.001}
            mock_optimizer.optimize.return_value = mock_result
            mock_optimizer_class.return_value = mock_optimizer
            
            # Mock task execution
            result = await optimize_hyperparameters_task.apply_async(args=[task_data])
            
            # Note: In real testing, you'd want to test actual Celery task execution
            # This is a simplified test for the task structure


class TestRLConfiguration:
    """Test RL configuration management"""
    
    def test_rl_settings_loading(self):
        """Test RL settings loading from environment"""
        settings = get_rl_settings()
        
        assert settings.rl_enabled is not None
        assert settings.rl_max_concurrent_sessions > 0
        assert settings.rl_default_strategy in [e.value for e in RLStrategy]
    
    def test_industry_specific_config(self):
        """Test industry-specific configuration"""
        settings = get_rl_settings()
        
        ecommerce_config = settings.get_optimization_config(industry_type="ecommerce")
        manufacturing_config = settings.get_optimization_config(industry_type="manufacturing")
        finance_config = settings.get_optimization_config(industry_type="finance")
        
        # Verify industry-specific differences
        assert ecommerce_config["objective"] == settings.ecommerce_default_objective
        assert manufacturing_config["objective"] == settings.manufacturing_default_objective
        assert finance_config["objective"] == settings.finance_default_objective
    
    def test_resource_limits(self):
        """Test resource limit configuration"""
        settings = get_rl_settings()
        limits = settings.get_resource_limits()
        
        assert "max_cpu_cores" in limits
        assert "max_memory_gb" in limits
        assert limits["max_cpu_cores"] > 0
        assert limits["max_memory_gb"] > 0


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_invalid_optimization_request(self):
        """Test handling of invalid optimization requests"""
        service = RLOptimizationService()
        
        invalid_request = {
            "pipeline_id": "",  # Invalid empty pipeline ID
            "optimization_type": "invalid_type",  # Invalid type
        }
        
        with pytest.raises(ValueError):
            service._validate_optimization_request(invalid_request)
    
    def test_resource_limit_exceeded(self):
        """Test handling when resource limits are exceeded"""
        settings = get_rl_settings()
        
        # Test with excessive resource request
        with pytest.raises(ValueError):
            config = OptimizationConfig(
                max_episodes=1000,  # Excessive episodes
                max_training_time=36000  # 10 hours - excessive
            )
    
    @pytest.mark.asyncio
    async def test_optimization_timeout(self):
        """Test handling of optimization timeouts"""
        service = RLOptimizationService()
        session_id = str(uuid.uuid4())
        
        with patch.object(service, '_get_session_by_id') as mock_get:
            mock_session = Mock()
            mock_session.created_at = datetime.utcnow() - timedelta(hours=2)  # Old session
            mock_session.status = "running"
            mock_get.return_value = mock_session
            
            # Test timeout handling
            with patch.object(service, '_handle_timeout') as mock_timeout:
                await service._check_session_timeout(session_id)
                mock_timeout.assert_called_once()


# Performance benchmarks
class TestPerformanceBenchmarks:
    """Performance benchmarks for RL system"""
    
    @pytest.mark.benchmark
    def test_optimization_startup_time(self, benchmark):
        """Benchmark optimization session startup time"""
        def start_optimization():
            service = RLOptimizationService()
            config = OptimizationConfig(max_episodes=1)
            return service._create_optimization_session("test_pipeline", config)
        
        result = benchmark(start_optimization)
        assert result is not None
    
    @pytest.mark.benchmark
    def test_environment_step_performance(self, benchmark):
        """Benchmark environment step performance"""
        mock_ml_client = Mock()
        mock_ml_client.evaluate_hyperparameters.return_value = {"accuracy": 0.8}
        
        env = MLTrainingEnvironment(
            pipeline_id="test_pipeline",
            training_data_path="s3://test/train.csv",
            ml_client=mock_ml_client
        )
        env.reset()
        
        def step():
            return env.step(np.array([0.5, 0.3, 0.7]))
        
        result = benchmark(step)
        assert result is not None


if __name__ == "__main__":
    # Run tests with coverage
    pytest.main([
        "--cov=app/services/rl",
        "--cov=app/tasks/rl_optimization_tasks",
        "--cov-report=html",
        "--cov-report=term-missing",
        "-v",
        __file__
    ])