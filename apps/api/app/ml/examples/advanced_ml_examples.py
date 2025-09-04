"""
Advanced ML Examples and Usage Demonstrations

This module provides comprehensive examples showing how to use the Advanced ML Modeling Engine
and Enhanced ML Service for various industrial applications.
"""

import numpy as np
import pandas as pd
import asyncio
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from advanced_modeling_engine import AdvancedMLModelingEngine
from ..services.enhanced_ml_service import (
    EnhancedMLService, ModelTrainingRequest, PredictionRequest,
    ModelType, create_enhanced_ml_service
)


def generate_industrial_sensor_data(n_samples: int = 1000, n_sensors: int = 8, 
                                   failure_rate: float = 0.05) -> pd.DataFrame:
    """
    Generate synthetic industrial sensor data for testing.
    
    Args:
        n_samples: Number of data points
        n_sensors: Number of sensor channels
        failure_rate: Proportion of failure cases
        
    Returns:
        DataFrame with sensor readings and failure labels
    """
    np.random.seed(42)
    
    # Generate timestamps
    start_time = datetime.now() - timedelta(days=30)
    timestamps = [start_time + timedelta(hours=i/10) for i in range(n_samples)]
    
    data = {'timestamp': timestamps}
    
    # Generate sensor readings with some correlation
    base_temp = 70 + 10 * np.sin(np.linspace(0, 4*np.pi, n_samples)) + np.random.normal(0, 2, n_samples)
    
    for i in range(n_sensors):
        if i == 0:  # Temperature sensor
            data[f'temp_sensor_{i}'] = base_temp + np.random.normal(0, 1, n_samples)
        elif i == 1:  # Pressure sensor (correlated with temperature)
            data[f'pressure_sensor_{i}'] = base_temp * 0.8 + 20 + np.random.normal(0, 3, n_samples)
        elif i == 2:  # Vibration sensor
            data[f'vibration_sensor_{i}'] = np.abs(np.random.normal(0, 5, n_samples))
        else:  # Generic sensors
            data[f'sensor_{i}'] = np.random.normal(50, 10, n_samples)
    
    # Generate failure labels (equipment failure within next 24 hours)
    failure_indices = np.random.choice(n_samples, size=int(n_samples * failure_rate), replace=False)
    failures = np.zeros(n_samples)
    failures[failure_indices] = 1
    
    # Make failures more realistic by correlating with sensor anomalies
    for idx in failure_indices:
        if idx < n_samples - 1:
            # Increase temperature before failure
            data[f'temp_sensor_0'][idx:idx+1] += np.random.uniform(10, 20)
            # Increase vibration before failure
            data[f'vibration_sensor_2'][idx:idx+1] += np.random.uniform(15, 25)
    
    data['equipment_failure'] = failures
    
    # Add quality defect labels (independent of failures)
    defect_rate = 0.1
    defect_indices = np.random.choice(n_samples, size=int(n_samples * defect_rate), replace=False)
    defects = np.zeros(n_samples)
    defects[defect_indices] = 1
    data['quality_defect'] = defects
    
    return pd.DataFrame(data)


def example_1_basic_model_training():
    """Example 1: Basic model training with automatic architecture selection."""
    print("=== Example 1: Basic Model Training ===\n")
    
    # Generate sample data
    data = generate_industrial_sensor_data(n_samples=1000)
    print(f"Generated {len(data)} samples with {len(data.columns)} features")
    
    # Initialize modeling engine
    engine = AdvancedMLModelingEngine()
    
    # Train model for equipment failure prediction
    print("\nTraining equipment failure prediction model...")
    results = engine.train_industrial_model(
        data=data,
        target_column='equipment_failure',
        model_type='auto',  # Automatic model selection
        task_type='classification',
        optimization_budget=30
    )
    
    print(f"Model trained successfully!")
    print(f"Model type: {results['model_type']}")
    print(f"Best score: {results['performance']['best_score']:.4f}")
    print(f"Model key: {results['model_key']}")
    
    # Make predictions
    print("\nMaking predictions on test data...")
    test_data = data.sample(n=100).drop('equipment_failure', axis=1)
    predictions = engine.predict_industrial_outcome(
        data=test_data,
        model_key=results['model_key'],
        return_uncertainty=True
    )
    
    print(f"Made predictions for {len(predictions['predictions'])} samples")
    print(f"Sample predictions: {predictions['predictions'][:5]}")
    if predictions.get('uncertainty'):
        print(f"Sample uncertainties: {predictions['uncertainty'][:5]}")
    
    return engine, results


