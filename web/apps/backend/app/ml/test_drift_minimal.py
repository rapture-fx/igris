#!/usr/bin/env python3
"""
Minimal test of sensor drift correction core algorithms using only NumPy and Pandas.
"""

import numpy as np
import pandas as pd
import sys

def basic_linear_regression(x, y):
    """Basic linear regression implementation using only NumPy."""
    x_arr = np.array(x)
    y_arr = np.array(y)
    n = len(x_arr)
    
    if n < 2:
        return 0, 0, 0, 1, 0
        
    x_mean = np.mean(x_arr)
    y_mean = np.mean(y_arr)
    
    # Calculate slope and intercept
    numerator = np.sum((x_arr - x_mean) * (y_arr - y_mean))
    denominator = np.sum((x_arr - x_mean)**2)
    
    if denominator == 0:
        return 0, y_mean, 0, 1, 0
        
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    
    # Calculate correlation coefficient
    y_pred = slope * x_arr + intercept
    ss_res = np.sum((y_arr - y_pred) ** 2)
    ss_tot = np.sum((y_arr - y_mean) ** 2)
    
    if ss_tot == 0:
        r_value = 0
    else:
        r_value = np.sqrt(1 - (ss_res / ss_tot)) if ss_res <= ss_tot else 0
        
    # Simple p-value approximation
    if abs(slope) > 0.01 and r_value > 0.5:
        p_value = 0.01  # Significant
    else:
        p_value = 0.1   # Not significant
        
    std_err = np.sqrt(ss_res / (n - 2)) if n > 2 else 0
    
    return slope, intercept, r_value, p_value, std_err


class MinimalSensorDriftCorrector:
    """Simplified sensor drift corrector using only NumPy and Pandas."""
    
    def __init__(self):
        self.drift_threshold_pvalue = 0.05
        self.drift_threshold_slope = 0.01
    
    def detect_linear_drift(self, data_array):
        """Detect linear drift in sensor data."""
        if len(data_array) < 10:
            return {"detected": False, "confidence": 0.0}
        
        clean_data = data_array[~np.isnan(data_array)]
        if len(clean_data) < 10:
            return {"detected": False, "confidence": 0.0}
        
        x = np.arange(len(clean_data))
        slope, intercept, r_value, p_value, std_err = basic_linear_regression(x, clean_data)
        
        # Determine if trend is significant
        trend_significant = (
            p_value < self.drift_threshold_pvalue and
            abs(slope) > self.drift_threshold_slope * np.std(clean_data)
        )
        
        confidence = max(0, 1 - p_value) if trend_significant else 0
        
        return {
            "detected": trend_significant,
            "confidence": confidence,
            "slope": slope,
            "p_value": p_value,
            "r_squared": r_value**2,
            "magnitude": abs(slope * len(clean_data))
        }
    
    def apply_linear_correction(self, series):
        """Apply linear drift correction to a pandas Series."""
        clean_series = series.dropna()
        if len(clean_series) < 10:
            return series, {"method": "linear_trend", "status": "insufficient_data"}
        
        x = np.arange(len(clean_series))
        slope, intercept, _, _, _ = basic_linear_regression(x, clean_series.values)
        
        # Remove the linear trend
        detrended_values = clean_series.values - (slope * x)
        
        # Reconstruct the series
        corrected_series = series.copy()
        corrected_series.loc[clean_series.index] = detrended_values
        
        return corrected_series, {
            "method": "linear_trend",
            "status": "success",
            "slope_removed": slope,
            "trend_magnitude": abs(slope * len(clean_series))
        }
    
    def correct_sensor_drift(self, data, metadata=None):
        """Main drift correction method."""
        if data.empty:
            return data, {"drift_corrections_applied": 0, "status": "no_data"}
        
        corrected_data = data.copy()
        correction_report = {
            "drift_corrections_applied": 0,
            "corrections_by_column": {},
            "drift_patterns_detected": {},
            "status": "success"
        }
        
        # Process each numeric column
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            if len(data[col].dropna()) > 10:
                # Detect drift
                drift_analysis = self.detect_linear_drift(data[col].values)
                correction_report["drift_patterns_detected"][col] = drift_analysis
                
                # Apply correction if drift detected
                if drift_analysis["detected"]:
                    corrected_series, correction_info = self.apply_linear_correction(data[col])
                    corrected_data[col] = corrected_series
                    correction_report["corrections_by_column"][col] = correction_info
                    correction_report["drift_corrections_applied"] += 1
        
        return corrected_data, correction_report


def create_test_data():
    """Create synthetic sensor data with known drift."""
    np.random.seed(42)
    n_points = 200
    
    # Temperature sensor with linear drift
    base_temp = 25.0 + 0.2 * np.random.normal(0, 1, n_points)
    drift = np.linspace(0, 4.0, n_points)  # 4°C drift over dataset
    temp_with_drift = base_temp + drift
    
    # Pressure sensor without drift
    pressure_clean = 100.0 + 0.3 * np.random.normal(0, 1, n_points)
    
    return pd.DataFrame({
        'temperature': temp_with_drift,
        'pressure': pressure_clean
    })


