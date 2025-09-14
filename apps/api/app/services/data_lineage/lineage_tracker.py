"""
Data Lineage Tracking System
Comprehensive tracking of data transformations, processing steps, and dependencies
"""

import uuid
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import logging

from app.core.config import settings
from app.core.error_tracking import capture_exception, ErrorSeverity, ErrorCategory
from app.database.connection import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

logger = logging.getLogger(__name__)

class LineageEventType(str, Enum):
    """Types of lineage events"""
    DATA_INGESTION = "data_ingestion"
    DATA_TRANSFORMATION = "data_transformation"
    DATA_CLEANING = "data_cleaning"
    FEATURE_ENGINEERING = "feature_engineering"
    MODEL_TRAINING = "model_training"
    MODEL_INFERENCE = "model_inference"
    DATA_EXPORT = "data_export"
    DATA_VALIDATION = "data_validation"
    SCHEMA_EVOLUTION = "schema_evolution"

class DataSourceType(str, Enum):
    """Types of data sources"""
    FILE_UPLOAD = "file_upload"
    DATABASE_QUERY = "database_query"
    API_CALL = "api_call"
    STREAM_INGESTION = "stream_ingestion"
    MODEL_OUTPUT = "model_output"
    EXTERNAL_SERVICE = "external_service"

@dataclass
class LineageNode:
    """Represents a data entity in the lineage graph"""
    node_id: str
    name: str
    type: str  # dataset, model, transformation, etc.
    version: str
    metadata: Dict[str, Any]
    created_at: datetime
    hash: Optional[str] = None
    schema: Optional[Dict[str, Any]] = None
    size_bytes: Optional[int] = None
    row_count: Optional[int] = None

@dataclass
class LineageEdge:
    """Represents a relationship between data entities"""
    edge_id: str
    source_node_id: str
    target_node_id: str
    event_type: LineageEventType
    transformation_details: Dict[str, Any]
    created_at: datetime
    processing_time: Optional[float] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None

