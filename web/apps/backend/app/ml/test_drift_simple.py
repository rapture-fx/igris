#!/usr/bin/env python3
"""
Simple test to verify sensor drift correction implementation.
"""

import numpy as np
import pandas as pd
import sys
import os

# Add the API app to the path
api_path = '/Users/wira/Desktop/schlep-engine/apps/api/app'
if api_path not in sys.path:
    sys.path.insert(0, api_path)

# Import the data quality module directly
try:
    from ml.data_quality import SensorDriftCorrector
    print("✓ Successfully imported SensorDriftCorrector")
except ImportError as e:
    print(f"✗ Failed to import SensorDriftCorrector: {e}")
    sys.exit(1)


def create_test_data():
    """Create simple test data with linear drift."""
    np.random.seed(42)
    n_points = 100
    
    # Base sensor reading around 25.0
    base_values = 25.0 + 0.5 * np.random.normal(0, 1, n_points)
    
    # Add linear drift
    drift = np.linspace(0, 2.0, n_points)  # 2-unit drift over time
    sensor_data = base_values + drift
    
    # Create DataFrame
    data = pd.DataFrame({
        'temperature': sensor_data,
        'pressure': 100.0 + 0.3 * np.random.normal(0, 1, n_points),  # No drift
    })
    
    return data


def test_drift_correction():
    """Test the drift correction functionality."""
    print("\n" + "="*50)
    print("Testing Sensor Drift Correction")
    print("="*50)
    
    # Create test data
    data = create_test_data()
    print(f"Created test data with shape: {data.shape}")
    print(f"Temperature range: {data['temperature'].min():.2f} to {data['temperature'].max():.2f}")
    
    # Create metadata
    metadata = {
        'temperature': {
            'sensor_type': 'temperature',
            'reference_values': {
                'expected_range': [24.0, 26.0]
            }
        },
        'pressure': {
            'sensor_type': 'pressure'
        }
    }
    
    # Initialize corrector
    corrector = SensorDriftCorrector()
    print("✓ SensorDriftCorrector initialized")
    
    # Apply correction
    try:
        corrected_data, report = corrector.correct_sensor_drift(
            data=data,
            sensor_metadata=metadata,
            correction_strategy='auto'
        )
        
        print(f"✓ Drift correction completed")
        print(f"Status: {report.get('status', 'unknown')}")
        print(f"Corrections applied: {report.get('drift_corrections_applied', 0)}")
        
        # Show results for temperature sensor
        if 'temperature' in report.get('drift_patterns_detected', {}):
            temp_analysis = report['drift_patterns_detected']['temperature']
            print(f"\nTemperature sensor analysis:")
            print(f"  Drift detected: {temp_analysis.get('drift_detected', False)}")
            print(f"  Confidence: {temp_analysis.get('confidence', 0.0):.3f}")
            print(f"  Drift type: {temp_analysis.get('drift_type', 'none')}")
        
        # Compare original vs corrected
        original_mean = data['temperature'].mean()
        corrected_mean = corrected_data['temperature'].mean()
        original_trend = data['temperature'].iloc[-10:].mean() - data['temperature'].iloc[:10].mean()
        corrected_trend = corrected_data['temperature'].iloc[-10:].mean() - corrected_data['temperature'].iloc[:10].mean()
        
        print(f"\nComparison (Temperature):")
        print(f"  Original mean: {original_mean:.3f}")
        print(f"  Corrected mean: {corrected_mean:.3f}")
        print(f"  Original trend (end-start): {original_trend:.3f}")
        print(f"  Corrected trend (end-start): {corrected_trend:.3f}")
        print(f"  Trend reduction: {abs(original_trend) - abs(corrected_trend):.3f}")
        
        return True
        
    except Exception as e:
        print(f"✗ Drift correction failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_drift_correction()
    if success:
        print(f"\n✓ Sensor drift correction test passed!")
    else:
        print(f"\n✗ Sensor drift correction test failed!")
        sys.exit(1)