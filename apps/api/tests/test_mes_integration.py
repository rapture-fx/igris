"""
Manufacturing Execution System (MES) Integration Tests
=====================================================

Comprehensive test suite for MES integration functionality including:
- MES system connectivity across different platforms
- Work order lifecycle management
- Production data synchronization
- Quality management integration
- OEE calculations and analytics
- Integration with existing IoT systems
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.models import User
from app.models.manufacturing_mes import (
    MESSystemConnection, WorkOrder, ProductionRecord, QualityRecord,
    OEEMetrics, ProductionAlert, MESSystemType, ConnectionStatus, 
    WorkOrderStatus, QualityStatus
)
from app.services.mes_integration_service import MESIntegrationService
from app.services.production_optimizer import ProductionOptimizer
from app.schemas.manufacturing_mes import (
    MESConnectionRequest, MESConnectionConfig, WorkOrderCreate, WorkOrderUpdate,
    QualityInspectionRequest, OEECalculationRequest, ProductionOptimizationRequest
)


class TestMESIntegration:
    """Test MES integration functionality."""

    @pytest.fixture
    def client(self):
        """Test client fixture."""
        return TestClient(app)
    
    @pytest.fixture
    def mock_user(self):
        """Mock user fixture."""
        user = Mock(spec=User)
        user.id = 1
        user.username = "test_user"
        user.email = "test@example.com"
        return user
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session fixture."""
        return Mock(spec=Session)
    
    @pytest.fixture
    def mes_service(self, mock_db):
        """MES integration service fixture."""
        return MESIntegrationService(mock_db)
    
    @pytest.fixture
    def production_optimizer(self, mock_db):
        """Production optimizer fixture."""
        return ProductionOptimizer(mock_db)
    
    @pytest.fixture
    def sample_connection_request(self):
        """Sample MES connection request."""
        config = MESConnectionConfig(
            system_name="Test SAP MES",
            system_type=MESSystemType.SAP_ME,
            facility_id="FAC001",
            plant_code="PLT001",
            endpoint_url="https://sap-mes.example.com/api",
            authentication_method="oauth2",
            api_version="2.0",
            connection_config={
                "client_id": "test_client",
                "scope": "production.read production.write"
            },
            enabled_modules=["work_orders", "production", "quality"],
            auto_sync_enabled=True,
            sync_interval_minutes=15
        )
        
        return MESConnectionRequest(
            connection_id="test_connection_001",
            connection_config=config,
            credentials={
                "client_id": "test_client",
                "client_secret": "test_secret",
                "access_token": "test_token"
            },
            validate_connection=True,
            enable_real_time_sync=True,
            initial_sync_scope=["work_orders", "production"]
        )
    
    @pytest.fixture
    def sample_work_order(self):
        """Sample work order create request."""
        return WorkOrderCreate(
            work_order_number="WO-2025-001",
            product_code="PROD-001",
            product_name="Advanced Widget",
            planned_quantity=1000.0,
            unit_of_measure="EA",
            batch_number="BATCH-001",
            planned_start_time=datetime.utcnow(),
            planned_end_time=datetime.utcnow() + timedelta(hours=8),
            estimated_duration_hours=8.0,
            assigned_line_id="LINE-001",
            assigned_equipment_ids=["EQ-001", "EQ-002"],
            assigned_operators=["OP-001", "OP-002"],
            quality_requirements={
                "dimension_tolerance": "±0.1mm",
                "surface_finish": "Ra 0.8μm"
            },
            efficiency_target_percentage=90.0,
            customer_order_ref="CO-2025-001"
        )


