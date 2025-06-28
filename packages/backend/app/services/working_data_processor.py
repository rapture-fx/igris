"""Deprecated WorkingDataProcessor (compatibility shim)
====================================================

All real data-processing logic now lives in
`app.services.unified_data_processor.UnifiedDataProcessor`.
This module keeps the old public interface (`working_processor` instance and
`prepare_data_for_ai`) so that demos and legacy scripts keep working until
those imports are updated.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Dict, Any

from app.services.unified_data_processor import UnifiedDataProcessor, ProcessingMode

# Single shared instance
_unified = UnifiedDataProcessor()

class WorkingDataProcessor:  # noqa: N801 – keep original class name for imports
    """Thin wrapper around UnifiedDataProcessor (do not add new logic)."""

    def prepare_data(self, file_path: str, target_framework: str = "pandas") -> Dict[str, Any]:
        # Synchronous wrapper around the async processor for backward-compat.
        return asyncio.run(_unified.process(file_path, target_framework, mode=ProcessingMode.STANDARD))

# Public symbols expected elsewhere
working_processor = WorkingDataProcessor()

def prepare_data_for_ai(file_path: str, target_framework: str = "pandas") -> Dict[str, Any]:
    """Backward-compat helper used by demo scripts."""
    return working_processor.prepare_data(Path(file_path), target_framework)
