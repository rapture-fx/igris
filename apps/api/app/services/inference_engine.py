"""
Multi-Framework Inference Engine
=================================

High-performance inference engine supporting multiple ML frameworks with
ONNX conversion, optimization, and cross-framework compatibility.

Features:
- Multi-framework support (TensorFlow, PyTorch, scikit-learn, XGBoost, LightGBM)
- ONNX model conversion and optimization
- Batch processing with dynamic batching
- Model quantization and optimization
- Hardware acceleration (CPU/GPU)
- Memory-efficient model loading
- Performance profiling and optimization
"""

import asyncio
import logging
import time
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import tempfile
import os

# Framework imports with availability checks
FRAMEWORK_AVAILABILITY = {
    'tensorflow': False,
    'pytorch': False,
    'sklearn': False,
    'xgboost': False,
    'lightgbm': False,
    'onnx': False,
    'openvino': False
}

try:
    import tensorflow as tf
    FRAMEWORK_AVAILABILITY['tensorflow'] = True
except ImportError:
    tf = None

try:
    import torch
    import torch.nn as nn
    import torch.jit
    FRAMEWORK_AVAILABILITY['pytorch'] = True
except ImportError:
    torch = None

try:
    from sklearn.base import BaseEstimator
    import joblib
    FRAMEWORK_AVAILABILITY['sklearn'] = True
except ImportError:
    pass

try:
    import xgboost as xgb
    FRAMEWORK_AVAILABILITY['xgboost'] = True
except ImportError:
    xgb = None

try:
    import lightgbm as lgb
    FRAMEWORK_AVAILABILITY['lightgbm'] = True
except ImportError:
    lgb = None

try:
    import onnx
    import onnxruntime as ort
    from onnxruntime.quantization import quantize_dynamic, QuantType
    FRAMEWORK_AVAILABILITY['onnx'] = True
except ImportError:
    onnx = None
    ort = None

try:
    import openvino.runtime as ov
    FRAMEWORK_AVAILABILITY['openvino'] = True
except ImportError:
    ov = None


class OptimizationLevel(str, Enum):
    """Model optimization levels."""
    NONE = "none"
    BASIC = "basic"
    AGGRESSIVE = "aggressive"
    MAX = "max"


class HardwareTarget(str, Enum):
    """Hardware acceleration targets."""
    CPU = "cpu"
    GPU = "gpu"
    NEURAL_ENGINE = "neural_engine"
    OPENVINO = "openvino"


@dataclass
class InferenceConfig:
    """Inference configuration."""
    batch_size: int = 1
    max_batch_delay_ms: int = 100
    optimization_level: OptimizationLevel = OptimizationLevel.BASIC
    hardware_target: HardwareTarget = HardwareTarget.CPU
    use_fp16: bool = False
    use_quantization: bool = False
    enable_profiling: bool = False
    memory_limit_mb: Optional[int] = None


@dataclass
class ModelMetadata:
    """Model metadata and capabilities."""
    framework: str
    input_shapes: Dict[str, List[int]]
    output_shapes: Dict[str, List[int]]
    input_types: Dict[str, str]
    output_types: Dict[str, str]
    model_size_mb: float
    optimization_level: str
    hardware_target: str
    supports_batching: bool
    max_batch_size: int


