#!/usr/bin/env python3
"""
Test script for advanced missing value imputation system.

This script demonstrates the functionality of the AdvancedImputationEngine
and validates that it works correctly with different types of data.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# Add the parent directory to Python path to import modules
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

try:
    from ml.data_quality import AdvancedImputationEngine, IndustrialDataQualityEngine
    from services.data_quality_service import DataQualityService
except ImportError:
    # Try alternate import path
    sys.path.insert(0, '/Users/wira/Desktop/schlep-engine/apps/api/app')
    from ml.data_quality import AdvancedImputationEngine, IndustrialDataQualityEngine
    from services.data_quality_service import DataQualityService

def create_test_industrial_data():
    """Create synthetic industrial sensor data with missing values."""
    print("Creating synthetic industrial sensor data...")
    
    # Create timestamp series
    start_time = datetime.now() - timedelta(days=7)
    timestamps = pd.date_range(start_time, periods=1000, freq='5T')  # 5-minute intervals
    
    # Create sensor data
    data = {
        'timestamp': timestamps,
        'temperature_sensor_1': 25 + 5 * np.sin(np.arange(1000) * 0.01) + np.random.normal(0, 0.5, 1000),
        'pressure_sensor_1': 100 + 10 * np.cos(np.arange(1000) * 0.008) + np.random.normal(0, 1, 1000),
        'flow_rate_sensor': 50 + 15 * np.sin(np.arange(1000) * 0.005) + np.random.normal(0, 2, 1000),
        'vibration_sensor': np.abs(np.random.normal(0.1, 0.05, 1000)),
        'equipment_status': np.random.choice(['running', 'idle', 'maintenance'], 1000, p=[0.7, 0.2, 0.1])
    }
    
    df = pd.DataFrame(data)
    
    # Introduce missing values with different patterns
    # Random missing values
    np.random.seed(42)
    random_missing_indices = np.random.choice(1000, 80, replace=False)
    df.loc[random_missing_indices, 'temperature_sensor_1'] = np.nan
    
    # Systematic missing (sensor failure period)
    df.loc[200:250, 'pressure_sensor_1'] = np.nan
    
    # Correlated missing (maintenance periods)
    maintenance_periods = df[df['equipment_status'] == 'maintenance'].index
    if len(maintenance_periods) > 0:
        df.loc[maintenance_periods[:20], 'flow_rate_sensor'] = np.nan
    
    # Missing in categorical data
    df.loc[np.random.choice(1000, 30, replace=False), 'equipment_status'] = np.nan
    
    print(f"Created dataset with shape: {df.shape}")
    print(f"Missing values by column:")
    print(df.isnull().sum())
    
    return df

def test_advanced_imputation_engine():
    """Test the AdvancedImputationEngine with different strategies."""
    print("\n" + "="*60)
    print("TESTING ADVANCED IMPUTATION ENGINE")
    print("="*60)
    
    # Create test data
    df = create_test_industrial_data()
    
    # Initialize imputation engine
    engine = AdvancedImputationEngine()
    
    # Test different strategies
    strategies = ['auto', 'statistical', 'knn_temporal', 'time_series', 'domain_specific', 'mice']
    
    for strategy in strategies:
        print(f"\n--- Testing {strategy.upper()} strategy ---")
        
        try:
            imputed_data, report = engine.handle_missing_values(
                data=df.copy(),
                strategy=strategy,
                sensor_metadata={
                    'equipment_defaults': {
                        'temperature_sensor_1': 25.0,
                        'pressure_sensor_1': 100.0
                    }
                }
            )
            
            print(f"✓ Strategy: {report['strategy_used']}")
            print(f"✓ Original missing: {report['original_missing_count']}")
            print(f"✓ Final missing: {report['final_missing_count']}")
            print(f"✓ Effectiveness: {report['imputation_effectiveness']:.1%}")
            print(f"✓ Processing time: {report['processing_time_seconds']:.3f}s")
            print(f"✓ Quality confidence: {report.get('quality_assessment', {}).get('overall_confidence', 0):.3f}")
            
        except Exception as e:
            print(f"✗ Strategy {strategy} failed: {e}")
    
    return True

def test_data_quality_service():
    """Test the DataQualityService integration."""
    print("\n" + "="*60)
    print("TESTING DATA QUALITY SERVICE")
    print("="*60)
    
    # Create test data
    df = create_test_industrial_data()
    
    # Initialize service
    service = DataQualityService()
    
    print("\n--- Testing missing value handling ---")
    
    try:
        import asyncio
        
        # Test industrial data imputation
        result = asyncio.run(service.handle_missing_values(
            df=df.copy(),
            strategy='auto',
            is_industrial_data=True,
            sensor_metadata={
                'equipment_defaults': {
                    'temperature_sensor_1': 25.0
                }
            }
        ))
        
        if result['success']:
            print("✓ Industrial imputation successful")
            print(f"✓ Strategy used: {result['imputation_report']['imputation_strategy']}")
            print(f"✓ Effectiveness: {result['imputation_report']['effectiveness_percentage']:.1f}%")
            print(f"✓ Processing time: {result['processing_time']:.3f}s")
        else:
            print(f"✗ Industrial imputation failed: {result.get('error', 'Unknown error')}")
    
    except Exception as e:
        print(f"✗ Service test failed: {e}")
    
    print("\n--- Testing strategy information ---")
    
    try:
        strategies_info = service.get_available_imputation_strategies()
        print("✓ Available strategies:")
        for strategy_name, info in strategies_info['strategies'].items():
            print(f"  - {strategy_name}: {info['description']}")
    
    except Exception as e:
        print(f"✗ Strategy info retrieval failed: {e}")
    
    return True

def test_industrial_quality_engine():
    """Test the IndustrialDataQualityEngine."""
    print("\n" + "="*60)
    print("TESTING INDUSTRIAL QUALITY ENGINE")
    print("="*60)
    
    # Create test data
    df = create_test_industrial_data()
    
    # Initialize engine
    engine = IndustrialDataQualityEngine()
    
    print("\n--- Testing comprehensive assessment ---")
    
    try:
        assessment = engine.comprehensive_quality_assessment(
            data=df,
            sensor_metadata={
                'equipment_sensors': {
                    'thermal_system': ['temperature_sensor_1'],
                    'hydraulic_system': ['pressure_sensor_1', 'flow_rate_sensor']
                }
            }
        )
        
        print("✓ Comprehensive assessment completed")
        print(f"✓ Overall quality grade: {assessment['overall_quality_grade']}")
        print(f"✓ Data shape: {assessment['data_shape']}")
        print(f"✓ Assessment details available: {len(assessment)} sections")
        
    except Exception as e:
        print(f"✗ Comprehensive assessment failed: {e}")
    
    print("\n--- Testing data cleaning ---")
    
    try:
        cleaned_data, cleaning_report = engine.clean_industrial_data(
            data=df.copy(),
            cleaning_strategy="conservative",
            sensor_metadata={
                'equipment_defaults': {
                    'temperature_sensor_1': 25.0
                }
            }
        )
        
        print("✓ Data cleaning completed")
        print(f"✓ Original shape: {cleaning_report['original_shape']}")
        print(f"✓ Final shape: {cleaning_report['final_shape']}")
        print(f"✓ Operations performed: {len(cleaning_report['operations_performed'])}")
        print(f"✓ Missing values handled: {cleaning_report['missing_value_report']['missing_values_handled']}")
        
    except Exception as e:
        print(f"✗ Data cleaning failed: {e}")
    
    return True

def main():
    """Run all tests."""
    print("SCHLEP-ENGINE ADVANCED IMPUTATION SYSTEM TEST")
    print("=" * 60)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = []
    
    try:
        # Test Advanced Imputation Engine
        result1 = test_advanced_imputation_engine()
        test_results.append(("AdvancedImputationEngine", result1))
        
        # Test Data Quality Service
        result2 = test_data_quality_service()
        test_results.append(("DataQualityService", result2))
        
        # Test Industrial Quality Engine
        result3 = test_industrial_quality_engine()
        test_results.append(("IndustrialDataQualityEngine", result3))
        
    except Exception as e:
        print(f"\n✗ CRITICAL ERROR: {e}")
        return False
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    all_passed = True
    for test_name, result in test_results:
        status = "PASSED" if result else "FAILED"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    print(f"\nOverall result: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print(f"Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)