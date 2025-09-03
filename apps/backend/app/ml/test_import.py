#!/usr/bin/env python3
"""
Test importing the data quality module directly.
"""

import sys
sys.path.insert(0, '/Users/wira/Desktop/schlep-engine/apps/api/app')

try:
    print("Attempting to import ml.data_quality...")
    import ml.data_quality
    print("✓ ml.data_quality imported successfully")
    
    print("Attempting to access SensorDriftCorrector...")
    corrector = ml.data_quality.SensorDriftCorrector()
    print("✓ SensorDriftCorrector created successfully")
    
except Exception as e:
    print(f"✗ Import failed: {e}")
    import traceback
    traceback.print_exc()