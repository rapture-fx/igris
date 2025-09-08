"""
Manufacturing Execution System (MES) Integration Service
======================================================

Core service for MES system integration providing:
- Multi-protocol MES connectivity (SAP, Siemens, Rockwell, Generic REST)
- Real-time data synchronization and bidirectional communication
- Work order lifecycle management and tracking
- Production schedule optimization and resource planning
- Quality management and traceability integration
- Performance analytics and OEE calculations
- Alert management and escalation workflows
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
import json
import hashlib
import uuid
from dataclasses import dataclass
from abc import ABC, abstractmethod

from app.database.connection import get_db
from app.models.manufacturing_mes import (
    MESSystemConnection, WorkOrder, ProductionSchedule, QualityRecord,
    ProductionRecord, MaterialMovement, OEEMetrics, ProductionAlert,
    MESSystemType, ConnectionStatus, WorkOrderStatus, QualityStatus
)
from app.schemas.manufacturing_mes import (
    MESConnectionConfig, MESConnectionRequest, WorkOrderCreate, WorkOrderUpdate,
    ProductionScheduleRequest, QualityInspectionRequest, OEECalculationRequest,
    SyncDataRequest, ProductionOptimizationRequest
)

logger = logging.getLogger(__name__)


@dataclass
class MESConnectorConfig:
    """Configuration for MES connector instances."""
    connector_type: str
    endpoint_url: str
    authentication: Dict[str, Any]
    api_version: str
    timeout_seconds: int = 30
    retry_attempts: int = 3
    rate_limit_per_minute: int = 100


class BaseMESConnector(ABC):
    """Base abstract class for MES system connectors."""
    
    def __init__(self, config: MESConnectorConfig):
        self.config = config
        self.is_connected = False
        self.last_error = None
        self.connection_time = None
        self.request_count = 0
        self.error_count = 0
        
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to MES system."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """Disconnect from MES system."""
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """Test MES system connectivity and return system info."""
        pass
    
    @abstractmethod
    async def sync_work_orders(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize work orders from MES system."""
        pass
    
    @abstractmethod
    async def sync_production_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize production data from MES system."""
        pass
    
    @abstractmethod
    async def sync_quality_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize quality data from MES system."""
        pass
    
    @abstractmethod
    async def send_work_order_update(self, work_order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send work order updates to MES system."""
        pass
    
    @abstractmethod
    async def send_production_report(self, production_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send production reports to MES system."""
        pass


class MESIntegrationService:
    """Core MES integration service managing connections and data synchronization."""
    
    def __init__(self, db: Session):
        self.db = db
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        self.connector_registry: Dict[MESSystemType, type] = {}
        self.sync_tasks: Dict[str, asyncio.Task] = {}
        self.performance_metrics: Dict[str, Any] = {}
        
        # Initialize connector registry
        self._register_connectors()
        
        logger.info("MES Integration Service initialized")
    
    def _register_connectors(self):
        """Register available MES connector types."""
        # Import connector classes (these would be implemented in separate modules)
        try:
            from app.services.mes_connectors.sap_connector import SAPMESConnector
            self.connector_registry[MESSystemType.SAP_ME] = SAPMESConnector
            self.connector_registry[MESSystemType.SAP_DMC] = SAPMESConnector
        except ImportError:
            logger.warning("SAP MES connectors not available")
        
        try:
            from app.services.mes_connectors.siemens_connector import SiemensMESConnector
            self.connector_registry[MESSystemType.SIEMENS_MINDSHPERE] = SiemensMESConnector
            self.connector_registry[MESSystemType.SIEMENS_OPCENTER] = SiemensMESConnector
        except ImportError:
            logger.warning("Siemens MES connectors not available")
        
        try:
            from app.services.mes_connectors.rockwell_connector import RockwellMESConnector
            self.connector_registry[MESSystemType.ROCKWELL_FACTORYTALK] = RockwellMESConnector
        except ImportError:
            logger.warning("Rockwell MES connectors not available")
        
        try:
            from app.services.mes_connectors.generic_connector import GenericRESTConnector
            self.connector_registry[MESSystemType.GENERIC_REST] = GenericRESTConnector
        except ImportError:
            logger.warning("Generic REST connector not available")
    
    async def connect_mes_system(self, connection_request: MESConnectionRequest, user_id: int) -> Dict[str, Any]:
        """
        Connect to MES system and establish real-time sync.
        
        Args:
            connection_request: MES connection configuration
            user_id: User ID for connection tracking
            
        Returns:
            Connection response with status and system information
        """
        try:
            connection_id = connection_request.connection_id
            config = connection_request.connection_config
            
            logger.info(f"Connecting to MES system {connection_id} ({config.system_type.value})")
            
            # Check if connection already exists
            if connection_id in self.active_connections:
                return {
                    'success': False,
                    'message': f'Connection {connection_id} already exists',
                    'connection_id': connection_id
                }
            
            # Get or create connection record
            mes_connection = self.db.query(MESSystemConnection).filter(
                MESSystemConnection.connection_id == connection_id
            ).first()
            
            if not mes_connection:
                mes_connection = MESSystemConnection(
                    connection_id=connection_id,
                    user_id=user_id,
                    system_name=config.system_name,
                    system_type=config.system_type,
                    facility_id=config.facility_id,
                    plant_code=config.plant_code,
                    endpoint_url=config.endpoint_url,
                    authentication_method=config.authentication_method,
                    api_version=config.api_version,
                    connection_config=config.connection_config,
                    enabled_modules=config.enabled_modules,
                    custom_field_mappings=config.custom_field_mappings,
                    auto_sync_enabled=config.auto_sync_enabled,
                    sync_interval_minutes=config.sync_interval_minutes
                )
                self.db.add(mes_connection)
                self.db.commit()
                self.db.refresh(mes_connection)
            
            # Create connector instance
            connector_class = self.connector_registry.get(config.system_type)
            if not connector_class:
                raise ValueError(f"No connector available for system type: {config.system_type}")
            
            connector_config = MESConnectorConfig(
                connector_type=config.system_type.value,
                endpoint_url=config.endpoint_url,
                authentication=connection_request.credentials,
                api_version=config.api_version or "1.0"
            )
            
            connector = connector_class(connector_config)
            
            # Test connection if requested
            system_info = None
            if connection_request.validate_connection:
                connection_result = await connector.connect()
                if not connection_result:
                    mes_connection.status = ConnectionStatus.ERROR
                    mes_connection.last_error_message = connector.last_error
                    self.db.commit()
                    
                    return {
                        'success': False,
                        'message': f'Failed to connect to MES system: {connector.last_error}',
                        'connection_id': connection_id
                    }
                
                # Get system information
                system_info = await connector.test_connection()
            
            # Store connection information
            self.active_connections[connection_id] = {
                'connection': mes_connection,
                'connector': connector,
                'config': config,
                'connected_at': datetime.utcnow(),
                'last_sync': None,
                'sync_stats': {
                    'work_orders': 0,
                    'production_records': 0,
                    'quality_records': 0,
                    'errors': 0
                }
            }
            
            # Update connection status
            mes_connection.status = ConnectionStatus.CONNECTED
            mes_connection.last_connected_at = datetime.utcnow()
            if system_info:
                mes_connection.connection_config.update({
                    'system_info': system_info,
                    'available_modules': system_info.get('modules', [])
                })
            self.db.commit()
            
            # Start automatic sync if enabled
            if config.auto_sync_enabled and connection_request.enable_real_time_sync:
                await self._start_sync_task(connection_id)
            
            # Perform initial sync if requested
            if connection_request.initial_sync_scope:
                await self._perform_initial_sync(connection_id, connection_request.initial_sync_scope)
            
            logger.info(f"Successfully connected to MES system {connection_id}")
            
            return {
                'success': True,
                'message': 'MES system connected successfully',
                'connection_id': connection_id,
                'status': ConnectionStatus.CONNECTED,
                'system_info': system_info,
                'available_modules': system_info.get('modules', []) if system_info else [],
                'sync_status': {
                    'auto_sync_enabled': config.auto_sync_enabled,
                    'sync_interval_minutes': config.sync_interval_minutes,
                    'initial_sync_completed': bool(connection_request.initial_sync_scope)
                }
            }
            
        except Exception as e:
            logger.error(f"Error connecting to MES system {connection_id}: {e}")
            
            # Update connection status on error
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]
            
            mes_connection = self.db.query(MESSystemConnection).filter(
                MESSystemConnection.connection_id == connection_id
            ).first()
            if mes_connection:
                mes_connection.status = ConnectionStatus.ERROR
                mes_connection.last_error_message = str(e)
                self.db.commit()
            
            return {
                'success': False,
                'message': f'Failed to connect to MES system: {str(e)}',
                'connection_id': connection_id
            }
    
    async def disconnect_mes_system(self, connection_id: str) -> bool:
        """
        Disconnect from MES system and stop all related tasks.
        
        Args:
            connection_id: MES connection identifier
            
        Returns:
            Success status of disconnection
        """
        try:
            if connection_id not in self.active_connections:
                return False
            
            connection_info = self.active_connections[connection_id]
            connector = connection_info['connector']
            
            # Stop sync task
            if connection_id in self.sync_tasks:
                self.sync_tasks[connection_id].cancel()
                del self.sync_tasks[connection_id]
            
            # Disconnect from MES system
            await connector.disconnect()
            
            # Update connection status
            mes_connection = connection_info['connection']
            mes_connection.status = ConnectionStatus.DISCONNECTED
            self.db.commit()
            
            # Remove from active connections
            del self.active_connections[connection_id]
            
            logger.info(f"Disconnected from MES system {connection_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting from MES system {connection_id}: {e}")
            return False
    
    async def sync_mes_data(self, sync_request: SyncDataRequest) -> Dict[str, Any]:
        """
        Synchronize data with MES system.
        
        Args:
            sync_request: Data synchronization request
            
        Returns:
            Synchronization results and statistics
        """
        try:
            connection_id = sync_request.connection_id
            
            if connection_id not in self.active_connections:
                raise ValueError(f"Connection {connection_id} not found or inactive")
            
            connection_info = self.active_connections[connection_id]
            connector = connection_info['connector']
            
            logger.info(f"Starting data sync for connection {connection_id}, scope: {sync_request.sync_scope}")
            
            sync_results = {
                'sync_id': str(uuid.uuid4()),
                'connection_id': connection_id,
                'sync_scope': sync_request.sync_scope,
                'started_at': datetime.utcnow(),
                'records_processed': {},
                'records_created': {},
                'records_updated': {},
                'records_failed': {},
                'errors': [],
                'warnings': []
            }
            
            # Determine sync date range
            date_from = sync_request.date_from or datetime.utcnow() - timedelta(days=7)
            date_to = sync_request.date_to or datetime.utcnow()
            
            # Sync work orders
            if 'work_orders' in sync_request.sync_scope:
                try:
                    wo_result = await connector.sync_work_orders(date_from, date_to)
                    work_order_stats = await self._process_work_order_sync(
                        connection_id, wo_result, sync_request.validate_data
                    )
                    sync_results['records_processed']['work_orders'] = work_order_stats['processed']
                    sync_results['records_created']['work_orders'] = work_order_stats['created']
                    sync_results['records_updated']['work_orders'] = work_order_stats['updated']
                    sync_results['records_failed']['work_orders'] = work_order_stats['failed']
                    
                except Exception as e:
                    logger.error(f"Work order sync failed: {e}")
                    sync_results['errors'].append({
                        'scope': 'work_orders',
                        'error': str(e)
                    })
            
            # Sync production data
            if 'production' in sync_request.sync_scope:
                try:
                    prod_result = await connector.sync_production_data(date_from, date_to)
                    production_stats = await self._process_production_sync(
                        connection_id, prod_result, sync_request.validate_data
                    )
                    sync_results['records_processed']['production'] = production_stats['processed']
                    sync_results['records_created']['production'] = production_stats['created']
                    sync_results['records_updated']['production'] = production_stats['updated']
                    sync_results['records_failed']['production'] = production_stats['failed']
                    
                except Exception as e:
                    logger.error(f"Production data sync failed: {e}")
                    sync_results['errors'].append({
                        'scope': 'production',
                        'error': str(e)
                    })
            
            # Sync quality data
            if 'quality' in sync_request.sync_scope:
                try:
                    quality_result = await connector.sync_quality_data(date_from, date_to)
                    quality_stats = await self._process_quality_sync(
                        connection_id, quality_result, sync_request.validate_data
                    )
                    sync_results['records_processed']['quality'] = quality_stats['processed']
                    sync_results['records_created']['quality'] = quality_stats['created']
                    sync_results['records_updated']['quality'] = quality_stats['updated']
                    sync_results['records_failed']['quality'] = quality_stats['failed']
                    
                except Exception as e:
                    logger.error(f"Quality data sync failed: {e}")
                    sync_results['errors'].append({
                        'scope': 'quality',
                        'error': str(e)
                    })
            
            # Calculate sync statistics
            sync_results['completed_at'] = datetime.utcnow()
            sync_results['sync_duration_seconds'] = (
                sync_results['completed_at'] - sync_results['started_at']
            ).total_seconds()
            
            total_processed = sum(sync_results['records_processed'].values())
            sync_results['throughput_records_per_second'] = (
                total_processed / max(sync_results['sync_duration_seconds'], 1)
            )
            
            # Update connection sync statistics
            connection_info['last_sync'] = sync_results['completed_at']
            for scope, count in sync_results['records_processed'].items():
                connection_info['sync_stats'][scope] = connection_info['sync_stats'].get(scope, 0) + count
            
            # Update MES connection record
            mes_connection = connection_info['connection']
            mes_connection.last_sync_at = sync_results['completed_at']
            mes_connection.total_work_orders_synced += sync_results['records_processed'].get('work_orders', 0)
            mes_connection.total_production_records += sync_results['records_processed'].get('production', 0)
            
            # Calculate success rate
            total_failed = sum(sync_results['records_failed'].values())
            if total_processed > 0:
                success_rate = ((total_processed - total_failed) / total_processed) * 100
                mes_connection.sync_success_rate = success_rate
            
            self.db.commit()
            
            sync_results['success'] = len(sync_results['errors']) == 0
            sync_results['data_quality_score'] = self._calculate_data_quality_score(sync_results)
            
            logger.info(f"Data sync completed for {connection_id}: {total_processed} records processed")
            
            return sync_results
            
        except Exception as e:
            logger.error(f"Error during data sync: {e}")
            return {
                'success': False,
                'error': str(e),
                'sync_id': str(uuid.uuid4()),
                'connection_id': sync_request.connection_id,
                'completed_at': datetime.utcnow()
            }
    
    async def create_work_order(self, connection_id: str, work_order_data: WorkOrderCreate) -> Dict[str, Any]:
        """
        Create new work order in MES system.
        
        Args:
            connection_id: MES connection identifier
            work_order_data: Work order creation data
            
        Returns:
            Work order creation result
        """
        try:
            if connection_id not in self.active_connections:
                raise ValueError(f"Connection {connection_id} not found")
            
            connection_info = self.active_connections[connection_id]
            connector = connection_info['connector']
            mes_connection = connection_info['connection']
            
            # Create local work order record
            work_order = WorkOrder(
                work_order_id=str(uuid.uuid4()),
                mes_system_id=mes_connection.id,
                work_order_number=work_order_data.work_order_number,
                product_code=work_order_data.product_code,
                product_name=work_order_data.product_name,
                product_version=work_order_data.product_version,
                batch_number=work_order_data.batch_number,
                lot_number=work_order_data.lot_number,
                planned_quantity=work_order_data.planned_quantity,
                unit_of_measure=work_order_data.unit_of_measure,
                planned_start_time=work_order_data.planned_start_time,
                planned_end_time=work_order_data.planned_end_time,
                estimated_duration_hours=work_order_data.estimated_duration_hours,
                priority=work_order_data.priority,
                assigned_line_id=work_order_data.assigned_line_id,
                assigned_equipment_ids=work_order_data.assigned_equipment_ids,
                assigned_operators=work_order_data.assigned_operators,
                quality_requirements=work_order_data.quality_requirements,
                resource_requirements=work_order_data.resource_requirements,
                routing_sequence=work_order_data.routing_sequence,
                standard_cost_per_unit=work_order_data.standard_cost_per_unit,
                efficiency_target_percentage=work_order_data.efficiency_target_percentage,
                customer_order_ref=work_order_data.customer_order_ref,
                sales_order_number=work_order_data.sales_order_number,
                delivery_date=work_order_data.delivery_date,
                special_instructions=work_order_data.special_instructions,
                custom_attributes=work_order_data.custom_attributes
            )
            
            self.db.add(work_order)
            self.db.commit()
            self.db.refresh(work_order)
            
            # Send work order to MES system
            mes_work_order_data = self._convert_work_order_to_mes_format(work_order, mes_connection)
            mes_result = await connector.send_work_order_update(mes_work_order_data)
            
            if mes_result.get('success'):
                work_order.synced_at = datetime.utcnow()
                self.db.commit()
                
                logger.info(f"Work order {work_order.work_order_number} created and synced to MES")
                
                return {
                    'success': True,
                    'work_order_id': work_order.work_order_id,
                    'work_order_number': work_order.work_order_number,
                    'mes_sync_result': mes_result,
                    'created_at': work_order.created_at
                }
            else:
                logger.warning(f"Work order created locally but MES sync failed: {mes_result.get('error')}")
                return {
                    'success': True,
                    'work_order_id': work_order.work_order_id,
                    'work_order_number': work_order.work_order_number,
                    'warning': 'Work order created but not synced to MES',
                    'mes_sync_error': mes_result.get('error'),
                    'created_at': work_order.created_at
                }
            
        except Exception as e:
            logger.error(f"Error creating work order: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def update_work_order(self, work_order_id: str, updates: WorkOrderUpdate) -> Dict[str, Any]:
        """
        Update existing work order and sync to MES.
        
        Args:
            work_order_id: Work order identifier
            updates: Work order update data
            
        Returns:
            Work order update result
        """
        try:
            work_order = self.db.query(WorkOrder).filter(
                WorkOrder.work_order_id == work_order_id
            ).first()
            
            if not work_order:
                raise ValueError(f"Work order {work_order_id} not found")
            
            # Find active connection for this work order
            mes_connection = self.db.query(MESSystemConnection).filter(
                MESSystemConnection.id == work_order.mes_system_id
            ).first()
            
            connection_info = self.active_connections.get(mes_connection.connection_id)
            if not connection_info:
                logger.warning(f"MES connection not active for work order update: {mes_connection.connection_id}")
            
            # Update work order fields
            update_fields = updates.dict(exclude_unset=True)
            for field, value in update_fields.items():
                if hasattr(work_order, field):
                    setattr(work_order, field, value)
            
            work_order.updated_at = datetime.utcnow()
            
            # Update completion percentage if status changed
            if updates.status == WorkOrderStatus.COMPLETED:
                work_order.completion_percentage = 100.0
                work_order.actual_end_time = datetime.utcnow()
            elif updates.status == WorkOrderStatus.STARTED and not work_order.actual_start_time:
                work_order.actual_start_time = datetime.utcnow()
            
            self.db.commit()
            
            # Sync to MES system if connection is active
            mes_sync_result = None
            if connection_info:
                try:
                    connector = connection_info['connector']
                    mes_work_order_data = self._convert_work_order_to_mes_format(work_order, mes_connection)
                    mes_sync_result = await connector.send_work_order_update(mes_work_order_data)
                    
                    if mes_sync_result.get('success'):
                        work_order.synced_at = datetime.utcnow()
                        self.db.commit()
                        
                except Exception as e:
                    logger.error(f"Failed to sync work order update to MES: {e}")
                    mes_sync_result = {'success': False, 'error': str(e)}
            
            logger.info(f"Work order {work_order.work_order_number} updated")
            
            return {
                'success': True,
                'work_order_id': work_order_id,
                'work_order_number': work_order.work_order_number,
                'updated_fields': list(update_fields.keys()),
                'mes_sync_result': mes_sync_result,
                'updated_at': work_order.updated_at
            }
            
        except Exception as e:
            logger.error(f"Error updating work order: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_connection_status(self, connection_id: str) -> Dict[str, Any]:
        """
        Get MES connection status and performance metrics.
        
        Args:
            connection_id: MES connection identifier
            
        Returns:
            Connection status and metrics
        """
        try:
            mes_connection = self.db.query(MESSystemConnection).filter(
                MESSystemConnection.connection_id == connection_id
            ).first()
            
            if not mes_connection:
                return {'success': False, 'error': 'Connection not found'}
            
            connection_info = self.active_connections.get(connection_id)
            is_active = connection_info is not None
            
            # Get recent sync statistics
            recent_sync_stats = {}
            if is_active:
                recent_sync_stats = connection_info['sync_stats']
                
                # Test connection health
                try:
                    connector = connection_info['connector']
                    health_check = await connector.test_connection()
                    mes_connection.health_score = health_check.get('health_score', 0.8)
                    mes_connection.avg_response_time_ms = health_check.get('response_time_ms', 0)
                except Exception as e:
                    mes_connection.health_score = 0.0
                    mes_connection.last_error_message = str(e)
                
                self.db.commit()
            
            # Get work order statistics
            work_order_stats = self.db.query(
                func.count(WorkOrder.id),
                func.count(WorkOrder.id).filter(WorkOrder.status.in_([WorkOrderStatus.STARTED, WorkOrderStatus.RELEASED])),
                func.avg(WorkOrder.completion_percentage)
            ).filter(WorkOrder.mes_system_id == mes_connection.id).first()
            
            total_work_orders, active_work_orders, avg_completion = work_order_stats
            
            return {
                'success': True,
                'connection_id': connection_id,
                'system_name': mes_connection.system_name,
                'system_type': mes_connection.system_type.value,
                'facility_id': mes_connection.facility_id,
                'status': mes_connection.status.value,
                'is_active': is_active,
                'health_score': mes_connection.health_score,
                'uptime_hours': (
                    (datetime.utcnow() - connection_info['connected_at']).total_seconds() / 3600
                ) if is_active else 0,
                'last_sync_at': mes_connection.last_sync_at,
                'sync_success_rate': mes_connection.sync_success_rate,
                'avg_response_time_ms': mes_connection.avg_response_time_ms,
                'work_order_statistics': {
                    'total_work_orders': total_work_orders or 0,
                    'active_work_orders': active_work_orders or 0,
                    'average_completion_percentage': float(avg_completion or 0)
                },
                'sync_statistics': recent_sync_stats,
                'enabled_modules': mes_connection.enabled_modules,
                'auto_sync_enabled': mes_connection.auto_sync_enabled,
                'last_error': mes_connection.last_error_message
            }
            
        except Exception as e:
            logger.error(f"Error getting connection status: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Private helper methods
    
    async def _start_sync_task(self, connection_id: str):
        """Start automatic sync task for connection."""
        connection_info = self.active_connections[connection_id]
        sync_interval = connection_info['config'].sync_interval_minutes
        
        async def sync_loop():
            while connection_id in self.active_connections:
                try:
                    await asyncio.sleep(sync_interval * 60)
                    
                    # Perform automatic sync
                    sync_request = SyncDataRequest(
                        connection_id=connection_id,
                        sync_scope=['work_orders', 'production', 'quality'],
                        full_sync=False,
                        date_from=datetime.utcnow() - timedelta(hours=24)
                    )
                    
                    await self.sync_mes_data(sync_request)
                    logger.debug(f"Automatic sync completed for {connection_id}")
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error in automatic sync for {connection_id}: {e}")
        
        self.sync_tasks[connection_id] = asyncio.create_task(sync_loop())
    
    async def _perform_initial_sync(self, connection_id: str, sync_scope: List[str]):
        """Perform initial data synchronization."""
        sync_request = SyncDataRequest(
            connection_id=connection_id,
            sync_scope=sync_scope,
            full_sync=True,
            date_from=datetime.utcnow() - timedelta(days=30)
        )
        
        await self.sync_mes_data(sync_request)
    
    async def _process_work_order_sync(self, connection_id: str, sync_data: Dict[str, Any], validate: bool) -> Dict[str, int]:
        """Process synchronized work order data."""
        stats = {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0}
        
        work_orders = sync_data.get('work_orders', [])
        mes_connection = self.active_connections[connection_id]['connection']
        
        for wo_data in work_orders:
            try:
                stats['processed'] += 1
                
                # Check if work order exists
                existing_wo = self.db.query(WorkOrder).filter(
                    and_(
                        WorkOrder.work_order_number == wo_data.get('work_order_number'),
                        WorkOrder.mes_system_id == mes_connection.id
                    )
                ).first()
                
                if existing_wo:
                    # Update existing work order
                    self._update_work_order_from_mes_data(existing_wo, wo_data)
                    stats['updated'] += 1
                else:
                    # Create new work order
                    new_wo = self._create_work_order_from_mes_data(wo_data, mes_connection.id)
                    self.db.add(new_wo)
                    stats['created'] += 1
                
            except Exception as e:
                logger.error(f"Error processing work order sync data: {e}")
                stats['failed'] += 1
        
        self.db.commit()
        return stats
    
    async def _process_production_sync(self, connection_id: str, sync_data: Dict[str, Any], validate: bool) -> Dict[str, int]:
        """Process synchronized production data."""
        stats = {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0}
        
        production_records = sync_data.get('production_records', [])
        
        for record_data in production_records:
            try:
                stats['processed'] += 1
                
                # Find associated work order
                work_order = self.db.query(WorkOrder).filter(
                    WorkOrder.work_order_number == record_data.get('work_order_number')
                ).first()
                
                if not work_order:
                    logger.warning(f"Work order not found for production record: {record_data.get('work_order_number')}")
                    stats['failed'] += 1
                    continue
                
                # Create production record
                production_record = ProductionRecord(
                    record_id=record_data.get('record_id', str(uuid.uuid4())),
                    work_order_id=work_order.id,
                    equipment_id=record_data.get('equipment_id'),
                    operator_id=record_data.get('operator_id'),
                    shift_id=record_data.get('shift_id'),
                    quantity_produced=record_data.get('quantity_produced', 0),
                    quantity_rejected=record_data.get('quantity_rejected', 0),
                    start_time=record_data.get('start_time'),
                    end_time=record_data.get('end_time'),
                    efficiency_percentage=record_data.get('efficiency_percentage'),
                    custom_data=record_data.get('custom_data', {})
                )
                
                self.db.add(production_record)
                stats['created'] += 1
                
            except Exception as e:
                logger.error(f"Error processing production sync data: {e}")
                stats['failed'] += 1
        
        self.db.commit()
        return stats
    
    async def _process_quality_sync(self, connection_id: str, sync_data: Dict[str, Any], validate: bool) -> Dict[str, int]:
        """Process synchronized quality data."""
        stats = {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0}
        
        quality_records = sync_data.get('quality_records', [])
        mes_connection = self.active_connections[connection_id]['connection']
        
        for quality_data in quality_records:
            try:
                stats['processed'] += 1
                
                # Find associated work order if specified
                work_order = None
                if quality_data.get('work_order_number'):
                    work_order = self.db.query(WorkOrder).filter(
                        WorkOrder.work_order_number == quality_data.get('work_order_number')
                    ).first()
                
                # Create quality record
                quality_record = QualityRecord(
                    quality_record_id=quality_data.get('quality_record_id', str(uuid.uuid4())),
                    mes_system_id=mes_connection.id,
                    work_order_id=work_order.id if work_order else None,
                    inspection_type=quality_data.get('inspection_type'),
                    inspection_point=quality_data.get('inspection_point'),
                    inspector_id=quality_data.get('inspector_id'),
                    item_identifier=quality_data.get('item_identifier'),
                    product_code=quality_data.get('product_code'),
                    batch_number=quality_data.get('batch_number'),
                    measured_values=quality_data.get('measured_values', {}),
                    specifications=quality_data.get('specifications', {}),
                    overall_status=QualityStatus(quality_data.get('overall_status', 'pending')),
                    passed_tests=quality_data.get('passed_tests', 0),
                    failed_tests=quality_data.get('failed_tests', 0),
                    disposition=quality_data.get('disposition'),
                    inspection_start_time=quality_data.get('inspection_start_time')
                )
                
                self.db.add(quality_record)
                stats['created'] += 1
                
            except Exception as e:
                logger.error(f"Error processing quality sync data: {e}")
                stats['failed'] += 1
        
        self.db.commit()
        return stats
    
    def _convert_work_order_to_mes_format(self, work_order: WorkOrder, mes_connection: MESSystemConnection) -> Dict[str, Any]:
        """Convert work order to MES system format."""
        mes_data = {
            'work_order_number': work_order.work_order_number,
            'product_code': work_order.product_code,
            'product_name': work_order.product_name,
            'planned_quantity': work_order.planned_quantity,
            'produced_quantity': work_order.produced_quantity,
            'unit_of_measure': work_order.unit_of_measure,
            'status': work_order.status.value,
            'priority': work_order.priority.value,
            'planned_start_time': work_order.planned_start_time.isoformat() if work_order.planned_start_time else None,
            'planned_end_time': work_order.planned_end_time.isoformat() if work_order.planned_end_time else None,
            'actual_start_time': work_order.actual_start_time.isoformat() if work_order.actual_start_time else None,
            'actual_end_time': work_order.actual_end_time.isoformat() if work_order.actual_end_time else None,
            'assigned_line_id': work_order.assigned_line_id,
            'assigned_equipment_ids': work_order.assigned_equipment_ids,
            'assigned_operators': work_order.assigned_operators,
            'completion_percentage': work_order.completion_percentage,
            'efficiency_percentage': work_order.actual_efficiency_percentage
        }
        
        # Apply custom field mappings
        if mes_connection.custom_field_mappings:
            mapped_data = {}
            for local_field, mes_field in mes_connection.custom_field_mappings.items():
                if local_field in mes_data:
                    mapped_data[mes_field] = mes_data[local_field]
                else:
                    mapped_data[mes_field] = mes_data.get(local_field)
            mes_data.update(mapped_data)
        
        return mes_data
    
    def _update_work_order_from_mes_data(self, work_order: WorkOrder, mes_data: Dict[str, Any]):
        """Update work order with data from MES system."""
        # Map common fields
        field_mapping = {
            'product_name': 'product_name',
            'planned_quantity': 'planned_quantity',
            'produced_quantity': 'produced_quantity',
            'status': 'status',
            'priority': 'priority',
            'planned_start_time': 'planned_start_time',
            'planned_end_time': 'planned_end_time',
            'actual_start_time': 'actual_start_time',
            'actual_end_time': 'actual_end_time',
            'completion_percentage': 'completion_percentage',
            'efficiency_percentage': 'actual_efficiency_percentage'
        }
        
        for mes_field, wo_field in field_mapping.items():
            if mes_field in mes_data and mes_data[mes_field] is not None:
                value = mes_data[mes_field]
                
                # Handle enum conversions
                if wo_field == 'status' and isinstance(value, str):
                    try:
                        value = WorkOrderStatus(value.lower())
                    except ValueError:
                        continue
                
                setattr(work_order, wo_field, value)
        
        work_order.updated_at = datetime.utcnow()
        work_order.synced_at = datetime.utcnow()
    
    def _create_work_order_from_mes_data(self, mes_data: Dict[str, Any], mes_system_id: int) -> WorkOrder:
        """Create new work order from MES system data."""
        work_order = WorkOrder(
            work_order_id=str(uuid.uuid4()),
            mes_system_id=mes_system_id,
            work_order_number=mes_data.get('work_order_number'),
            product_code=mes_data.get('product_code'),
            product_name=mes_data.get('product_name'),
            planned_quantity=mes_data.get('planned_quantity', 0),
            produced_quantity=mes_data.get('produced_quantity', 0),
            unit_of_measure=mes_data.get('unit_of_measure', 'EA'),
            status=WorkOrderStatus(mes_data.get('status', 'planned')),
            synced_at=datetime.utcnow()
        )
        
        return work_order
    
    def _calculate_data_quality_score(self, sync_results: Dict[str, Any]) -> float:
        """Calculate data quality score based on sync results."""
        total_processed = sum(sync_results['records_processed'].values())
        total_failed = sum(sync_results['records_failed'].values())
        
        if total_processed == 0:
            return 0.0
        
        success_rate = (total_processed - total_failed) / total_processed
        error_penalty = len(sync_results['errors']) * 0.05
        warning_penalty = len(sync_results['warnings']) * 0.02
        
        quality_score = max(0.0, success_rate - error_penalty - warning_penalty)
        return min(1.0, quality_score)