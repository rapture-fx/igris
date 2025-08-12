"""
Advanced Feature Engineering for Industry-Specific Applications
Enhanced algorithms for sensor data, cold start problems, and rare events
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union
from scipy import signal
from scipy.stats import entropy, skew, kurtosis
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.decomposition import PCA, FastICA
from sklearn.ensemble import IsolationForest
import warnings
warnings.filterwarnings('ignore')
import logging

logger = logging.getLogger(__name__)


class SensorDataFeatureEngine:
    """
    Advanced feature engineering for manufacturing sensor data cleaning and analysis.
    
    Features:
    - Industrial noise filtering with domain-specific algorithms
    - Time series feature extraction for IoT sensor streams
    - Vibration analysis and spectral features
    - Multi-sensor correlation features
    - Equipment health indicators
    """
    
    def __init__(self, sample_rate: float = 1000.0, window_size: int = 1024):
        self.sample_rate = sample_rate
        self.window_size = window_size
        self.scaler = RobustScaler()  # Better for industrial data with outliers
        
    def clean_sensor_data(self, data: pd.DataFrame, sensor_columns: List[str]) -> pd.DataFrame:
        """
        Clean industrial sensor data with domain-specific noise filtering.
        
        Args:
            data: Raw sensor data
            sensor_columns: List of sensor data columns
            
        Returns:
            Cleaned sensor data
        """
        logger.info(f"Cleaning sensor data for {len(sensor_columns)} sensors")
        
        cleaned_data = data.copy()
        
        for column in sensor_columns:
            if column not in data.columns:
                logger.warning(f"Column {column} not found in data")
                continue
                
            sensor_values = data[column].values
            
            # Remove electrical noise using Butterworth filter
            cleaned_values = self._remove_electrical_noise(sensor_values)
            
            # Remove vibration artifacts
            cleaned_values = self._remove_vibration_artifacts(cleaned_values)
            
            # Outlier detection and correction for industrial sensors
            cleaned_values = self._correct_sensor_outliers(cleaned_values)
            
            # Missing value interpolation for sensor streams
            cleaned_values = self._interpolate_missing_values(cleaned_values)
            
            cleaned_data[column] = cleaned_values
            
        logger.info("Sensor data cleaning completed")
        return cleaned_data
    
    def extract_time_series_features(self, data: pd.DataFrame, 
                                   timestamp_col: str, 
                                   sensor_columns: List[str]) -> pd.DataFrame:
        """
        Extract comprehensive time series features for IoT sensor data.
        
        Args:
            data: Time series sensor data
            timestamp_col: Timestamp column name
            sensor_columns: Sensor data columns
            
        Returns:
            DataFrame with extracted features
        """
        logger.info("Extracting time series features for IoT sensors")
        
        # Ensure data is sorted by timestamp
        data_sorted = data.sort_values(timestamp_col)
        
        features = []
        
        # Process data in time windows
        for i in range(0, len(data_sorted), self.window_size):
            window_data = data_sorted.iloc[i:i + self.window_size]
            
            if len(window_data) < self.window_size // 2:
                continue  # Skip incomplete windows
                
            window_features = {'window_start': window_data[timestamp_col].iloc[0]}
            
            for column in sensor_columns:
                if column not in window_data.columns:
                    continue
                    
                values = window_data[column].dropna().values
                
                if len(values) < 10:  # Skip windows with insufficient data
                    continue
                
                # Statistical features
                window_features.update(self._extract_statistical_features(values, column))
                
                # Frequency domain features
                window_features.update(self._extract_frequency_features(values, column))
                
                # Equipment health indicators
                window_features.update(self._extract_health_indicators(values, column))
                
                # Trend and pattern features
                window_features.update(self._extract_trend_features(values, column))
            
            features.append(window_features)
        
        feature_df = pd.DataFrame(features)
        logger.info(f"Extracted {len(feature_df.columns)} time series features")
        
        return feature_df
    
    def extract_multi_sensor_correlations(self, data: pd.DataFrame, 
                                        sensor_columns: List[str]) -> Dict[str, float]:
        """
        Extract correlation features between multiple sensors for fault detection.
        
        Args:
            data: Multi-sensor data
            sensor_columns: List of sensor columns
            
        Returns:
            Dictionary of correlation features
        """
        correlation_features = {}
        
        # Calculate pairwise correlations
        for i, sensor_a in enumerate(sensor_columns):
            for j, sensor_b in enumerate(sensor_columns[i+1:], i+1):
                if sensor_a in data.columns and sensor_b in data.columns:
                    corr = data[sensor_a].corr(data[sensor_b])
                    correlation_features[f'corr_{sensor_a}_{sensor_b}'] = corr
                    
                    # Cross-correlation with time lags
                    cross_corr = self._calculate_cross_correlation(
                        data[sensor_a].values, 
                        data[sensor_b].values
                    )
                    correlation_features[f'cross_corr_{sensor_a}_{sensor_b}'] = cross_corr
        
        # Mutual information between sensors
        for sensor in sensor_columns:
            if sensor in data.columns:
                mi_features = self._calculate_mutual_information(data, sensor, sensor_columns)
                correlation_features.update(mi_features)
        
        return correlation_features
    
    def _remove_electrical_noise(self, values: np.ndarray) -> np.ndarray:
        """Remove electrical noise using advanced multi-stage filtering."""
        if len(values) < 10:
            return values
            
        # Stage 1: Multiple notch filters for common industrial frequencies
        industrial_freqs = [50, 60, 100, 120, 150, 180]  # Harmonics included
        filtered_values = values.copy()
        
        for freq in industrial_freqs:
            if freq < self.sample_rate / 2:  # Ensure frequency is below Nyquist
                try:
                    b, a = signal.iirnotch(freq, 30, self.sample_rate)
                    filtered_values = signal.filtfilt(b, a, filtered_values)
                except:
                    continue
        
        # Stage 2: Adaptive low-pass filtering based on signal characteristics
        signal_bandwidth = self._estimate_signal_bandwidth(filtered_values)
        cutoff = min(signal_bandwidth * 2, self.sample_rate * 0.4)
        
        if cutoff > 1:
            try:
                b, a = signal.butter(6, cutoff / (self.sample_rate / 2), btype='low')
                filtered_values = signal.filtfilt(b, a, filtered_values)
            except:
                pass
        
        # Stage 3: Median filtering for impulsive noise
        if len(filtered_values) > 5:
            kernel_size = min(5, len(filtered_values) // 10)
            if kernel_size >= 3 and kernel_size % 2 == 1:
                filtered_values = signal.medfilt(filtered_values, kernel_size)
        
        # Stage 4: Wiener filtering for remaining noise
        if len(filtered_values) > 20:
            filtered_values = self._apply_wiener_filter(filtered_values)
        
        return filtered_values
    
    def _estimate_signal_bandwidth(self, values: np.ndarray) -> float:
        """Estimate the main signal bandwidth using spectral analysis."""
        if len(values) < 10:
            return 50.0  # Default bandwidth
            
        try:
            # Compute power spectral density
            freqs, psd = signal.welch(values, fs=self.sample_rate, nperseg=min(256, len(values)//4))
            
            # Find frequency where 95% of energy is contained
            cumulative_energy = np.cumsum(psd)
            total_energy = cumulative_energy[-1]
            
            # Find 95% energy frequency
            idx_95 = np.where(cumulative_energy >= 0.95 * total_energy)[0]
            if len(idx_95) > 0:
                return freqs[idx_95[0]]
            else:
                return freqs[-1] * 0.5
        except:
            return 50.0  # Fallback bandwidth
    
    def _apply_wiener_filter(self, values: np.ndarray) -> np.ndarray:
        """Apply Wiener filtering for noise reduction."""
        try:
            # Estimate noise variance from high-frequency components
            if len(values) < 20:
                return values
                
            # Simple Wiener filter implementation
            fft_signal = np.fft.fft(values)
            freqs = np.fft.fftfreq(len(values), 1/self.sample_rate)
            
            # Estimate signal and noise power spectra
            signal_power = np.abs(fft_signal)**2
            
            # Assume noise is primarily in high frequencies
            high_freq_mask = np.abs(freqs) > self.sample_rate * 0.3
            if np.any(high_freq_mask):
                noise_power = np.mean(signal_power[high_freq_mask])
            else:
                noise_power = np.mean(signal_power) * 0.1
            
            # Wiener filter transfer function
            wiener_filter = signal_power / (signal_power + noise_power)
            
            # Apply filter
            filtered_fft = fft_signal * wiener_filter
            filtered_signal = np.real(np.fft.ifft(filtered_fft))
            
            return filtered_signal
        except:
            return values  # Return original if filtering fails
    
    def _remove_vibration_artifacts(self, values: np.ndarray) -> np.ndarray:
        """Remove mechanical vibration artifacts using advanced filtering."""
        if len(values) < 10:
            return values
            
        try:
            # Stage 1: Adaptive high-pass filtering for low-frequency vibrations
            # Estimate the vibration frequency range
            vibration_cutoff = self._estimate_vibration_frequency(values)
            
            if vibration_cutoff > 0:
                b, a = signal.butter(4, vibration_cutoff / (self.sample_rate / 2), btype='high')
                filtered_values = signal.filtfilt(b, a, values)
            else:
                filtered_values = values.copy()
            
            # Stage 2: Comb filter for periodic vibration removal
            filtered_values = self._apply_comb_filter(filtered_values)
            
            # Stage 3: Empirical Mode Decomposition for non-linear vibrations
            if len(filtered_values) > 50:
                filtered_values = self._apply_emd_denoising(filtered_values)
            
            return filtered_values
            
        except Exception as e:
            logger.warning(f"Vibration artifact removal failed: {e}")
            return values
    
    def _estimate_vibration_frequency(self, values: np.ndarray) -> float:
        """Estimate dominant vibration frequency."""
        try:
            # Use autocorrelation to find periodic components
            autocorr = np.correlate(values, values, mode='full')
            autocorr = autocorr[autocorr.size // 2:]
            
            # Find peaks in autocorrelation
            peaks, _ = signal.find_peaks(autocorr[1:], height=np.max(autocorr) * 0.1)
            
            if len(peaks) > 0:
                # First significant peak indicates the main period
                main_period = peaks[0] + 1
                vibration_freq = self.sample_rate / main_period
                
                # Return cutoff frequency (half of vibration frequency)
                return vibration_freq * 0.5
            else:
                return 0.1  # Default low-frequency cutoff
                
        except:
            return 0.1
    
    def _apply_comb_filter(self, values: np.ndarray) -> np.ndarray:
        """Apply comb filter to remove periodic vibrations."""
        try:
            if len(values) < 20:
                return values
                
            # Find periodic components using FFT
            fft_signal = np.fft.fft(values)
            freqs = np.fft.fftfreq(len(values), 1/self.sample_rate)
            magnitude = np.abs(fft_signal)
            
            # Find dominant frequencies (peaks in spectrum)
            peaks, properties = signal.find_peaks(
                magnitude[:len(magnitude)//2], 
                height=np.max(magnitude) * 0.1,
                distance=len(magnitude) // 20
            )
            
            # Create comb filter to attenuate dominant frequencies
            filter_mask = np.ones_like(fft_signal)
            
            for peak_idx in peaks:
                # Attenuate frequency and its harmonics
                freq = freqs[peak_idx]
                if abs(freq) < self.sample_rate * 0.4:  # Only attenuate reasonable frequencies
                    # Create notch around the frequency
                    freq_mask = np.abs(freqs - freq) < freq * 0.05
                    filter_mask[freq_mask] *= 0.1  # Attenuate by 90%
                    
                    # Also attenuate negative frequency
                    freq_mask_neg = np.abs(freqs + freq) < abs(freq) * 0.05
                    filter_mask[freq_mask_neg] *= 0.1
            
            # Apply filter
            filtered_fft = fft_signal * filter_mask
            filtered_signal = np.real(np.fft.ifft(filtered_fft))
            
            return filtered_signal
            
        except:
            return values
    
    def _apply_emd_denoising(self, values: np.ndarray) -> np.ndarray:
        """Apply simplified Empirical Mode Decomposition for denoising."""
        try:
            # Simplified EMD implementation for noise reduction
            signal_copy = values.copy()
            
            # Apply iterative filtering to extract trend
            for iteration in range(3):  # Limited iterations for performance
                # Find local maxima and minima
                maxima_indices = signal.argrelmax(signal_copy, order=max(1, len(signal_copy)//20))[0]
                minima_indices = signal.argrelmin(signal_copy, order=max(1, len(signal_copy)//20))[0]
                
                if len(maxima_indices) < 2 or len(minima_indices) < 2:
                    break
                
                # Interpolate envelopes
                x = np.arange(len(signal_copy))
                
                try:
                    upper_envelope = np.interp(x, maxima_indices, signal_copy[maxima_indices])
                    lower_envelope = np.interp(x, minima_indices, signal_copy[minima_indices])
                    
                    # Calculate mean envelope
                    mean_envelope = (upper_envelope + lower_envelope) / 2
                    
                    # Subtract mean to get component
                    component = signal_copy - mean_envelope
                    
                    # Check stopping criterion
                    if np.std(component) < np.std(signal_copy) * 0.1:
                        break
                    
                    signal_copy = component
                    
                except:
                    break
            
            # Return the denoised signal (original minus high-frequency noise)
            noise_level = np.std(signal_copy)
            if noise_level < np.std(values) * 0.8:  # If denoising was effective
                return values - signal_copy * 0.5  # Partial noise removal
            else:
                return values
                
        except:
            return values
    
    def _correct_sensor_outliers(self, values: np.ndarray) -> np.ndarray:
        """Detect and correct sensor outliers using multi-method approach."""
        if len(values) < 10:
            return values
            
        try:
            values_clean = values.copy()
            outlier_mask = np.zeros(len(values), dtype=bool)
            
            # Method 1: Statistical outliers (Modified Z-score)
            median = np.median(values)
            mad = np.median(np.abs(values - median))
            modified_z_scores = 0.6745 * (values - median) / (mad + 1e-8)
            statistical_outliers = np.abs(modified_z_scores) > 3.5
            
            # Method 2: Isolation Forest
            if len(values) > 20:
                isolation_forest = IsolationForest(contamination=0.05, random_state=42)
                isolation_outliers = isolation_forest.fit_predict(values.reshape(-1, 1)) == -1
            else:
                isolation_outliers = np.zeros(len(values), dtype=bool)
            
            # Method 3: Local outliers using sliding window
            window_outliers = self._detect_local_outliers(values)
            
            # Method 4: Physical constraint violations
            physics_outliers = self._detect_physics_violations(values)
            
            # Combine outlier detection methods
            outlier_mask = statistical_outliers | isolation_outliers | window_outliers | physics_outliers
            
            # Correct outliers using adaptive method
            if np.any(outlier_mask):
                values_clean = self._adaptive_outlier_correction(values, outlier_mask)
            
            return values_clean
            
        except Exception as e:
            logger.warning(f"Outlier correction failed: {e}")
            return values
    
    def _detect_local_outliers(self, values: np.ndarray, window_size: int = None) -> np.ndarray:
        """Detect outliers using local statistical properties."""
        if window_size is None:
            window_size = min(50, max(10, len(values) // 10))
        
        outliers = np.zeros(len(values), dtype=bool)
        
        for i in range(len(values)):
            start_idx = max(0, i - window_size // 2)
            end_idx = min(len(values), i + window_size // 2 + 1)
            window = values[start_idx:end_idx]
            
            if len(window) > 5:
                q1, q3 = np.percentile(window, [25, 75])
                iqr = q3 - q1
                lower_bound = q1 - 2.0 * iqr
                upper_bound = q3 + 2.0 * iqr
                
                if values[i] < lower_bound or values[i] > upper_bound:
                    outliers[i] = True
        
        return outliers
    
    def _detect_physics_violations(self, values: np.ndarray) -> np.ndarray:
        """Detect outliers that violate physical constraints."""
        outliers = np.zeros(len(values), dtype=bool)
        
        # Check for impossible rate of change (sensor dependent)
        if len(values) > 1:
            rate_of_change = np.abs(np.diff(values))
            max_reasonable_change = np.std(values) * 5  # Adaptive threshold
            
            # Flag points with excessive rate of change
            excessive_change_points = np.where(rate_of_change > max_reasonable_change)[0]
            outliers[excessive_change_points] = True
            outliers[excessive_change_points + 1] = True  # Flag next point too
        
        # Check for stuck sensor values (identical consecutive readings)
        if len(values) > 5:
            stuck_threshold = max(3, len(values) // 20)
            for i in range(len(values) - stuck_threshold):
                window = values[i:i + stuck_threshold]
                if np.all(window == window[0]) and np.std(values) > 1e-6:
                    outliers[i:i + stuck_threshold] = True
        
        return outliers
    
    def _adaptive_outlier_correction(self, values: np.ndarray, outlier_mask: np.ndarray) -> np.ndarray:
        """Correct outliers using adaptive interpolation methods."""
        values_corrected = values.copy()
        
        # Group consecutive outliers for efficient processing
        outlier_groups = self._group_consecutive_outliers(outlier_mask)
        
        for start_idx, end_idx in outlier_groups:
            group_size = end_idx - start_idx
            
            if group_size == 1:
                # Single outlier - use local interpolation
                values_corrected[start_idx] = self._interpolate_single_point(values, start_idx)
            elif group_size <= 5:
                # Small group - use linear interpolation
                values_corrected[start_idx:end_idx] = self._interpolate_small_group(values, start_idx, end_idx)
            else:
                # Large group - use trend-based reconstruction
                values_corrected[start_idx:end_idx] = self._reconstruct_large_group(values, start_idx, end_idx)
        
        return values_corrected
    
    def _group_consecutive_outliers(self, outlier_mask: np.ndarray) -> List[Tuple[int, int]]:
        """Group consecutive outlier indices."""
        groups = []
        start = None
        
        for i, is_outlier in enumerate(outlier_mask):
            if is_outlier and start is None:
                start = i
            elif not is_outlier and start is not None:
                groups.append((start, i))
                start = None
        
        # Handle case where outliers extend to end of array
        if start is not None:
            groups.append((start, len(outlier_mask)))
        
        return groups
    
    def _interpolate_single_point(self, values: np.ndarray, idx: int) -> float:
        """Interpolate a single outlier point."""
        if idx == 0:
            return values[1] if len(values) > 1 else values[0]
        elif idx == len(values) - 1:
            return values[-2]
        else:
            # Use local median or linear interpolation
            window_start = max(0, idx - 3)
            window_end = min(len(values), idx + 4)
            local_values = np.concatenate([values[window_start:idx], values[idx+1:window_end]])
            
            if len(local_values) > 0:
                return np.median(local_values)
            else:
                return (values[idx-1] + values[idx+1]) / 2
    
    def _interpolate_small_group(self, values: np.ndarray, start_idx: int, end_idx: int) -> np.ndarray:
        """Interpolate a small group of outliers."""
        if start_idx == 0:
            # Extrapolate from the beginning
            return np.full(end_idx - start_idx, values[end_idx]) if end_idx < len(values) else values[:end_idx - start_idx]
        elif end_idx >= len(values):
            # Extrapolate to the end
            return np.full(end_idx - start_idx, values[start_idx - 1])
        else:
            # Linear interpolation
            start_value = values[start_idx - 1]
            end_value = values[end_idx]
            interpolated = np.linspace(start_value, end_value, end_idx - start_idx + 2)[1:-1]
            return interpolated
    
    def _reconstruct_large_group(self, values: np.ndarray, start_idx: int, end_idx: int) -> np.ndarray:
        """Reconstruct a large group of outliers using trend analysis."""
        group_size = end_idx - start_idx
        
        # Analyze trend before and after the outlier group
        before_window = max(10, group_size)
        after_window = max(10, group_size)
        
        before_start = max(0, start_idx - before_window)
        after_end = min(len(values), end_idx + after_window)
        
        # Calculate trends
        if start_idx > 0 and end_idx < len(values):
            # Use polynomial fitting for smooth reconstruction
            x_before = np.arange(before_start, start_idx)
            y_before = values[before_start:start_idx]
            
            x_after = np.arange(end_idx, after_end)
            y_after = values[end_idx:after_end]
            
            if len(y_before) > 2 and len(y_after) > 2:
                # Fit polynomials to before and after segments
                poly_before = np.polyfit(x_before, y_before, min(2, len(y_before) - 1))
                poly_after = np.polyfit(x_after, y_after, min(2, len(y_after) - 1))
                
                # Interpolate using weighted combination of trends
                x_interp = np.arange(start_idx, end_idx)
                
                # Predict using both polynomials
                pred_before = np.polyval(poly_before, x_interp)
                pred_after = np.polyval(poly_after, x_interp)
                
                # Weight predictions based on distance
                weights_after = np.linspace(0, 1, len(x_interp))
                weights_before = 1 - weights_after
                
                reconstructed = weights_before * pred_before + weights_after * pred_after
                return reconstructed
        
        # Fallback to linear interpolation
        return self._interpolate_small_group(values, start_idx, end_idx)
    
    def _interpolate_missing_values(self, values: np.ndarray) -> np.ndarray:
        """Interpolate missing values in sensor streams."""
        series = pd.Series(values)
        
        # Use different methods based on missing data pattern
        missing_pct = series.isnull().sum() / len(series)
        
        if missing_pct > 0.3:
            # Too many missing values - use forward fill
            series = series.fillna(method='ffill').fillna(method='bfill')
        elif missing_pct > 0.1:
            # Moderate missing - use spline interpolation
            series = series.interpolate(method='spline', order=2)
        else:
            # Few missing - use linear interpolation
            series = series.interpolate(method='linear')
        
        return series.fillna(series.mean()).values
    
    def detect_calibration_drift(self, values: np.ndarray, reference_window: int = 100) -> Dict[str, Any]:
        """
        Advanced calibration drift detection for industrial sensors.
        
        Args:
            values: Sensor time series data
            reference_window: Size of reference window for drift calculation
            
        Returns:
            Drift detection results
        """
        if len(values) < reference_window * 2:
            return {"drift_detected": False, "drift_magnitude": 0.0, "confidence": 0.0}
        
        try:
            # Method 1: Statistical drift detection
            statistical_drift = self._detect_statistical_drift(values, reference_window)
            
            # Method 2: Spectral drift detection
            spectral_drift = self._detect_spectral_drift(values, reference_window)
            
            # Method 3: Trend-based drift detection
            trend_drift = self._detect_trend_drift(values, reference_window)
            
            # Combine drift detection methods
            combined_confidence = (statistical_drift["confidence"] + 
                                 spectral_drift["confidence"] + 
                                 trend_drift["confidence"]) / 3
            
            drift_detected = combined_confidence > 0.7
            overall_magnitude = max(statistical_drift["magnitude"], 
                                  spectral_drift["magnitude"], 
                                  trend_drift["magnitude"])
            
            return {
                "drift_detected": drift_detected,
                "drift_magnitude": overall_magnitude,
                "confidence": combined_confidence,
                "drift_types": {
                    "statistical": statistical_drift,
                    "spectral": spectral_drift,
                    "trend": trend_drift
                },
                "recommended_action": self._get_drift_recommendation(drift_detected, overall_magnitude)
            }
            
        except Exception as e:
            logger.warning(f"Calibration drift detection failed: {e}")
            return {"drift_detected": False, "drift_magnitude": 0.0, "confidence": 0.0}
    
    def _detect_statistical_drift(self, values: np.ndarray, reference_window: int) -> Dict[str, float]:
        """Detect drift using statistical properties comparison."""
        # Split data into segments for comparison
        n_segments = len(values) // reference_window
        if n_segments < 2:
            return {"magnitude": 0.0, "confidence": 0.0}
        
        # Calculate statistical properties for each segment
        segment_means = []
        segment_stds = []
        
        for i in range(n_segments):
            start_idx = i * reference_window
            end_idx = min((i + 1) * reference_window, len(values))
            segment = values[start_idx:end_idx]
            
            segment_means.append(np.mean(segment))
            segment_stds.append(np.std(segment))
        
        # Analyze trends in statistical properties
        mean_trend = np.polyfit(range(len(segment_means)), segment_means, 1)[0]
        std_trend = np.polyfit(range(len(segment_stds)), segment_stds, 1)[0]
        
        # Calculate drift magnitude
        mean_drift_magnitude = abs(mean_trend) / (np.std(segment_means) + 1e-8)
        std_drift_magnitude = abs(std_trend) / (np.std(segment_stds) + 1e-8)
        
        overall_magnitude = max(mean_drift_magnitude, std_drift_magnitude)
        confidence = min(1.0, overall_magnitude)
        
        return {"magnitude": overall_magnitude, "confidence": confidence}
    
    def _detect_spectral_drift(self, values: np.ndarray, reference_window: int) -> Dict[str, float]:
        """Detect drift using spectral properties comparison."""
        try:
            # Split data into two halves for comparison
            mid_point = len(values) // 2
            first_half = values[:mid_point]
            second_half = values[mid_point:]
            
            # Compute power spectral densities
            freq1, psd1 = signal.welch(first_half, fs=self.sample_rate, 
                                     nperseg=min(256, len(first_half)//4))
            freq2, psd2 = signal.welch(second_half, fs=self.sample_rate, 
                                     nperseg=min(256, len(second_half)//4))
            
            # Ensure same frequency resolution
            min_len = min(len(psd1), len(psd2))
            psd1, psd2 = psd1[:min_len], psd2[:min_len]
            
            # Calculate spectral distance
            spectral_distance = np.mean(np.abs(psd1 - psd2) / (psd1 + psd2 + 1e-8))
            
            # Convert to confidence measure
            confidence = min(1.0, spectral_distance * 10)  # Scale factor
            
            return {"magnitude": spectral_distance, "confidence": confidence}
            
        except:
            return {"magnitude": 0.0, "confidence": 0.0}
    
    def _detect_trend_drift(self, values: np.ndarray, reference_window: int) -> Dict[str, float]:
        """Detect drift using long-term trend analysis."""
        try:
            # Use rolling windows to detect changes in local trends
            window_size = reference_window
            local_trends = []
            
            for i in range(0, len(values) - window_size, window_size // 2):
                window = values[i:i + window_size]
                x = np.arange(len(window))
                trend_coeff = np.polyfit(x, window, 1)[0]
                local_trends.append(trend_coeff)
            
            if len(local_trends) < 3:
                return {"magnitude": 0.0, "confidence": 0.0}
            
            # Analyze variance in local trends
            trend_variance = np.var(local_trends)
            mean_trend = np.mean(np.abs(local_trends))
            
            # Calculate trend drift magnitude
            if mean_trend > 0:
                trend_drift_magnitude = trend_variance / mean_trend
            else:
                trend_drift_magnitude = trend_variance
            
            confidence = min(1.0, trend_drift_magnitude)
            
            return {"magnitude": trend_drift_magnitude, "confidence": confidence}
            
        except:
            return {"magnitude": 0.0, "confidence": 0.0}
    
    def _get_drift_recommendation(self, drift_detected: bool, magnitude: float) -> str:
        """Get recommended action based on drift detection results."""
        if not drift_detected:
            return "No action required - sensor calibration is stable"
        elif magnitude > 0.8:
            return "Critical: Immediate sensor recalibration required"
        elif magnitude > 0.5:
            return "Warning: Schedule sensor calibration within 1 week"
        else:
            return "Monitor: Slight drift detected, continue monitoring"
    
    def _extract_statistical_features(self, values: np.ndarray, column: str) -> Dict[str, float]:
        """Extract statistical features from sensor data."""
        return {
            f'{column}_mean': np.mean(values),
            f'{column}_std': np.std(values),
            f'{column}_var': np.var(values),
            f'{column}_min': np.min(values),
            f'{column}_max': np.max(values),
            f'{column}_range': np.max(values) - np.min(values),
            f'{column}_median': np.median(values),
            f'{column}_q25': np.percentile(values, 25),
            f'{column}_q75': np.percentile(values, 75),
            f'{column}_iqr': np.percentile(values, 75) - np.percentile(values, 25),
            f'{column}_skewness': skew(values),
            f'{column}_kurtosis': kurtosis(values),
            f'{column}_rms': np.sqrt(np.mean(values**2)),
            f'{column}_peak_to_peak': np.max(values) - np.min(values),
            f'{column}_crest_factor': np.max(np.abs(values)) / np.sqrt(np.mean(values**2))
        }
    
    def _extract_frequency_features(self, values: np.ndarray, column: str) -> Dict[str, float]:
        """Extract frequency domain features for vibration analysis."""
        # FFT analysis
        fft = np.fft.fft(values)
        freqs = np.fft.fftfreq(len(values), 1/self.sample_rate)
        magnitude = np.abs(fft)
        
        # Keep only positive frequencies
        pos_freqs = freqs[:len(freqs)//2]
        pos_magnitude = magnitude[:len(magnitude)//2]
        
        # Frequency domain features
        features = {
            f'{column}_dominant_freq': pos_freqs[np.argmax(pos_magnitude)],
            f'{column}_spectral_centroid': np.sum(pos_freqs * pos_magnitude) / np.sum(pos_magnitude),
            f'{column}_spectral_rolloff': self._calculate_spectral_rolloff(pos_freqs, pos_magnitude),
            f'{column}_spectral_bandwidth': self._calculate_spectral_bandwidth(pos_freqs, pos_magnitude),
            f'{column}_spectral_energy': np.sum(pos_magnitude**2),
            f'{column}_zero_crossing_rate': self._calculate_zero_crossing_rate(values)
        }
        
        # Frequency band energy ratios (for machinery diagnosis)
        features.update(self._extract_frequency_band_features(pos_freqs, pos_magnitude, column))
        
        return features
    
    def _extract_health_indicators(self, values: np.ndarray, column: str) -> Dict[str, float]:
        """Extract equipment health indicators from sensor data."""
        return {
            f'{column}_smoothness': self._calculate_smoothness_index(values),
            f'{column}_impulse_factor': self._calculate_impulse_factor(values),
            f'{column}_shape_factor': self._calculate_shape_factor(values),
            f'{column}_clearance_factor': self._calculate_clearance_factor(values),
            f'{column}_entropy': entropy(np.histogram(values, bins=50)[0] + 1e-10)
        }
    
    def _extract_trend_features(self, values: np.ndarray, column: str) -> Dict[str, float]:
        """Extract trend and pattern features."""
        # Linear trend
        x = np.arange(len(values))
        trend_coeff = np.polyfit(x, values, 1)[0]
        
        # Seasonal decomposition (simplified)
        detrended = values - np.polyval([trend_coeff, np.mean(values)], x)
        
        return {
            f'{column}_trend_slope': trend_coeff,
            f'{column}_trend_strength': np.abs(trend_coeff) / np.std(values),
            f'{column}_seasonality_strength': np.std(detrended) / np.std(values),
            f'{column}_autocorr_lag1': np.corrcoef(values[:-1], values[1:])[0, 1] if len(values) > 1 else 0
        }
    
    def _calculate_cross_correlation(self, x: np.ndarray, y: np.ndarray) -> float:
        """Calculate maximum cross-correlation between two signals."""
        if len(x) != len(y):
            min_len = min(len(x), len(y))
            x, y = x[:min_len], y[:min_len]
        
        correlation = np.correlate(x - np.mean(x), y - np.mean(y), mode='full')
        return np.max(np.abs(correlation)) / (np.std(x) * np.std(y) * len(x))
    
    def _calculate_mutual_information(self, data: pd.DataFrame, 
                                    target_sensor: str, 
                                    sensor_columns: List[str]) -> Dict[str, float]:
        """Calculate mutual information between sensors."""
        mi_features = {}
        
        for sensor in sensor_columns:
            if sensor != target_sensor and sensor in data.columns:
                # Simplified MI calculation using histogram method
                hist_2d, _, _ = np.histogram2d(
                    data[target_sensor].dropna(), 
                    data[sensor].dropna(), 
                    bins=20
                )
                
                # Calculate MI
                pxy = hist_2d / np.sum(hist_2d)
                px = np.sum(pxy, axis=1)
                py = np.sum(pxy, axis=0)
                
                pxy_flat = pxy.flatten()
                px_py = np.outer(px, py).flatten()
                
                # Avoid log(0)
                mask = (pxy_flat > 0) & (px_py > 0)
                mi = np.sum(pxy_flat[mask] * np.log(pxy_flat[mask] / px_py[mask]))
                
                mi_features[f'mi_{target_sensor}_{sensor}'] = mi
        
        return mi_features
    
    def _calculate_spectral_rolloff(self, freqs: np.ndarray, magnitude: np.ndarray) -> float:
        """Calculate spectral rolloff frequency (85% of energy)."""
        total_energy = np.sum(magnitude**2)
        cumulative_energy = np.cumsum(magnitude**2)
        rolloff_idx = np.where(cumulative_energy >= 0.85 * total_energy)[0]
        return freqs[rolloff_idx[0]] if len(rolloff_idx) > 0 else freqs[-1]
    
    def _calculate_spectral_bandwidth(self, freqs: np.ndarray, magnitude: np.ndarray) -> float:
        """Calculate spectral bandwidth."""
        centroid = np.sum(freqs * magnitude) / np.sum(magnitude)
        bandwidth = np.sqrt(np.sum(magnitude * (freqs - centroid)**2) / np.sum(magnitude))
        return bandwidth
    
    def _calculate_zero_crossing_rate(self, values: np.ndarray) -> float:
        """Calculate zero crossing rate."""
        zero_crossings = np.where(np.diff(np.sign(values)))[0]
        return len(zero_crossings) / len(values)
    
    def _extract_frequency_band_features(self, freqs: np.ndarray, 
                                       magnitude: np.ndarray, 
                                       column: str) -> Dict[str, float]:
        """Extract energy ratios for different frequency bands."""
        # Define frequency bands for machinery diagnosis
        bands = {
            'low': (0, 10),      # Low frequency (0-10 Hz)
            'mid': (10, 100),    # Mid frequency (10-100 Hz)  
            'high': (100, 500),  # High frequency (100-500 Hz)
            'vhigh': (500, 1000) # Very high frequency (500-1000 Hz)
        }
        
        total_energy = np.sum(magnitude**2)
        band_features = {}
        
        for band_name, (low_freq, high_freq) in bands.items():
            mask = (freqs >= low_freq) & (freqs <= high_freq)
            band_energy = np.sum(magnitude[mask]**2)
            band_ratio = band_energy / total_energy if total_energy > 0 else 0
            band_features[f'{column}_energy_ratio_{band_name}'] = band_ratio
        
        return band_features
    
    def _calculate_smoothness_index(self, values: np.ndarray) -> float:
        """Calculate smoothness index for equipment health."""
        if len(values) < 3:
            return 0.0
        
        diff2 = np.diff(values, 2)  # Second derivative
        smoothness = 1.0 / (1.0 + np.std(diff2))
        return smoothness
    
    def _calculate_impulse_factor(self, values: np.ndarray) -> float:
        """Calculate impulse factor."""
        peak = np.max(np.abs(values))
        mean_abs = np.mean(np.abs(values))
        return peak / mean_abs if mean_abs > 0 else 0
    
    def _calculate_shape_factor(self, values: np.ndarray) -> float:
        """Calculate shape factor."""
        rms = np.sqrt(np.mean(values**2))
        mean_abs = np.mean(np.abs(values))
        return rms / mean_abs if mean_abs > 0 else 0
    
    def _calculate_clearance_factor(self, values: np.ndarray) -> float:
        """Calculate clearance factor."""
        peak = np.max(np.abs(values))
        mean_sqrt = np.mean(np.sqrt(np.abs(values)))**2
        return peak / mean_sqrt if mean_sqrt > 0 else 0


class ColdStartFeatureEngine:
    """
    Advanced feature engineering for e-commerce cold start problems.
    
    Features:
    - Content-based feature extraction from sparse data
    - User behavior pattern inference from minimal interactions
    - Item similarity features from metadata
    - Demographic and contextual feature engineering
    - Cold start recommendation features
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.content_features = {}
        self.user_profiles = {}
        
    def extract_cold_start_user_features(self, user_data: pd.DataFrame, 
                                       interaction_data: pd.DataFrame) -> pd.DataFrame:
        """
        Extract features for new users with minimal interaction history.
        
        Args:
            user_data: User demographic and profile data
            interaction_data: Limited interaction history
            
        Returns:
            Cold start user features
        """
        logger.info("Extracting cold start user features")
        
        features = []
        
        for user_id in user_data['user_id'].unique():
            user_info = user_data[user_data['user_id'] == user_id].iloc[0]
            user_interactions = interaction_data[interaction_data['user_id'] == user_id]
            
            user_features = {'user_id': user_id}
            
            # Demographic features
            user_features.update(self._extract_demographic_features(user_info))
            
            # Behavioral inference from limited interactions
            user_features.update(self._infer_behavioral_patterns(user_interactions))
            
            # Contextual features
            user_features.update(self._extract_contextual_features(user_info, user_interactions))
            
            # Cold start specific features
            user_features.update(self._extract_cold_start_signals(user_interactions))
            
            features.append(user_features)
        
        feature_df = pd.DataFrame(features)
        logger.info(f"Extracted cold start features for {len(feature_df)} users")
        
        return feature_df
    
    def extract_cold_start_item_features(self, item_data: pd.DataFrame,
                                       interaction_data: pd.DataFrame) -> pd.DataFrame:
        """
        Extract features for new items with minimal interaction history.
        
        Args:
            item_data: Item metadata and content information
            interaction_data: Limited interaction history
            
        Returns:
            Cold start item features
        """
        logger.info("Extracting cold start item features")
        
        features = []
        
        for item_id in item_data['item_id'].unique():
            item_info = item_data[item_data['item_id'] == item_id].iloc[0]
            item_interactions = interaction_data[interaction_data['item_id'] == item_id]
            
            item_features = {'item_id': item_id}
            
            # Content-based features
            item_features.update(self._extract_content_features(item_info))
            
            # Category and metadata features
            item_features.update(self._extract_category_features(item_info))
            
            # Price and value features
            item_features.update(self._extract_price_features(item_info))
            
            # Early interaction signals
            item_features.update(self._extract_early_interaction_features(item_interactions))
            
            # Similarity to popular items
            item_features.update(self._calculate_item_similarity_features(item_info, item_data))
            
            features.append(item_features)
        
        feature_df = pd.DataFrame(features)
        logger.info(f"Extracted cold start features for {len(feature_df)} items")
        
        return feature_df
    
    def generate_automated_features(self, interaction_data: pd.DataFrame,
                                  user_data: pd.DataFrame = None,
                                  item_data: pd.DataFrame = None) -> Dict[str, pd.DataFrame]:
        """
        Automated feature generation for cold start scenarios.
        
        Args:
            interaction_data: User-item interaction data
            user_data: Optional user metadata
            item_data: Optional item metadata
            
        Returns:
            Dictionary of generated feature sets
        """
        logger.info("Starting automated feature generation for cold start scenarios")
        
        generated_features = {}
        
        # Generate temporal features
        if 'timestamp' in interaction_data.columns:
            temporal_features = self._generate_temporal_features(interaction_data)
            generated_features['temporal'] = temporal_features
        
        # Generate interaction pattern features
        interaction_features = self._generate_interaction_pattern_features(interaction_data)
        generated_features['interaction_patterns'] = interaction_features
        
        # Generate similarity-based features
        similarity_features = self._generate_similarity_features(interaction_data, user_data, item_data)
        generated_features['similarity'] = similarity_features
        
        # Generate contextual features
        if user_data is not None:
            contextual_features = self._generate_contextual_features(user_data, interaction_data)
            generated_features['contextual'] = contextual_features
        
        # Generate content-based features
        if item_data is not None:
            content_features = self._generate_advanced_content_features(item_data, interaction_data)
            generated_features['content'] = content_features
        
        # Generate ensemble features (combinations of above)
        ensemble_features = self._generate_ensemble_features(generated_features)
        generated_features['ensemble'] = ensemble_features
        
        logger.info(f"Generated {len(generated_features)} feature sets")
        return generated_features
    
    def _generate_temporal_features(self, interaction_data: pd.DataFrame) -> pd.DataFrame:
        """Generate time-based features for cold start users."""
        temporal_features = []
        
        # Convert timestamp to datetime
        interaction_data = interaction_data.copy()
        interaction_data['timestamp'] = pd.to_datetime(interaction_data['timestamp'])
        
        for user_id in interaction_data['user_id'].unique():
            user_interactions = interaction_data[interaction_data['user_id'] == user_id].sort_values('timestamp')
            
            features = {'user_id': user_id}
            
            if len(user_interactions) > 0:
                # Basic temporal features
                features.update({
                    'first_interaction_hour': user_interactions['timestamp'].iloc[0].hour,
                    'first_interaction_day_of_week': user_interactions['timestamp'].iloc[0].dayofweek,
                    'interaction_time_span_hours': (user_interactions['timestamp'].max() - 
                                                   user_interactions['timestamp'].min()).total_seconds() / 3600,
                    'avg_time_between_interactions': self._calculate_avg_interaction_interval(user_interactions['timestamp']),
                    'interaction_frequency_pattern': self._classify_interaction_frequency(user_interactions['timestamp']),
                    'session_count': self._count_interaction_sessions(user_interactions['timestamp']),
                    'weekend_interaction_ratio': self._calculate_weekend_ratio(user_interactions['timestamp']),
                    'peak_hour_preference': self._identify_peak_hour(user_interactions['timestamp']),
                    'interaction_regularity_score': self._calculate_regularity_score(user_interactions['timestamp'])
                })
            
            temporal_features.append(features)
        
        return pd.DataFrame(temporal_features)
    
    def _generate_interaction_pattern_features(self, interaction_data: pd.DataFrame) -> pd.DataFrame:
        """Generate advanced interaction pattern features."""
        pattern_features = []
        
        for user_id in interaction_data['user_id'].unique():
            user_interactions = interaction_data[interaction_data['user_id'] == user_id]
            
            features = {'user_id': user_id}
            
            # Interaction diversity features
            features.update({
                'unique_items_ratio': len(user_interactions['item_id'].unique()) / len(user_interactions),
                'repeat_interaction_ratio': (len(user_interactions) - len(user_interactions['item_id'].unique())) / len(user_interactions),
                'interaction_entropy': self._calculate_interaction_entropy(user_interactions),
                'category_diversity': self._calculate_category_diversity(user_interactions),
                'interaction_burst_score': self._calculate_burst_score(user_interactions),
                'exploration_vs_exploitation': self._calculate_exploration_score(user_interactions)
            })
            
            # Behavioral pattern features
            if 'rating' in user_interactions.columns:
                features.update({
                    'rating_variance': user_interactions['rating'].var(),
                    'rating_trend': self._calculate_rating_trend(user_interactions),
                    'harsh_rater_score': self._calculate_harsh_rater_score(user_interactions),
                    'rating_consistency': self._calculate_rating_consistency(user_interactions)
                })
            
            pattern_features.append(features)
        
        return pd.DataFrame(pattern_features)
    
    def _generate_similarity_features(self, interaction_data: pd.DataFrame,
                                    user_data: pd.DataFrame = None,
                                    item_data: pd.DataFrame = None) -> pd.DataFrame:
        """Generate user and item similarity features."""
        similarity_features = []
        
        # Calculate user-user similarity for cold start users
        user_item_matrix = interaction_data.pivot_table(
            index='user_id', columns='item_id', values='rating', fill_value=0
        )
        
        # Use cosine similarity for sparse data
        from sklearn.metrics.pairwise import cosine_similarity
        user_similarity_matrix = cosine_similarity(user_item_matrix.fillna(0))
        
        for i, user_id in enumerate(user_item_matrix.index):
            features = {'user_id': user_id}
            
            # Find similar users
            similarity_scores = user_similarity_matrix[i]
            most_similar_indices = np.argsort(similarity_scores)[-6:-1]  # Top 5 excluding self
            
            features.update({
                'max_user_similarity': similarity_scores[most_similar_indices[-1]],
                'avg_user_similarity': np.mean(similarity_scores[most_similar_indices]),
                'similarity_spread': np.std(similarity_scores[most_similar_indices]),
                'similar_user_count': np.sum(similarity_scores > 0.1),
                'isolation_score': 1.0 - np.mean(similarity_scores)  # How isolated the user is
            })
            
            # Content-based similarity if item data available
            if item_data is not None:
                user_items = interaction_data[interaction_data['user_id'] == user_id]['item_id'].unique()
                content_similarity = self._calculate_content_similarity(user_items, item_data)
                features.update(content_similarity)
            
            similarity_features.append(features)
        
        return pd.DataFrame(similarity_features)
    
    def _generate_contextual_features(self, user_data: pd.DataFrame, 
                                    interaction_data: pd.DataFrame) -> pd.DataFrame:
        """Generate advanced contextual features."""
        contextual_features = []
        
        for _, user_row in user_data.iterrows():
            user_id = user_row['user_id']
            user_interactions = interaction_data[interaction_data['user_id'] == user_id]
            
            features = {'user_id': user_id}
            
            # Enhanced demographic features
            features.update(self._extract_enhanced_demographic_features(user_row))
            
            # Behavioral context features
            features.update(self._extract_behavioral_context_features(user_row, user_interactions))
            
            # Social context features
            features.update(self._extract_social_context_features(user_row, interaction_data))
            
            contextual_features.append(features)
        
        return pd.DataFrame(contextual_features)
    
    def _generate_advanced_content_features(self, item_data: pd.DataFrame,
                                          interaction_data: pd.DataFrame) -> pd.DataFrame:
        """Generate advanced content-based features."""
        content_features = []
        
        for _, item_row in item_data.iterrows():
            item_id = item_row['item_id']
            item_interactions = interaction_data[interaction_data['item_id'] == item_id]
            
            features = {'item_id': item_id}
            
            # Enhanced text features
            if 'title' in item_row:
                features.update(self._extract_advanced_text_features(item_row['title'], 'title'))
            
            if 'description' in item_row:
                features.update(self._extract_advanced_text_features(item_row['description'], 'description'))
            
            # Category hierarchy features
            if 'category' in item_row:
                features.update(self._extract_category_hierarchy_features(item_row['category']))
            
            # Popularity and trend features
            features.update(self._extract_popularity_features(item_interactions))
            
            # Quality indicators
            features.update(self._extract_quality_indicators(item_row, item_interactions))
            
            content_features.append(features)
        
        return pd.DataFrame(content_features)
    
    def _generate_ensemble_features(self, feature_sets: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Generate ensemble features by combining multiple feature sets."""
        ensemble_features = []
        
        # Find common entities (users or items) across feature sets
        common_entities = set()
        id_columns = []
        
        for name, features in feature_sets.items():
            if 'user_id' in features.columns:
                common_entities.update(features['user_id'].unique())
                id_columns.append('user_id')
            elif 'item_id' in features.columns:
                common_entities.update(features['item_id'].unique())
                id_columns.append('item_id')
        
        # Use the most common ID type
        if id_columns:
            primary_id = max(set(id_columns), key=id_columns.count)
            
            for entity_id in common_entities:
                entity_features = {primary_id: entity_id}
                
                # Combine features from all sets
                for name, features in feature_sets.items():
                    if primary_id in features.columns:
                        entity_data = features[features[primary_id] == entity_id]
                        if not entity_data.empty:
                            # Add features with set prefix
                            for col in entity_data.columns:
                                if col != primary_id:
                                    entity_features[f'{name}_{col}'] = entity_data[col].iloc[0]
                
                # Generate interaction features between different feature sets
                entity_features.update(self._generate_cross_feature_interactions(entity_features))
                
                ensemble_features.append(entity_features)
        
        return pd.DataFrame(ensemble_features)
    
    def generate_cold_start_recommendations(self, user_features: pd.DataFrame,
                                          item_features: pd.DataFrame,
                                          popular_items: List[str],
                                          recommendation_strategy: str = 'hybrid') -> Dict[str, List[str]]:
        """
        Generate advanced recommendations for cold start scenarios.
        
        Args:
            user_features: Cold start user features
            item_features: Cold start item features  
            popular_items: List of popular item IDs
            recommendation_strategy: Strategy to use ('content', 'demographic', 'hybrid', 'adaptive')
            
        Returns:
            Dictionary mapping user_id to recommended item_ids
        """
        recommendations = {}
        
        for _, user_row in user_features.iterrows():
            user_id = user_row['user_id']
            
            if recommendation_strategy == 'hybrid':
                # Advanced hybrid approach
                recs = self._generate_hybrid_recommendations(user_row, item_features, popular_items)
            elif recommendation_strategy == 'adaptive':
                # Adaptive strategy based on user characteristics
                recs = self._generate_adaptive_recommendations(user_row, item_features, popular_items)
            elif recommendation_strategy == 'content':
                recs = self._generate_content_based_recs(user_row, item_features)
            elif recommendation_strategy == 'demographic':
                recs = self._generate_demographic_recs(user_row, item_features)
            else:
                # Fallback to popular items
                recs = popular_items[:10]
            
            recommendations[user_id] = recs[:10]  # Top 10 recommendations
        
        return recommendations
    
    # Helper methods for automated feature generation
    def _calculate_avg_interaction_interval(self, timestamps: pd.Series) -> float:
        """Calculate average time between interactions."""
        if len(timestamps) < 2:
            return 0.0
        
        intervals = timestamps.diff().dropna()
        return intervals.mean().total_seconds() / 3600  # Hours
    
    def _classify_interaction_frequency(self, timestamps: pd.Series) -> str:
        """Classify user interaction frequency pattern."""
        if len(timestamps) < 2:
            return 'single'
        
        avg_interval = self._calculate_avg_interaction_interval(timestamps)
        
        if avg_interval < 1:  # Less than 1 hour
            return 'burst'
        elif avg_interval < 24:  # Less than 1 day
            return 'frequent'
        elif avg_interval < 168:  # Less than 1 week
            return 'regular'
        else:
            return 'infrequent'
    
    def _count_interaction_sessions(self, timestamps: pd.Series, session_gap_hours: float = 2) -> int:
        """Count number of interaction sessions."""
        if len(timestamps) < 2:
            return 1
        
        sorted_timestamps = timestamps.sort_values()
        gaps = sorted_timestamps.diff()
        session_breaks = gaps > pd.Timedelta(hours=session_gap_hours)
        
        return session_breaks.sum() + 1
    
    def _calculate_weekend_ratio(self, timestamps: pd.Series) -> float:
        """Calculate ratio of weekend interactions."""
        weekend_interactions = timestamps[timestamps.dt.dayofweek >= 5]
        return len(weekend_interactions) / len(timestamps) if len(timestamps) > 0 else 0
    
    def _identify_peak_hour(self, timestamps: pd.Series) -> int:
        """Identify user's peak interaction hour."""
        if len(timestamps) == 0:
            return 0
        
        hour_counts = timestamps.dt.hour.value_counts()
        return hour_counts.index[0]
    
    def _calculate_regularity_score(self, timestamps: pd.Series) -> float:
        """Calculate how regular the user's interactions are."""
        if len(timestamps) < 3:
            return 0.0
        
        intervals = timestamps.diff().dropna()
        interval_hours = intervals.dt.total_seconds() / 3600
        
        # Lower coefficient of variation indicates higher regularity
        cv = interval_hours.std() / (interval_hours.mean() + 1e-8)
        regularity_score = 1.0 / (1.0 + cv)
        
        return regularity_score
    
    def _calculate_interaction_entropy(self, interactions: pd.DataFrame) -> float:
        """Calculate entropy of user's item interactions."""
        item_counts = interactions['item_id'].value_counts()
        probabilities = item_counts / item_counts.sum()
        
        return entropy(probabilities)
    
    def _calculate_category_diversity(self, interactions: pd.DataFrame) -> float:
        """Calculate diversity of categories user interacts with."""
        if 'category' not in interactions.columns:
            return 0.0
        
        unique_categories = interactions['category'].nunique()
        total_interactions = len(interactions)
        
        return unique_categories / total_interactions if total_interactions > 0 else 0
    
    def _calculate_exploration_score(self, interactions: pd.DataFrame) -> float:
        """Calculate exploration vs exploitation score."""
        unique_items = interactions['item_id'].nunique()
        total_interactions = len(interactions)
        
        return unique_items / total_interactions if total_interactions > 0 else 0
    
    def _extract_enhanced_demographic_features(self, user_data: pd.Series) -> Dict[str, Any]:
        """Extract enhanced demographic features."""
        features = {}
        
        # Age-based features with more granularity
        if 'age' in user_data:
            age = user_data['age']
            features.update({
                'age_normalized': age / 100.0,  # Normalize for ML
                'age_generation': self._classify_generation(age),
                'age_life_stage': self._classify_life_stage(age)
            })
        
        # Enhanced location features
        if 'location' in user_data:
            location = str(user_data['location'])
            features.update({
                'location_urban_score': self._calculate_urban_score(location),
                'location_region': self._extract_region(location),
                'location_climate': self._infer_climate(location)
            })
        
        return features
    
    def _extract_behavioral_context_features(self, user_data: pd.Series, 
                                           interactions: pd.DataFrame) -> Dict[str, Any]:
        """Extract behavioral context features."""
        features = {}
        
        # Device and platform preferences
        if 'device_type' in user_data:
            device = str(user_data['device_type'])
            features.update({
                'device_mobility_score': self._calculate_mobility_score(device),
                'device_tech_savviness': self._infer_tech_savviness(device)
            })
        
        # Onboarding and early behavior
        if 'registration_date' in user_data:
            reg_date = pd.to_datetime(user_data['registration_date'])
            features.update({
                'registration_recency': (pd.Timestamp.now() - reg_date).days,
                'early_adopter_score': self._calculate_early_adopter_score(reg_date),
                'onboarding_season': self._classify_season(reg_date)
            })
        
        return features
    
    def _extract_social_context_features(self, user_data: pd.Series,
                                       all_interactions: pd.DataFrame) -> Dict[str, Any]:
        """Extract social context features."""
        features = {}
        
        # Network effects and social proof
        user_id = user_data['user_id']
        
        # Calculate social influence scores
        features.update({
            'social_proof_score': self._calculate_social_proof_score(user_id, all_interactions),
            'network_centrality': self._calculate_network_centrality(user_id, all_interactions),
            'trend_following_score': self._calculate_trend_following_score(user_id, all_interactions)
        })
        
        return features
    
    # Additional helper methods would continue here...
    # For brevity, I'll provide key method stubs:
    
    def _classify_generation(self, age: int) -> str:
        """Classify user into generational cohort."""
        if age < 25:
            return 'gen_z'
        elif age < 40:
            return 'millennial'
        elif age < 55:
            return 'gen_x'
        else:
            return 'boomer'
    
    def _calculate_social_proof_score(self, user_id: str, interactions: pd.DataFrame) -> float:
        """Calculate social proof influence score."""
        # Simplified implementation
        user_items = interactions[interactions['user_id'] == user_id]['item_id'].unique()
        popular_items = interactions['item_id'].value_counts().head(100).index
        
        overlap = len(set(user_items) & set(popular_items))
        return overlap / len(user_items) if len(user_items) > 0 else 0
    
    def _generate_hybrid_recommendations(self, user_row: pd.Series,
                                       item_features: pd.DataFrame,
                                       popular_items: List[str]) -> List[str]:
        """Generate hybrid recommendations using multiple strategies."""
        # Content-based recommendations
        content_recs = self._generate_content_based_recs(user_row, item_features)
        
        # Demographic-based recommendations
        demo_recs = self._generate_demographic_recs(user_row, item_features)
        
        # Popularity-based recommendations
        popular_recs = popular_items[:15]
        
        # Advanced weighted combination
        combined_recs = self._advanced_recommendation_fusion([
            (content_recs, 0.4),
            (demo_recs, 0.3),
            (popular_recs, 0.3)
        ], user_row)
        
        return combined_recs
    
    def _generate_adaptive_recommendations(self, user_row: pd.Series,
                                         item_features: pd.DataFrame,
                                         popular_items: List[str]) -> List[str]:
        """Generate adaptive recommendations based on user characteristics."""
        # Analyze user characteristics to determine best strategy
        strategy_weights = self._determine_strategy_weights(user_row)
        
        # Generate recommendations using adaptive weights
        content_recs = self._generate_content_based_recs(user_row, item_features)
        demo_recs = self._generate_demographic_recs(user_row, item_features)
        popular_recs = popular_items[:15]
        
        return self._advanced_recommendation_fusion([
            (content_recs, strategy_weights.get('content', 0.3)),
            (demo_recs, strategy_weights.get('demographic', 0.3)),
            (popular_recs, strategy_weights.get('popularity', 0.4))
        ], user_row)
    
    def _determine_strategy_weights(self, user_row: pd.Series) -> Dict[str, float]:
        """Determine optimal strategy weights based on user characteristics."""
        weights = {'content': 0.3, 'demographic': 0.3, 'popularity': 0.4}
        
        # Adjust weights based on available user information
        if 'age' in user_row and pd.notna(user_row['age']):
            weights['demographic'] += 0.1
            weights['popularity'] -= 0.1
        
        if 'interaction_count' in user_row and user_row['interaction_count'] > 0:
            weights['content'] += 0.1
            weights['popularity'] -= 0.1
        
        return weights
    
    def _advanced_recommendation_fusion(self, recommendation_lists: List[Tuple[List[str], float]],
                                      user_row: pd.Series) -> List[str]:
        """Advanced fusion of multiple recommendation lists."""
        item_scores = {}
        
        for rec_list, weight in recommendation_lists:
            for i, item_id in enumerate(rec_list):
                # Position-based scoring with decay
                position_score = 1.0 / (i + 1)
                
                # Apply user-specific adjustments
                adjusted_weight = self._adjust_weight_for_user(weight, user_row)
                
                score = adjusted_weight * position_score
                item_scores[item_id] = item_scores.get(item_id, 0) + score
        
        # Sort by combined score and return top items
        sorted_items = sorted(item_scores.items(), key=lambda x: x[1], reverse=True)
        return [item_id for item_id, score in sorted_items]
    
    def _adjust_weight_for_user(self, base_weight: float, user_row: pd.Series) -> float:
        """Adjust recommendation weight based on user characteristics."""
        # Simple adjustment logic - can be made more sophisticated
        adjustment = 1.0
        
        # Boost content weight for tech-savvy users
        if 'device_tech_savviness' in user_row and user_row['device_tech_savviness'] > 0.7:
            if 'content' in str(base_weight):  # Simplified check
                adjustment = 1.2
        
        return base_weight * adjustment
    
    def _extract_demographic_features(self, user_info: pd.Series) -> Dict[str, Any]:
        """Extract demographic features from user data."""
        features = {}
        
        # Age-related features
        if 'age' in user_info:
            age = user_info['age']
            features.update({
                'age': age,
                'age_group': self._categorize_age(age),
                'is_young_adult': 1 if 18 <= age <= 25 else 0,
                'is_middle_aged': 1 if 26 <= age <= 45 else 0,
                'is_senior': 1 if age >= 46 else 0
            })
        
        # Gender features
        if 'gender' in user_info:
            gender = user_info['gender']
            features.update({
                'is_male': 1 if gender.lower() == 'male' else 0,
                'is_female': 1 if gender.lower() == 'female' else 0
            })
        
        # Location features
        if 'location' in user_info:
            location = user_info['location']
            features.update({
                'location_hash': hash(str(location)) % 1000,  # Simple location encoding
                'is_urban': self._is_urban_location(location)
            })
        
        # Income/spending power indicators
        if 'income' in user_info:
            income = user_info['income']
            features.update({
                'income_level': self._categorize_income(income),
                'high_spending_power': 1 if income > 75000 else 0
            })
        
        return features
    
    def _infer_behavioral_patterns(self, interactions: pd.DataFrame) -> Dict[str, float]:
        """Infer behavioral patterns from limited interactions."""
        if len(interactions) == 0:
            return {
                'interaction_count': 0,
                'avg_rating': 0,
                'interaction_diversity': 0,
                'time_span_days': 0,
                'interaction_frequency': 0
            }
        
        features = {
            'interaction_count': len(interactions),
            'avg_rating': interactions['rating'].mean() if 'rating' in interactions.columns else 0,
            'interaction_diversity': len(interactions['item_id'].unique()) / len(interactions),
        }
        
        # Temporal patterns
        if 'timestamp' in interactions.columns:
            timestamps = pd.to_datetime(interactions['timestamp'])
            time_span = (timestamps.max() - timestamps.min()).days
            features.update({
                'time_span_days': time_span,
                'interaction_frequency': len(interactions) / max(1, time_span),
                'recent_activity': 1 if time_span <= 7 else 0
            })
        
        # Category preferences
        if 'category' in interactions.columns:
            category_counts = interactions['category'].value_counts()
            features.update({
                'favorite_category': category_counts.index[0] if len(category_counts) > 0 else None,
                'category_concentration': category_counts.iloc[0] / len(interactions) if len(category_counts) > 0 else 0
            })
        
        return features
    
    def _extract_contextual_features(self, user_info: pd.Series, 
                                   interactions: pd.DataFrame) -> Dict[str, Any]:
        """Extract contextual features for recommendation."""
        features = {}
        
        # Registration context
        if 'registration_date' in user_info:
            reg_date = pd.to_datetime(user_info['registration_date'])
            days_since_reg = (pd.Timestamp.now() - reg_date).days
            features.update({
                'days_since_registration': days_since_reg,
                'is_very_new_user': 1 if days_since_reg <= 7 else 0,
                'registration_season': reg_date.month // 4  # 0: Q1, 1: Q2, etc.
            })
        
        # Device/platform context
        if 'device_type' in user_info:
            device = user_info['device_type']
            features.update({
                'is_mobile_user': 1 if 'mobile' in str(device).lower() else 0,
                'is_desktop_user': 1 if 'desktop' in str(device).lower() else 0
            })
        
        # Acquisition channel
        if 'acquisition_channel' in user_info:
            channel = user_info['acquisition_channel']
            features.update({
                'is_organic_user': 1 if 'organic' in str(channel).lower() else 0,
                'is_paid_user': 1 if 'paid' in str(channel).lower() else 0,
                'is_social_user': 1 if 'social' in str(channel).lower() else 0
            })
        
        return features
    
    def _extract_cold_start_signals(self, interactions: pd.DataFrame) -> Dict[str, float]:
        """Extract signals specific to cold start scenarios."""
        signals = {
            'is_cold_start_user': 1 if len(interactions) <= 5 else 0,
            'interaction_velocity': len(interactions) / max(1, 7),  # Interactions per week
            'early_engagement_score': self._calculate_early_engagement(interactions)
        }
        
        return signals
    
    def _extract_content_features(self, item_info: pd.Series) -> Dict[str, Any]:
        """Extract content-based features from item metadata."""
        features = {}
        
        # Text features from title/description
        if 'title' in item_info:
            title = str(item_info['title'])
            features.update({
                'title_length': len(title),
                'title_word_count': len(title.split()),
                'has_numbers_in_title': 1 if any(c.isdigit() for c in title) else 0
            })
        
        if 'description' in item_info:
            desc = str(item_info['description'])
            features.update({
                'description_length': len(desc),
                'description_word_count': len(desc.split()),
                'description_sentiment': self._calculate_text_sentiment(desc)
            })
        
        # Brand features
        if 'brand' in item_info:
            brand = str(item_info['brand'])
            features.update({
                'brand_hash': hash(brand) % 1000,
                'is_premium_brand': self._is_premium_brand(brand)
            })
        
        return features
    
    def _extract_category_features(self, item_info: pd.Series) -> Dict[str, Any]:
        """Extract category and taxonomy features."""
        features = {}
        
        if 'category' in item_info:
            category = str(item_info['category'])
            features.update({
                'category_hash': hash(category) % 100,
                'category_level': len(category.split('/')),  # Depth in taxonomy
            })
        
        # Sub-category features
        if 'subcategory' in item_info:
            subcategory = str(item_info['subcategory'])
            features['subcategory_hash'] = hash(subcategory) % 100
        
        return features
    
    def _extract_price_features(self, item_info: pd.Series) -> Dict[str, float]:
        """Extract price and value-related features."""
        features = {}
        
        if 'price' in item_info:
            price = float(item_info['price']) if item_info['price'] is not None else 0
            features.update({
                'price': price,
                'price_tier': self._categorize_price(price),
                'is_expensive': 1 if price > 100 else 0,
                'is_budget': 1 if price < 20 else 0
            })
        
        # Discount features
        if 'original_price' in item_info and 'price' in item_info:
            original = float(item_info['original_price']) if item_info['original_price'] is not None else 0
            current = float(item_info['price']) if item_info['price'] is not None else 0
            
            if original > 0:
                discount_pct = (original - current) / original
                features.update({
                    'discount_percentage': discount_pct,
                    'is_on_sale': 1 if discount_pct > 0.1 else 0
                })
        
        return features
    
    def _extract_early_interaction_features(self, interactions: pd.DataFrame) -> Dict[str, float]:
        """Extract features from early item interactions."""
        if len(interactions) == 0:
            return {
                'early_interaction_count': 0,
                'early_rating_avg': 0,
                'early_engagement_rate': 0
            }
        
        # Consider only first week of interactions as "early"
        if 'timestamp' in interactions.columns:
            interactions['timestamp'] = pd.to_datetime(interactions['timestamp'])
            first_interaction = interactions['timestamp'].min()
            early_cutoff = first_interaction + pd.Timedelta(days=7)
            early_interactions = interactions[interactions['timestamp'] <= early_cutoff]
        else:
            early_interactions = interactions.head(10)  # First 10 interactions
        
        features = {
            'early_interaction_count': len(early_interactions),
            'early_rating_avg': early_interactions['rating'].mean() if 'rating' in early_interactions.columns else 0,
            'early_engagement_rate': len(early_interactions) / max(1, len(interactions))
        }
        
        return features
    
    def _calculate_item_similarity_features(self, item_info: pd.Series, 
                                          all_items: pd.DataFrame) -> Dict[str, float]:
        """Calculate similarity features to popular/successful items."""
        features = {}
        
        # Simple similarity based on category
        if 'category' in item_info and 'category' in all_items.columns:
            same_category_items = all_items[all_items['category'] == item_info['category']]
            features['category_item_count'] = len(same_category_items)
        
        # Price similarity to category average
        if 'price' in item_info and 'price' in all_items.columns:
            category_avg_price = all_items[all_items['category'] == item_info['category']]['price'].mean()
            price_diff = abs(float(item_info['price']) - category_avg_price) if category_avg_price else 0
            features['price_deviation_from_category'] = price_diff
        
        return features
    
    # Helper methods
    def _categorize_age(self, age: int) -> str:
        """Categorize age into groups."""
        if age < 18:
            return 'minor'
        elif age < 25:
            return 'young_adult'
        elif age < 35:
            return 'adult'
        elif age < 50:
            return 'middle_aged'
        else:
            return 'senior'
    
    def _categorize_income(self, income: float) -> str:
        """Categorize income into levels."""
        if income < 30000:
            return 'low'
        elif income < 60000:
            return 'medium'
        elif income < 100000:
            return 'high'
        else:
            return 'very_high'
    
    def _categorize_price(self, price: float) -> str:
        """Categorize price into tiers."""
        if price < 10:
            return 'very_low'
        elif price < 50:
            return 'low'
        elif price < 200:
            return 'medium'
        elif price < 500:
            return 'high'
        else:
            return 'very_high'
    
    def _is_urban_location(self, location: str) -> int:
        """Simple urban location detection."""
        urban_keywords = ['city', 'urban', 'metro', 'downtown']
        return 1 if any(keyword in str(location).lower() for keyword in urban_keywords) else 0
    
    def _is_premium_brand(self, brand: str) -> int:
        """Simple premium brand detection."""
        premium_keywords = ['luxury', 'premium', 'deluxe', 'pro', 'elite']
        return 1 if any(keyword in str(brand).lower() for keyword in premium_keywords) else 0
    
    def _calculate_text_sentiment(self, text: str) -> float:
        """Simple sentiment analysis."""
        positive_words = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'best']
        negative_words = ['bad', 'terrible', 'awful', 'worst', 'horrible', 'poor']
        
        text_lower = text.lower()
        pos_count = sum(word in text_lower for word in positive_words)
        neg_count = sum(word in text_lower for word in negative_words)
        
        if pos_count + neg_count == 0:
            return 0.0
        return (pos_count - neg_count) / (pos_count + neg_count)
    
    def _calculate_early_engagement(self, interactions: pd.DataFrame) -> float:
        """Calculate early engagement score."""
        if len(interactions) == 0:
            return 0.0
        
        # Simple engagement based on interaction count and ratings
        interaction_score = min(len(interactions) / 10, 1.0)  # Normalize to 0-1
        
        if 'rating' in interactions.columns:
            rating_score = interactions['rating'].mean() / 5.0  # Assuming 5-star scale
            return (interaction_score + rating_score) / 2
        
        return interaction_score
    
    def _generate_content_based_recs(self, user_features: pd.Series, 
                                   item_features: pd.DataFrame) -> List[str]:
        """Generate content-based recommendations."""
        # Simple content-based approach - could be enhanced with more sophisticated methods
        recommendations = item_features['item_id'].head(5).tolist()
        return recommendations
    
    def _generate_demographic_recs(self, user_features: pd.Series,
                                 item_features: pd.DataFrame) -> List[str]:
        """Generate demographic-based recommendations."""
        # Simple demographic approach - could be enhanced
        recommendations = item_features['item_id'].head(5).tolist()
        return recommendations
    
    def _combine_recommendations(self, rec_lists: List[Tuple[List[str], float]]) -> List[str]:
        """Combine multiple recommendation lists with weights."""
        combined_scores = {}
        
        for rec_list, weight in rec_lists:
            for i, item_id in enumerate(rec_list):
                score = weight * (len(rec_list) - i) / len(rec_list)  # Position-based scoring
                combined_scores[item_id] = combined_scores.get(item_id, 0) + score
        
        # Sort by combined score
        sorted_items = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        return [item_id for item_id, score in sorted_items]


