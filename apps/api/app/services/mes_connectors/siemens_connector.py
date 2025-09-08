"""
Siemens MES System Connector
===========================

Connector for Siemens Manufacturing Execution systems including:
- Siemens MindSphere IoT operating system
- Siemens Opcenter Execution (formerly SIMATIC IT)
- Real-time data synchronization via Siemens APIs
- Bearer token and API key authentication
"""

import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json
import uuid
from urllib.parse import urljoin

from app.services.mes_integration_service import BaseMESConnector, MESConnectorConfig

logger = logging.getLogger(__name__)


class SiemensMESConnector(BaseMESConnector):
    """Siemens MES system connector with support for MindSphere and Opcenter."""
    
    def __init__(self, config: MESConnectorConfig):
        super().__init__(config)
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.api_base_url = config.endpoint_url.rstrip('/')
        
        # Authentication configuration
        self.client_id = config.authentication.get('client_id')
        self.client_secret = config.authentication.get('client_secret')
        self.api_key = config.authentication.get('api_key')
        self.tenant = config.authentication.get('tenant')
        
        # Siemens-specific configuration
        self.siemens_system_type = config.authentication.get('system_type', 'MINDSHPERE')  # MINDSHPERE or OPCENTER
        self.plant_id = config.authentication.get('plant_id')
        self.area_filter = config.authentication.get('area_filter', [])
        self.asset_hierarchy = config.authentication.get('asset_hierarchy', {})
        
        logger.info(f"Initialized Siemens MES connector for {self.siemens_system_type}")
    
    async def connect(self) -> bool:
        """Establish connection to Siemens MES system."""
        try:
            if self.session:
                await self.session.close()
            
            # Create session with proper timeout and headers
            timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Schlep-Engine-MES-Connector/1.0'
            }
            
            # Add API key to headers if provided
            if self.api_key:
                headers['X-API-Key'] = self.api_key
            
            self.session = aiohttp.ClientSession(timeout=timeout, headers=headers)
            
            # Authenticate based on system type
            auth_success = await self._authenticate()
            if not auth_success:
                self.last_error = "Authentication failed"
                return False
            
            # Test API connectivity
            test_result = await self._test_api_connectivity()
            if not test_result:
                self.last_error = "API connectivity test failed"
                return False
            
            self.is_connected = True
            self.connection_time = datetime.utcnow()
            logger.info(f"Successfully connected to Siemens MES system: {self.api_base_url}")
            
            return True
            
        except Exception as e:
            self.last_error = f"Connection failed: {str(e)}"
            logger.error(f"Siemens MES connection error: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from Siemens MES system."""
        try:
            if self.session:
                await self.session.close()
                self.session = None
            
            self.is_connected = False
            self.access_token = None
            self.token_expiry = None
            
            logger.info("Disconnected from Siemens MES system")
            return True
            
        except Exception as e:
            logger.error(f"Error during Siemens MES disconnection: {e}")
            return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Siemens MES system connectivity and return system info."""
        try:
            if not self.is_connected:
                await self.connect()
            
            # Get system information
            system_info_endpoint = self._get_system_info_endpoint()
            response = await self._make_api_request('GET', system_info_endpoint)
            
            if response.get('success'):
                system_data = response['data']
                
                # Get available assets/equipment
                assets_endpoint = self._get_assets_endpoint()
                assets_response = await self._make_api_request('GET', assets_endpoint)
                available_assets = assets_response.get('data', {}).get('assets', [])
                
                # Calculate health score
                response_time = response.get('response_time_ms', 0)
                health_score = min(1.0, max(0.0, 1.0 - (response_time / 3000)))
                
                return {
                    'success': True,
                    'system_name': system_data.get('systemName', 'Siemens MES'),
                    'system_version': system_data.get('version'),
                    'system_type': self.siemens_system_type,
                    'plant_id': self.plant_id,
                    'tenant': self.tenant,
                    'api_version': self.config.api_version,
                    'available_assets': len(available_assets),
                    'modules': system_data.get('capabilities', []),
                    'health_score': health_score,
                    'response_time_ms': response_time,
                    'connection_time': self.connection_time,
                    'last_sync': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'System info request failed')
                }
            
        except Exception as e:
            logger.error(f"Siemens MES connection test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'health_score': 0.0
            }
    
    async def sync_work_orders(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize work orders from Siemens MES system."""
        try:
            logger.info(f"Syncing work orders from Siemens MES: {date_from} to {date_to}")
            
            # Prepare query parameters based on system type
            if self.siemens_system_type == 'MINDSHPERE':
                params = {
                    'plantId': self.plant_id,
                    'from': date_from.isoformat(),
                    'to': date_to.isoformat(),
                    'size': 1000,
                    'includeDetails': 'true'
                }
            else:  # OPCENTER
                params = {
                    'PlantModel': self.plant_id,
                    'StartTime': date_from.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'EndTime': date_to.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'MaxCount': 1000
                }
            
            # Add area filter if specified
            if self.area_filter:
                params['areas'] = ','.join(self.area_filter)
            
            # Get work orders
            work_orders_endpoint = self._get_work_orders_endpoint()
            response = await self._make_api_request('GET', work_orders_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch work orders')
                }
            
            siemens_work_orders = self._extract_work_orders_from_response(response['data'])
            
            # Convert Siemens work orders to standard format
            work_orders = []
            for siemens_wo in siemens_work_orders:
                try:
                    standard_wo = self._convert_siemens_work_order_to_standard(siemens_wo)
                    work_orders.append(standard_wo)
                except Exception as e:
                    logger.warning(f"Failed to convert Siemens work order {siemens_wo.get('WorkOrderNumber')}: {e}")
            
            logger.info(f"Successfully synced {len(work_orders)} work orders from Siemens MES")
            
            return {
                'success': True,
                'work_orders': work_orders,
                'total_count': len(work_orders),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing work orders from Siemens MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_production_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize production data from Siemens MES system."""
        try:
            logger.info(f"Syncing production data from Siemens MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            if self.siemens_system_type == 'MINDSHPERE':
                params = {
                    'plantId': self.plant_id,
                    'from': date_from.isoformat(),
                    'to': date_to.isoformat(),
                    'eventType': 'ProductionEvent',
                    'size': 1000
                }
            else:  # OPCENTER
                params = {
                    'PlantModel': self.plant_id,
                    'StartTime': date_from.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'EndTime': date_to.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'EventType': 'ProductionTransaction'
                }
            
            # Get production events/transactions
            production_endpoint = self._get_production_endpoint()
            response = await self._make_api_request('GET', production_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch production data')
                }
            
            siemens_production_records = self._extract_production_records_from_response(response['data'])
            
            # Convert Siemens production records to standard format
            production_records = []
            for siemens_record in siemens_production_records:
                try:
                    standard_record = self._convert_siemens_production_record_to_standard(siemens_record)
                    production_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert Siemens production record: {e}")
            
            logger.info(f"Successfully synced {len(production_records)} production records from Siemens MES")
            
            return {
                'success': True,
                'production_records': production_records,
                'total_count': len(production_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing production data from Siemens MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_quality_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize quality data from Siemens MES system."""
        try:
            logger.info(f"Syncing quality data from Siemens MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            if self.siemens_system_type == 'MINDSHPERE':
                params = {
                    'plantId': self.plant_id,
                    'from': date_from.isoformat(),
                    'to': date_to.isoformat(),
                    'dataType': 'QualityData',
                    'includeResults': 'true'
                }
            else:  # OPCENTER
                params = {
                    'PlantModel': self.plant_id,
                    'StartTime': date_from.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'EndTime': date_to.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'IncludeTestResults': 'true'
                }
            
            # Get quality data
            quality_endpoint = self._get_quality_endpoint()
            response = await self._make_api_request('GET', quality_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch quality data')
                }
            
            siemens_quality_records = self._extract_quality_records_from_response(response['data'])
            
            # Convert Siemens quality records to standard format
            quality_records = []
            for siemens_record in siemens_quality_records:
                try:
                    standard_record = self._convert_siemens_quality_record_to_standard(siemens_record)
                    quality_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert Siemens quality record: {e}")
            
            logger.info(f"Successfully synced {len(quality_records)} quality records from Siemens MES")
            
            return {
                'success': True,
                'quality_records': quality_records,
                'total_count': len(quality_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing quality data from Siemens MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_work_order_update(self, work_order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send work order updates to Siemens MES system."""
        try:
            # Convert standard work order format to Siemens format
            siemens_work_order = self._convert_standard_work_order_to_siemens(work_order_data)
            
            # Determine endpoint and method
            if work_order_data.get('is_new', False):
                endpoint = self._get_work_order_create_endpoint()
                method = 'POST'
            else:
                endpoint = self._get_work_order_update_endpoint(work_order_data['work_order_number'])
                method = 'PUT'
            
            response = await self._make_api_request(method, endpoint, json_data=siemens_work_order)
            
            if response.get('success'):
                logger.info(f"Successfully sent work order update to Siemens MES: {work_order_data['work_order_number']}")
                return {
                    'success': True,
                    'siemens_work_order_id': response['data'].get('Id') or response['data'].get('WorkOrderId'),
                    'siemens_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Work order update failed'),
                    'siemens_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending work order update to Siemens MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_production_report(self, production_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send production reports to Siemens MES system."""
        try:
            # Convert standard production format to Siemens format
            siemens_production_data = self._convert_standard_production_to_siemens(production_data)
            
            endpoint = self._get_production_report_endpoint()
            response = await self._make_api_request('POST', endpoint, json_data=siemens_production_data)
            
            if response.get('success'):
                logger.info("Successfully sent production report to Siemens MES")
                return {
                    'success': True,
                    'siemens_transaction_id': response['data'].get('Id') or response['data'].get('TransactionId'),
                    'siemens_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Production report failed'),
                    'siemens_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending production report to Siemens MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Private helper methods
    
    async def _authenticate(self) -> bool:
        """Authenticate with Siemens MES system."""
        try:
            if self.siemens_system_type == 'MINDSHPERE':
                return await self._authenticate_mindshpere()
            else:  # OPCENTER
                return await self._authenticate_opcenter()
        except Exception as e:
            logger.error(f"Siemens MES authentication error: {e}")
            self.last_error = f"Authentication error: {str(e)}"
            return False
    
    async def _authenticate_mindshpere(self) -> bool:
        """Authenticate with Siemens MindSphere."""
        auth_url = urljoin(self.api_base_url, '/api/technicaltokenmanager/v3/oauth/token')
        
        auth_data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        
        async with self.session.post(auth_url, data=auth_data) as response:
            if response.status == 200:
                token_data = await response.json()
                self.access_token = token_data['access_token']
                expires_in = token_data.get('expires_in', 3600)
                self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 300)  # 5 min buffer
                
                # Update session headers with token
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}'
                })
                
                return True
            else:
                error_text = await response.text()
                self.last_error = f"MindSphere authentication failed: {response.status} - {error_text}"
                return False
    
    async def _authenticate_opcenter(self) -> bool:
        """Authenticate with Siemens Opcenter."""
        # Opcenter typically uses integrated Windows authentication or service accounts
        # For API key authentication, the key is already set in headers
        if self.api_key:
            return True
        
        # For username/password authentication
        auth_url = urljoin(self.api_base_url, '/Authentication/Login')
        
        auth_data = {
            'Username': self.config.authentication.get('username'),
            'Password': self.config.authentication.get('password'),
            'Domain': self.config.authentication.get('domain', '')
        }
        
        async with self.session.post(auth_url, json=auth_data) as response:
            if response.status == 200:
                auth_response = await response.json()
                session_token = auth_response.get('SessionToken')
                
                if session_token:
                    self.access_token = session_token
                    self.session.headers.update({
                        'Authorization': f'Bearer {session_token}'
                    })
                    return True
                else:
                    self.last_error = "No session token received from Opcenter"
                    return False
            else:
                error_text = await response.text()
                self.last_error = f"Opcenter authentication failed: {response.status} - {error_text}"
                return False
    
    async def _test_api_connectivity(self) -> bool:
        """Test API connectivity after authentication."""
        try:
            test_endpoint = self._get_system_info_endpoint()
            response = await self._make_api_request('GET', test_endpoint)
            return response.get('success', False)
        except Exception:
            return False
    
    async def _make_api_request(self, method: str, endpoint: str, params: Dict = None, json_data: Dict = None) -> Dict[str, Any]:
        """Make authenticated API request to Siemens MES."""
        try:
            if not self.session:
                raise Exception("No active session")
            
            # Check token expiry for MindSphere
            if self.siemens_system_type == 'MINDSHPERE' and self.token_expiry:
                if datetime.utcnow() >= self.token_expiry:
                    await self._authenticate()
            
            url = urljoin(self.api_base_url, endpoint)
            start_time = datetime.utcnow()
            
            self.request_count += 1
            
            async with self.session.request(method, url, params=params, json=json_data) as response:
                response_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                if response.status in [200, 201]:
                    data = await response.json()
                    return {
                        'success': True,
                        'data': data,
                        'status_code': response.status,
                        'response_time_ms': response_time_ms
                    }
                else:
                    error_text = await response.text()
                    self.error_count += 1
                    logger.warning(f"Siemens MES API error: {response.status} - {error_text}")
                    return {
                        'success': False,
                        'error': f"API request failed: {response.status}",
                        'error_details': error_text,
                        'status_code': response.status
                    }
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"Siemens MES API request error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Endpoint methods based on system type
    
    def _get_system_info_endpoint(self) -> str:
        """Get system information endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/manufacturing-execution/v1/plants/{self.plant_id}/info'
        else:  # OPCENTER
            return '/DataCollectionService/GetSystemInfo'
    
    def _get_assets_endpoint(self) -> str:
        """Get assets endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/assetmanagement/v3/{self.tenant}/assets'
        else:  # OPCENTER
            return '/ModelService/GetAssets'
    
    def _get_work_orders_endpoint(self) -> str:
        """Get work orders endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/manufacturing-execution/v1/plants/{self.plant_id}/workorders'
        else:  # OPCENTER
            return '/DataCollectionService/GetWorkOrders'
    
    def _get_work_order_create_endpoint(self) -> str:
        """Get work order creation endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/manufacturing-execution/v1/plants/{self.plant_id}/workorders'
        else:  # OPCENTER
            return '/DataCollectionService/CreateWorkOrder'
    
    def _get_work_order_update_endpoint(self, work_order_number: str) -> str:
        """Get work order update endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/manufacturing-execution/v1/plants/{self.plant_id}/workorders/{work_order_number}'
        else:  # OPCENTER
            return f'/DataCollectionService/UpdateWorkOrder/{work_order_number}'
    
    def _get_production_endpoint(self) -> str:
        """Get production data endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/manufacturing-execution/v1/plants/{self.plant_id}/events'
        else:  # OPCENTER
            return '/DataCollectionService/GetProductionTransactions'
    
    def _get_production_report_endpoint(self) -> str:
        """Get production report endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/manufacturing-execution/v1/plants/{self.plant_id}/events'
        else:  # OPCENTER
            return '/DataCollectionService/ReportProduction'
    
    def _get_quality_endpoint(self) -> str:
        """Get quality data endpoint."""
        if self.siemens_system_type == 'MINDSHPERE':
            return f'/api/quality-management/v1/plants/{self.plant_id}/inspections'
        else:  # OPCENTER
            return '/QualityService/GetQualityData'
    
    # Data extraction methods
    
    def _extract_work_orders_from_response(self, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract work orders from API response based on system type."""
        if self.siemens_system_type == 'MINDSHPERE':
            return response_data.get('_embedded', {}).get('workOrders', [])
        else:  # OPCENTER
            return response_data.get('WorkOrders', [])
    
    def _extract_production_records_from_response(self, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract production records from API response."""
        if self.siemens_system_type == 'MINDSHPERE':
            return response_data.get('_embedded', {}).get('events', [])
        else:  # OPCENTER
            return response_data.get('ProductionTransactions', [])
    
    def _extract_quality_records_from_response(self, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract quality records from API response."""
        if self.siemens_system_type == 'MINDSHPERE':
            return response_data.get('_embedded', {}).get('inspections', [])
        else:  # OPCENTER
            return response_data.get('QualityData', [])
    
    # Data conversion methods
    
    def _convert_siemens_work_order_to_standard(self, siemens_wo: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Siemens work order format to standard format."""
        if self.siemens_system_type == 'MINDSHPERE':
            return self._convert_mindshpere_work_order_to_standard(siemens_wo)
        else:  # OPCENTER
            return self._convert_opcenter_work_order_to_standard(siemens_wo)
    
    def _convert_mindshpere_work_order_to_standard(self, ms_wo: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MindSphere work order to standard format."""
        return {
            'work_order_number': ms_wo.get('workOrderNumber') or ms_wo.get('id'),
            'product_code': ms_wo.get('materialId') or ms_wo.get('productCode'),
            'product_name': ms_wo.get('materialDescription') or ms_wo.get('productName'),
            'batch_number': ms_wo.get('batch'),
            'lot_number': ms_wo.get('lot'),
            'planned_quantity': float(ms_wo.get('plannedQuantity', 0)),
            'produced_quantity': float(ms_wo.get('actualQuantity', 0)),
            'unit_of_measure': ms_wo.get('unit', 'EA'),
            'status': self._convert_siemens_status_to_standard(ms_wo.get('status')),
            'priority': ms_wo.get('priority', 'normal'),
            'planned_start_time': self._parse_siemens_datetime(ms_wo.get('plannedStartTime')),
            'planned_end_time': self._parse_siemens_datetime(ms_wo.get('plannedEndTime')),
            'actual_start_time': self._parse_siemens_datetime(ms_wo.get('actualStartTime')),
            'actual_end_time': self._parse_siemens_datetime(ms_wo.get('actualEndTime')),
            'custom_data': {
                'mindshpere_id': ms_wo.get('id'),
                'plant_id': ms_wo.get('plantId'),
                'asset_id': ms_wo.get('assetId'),
                'created_by': ms_wo.get('createdBy')
            }
        }
    
    def _convert_opcenter_work_order_to_standard(self, oc_wo: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Opcenter work order to standard format."""
        return {
            'work_order_number': oc_wo.get('WorkOrderNumber') or oc_wo.get('Id'),
            'product_code': oc_wo.get('ProductionLot', {}).get('ProductDefinition', {}).get('Name'),
            'product_name': oc_wo.get('ProductionLot', {}).get('ProductDefinition', {}).get('Description'),
            'batch_number': oc_wo.get('ProductionLot', {}).get('Name'),
            'planned_quantity': float(oc_wo.get('PlanQuantity', 0)),
            'produced_quantity': float(oc_wo.get('ActualQuantity', 0)),
            'unit_of_measure': oc_wo.get('UOM', 'EA'),
            'status': self._convert_siemens_status_to_standard(oc_wo.get('CurrentState', {}).get('Name')),
            'priority': oc_wo.get('Priority', 'Normal').lower(),
            'planned_start_time': self._parse_siemens_datetime(oc_wo.get('PlanStartTime')),
            'planned_end_time': self._parse_siemens_datetime(oc_wo.get('PlanEndTime')),
            'actual_start_time': self._parse_siemens_datetime(oc_wo.get('ActualStartTime')),
            'actual_end_time': self._parse_siemens_datetime(oc_wo.get('ActualEndTime')),
            'custom_data': {
                'opcenter_id': oc_wo.get('Id'),
                'work_center': oc_wo.get('WorkCenter', {}).get('Name'),
                'operation': oc_wo.get('Operation', {}).get('Name'),
                'revision': oc_wo.get('Revision')
            }
        }
    
    def _convert_siemens_production_record_to_standard(self, siemens_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Siemens production record to standard format."""
        if self.siemens_system_type == 'MINDSHPERE':
            return {
                'record_id': siemens_record.get('eventId') or str(uuid.uuid4()),
                'work_order_number': siemens_record.get('workOrderId'),
                'equipment_id': siemens_record.get('assetId') or siemens_record.get('equipment'),
                'operator_id': siemens_record.get('operatorId'),
                'quantity_produced': float(siemens_record.get('quantity', 0)),
                'start_time': self._parse_siemens_datetime(siemens_record.get('startTime')),
                'end_time': self._parse_siemens_datetime(siemens_record.get('endTime')),
                'efficiency_percentage': siemens_record.get('efficiency'),
                'custom_data': {
                    'event_type': siemens_record.get('eventType'),
                    'plant_id': siemens_record.get('plantId')
                }
            }
        else:  # OPCENTER
            return {
                'record_id': siemens_record.get('Id') or str(uuid.uuid4()),
                'work_order_number': siemens_record.get('WorkOrderNumber'),
                'equipment_id': siemens_record.get('Resource', {}).get('Name'),
                'operator_id': siemens_record.get('UserId'),
                'quantity_produced': float(siemens_record.get('Quantity', 0)),
                'quantity_rejected': float(siemens_record.get('ScrapQuantity', 0)),
                'start_time': self._parse_siemens_datetime(siemens_record.get('StartTime')),
                'end_time': self._parse_siemens_datetime(siemens_record.get('EndTime')),
                'custom_data': {
                    'transaction_type': siemens_record.get('TransactionType'),
                    'operation_name': siemens_record.get('OperationName')
                }
            }
    
    def _convert_siemens_quality_record_to_standard(self, siemens_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Siemens quality record to standard format."""
        if self.siemens_system_type == 'MINDSHPERE':
            return {
                'quality_record_id': siemens_record.get('inspectionId') or str(uuid.uuid4()),
                'work_order_number': siemens_record.get('workOrderId'),
                'inspection_type': siemens_record.get('inspectionType'),
                'inspector_id': siemens_record.get('inspectorId'),
                'product_code': siemens_record.get('materialId'),
                'batch_number': siemens_record.get('batch'),
                'overall_status': self._convert_siemens_quality_status_to_standard(siemens_record.get('result')),
                'measured_values': siemens_record.get('measurements', {}),
                'inspection_start_time': self._parse_siemens_datetime(siemens_record.get('inspectionTime'))
            }
        else:  # OPCENTER
            return {
                'quality_record_id': siemens_record.get('Id') or str(uuid.uuid4()),
                'inspection_type': siemens_record.get('InspectionType'),
                'inspector_id': siemens_record.get('InspectorId'),
                'product_code': siemens_record.get('ProductCode'),
                'batch_number': siemens_record.get('BatchNumber'),
                'overall_status': self._convert_siemens_quality_status_to_standard(siemens_record.get('Status')),
                'measured_values': siemens_record.get('TestResults', {}),
                'passed_tests': siemens_record.get('PassedTests', 0),
                'failed_tests': siemens_record.get('FailedTests', 0),
                'inspection_start_time': self._parse_siemens_datetime(siemens_record.get('InspectionDateTime'))
            }
    
    def _convert_standard_work_order_to_siemens(self, work_order: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard work order to Siemens format."""
        if self.siemens_system_type == 'MINDSHPERE':
            return {
                'workOrderNumber': work_order['work_order_number'],
                'materialId': work_order['product_code'],
                'materialDescription': work_order.get('product_name'),
                'plannedQuantity': work_order['planned_quantity'],
                'unit': work_order['unit_of_measure'],
                'plannedStartTime': work_order.get('planned_start_time'),
                'plannedEndTime': work_order.get('planned_end_time'),
                'status': work_order.get('status', 'planned'),
                'plantId': self.plant_id
            }
        else:  # OPCENTER
            return {
                'WorkOrderNumber': work_order['work_order_number'],
                'PlanQuantity': work_order['planned_quantity'],
                'UOM': work_order['unit_of_measure'],
                'PlanStartTime': work_order.get('planned_start_time'),
                'PlanEndTime': work_order.get('planned_end_time'),
                'Priority': work_order.get('priority', 'Normal').title(),
                'ProductionLot': {
                    'ProductDefinition': {
                        'Name': work_order['product_code'],
                        'Description': work_order.get('product_name')
                    }
                }
            }
    
    def _convert_standard_production_to_siemens(self, production: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard production format to Siemens format."""
        if self.siemens_system_type == 'MINDSHPERE':
            return {
                'eventType': 'ProductionEvent',
                'workOrderId': production['work_order_number'],
                'assetId': production.get('equipment_id'),
                'quantity': production['quantity_produced'],
                'startTime': production.get('start_time'),
                'endTime': production.get('end_time'),
                'operatorId': production.get('operator_id'),
                'plantId': self.plant_id
            }
        else:  # OPCENTER
            return {
                'TransactionType': 'Production',
                'WorkOrderNumber': production['work_order_number'],
                'Resource': {'Name': production.get('equipment_id')},
                'Quantity': production['quantity_produced'],
                'ScrapQuantity': production.get('quantity_rejected', 0),
                'StartTime': production.get('start_time'),
                'EndTime': production.get('end_time'),
                'UserId': production.get('operator_id')
            }
    
    def _convert_siemens_status_to_standard(self, siemens_status: str) -> str:
        """Convert Siemens work order status to standard status."""
        if not siemens_status:
            return 'planned'
        
        status = siemens_status.lower()
        
        status_mapping = {
            'created': 'planned',
            'planned': 'planned',
            'released': 'released',
            'started': 'started',
            'active': 'started',
            'completed': 'completed',
            'finished': 'completed',
            'closed': 'completed',
            'cancelled': 'cancelled',
            'aborted': 'cancelled'
        }
        
        return status_mapping.get(status, 'planned')
    
    def _convert_siemens_quality_status_to_standard(self, siemens_result: str) -> str:
        """Convert Siemens quality result to standard status."""
        if not siemens_result:
            return 'pending'
        
        result = siemens_result.lower()
        
        result_mapping = {
            'passed': 'passed',
            'pass': 'passed',
            'ok': 'passed',
            'accepted': 'passed',
            'failed': 'failed',
            'fail': 'failed',
            'rejected': 'failed',
            'nok': 'failed',
            'pending': 'pending',
            'in_progress': 'in_review',
            'quarantined': 'quarantined'
        }
        
        return result_mapping.get(result, 'pending')
    
    def _parse_siemens_datetime(self, siemens_datetime: str) -> Optional[datetime]:
        """Parse Siemens datetime string to Python datetime."""
        if not siemens_datetime:
            return None
        
        # Handle different Siemens datetime formats
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(siemens_datetime, fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse Siemens datetime: {siemens_datetime}")
        return None