class ONNXConverter:
    """ONNX model converter for cross-framework compatibility."""
    
    @staticmethod
    def tensorflow_to_onnx(model_path: str, output_path: str, 
                          input_signature: Optional[Dict] = None) -> bool:
        """Convert TensorFlow model to ONNX."""
        if not FRAMEWORK_AVAILABILITY['tensorflow'] or not FRAMEWORK_AVAILABILITY['onnx']:
            raise ImportError("TensorFlow or ONNX not available")
        
        try:
            import tf2onnx
            
            # Load TensorFlow model
            model = tf.saved_model.load(model_path)
            
            # Convert to ONNX
            onnx_model, _ = tf2onnx.convert.from_saved_model(
                model_path,
                opset=13,
                output_path=output_path
            )
            
            logging.info(f"Successfully converted TensorFlow model to ONNX: {output_path}")
            return True
            
        except Exception as e:
            logging.error(f"TensorFlow to ONNX conversion failed: {e}")
            return False
    
    @staticmethod
    def pytorch_to_onnx(model_path: str, output_path: str, 
                       input_shape: Tuple[int, ...], input_names: List[str] = None,
                       output_names: List[str] = None) -> bool:
        """Convert PyTorch model to ONNX."""
        if not FRAMEWORK_AVAILABILITY['pytorch'] or not FRAMEWORK_AVAILABILITY['onnx']:
            raise ImportError("PyTorch or ONNX not available")
        
        try:
            # Load PyTorch model
            model = torch.load(model_path, map_location='cpu')
            model.eval()
            
            # Create dummy input
            dummy_input = torch.randn(input_shape)
            
            # Export to ONNX
            torch.onnx.export(
                model,
                dummy_input,
                output_path,
                export_params=True,
                opset_version=13,
                do_constant_folding=True,
                input_names=input_names or ['input'],
                output_names=output_names or ['output'],
                dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}} if input_names is None else None
            )
            
            logging.info(f"Successfully converted PyTorch model to ONNX: {output_path}")
            return True
            
        except Exception as e:
            logging.error(f"PyTorch to ONNX conversion failed: {e}")
            return False
    
    @staticmethod
    def sklearn_to_onnx(model_path: str, output_path: str, 
                       initial_types: List[Tuple] = None) -> bool:
        """Convert scikit-learn model to ONNX."""
        if not FRAMEWORK_AVAILABILITY['sklearn'] or not FRAMEWORK_AVAILABILITY['onnx']:
            raise ImportError("Scikit-learn or ONNX not available")
        
        try:
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType
            
            # Load scikit-learn model
            model = joblib.load(model_path)
            
            # Default initial types if not provided
            if initial_types is None:
                initial_types = [('float_input', FloatTensorType([None, 4]))]  # Adjust based on your needs
            
            # Convert to ONNX
            onnx_model = convert_sklearn(model, initial_types=initial_types)
            
            # Save ONNX model
            with open(output_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            
            logging.info(f"Successfully converted scikit-learn model to ONNX: {output_path}")
            return True
            
        except Exception as e:
            logging.error(f"Scikit-learn to ONNX conversion failed: {e}")
            return False


class ModelOptimizer:
    """Model optimization utilities."""
    
    @staticmethod
    def optimize_onnx_model(model_path: str, output_path: str, 
                           optimization_level: OptimizationLevel = OptimizationLevel.BASIC,
                           use_quantization: bool = False) -> bool:
        """Optimize ONNX model for inference."""
        if not FRAMEWORK_AVAILABILITY['onnx']:
            raise ImportError("ONNX not available")
        
        try:
            # Set session options for optimization
            sess_options = ort.SessionOptions()
            
            if optimization_level == OptimizationLevel.BASIC:
                sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
            elif optimization_level == OptimizationLevel.AGGRESSIVE:
                sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED
            elif optimization_level == OptimizationLevel.MAX:
                sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            # Apply quantization if requested
            if use_quantization:
                quantize_dynamic(
                    model_path,
                    output_path,
                    weight_type=QuantType.QUInt8,
                    optimize_model=True
                )
                optimized_path = output_path
            else:
                optimized_path = model_path
            
            # Create optimized session
            session = ort.InferenceSession(optimized_path, sess_options)
            
            # Save optimized model if not already quantized
            if not use_quantization and output_path != model_path:
                # ONNX Runtime doesn't directly save optimized models
                # This is a placeholder - in practice, you'd use tools like onnxoptimizer
                import shutil
                shutil.copy2(model_path, output_path)
            
            logging.info(f"Successfully optimized ONNX model: {output_path}")
            return True
            
        except Exception as e:
            logging.error(f"ONNX model optimization failed: {e}")
            return False
    
    @staticmethod
    def profile_model_performance(model_path: str, input_data: np.ndarray,
                                num_iterations: int = 100) -> Dict[str, float]:
        """Profile model inference performance."""
        if not FRAMEWORK_AVAILABILITY['onnx']:
            raise ImportError("ONNX not available")
        
        try:
            # Create inference session
            session = ort.InferenceSession(model_path)
            input_name = session.get_inputs()[0].name
            
            # Warm-up runs
            for _ in range(10):
                session.run(None, {input_name: input_data})
            
            # Timing runs
            times = []
            for _ in range(num_iterations):
                start_time = time.perf_counter()
                session.run(None, {input_name: input_data})
                end_time = time.perf_counter()
                times.append((end_time - start_time) * 1000)  # Convert to ms
            
            return {
                'avg_latency_ms': np.mean(times),
                'min_latency_ms': np.min(times),
                'max_latency_ms': np.max(times),
                'p95_latency_ms': np.percentile(times, 95),
                'p99_latency_ms': np.percentile(times, 99),
                'std_latency_ms': np.std(times),
                'throughput_qps': 1000 / np.mean(times)
            }
            
        except Exception as e:
            logging.error(f"Model performance profiling failed: {e}")
            return {}


class DynamicBatcher:
    """Dynamic batching for improved throughput."""
    
    def __init__(self, max_batch_size: int = 32, max_delay_ms: int = 100):
        self.max_batch_size = max_batch_size
        self.max_delay_ms = max_delay_ms
        self.pending_requests = []
        self.batch_lock = asyncio.Lock()
        
    async def add_request(self, request_data: Dict[str, Any], 
                         callback: callable) -> None:
        """Add request to batch queue."""
        async with self.batch_lock:
            self.pending_requests.append({
                'data': request_data,
                'callback': callback,
                'timestamp': time.time()
            })
            
            # Trigger batch processing if conditions are met
            if (len(self.pending_requests) >= self.max_batch_size or
                self._should_process_batch()):
                await self._process_batch()
    
    def _should_process_batch(self) -> bool:
        """Check if batch should be processed based on time delay."""
        if not self.pending_requests:
            return False
        
        oldest_request_time = self.pending_requests[0]['timestamp']
        elapsed_ms = (time.time() - oldest_request_time) * 1000
        return elapsed_ms >= self.max_delay_ms
    
    async def _process_batch(self):
        """Process accumulated batch of requests."""
        if not self.pending_requests:
            return
        
        batch_to_process = self.pending_requests[:self.max_batch_size]
        self.pending_requests = self.pending_requests[self.max_batch_size:]
        
        # Create batch input
        batch_data = [req['data'] for req in batch_to_process]
        callbacks = [req['callback'] for req in batch_to_process]
        
        # Process batch (this would call the actual inference)
        try:
            # This is a placeholder - actual implementation would call the inference engine
            results = await self._run_batch_inference(batch_data)
            
            # Send results back to callbacks
            for callback, result in zip(callbacks, results):
                callback(result)
                
        except Exception as e:
            # Send error to all callbacks
            error_result = {'error': str(e)}
            for callback in callbacks:
                callback(error_result)
    
    async def _run_batch_inference(self, batch_data: List[Dict]) -> List[Dict]:
        """Run batch inference (placeholder)."""
        # This would be implemented by the specific inference engine
        return [{'prediction': 'placeholder'} for _ in batch_data]


class MultiFrameworkInferenceEngine:
    """High-performance multi-framework inference engine."""
    
    def __init__(self, config: InferenceConfig = None):
        self.config = config or InferenceConfig()
        self.loaded_models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, ModelMetadata] = {}
        self.model_sessions: Dict[str, Any] = {}
        self.dynamic_batcher = DynamicBatcher(
            max_batch_size=self.config.batch_size,
            max_delay_ms=self.config.max_batch_delay_ms
        )
        
        logging.info(f"Multi-Framework Inference Engine initialized")
        logging.info(f"Framework availability: {FRAMEWORK_AVAILABILITY}")
    
    async def load_model(self, model_id: str, model_path: str, 
                        framework: str, model_config: Dict = None) -> bool:
        """Load model with automatic optimization and conversion."""
        try:
            # Check if framework is available
            if framework not in FRAMEWORK_AVAILABILITY or not FRAMEWORK_AVAILABILITY[framework]:
                # Try to convert to ONNX for cross-framework compatibility
                logging.info(f"Framework {framework} not available, attempting ONNX conversion")
                return await self._load_with_onnx_conversion(model_id, model_path, framework, model_config)
            
            # Load model based on framework
            if framework == 'tensorflow':
                return await self._load_tensorflow_model(model_id, model_path, model_config)
            elif framework == 'pytorch':
                return await self._load_pytorch_model(model_id, model_path, model_config)
            elif framework == 'sklearn':
                return await self._load_sklearn_model(model_id, model_path, model_config)
            elif framework == 'xgboost':
                return await self._load_xgboost_model(model_id, model_path, model_config)
            elif framework == 'lightgbm':
                return await self._load_lightgbm_model(model_id, model_path, model_config)
            elif framework == 'onnx':
                return await self._load_onnx_model(model_id, model_path, model_config)
            else:
                raise ValueError(f"Unsupported framework: {framework}")
                
        except Exception as e:
            logging.error(f"Failed to load model {model_id}: {e}")
            return False
    
    async def _load_with_onnx_conversion(self, model_id: str, model_path: str, 
                                       framework: str, model_config: Dict) -> bool:
        """Load model by converting to ONNX first."""
        if not FRAMEWORK_AVAILABILITY['onnx']:
            logging.error("ONNX not available for cross-framework conversion")
            return False
        
        try:
            # Create temporary ONNX file
            with tempfile.NamedTemporaryFile(suffix='.onnx', delete=False) as tmp_file:
                onnx_path = tmp_file.name
            
            # Convert to ONNX based on original framework
            converter = ONNXConverter()
            success = False
            
            if framework == 'tensorflow':
                success = converter.tensorflow_to_onnx(model_path, onnx_path)
            elif framework == 'pytorch':
                input_shape = model_config.get('input_shape', (1, 3, 224, 224))
                success = converter.pytorch_to_onnx(model_path, onnx_path, input_shape)
            elif framework == 'sklearn':
                success = converter.sklearn_to_onnx(model_path, onnx_path)
            
            if success:
                # Load the converted ONNX model
                result = await self._load_onnx_model(model_id, onnx_path, model_config)
                
                # Clean up temporary file
                os.unlink(onnx_path)
                return result
            else:
                os.unlink(onnx_path)
                return False
                
        except Exception as e:
            logging.error(f"ONNX conversion failed for {model_id}: {e}")
            return False
    
    async def _load_onnx_model(self, model_id: str, model_path: str, 
                              model_config: Dict = None) -> bool:
        """Load ONNX model with optimization."""
        try:
            # Apply optimization if requested
            optimized_path = model_path
            if self.config.optimization_level != OptimizationLevel.NONE:
                with tempfile.NamedTemporaryFile(suffix='.onnx', delete=False) as tmp_file:
                    optimized_path = tmp_file.name
                
                optimizer = ModelOptimizer()
                optimizer.optimize_onnx_model(
                    model_path, 
                    optimized_path,
                    self.config.optimization_level,
                    self.config.use_quantization
                )
            
            # Configure session options
            sess_options = ort.SessionOptions()
            sess_options.enable_profiling = self.config.enable_profiling
            
            if self.config.memory_limit_mb:
                sess_options.add_session_config_entry(
                    'session.memory_limit_mb', 
                    str(self.config.memory_limit_mb)
                )
            
            # Configure execution providers
            providers = ['CPUExecutionProvider']
            if self.config.hardware_target == HardwareTarget.GPU:
                providers.insert(0, 'CUDAExecutionProvider')
            elif self.config.hardware_target == HardwareTarget.OPENVINO:
                providers.insert(0, 'OpenVINOExecutionProvider')
            
            # Create inference session
            session = ort.InferenceSession(optimized_path, sess_options, providers=providers)
            
            # Extract model metadata
            metadata = self._extract_onnx_metadata(session)
            
            # Store model and metadata
            self.model_sessions[model_id] = session
            self.model_metadata[model_id] = metadata
            
            # Profile performance if enabled
            if self.config.enable_profiling:
                # Create dummy input for profiling
                input_info = session.get_inputs()[0]
                dummy_input = np.random.random(input_info.shape).astype(np.float32)
                
                optimizer = ModelOptimizer()
                perf_metrics = optimizer.profile_model_performance(optimized_path, dummy_input)
                logging.info(f"Model {model_id} performance: {perf_metrics}")
            
            # Clean up temporary optimized file
            if optimized_path != model_path:
                os.unlink(optimized_path)
            
            logging.info(f"Successfully loaded ONNX model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load ONNX model {model_id}: {e}")
            return False
    
    def _extract_onnx_metadata(self, session: ort.InferenceSession) -> ModelMetadata:
        """Extract metadata from ONNX session."""
        input_info = {}
        input_types = {}
        for input_meta in session.get_inputs():
            input_info[input_meta.name] = list(input_meta.shape)
            input_types[input_meta.name] = input_meta.type
        
        output_info = {}
        output_types = {}
        for output_meta in session.get_outputs():
            output_info[output_meta.name] = list(output_meta.shape)
            output_types[output_meta.name] = output_meta.type
        
        # Estimate model size (rough approximation)
        model_size_mb = 10.0  # Placeholder - would need actual model file size
        
        return ModelMetadata(
            framework='onnx',
            input_shapes=input_info,
            output_shapes=output_info,
            input_types=input_types,
            output_types=output_types,
            model_size_mb=model_size_mb,
            optimization_level=self.config.optimization_level.value,
            hardware_target=self.config.hardware_target.value,
            supports_batching=True,
            max_batch_size=self.config.batch_size
        )
    
    async def _load_tensorflow_model(self, model_id: str, model_path: str, 
                                   model_config: Dict = None) -> bool:
        """Load TensorFlow model."""
        try:
            model = tf.saved_model.load(model_path)
            
            # Apply TensorFlow-specific optimizations
            if self.config.optimization_level != OptimizationLevel.NONE:
                # Convert to TensorFlow Lite if requested
                if self.config.use_quantization:
                    converter = tf.lite.TFLiteConverter.from_saved_model(model_path)
                    converter.optimizations = [tf.lite.Optimize.DEFAULT]
                    tflite_model = converter.convert()
                    
                    # Save quantized model
                    with tempfile.NamedTemporaryFile(suffix='.tflite', delete=False) as tmp_file:
                        tmp_file.write(tflite_model)
                        tflite_path = tmp_file.name
                    
                    # Load TensorFlow Lite interpreter
                    interpreter = tf.lite.Interpreter(model_path=tflite_path)
                    interpreter.allocate_tensors()
                    
                    self.loaded_models[model_id] = interpreter
                    os.unlink(tflite_path)
                else:
                    self.loaded_models[model_id] = model
            else:
                self.loaded_models[model_id] = model
            
            logging.info(f"Successfully loaded TensorFlow model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load TensorFlow model {model_id}: {e}")
            return False
    
    async def _load_pytorch_model(self, model_id: str, model_path: str, 
                                 model_config: Dict = None) -> bool:
        """Load PyTorch model."""
        try:
            model = torch.load(model_path, map_location='cpu')
            model.eval()
            
            # Apply PyTorch-specific optimizations
            if self.config.optimization_level != OptimizationLevel.NONE:
                # TorchScript compilation
                if hasattr(torch.jit, 'script'):
                    try:
                        model = torch.jit.script(model)
                        logging.info(f"Applied TorchScript optimization to {model_id}")
                    except:
                        logging.warning(f"TorchScript optimization failed for {model_id}, using regular model")
                
                # Move to GPU if requested and available
                if self.config.hardware_target == HardwareTarget.GPU and torch.cuda.is_available():
                    model = model.cuda()
                    logging.info(f"Moved model {model_id} to GPU")
            
            self.loaded_models[model_id] = model
            logging.info(f"Successfully loaded PyTorch model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load PyTorch model {model_id}: {e}")
            return False
    
    async def _load_sklearn_model(self, model_id: str, model_path: str, 
                                 model_config: Dict = None) -> bool:
        """Load scikit-learn model."""
        try:
            model = joblib.load(model_path)
            self.loaded_models[model_id] = model
            
            logging.info(f"Successfully loaded scikit-learn model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load scikit-learn model {model_id}: {e}")
            return False
    
    async def _load_xgboost_model(self, model_id: str, model_path: str, 
                                 model_config: Dict = None) -> bool:
        """Load XGBoost model."""
        try:
            model = xgb.Booster()
            model.load_model(model_path)
            self.loaded_models[model_id] = model
            
            logging.info(f"Successfully loaded XGBoost model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load XGBoost model {model_id}: {e}")
            return False
    
    async def _load_lightgbm_model(self, model_id: str, model_path: str, 
                                  model_config: Dict = None) -> bool:
        """Load LightGBM model."""
        try:
            model = lgb.Booster(model_file=model_path)
            self.loaded_models[model_id] = model
            
            logging.info(f"Successfully loaded LightGBM model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to load LightGBM model {model_id}: {e}")
            return False
    
    async def predict(self, model_id: str, input_data: Union[List[Dict], np.ndarray, pd.DataFrame],
                     return_probabilities: bool = False) -> Dict[str, Any]:
        """Run inference on loaded model."""
        start_time = time.perf_counter()
        
        try:
            if model_id not in self.loaded_models and model_id not in self.model_sessions:
                raise ValueError(f"Model {model_id} not loaded")
            
            # Use ONNX session if available
            if model_id in self.model_sessions:
                result = await self._predict_onnx(model_id, input_data)
            else:
                # Use framework-specific prediction
                metadata = self.model_metadata.get(model_id, {})
                framework = getattr(metadata, 'framework', 'unknown')
                
                if framework == 'tensorflow':
                    result = await self._predict_tensorflow(model_id, input_data)
                elif framework == 'pytorch':
                    result = await self._predict_pytorch(model_id, input_data)
                elif framework == 'sklearn':
                    result = await self._predict_sklearn(model_id, input_data, return_probabilities)
                elif framework == 'xgboost':
                    result = await self._predict_xgboost(model_id, input_data)
                elif framework == 'lightgbm':
                    result = await self._predict_lightgbm(model_id, input_data)
                else:
                    raise ValueError(f"Unsupported framework for prediction: {framework}")
            
            prediction_time = (time.perf_counter() - start_time) * 1000
            
            return {
                'predictions': result,
                'model_id': model_id,
                'prediction_time_ms': prediction_time,
                'batch_size': len(input_data) if isinstance(input_data, (list, np.ndarray)) else 1
            }
            
        except Exception as e:
            prediction_time = (time.perf_counter() - start_time) * 1000
            logging.error(f"Prediction failed for model {model_id}: {e}")
            raise e
    
    async def _predict_onnx(self, model_id: str, input_data: Union[List[Dict], np.ndarray]) -> List[Dict]:
        """Run ONNX inference."""
        session = self.model_sessions[model_id]
        
        # Prepare input data
        if isinstance(input_data, list):
            # Convert list of dicts to numpy array
            input_array = np.array([[v for v in item.values()] for item in input_data], dtype=np.float32)
        else:
            input_array = np.array(input_data, dtype=np.float32)
        
        # Get input name
        input_name = session.get_inputs()[0].name
        
        # Run inference
        outputs = session.run(None, {input_name: input_array})
        
        # Convert outputs to list of dicts
        results = []
        output_names = [output.name for output in session.get_outputs()]
        
        for i in range(len(input_array)):
            result = {}
            for j, output_name in enumerate(output_names):
                result[output_name] = outputs[j][i].tolist()
            results.append(result)
        
        return results
    
    async def _predict_tensorflow(self, model_id: str, input_data: Union[List[Dict], np.ndarray]) -> List[Dict]:
        """Run TensorFlow inference."""
        model = self.loaded_models[model_id]
        
        # Handle TensorFlow Lite
        if hasattr(model, 'get_input_details'):  # TFLite interpreter
            input_details = model.get_input_details()
            output_details = model.get_output_details()
            
            # Convert input data
            if isinstance(input_data, list):
                input_array = np.array([[v for v in item.values()] for item in input_data], dtype=np.float32)
            else:
                input_array = np.array(input_data, dtype=np.float32)
            
            results = []
            for sample in input_array:
                model.set_tensor(input_details[0]['index'], sample.reshape(1, -1))
                model.invoke()
                output = model.get_tensor(output_details[0]['index'])
                results.append({'prediction': output[0].tolist()})
            
            return results
        
        else:  # Regular TensorFlow model
            # Convert input data to tensor
            if isinstance(input_data, list):
                input_tensor = tf.constant([[v for v in item.values()] for item in input_data], dtype=tf.float32)
            else:
                input_tensor = tf.constant(input_data, dtype=tf.float32)
            
            # Run inference
            if hasattr(model, 'signatures'):
                # Use serving signature
                serve_func = model.signatures.get('serving_default') or list(model.signatures.values())[0]
                predictions = serve_func(input_tensor)
            else:
                # Direct model call
                predictions = model(input_tensor)
            
            # Convert to list of dicts
            results = []
            if isinstance(predictions, dict):
                # Multiple outputs
                output_keys = list(predictions.keys())
                batch_size = predictions[output_keys[0]].shape[0]
                
                for i in range(batch_size):
                    result = {}
                    for key, tensor in predictions.items():
                        result[key] = tensor[i].numpy().tolist()
                    results.append(result)
            else:
                # Single output
                pred_array = predictions.numpy()
                for pred in pred_array:
                    results.append({'prediction': pred.tolist()})
            
            return results
    
    async def _predict_pytorch(self, model_id: str, input_data: Union[List[Dict], np.ndarray]) -> List[Dict]:
        """Run PyTorch inference."""
        model = self.loaded_models[model_id]
        
        # Convert input data to tensor
        if isinstance(input_data, list):
            input_tensor = torch.tensor([[v for v in item.values()] for item in input_data], dtype=torch.float32)
        else:
            input_tensor = torch.tensor(input_data, dtype=torch.float32)
        
        # Move to GPU if model is on GPU
        if next(model.parameters()).is_cuda:
            input_tensor = input_tensor.cuda()
        
        # Run inference
        with torch.no_grad():
            predictions = model(input_tensor)
        
        # Convert to CPU and list of dicts
        predictions = predictions.cpu()
        results = []
        for pred in predictions:
            results.append({'prediction': pred.tolist()})
        
        return results
    
    async def _predict_sklearn(self, model_id: str, input_data: Union[List[Dict], np.ndarray],
                              return_probabilities: bool = False) -> List[Dict]:
        """Run scikit-learn inference."""
        model = self.loaded_models[model_id]
        
        # Convert input data to DataFrame/array
        if isinstance(input_data, list):
            input_df = pd.DataFrame(input_data)
        else:
            input_df = pd.DataFrame(input_data)
        
        # Make predictions
        predictions = model.predict(input_df)
        
        # Get probabilities if requested and available
        probabilities = None
        if return_probabilities and hasattr(model, 'predict_proba'):
            try:
                probabilities = model.predict_proba(input_df)
            except:
                pass
        
        # Convert to list of dicts
        results = []
        for i, pred in enumerate(predictions):
            result = {'prediction': pred}
            if probabilities is not None:
                result['probabilities'] = probabilities[i].tolist()
            results.append(result)
        
        return results
    
    async def _predict_xgboost(self, model_id: str, input_data: Union[List[Dict], np.ndarray]) -> List[Dict]:
        """Run XGBoost inference."""
        model = self.loaded_models[model_id]
        
        # Convert input data to DMatrix
        if isinstance(input_data, list):
            input_df = pd.DataFrame(input_data)
        else:
            input_df = pd.DataFrame(input_data)
        
        dmatrix = xgb.DMatrix(input_df)
        
        # Make predictions
        predictions = model.predict(dmatrix)
        
        # Convert to list of dicts
        results = []
        for pred in predictions:
            results.append({'prediction': float(pred)})
        
        return results
    
    async def _predict_lightgbm(self, model_id: str, input_data: Union[List[Dict], np.ndarray]) -> List[Dict]:
        """Run LightGBM inference."""
        model = self.loaded_models[model_id]
        
        # Convert input data
        if isinstance(input_data, list):
            input_df = pd.DataFrame(input_data)
        else:
            input_df = pd.DataFrame(input_data)
        
        # Make predictions
        predictions = model.predict(input_df.values)
        
        # Convert to list of dicts
        results = []
        for pred in predictions:
            results.append({'prediction': float(pred)})
        
        return results
    
    def unload_model(self, model_id: str) -> bool:
        """Unload model from memory."""
        try:
            if model_id in self.loaded_models:
                del self.loaded_models[model_id]
            if model_id in self.model_sessions:
                del self.model_sessions[model_id]
            if model_id in self.model_metadata:
                del self.model_metadata[model_id]
            
            logging.info(f"Successfully unloaded model {model_id}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to unload model {model_id}: {e}")
            return False
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get comprehensive model information."""
        if model_id not in self.loaded_models and model_id not in self.model_sessions:
            return {'error': 'Model not loaded'}
        
        metadata = self.model_metadata.get(model_id)
        
        info = {
            'model_id': model_id,
            'loaded': True,
            'framework_availability': FRAMEWORK_AVAILABILITY,
            'inference_config': {
                'batch_size': self.config.batch_size,
                'optimization_level': self.config.optimization_level.value,
                'hardware_target': self.config.hardware_target.value,
                'use_quantization': self.config.use_quantization
            }
        }
        
        if metadata:
            info.update({
                'framework': metadata.framework,
                'input_shapes': metadata.input_shapes,
                'output_shapes': metadata.output_shapes,
                'model_size_mb': metadata.model_size_mb,
                'supports_batching': metadata.supports_batching,
                'max_batch_size': metadata.max_batch_size
            })
        
        return info
    
    def get_loaded_models(self) -> List[str]:
        """Get list of loaded model IDs."""
        loaded = list(self.loaded_models.keys())
        loaded.extend(list(self.model_sessions.keys()))
        return list(set(loaded))


# Global inference engine instance
_inference_engine = None


def get_inference_engine(config: InferenceConfig = None) -> MultiFrameworkInferenceEngine:
    """Get global inference engine instance."""
    global _inference_engine
    if _inference_engine is None:
        _inference_engine = MultiFrameworkInferenceEngine(config)
    return _inference_engine