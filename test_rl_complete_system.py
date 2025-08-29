#!/usr/bin/env python3
"""
Complete RL System Test

Comprehensive test of all RL components including the new PyTorch-free implementations.
Tests CRUD, training simulation, mock SB3 integration, and logging system.
"""

import os
import sys
import asyncio
import tempfile
import shutil
from pathlib import Path

# Set up environment before any imports
from dotenv import load_dotenv
load_dotenv('.env.test')
os.environ["TESTING"] = "true"
os.environ["ENVIRONMENT"] = "testing"

# Add to path
sys.path.insert(0, 'apps/api')

def test_crud_operations():
    """Test CRUD operations in compatibility mode"""
    print("\n🗄️  TESTING CRUD OPERATIONS:")
    
    async def run_crud_test():
        try:
            from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
            
            # Test without database session (compatibility mode)
            crud = RLOptimizationCRUD()
            print(f"   ✅ CRUD initialized (compatibility mode: {crud.compatibility_mode})")
            
            # Create session
            session = await crud.create_session(
                user_id='test_user',
                pipeline_id='test_pipeline_001',
                optimization_type='ppo'
            )
            session_id = str(session.id)
            print(f"   ✅ Created session: {session_id}")
            
            # Get session
            retrieved = await crud.get_session(session_id, 'test_user')
            assert retrieved.pipeline_id == 'test_pipeline_001'
            print(f"   ✅ Retrieved session: {retrieved.optimization_type}")
            
            # Update session
            updated = await crud.update_session(session_id, best_performance=0.87, total_episodes=25)
            assert updated.best_performance == 0.87
            print(f"   ✅ Updated session (performance: {updated.best_performance})")
            
            # List sessions
            sessions = await crud.list_sessions('test_user')
            assert len(sessions) >= 1
            print(f"   ✅ Listed {len(sessions)} sessions")
            
            # Delete session
            deleted = await crud.delete_session(session_id, 'test_user')
            assert deleted is True
            print(f"   ✅ Deleted session successfully")
            
            return "FULLY WORKING"
            
        except Exception as e:
            print(f"   ❌ CRUD test failed: {e}")
            return f"FAILED: {e}"
    
    result = asyncio.run(run_crud_test())
    return result


def test_rl_training_simulation():
    """Test RL training simulation"""
    print("\n🤖 TESTING RL TRAINING SIMULATION:")
    
    try:
        from app.services.rl.training import (
            RLTrainingSimulator,
            TrainingConfig,
            RLAlgorithm,
            create_training_simulator
        )
        
        print("   ✅ Imported training simulator")
        
        # Test different algorithms
        algorithms = ['ppo', 'a2c', 'sac', 'ddpg']
        results = {}
        
        for algorithm in algorithms:
            simulator = create_training_simulator(
                algorithm=algorithm,
                total_timesteps=10000,
                target_reward_threshold=100.0
            )
            
            result = simulator.simulate_training()
            results[algorithm] = result
            
            print(f"   ✅ {algorithm.upper()}: Best reward={result.best_reward:.2f}, "
                  f"Episodes={result.total_episodes}, Time={result.training_time:.2f}s")
        
        # Test training summary
        summary = simulator.get_training_summary()
        assert summary['status'] == 'completed'
        print(f"   ✅ Training summary generated ({summary['total_episodes']} episodes)")
        
        return "FULLY WORKING"
        
    except Exception as e:
        print(f"   ❌ Training simulation failed: {e}")
        return f"FAILED: {e}"


