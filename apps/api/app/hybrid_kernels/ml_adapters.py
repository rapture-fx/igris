"""
ML Framework Adapters for Hybrid Rust + Python ML Pipeline
Converts Arrow data to framework-specific formats with zero-copy where possible
"""

import pyarrow as pa
from typing import Any, Optional, Dict, List
import numpy as np

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class MLFrameworkAdapter:
    """Base adapter for ML frameworks"""

    @staticmethod
    def from_arrow(table: pa.Table) -> Any:
        """Convert Arrow table to framework-specific format"""
        raise NotImplementedError

    @staticmethod
    def to_arrow(data: Any) -> pa.Table:
        """Convert framework-specific format to Arrow table"""
        raise NotImplementedError


class ScikitLearnAdapter(MLFrameworkAdapter):
    """Adapter for scikit-learn (NumPy arrays)"""

    @staticmethod
    def from_arrow(table: pa.Table, target_column: Optional[str] = None) -> tuple:
        """
        Convert Arrow table to NumPy arrays for scikit-learn

        Args:
            table: PyArrow Table
            target_column: Optional target column name for y

        Returns:
            (X, y) tuple of NumPy arrays, or just X if no target
        """
        try:
            # Convert numeric columns to NumPy with zero-copy
            numeric_cols = []
            for col_name in table.column_names:
                col = table.column(col_name)
                if pa.types.is_integer(col.type) or pa.types.is_floating(col.type):
                    if target_column and col_name == target_column:
                        continue
                    numeric_cols.append(col_name)

            # Extract features (X)
            if numeric_cols:
                X = table.select(numeric_cols).to_pandas().values
            else:
                # Fallback: convert all to pandas then numpy
                df = table.to_pandas()
                if target_column and target_column in df.columns:
                    X = df.drop(columns=[target_column]).values
                else:
                    X = df.values

            # Extract target (y) if specified
            if target_column:
                y = table.column(target_column).to_numpy()
                return X, y

            return X

        except Exception as e:
            logger.error(f"ScikitLearn adapter error: {e}")
            raise

    @staticmethod
    def to_arrow(X: np.ndarray, y: Optional[np.ndarray] = None, feature_names: Optional[List[str]] = None) -> pa.Table:
        """Convert NumPy arrays back to Arrow table"""
        import pandas as pd

        if feature_names is None:
            feature_names = [f"feature_{i}" for i in range(X.shape[1])]

        df = pd.DataFrame(X, columns=feature_names)

        if y is not None:
            df['target'] = y

        return pa.Table.from_pandas(df)


class TensorFlowAdapter(MLFrameworkAdapter):
    """Adapter for TensorFlow"""

    @staticmethod
    def from_arrow(table: pa.Table, target_column: Optional[str] = None) -> Any:
        """
        Convert Arrow table to TensorFlow Dataset

        Args:
            table: PyArrow Table
            target_column: Optional target column

        Returns:
            tf.data.Dataset or tuple of tensors
        """
        try:
            import tensorflow as tf

            # Convert to pandas first (TensorFlow doesn't support Arrow directly yet)
            df = table.to_pandas()

            if target_column:
                X = df.drop(columns=[target_column])
                y = df[target_column]

                # Create TensorFlow Dataset
                dataset = tf.data.Dataset.from_tensor_slices((
                    {col: X[col].values for col in X.columns},
                    y.values
                ))
                return dataset
            else:
                # Return features only
                dataset = tf.data.Dataset.from_tensor_slices(
                    {col: df[col].values for col in df.columns}
                )
                return dataset

        except ImportError:
            logger.error("TensorFlow not installed")
            raise
        except Exception as e:
            logger.error(f"TensorFlow adapter error: {e}")
            raise

    @staticmethod
    def to_arrow(dataset: Any) -> pa.Table:
        """Convert TensorFlow Dataset to Arrow table"""
        import tensorflow as tf
        import pandas as pd

        # Convert dataset to pandas then Arrow
        data = list(dataset.as_numpy_iterator())
        df = pd.DataFrame(data)
        return pa.Table.from_pandas(df)


class PyTorchAdapter(MLFrameworkAdapter):
    """Adapter for PyTorch"""

    @staticmethod
    def from_arrow(table: pa.Table, target_column: Optional[str] = None) -> Any:
        """
        Convert Arrow table to PyTorch tensors

        Args:
            table: PyArrow Table
            target_column: Optional target column

        Returns:
            Tuple of (X_tensor, y_tensor) or just X_tensor
        """
        try:
            import torch

            # Convert to NumPy first (efficient with Arrow)
            df = table.to_pandas()

            if target_column:
                X = df.drop(columns=[target_column]).values
                y = df[target_column].values

                X_tensor = torch.from_numpy(X).float()
                y_tensor = torch.from_numpy(y).float()

                return X_tensor, y_tensor
            else:
                X = df.values
                X_tensor = torch.from_numpy(X).float()
                return X_tensor

        except ImportError:
            logger.error("PyTorch not installed")
            raise
        except Exception as e:
            logger.error(f"PyTorch adapter error: {e}")
            raise

    @staticmethod
    def to_arrow(tensor: Any, column_names: Optional[List[str]] = None) -> pa.Table:
        """Convert PyTorch tensor to Arrow table"""
        import pandas as pd
        import torch

        # Convert tensor to numpy
        if isinstance(tensor, torch.Tensor):
            array = tensor.cpu().numpy()
        else:
            array = tensor

        if column_names is None:
            column_names = [f"col_{i}" for i in range(array.shape[1])]

        df = pd.DataFrame(array, columns=column_names)
        return pa.Table.from_pandas(df)


