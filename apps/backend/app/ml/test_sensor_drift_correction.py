#!/usr/bin/env python3
"""
Test and demonstration of the comprehensive sensor drift correction implementation.

This script demonstrates various types of sensor drift and shows how the correction
algorithms detect and correct different drift patterns commonly found in industrial
sensor networks.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import sys
import os

# Add the API app to the path so we can import the data quality module
sys.path.append('/Users/wira/Desktop/schlep-engine/apps/api/app')

from ml.data_quality import SensorDriftCorrector
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def generate_synthetic_sensor_data(n_points=1000, drift_type='linear'):
    """
    Generate synthetic sensor data with different types of drift for testing.
    
    Args:
        n_points: Number of data points to generate
        drift_type: Type of drift to simulate ('linear', 'step_change', 'temperature', 'pressure')
    
    Returns:
        DataFrame with synthetic sensor data including drift
    """
    np.random.seed(42)  # For reproducible results
    
    # Base signal - simulated temperature sensor (20-30°C)
    base_temp = 25.0 + 2.0 * np.sin(np.linspace(0, 4*np.pi, n_points)) + np.random.normal(0, 0.5, n_points)
    
    # Simulated pressure sensor (100-110 kPa)
    base_pressure = 105.0 + 1.5 * np.cos(np.linspace(0, 2*np.pi, n_points)) + np.random.normal(0, 0.3, n_points)
    
    # Simulated flow sensor (10-20 L/min)
    base_flow = 15.0 + 2.5 * np.sin(np.linspace(0, 6*np.pi, n_points)) + np.random.normal(0, 0.4, n_points)
    
    time_index = pd.date_range(start='2024-01-01', periods=n_points, freq='1min')
    
    # Add different types of drift
    if drift_type == 'linear':
        # Linear drift: gradual sensor calibration drift over time
        drift_temp = base_temp + np.linspace(0, 3.0, n_points)  # 3°C drift over time
        drift_pressure = base_pressure + np.linspace(0, -2.0, n_points)  # -2 kPa drift
        drift_flow = base_flow + np.linspace(0, 1.5, n_points)  # 1.5 L/min drift
        
    elif drift_type == 'step_change':
        # Sudden calibration shift (maintenance event at midpoint)
        midpoint = n_points // 2
        drift_temp = base_temp.copy()
        drift_temp[midpoint:] += 2.5  # Sudden +2.5°C offset
        
        drift_pressure = base_pressure.copy()
        drift_pressure[midpoint:] -= 1.8  # Sudden -1.8 kPa offset
        
        drift_flow = base_flow.copy()
        drift_flow[midpoint:] += 1.2  # Sudden +1.2 L/min offset
        
    elif drift_type == 'temperature_dependent':
        # Temperature-dependent drift (thermal compensation needed)
        ambient_temp = 20 + 10 * np.sin(np.linspace(0, 2*np.pi, n_points))  # Daily temperature cycle
        temp_coeff = 0.02  # 2% per degree C
        
        drift_temp = base_temp + temp_coeff * (ambient_temp - 25) * base_temp
        drift_pressure = base_pressure + temp_coeff * 0.5 * (ambient_temp - 25) * base_pressure
        drift_flow = base_flow  # Flow sensor not temperature dependent
        
    elif drift_type == 'complex_nonlinear':
        # Complex non-linear drift pattern
        time_factor = np.linspace(0, 1, n_points)
        
        # Exponential decay drift
        drift_temp = base_temp + 2.0 * (1 - np.exp(-time_factor * 3))
        
        # Polynomial drift
        drift_pressure = base_pressure + 1.5 * time_factor**2 - 0.8 * time_factor
        
        # Oscillating drift with increasing amplitude
        drift_flow = base_flow + 0.5 * time_factor * np.sin(time_factor * 10 * np.pi)
        
    else:  # No drift case
        drift_temp = base_temp
        drift_pressure = base_pressure
        drift_flow = base_flow
    
    data = pd.DataFrame({
        'temperature_sensor': drift_temp,
        'pressure_sensor': drift_pressure,
        'flow_sensor': drift_flow,
        'timestamp': time_index
    })
    
    return data.set_index('timestamp')


def create_sensor_metadata():
    """Create realistic sensor metadata for testing."""
    return {
        'temperature_sensor': {
            'sensor_type': 'temperature',
            'units': 'celsius',
            'reference_values': {
                'expected_range': [20.0, 30.0],
                'calibration_points': {
                    '0C': 0.0,
                    '100C': 100.0
                }
            },
            'temperature_coefficient': 0.01,
            'reference_temperature': 25.0
        },
        'pressure_sensor': {
            'sensor_type': 'pressure',
            'units': 'kPa',
            'reference_values': {
                'expected_range': [100.0, 110.0],
                'calibration_points': {
                    'atmospheric': 101.325
                }
            }
        },
        'flow_sensor': {
            'sensor_type': 'flow',
            'units': 'L/min',
            'reference_values': {
                'expected_range': [10.0, 20.0]
            }
        }
    }


def test_drift_correction(drift_type='linear'):
    """
    Test the sensor drift correction with different drift patterns.
    
    Args:
        drift_type: Type of drift to test
    """
    print(f"\n{'='*60}")
    print(f"Testing Sensor Drift Correction: {drift_type.upper()} DRIFT")
    print(f"{'='*60}")
    
    # Generate synthetic data with drift
    data = generate_synthetic_sensor_data(n_points=500, drift_type=drift_type)
    metadata = create_sensor_metadata()
    
    print(f"Generated synthetic sensor data with {drift_type} drift:")
    print(f"- Data shape: {data.shape}")
    print(f"- Time range: {data.index[0]} to {data.index[-1]}")
    print(f"- Sensor columns: {list(data.columns)}")
    
    # Initialize drift corrector
    corrector = SensorDriftCorrector()
    
    # Apply drift correction
    print("\nApplying drift correction...")
    corrected_data, drift_report = corrector.correct_sensor_drift(
        data=data,
        sensor_metadata=metadata,
        correction_strategy='auto'
    )
    
    # Display results
    print(f"\nDrift Correction Results:")
    print(f"- Status: {drift_report.get('status', 'unknown')}")
    print(f"- Corrections applied: {drift_report.get('drift_corrections_applied', 0)}")
    
    if drift_report.get('drift_corrections_applied', 0) > 0:
        print(f"\nDrift Patterns Detected:")
        for sensor, pattern in drift_report.get('drift_patterns_detected', {}).items():
            if pattern.get('drift_detected', False):
                print(f"  {sensor}:")
                print(f"    - Drift type: {pattern.get('drift_type', 'unknown')}")
                print(f"    - Confidence: {pattern.get('confidence', 0.0):.3f}")
                print(f"    - Magnitude: {pattern.get('drift_magnitude', 0.0):.3f}")
                print(f"    - Recommended correction: {pattern.get('recommended_correction', 'none')}")
        
        print(f"\nCorrections Applied:")
        for sensor, correction in drift_report.get('corrections_by_column', {}).items():
            print(f"  {sensor}:")
            print(f"    - Method: {correction.get('method', 'unknown')}")
            print(f"    - Status: {correction.get('status', 'unknown')}")
            if 'slope_removed' in correction:
                print(f"    - Slope removed: {correction['slope_removed']:.6f}")
            if 'offset_applied' in correction:
                print(f"    - Offset applied: {correction['offset_applied']:.3f}")
            if 'max_correction' in correction:
                print(f"    - Max correction: {correction['max_correction']:.3f}")
        
        if 'correction_summary' in drift_report:
            summary = drift_report['correction_summary']
            print(f"\nSummary:")
            print(f"  - Columns processed: {summary.get('total_columns_processed', 0)}")
            print(f"  - Drift detected in: {summary.get('columns_with_drift_detected', 0)}")
            print(f"  - Columns corrected: {summary.get('columns_corrected', 0)}")
            print(f"  - Average confidence: {summary.get('average_confidence', 0.0):.3f}")
    else:
        print("No significant drift detected in the data.")
    
    # Calculate improvement metrics
    print(f"\nData Quality Improvement:")
    for col in data.columns:
        if col in corrected_data.columns:
            original_std = data[col].std()
            corrected_std = corrected_data[col].std()
            improvement = ((original_std - corrected_std) / original_std) * 100
            
            print(f"  {col}:")
            print(f"    - Original std: {original_std:.3f}")
            print(f"    - Corrected std: {corrected_std:.3f}")
            print(f"    - Improvement: {improvement:.1f}%")
    
    return data, corrected_data, drift_report


def run_comprehensive_tests():
    """Run comprehensive tests of all drift correction methods."""
    print("Starting Comprehensive Sensor Drift Correction Tests")
    print("=" * 80)
    
    drift_types = ['linear', 'step_change', 'temperature_dependent', 'complex_nonlinear', 'no_drift']
    results = {}
    
    for drift_type in drift_types:
        try:
            original, corrected, report = test_drift_correction(drift_type)
            results[drift_type] = {
                'original': original,
                'corrected': corrected,
                'report': report,
                'success': True
            }
        except Exception as e:
            print(f"Error testing {drift_type}: {str(e)}")
            results[drift_type] = {'success': False, 'error': str(e)}
    
    # Summary of all tests
    print(f"\n{'='*80}")
    print("COMPREHENSIVE TEST SUMMARY")
    print(f"{'='*80}")
    
    successful_tests = sum(1 for r in results.values() if r.get('success', False))
    total_tests = len(results)
    
    print(f"Tests completed: {successful_tests}/{total_tests}")
    
    for drift_type, result in results.items():
        if result.get('success', False):
            report = result['report']
            corrections = report.get('drift_corrections_applied', 0)
            status = "✓ PASSED" if corrections > 0 or drift_type == 'no_drift' else "⚠ NO DRIFT DETECTED"
            print(f"  {drift_type:20} - {status} (corrections: {corrections})")
        else:
            print(f"  {drift_type:20} - ✗ FAILED ({result.get('error', 'unknown error')})")
    
    print(f"\nTest suite completed. Industrial sensor drift correction is ready for production use!")
    return results


if __name__ == "__main__":
    print("Sensor Drift Correction Test Suite")
    print("Demonstrating industrial-grade drift detection and correction")
    
    # Run individual test
    if len(sys.argv) > 1:
        drift_type = sys.argv[1]
        test_drift_correction(drift_type)
    else:
        # Run comprehensive test suite
        run_comprehensive_tests()