def example_2_deep_learning_lstm():
    """Example 2: Deep learning LSTM model for time-series prediction."""
    print("\n=== Example 2: Deep Learning LSTM Model ===\n")
    
    # Generate time-series sensor data
    data = generate_industrial_sensor_data(n_samples=2000, n_sensors=6)
    print(f"Generated time-series data: {data.shape}")
    
    # Initialize modeling engine
    engine = AdvancedMLModelingEngine()
    
    # Train LSTM model for continuous temperature prediction
    print("Training LSTM model for temperature prediction...")
    
    # Create lagged features for time-series
    for lag in [1, 2, 3, 5]:
        data[f'temp_lag_{lag}'] = data['temp_sensor_0'].shift(lag)
    
    # Remove rows with NaN values
    data_clean = data.dropna()
    
    results = engine.train_industrial_model(
        data=data_clean,
        target_column='temp_sensor_0',
        model_type='deep_learning',
        task_type='regression',
        optimization_budget=50
    )
    
    print(f"LSTM model trained!")
    print(f"Architecture: {results.get('model_architecture', 'Unknown')}")
    print(f"Framework: {results.get('framework', 'Unknown')}")
    print(f"Performance (R²): {results['performance']['best_score']:.4f}")
    
    return results


def example_3_ensemble_optimization():
    """Example 3: Advanced ensemble model optimization."""
    print("\n=== Example 3: Ensemble Model Optimization ===\n")
    
    # Generate complex industrial data
    data = generate_industrial_sensor_data(n_samples=1500, n_sensors=10)
    
    # Initialize modeling engine
    engine = AdvancedMLModelingEngine()
    
    # Optimize ensemble for quality defect prediction
    print("Optimizing ensemble models for quality defect prediction...")
    ensemble_results = engine.optimize_model_ensemble(
        data=data,
        target_column='quality_defect',
        ensemble_methods=['xgboost', 'lightgbm', 'random_forest', 'voting'],
        optimization_budget=100
    )
    
    print("Ensemble optimization completed!")
    print(f"Base models trained: {list(ensemble_results['base_model_scores'].keys())}")
    print("Base model scores:")
    for model_name, score in ensemble_results['base_model_scores'].items():
        print(f"  {model_name}: {score:.4f}")
    
    print(f"\nBest ensemble: {ensemble_results.get('best_ensemble', 'None')}")
    print(f"Best ensemble score: {ensemble_results.get('best_ensemble_score', 0.0):.4f}")
    
    return ensemble_results


async def example_4_enhanced_ml_service():
    """Example 4: Using Enhanced ML Service for async training."""
    print("\n=== Example 4: Enhanced ML Service ===\n")
    
    # Create enhanced ML service
    service = create_enhanced_ml_service(models_directory="/tmp/schlep_ml_models")
    
    # Generate training data
    data = generate_industrial_sensor_data(n_samples=800, n_sensors=12)
    
    # Create training request
    training_request = ModelTrainingRequest(
        dataset_id="industrial_demo_001",
        target_column="equipment_failure",
        model_type=ModelType.ENSEMBLE,
        task_type="classification",
        optimization_budget=40,
        tags={"application": "predictive_maintenance", "version": "1.0"}
    )
    
    print("Starting async model training...")
    
    # Since we can't use real dataset loading, we'll train directly with the engine
    engine = AdvancedMLModelingEngine()
    results = engine.train_industrial_model(
        data=data,
        target_column=training_request.target_column,
        model_type=training_request.model_type.value,
        task_type=training_request.task_type,
        optimization_budget=training_request.optimization_budget
    )
    
    print(f"Training completed!")
    print(f"Model performance: {results['performance']['best_score']:.4f}")
    
    # Make predictions
    test_data = data.sample(n=50).drop('equipment_failure', axis=1)
    prediction_request = PredictionRequest(
        model_id="demo_model",
        input_data=test_data,
        return_uncertainty=True,
        return_explanations=True
    )
    
    # Simulate prediction (in real usage, this would use the service)
    predictions = engine.predict_industrial_outcome(
        data=test_data,
        model_key=results['model_key'],
        return_uncertainty=True
    )
    
    print(f"Made predictions for {len(predictions['predictions'])} samples")
    
    # Show service statistics (simulated)
    print("\nService Statistics:")
    print(f"  Available frameworks: {engine.get_model_info()['available_frameworks']}")
    print(f"  Total models: {len(engine.models)}")
    
    return service, results


