"""
RL Optimization API for Schlep-engine Python SDK
Provides interfaces for reinforcement learning optimization services
"""

from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import asyncio
import time

from .base import BaseAPI
from ..models.rl_optimization import (
    RLOptimizationRequest,
    RLOptimizationSession,
    RLOptimizationStatus,
    RLSessionMetrics,
    RLStrategy,
    RLObjective,
    OptimizationResult
)
from ..exceptions.base import SchlepEngineError


class RLOptimizationAPI(BaseAPI):
    """
    RL Optimization API client for hyperparameter optimization, 
    resource allocation, and performance tuning
    """
    
    def __init__(self, client):
        super().__init__(client)
        self.base_url = f"{self.client.base_url}/api/v1/rl"
    
    async def start_hyperparameter_optimization(
        self,
        pipeline_id: str,
        training_data_path: str,
        validation_data_path: Optional[str] = None,
        strategy: Union[str, RLStrategy] = RLStrategy.PPO,
        objective: Union[str, RLObjective] = RLObjective.BALANCED_PERFORMANCE,
        max_episodes: int = 50,
        max_training_time: int = 3600,
        early_stopping_patience: int = 10,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> RLOptimizationSession:
        """
        Start hyperparameter optimization using RL
        
        Args:
            pipeline_id: ID of the ML pipeline to optimize
            training_data_path: Path to training data
            validation_data_path: Path to validation data (optional)
            strategy: RL strategy to use (PPO, A2C, SAC, DDPG)
            objective: Optimization objective (accuracy, f1_score, etc.)
            max_episodes: Maximum number of training episodes
            max_training_time: Maximum training time in seconds
            early_stopping_patience: Episodes to wait before early stopping
            custom_config: Additional custom configuration
            
        Returns:
            RLOptimizationSession with session details
        """
        
        # Convert enum to string if needed
        if isinstance(strategy, RLStrategy):
            strategy = strategy.value
        if isinstance(objective, RLObjective):
            objective = objective.value
        
        request_data = {
            "pipeline_id": pipeline_id,
            "optimization_type": "hyperparameter",
            "training_data_path": training_data_path,
            "validation_data_path": validation_data_path,
            "optimization_config": {
                "strategy": strategy,
                "objective": objective,
                "max_episodes": max_episodes,
                "max_training_time": max_training_time,
                "early_stopping_patience": early_stopping_patience,
                **(custom_config or {})
            }
        }
        
        response = await self._post(
            f"{self.base_url}/hyperparameters/optimize",
            json=request_data
        )
        
        return RLOptimizationSession.from_dict(response)
    
    async def start_resource_allocation_optimization(
        self,
        pipeline_configs: List[Dict[str, Any]],
        resource_constraints: Dict[str, Any],
        strategy: Union[str, RLStrategy] = RLStrategy.PPO,
        optimization_objective: str = "cost_efficiency"
    ) -> RLOptimizationSession:
        """
        Start resource allocation optimization using RL
        
        Args:
            pipeline_configs: List of pipeline configurations with resource requirements
            resource_constraints: Available resource constraints
            strategy: RL strategy to use
            optimization_objective: Optimization objective for resource allocation
            
        Returns:
            RLOptimizationSession with session details
        """
        
        if isinstance(strategy, RLStrategy):
            strategy = strategy.value
        
        request_data = {
            "optimization_type": "resource_allocation",
            "pipeline_configs": pipeline_configs,
            "resource_constraints": resource_constraints,
            "optimization_config": {
                "strategy": strategy,
                "objective": optimization_objective,
                "max_episodes": 30,
                "max_training_time": 1800
            }
        }
        
        response = await self._post(
            f"{self.base_url}/resource-allocation/optimize",
            json=request_data
        )
        
        return RLOptimizationSession.from_dict(response)
    
    async def get_session_status(
        self, 
        session_id: str
    ) -> RLOptimizationStatus:
        """
        Get status of an RL optimization session
        
        Args:
            session_id: ID of the optimization session
            
        Returns:
            RLOptimizationStatus with current session status
        """
        
        response = await self._get(f"{self.base_url}/sessions/{session_id}/status")
        return RLOptimizationStatus.from_dict(response)
    
    async def get_session_metrics(
        self,
        session_id: str,
        include_episodes: bool = True
    ) -> RLSessionMetrics:
        """
        Get detailed metrics for an RL optimization session
        
        Args:
            session_id: ID of the optimization session
            include_episodes: Whether to include episode-by-episode metrics
            
        Returns:
            RLSessionMetrics with detailed performance data
        """
        
        params = {"include_episodes": include_episodes}
        response = await self._get(
            f"{self.base_url}/sessions/{session_id}/metrics",
            params=params
        )
        
        return RLSessionMetrics.from_dict(response)
    
    async def stop_optimization(self, session_id: str) -> bool:
        """
        Stop a running RL optimization session
        
        Args:
            session_id: ID of the optimization session to stop
            
        Returns:
            True if session was successfully stopped
        """
        
        response = await self._post(f"{self.base_url}/sessions/{session_id}/stop")
        return response.get("success", False)
    
    async def get_optimization_result(
        self, 
        session_id: str
    ) -> OptimizationResult:
        """
        Get final results from a completed RL optimization session
        
        Args:
            session_id: ID of the completed optimization session
            
        Returns:
            OptimizationResult with best hyperparameters and performance metrics
        """
        
        response = await self._get(f"{self.base_url}/sessions/{session_id}/result")
        return OptimizationResult.from_dict(response)
    
    async def list_sessions(
        self,
        pipeline_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[RLOptimizationSession]:
        """
        List RL optimization sessions
        
        Args:
            pipeline_id: Filter by pipeline ID
            status: Filter by session status
            limit: Maximum number of sessions to return
            offset: Number of sessions to skip
            
        Returns:
            List of RLOptimizationSession objects
        """
        
        params = {
            "limit": limit,
            "offset": offset
        }
        
        if pipeline_id:
            params["pipeline_id"] = pipeline_id
        if status:
            params["status"] = status
        
        response = await self._get(f"{self.base_url}/sessions", params=params)
        
        return [
            RLOptimizationSession.from_dict(session_data)
            for session_data in response.get("sessions", [])
        ]
    
    async def wait_for_completion(
        self,
        session_id: str,
        timeout: int = 3600,
        poll_interval: int = 30
    ) -> OptimizationResult:
        """
        Wait for an RL optimization session to complete
        
        Args:
            session_id: ID of the optimization session
            timeout: Maximum time to wait in seconds
            poll_interval: Time between status checks in seconds
            
        Returns:
            OptimizationResult when session completes
            
        Raises:
            TimeoutError: If session doesn't complete within timeout
            SchlepEngineError: If session fails
        """
        
        start_time = time.time()
        
        while True:
            status = await self.get_session_status(session_id)
            
            if status.status == "completed":
                return await self.get_optimization_result(session_id)
            elif status.status == "failed":
                raise SchlepEngineError(f"Optimization session {session_id} failed: {status.error_message}")
            elif time.time() - start_time > timeout:
                raise TimeoutError(f"Optimization session {session_id} did not complete within {timeout} seconds")
            
            await asyncio.sleep(poll_interval)
    
    async def get_industry_preset(self, industry: str) -> Dict[str, Any]:
        """
        Get industry-specific optimization configuration preset
        
        Args:
            industry: Industry type (ecommerce, manufacturing, finance)
            
        Returns:
            Dictionary with optimized configuration for the industry
        """
        
        response = await self._get(f"{self.base_url}/presets/industry/{industry}")
        return response
    
    async def validate_optimization_request(
        self,
        request_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate an optimization request before submission
        
        Args:
            request_data: The optimization request data
            
        Returns:
            Validation result with any errors or warnings
        """
        
        response = await self._post(
            f"{self.base_url}/validate",
            json=request_data
        )
        
        return response
    
    # Convenience methods for common use cases
    
    async def optimize_ecommerce_pipeline(
        self,
        pipeline_id: str,
        training_data_path: str,
        **kwargs
    ) -> RLOptimizationSession:
        """
        Optimize an e-commerce ML pipeline with industry-specific settings
        
        Args:
            pipeline_id: ID of the e-commerce pipeline
            training_data_path: Path to training data
            **kwargs: Additional optimization parameters
            
        Returns:
            RLOptimizationSession with session details
        """
        
        # Get e-commerce preset configuration
        preset = await self.get_industry_preset("ecommerce")
        
        # Merge with user-provided kwargs
        config = {**preset, **kwargs}
        
        return await self.start_hyperparameter_optimization(
            pipeline_id=pipeline_id,
            training_data_path=training_data_path,
            **config
        )
    
    async def optimize_manufacturing_pipeline(
        self,
        pipeline_id: str,
        training_data_path: str,
        **kwargs
    ) -> RLOptimizationSession:
        """
        Optimize a manufacturing ML pipeline with industry-specific settings
        
        Args:
            pipeline_id: ID of the manufacturing pipeline
            training_data_path: Path to training data
            **kwargs: Additional optimization parameters
            
        Returns:
            RLOptimizationSession with session details
        """
        
        preset = await self.get_industry_preset("manufacturing")
        config = {**preset, **kwargs}
        
        return await self.start_hyperparameter_optimization(
            pipeline_id=pipeline_id,
            training_data_path=training_data_path,
            **config
        )
    
    async def optimize_finance_pipeline(
        self,
        pipeline_id: str,
        training_data_path: str,
        **kwargs
    ) -> RLOptimizationSession:
        """
        Optimize a finance ML pipeline with industry-specific settings
        
        Args:
            pipeline_id: ID of the finance pipeline
            training_data_path: Path to training data
            **kwargs: Additional optimization parameters
            
        Returns:
            RLOptimizationSession with session details
        """
        
        preset = await self.get_industry_preset("finance")
        config = {**preset, **kwargs}
        
        return await self.start_hyperparameter_optimization(
            pipeline_id=pipeline_id,
            training_data_path=training_data_path,
            **config
        )