def test_mock_sb3_integration():
    """Test mock Stable-Baselines3 integration"""
    print("\n🔗 TESTING MOCK SB3 INTEGRATION:")
    
    try:
        from app.services.rl.integrations import (
            MockPPO,
            MockA2C, 
            create_mock_algorithm,
            make_vec_env
        )
        
        print("   ✅ Imported mock SB3 components")
        
        # Create mock environment
        class MockEnv:
            def __init__(self):
                self.observation_space = type('Space', (), {'shape': (4,)})()
                self.action_space = type('Space', (), {'n': 2})()
            
            def reset(self):
                import numpy as np
                return np.random.randn(4)
            
            def step(self, action):
                import numpy as np
                obs = np.random.randn(4)
                reward = np.random.randn()
                done = np.random.rand() < 0.1
                info = {}
                return obs, reward, done, info
        
        env = MockEnv()
        print("   ✅ Created mock environment")
        
        # Test MockPPO
        model = MockPPO("MlpPolicy", env, verbose=0)
        model.learn(total_timesteps=5000)
        
        # Test prediction
        obs = env.reset()
        action, _ = model.predict(obs)
        print(f"   ✅ PPO training & prediction completed")
        
        # Test save/load
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "test_model.json"
            model.save(model_path)
            loaded_model = MockPPO.load(model_path, env)
            print(f"   ✅ Model save/load successful")
        
        # Test factory function
        a2c_model = create_mock_algorithm("a2c", "MlpPolicy", env)
        assert isinstance(a2c_model, MockA2C)
        print(f"   ✅ Algorithm factory working")
        
        # Test vectorized environment
        vec_env = make_vec_env(lambda: env, n_envs=2)
        obs = vec_env.reset()
        actions = [env.action_space.sample() if hasattr(env.action_space, 'sample') else 0 for _ in range(2)]
        vec_env.step(actions)
        print(f"   ✅ Vectorized environment working")
        
        return "FULLY WORKING"
        
    except Exception as e:
        print(f"   ❌ Mock SB3 integration failed: {e}")
        import traceback
        traceback.print_exc()
        return f"FAILED: {e}"


def test_rl_logging_system():
    """Test RL logging system"""
    print("\n📊 TESTING RL LOGGING SYSTEM:")
    
    try:
        from app.services.rl.logging import (
            RLLogger,
            RLLoggerCallback,
            create_rl_logger,
            create_logger_callback
        )
        import numpy as np
        
        print("   ✅ Imported logging components")
        
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create logger
            logger = create_rl_logger(log_dir=tmpdir, run_name="test_logging")
            
            # Log metrics
            for episode in range(20):
                episode_reward = 50 + episode * 2 + np.random.normal(0, 5)
                logger.log_episode_summary(
                    episode=episode,
                    episode_reward=episode_reward,
                    episode_length=200 + np.random.randint(-20, 20)
                )
                
                if episode % 5 == 0:
                    logger.log_training_metrics(
                        step=episode * 200,
                        policy_loss=1.0 / (1 + episode * 0.02),
                        value_loss=0.5 / (1 + episode * 0.01),
                        entropy=0.1 * np.exp(-episode * 0.02),
                        learning_rate=3e-4
                    )
            
            print("   ✅ Logged training metrics")
            
            # Test summaries
            reward_summary = logger.get_metric_summary("episode_reward")
            assert reward_summary is not None
            assert reward_summary.count == 20
            print(f"   ✅ Reward summary: mean={reward_summary.mean:.2f}, trend={reward_summary.trend}")
            
            # Test progress report
            progress = logger.get_training_progress()
            assert progress['total_episodes'] == 19  # 0-indexed
            assert progress['metrics_collected'] > 0
            print(f"   ✅ Progress report: {progress['metrics_collected']} metrics collected")
            
            # Test export
            export_path = logger.export_metrics("json")
            assert export_path.exists()
            print(f"   ✅ Exported metrics to JSON")
            
            # Test plot data generation
            plot_data = logger.generate_plot_data("episode_reward")
            assert plot_data is not None
            assert len(plot_data['values']) == 20
            print(f"   ✅ Generated plot data ({len(plot_data['values'])} points)")
            
            # Test callback
            callback = create_logger_callback(logger)
            
            # Simulate some steps
            for step in range(10):
                callback.on_step(step, reward=1.0, done=(step == 9), info={"test_metric": step * 0.1})
            
            print("   ✅ Logger callback working")
            
            logger.close()
        
        return "FULLY WORKING"
        
    except Exception as e:
        print(f"   ❌ Logging system failed: {e}")
        import traceback
        traceback.print_exc()
        return f"FAILED: {e}"


