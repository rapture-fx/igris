#!/usr/bin/env python3
"""
Target script for line-by-line profiling of data processing functions
"""

import pandas as pd
import numpy as np
import time
import sys
from pathlib import Path

@profile
def profile_csv_reading(file_path: str):
    """Profile CSV reading performance"""
    # Different reading methods
    df1 = pd.read_csv(file_path)
    return len(df1)

@profile
def profile_data_cleaning(file_path: str):
    """Profile data cleaning operations line by line"""
    df = pd.read_csv(file_path)

    # Get numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    # Fill missing values - line by line analysis
    for col in numeric_cols:
        median_val = df[col].median()
        df[col] = df[col].fillna(median_val)

    # Remove duplicates
    initial_rows = len(df)
    df = df.drop_duplicates()
    final_rows = len(df)

    # Outlier detection
    for col in numeric_cols:
        mean_val = df[col].mean()
        std_val = df[col].std()
        z_scores = np.abs((df[col] - mean_val) / std_val)
        outlier_mask = z_scores < 3
        df = df[outlier_mask]

    return {
        'initial_rows': initial_rows,
        'after_dedup': final_rows,
        'final_rows': len(df)
    }

@profile
def profile_aggregations(file_path: str):
    """Profile aggregation operations line by line"""
    df = pd.read_csv(file_path)

    # Get column types
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object']).columns

    results = {}

    # Global aggregations
    if len(numeric_cols) > 0:
        means = df[numeric_cols].mean()
        stds = df[numeric_cols].std()
        medians = df[numeric_cols].median()
        mins = df[numeric_cols].min()
        maxs = df[numeric_cols].max()

        results['global_stats'] = {
            'means': means.to_dict(),
            'stds': stds.to_dict()
        }

    # Group by aggregations if categorical columns exist
    if len(categorical_cols) > 0 and len(numeric_cols) > 0:
        group_col = categorical_cols[0]

        # Multiple aggregation functions
        agg_dict = {}
        for col in numeric_cols[:3]:  # Limit to first 3 numeric columns
            agg_dict[col] = ['mean', 'std', 'count']

        grouped = df.groupby(group_col)
        aggregated = grouped.agg(agg_dict)

        results['grouped_stats'] = len(aggregated)

    return results

@profile
def profile_transformations(file_path: str):
    """Profile transformation operations line by line"""
    df = pd.read_csv(file_path)

    # Get numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    # Apply transformations
    for col in numeric_cols[:3]:  # Limit to avoid excessive computation
        # Log transformation
        df[f'{col}_log'] = np.log1p(df[col].abs())

        # Squared transformation
        df[f'{col}_squared'] = df[col] ** 2

        # Normalization (z-score)
        col_mean = df[col].mean()
        col_std = df[col].std()
        df[f'{col}_normalized'] = (df[col] - col_mean) / col_std

        # Min-max scaling
        col_min = df[col].min()
        col_max = df[col].max()
        df[f'{col}_minmax'] = (df[col] - col_min) / (col_max - col_min)

    return len(df)

@profile
def profile_joins_merges(file_path: str):
    """Profile join/merge operations line by line"""
    df = pd.read_csv(file_path)

    # Only perform joins on smaller datasets to avoid memory issues
    if len(df) > 10000:
        return {'skipped': 'Dataset too large for join profiling'}

    # Create a sample for joining
    sample_size = min(1000, len(df) // 2)
    df_sample = df.sample(sample_size, random_state=42)

    # Inner join
    inner_joined = df.merge(df_sample, left_index=True, right_index=True, suffixes=('', '_right'))

    # Left join
    left_joined = df.merge(df_sample, left_index=True, right_index=True, how='left', suffixes=('', '_left'))

    return {
        'original_rows': len(df),
        'sample_rows': len(df_sample),
        'inner_join_rows': len(inner_joined),
        'left_join_rows': len(left_joined)
    }

@profile
def profile_string_operations(file_path: str):
    """Profile string operations line by line"""
    df = pd.read_csv(file_path)

    # Get string columns
    string_cols = df.select_dtypes(include=['object']).columns

    for col in string_cols[:2]:  # Limit to first 2 string columns
        # String length
        df[f'{col}_length'] = df[col].astype(str).str.len()

        # Uppercase
        df[f'{col}_upper'] = df[col].astype(str).str.upper()

        # Extract patterns (if applicable)
        if 'email' in col.lower():
            df[f'{col}_domain'] = df[col].astype(str).str.extract(r'@([^.]+\.)')

        # String contains
        df[f'{col}_has_underscore'] = df[col].astype(str).str.contains('_')

    return len(df)

def run_profiling_suite(dataset_path: str):
    """Run the complete profiling suite on a dataset"""
    results = {}

    print(f"Starting line profiling for: {dataset_path}")

    # Profile each function
    functions_to_profile = [
        ('csv_reading', profile_csv_reading),
        ('data_cleaning', profile_data_cleaning),
        ('aggregations', profile_aggregations),
        ('transformations', profile_transformations),
        ('joins_merges', profile_joins_merges),
        ('string_operations', profile_string_operations)
    ]

    for func_name, func in functions_to_profile:
        print(f"Profiling {func_name}...")
        try:
            start_time = time.time()
            result = func(dataset_path)
            end_time = time.time()

            results[func_name] = {
                'execution_time': end_time - start_time,
                'result': result
            }
            print(f"  ✅ {func_name}: {end_time - start_time:.3f}s")
        except Exception as e:
            print(f"  ❌ {func_name} failed: {e}")
            results[func_name] = {'error': str(e)}

    return results

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        dataset_path = sys.argv[1]
        results = run_profiling_suite(dataset_path)
        print("Profiling completed!")
    else:
        print("Usage: python script.py <dataset_path>")