class RareEventFeatureEngine:
    """
    Advanced feature engineering for financial rare event detection and sampling.
    
    Features:
    - Sophisticated sampling techniques for imbalanced datasets
    - Financial anomaly detection features
    - Risk indicators and market stress features
    - Temporal pattern analysis for rare events
    - Advanced oversampling and undersampling methods
    """
    
    def __init__(self):
        self.scaler = RobustScaler()  # Better for financial data with outliers
        self.rare_event_patterns = {}
        
    def extract_rare_event_features(self, data: pd.DataFrame,
                                  target_column: str,
                                  timestamp_col: Optional[str] = None) -> pd.DataFrame:
        """
        Extract features specifically designed for rare event detection.
        
        Args:
            data: Financial dataset
            target_column: Binary target indicating rare events
            timestamp_col: Optional timestamp column for temporal features
            
        Returns:
            Enhanced dataset with rare event features
        """
        logger.info("Extracting rare event features for financial data")
        
        enhanced_data = data.copy()
        
        # Statistical outlier features
        enhanced_data = self._add_outlier_features(enhanced_data, target_column)
        
        # Risk and volatility features
        enhanced_data = self._add_risk_features(enhanced_data)
        
        # Temporal patterns (if timestamp available)
        if timestamp_col and timestamp_col in data.columns:
            enhanced_data = self._add_temporal_features(enhanced_data, timestamp_col, target_column)
        
        # Market stress indicators
        enhanced_data = self._add_market_stress_features(enhanced_data)
        
        # Cross-feature interactions
        enhanced_data = self._add_interaction_features(enhanced_data)
        
        # Regime change indicators
        enhanced_data = self._add_regime_change_features(enhanced_data, target_column)
        
        logger.info(f"Added {len(enhanced_data.columns) - len(data.columns)} rare event features")
        return enhanced_data
    
    def advanced_rare_event_sampling(self, X: pd.DataFrame, y: pd.Series,
                                   sampling_method: str = 'adaptive') -> Tuple[pd.DataFrame, pd.Series]:
        """
        Apply sophisticated sampling techniques for rare events.
        
        Args:
            X: Feature matrix
            y: Target vector (binary, with rare events as 1)
            sampling_method: Sampling strategy ('adaptive', 'cost_sensitive', 'ensemble')
            
        Returns:
            Resampled X and y
        """
        logger.info(f"Applying {sampling_method} sampling for rare events")
        
        rare_event_ratio = y.sum() / len(y)
        logger.info(f"Original rare event ratio: {rare_event_ratio:.4f}")
        
        if sampling_method == 'adaptive':
            return self._adaptive_sampling(X, y, rare_event_ratio)
        elif sampling_method == 'cost_sensitive':
            return self._cost_sensitive_sampling(X, y, rare_event_ratio)
        elif sampling_method == 'ensemble':
            return self._ensemble_sampling(X, y, rare_event_ratio)
        else:
            raise ValueError(f"Unknown sampling method: {sampling_method}")
    
    def generate_synthetic_rare_events(self, X: pd.DataFrame, y: pd.Series,
                                     n_synthetic: int = None,
                                     method: str = 'smote_variants') -> Tuple[pd.DataFrame, pd.Series]:
        """
        Generate synthetic rare events using advanced techniques.
        
        Args:
            X: Feature matrix
            y: Target vector
            n_synthetic: Number of synthetic samples to generate
            method: Synthesis method ('smote_variants', 'gan_inspired', 'bayesian', 'ensemble')
            
        Returns:
            Original data augmented with synthetic rare events
        """
        logger.info(f"Generating synthetic rare events using {method} method")
        
        # Identify rare events
        rare_indices = y[y == 1].index
        rare_X = X.loc[rare_indices]
        
        if len(rare_X) < 2:
            logger.warning("Insufficient rare events for synthetic generation")
            return X, y
        
        if n_synthetic is None:
            n_synthetic = min(len(rare_X) * 3, 1500)  # More aggressive default for rare events
        
        if method == 'smote_variants':
            synthetic_samples = self._generate_smote_variants(rare_X, n_synthetic)
        elif method == 'gan_inspired':
            synthetic_samples = self._generate_gan_inspired_samples(rare_X, n_synthetic)
        elif method == 'bayesian':
            synthetic_samples = self._generate_bayesian_samples(rare_X, n_synthetic)
        elif method == 'ensemble':
            synthetic_samples = self._generate_ensemble_synthetic_samples(rare_X, n_synthetic)
        else:
            # Fallback to improved SMOTE-like approach
            synthetic_samples = self._generate_improved_smote_samples(rare_X, n_synthetic)
        
        # Combine with original data
        if synthetic_samples:
            synthetic_df = pd.DataFrame(synthetic_samples, columns=X.columns)
            synthetic_y = pd.Series([1] * len(synthetic_df), name=y.name)
            
            X_augmented = pd.concat([X, synthetic_df], ignore_index=True)
            y_augmented = pd.concat([y, synthetic_y], ignore_index=True)
            
            logger.info(f"Generated {len(synthetic_df)} synthetic rare events")
            return X_augmented, y_augmented
        else:
            logger.warning("Failed to generate synthetic samples")
            return X, y
    
    def _generate_smote_variants(self, rare_X: pd.DataFrame, n_synthetic: int) -> List[np.ndarray]:
        """Generate synthetic samples using SMOTE variants."""
        from sklearn.neighbors import NearestNeighbors
        
        synthetic_samples = []
        
        # Adaptive k based on data size
        k_neighbors = min(5, max(2, len(rare_X) // 2))
        nn = NearestNeighbors(n_neighbors=k_neighbors, metric='euclidean')
        nn.fit(rare_X)
        
        for _ in range(n_synthetic):
            # Select random base sample
            base_idx = np.random.choice(rare_X.index)
            base_sample = rare_X.loc[base_idx].values
            
            # Find k nearest neighbors
            distances, indices = nn.kneighbors([base_sample])
            
            # Select neighbor with probability inversely proportional to distance
            neighbor_probs = 1.0 / (distances[0][1:] + 1e-8)  # Exclude self
            neighbor_probs /= neighbor_probs.sum()
            
            selected_neighbor_idx = np.random.choice(
                indices[0][1:], 
                p=neighbor_probs
            )
            neighbor_sample = rare_X.iloc[selected_neighbor_idx].values
            
            # Borderline-SMOTE approach: vary interpolation based on local density
            local_density = np.mean(distances[0][1:])
            if local_density > np.median(distances[0][1:]):
                # High density area - conservative interpolation
                alpha = np.random.uniform(0.3, 0.7)
            else:
                # Low density area - more aggressive interpolation
                alpha = np.random.uniform(0.1, 0.9)
            
            # Generate synthetic sample
            synthetic_sample = base_sample + alpha * (neighbor_sample - base_sample)
            
            # Add adaptive noise based on feature variance
            feature_vars = rare_X.var()
            noise = np.random.normal(0, feature_vars * 0.05, len(synthetic_sample))
            synthetic_sample += noise
            
            synthetic_samples.append(synthetic_sample)
        
        return synthetic_samples
    
    def _generate_gan_inspired_samples(self, rare_X: pd.DataFrame, n_synthetic: int) -> List[np.ndarray]:
        """Generate synthetic samples using GAN-inspired approach."""
        # Simplified GAN-inspired generation without full neural networks
        synthetic_samples = []
        
        # Estimate data distribution parameters
        means = rare_X.mean()
        stds = rare_X.std()
        correlations = rare_X.corr()
        
        # Generate samples that respect correlations
        for _ in range(n_synthetic):
            # Start with random normal sample
            base_sample = np.random.normal(means, stds)
            
            # Apply correlation structure iteratively
            for iteration in range(3):  # Few iterations for efficiency
                for i, col in enumerate(rare_X.columns):
                    # Adjust feature based on correlations with other features
                    correlation_adjustment = 0
                    for j, other_col in enumerate(rare_X.columns):
                        if i != j:
                            correlation = correlations.iloc[i, j]
                            correlation_adjustment += correlation * (base_sample[j] - means[j])
                    
                    # Apply adjustment with learning rate
                    learning_rate = 0.1
                    base_sample[i] += learning_rate * correlation_adjustment
            
            # Ensure sample is within reasonable bounds
            for i, col in enumerate(rare_X.columns):
                col_min, col_max = rare_X[col].min(), rare_X[col].max()
                margin = (col_max - col_min) * 0.1
                base_sample[i] = np.clip(base_sample[i], col_min - margin, col_max + margin)
            
            synthetic_samples.append(base_sample)
        
        return synthetic_samples
    
    def _generate_bayesian_samples(self, rare_X: pd.DataFrame, n_synthetic: int) -> List[np.ndarray]:
        """Generate synthetic samples using Bayesian approach."""
        from sklearn.mixture import GaussianMixture
        
        synthetic_samples = []
        
        try:
            # Fit Gaussian Mixture Model
            n_components = min(3, max(1, len(rare_X) // 5))
            gmm = GaussianMixture(n_components=n_components, random_state=42)
            gmm.fit(rare_X)
            
            # Generate samples from the fitted model
            synthetic_samples_array, _ = gmm.sample(n_synthetic)
            synthetic_samples = [sample for sample in synthetic_samples_array]
            
        except:
            # Fallback to multivariate normal
            mean = rare_X.mean()
            cov = rare_X.cov()
            
            # Add small regularization to covariance matrix
            regularization = np.eye(len(cov)) * 1e-6
            cov_regularized = cov + regularization
            
            synthetic_samples_array = np.random.multivariate_normal(
                mean, cov_regularized, n_synthetic
            )
            synthetic_samples = [sample for sample in synthetic_samples_array]
        
        return synthetic_samples
    
    def _generate_ensemble_synthetic_samples(self, rare_X: pd.DataFrame, n_synthetic: int) -> List[np.ndarray]:
        """Generate synthetic samples using ensemble of methods."""
        # Split synthetic samples among different methods
        n_per_method = n_synthetic // 3
        remainder = n_synthetic % 3
        
        all_synthetic_samples = []
        
        # SMOTE variants
        smote_samples = self._generate_smote_variants(rare_X, n_per_method + remainder)
        all_synthetic_samples.extend(smote_samples)
        
        # GAN-inspired
        gan_samples = self._generate_gan_inspired_samples(rare_X, n_per_method)
        all_synthetic_samples.extend(gan_samples)
        
        # Bayesian
        bayesian_samples = self._generate_bayesian_samples(rare_X, n_per_method)
        all_synthetic_samples.extend(bayesian_samples)
        
        # Shuffle to mix different methods
        np.random.shuffle(all_synthetic_samples)
        
        return all_synthetic_samples
    
    def _generate_improved_smote_samples(self, rare_X: pd.DataFrame, n_synthetic: int) -> List[np.ndarray]:
        """Generate synthetic samples using improved SMOTE approach."""
        from sklearn.neighbors import NearestNeighbors
        
        synthetic_samples = []
        
        # Use adaptive k based on data characteristics
        k_neighbors = min(5, max(2, len(rare_X) // 2))
        nn = NearestNeighbors(n_neighbors=k_neighbors, metric='euclidean')
        nn.fit(rare_X)
        
        for _ in range(n_synthetic):
            # Select random rare event
            base_idx = np.random.choice(rare_X.index)
            base_sample = rare_X.loc[base_idx].values
            
            # Find neighbors
            distances, indices = nn.kneighbors([base_sample])
            neighbor_idx = np.random.choice(indices[0][1:])  # Exclude self
            neighbor_sample = rare_X.iloc[neighbor_idx].values
            
            # Adaptive interpolation based on local neighborhood density
            avg_distance = np.mean(distances[0][1:])
            if avg_distance > rare_X.std().mean():
                # Sparse area - more conservative interpolation
                alpha = np.random.uniform(0.2, 0.8)
            else:
                # Dense area - more aggressive interpolation
                alpha = np.random.uniform(0.1, 0.9)
            
            # Generate synthetic sample
            synthetic_sample = base_sample + alpha * (neighbor_sample - base_sample)
            
            # Add intelligent noise based on feature characteristics
            feature_ranges = rare_X.max() - rare_X.min()
            noise_scale = feature_ranges * 0.02  # 2% of feature range
            noise = np.random.normal(0, noise_scale, len(synthetic_sample))
            synthetic_sample += noise
            
            synthetic_samples.append(synthetic_sample)
        
        return synthetic_samples
    
    def advanced_imbalanced_sampling(self, X: pd.DataFrame, y: pd.Series,
                                   target_ratio: float = 0.1,
                                   strategy: str = 'hybrid') -> Tuple[pd.DataFrame, pd.Series]:
        """
        Advanced sampling strategy specifically designed for highly imbalanced rare events.
        
        Args:
            X: Feature matrix
            y: Target vector
            target_ratio: Desired ratio of rare events to total samples
            strategy: Sampling strategy ('hybrid', 'cluster_based', 'ensemble_boost')
            
        Returns:
            Balanced dataset optimized for rare event detection
        """
        logger.info(f"Applying advanced imbalanced sampling with target ratio {target_ratio}")
        
        rare_indices = y[y == 1].index
        normal_indices = y[y == 0].index
        
        current_ratio = len(rare_indices) / len(y)
        
        if current_ratio >= target_ratio:
            logger.info(f"Current ratio {current_ratio:.4f} already meets target {target_ratio}")
            return X, y
        
        if strategy == 'hybrid':
            return self._hybrid_rare_event_sampling(X, y, rare_indices, normal_indices, target_ratio)
        elif strategy == 'cluster_based':
            return self._cluster_based_sampling(X, y, rare_indices, normal_indices, target_ratio)
        elif strategy == 'ensemble_boost':
            return self._ensemble_boost_sampling(X, y, rare_indices, normal_indices, target_ratio)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
    
    def _hybrid_rare_event_sampling(self, X: pd.DataFrame, y: pd.Series,
                                  rare_indices: pd.Index, normal_indices: pd.Index,
                                  target_ratio: float) -> Tuple[pd.DataFrame, pd.Series]:
        """Hybrid sampling combining oversampling and intelligent undersampling."""
        # Step 1: Generate synthetic rare events
        rare_X = X.loc[rare_indices]
        n_rare_needed = int(len(X) * target_ratio)
        n_synthetic = max(0, n_rare_needed - len(rare_indices))
        
        if n_synthetic > 0:
            synthetic_samples = self._generate_ensemble_synthetic_samples(rare_X, n_synthetic)
            synthetic_df = pd.DataFrame(synthetic_samples, columns=X.columns)
            synthetic_y = pd.Series([1] * len(synthetic_df))
            
            # Combine rare events
            rare_X_combined = pd.concat([rare_X, synthetic_df], ignore_index=True)
            rare_y_combined = pd.concat([y.loc[rare_indices], synthetic_y], ignore_index=True)
        else:
            rare_X_combined = rare_X
            rare_y_combined = y.loc[rare_indices]
        
        # Step 2: Intelligent undersampling of normal events
        n_normal_needed = int(len(rare_X_combined) / target_ratio) - len(rare_X_combined)
        n_normal_needed = min(n_normal_needed, len(normal_indices))
        
        # Use clustering to preserve diversity in normal samples
        normal_X_sampled = self._intelligent_undersampling(
            X.loc[normal_indices], n_normal_needed
        )
        normal_y_sampled = pd.Series([0] * len(normal_X_sampled))
        
        # Combine final dataset
        X_final = pd.concat([rare_X_combined, normal_X_sampled], ignore_index=True)
        y_final = pd.concat([rare_y_combined, normal_y_sampled], ignore_index=True)
        
        final_ratio = y_final.sum() / len(y_final)
        logger.info(f"Hybrid sampling achieved ratio: {final_ratio:.4f}")
        
        return X_final, y_final
    
    def _intelligent_undersampling(self, normal_X: pd.DataFrame, n_samples: int) -> pd.DataFrame:
        """Intelligent undersampling preserving data diversity."""
        if len(normal_X) <= n_samples:
            return normal_X
        
        try:
            from sklearn.cluster import KMeans
            
            # Use clustering to preserve diversity
            n_clusters = min(n_samples // 2, 50)  # Reasonable number of clusters
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            clusters = kmeans.fit_predict(normal_X)
            
            # Sample from each cluster proportionally
            sampled_indices = []
            cluster_counts = pd.Series(clusters).value_counts()
            
            for cluster_id in range(n_clusters):
                cluster_indices = normal_X.index[clusters == cluster_id]
                cluster_size = len(cluster_indices)
                
                if cluster_size > 0:
                    # Calculate samples needed from this cluster
                    cluster_proportion = cluster_counts[cluster_id] / len(normal_X)
                    samples_from_cluster = max(1, int(n_samples * cluster_proportion))
                    samples_from_cluster = min(samples_from_cluster, cluster_size)
                    
                    # Randomly sample from cluster
                    sampled_from_cluster = np.random.choice(
                        cluster_indices, 
                        size=samples_from_cluster, 
                        replace=False
                    )
                    sampled_indices.extend(sampled_from_cluster)
            
            # Ensure we have exactly n_samples
            if len(sampled_indices) > n_samples:
                sampled_indices = np.random.choice(sampled_indices, size=n_samples, replace=False)
            elif len(sampled_indices) < n_samples:
                # Add random samples to reach target
                remaining_indices = normal_X.index[~normal_X.index.isin(sampled_indices)]
                additional_samples = np.random.choice(
                    remaining_indices, 
                    size=n_samples - len(sampled_indices), 
                    replace=False
                )
                sampled_indices.extend(additional_samples)
            
            return normal_X.loc[sampled_indices]
            
        except:
            # Fallback to random sampling
            return normal_X.sample(n=n_samples, random_state=42)
    
    def _add_outlier_features(self, data: pd.DataFrame, target_column: str) -> pd.DataFrame:
        """Add statistical outlier detection features."""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col != target_column]
        
        for col in numeric_columns:
            # Z-score outliers
            z_scores = np.abs((data[col] - data[col].mean()) / data[col].std())
            data[f'{col}_z_outlier'] = (z_scores > 3).astype(int)
            data[f'{col}_z_score'] = z_scores
            
            # IQR outliers
            Q1 = data[col].quantile(0.25)
            Q3 = data[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            data[f'{col}_iqr_outlier'] = ((data[col] < lower_bound) | (data[col] > upper_bound)).astype(int)
            
            # Percentile features
            data[f'{col}_percentile'] = data[col].rank(pct=True)
            data[f'{col}_extreme_percentile'] = ((data[col].rank(pct=True) < 0.05) | 
                                               (data[col].rank(pct=True) > 0.95)).astype(int)
        
        return data
    
    def _add_risk_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add financial risk and volatility features."""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        # Rolling volatility features
        for window in [5, 10, 20]:
            for col in numeric_columns:
                if len(data) > window:
                    data[f'{col}_volatility_{window}d'] = data[col].rolling(window).std()
                    data[f'{col}_mean_reversion_{window}d'] = (data[col] - data[col].rolling(window).mean()).abs()
        
        # Value at Risk (VaR) approximation
        for col in numeric_columns:
            if len(data) > 20:
                data[f'{col}_var_5pct'] = data[col].rolling(20).quantile(0.05)
                data[f'{col}_var_1pct'] = data[col].rolling(20).quantile(0.01)
                
                # Risk-adjusted returns
                rolling_mean = data[col].rolling(20).mean()
                rolling_std = data[col].rolling(20).std()
                data[f'{col}_sharpe_ratio'] = rolling_mean / (rolling_std + 1e-8)
        
        return data
    
    def _add_temporal_features(self, data: pd.DataFrame, 
                             timestamp_col: str, 
                             target_column: str) -> pd.DataFrame:
        """Add temporal pattern features for rare event detection."""
        data[timestamp_col] = pd.to_datetime(data[timestamp_col])
        data = data.sort_values(timestamp_col)
        
        # Time-based features
        data['hour'] = data[timestamp_col].dt.hour
        data['day_of_week'] = data[timestamp_col].dt.dayofweek
        data['month'] = data[timestamp_col].dt.month
        data['quarter'] = data[timestamp_col].dt.quarter
        
        # Market session features (assuming financial markets)
        data['is_market_open'] = ((data['hour'] >= 9) & (data['hour'] <= 16) & 
                                 (data['day_of_week'] < 5)).astype(int)
        data['is_weekend'] = (data['day_of_week'] >= 5).astype(int)
        
        # Time since last rare event
        rare_event_times = data[data[target_column] == 1][timestamp_col]
        
        if len(rare_event_times) > 0:
            time_since_last_event = []
            last_event_time = None
            
            for timestamp in data[timestamp_col]:
                if last_event_time is None:
                    time_since_last_event.append(np.inf)
                else:
                    time_since_last_event.append((timestamp - last_event_time).total_seconds() / 3600)  # Hours
                
                if timestamp in rare_event_times.values:
                    last_event_time = timestamp
            
            data['hours_since_last_rare_event'] = time_since_last_event
            data['hours_since_last_rare_event'] = data['hours_since_last_rare_event'].replace(np.inf, 24*365)  # Cap at 1 year
        
        return data
    
    def _add_market_stress_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add market stress and regime indicators."""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        # Cross-correlation stress indicators
        if len(numeric_columns) > 1:
            # Calculate rolling correlations
            for i, col1 in enumerate(numeric_columns[:5]):  # Limit to avoid explosion
                for col2 in numeric_columns[i+1:6]:
                    if len(data) > 20:
                        corr = data[col1].rolling(20).corr(data[col2])
                        data[f'corr_{col1}_{col2}'] = corr
                        
                        # Correlation breakdown indicator
                        long_term_corr = data[col1].rolling(60).corr(data[col2]) if len(data) > 60 else corr
                        data[f'corr_breakdown_{col1}_{col2}'] = (abs(corr - long_term_corr) > 0.3).astype(int)
        
        # Dispersion indicators
        if len(numeric_columns) > 2:
            # Create a simple market stress index
            scaled_data = self.scaler.fit_transform(data[numeric_columns].fillna(0))
            data['market_dispersion'] = np.std(scaled_data, axis=1)
            data['market_stress_indicator'] = (data['market_dispersion'] > data['market_dispersion'].quantile(0.9)).astype(int)
        
        return data
    
    def _add_interaction_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add cross-feature interaction terms."""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        # Add key interaction features (limit to avoid explosion)
        important_features = numeric_columns[:10]  # Take first 10 features
        
        for i, col1 in enumerate(important_features):
            for col2 in important_features[i+1:]:
                # Multiplicative interaction
                data[f'{col1}_x_{col2}'] = data[col1] * data[col2]
                
                # Ratio interaction (avoid division by zero)
                data[f'{col1}_div_{col2}'] = data[col1] / (data[col2] + 1e-8)
        
        return data
    
    def _add_regime_change_features(self, data: pd.DataFrame, target_column: str) -> pd.DataFrame:
        """Add regime change detection features."""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col != target_column]
        
        for col in numeric_columns:
            if len(data) > 50:
                # Structural break detection using rolling statistics
                short_window = 10
                long_window = 50
                
                short_mean = data[col].rolling(short_window).mean()
                long_mean = data[col].rolling(long_window).mean()
                short_std = data[col].rolling(short_window).std()
                long_std = data[col].rolling(long_window).std()
                
                # Mean shift indicator
                mean_shift = abs(short_mean - long_mean) / (long_std + 1e-8)
                data[f'{col}_mean_shift'] = mean_shift
                data[f'{col}_regime_change'] = (mean_shift > 2).astype(int)
                
                # Volatility shift indicator
                vol_shift = abs(short_std - long_std) / (long_std + 1e-8)
                data[f'{col}_vol_shift'] = vol_shift
                data[f'{col}_vol_regime_change'] = (vol_shift > 1).astype(int)
        
        return data
    
    def _adaptive_sampling(self, X: pd.DataFrame, y: pd.Series, 
                         rare_event_ratio: float) -> Tuple[pd.DataFrame, pd.Series]:
        """Adaptive sampling based on local data density."""
        from sklearn.neighbors import NearestNeighbors
        
        # Separate rare and normal events
        rare_indices = y[y == 1].index
        normal_indices = y[y == 0].index
        
        rare_X = X.loc[rare_indices]
        normal_X = X.loc[normal_indices]
        
        # Oversample rare events
        n_rare_needed = int(len(normal_X) * 0.2)  # Target 20% rare events
        
        if len(rare_X) < n_rare_needed:
            # Generate synthetic rare events
            X_augmented, y_augmented = self.generate_synthetic_rare_events(
                X, y, n_rare_needed - len(rare_X)
            )
        else:
            X_augmented, y_augmented = X, y
        
        # Intelligent undersampling of normal events
        if len(normal_X) > n_rare_needed * 4:  # If too many normal events
            # Use Tomek links and edited nearest neighbors for undersampling
            normal_sample_size = min(len(normal_X), n_rare_needed * 4)
            sampled_normal_indices = np.random.choice(
                normal_indices, 
                size=normal_sample_size, 
                replace=False
            )
            
            # Combine rare events with sampled normal events
            final_indices = list(rare_indices) + list(sampled_normal_indices)
            X_final = X_augmented.loc[X_augmented.index.isin(final_indices)]
            y_final = y_augmented.loc[y_augmented.index.isin(final_indices)]
        else:
            X_final, y_final = X_augmented, y_augmented
        
        logger.info(f"Adaptive sampling: {len(X_final)} samples, rare event ratio: {y_final.sum()/len(y_final):.4f}")
        return X_final, y_final
    
    def _cost_sensitive_sampling(self, X: pd.DataFrame, y: pd.Series,
                               rare_event_ratio: float) -> Tuple[pd.DataFrame, pd.Series]:
        """Cost-sensitive sampling with misclassification costs."""
        # Calculate misclassification costs
        cost_ratio = (1 - rare_event_ratio) / rare_event_ratio
        
        # Oversample rare events based on cost ratio
        rare_indices = y[y == 1].index
        normal_indices = y[y == 0].index
        
        n_rare_copies = int(cost_ratio)
        
        # Replicate rare events
        rare_X_replicated = pd.concat([X.loc[rare_indices]] * n_rare_copies, ignore_index=True)
        rare_y_replicated = pd.concat([y.loc[rare_indices]] * n_rare_copies, ignore_index=True)
        
        # Combine with normal events
        X_final = pd.concat([X.loc[normal_indices], rare_X_replicated], ignore_index=True)
        y_final = pd.concat([y.loc[normal_indices], rare_y_replicated], ignore_index=True)
        
        logger.info(f"Cost-sensitive sampling: {len(X_final)} samples, rare event ratio: {y_final.sum()/len(y_final):.4f}")
        return X_final, y_final
    
    def _ensemble_sampling(self, X: pd.DataFrame, y: pd.Series,
                         rare_event_ratio: float) -> Tuple[pd.DataFrame, pd.Series]:
        """Ensemble approach combining multiple sampling strategies."""
        # Apply adaptive sampling
        X_adaptive, y_adaptive = self._adaptive_sampling(X, y, rare_event_ratio)
        
        # Apply cost-sensitive sampling  
        X_cost, y_cost = self._cost_sensitive_sampling(X, y, rare_event_ratio)
        
        # Combine both approaches
        X_ensemble = pd.concat([X_adaptive, X_cost], ignore_index=True)
        y_ensemble = pd.concat([y_adaptive, y_cost], ignore_index=True)
        
        # Remove duplicates while preserving rare events
        combined_data = pd.concat([X_ensemble, y_ensemble], axis=1)
        
        # Keep all rare events, deduplicate normal events
        rare_data = combined_data[combined_data[y.name] == 1]
        normal_data = combined_data[combined_data[y.name] == 0].drop_duplicates()
        
        final_data = pd.concat([rare_data, normal_data], ignore_index=True)
        
        X_final = final_data.drop(columns=[y.name])
        y_final = final_data[y.name]
        
        logger.info(f"Ensemble sampling: {len(X_final)} samples, rare event ratio: {y_final.sum()/len(y_final):.4f}")
        return X_final, y_final