# Manufacturing Execution System (MES) Integration Guide

## Overview

The Schlep Engine MES Integration Layer provides comprehensive connectivity and data synchronization capabilities with leading Manufacturing Execution Systems. This integration enables manufacturing companies to:

- Connect existing MES systems (SAP, Siemens, Rockwell, Generic REST APIs)
- Synchronize production data in real-time
- Optimize production schedules using advanced algorithms
- Monitor equipment performance and calculate OEE metrics
- Integrate quality management and traceability
- Combine MES data with IoT sensor insights for enhanced analytics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MES Systems   │    │  Schlep Engine  │    │ Industrial IoT  │
│                 │◄──►│   Integration   │◄──►│    Gateway      │
│ • SAP MES       │    │     Layer       │    │                 │
│ • Siemens       │    │                 │    │ • OPC-UA        │
│ • Rockwell      │    │ • Data Sync     │    │ • MQTT          │
│ • Generic REST  │    │ • Optimization  │    │ • Modbus        │
│                 │    │ • Analytics     │    │ • Sensors       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Production    │
                       │   Intelligence  │
                       │                 │
                       │ • OEE Analysis  │
                       │ • Quality Mgmt  │
                       │ • Predictive    │
                       │   Maintenance   │
                       └─────────────────┘
```

## Supported MES Systems

### SAP Manufacturing Execution
- **SAP ME (Manufacturing Execution)**: Complete production control and tracking
- **SAP DMC (Digital Manufacturing Cloud)**: Cloud-based manufacturing platform
- **Authentication**: OAuth2, SAML, API Keys
- **API Version**: v2.0, v3.0
- **Data Scope**: Work orders, production confirmations, quality records, material movements

### Siemens MES Platforms
- **Siemens MindSphere**: Industrial IoT and analytics platform
- **Siemens Opcenter Execution**: Production execution and control
- **Authentication**: OAuth2, Certificate-based
- **API Version**: v1.0, v2.0
- **Data Scope**: Production orders, operations, resources, quality data

### Rockwell FactoryTalk
- **FactoryTalk Manufacturing Execution System**: Comprehensive MES solution
- **Authentication**: Windows Authentication, OAuth2
- **API Version**: REST API v1.0
- **Data Scope**: Work instructions, material tracking, genealogy, quality

### Generic REST API Support
- **Custom MES Systems**: Any system with REST API capabilities
- **Authentication**: Flexible (OAuth2, API Keys, Basic Auth, Custom)
- **Data Mapping**: Configurable field mappings
- **Format Support**: JSON, XML response formats

## Quick Start

### 1. MES System Connection

Connect to your MES system using the connection API:

```python
import requests

# Connect to SAP MES system
connection_data = {
    "connection_id": "sap_mes_plant_001",
    "connection_config": {
        "system_name": "SAP MES Production Plant 1",
        "system_type": "sap_me",
        "facility_id": "PLANT001",
        "plant_code": "P001",
        "endpoint_url": "https://your-sap-mes.com/api/v2",
        "authentication_method": "oauth2",
        "api_version": "2.0",
        "enabled_modules": ["work_orders", "production", "quality", "materials"],
        "auto_sync_enabled": True,
        "sync_interval_minutes": 15
    },
    "credentials": {
        "client_id": "your_client_id",
        "client_secret": "your_client_secret",
        "scope": "production.read production.write quality.read"
    },
    "validate_connection": True,
    "enable_real_time_sync": True,
    "initial_sync_scope": ["work_orders", "production"]
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/connect",
    json=connection_data,
    headers={"Authorization": "Bearer your_jwt_token"}
)

