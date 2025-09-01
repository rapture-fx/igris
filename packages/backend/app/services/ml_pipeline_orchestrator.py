"""
ML Pipeline Orchestration Service
=================================

Comprehensive orchestration service for managing complex ML/RL workflows
with support for pipeline definition, execution, monitoring, and error handling.

Features:
- Visual pipeline builder integration
- Step-by-step execution with dependencies
- Parallel and sequential processing
- Error handling and retry mechanisms
- Resource management and optimization
- Real-time monitoring and logging
- Pipeline versioning and reproducibility
- Integration with existing ML/RL services
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Any, Optional, Union, Callable, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class StepStatus(Enum):
    """Status of pipeline steps"""
    PENDING = "pending"
    WAITING = "waiting"  # Waiting for dependencies
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class PipelineStatus(Enum):
    """Status of entire pipeline"""
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExecutionMode(Enum):
    """Pipeline execution modes"""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    HYBRID = "hybrid"  # Mixed sequential and parallel


@dataclass
class StepConfig:
    """Configuration for a pipeline step"""
    step_id: str
    name: str
    service: str  # Which service to use (e.g., 'ml_training', 'data_processing')
    function: str  # Function to call within the service
    parameters: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)  # Step IDs this depends on
    retry_count: int = 3
    timeout_seconds: Optional[int] = None
    condition: Optional[str] = None  # Conditional execution expression
    resources: Dict[str, Any] = field(default_factory=dict)  # Resource requirements
    
    # Output handling
    output_mapping: Dict[str, str] = field(default_factory=dict)  # Map outputs to pipeline variables
    cache_outputs: bool = True


@dataclass
class StepResult:
    """Result of a step execution"""
    step_id: str
    status: StepStatus
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    outputs: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    retry_attempt: int = 0
    logs: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineDefinition:
    """Complete pipeline definition"""
    pipeline_id: str
    name: str
    description: str
    version: str
    steps: List[StepConfig]
    execution_mode: ExecutionMode = ExecutionMode.HYBRID
    
    # Pipeline-level configuration
    max_parallel_steps: int = 5
    global_timeout_seconds: Optional[int] = None
    error_handling: str = "fail_fast"  # 'fail_fast', 'continue', 'retry'
    
    # Variables and parameters
    pipeline_parameters: Dict[str, Any] = field(default_factory=dict)
    pipeline_variables: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    tags: List[str] = field(default_factory=list)


@dataclass
class PipelineExecution:
    """Runtime execution state of a pipeline"""
    execution_id: str
    pipeline_id: str
    status: PipelineStatus
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    # Step tracking
    step_results: Dict[str, StepResult] = field(default_factory=dict)
    current_steps: Set[str] = field(default_factory=set)  # Currently running steps
    
    # Runtime state
    pipeline_variables: Dict[str, Any] = field(default_factory=dict)
    execution_logs: List[str] = field(default_factory=list)
    
    # User context
    user_id: str = ""
    session_id: Optional[str] = None


class ServiceRegistry:
    """Registry of available services and their functions"""
    
    def __init__(self):
        self.services: Dict[str, Dict[str, Callable]] = {}
    
    def register_service(self, service_name: str, functions: Dict[str, Callable]):
        """Register a service with its available functions"""
        self.services[service_name] = functions
        logger.info(f"Registered service '{service_name}' with {len(functions)} functions")
    
    def get_function(self, service_name: str, function_name: str) -> Optional[Callable]:
        """Get a function from a registered service"""
        return self.services.get(service_name, {}).get(function_name)
    
    def list_services(self) -> Dict[str, List[str]]:
        """List all registered services and their functions"""
        return {service: list(functions.keys()) for service, functions in self.services.items()}


class MLPipelineOrchestrator:
    """
    Advanced ML pipeline orchestration service
    """
    
    def __init__(self, max_concurrent_pipelines: int = 10):
        """
        Initialize the pipeline orchestrator
        
        Args:
            max_concurrent_pipelines: Maximum number of pipelines to run simultaneously
        """
        self.max_concurrent_pipelines = max_concurrent_pipelines
        self.service_registry = ServiceRegistry()
        
        # Pipeline storage
        self.pipeline_definitions: Dict[str, PipelineDefinition] = {}
        self.active_executions: Dict[str, PipelineExecution] = {}
        self.execution_history: List[PipelineExecution] = []
        
        # Execution management
        self.executor = ThreadPoolExecutor(max_workers=20)
        self.running_tasks: Dict[str, asyncio.Task] = {}
        
        # Register default services
        self._register_default_services()
    
    def _register_default_services(self):
        """Register default ML/RL services"""
        try:
            # Register ML training service
            from app.services.advanced_ml_engine import advanced_ml_engine
            ml_functions = {
                'train_anomaly_detection': advanced_ml_engine.train_anomaly_detection_model,
                'train_predictive_model': advanced_ml_engine.train_predictive_model,
                'detect_anomalies': advanced_ml_engine.detect_anomalies,
                'make_predictions': advanced_ml_engine.make_predictions,
                'generate_insights': advanced_ml_engine.generate_insights
            }
            self.service_registry.register_service('ml_training', ml_functions)
            
        except ImportError as e:
            logger.warning(f"ML training service not available: {e}")
        
        try:
            # Register document processing service
            from app.services.document_processor import document_processor
            doc_functions = {
                'process_document': document_processor.process_document,
                'process_multiple_documents': document_processor.process_multiple_documents,
                'extract_structured_data': document_processor.extract_structured_data
            }
            self.service_registry.register_service('document_processing', doc_functions)
            
        except ImportError as e:
            logger.warning(f"Document processing service not available: {e}")
        
        try:
            # Register data quality service
            from app.services.data_quality_service import data_quality_assessor
            quality_functions = {
                'assess_data_quality': data_quality_assessor.assess_data_quality
            }
            self.service_registry.register_service('data_quality', quality_functions)
            
        except ImportError as e:
            logger.warning(f"Data quality service not available: {e}")
        
        # Register utility functions
        utility_functions = {
            'delay': self._utility_delay,
            'log_message': self._utility_log_message,
            'set_variable': self._utility_set_variable,
            'conditional_branch': self._utility_conditional_branch,
            'data_transformation': self._utility_data_transformation
        }
        self.service_registry.register_service('utilities', utility_functions)
    
    async def create_pipeline(self, 
                            definition: PipelineDefinition,
                            user_id: str) -> str:
        """
        Create a new pipeline definition
        
        Args:
            definition: Pipeline definition
            user_id: User creating the pipeline
            
        Returns:
            Pipeline ID
        """
        try:
            # Validate pipeline definition
            await self._validate_pipeline_definition(definition)
            
            # Store pipeline definition
            definition.created_by = user_id
            definition.created_at = datetime.utcnow()
            
            self.pipeline_definitions[definition.pipeline_id] = definition
            
            logger.info(f"Pipeline created: {definition.pipeline_id} by user {user_id}")
            return definition.pipeline_id
            
        except Exception as e:
            logger.error(f"Failed to create pipeline: {str(e)}")
            raise
    
    async def execute_pipeline(self,
                             pipeline_id: str,
                             user_id: str,
                             parameters: Optional[Dict[str, Any]] = None,
                             session_id: Optional[str] = None) -> str:
        """
        Execute a pipeline
        
        Args:
            pipeline_id: ID of pipeline to execute
            user_id: User executing the pipeline
            parameters: Runtime parameters
            session_id: Optional session ID for tracking
            
        Returns:
            Execution ID
        """
        try:
            # Check if pipeline exists
            if pipeline_id not in self.pipeline_definitions:
                raise ValueError(f"Pipeline '{pipeline_id}' not found")
            
            # Check concurrent execution limit
            if len(self.active_executions) >= self.max_concurrent_pipelines:
                raise ValueError("Maximum concurrent pipelines reached")
            
            # Create execution context
            execution_id = str(uuid.uuid4())
            pipeline_def = self.pipeline_definitions[pipeline_id]
            
            execution = PipelineExecution(
                execution_id=execution_id,
                pipeline_id=pipeline_id,
                status=PipelineStatus.CREATED,
                user_id=user_id,
                session_id=session_id,
                pipeline_variables=parameters or {}
            )
            
            # Initialize step results
            for step in pipeline_def.steps:
                execution.step_results[step.step_id] = StepResult(
                    step_id=step.step_id,
                    status=StepStatus.PENDING
                )
            
            # Store execution
            self.active_executions[execution_id] = execution
            
            # Start execution task
            task = asyncio.create_task(self._execute_pipeline_async(execution_id))
            self.running_tasks[execution_id] = task
            
            logger.info(f"Pipeline execution started: {execution_id} for pipeline {pipeline_id}")
            return execution_id
            
        except Exception as e:
            logger.error(f"Failed to start pipeline execution: {str(e)}")
            raise
    
    async def get_execution_status(self, execution_id: str) -> Optional[PipelineExecution]:
        """Get current execution status"""
        if execution_id in self.active_executions:
            return self.active_executions[execution_id]
        
        # Check history
        for execution in self.execution_history:
            if execution.execution_id == execution_id:
                return execution
        
        return None
    
    async def cancel_execution(self, execution_id: str, user_id: str) -> bool:
        """Cancel a running pipeline execution"""
        if execution_id not in self.active_executions:
            return False
        
        execution = self.active_executions[execution_id]
        
        # Check permission (user must own the execution)
        if execution.user_id != user_id:
            raise PermissionError("Cannot cancel execution owned by another user")
        
        # Cancel the execution
        execution.status = PipelineStatus.CANCELLED
        execution.end_time = datetime.utcnow()
        
        # Cancel running task
        if execution_id in self.running_tasks:
            self.running_tasks[execution_id].cancel()
            del self.running_tasks[execution_id]
        
        # Move to history
        self._move_to_history(execution_id)
        
        logger.info(f"Pipeline execution cancelled: {execution_id}")
        return True
    
    async def list_pipelines(self, user_id: str) -> List[Dict[str, Any]]:
        """List available pipelines for a user"""
        pipelines = []
        
        for pipeline_id, definition in self.pipeline_definitions.items():
            # For now, show all pipelines. In production, filter by user access
            pipelines.append({
                "pipeline_id": pipeline_id,
                "name": definition.name,
                "description": definition.description,
                "version": definition.version,
                "created_by": definition.created_by,
                "created_at": definition.created_at.isoformat(),
                "step_count": len(definition.steps),
                "execution_mode": definition.execution_mode.value,
                "tags": definition.tags
            })
        
        return pipelines
    
    async def list_executions(self, 
                            user_id: str,
                            pipeline_id: Optional[str] = None,
                            limit: int = 50) -> List[Dict[str, Any]]:
        """List pipeline executions for a user"""
        executions = []
        
        # Get active executions
        for execution in self.active_executions.values():
            if execution.user_id == user_id:
                if pipeline_id is None or execution.pipeline_id == pipeline_id:
                    executions.append(execution)
        
        # Get historical executions
        for execution in self.execution_history:
            if execution.user_id == user_id:
                if pipeline_id is None or execution.pipeline_id == pipeline_id:
                    executions.append(execution)
        
        # Sort by start time (most recent first)
        executions.sort(key=lambda x: x.start_time or datetime.min, reverse=True)
        
        # Format for response
        formatted_executions = []
        for execution in executions[:limit]:
            duration = None
            if execution.start_time and execution.end_time:
                duration = (execution.end_time - execution.start_time).total_seconds()
            
            formatted_executions.append({
                "execution_id": execution.execution_id,
                "pipeline_id": execution.pipeline_id,
                "status": execution.status.value,
                "start_time": execution.start_time.isoformat() if execution.start_time else None,
                "end_time": execution.end_time.isoformat() if execution.end_time else None,
                "duration_seconds": duration,
                "completed_steps": len([s for s in execution.step_results.values() if s.status == StepStatus.COMPLETED]),
                "total_steps": len(execution.step_results),
                "user_id": execution.user_id,
                "session_id": execution.session_id
            })
        
        return formatted_executions
    
    async def get_step_logs(self, execution_id: str, step_id: str) -> List[str]:
        """Get logs for a specific step"""
        execution = await self.get_execution_status(execution_id)
        if not execution:
            return []
        
        step_result = execution.step_results.get(step_id)
        if not step_result:
            return []
        
        return step_result.logs
    
    async def _execute_pipeline_async(self, execution_id: str):
        """Asynchronously execute a pipeline"""
        try:
            execution = self.active_executions[execution_id]
            pipeline_def = self.pipeline_definitions[execution.pipeline_id]
            
            execution.status = PipelineStatus.RUNNING
            execution.start_time = datetime.utcnow()
            
            # Build dependency graph
            dependency_graph = self._build_dependency_graph(pipeline_def.steps)
            
            # Execute steps based on execution mode
            if pipeline_def.execution_mode == ExecutionMode.SEQUENTIAL:
                await self._execute_sequential(execution_id, dependency_graph)
            elif pipeline_def.execution_mode == ExecutionMode.PARALLEL:
                await self._execute_parallel(execution_id, dependency_graph)
            else:  # HYBRID
                await self._execute_hybrid(execution_id, dependency_graph)
            
            # Determine final status
            failed_steps = [s for s in execution.step_results.values() if s.status == StepStatus.FAILED]
            if failed_steps:
                execution.status = PipelineStatus.FAILED
            else:
                execution.status = PipelineStatus.COMPLETED
            
            execution.end_time = datetime.utcnow()
            
            # Send completion notification
            await self._notify_pipeline_completion(execution_id)
            
            logger.info(f"Pipeline execution completed: {execution_id} with status {execution.status.value}")
            
        except asyncio.CancelledError:
            execution = self.active_executions.get(execution_id)
            if execution:
                execution.status = PipelineStatus.CANCELLED
                execution.end_time = datetime.utcnow()
            logger.info(f"Pipeline execution cancelled: {execution_id}")
            
        except Exception as e:
            execution = self.active_executions.get(execution_id)
            if execution:
                execution.status = PipelineStatus.FAILED
                execution.end_time = datetime.utcnow()
                execution.execution_logs.append(f"Pipeline failed: {str(e)}")
            
            logger.error(f"Pipeline execution failed: {execution_id} - {str(e)}")
            logger.error(traceback.format_exc())
        
        finally:
            # Clean up
            self._move_to_history(execution_id)
            if execution_id in self.running_tasks:
                del self.running_tasks[execution_id]
    
    async def _execute_hybrid(self, execution_id: str, dependency_graph: Dict[str, Set[str]]):
        """Execute pipeline in hybrid mode (optimal parallelization)"""
        execution = self.active_executions[execution_id]
        pipeline_def = self.pipeline_definitions[execution.pipeline_id]
        
        # Track completed steps
        completed_steps = set()
        remaining_steps = set(step.step_id for step in pipeline_def.steps)
        
        while remaining_steps:
            # Find steps that can run (dependencies satisfied)
            ready_steps = []
            for step_id in remaining_steps:
                dependencies = dependency_graph.get(step_id, set())
                if dependencies.issubset(completed_steps):
                    step_config = next(s for s in pipeline_def.steps if s.step_id == step_id)
                    ready_steps.append(step_config)
            
            if not ready_steps:
                # No steps can run - check for circular dependencies
                logger.error(f"No ready steps found, possible circular dependency in pipeline {execution.pipeline_id}")
                break
            
            # Limit concurrent steps
            concurrent_steps = ready_steps[:pipeline_def.max_parallel_steps]
            
            # Execute steps concurrently
            tasks = []
            for step_config in concurrent_steps:
                task = asyncio.create_task(self._execute_step(execution_id, step_config))
                tasks.append(task)
                execution.current_steps.add(step_config.step_id)
                remaining_steps.remove(step_config.step_id)
            
            # Wait for all tasks to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for i, result in enumerate(results):
                step_config = concurrent_steps[i]
                execution.current_steps.discard(step_config.step_id)
                
                if isinstance(result, Exception):
                    step_result = execution.step_results[step_config.step_id]
                    step_result.status = StepStatus.FAILED
                    step_result.error_message = str(result)
                    
                    # Handle error based on error handling strategy
                    if pipeline_def.error_handling == "fail_fast":
                        raise result
                    # For 'continue' mode, we just log and move on
                    
                else:
                    completed_steps.add(step_config.step_id)
    
    async def _execute_sequential(self, execution_id: str, dependency_graph: Dict[str, Set[str]]):
        """Execute pipeline sequentially"""
        execution = self.active_executions[execution_id]
        pipeline_def = self.pipeline_definitions[execution.pipeline_id]
        
        # Sort steps by dependencies (topological sort)
        sorted_steps = self._topological_sort(pipeline_def.steps, dependency_graph)
        
        for step_config in sorted_steps:
            try:
                execution.current_steps.add(step_config.step_id)
                await self._execute_step(execution_id, step_config)
                execution.current_steps.discard(step_config.step_id)
                
            except Exception as e:
                step_result = execution.step_results[step_config.step_id]
                step_result.status = StepStatus.FAILED
                step_result.error_message = str(e)
                execution.current_steps.discard(step_config.step_id)
                
                if pipeline_def.error_handling == "fail_fast":
                    raise
    
    async def _execute_parallel(self, execution_id: str, dependency_graph: Dict[str, Set[str]]):
        """Execute pipeline with maximum parallelization (ignoring dependencies)"""
        execution = self.active_executions[execution_id]
        pipeline_def = self.pipeline_definitions[execution.pipeline_id]
        
        # Execute all steps in parallel
        tasks = []
        for step_config in pipeline_def.steps:
            task = asyncio.create_task(self._execute_step(execution_id, step_config))
            tasks.append(task)
            execution.current_steps.add(step_config.step_id)
        
        # Wait for all tasks
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for i, result in enumerate(results):
            step_config = pipeline_def.steps[i]
            execution.current_steps.discard(step_config.step_id)
            
            if isinstance(result, Exception):
                step_result = execution.step_results[step_config.step_id]
                step_result.status = StepStatus.FAILED
                step_result.error_message = str(result)
    
    async def _execute_step(self, execution_id: str, step_config: StepConfig):
        """Execute a single pipeline step"""
        execution = self.active_executions[execution_id]
        step_result = execution.step_results[step_config.step_id]
        
        try:
            step_result.status = StepStatus.RUNNING
            step_result.start_time = datetime.utcnow()
            
            # Check condition if specified
            if step_config.condition and not self._evaluate_condition(step_config.condition, execution.pipeline_variables):
                step_result.status = StepStatus.SKIPPED
                step_result.end_time = datetime.utcnow()
                logger.info(f"Step {step_config.step_id} skipped due to condition")
                return
            
            # Get service function
            service_func = self.service_registry.get_function(step_config.service, step_config.function)
            if not service_func:
                raise ValueError(f"Service function not found: {step_config.service}.{step_config.function}")
            
            # Prepare parameters
            step_params = self._prepare_step_parameters(step_config, execution.pipeline_variables)
            
            # Execute with timeout
            try:
                if asyncio.iscoroutinefunction(service_func):
                    if step_config.timeout_seconds:
                        outputs = await asyncio.wait_for(
                            service_func(**step_params),
                            timeout=step_config.timeout_seconds
                        )
                    else:
                        outputs = await service_func(**step_params)
                else:
                    # Run synchronous function in executor
                    if step_config.timeout_seconds:
                        outputs = await asyncio.wait_for(
                            asyncio.get_event_loop().run_in_executor(
                                self.executor, 
                                lambda: service_func(**step_params)
                            ),
                            timeout=step_config.timeout_seconds
                        )
                    else:
                        outputs = await asyncio.get_event_loop().run_in_executor(
                            self.executor,
                            lambda: service_func(**step_params)
                        )
                
                # Store outputs
                if outputs is not None:
                    if isinstance(outputs, dict):
                        step_result.outputs = outputs
                    else:
                        step_result.outputs = {"result": outputs}
                
                # Map outputs to pipeline variables
                if step_config.output_mapping:
                    for output_key, variable_name in step_config.output_mapping.items():
                        if output_key in step_result.outputs:
                            execution.pipeline_variables[variable_name] = step_result.outputs[output_key]
                
                step_result.status = StepStatus.COMPLETED
                step_result.end_time = datetime.utcnow()
                
                # Notify step completion
                await self._notify_step_completion(execution_id, step_config.step_id)
                
                logger.info(f"Step completed: {step_config.step_id}")
                
            except asyncio.TimeoutError:
                raise TimeoutError(f"Step {step_config.step_id} timed out after {step_config.timeout_seconds} seconds")
            
        except Exception as e:
            step_result.status = StepStatus.FAILED
            step_result.end_time = datetime.utcnow()
            step_result.error_message = str(e)
            step_result.logs.append(f"Step failed: {str(e)}")
            
            # Retry logic
            if step_result.retry_attempt < step_config.retry_count:
                step_result.retry_attempt += 1
                step_result.logs.append(f"Retrying step (attempt {step_result.retry_attempt + 1}/{step_config.retry_count + 1})")
                
                # Exponential backoff
                wait_time = 2 ** step_result.retry_attempt
                await asyncio.sleep(wait_time)
                
                # Recursive retry
                await self._execute_step(execution_id, step_config)
            else:
                logger.error(f"Step failed after {step_config.retry_count + 1} attempts: {step_config.step_id} - {str(e)}")
                raise
    
    def _build_dependency_graph(self, steps: List[StepConfig]) -> Dict[str, Set[str]]:
        """Build dependency graph from step configurations"""
        graph = {}
        for step in steps:
            graph[step.step_id] = set(step.dependencies)
        return graph
    
    def _topological_sort(self, steps: List[StepConfig], dependency_graph: Dict[str, Set[str]]) -> List[StepConfig]:
        """Sort steps in topological order based on dependencies"""
        # Kahn's algorithm
        in_degree = defaultdict(int)
        step_map = {step.step_id: step for step in steps}
        
        # Calculate in-degrees
        for step_id, dependencies in dependency_graph.items():
            for dep in dependencies:
                in_degree[step_id] += 1
        
        # Find steps with no dependencies
        queue = deque([step for step in steps if in_degree[step.step_id] == 0])
        sorted_steps = []
        
        while queue:
            current_step = queue.popleft()
            sorted_steps.append(current_step)
            
            # Update in-degrees for dependent steps
            for step_id, dependencies in dependency_graph.items():
                if current_step.step_id in dependencies:
                    in_degree[step_id] -= 1
                    if in_degree[step_id] == 0 and step_id in step_map:
                        queue.append(step_map[step_id])
        
        return sorted_steps
    
    def _prepare_step_parameters(self, step_config: StepConfig, pipeline_variables: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare parameters for step execution by resolving variables"""
        params = step_config.parameters.copy()
        
        # Replace variable references
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                var_name = value[2:-1]  # Remove ${ and }
                if var_name in pipeline_variables:
                    params[key] = pipeline_variables[var_name]
        
        return params
    
    def _evaluate_condition(self, condition: str, variables: Dict[str, Any]) -> bool:
        """Evaluate a condition expression"""
        try:
            # Simple condition evaluation - in production, use a safe evaluator
            # This is a simplified implementation
            for var_name, var_value in variables.items():
                condition = condition.replace(f"${{{var_name}}}", str(var_value))
            
            # Very basic evaluation - should be replaced with proper expression evaluator
            if "==" in condition:
                left, right = condition.split("==", 1)
                return left.strip().strip('"\'') == right.strip().strip('"\'')
            elif "!=" in condition:
                left, right = condition.split("!=", 1)
                return left.strip().strip('"\'') != right.strip().strip('"\'')
            else:
                return bool(condition)
                
        except Exception as e:
            logger.warning(f"Condition evaluation failed: {condition} - {str(e)}")
            return True  # Default to true if evaluation fails
    
    async def _validate_pipeline_definition(self, definition: PipelineDefinition):
        """Validate pipeline definition"""
        # Check for duplicate step IDs
        step_ids = [step.step_id for step in definition.steps]
        if len(step_ids) != len(set(step_ids)):
            raise ValueError("Duplicate step IDs found in pipeline definition")
        
        # Validate dependencies
        for step in definition.steps:
            for dep in step.dependencies:
                if dep not in step_ids:
                    raise ValueError(f"Step '{step.step_id}' depends on non-existent step '{dep}'")
        
        # Check for circular dependencies
        if self._has_circular_dependencies(definition.steps):
            raise ValueError("Circular dependencies detected in pipeline definition")
        
        # Validate service functions
        for step in definition.steps:
            if not self.service_registry.get_function(step.service, step.function):
                raise ValueError(f"Unknown service function: {step.service}.{step.function}")
    
    def _has_circular_dependencies(self, steps: List[StepConfig]) -> bool:
        """Check for circular dependencies using DFS"""
        dependency_graph = self._build_dependency_graph(steps)
        visited = set()
        rec_stack = set()
        
        def has_cycle(step_id):
            if step_id in rec_stack:
                return True
            if step_id in visited:
                return False
            
            visited.add(step_id)
            rec_stack.add(step_id)
            
            for dep in dependency_graph.get(step_id, set()):
                if has_cycle(dep):
                    return True
            
            rec_stack.remove(step_id)
            return False
        
        for step in steps:
            if step.step_id not in visited:
                if has_cycle(step.step_id):
                    return True
        
        return False
    
    def _move_to_history(self, execution_id: str):
        """Move execution from active to history"""
        if execution_id in self.active_executions:
            execution = self.active_executions.pop(execution_id)
            self.execution_history.append(execution)
            
            # Keep history limited
            if len(self.execution_history) > 1000:
                self.execution_history = self.execution_history[-1000:]
    
    async def _notify_pipeline_completion(self, execution_id: str):
        """Send notification when pipeline completes"""
        try:
            from app.services.ml_websocket_service import ml_websocket_manager, MLEvent, MLEventType
            
            execution = self.active_executions.get(execution_id)
            if not execution:
                return
            
            event_type = MLEventType.TASK_COMPLETED if execution.status == PipelineStatus.COMPLETED else MLEventType.TASK_FAILED
            
            event = MLEvent(
                event_type=event_type,
                session_id=execution.session_id or execution_id,
                user_id=execution.user_id,
                task_id=execution_id,
                progress=1.0,
                message=f"Pipeline {execution.pipeline_id} {execution.status.value}",
                data={
                    "pipeline_id": execution.pipeline_id,
                    "execution_id": execution_id,
                    "status": execution.status.value,
                    "duration": (execution.end_time - execution.start_time).total_seconds() if execution.start_time and execution.end_time else None,
                    "completed_steps": len([s for s in execution.step_results.values() if s.status == StepStatus.COMPLETED]),
                    "total_steps": len(execution.step_results)
                }
            )
            
            await ml_websocket_manager.broadcast_event(event, target_user_id=execution.user_id)
            
        except Exception as e:
            logger.error(f"Failed to notify pipeline completion: {str(e)}")
    
    async def _notify_step_completion(self, execution_id: str, step_id: str):
        """Send notification when step completes"""
        try:
            from app.services.ml_websocket_service import ml_websocket_manager, MLEvent, MLEventType
            
            execution = self.active_executions.get(execution_id)
            if not execution:
                return
            
            step_result = execution.step_results.get(step_id)
            if not step_result:
                return
            
            completed_steps = len([s for s in execution.step_results.values() if s.status == StepStatus.COMPLETED])
            total_steps = len(execution.step_results)
            progress = completed_steps / total_steps
            
            event = MLEvent(
                event_type=MLEventType.TASK_STARTED,  # Use generic task event
                session_id=execution.session_id or execution_id,
                user_id=execution.user_id,
                task_id=execution_id,
                progress=progress,
                message=f"Step {step_id} completed ({completed_steps}/{total_steps})",
                data={
                    "pipeline_id": execution.pipeline_id,
                    "execution_id": execution_id,
                    "step_id": step_id,
                    "step_status": step_result.status.value,
                    "completed_steps": completed_steps,
                    "total_steps": total_steps
                }
            )
            
            await ml_websocket_manager.broadcast_event(event, target_user_id=execution.user_id)
            
        except Exception as e:
            logger.error(f"Failed to notify step completion: {str(e)}")
    
    # Utility functions for common pipeline operations
    async def _utility_delay(self, seconds: int = 1):
        """Utility function to add delay"""
        await asyncio.sleep(seconds)
        return {"delay_seconds": seconds}
    
    async def _utility_log_message(self, message: str):
        """Utility function to log message"""
        logger.info(f"Pipeline log: {message}")
        return {"logged_message": message}
    
    async def _utility_set_variable(self, variable_name: str, value: Any):
        """Utility function to set pipeline variable"""
        return {variable_name: value}
    
    async def _utility_conditional_branch(self, condition: bool, true_value: Any = True, false_value: Any = False):
        """Utility function for conditional logic"""
        return {"result": true_value if condition else false_value}
    
    async def _utility_data_transformation(self, data: Any, transformation: str = "identity"):
        """Utility function for basic data transformations"""
        if transformation == "identity":
            return {"transformed_data": data}
        elif transformation == "uppercase" and isinstance(data, str):
            return {"transformed_data": data.upper()}
        elif transformation == "lowercase" and isinstance(data, str):
            return {"transformed_data": data.lower()}
        else:
            return {"transformed_data": data}


