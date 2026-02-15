"""
Analytics models for Igris-engine SDK
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from enum import Enum


class AggregationType(str, Enum):
    """Analytics aggregation types."""
    
    COUNT = "count"
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    MEDIAN = "median"
    STDDEV = "stddev"
    PERCENTILE = "percentile"


class TimeGranularity(str, Enum):
    """Time-based aggregation granularities."""
    
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


@dataclass
class AnalyticsQuery:
    """Analytics query configuration."""
    
    dataset: str
    metrics: List[Dict[str, Any]] = field(default_factory=list)
    dimensions: List[str] = field(default_factory=list)
    filters: List[Dict[str, Any]] = field(default_factory=list)
    time_range: Optional[Dict[str, str]] = None
    time_granularity: Optional[TimeGranularity] = None
    limit: Optional[int] = None
    order_by: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        return {
            "dataset": self.dataset,
            "metrics": self.metrics,
            "dimensions": self.dimensions,
            "filters": self.filters,
            "time_range": self.time_range,
            "time_granularity": self.time_granularity.value if self.time_granularity else None,
            "limit": self.limit,
            "order_by": self.order_by
        }


@dataclass
class AnalyticsResult:
    """Analytics query result."""
    
    query_id: str
    data: List[Dict[str, Any]] = field(default_factory=list)
    total_rows: int = 0
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "query_id": self.query_id,
            "data": self.data,
            "total_rows": self.total_rows,
            "execution_time_ms": self.execution_time_ms,
            "metadata": self.metadata
        }