print(response.json())
```

### 2. Work Order Management

Create and manage work orders:

```python
# Create new work order
work_order_data = {
    "work_order_number": "WO-2025-001",
    "product_code": "WIDGET-ADV-001",
    "product_name": "Advanced Widget Model A",
    "planned_quantity": 1000.0,
    "unit_of_measure": "EA",
    "batch_number": "BATCH-2025-001",
    "planned_start_time": "2025-01-15T08:00:00Z",
    "planned_end_time": "2025-01-15T16:00:00Z",
    "estimated_duration_hours": 8.0,
    "priority": "normal",
    "assigned_line_id": "LINE-001",
    "assigned_equipment_ids": ["EQ-001", "EQ-002", "EQ-003"],
    "assigned_operators": ["OP-101", "OP-102"],
    "quality_requirements": {
        "dimension_tolerance": "±0.1mm",
        "surface_finish": "Ra 0.8μm",
        "material_grade": "304 Stainless Steel"
    },
    "efficiency_target_percentage": 90.0,
    "customer_order_ref": "CO-2025-001"
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/work-orders",
    json=work_order_data,
    params={"connection_id": "sap_mes_plant_001"},
    headers={"Authorization": "Bearer your_jwt_token"}
)
```

### 3. Production Schedule Optimization

Optimize production schedules using advanced algorithms:

```python
# Request production optimization
optimization_request = {
    "schedule_name": "Weekly Production Schedule",
    "facility_id": "PLANT001",
    "production_line_id": "LINE-001",
    "schedule_start_date": "2025-01-15T00:00:00Z",
    "schedule_end_date": "2025-01-22T00:00:00Z",
    "planning_horizon_days": 7,
    "work_order_ids": ["WO-2025-001", "WO-2025-002", "WO-2025-003"],
    "optimization_objectives": ["maximize_throughput", "minimize_makespan", "minimize_cost"],
    "optimization_algorithm": "multi_objective_genetic",
    "consider_material_availability": True,
    "consider_resource_capacity": True,
    "allow_overtime": False
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/production/schedule",
    json=optimization_request,
    headers={"Authorization": "Bearer your_jwt_token"}
)

schedule_result = response.json()
print(f"Optimization Score: {schedule_result['optimization_result']['optimization_score']}")
print(f"Expected Throughput: {schedule_result['optimization_result']['estimated_throughput']}")
```

### 4. OEE Analysis

Calculate comprehensive OEE metrics:

```python
# Get OEE analysis for equipment
response = requests.get(
    "http://localhost:8000/api/v1/manufacturing/mes/oee/EQ-001",
    params={
        "period_start": "2025-01-15T00:00:00Z",
        "period_end": "2025-01-15T23:59:59Z",
        "include_trends": True,
        "include_benchmarking": True
    },
    headers={"Authorization": "Bearer your_jwt_token"}
)

oee_analysis = response.json()
oee_metrics = oee_analysis["oee_metrics"]

print(f"Overall OEE: {oee_metrics['oee_percentage']:.1f}%")
print(f"Availability: {oee_metrics['availability_percentage']:.1f}%")
print(f"Performance: {oee_metrics['performance_percentage']:.1f}%")
print(f"Quality: {oee_metrics['quality_percentage']:.1f}%")

# Display improvement opportunities
for opportunity in oee_analysis["improvement_opportunities"]:
    print(f"• {opportunity['opportunity']}: {opportunity['estimated_impact']}")
```

## Data Synchronization

### Automatic Synchronization

The system provides automatic bidirectional synchronization:

```python
# Configure automatic sync
sync_config = {
    "connection_id": "sap_mes_plant_001",
    "sync_scope": ["work_orders", "production", "quality", "materials", "oee"],
    "full_sync": False,
    "date_from": "2025-01-15T00:00:00Z",
    "validate_data": True,
    "resolve_conflicts": True,
    "backup_before_sync": True
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/sync",
    json=sync_config,
    headers={"Authorization": "Bearer your_jwt_token"}
)