class DataLineageTracker:
    """
    Comprehensive data lineage tracking system

    Features:
    - Real-time lineage capture
    - Graph-based lineage visualization
    - Impact analysis and dependency tracking
    - Data quality integration
    - Compliance and audit support
    - Performance optimization
    """

    def __init__(self):
        self.session_cache = {}
        self.batch_operations = []
        self.batch_size = 50
        self.auto_flush_interval = 300  # 5 minutes

    def _generate_data_hash(self, data: Any) -> str:
        """Generate hash for data content verification"""
        try:
            if hasattr(data, 'to_dict'):
                content = str(data.to_dict())
            elif hasattr(data, 'to_json'):
                content = data.to_json()
            elif isinstance(data, dict):
                content = json.dumps(data, sort_keys=True)
            else:
                content = str(data)

            return hashlib.sha256(content.encode()).hexdigest()[:16]
        except Exception as e:
            logger.warning(f"Could not generate data hash: {e}")
            return str(uuid.uuid4())[:16]

    async def track_data_ingestion(
        self,
        source_name: str,
        source_type: DataSourceType,
        data_metadata: Dict[str, Any],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> str:
        """
        Track data ingestion event

        Args:
            source_name: Name of the data source
            source_type: Type of data source
            data_metadata: Metadata about the ingested data
            user_id: User who performed the ingestion
            session_id: Session identifier

        Returns:
            Node ID of the created data source node
        """

        node_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)

        try:
            # Create lineage node
            node = LineageNode(
                node_id=node_id,
                name=source_name,
                type="dataset",
                version="1.0",
                metadata={
                    **data_metadata,
                    "source_type": source_type.value,
                    "ingestion_timestamp": timestamp.isoformat(),
                    "user_id": user_id,
                    "session_id": session_id
                },
                created_at=timestamp,
                hash=self._generate_data_hash(data_metadata),
                size_bytes=data_metadata.get("file_size"),
                row_count=data_metadata.get("row_count")
            )

            # Store the node
            await self._store_lineage_node(node)

            # Create ingestion event
            await self._create_lineage_event(
                event_type=LineageEventType.DATA_INGESTION,
                source_node_id=None,  # No source for ingestion
                target_node_id=node_id,
                transformation_details={
                    "source_type": source_type.value,
                    "source_name": source_name,
                    "ingestion_method": data_metadata.get("ingestion_method", "upload"),
                    "data_format": data_metadata.get("format"),
                    "compression": data_metadata.get("compression")
                },
                user_id=user_id,
                session_id=session_id
            )

            logger.info(f"Tracked data ingestion: {source_name} -> {node_id}")
            return node_id

        except Exception as e:
            logger.error(f"Failed to track data ingestion: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.DATA_TRACKING,
                extra_data={
                    "source_name": source_name,
                    "source_type": source_type.value
                }
            )
            raise

    async def track_data_transformation(
        self,
        source_node_ids: List[str],
        target_name: str,
        transformation_type: LineageEventType,
        transformation_details: Dict[str, Any],
        output_metadata: Dict[str, Any],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        processing_time: Optional[float] = None
    ) -> str:
        """
        Track data transformation event

        Args:
            source_node_ids: List of source data node IDs
            target_name: Name of the transformed output
            transformation_type: Type of transformation
            transformation_details: Details of the transformation process
            output_metadata: Metadata about the output
            user_id: User who performed the transformation
            session_id: Session identifier
            processing_time: Time taken for processing

        Returns:
            Node ID of the created output node
        """

        output_node_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)

        try:
            # Create output node
            output_node = LineageNode(
                node_id=output_node_id,
                name=target_name,
                type="dataset",
                version=self._generate_version_from_sources(source_node_ids),
                metadata={
                    **output_metadata,
                    "transformation_type": transformation_type.value,
                    "created_timestamp": timestamp.isoformat(),
                    "source_count": len(source_node_ids),
                    "user_id": user_id,
                    "session_id": session_id,
                    "processing_time": processing_time
                },
                created_at=timestamp,
                hash=self._generate_data_hash(output_metadata),
                size_bytes=output_metadata.get("file_size"),
                row_count=output_metadata.get("row_count")
            )

            # Store the output node
            await self._store_lineage_node(output_node)

            # Create transformation edges for each source
            for source_node_id in source_node_ids:
                await self._create_lineage_event(
                    event_type=transformation_type,
                    source_node_id=source_node_id,
                    target_node_id=output_node_id,
                    transformation_details=transformation_details,
                    user_id=user_id,
                    session_id=session_id,
                    processing_time=processing_time
                )

            logger.info(f"Tracked transformation: {source_node_ids} -> {output_node_id}")
            return output_node_id

        except Exception as e:
            logger.error(f"Failed to track data transformation: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.DATA_TRACKING,
                extra_data={
                    "source_node_ids": source_node_ids,
                    "transformation_type": transformation_type.value
                }
            )
            raise

    async def track_ml_model_training(
        self,
        training_data_node_ids: List[str],
        model_name: str,
        model_metadata: Dict[str, Any],
        training_config: Dict[str, Any],
        performance_metrics: Dict[str, Any],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        training_time: Optional[float] = None
    ) -> str:
        """
        Track ML model training event

        Args:
            training_data_node_ids: List of training data node IDs
            model_name: Name of the trained model
            model_metadata: Model metadata
            training_config: Training configuration
            performance_metrics: Model performance metrics
            user_id: User who trained the model
            session_id: Session identifier
            training_time: Time taken for training

        Returns:
            Node ID of the created model node
        """

        model_node_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)

        try:
            # Create model node
            model_node = LineageNode(
                node_id=model_node_id,
                name=model_name,
                type="model",
                version=f"v1.0_{timestamp.strftime('%Y%m%d_%H%M%S')}",
                metadata={
                    **model_metadata,
                    "model_type": "ml_model",
                    "training_config": training_config,
                    "performance_metrics": performance_metrics,
                    "training_data_count": len(training_data_node_ids),
                    "trained_at": timestamp.isoformat(),
                    "user_id": user_id,
                    "session_id": session_id,
                    "training_time": training_time
                },
                created_at=timestamp,
                hash=self._generate_data_hash({**training_config, **performance_metrics})
            )

            # Store the model node
            await self._store_lineage_node(model_node)

            # Create training edges for each training data source
            for data_node_id in training_data_node_ids:
                await self._create_lineage_event(
                    event_type=LineageEventType.MODEL_TRAINING,
                    source_node_id=data_node_id,
                    target_node_id=model_node_id,
                    transformation_details={
                        "training_config": training_config,
                        "performance_metrics": performance_metrics,
                        "algorithm": training_config.get("algorithm"),
                        "hyperparameters": training_config.get("hyperparameters", {}),
                        "validation_method": training_config.get("validation_method")
                    },
                    user_id=user_id,
                    session_id=session_id,
                    processing_time=training_time
                )

            logger.info(f"Tracked ML model training: {training_data_node_ids} -> {model_node_id}")
            return model_node_id

        except Exception as e:
            logger.error(f"Failed to track ML model training: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.DATA_TRACKING,
                extra_data={
                    "training_data_node_ids": training_data_node_ids,
                    "model_name": model_name
                }
            )
            raise

    async def get_lineage_graph(
        self,
        node_id: str,
        depth: int = 3,
        direction: str = "both"  # "upstream", "downstream", "both"
    ) -> Dict[str, Any]:
        """
        Get lineage graph for a specific node

        Args:
            node_id: Starting node ID
            depth: Maximum depth to traverse
            direction: Direction to traverse the graph

        Returns:
            Lineage graph with nodes and edges
        """

        try:
            async with get_async_session() as db:
                # Get the starting node
                root_node = await self._get_node_by_id(db, node_id)
                if not root_node:
                    return {"error": "Node not found"}

                visited_nodes = set()
                nodes = {}
                edges = []

                # Traverse the graph
                await self._traverse_lineage_graph(
                    db, node_id, depth, direction, visited_nodes, nodes, edges
                )

                return {
                    "root_node_id": node_id,
                    "nodes": list(nodes.values()),
                    "edges": edges,
                    "total_nodes": len(nodes),
                    "total_edges": len(edges),
                    "depth_traversed": min(depth, len(nodes))
                }

        except Exception as e:
            logger.error(f"Failed to get lineage graph: {e}")
            return {"error": str(e)}

    async def analyze_impact(
        self,
        node_id: str,
        change_type: str = "data_change"
    ) -> Dict[str, Any]:
        """
        Analyze impact of changes to a data node

        Args:
            node_id: Node ID to analyze
            change_type: Type of change

        Returns:
            Impact analysis results
        """

        try:
            # Get downstream dependencies
            downstream_graph = await self.get_lineage_graph(
                node_id, depth=5, direction="downstream"
            )

            if "error" in downstream_graph:
                return downstream_graph

            # Categorize affected components
            affected_datasets = []
            affected_models = []
            affected_transformations = []

            for node in downstream_graph["nodes"]:
                if node["type"] == "dataset":
                    affected_datasets.append(node)
                elif node["type"] == "model":
                    affected_models.append(node)
                elif node["type"] == "transformation":
                    affected_transformations.append(node)

            # Calculate impact severity
            impact_severity = self._calculate_impact_severity(
                len(affected_datasets),
                len(affected_models),
                len(affected_transformations)
            )

            return {
                "source_node_id": node_id,
                "change_type": change_type,
                "impact_severity": impact_severity,
                "affected_components": {
                    "datasets": len(affected_datasets),
                    "models": len(affected_models),
                    "transformations": len(affected_transformations),
                    "total": downstream_graph["total_nodes"] - 1  # Exclude source node
                },
                "affected_datasets": affected_datasets[:10],  # Top 10
                "affected_models": affected_models[:10],
                "recommended_actions": self._generate_impact_recommendations(
                    change_type, impact_severity, affected_datasets, affected_models
                ),
                "analysis_timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to analyze impact: {e}")
            return {"error": str(e)}

    def _generate_version_from_sources(self, source_node_ids: List[str]) -> str:
        """Generate version string from source nodes"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        source_hash = hashlib.md5("_".join(sorted(source_node_ids)).encode()).hexdigest()[:8]
        return f"v1.0_{timestamp}_{source_hash}"

    def _calculate_impact_severity(
        self,
        datasets: int,
        models: int,
        transformations: int
    ) -> str:
        """Calculate impact severity based on affected components"""

        total_affected = datasets + models + transformations

        if models > 5 or total_affected > 20:
            return "critical"
        elif models > 2 or total_affected > 10:
            return "high"
        elif models > 0 or total_affected > 5:
            return "medium"
        else:
            return "low"

    def _generate_impact_recommendations(
        self,
        change_type: str,
        impact_severity: str,
        affected_datasets: List[Dict],
        affected_models: List[Dict]
    ) -> List[str]:
        """Generate recommendations based on impact analysis"""

        recommendations = []

        if impact_severity == "critical":
            recommendations.append("Coordinate with all stakeholders before making changes")
            recommendations.append("Consider implementing the change during a maintenance window")
            recommendations.append("Prepare rollback procedures")

        if affected_models:
            recommendations.append(f"Retrain {len(affected_models)} affected ML models")
            recommendations.append("Validate model performance after data changes")

        if len(affected_datasets) > 5:
            recommendations.append("Update dependent data pipelines")
            recommendations.append("Verify data quality in downstream datasets")

        if change_type == "schema_change":
            recommendations.append("Update data contracts and API schemas")
            recommendations.append("Test downstream applications for compatibility")

        return recommendations

    async def _store_lineage_node(self, node: LineageNode):
        """Store lineage node in database"""

        try:
            async with get_async_session() as db:
                from app.database.models import DataLineageNode

                db_node = DataLineageNode(
                    node_id=node.node_id,
                    name=node.name,
                    type=node.type,
                    version=node.version,
                    metadata=node.metadata,
                    created_at=node.created_at,
                    hash=node.hash,
                    schema=node.schema,
                    size_bytes=node.size_bytes,
                    row_count=node.row_count
                )

                db.add(db_node)
                await db.commit()

        except Exception as e:
            logger.error(f"Failed to store lineage node: {e}")
            raise

    async def _create_lineage_event(
        self,
        event_type: LineageEventType,
        source_node_id: Optional[str],
        target_node_id: str,
        transformation_details: Dict[str, Any],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        processing_time: Optional[float] = None
    ):
        """Create lineage event/edge"""

        try:
            async with get_async_session() as db:
                from app.database.models import DataLineageEdge

                edge = DataLineageEdge(
                    edge_id=str(uuid.uuid4()),
                    source_node_id=source_node_id,
                    target_node_id=target_node_id,
                    event_type=event_type.value,
                    transformation_details=transformation_details,
                    created_at=datetime.now(timezone.utc),
                    processing_time=processing_time,
                    user_id=user_id,
                    session_id=session_id
                )

                db.add(edge)
                await db.commit()

        except Exception as e:
            logger.error(f"Failed to create lineage event: {e}")
            raise

    async def _get_node_by_id(self, db: AsyncSession, node_id: str):
        """Get node by ID from database"""

        from app.database.models import DataLineageNode

        result = await db.execute(
            select(DataLineageNode).where(DataLineageNode.node_id == node_id)
        )
        return result.scalar_one_or_none()

    async def _traverse_lineage_graph(
        self,
        db: AsyncSession,
        current_node_id: str,
        remaining_depth: int,
        direction: str,
        visited_nodes: Set[str],
        nodes: Dict[str, Dict],
        edges: List[Dict]
    ):
        """Recursively traverse lineage graph"""

        if remaining_depth <= 0 or current_node_id in visited_nodes:
            return

        visited_nodes.add(current_node_id)

        # Get current node
        from app.database.models import DataLineageNode, DataLineageEdge

        result = await db.execute(
            select(DataLineageNode).where(DataLineageNode.node_id == current_node_id)
        )
        current_node = result.scalar_one_or_none()

        if current_node:
            nodes[current_node_id] = {
                "node_id": current_node.node_id,
                "name": current_node.name,
                "type": current_node.type,
                "version": current_node.version,
                "metadata": current_node.metadata,
                "created_at": current_node.created_at.isoformat(),
                "hash": current_node.hash,
                "size_bytes": current_node.size_bytes,
                "row_count": current_node.row_count
            }

        # Get connected edges based on direction
        if direction in ["upstream", "both"]:
            # Get edges where current node is the target
            result = await db.execute(
                select(DataLineageEdge).where(DataLineageEdge.target_node_id == current_node_id)
            )
            upstream_edges = result.scalars().all()

            for edge in upstream_edges:
                edges.append({
                    "edge_id": edge.edge_id,
                    "source_node_id": edge.source_node_id,
                    "target_node_id": edge.target_node_id,
                    "event_type": edge.event_type,
                    "transformation_details": edge.transformation_details,
                    "created_at": edge.created_at.isoformat(),
                    "processing_time": edge.processing_time
                })

                if edge.source_node_id:
                    await self._traverse_lineage_graph(
                        db, edge.source_node_id, remaining_depth - 1,
                        direction, visited_nodes, nodes, edges
                    )

        if direction in ["downstream", "both"]:
            # Get edges where current node is the source
            result = await db.execute(
                select(DataLineageEdge).where(DataLineageEdge.source_node_id == current_node_id)
            )
            downstream_edges = result.scalars().all()

            for edge in downstream_edges:
                if {
                    "edge_id": edge.edge_id,
                    "source_node_id": edge.source_node_id,
                    "target_node_id": edge.target_node_id,
                    "event_type": edge.event_type,
                    "transformation_details": edge.transformation_details,
                    "created_at": edge.created_at.isoformat(),
                    "processing_time": edge.processing_time
                } not in edges:
                    edges.append({
                        "edge_id": edge.edge_id,
                        "source_node_id": edge.source_node_id,
                        "target_node_id": edge.target_node_id,
                        "event_type": edge.event_type,
                        "transformation_details": edge.transformation_details,
                        "created_at": edge.created_at.isoformat(),
                        "processing_time": edge.processing_time
                    })

                await self._traverse_lineage_graph(
                    db, edge.target_node_id, remaining_depth - 1,
                    direction, visited_nodes, nodes, edges
                )

# Global instance
lineage_tracker = DataLineageTracker()