"""
Rockwell Automation MES System Connector
========================================

Connector for Rockwell Automation Manufacturing Execution systems including:
- FactoryTalk Manufacturing Execution System (MES)
- FactoryTalk Production Centre
- Real-time data synchronization via Rockwell APIs
- Integrated Windows Authentication and API key support
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


class RockwellMESConnector(BaseMESConnector):
    """Rockwell MES system connector with support for FactoryTalk systems."""
    
    def __init__(self, config: MESConnectorConfig):
        super().__init__(config)
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.api_base_url = config.endpoint_url.rstrip('/')
        
        # Authentication configuration
        self.api_key = config.authentication.get('api_key')
        self.username = config.authentication.get('username')
        self.password = config.authentication.get('password')
        self.domain = config.authentication.get('domain')
        
        # Rockwell-specific configuration
        self.plant_name = config.authentication.get('plant_name')
        self.area_filter = config.authentication.get('area_filter', [])
        self.line_filter = config.authentication.get('line_filter', [])
        self.use_windows_auth = config.authentication.get('use_windows_auth', False)
        
        logger.info("Initialized Rockwell FactoryTalk MES connector")
    
    async def connect(self) -> bool:
        """Establish connection to Rockwell MES system."""
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
            
            # Authenticate
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
            logger.info(f"Successfully connected to Rockwell MES system: {self.api_base_url}")
            
            return True
            
        except Exception as e:
            self.last_error = f"Connection failed: {str(e)}"
            logger.error(f"Rockwell MES connection error: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from Rockwell MES system."""
        try:
            if self.session:
                await self.session.close()
                self.session = None
            
            self.is_connected = False
            self.access_token = None
            self.token_expiry = None
            
            logger.info("Disconnected from Rockwell MES system")
            return True
            
        except Exception as e:
            logger.error(f"Error during Rockwell MES disconnection: {e}")
            return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Rockwell MES system connectivity and return system info."""
        try:
            if not self.is_connected:
                await self.connect()
            
            # Get system information
            system_info_endpoint = '/api/v1/system/info'
            response = await self._make_api_request('GET', system_info_endpoint)
            
            if response.get('success'):
                system_data = response['data']
                
                # Get available production lines
                lines_endpoint = '/api/v1/production/lines'
                lines_response = await self._make_api_request('GET', lines_endpoint)
                available_lines = lines_response.get('data', {}).get('lines', [])
                
                # Calculate health score
                response_time = response.get('response_time_ms', 0)
                health_score = min(1.0, max(0.0, 1.0 - (response_time / 4000)))
                
                return {
                    'success': True,
                    'system_name': system_data.get('systemName', 'FactoryTalk MES'),
                    'system_version': system_data.get('version'),
                    'system_type': 'ROCKWELL_FACTORYTALK',
                    'plant_name': self.plant_name,
                    'api_version': self.config.api_version,
                    'available_lines': len(available_lines),
                    'modules': system_data.get('modules', []),
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
            logger.error(f"Rockwell MES connection test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'health_score': 0.0
            }
    
    async def sync_work_orders(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize work orders from Rockwell MES system."""
        try:
            logger.info(f"Syncing work orders from Rockwell MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            params = {
                'plant': self.plant_name,
                'startDate': date_from.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'endDate': date_to.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'includeDetails': 'true',
                'pageSize': 1000
            }
            
            # Add filters if specified
            if self.area_filter:
                params['areas'] = ','.join(self.area_filter)
            if self.line_filter:
                params['lines'] = ','.join(self.line_filter)
            
            # Get work orders
            work_orders_endpoint = '/api/v1/production/workorders'
            response = await self._make_api_request('GET', work_orders_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch work orders')
                }
            
            rockwell_work_orders = response['data'].get('workOrders', [])
            
            # Convert Rockwell work orders to standard format
            work_orders = []
            for rockwell_wo in rockwell_work_orders:
                try:
                    standard_wo = self._convert_rockwell_work_order_to_standard(rockwell_wo)
                    work_orders.append(standard_wo)
                except Exception as e:
                    logger.warning(f"Failed to convert Rockwell work order {rockwell_wo.get('workOrderNumber')}: {e}")
            
            logger.info(f"Successfully synced {len(work_orders)} work orders from Rockwell MES")
            
            return {
                'success': True,
                'work_orders': work_orders,
                'total_count': len(work_orders),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing work orders from Rockwell MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_production_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize production data from Rockwell MES system."""
        try:
            logger.info(f"Syncing production data from Rockwell MES: {date_from} to {date_to}")
            
            # Get production transactions
            params = {
                'plant': self.plant_name,
                'startDate': date_from.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'endDate': date_to.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'transactionTypes': 'Production,Scrap,Rework',
                'includeDetails': 'true'
            }
            
            if self.line_filter:
                params['lines'] = ','.join(self.line_filter)
            
            production_endpoint = '/api/v1/production/transactions'
            response = await self._make_api_request('GET', production_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch production data')
                }
            
            rockwell_production_records = response['data'].get('transactions', [])
            
            # Convert Rockwell production records to standard format
            production_records = []
            for rockwell_record in rockwell_production_records:
                try:
                    standard_record = self._convert_rockwell_production_record_to_standard(rockwell_record)
                    production_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert Rockwell production record: {e}")
            
            logger.info(f"Successfully synced {len(production_records)} production records from Rockwell MES")
            
            return {
                'success': True,
                'production_records': production_records,
                'total_count': len(production_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing production data from Rockwell MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_quality_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize quality data from Rockwell MES system."""
        try:
            logger.info(f"Syncing quality data from Rockwell MES: {date_from} to {date_to}")
            
            # Get quality inspections
            params = {
                'plant': self.plant_name,
                'startDate': date_from.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'endDate': date_to.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'includeTestResults': 'true'
            }
            
            quality_endpoint = '/api/v1/quality/inspections'
            response = await self._make_api_request('GET', quality_endpoint, params=params)
            
            if not response.get('success'):
                return {
                    'success': False,
                    'error': response.get('error', 'Failed to fetch quality data')
                }
            
            rockwell_quality_records = response['data'].get('inspections', [])
            
            # Convert Rockwell quality records to standard format
            quality_records = []
            for rockwell_record in rockwell_quality_records:
                try:
                    standard_record = self._convert_rockwell_quality_record_to_standard(rockwell_record)
                    quality_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert Rockwell quality record: {e}")
            
            logger.info(f"Successfully synced {len(quality_records)} quality records from Rockwell MES")
            
            return {
                'success': True,
                'quality_records': quality_records,
                'total_count': len(quality_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing quality data from Rockwell MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_work_order_update(self, work_order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send work order updates to Rockwell MES system."""
        try:
            # Convert standard work order format to Rockwell format
            rockwell_work_order = self._convert_standard_work_order_to_rockwell(work_order_data)
            
            # Determine endpoint and method
            if work_order_data.get('is_new', False):
                endpoint = '/api/v1/production/workorders'
                method = 'POST'
            else:
                endpoint = f'/api/v1/production/workorders/{work_order_data["work_order_number"]}'
                method = 'PUT'
            
            response = await self._make_api_request(method, endpoint, json_data=rockwell_work_order)
            
            if response.get('success'):
                logger.info(f"Successfully sent work order update to Rockwell MES: {work_order_data['work_order_number']}")
                return {
                    'success': True,
                    'rockwell_work_order_id': response['data'].get('workOrderId'),
                    'rockwell_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Work order update failed'),
                    'rockwell_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending work order update to Rockwell MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_production_report(self, production_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send production reports to Rockwell MES system."""
        try:
            # Convert standard production format to Rockwell format
            rockwell_production_data = self._convert_standard_production_to_rockwell(production_data)
            
            endpoint = '/api/v1/production/transactions'
            response = await self._make_api_request('POST', endpoint, json_data=rockwell_production_data)
            
            if response.get('success'):
                logger.info("Successfully sent production report to Rockwell MES")
                return {
                    'success': True,
                    'rockwell_transaction_id': response['data'].get('transactionId'),
                    'rockwell_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Production report failed'),
                    'rockwell_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending production report to Rockwell MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Private helper methods
    
    async def _authenticate(self) -> bool:
        """Authenticate with Rockwell MES system."""
        try:
            if self.api_key:
                # API key authentication - key is already in headers
                return True
            elif self.use_windows_auth:
                # Windows integrated authentication
                return await self._authenticate_windows()
            else:
                # Username/password authentication
                return await self._authenticate_credentials()
        except Exception as e:
            logger.error(f"Rockwell MES authentication error: {e}")
            self.last_error = f"Authentication error: {str(e)}"
            return False
    
    async def _authenticate_windows(self) -> bool:
        """Authenticate using Windows integrated authentication."""
        # For Windows auth, we would typically use NTLM or Kerberos
        # This is a simplified implementation
        auth_url = urljoin(self.api_base_url, '/api/v1/auth/windows')
        
        auth_data = {
            'domain': self.domain,
            'username': self.username
        }
        
        async with self.session.post(auth_url, json=auth_data) as response:
            if response.status == 200:
                auth_response = await response.json()
                self.access_token = auth_response.get('token')
                
                if self.access_token:
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.access_token}'
                    })
                    return True
                else:
                    self.last_error = "No authentication token received"
                    return False
            else:
                error_text = await response.text()
                self.last_error = f"Windows authentication failed: {response.status} - {error_text}"
                return False
    
    async def _authenticate_credentials(self) -> bool:
        """Authenticate using username and password."""
        auth_url = urljoin(self.api_base_url, '/api/v1/auth/login')
        
        auth_data = {
            'username': self.username,
            'password': self.password,
            'domain': self.domain,
            'plant': self.plant_name
        }
        
        async with self.session.post(auth_url, json=auth_data) as response:
            if response.status == 200:
                auth_response = await response.json()
                self.access_token = auth_response.get('accessToken')
                expires_in = auth_response.get('expiresIn', 3600)
                
                if self.access_token:
                    self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 300)
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.access_token}'
                    })
                    return True
                else:
                    self.last_error = "No access token received"
                    return False
            else:
                error_text = await response.text()
                self.last_error = f"Credential authentication failed: {response.status} - {error_text}"
                return False
    
    async def _test_api_connectivity(self) -> bool:
        """Test API connectivity after authentication."""
        try:
            response = await self._make_api_request('GET', '/api/v1/system/info')
            return response.get('success', False)
        except Exception:
            return False
    
    async def _make_api_request(self, method: str, endpoint: str, params: Dict = None, json_data: Dict = None) -> Dict[str, Any]:
        """Make authenticated API request to Rockwell MES."""
        try:
            if not self.session:
                raise Exception("No active session")
            
            # Check token expiry
            if self.token_expiry and datetime.utcnow() >= self.token_expiry:
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
                    logger.warning(f"Rockwell MES API error: {response.status} - {error_text}")
                    return {
                        'success': False,
                        'error': f"API request failed: {response.status}",
                        'error_details': error_text,
                        'status_code': response.status
                    }
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"Rockwell MES API request error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Data conversion methods
    
    def _convert_rockwell_work_order_to_standard(self, rockwell_wo: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Rockwell work order format to standard format."""
        return {
            'work_order_number': rockwell_wo.get('workOrderNumber'),
            'product_code': rockwell_wo.get('partNumber') or rockwell_wo.get('productCode'),
            'product_name': rockwell_wo.get('partDescription') or rockwell_wo.get('productName'),
            'product_version': rockwell_wo.get('partRevision'),
            'batch_number': rockwell_wo.get('batchId') or rockwell_wo.get('lotNumber'),
            'planned_quantity': float(rockwell_wo.get('plannedQuantity', 0)),
            'produced_quantity': float(rockwell_wo.get('producedQuantity', 0)),
            'unit_of_measure': rockwell_wo.get('unitOfMeasure', 'EA'),
            'status': self._convert_rockwell_status_to_standard(rockwell_wo.get('status')),
            'priority': rockwell_wo.get('priority', 'Normal').lower(),
            'planned_start_time': self._parse_rockwell_datetime(rockwell_wo.get('plannedStartDate')),
            'planned_end_time': self._parse_rockwell_datetime(rockwell_wo.get('plannedEndDate')),
            'actual_start_time': self._parse_rockwell_datetime(rockwell_wo.get('actualStartDate')),
            'actual_end_time': self._parse_rockwell_datetime(rockwell_wo.get('actualEndDate')),
            'custom_data': {
                'rockwell_id': rockwell_wo.get('workOrderId'),
                'plant': rockwell_wo.get('plant'),
                'area': rockwell_wo.get('area'),
                'line': rockwell_wo.get('line'),
                'recipe': rockwell_wo.get('recipe'),
                'created_by': rockwell_wo.get('createdBy')
            }
        }
    
    def _convert_rockwell_production_record_to_standard(self, rockwell_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Rockwell production record format to standard format."""
        return {
            'record_id': rockwell_record.get('transactionId') or str(uuid.uuid4()),
            'work_order_number': rockwell_record.get('workOrderNumber'),
            'equipment_id': rockwell_record.get('equipmentId') or rockwell_record.get('line'),
            'operator_id': rockwell_record.get('operatorId') or rockwell_record.get('userId'),
            'shift_id': rockwell_record.get('shiftId'),
            'quantity_produced': float(rockwell_record.get('quantity', 0)),
            'quantity_rejected': float(rockwell_record.get('scrapQuantity', 0)),
            'quantity_reworked': float(rockwell_record.get('reworkQuantity', 0)),
            'start_time': self._parse_rockwell_datetime(rockwell_record.get('startTime')),
            'end_time': self._parse_rockwell_datetime(rockwell_record.get('endTime')),
            'efficiency_percentage': rockwell_record.get('efficiency'),
            'downtime_minutes': rockwell_record.get('downtimeMinutes', 0),
            'custom_data': {
                'transaction_type': rockwell_record.get('transactionType'),
                'operation_name': rockwell_record.get('operationName'),
                'recipe_name': rockwell_record.get('recipeName'),
                'plant': rockwell_record.get('plant'),
                'area': rockwell_record.get('area')
            }
        }
    
    def _convert_rockwell_quality_record_to_standard(self, rockwell_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Rockwell quality record format to standard format."""
        return {
            'quality_record_id': rockwell_record.get('inspectionId') or str(uuid.uuid4()),
            'work_order_number': rockwell_record.get('workOrderNumber'),
            'inspection_type': rockwell_record.get('inspectionType'),
            'inspector_id': rockwell_record.get('inspectorId'),
            'product_code': rockwell_record.get('partNumber'),
            'batch_number': rockwell_record.get('batchId'),
            'item_identifier': rockwell_record.get('serialNumber'),
            'overall_status': self._convert_rockwell_quality_status_to_standard(rockwell_record.get('inspectionResult')),
            'measured_values': rockwell_record.get('testResults', {}),
            'specifications': rockwell_record.get('specifications', {}),
            'passed_tests': rockwell_record.get('passedTests', 0),
            'failed_tests': rockwell_record.get('failedTests', 0),
            'disposition': rockwell_record.get('disposition'),
            'inspection_start_time': self._parse_rockwell_datetime(rockwell_record.get('inspectionDate')),
            'custom_data': {
                'inspection_plan': rockwell_record.get('inspectionPlan'),
                'test_station': rockwell_record.get('testStation'),
                'plant': rockwell_record.get('plant')
            }
        }
    
    def _convert_standard_work_order_to_rockwell(self, work_order: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard work order format to Rockwell format."""
        return {
            'workOrderNumber': work_order['work_order_number'],
            'partNumber': work_order['product_code'],
            'partDescription': work_order.get('product_name'),
            'plannedQuantity': work_order['planned_quantity'],
            'unitOfMeasure': work_order['unit_of_measure'],
            'plannedStartDate': work_order.get('planned_start_time'),
            'plannedEndDate': work_order.get('planned_end_time'),
            'priority': work_order.get('priority', 'Normal').title(),
            'plant': self.plant_name,
            'batchId': work_order.get('batch_number'),
            'status': self._convert_standard_status_to_rockwell(work_order.get('status', 'planned'))
        }
    
    def _convert_standard_production_to_rockwell(self, production: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard production format to Rockwell format."""
        return {
            'transactionType': 'Production',
            'workOrderNumber': production['work_order_number'],
            'equipmentId': production.get('equipment_id'),
            'line': production.get('equipment_id'),  # Rockwell often uses 'line' instead of equipment
            'quantity': production['quantity_produced'],
            'scrapQuantity': production.get('quantity_rejected', 0),
            'startTime': production.get('start_time'),
            'endTime': production.get('end_time'),
            'operatorId': production.get('operator_id'),
            'shiftId': production.get('shift_id'),
            'plant': self.plant_name
        }
    
    def _convert_rockwell_status_to_standard(self, rockwell_status: str) -> str:
        """Convert Rockwell work order status to standard status."""
        if not rockwell_status:
            return 'planned'
        
        status = rockwell_status.lower().replace(' ', '_')
        
        status_mapping = {
            'created': 'planned',
            'planned': 'planned',
            'released': 'released',
            'ready_to_start': 'released',
            'started': 'started',
            'in_progress': 'started',
            'running': 'started',
            'completed': 'completed',
            'finished': 'completed',
            'closed': 'completed',
            'cancelled': 'cancelled',
            'aborted': 'cancelled',
            'on_hold': 'on_hold',
            'paused': 'paused'
        }
        
        return status_mapping.get(status, 'planned')
    
    def _convert_standard_status_to_rockwell(self, status: str) -> str:
        """Convert standard status to Rockwell status."""
        status_mapping = {
            'planned': 'Created',
            'released': 'Released',
            'started': 'Started',
            'paused': 'Paused',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
            'on_hold': 'On Hold'
        }
        return status_mapping.get(status, 'Created')
    
    def _convert_rockwell_quality_status_to_standard(self, rockwell_result: str) -> str:
        """Convert Rockwell quality result to standard status."""
        if not rockwell_result:
            return 'pending'
        
        result = rockwell_result.lower()
        
        result_mapping = {
            'pass': 'passed',
            'passed': 'passed',
            'accept': 'passed',
            'accepted': 'passed',
            'ok': 'passed',
            'fail': 'failed',
            'failed': 'failed',
            'reject': 'failed',
            'rejected': 'failed',
            'nok': 'failed',
            'pending': 'pending',
            'in_progress': 'in_review',
            'under_review': 'in_review',
            'quarantine': 'quarantined',
            'quarantined': 'quarantined'
        }
        
        return result_mapping.get(result, 'pending')
    
    def _parse_rockwell_datetime(self, rockwell_datetime: str) -> Optional[datetime]:
        """Parse Rockwell datetime string to Python datetime."""
        if not rockwell_datetime:
            return None
        
        # Handle different Rockwell datetime formats
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S',
            '%m/%d/%Y %H:%M:%S',
            '%Y-%m-%d %H:%M:%S'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(rockwell_datetime, fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse Rockwell datetime: {rockwell_datetime}")
        return None