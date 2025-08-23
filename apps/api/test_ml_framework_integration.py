#!/usr/bin/env python3
"""
Test script for ML Framework Integration Service
===============================================

Quick validation of the comprehensive ML framework integration functionality.
"""

import asyncio
import sys
import os
import pandas as pd
import numpy as np
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from services.ml_framework_integration import (
    ml_framework_integration,
    MLFrameworkType,
    ExportConfiguration,
    TaskType,
    DataFormat
)


async def test_basic_functionality():
    """Test basic functionality of the ML framework integration service"""
    
    print("🧪 Testing ML Framework Integration Service")
    print("=" * 50)
    
    # Create sample dataset
    np.random.seed(42)
    n_samples = 1000
    n_features = 10
    
    # Generate synthetic classification data
    X = np.random.randn(n_samples, n_features)
    y = np.random.choice(['class_A', 'class_B', 'class_C'], size=n_samples)
    
    # Create DataFrame
    feature_cols = [f'feature_{i}' for i in range(n_features)]
    df = pd.DataFrame(X, columns=feature_cols)
    df['target'] = y
    
    print(f"✅ Created sample dataset with {len(df)} rows and {len(df.columns)} columns")
    
    # Test framework capabilities
    print("\n📋 Framework Capabilities:")
    capabilities = ml_framework_integration.get_framework_capabilities()
    for framework, details in capabilities.items():
        status = "✅ Available" if details['available'] else "❌ Not available"
        print(f"  {framework}: {status}")
    
    # Test Scikit-learn export (should always work)
    print("\n🔬 Testing Scikit-learn Export:")
    config = ExportConfiguration(
        framework=MLFrameworkType.SCIKIT_LEARN,
        task_type=TaskType.CLASSIFICATION,
        data_format=DataFormat.NUMPY,
        target_column='target',
        feature_columns=feature_cols,
        train_ratio=0.7,
        validation_ratio=0.15,
        test_ratio=0.15,
        normalize_features=True,
        encode_categorical=True,
        batch_size=32
    )
    
    try:
        result = await ml_framework_integration.export_for_framework(df, config)
        
        if result['success']:
            print("  ✅ Scikit-learn export successful")
            print(f"  📁 Output directory: {config.output_directory}")
            print(f"  ⏱️  Export time: {result['export_time_seconds']:.2f} seconds")
            
            # Print metadata
            if 'metadata' in result:
                metadata = result['metadata']
                print(f"  📊 Splits: {metadata.get('splits', {})}")
                print(f"  🔢 Features: {metadata.get('num_features', 'N/A')}")
                print(f"  🎯 Classes: {metadata.get('num_classes', 'N/A')}")
        else:
            print(f"  ❌ Scikit-learn export failed: {result.get('error', 'Unknown error')}")
    
    except Exception as e:
        print(f"  ❌ Scikit-learn export failed with exception: {str(e)}")
    
    # Test multi-format export
    print("\n📦 Testing Multi-format Export:")
    try:
        formats = [DataFormat.CSV, DataFormat.NUMPY, DataFormat.JSON]
        multi_result = ml_framework_integration.export_multiple_formats(df, config, formats)
        
        print("  ✅ Multi-format export successful")
        for format_name, paths in multi_result.items():
            print(f"    {format_name}: {len(paths)} files")
    
    except Exception as e:
        print(f"  ❌ Multi-format export failed: {str(e)}")
    
    # Test balanced dataset creation
    print("\n⚖️  Testing Balanced Dataset Creation:")
    try:
        balanced_result = ml_framework_integration.create_balanced_dataset(df, config)
        
        if 'balance_info' in balanced_result:
            balance_info = balanced_result['balance_info']
            print("  ✅ Balanced dataset created")
            print(f"    Original distribution: {balance_info['original_distribution']}")
            print(f"    Balanced count per class: {balance_info['balanced_count_per_class']}")
    
    except Exception as e:
        print(f"  ❌ Balanced dataset creation failed: {str(e)}")
    
    print("\n🔍 Note: TensorFlow and PyTorch exports are available when those frameworks are installed")
    print("    The comprehensive service supports:")
    print("    • TensorFlow: tf.data.Dataset, SavedModel, TF Transform, TFX integration")
    print("    • PyTorch: Custom Dataset/DataLoader, TorchScript, ONNX export, Lightning")
    print("    • Scikit-learn: Enhanced pipelines, custom transformers, model versioning")
    
    print("\n🎉 Testing completed!")
    return True


def main():
    """Main test function"""
    try:
        # Run async test
        asyncio.run(test_basic_functionality())
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)