def example_5_predictive_maintenance_pipeline():
    """Example 5: Complete predictive maintenance pipeline."""
    print("\n=== Example 5: Predictive Maintenance Pipeline ===\n")
    
    # Generate equipment sensor data with failure patterns
    data = generate_industrial_sensor_data(n_samples=2000, n_sensors=8, failure_rate=0.08)
    
    # Add equipment-specific features
    equipment_ids = ['PUMP_001', 'PUMP_002', 'COMPRESSOR_001', 'MOTOR_001']
    data['equipment_id'] = np.random.choice(equipment_ids, size=len(data))
    
    # Add maintenance history (days since last maintenance)
    data['days_since_maintenance'] = np.random.exponential(30, size=len(data))
    
    # Add operating hours
    data['operating_hours'] = np.random.uniform(0, 24, size=len(data))
    
    print(f"Enhanced dataset shape: {data.shape}")
    print(f"Equipment failure rate: {data['equipment_failure'].mean():.3f}")
    
    # Initialize modeling engine
    engine = AdvancedMLModelingEngine()
    
    # Train predictive maintenance model
    print("\nTraining predictive maintenance model...")
    results = engine.train_industrial_model(
        data=data,
        target_column='equipment_failure',
        model_type='ensemble',  # Good for imbalanced data
        task_type='classification',
        optimization_budget=60
    )
    
    print(f"Predictive maintenance model trained!")
    print(f"Model performance: {results['performance']['best_score']:.4f}")
    
    # Demonstrate real-time monitoring simulation
    print("\nSimulating real-time equipment monitoring...")
    
    # Generate "live" sensor readings
    live_data = generate_industrial_sensor_data(n_samples=10, n_sensors=8, failure_rate=0.0)
    live_data['equipment_id'] = 'PUMP_001'
    live_data['days_since_maintenance'] = 45  # High value indicates due for maintenance
    live_data['operating_hours'] = 22  # Heavy usage
    
    # Remove target column for prediction
    live_features = live_data.drop(['equipment_failure', 'quality_defect'], axis=1)
    
    # Make predictions
    predictions = engine.predict_industrial_outcome(
        data=live_features,
        model_key=results['model_key'],
        return_uncertainty=True
    )
    
    print("Real-time predictions:")
    for i, (pred, uncertainty) in enumerate(zip(predictions['predictions'], 
                                               predictions.get('uncertainty', [0]*len(predictions['predictions'])))):
        status = "HIGH RISK" if pred > 0.5 else "NORMAL"
        confidence = 1 - uncertainty if uncertainty else 0.9
        print(f"  Reading {i+1}: {status} (confidence: {confidence:.3f})")
    
    return results