sync_result = response.json()
print(f"Records Processed: {sum(sync_result['records_processed'].values())}")
print(f"Success Rate: {((sum(sync_result['records_processed'].values()) - sum(sync_result['records_failed'].values())) / sum(sync_result['records_processed'].values()) * 100):.1f}%")
```

### Manual Data Sync

For on-demand synchronization:

```python
# Manual sync with specific parameters
manual_sync = {
    "connection_id": "sap_mes_plant_001",
    "sync_scope": ["work_orders"],
    "full_sync": True,
    "date_from": "2025-01-01T00:00:00Z",
    "date_to": "2025-01-31T23:59:59Z",
    "facility_filter": ["PLANT001"],
    "equipment_filter": ["EQ-001", "EQ-002"],
    "validate_data": True
}
```

## Quality Management Integration

### Quality Inspection Recording

Report quality inspection data to the MES system:

```python
# Report quality inspection
quality_data = {
    "work_order_id": "WO-2025-001",
    "inspection_type": "final_inspection",
    "inspection_point": "end_of_line",
    "inspector_id": "INSP-001",
    "item_identifier": "ITEM-001-SN12345",
    "product_code": "WIDGET-ADV-001",
    "batch_number": "BATCH-2025-001",
    "measured_values": {
        "overall_length": 100.05,
        "overall_width": 50.02,
        "surface_roughness": 0.75,
        "hardness_hrc": 58.5
    },
    "specifications": {
        "overall_length": {"min": 99.9, "max": 100.1, "target": 100.0},
        "overall_width": {"min": 49.9, "max": 50.1, "target": 50.0},
        "surface_roughness": {"min": 0.0, "max": 0.8, "target": 0.6},
        "hardness_hrc": {"min": 55.0, "max": 62.0, "target": 58.0}
    },
    "test_results": {
        "dimensional_check": "pass",
        "surface_inspection": "pass",
        "hardness_test": "pass",
        "visual_inspection": "pass"
    },
    "overall_status": "passed",
    "disposition": "accept",
    "inspection_start_time": "2025-01-15T14:30:00Z",
    "inspection_end_time": "2025-01-15T14:45:00Z",
    "standards_referenced": ["ISO 9001", "ASTM A240"]
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/quality/report",
    json=quality_data,
    params={"connection_id": "sap_mes_plant_001"},
    headers={"Authorization": "Bearer your_jwt_token"}
)
```

### Statistical Process Control (SPC)

Integrate SPC data and control charts:

```python
# Quality data with SPC information
spc_data = {
    "statistical_data": {
        "mean": 100.025,
        "std_dev": 0.015,
        "cp": 1.67,
        "cpk": 1.45,
        "pp": 1.58,
        "ppk": 1.42
    },
    "control_limits": {
        "overall_length": {
            "ucl": 100.08,  # Upper Control Limit
            "lcl": 99.92,   # Lower Control Limit
            "target": 100.0
        }
    },
    "out_of_control_points": []
}
```

## IoT Integration and Enhanced Analytics

### Correlating MES Data with IoT Sensors

The integration layer automatically correlates MES production data with IoT sensor readings:

```python
# Get integrated equipment status (MES + IoT)
response = requests.get(
    "http://localhost:8000/api/v1/manufacturing/mes/equipment/EQ-001/integrated-status",
    headers={"Authorization": "Bearer your_jwt_token"}
)

integrated_status = response.json()
print(f"Current Work Order: {integrated_status['current_work_order']['work_order_number']}")
print(f"Production Status: {integrated_status['production_status']['current_phase']}")
print(f"Equipment Health: {integrated_status['equipment_health']['health_score']:.2f}")
print(f"Temperature: {integrated_status['sensor_data']['temperature']}°C")
print(f"Integrated OEE: {integrated_status['integrated_kpis']['integrated_oee']:.1f}%")

# Display recommendations
for recommendation in integrated_status['recommendations']:
    print(f"• {recommendation}")
```

### Predictive Quality with Sensor Data

Predict quality outcomes using real-time sensor data:

```python
# Get quality predictions based on current sensor readings
response = requests.get(
    "http://localhost:8000/api/v1/manufacturing/mes/work-orders/WO-2025-001/quality-prediction",
    headers={"Authorization": "Bearer your_jwt_token"}
)

quality_prediction = response.json()
print(f"Pass Probability: {quality_prediction['pass_probability']:.1%}")
print(f"Confidence: {quality_prediction['confidence_score']:.1%}")

if quality_prediction['predicted_defects']:
    print("Potential Quality Issues:")
    for defect in quality_prediction['predicted_defects']:
        print(f"• {defect}")