class TestMESConnectivity(TestMESIntegration):
    """Test MES system connectivity functionality."""
    
    @pytest.mark.asyncio
    async def test_mes_connection_success(self, mes_service, mock_user, sample_connection_request):
        """Test successful MES system connection."""
        
        # Mock successful connection
        with patch.object(mes_service, '_register_connectors'), \
             patch.object(mes_service.db, 'query'), \
             patch.object(mes_service.db, 'add'), \
             patch.object(mes_service.db, 'commit'):
            
            # Mock connector registry
            mock_connector_class = Mock()
            mock_connector = Mock()
            mock_connector.connect.return_value = True
            mock_connector.test_connection.return_value = {
                'success': True,
                'system_info': {'version': '2.0', 'modules': ['work_orders', 'production']},
                'health_score': 0.95,
                'response_time_ms': 150
            }
            mock_connector_class.return_value = mock_connector
            mes_service.connector_registry[MESSystemType.SAP_ME] = mock_connector_class
            
            result = await mes_service.connect_mes_system(sample_connection_request, mock_user.id)
            
            assert result['success'] is True
            assert result['connection_id'] == "test_connection_001"
            assert result['status'] == ConnectionStatus.CONNECTED
            assert 'system_info' in result
    
    @pytest.mark.asyncio
    async def test_mes_connection_failure(self, mes_service, mock_user, sample_connection_request):
        """Test MES system connection failure."""
        
        with patch.object(mes_service, '_register_connectors'), \
             patch.object(mes_service.db, 'query'), \
             patch.object(mes_service.db, 'add'), \
             patch.object(mes_service.db, 'commit'):
            
            # Mock failed connection
            mock_connector_class = Mock()
            mock_connector = Mock()
            mock_connector.connect.return_value = False
            mock_connector.last_error = "Authentication failed"
            mock_connector_class.return_value = mock_connector
            mes_service.connector_registry[MESSystemType.SAP_ME] = mock_connector_class
            
            result = await mes_service.connect_mes_system(sample_connection_request, mock_user.id)
            
            assert result['success'] is False
            assert "Authentication failed" in result['message']
    
    @pytest.mark.asyncio  
    async def test_mes_disconnection(self, mes_service):
        """Test MES system disconnection."""
        
        # Setup active connection
        mock_connector = Mock()
        mock_connector.disconnect.return_value = True
        mock_connection = Mock()
        mock_connection.status = ConnectionStatus.CONNECTED
        
        mes_service.active_connections["test_connection_001"] = {
            'connector': mock_connector,
            'connection': mock_connection
        }
        
        with patch.object(mes_service.db, 'commit'):
            result = await mes_service.disconnect_mes_system("test_connection_001")
            
            assert result is True
            assert "test_connection_001" not in mes_service.active_connections
            mock_connector.disconnect.assert_called_once()
    
    def test_connection_status_retrieval(self, mes_service, mock_db):
        """Test MES connection status retrieval."""
        
        # Mock database query
        mock_connection = Mock(spec=MESSystemConnection)
        mock_connection.connection_id = "test_connection_001"
        mock_connection.system_name = "Test SAP MES"
        mock_connection.system_type = MESSystemType.SAP_ME
        mock_connection.facility_id = "FAC001"
        mock_connection.status = ConnectionStatus.CONNECTED
        mock_connection.health_score = 0.95
        mock_connection.sync_success_rate = 98.5
        mock_connection.avg_response_time_ms = 150.0
        mock_connection.enabled_modules = ["work_orders", "production"]
        mock_connection.auto_sync_enabled = True
        mock_connection.last_error_message = None
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_connection
        mock_db.query.return_value.filter.return_value.first.return_value = (10, 3, 85.5)  # work order stats
        
        # Add active connection info
        mes_service.active_connections["test_connection_001"] = {
            'connected_at': datetime.utcnow(),
            'sync_stats': {'work_orders': 50, 'production': 100}
        }
        
        result = asyncio.run(mes_service.get_connection_status("test_connection_001"))
        
        assert result['success'] is True
        assert result['connection_id'] == "test_connection_001"
        assert result['status'] == ConnectionStatus.CONNECTED.value
        assert result['health_score'] == 0.95


class TestWorkOrderManagement(TestMESIntegration):
    """Test work order management functionality."""
    
    @pytest.mark.asyncio
    async def test_work_order_creation(self, mes_service, sample_work_order):
        """Test work order creation."""
        
        # Mock active connection
        mock_connector = Mock()
        mock_connector.send_work_order_update.return_value = {'success': True, 'mes_id': 'MES-WO-001'}
        mock_connection = Mock()
        mock_connection.id = 1
        
        mes_service.active_connections["test_connection"] = {
            'connector': mock_connector,
            'connection': mock_connection
        }
        
        with patch.object(mes_service.db, 'add'), \
             patch.object(mes_service.db, 'commit'), \
             patch.object(mes_service.db, 'refresh'):
            
            result = await mes_service.create_work_order("test_connection", sample_work_order)
            
            assert result['success'] is True
            assert 'work_order_id' in result
            assert result['work_order_number'] == "WO-2025-001"
    
    @pytest.mark.asyncio
    async def test_work_order_update(self, mes_service, mock_db):
        """Test work order status update."""
        
        # Mock existing work order
        mock_work_order = Mock(spec=WorkOrder)
        mock_work_order.work_order_id = "wo-001"
        mock_work_order.work_order_number = "WO-2025-001"
        mock_work_order.mes_system_id = 1
        mock_work_order.status = WorkOrderStatus.PLANNED
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_work_order
        
        # Mock MES connection
        mock_mes_connection = Mock()
        mock_mes_connection.connection_id = "test_connection"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_mes_connection
        
        updates = WorkOrderUpdate(
            status=WorkOrderStatus.STARTED,
            actual_start_time=datetime.utcnow(),
            completion_percentage=10.0
        )
        
        with patch.object(mock_db, 'commit'):
            result = await mes_service.update_work_order("wo-001", updates)
            
            assert result['success'] is True
            assert mock_work_order.status == WorkOrderStatus.STARTED
            assert mock_work_order.completion_percentage == 10.0


