"""
SAP MES System Connector
=======================

Connector for SAP Manufacturing Execution systems including:
- SAP Manufacturing Execution (SAP ME)
- SAP Digital Manufacturing Cloud (SAP DMC)
- Real-time data synchronization via SAP APIs
- OAuth 2.0 and certificate-based authentication
"""

import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json
import base64
from urllib.parse import urljoin

from app.services.mes_integration_service import BaseMESConnector, MESConnectorConfig

logger = logging.getLogger(__name__)


class SAPMESConnector(BaseMESConnector):
    """SAP MES system connector with support for SAP ME and SAP DMC."""
    
    def __init__(self, config: MESConnectorConfig):
        super().__init__(config)
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.api_base_url = config.endpoint_url.rstrip('/')
        self.client_id = config.authentication.get('client_id')
        self.client_secret = config.authentication.get('client_secret')
        self.username = config.authentication.get('username')
        self.password = config.authentication.get('password')
        self.tenant_id = config.authentication.get('tenant_id')
        
        # SAP-specific configuration
        self.sap_system_type = config.authentication.get('system_type', 'SAP_ME')  # SAP_ME or SAP_DMC
        self.plant_code = config.authentication.get('plant_code')
        self.work_center_filter = config.authentication.get('work_center_filter', [])
        
        logger.info(f"Initialized SAP MES connector for {self.sap_system_type}")
    
    async def connect(self) -> bool:
        """Establish connection to SAP MES system."""
        try:
            if self.session:
                await self.session.close()
            
            # Create session with proper timeout and headers
            timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Schlep-Engine-MES-Connector/1.0'
                }
            )
            
            # Authenticate and get access token
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
            logger.info(f"Successfully connected to SAP MES system: {self.api_base_url}")
            
            return True
            
        except Exception as e:
            self.last_error = f"Connection failed: {str(e)}"
            logger.error(f"SAP MES connection error: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from SAP MES system."""
        try:
            if self.session:
                await self.session.close()
                self.session = None
            
            self.is_connected = False
            self.access_token = None
            self.token_expiry = None
            
            logger.info("Disconnected from SAP MES system")
            return True
            
        except Exception as e:
            logger.error(f"Error during SAP MES disconnection: {e}")
            return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test SAP MES system connectivity and return system info."""
        try:
            if not self.is_connected:
                await self.connect()
            
            # Get system information
            system_info_endpoint = self._get_system_info_endpoint()
            response = await self._make_api_request('GET', system_info_endpoint)
            
            if response.get('success'):
                system_data = response['data']
                
                # Get available modules/services
                modules_endpoint = self._get_modules_endpoint()
                modules_response = await self._make_api_request('GET', modules_endpoint)
                available_modules = modules_response.get('data', {}).get('modules', [])
                
                # Calculate health score based on response time and system status
                response_time = response.get('response_time_ms', 0)
                health_score = min(1.0, max(0.0, 1.0 - (response_time / 5000)))  # Penalize slow responses
                
                return {
                    'success': True,
                    'system_name': system_data.get('systemName', 'SAP MES'),
                    'system_version': system_data.get('version'),
                    'system_type': self.sap_system_type,
                    'plant_code': self.plant_code,
                    'tenant_id': self.tenant_id,
                    'api_version': self.config.api_version,
                    'modules': available_modules,
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
            logger.error(f"SAP MES connection test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'health_score': 0.0
            }
    
    async def sync_work_orders(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize work orders from SAP MES system."""
        try:
            logger.info(f"Syncing work orders from SAP MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            params = {
                'plantCode': self.plant_code,
                'dateFrom': date_from.strftime('%Y-%m-%dT%H:%M:%S'),
                'dateTo': date_to.strftime('%Y-%m-%dT%H:%M:%S'),
                'includeDetails': 'true'
            }
            
            if self.work_center_filter:
                params['workCenters'] = ','.join(self.work_center_filter)
            
            # Get work orders
            work_orders_endpoint = self._get_work_orders_endpoint()
            response = await self._make_api_request('GET', work_orders_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch work orders')
                }
            
            sap_work_orders = response['data'].get('workOrders', [])
            
            # Convert SAP work orders to standard format
            work_orders = []
            for sap_wo in sap_work_orders:
                try:
                    standard_wo = self._convert_sap_work_order_to_standard(sap_wo)
                    work_orders.append(standard_wo)
                except Exception as e:
                    logger.warning(f"Failed to convert SAP work order {sap_wo.get('workOrderNumber')}: {e}")
            
            logger.info(f"Successfully synced {len(work_orders)} work orders from SAP MES")
            
            return {
                'success': True,
                'work_orders': work_orders,
                'total_count': len(work_orders),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing work orders from SAP MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_production_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize production data from SAP MES system."""
        try:
            logger.info(f"Syncing production data from SAP MES: {date_from} to {date_to}")
            
            # Get production confirmations/transactions
            params = {
                'plantCode': self.plant_code,
                'dateFrom': date_from.strftime('%Y-%m-%dT%H:%M:%S'),
                'dateTo': date_to.strftime('%Y-%m-%dT%H:%M:%S'),
                'transactionType': 'PRODUCTION_CONFIRMATION'
            }
            
            production_endpoint = self._get_production_endpoint()
            response = await self._make_api_request('GET', production_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch production data')
                }
            
            sap_production_records = response['data'].get('productionRecords', [])
            
            # Convert SAP production records to standard format
            production_records = []
            for sap_record in sap_production_records:
                try:
                    standard_record = self._convert_sap_production_record_to_standard(sap_record)
                    production_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert SAP production record: {e}")
            
            logger.info(f"Successfully synced {len(production_records)} production records from SAP MES")
            
            return {
                'success': True,
                'production_records': production_records,
                'total_count': len(production_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing production data from SAP MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_quality_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize quality data from SAP MES system."""
        try:
            logger.info(f"Syncing quality data from SAP MES: {date_from} to {date_to}")
            
            # Get quality inspections and results
            params = {
                'plantCode': self.plant_code,
                'dateFrom': date_from.strftime('%Y-%m-%dT%H:%M:%S'),
                'dateTo': date_to.strftime('%Y-%m-%dT%H:%M:%S'),
                'includeResults': 'true'
            }
            
            quality_endpoint = self._get_quality_endpoint()
            response = await self._make_api_request('GET', quality_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch quality data')
                }
            
            sap_quality_records = response['data'].get('qualityInspections', [])
            
            # Convert SAP quality records to standard format
            quality_records = []
            for sap_record in sap_quality_records:
                try:
                    standard_record = self._convert_sap_quality_record_to_standard(sap_record)
                    quality_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert SAP quality record: {e}")
            
            logger.info(f"Successfully synced {len(quality_records)} quality records from SAP MES")
            
            return {
                'success': True,
                'quality_records': quality_records,
                'total_count': len(quality_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing quality data from SAP MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_work_order_update(self, work_order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send work order updates to SAP MES system."""
        try:
            # Convert standard work order format to SAP format
            sap_work_order = self._convert_standard_work_order_to_sap(work_order_data)
            
            # Determine endpoint based on operation (create/update)
            if work_order_data.get('is_new', False):
                endpoint = self._get_work_order_create_endpoint()
                method = 'POST'
            else:
                endpoint = self._get_work_order_update_endpoint(work_order_data['work_order_number'])
                method = 'PUT'
            
            response = await self._make_api_request(method, endpoint, json_data=sap_work_order)
            
            if response.get('success'):
                logger.info(f"Successfully sent work order update to SAP MES: {work_order_data['work_order_number']}")
                return {
                    'success': True,
                    'sap_work_order_id': response['data'].get('workOrderId'),
                    'sap_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Work order update failed'),
                    'sap_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending work order update to SAP MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_production_report(self, production_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send production reports to SAP MES system."""
        try:
            # Convert standard production format to SAP format
            sap_production_data = self._convert_standard_production_to_sap(production_data)
            
            endpoint = self._get_production_confirmation_endpoint()
            response = await self._make_api_request('POST', endpoint, json_data=sap_production_data)
            
            if response.get('success'):
                logger.info("Successfully sent production report to SAP MES")
                return {
                    'success': True,
                    'sap_confirmation_id': response['data'].get('confirmationId'),
                    'sap_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Production report failed'),
                    'sap_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending production report to SAP MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Private helper methods
    
    async def _authenticate(self) -> bool:
        """Authenticate with SAP MES system."""
        try:
            if self.sap_system_type == 'SAP_DMC':
                return await self._authenticate_sap_dmc()
            else:
                return await self._authenticate_sap_me()
        except Exception as e:
            logger.error(f"SAP MES authentication error: {e}")
            self.last_error = f"Authentication error: {str(e)}"
            return False
    
    async def _authenticate_sap_dmc(self) -> bool:
        """Authenticate with SAP Digital Manufacturing Cloud."""
        auth_url = urljoin(self.api_base_url, '/oauth/token')
        
        auth_data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        
        if self.tenant_id:
            auth_data['tenant'] = self.tenant_id
        
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
                self.last_error = f"DMC authentication failed: {response.status} - {error_text}"
                return False
    
    async def _authenticate_sap_me(self) -> bool:
        """Authenticate with SAP Manufacturing Execution."""
        auth_url = urljoin(self.api_base_url, '/auth/login')
        
        auth_data = {
            'username': self.username,
            'password': self.password,
            'plant': self.plant_code
        }
        
        async with self.session.post(auth_url, json=auth_data) as response:
            if response.status == 200:
                auth_response = await response.json()
                self.access_token = auth_response['sessionId']
                
                # Update session headers with session ID
                self.session.headers.update({
                    'X-Session-ID': self.access_token
                })
                
                return True
            else:
                error_text = await response.text()
                self.last_error = f"SAP ME authentication failed: {response.status} - {error_text}"
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
        """Make authenticated API request to SAP MES."""
        try:
            if not self.session:
                raise Exception("No active session")
            
            # Check token expiry for DMC
            if self.sap_system_type == 'SAP_DMC' and self.token_expiry:
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
                    logger.warning(f"SAP MES API error: {response.status} - {error_text}")
                    return {
                        'success': False,
                        'error': f"API request failed: {response.status}",
                        'error_details': error_text,
                        'status_code': response.status
                    }
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"SAP MES API request error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_system_info_endpoint(self) -> str:
        """Get system information endpoint based on SAP system type."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/system/info'
        else:
            return '/api/system/info'
    
    def _get_modules_endpoint(self) -> str:
        """Get available modules endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/system/modules'
        else:
            return '/api/system/modules'
    
    def _get_work_orders_endpoint(self) -> str:
        """Get work orders endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/production/workorders'
        else:
            return '/api/workorder'
    
    def _get_work_order_create_endpoint(self) -> str:
        """Get work order creation endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/production/workorders'
        else:
            return '/api/workorder'
    
    def _get_work_order_update_endpoint(self, work_order_number: str) -> str:
        """Get work order update endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return f'/api/v1/production/workorders/{work_order_number}'
        else:
            return f'/api/workorder/{work_order_number}'
    
    def _get_production_endpoint(self) -> str:
        """Get production data endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/production/confirmations'
        else:
            return '/api/production/confirmations'
    
    def _get_production_confirmation_endpoint(self) -> str:
        """Get production confirmation endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/production/confirmations'
        else:
            return '/api/production/confirm'
    
    def _get_quality_endpoint(self) -> str:
        """Get quality data endpoint."""
        if self.sap_system_type == 'SAP_DMC':
            return '/api/v1/quality/inspections'
        else:
            return '/api/quality/inspections'
    
    def _convert_sap_work_order_to_standard(self, sap_wo: Dict[str, Any]) -> Dict[str, Any]:
        """Convert SAP work order format to standard format."""
        return {
            'work_order_number': sap_wo.get('workOrderNumber') or sap_wo.get('number'),
            'product_code': sap_wo.get('materialNumber') or sap_wo.get('productCode'),
            'product_name': sap_wo.get('materialDescription') or sap_wo.get('productName'),
            'product_version': sap_wo.get('version'),
            'batch_number': sap_wo.get('batchNumber') or sap_wo.get('batch'),
            'lot_number': sap_wo.get('lotNumber') or sap_wo.get('lot'),
            'planned_quantity': float(sap_wo.get('plannedQuantity', 0)),
            'produced_quantity': float(sap_wo.get('producedQuantity', 0)),
            'unit_of_measure': sap_wo.get('unitOfMeasure') or sap_wo.get('uom', 'EA'),
            'status': self._convert_sap_status_to_standard(sap_wo.get('status')),
            'priority': self._convert_sap_priority_to_standard(sap_wo.get('priority')),
            'planned_start_time': self._parse_sap_datetime(sap_wo.get('plannedStartDate')),
            'planned_end_time': self._parse_sap_datetime(sap_wo.get('plannedEndDate')),
            'actual_start_time': self._parse_sap_datetime(sap_wo.get('actualStartDate')),
            'actual_end_time': self._parse_sap_datetime(sap_wo.get('actualEndDate')),
            'work_center': sap_wo.get('workCenter'),
            'routing': sap_wo.get('routing'),
            'custom_data': {
                'sap_work_order_id': sap_wo.get('id'),
                'plant': sap_wo.get('plant'),
                'order_type': sap_wo.get('orderType'),
                'created_by': sap_wo.get('createdBy'),
                'created_at': sap_wo.get('createdAt')
            }
        }
    
    def _convert_sap_production_record_to_standard(self, sap_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert SAP production record format to standard format."""
        return {
            'record_id': sap_record.get('confirmationId') or sap_record.get('id'),
            'work_order_number': sap_record.get('workOrderNumber'),
            'equipment_id': sap_record.get('workCenter') or sap_record.get('equipment'),
            'operator_id': sap_record.get('confirmedBy') or sap_record.get('operator'),
            'shift_id': sap_record.get('shift'),
            'quantity_produced': float(sap_record.get('confirmedQuantity', 0)),
            'quantity_rejected': float(sap_record.get('scrapQuantity', 0)),
            'start_time': self._parse_sap_datetime(sap_record.get('actualStartTime')),
            'end_time': self._parse_sap_datetime(sap_record.get('actualEndTime')),
            'efficiency_percentage': sap_record.get('efficiency'),
            'custom_data': {
                'sap_confirmation_id': sap_record.get('confirmationId'),
                'operation_number': sap_record.get('operationNumber'),
                'work_center': sap_record.get('workCenter'),
                'plant': sap_record.get('plant')
            }
        }
    
    def _convert_sap_quality_record_to_standard(self, sap_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert SAP quality record format to standard format."""
        return {
            'quality_record_id': sap_record.get('inspectionId') or sap_record.get('id'),
            'work_order_number': sap_record.get('workOrderNumber'),
            'inspection_type': sap_record.get('inspectionType'),
            'inspector_id': sap_record.get('inspector'),
            'product_code': sap_record.get('materialNumber'),
            'batch_number': sap_record.get('batchNumber'),
            'item_identifier': sap_record.get('serialNumber') or sap_record.get('itemId'),
            'overall_status': self._convert_sap_quality_status_to_standard(sap_record.get('result')),
            'measured_values': sap_record.get('measurements', {}),
            'specifications': sap_record.get('specifications', {}),
            'passed_tests': sap_record.get('passedTests', 0),
            'failed_tests': sap_record.get('failedTests', 0),
            'disposition': sap_record.get('disposition'),
            'inspection_start_time': self._parse_sap_datetime(sap_record.get('inspectionDate'))
        }
    
    def _convert_standard_work_order_to_sap(self, work_order: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard work order format to SAP format."""
        sap_data = {
            'workOrderNumber': work_order['work_order_number'],
            'materialNumber': work_order['product_code'],
            'plannedQuantity': work_order['planned_quantity'],
            'unitOfMeasure': work_order['unit_of_measure'],
            'plant': self.plant_code
        }
        
        # Add optional fields
        if work_order.get('product_name'):
            sap_data['materialDescription'] = work_order['product_name']
        if work_order.get('batch_number'):
            sap_data['batchNumber'] = work_order['batch_number']
        if work_order.get('planned_start_time'):
            sap_data['plannedStartDate'] = work_order['planned_start_time']
        if work_order.get('planned_end_time'):
            sap_data['plannedEndDate'] = work_order['planned_end_time']
        if work_order.get('status'):
            sap_data['status'] = self._convert_standard_status_to_sap(work_order['status'])
        
        return sap_data
    
    def _convert_standard_production_to_sap(self, production: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard production format to SAP format."""
        return {
            'workOrderNumber': production['work_order_number'],
            'confirmedQuantity': production['quantity_produced'],
            'scrapQuantity': production.get('quantity_rejected', 0),
            'workCenter': production.get('equipment_id'),
            'actualStartTime': production.get('start_time'),
            'actualEndTime': production.get('end_time'),
            'confirmedBy': production.get('operator_id'),
            'plant': self.plant_code
        }
    
    def _convert_sap_status_to_standard(self, sap_status: str) -> str:
        """Convert SAP work order status to standard status."""
        status_mapping = {
            'CRTD': 'planned',      # Created
            'REL': 'released',      # Released
            'PCNF': 'started',      # Partially Confirmed
            'CNF': 'completed',     # Confirmed
            'TECO': 'completed',    # Technically Complete
            'CLSD': 'completed',    # Closed
            'DLFL': 'cancelled'     # Deletion Flag
        }
        return status_mapping.get(sap_status, 'planned')
    
    def _convert_standard_status_to_sap(self, status: str) -> str:
        """Convert standard status to SAP status."""
        status_mapping = {
            'planned': 'CRTD',
            'released': 'REL',
            'started': 'PCNF',
            'completed': 'TECO',
            'cancelled': 'DLFL'
        }
        return status_mapping.get(status, 'CRTD')
    
    def _convert_sap_priority_to_standard(self, sap_priority: str) -> str:
        """Convert SAP priority to standard priority."""
        if not sap_priority:
            return 'normal'
        
        priority_mapping = {
            '1': 'low',
            '2': 'normal',
            '3': 'high',
            '4': 'urgent',
            '5': 'critical'
        }
        return priority_mapping.get(str(sap_priority), 'normal')
    
    def _convert_sap_quality_status_to_standard(self, sap_result: str) -> str:
        """Convert SAP quality result to standard status."""
        result_mapping = {
            'A': 'passed',      # Accepted
            'R': 'failed',      # Rejected
            'Q': 'quarantined', # Quarantined
            'B': 'pending',     # Blocked
            'P': 'pending'      # Pending
        }
        return result_mapping.get(sap_result, 'pending')
    
    def _parse_sap_datetime(self, sap_datetime: str) -> Optional[datetime]:
        """Parse SAP datetime string to Python datetime."""
        if not sap_datetime:
            return None
        
        # Handle different SAP datetime formats
        formats = [
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S',
            '%Y%m%d%H%M%S'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(sap_datetime, fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse SAP datetime: {sap_datetime}")
        return None