class HuggingFaceAdapter(MLFrameworkAdapter):
    """Adapter for HuggingFace Datasets (native Arrow support)"""

    @staticmethod
    def from_arrow(table: pa.Table) -> Any:
        """
        Convert Arrow table to HuggingFace Dataset (zero-copy!)

        Args:
            table: PyArrow Table

        Returns:
            HuggingFace Dataset
        """
        try:
            from datasets import Dataset

            # HuggingFace has native Arrow support - zero-copy conversion!
            dataset = Dataset(table)
            logger.info(f"Created HuggingFace Dataset with {len(dataset)} examples (zero-copy)")
            return dataset

        except ImportError:
            logger.error("HuggingFace datasets not installed")
            raise
        except Exception as e:
            logger.error(f"HuggingFace adapter error: {e}")
            raise

    @staticmethod
    def to_arrow(dataset: Any) -> pa.Table:
        """Convert HuggingFace Dataset to Arrow table (already Arrow!)"""
        try:
            from datasets import Dataset

            if isinstance(dataset, Dataset):
                # HuggingFace Dataset is already backed by Arrow
                return dataset.data.table
            else:
                raise ValueError("Input is not a HuggingFace Dataset")

        except Exception as e:
            logger.error(f"HuggingFace to Arrow error: {e}")
            raise


class UnifiedMLAdapter:
    """
    Unified adapter that automatically detects and converts to/from different ML frameworks
    """

    ADAPTERS = {
        'sklearn': ScikitLearnAdapter,
        'scikit-learn': ScikitLearnAdapter,
        'tensorflow': TensorFlowAdapter,
        'tf': TensorFlowAdapter,
        'pytorch': PyTorchAdapter,
        'torch': PyTorchAdapter,
        'huggingface': HuggingFaceAdapter,
        'hf': HuggingFaceAdapter,
    }

    @classmethod
    def from_arrow(
        cls,
        table: pa.Table,
        framework: str,
        target_column: Optional[str] = None,
        **kwargs
    ) -> Any:
        """
        Convert Arrow table to framework-specific format

        Args:
            table: PyArrow Table
            framework: ML framework name ('sklearn', 'tensorflow', 'pytorch', 'huggingface')
            target_column: Optional target column for supervised learning
            **kwargs: Additional framework-specific arguments

        Returns:
            Framework-specific data structure
        """
        framework_key = framework.lower()

        if framework_key not in cls.ADAPTERS:
            raise ValueError(
                f"Unsupported framework: {framework}. "
                f"Supported: {list(cls.ADAPTERS.keys())}"
            )

        adapter = cls.ADAPTERS[framework_key]

        if framework_key in ['huggingface', 'hf']:
            # HuggingFace doesn't use target_column in from_arrow
            return adapter.from_arrow(table)
        else:
            return adapter.from_arrow(table, target_column=target_column)

    @classmethod
    def to_arrow(
        cls,
        data: Any,
        framework: str,
        **kwargs
    ) -> pa.Table:
        """
        Convert framework-specific format to Arrow table

        Args:
            data: Framework-specific data
            framework: ML framework name
            **kwargs: Additional framework-specific arguments

        Returns:
            PyArrow Table
        """
        framework_key = framework.lower()

        if framework_key not in cls.ADAPTERS:
            raise ValueError(
                f"Unsupported framework: {framework}. "
                f"Supported: {list(cls.ADAPTERS.keys())}"
            )

        adapter = cls.ADAPTERS[framework_key]
        return adapter.to_arrow(data, **kwargs)

    @classmethod
    def list_supported_frameworks(cls) -> List[str]:
        """List all supported ML frameworks"""
        return list(set(cls.ADAPTERS.keys()))


def get_framework_data(
    table: pa.Table,
    framework: str,
    target_column: Optional[str] = None
) -> Any:
    """
    Convenience function to convert Arrow table to ML framework format

    Args:
        table: PyArrow Table from Rust preprocessing
        framework: Target ML framework
        target_column: Optional target column

    Returns:
        Framework-specific data structure
    """
    return UnifiedMLAdapter.from_arrow(table, framework, target_column)