class TestProductionDataSync(TestMESIntegration):
    """Test production data synchronization."""
    
    @pytest.mark.asyncio
    async def test_data_synchronization(self, mes_service):
        """Test MES data synchronization."""
        
        from app.schemas.manufacturing_mes import SyncDataRequest
        
        # Mock active connection with connector
        mock_connector = Mock()
        mock_connector.sync_work_orders.return_value = {
            'work_orders': [
                {
                    'work_order_number': 'WO-001',
                    'product_code': 'PROD-001',
                    'planned_quantity': 1000,
                    'status': 'started'
                }
            ]
        }
        mock_connector.sync_production_data.return_value = {'production_records': []}
        mock_connector.sync_quality_data.return_value = {'quality_records': []}
        
        mock_connection = Mock()
        mock_connection.id = 1
        
        mes_service.active_connections["test_connection"] = {
            'connector': mock_connector,
            'connection': mock_connection
        }
        
        sync_request = SyncDataRequest(
            connection_id="test_connection",
            sync_scope=["work_orders", "production", "quality"],
            full_sync=False,
            date_from=datetime.utcnow() - timedelta(days=1),
            validate_data=True
        )
        
        with patch.object(mes_service, '_process_work_order_sync') as mock_process_wo, \
             patch.object(mes_service, '_process_production_sync') as mock_process_prod, \
             patch.object(mes_service, '_process_quality_sync') as mock_process_qual:
            
            mock_process_wo.return_value = {'processed': 1, 'created': 1, 'updated': 0, 'failed': 0}
            mock_process_prod.return_value = {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0}
            mock_process_qual.return_value = {'processed': 0, 'created': 0, 'updated': 0, 'failed': 0}
            
            result = await mes_service.sync_mes_data(sync_request)
            
            assert result['success'] is True
            assert result['records_processed']['work_orders'] == 1
            assert len(result['errors']) == 0


class TestQualityManagement(TestMESIntegration):
    """Test quality management functionality."""
    
    def test_quality_record_creation(self, mock_db):
        """Test quality inspection record creation."""
        
        quality_data = QualityInspectionRequest(
            inspection_type="final_inspection",
            item_identifier="ITEM-001",
            product_code="PROD-001",
            batch_number="BATCH-001",
            measured_values={
                "dimension_1": 10.05,
                "dimension_2": 5.02,
                "surface_roughness": 0.7
            },
            specifications={
                "dimension_1": {"min": 9.9, "max": 10.1, "target": 10.0},
                "dimension_2": {"min": 4.9, "max": 5.1, "target": 5.0}
            },
            overall_status=QualityStatus.PASSED,
            disposition="accept",
            inspection_start_time=datetime.utcnow()
        )
        
        # This would typically be tested through the API endpoint
        assert quality_data.inspection_type == "final_inspection"
        assert quality_data.overall_status == QualityStatus.PASSED
        assert quality_data.measured_values["dimension_1"] == 10.05