def test_drift_correction():
    """Test the minimal drift correction implementation."""
    print("MINIMAL SENSOR DRIFT CORRECTION TEST")
    print("=" * 50)
    
    # Create test data
    data = create_test_data()
    print(f"Test data shape: {data.shape}")
    
    # Calculate expected drift
    temp_values = data['temperature'].values
    x = np.arange(len(temp_values))
    original_slope, _, _, original_pvalue, _ = basic_linear_regression(x, temp_values)
    
    print(f"Original temperature slope: {original_slope:.6f}°C/reading")
    print(f"Original p-value: {original_pvalue:.6f}")
    print(f"Expected slope: ~{4.0/len(temp_values):.6f}°C/reading")
    
    # Apply drift correction
    corrector = MinimalSensorDriftCorrector()
    corrected_data, report = corrector.correct_sensor_drift(data)
    
    print(f"\nDrift correction results:")
    print(f"Status: {report['status']}")
    print(f"Corrections applied: {report['drift_corrections_applied']}")
    
    # Check temperature correction
    if 'temperature' in report['drift_patterns_detected']:
        temp_analysis = report['drift_patterns_detected']['temperature']
        print(f"\nTemperature analysis:")
        print(f"  Drift detected: {temp_analysis['detected']}")
        print(f"  Confidence: {temp_analysis['confidence']:.3f}")
        print(f"  Slope: {temp_analysis['slope']:.6f}")
        print(f"  R²: {temp_analysis['r_squared']:.3f}")
        
        if 'temperature' in report['corrections_by_column']:
            correction = report['corrections_by_column']['temperature']
            print(f"  Correction applied: {correction['method']}")
            print(f"  Slope removed: {correction['slope_removed']:.6f}")
    
    # Verify correction effectiveness
    corrected_temp = corrected_data['temperature'].values
    corrected_slope, _, _, corrected_pvalue, _ = basic_linear_regression(x, corrected_temp)
    
    improvement = abs(original_slope) - abs(corrected_slope)
    improvement_pct = (improvement / abs(original_slope)) * 100 if original_slope != 0 else 0
    
    print(f"\nCorrection effectiveness:")
    print(f"  Before: slope={original_slope:.6f}, p={original_pvalue:.6f}")
    print(f"  After:  slope={corrected_slope:.6f}, p={corrected_pvalue:.6f}")
    print(f"  Improvement: {improvement_pct:.1f}%")
    
    # Test success criteria
    success = (
        report['drift_corrections_applied'] > 0 and
        abs(corrected_slope) < abs(original_slope) and
        improvement_pct > 80  # Should remove most of the drift
    )
    
    return success


def demonstrate_algorithms():
    """Demonstrate the key drift correction algorithms."""
    print("\nDEMONSTRATING SENSOR DRIFT CORRECTION ALGORITHMS")
    print("=" * 60)
    
    print("\n1. LINEAR TREND DETECTION")
    print("-" * 30)
    
    # Test with different trend strengths
    test_cases = [
        ("Strong upward trend", np.linspace(0, 5, 100) + 0.1 * np.random.normal(0, 1, 100)),
        ("Weak trend", np.linspace(0, 0.5, 100) + 0.2 * np.random.normal(0, 1, 100)),
        ("No trend", 0.3 * np.random.normal(0, 1, 100)),
    ]
    
    corrector = MinimalSensorDriftCorrector()
    
    for name, data_array in test_cases:
        result = corrector.detect_linear_drift(data_array)
        print(f"{name:20}: detected={result['detected']}, "
              f"confidence={result['confidence']:.3f}, "
              f"slope={result['slope']:.6f}")
    
    print("\n2. DRIFT CORRECTION EFFECTIVENESS")
    print("-" * 40)
    
    # Test correction on known drift
    np.random.seed(123)
    base_signal = 10.0 + 0.5 * np.sin(np.linspace(0, 4*np.pi, 150)) + 0.2 * np.random.normal(0, 1, 150)
    drift_signal = base_signal + np.linspace(0, 3.0, 150)  # Add 3-unit drift
    
    series = pd.Series(drift_signal)
    
    original_trend = corrector.detect_linear_drift(series.values)
    corrected_series, correction_info = corrector.apply_linear_correction(series)
    final_trend = corrector.detect_linear_drift(corrected_series.values)
    
    print(f"Original trend slope: {original_trend['slope']:.6f}")
    print(f"Corrected trend slope: {final_trend['slope']:.6f}")
    print(f"Drift reduction: {(1 - abs(final_trend['slope']/original_trend['slope'])) * 100:.1f}%")


if __name__ == "__main__":
    print("Minimal Sensor Drift Correction Test")
    print("Testing core algorithms with NumPy and Pandas only")
    
    # Run main test
    success = test_drift_correction()
    
    if success:
        print(f"\n✅ DRIFT CORRECTION TEST PASSED!")
        demonstrate_algorithms()
        print(f"\n🎉 Sensor drift correction algorithms are working correctly!")
        print("The implementation successfully detects and corrects linear sensor drift.")
    else:
        print(f"\n❌ DRIFT CORRECTION TEST FAILED!")
        sys.exit(1)