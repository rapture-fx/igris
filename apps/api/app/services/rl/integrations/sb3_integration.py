"""
Mock Stable-Baselines3 Integration

Provides a compatibility layer that mimics Stable-Baselines3 functionality
without requiring PyTorch or the actual SB3 library.
"""

import logging
import numpy as np
from typing import Dict, Any, Optional, Union, Callable
from dataclasses import dataclass, asdict
import json
from datetime import datetime
from pathlib import Path

from ..training.rl_training_simulator import (
    RLTrainingSimulator,
    TrainingConfig, 
    TrainingResult,
    RLAlgorithm
)

logger = logging.getLogger(__name__)


class MockPolicy:
    """Mock policy class that mimics SB3 policy interface"""
    
    def __init__(self, observation_space, action_space, lr_schedule=None):
        self.observation_space = observation_space
        self.action_space = action_space
        self.lr_schedule = lr_schedule or (lambda x: 3e-4)
        
        # Mock policy parameters
        self.policy_net_params = np.random.normal(0, 0.1, 1000)
        self.value_net_params = np.random.normal(0, 0.1, 500)
    
    def predict(self, observation, deterministic=True):
        """Predict action from observation"""
        # Mock prediction based on observation
        if hasattr(self.action_space, 'n'):  # Discrete
            action = np.random.randint(0, self.action_space.n)
        else:  # Continuous
            action = np.random.uniform(-1, 1, self.action_space.shape)
        
        return action, None
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get policy parameters for serialization"""
        return {
            "policy_params_mean": float(np.mean(self.policy_net_params)),
            "policy_params_std": float(np.std(self.policy_net_params)),
            "value_params_mean": float(np.mean(self.value_net_params)),
            "value_params_std": float(np.std(self.value_net_params)),
            "total_parameters": len(self.policy_net_params) + len(self.value_net_params)
        }


class MockCallback:
    """Mock callback class that mimics SB3 callback interface"""
    
    def __init__(self, verbose=0):
        self.verbose = verbose
        self.num_timesteps = 0
        self.training_env = None
        self.logger = None
        self.locals = {}
        self.globals = {}
    
    def init_callback(self, model):
        """Initialize callback"""
        self.model = model
        return True
    
    def on_training_start(self, locals_, globals_):
        """Called at training start"""
        pass
    
    def on_rollout_start(self):
        """Called at rollout start"""
        pass
    
    def on_step(self) -> bool:
        """Called at each step"""
        return True
    
    def on_rollout_end(self):
        """Called at rollout end"""
        pass
    
    def on_training_end(self):
        """Called at training end"""
        pass


class MockBaseAlgorithm:
    """Base class for mock RL algorithms"""
    
    def __init__(self, policy, env, learning_rate=3e-4, verbose=0, **kwargs):
        self.policy = policy
        self.env = env
        self.learning_rate = learning_rate
        self.verbose = verbose
        self.kwargs = kwargs
        
        # Training state
        self.num_timesteps = 0
        self._episode_num = 0
        self.start_time = None
        
        # Mock model components
        if hasattr(env, 'observation_space') and hasattr(env, 'action_space'):
            self.policy_instance = MockPolicy(env.observation_space, env.action_space)
        else:
            self.policy_instance = None
        
        # Training simulator
        self.training_simulator = None
        
        logger.info(f"Initialized mock {self.__class__.__name__}")
    
    def learn(self, total_timesteps: int, 
              callback=None, 
              log_interval=10,
              eval_env=None,
              eval_freq=-1,
              n_eval_episodes=5,
              tb_log_name="run",
              eval_log_path=None,
              reset_num_timesteps=True,
              **kwargs) -> "MockBaseAlgorithm":
        """Mock learning process using training simulator"""
        
        if reset_num_timesteps:
            self.num_timesteps = 0
            self._episode_num = 0
        
        # Setup training simulator
        algorithm_name = self.__class__.__name__.lower().replace('mock', '')
        config = TrainingConfig(
            algorithm=RLAlgorithm(algorithm_name),
            total_timesteps=total_timesteps,
            learning_rate=self.learning_rate
        )
        
        self.training_simulator = RLTrainingSimulator(config)
        
        # Progress callback
        def progress_callback(metrics):
            self.num_timesteps = metrics.timestep
            self._episode_num = metrics.episode
            
            if callback and hasattr(callback, 'on_step'):
                callback.locals = {
                    'reward': metrics.reward_mean,
                    'done': False,
                    'info': {'episode_reward': metrics.reward_mean}
                }
                callback.num_timesteps = self.num_timesteps
                callback.on_step()
            
            if self.verbose > 0 and metrics.episode % log_interval == 0:
                logger.info(f"Episode {metrics.episode}: Reward={metrics.reward_mean:.2f}, "
                           f"Phase={metrics.phase.value}")
        
        # Run simulation
        self.start_time = datetime.now()
        training_result = self.training_simulator.simulate_training(
            progress_callback=progress_callback
        )
        
        if self.verbose > 0:
            logger.info(f"Training completed. Best reward: {training_result.best_reward:.2f}")
        
        return self
    
    def predict(self, observation, deterministic=True, **kwargs):
        """Predict action from observation"""
        if self.policy_instance:
            return self.policy_instance.predict(observation, deterministic)
        else:
            # Fallback random action
            return np.array([0]), None
    
    def save(self, path: Union[str, Path], **kwargs):
        """Save model to path"""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create mock save data
        save_data = {
            "algorithm": self.__class__.__name__,
            "learning_rate": self.learning_rate,
            "num_timesteps": self.num_timesteps,
            "episode_num": self._episode_num,
            "kwargs": self.kwargs,
            "policy_params": self.policy_instance.get_parameters() if self.policy_instance else {},
            "training_summary": self.training_simulator.get_training_summary() if self.training_simulator else {},
            "saved_at": datetime.now().isoformat()
        }
        
        with open(path, 'w') as f:
            json.dump(save_data, f, indent=2)
        
        logger.info(f"Saved mock model to {path}")
    
    @classmethod
    def load(cls, path: Union[str, Path], env=None, **kwargs):
        """Load model from path"""
        path = Path(path)
        
        if not path.exists():
            raise FileNotFoundError(f"No model found at {path}")
        
        with open(path, 'r') as f:
            save_data = json.load(f)
        
        # Create instance
        instance = cls(
            policy="MlpPolicy",  # Mock policy
            env=env,
            learning_rate=save_data.get("learning_rate", 3e-4),
            **save_data.get("kwargs", {})
        )
        
        instance.num_timesteps = save_data.get("num_timesteps", 0)
        instance._episode_num = save_data.get("episode_num", 0)
        
        logger.info(f"Loaded mock model from {path}")
        return instance
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get algorithm parameters"""
        return {
            "algorithm": self.__class__.__name__,
            "learning_rate": self.learning_rate,
            "num_timesteps": self.num_timesteps,
            "episode_num": self._episode_num,
            "policy_params": self.policy_instance.get_parameters() if self.policy_instance else {}
        }
    
    def set_parameters(self, params: Dict[str, Any]):
        """Set algorithm parameters"""
        if "learning_rate" in params:
            self.learning_rate = params["learning_rate"]
        if "num_timesteps" in params:
            self.num_timesteps = params["num_timesteps"]
        # Note: In real SB3, this would update neural network parameters
        logger.info("Updated mock algorithm parameters")