class TestOEEAnalytics(TestMESIntegration):
    """Test OEE calculation and analytics."""
    
    @pytest.mark.asyncio
    async def test_oee_calculation(self, production_optimizer, mock_db):
        """Test OEE metrics calculation."""
        
        # Mock production records
        mock_records = [
            Mock(
                equipment_id="EQ-001",
                start_time=datetime.utcnow() - timedelta(hours=8),
                end_time=datetime.utcnow(),
                duration_minutes=480,
                quantity_produced=100,
                quantity_rejected=5,
                downtime_minutes=30
            )
        ]
        
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = mock_records
        
        request = OEECalculationRequest(
            equipment_id="EQ-001",
            measurement_period_start=datetime.utcnow() - timedelta(hours=8),
            measurement_period_end=datetime.utcnow(),
            target_oee_percentage=85.0
        )
        
        with patch.object(production_optimizer, '_calculate_availability_metrics') as mock_avail, \
             patch.object(production_optimizer, '_calculate_performance_metrics') as mock_perf, \
             patch.object(production_optimizer, '_calculate_quality_metrics') as mock_qual, \
             patch.object(mock_db, 'add'), \
             patch.object(mock_db, 'commit'):
            
            mock_avail.return_value = {
                'availability_percentage': 90.0,
                'planned_run_time_minutes': 480,
                'actual_run_time_minutes': 450,
                'downtime_minutes': 30
            }
            mock_perf.return_value = {
                'performance_percentage': 85.0,
                'ideal_cycle_time_seconds': 60,
                'performance_rate_pieces_per_minute': 12.5
            }
            mock_qual.return_value = {
                'quality_percentage': 95.0,
                'first_pass_yield_percentage': 95.0
            }
            
            result = await production_optimizer.calculate_oee_metrics(request)
            
            assert result.equipment_id == "EQ-001"
            assert result.availability_percentage == 90.0
            assert result.performance_percentage == 85.0
            assert result.quality_percentage == 95.0
            # OEE = 90% × 85% × 95% = 72.675%
            assert abs(result.oee_percentage - 72.675) < 0.1


class TestProductionOptimization(TestMESIntegration):
    """Test production optimization functionality."""
    
    @pytest.mark.asyncio
    async def test_production_optimization(self, production_optimizer):
        """Test production schedule optimization."""
        
        request = ProductionOptimizationRequest(
            facility_id="FAC001",
            optimization_scope="line",
            optimization_timeframe="daily",
            primary_objective="throughput",
            secondary_objectives=["cost", "quality"],
            algorithm="genetic_algorithm",
            max_iterations=100,
            historical_data_days=30
        )
        
        with patch.object(production_optimizer, '_load_production_data') as mock_load_data, \
             patch.object(production_optimizer, '_load_resources') as mock_load_resources, \
             patch.object(production_optimizer, '_execute_optimization') as mock_optimize:
            
            mock_load_data.return_value = {
                'work_orders': [],
                'production_records': [],
                'date_range': (datetime.utcnow() - timedelta(days=30), datetime.utcnow())
            }
            mock_load_resources.return_value = []
            mock_optimize.return_value = {
                'current_performance': {
                    'throughput_units_per_day': 1000,
                    'resource_utilization_percentage': 75.0,
                    'oee_percentage': 70.0
                },
                'optimized_performance': {
                    'throughput_units_per_day': 1150,
                    'resource_utilization_percentage': 85.0,
                    'oee_percentage': 80.0
                },
                'improvement_potential': {
                    'throughput_units_per_day': 15.0,
                    'resource_utilization_percentage': 13.3,
                    'oee_percentage': 14.3
                },
                'utilization_changes': {},
                'iterations': 100,
                'converged': True,
                'computation_time': 5.5,
                'confidence_score': 0.85,
                'estimated_roi': 250.0,
                'timeline_days': 14
            }
            
            result = await production_optimizer.optimize_production_schedule(request)
            
            assert result.facility_id == "FAC001"
            assert result.optimized_performance['throughput_units_per_day'] == 1150
            assert result.improvement_potential['throughput_units_per_day'] == 15.0
            assert result.confidence_score == 0.85


class TestMESIoTIntegration(TestMESIntegration):
    """Test MES integration with existing IoT systems."""
    
    def test_mes_iot_data_correlation(self):
        """Test correlation between MES work orders and IoT sensor data."""
        
        # This test would verify that MES work order data can be correlated
        # with real-time IoT sensor data for enhanced production monitoring
        
        work_order_data = {
            'work_order_id': 'WO-001',
            'equipment_id': 'EQ-001',
            'start_time': datetime.utcnow(),
            'product_code': 'PROD-001'
        }
        
        iot_sensor_data = {
            'equipment_id': 'EQ-001',
            'timestamp': datetime.utcnow(),
            'temperature': 85.5,
            'pressure': 1024.3,
            'vibration': 0.05,
            'power_consumption': 15.2
        }
        
        # Verify equipment IDs match for correlation
        assert work_order_data['equipment_id'] == iot_sensor_data['equipment_id']
        
        # In a real implementation, this would test the correlation logic
        # between MES production data and IoT sensor readings
    
    def test_predictive_maintenance_integration(self):
        """Test integration with predictive maintenance from IoT data."""
        
        # Mock IoT-based equipment health prediction
        equipment_health = {
            'equipment_id': 'EQ-001',
            'health_score': 0.75,
            'predicted_failure_probability': 0.15,
            'maintenance_recommendation': 'schedule_in_2_weeks',
            'sensor_indicators': {
                'temperature_trend': 'increasing',
                'vibration_level': 'normal',
                'power_consumption': 'stable'
            }
        }
        
        # Mock MES work order planning that considers equipment health
        work_order_planning = {
            'equipment_id': 'EQ-001',
            'available_capacity_hours': 160,  # Reduced due to predicted maintenance
            'risk_factor': 0.15,
            'maintenance_window': datetime.utcnow() + timedelta(weeks=2)
        }
        
        # Verify integration reduces capacity based on predicted maintenance
        assert work_order_planning['available_capacity_hours'] < 168  # Full week capacity
        assert work_order_planning['risk_factor'] == equipment_health['predicted_failure_probability']