print("Recommended Adjustments:")
for param, adjustment in quality_prediction['suggested_adjustments'].items():
    print(f"• {param}: {adjustment}")
```

### Production Optimization with IoT Insights

Optimize production using combined MES and IoT data:

```python
# Request IoT-enhanced production optimization
optimization_request = {
    "facility_id": "PLANT001",
    "optimization_scope": "facility",
    "optimization_timeframe": "weekly",
    "primary_objective": "maximize_oee",
    "secondary_objectives": ["minimize_cost", "maximize_quality"],
    "include_iot_insights": True,
    "include_predictive_maintenance": True,
    "include_quality_predictions": True,
    "algorithm": "multi_objective_genetic",
    "max_iterations": 1000
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/production/optimize-with-iot",
    json=optimization_request,
    headers={"Authorization": "Bearer your_jwt_token"}
)

optimization_result = response.json()
print(f"Expected OEE Improvement: {optimization_result['expected_benefits']['oee_improvement']:.1f}%")
print(f"Quality Improvement: {optimization_result['expected_benefits']['quality_improvement']:.1f}%")
print(f"Maintenance Cost Reduction: ${optimization_result['expected_benefits']['maintenance_cost_reduction']:,.2f}")
print(f"Downtime Reduction: {optimization_result['expected_benefits']['downtime_reduction_hours']:.1f} hours")
```

## Advanced Analytics and Reporting

### Production Performance Dashboard

Create comprehensive production dashboards:

```python
# Get facility-wide production analytics
response = requests.get(
    "http://localhost:8000/api/v1/manufacturing/mes/analytics/facility/PLANT001",
    params={
        "date_from": "2025-01-15T00:00:00Z",
        "date_to": "2025-01-22T00:00:00Z",
        "include_trends": True,
        "include_benchmarking": True,
        "include_forecasts": True
    },
    headers={"Authorization": "Bearer your_jwt_token"}
)

analytics = response.json()

# Display key metrics
print("Production Performance Summary:")
print(f"• Overall OEE: {analytics['summary']['overall_oee']:.1f}%")
print(f"• Total Throughput: {analytics['summary']['total_throughput']:,} units")
print(f"• First Pass Yield: {analytics['summary']['first_pass_yield']:.1f}%")
print(f"• Schedule Adherence: {analytics['summary']['schedule_adherence']:.1f}%")

# Display top performing equipment
print("\nTop Performing Equipment:")
for equipment in analytics['top_performers']['equipment'][:5]:
    print(f"• {equipment['equipment_id']}: OEE {equipment['oee']:.1f}%")

# Display improvement opportunities
print("\nImprovement Opportunities:")
for opportunity in analytics['improvement_opportunities']:
    print(f"• {opportunity['area']}: {opportunity['potential_improvement']}")
```

### Custom Reports and Data Export

Export data for external analysis:

```python
# Export production data
export_request = {
    "report_type": "production_summary",
    "facility_id": "PLANT001",
    "date_from": "2025-01-01T00:00:00Z",
    "date_to": "2025-01-31T23:59:59Z",
    "include_oee_details": True,
    "include_quality_data": True,
    "include_downtime_analysis": True,
    "format": "csv"  # or "json", "excel"
}

response = requests.post(
    "http://localhost:8000/api/v1/manufacturing/mes/reports/export",
    json=export_request,
    headers={"Authorization": "Bearer your_jwt_token"}
)

# Save exported data
with open("production_report.csv", "wb") as f:
    f.write(response.content)
```

## Alert Management and Notifications

### Production Alerts

Monitor and manage production alerts:

```python
# Get current production alerts
response = requests.get(
    "http://localhost:8000/api/v1/manufacturing/mes/alerts",
    params={
        "facility_id": "PLANT001",
        "severity": "high",
        "status": "open"
    },
    headers={"Authorization": "Bearer your_jwt_token"}
)

alerts = response.json()
print(f"Active High Priority Alerts: {alerts['total_count']}")