class MockPPO(MockBaseAlgorithm):
    """Mock PPO algorithm"""
    
    def __init__(self, policy, env, learning_rate=3e-4, n_steps=2048, batch_size=64,
                 n_epochs=10, gamma=0.99, gae_lambda=0.95, clip_range=0.2, **kwargs):
        super().__init__(policy, env, learning_rate, **kwargs)
        self.n_steps = n_steps
        self.batch_size = batch_size
        self.n_epochs = n_epochs
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.clip_range = clip_range


class MockA2C(MockBaseAlgorithm):
    """Mock A2C algorithm"""
    
    def __init__(self, policy, env, learning_rate=7e-4, n_steps=5, gamma=0.99,
                 gae_lambda=1.0, ent_coef=0.0, vf_coef=0.25, **kwargs):
        super().__init__(policy, env, learning_rate, **kwargs)
        self.n_steps = n_steps
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.ent_coef = ent_coef
        self.vf_coef = vf_coef


class MockSAC(MockBaseAlgorithm):
    """Mock SAC algorithm"""
    
    def __init__(self, policy, env, learning_rate=3e-4, buffer_size=1000000,
                 batch_size=256, tau=0.005, gamma=0.99, **kwargs):
        super().__init__(policy, env, learning_rate, **kwargs)
        self.buffer_size = buffer_size
        self.batch_size = batch_size
        self.tau = tau
        self.gamma = gamma


