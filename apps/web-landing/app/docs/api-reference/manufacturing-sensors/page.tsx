'use client'

import React from 'react'
import Link from 'next/link'
import { Settings, Zap, Eye, Activity, CheckCircle, AlertTriangle, Wrench, BarChart3 } from 'lucide-react'

export default function ManufacturingSensorsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/docs/api-reference" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to API Reference
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Manufacturing Sensor Integration</h1>
          <p className="text-xl text-gray-600">
            Advanced sensor data processing APIs for industrial IoT, predictive maintenance, and real-time monitoring with noise filtering and anomaly detection.
          </p>
        </div>

        {/* Overview */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-600 mb-6">
            Schlep Engine's manufacturing sensor APIs are specifically designed for industrial environments, handling noisy sensor data, 
            electromagnetic interference, and the unique challenges of production floor monitoring. Our ML models are trained on thousands 
            of industrial installations to provide accurate equipment health assessment and predictive maintenance insights.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Industrial Sensor Support</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <ul className="list-disc list-inside text-blue-800 space-y-2">
                <li>Vibration sensors (accelerometers, velocity transducers)</li>
                <li>Temperature sensors (RTDs, thermocouples, infrared)</li>
                <li>Pressure sensors (gauge, absolute, differential)</li>
                <li>Flow sensors (electromagnetic, ultrasonic, turbine)</li>
              </ul>
              <ul className="list-disc list-inside text-blue-800 space-y-2">
                <li>Current/voltage sensors for motor monitoring</li>
                <li>Acoustic emission sensors</li>
                <li>Oil analysis sensors (particle counters, viscosity)</li>
                <li>Custom protocol support (Modbus, OPC-UA, MQTT)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Real-time Sensor Processing */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Real-time Sensor Processing</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/manufacturing/sensor-stream</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Process real-time sensor data streams with automatic noise filtering, anomaly detection, and equipment health scoring. 
              Supports batch and streaming modes with configurable processing windows.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "equipment_id": "pump_001",
  "equipment_type": "centrifugal_pump",
  "timestamp": "2024-01-15T14:30:00Z",
  "sensor_readings": {
    "vibration": {
      "sensor_id": "vib_001",
      "location": "bearing_de",
      "x_axis": [0.12, 0.15, 0.11, 0.13, 0.14],
      "y_axis": [0.08, 0.09, 0.07, 0.08, 0.09],
      "z_axis": [0.03, 0.04, 0.03, 0.03, 0.04],
      "sampling_rate": 25600,
      "units": "g"
    },
    "temperature": {
      "sensor_id": "temp_001",
      "location": "bearing_de",
      "value": 68.5,
      "units": "celsius"
    },
    "pressure": {
      "sensor_id": "press_001",
      "location": "discharge",
      "value": 145.8,
      "units": "psi"
    },
    "flow_rate": {
      "sensor_id": "flow_001",
      "location": "discharge",
      "value": 850.2,
      "units": "gpm"
    },
    "motor_current": {
      "sensor_id": "current_001",
      "phase_a": 42.3,
      "phase_b": 41.8,
      "phase_c": 42.1,
      "units": "amperes"
    }
  },
  "processing_options": {
    "enable_noise_filtering": true,
    "frequency_analysis": true,
    "trend_analysis": true,
    "anomaly_detection": true,
    "health_scoring": true,
    "maintenance_prediction": true
  },
  "equipment_context": {
    "operating_hours": 8760,
    "last_maintenance": "2023-12-01T00:00:00Z",
    "rated_capacity": 1000,
    "normal_operating_temp": 65.0
  }
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "processing_id": "proc_sensor_789",
  "equipment_id": "pump_001",
  "timestamp": "2024-01-15T14:30:00Z",
  "health_assessment": {
    "overall_health_score": 0.78,
    "health_status": "good",
    "degradation_rate": 0.02,
    "estimated_remaining_life": "6_months"
  },
  "anomaly_detection": {
    "anomalies_detected": 1,
    "anomalies": [
      {
        "type": "vibration_spike",
        "severity": "medium",
        "confidence": 0.89,
        "sensor_id": "vib_001",
        "frequency_band": "1x_rpm",
        "description": "Elevated 1X vibration suggests slight imbalance"
      }
    ]
  },
  "processed_signals": {
    "vibration_analysis": {
      "overall_rms": 0.13,
      "peak_frequency": 29.7,
      "frequency_spectrum": {
        "1x_rpm": 0.08,
        "2x_rpm": 0.03,
        "bearing_frequencies": {
          "bpfo": 0.02,
          "bpfi": 0.01,
          "ftf": 0.01,
          "bsf": 0.01
        }
      },
      "trend_indicators": {
        "rms_trend": "increasing",
        "peak_trend": "stable",
        "change_rate": 0.005
      }
    },
    "thermal_analysis": {
      "temperature_status": "normal",
      "thermal_trend": "stable",
      "temperature_gradient": 0.1,
      "hot_spots_detected": false
    },
    "performance_metrics": {
      "efficiency": 0.82,
      "flow_deviation": -0.03,
      "pressure_stability": 0.95,
      "energy_consumption": "normal"
    }
  },
  "maintenance_recommendations": [
    {
      "priority": "medium",
      "action": "balance_check",
      "timeframe": "next_scheduled_maintenance",
      "description": "Check and correct any shaft imbalance",
      "estimated_cost": 500,
      "impact_if_ignored": "accelerated_bearing_wear"
    }
  ],
  "data_quality": {
    "noise_level": 0.12,
    "signal_quality": "good",
    "missing_samples": 0,
    "outliers_filtered": 3,
    "calibration_drift": "within_tolerance"
  },
  "next_analysis": "2024-01-15T15:00:00Z"
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Batch Processing */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Historical Data Analysis</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/manufacturing/batch-analysis</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Analyze historical sensor data to identify long-term trends, predict failure modes, and optimize maintenance schedules. 
              Ideal for processing stored data files or conducting deep equipment health assessments.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "analysis_type": "trend_analysis",
  "equipment_id": "compressor_003",
  "time_range": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-15T23:59:59Z"
  },
  "data_source": {
    "type": "file_upload",
    "file_id": "sensor_data_file_456",
    "format": "csv"
  },
  "analysis_parameters": {
    "trend_detection": true,
    "failure_prediction": true,
    "optimization_recommendations": true,
    "baseline_comparison": true,
    "seasonal_adjustment": true
  },
  "equipment_specifications": {
    "type": "rotary_screw_compressor",
    "rated_pressure": 175,
    "rated_flow": 425,
    "installation_date": "2020-03-15T00:00:00Z",
    "maintenance_history": [
      {
        "date": "2023-09-15T00:00:00Z",
        "type": "oil_change",
        "parts_replaced": ["oil_filter", "air_filter"]
      }
    ]
  }
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "analysis_id": "batch_analysis_123",
  "equipment_id": "compressor_003",
  "analysis_period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-15T23:59:59Z",
    "total_hours": 360
  },
  "trend_analysis": {
    "degradation_trends": [
      {
        "component": "air_end_bearings",
        "trend": "gradual_increase",
        "severity": "low",
        "rate_of_change": 0.003,
        "projected_failure": "2025-08-15T00:00:00Z"
      },
      {
        "component": "oil_cooler",
        "trend": "temperature_increase",
        "severity": "medium",
        "rate_of_change": 0.15,
        "projected_threshold": "2024-06-30T00:00:00Z"
      }
    ],
    "efficiency_trends": {
      "overall_efficiency": {
        "current": 0.89,
        "baseline": 0.92,
        "degradation": 0.03,
        "cost_impact": 240
      },
      "energy_consumption": {
        "current_kwh_per_cfm": 0.21,
        "baseline_kwh_per_cfm": 0.19,
        "increase_percentage": 10.5
      }
    }
  },
  "failure_predictions": [
    {
      "component": "oil_separator",
      "failure_probability": 0.23,
      "predicted_failure_window": {
        "earliest": "2024-09-01T00:00:00Z",
        "most_likely": "2024-11-15T00:00:00Z",
        "latest": "2025-01-30T00:00:00Z"
      },
      "failure_modes": [
        {
          "mode": "differential_pressure_increase",
          "probability": 0.15,
          "indicators": ["pressure_drop", "flow_reduction"]
        },
        {
          "mode": "element_fouling",
          "probability": 0.08,
          "indicators": ["temperature_rise", "efficiency_loss"]
        }
      ]
    }
  ],
  "optimization_recommendations": [
    {
      "category": "operational",
      "priority": "high",
      "action": "adjust_loading_schedule",
      "description": "Reduce load during peak temperature hours (2PM-4PM)",
      "expected_savings": 1200,
      "implementation_effort": "low"
    },
    {
      "category": "maintenance",
      "priority": "medium",
      "action": "oil_cooler_cleaning",
      "description": "Schedule oil cooler cleaning within 30 days",
      "expected_benefit": "restore_5_percent_efficiency",
      "estimated_cost": 350
    }
  ],
  "data_insights": {
    "total_samples_processed": 259200,
    "data_quality_score": 0.94,
    "anomalies_identified": 12,
    "pattern_changes": 3,
    "seasonal_effects": ["summer_temperature_correlation", "weekend_load_reduction"]
  }
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Multi-Equipment Fleet Analysis */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Fleet-wide Equipment Monitoring</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/manufacturing/fleet-analysis</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Monitor and analyze multiple pieces of equipment simultaneously to identify fleet-wide patterns, optimize maintenance schedules, 
              and benchmark equipment performance across your facility.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "facility_id": "plant_north_001",
  "analysis_scope": "production_line_a",
  "equipment_list": [
    {
      "equipment_id": "motor_001",
      "type": "induction_motor",
      "critical_sensors": ["vibration", "temperature", "current"]
    },
    {
      "equipment_id": "pump_002", 
      "type": "centrifugal_pump",
      "critical_sensors": ["vibration", "flow", "pressure"]
    },
    {
      "equipment_id": "conveyor_003",
      "type": "belt_conveyor",
      "critical_sensors": ["belt_tension", "motor_current", "bearing_temp"]
    }
  ],
  "analysis_parameters": {
    "cross_equipment_correlation": true,
    "production_impact_analysis": true,
    "maintenance_optimization": true,
    "performance_benchmarking": true,
    "cost_analysis": true
  },
  "time_window": "24_hours",
  "alert_thresholds": {
    "critical": 0.9,
    "warning": 0.7,
    "maintenance_due": 0.5
  }
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "fleet_analysis_id": "fleet_123",
  "facility_id": "plant_north_001",
  "analysis_timestamp": "2024-01-15T14:30:00Z",
  "overall_fleet_health": {
    "health_score": 0.84,
    "status": "good",
    "equipment_at_risk": 1,
    "maintenance_due": 2
  },
  "equipment_summary": [
    {
      "equipment_id": "motor_001",
      "health_score": 0.92,
      "status": "excellent",
      "alerts": [],
      "next_maintenance": "2024-03-15T00:00:00Z",
      "performance_vs_baseline": 1.02
    },
    {
      "equipment_id": "pump_002",
      "health_score": 0.68,
      "status": "needs_attention",
      "alerts": [
        {
          "type": "efficiency_decline",
          "severity": "medium",
          "description": "Flow rate 8% below optimal"
        }
      ],
      "next_maintenance": "2024-02-01T00:00:00Z",
      "performance_vs_baseline": 0.92
    },
    {
      "equipment_id": "conveyor_003",
      "health_score": 0.89,
      "status": "good",
      "alerts": [
        {
          "type": "belt_wear_indicator",
          "severity": "low",
          "description": "Belt tension slightly elevated"
        }
      ],
      "next_maintenance": "2024-02-28T00:00:00Z",
      "performance_vs_baseline": 0.98
    }
  ],
  "cross_equipment_insights": [
    {
      "correlation": "pump_motor_vibration",
      "strength": 0.87,
      "description": "Pump vibration correlates with motor load variations",
      "recommendation": "Check motor-pump alignment"
    }
  ],
  "production_impact": {
    "current_oee": 0.82,
    "potential_oee": 0.89,
    "bottleneck_equipment": "pump_002",
    "downtime_risk": {
      "next_7_days": 0.15,
      "next_30_days": 0.35
    }
  },
  "maintenance_optimization": {
    "suggested_schedule": [
      {
        "equipment_id": "pump_002",
        "maintenance_type": "impeller_inspection",
        "optimal_date": "2024-01-20T08:00:00Z",
        "duration_hours": 4,
        "production_impact": "minimal"
      }
    ],
    "cost_optimization": {
      "current_annual_cost": 45000,
      "optimized_annual_cost": 38500,
      "potential_savings": 6500
    }
  }
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Sensor Configuration & Calibration */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sensor Configuration & Calibration</h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-blue-50 rounded-lg p-6">
              <Settings className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Automatic Calibration Drift Detection</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Real-time calibration drift monitoring</li>
                <li>• Automatic sensor health assessment</li>
                <li>• Cross-sensor validation algorithms</li>
                <li>• Calibration schedule optimization</li>
              </ul>
            </div>
            
            <div className="bg-green-50 rounded-lg p-6">
              <Wrench className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Noise Filtering & Signal Enhancement</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Advanced digital filtering (Butterworth, Chebyshev)</li>
                <li>• Electromagnetic interference removal</li>
                <li>• Signal conditioning and amplification</li>
                <li>• Frequency domain noise suppression</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Sensor Configuration API</h3>
            <pre className="text-green-400 text-sm overflow-x-auto"><code>{`# Configure sensor processing parameters
curl -X POST https://api.schlep-engine.com/v1/manufacturing/sensor-config \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "equipment_id": "motor_001",
    "sensor_configurations": [
      {
        "sensor_id": "vib_001",
        "type": "accelerometer",
        "sampling_rate": 25600,
        "filter_settings": {
          "highpass_cutoff": 2.0,
          "lowpass_cutoff": 5000.0,
          "filter_type": "butterworth",
          "filter_order": 4
        },
        "alarm_thresholds": {
          "warning": 0.5,
          "critical": 1.0,
          "units": "g_rms"
        },
        "calibration": {
          "sensitivity": 100.0,
          "units": "mv_per_g",
          "last_calibration": "2024-01-01T00:00:00Z",
          "calibration_interval": "annual"
        }
      }
    ],
    "processing_rules": {
      "enable_trend_analysis": true,
      "enable_frequency_analysis": true,
      "enable_cross_sensor_validation": true,
      "data_retention_days": 365
    }
  }'

# Response
{
  "configuration_id": "config_789",
  "status": "configured",
  "sensors_updated": 1,
  "validation_results": {
    "config_valid": true,
    "estimated_processing_load": "medium",
    "storage_requirements_gb": 12.5
  }
}`}</code></pre>
          </div>
        </section>

        {/* Integration Protocols */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Industrial Protocol Support</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Universal Protocol Support</h3>
                <p className="text-yellow-700">
                  Schlep Engine supports all major industrial communication protocols, ensuring seamless integration 
                  with existing SCADA systems, PLCs, and sensor networks without requiring protocol conversions.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Modbus Integration</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Modbus RTU and TCP support</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Custom register mapping</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Real-time polling and caching</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">OPC-UA Integration</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Secure OPC-UA client connections</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Subscription-based data collection</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Node browsing and discovery</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">MQTT & IoT Protocols</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>MQTT broker integration</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>CoAP and HTTP REST APIs</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Edge computing compatibility</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Performance & Scaling */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance & Scaling</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <Activity className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">1000+</h3>
              <p className="text-gray-600">Sensors per Second</p>
              <p className="text-sm text-gray-500 mt-2">Real-time processing capacity</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <Zap className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">&lt;50ms</h3>
              <p className="text-gray-600">Processing Latency</p>
              <p className="text-sm text-gray-500 mt-2">From sensor to insight</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <BarChart3 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">99.9%</h3>
              <p className="text-gray-600">Uptime SLA</p>
              <p className="text-sm text-gray-500 mt-2">Enterprise availability</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Auto-scaling for Industrial Environments</h3>
            <p className="text-blue-700 mb-4">
              Our infrastructure automatically scales to handle varying sensor loads, from small pilot installations 
              to enterprise-wide deployments with thousands of sensors across multiple facilities.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <ul className="list-disc list-inside text-blue-700 space-y-1">
                <li>Automatic load balancing across regions</li>
                <li>Edge computing for ultra-low latency</li>
                <li>Redundant processing paths</li>
              </ul>
              <ul className="list-disc list-inside text-blue-700 space-y-1">
                <li>Industrial-grade security and encryption</li>
                <li>On-premises deployment options</li>
                <li>Hybrid cloud architectures</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Implementation Support</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/contact" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <Settings className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Manufacturing Integration Consultation</h3>
              <p className="text-gray-600">Work with our industrial IoT experts to design and implement sensor integration for your specific equipment and protocols.</p>
            </Link>
            
            <Link href="/docs/integrations" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <Wrench className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Integration Guides</h3>
              <p className="text-gray-600">Step-by-step guides for connecting common industrial protocols and sensor types to Schlep Engine APIs.</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}