for alert in alerts['alerts']:
    print(f"\n• {alert['title']}")
    print(f"  Equipment: {alert['equipment_id']}")
    print(f"  Impact: {alert['production_impact']}")
    print(f"  Triggered: {alert['triggered_at']}")
    
    if alert['recommended_actions']:
        print("  Recommended Actions:")
        for action in alert['recommended_actions']:
            print(f"    - {action}")

# Acknowledge an alert
alert_id = alerts['alerts'][0]['alert_id']
response = requests.post(
    f"http://localhost:8000/api/v1/manufacturing/mes/alerts/{alert_id}/acknowledge",
    headers={"Authorization": "Bearer your_jwt_token"}
)
```

### Configurable Alert Thresholds

Set up custom alert conditions:

```python
# Configure alert thresholds
alert_config = {
    "facility_id": "PLANT001",
    "alert_rules": [
        {
            "name": "Low OEE Alert",
            "condition": "oee_percentage < 70",
            "severity": "medium",
            "equipment_filter": ["EQ-001", "EQ-002"],
            "notification_channels": ["email", "webhook"]
        },
        {
            "name": "Quality Failure Alert", 
            "condition": "quality_pass_rate < 95",
            "severity": "high",
            "escalation_minutes": 15,
            "notification_channels": ["email", "sms", "webhook"]
        },
        {
            "name": "Equipment Health Alert",
            "condition": "health_score < 0.7 OR predicted_failure_probability > 0.3",
            "severity": "critical",
            "immediate_notification": True
        }
    ]
}
```

## Security and Compliance

### Authentication and Authorization

The MES integration supports multiple authentication methods:

```python
# OAuth2 Authentication (Recommended)
oauth_config = {
    "authentication_method": "oauth2",
    "credentials": {
        "client_id": "your_client_id",
        "client_secret": "your_client_secret",
        "authorization_url": "https://your-mes.com/oauth/authorize",
        "token_url": "https://your-mes.com/oauth/token",
        "scope": "production.read production.write quality.read"
    }
}

# API Key Authentication
api_key_config = {
    "authentication_method": "api_key",
    "credentials": {
        "api_key": "your_api_key",
        "key_header": "X-API-Key"  # or "Authorization"
    }
}