# Global orchestrator instance
ml_pipeline_orchestrator = MLPipelineOrchestrator()


# Utility functions for pipeline creation
def create_ml_training_pipeline(pipeline_id: str,
                               name: str,
                               data_path: str,
                               model_type: str = "classification") -> PipelineDefinition:
    """
    Create a standard ML training pipeline
    """
    steps = [
        StepConfig(
            step_id="data_quality_check",
            name="Data Quality Assessment",
            service="data_quality",
            function="assess_data_quality",
            parameters={"data": f"${{{data_path}}}"},
            output_mapping={"overall_score": "data_quality_score"}
        ),
        StepConfig(
            step_id="ml_training",
            name="Model Training",
            service="ml_training",
            function="train_predictive_model",
            parameters={
                "data": f"${{{data_path}}}",
                "model_name": f"model_{pipeline_id}",
                "model_type": model_type
            },
            dependencies=["data_quality_check"],
            condition="${data_quality_score} > 0.7",
            output_mapping={"metadata": "model_metadata"}
        ),
        StepConfig(
            step_id="model_insights",
            name="Generate Model Insights",
            service="ml_training",
            function="generate_insights",
            parameters={
                "model_name": f"model_{pipeline_id}"
            },
            dependencies=["ml_training"]
        )
    ]
    
    return PipelineDefinition(
        pipeline_id=pipeline_id,
        name=name,
        description=f"Standard ML training pipeline for {model_type} model",
        version="1.0",
        steps=steps,
        execution_mode=ExecutionMode.HYBRID
    )


def create_document_processing_pipeline(pipeline_id: str,
                                      name: str,
                                      document_path: str) -> PipelineDefinition:
    """
    Create a document processing pipeline
    """
    steps = [
        StepConfig(
            step_id="document_processing",
            name="Process Documents",
            service="document_processing",
            function="process_document",
            parameters={
                "file_content": f"${{{document_path}}}",
                "filename": "document.pdf"
            },
            output_mapping={"text_content": "extracted_text"}
        ),
        StepConfig(
            step_id="structured_extraction",
            name="Extract Structured Data",
            service="document_processing",
            function="extract_structured_data",
            parameters={
                "processing_result": "${extracted_text}"
            },
            dependencies=["document_processing"]
        )
    ]
    
    return PipelineDefinition(
        pipeline_id=pipeline_id,
        name=name,
        description="Document processing and structured data extraction pipeline",
        version="1.0",
        steps=steps,
        execution_mode=ExecutionMode.SEQUENTIAL
    )