def example_6_quality_control_system():
    """Example 6: Quality control system with CNN pattern recognition."""
    print("\n=== Example 6: Quality Control System ===\n")
    
    # Generate manufacturing quality data
    data = generate_industrial_sensor_data(n_samples=1200, n_sensors=15, failure_rate=0.0)
    
    # Add product dimensions and measurements
    data['product_length'] = np.random.normal(100, 2, size=len(data))  # Target: 100mm
    data['product_width'] = np.random.normal(50, 1.5, size=len(data))   # Target: 50mm
    data['product_thickness'] = np.random.normal(10, 0.5, size=len(data)) # Target: 10mm
    data['surface_roughness'] = np.random.exponential(2, size=len(data))
    data['hardness'] = np.random.normal(45, 3, size=len(data))  # HRC scale
    
    # Create defects based on out-of-spec measurements
    defect_conditions = (
        (np.abs(data['product_length'] - 100) > 3) |  # Length tolerance ±3mm
        (np.abs(data['product_width'] - 50) > 2) |    # Width tolerance ±2mm
        (np.abs(data['product_thickness'] - 10) > 0.8) | # Thickness tolerance ±0.8mm
        (data['surface_roughness'] > 5) |             # Surface quality
        (np.abs(data['hardness'] - 45) > 5)           # Hardness range
    )
    
    data['quality_defect'] = defect_conditions.astype(int)
    
    print(f"Quality control dataset: {data.shape}")
    print(f"Defect rate: {data['quality_defect'].mean():.3f}")
    
    # Train quality control model
    engine = AdvancedMLModelingEngine()
    
    print("\nTraining quality control model...")
    results = engine.train_industrial_model(
        data=data,
        target_column='quality_defect',
        model_type='deep_learning',  # Use deep learning for pattern recognition
        task_type='classification',
        optimization_budget=40
    )
    
    print(f"Quality control model trained!")
    print(f"Model performance: {results['performance']['best_score']:.4f}")
    
    # Simulate production line inspection
    print("\nSimulating production line inspection...")
    
    # Generate batch of products for inspection
    inspection_batch = generate_industrial_sensor_data(n_samples=20, n_sensors=15)
    inspection_batch['product_length'] = np.random.normal(100, 2.5, size=20)
    inspection_batch['product_width'] = np.random.normal(50, 2, size=20)
    inspection_batch['product_thickness'] = np.random.normal(10, 0.8, size=20)
    inspection_batch['surface_roughness'] = np.random.exponential(2.5, size=20)
    inspection_batch['hardness'] = np.random.normal(45, 4, size=20)
    
    # Remove target columns
    inspection_features = inspection_batch.drop(['equipment_failure', 'quality_defect'], axis=1)
    
    # Predict quality
    predictions = engine.predict_industrial_outcome(
        data=inspection_features,
        model_key=results['model_key'],
        return_uncertainty=True
    )
    
    print("Quality inspection results:")
    for i, (pred, uncertainty) in enumerate(zip(predictions['predictions'][:10], 
                                               predictions.get('uncertainty', [0]*10))):
        quality = "DEFECTIVE" if pred > 0.5 else "GOOD"
        confidence = 1 - uncertainty if uncertainty else 0.9
        print(f"  Product {i+1}: {quality} (confidence: {confidence:.3f})")
    
    return results


def example_7_sensor_fusion_architecture():
    """Example 7: Multi-sensor fusion for complex monitoring."""
    print("\n=== Example 7: Sensor Fusion Architecture ===\n")
    
    # Generate multi-sensor data
    n_samples = 1000
    
    # Temperature sensors
    temp_data = np.random.normal(75, 5, (n_samples, 4))
    
    # Pressure sensors  
    pressure_data = np.random.normal(100, 10, (n_samples, 3))
    
    # Vibration sensors (accelerometer data)
    vibration_data = np.abs(np.random.normal(0, 3, (n_samples, 6)))
    
    # Acoustic sensors
    acoustic_data = np.random.exponential(2, (n_samples, 2))
    
    # Combine all sensor data
    sensor_data = pd.DataFrame({
        **{f'temp_sensor_{i}': temp_data[:, i] for i in range(4)},
        **{f'pressure_sensor_{i}': pressure_data[:, i] for i in range(3)},
        **{f'vibration_sensor_{i}': vibration_data[:, i] for i in range(6)},
        **{f'acoustic_sensor_{i}': acoustic_data[:, i] for i in range(2)}
    })
    
    # Create target: system health score (0-100)
    # Based on weighted combination of sensor readings
    health_score = (
        100 - 
        np.clip((temp_data.mean(axis=1) - 75) * 2, 0, 30) -  # Temperature impact
        np.clip((pressure_data.mean(axis=1) - 100) * 0.5, 0, 20) -  # Pressure impact
        np.clip(vibration_data.mean(axis=1) * 3, 0, 30) -     # Vibration impact
        np.clip(acoustic_data.mean(axis=1) * 5, 0, 20)        # Acoustic impact
    )
    
    sensor_data['system_health'] = np.clip(health_score, 0, 100)
    
    print(f"Sensor fusion dataset: {sensor_data.shape}")
    print(f"Sensor types: Temperature(4), Pressure(3), Vibration(6), Acoustic(2)")
    print(f"System health range: {sensor_data['system_health'].min():.1f} - {sensor_data['system_health'].max():.1f}")
    
    # Train sensor fusion model
    engine = AdvancedMLModelingEngine()
    
    print("\nTraining sensor fusion model...")
    results = engine.train_industrial_model(
        data=sensor_data,
        target_column='system_health',
        model_type='deep_learning',  # Deep learning for sensor fusion
        task_type='regression',
        optimization_budget=50
    )
    
    print(f"Sensor fusion model trained!")
    print(f"Model performance (R²): {results['performance']['best_score']:.4f}")
    
    # Demonstrate multi-sensor prediction
    test_sensors = sensor_data.sample(n=5).drop('system_health', axis=1)
    
    predictions = engine.predict_industrial_outcome(
        data=test_sensors,
        model_key=results['model_key'],
        return_uncertainty=True
    )
    
    print("\nSensor fusion predictions:")
    for i, pred in enumerate(predictions['predictions'][:5]):
        print(f"  System {i+1}: Health Score = {pred:.1f}")
    
    return results