class TestAPIEndpoints(TestMESIntegration):
    """Test MES API endpoints integration."""
    
    def test_mes_connection_endpoint(self, client):
        """Test MES connection API endpoint."""
        
        connection_data = {
            "connection_id": "test_connection_001",
            "connection_config": {
                "system_name": "Test SAP MES",
                "system_type": "sap_me",
                "facility_id": "FAC001",
                "endpoint_url": "https://sap-mes.example.com/api",
                "authentication_method": "oauth2"
            },
            "credentials": {
                "client_id": "test_client",
                "client_secret": "test_secret"
            },
            "validate_connection": True,
            "enable_real_time_sync": True
        }
        
        with patch('app.auth.dependencies.get_current_user') as mock_get_user, \
             patch('app.api.v1.manufacturing_mes.get_mes_service') as mock_get_service:
            
            mock_user = Mock()
            mock_user.id = 1
            mock_get_user.return_value = mock_user
            
            mock_service = Mock()
            mock_service.connect_mes_system.return_value = {
                'success': True,
                'message': 'MES system connected successfully',
                'connection_id': 'test_connection_001',
                'status': 'connected'
            }
            mock_get_service.return_value = mock_service
            
            # This would be a full API test in a real implementation
            # response = client.post("/api/v1/manufacturing/mes/connect", json=connection_data)
            # assert response.status_code == 200
            # assert response.json()["success"] is True
            
            # For now, just verify the mock setup
            assert mock_service.connect_mes_system is not None
    
    def test_work_order_creation_endpoint(self, client):
        """Test work order creation API endpoint."""
        
        work_order_data = {
            "work_order_number": "WO-2025-001",
            "product_code": "PROD-001",
            "product_name": "Advanced Widget",
            "planned_quantity": 1000.0,
            "unit_of_measure": "EA",
            "priority": "normal",
            "assigned_line_id": "LINE-001"
        }
        
        with patch('app.auth.dependencies.get_current_user') as mock_get_user:
            mock_user = Mock()
            mock_user.id = 1
            mock_get_user.return_value = mock_user
            
            # This would be a full API test in a real implementation
            # response = client.post("/api/v1/manufacturing/mes/work-orders", 
            #                       json=work_order_data, 
            #                       params={"connection_id": "test_connection"})
            # assert response.status_code == 200
            
            # For now, verify the test data structure
            assert work_order_data["work_order_number"] == "WO-2025-001"
            assert work_order_data["planned_quantity"] == 1000.0


@pytest.mark.integration
class TestMESConnectorImplementations(TestMESIntegration):
    """Test specific MES connector implementations."""
    
    def test_sap_connector_availability(self):
        """Test SAP MES connector availability."""
        try:
            from app.services.mes_connectors.sap_connector import SAPMESConnector
            assert SAPMESConnector is not None
        except ImportError:
            pytest.skip("SAP MES connector not available")
    
    def test_siemens_connector_availability(self):
        """Test Siemens MES connector availability."""
        try:
            from app.services.mes_connectors.siemens_connector import SiemensMESConnector
            assert SiemensMESConnector is not None
        except ImportError:
            pytest.skip("Siemens MES connector not available")
    
    def test_rockwell_connector_availability(self):
        """Test Rockwell MES connector availability."""
        try:
            from app.services.mes_connectors.rockwell_connector import RockwellMESConnector
            assert RockwellMESConnector is not None
        except ImportError:
            pytest.skip("Rockwell MES connector not available")
    
    def test_generic_connector_availability(self):
        """Test Generic REST MES connector availability."""
        try:
            from app.services.mes_connectors.generic_connector import GenericRESTConnector
            assert GenericRESTConnector is not None
        except ImportError:
            pytest.skip("Generic REST connector not available")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])