class MockDDPG(MockBaseAlgorithm):
    """Mock DDPG algorithm"""
    
    def __init__(self, policy, env, learning_rate=1e-3, buffer_size=1000000,
                 batch_size=100, tau=0.005, gamma=0.99, **kwargs):
        super().__init__(policy, env, learning_rate, **kwargs)
        self.buffer_size = buffer_size
        self.batch_size = batch_size
        self.tau = tau
        self.gamma = gamma


# Factory function to create algorithms
def create_mock_algorithm(algorithm_name: str, policy: str, env, **kwargs) -> MockBaseAlgorithm:
    """Factory function to create mock RL algorithms"""
    algorithm_map = {
        'ppo': MockPPO,
        'a2c': MockA2C,
        'sac': MockSAC,
        'ddpg': MockDDPG
    }
    
    algorithm_class = algorithm_map.get(algorithm_name.lower())
    if not algorithm_class:
        raise ValueError(f"Unknown algorithm: {algorithm_name}")
    
    return algorithm_class(policy, env, **kwargs)


# Mock environment utilities
def make_vec_env(env_fn, n_envs=1, **kwargs):
    """Mock vectorized environment creation"""
    class MockVecEnv:
        def __init__(self, env_fn, n_envs):
            self.env_fn = env_fn
            self.n_envs = n_envs
            self.envs = [env_fn() for _ in range(n_envs)]
            
            # Set spaces from first environment
            if self.envs:
                self.observation_space = getattr(self.envs[0], 'observation_space', None)
                self.action_space = getattr(self.envs[0], 'action_space', None)
        
        def reset(self):
            return np.array([env.reset() if hasattr(env, 'reset') else np.zeros(4) for env in self.envs])
        
        def step(self, actions):
            results = []
            for env, action in zip(self.envs, actions):
                if hasattr(env, 'step'):
                    results.append(env.step(action))
                else:
                    # Mock step result
                    obs = np.random.randn(4)
                    reward = np.random.randn()
                    done = np.random.rand() < 0.01
                    info = {}
                    results.append((obs, reward, done, info))
            
            obs, rewards, dones, infos = zip(*results)
            return np.array(obs), np.array(rewards), np.array(dones), list(infos)
    
    return MockVecEnv(env_fn, n_envs)


# Example usage
if __name__ == "__main__":
    # Test mock SB3 integration
    class MockEnv:
        def __init__(self):
            self.observation_space = type('Space', (), {'shape': (4,)})()
            self.action_space = type('Space', (), {'n': 2})()
        
        def reset(self):
            return np.random.randn(4)
        
        def step(self, action):
            obs = np.random.randn(4)
            reward = np.random.randn()
            done = np.random.rand() < 0.01
            info = {}
            return obs, reward, done, info
    
    # Test PPO
    env = MockEnv()
    model = MockPPO("MlpPolicy", env, verbose=1)
    
    # Train
    model.learn(total_timesteps=10000)
    
    # Save and load
    model.save("test_model.json")
    loaded_model = MockPPO.load("test_model.json", env)
    
    # Predict
    obs = env.reset()
    action, _ = loaded_model.predict(obs)
    print(f"Predicted action: {action}")
    
    print("Mock SB3 integration test completed successfully!")