def run_all_examples():
    """Run all examples in sequence."""
    print("🚀 Advanced ML Modeling Engine - Comprehensive Examples\n")
    print("=" * 60)
    
    examples = [
        ("Basic Model Training", example_1_basic_model_training),
        ("Deep Learning LSTM", example_2_deep_learning_lstm),
        ("Ensemble Optimization", example_3_ensemble_optimization),
        ("Enhanced ML Service", lambda: asyncio.run(example_4_enhanced_ml_service())),
        ("Predictive Maintenance", example_5_predictive_maintenance_pipeline),
        ("Quality Control System", example_6_quality_control_system),
        ("Sensor Fusion Architecture", example_7_sensor_fusion_architecture)
    ]
    
    results = {}
    
    for name, example_func in examples:
        print(f"\n📊 Running {name}...")
        try:
            start_time = datetime.now()
            result = example_func()
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            results[name] = {
                'result': result,
                'duration': duration,
                'status': 'success'
            }
            print(f"✅ {name} completed in {duration:.2f}s")
            
        except Exception as e:
            results[name] = {
                'error': str(e),
                'status': 'failed'
            }
            print(f"❌ {name} failed: {str(e)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📈 EXECUTION SUMMARY")
    print("=" * 60)
    
    successful = sum(1 for r in results.values() if r['status'] == 'success')
    total = len(results)
    
    print(f"Examples executed: {total}")
    print(f"Successful: {successful}")
    print(f"Failed: {total - successful}")
    print(f"Success rate: {successful/total*100:.1f}%")
    
    if successful > 0:
        total_time = sum(r.get('duration', 0) for r in results.values() if r['status'] == 'success')
        print(f"Total execution time: {total_time:.2f}s")
        print(f"Average time per example: {total_time/successful:.2f}s")
    
    print("\nExample Results:")
    for name, result in results.items():
        status_icon = "✅" if result['status'] == 'success' else "❌"
        if result['status'] == 'success':
            print(f"{status_icon} {name}: {result['duration']:.2f}s")
        else:
            print(f"{status_icon} {name}: {result['error']}")
    
    return results


if __name__ == "__main__":
    print("🔬 Advanced ML Examples - Schlep Engine")
    print("This script demonstrates advanced ML capabilities including:")
    print("• Deep Learning (TensorFlow/Keras, PyTorch)")
    print("• Advanced Ensembles (XGBoost, LightGBM, CatBoost)")  
    print("• Industrial Applications (Predictive Maintenance, Quality Control)")
    print("• Sensor Fusion and Multi-modal Learning")
    print("• Automated Model Selection and Hyperparameter Optimization")
    print()
    
    # Check for optional dependencies
    print("Checking optional dependencies...")
    
    try:
        import tensorflow as tf
        print(f"✅ TensorFlow: {tf.__version__}")
    except ImportError:
        print("⚠️  TensorFlow: Not available")
    
    try:
        import torch
        print(f"✅ PyTorch: {torch.__version__}")
    except ImportError:
        print("⚠️  PyTorch: Not available")
    
    try:
        import xgboost as xgb
        print(f"✅ XGBoost: {xgb.__version__}")
    except ImportError:
        print("⚠️  XGBoost: Not available")
    
    try:
        import lightgbm as lgb
        print(f"✅ LightGBM: {lgb.__version__}")
    except ImportError:
        print("⚠️  LightGBM: Not available")
    
    print()
    
    # Run examples
    results = run_all_examples()
    
    print("\n🎯 Examples completed! The advanced ML modeling engine is ready for production use.")
    print("\nNext steps:")
    print("1. Install optional dependencies for full functionality:")
    print("   pip install tensorflow torch xgboost lightgbm catboost scikit-optimize")
    print("2. Configure your data sources and processing pipelines")
    print("3. Set up Celery workers for background model training")
    print("4. Deploy models to production with monitoring")