"""
Generic REST API MES Connector
==============================

Generic connector for custom MES systems with REST APIs including:
- Configurable endpoint mapping
- Multiple authentication methods (API Key, OAuth 2.0, Basic Auth)
- Customizable data transformation and field mapping
- Flexible response parsing and error handling
"""

import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json
import uuid
import base64
from urllib.parse import urljoin, urlencode

from app.services.mes_integration_service import BaseMESConnector, MESConnectorConfig

logger = logging.getLogger(__name__)


class GenericRESTConnector(BaseMESConnector):
    """Generic REST API connector for custom MES systems."""
    
    def __init__(self, config: MESConnectorConfig):
        super().__init__(config)
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.api_base_url = config.endpoint_url.rstrip('/')
        
        # Authentication configuration
        self.auth_method = config.authentication.get('method', 'api_key')  # api_key, oauth2, basic, bearer
        self.api_key = config.authentication.get('api_key')
        self.api_key_header = config.authentication.get('api_key_header', 'X-API-Key')
        self.client_id = config.authentication.get('client_id')
        self.client_secret = config.authentication.get('client_secret')
        self.username = config.authentication.get('username')
        self.password = config.authentication.get('password')
        self.oauth_token_url = config.authentication.get('token_url')
        
        # Generic connector configuration
        self.endpoint_mapping = config.authentication.get('endpoint_mapping', {})
        self.field_mapping = config.authentication.get('field_mapping', {})
        self.response_format = config.authentication.get('response_format', 'json')  # json, xml
        self.data_path_mapping = config.authentication.get('data_path_mapping', {})
        self.custom_headers = config.authentication.get('custom_headers', {})
        self.pagination_config = config.authentication.get('pagination_config', {})
        
        # Default endpoint mapping
        self._set_default_endpoints()
        
        logger.info("Initialized Generic REST MES connector")
    
    def _set_default_endpoints(self):
        """Set default endpoint mappings if not provided."""
        default_endpoints = {
            'system_info': '/api/system/info',
            'work_orders': '/api/workorders',
            'work_order_create': '/api/workorders',
            'work_order_update': '/api/workorders/{id}',
            'production_data': '/api/production',
            'production_report': '/api/production',
            'quality_data': '/api/quality',
            'quality_report': '/api/quality'
        }
        
        for endpoint, default_path in default_endpoints.items():
            if endpoint not in self.endpoint_mapping:
                self.endpoint_mapping[endpoint] = default_path
    
    async def connect(self) -> bool:
        """Establish connection to generic MES system."""
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
            
            # Add custom headers
            headers.update(self.custom_headers)
            
            self.session = aiohttp.ClientSession(timeout=timeout, headers=headers)
            
            # Authenticate based on method
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
            logger.info(f"Successfully connected to Generic MES system: {self.api_base_url}")
            
            return True
            
        except Exception as e:
            self.last_error = f"Connection failed: {str(e)}"
            logger.error(f"Generic MES connection error: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from generic MES system."""
        try:
            if self.session:
                await self.session.close()
                self.session = None
            
            self.is_connected = False
            self.access_token = None
            self.token_expiry = None
            
            logger.info("Disconnected from Generic MES system")
            return True
            
        except Exception as e:
            logger.error(f"Error during Generic MES disconnection: {e}")
            return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test generic MES system connectivity and return system info."""
        try:
            if not self.is_connected:
                await self.connect()
            
            # Get system information
            system_info_endpoint = self.endpoint_mapping.get('system_info')
            response = await self._make_api_request('GET', system_info_endpoint)
            
            if response.get('success'):
                system_data = response['data']
                
                # Extract system info based on configured data paths
                system_name = self._extract_data_from_response(system_data, 'system_name', 'Generic MES')
                system_version = self._extract_data_from_response(system_data, 'system_version', '1.0')
                
                # Calculate health score
                response_time = response.get('response_time_ms', 0)
                health_score = min(1.0, max(0.0, 1.0 - (response_time / 5000)))
                
                return {
                    'success': True,
                    'system_name': system_name,
                    'system_version': system_version,
                    'system_type': 'GENERIC_REST',
                    'api_version': self.config.api_version,
                    'health_score': health_score,
                    'response_time_ms': response_time,
                    'connection_time': self.connection_time,
                    'last_sync': datetime.utcnow(),
                    'raw_system_info': system_data
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'System info request failed')
                }
            
        except Exception as e:
            logger.error(f"Generic MES connection test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'health_score': 0.0
            }
    
    async def sync_work_orders(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize work orders from generic MES system."""
        try:
            logger.info(f"Syncing work orders from Generic MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            params = self._build_date_range_params(date_from, date_to, 'work_orders')
            
            # Get work orders with pagination if configured
            work_orders_endpoint = self.endpoint_mapping.get('work_orders')
            all_work_orders = await self._get_paginated_data(work_orders_endpoint, params, 'work_orders')
            
            if all_work_orders is None:
                return {
                    'success': False,
                    'error': 'Failed to fetch work orders'
                }
            
            # Convert generic work orders to standard format
            work_orders = []
            for generic_wo in all_work_orders:
                try:
                    standard_wo = self._convert_generic_work_order_to_standard(generic_wo)
                    work_orders.append(standard_wo)
                except Exception as e:
                    logger.warning(f"Failed to convert generic work order: {e}")
            
            logger.info(f"Successfully synced {len(work_orders)} work orders from Generic MES")
            
            return {
                'success': True,
                'work_orders': work_orders,
                'total_count': len(work_orders),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing work orders from Generic MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_production_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize production data from generic MES system."""
        try:
            logger.info(f"Syncing production data from Generic MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            params = self._build_date_range_params(date_from, date_to, 'production_data')
            
            # Get production data with pagination
            production_endpoint = self.endpoint_mapping.get('production_data')
            all_production_records = await self._get_paginated_data(production_endpoint, params, 'production_data')
            
            if all_production_records is None:
                return {
                    'success': False,
                    'error': 'Failed to fetch production data'
                }
            
            # Convert generic production records to standard format
            production_records = []
            for generic_record in all_production_records:
                try:
                    standard_record = self._convert_generic_production_record_to_standard(generic_record)
                    production_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert generic production record: {e}")
            
            logger.info(f"Successfully synced {len(production_records)} production records from Generic MES")
            
            return {
                'success': True,
                'production_records': production_records,
                'total_count': len(production_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing production data from Generic MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_quality_data(self, date_from: datetime, date_to: datetime) -> Dict[str, Any]:
        """Synchronize quality data from generic MES system."""
        try:
            logger.info(f"Syncing quality data from Generic MES: {date_from} to {date_to}")
            
            # Prepare query parameters
            params = self._build_date_range_params(date_from, date_to, 'quality_data')
            
            # Get quality data with pagination
            quality_endpoint = self.endpoint_mapping.get('quality_data')
            all_quality_records = await self._get_paginated_data(quality_endpoint, params, 'quality_data')
            
            if all_quality_records is None:
                return {
                    'success': False,
                    'error': 'Failed to fetch quality data'
                }
            
            # Convert generic quality records to standard format
            quality_records = []
            for generic_record in all_quality_records:
                try:
                    standard_record = self._convert_generic_quality_record_to_standard(generic_record)
                    quality_records.append(standard_record)
                except Exception as e:
                    logger.warning(f"Failed to convert generic quality record: {e}")
            
            logger.info(f"Successfully synced {len(quality_records)} quality records from Generic MES")
            
            return {
                'success': True,
                'quality_records': quality_records,
                'total_count': len(quality_records),
                'sync_timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing quality data from Generic MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_work_order_update(self, work_order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send work order updates to generic MES system."""
        try:
            # Convert standard work order format to generic format
            generic_work_order = self._convert_standard_work_order_to_generic(work_order_data)
            
            # Determine endpoint and method
            if work_order_data.get('is_new', False):
                endpoint = self.endpoint_mapping.get('work_order_create')
                method = 'POST'
            else:
                endpoint_template = self.endpoint_mapping.get('work_order_update')
                endpoint = endpoint_template.format(id=work_order_data['work_order_number'])
                method = 'PUT'
            
            response = await self._make_api_request(method, endpoint, json_data=generic_work_order)
            
            if response.get('success'):
                logger.info(f"Successfully sent work order update to Generic MES: {work_order_data['work_order_number']}")
                return {
                    'success': True,
                    'generic_work_order_id': self._extract_data_from_response(response['data'], 'work_order_id'),
                    'generic_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Work order update failed'),
                    'generic_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending work order update to Generic MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_production_report(self, production_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send production reports to generic MES system."""
        try:
            # Convert standard production format to generic format
            generic_production_data = self._convert_standard_production_to_generic(production_data)
            
            endpoint = self.endpoint_mapping.get('production_report')
            response = await self._make_api_request('POST', endpoint, json_data=generic_production_data)
            
            if response.get('success'):
                logger.info("Successfully sent production report to Generic MES")
                return {
                    'success': True,
                    'generic_transaction_id': self._extract_data_from_response(response['data'], 'transaction_id'),
                    'generic_response': response['data'],
                    'timestamp': datetime.utcnow()
                }
            else:
                return {
                    'success': False,
                    'error': response.get('error', 'Production report failed'),
                    'generic_error_details': response.get('data')
                }
            
        except Exception as e:
            logger.error(f"Error sending production report to Generic MES: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # Private helper methods
    
    async def _authenticate(self) -> bool:
        """Authenticate with generic MES system based on configured method."""
        try:
            if self.auth_method == 'api_key':
                return await self._authenticate_api_key()
            elif self.auth_method == 'oauth2':
                return await self._authenticate_oauth2()
            elif self.auth_method == 'basic':
                return await self._authenticate_basic()
            elif self.auth_method == 'bearer':
                return await self._authenticate_bearer()
            else:
                logger.warning(f"Unknown authentication method: {self.auth_method}")
                return True  # Assume no auth required
        except Exception as e:
            logger.error(f"Generic MES authentication error: {e}")
            self.last_error = f"Authentication error: {str(e)}"
            return False
    
    async def _authenticate_api_key(self) -> bool:
        """Authenticate using API key."""
        if not self.api_key:
            logger.error("API key not provided")
            return False
        
        # Add API key to session headers
        self.session.headers.update({
            self.api_key_header: self.api_key
        })
        
        return True
    
    async def _authenticate_oauth2(self) -> bool:
        """Authenticate using OAuth 2.0."""
        if not self.oauth_token_url or not self.client_id or not self.client_secret:
            logger.error("OAuth 2.0 credentials not complete")
            return False
        
        auth_data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        
        async with self.session.post(self.oauth_token_url, data=auth_data) as response:
            if response.status == 200:
                token_data = await response.json()
                self.access_token = token_data.get('access_token')
                expires_in = token_data.get('expires_in', 3600)
                self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 300)
                
                # Update session headers
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}'
                })
                
                return True
            else:
                error_text = await response.text()
                self.last_error = f"OAuth 2.0 authentication failed: {response.status} - {error_text}"
                return False
    
    async def _authenticate_basic(self) -> bool:
        """Authenticate using Basic authentication."""
        if not self.username or not self.password:
            logger.error("Basic auth credentials not provided")
            return False
        
        # Create Basic auth header
        credentials = f"{self.username}:{self.password}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        self.session.headers.update({
            'Authorization': f'Basic {encoded_credentials}'
        })
        
        return True
    
    async def _authenticate_bearer(self) -> bool:
        """Authenticate using Bearer token."""
        token = self.config.authentication.get('bearer_token')
        if not token:
            logger.error("Bearer token not provided")
            return False
        
        self.session.headers.update({
            'Authorization': f'Bearer {token}'
        })
        
        return True
    
    async def _test_api_connectivity(self) -> bool:
        """Test API connectivity after authentication."""
        try:
            system_info_endpoint = self.endpoint_mapping.get('system_info')
            if system_info_endpoint:
                response = await self._make_api_request('GET', system_info_endpoint)
                return response.get('success', False)
            else:
                # If no system info endpoint, assume connection is good
                return True
        except Exception:
            return False
    
    async def _make_api_request(self, method: str, endpoint: str, params: Dict = None, json_data: Dict = None) -> Dict[str, Any]:
        """Make authenticated API request to generic MES."""
        try:
            if not self.session:
                raise Exception("No active session")
            
            # Check token expiry for OAuth 2.0
            if self.auth_method == 'oauth2' and self.token_expiry:
                if datetime.utcnow() >= self.token_expiry:
                    await self._authenticate()
            
            url = urljoin(self.api_base_url, endpoint)
            start_time = datetime.utcnow()
            
            self.request_count += 1
            
            async with self.session.request(method, url, params=params, json=json_data) as response:
                response_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                if response.status in [200, 201]:
                    if self.response_format == 'json':
                        data = await response.json()
                    else:
                        # For XML or other formats, return as text for now
                        data = await response.text()
                    
                    return {
                        'success': True,
                        'data': data,
                        'status_code': response.status,
                        'response_time_ms': response_time_ms
                    }
                else:
                    error_text = await response.text()
                    self.error_count += 1
                    logger.warning(f"Generic MES API error: {response.status} - {error_text}")
                    return {
                        'success': False,
                        'error': f"API request failed: {response.status}",
                        'error_details': error_text,
                        'status_code': response.status
                    }
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"Generic MES API request error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _get_paginated_data(self, endpoint: str, params: Dict, data_type: str) -> Optional[List[Dict[str, Any]]]:
        """Get all data using pagination if configured."""
        try:
            all_data = []
            page = 1
            pagination = self.pagination_config.get(data_type, {})
            
            if not pagination:
                # No pagination, single request
                response = await self._make_api_request('GET', endpoint, params=params)
                if response.get('success'):
                    data = response['data']
                    return self._extract_data_from_response(data, data_type, [])
                return None
            
            # Paginated requests
            page_param = pagination.get('page_param', 'page')
            size_param = pagination.get('size_param', 'size')
            page_size = pagination.get('page_size', 100)
            max_pages = pagination.get('max_pages', 100)
            
            while page <= max_pages:
                paginated_params = params.copy()
                paginated_params[page_param] = page
                paginated_params[size_param] = page_size
                
                response = await self._make_api_request('GET', endpoint, params=paginated_params)
                if not response.get('success'):
                    break
                
                data = response['data']
                page_data = self._extract_data_from_response(data, data_type, [])
                
                if not page_data:
                    break
                
                all_data.extend(page_data)
                
                # Check if we got fewer items than page size (last page)
                if len(page_data) < page_size:
                    break
                
                page += 1
            
            return all_data
            
        except Exception as e:
            logger.error(f"Error in paginated data retrieval: {e}")
            return None
    
    def _build_date_range_params(self, date_from: datetime, date_to: datetime, data_type: str) -> Dict[str, Any]:
        """Build query parameters for date range based on configuration."""
        params = {}
        
        # Get parameter mapping for this data type
        param_mapping = self.field_mapping.get('query_params', {}).get(data_type, {})
        
        # Date parameters
        date_from_param = param_mapping.get('date_from', 'date_from')
        date_to_param = param_mapping.get('date_to', 'date_to')
        date_format = param_mapping.get('date_format', '%Y-%m-%dT%H:%M:%S')
        
        params[date_from_param] = date_from.strftime(date_format)
        params[date_to_param] = date_to.strftime(date_format)
        
        # Add any additional static parameters
        additional_params = param_mapping.get('additional_params', {})
        params.update(additional_params)
        
        return params
    
    def _extract_data_from_response(self, response_data: Any, data_type: str, default: Any = None) -> Any:
        """Extract data from response using configured data paths."""
        if not response_data:
            return default
        
        # Get data path configuration
        data_path = self.data_path_mapping.get(data_type)
        
        if not data_path:
            # No specific path configured, return the data as-is or look for common patterns
            if isinstance(response_data, dict):
                # Try common data container names
                for common_name in ['data', 'items', 'results', data_type]:
                    if common_name in response_data:
                        return response_data[common_name]
            return response_data if response_data else default
        
        # Navigate through the data path
        current_data = response_data
        path_parts = data_path.split('.')
        
        for part in path_parts:
            if isinstance(current_data, dict) and part in current_data:
                current_data = current_data[part]
            elif isinstance(current_data, list) and part.isdigit():
                index = int(part)
                if 0 <= index < len(current_data):
                    current_data = current_data[index]
                else:
                    return default
            else:
                return default
        
        return current_data if current_data is not None else default
    
    # Data conversion methods
    
    def _convert_generic_work_order_to_standard(self, generic_wo: Dict[str, Any]) -> Dict[str, Any]:
        """Convert generic work order format to standard format using field mapping."""
        field_map = self.field_mapping.get('work_order', {})
        
        return {
            'work_order_number': self._map_field(generic_wo, field_map, 'work_order_number', 'workOrderNumber'),
            'product_code': self._map_field(generic_wo, field_map, 'product_code', 'productCode'),
            'product_name': self._map_field(generic_wo, field_map, 'product_name', 'productName'),
            'product_version': self._map_field(generic_wo, field_map, 'product_version', 'version'),
            'batch_number': self._map_field(generic_wo, field_map, 'batch_number', 'batchNumber'),
            'lot_number': self._map_field(generic_wo, field_map, 'lot_number', 'lotNumber'),
            'planned_quantity': float(self._map_field(generic_wo, field_map, 'planned_quantity', 'plannedQuantity') or 0),
            'produced_quantity': float(self._map_field(generic_wo, field_map, 'produced_quantity', 'producedQuantity') or 0),
            'unit_of_measure': self._map_field(generic_wo, field_map, 'unit_of_measure', 'unitOfMeasure') or 'EA',
            'status': self._map_field(generic_wo, field_map, 'status', 'status') or 'planned',
            'priority': self._map_field(generic_wo, field_map, 'priority', 'priority') or 'normal',
            'planned_start_time': self._parse_generic_datetime(self._map_field(generic_wo, field_map, 'planned_start_time', 'plannedStartTime')),
            'planned_end_time': self._parse_generic_datetime(self._map_field(generic_wo, field_map, 'planned_end_time', 'plannedEndTime')),
            'actual_start_time': self._parse_generic_datetime(self._map_field(generic_wo, field_map, 'actual_start_time', 'actualStartTime')),
            'actual_end_time': self._parse_generic_datetime(self._map_field(generic_wo, field_map, 'actual_end_time', 'actualEndTime')),
            'custom_data': {
                'original_data': generic_wo,
                'source_system': 'generic_rest'
            }
        }
    
    def _convert_generic_production_record_to_standard(self, generic_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert generic production record format to standard format."""
        field_map = self.field_mapping.get('production_record', {})
        
        return {
            'record_id': self._map_field(generic_record, field_map, 'record_id', 'id') or str(uuid.uuid4()),
            'work_order_number': self._map_field(generic_record, field_map, 'work_order_number', 'workOrderNumber'),
            'equipment_id': self._map_field(generic_record, field_map, 'equipment_id', 'equipmentId'),
            'operator_id': self._map_field(generic_record, field_map, 'operator_id', 'operatorId'),
            'shift_id': self._map_field(generic_record, field_map, 'shift_id', 'shiftId'),
            'quantity_produced': float(self._map_field(generic_record, field_map, 'quantity_produced', 'quantityProduced') or 0),
            'quantity_rejected': float(self._map_field(generic_record, field_map, 'quantity_rejected', 'quantityRejected') or 0),
            'start_time': self._parse_generic_datetime(self._map_field(generic_record, field_map, 'start_time', 'startTime')),
            'end_time': self._parse_generic_datetime(self._map_field(generic_record, field_map, 'end_time', 'endTime')),
            'efficiency_percentage': self._map_field(generic_record, field_map, 'efficiency_percentage', 'efficiency'),
            'custom_data': {
                'original_data': generic_record,
                'source_system': 'generic_rest'
            }
        }
    
    def _convert_generic_quality_record_to_standard(self, generic_record: Dict[str, Any]) -> Dict[str, Any]:
        """Convert generic quality record format to standard format."""
        field_map = self.field_mapping.get('quality_record', {})
        
        return {
            'quality_record_id': self._map_field(generic_record, field_map, 'quality_record_id', 'id') or str(uuid.uuid4()),
            'work_order_number': self._map_field(generic_record, field_map, 'work_order_number', 'workOrderNumber'),
            'inspection_type': self._map_field(generic_record, field_map, 'inspection_type', 'inspectionType'),
            'inspector_id': self._map_field(generic_record, field_map, 'inspector_id', 'inspectorId'),
            'product_code': self._map_field(generic_record, field_map, 'product_code', 'productCode'),
            'batch_number': self._map_field(generic_record, field_map, 'batch_number', 'batchNumber'),
            'item_identifier': self._map_field(generic_record, field_map, 'item_identifier', 'itemId'),
            'overall_status': self._map_field(generic_record, field_map, 'overall_status', 'status') or 'pending',
            'measured_values': self._map_field(generic_record, field_map, 'measured_values', 'measurements') or {},
            'specifications': self._map_field(generic_record, field_map, 'specifications', 'specifications') or {},
            'passed_tests': int(self._map_field(generic_record, field_map, 'passed_tests', 'passedTests') or 0),
            'failed_tests': int(self._map_field(generic_record, field_map, 'failed_tests', 'failedTests') or 0),
            'disposition': self._map_field(generic_record, field_map, 'disposition', 'disposition'),
            'inspection_start_time': self._parse_generic_datetime(self._map_field(generic_record, field_map, 'inspection_start_time', 'inspectionTime')),
            'custom_data': {
                'original_data': generic_record,
                'source_system': 'generic_rest'
            }
        }
    
    def _convert_standard_work_order_to_generic(self, work_order: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard work order format to generic format."""
        field_map = self.field_mapping.get('work_order', {})
        reverse_map = {v: k for k, v in field_map.items()}
        
        generic_data = {}
        for standard_field, value in work_order.items():
            generic_field = reverse_map.get(standard_field, standard_field)
            generic_data[generic_field] = value
        
        return generic_data
    
    def _convert_standard_production_to_generic(self, production: Dict[str, Any]) -> Dict[str, Any]:
        """Convert standard production format to generic format."""
        field_map = self.field_mapping.get('production_record', {})
        reverse_map = {v: k for k, v in field_map.items()}
        
        generic_data = {}
        for standard_field, value in production.items():
            generic_field = reverse_map.get(standard_field, standard_field)
            generic_data[generic_field] = value
        
        return generic_data
    
    def _map_field(self, data: Dict[str, Any], field_map: Dict[str, str], standard_field: str, default_field: str) -> Any:
        """Map a field from generic data to standard format."""
        # Check if there's a custom mapping
        mapped_field = field_map.get(standard_field, default_field)
        
        # Support nested field access with dot notation
        if '.' in mapped_field:
            parts = mapped_field.split('.')
            value = data
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    return None
            return value
        else:
            return data.get(mapped_field)
    
    def _parse_generic_datetime(self, datetime_str: str) -> Optional[datetime]:
        """Parse generic datetime string to Python datetime."""
        if not datetime_str:
            return None
        
        # Try multiple common datetime formats
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%d/%m/%Y %H:%M:%S',
            '%m/%d/%Y %H:%M:%S'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(datetime_str, fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse generic datetime: {datetime_str}")
        return None