# Certificate-based Authentication (for high-security environments)
cert_config = {
    "authentication_method": "certificate",
    "credentials": {
        "cert_file": "/path/to/client.crt",
        "key_file": "/path/to/client.key",
        "ca_file": "/path/to/ca.crt"
    }
}
```

### Data Encryption and Security

All data transmissions are encrypted and secure:

- **TLS 1.3** encryption for all API communications
- **Field-level encryption** for sensitive production data
- **Audit logging** for all data access and modifications
- **Role-based access control** for different user types
- **Data retention policies** for compliance requirements

### Compliance Features

Built-in compliance support for manufacturing regulations:

```python
# Configure compliance requirements
compliance_config = {
    "facility_id": "PLANT001",
    "regulatory_frameworks": ["ISO 9001", "FDA 21 CFR Part 11", "IATF 16949"],
    "audit_trail_required": True,
    "electronic_signature_required": True,
    "data_integrity_validation": True,
    "batch_record_management": True,
    "traceability_requirements": {
        "material_genealogy": True,
        "lot_tracking": True,
        "serial_number_tracking": True,
        "supplier_traceability": True
    }
}
```

## Troubleshooting

### Common Connection Issues

1. **Authentication Failures**
   ```python
   # Check credentials and token validity
   response = requests.get(
       "http://localhost:8000/api/v1/manufacturing/mes/connections/test-connection/status",
       headers={"Authorization": "Bearer your_jwt_token"}
   )
   
   status = response.json()
   if not status['success']:
       print(f"Connection Error: {status['last_error']}")
   ```

2. **Synchronization Problems**
   ```python
   # Check sync status and performance
   response = requests.get(
       "http://localhost:8000/api/v1/manufacturing/mes/sync/test-connection/status",
       headers={"Authorization": "Bearer your_jwt_token"}
   )
   
   sync_status = response.json()
   print(f"Sync Health: {sync_status['sync_health_status']}")
   print(f"Last Successful Sync: {sync_status['last_successful_sync']}")
   ```

3. **Data Quality Issues**
   ```python
   # Monitor data quality metrics
   if sync_result['data_quality_score'] < 0.9:
       print("Data quality issues detected:")
       for issue in sync_result['validation_issues']:
           print(f"• {issue['field']}: {issue['error']}")
   ```

### Performance Optimization

1. **Optimize Sync Intervals**
   - Increase sync interval for stable environments
   - Use real-time sync only for critical data
   - Implement incremental sync for large datasets

2. **Connection Pooling**
   ```python
   # Configure connection pool settings
   connection_config = {
       "connection_pool_size": 10,
       "max_connections_per_host": 5,
       "connection_timeout_seconds": 30,
       "request_timeout_seconds": 60
   }
   ```

3. **Batch Processing**
   ```python
   # Use batch operations for bulk data
   batch_config = {
       "batch_size": 100,
       "batch_timeout_seconds": 300,
       "parallel_batches": 5
   }
   ```

## API Reference

### Complete Endpoint List

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/manufacturing/mes/connect` | POST | Connect to MES system |
| `/api/v1/manufacturing/mes/connections` | GET | List MES connections |
| `/api/v1/manufacturing/mes/connections/{id}` | DELETE | Disconnect MES system |
| `/api/v1/manufacturing/mes/connections/{id}/status` | GET | Get connection status |
| `/api/v1/manufacturing/mes/sync` | POST | Synchronize data |
| `/api/v1/manufacturing/mes/sync/{id}/status` | GET | Get sync status |
| `/api/v1/manufacturing/mes/work-orders` | GET/POST | Manage work orders |
| `/api/v1/manufacturing/mes/work-orders/{id}` | PUT | Update work order |
| `/api/v1/manufacturing/mes/production/schedule` | POST | Create production schedule |
| `/api/v1/manufacturing/mes/production/optimize` | POST | Optimize production |
| `/api/v1/manufacturing/mes/oee/{equipment_id}` | GET | Get OEE analysis |
| `/api/v1/manufacturing/mes/quality/report` | POST | Report quality data |
| `/api/v1/manufacturing/mes/quality/records` | GET | Get quality records |
| `/api/v1/manufacturing/mes/alerts` | GET | Get production alerts |
| `/api/v1/manufacturing/mes/alerts/{id}/acknowledge` | POST | Acknowledge alert |

### WebSocket Support

For real-time data streaming:

```javascript
// JavaScript WebSocket client example
const ws = new WebSocket('ws://localhost:8000/api/v1/manufacturing/mes/ws/realtime');

ws.onopen = function(event) {
    console.log('Connected to MES real-time feed');
    
    // Subscribe to specific data streams
    ws.send(JSON.stringify({
        action: 'subscribe',
        streams: ['work_orders', 'oee_metrics', 'quality_alerts'],
        facility_id: 'PLANT001'
    }));
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'work_order_update':
            console.log('Work Order Update:', data.payload);
            break;
        case 'oee_metric':
            console.log('OEE Metric:', data.payload);
            break;
        case 'quality_alert':
            console.log('Quality Alert:', data.payload);
            break;
    }
};
```

## Support and Resources

### Documentation Links
- [API Reference Documentation](./API_REFERENCE.md)
- [IoT Gateway Integration Guide](./IOT_INTEGRATION_GUIDE.md)
- [Database Schema Reference](./DATABASE_SCHEMA.md)
- [Security Configuration Guide](./SECURITY_GUIDE.md)

### Sample Applications
- [MES Dashboard Demo](../examples/mes_dashboard_demo.py)
- [Production Analytics Script](../examples/production_analytics_example.py)
- [Quality Management Integration](../examples/quality_management_example.py)

### Community and Support
- GitHub Issues: Report bugs and feature requests
- Documentation Wiki: Community-contributed guides and examples
- Developer Forum: Technical discussions and support

For technical support, please contact the development team or create an issue in the project repository.