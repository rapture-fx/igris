#!/usr/bin/env python3
"""
Direct test of sensor drift correction without going through __init__.py
"""

import numpy as np
import pandas as pd
import sys
import os

# Add the API app to the path
sys.path.insert(0, '/Users/wira/Desktop/schlep-engine/apps/api/app')

# Import the class directly by executing the file
exec_globals = {}
try:
    with open('/Users/wira/Desktop/schlep-engine/apps/api/app/ml/data_quality.py', 'r') as f:
        exec(f.read(), exec_globals)
    
    SensorDriftCorrector = exec_globals['SensorDriftCorrector']
    print("✓ Successfully imported SensorDriftCorrector directly")
    
except Exception as e:
    print(f"✗ Failed to import SensorDriftCorrector: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


def create_test_data_with_drift():
    """Create test data with clear linear drift."""
    np.random.seed(42)
    n_points = 100
    
    # Temperature sensor with clear linear drift
    base_temp = 25.0 + 0.1 * np.random.normal(0, 1, n_points)
    drift = np.linspace(0, 3.0, n_points)  # 3°C drift over time
    temp_with_drift = base_temp + drift
    
    # Pressure sensor without drift (for comparison)
    pressure_clean = 100.0 + 0.2 * np.random.normal(0, 1, n_points)
    
    data = pd.DataFrame({
        'temperature': temp_with_drift,
        'pressure': pressure_clean
    })
    
    return data


def test_sensor_drift_correction():
    """Test the sensor drift correction functionality."""
    print("\n" + "="*60)
    print("SENSOR DRIFT CORRECTION TEST")
    print("="*60)
    
    # Create test data
    data = create_test_data_with_drift()
    print(f"Created test data: {data.shape}")
    print(f"Temperature range: {data['temperature'].min():.2f} - {data['temperature'].max():.2f}°C")
    print(f"Pressure range: {data['pressure'].min():.2f} - {data['pressure'].max():.2f} kPa")
    
    # Calculate original trend (should be positive due to drift)
    temp_values = data['temperature'].values
    x_original = np.arange(len(temp_values))
    
    # Manual linear regression for original trend
    x_mean = np.mean(x_original)
    y_mean = np.mean(temp_values)
    numerator = np.sum((x_original - x_mean) * (temp_values - y_mean))
    denominator = np.sum((x_original - x_mean)**2)
    original_slope = numerator / denominator
    
    print(f"\nOriginal temperature trend slope: {original_slope:.6f}°C per reading")
    print(f"Expected trend (3°C over {len(temp_values)} points): {3.0/len(temp_values):.6f}°C per reading")
    
    # Create sensor metadata
    metadata = {
        'temperature': {
            'sensor_type': 'temperature',
            'units': 'celsius',
            'reference_values': {
                'expected_range': [24.0, 26.0]
            }
        },
        'pressure': {
            'sensor_type': 'pressure',
            'units': 'kPa'
        }
    }
    
    # Initialize corrector
    try:
        corrector = SensorDriftCorrector()
        print("✓ SensorDriftCorrector initialized")
    except Exception as e:
        print(f"✗ Failed to initialize SensorDriftCorrector: {e}")
        return False
    
    # Apply drift correction
    try:
        print("\nApplying drift correction...")
        corrected_data, report = corrector.correct_sensor_drift(
            data=data,
            sensor_metadata=metadata,
            correction_strategy='auto'
        )
        
        print(f"✓ Drift correction completed")
        print(f"Status: {report.get('status')}")
        print(f"Corrections applied: {report.get('drift_corrections_applied', 0)}")
        
        # Analyze results
        if report.get('drift_corrections_applied', 0) > 0:
            print(f"\nDetected drift patterns:")
            
            for sensor, pattern in report.get('drift_patterns_detected', {}).items():
                if pattern.get('drift_detected', False):
                    print(f"  {sensor}:")
                    print(f"    - Type: {pattern.get('drift_type')}")
                    print(f"    - Confidence: {pattern.get('confidence', 0):.3f}")
                    print(f"    - Magnitude: {pattern.get('drift_magnitude', 0):.3f}")
            
            print(f"\nCorrections applied:")
            for sensor, correction in report.get('corrections_by_column', {}).items():
                print(f"  {sensor}:")
                print(f"    - Method: {correction.get('method')}")
                print(f"    - Status: {correction.get('status')}")
                if 'slope_removed' in correction:
                    print(f"    - Slope removed: {correction['slope_removed']:.6f}")
                if 'trend_magnitude' in correction:
                    print(f"    - Trend magnitude: {correction['trend_magnitude']:.3f}")
        
        # Check correction effectiveness
        temp_corrected = corrected_data['temperature'].values
        
        # Calculate corrected trend
        numerator_corr = np.sum((x_original - x_mean) * (temp_corrected - np.mean(temp_corrected)))
        corrected_slope = numerator_corr / denominator
        
        improvement = abs(original_slope) - abs(corrected_slope)
        improvement_pct = (improvement / abs(original_slope)) * 100 if original_slope != 0 else 0
        
        print(f"\nCorrection effectiveness:")
        print(f"  Original slope: {original_slope:.6f}°C per reading")
        print(f"  Corrected slope: {corrected_slope:.6f}°C per reading")
        print(f"  Improvement: {improvement:.6f}°C per reading ({improvement_pct:.1f}%)")
        
        # Check data quality metrics
        original_std = np.std(temp_values)
        corrected_std = np.std(temp_corrected)
        
        print(f"  Original std dev: {original_std:.3f}°C")
        print(f"  Corrected std dev: {corrected_std:.3f}°C")
        
        success = (
            report.get('drift_corrections_applied', 0) > 0 and
            abs(corrected_slope) < abs(original_slope) and
            improvement_pct > 50  # At least 50% improvement
        )
        
        return success
        
    except Exception as e:
        print(f"✗ Drift correction failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("Direct Test of Sensor Drift Correction Implementation")
    print("Testing industrial-grade drift detection and correction algorithms")
    
    success = test_sensor_drift_correction()
    
    if success:
        print(f"\n🎉 SENSOR DRIFT CORRECTION TEST PASSED!")
        print("The implementation successfully detected and corrected sensor drift.")
        print("Ready for production use in industrial sensor data processing.")
    else:
        print(f"\n❌ SENSOR DRIFT CORRECTION TEST FAILED!")
        print("The implementation needs further debugging.")
        sys.exit(1)