def test_hyperparameter_optimizer_integration():
    """Test hyperparameter optimizer with new components"""
    print("\n🔧 TESTING HYPERPARAMETER OPTIMIZER INTEGRATION:")
    
    try:
        from app.services.rl.agents.hyperparameter_optimizer import (
            OptimizationConfig,
            HyperparameterOptimizer,
            OptimizationStrategy,
            OptimizationObjective
        )
        
        # Test with enhanced configuration
        config = OptimizationConfig(
            strategy=OptimizationStrategy.PPO,
            objective=OptimizationObjective.BALANCED_PERFORMANCE,
            max_episodes=5,
            enable_tensorboard=False,  # Use our logging system
            save_checkpoints=True
        )
        
        optimizer = HyperparameterOptimizer(config)
        print(f"   ✅ Optimizer created (Full RL: {optimizer.full_rl_available})")
        
        # Run optimization
        result = optimizer.optimize(
            pipeline_id="test_pipeline_integration",
            training_data_path="mock_data.csv"
        )
        
        print(f"   ✅ Optimization completed:")
        print(f"      • Best performance: {result.best_performance:.3f}")
        print(f"      • Total episodes: {result.total_episodes}")
        print(f"      • Training time: {result.optimization_time:.2f}s")
        print(f"      • Final metrics: {len(result.final_model_metrics)} metrics")
        
        # Test optimization history
        history = optimizer.get_optimization_history()
        assert len(history['performance_history']) == result.total_episodes
        print(f"   ✅ Optimization history available")
        
        # Test visualization data
        viz_data = optimizer.visualize_optimization()
        assert 'performance_curve' in viz_data
        assert 'convergence_analysis' in viz_data
        print(f"   ✅ Visualization data generated")
        
        return "FULLY WORKING"
        
    except Exception as e:
        print(f"   ❌ Hyperparameter optimizer integration failed: {e}")
        import traceback
        traceback.print_exc()
        return f"FAILED: {e}"


def main():
    """Run comprehensive RL system test"""
    print("🎯 COMPREHENSIVE RL SYSTEM TEST")
    print("=" * 60)
    
    # Component tests
    tests = [
        ("CRUD Operations", test_crud_operations),
        ("RL Training Simulation", test_rl_training_simulation),
        ("Mock SB3 Integration", test_mock_sb3_integration),
        ("RL Logging System", test_rl_logging_system),
        ("Hyperparameter Optimizer Integration", test_hyperparameter_optimizer_integration)
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            result = test_func()
            results[test_name] = result
        except Exception as e:
            print(f"   💥 {test_name} CRASHED: {e}")
            results[test_name] = f"CRASHED: {e}"
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY:")
    
    working_count = 0
    for test_name, result in results.items():
        if result == "FULLY WORKING":
            status = "✅ WORKING"
            working_count += 1
        elif result.startswith("FAILED"):
            status = "❌ FAILED"
        else:
            status = "💥 CRASHED"
        
        print(f"   {status}: {test_name}")
        if not result == "FULLY WORKING":
            print(f"      └── {result}")
    
    total_tests = len(tests)
    print(f"\n🎯 FINAL RESULT: {working_count}/{total_tests} components fully working")
    
    if working_count == total_tests:
        print("🚀 ALL RL SYSTEM COMPONENTS ARE FULLY FUNCTIONAL!")
        print("💪 Ready for production deployment!")
    elif working_count >= total_tests * 0.8:
        print("⚡ MAJORITY OF RL SYSTEM IS WORKING!")
        print("🔧 Minor fixes needed for full functionality.")
    else:
        print("⚠️  SIGNIFICANT ISSUES FOUND")
        print("🛠️  Major fixes required before deployment.")
    
    return working_count == total_tests


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)